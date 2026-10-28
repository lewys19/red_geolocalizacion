"""Usuarios: username único (perfil público altoque.pe/lewys), foto de perfil y fecha de actualización.

A las cuentas existentes se les genera el username desde el nombre (con -2, -3… si se repite).

Revision ID: 0009
Revises: 0008
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.usernames import RESERVADOS, base_desde

revision: str = "0009"
down_revision: str | None = "0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("username", sa.String(30), nullable=True))
    op.add_column("usuarios", sa.Column("avatar_clave", sa.String(200), nullable=True))
    op.add_column(
        "usuarios",
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
    )

    conexion = op.get_bind()
    tomados: set[str] = set()
    for usuario_id, nombre in conexion.execute(sa.text("SELECT id, nombre FROM usuarios ORDER BY id")).all():
        base = base_desde(nombre)
        candidato, n = base, 1
        while candidato in tomados or candidato in RESERVADOS:
            n += 1
            candidato = f"{base}-{n}"
        tomados.add(candidato)
        conexion.execute(sa.text("UPDATE usuarios SET username = :u WHERE id = :i"), {"u": candidato, "i": usuario_id})

    op.alter_column("usuarios", "username", nullable=False)
    op.create_unique_constraint(op.f("uq_usuarios_username"), "usuarios", ["username"])


def downgrade() -> None:
    op.drop_constraint(op.f("uq_usuarios_username"), "usuarios", type_="unique")
    op.drop_column("usuarios", "actualizado_en")
    op.drop_column("usuarios", "avatar_clave")
    op.drop_column("usuarios", "username")
