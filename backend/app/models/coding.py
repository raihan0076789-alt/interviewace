"""
Coding interview models — four tables:
  coding_sessions    → one per coding interview attempt
  coding_problems    → LLM-generated problems inside a session
  coding_submissions → user's code submissions with test results + AI scores
  coding_followups   → Aira's follow-up questions + user answers
"""

from datetime import datetime

from sqlalchemy import Boolean, Column, Float, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CodingSession(Base):
    __tablename__ = "coding_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(100), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="medium")
    primary_language: Mapped[str] = mapped_column(String(20), nullable=False, default="python")
    started_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)

    problems: Mapped[list["CodingProblem"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="CodingProblem.order_index",
    )


class CodingProblem(Base):
    __tablename__ = "coding_problems"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(
        ForeignKey("coding_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), nullable=False, default="medium")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    solution_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    # JSON columns — SQLAlchemy JSON type handles SQLite (text) and Postgres (native JSON)
    examples = Column(JSON, nullable=False, default=list)
    constraints = Column(JSON, nullable=False, default=list)
    test_cases = Column(JSON, nullable=False, default=list)   # [{input, expected_output, is_sample}]
    starter_code = Column(JSON, nullable=False, default=dict) # {python, javascript, java, cpp}

    session: Mapped["CodingSession"] = relationship(back_populates="problems")
    submissions: Mapped[list["CodingSubmission"]] = relationship(
        back_populates="problem", cascade="all, delete-orphan",
        order_by="CodingSubmission.submitted_at",
    )


class CodingSubmission(Base):
    __tablename__ = "coding_submissions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    problem_id: Mapped[int] = mapped_column(
        ForeignKey("coding_problems.id", ondelete="CASCADE"), nullable=False, index=True
    )
    code: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(20), nullable=False)
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, default="pending"
    )  # accepted | wrong_answer | runtime_error | compile_error | time_limit

    test_cases_passed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    test_cases_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    execution_time_ms: Mapped[float | None] = mapped_column(Float, nullable=True)

    # AI evaluation
    code_quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    overall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    ai_feedback = Column(JSON, nullable=True)  # {feedback, strengths, weaknesses, time_complexity, ...}

    submitted_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    problem: Mapped["CodingProblem"] = relationship(back_populates="submissions")
    followups: Mapped[list["CodingFollowup"]] = relationship(
        back_populates="submission", cascade="all, delete-orphan",
        order_by="CodingFollowup.order_index",
    )


class CodingFollowup(Base):
    __tablename__ = "coding_followups"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submission_id: Mapped[int] = mapped_column(
        ForeignKey("coding_submissions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    question: Mapped[str] = mapped_column(Text, nullable=False)
    user_answer: Mapped[str | None] = mapped_column(Text, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now(), nullable=False)

    submission: Mapped["CodingSubmission"] = relationship(back_populates="followups")