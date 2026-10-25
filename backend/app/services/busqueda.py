"""Búsqueda por texto: "pollo a la brasa" → negocios cuyo nombre, descripción,
categoría o carta se parezcan a esas palabras (sin tildes y con algún error de tipeo).

Cada palabra útil suma su parecido (word_similarity de pg_trgm, de 0 a 1) si
supera el umbral; se ordena por esa suma. Así un negocio que coincide en
"pollo" y "brasa" queda antes que uno que solo coincide en "pollo".
"""

import re
import unicodedata

from sqlalchemy import ColumnElement, Float, String, case, cast, func, literal, select

from app.models import Categoria, Negocio, Producto

# Palabras que no ayudan a buscar.
VACIAS = {"a", "al", "la", "las", "el", "los", "de", "del", "en", "y", "o", "con", "para", "por", "un", "una", "que"}
UMBRAL = 0.5
MAX_PALABRAS = 6


def palabras(consulta: str) -> list[str]:
    sin_tildes = unicodedata.normalize("NFKD", consulta).encode("ascii", "ignore").decode("ascii").lower()
    vistas: list[str] = []
    for p in re.findall(r"[a-z0-9]+", sin_tildes):
        if len(p) >= 3 and p not in VACIAS and p not in vistas:
            vistas.append(p)
    return vistas[:MAX_PALABRAS]


def _limpio(columna: ColumnElement) -> ColumnElement:
    return func.f_unaccent(func.lower(func.coalesce(columna, "")))


def texto_del_negocio() -> ColumnElement:
    """Todo lo buscable de un negocio en una sola cadena, sin tildes y en minúsculas."""
    carta = (
        select(func.string_agg(_limpio(Producto.nombre), " "))
        .where(Producto.negocio_id == Negocio.id, Producto.disponible.is_(True))
        .correlate(Negocio)
        .scalar_subquery()
    )
    categoria = select(Categoria.nombre).where(Categoria.id == Negocio.categoria_id).correlate(Negocio).scalar_subquery()
    return func.concat_ws(
        " ", _limpio(Negocio.nombre), _limpio(Negocio.descripcion), _limpio(categoria), func.coalesce(carta, "")
    )


def puntaje(lista: list[str]) -> ColumnElement:
    """Suma del parecido de cada palabra que pasa el umbral (0 = no coincide)."""
    texto = texto_del_negocio()
    partes = []
    for palabra in lista:
        parecido = func.word_similarity(cast(literal(palabra), String), texto)
        partes.append(case((parecido >= UMBRAL, parecido), else_=0.0))
    total = partes[0]
    for p in partes[1:]:
        total = total + p
    return cast(total, Float)

