from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.interview import InterviewSession, Question
from app.models.user import User
from app.schemas.session import SessionCreate, SessionResponse
from app.services.question_generation import generate_questions


router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("/", response_model=SessionResponse, status_code=status.HTTP_201_CREATED)
async def create_session(
    payload: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Create a new interview session.

    Two modes:
    - Generic: generates questions via Groq based on role + difficulty
    - Resume-based: uses `custom_questions` pre-generated from the resume
      (via POST /api/resume/analyze) instead of calling the LLM again
    """
    if payload.custom_questions:
        # Resume-based session — questions already generated from resume
        questions_text = payload.custom_questions
        is_resume_based = True
    else:
        # Generic session — generate via LLM
        questions_text = await generate_questions(
            role=payload.role,
            difficulty=payload.difficulty,
            count=payload.question_count,
        )
        is_resume_based = False

    if not questions_text:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Could not generate questions. Please try again.",
        )

    session = InterviewSession(
        user_id=current_user.id,
        role=payload.role,
        difficulty=payload.difficulty,
        is_resume_based=is_resume_based,
        resume_text=payload.resume_text,
    )
    db.add(session)
    await db.flush()

    for idx, text in enumerate(questions_text):
        db.add(Question(
            session_id=session.id,
            question_text=text,
            order_index=idx,
            is_followup=False,
        ))

    await db.commit()

    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.id == session.id)
        .options(selectinload(InterviewSession.questions))
    )
    return result.scalar_one()


@router.get("/", response_model=list[SessionResponse])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession)
        .where(InterviewSession.user_id == current_user.id)
        .options(selectinload(InterviewSession.questions))
        .order_by(InterviewSession.started_at.desc())
    )
    return result.scalars().all()


@router.get("/{session_id}", response_model=SessionResponse)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(InterviewSession)
        .where(
            InterviewSession.id == session_id,
            InterviewSession.user_id == current_user.id,
        )
        .options(selectinload(InterviewSession.questions))
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.delete("/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_all_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Permanently delete all sessions for the current user.
    Cascades to questions and answers automatically.
    """
    await db.execute(
        sql_delete(InterviewSession).where(
            InterviewSession.user_id == current_user.id
        )
    )
    await db.commit()