from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, EmailStr, Field, StringConstraints

from app.core.security import LARGO_MAXIMO_CONTRASENA
from app.schemas.usuario import UsuarioOut

Nombre = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
Contrasena = Annotated[str, Field(min_length=8, max_length=LARGO_MAXIMO_CONTRASENA)]


class RegistroIn(BaseModel):
    email: EmailStr
    nombre: Nombre
    contrasena: Contrasena
    # Ley 29733: sin consentimiento expreso no se crea la cuenta.
    acepta_terminos: Literal[True]


class LoginIn(BaseModel):
    email: EmailStr
    contrasena: Annotated[str, Field(max_length=LARGO_MAXIMO_CONTRASENA)]


class RefrescoIn(BaseModel):
    token_refresco: Annotated[str, Field(min_length=20, max_length=200)]


class SesionOut(BaseModel):
    token_acceso: str
    token_refresco: str
    tipo: str = "bearer"
    acceso_expira_en: datetime
    usuario: UsuarioOut
