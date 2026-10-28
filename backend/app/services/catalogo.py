"""Catálogo, fotos y ficha pública de los negocios."""

import uuid

from fastapi import status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.almacen import Almacen
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.fechas import ahora
from app.core.geo import coordenadas
from app.models import Categoria, EstadoNegocio, Foto, Negocio, Producto, Publicacion, Usuario
from app.schemas.catalogo import CatalogoOut, FichaOut, FotoOut, ProductoCambios, ProductoIn, ProductoOut
from app.schemas.negocio import HorarioOut
from app.services import imagenes, social
from app.services.horarios import estado_atencion
from app.services.negocios import exigir_dueno


def producto_out(p: Producto) -> ProductoOut:
    return ProductoOut(
        id=p.id,
        nombre=p.nombre,
        descripcion=p.descripcion,
        precio_centimos=p.precio_centimos,
        disponible=p.disponible,
        orden=p.orden,
    )


def foto_out(f: Foto, almacen: Almacen) -> FotoOut:
    return FotoOut(id=f.id, url=almacen.url(f.clave), ancho=f.ancho, alto=f.alto)


# ---------- Productos ----------


def crear_producto(db: Session, usuario: Usuario, negocio_id: int, datos: ProductoIn) -> ProductoOut:
    exigir_dueno(db, usuario, negocio_id)
    cantidad = db.scalar(select(func.count()).select_from(Producto).where(Producto.negocio_id == negocio_id)) or 0
    if cantidad >= settings.MAX_PRODUCTOS_POR_NEGOCIO:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, f"Máximo {settings.MAX_PRODUCTOS_POR_NEGOCIO} productos.")
    producto = Producto(negocio_id=negocio_id, **datos.model_dump())
    db.add(producto)
    db.commit()
    return producto_out(producto)


def _producto_de(db: Session, negocio_id: int, producto_id: int) -> Producto:
    producto = db.get(Producto, producto_id)
    if producto is None or producto.negocio_id != negocio_id:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Producto no encontrado.")
    return producto


def editar_producto(
    db: Session, usuario: Usuario, negocio_id: int, producto_id: int, cambios: ProductoCambios
) -> ProductoOut:
    exigir_dueno(db, usuario, negocio_id)
    producto = _producto_de(db, negocio_id, producto_id)
    datos = cambios.model_dump(exclude_unset=True)
    for campo, valor in datos.items():
        # nombre, disponible y orden no aceptan "vacío"; descripción y precio sí (quitar el precio = consultar).
        if valor is not None or campo in ("descripcion", "precio_centimos"):
            setattr(producto, campo, valor)
    db.commit()
    return producto_out(producto)


def borrar_producto(db: Session, usuario: Usuario, negocio_id: int, producto_id: int) -> None:
    exigir_dueno(db, usuario, negocio_id)
    db.delete(_producto_de(db, negocio_id, producto_id))
    db.commit()


# ---------- Fotos ----------


def subir_foto(db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int, datos: bytes) -> FotoOut:
    exigir_dueno(db, usuario, negocio_id)
    cantidad = db.scalar(select(func.count()).select_from(Foto).where(Foto.negocio_id == negocio_id)) or 0
    if cantidad >= settings.MAX_FOTOS_POR_NEGOCIO:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, f"Máximo {settings.MAX_FOTOS_POR_NEGOCIO} fotos. Borra alguna.")
    webp, ancho, alto = imagenes.procesar(datos)
    clave = f"negocios/{negocio_id}/{uuid.uuid4().hex}.webp"  # nombre imposible de adivinar
    almacen.guardar(clave, webp, "image/webp")
    foto = Foto(negocio_id=negocio_id, clave=clave, ancho=ancho, alto=alto, orden=cantidad)
    db.add(foto)
    try:
        db.commit()
    except Exception:
        almacen.borrar(clave)  # sin registro en la base, el archivo quedaría huérfano
        raise
    return foto_out(foto, almacen)


def borrar_foto(db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int, foto_id: int) -> None:
    exigir_dueno(db, usuario, negocio_id)
    foto = db.get(Foto, foto_id)
    if foto is None or foto.negocio_id != negocio_id:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Foto no encontrada.")
    clave = foto.clave
    db.delete(foto)
    db.commit()
    almacen.borrar(clave)


# ---------- Ficha pública ----------


def ficha(db: Session, almacen: Almacen, slug: str) -> FichaOut:
    fila = db.execute(
        select(Negocio, Categoria)
        .join(Categoria, Categoria.id == Negocio.categoria_id)
        .options(selectinload(Negocio.horarios), selectinload(Negocio.productos), selectinload(Negocio.fotos))
        .where(Negocio.slug == slug, Negocio.estado == EstadoNegocio.APROBADO, Negocio.eliminado_en.is_(None))
    ).first()
    if fila is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Negocio no encontrado.")
    negocio, categoria = fila
    lng, lat = coordenadas(negocio.ubicacion)
    atencion = estado_atencion(negocio.horarios, ahora())
    return FichaOut(
        id=negocio.id,
        slug=negocio.slug,
        nombre=negocio.nombre,
        categoria=categoria.nombre,
        categoria_slug=categoria.slug,
        descripcion=negocio.descripcion,
        distrito=negocio.distrito,
        direccion=negocio.direccion,
        referencia=negocio.referencia,
        lng=lng,
        lat=lat,
        telefono=negocio.telefono,
        whatsapp=negocio.whatsapp,
        tiene_delivery=negocio.tiene_delivery,
        abierto=atencion.abierto if atencion else None,
        cierra_a=atencion.cierra_a if atencion else None,
        horarios=[HorarioOut(dia_semana=h.dia_semana, abre=h.abre, cierra=h.cierra) for h in negocio.horarios],
        productos=[producto_out(p) for p in negocio.productos if p.disponible],
        fotos=[foto_out(f, almacen) for f in negocio.fotos],
        calificacion_promedio=float(negocio.calificacion_promedio) if negocio.calificacion_promedio else None,
        total_resenas=negocio.total_resenas,
        logo=almacen.url(negocio.logo_clave) if negocio.logo_clave else None,
        portada=almacen.url(negocio.portada_clave) if negocio.portada_clave else None,
        seguidores=social.contar_seguidores(db, negocio.id),
        total_reacciones=social.total_reacciones_del_negocio(db, negocio.id),
        total_me_gusta=social.contar_me_gusta(db, negocio.id),
        total_publicaciones=db.scalar(
            select(func.count()).select_from(Publicacion).where(Publicacion.negocio_id == negocio.id)
        )
        or 0,
    )


def catalogo_propio(db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int) -> CatalogoOut:
    exigir_dueno(db, usuario, negocio_id)
    productos = db.scalars(
        select(Producto).where(Producto.negocio_id == negocio_id).order_by(Producto.orden, Producto.id)
    ).all()
    fotos = db.scalars(select(Foto).where(Foto.negocio_id == negocio_id).order_by(Foto.orden, Foto.id)).all()
    negocio = db.get(Negocio, negocio_id)
    assert negocio is not None
    return CatalogoOut(
        productos=[producto_out(p) for p in productos],
        fotos=[foto_out(f, almacen) for f in fotos],
        logo=almacen.url(negocio.logo_clave) if negocio.logo_clave else None,
        portada=almacen.url(negocio.portada_clave) if negocio.portada_clave else None,
    )
