"""Errores de negocio.

Los servicios lanzan `ErrorNegocio` y un único manejador (en app.main) lo
convierte en respuesta JSON con el mismo formato que usa FastAPI:
{"detail": "mensaje", ...datos extra}.
"""

from typing import Any

from fastapi import Request
from fastapi.responses import JSONResponse


class ErrorNegocio(Exception):
    def __init__(self, status_code: int, mensaje: str, **extra: Any) -> None:
        super().__init__(mensaje)
        self.status_code = status_code
        self.mensaje = mensaje
        self.extra = extra


async def manejar_error_negocio(_request: Request, error: ErrorNegocio) -> JSONResponse:
    return JSONResponse(status_code=error.status_code, content={"detail": error.mensaje, **error.extra})
