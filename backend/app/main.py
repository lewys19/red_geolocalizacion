"""Punto de entrada de la API de Altoque."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import redis
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app import models  # noqa: F401  (importa los modelos para registrarlos)
from app.api.v1.api import api_router
from app.core.config import settings
from app.core.database import engine
from app.core.errores import ErrorNegocio, manejar_error_negocio
from app.core.security import verificar_secret_key

# Las tablas las crea Alembic: `alembic upgrade head` (ver README).


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    verificar_secret_key()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Directorio de negocios locales con mapa. Piloto en Lima.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()],
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type"],
)
app.add_exception_handler(ErrorNegocio, manejar_error_negocio)  # type: ignore[arg-type]
app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["Health"])
def health_check() -> JSONResponse:
    """Comprueba la API, la base (con PostGIS) y Redis. Lo usa el healthcheck de Docker."""
    estado: dict[str, str] = {}
    try:
        with engine.connect() as conexion:
            estado["postgis"] = conexion.execute(text("SELECT postgis_lib_version()")).scalar_one()
        estado["db"] = "ok"
    except Exception:  # noqa: BLE001  (cualquier fallo de la base = no saludable)
        estado["db"] = "error"
    try:
        redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2).ping()
        estado["redis"] = "ok"
    except redis.RedisError:
        estado["redis"] = "error"
    sano = estado["db"] == "ok" and estado["redis"] == "ok"
    return JSONResponse({"status": "ok" if sano else "error", **estado}, status_code=200 if sano else 503)
