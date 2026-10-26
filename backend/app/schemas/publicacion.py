from datetime import datetime

from pydantic import BaseModel

from app.schemas.catalogo import FotoOut
from app.schemas.social import TipoReaccion


class NegocioMini(BaseModel):
    """Lo mínimo para mostrar un negocio en el Inicio: círculo, tarjeta o cabecera de publicación."""

    id: int
    slug: str
    nombre: str
    categoria: str
    distrito: str
    foto: str | None  # su foto de perfil; si no tiene, la primera de su galería
    distancia_m: int | None = None  # solo si se envió la ubicación de quien mira


class PublicacionOut(BaseModel):
    id: int
    texto: str
    creado_en: datetime
    negocio: NegocioMini
    fotos: list[FotoOut]
    reacciones: dict[str, int]
    total_reacciones: int
    total_comentarios: int
    mi_reaccion: TipoReaccion | None = None  # solo si quien mira inició sesión


class MuroOut(BaseModel):
    publicaciones: list[PublicacionOut]
    # Para pedir la página siguiente: ?antes_de=<siguiente>. None = no hay más.
    siguiente: int | None
