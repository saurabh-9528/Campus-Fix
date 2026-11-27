"""add uploaded_files table

Revision ID: a7c4e9b21f10
Revises: 5bddc1131563
Create Date: 2026-11-27 13:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7c4e9b21f10'
down_revision: Union[str, None] = '5bddc1131563'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'uploaded_files',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('object_id', sa.String(length=160), nullable=False),
        sa.Column('content_type', sa.String(length=50), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_uploaded_files_id'), 'uploaded_files', ['id'], unique=False)
    op.create_index(op.f('ix_uploaded_files_object_id'), 'uploaded_files', ['object_id'], unique=True)


def downgrade() -> None:
    op.drop_index(op.f('ix_uploaded_files_object_id'), table_name='uploaded_files')
    op.drop_index(op.f('ix_uploaded_files_id'), table_name='uploaded_files')
    op.drop_table('uploaded_files')
