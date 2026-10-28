"""Ingreso con Google y Microsoft (Hotmail, Outlook): OAuth 2.0 con PKCE.

1. GET  /auth/externo/{proveedor}         → se guarda un "estado" en Redis y se va al proveedor.
2. GET  /auth/externo/{proveedor}/vuelta  → el proveedor vuelve con un código; se cambia por el
   perfil (correo verificado), se busca o crea la cuenta y se vuelve a la web con un código de
   canje de un solo uso (60 s). Así los tokens de sesión nunca viajan en la URL.
3. POST /auth/externo/canje               → la web cambia ese código por la sesión normal.
"""

import base64
import hashlib
import json
import secrets
import urllib.parse
import urllib.request
from dataclasses import dataclass

import redis
from fastapi import status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.fechas import ahora
from app.core.security import HASH_SEÑUELO
from app.models import CuentaExterna, Usuario
from app.services.usuarios import username_libre

SEGUNDOS_ESTADO = 600
SEGUNDOS_CANJE = 60


@dataclass(frozen=True)
class Proveedor:
    nombre: str
    url_autorizacion: str
    url_token: str
    url_perfil: str
    client_id: str
    client_secret: str
    extra: tuple[tuple[str, str], ...] = ()

    @property
    def activo(self) -> bool:
        return bool(self.client_id and self.client_secret)

    @property
    def url_vuelta(self) -> str:
        return f"{settings.URL_PUBLICA.rstrip('/')}/api/v1/auth/externo/{self.nombre}/vuelta"


def proveedores() -> dict[str, Proveedor]:
    return {
        "google": Proveedor(
            "google",
            "https://accounts.google.com/o/oauth2/v2/auth",
            "https://oauth2.googleapis.com/token",
            "https://openidconnect.googleapis.com/v1/userinfo",
            settings.GOOGLE_CLIENT_ID,
            settings.GOOGLE_CLIENT_SECRET,
            (("prompt", "select_account"),),
        ),
        # "consumers": solo cuentas personales (Hotmail, Outlook, Live), cuyo correo verifica Microsoft.
        # Las cuentas de empresas quedan fuera: ahí cualquiera puede poner un correo ajeno.
        "microsoft": Proveedor(
            "microsoft",
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize",
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            "https://graph.microsoft.com/oidc/userinfo",
            settings.MICROSOFT_CLIENT_ID,
            settings.MICROSOFT_CLIENT_SECRET,
            (("prompt", "select_account"),),
        ),
    }


def activos() -> list[str]:
    return [nombre for nombre, p in proveedores().items() if p.activo]


def _proveedor(nombre: str) -> Proveedor:
    proveedor = proveedores().get(nombre)
    if proveedor is None or not proveedor.activo:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Ese medio de ingreso no está disponible.")
    return proveedor


def _volver_seguro(volver: str | None) -> str:
    """Solo rutas de la propia web: evita que el ingreso termine en un sitio ajeno."""
    if volver and volver.startswith("/") and not volver.startswith("//") and "\\" not in volver:
        return volver
    return "/"


def iniciar(cliente: redis.Redis, nombre: str, volver: str | None) -> str:
    """Devuelve la URL del proveedor a la que se envía a la persona."""
    proveedor = _proveedor(nombre)
    estado = secrets.token_urlsafe(32)
    verificador = secrets.token_urlsafe(64)
    reto = base64.urlsafe_b64encode(hashlib.sha256(verificador.encode()).digest()).rstrip(b"=").decode()
    datos = {"proveedor": nombre, "verificador": verificador, "volver": _volver_seguro(volver)}
    cliente.set(f"externo:estado:{estado}", json.dumps(datos), ex=SEGUNDOS_ESTADO)
    params = {
        "client_id": proveedor.client_id,
        "redirect_uri": proveedor.url_vuelta,
        "response_type": "code",
        "scope": "openid email profile",
        "state": estado,
        "code_challenge": reto,
        "code_challenge_method": "S256",
        **dict(proveedor.extra),
    }
    return f"{proveedor.url_autorizacion}?{urllib.parse.urlencode(params)}"


@dataclass(frozen=True)
class Perfil:
    sujeto: str
    email: str
    nombre: str


def pedir_perfil(proveedor: Proveedor, codigo: str, verificador: str) -> Perfil:
    """Cambia el código por un token y lee el perfil. Separado para reemplazarlo en las pruebas."""
    cuerpo = urllib.parse.urlencode(
        {
            "grant_type": "authorization_code",
            "code": codigo,
            "redirect_uri": proveedor.url_vuelta,
            "client_id": proveedor.client_id,
            "client_secret": proveedor.client_secret,
            "code_verifier": verificador,
        }
    ).encode()
    with urllib.request.urlopen(urllib.request.Request(proveedor.url_token, data=cuerpo), timeout=10) as r:  # noqa: S310
        token = json.load(r)["access_token"]
    pedido = urllib.request.Request(proveedor.url_perfil, headers={"Authorization": f"Bearer {token}"})
    with urllib.request.urlopen(pedido, timeout=10) as r:  # noqa: S310 (URLs fijas)
        datos = json.load(r)
    # Google dice si verificó el correo; las cuentas personales de Microsoft siempre lo están.
    if not datos.get("email") or datos.get("email_verified") is False:
        raise ValueError("El proveedor no dio un correo verificado.")
    nombre = (datos.get("name") or datos["email"].split("@")[0]).strip()[:80]
    return Perfil(sujeto=str(datos["sub"]), email=datos["email"].strip().lower(), nombre=nombre)


def cuenta_para(db: Session, proveedor: str, perfil: Perfil) -> Usuario:
    """La cuenta ya enlazada; si no, la del mismo correo (y se enlaza); si no, una nueva."""
    enlace = db.scalar(
        select(CuentaExterna).where(CuentaExterna.proveedor == proveedor, CuentaExterna.sujeto == perfil.sujeto)
    )
    if enlace is not None:
        usuario = db.get(Usuario, enlace.usuario_id)
    else:
        usuario = db.scalar(select(Usuario).where(Usuario.email == perfil.email))
        if usuario is None:
            # Ley 29733: la ventana avisa que continuar con Google/Microsoft acepta los términos.
            usuario = Usuario(
                email=perfil.email,
                username=username_libre(db, perfil.nombre),
                nombre=perfil.nombre,
                hash_contrasena=HASH_SEÑUELO,
                acepto_terminos_en=ahora(),
            )
            db.add(usuario)
            db.flush()
        db.add(CuentaExterna(usuario_id=usuario.id, proveedor=proveedor, sujeto=perfil.sujeto))
    if usuario is None or usuario.eliminado_en is not None:
        raise ErrorNegocio(status.HTTP_403_FORBIDDEN, "Esta cuenta fue eliminada.")
    db.commit()
    return usuario


def volver(db: Session, cliente: redis.Redis, nombre: str, codigo: str | None, estado: str | None) -> str:
    """Procesa la vuelta del proveedor y devuelve a dónde redirigir en la web."""
    guardado = cliente.getdel(f"externo:estado:{estado}") if estado else None
    datos = json.loads(guardado) if guardado else None
    destino = datos["volver"] if datos else "/"
    separador = "&" if "?" in destino else "?"
    if not datos or datos["proveedor"] != nombre or not codigo:
        return f"{destino}{separador}ingreso_error=cancelado"
    try:
        perfil = pedir_perfil(_proveedor(nombre), codigo, datos["verificador"])
        usuario = cuenta_para(db, nombre, perfil)
    except ErrorNegocio:
        return f"{destino}{separador}ingreso_error=eliminada"
    except Exception:  # noqa: BLE001 (red caída, código vencido, respuesta rara: se pide reintentar)
        return f"{destino}{separador}ingreso_error=fallo"
    canje = secrets.token_urlsafe(32)
    cliente.set(f"externo:canje:{canje}", str(usuario.id), ex=SEGUNDOS_CANJE)
    return f"{destino}{separador}ingreso={canje}"


def canjear(cliente: redis.Redis, codigo: str) -> int:
    """Id del usuario del código (de un solo uso)."""
    usuario_id = cliente.getdel(f"externo:canje:{codigo}")
    if usuario_id is None:
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "El ingreso venció. Inténtalo de nuevo.")
    return int(usuario_id)
