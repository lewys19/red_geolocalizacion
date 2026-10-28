"""Publicaciones de los negocios, el muro del Inicio, destacados y listas de negocios."""

import uuid

from fastapi import status
from geoalchemy2 import Geography
from sqlalchemy import Select, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.almacen import Almacen
from app.core.errores import ErrorNegocio
from app.models import Categoria, EstadoNegocio, FotoPublicacion, Negocio, Publicacion, Usuario
from app.schemas.catalogo import FotoOut
from app.schemas.publicacion import MuroOut, NegocioMini, PublicacionOut
from app.services import imagenes, social
from app.services.negocios import exigir_dueno

MAX_FOTOS_POR_PUBLICACION = 4
MAX_TEXTO = 2000


def _origen(lng: float, lat: float):  # type: ignore[no-untyped-def]
    return cast(func.ST_SetSRID(func.ST_MakePoint(lng, lat), 4326), Geography(srid=4326))


def mini(negocio: Negocio, categoria: str, almacen: Almacen, distancia_m: float | None = None) -> NegocioMini:
    clave = negocio.logo_clave or (negocio.fotos[0].clave if negocio.fotos else None)
    return NegocioMini(
        id=negocio.id,
        slug=negocio.slug,
        nombre=negocio.nombre,
        categoria=categoria,
        distrito=negocio.distrito,
        foto=almacen.url(clave) if clave else None,
        distancia_m=round(distancia_m) if distancia_m is not None else None,
    )


def _visibles(consulta: Select) -> Select:
    """Solo negocios aprobados y no borrados."""
    return consulta.where(Negocio.estado == EstadoNegocio.APROBADO, Negocio.eliminado_en.is_(None))


# ---------- Publicar ----------


def crear(
    db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int, texto: str, fotos: list[bytes]
) -> PublicacionOut:
    exigir_dueno(db, usuario, negocio_id)
    negocio = db.get(Negocio, negocio_id)
    assert negocio is not None
    if negocio.estado != EstadoNegocio.APROBADO:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Podrás publicar cuando tu negocio esté aprobado.")
    texto = texto.strip()
    if not texto and not fotos:
        raise ErrorNegocio(status.HTTP_422_UNPROCESSABLE_CONTENT, "Escribe algo o agrega una foto.")
    if len(texto) > MAX_TEXTO:
        raise ErrorNegocio(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Máximo {MAX_TEXTO} caracteres.")
    if len(fotos) > MAX_FOTOS_POR_PUBLICACION:
        raise ErrorNegocio(status.HTTP_422_UNPROCESSABLE_CONTENT, f"Máximo {MAX_FOTOS_POR_PUBLICACION} fotos.")

    procesadas = [imagenes.procesar(datos) for datos in fotos]  # si una falla, no se guarda nada
    publicacion = Publicacion(negocio_id=negocio_id, autor_id=usuario.id, texto=texto)
    guardadas: list[str] = []
    try:
        for orden, (webp, ancho, alto) in enumerate(procesadas):
            clave = f"publicaciones/{negocio_id}/{uuid.uuid4().hex}.webp"
            almacen.guardar(clave, webp, "image/webp")
            guardadas.append(clave)
            publicacion.fotos.append(FotoPublicacion(clave=clave, ancho=ancho, alto=alto, orden=orden))
        db.add(publicacion)
        db.commit()
    except Exception:
        for clave in guardadas:  # sin registro en la base, los archivos quedarían huérfanos
            almacen.borrar(clave)
        raise
    return _cargar_una(db, almacen, publicacion.id)


def borrar(db: Session, almacen: Almacen, usuario: Usuario, negocio_id: int, publicacion_id: int) -> None:
    exigir_dueno(db, usuario, negocio_id)
    publicacion = db.get(Publicacion, publicacion_id)
    if publicacion is None or publicacion.negocio_id != negocio_id:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Publicación no encontrada.")
    claves = [f.clave for f in publicacion.fotos]
    db.delete(publicacion)
    db.commit()
    for clave in claves:
        almacen.borrar(clave)


def _a_salida(
    p: Publicacion, categoria: str, almacen: Almacen, distancia_m: float | None, resumen: social.Resumen
) -> PublicacionOut:
    return PublicacionOut(
        id=p.id,
        texto=p.texto,
        creado_en=p.creado_en,
        negocio=mini(p.negocio, categoria, almacen, distancia_m),
        fotos=[FotoOut(id=f.id, url=almacen.url(f.clave), ancho=f.ancho, alto=f.alto) for f in p.fotos],
        reacciones=resumen.reacciones,
        total_reacciones=resumen.total,
        total_comentarios=resumen.comentarios,
        mi_reaccion=resumen.mi_reaccion,  # type: ignore[arg-type]
    )


def _cargar_una(db: Session, almacen: Almacen, publicacion_id: int) -> PublicacionOut:
    p, categoria = db.execute(
        select(Publicacion, Categoria.nombre)
        .join(Negocio, Negocio.id == Publicacion.negocio_id)
        .join(Categoria, Categoria.id == Negocio.categoria_id)
        .options(selectinload(Publicacion.fotos), selectinload(Publicacion.negocio).selectinload(Negocio.fotos))
        .where(Publicacion.id == publicacion_id)
    ).one()
    return _a_salida(p, categoria, almacen, None, social.Resumen())


# ---------- Muro ----------


def muro(
    db: Session,
    almacen: Almacen,
    desde: tuple[float, float] | None = None,
    radio_m: int = 50_000,
    antes_de: int | None = None,
    limite: int = 20,
    negocio_slug: str | None = None,
    usuario: Usuario | None = None,
) -> MuroOut:
    """Lo más nuevo primero. Con ubicación, solo de negocios dentro del radio (y con su distancia).
    Con negocio_slug, el muro de ese negocio (su página de perfil)."""
    distancia = func.ST_Distance(Negocio.ubicacion, _origen(*desde)) if desde else None
    consulta = _visibles(
        select(Publicacion, Categoria.nombre, *([distancia] if distancia is not None else []))
        .join(Negocio, Negocio.id == Publicacion.negocio_id)
        .join(Categoria, Categoria.id == Negocio.categoria_id)
        .options(selectinload(Publicacion.fotos), selectinload(Publicacion.negocio).selectinload(Negocio.fotos))
    )
    if desde:
        consulta = consulta.where(func.ST_DWithin(Negocio.ubicacion, _origen(*desde), radio_m))
    if negocio_slug:
        consulta = consulta.where(Negocio.slug == negocio_slug)
    if antes_de:
        consulta = consulta.where(Publicacion.id < antes_de)
    filas = db.execute(consulta.order_by(Publicacion.id.desc()).limit(limite + 1)).all()
    hay_mas = len(filas) > limite
    filas = filas[:limite]
    resumen = social.resumenes(db, [f[0].id for f in filas], usuario)
    return MuroOut(
        publicaciones=[
            _a_salida(f[0], f[1], almacen, f[2] if distancia is not None else None, resumen[f[0].id]) for f in filas
        ],
        siguiente=filas[-1][0].id if hay_mas else None,
    )


# ---------- Listas de negocios (círculos, tarjetas de categoría, destacados) ----------


def lista(
    db: Session,
    almacen: Almacen,
    categoria: str | None = None,
    desde: tuple[float, float] | None = None,
    limite: int = 30,
) -> list[NegocioMini]:
    """Con ubicación: los más cercanos primero. Sin ella: los más nuevos."""
    distancia = func.ST_Distance(Negocio.ubicacion, _origen(*desde)) if desde else None
    consulta = _visibles(
        select(Negocio, Categoria.nombre, *([distancia] if distancia is not None else []))
        .join(Categoria, Categoria.id == Negocio.categoria_id)
        .options(selectinload(Negocio.fotos))
    )
    if categoria:
        padre = select(Categoria.id).where(Categoria.slug == categoria).scalar_subquery()
        ids = select(Categoria.id).where(or_(Categoria.slug == categoria, Categoria.padre_id == padre))
        consulta = consulta.where(Negocio.categoria_id.in_(ids))
    orden = distancia if distancia is not None else Negocio.creado_en.desc()
    filas = db.execute(consulta.order_by(orden, Negocio.id).limit(limite)).all()
    return [mini(f[0], f[1], almacen, f[2] if distancia is not None else None) for f in filas]


def conteo_por_categoria(db: Session) -> dict[str, int]:
    """Negocios visibles por categoría; una categoría padre suma las de sus hijas."""
    filas = db.execute(
        _visibles(
            select(Categoria.slug, Categoria.padre_id, func.count(Negocio.id))
            .join(Negocio, Negocio.categoria_id == Categoria.id)
            .group_by(Categoria.slug, Categoria.padre_id)
        )
    ).all()
    padres = dict(db.execute(select(Categoria.id, Categoria.slug)).all())
    conteo: dict[str, int] = {}
    for slug, padre_id, n in filas:
        conteo[slug] = conteo.get(slug, 0) + n
        if padre_id is not None:
            conteo[padres[padre_id]] = conteo.get(padres[padre_id], 0) + n
    return conteo
