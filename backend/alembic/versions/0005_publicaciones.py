"""Publicaciones de los negocios (muro del Inicio y de cada negocio).

Revision ID: 0005
Revises: 0004
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "publicaciones",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("autor_id", sa.Integer(), nullable=True),
        sa.Column("texto", sa.Text(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_publicaciones_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["autor_id"], ["usuarios.id"], name=op.f("fk_publicaciones_autor_id_usuarios"), ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_publicaciones")),
    )
    op.create_index(op.f("ix_publicaciones_negocio_id"), "publicaciones", ["negocio_id"])
    op.create_index(op.f("ix_publicaciones_creado_en"), "publicaciones", ["creado_en"])

    op.create_table(
        "fotos_publicacion",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("publicacion_id", sa.Integer(), nullable=False),
        sa.Column("clave", sa.String(200), nullable=False),
        sa.Column("ancho", sa.SmallInteger(), nullable=False),
        sa.Column("alto", sa.SmallInteger(), nullable=False),
        sa.Column("orden", sa.SmallInteger(), server_default="0", nullable=False),
        sa.ForeignKeyConstraint(
            ["publicacion_id"],
            ["publicaciones.id"],
            name=op.f("fk_fotos_publicacion_publicacion_id_publicaciones"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_fotos_publicacion")),
        sa.UniqueConstraint("clave", name=op.f("uq_fotos_publicacion_clave")),
    )
    op.create_index(op.f("ix_fotos_publicacion_publicacion_id"), "fotos_publicacion", ["publicacion_id"])


def downgrade() -> None:
    op.drop_index(op.f("ix_fotos_publicacion_publicacion_id"), table_name="fotos_publicacion")
    op.drop_table("fotos_publicacion")
    op.drop_index(op.f("ix_publicaciones_creado_en"), table_name="publicaciones")
    op.drop_index(op.f("ix_publicaciones_negocio_id"), table_name="publicaciones")
    op.drop_table("publicaciones")
