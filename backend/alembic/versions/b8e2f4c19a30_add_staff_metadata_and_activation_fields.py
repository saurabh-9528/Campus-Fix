"""add staff metadata and activation fields

Revision ID: b8e2f4c19a30
Revises: a7c4e9b21f10
Create Date: 2026-11-27 17:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b8e2f4c19a30'
down_revision: Union[str, None] = 'a7c4e9b21f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('employee_id', sa.String(length=32), nullable=True))
        batch_op.add_column(sa.Column('department', sa.String(length=100), nullable=True))
        batch_op.add_column(
            sa.Column('account_status', sa.String(length=32), server_default='active', nullable=False)
        )
        batch_op.add_column(
            sa.Column('must_change_password', sa.Boolean(), server_default=sa.false(), nullable=False)
        )
        batch_op.create_index(batch_op.f('ix_users_employee_id'), ['employee_id'], unique=True)


def downgrade() -> None:
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_employee_id'))
        batch_op.drop_column('must_change_password')
        batch_op.drop_column('account_status')
        batch_op.drop_column('department')
        batch_op.drop_column('employee_id')
