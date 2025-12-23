"""Add xp_topic column to quiz table

Revision ID: add_xp_topic_column
Revises: ee26e2c7591c_add_video_notes_quiz_completion_columns_
Create Date: 2024-01-15 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_xp_topic_column'
down_revision = 'ee26e2c7591c_add_video_notes_quiz_completion_columns_'
branch_labels = None
depends_on = None


def upgrade():
    # Add xp_topic column to quiz table
    op.add_column('quiz', sa.Column('xp_topic', sa.Integer(), nullable=True))


def downgrade():
    # Remove xp_topic column from quiz table
    op.drop_column('quiz', 'xp_topic')

