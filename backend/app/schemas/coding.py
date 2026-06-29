from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class CodingSessionCreate(BaseModel):
    role: str = Field(min_length=2, max_length=100)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    language: Literal["python", "javascript", "java", "cpp"] = "python"
    problem_count: int = Field(default=1, ge=1, le=3)


class RunCodeRequest(BaseModel):
    problem_id: int
    code: str = Field(min_length=1)
    language: Literal["python", "javascript", "java", "cpp"]


class SubmitCodeRequest(BaseModel):
    problem_id: int
    code: str = Field(min_length=1)
    language: Literal["python", "javascript", "java", "cpp"]


class FollowupRequest(BaseModel):
    submission_id: int


class FollowupAnswerRequest(BaseModel):
    followup_id: int
    answer: str


class TestCaseResultResponse(BaseModel):
    passed: bool
    stdin: str
    expected: str
    got: str
    status: str
    execution_time_ms: float = 0.0
    stderr: str = ""


class RunResultResponse(BaseModel):
    test_results: list[TestCaseResultResponse]
    total_passed: int
    total_ran: int
    language: str


class SubmissionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    problem_id: int
    language: str
    status: str
    test_cases_passed: int
    test_cases_total: int
    execution_time_ms: float | None
    code_quality_score: float | None
    overall_score: float | None
    ai_feedback: Any | None
    submitted_at: datetime
    test_results: list[TestCaseResultResponse] = []


class CodingFollowupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    submission_id: int
    question: str
    user_answer: str | None
    order_index: int
    created_at: datetime


class CodingProblemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    session_id: int
    title: str
    difficulty: str
    description: str
    solution_hint: str | None
    order_index: int
    examples: Any
    constraints: Any
    starter_code: Any
    sample_test_cases: list[dict] = []
    submissions: list[SubmissionResponse] = []


class CodingSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    difficulty: str
    primary_language: str
    started_at: datetime
    completed_at: datetime | None
    overall_score: float | None
    problems: list[CodingProblemResponse] = []


class ProblemReportDetail(BaseModel):
    problem_id: int
    title: str
    difficulty: str
    order_index: int
    best_submission: SubmissionResponse | None
    followups: list[CodingFollowupResponse] = []


class CodingReportResponse(BaseModel):
    session_id: int
    role: str
    difficulty: str
    primary_language: str
    started_at: datetime
    completed_at: datetime | None
    overall_score: float | None
    total_problems: int
    submitted_problems: int
    total_test_cases_passed: int
    total_test_cases: int
    problems: list[ProblemReportDetail] = []