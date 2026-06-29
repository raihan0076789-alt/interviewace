"""add resume fields and is_followup to questions

Revision ID: b1c2d3e4f5a6
Revises: f1e83df310aa
Create Date: 2026-06-24
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, None] = "f1e83df310aa"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("interview_sessions",
        sa.Column("is_resume_based", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("interview_sessions",
        sa.Column("resume_text", sa.Text(), nullable=True))
    op.add_column("questions",
        sa.Column("is_followup", sa.Boolean(), nullable=False, server_default="0"))


def downgrade() -> None:
    op.drop_column("questions", "is_followup")
    op.drop_column("interview_sessions", "resume_text")
    op.drop_column("interview_sessions", "is_resume_based")