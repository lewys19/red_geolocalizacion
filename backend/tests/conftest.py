"""Configuración de pruebas.

Las pruebas usan una base PostgreSQL + PostGIS real (`altoque_pruebas`), separada
de la de desarrollo: SQLite no entiende de geografía. Se crea si no existe, se le
aplican las migraciones una vez por ejecución y se vacía antes de cada prueba.
Necesita la base levantada: `docker compose up -d db redis` (en CI, un servicio).
"""

import os

# Antes de importar la app: la configuración se lee al importarla.
os.environ.setdefault("SECRET_KEY", "clave-de-pruebas-de-al-menos-32-caracteres")

from collections.abc import Callable, Generator  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import Engine, create_engine, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402

from app.api.deps import get_db  # noqa: E402
from app.core.config import settings  # noqa: E402
from app.main import app  # noqa: E402

Cabeceras = dict[str, str]

URL_PRUEBAS = make_url(os.environ.get("DATABASE_URL_PRUEBAS") or settings.DATABASE_URL).set(
    database="altoque_pruebas"
)
# Tablas que se vacían entre pruebas (las categorías vienen de la migración y se conservan).
TABLAS_DE_DATOS = (
    "comentarios, reacciones, seguidores, fotos_publicacion, publicaciones, fotos, productos, horarios, "
    "miembros_negocio, negocios, cuentas_externas, tokens_refresco, usuarios"
)


def _crear_base_si_falta() -> None:
    admin = create_engine(URL_PRUEBAS.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conexion:
        existe = conexion.scalar(text("SELECT 1 FROM pg_database WHERE datname = 'altoque_pruebas'"))
        if not existe:
            conexion.execute(text("CREATE DATABASE altoque_pruebas"))
    admin.dispose()


@pytest.fixture(scope="session")
def engine() -> Generator[Engine, None, None]:
    _crear_base_si_falta()
    config = Config("alembic.ini")
    config.set_main_option("sqlalchemy.url", URL_PRUEBAS.render_as_string(hide_password=False))
    command.upgrade(config, "head")
    motor = create_engine(URL_PRUEBAS)
    yield motor
    motor.dispose()


@pytest.fixture()
def session_factory(engine: Engine) -> sessionmaker[Session]:
    with engine.begin() as conexion:
        conexion.execute(text(f"TRUNCATE {TABLAS_DE_DATOS} RESTART IDENTITY CASCADE"))
    return sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def db(session_factory: sessionmaker[Session]) -> Generator[Session, None, None]:
    with session_factory() as sesion:
        yield sesion


@pytest.fixture()
def client(session_factory: sessionmaker[Session]) -> Generator[TestClient, None, None]:
    def get_db_pruebas() -> Generator[Session, None, None]:
        with session_factory() as sesion:
            yield sesion

    app.dependency_overrides[get_db] = get_db_pruebas
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()


@pytest.fixture()
def registrar(client: TestClient) -> Callable[..., dict]:
    """Registra una cuenta y devuelve la sesión completa (tokens + usuario)."""

    def _registrar(email: str = "ana@example.com", contrasena: str = "clave-segura-1") -> dict:
        r = client.post(
            "/api/v1/auth/registro",
            json={"email": email, "nombre": "Ana", "contrasena": contrasena, "acepta_terminos": True},
        )
        assert r.status_code == 201, r.text
        return r.json()

    return _registrar


def cabeceras(sesion: dict) -> Cabeceras:
    return {"Authorization": f"Bearer {sesion['token_acceso']}"}


def datos_negocio(**cambios: object) -> dict:
    """Pollería en Miraflores (cerca del Parque Kennedy), abierta de lunes a domingo 12:00-23:00."""
    datos: dict = {
        "nombre": "Pollería El Buen Sabor",
        "categoria_id": 2,  # Pollerías (sembrada por la migración 0001)
        "distrito": "Miraflores",
        "direccion": "Av. Larco 345",
        "referencia": "Frente al parque",
        "ubicacion": {"lng": -77.0300, "lat": -12.1215},
        "whatsapp": "987 654 321",
        "tiene_delivery": True,
        "horarios": [{"dia_semana": d, "abre": "12:00", "cierra": "23:00"} for d in range(7)],
    }
    datos.update(cambios)
    return datos
