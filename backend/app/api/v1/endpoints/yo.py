from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db, UsuarioActual
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.schemas.usuario import YoCambios, YoOut
from app.services import auth, usuarios

router = APIRouter(prefix="/yo", tags=["Cuenta"])

AlmacenFotos = Annotated[Almacen, Depends(obtener_almacen)]


@router.get("", response_model=YoOut)
def ver_perfil(usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> YoOut:
    return usuarios.perfil(db, usuario, almacen)


@router.patch("", response_model=YoOut)
def actualizar_perfil(cambios: YoCambios, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> YoOut:
    """Nombre, celular y nombre de usuario. El correo no se cambia aquí."""
    return usuarios.actualizar(db, usuario, cambios, almacen)


@router.put("/avatar", response_model=YoOut)
async def subir_avatar(
    usuario: UsuarioActual, db: Db, almacen: AlmacenFotos, foto: Annotated[UploadFile, File()]
) -> YoOut:
    """Foto de perfil (se recorta cuadrada). Reemplaza la anterior."""
    limite = settings.MAX_MB_FOTO * 1024 * 1024
    datos = await foto.read(limite + 1)
    if len(datos) > limite:
        raise ErrorNegocio(status.HTTP_413_CONTENT_TOO_LARGE, f"La foto pesa más de {settings.MAX_MB_FOTO} MB.")
    return usuarios.cambiar_avatar(db, almacen, usuario, datos)


@router.delete("/avatar", response_model=YoOut)
def quitar_avatar(usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> YoOut:
    return usuarios.cambiar_avatar(db, almacen, usuario, None)


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_cuenta(usuario: UsuarioActual, db: Db) -> Response:
    auth.eliminar_cuenta(db, usuario)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
