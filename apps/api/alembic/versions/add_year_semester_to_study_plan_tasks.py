"""add_year_semester_to_study_plan_tasks

Revision ID: add_year_semester_to_tasks
Revises: ee26e2c7591c
Create Date: 2025-10-06 18:20:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_year_semester_to_tasks'
down_revision: Union[str, None] = 'ee26e2c7591c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1) Add columns as NULLable to avoid breaking existing rows
    op.add_column('study_plan_tasks', sa.Column('year', sa.Integer(), nullable=True))
    op.add_column('study_plan_tasks', sa.Column('semester', sa.Integer(), nullable=True))

    # 2) Backfill from parent study_plans table based on study_plan_id
    # Use portable SQL that works with SQLite and Postgres
    op.execute(
        """
        UPDATE study_plan_tasks
        SET year = (
            SELECT year FROM study_plans WHERE study_plans.id = study_plan_tasks.study_plan_id
        ),
        semester = (
            SELECT semester FROM study_plans WHERE study_plans.id = study_plan_tasks.study_plan_id
        )
        """
    )

    # Note: Keeping columns nullable to preserve behavior and avoid issues on inserts


def downgrade() -> None:
    # Drop newly added columns
    op.drop_column('study_plan_tasks', 'semester')
    op.drop_column('study_plan_tasks', 'year')

