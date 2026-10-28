from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db, UsuarioActual, UsuarioOpcional
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.schemas.publicacion import MuroOut, NegocioMini, PublicacionCambios, PublicacionOut
from app.schemas.social import CompartidoOut
from app.services import publicaciones

router = APIRouter(tags=["Inicio"])

AlmacenFotos = Annotated[Almacen, Depends(obtener_almacen)]
Grados = Annotated[float, Query(ge=-180, le=180)]
Radio = Annotated[int, Query(ge=100, le=settings.MAX_RADIO_M)]


def _desde(lng: float | None, lat: float | None) -> tuple[float, float] | None:
    return (lng, lat) if lng is not None and lat is not None else None


@router.post(
    "/negocios/{negocio_id}/publicaciones", response_model=PublicacionOut, status_code=status.HTTP_201_CREATED
)
async def publicar(
    negocio_id: int,
    usuario: UsuarioActual,
    db: Db,
    almacen: AlmacenFotos,
    texto: Annotated[str, Form(max_length=2000)] = "",
    fotos: Annotated[list[UploadFile] | None, File()] = None,
) -> PublicacionOut:
    """Publica en el muro: texto y hasta 4 fotos (WebP de 1600 px, sin GPS). Solo negocios aprobados."""
    limite = settings.MAX_MB_FOTO * 1024 * 1024
    contenidos: list[bytes] = []
    for foto in fotos or []:
        datos = await foto.read(limite + 1)
        if len(datos) > limite:
            raise ErrorNegocio(status.HTTP_413_CONTENT_TOO_LARGE, f"Una foto pesa más de {settings.MAX_MB_FOTO} MB.")
        contenidos.append(datos)
    return publicaciones.crear(db, almacen, usuario, negocio_id, texto, contenidos)


@router.patch("/negocios/{negocio_id}/publicaciones/{publicacion_id}", response_model=PublicacionOut)
def editar(
    negocio_id: int, publicacion_id: int, cambios: PublicacionCambios, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos
) -> PublicacionOut:
    """El dueño cambia el texto de su publicación; queda marcada como editada."""
    return publicaciones.editar(db, almacen, usuario, negocio_id, publicacion_id, cambios.texto)


@router.post("/publicaciones/{publicacion_id}/compartido", response_model=CompartidoOut)
def compartido(publicacion_id: int, db: Db) -> CompartidoOut:
    """La web lo llama al tocar «Compartir». Sin sesión: también comparte quien no tiene cuenta."""
    return CompartidoOut(compartidos=publicaciones.contar_compartido(db, publicacion_id))


@router.delete("/negocios/{negocio_id}/publicaciones/{publicacion_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar(negocio_id: int, publicacion_id: int, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> Response:
    publicaciones.borrar(db, almacen, usuario, negocio_id, publicacion_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/muro", response_model=MuroOut)
def muro(
    db: Db,
    almacen: AlmacenFotos,
    usuario: UsuarioOpcional,
    lng: Grados | None = None,
    lat: Grados | None = None,
    radio_m: Radio = 50_000,
    antes_de: Annotated[int | None, Query(ge=1)] = None,
    limite: Annotated[int, Query(ge=1, le=50)] = 20,
) -> MuroOut:
    """Publicaciones de los negocios, lo más nuevo primero. Sin ubicación: de todos (general).
    Con lng/lat: solo de negocios dentro del radio. Página siguiente: ?antes_de=<siguiente>."""
    return publicaciones.muro(db, almacen, _desde(lng, lat), radio_m, antes_de, limite, usuario=usuario)


@router.get("/negocios/ficha/{slug}/publicaciones", response_model=MuroOut)
def muro_del_negocio(
    slug: str,
    db: Db,
    almacen: AlmacenFotos,
    usuario: UsuarioOpcional,
    antes_de: Annotated[int | None, Query(ge=1)] = None,
) -> MuroOut:
    """El muro de un negocio: sus publicaciones, en su página de perfil."""
    return publicaciones.muro(db, almacen, antes_de=antes_de, negocio_slug=slug, usuario=usuario)


@router.get("/negocios/lista", response_model=list[NegocioMini])
def lista(
    db: Db,
    almacen: AlmacenFotos,
    categoria: Annotated[str | None, Query(max_length=70)] = None,
    lng: Grados | None = None,
    lat: Grados | None = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 30,
) -> list[NegocioMini]:
    """Negocios para círculos y tarjetas. Con lng/lat, los más cercanos; sin ellos, los más nuevos."""
    return publicaciones.lista(db, almacen, categoria, _desde(lng, lat), limite)


@router.get("/categorias/conteo", response_model=dict[str, int], tags=["Mapa"])
def conteo(db: Db) -> dict[str, int]:
    """Cuántos negocios hay en cada categoría (la categoría padre suma sus hijas)."""
    return publicaciones.conteo_por_categoria(db)
