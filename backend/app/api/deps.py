"""Dependencias reutilizables para los endpoints.

- `get_db` abre una sesión de base de datos por petición y la cierra al terminar.
- `usuario_actual` exige el token de acceso (Authorization: Bearer ...).
- `requiere_rol(...)` exige además un rol de plataforma (operador, superadmin).
"""

from collections.abc import Callable, Generator
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.core.security import leer_token_acceso
from app.models import RolPlataforma, Usuario


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


def requiere_rol(*roles: RolPlataforma) -> Callable[[Usuario], Usuario]:
    """El superadmin pasa siempre; el resto, solo si su rol está en la lista."""

    def verificar(usuario: UsuarioActual) -> Usuario:
        if usuario.rol != RolPlataforma.SUPERADMIN and usuario.rol not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "No tienes permiso para esta acción.")
        return usuario

    return verificar


Operador = Annotated[Usuario, Depends(requiere_rol(RolPlataforma.OPERADOR))]
Superadmin = Annotated[Usuario, Depends(requiere_rol())]
