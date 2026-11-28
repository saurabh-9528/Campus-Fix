"""add invalid complaint status

Revision ID: d4e5f6a7b8c9
Revises: c3f1a9d24b60
Create Date: 2026-11-29 02:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3f1a9d24b60'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        with op.get_context().autocommit_block():
            op.execute("ALTER TYPE complaintstatus ADD VALUE IF NOT EXISTS 'invalid'")


def downgrade() -> None:
    # PostgreSQL does not support removing an enum value directly without recreating the type.
    pass
