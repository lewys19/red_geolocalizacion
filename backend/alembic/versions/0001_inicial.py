"""Inicial: PostGIS, usuarios y sesiones, categorías, negocios y sus miembros.

Revision ID: 0001
Revises:
Create Date: 2026-10-25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

ROL_PLATAFORMA = postgresql.ENUM("cliente", "operador", "superadmin", name="rol_plataforma", create_type=False)
ESTADO_NEGOCIO = postgresql.ENUM(
    "pendiente", "aprobado", "rechazado", "suspendido", name="estado_negocio", create_type=False
)
ROL_MIEMBRO = postgresql.ENUM("propietario", "editor", name="rol_miembro", create_type=False)

# Propuesta inicial para el piloto en Lima; el operador puede cambiarlas desde el panel.
# (slug, nombre, icono, slug del padre)
CATEGORIAS = [
    ("comida", "Comida", "utensils", None),
    ("pollerias", "Pollerías", "drumstick", "comida"),
    ("chifas", "Chifas", "bowl", "comida"),
    ("cevicherias", "Cevicherías", "fish", "comida"),
    ("comida-criolla", "Comida criolla", "pot", "comida"),
    ("hamburguesas-y-sanguches", "Hamburguesas y sánguches", "burger", "comida"),
    ("pizzerias", "Pizzerías", "pizza", "comida"),
    ("cafes-y-panaderias", "Cafés y panaderías", "coffee", "comida"),
    ("juguerias", "Juguerías", "cup", "comida"),
    ("bodegas", "Bodegas y minimarkets", "store", None),
    ("farmacias", "Farmacias y boticas", "pill", None),
    ("ferreterias", "Ferreterías", "hammer", None),
    ("peluquerias", "Peluquerías y barberías", "scissors", None),
    ("talleres", "Talleres mecánicos", "wrench", None),
    ("lavanderias", "Lavanderías", "shirt", None),
    ("veterinarias", "Veterinarias", "paw", None),
]


def upgrade() -> None:
    # PostGIS: tipos y funciones geográficas. unaccent y pg_trgm: búsqueda que tolera tildes y errores.
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS unaccent")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")

    bind = op.get_bind()
    for tipo in (ROL_PLATAFORMA, ESTADO_NEGOCIO, ROL_MIEMBRO):
        tipo.create(bind, checkfirst=True)

    op.create_table(
        "usuarios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("nombre", sa.String(80), nullable=False),
        sa.Column("telefono", sa.String(20), nullable=True),
        sa.Column("hash_contrasena", sa.String(255), nullable=False),
        sa.Column("rol", ROL_PLATAFORMA, nullable=False),
        sa.Column("acepto_terminos_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_usuarios")),
        sa.UniqueConstraint("email", name=op.f("uq_usuarios_email")),
    )

    op.create_table(
        "tokens_refresco",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("huella", sa.String(64), nullable=False),
        sa.Column("expira_en", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revocado_en", sa.DateTime(timezone=True), nullable=True),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_tokens_refresco_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_tokens_refresco")),
        sa.UniqueConstraint("huella", name=op.f("uq_tokens_refresco_huella")),
    )
    op.create_index(op.f("ix_tokens_refresco_usuario_id"), "tokens_refresco", ["usuario_id"])

    categorias = op.create_table(
        "categorias",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(60), nullable=False),
        sa.Column("slug", sa.String(70), nullable=False),
        sa.Column("icono", sa.String(40), nullable=True),
        sa.Column("padre_id", sa.Integer(), nullable=True),
        sa.Column("orden", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["padre_id"], ["categorias.id"], name=op.f("fk_categorias_padre_id_categorias"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_categorias")),
        sa.UniqueConstraint("slug", name=op.f("uq_categorias_slug")),
    )

    op.create_table(
        "negocios",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("slug", sa.String(140), nullable=False),
        sa.Column("descripcion", sa.Text(), nullable=True),
        sa.Column("categoria_id", sa.Integer(), nullable=False),
        sa.Column("distrito", sa.String(60), nullable=False),
        sa.Column("direccion", sa.String(200), nullable=False),
        sa.Column("referencia", sa.String(200), nullable=True),
        sa.Column("ubicacion", Geography(geometry_type="POINT", srid=4326, spatial_index=False), nullable=False),
        sa.Column("telefono", sa.String(20), nullable=True),
        sa.Column("whatsapp", sa.String(20), nullable=True),
        sa.Column("tiene_delivery", sa.Boolean(), nullable=False),
        sa.Column("estado", ESTADO_NEGOCIO, nullable=False),
        sa.Column("calificacion_promedio", sa.Numeric(2, 1), nullable=True),
        sa.Column("total_resenas", sa.Integer(), nullable=False),
        sa.Column("creado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("eliminado_en", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["categoria_id"], ["categorias.id"], name=op.f("fk_negocios_categoria_id_categorias"), ondelete="RESTRICT"
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_negocios")),
        sa.UniqueConstraint("slug", name=op.f("uq_negocios_slug")),
    )
    op.create_index("ix_negocios_ubicacion", "negocios", ["ubicacion"], postgresql_using="gist")
    op.create_index(op.f("ix_negocios_categoria_id"), "negocios", ["categoria_id"])
    op.create_index(op.f("ix_negocios_estado"), "negocios", ["estado"])

    op.create_table(
        "miembros_negocio",
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("negocio_id", sa.Integer(), nullable=False),
        sa.Column("rol", ROL_MIEMBRO, nullable=False),
        sa.ForeignKeyConstraint(
            ["negocio_id"], ["negocios.id"], name=op.f("fk_miembros_negocio_negocio_id_negocios"), ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(
            ["usuario_id"], ["usuarios.id"], name=op.f("fk_miembros_negocio_usuario_id_usuarios"), ondelete="CASCADE"
        ),
        sa.PrimaryKeyConstraint("usuario_id", "negocio_id", name=op.f("pk_miembros_negocio")),
    )
    op.create_index(op.f("ix_miembros_negocio_negocio_id"), "miembros_negocio", ["negocio_id"])

    # Categorías iniciales: primero los padres (para conocer su id), luego los hijos.
    ids: dict[str, int] = {}
    for orden, (slug, nombre, icono, padre) in enumerate(CATEGORIAS):
        fila = bind.execute(
            categorias.insert()
            .values(nombre=nombre, slug=slug, icono=icono, padre_id=ids.get(padre) if padre else None, orden=orden)
            .returning(categorias.c.id)
        )
        ids[slug] = fila.scalar_one()


def downgrade() -> None:
    op.drop_table("miembros_negocio")
    op.drop_table("negocios")
    op.drop_table("categorias")
    op.drop_table("tokens_refresco")
    op.drop_table("usuarios")
    bind = op.get_bind()
    for tipo in (ROL_MIEMBRO, ESTADO_NEGOCIO, ROL_PLATAFORMA):
        tipo.drop(bind, checkfirst=True)
