"""Horarios de atención, marca de datos de demostración y motivo de rechazo.

Revision ID: 0002
Revises: 0001
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "horarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("dia_semana", sa.SmallInteger(), nullable=False),
        sa.Column("abre", sa.Time(), nullable=False),
        sa.Column("cierra", sa.Time(), nullable=False),
        sa.CheckConstraint("dia_semana BETWEEN 0 AND 6", name=op.f("ck_horarios_dia_valido")),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_horarios_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_horarios")),
    )
    op.create_index(op.f("ix_horarios_negocio_id"), "horarios", ["negocio_id"])
    # server_default: los negocios que ya existan quedan como reales (no demo).
    op.add_column("negocios", sa.Column("es_demo", sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column("negocios", sa.Column("motivo_rechazo", sa.String(300), nullable=True))


def downgrade() -> None:
    op.drop_column("negocios", "motivo_rechazo")
    op.drop_column("negocios", "es_demo")
    op.drop_index(op.f("ix_horarios_negocio_id"), table_name="horarios")
    op.drop_table("horarios")
