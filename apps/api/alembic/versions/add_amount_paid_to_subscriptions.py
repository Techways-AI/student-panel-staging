"""Add amount_paid column to subscriptions

Revision ID: add_amount_paid_to_subscriptions
Revises: add_ai_tutor_queries_column
Create Date: 2025-11-18 10:08:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'add_amount_paid_to_subscriptions'
down_revision = 'add_ai_tutor_queries_column'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'subscriptions',
        sa.Column('amount_paid', sa.Numeric(precision=10, scale=2), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('subscriptions', 'amount_paid')

