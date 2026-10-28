"""Negocios: registro y edición por su dueño, aprobación por el equipo."""

import re
import unicodedata

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.geo import coordenadas, dentro_del_piloto, punto
from app.models import Categoria, EstadoNegocio, Horario, Negocio, Usuario
from app.schemas.negocio import HorarioOut, NegocioCambios, NegocioIn, NegocioOut, Ubicacion


def _slug_base(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-z0-9]+", "-", sin_tildes.lower()).strip("-")[:120] or "negocio"


def slug_unico(db: Session, nombre: str, distrito: str) -> str:
    """polleria-el-buen-sabor-miraflores; si ya existe, -2, -3…"""
    base = _slug_base(f"{nombre} {distrito}")
    slug, n = base, 1
    while db.scalar(select(Negocio.id).where(Negocio.slug == slug)) is not None:
        n += 1
        slug = f"{base}-{n}"
    return slug


def _validar_categoria(db: Session, categoria_id: int) -> Categoria:
    categoria = db.get(Categoria, categoria_id)
    if categoria is None:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "La categoría no existe.")
    tiene_hijas = db.scalar(select(Categoria.id).where(Categoria.padre_id == categoria_id).limit(1))
    if tiene_hijas is not None:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, f"Elige una categoría dentro de «{categoria.nombre}».")
    return categoria


def a_salida(negocio: Negocio, es_mio: bool = False) -> NegocioOut:
    lng, lat = coordenadas(negocio.ubicacion)
    return NegocioOut(
        id=negocio.id,
        slug=negocio.slug,
        nombre=negocio.nombre,
        categoria_id=negocio.categoria_id,
        categoria=negocio.categoria.nombre,
        descripcion=negocio.descripcion,
        distrito=negocio.distrito,
        direccion=negocio.direccion,
        referencia=negocio.referencia,
        ubicacion=Ubicacion(lng=lng, lat=lat) if dentro_del_piloto(lng, lat) else None,
        telefono=negocio.telefono,
        whatsapp=negocio.whatsapp,
        tiene_delivery=negocio.tiene_delivery,
        estado=negocio.estado,
        motivo_rechazo=negocio.motivo_rechazo,
        horarios=[HorarioOut(dia_semana=h.dia_semana, abre=h.abre, cierra=h.cierra) for h in negocio.horarios],
        es_mio=es_mio,
    )


def _cargar(db: Session, negocio_id: int) -> Negocio | None:
    return db.scalar(
        select(Negocio)
        .options(selectinload(Negocio.horarios), selectinload(Negocio.categoria))
        .where(Negocio.id == negocio_id, Negocio.eliminado_en.is_(None))
    )


def crear(db: Session, usuario: Usuario, datos: NegocioIn) -> NegocioOut:
    pendientes = db.scalar(
        select(func.count()).where(Negocio.usuario_id == usuario.id, Negocio.estado == EstadoNegocio.PENDIENTE)
    )
    if (pendientes or 0) >= settings.MAX_PENDIENTES_POR_USUARIO:
        raise ErrorNegocio(
            status.HTTP_429_TOO_MANY_REQUESTS, "Ya tienes varios negocios esperando aprobación. Espera a que los revisemos."
        )
    _validar_categoria(db, datos.categoria_id)
    negocio = Negocio(
        usuario_id=usuario.id,
        nombre=datos.nombre,
        slug=slug_unico(db, datos.nombre, datos.distrito),
        categoria_id=datos.categoria_id,
        descripcion=datos.descripcion,
        distrito=datos.distrito,
        direccion=datos.direccion,
        referencia=datos.referencia,
        ubicacion=punto(datos.ubicacion.lng, datos.ubicacion.lat),
        telefono=datos.telefono,
        whatsapp=datos.whatsapp,
        tiene_delivery=datos.tiene_delivery,
        estado=EstadoNegocio.PENDIENTE,
        horarios=[Horario(dia_semana=h.dia_semana, abre=h.abre, cierra=h.cierra) for h in datos.horarios],
    )
    db.add(negocio)
    db.commit()
    cargado = _cargar(db, negocio.id)
    assert cargado is not None
    return a_salida(cargado, es_mio=True)


def es_dueno(db: Session, usuario: Usuario, negocio_id: int) -> bool:
    return (
        db.scalar(
            select(Negocio.id).where(
                Negocio.id == negocio_id, Negocio.usuario_id == usuario.id, Negocio.eliminado_en.is_(None)
            )
        )
        is not None
    )


def exigir_dueno(db: Session, usuario: Usuario, negocio_id: int) -> None:
    """404 si no es su dueño: no se revela qué ids existen."""
    if not es_dueno(db, usuario, negocio_id):
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Negocio no encontrado.")


def _propio(db: Session, usuario: Usuario, negocio_id: int) -> Negocio:
    negocio = _cargar(db, negocio_id)
    if negocio is None or negocio.usuario_id != usuario.id:
        # 404 también si existe pero no es suyo: no se revela qué ids existen.
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Negocio no encontrado.")
    return negocio


def ver_propio(db: Session, usuario: Usuario, negocio_id: int) -> NegocioOut:
    return a_salida(_propio(db, usuario, negocio_id), es_mio=True)


def actualizar(db: Session, usuario: Usuario, negocio_id: int, cambios: NegocioCambios) -> NegocioOut:
    negocio = _propio(db, usuario, negocio_id)
    datos = cambios.model_dump(exclude_unset=True)
    if "categoria_id" in datos and datos["categoria_id"] is not None:
        _validar_categoria(db, datos["categoria_id"])
    for campo in ("nombre", "categoria_id", "descripcion", "distrito", "direccion", "referencia", "telefono",
                  "whatsapp", "tiene_delivery"):  # fmt: skip
        if campo in datos and (datos[campo] is not None or campo in ("descripcion", "referencia", "telefono", "whatsapp")):
            setattr(negocio, campo, datos[campo])
    if cambios.ubicacion is not None:
        negocio.ubicacion = punto(cambios.ubicacion.lng, cambios.ubicacion.lat)
    if cambios.horarios is not None:
        negocio.horarios = [Horario(dia_semana=h.dia_semana, abre=h.abre, cierra=h.cierra) for h in cambios.horarios]
    if negocio.estado == EstadoNegocio.RECHAZADO:
        # Corrigió lo que se le pidió: vuelve a la cola de revisión.
        negocio.estado = EstadoNegocio.PENDIENTE
        negocio.motivo_rechazo = None
    db.commit()
    db.expire_all()
    cargado = _cargar(db, negocio_id)
    assert cargado is not None
    return a_salida(cargado, es_mio=True)


def mios(db: Session, usuario: Usuario) -> list[NegocioOut]:
    negocios = db.scalars(
        select(Negocio)
        .options(selectinload(Negocio.horarios), selectinload(Negocio.categoria))
        .where(Negocio.usuario_id == usuario.id, Negocio.eliminado_en.is_(None))
        .order_by(Negocio.creado_en.desc())
    ).all()
    return [a_salida(n, es_mio=True) for n in negocios]


# ---------- Equipo (panel) ----------


def listar_por_estado(db: Session, estado: EstadoNegocio) -> list[NegocioOut]:
    negocios = db.scalars(
        select(Negocio)
        .options(selectinload(Negocio.horarios), selectinload(Negocio.categoria))
        .where(Negocio.estado == estado, Negocio.eliminado_en.is_(None))
        .order_by(Negocio.creado_en)  # el que espera más, primero
    ).all()
    return [a_salida(n) for n in negocios]


def decidir(db: Session, negocio_id: int, aprobar: bool, motivo: str | None = None) -> NegocioOut:
    negocio = _cargar(db, negocio_id)
    if negocio is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Negocio no encontrado.")
    negocio.estado = EstadoNegocio.APROBADO if aprobar else EstadoNegocio.RECHAZADO
    negocio.motivo_rechazo = None if aprobar else motivo
    db.commit()
    return a_salida(negocio)
