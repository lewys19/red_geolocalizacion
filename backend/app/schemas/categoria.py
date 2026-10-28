from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    slug: str
    icono: str | None
    hijas: list["CategoriaOut"] = []


class CategoriaAdminOut(BaseModel):
    """Una fila de la tabla de categorías del panel."""

    id: int
    nombre: str
    slug: str
    icono: str | None
    orden: int
    padre_id: int | None
    padre: str | None
    hijas: int
    negocios: int  # con la categoría asignada directamente


class CategoriaIn(BaseModel):
    nombre: Annotated[str, StringConstraints(strip_whitespace=True), Field(min_length=2, max_length=60)]
    icono: Annotated[str, StringConstraints(strip_whitespace=True), Field(max_length=16)] | None = None  # un emoji
    padre_id: int | None = None  # dentro de qué categoría va (solo dos niveles)
    orden: Annotated[int, Field(ge=0, le=999)] = 0
