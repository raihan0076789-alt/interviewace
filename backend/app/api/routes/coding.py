"""
Coding interview API routes.

Endpoints:
  POST   /api/coding/sessions/                    Create session + generate problems
  GET    /api/coding/sessions/                    List user's coding sessions
  DELETE /api/coding/sessions/                    Clear all user's coding sessions
  GET    /api/coding/sessions/{id}                Get session with problems + submissions
  POST   /api/coding/sessions/{id}/run            Run code against sample test cases
  POST   /api/coding/sessions/{id}/submit         Submit + evaluate full solution
  POST   /api/coding/sessions/{id}/followup       Generate Aira follow-up question
  POST   /api/coding/sessions/{id}/followup/answer Submit user's follow-up answer
  GET    /api/coding/sessions/{id}/report         Full coding report
"""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.coding import (
    CodingFollowup, CodingProblem, CodingSession, CodingSubmission,
)
from app.models.user import User
from app.schemas.coding import (
    CodingFollowupResponse, CodingProblemResponse, CodingReportResponse,
    CodingSessionCreate, CodingSessionResponse, FollowupAnswerRequest,
    FollowupRequest, ProblemReportDetail, RunCodeRequest, RunResultResponse,
    SubmissionResponse, SubmitCodeRequest, TestCaseResultResponse,
)
from app.services.code_evaluator import evaluate_code
from app.services.code_executor import run_test_cases
from app.services.coding_questions import (
    generate_coding_problem, generate_followup_question,
)
from app.services.groq_client import GroqGenerationError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/coding", tags=["coding"])


# ── Helpers ────────────────────────────────────────────────────────────────

def _problem_to_response(problem: CodingProblem) -> CodingProblemResponse:
    """Convert ORM object → response schema, exposing only sample test cases."""
    all_tcs = problem.test_cases or []
    sample_tcs = [tc for tc in all_tcs if tc.get("is_sample", False)]
    return CodingProblemResponse(
        id=problem.id,
        session_id=problem.session_id,
        title=problem.title,
        difficulty=problem.difficulty,
        description=problem.description,
        solution_hint=problem.solution_hint,
        order_index=problem.order_index,
        examples=problem.examples or [],
        constraints=problem.constraints or [],
        starter_code=problem.starter_code or {},
        sample_test_cases=sample_tcs,
        submissions=[
            SubmissionResponse(
                id=s.id,
                problem_id=s.problem_id,
                language=s.language,
                status=s.status,
                test_cases_passed=s.test_cases_passed,
                test_cases_total=s.test_cases_total,
                execution_time_ms=s.execution_time_ms,
                code_quality_score=s.code_quality_score,
                overall_score=s.overall_score,
                ai_feedback=s.ai_feedback,
                submitted_at=s.submitted_at,
            )
            for s in (problem.submissions or [])
        ],
    )


async def _get_session_or_404(
    session_id: int, user_id: int, db: AsyncSession
) -> CodingSession:
    result = await db.execute(
        select(CodingSession)
        .where(CodingSession.id == session_id, CodingSession.user_id == user_id)
        .options(
            selectinload(CodingSession.problems)
            .selectinload(CodingProblem.submissions)
            .selectinload(CodingSubmission.followups)
        )
    )
    session = result.scalar_one_or_none()
    if session is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/sessions/", response_model=CodingSessionResponse, status_code=201)
async def create_coding_session(
    payload: CodingSessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a coding session and generate problems via Groq LLM."""
    session = CodingSession(
        user_id=current_user.id,
        role=payload.role,
        difficulty=payload.difficulty,
        primary_language=payload.language,
    )
    db.add(session)
    await db.flush()  # get session.id

    problems_added = []
    for i in range(payload.problem_count):
        try:
            prob_data = await generate_coding_problem(payload.role, payload.difficulty, i)
        except (GroqGenerationError, ValueError) as exc:
            logger.error("Problem generation failed (index %d): %s", i, exc)
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Could not generate coding problem: {exc}",
            )

        problem = CodingProblem(
            session_id=session.id,
            title=prob_data.title,
            difficulty=prob_data.difficulty,
            description=prob_data.description,
            solution_hint=prob_data.solution_hint,
            order_index=i,
            examples=prob_data.examples,
            constraints=prob_data.constraints,
            test_cases=prob_data.test_cases,
            starter_code=prob_data.starter_code,
        )
        db.add(problem)
        problems_added.append(problem)

    await db.commit()

    # Reload with relationships
    result = await db.execute(
        select(CodingSession)
        .where(CodingSession.id == session.id)
        .options(
            selectinload(CodingSession.problems)
            .selectinload(CodingProblem.submissions)
        )
    )
    session = result.scalar_one()
    return CodingSessionResponse(
        id=session.id,
        role=session.role,
        difficulty=session.difficulty,
        primary_language=session.primary_language,
        started_at=session.started_at,
        completed_at=session.completed_at,
        overall_score=session.overall_score,
        problems=[_problem_to_response(p) for p in session.problems],
    )


@router.get("/sessions/", response_model=list[CodingSessionResponse])
async def list_coding_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(CodingSession)
        .where(CodingSession.user_id == current_user.id)
        .options(selectinload(CodingSession.problems).selectinload(CodingProblem.submissions))
        .order_by(CodingSession.started_at.desc())
    )
    sessions = result.scalars().all()
    return [
        CodingSessionResponse(
            id=s.id, role=s.role, difficulty=s.difficulty,
            primary_language=s.primary_language, started_at=s.started_at,
            completed_at=s.completed_at, overall_score=s.overall_score,
            problems=[_problem_to_response(p) for p in s.problems],
        )
        for s in sessions
    ]


@router.delete("/sessions/", status_code=status.HTTP_204_NO_CONTENT)
async def clear_coding_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await db.execute(
        sql_delete(CodingSession).where(CodingSession.user_id == current_user.id)
    )
    await db.commit()


@router.get("/sessions/{session_id}", response_model=CodingSessionResponse)
async def get_coding_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await _get_session_or_404(session_id, current_user.id, db)
    return CodingSessionResponse(
        id=session.id, role=session.role, difficulty=session.difficulty,
        primary_language=session.primary_language, started_at=session.started_at,
        completed_at=session.completed_at, overall_score=session.overall_score,
        problems=[_problem_to_response(p) for p in session.problems],
    )


@router.post("/sessions/{session_id}/run", response_model=RunResultResponse)
async def run_code(
    session_id: int,
    payload: RunCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Run code against sample test cases only. Does NOT store results."""
    session = await _get_session_or_404(session_id, current_user.id, db)

    problem = next(
        (p for p in session.problems if p.id == payload.problem_id), None
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found in this session")

    test_cases = problem.test_cases or []
    results = await run_test_cases(
        code=payload.code,
        language=payload.language,
        test_cases=test_cases,
        sample_only=True,
    )

    return RunResultResponse(
        test_results=[
            TestCaseResultResponse(
                passed=r.passed, stdin=r.stdin, expected=r.expected,
                got=r.got, status=r.status,
                execution_time_ms=r.execution_time_ms, stderr=r.stderr,
            )
            for r in results
        ],
        total_passed=sum(1 for r in results if r.passed),
        total_ran=len(results),
        language=payload.language,
    )


@router.post("/sessions/{session_id}/submit", response_model=SubmissionResponse)
async def submit_solution(
    session_id: int,
    payload: SubmitCodeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit solution — runs ALL test cases + evaluates with LLM.
    Stores and returns the submission with AI feedback.
    """
    session = await _get_session_or_404(session_id, current_user.id, db)

    problem = next(
        (p for p in session.problems if p.id == payload.problem_id), None
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found in this session")

    test_cases = problem.test_cases or []

    # Run all test cases
    results = await run_test_cases(
        code=payload.code,
        language=payload.language,
        test_cases=test_cases,
        sample_only=False,
    )

    passed = sum(1 for r in results if r.passed)
    total = len(results)
    avg_time = (
        sum(r.execution_time_ms for r in results) / max(total, 1)
    )

    # Determine overall execution status
    if total > 0 and passed == total:
        exec_status = "accepted"
    elif any(r.status == "compile_error" for r in results):
        exec_status = "compile_error"
    elif any(r.status == "runtime_error" for r in results):
        exec_status = "runtime_error"
    elif any(r.status == "time_limit" for r in results):
        exec_status = "time_limit"
    else:
        exec_status = "wrong_answer"

    # LLM evaluation
    ai_feedback_dict: dict | None = None
    code_quality: float | None = None
    overall_score: float | None = None

    try:
        eval_result = await evaluate_code(
            problem_title=problem.title,
            problem_description=problem.description,
            code=payload.code,
            language=payload.language,
            passed=passed,
            total=total,
            role=session.role,
        )
        code_quality = eval_result.code_quality_score
        overall_score = eval_result.overall_score
        ai_feedback_dict = {
            "feedback": eval_result.feedback,
            "time_complexity": eval_result.time_complexity,
            "space_complexity": eval_result.space_complexity,
            "strengths": eval_result.strengths,
            "weaknesses": eval_result.weaknesses,
            "optimizations": eval_result.optimizations,
            "readability": eval_result.readability,
        }
    except (GroqGenerationError, ValueError) as exc:
        logger.warning("Code evaluation failed, skipping AI feedback: %s", exc)

    # Store submission
    submission = CodingSubmission(
        problem_id=problem.id,
        code=payload.code,
        language=payload.language,
        status=exec_status,
        test_cases_passed=passed,
        test_cases_total=total,
        execution_time_ms=round(avg_time, 2),
        code_quality_score=code_quality,
        overall_score=overall_score,
        ai_feedback=ai_feedback_dict,
    )
    db.add(submission)

    # Update session overall_score (mean of all submitted problems' scores)
    await db.flush()
    await _update_session_score(session, db)
    await db.commit()
    await db.refresh(submission)

    return SubmissionResponse(
        id=submission.id,
        problem_id=submission.problem_id,
        language=submission.language,
        status=submission.status,
        test_cases_passed=submission.test_cases_passed,
        test_cases_total=submission.test_cases_total,
        execution_time_ms=submission.execution_time_ms,
        code_quality_score=submission.code_quality_score,
        overall_score=submission.overall_score,
        ai_feedback=submission.ai_feedback,
        submitted_at=submission.submitted_at,
        test_results=[
            TestCaseResultResponse(
                passed=r.passed, stdin=r.stdin, expected=r.expected,
                got=r.got, status=r.status,
                execution_time_ms=r.execution_time_ms, stderr=r.stderr,
            )
            for r in results
        ],
    )


async def _update_session_score(session: CodingSession, db: AsyncSession) -> None:
    """Recompute session.overall_score as mean of best submission per problem."""
    scores = []
    for problem in session.problems:
        # Reload submissions for this problem
        result = await db.execute(
            select(CodingSubmission.overall_score)
            .where(
                CodingSubmission.problem_id == problem.id,
                CodingSubmission.overall_score.is_not(None),
            )
        )
        prob_scores = [row[0] for row in result.fetchall()]
        if prob_scores:
            scores.append(max(prob_scores))

    if scores:
        session.overall_score = round(sum(scores) / len(scores), 1)


@router.post("/sessions/{session_id}/followup", response_model=CodingFollowupResponse)
async def generate_followup(
    session_id: int,
    payload: FollowupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate an Aira follow-up question for a submitted solution."""
    session = await _get_session_or_404(session_id, current_user.id, db)

    # Find submission and its problem
    submission_result = await db.execute(
        select(CodingSubmission)
        .join(CodingProblem, CodingSubmission.problem_id == CodingProblem.id)
        .where(
            CodingSubmission.id == payload.submission_id,
            CodingProblem.session_id == session_id,
        )
        .options(selectinload(CodingSubmission.followups))
    )
    submission = submission_result.scalar_one_or_none()
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")

    # Find the problem
    problem = next(
        (p for p in session.problems if p.id == submission.problem_id), None
    )
    if problem is None:
        raise HTTPException(status_code=404, detail="Problem not found")

    followup_index = len(submission.followups)

    try:
        question = await generate_followup_question(
            problem_title=problem.title,
            problem_description=problem.description,
            code=submission.code,
            language=submission.language,
            role=session.role,
            test_cases_passed=submission.test_cases_passed,
            test_cases_total=submission.test_cases_total,
            followup_index=followup_index,
        )
    except (GroqGenerationError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not generate follow-up: {exc}",
        )

    followup = CodingFollowup(
        submission_id=submission.id,
        question=question,
        order_index=followup_index,
    )
    db.add(followup)
    await db.commit()
    await db.refresh(followup)

    return CodingFollowupResponse(
        id=followup.id,
        submission_id=followup.submission_id,
        question=followup.question,
        user_answer=followup.user_answer,
        order_index=followup.order_index,
        created_at=followup.created_at,
    )


@router.post("/sessions/{session_id}/followup/answer", response_model=CodingFollowupResponse)
async def submit_followup_answer(
    session_id: int,
    payload: FollowupAnswerRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Save user's text answer to a follow-up question."""
    # Verify the followup belongs to this user's session
    result = await db.execute(
        select(CodingFollowup)
        .join(CodingSubmission, CodingFollowup.submission_id == CodingSubmission.id)
        .join(CodingProblem, CodingSubmission.problem_id == CodingProblem.id)
        .join(CodingSession, CodingProblem.session_id == CodingSession.id)
        .where(
            CodingFollowup.id == payload.followup_id,
            CodingSession.id == session_id,
            CodingSession.user_id == current_user.id,
        )
    )
    followup = result.scalar_one_or_none()
    if followup is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")

    followup.user_answer = payload.answer
    await db.commit()
    await db.refresh(followup)

    return CodingFollowupResponse(
        id=followup.id,
        submission_id=followup.submission_id,
        question=followup.question,
        user_answer=followup.user_answer,
        order_index=followup.order_index,
        created_at=followup.created_at,
    )


@router.get("/sessions/{session_id}/report", response_model=CodingReportResponse)
async def get_coding_report(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Full coding interview report with all submissions and follow-ups."""
    session = await _get_session_or_404(session_id, current_user.id, db)

    total_passed = 0
    total_tcs = 0
    submitted_problems = 0
    problem_details: list[ProblemReportDetail] = []

    for problem in sorted(session.problems, key=lambda p: p.order_index):
        subs = sorted(problem.submissions or [], key=lambda s: s.submitted_at)

        # Best submission = highest overall_score, or latest if no scores
        best: CodingSubmission | None = None
        if subs:
            scored = [s for s in subs if s.overall_score is not None]
            best = max(scored, key=lambda s: s.overall_score) if scored else subs[-1]
            submitted_problems += 1
            total_passed += best.test_cases_passed
            total_tcs += best.test_cases_total

        all_followups: list[CodingFollowup] = []
        if best:
            all_followups = list(best.followups or [])

        problem_details.append(ProblemReportDetail(
            problem_id=problem.id,
            title=problem.title,
            difficulty=problem.difficulty,
            order_index=problem.order_index,
            best_submission=SubmissionResponse(
                id=best.id,
                problem_id=best.problem_id,
                language=best.language,
                status=best.status,
                test_cases_passed=best.test_cases_passed,
                test_cases_total=best.test_cases_total,
                execution_time_ms=best.execution_time_ms,
                code_quality_score=best.code_quality_score,
                overall_score=best.overall_score,
                ai_feedback=best.ai_feedback,
                submitted_at=best.submitted_at,
            ) if best else None,
            followups=[
                CodingFollowupResponse(
                    id=f.id,
                    submission_id=f.submission_id,
                    question=f.question,
                    user_answer=f.user_answer,
                    order_index=f.order_index,
                    created_at=f.created_at,
                )
                for f in all_followups
            ],
        ))

    # Mark session completed if all problems submitted
    if submitted_problems == len(session.problems) and session.completed_at is None:
        session.completed_at = datetime.now(timezone.utc)
        await db.commit()

    return CodingReportResponse(
        session_id=session.id,
        role=session.role,
        difficulty=session.difficulty,
        primary_language=session.primary_language,
        started_at=session.started_at,
        completed_at=session.completed_at,
        overall_score=session.overall_score,
        total_problems=len(session.problems),
        submitted_problems=submitted_problems,
        total_test_cases_passed=total_passed,
        total_test_cases=total_tcs,
        problems=problem_details,
    )