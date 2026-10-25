from fastapi import APIRouter

from app.api.deps import Db, Operador, Superadmin
from app.schemas.admin import ResumenOut
from app.schemas.usuario import CambioRolIn, UsuarioOut
from app.services import usuarios

router = APIRouter(tags=["Administración"])


@router.get("/admin/resumen", response_model=ResumenOut)
def resumen(_operador: Operador, db: Db) -> ResumenOut:
    return usuarios.resumen(db)


@router.patch("/superadmin/usuarios/{usuario_id}/rol", response_model=UsuarioOut)
def cambiar_rol(usuario_id: int, datos: CambioRolIn, superadmin: Superadmin, db: Db) -> UsuarioOut:
    return UsuarioOut.model_validate(usuarios.cambiar_rol(db, superadmin, usuario_id, datos.rol))
