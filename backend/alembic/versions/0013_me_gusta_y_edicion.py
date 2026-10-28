"""«Me gusta» a la página del negocio; publicaciones con fecha de edición y contador de compartidos.

Revision ID: 0013
Revises: 0012
Create Date: 2026-10-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0013"
down_revision: str | None = "0012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "me_gusta_negocio",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_me_gusta_negocio_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_me_gusta_negocio_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("usuario_id", "negocio_id", name=op.f("pk_me_gusta_negocio")),
    )
    op.create_index(op.f("ix_me_gusta_negocio_negocio_id"), "me_gusta_negocio", ["negocio_id"])
    op.add_column("publicaciones", sa.Column("editado_en", sa.DateTime(timezone=True), nullable=True))
    op.add_column("publicaciones", sa.Column("compartidos", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("publicaciones", "compartidos")
    op.drop_column("publicaciones", "editado_en")
    op.drop_index(op.f("ix_me_gusta_negocio_negocio_id"), table_name="me_gusta_negocio")
    op.drop_table("me_gusta_negocio")
