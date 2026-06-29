import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.interview import Answer, InterviewSession, Question
from app.models.user import User
from app.schemas.answer import AnswerResponse
from app.schemas.session import QuestionResponse
from app.services.evaluation import evaluate_answer
from app.services.resume_questions import generate_followup_question
from app.services.transcription import TranscriptionError, transcribe_audio

logger = logging.getLogger(__name__)

router = APIRouter(tags=["answers"])


async def _get_question_or_404(
    session_id: int,
    question_id: int,
    user_id: int,
    db: AsyncSession,
) -> Question:
    result = await db.execute(
        select(Question)
        .join(InterviewSession, Question.session_id == InterviewSession.id)
        .where(
            Question.id == question_id,
            Question.session_id == session_id,
            InterviewSession.user_id == user_id,
        )
    )
    question = result.scalar_one_or_none()
    if question is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    return question


@router.post(
    "/api/sessions/{session_id}/answers/{question_id}",
    response_model=AnswerResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit audio answer for a question",
)
async def submit_answer(
    session_id: int,
    question_id: int,
    audio: UploadFile = File(...),
    eye_contact_score: float | None = Form(default=None, ge=0.0, le=1.0),
    posture_score: float | None = Form(default=None, ge=0.0, le=1.0),
    audio_duration_seconds: float | None = Form(default=None, ge=0.0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _get_question_or_404(session_id, question_id, current_user.id, db)
    audio_bytes = await audio.read()
    filename = audio.filename or "recording.webm"

    transcript: str | None = None
    try:
        transcript = await transcribe_audio(audio_bytes, filename)
    except TranscriptionError as exc:
        logger.warning("Transcription failed for question %d: %s", question_id, exc)

    existing_result = await db.execute(select(Answer).where(Answer.question_id == question.id))
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.transcript = transcript
        existing.eye_contact_score = eye_contact_score
        existing.posture_score = posture_score
        existing.audio_duration_seconds = audio_duration_seconds
        existing.content_score = None
        existing.feedback = None
        answer = existing
    else:
        answer = Answer(
            question_id=question.id,
            transcript=transcript,
            eye_contact_score=eye_contact_score,
            posture_score=posture_score,
            audio_duration_seconds=audio_duration_seconds,
        )
        db.add(answer)

    await db.commit()
    await db.refresh(answer)
    return answer


@router.get(
    "/api/sessions/{session_id}/answers/{question_id}",
    response_model=AnswerResponse,
)
async def get_answer(
    session_id: int,
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    question = await _get_question_or_404(session_id, question_id, current_user.id, db)
    result = await db.execute(select(Answer).where(Answer.question_id == question.id))
    answer = result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not answered yet")
    return answer


@router.post(
    "/api/sessions/{session_id}/answers/{question_id}/evaluate",
    response_model=AnswerResponse,
    summary="Run LLM evaluation on a submitted answer",
)
async def evaluate_answer_endpoint(
    session_id: int,
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.services.groq_client import GroqGenerationError

    question = await _get_question_or_404(session_id, question_id, current_user.id, db)
    answer_result = await db.execute(select(Answer).where(Answer.question_id == question.id))
    answer = answer_result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No answer found. Submit audio first.")

    session_result = await db.execute(select(InterviewSession).where(InterviewSession.id == session_id))
    session = session_result.scalar_one()

    try:
        result = await evaluate_answer(
            question=question.question_text,
            transcript=answer.transcript,
            role=session.role,
            eye_contact_score=answer.eye_contact_score,
            posture_score=answer.posture_score,
        )
    except (GroqGenerationError, ValueError) as exc:
        logger.error("Evaluation failed for question %d: %s", question_id, exc)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Evaluation failed: {exc}. Please try again.",
        )

    answer.content_score = result.content_score
    answer.feedback = result.feedback
    await db.commit()
    await db.refresh(answer)
    return answer


@router.post(
    "/api/sessions/{session_id}/answers/{question_id}/followup",
    response_model=QuestionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Generate a follow-up question based on the candidate's answer",
)
async def generate_followup_endpoint(
    session_id: int,
    question_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Aira generates a contextual follow-up question based on what the
    candidate just said. The follow-up is saved as a new question in
    the session so it appears in the session report.
    """
    from app.services.groq_client import GroqGenerationError

    question = await _get_question_or_404(session_id, question_id, current_user.id, db)

    # Require an answer to exist before generating a follow-up
    answer_result = await db.execute(select(Answer).where(Answer.question_id == question.id))
    answer = answer_result.scalar_one_or_none()
    if answer is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submit an answer first before requesting a follow-up.",
        )

    # Load session for role + resume_text context
    session_result = await db.execute(
        select(InterviewSession).where(InterviewSession.id == session_id)
    )
    session = session_result.scalar_one()

    # Generate follow-up
    try:
        followup_text = await generate_followup_question(
            original_question=question.question_text,
            transcript=answer.transcript or "",
            role=session.role,
            resume_text=session.resume_text,
        )
    except (GroqGenerationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not generate follow-up: {exc}",
        )

    # Find max order_index in this session and add the follow-up after it
    max_result = await db.execute(
        select(func.max(Question.order_index)).where(Question.session_id == session_id)
    )
    max_order = max_result.scalar() or 0

    new_question = Question(
        session_id=session_id,
        question_text=followup_text,
        order_index=max_order + 1,
        is_followup=True,
    )
    db.add(new_question)
    await db.commit()
    await db.refresh(new_question)
    return new_question