"""Perfil y comunidad: foto de perfil y portada, seguidores, reacciones y comentarios."""

import uuid
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Literal

from fastapi import status
from sqlalchemy import delete, func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session, selectinload

from app.almacen import Almacen
from app.core.errores import ErrorNegocio
from app.models import (
    TIPOS_REACCION,
    Comentario,
    EstadoNegocio,
    Negocio,
    Publicacion,
    Reaccion,
    RolPlataforma,
    Seguidor,
    Usuario,
)
from app.schemas.social import (
    AutorOut,
    ComentarioOut,
    ComentariosOut,
    ImagenOut,
    ReaccionesOut,
    RelacionOut,
    SeguirOut,
)
from app.services import imagenes
from app.services.negocios import _rol_en, exigir_miembro

TipoImagen = Literal["logo", "portada"]
# Foto de perfil cuadrada; portada 3:1 (como la de X/Twitter).
MEDIDAS: dict[TipoImagen, tuple[int, int]] = {"logo": (400, 400), "portada": (1500, 500)}


# ---------- Foto de perfil y portada ----------


def cambiar_imagen(
    db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int, tipo: TipoImagen, datos: bytes | None
) -> ImagenOut:
    """Reemplaza (o quita, con datos=None) la foto de perfil o la portada."""
    exigir_miembro(db, usuario, negocio_id)
    negocio = db.get(Negocio, negocio_id)
    assert negocio is not None
    campo = f"{tipo}_clave"
    anterior: str | None = getattr(negocio, campo)
    nueva: str | None = None
    if datos is not None:
        webp, _, _ = imagenes.procesar(datos, MEDIDAS[tipo])
        nueva = f"negocios/{negocio_id}/{tipo}-{uuid.uuid4().hex}.webp"
        almacen.guardar(nueva, webp, "image/webp")
    setattr(negocio, campo, nueva)
    try:
        db.commit()
    except Exception:
        if nueva:
            almacen.borrar(nueva)
        raise
    if anterior:
        almacen.borrar(anterior)
    return ImagenOut(url=almacen.url(nueva) if nueva else None)


# ---------- Seguidores ----------


def _negocio_visible(db: Session, negocio_id: int) -> None:
    existe = db.scalar(
        select(Negocio.id).where(
            Negocio.id == negocio_id, Negocio.estado == EstadoNegocio.APROBADO, Negocio.eliminado_en.is_(None)
        )
    )
    if existe is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Negocio no encontrado.")


def contar_seguidores(db: Session, negocio_id: int) -> int:
    return db.scalar(select(func.count()).select_from(Seguidor).where(Seguidor.negocio_id == negocio_id)) or 0


def _lo_sigue(db: Session, usuario: Usuario, negocio_id: int) -> bool:
    return db.get(Seguidor, (usuario.id, negocio_id)) is not None


def seguir(db: Session, usuario: Usuario, negocio_id: int, sigue: bool) -> SeguirOut:
    _negocio_visible(db, negocio_id)
    if sigue:
        # Seguir dos veces no es un error (doble clic, dos pestañas).
        db.execute(insert(Seguidor).values(usuario_id=usuario.id, negocio_id=negocio_id).on_conflict_do_nothing())
    else:
        db.execute(delete(Seguidor).where(Seguidor.usuario_id == usuario.id, Seguidor.negocio_id == negocio_id))
    db.commit()
    return SeguirOut(seguidores=contar_seguidores(db, negocio_id), lo_sigo=sigue)


def relacion(db: Session, usuario: Usuario, negocio_id: int) -> RelacionOut:
    return RelacionOut(lo_sigo=_lo_sigue(db, usuario, negocio_id), es_miembro=_rol_en(db, usuario, negocio_id) is not None)


# ---------- Reacciones ----------


@dataclass
class Resumen:
    reacciones: dict[str, int] = field(default_factory=lambda: dict.fromkeys(TIPOS_REACCION, 0))
    comentarios: int = 0
    mi_reaccion: str | None = None

    @property
    def total(self) -> int:
        return sum(self.reacciones.values())


def resumenes(db: Session, ids: list[int], usuario: Usuario | None) -> dict[int, Resumen]:
    """Conteos de reacciones y comentarios de varias publicaciones con 2-3 consultas (no una por cada una)."""
    salida: dict[int, Resumen] = defaultdict(Resumen)
    if not ids:
        return salida
    for pid, tipo, n in db.execute(
        select(Reaccion.publicacion_id, Reaccion.tipo, func.count())
        .where(Reaccion.publicacion_id.in_(ids))
        .group_by(Reaccion.publicacion_id, Reaccion.tipo)
    ):
        salida[pid].reacciones[tipo] = n
    for pid, n in db.execute(
        select(Comentario.publicacion_id, func.count())
        .where(Comentario.publicacion_id.in_(ids))
        .group_by(Comentario.publicacion_id)
    ):
        salida[pid].comentarios = n
    if usuario is not None:
        for pid, tipo in db.execute(
            select(Reaccion.publicacion_id, Reaccion.tipo).where(
                Reaccion.publicacion_id.in_(ids), Reaccion.usuario_id == usuario.id
            )
        ):
            salida[pid].mi_reaccion = tipo
    return salida


def _publicacion_visible(db: Session, publicacion_id: int) -> Publicacion:
    publicacion = db.scalar(
        select(Publicacion)
        .join(Negocio, Negocio.id == Publicacion.negocio_id)
        .where(
            Publicacion.id == publicacion_id,
            Negocio.estado == EstadoNegocio.APROBADO,
            Negocio.eliminado_en.is_(None),
        )
    )
    if publicacion is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Publicación no encontrada.")
    return publicacion


def reaccionar(db: Session, usuario: Usuario, publicacion_id: int, tipo: str | None) -> ReaccionesOut:
    """Pone o cambia la reacción (una por persona); tipo=None la quita."""
    _publicacion_visible(db, publicacion_id)
    if tipo is None:
        db.execute(
            delete(Reaccion).where(Reaccion.publicacion_id == publicacion_id, Reaccion.usuario_id == usuario.id)
        )
    else:
        db.execute(
            insert(Reaccion)
            .values(publicacion_id=publicacion_id, usuario_id=usuario.id, tipo=tipo)
            .on_conflict_do_update(index_elements=["publicacion_id", "usuario_id"], set_={"tipo": tipo})
        )
    db.commit()
    r = resumenes(db, [publicacion_id], usuario)[publicacion_id]
    return ReaccionesOut(reacciones=r.reacciones, total=r.total, mi_reaccion=r.mi_reaccion)  # type: ignore[arg-type]


def total_reacciones_del_negocio(db: Session, negocio_id: int) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(Reaccion)
            .join(Publicacion, Publicacion.id == Reaccion.publicacion_id)
            .where(Publicacion.negocio_id == negocio_id)
        )
        or 0
    )


# ---------- Comentarios ----------


def _comentario_out(c: Comentario) -> ComentarioOut:
    return ComentarioOut(id=c.id, texto=c.texto, creado_en=c.creado_en, autor=AutorOut(id=c.autor.id, nombre=c.autor.nombre))


def comentarios(db: Session, publicacion_id: int, despues_de: int | None = None, limite: int = 20) -> ComentariosOut:
    _publicacion_visible(db, publicacion_id)
    consulta = (
        select(Comentario).options(selectinload(Comentario.autor)).where(Comentario.publicacion_id == publicacion_id)
    )
    if despues_de:
        consulta = consulta.where(Comentario.id > despues_de)
    filas = db.scalars(consulta.order_by(Comentario.id).limit(limite + 1)).all()
    hay_mas = len(filas) > limite
    filas = filas[:limite]
    total = db.scalar(select(func.count()).select_from(Comentario).where(Comentario.publicacion_id == publicacion_id))
    return ComentariosOut(
        comentarios=[_comentario_out(c) for c in filas],
        siguiente=filas[-1].id if hay_mas else None,
        total=total or 0,
    )


def comentar(db: Session, usuario: Usuario, publicacion_id: int, texto: str) -> ComentarioOut:
    _publicacion_visible(db, publicacion_id)
    comentario = Comentario(publicacion_id=publicacion_id, usuario_id=usuario.id, texto=texto)
    db.add(comentario)
    db.commit()
    db.refresh(comentario, ["autor"])
    return _comentario_out(comentario)


def borrar_comentario(db: Session, usuario: Usuario, publicacion_id: int, comentario_id: int) -> None:
    """Lo borra quien lo escribió, el negocio dueño de la publicación (moderar su muro) o un operador."""
    comentario = db.get(Comentario, comentario_id)
    if comentario is None or comentario.publicacion_id != publicacion_id:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Comentario no encontrado.")
    publicacion = db.get(Publicacion, publicacion_id)
    assert publicacion is not None
    puede = (
        comentario.usuario_id == usuario.id
        or usuario.rol in (RolPlataforma.OPERADOR, RolPlataforma.SUPERADMIN)
        or _rol_en(db, usuario, publicacion.negocio_id) is not None
    )
    if not puede:
        raise ErrorNegocio(status.HTTP_403_FORBIDDEN, "Solo puedes borrar tus comentarios.")
    db.delete(comentario)
    db.commit()
