"""add student_id to users

Revision ID: c3f1a9d24b60
Revises: b8e2f4c19a30
Create Date: 2026-11-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3f1a9d24b60'
down_revision: Union[str, None] = 'b8e2f4c19a30'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('student_id', sa.String(length=32), nullable=True))
        batch_op.create_index(batch_op.f('ix_users_student_id'), ['student_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_student_id'))
        batch_op.drop_column('student_id')
