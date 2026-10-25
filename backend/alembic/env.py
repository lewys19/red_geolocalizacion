"""Entorno de Alembic: usa la misma URL y los mismos modelos que la API."""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool, text

import app.models  # noqa: F401  (registra los modelos)
from app.core.config import settings
from app.core.database import Base

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Una URL pasada desde fuera (las pruebas) tiene prioridad sobre la del .env.
if not config.get_main_option("sqlalchemy.url"):
    config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

# Tablas que crea PostGIS por su cuenta: Alembic no debe intentar borrarlas.
TABLAS_DE_POSTGIS = {"spatial_ref_sys"}


def incluir_objeto(objeto, nombre, tipo, _reflejado, _comparar_con) -> bool:  # type: ignore[no-untyped-def]
    return not (tipo == "table" and nombre in TABLAS_DE_POSTGIS)


def run_migrations_offline() -> None:
    context.configure(
        url=config.get_main_option("sqlalchemy.url"),
        target_metadata=target_metadata,
        literal_binds=True,
        include_object=incluir_objeto,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    motor = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with motor.connect() as conexion:
        # La imagen de PostGIS agrega los esquemas tiger y topology al search_path:
        # Alembic solo debe mirar el esquema de la app.
        conexion.execute(text("SET search_path TO public"))
        conexion.commit()  # cierra esa mini transacción: si no, Alembic no guardaría la migración
        context.configure(connection=conexion, target_metadata=target_metadata, include_object=incluir_objeto)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
