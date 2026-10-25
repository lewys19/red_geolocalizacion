"""Seguridad: contraseñas (Argon2) y sesión.

La sesión usa dos tokens, igual para la web y la futura app móvil:
- acceso: JWT corto (30 min) que va en cada petición (Authorization: Bearer).
- refresco: valor aleatorio largo (30 días) que solo sirve para pedir un acceso nuevo.
  En la base se guarda su huella SHA-256, nunca el valor: si alguien copia la
  base, no puede usar esos tokens.
"""

import hashlib
import secrets
from datetime import datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.core.config import settings
from app.core.fechas import ahora

_hasher = PasswordHasher()

LARGO_MAXIMO_CONTRASENA = 128


def hash_contrasena(contrasena: str) -> str:
    return _hasher.hash(contrasena)


def verificar_contrasena(contrasena: str, hash_guardado: str) -> bool:
    try:
        return _hasher.verify(hash_guardado, contrasena)
    except (VerificationError, InvalidHashError):
        return False


# Hash de una contraseña que no existe: el login lo verifica igual cuando el email
# no está registrado, para que el tiempo de respuesta no revele qué emails existen.
HASH_SEÑUELO = _hasher.hash(secrets.token_urlsafe(16))


# ---------- Token de acceso (JWT) ----------

ALGORITMO = "HS256"
LARGO_MINIMO_SECRET_KEY = 32


def verificar_secret_key() -> None:
    """Se llama al arrancar la API: mejor fallar al inicio que en el primer login."""
    _clave()


def _clave() -> str:
    clave = settings.SECRET_KEY
    if len(clave) < LARGO_MINIMO_SECRET_KEY:
        raise RuntimeError(
            "Falta SECRET_KEY (mínimo 32 caracteres) en el .env o en el entorno. "
            'Genera una con: python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return clave


def crear_token_acceso(usuario_id: int) -> tuple[str, datetime]:
    """Devuelve (token, vencimiento)."""
    expira = ahora() + timedelta(minutes=settings.MINUTOS_TOKEN_ACCESO)
    datos = {"sub": str(usuario_id), "exp": expira, "tipo": "acceso"}
    return jwt.encode(datos, _clave(), algorithm=ALGORITMO), expira


def leer_token_acceso(token: str) -> int | None:
    """Id del usuario si el token es válido y no venció; None si no."""
    try:
        datos = jwt.decode(token, _clave(), algorithms=[ALGORITMO], options={"require": ["exp", "sub"]})
        if datos.get("tipo") != "acceso":
            return None
        return int(datos["sub"])
    except (jwt.InvalidTokenError, ValueError):
        return None


# ---------- Token de refresco (opaco) ----------


def nuevo_token_refresco() -> tuple[str, str]:
    """Devuelve (valor para el cliente, huella para la base)."""
    valor = secrets.token_urlsafe(48)
    return valor, huella(valor)


def huella(valor: str) -> str:
    return hashlib.sha256(valor.encode("utf-8")).hexdigest()
