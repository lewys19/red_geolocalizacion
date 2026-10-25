"""Búsqueda por texto: función sin tildes inmutable e índice de trigramas.

`unaccent` no es inmutable (depende de un diccionario), así que no sirve para
índices. Se envuelve en `f_unaccent`, fijando el diccionario, y con ella se
crea un índice GIN de trigramas (pg_trgm) sobre el nombre del negocio.

Revision ID: 0004
Revises: 0003
Create Date: 2026-10-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION f_unaccent(texto text) RETURNS text
        LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
        AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, texto) $$
        """
    )
    op.execute(
        "CREATE INDEX ix_negocios_nombre_trgm ON negocios USING gin (f_unaccent(lower(nombre)) gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_negocios_nombre_trgm")
    op.execute("DROP FUNCTION IF EXISTS f_unaccent(text)")
