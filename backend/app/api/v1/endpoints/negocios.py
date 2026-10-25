from typing import Annotated

from fastapi import APIRouter, Depends, File, Response, UploadFile, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db, UsuarioActual
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.schemas.catalogo import CatalogoOut, FichaOut, FotoOut, ProductoCambios, ProductoIn, ProductoOut
from app.schemas.negocio import NegocioCambios, NegocioIn, NegocioOut
from app.services import catalogo, negocios

router = APIRouter(prefix="/negocios", tags=["Negocios"])

AlmacenFotos = Annotated[Almacen, Depends(obtener_almacen)]


@router.post("", response_model=NegocioOut, status_code=status.HTTP_201_CREATED)
def registrar(datos: NegocioIn, usuario: UsuarioActual, db: Db) -> NegocioOut:
    """Registra un negocio; queda pendiente hasta que un operador lo apruebe."""
    return negocios.crear(db, usuario, datos)


@router.get("/ficha/{slug}", response_model=FichaOut, tags=["Mapa"])
def ver_ficha(slug: str, db: Db, almacen: AlmacenFotos) -> FichaOut:
    """Página pública de un negocio aprobado: datos, horario, catálogo y fotos."""
    return catalogo.ficha(db, almacen, slug)


@router.get("/mios", response_model=list[NegocioOut])
def mis_negocios(usuario: UsuarioActual, db: Db) -> list[NegocioOut]:
    return negocios.mios(db, usuario)


@router.get("/mios/{negocio_id}", response_model=NegocioOut)
def ver_mio(negocio_id: int, usuario: UsuarioActual, db: Db) -> NegocioOut:
    return negocios.ver_propio(db, usuario, negocio_id)


@router.get("/mios/{negocio_id}/catalogo", response_model=CatalogoOut)
def ver_mi_catalogo(negocio_id: int, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> CatalogoOut:
    return catalogo.catalogo_propio(db, almacen, usuario, negocio_id)


@router.patch("/{negocio_id}", response_model=NegocioOut)
def editar(negocio_id: int, cambios: NegocioCambios, usuario: UsuarioActual, db: Db) -> NegocioOut:
    return negocios.actualizar(db, usuario, negocio_id, cambios)


# ---------- Catálogo ----------


@router.post("/{negocio_id}/productos", response_model=ProductoOut, status_code=status.HTTP_201_CREATED)
def agregar_producto(negocio_id: int, datos: ProductoIn, usuario: UsuarioActual, db: Db) -> ProductoOut:
    return catalogo.crear_producto(db, usuario, negocio_id, datos)


@router.patch("/{negocio_id}/productos/{producto_id}", response_model=ProductoOut)
def editar_producto(
    negocio_id: int, producto_id: int, cambios: ProductoCambios, usuario: UsuarioActual, db: Db
) -> ProductoOut:
    return catalogo.editar_producto(db, usuario, negocio_id, producto_id, cambios)


@router.delete("/{negocio_id}/productos/{producto_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_producto(negocio_id: int, producto_id: int, usuario: UsuarioActual, db: Db) -> Response:
    catalogo.borrar_producto(db, usuario, negocio_id, producto_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Fotos ----------


@router.post("/{negocio_id}/fotos", response_model=FotoOut, status_code=status.HTTP_201_CREATED)
async def subir_foto(
    negocio_id: int, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos, foto: Annotated[UploadFile, File()]
) -> FotoOut:
    """JPG, PNG o WebP de hasta 8 MB. Se guarda en WebP de 1600 px, sin metadatos (ni GPS)."""
    limite = settings.MAX_MB_FOTO * 1024 * 1024
    datos = await foto.read(limite + 1)  # no se lee más de lo permitido
    if len(datos) > limite:
        raise ErrorNegocio(status.HTTP_413_CONTENT_TOO_LARGE, f"La foto pesa más de {settings.MAX_MB_FOTO} MB.")
    return catalogo.subir_foto(db, almacen, usuario, negocio_id, datos)


@router.delete("/{negocio_id}/fotos/{foto_id}", status_code=status.HTTP_204_NO_CONTENT)
def borrar_foto(negocio_id: int, foto_id: int, usuario: UsuarioActual, db: Db, almacen: AlmacenFotos) -> Response:
    catalogo.borrar_foto(db, almacen, usuario, negocio_id, foto_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
