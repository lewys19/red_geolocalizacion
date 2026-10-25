import re
from datetime import time
from typing import Annotated

from pydantic import AfterValidator, BaseModel, Field, StringConstraints, model_validator

from app.core.geo import DISTRITOS, dentro_del_piloto
from app.models import EstadoNegocio, RolMiembro

Texto = Annotated[str, StringConstraints(strip_whitespace=True)]


def _validar_telefono(valor: str | None) -> str | None:
    """Deja solo dígitos (y el + inicial). Un celular peruano de 9 dígitos recibe el código 51."""
    if valor is None or not valor.strip():
        return None
    digitos = re.sub(r"[^\d]", "", valor)
    if not 6 <= len(digitos) <= 15:
        raise ValueError("Número de teléfono no válido.")
    if len(digitos) == 9 and digitos.startswith("9"):
        digitos = "51" + digitos
    return digitos


def _validar_distrito(valor: str) -> str:
    if valor not in DISTRITOS:
        raise ValueError("Elige un distrito de Lima o Callao.")
    return valor


Telefono = Annotated[str | None, AfterValidator(_validar_telefono)]
Distrito = Annotated[str, AfterValidator(_validar_distrito)]


class HorarioIn(BaseModel):
    dia_semana: Annotated[int, Field(ge=0, le=6)]
    abre: time
    cierra: time

    @model_validator(mode="after")
    def _distintos(self) -> "HorarioIn":
        if self.abre == self.cierra:
            raise ValueError("La hora de apertura y la de cierre no pueden ser iguales.")
        return self


class HorarioOut(HorarioIn):
    pass


class Ubicacion(BaseModel):
    lng: Annotated[float, Field(ge=-180, le=180)]
    lat: Annotated[float, Field(ge=-90, le=90)]

    @model_validator(mode="after")
    def _en_lima(self) -> "Ubicacion":
        if not dentro_del_piloto(self.lng, self.lat):
            raise ValueError("Por ahora Altoque solo funciona en Lima y Callao.")
        return self


class NegocioIn(BaseModel):
    nombre: Annotated[Texto, Field(min_length=2, max_length=120)]
    categoria_id: int
    descripcion: Annotated[Texto, Field(max_length=1000)] | None = None
    distrito: Distrito
    direccion: Annotated[Texto, Field(min_length=5, max_length=200)]
    referencia: Annotated[Texto, Field(max_length=200)] | None = None
    ubicacion: Ubicacion
    telefono: Telefono = None
    whatsapp: Telefono = None
    tiene_delivery: bool = False
    horarios: Annotated[list[HorarioIn], Field(max_length=28)] = []


class NegocioCambios(BaseModel):
    """Edición parcial: solo se cambia lo que se envía. `horarios` reemplaza la lista completa."""

    nombre: Annotated[Texto, Field(min_length=2, max_length=120)] | None = None
    categoria_id: int | None = None
    descripcion: Annotated[Texto, Field(max_length=1000)] | None = None
    distrito: Distrito | None = None
    direccion: Annotated[Texto, Field(min_length=5, max_length=200)] | None = None
    referencia: Annotated[Texto, Field(max_length=200)] | None = None
    ubicacion: Ubicacion | None = None
    telefono: Telefono = None
    whatsapp: Telefono = None
    tiene_delivery: bool | None = None
    horarios: Annotated[list[HorarioIn], Field(max_length=28)] | None = None


class NegocioOut(BaseModel):
    """Lo que ve el dueño de su negocio (y el operador)."""

    id: int
    slug: str
    nombre: str
    categoria_id: int
    categoria: str
    descripcion: str | None
    distrito: str
    direccion: str
    referencia: str | None
    ubicacion: Ubicacion | None  # None solo si quedara fuera del piloto (no debería)
    telefono: str | None
    whatsapp: str | None
    tiene_delivery: bool
    estado: EstadoNegocio
    motivo_rechazo: str | None
    horarios: list[HorarioOut]
    mi_rol: RolMiembro | None = None


class RechazoIn(BaseModel):
    motivo: Annotated[Texto, Field(min_length=5, max_length=300)]


# ---------- Mapa ----------


class PuntoMapa(BaseModel):
    id: int
    slug: str
    nombre: str
    categoria: str
    lng: float
    lat: float
    distrito: str
    direccion: str
    referencia: str | None
    telefono: str | None
    whatsapp: str | None
    tiene_delivery: bool
    abierto: bool | None  # None = no cargó horarios
    cierra_a: time | None
    distancia_m: int | None  # solo si se envió la ubicación de quien busca


class GrupoMapa(BaseModel):
    lng: float
    lat: float
    cantidad: int


class MapaOut(BaseModel):
    total: int
    puntos: list[PuntoMapa]
    grupos: list[GrupoMapa]


class DireccionSugeridaOut(BaseModel):
    direccion: str | None
    distrito: str | None
    completa: str
