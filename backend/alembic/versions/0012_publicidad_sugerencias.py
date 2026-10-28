"""Banners publicitarios (3 espacios) y sugerencias; permisos nuevos para el Subadministrador.

Revision ID: 0012
Revises: 0011
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0012"
down_revision: str | None = "0011"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

NUEVOS = ("publicidad.gestionar", "sugerencias.ver")


def upgrade() -> None:
    op.create_table(
        "anuncios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("posicion", sa.SmallInteger(), nullable=False),
        sa.Column("titulo", sa.String(120), nullable=True),
        sa.Column("enlace", sa.String(300), nullable=True),
        sa.Column("imagen_clave", sa.String(200), nullable=True),
        sa.Column("activo", sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("posicion BETWEEN 1 AND 3", name=op.f("ck_anuncios_posicion_valida")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_anuncios")),
        sa.UniqueConstraint("posicion", name=op.f("uq_anuncios_posicion")),
    )
    op.create_table(
        "sugerencias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_sugerencias_usuario_id_usuarios"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sugerencias")),
    )
    op.create_index(op.f("ix_sugerencias_usuario_id"), "sugerencias", ["usuario_id"])
    op.create_index(op.f("ix_sugerencias_creado_en"), "sugerencias", ["creado_en"])
    for permiso in NUEVOS:
        op.execute(
            f"UPDATE roles_panel SET permisos = array_append(permisos, '{permiso}') "
            f"WHERE id = 1 AND NOT '{permiso}' = ANY(permisos)"
        )


def downgrade() -> None:
    for permiso in NUEVOS:
        op.execute(f"UPDATE roles_panel SET permisos = array_remove(permisos, '{permiso}')")
    op.drop_index(op.f("ix_sugerencias_creado_en"), table_name="sugerencias")
    op.drop_index(op.f("ix_sugerencias_usuario_id"), table_name="sugerencias")
    op.drop_table("sugerencias")
    op.drop_table("anuncios")
