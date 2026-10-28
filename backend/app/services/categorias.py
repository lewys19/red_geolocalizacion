"""Categorías: el árbol público (Comida → Pollerías) y su administración desde el panel."""

import re
import unicodedata

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errores import ErrorNegocio
from app.models import Categoria, Negocio
from app.schemas.categoria import CategoriaAdminOut, CategoriaIn, CategoriaOut


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


# ---------- Panel administrativo ----------


def _slug(db: Session, nombre: str) -> str:
    """«Animales» → animales; si existe, animales-2… El slug no cambia al renombrar: no rompe enlaces."""
    base = re.sub(r"[^a-z0-9]+", "-", unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode().lower())
    base = base.strip("-")[:60] or "categoria"
    slug, n = base, 1
    while db.scalar(select(Categoria.id).where(Categoria.slug == slug)) is not None:
        n += 1
        slug = f"{base}-{n}"
    return slug


def listar_admin(db: Session) -> list[CategoriaAdminOut]:
    """Padres primero y cada uno seguido de sus hijas, en el orden en que se muestran en la web."""
    filas = db.scalars(select(Categoria).order_by(Categoria.orden, Categoria.nombre)).all()
    negocios = dict(
        db.execute(
            select(Negocio.categoria_id, func.count()).where(Negocio.eliminado_en.is_(None)).group_by(Negocio.categoria_id)
        ).all()
    )
    nombres = {c.id: c.nombre for c in filas}
    hijas: dict[int, list[Categoria]] = {}
    for c in filas:
        if c.padre_id is not None:
            hijas.setdefault(c.padre_id, []).append(c)

    def fila(c: Categoria) -> CategoriaAdminOut:
        return CategoriaAdminOut(
            id=c.id, nombre=c.nombre, slug=c.slug, icono=c.icono, orden=c.orden, padre_id=c.padre_id,
            padre=nombres.get(c.padre_id) if c.padre_id else None, hijas=len(hijas.get(c.id, [])),
            negocios=negocios.get(c.id, 0),
        )  # fmt: skip

    salida = []
    for c in filas:
        if c.padre_id is None:
            salida.append(fila(c))
            salida.extend(fila(h) for h in hijas.get(c.id, []))
    return salida


def _negocios_de(db: Session, categoria_id: int) -> int:
    """Incluye los borrados (siguen apuntando a la categoría en la base)."""
    return db.scalar(select(func.count()).select_from(Negocio).where(Negocio.categoria_id == categoria_id)) or 0


def _validar_padre(db: Session, padre_id: int | None, categoria: Categoria | None) -> None:
    """Solo dos niveles, y una categoría con negocios no puede pasar a tener subcategorías
    (sus negocios quedarían en una categoría que ya no se puede elegir)."""
    if padre_id is None:
        return
    padre = db.get(Categoria, padre_id)
    if padre is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "La categoría superior no existe.")
    if categoria is not None and padre.id == categoria.id:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Una categoría no puede ir dentro de sí misma.")
    if padre.padre_id is not None:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, f"«{padre.nombre}» ya es una subcategoría: solo hay dos niveles.")
    if categoria is not None and db.scalar(select(Categoria.id).where(Categoria.padre_id == categoria.id).limit(1)):
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Esta categoría tiene subcategorías: no puede ir dentro de otra.")
    if n := _negocios_de(db, padre.id):
        raise ErrorNegocio(
            status.HTTP_409_CONFLICT,
            f"«{padre.nombre}» tiene {n} negocio(s) asignados directamente: muévelos a otra categoría antes de "
            "agregarle subcategorías.",
        )


def _guardar(db: Session, categoria: Categoria, datos: CategoriaIn) -> CategoriaAdminOut:
    repetida = db.scalar(
        select(Categoria.id).where(func.lower(Categoria.nombre) == datos.nombre.lower(), Categoria.id != categoria.id)
    )
    if repetida:
        raise ErrorNegocio(status.HTTP_409_CONFLICT, "Ya existe una categoría con ese nombre.")
    categoria.nombre = datos.nombre
    categoria.icono = datos.icono or None
    categoria.padre_id = datos.padre_id
    categoria.orden = datos.orden
    db.commit()
    return next(c for c in listar_admin(db) if c.id == categoria.id)


def crear(db: Session, datos: CategoriaIn) -> CategoriaAdminOut:
    _validar_padre(db, datos.padre_id, None)
    categoria = Categoria(slug=_slug(db, datos.nombre), nombre=datos.nombre)
    db.add(categoria)
    db.flush()
    return _guardar(db, categoria, datos)


def editar(db: Session, categoria_id: int, datos: CategoriaIn) -> CategoriaAdminOut:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Categoría no encontrada.")
    if datos.padre_id != categoria.padre_id:
        _validar_padre(db, datos.padre_id, categoria)
    return _guardar(db, categoria, datos)


def eliminar(db: Session, categoria_id: int) -> None:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Categoría no encontrada.")
    if db.scalar(select(Categoria.id).where(Categoria.padre_id == categoria.id).limit(1)):
        raise ErrorNegocio(status.HTTP_409_CONFLICT, "Tiene subcategorías: elimínalas o muévelas primero.")
    if n := _negocios_de(db, categoria.id):
        raise ErrorNegocio(
            status.HTTP_409_CONFLICT, f"Tiene {n} negocio(s). Muévelos a otra categoría antes de eliminarla."
        )
    db.delete(categoria)
    db.commit()
