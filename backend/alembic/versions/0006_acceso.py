"""Ingreso con celular y con Google / Microsoft (Hotmail, Outlook).

Revision ID: 0006
Revises: 0005
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0006"
down_revision: str | None = "0005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_unique_constraint(op.f("uq_usuarios_telefono"), "usuarios", ["telefono"])
    op.create_table(
        "cuentas_externas",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("proveedor", sa.String(20), nullable=False),
        sa.Column("sujeto", sa.String(255), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_cuentas_externas_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cuentas_externas")),
        sa.UniqueConstraint("proveedor", "sujeto", name=op.f("uq_cuentas_externas_proveedor")),
    )
    op.create_index(op.f("ix_cuentas_externas_usuario_id"), "cuentas_externas", ["usuario_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_cuentas_externas_usuario_id"), table_name="cuentas_externas")
    op.drop_table("cuentas_externas")
    op.drop_constraint(op.f("uq_usuarios_telefono"), "usuarios", type_="unique")
