from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class SessionCreate(BaseModel):
    role: str = Field(min_length=2, max_length=100, examples=["SDE-1 Backend"])
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    question_count: int = Field(default=5, ge=3, le=10)
    # Resume-based fields — when provided, custom_questions are used
    # directly instead of calling the LLM for question generation
    resume_text: str | None = None
    custom_questions: list[str] | None = None


class QuestionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_text: str
    order_index: int
    is_followup: bool = False


class SessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: str
    difficulty: str
    started_at: datetime
    overall_score: float | None
    is_resume_based: bool = False
    questions: list[QuestionResponse]