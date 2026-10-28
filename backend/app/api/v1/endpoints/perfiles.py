from typing import Annotated

from fastapi import APIRouter, Depends

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db
from app.schemas.usuario import PerfilPublicoOut
from app.services import usuarios

router = APIRouter(prefix="/perfiles", tags=["Perfiles"])


@router.get("/{username}", response_model=PerfilPublicoOut)
def ver_perfil_publico(username: str, db: Db, almacen: Annotated[Almacen, Depends(obtener_almacen)]) -> PerfilPublicoOut:
    """Perfil público (altoque.pe/{username}): nombre, foto y negocios aprobados."""
    return usuarios.perfil_publico(db, almacen, username)
