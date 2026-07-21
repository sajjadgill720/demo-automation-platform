"""add_lead_qualification_fields

Revision ID: a3b7c9d2e4f1
Revises: fea66a6b5ca1
Create Date: 2026-07-17 01:15:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import sqlmodel


# revision identifiers, used by Alembic.
revision: str = 'a3b7c9d2e4f1'
down_revision: Union[str, Sequence[str], None] = 'fea66a6b5ca1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add qualification fields to leads table and extend agentstatus enum."""
    bind = op.get_bind()
    dialect = bind.dialect.name

    # ── Extend the AgentStatus enum with 'skipped' ──
    # PostgreSQL requires ALTER TYPE executed outside a transaction block.
    # SQLite stores enums as plain strings so no DDL change needed.
    if dialect == "postgresql":
        # Must run outside transaction for ADD VALUE to work
        op.execute("COMMIT")
        op.execute("ALTER TYPE agentstatus ADD VALUE IF NOT EXISTS 'skipped'")
        op.execute("BEGIN")

    # ── Add qualification columns to leads table ──
    op.add_column('leads', sa.Column('qualified', sa.Boolean(), nullable=True))
    op.add_column('leads', sa.Column('qualification_confidence', sa.Float(), nullable=True))
    op.add_column('leads', sa.Column('qualification_reasoning', sa.String(), nullable=True))


def downgrade() -> None:
    """Remove qualification fields from leads table.
    
    Note: PostgreSQL does not support removing values from an ENUM type
    without recreating it. The 'skipped' value will remain in the enum
    after downgrade, which is harmless.
    """
    op.drop_column('leads', 'qualification_reasoning')
    op.drop_column('leads', 'qualification_confidence')
    op.drop_column('leads', 'qualified')
