"""Negocios: el dueño va en negocios.usuario_id (arquitectura MVP) y se quita la tabla miembros_negocio.

La tabla intermedia era la base de "equipos", que el MVP deja para después; el rol "editor" no se usaba.

Revision ID: 0010
Revises: 0009
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0010"
down_revision: str | None = "0009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("negocios", sa.Column("usuario_id", sa.Integer(), nullable=True))
    # El propietario; si hubiera más de uno, el que se sumó primero (el de menor id).
    op.execute(
        """
        UPDATE negocios n SET usuario_id = (
            SELECT min(m.usuario_id) FROM miembros_negocio m
            WHERE m.negocio_id = n.id AND m.rol = 'propietario'
        )
        """
    )
    huerfanos = op.get_bind().scalar(sa.text("SELECT count(*) FROM negocios WHERE usuario_id IS NULL"))
    if huerfanos:
        raise RuntimeError(f"{huerfanos} negocios no tienen propietario: revisar antes de migrar.")
    op.alter_column("negocios", "usuario_id", nullable=False)
    op.create_foreign_key(
        op.f("fk_negocios_usuario_id_usuarios"), "negocios", "usuarios", ["usuario_id"], ["id"], ondelete="RESTRICT"
    )
    op.create_index(op.f("ix_negocios_usuario_id"), "negocios", ["usuario_id"])
    op.drop_table("miembros_negocio")
    op.execute("DROP TYPE rol_miembro")


def downgrade() -> None:
    rol = postgresql.ENUM("propietario", "editor", name="rol_miembro")
    rol.create(op.get_bind())
    op.create_table(
        "miembros_negocio",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("rol", postgresql.ENUM(name="rol_miembro", create_type=False), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_miembros_negocio_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_miembros_negocio_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("usuario_id", "negocio_id", name=op.f("pk_miembros_negocio")),
    )
    op.create_index(op.f("ix_miembros_negocio_negocio_id"), "miembros_negocio", ["negocio_id"])
    op.execute("INSERT INTO miembros_negocio SELECT usuario_id, id, 'propietario' FROM negocios")
    op.drop_index(op.f("ix_negocios_usuario_id"), table_name="negocios")
    op.drop_constraint(op.f("fk_negocios_usuario_id_usuarios"), "negocios", type_="foreignkey")
    op.drop_column("negocios", "usuario_id")
