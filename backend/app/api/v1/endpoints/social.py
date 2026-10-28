from typing import Annotated

from fastapi import APIRouter, Depends, File, Query, Response, UploadFile, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db, UsuarioActual
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.schemas.social import (
    ComentarioIn,
    ComentarioOut,
    ComentariosOut,
    ImagenOut,
    MeGustaOut,
    ReaccionesOut,
    ReaccionIn,
    RelacionOut,
    SeguirOut,
)
from app.services import social
from app.services.social import TipoImagen

router = APIRouter(tags=["Comunidad"])

AlmacenFotos = Annotated[Almacen, Depends(obtener_almacen)]


# ---------- Foto de perfil y portada ----------


@router.put("/negocios/{negocio_id}/imagen/{tipo}", response_model=ImagenOut, tags=["Negocios"])
async def subir_imagen(
    negocio_id: int,
    tipo: TipoImagen,
    usuario: UsuarioActual,
    db: Db,
    almacen: AlmacenFotos,
    foto: Annotated[UploadFile, File()],
) -> ImagenOut:
    """`logo` (foto de perfil, se recorta cuadrada) o `portada` (se recorta 3:1). Reemplaza la anterior."""
    limite = settings.MAX_MB_FOTO * 1024 * 1024
    datos = await foto.read(limite + 1)
    if len(datos) > limite:
        raise ErrorNegocio(status.HTTP_413_CONTENT_TOO_LARGE, f"La foto pesa más de {settings.MAX_MB_FOTO} MB.")
    return social.cambiar_imagen(db, almacen, usuario, negocio_id, tipo, datos)


@router.delete("/negocios/{negocio_id}/imagen/{tipo}", response_model=ImagenOut, tags=["Negocios"])
def quitar_imagen(negocio_id: int, tipo: TipoImagen, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> ImagenOut:
    return social.cambiar_imagen(db, almacen, usuario, negocio_id, tipo, None)


# ---------- Seguidores ----------


@router.put("/negocios/{negocio_id}/seguir", response_model=SeguirOut)
def seguir(negocio_id: int, usuario: UsuarioActual, db: Db) -> SeguirOut:
    return social.seguir(db, usuario, negocio_id, True)


@router.delete("/negocios/{negocio_id}/seguir", response_model=SeguirOut)
def dejar_de_seguir(negocio_id: int, usuario: UsuarioActual, db: Db) -> SeguirOut:
    return social.seguir(db, usuario, negocio_id, False)


@router.put("/negocios/{negocio_id}/me-gusta", response_model=MeGustaOut)
def dar_me_gusta(negocio_id: int, usuario: UsuarioActual, db: Db) -> MeGustaOut:
    """«Me gusta» a la página del negocio (distinto de seguirlo)."""
    return social.me_gusta(db, usuario, negocio_id, True)


@router.delete("/negocios/{negocio_id}/me-gusta", response_model=MeGustaOut)
def quitar_me_gusta(negocio_id: int, usuario: UsuarioActual, db: Db) -> MeGustaOut:
    return social.me_gusta(db, usuario, negocio_id, False)


@router.get("/negocios/{negocio_id}/relacion", response_model=RelacionOut)
def relacion(negocio_id: int, usuario: UsuarioActual, db: Db) -> RelacionOut:
    """Si lo sigues, si te gusta y si es tuyo (para mostrar «Seguir»/«Me gusta» o los botones de editar)."""
    return social.relacion(db, usuario, negocio_id)


# ---------- Reacciones y comentarios ----------


@router.put("/publicaciones/{publicacion_id}/reaccion", response_model=ReaccionesOut)
def reaccionar(publicacion_id: int, datos: ReaccionIn, usuario: UsuarioActual, db: Db) -> ReaccionesOut:
    """me_gusta, me_encanta o wow. Una por persona: cambiarla reemplaza la anterior."""
    return social.reaccionar(db, usuario, publicacion_id, datos.tipo)


@router.delete("/publicaciones/{publicacion_id}/reaccion", response_model=ReaccionesOut)
def quitar_reaccion(publicacion_id: int, usuario: UsuarioActual, db: Db) -> ReaccionesOut:
    return social.reaccionar(db, usuario, publicacion_id, None)


@router.get("/publicaciones/{publicacion_id}/comentarios", response_model=ComentariosOut)
def ver_comentarios(
    publicacion_id: int, db: Db, despues_de: Annotated[int | None, Query(ge=1)] = None
) -> ComentariosOut:
    """Los más antiguos primero. Siguiente página: ?despues_de=<siguiente>."""
    return social.comentarios(db, publicacion_id, despues_de)


@router.post(
    "/publicaciones/{publicacion_id}/comentarios", response_model=ComentarioOut, status_code=status.HTTP_201_CREATED
)
def comentar(publicacion_id: int, datos: ComentarioIn, usuario: UsuarioActual, db: Db) -> ComentarioOut:
    return social.comentar(db, usuario, publicacion_id, datos.texto)


@router.delete("/publicaciones/{publicacion_id}/comentarios/{comentario_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_comentario(publicacion_id: int, comentario_id: int, usuario: UsuarioActual, db: Db) -> Response:
    social.borrar_comentario(db, usuario, publicacion_id, comentario_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
