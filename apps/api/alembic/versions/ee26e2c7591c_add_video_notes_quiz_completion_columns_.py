"""Add video_notes_quiz_completion_columns_to_study_plan_tasks

Revision ID: ee26e2c7591c
Revises: add_quiz_analysis_columns
Create Date: 2025-09-13 12:16:17.785166

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ee26e2c7591c'
down_revision: Union[str, None] = 'add_quiz_analysis_columns'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new completion tracking columns to study_plan_tasks table
    op.add_column('study_plan_tasks', sa.Column('video_completed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('study_plan_tasks', sa.Column('notes_completed', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('study_plan_tasks', sa.Column('quiz_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    # Remove the completion tracking columns
    op.drop_column('study_plan_tasks', 'quiz_completed')
    op.drop_column('study_plan_tasks', 'notes_completed')
    op.drop_column('study_plan_tasks', 'video_completed')

