from pydantic import BaseModel


class CategoriaOut(BaseModel):
    id: int
    nombre: str
    slug: str
    icono: str | None
    hijas: list["CategoriaOut"] = []
