"""Perfil del negocio (foto de perfil y portada), seguidores, reacciones y comentarios.

Revision ID: 0007
Revises: 0006
Create Date: 2026-10-26
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0007"
down_revision: str | None = "0006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("logo_clave", sa.String(200), nullable=True))
    op.add_column("negocios", sa.Column("portada_clave", sa.String(200), nullable=True))

    op.create_table(
        "seguidores",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_seguidores_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_seguidores_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("usuario_id", "negocio_id", name=op.f("pk_seguidores")),
    )
    op.create_index(op.f("ix_seguidores_negocio_id"), "seguidores", ["negocio_id"])

    op.create_table(
        "reacciones",
        sa.Column("publicacion_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("tipo", sa.String(12), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint("tipo IN ('me_gusta', 'me_encanta', 'wow')", name=op.f("ck_reacciones_tipo")),
        sa.ForeignKeyConstraint(
            ["publicacion_id"],
            ["publicaciones.id"],
            name=op.f("fk_reacciones_publicacion_id_publicaciones"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_reacciones_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("publicacion_id", "usuario_id", name=op.f("pk_reacciones")),
    )
    op.create_index(op.f("ix_reacciones_usuario_id"), "reacciones", ["usuario_id"])

    op.create_table(
        "comentarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("publicacion_id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("texto", sa.String(1000), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["publicacion_id"],
            ["publicaciones.id"],
            name=op.f("fk_comentarios_publicacion_id_publicaciones"),
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_comentarios_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_comentarios")),
    )
    op.create_index(op.f("ix_comentarios_publicacion_id"), "comentarios", ["publicacion_id"])
    op.create_index(op.f("ix_comentarios_usuario_id"), "comentarios", ["usuario_id"])


def downgrade() -> None:
    op.drop_table("comentarios")
    op.drop_table("reacciones")
    op.drop_table("seguidores")
    op.drop_column("negocios", "portada_clave")
    op.drop_column("negocios", "logo_clave")
