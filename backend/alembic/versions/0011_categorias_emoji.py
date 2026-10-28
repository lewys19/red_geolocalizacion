"""Categorías administrables desde el panel: el ícono pasa a ser el emoji mismo y se crea el permiso.

Antes el ícono era un nombre ("drumstick") que la web traducía a emoji; desde el panel se elige el emoji
directamente (🐾), así una categoría nueva no requiere tocar código. El Subadministrador recibe el permiso nuevo.

Revision ID: 0011
Revises: 0010
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0011"
down_revision: str | None = "0010"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

EMOJIS = {
    "utensils": "🍽️", "drumstick": "🍗", "bowl": "🥡", "fish": "🐟", "pot": "🍲", "burger": "🍔", "pizza": "🍕",
    "coffee": "☕", "cup": "🥤", "store": "🏪", "pill": "💊", "hammer": "🔨", "scissors": "✂️", "wrench": "🔧",
    "shirt": "👕", "paw": "🐾",
}  # fmt: skip


def upgrade() -> None:
    conexion = op.get_bind()
    for nombre, emoji in EMOJIS.items():
        conexion.execute(sa.text("UPDATE categorias SET icono = :e WHERE icono = :n"), {"e": emoji, "n": nombre})
    op.execute(
        "UPDATE roles_panel SET permisos = array_append(permisos, 'categorias.gestionar') "
        "WHERE id = 1 AND NOT 'categorias.gestionar' = ANY(permisos)"
    )


def downgrade() -> None:
    conexion = op.get_bind()
    for nombre, emoji in EMOJIS.items():
        conexion.execute(sa.text("UPDATE categorias SET icono = :n WHERE icono = :e"), {"e": emoji, "n": nombre})
    op.execute("UPDATE roles_panel SET permisos = array_remove(permisos, 'categorias.gestionar')")
