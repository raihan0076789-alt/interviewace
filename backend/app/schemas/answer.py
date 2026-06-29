from pydantic import BaseModel, ConfigDict, Field


class AnswerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question_id: int
    transcript: str | None
    eye_contact_score: float | None
    posture_score: float | None
    content_score: float | None
    feedback: str | None
    audio_duration_seconds: float | None