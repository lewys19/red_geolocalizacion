from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator

from app.core.permisos import PERMISOS
from app.models import RolPlataforma
from app.schemas.catalogo import FotoOut
from app.schemas.negocio import NegocioOut


class ConteoCategoria(BaseModel):
    categoria: str
    negocios: int


class ResumenOut(BaseModel):
    usuarios: int
    usuarios_nuevos_7d: int
    usuarios_con_negocio: int
    usuarios_sin_negocio: int
    negocios: int  # registrados, en cualquier estado
    negocios_por_estado: dict[str, int]
    categorias: int
    por_categoria: list[ConteoCategoria]  # de más a menos negocios
    equipo: int  # cuentas con acceso al panel


class DuenoOut(BaseModel):
    id: int
    username: str
    nombre: str
    email: str


class NegocioConDuenoOut(NegocioOut):
    """Un negocio en la tabla del panel, con el usuario que lo creó (su dueño)."""

    dueno: DuenoOut


class NegocioAdminOut(NegocioOut):
    logo: str | None
    portada: str | None
    fotos: list[FotoOut]


class RolCorto(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str


class UsuarioFilaOut(BaseModel):
    """Una fila de la tabla de usuarios del panel."""

    id: int
    email: str
    username: str
    nombre: str
    telefono: str | None
    rol: RolPlataforma
    rol_panel: RolCorto | None
    creado_en: datetime
    negocios: int


class PaginaUsuarios(BaseModel):
    total: int
    pagina: int
    por_pagina: int
    usuarios: list[UsuarioFilaOut]


class UsuarioAdminOut(UsuarioFilaOut):
    """Un usuario tal como lo ve el equipo de Altoque: sus datos y los de sus negocios."""

    negocios: list[NegocioAdminOut]  # type: ignore[assignment]


class AsignarRolIn(BaseModel):
    rol_panel_id: int | None  # null le quita el acceso al panel


class PermisoOut(BaseModel):
    clave: str
    texto: str


class RolPanelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nombre: str
    descripcion: str | None
    permisos: list[str]
    usuarios: int = 0


class RolPanelIn(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True), Field(min_length=3, max_length=40)]
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True), Field(max_length=200)] | None = None
    permisos: list[str]

    @field_validator("nombre")
    @classmethod
    def _nombre(cls, valor: str) -> str:
        if valor.lower() == "administrador":
            raise ValueError("«Administrador» está reservado.")
        return valor

    @field_validator("permisos")
    @classmethod
    def _permisos(cls, valor: list[str]) -> list[str]:
        desconocidos = [p for p in valor if p not in PERMISOS]
        if desconocidos:
            raise ValueError(f"Permisos desconocidos: {', '.join(desconocidos)}")
        return [p for p in PERMISOS if p in valor]  # sin repetidos y en el orden del catálogo

