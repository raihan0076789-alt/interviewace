from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    target_role: str | None = Field(default=None, max_length=100, examples=["SDE-1 Backend"])


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # lets us return an ORM object directly

    id: int
    email: EmailStr
    target_role: str | None
    created_at: datetime
