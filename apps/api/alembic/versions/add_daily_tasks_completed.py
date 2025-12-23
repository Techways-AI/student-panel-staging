"""Add daily_tasks_completed field to daily_goals table

Revision ID: add_daily_tasks_completed
Revises: 6c37ba360a86
Create Date: 2025-01-27 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_daily_tasks_completed'
down_revision = '6c37ba360a86'
branch_labels = None
depends_on = None


def upgrade():
    # Add the new daily_tasks_completed column
    op.add_column('daily_goals', sa.Column('daily_tasks_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade():
    # Remove the daily_tasks_completed column
    op.drop_column('daily_goals', 'daily_tasks_completed')

