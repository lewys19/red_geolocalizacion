from fastapi import APIRouter

from app.api.deps import Db, Operador, Superadmin
from app.models import EstadoNegocio
from app.schemas.admin import ResumenOut
from app.schemas.negocio import NegocioOut, RechazoIn
from app.schemas.usuario import CambioRolIn, UsuarioOut
from app.services import negocios, usuarios

router = APIRouter(tags=["Administración"])


@router.get("/admin/resumen", response_model=ResumenOut)
def resumen(_operador: Operador, db: Db) -> ResumenOut:
    return usuarios.resumen(db)


@router.get("/admin/negocios", response_model=list[NegocioOut])
def cola(_operador: Operador, db: Db, estado: EstadoNegocio = EstadoNegocio.PENDIENTE) -> list[NegocioOut]:
    """Negocios por estado; por defecto, los que esperan aprobación (el más antiguo primero)."""
    return negocios.listar_por_estado(db, estado)


@router.post("/admin/negocios/{negocio_id}/aprobar", response_model=NegocioOut)
def aprobar(negocio_id: int, _operador: Operador, db: Db) -> NegocioOut:
    return negocios.decidir(db, negocio_id, aprobar=True)


@router.post("/admin/negocios/{negocio_id}/rechazar", response_model=NegocioOut)
def rechazar(negocio_id: int, datos: RechazoIn, _operador: Operador, db: Db) -> NegocioOut:
    """El motivo lo ve el dueño, para que corrija y vuelva a enviar."""
    return negocios.decidir(db, negocio_id, aprobar=False, motivo=datos.motivo)


@router.patch("/superadmin/usuarios/{usuario_id}/rol", response_model=UsuarioOut)
def cambiar_rol(usuario_id: int, datos: CambioRolIn, superadmin: Superadmin, db: Db) -> UsuarioOut:
    return UsuarioOut.model_validate(usuarios.cambiar_rol(db, superadmin, usuario_id, datos.rol))
