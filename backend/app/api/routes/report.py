"""
Session report endpoint.

GET /api/sessions/{session_id}/report

Aggregates all questions + answers for a session into one report object.
Also updates the session's overall_score and completed_at when all
questions have been both answered and evaluated — marking it "done."
"""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.interview import Answer, InterviewSession, Question
from app.models.user import User
from app.schemas.report import AnswerDetail, SessionReport
from app.services.evaluation import compute_session_overall_score, _compute_overall_score

router = APIRouter(tags=["report"])


@router.get(
    "/api/sessions/{session_id}/report",
    response_model=SessionReport,
    summary="Get full session report with aggregated scores",
)
async def get_session_report(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the full session report:
    - per-question scores, transcripts, and feedback
    - aggregated overall session score
    - session completion status

    If all questions have been answered AND evaluated (have a content_score),
    the session is automatically marked as completed and the overall_score
    is written to the database.
    """
    # Load session with questions + answers eagerly
    result = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .options(
            selectinload(InterviewSession.questions).selectinload(Question.answer)
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    questions = sorted(session.questions, key=lambda q: q.order_index)

    answer_details: list[AnswerDetail] = []
    per_question_scores: list[float] = []
    answered_count = 0
    evaluated_count = 0

    for question in questions:
        answer: Answer | None = question.answer

        if answer is None:
            answer_details.append(AnswerDetail(
                question_id=question.id,
                question_text=question.question_text,
                order_index=question.order_index,
                transcript=None,
                eye_contact_score=None,
                posture_score=None,
                content_score=None,
                overall_score=None,
                feedback=None,
                audio_duration_seconds=None,
            ))
            continue

        answered_count += 1

        # Recompute the blended overall score at report time from stored fields
        overall_score: float | None = None
        if answer.content_score is not None:
            evaluated_count += 1
            overall_score = _compute_overall_score(
                content_score=answer.content_score,
                eye_contact_score=answer.eye_contact_score,
                posture_score=answer.posture_score,
            )
            per_question_scores.append(overall_score)

        answer_details.append(AnswerDetail(
            question_id=question.id,
            question_text=question.question_text,
            order_index=question.order_index,
            transcript=answer.transcript,
            eye_contact_score=answer.eye_contact_score,
            posture_score=answer.posture_score,
            content_score=answer.content_score,
            overall_score=overall_score,
            feedback=answer.feedback,
            audio_duration_seconds=answer.audio_duration_seconds,
        ))

    session_overall = compute_session_overall_score(per_question_scores)
    total_questions = len(questions)

    # Auto-complete the session when every question is answered and evaluated
    all_done = (answered_count == total_questions == evaluated_count > 0)
    if all_done and session.completed_at is None:
        session.overall_score = session_overall
        session.completed_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(session)

    return SessionReport(
        session_id=session.id,
        role=session.role,
        difficulty=session.difficulty,
        started_at=session.started_at,
        completed_at=session.completed_at,
        overall_score=session_overall,
        total_questions=total_questions,
        answered_questions=answered_count,
        evaluated_questions=evaluated_count,
        answers=answer_details,
    )