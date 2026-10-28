from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints, field_validator

Texto = Annotated[str, StringConstraints(strip_whitespace=True)]


class AnuncioOut(BaseModel):
    """Lo que ve el sitio: solo los activos con imagen."""

    posicion: int
    titulo: str | None
    enlace: str | None
    imagen: str


class AnuncioAdminOut(BaseModel):
    """Un espacio del panel (puede estar vacío)."""

    posicion: int
    titulo: str | None
    enlace: str | None
    imagen: str | None
    activo: bool


class AnuncioIn(BaseModel):
    titulo: Annotated[Texto, Field(max_length=120)] | None = None
    enlace: Annotated[Texto, Field(max_length=300)] | None = None
    activo: bool = False

    @field_validator("enlace")
    @classmethod
    def _enlace(cls, valor: str | None) -> str | None:
        # Solo web o rutas del sitio: nada de "javascript:" en un enlace que ve todo el público.
        if not valor:
            return None
        if valor.startswith("/") and not valor.startswith("//"):
            return valor
        if valor.startswith(("https://", "http://")):
            return valor
        raise ValueError("El enlace debe empezar con https:// o con / (una página de Altoque).")


class SugerenciaIn(BaseModel):
    texto: Annotated[Texto, Field(min_length=3, max_length=1000)]


class AutorSugerencia(BaseModel):
    id: int
    username: str
    nombre: str


class SugerenciaOut(BaseModel):
    id: int
    texto: str
    creado_en: datetime
    usuario: AutorSugerencia | None  # None: la envió alguien sin sesión


class PaginaSugerencias(BaseModel):
    total: int
    pagina: int
    por_pagina: int
    sugerencias: list[SugerenciaOut]
