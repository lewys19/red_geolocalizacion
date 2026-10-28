"""Dependencias reutilizables para los endpoints.

- `get_db` abre una sesión de base de datos por petición y la cierra al terminar.
- `usuario_actual` exige el token de acceso (Authorization: Bearer ...).
- `requiere_permiso(...)` exige un permiso del panel administrativo (ver app.core.permisos).
"""

from collections.abc import Callable, Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import leer_token_acceso
from app.models import Usuario


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


Db = Annotated[Session, Depends(get_db)]

_bearer = HTTPBearer(auto_error=False, description="token_acceso que devuelve POST /auth/login")


def usuario_actual(
    db: Db, credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Usuario:
    usuario_id = leer_token_acceso(credenciales.credentials) if credenciales else None
    # Se busca en la base en cada petición: si se borra la cuenta, pierde el acceso al instante.
    usuario = db.get(Usuario, usuario_id) if usuario_id else None
    if usuario is None or usuario.eliminado_en is not None:
        raise HTTPException(
            status.HTTP_401_UNAUTHORIZED,
            "Inicia sesión para continuar.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return usuario


UsuarioActual = Annotated[Usuario, Depends(usuario_actual)]


def usuario_opcional(
    db: Db, credenciales: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]
) -> Usuario | None:
    """Para lo público que cambia un poco con sesión (p. ej. marcar tu reacción). Sin token = visitante."""
    if credenciales is None:
        return None
    return usuario_actual(db, credenciales)  # token vencido → 401, y la web lo refresca


UsuarioOpcional = Annotated[Usuario | None, Depends(usuario_opcional)]


def miembro_panel(usuario: UsuarioActual) -> Usuario:
    """Administrador o cualquiera con rol de panel. Los clientes no entran."""
    if not usuario.en_panel:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tu cuenta no tiene acceso al panel.")
    return usuario


MiembroPanel = Annotated[Usuario, Depends(miembro_panel)]


def requiere_permiso(permiso: str) -> Callable[[Usuario], Usuario]:
    """El administrador pasa siempre; el resto, si su rol de panel tiene el permiso."""

    def verificar(usuario: UsuarioActual) -> Usuario:
        if not usuario.puede(permiso):
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permiso para esta acción.")
        return usuario

    return verificar


VerUsuarios = Annotated[Usuario, Depends(requiere_permiso("usuarios.ver"))]
EditarUsuarios = Annotated[Usuario, Depends(requiere_permiso("usuarios.editar"))]
EliminarUsuarios = Annotated[Usuario, Depends(requiere_permiso("usuarios.eliminar"))]
VerNegocios = Annotated[Usuario, Depends(requiere_permiso("negocios.ver"))]
ModerarNegocios = Annotated[Usuario, Depends(requiere_permiso("negocios.moderar"))]
GestionarCategorias = Annotated[Usuario, Depends(requiere_permiso("categorias.gestionar"))]
GestionarRoles = Annotated[Usuario, Depends(requiere_permiso("roles.gestionar"))]
