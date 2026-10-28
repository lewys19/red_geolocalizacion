"""Contenido del Inicio que maneja el equipo: banners publicitarios y sugerencias de la gente."""

import uuid

import redis
from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.almacen import Almacen
from app.core.cache import cliente_redis
from app.core.errores import ErrorNegocio
from app.models import Anuncio, Sugerencia, Usuario
from app.schemas.contenido import (
    AnuncioAdminOut,
    AnuncioIn,
    AnuncioOut,
    AutorSugerencia,
    PaginaSugerencias,
    SugerenciaOut,
)
from app.services import imagenes

ESPACIOS = (1, 2, 3)
# Sugerencias: como máximo 5 por hora desde una misma dirección (evita que llenen la tabla con basura).
MAX_SUGERENCIAS_POR_HORA = 5


# ---------- Publicidad ----------


def activos(db: Session, almacen: Almacen) -> list[AnuncioOut]:
    anuncios = db.scalars(
        select(Anuncio).where(Anuncio.activo.is_(True), Anuncio.imagen_clave.is_not(None)).order_by(Anuncio.posicion)
    ).all()
    return [
        AnuncioOut(posicion=a.posicion, titulo=a.titulo, enlace=a.enlace, imagen=almacen.url(a.imagen_clave or ""))
        for a in anuncios
    ]


def _admin_out(a: Anuncio | None, posicion: int, almacen: Almacen) -> AnuncioAdminOut:
    if a is None:
        return AnuncioAdminOut(posicion=posicion, titulo=None, enlace=None, imagen=None, activo=False)
    return AnuncioAdminOut(
        posicion=a.posicion, titulo=a.titulo, enlace=a.enlace, activo=a.activo,
        imagen=almacen.url(a.imagen_clave) if a.imagen_clave else None,
    )  # fmt: skip


def espacios(db: Session, almacen: Almacen) -> list[AnuncioAdminOut]:
    """Los 3 espacios, estén ocupados o no."""
    por_posicion = {a.posicion: a for a in db.scalars(select(Anuncio)).all()}
    return [_admin_out(por_posicion.get(p), p, almacen) for p in ESPACIOS]


def _espacio(db: Session, posicion: int) -> Anuncio:
    if posicion not in ESPACIOS:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Solo hay 3 espacios publicitarios.")
    anuncio = db.scalar(select(Anuncio).where(Anuncio.posicion == posicion))
    if anuncio is None:
        anuncio = Anuncio(posicion=posicion, activo=False)
        db.add(anuncio)
    return anuncio


def guardar(db: Session, almacen: Almacen, posicion: int, datos: AnuncioIn) -> AnuncioAdminOut:
    anuncio = _espacio(db, posicion)
    if datos.activo and not anuncio.imagen_clave:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Sube la imagen del banner antes de activarlo.")
    anuncio.titulo = datos.titulo or None
    anuncio.enlace = datos.enlace
    anuncio.activo = datos.activo
    db.commit()
    return _admin_out(anuncio, posicion, almacen)


def cambiar_imagen(db: Session, almacen: Almacen, posicion: int, datos: bytes | None) -> AnuncioAdminOut:
    """Sube (o quita, con None) la imagen. Sin imagen el banner queda desactivado."""
    anuncio = _espacio(db, posicion)
    anterior = anuncio.imagen_clave
    nueva = None
    if datos is not None:
        webp, _, _ = imagenes.procesar(datos)  # se respeta la proporción que eligió quien lo diseñó
        nueva = f"publicidad/banner-{posicion}-{uuid.uuid4().hex}.webp"
        almacen.guardar(nueva, webp, "image/webp")
    anuncio.imagen_clave = nueva
    if nueva is None:
        anuncio.activo = False
    try:
        db.commit()
    except Exception:
        if nueva:
            almacen.borrar(nueva)
        raise
    if anterior:
        almacen.borrar(anterior)
    return _admin_out(anuncio, posicion, almacen)


# ---------- Sugerencias ----------


def _dentro_del_limite(ip: str) -> bool:
    """Cuenta los envíos por hora en Redis. Si Redis no responde, se acepta: una sugerencia no es peligrosa."""
    try:
        cliente = cliente_redis()
        clave = f"sugerencias:{ip}"
        n = cliente.incr(clave)
        if n == 1:
            cliente.expire(clave, 3600)
        return int(n) <= MAX_SUGERENCIAS_POR_HORA  # type: ignore[arg-type]
    except redis.RedisError:
        return True


def enviar(db: Session, usuario: Usuario | None, texto: str, ip: str) -> None:
    if not _dentro_del_limite(ip):
        raise ErrorNegocio(status.HTTP_429_TOO_MANY_REQUESTS, "Ya enviaste varias sugerencias. Gracias; prueba más tarde.")
    db.add(Sugerencia(texto=texto, usuario_id=usuario.id if usuario else None))
    db.commit()


def listar(db: Session, pagina: int, por_pagina: int) -> PaginaSugerencias:
    """La más reciente primero."""
    total = db.scalar(select(func.count()).select_from(Sugerencia)) or 0
    filas = db.execute(
        select(Sugerencia, Usuario)
        .outerjoin(Usuario, Usuario.id == Sugerencia.usuario_id)
        .order_by(Sugerencia.creado_en.desc(), Sugerencia.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
    ).all()
    return PaginaSugerencias(
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        sugerencias=[
            SugerenciaOut(
                id=s.id, texto=s.texto, creado_en=s.creado_en,
                usuario=AutorSugerencia(id=u.id, username=u.username, nombre=u.nombre) if u else None,
            )  # fmt: skip
            for s, u in filas
        ],
    )


def borrar(db: Session, sugerencia_id: int) -> None:
    sugerencia = db.get(Sugerencia, sugerencia_id)
    if sugerencia is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Sugerencia no encontrada.")
    db.delete(sugerencia)
    db.commit()
