from fastapi import APIRouter, Response, status

from app.api.deps import Db, UsuarioActual
from app.schemas.usuario import YoOut
from app.services import auth, usuarios

router = APIRouter(prefix="/yo", tags=["Cuenta"])


@router.get("", response_model=YoOut)
def ver_perfil(usuario: UsuarioActual, db: Db) -> YoOut:
    return usuarios.perfil(db, usuario)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta(usuario: UsuarioActual, db: Db) -> Response:
    auth.eliminar_cuenta(db, usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
