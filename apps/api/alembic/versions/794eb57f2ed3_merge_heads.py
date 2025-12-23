"""merge_heads

Revision ID: 794eb57f2ed3
Revises: add_subscription_plans, add_streak_table
Create Date: 2025-09-16 15:45:06.625775

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '794eb57f2ed3'
down_revision: Union[str, None] = ('add_subscription_plans', 'add_streak_table')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

