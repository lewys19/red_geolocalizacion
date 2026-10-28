from datetime import datetime
from typing import Annotated, Literal

from pydantic import AliasChoices, BaseModel, EmailStr, Field, StringConstraints, field_validator

from app.core.security import LARGO_MAXIMO_CONTRASENA
from app.schemas.usuario import UsuarioOut, normalizar_celular

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Contrasena = Annotated[str, Field(min_length=8, max_length=LARGO_MAXIMO_CONTRASENA)]


class RegistroIn(BaseModel):
    email: EmailStr
    nombre: Nombre
    contrasena: Contrasena
    celular: str | None = None
    # Ley 29733: sin consentimiento expreso no se crea la cuenta.
    acepta_terminos: Literal[True]

    @field_validator("celular")
    @classmethod
    def _celular(cls, valor: str | None) -> str | None:
        if valor is None or not valor.strip():
            return None
        normalizado = normalizar_celular(valor)
        if normalizado is None:
            raise ValueError("El celular debe tener 9 dígitos y empezar con 9.")
        return normalizado


class LoginIn(BaseModel):
    # Correo o celular. "email" se sigue aceptando para los clientes que ya lo usaban.
    usuario: Annotated[str, Field(min_length=3, max_length=254, validation_alias=AliasChoices("usuario", "email"))]
    contrasena: Annotated[str, Field(max_length=LARGO_MAXIMO_CONTRASENA)]


class RefrescoIn(BaseModel):
    token_refresco: Annotated[str, Field(min_length=20, max_length=200)]


class SesionOut(BaseModel):
    token_acceso: str
    token_refresco: str
    tipo: str = "bearer"
    acceso_expira_en: datetime
    usuario: UsuarioOut


class CanjeIn(BaseModel):
    codigo: Annotated[str, Field(min_length=20, max_length=100)]


class ProveedoresOut(BaseModel):
    proveedores: list[str]
