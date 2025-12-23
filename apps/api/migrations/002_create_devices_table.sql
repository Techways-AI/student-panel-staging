"""Create devices table with UUID-based device management

Revision ID: create_devices_table
Revises: 
Create Date: 2024-01-01 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'create_devices_table'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    # Drop old device_sessions table if it exists
    op.execute("DROP TABLE IF EXISTS device_sessions CASCADE;")
    
    # Create new devices table
    op.create_table('devices',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('device_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('device_type', sa.String(length=20), nullable=False),
        sa.Column('fingerprint_hash', sa.String(length=64), nullable=True),
        sa.Column('fingerprint_components', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('ip_address', postgresql.INET(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('last_used', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes
    op.create_index(op.f('ix_devices_id'), 'devices', ['id'], unique=False)
    op.create_index(op.f('ix_devices_device_uuid'), 'devices', ['device_uuid'], unique=True)
    
    # Create unique constraint for one device per user per device type
    op.create_unique_constraint('ux_user_device_type', 'devices', ['user_id', 'device_type'])


def downgrade():
    # Drop the devices table
    op.drop_constraint('ux_user_device_type', 'devices', type_='unique')
    op.drop_index(op.f('ix_devices_device_uuid'), table_name='devices')
    op.drop_index(op.f('ix_devices_id'), table_name='devices')
    op.drop_table('devices')
    
    # Recreate old device_sessions table (simplified version)
    op.create_table('device_sessions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=False),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('device_type', sa.String(length=20), nullable=False),
        sa.Column('device_id', sa.String(length=255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('last_activity', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_device_sessions_id'), 'device_sessions', ['id'], unique=False)
