from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core import usernames
from app.models import RolPlataforma


def normalizar_celular(valor: str) -> str | None:
    """Celular peruano en 9 dígitos (987654321). Acepta espacios, guiones y el prefijo +51."""
    digitos = "".join(c for c in valor if c.isdigit())
    if len(digitos) == 11 and digitos.startswith("51"):
        digitos = digitos[2:]
    return digitos if len(digitos) == 9 and digitos.startswith("9") else None


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    nombre: str
    rol: RolPlataforma
    en_panel: bool  # la web muestra el enlace al panel administrativo


class NegocioPropioOut(BaseModel):
    negocio_id: int
    negocio_nombre: str


class YoOut(UsuarioOut):
    avatar: str | None
    telefono: str | None
    creado_en: datetime
    negocios: list[NegocioPropioOut]
    # Niveles que la web usa para mostrar u ocultar menús (los permisos los decide la API).
    es_negocio: bool
    es_operador: bool  # tiene acceso al panel administrativo
    es_superadmin: bool
    rol_panel: str | None  # «Administrador», «Subadministrador»…
    permisos: list[str]


class YoCambios(BaseModel):
    """Datos propios que el usuario puede cambiar. El correo no: es con lo que ingresa."""

    nombre: Annotated[str, StringConstraints(strip_whitespace=True), Field(min_length=2, max_length=80)] | None = None
    celular: str | None = None  # "" o null lo quita
    username: str | None = None

    @field_validator("username")
    @classmethod
    def _username(cls, valor: str | None) -> str | None:
        if valor is None:
            return None
        valor = valor.strip().lower().removeprefix("@")
        if motivo := usernames.problema(valor):
            raise ValueError(motivo)
        return valor

    @field_validator("celular")
    @classmethod
    def _celular(cls, valor: str | None) -> str | None:
        if valor is None or not valor.strip():
            return None
        normalizado = normalizar_celular(valor)
        if normalizado is None:
            raise ValueError("El celular debe tener 9 dígitos y empezar con 9.")
        return normalizado


class NegocioDePerfil(BaseModel):
    nombre: str
    slug: str
    categoria: str
    distrito: str
    logo: str | None


class PerfilPublicoOut(BaseModel):
    """Lo que cualquiera ve en altoque.pe/{username}. Sin correo ni celular."""

    username: str
    nombre: str
    avatar: str | None
    creado_en: datetime
    negocios: list[NegocioDePerfil]  # solo los aprobados
