"""Add AI tutor queries column

Revision ID: add_ai_tutor_queries_column
Revises: add_xp_topic_column
Create Date: 2025-10-14 10:15:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_ai_tutor_queries_column'
down_revision = 'add_xp_topic_column'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('ai_tutor_queries', sa.Integer(), nullable=False, server_default='0'))
    op.execute("UPDATE users SET ai_tutor_queries = 0 WHERE ai_tutor_queries IS NULL")
    op.alter_column('users', 'ai_tutor_queries', server_default=None)


def downgrade():
    op.drop_column('users', 'ai_tutor_queries')

