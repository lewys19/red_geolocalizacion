"""Almacén de archivos (fotos) con el patrón Strategy.

La app solo conoce `Almacen`: guardar, borrar y dar la URL pública de un archivo.
Hoy la estrategia es el disco del servidor; para crecer se agrega una de
Cloudflare R2 o S3 con la misma interfaz y se elige por configuración.
"""

from functools import lru_cache
from pathlib import Path
from typing import Protocol

from app.core.config import settings


class Almacen(Protocol):
    def guardar(self, clave: str, datos: bytes, tipo: str) -> None: ...
    def borrar(self, clave: str) -> None: ...
    def url(self, clave: str) -> str: ...


class AlmacenLocal:
    """Archivos en una carpeta del servidor, servidos por la API en /media/<clave>."""

    def __init__(self, carpeta: str) -> None:
        self.raiz = Path(carpeta).resolve()

    def _ruta(self, clave: str) -> Path:
        ruta = (self.raiz / clave).resolve()
        if not ruta.is_relative_to(self.raiz):  # nunca fuera de la carpeta (../)
            raise ValueError("Clave de archivo no válida")
        return ruta

    def guardar(self, clave: str, datos: bytes, tipo: str) -> None:
        ruta = self._ruta(clave)
        ruta.parent.mkdir(parents=True, exist_ok=True)
        ruta.write_bytes(datos)

    def borrar(self, clave: str) -> None:
        self._ruta(clave).unlink(missing_ok=True)

    def url(self, clave: str) -> str:
        return f"/media/{clave}"


@lru_cache
def obtener_almacen() -> Almacen:
    if settings.ALMACEN_FOTOS == "local":
        return AlmacenLocal(settings.CARPETA_MEDIA)
    raise RuntimeError(f"Almacén de fotos no soportado todavía: {settings.ALMACEN_FOTOS}")
