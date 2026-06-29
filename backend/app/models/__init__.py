
"""
Importing every model here means a single `from app.models import *` (used in
alembic/env.py) registers all tables on Base.metadata, which is what makes
`alembic revision --autogenerate` actually detect your schema.
"""

from app.models.user import User
from app.models.interview import InterviewSession, Question, Answer
from app.models.coding import CodingSession, CodingProblem, CodingSubmission, CodingFollowup

__all__ = [
    "User", "InterviewSession", "Question", "Answer",
    "CodingSession", "CodingProblem", "CodingSubmission", "CodingFollowup",
]