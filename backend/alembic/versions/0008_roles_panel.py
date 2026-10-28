"""Roles del panel administrativo con permisos; los operadores pasan a Subadministrador.

Revision ID: 0008
Revises: 0007
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0008"
down_revision: str | None = "0007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

SUBADMIN = [
    "usuarios.ver",
    "usuarios.editar",
    "usuarios.eliminar",
    "negocios.ver",
    "negocios.moderar",
    "publicaciones.moderar",
]
SUSCRIPTOR = ["usuarios.ver", "negocios.ver"]


def upgrade() -> None:
    roles = op.create_table(
        "roles_panel",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(40), nullable=False),
        sa.Column("descripcion", sa.String(200), nullable=True),
        sa.Column("permisos", postgresql.ARRAY(sa.String(40)), server_default="{}", nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_roles_panel")),
        sa.UniqueConstraint("nombre", name=op.f("uq_roles_panel_nombre")),
    )
    op.bulk_insert(
        roles,
        [
            {"id": 1, "nombre": "Subadministrador", "descripcion": "Opera la plataforma día a día.", "permisos": SUBADMIN},
            {"id": 2, "nombre": "Suscriptor", "descripcion": "Solo consulta.", "permisos": SUSCRIPTOR},
        ],
    )
    op.execute("SELECT setval('roles_panel_id_seq', 2)")

    op.add_column("usuarios", sa.Column("rol_panel_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        op.f("fk_usuarios_rol_panel_id_roles_panel"), "usuarios", "roles_panel", ["rol_panel_id"], ["id"],
        ondelete="RESTRICT",
    )  # fmt: skip
    op.create_index(op.f("ix_usuarios_rol_panel_id"), "usuarios", ["rol_panel_id"])
    op.execute("UPDATE usuarios SET rol = 'cliente', rol_panel_id = 1 WHERE rol = 'operador'")


def downgrade() -> None:
    op.execute("UPDATE usuarios SET rol = 'operador' WHERE rol_panel_id IS NOT NULL AND rol = 'cliente'")
    op.drop_index(op.f("ix_usuarios_rol_panel_id"), table_name="usuarios")
    op.drop_constraint(op.f("fk_usuarios_rol_panel_id_roles_panel"), "usuarios", type_="foreignkey")
    op.drop_column("usuarios", "rol_panel_id")
    op.drop_table("roles_panel")
