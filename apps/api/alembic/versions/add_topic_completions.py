"""Create topic_completions table

Revision ID: add_topic_completions
Revises: add_daily_tasks_completed
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime

# revision identifiers, used by Alembic.
revision = 'add_topic_completions'
down_revision = 'add_daily_tasks_completed'
branch_labels = None
depends_on = None

def upgrade():
    # Create topic_completions table
    op.create_table('topic_completions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('subject', sa.String(), nullable=False),
        sa.Column('unit', sa.String(), nullable=False),
        sa.Column('topic', sa.String(), nullable=False),
        sa.Column('date', sa.String(), nullable=False),
        sa.Column('video_watched', sa.Boolean(), nullable=True, default=False),
        sa.Column('notes_read', sa.Boolean(), nullable=True, default=False),
        sa.Column('quiz_completed', sa.Boolean(), nullable=True, default=False),
        sa.Column('topic_completed', sa.Boolean(), nullable=True, default=False),
        sa.Column('video_completed_at', sa.DateTime(), nullable=True),
        sa.Column('notes_completed_at', sa.DateTime(), nullable=True),
        sa.Column('quiz_completed_at', sa.DateTime(), nullable=True),
        sa.Column('topic_completed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, default=datetime.utcnow),
        sa.Column('updated_at', sa.DateTime(), nullable=True, default=datetime.utcnow),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_topic_completions_id'), 'topic_completions', ['id'], unique=False)
    op.create_index('ix_topic_completions_user_date', 'topic_completions', ['user_id', 'date'], unique=False)
    op.create_index('ix_topic_completions_subject_unit_topic', 'topic_completions', ['subject', 'unit', 'topic'], unique=False)
    
    # Create unique constraint
    op.create_unique_constraint('_user_topic_date_uc', 'topic_completions', ['user_id', 'subject', 'unit', 'topic', 'date'])

def downgrade():
    # Drop the table
    op.drop_table('topic_completions')

