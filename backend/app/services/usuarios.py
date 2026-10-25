"""Perfil propio y administración de usuarios."""

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errores import ErrorNegocio
from app.models import EstadoNegocio, MiembroNegocio, Negocio, RolPlataforma, Usuario
from app.schemas.admin import ResumenOut
from app.schemas.usuario import MembresiaOut, YoOut


def perfil(db: Session, usuario: Usuario) -> YoOut:
    filas = db.execute(
        select(MiembroNegocio.negocio_id, Negocio.nombre, MiembroNegocio.rol)
        .join(Negocio, Negocio.id == MiembroNegocio.negocio_id)
        .where(MiembroNegocio.usuario_id == usuario.id, Negocio.eliminado_en.is_(None))
        .order_by(Negocio.nombre)
    ).all()
    negocios = [MembresiaOut(negocio_id=i, negocio_nombre=n, rol=r) for i, n, r in filas]
    return YoOut(
        id=usuario.id,
        email=usuario.email,
        nombre=usuario.nombre,
        rol=usuario.rol,
        negocios=negocios,
        es_negocio=bool(negocios),
        es_operador=usuario.rol in (RolPlataforma.OPERADOR, RolPlataforma.SUPERADMIN),
        es_superadmin=usuario.rol == RolPlataforma.SUPERADMIN,
    )


def resumen(db: Session) -> ResumenOut:
    usuarios = db.scalar(select(func.count()).select_from(Usuario).where(Usuario.eliminado_en.is_(None))) or 0
    conteos = dict(
        db.execute(
            select(Negocio.estado, func.count()).where(Negocio.eliminado_en.is_(None)).group_by(Negocio.estado)
        ).all()
    )
    return ResumenOut(
        usuarios=usuarios,
        negocios_por_estado={estado.value: conteos.get(estado, 0) for estado in EstadoNegocio},
    )


def cambiar_rol(db: Session, quien: Usuario, usuario_id: int, rol: RolPlataforma) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.eliminado_en is not None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Usuario no encontrado.")
    if usuario.id == quien.id and rol != RolPlataforma.SUPERADMIN:
        # Evita quedarse sin ningún superadmin por error.
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "No puedes quitarte tu propio rol de superadmin.")
    usuario.rol = rol
    db.commit()
    return usuario
