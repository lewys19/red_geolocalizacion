from fastapi import APIRouter, status

from app.api.deps import Db, UsuarioActual
from app.schemas.negocio import NegocioCambios, NegocioIn, NegocioOut
from app.services import negocios

router = APIRouter(prefix="/negocios", tags=["Negocios"])


@router.post("", response_model=NegocioOut, status_code=status.HTTP_201_CREATED)
def registrar(datos: NegocioIn, usuario: UsuarioActual, db: Db) -> NegocioOut:
    """Registra un negocio; queda pendiente hasta que un operador lo apruebe."""
    return negocios.crear(db, usuario, datos)


@router.get("/mios", response_model=list[NegocioOut])
def mis_negocios(usuario: UsuarioActual, db: Db) -> list[NegocioOut]:
    return negocios.mios(db, usuario)


@router.get("/mios/{negocio_id}", response_model=NegocioOut)
def ver_mio(negocio_id: int, usuario: UsuarioActual, db: Db) -> NegocioOut:
    return negocios.ver_propio(db, usuario, negocio_id)


@router.patch("/{negocio_id}", response_model=NegocioOut)
def editar(negocio_id: int, cambios: NegocioCambios, usuario: UsuarioActual, db: Db) -> NegocioOut:
    return negocios.actualizar(db, usuario, negocio_id, cambios)
