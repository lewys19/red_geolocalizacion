"""Perfil propio: ver y cambiar sus datos, username y foto."""

import uuid

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.almacen import Almacen
from app.core import usernames
from app.core.errores import ErrorNegocio
from app.models import EstadoNegocio, Negocio, RolPlataforma, Usuario
from app.schemas.usuario import NegocioDePerfil, NegocioPropioOut, PerfilPublicoOut, YoCambios, YoOut
from app.services import imagenes


def username_libre(db: Session, texto: str) -> str:
    """Un username disponible a partir de un nombre: «Lewys Ramos» → lewys-ramos, lewys-ramos-2…"""
    base = usernames.base_desde(texto)
    tomados = set(db.scalars(select(Usuario.username).where(Usuario.username.like(f"{base}%"))))
    candidato, n = base, 1
    while candidato in tomados or usernames.problema(candidato):
        n += 1
        candidato = f"{base}-{n}"
    return candidato


def nombre_rol_panel(usuario: Usuario) -> str | None:
    """Cómo se llama su rol en el panel: «Administrador», el de su rol de panel o None (no entra)."""
    if usuario.rol == RolPlataforma.SUPERADMIN:
        return "Administrador"
    return usuario.rol_panel.nombre if usuario.rol_panel else None


def perfil(db: Session, usuario: Usuario, almacen: Almacen) -> YoOut:
    filas = db.execute(
        select(Negocio.id, Negocio.nombre)
        .where(Negocio.usuario_id == usuario.id, Negocio.eliminado_en.is_(None))
        .order_by(Negocio.nombre)
    ).all()
    negocios = [NegocioPropioOut(negocio_id=i, negocio_nombre=n) for i, n in filas]
    avatar = almacen.url(usuario.avatar_clave) if usuario.avatar_clave else None
    return YoOut(
        id=usuario.id,
        email=usuario.email,
        username=usuario.username,
        nombre=usuario.nombre,
        avatar=avatar,
        rol=usuario.rol,
        telefono=usuario.telefono,
        creado_en=usuario.creado_en,
        negocios=negocios,
        es_negocio=bool(negocios),
        en_panel=usuario.en_panel,
        es_operador=usuario.en_panel,
        es_superadmin=usuario.rol == RolPlataforma.SUPERADMIN,
        rol_panel=nombre_rol_panel(usuario),
        permisos=usuario.permisos,
    )


def aplicar_cambios(db: Session, usuario: Usuario, cambios: YoCambios) -> None:
    """Nombre, celular y username (los usa la cuenta propia y el panel). Hace commit."""
    datos = cambios.model_dump(exclude_unset=True)
    if datos.get("nombre"):
        usuario.nombre = datos["nombre"]
    if "celular" in datos:
        usuario.telefono = datos["celular"]
    if datos.get("username"):
        usuario.username = datos["username"]
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        if "username" in str(error.orig):
            raise ErrorNegocio(status.HTTP_409_CONFLICT, "Nombre de usuario no disponible.") from None
        raise ErrorNegocio(status.HTTP_409_CONFLICT, "Ya existe una cuenta con ese celular.") from None


def actualizar(db: Session, usuario: Usuario, cambios: YoCambios, almacen: Almacen) -> YoOut:
    aplicar_cambios(db, usuario, cambios)
    return perfil(db, usuario, almacen)


def cambiar_avatar(db: Session, almacen: Almacen, usuario: Usuario, datos: bytes | None) -> YoOut:
    """Reemplaza (o quita, con datos=None) la foto de perfil: cuadrada, 400 px, WebP sin EXIF."""
    anterior = usuario.avatar_clave
    nueva = None
    if datos is not None:
        webp, _, _ = imagenes.procesar(datos, (400, 400))
        nueva = f"usuarios/{usuario.id}/avatar-{uuid.uuid4().hex}.webp"
        almacen.guardar(nueva, webp, "image/webp")
    usuario.avatar_clave = nueva
    try:
        db.commit()
    except Exception:
        if nueva:
            almacen.borrar(nueva)
        raise
    if anterior:
        almacen.borrar(anterior)
    return perfil(db, usuario, almacen)


def perfil_publico(db: Session, almacen: Almacen, username: str) -> PerfilPublicoOut:
    usuario = db.scalar(
        select(Usuario).where(Usuario.username == username.lower(), Usuario.eliminado_en.is_(None))
    )
    if usuario is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Este perfil no existe.")
    negocios = db.scalars(
        select(Negocio)
        .options(selectinload(Negocio.categoria))
        .where(
            Negocio.usuario_id == usuario.id,
            Negocio.estado == EstadoNegocio.APROBADO,
            Negocio.eliminado_en.is_(None),
        )
        .order_by(Negocio.nombre)
    ).all()
    return PerfilPublicoOut(
        username=usuario.username,
        nombre=usuario.nombre,
        avatar=almacen.url(usuario.avatar_clave) if usuario.avatar_clave else None,
        creado_en=usuario.creado_en,
        negocios=[
            NegocioDePerfil(
                nombre=n.nombre, slug=n.slug, categoria=n.categoria.nombre, distrito=n.distrito,
                logo=almacen.url(n.logo_clave) if n.logo_clave else None,
            )  # fmt: skip
            for n in negocios
        ],
    )
