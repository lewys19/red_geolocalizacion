from datetime import time
from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

from app.schemas.negocio import HorarioOut

Texto = Annotated[str, StringConstraints(strip_whitespace=True)]
# Precio en céntimos de sol (1850 = S/ 18.50). None = "consultar". Tope: S/ 100 000.
Precio = Annotated[int, Field(ge=0, le=10_000_000)]


class ProductoIn(BaseModel):
    nombre: Annotated[Texto, Field(min_length=2, max_length=120)]
    descripcion: Annotated[Texto, Field(max_length=300)] | None = None
    precio_centimos: Precio | None = None
    disponible: bool = True
    orden: Annotated[int, Field(ge=0, le=999)] = 0


class ProductoCambios(BaseModel):
    nombre: Annotated[Texto, Field(min_length=2, max_length=120)] | None = None
    descripcion: Annotated[Texto, Field(max_length=300)] | None = None
    precio_centimos: Precio | None = None
    disponible: bool | None = None
    orden: Annotated[int, Field(ge=0, le=999)] | None = None


class ProductoOut(BaseModel):
    id: int
    nombre: str
    descripcion: str | None
    precio_centimos: int | None
    disponible: bool
    orden: int


class FotoOut(BaseModel):
    id: int
    url: str
    ancho: int
    alto: int


class FichaOut(BaseModel):
    """Lo que ve cualquiera en la página pública del negocio."""

    id: int
    slug: str
    nombre: str
    categoria: str
    categoria_slug: str
    descripcion: str | None
    distrito: str
    direccion: str
    referencia: str | None
    lng: float
    lat: float
    telefono: str | None
    whatsapp: str | None
    tiene_delivery: bool
    abierto: bool | None
    cierra_a: time | None
    horarios: list[HorarioOut]
    productos: list[ProductoOut]
    fotos: list[FotoOut]
    calificacion_promedio: float | None
    total_resenas: int
    logo: str | None
    portada: str | None
    seguidores: int
    total_reacciones: int  # reacciones sumadas de todas sus publicaciones
    total_me_gusta: int  # «me gusta» a la página del negocio
    total_publicaciones: int


class CatalogoOut(BaseModel):
    """Catálogo completo para el panel del dueño (incluye lo no disponible)."""

    productos: list[ProductoOut]
    fotos: list[FotoOut]
    logo: str | None
    portada: str | None
