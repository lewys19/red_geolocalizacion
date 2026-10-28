from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, Field, StringConstraints

TipoReaccion = Literal["me_gusta", "me_encanta", "wow"]


class ImagenOut(BaseModel):
    url: str | None  # None = se quitó


class SeguirOut(BaseModel):
    seguidores: int
    lo_sigo: bool


class RelacionOut(BaseModel):
    """Qué es quien mira para este negocio: si lo sigue, si le dio «me gusta» y si puede editarlo (su dueño)."""

    lo_sigo: bool
    me_gusta: bool
    es_miembro: bool


class MeGustaOut(BaseModel):
    me_gusta: bool
    total: int  # «me gusta» de la página del negocio


class CompartidoOut(BaseModel):
    compartidos: int


class ReaccionIn(BaseModel):
    tipo: TipoReaccion


class ReaccionesOut(BaseModel):
    reacciones: dict[str, int]  # {"me_gusta": 3, "me_encanta": 1, "wow": 0}
    total: int
    mi_reaccion: TipoReaccion | None


class ComentarioIn(BaseModel):
    texto: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class AutorOut(BaseModel):
    id: int
    nombre: str


class ComentarioOut(BaseModel):
    id: int
    texto: str
    creado_en: datetime
    autor: AutorOut


class ComentariosOut(BaseModel):
    comentarios: list[ComentarioOut]  # los más antiguos primero, como una conversación
    siguiente: int | None  # ?despues_de=<siguiente> para los que siguen
    total: int


Pagina = Annotated[int, Field(ge=1)]
