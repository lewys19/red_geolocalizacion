from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Categoria
from app.schemas.categoria import CategoriaOut


def arbol(db: Session) -> list[CategoriaOut]:
    filas = db.scalars(select(Categoria).order_by(Categoria.orden, Categoria.nombre)).all()
    nodos = {c.id: CategoriaOut(id=c.id, nombre=c.nombre, slug=c.slug, icono=c.icono) for c in filas}
    raices: list[CategoriaOut] = []
    for c in filas:
        if c.padre_id is None:
            raices.append(nodos[c.id])
        elif c.padre_id in nodos:
            nodos[c.padre_id].hijas.append(nodos[c.id])
    return raices
