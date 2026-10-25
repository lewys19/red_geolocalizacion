"""Catálogo de productos con precios y fotos de los negocios.

Revision ID: 0003
Revises: 0002
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table('fotos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('negocio_id', sa.Integer(), nullable=False),
    sa.Column('clave', sa.String(length=200), nullable=False),
    sa.Column('ancho', sa.SmallInteger(), nullable=False),
    sa.Column('alto', sa.SmallInteger(), nullable=False),
    sa.Column('orden', sa.SmallInteger(), server_default='0', nullable=False),
    sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['negocio_id'], ['negocios.id'], name=op.f('fk_fotos_negocio_id_negocios'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_fotos')),
    sa.UniqueConstraint('clave', name=op.f('uq_fotos_clave'))
    )
    op.create_index(op.f('ix_fotos_negocio_id'), 'fotos', ['negocio_id'], unique=False)
    op.create_table('productos',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('negocio_id', sa.Integer(), nullable=False),
    sa.Column('nombre', sa.String(length=120), nullable=False),
    sa.Column('descripcion', sa.String(length=300), nullable=True),
    sa.Column('precio_centimos', sa.Integer(), nullable=True),
    sa.Column('disponible', sa.Boolean(), server_default='true', nullable=False),
    sa.Column('orden', sa.SmallInteger(), server_default='0', nullable=False),
    sa.Column('creado_en', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.CheckConstraint('precio_centimos >= 0', name=op.f('ck_productos_precio_no_negativo')),
    sa.ForeignKeyConstraint(['negocio_id'], ['negocios.id'], name=op.f('fk_productos_negocio_id_negocios'), ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id', name=op.f('pk_productos'))
    )
    op.create_index(op.f('ix_productos_negocio_id'), 'productos', ['negocio_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_productos_negocio_id'), table_name='productos')
    op.drop_table('productos')
    op.drop_index(op.f('ix_fotos_negocio_id'), table_name='fotos')
    op.drop_table('fotos')
