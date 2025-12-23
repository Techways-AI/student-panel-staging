"""merge heads

Revision ID: d5781d76e353
Revises: 794eb57f2ed3, add_xp_topic_column
Create Date: 2025-09-18 15:03:24.263381

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd5781d76e353'
down_revision: Union[str, None] = ('794eb57f2ed3', 'add_xp_topic_column')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

