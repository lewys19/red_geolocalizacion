"""Cuentas y sesiones: registro, login, refresco (con rotación) y salida."""

from datetime import timedelta

from fastapi import status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.fechas import ahora
from app.core.security import (
    HASH_SEÑUELO,
    crear_token_acceso,
    hash_contrasena,
    huella,
    nuevo_token_refresco,
    verificar_contrasena,
)
from app.models import TokenRefresco, Usuario
from app.schemas.auth import LoginIn, RegistroIn, SesionOut, normalizar_celular
from app.schemas.usuario import UsuarioOut


def _normalizar(email: str) -> str:
    return email.strip().lower()


def abrir_sesion(db: Session, usuario: Usuario) -> SesionOut:
    acceso, expira = crear_token_acceso(usuario.id)
    valor, huella_refresco = nuevo_token_refresco()
    db.add(
        TokenRefresco(
            usuario_id=usuario.id,
            huella=huella_refresco,
            expira_en=ahora() + timedelta(days=settings.DIAS_TOKEN_REFRESCO),
        )
    )
    db.commit()
    return SesionOut(
        token_acceso=acceso,
        token_refresco=valor,
        acceso_expira_en=expira,
        usuario=UsuarioOut.model_validate(usuario),
    )


def registrar(db: Session, datos: RegistroIn) -> SesionOut:
    usuario = Usuario(
        email=_normalizar(datos.email),
        nombre=datos.nombre,
        telefono=datos.celular,
        hash_contrasena=hash_contrasena(datos.contrasena),
        acepto_terminos_en=ahora(),
    )
    db.add(usuario)
    try:
        db.flush()
    except IntegrityError as error:
        db.rollback()
        repetido = "celular" if "telefono" in str(error.orig) else "email"
        raise ErrorNegocio(status.HTTP_409_CONFLICT, f"Ya existe una cuenta con ese {repetido}.") from None
    return abrir_sesion(db, usuario)


def _buscar_cuenta(db: Session, valor: str) -> Usuario | None:
    """Por correo si tiene @; si no, por celular."""
    if "@" in valor:
        condicion = Usuario.email == _normalizar(valor)
    else:
        celular = normalizar_celular(valor)
        if celular is None:
            return None
        condicion = Usuario.telefono == celular
    return db.scalar(select(Usuario).where(condicion, Usuario.eliminado_en.is_(None)))


def ingresar(db: Session, datos: LoginIn) -> SesionOut:
    usuario = _buscar_cuenta(db, datos.usuario)
    # Siempre se verifica un hash, exista o no la cuenta: así el tiempo no delata qué cuentas existen.
    valida = verificar_contrasena(datos.contrasena, usuario.hash_contrasena if usuario else HASH_SEÑUELO)
    if usuario is None or not valida:
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "Correo, celular o contraseña incorrectos.")
    return abrir_sesion(db, usuario)


def refrescar(db: Session, valor: str) -> SesionOut:
    """Cambia un token de refresco por una sesión nueva. El usado queda revocado (rotación)."""
    token = db.scalar(select(TokenRefresco).where(TokenRefresco.huella == huella(valor)).with_for_update())
    momento = ahora()
    if token is None or token.expira_en <= momento:
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "La sesión venció. Vuelve a ingresar.")
    if token.revocado_en is not None:
        # Un token ya usado que vuelve a aparecer = posible robo: se cierran todas sus sesiones.
        _revocar_todas(db, token.usuario_id)
        db.commit()
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "La sesión venció. Vuelve a ingresar.")
    usuario = db.get(Usuario, token.usuario_id)
    if usuario is None or usuario.eliminado_en is not None:
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "La sesión venció. Vuelve a ingresar.")
    token.revocado_en = momento
    return abrir_sesion(db, usuario)


def salir(db: Session, valor: str) -> None:
    token = db.scalar(select(TokenRefresco).where(TokenRefresco.huella == huella(valor)))
    if token is not None and token.revocado_en is None:
        token.revocado_en = ahora()
        db.commit()


def _revocar_todas(db: Session, usuario_id: int) -> None:
    momento = ahora()
    for token in db.scalars(
        select(TokenRefresco).where(TokenRefresco.usuario_id == usuario_id, TokenRefresco.revocado_en.is_(None))
    ):
        token.revocado_en = momento


def eliminar_cuenta(db: Session, usuario: Usuario) -> None:
    """Borrado a pedido del titular (Ley 29733): se anonimizan sus datos y se cierran sus sesiones."""
    usuario.eliminado_en = ahora()
    usuario.email = f"eliminado-{usuario.id}@altoque.invalid"
    usuario.nombre = "Cuenta eliminada"
    usuario.telefono = None
    usuario.hash_contrasena = HASH_SEÑUELO
    _revocar_todas(db, usuario.id)
    db.commit()
