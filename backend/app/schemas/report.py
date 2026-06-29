from datetime import datetime

from pydantic import BaseModel


class AnswerDetail(BaseModel):
    """Per-question detail block inside the session report."""
    question_id: int
    question_text: str
    order_index: int
    transcript: str | None
    eye_contact_score: float | None
    posture_score: float | None
    content_score: float | None
    overall_score: float | None   # blended, computed at report time
    feedback: str | None
    audio_duration_seconds: float | None


class SessionReport(BaseModel):
    """
    Full session report returned by GET /api/sessions/{id}/report.
    Aggregates all per-question scores into a session-level summary.
    """
    session_id: int
    role: str
    difficulty: str
    started_at: datetime
    completed_at: datetime | None
    overall_score: float | None     # mean of per-question overall scores
    total_questions: int
    answered_questions: int
    evaluated_questions: int        # questions that have a content_score
    answers: list[AnswerDetail]