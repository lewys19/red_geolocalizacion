from fastapi import APIRouter, Response, status
from fastapi.responses import RedirectResponse

from app.api.deps import Db
from app.core.cache import cliente_redis
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.models import Usuario
from app.schemas.auth import CanjeIn, LoginIn, ProveedoresOut, RefrescoIn, RegistroIn, SesionOut
from app.services import auth, externo

router = APIRouter(prefix="/auth", tags=["Cuenta"])


@router.post("/registro", response_model=SesionOut, status_code=status.HTTP_201_CREATED)
def registro(datos: RegistroIn, db: Db) -> SesionOut:
    return auth.registrar(db, datos)


@router.post("/login", response_model=SesionOut)
def login(datos: LoginIn, db: Db) -> SesionOut:
    """Con correo o celular (campo `usuario`) y contraseña."""
    return auth.ingresar(db, datos)


@router.post("/refresco", response_model=SesionOut)
def refresco(datos: RefrescoIn, db: Db) -> SesionOut:
    return auth.refrescar(db, datos.token_refresco)


@router.post("/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir(datos: RefrescoIn, db: Db) -> Response:
    auth.salir(db, datos.token_refresco)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/externo", response_model=ProveedoresOut)
def proveedores_externos() -> ProveedoresOut:
    """Medios de ingreso configurados en este servidor (google, microsoft)."""
    return ProveedoresOut(proveedores=externo.activos())


@router.get("/externo/{proveedor}", status_code=status.HTTP_302_FOUND)
def ingresar_con(proveedor: str, volver: str | None = None) -> RedirectResponse:
    """Lleva a la pantalla de Google o Microsoft. `volver`: ruta de la web a la que regresar."""
    return RedirectResponse(externo.iniciar(cliente_redis(), proveedor, volver), status.HTTP_302_FOUND)


@router.get("/externo/{proveedor}/vuelta", status_code=status.HTTP_302_FOUND, include_in_schema=False)
def vuelta(proveedor: str, db: Db, code: str | None = None, state: str | None = None) -> RedirectResponse:
    destino = externo.volver(db, cliente_redis(), proveedor, code, state)
    return RedirectResponse(f"{settings.URL_PUBLICA.rstrip('/')}{destino}", status.HTTP_302_FOUND)


@router.post("/externo/canje", response_model=SesionOut)
def canje(datos: CanjeIn, db: Db) -> SesionOut:
    """Cambia el código de un solo uso (que trae la web tras Google/Microsoft) por la sesión."""
    usuario = db.get(Usuario, externo.canjear(cliente_redis(), datos.codigo))
    if usuario is None or usuario.eliminado_en is not None:
        raise ErrorNegocio(status.HTTP_401_UNAUTHORIZED, "El ingreso venció. Inténtalo de nuevo.")
    return auth.abrir_sesion(db, usuario)
