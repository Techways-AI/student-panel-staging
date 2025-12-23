"""add_quiz_analysis_columns

Revision ID: add_quiz_analysis_columns
Revises: add_topic_completions
Create Date: 2025-01-27 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_quiz_analysis_columns'
down_revision: Union[str, None] = 'add_topic_completions'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add new columns to quiz table for AI analysis
    op.add_column('quiz', sa.Column('strengths', sa.Text(), nullable=True))
    op.add_column('quiz', sa.Column('weakness', sa.Text(), nullable=True))
    op.add_column('quiz', sa.Column('areas_to_improve', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove the added columns
    op.drop_column('quiz', 'areas_to_improve')
    op.drop_column('quiz', 'weakness')
    op.drop_column('quiz', 'strengths')

