"""Add ai_daily_usage table for AI daily usage tracking

Revision ID: add_ai_daily_usage_table
Revises: add_ai_tutor_queries_column
Create Date: 2025-12-02 12:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "add_ai_daily_usage_table"
down_revision: Union[str, None] = "add_ai_tutor_queries_column"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create ai_daily_usage table for Plus/Pro daily AI limits
    op.create_table(
        "ai_daily_usage",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("date", sa.Date(), nullable=False),
        sa.Column("used_queries", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("plan_snapshot", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    # Indexes and uniqueness for fast lookups
    op.create_index("ix_ai_daily_usage_id", "ai_daily_usage", ["id"], unique=False)
    op.create_index("ix_ai_daily_usage_user_id", "ai_daily_usage", ["user_id"], unique=False)
    op.create_index("ix_ai_daily_usage_date", "ai_daily_usage", ["date"], unique=False)
    op.create_unique_constraint("uq_ai_daily_usage_user_date", "ai_daily_usage", ["user_id", "date"])

    # Remove server default so application code controls increments
    op.alter_column("ai_daily_usage", "used_queries", server_default=None)


def downgrade() -> None:
    op.drop_constraint("uq_ai_daily_usage_user_date", "ai_daily_usage", type_="unique")
    op.drop_index("ix_ai_daily_usage_date", table_name="ai_daily_usage")
    op.drop_index("ix_ai_daily_usage_user_id", table_name="ai_daily_usage")
    op.drop_index("ix_ai_daily_usage_id", table_name="ai_daily_usage")
    op.drop_table("ai_daily_usage")

