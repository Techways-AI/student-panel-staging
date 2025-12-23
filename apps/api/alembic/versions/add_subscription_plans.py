"""add_subscription_plans

Revision ID: add_subscription_plans
Revises: 6c37ba360a86
Create Date: 2024-01-15 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'add_subscription_plans'
down_revision: Union[str, None] = '6c37ba360a86'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create subscription_plans table
    op.create_table('subscription_plans',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('razorpay_plan_id', sa.String(length=255), nullable=True),
        sa.Column('name', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=True),
        sa.Column('interval', sa.String(length=20), nullable=False),
        sa.Column('interval_count', sa.Integer(), nullable=True),
        sa.Column('trial_period', sa.Integer(), nullable=True),
        sa.Column('features', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subscription_plans_id'), 'subscription_plans', ['id'], unique=False)
    op.create_index(op.f('ix_subscription_plans_razorpay_plan_id'), 'subscription_plans', ['razorpay_plan_id'], unique=True)

    # Create subscription_invoices table
    op.create_table('subscription_invoices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('subscription_id', sa.Integer(), nullable=False),
        sa.Column('razorpay_invoice_id', sa.String(length=255), nullable=True),
        sa.Column('invoice_number', sa.String(length=100), nullable=True),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=True),
        sa.Column('status', sa.String(length=50), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['subscription_id'], ['subscriptions.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_subscription_invoices_id'), 'subscription_invoices', ['id'], unique=False)
    op.create_index(op.f('ix_subscription_invoices_razorpay_invoice_id'), 'subscription_invoices', ['razorpay_invoice_id'], unique=True)

    # Add new columns to existing subscriptions table
    op.add_column('subscriptions', sa.Column('razorpay_subscription_id', sa.String(length=255), nullable=True))
    op.add_column('subscriptions', sa.Column('razorpay_plan_id', sa.String(length=255), nullable=True))
    op.add_column('subscriptions', sa.Column('subscription_status', sa.String(length=50), nullable=True))
    op.add_column('subscriptions', sa.Column('next_billing_date', sa.DateTime(timezone=True), nullable=True))
    op.add_column('subscriptions', sa.Column('billing_cycle_count', sa.Integer(), nullable=True))
    op.add_column('subscriptions', sa.Column('paused_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('subscriptions', sa.Column('resumed_at', sa.DateTime(timezone=True), nullable=True))

    # Add indexes for new columns
    op.create_index(op.f('ix_subscriptions_razorpay_subscription_id'), 'subscriptions', ['razorpay_subscription_id'], unique=True)
    op.create_index(op.f('ix_subscriptions_razorpay_plan_id'), 'subscriptions', ['razorpay_plan_id'], unique=False)

    # Add new columns to existing payments table for subscription support
    op.add_column('payments', sa.Column('subscription_id', sa.Integer(), nullable=True))
    op.add_column('payments', sa.Column('invoice_id', sa.String(length=255), nullable=True))
    op.add_column('payments', sa.Column('billing_cycle', sa.Integer(), nullable=True))

    # Add foreign key constraint for subscription_id in payments
    op.create_foreign_key('fk_payments_subscription_id', 'payments', 'subscriptions', ['subscription_id'], ['id'])


def downgrade() -> None:
    # Remove foreign key constraint
    op.drop_constraint('fk_payments_subscription_id', 'payments', type_='foreignkey')
    
    # Remove columns from payments table
    op.drop_column('payments', 'billing_cycle')
    op.drop_column('payments', 'invoice_id')
    op.drop_column('payments', 'subscription_id')
    
    # Remove indexes from subscriptions table
    op.drop_index(op.f('ix_subscriptions_razorpay_plan_id'), table_name='subscriptions')
    op.drop_index(op.f('ix_subscriptions_razorpay_subscription_id'), table_name='subscriptions')
    
    # Remove columns from subscriptions table
    op.drop_column('subscriptions', 'resumed_at')
    op.drop_column('subscriptions', 'paused_at')
    op.drop_column('subscriptions', 'billing_cycle_count')
    op.drop_column('subscriptions', 'next_billing_date')
    op.drop_column('subscriptions', 'subscription_status')
    op.drop_column('subscriptions', 'razorpay_plan_id')
    op.drop_column('subscriptions', 'razorpay_subscription_id')
    
    # Drop subscription_invoices table
    op.drop_index(op.f('ix_subscription_invoices_razorpay_invoice_id'), table_name='subscription_invoices')
    op.drop_index(op.f('ix_subscription_invoices_id'), table_name='subscription_invoices')
    op.drop_table('subscription_invoices')
    
    # Drop subscription_plans table
    op.drop_index(op.f('ix_subscription_plans_razorpay_plan_id'), table_name='subscription_plans')
    op.drop_index(op.f('ix_subscription_plans_id'), table_name='subscription_plans')
    op.drop_table('subscription_plans')

