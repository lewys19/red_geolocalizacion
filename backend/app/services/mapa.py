"""Búsqueda en el mapa: solo lo que se ve en pantalla.

La web envía el recuadro visible (oeste, sur, este, norte). Si ahí hay pocos
negocios se devuelven uno por uno; si hay muchos, agrupados en una malla de
8 x 8 celdas sobre la pantalla, con el conteo de cada celda. Así la respuesta
es siempre chica, haya 50 o 50 000 negocios en la base.
"""

from datetime import datetime

from fastapi import status
from geoalchemy2 import Geography, Geometry
from sqlalchemy import Select, cast, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.fechas import ahora
from app.models import Categoria, EstadoNegocio, Negocio
from app.schemas.negocio import GrupoMapa, MapaOut, PuntoMapa
from app.services.busqueda import palabras, puntaje
from app.services.horarios import estado_atencion

CELDAS_POR_LADO = 8


def _filtrar(consulta: Select, recuadro: tuple[float, float, float, float], categoria: str | None) -> Select:
    caja = cast(func.ST_MakeEnvelope(*recuadro, 4326), Geography(srid=4326))
    consulta = consulta.where(
        Negocio.estado == EstadoNegocio.APROBADO,
        Negocio.eliminado_en.is_(None),
        Negocio.ubicacion.op("&&")(caja),  # usa el índice espacial (GIST)
    )
    if categoria:
        # Una categoría padre ("comida") incluye a todas sus hijas.
        padre = select(Categoria.id).where(Categoria.slug == categoria).scalar_subquery()
        ids = select(Categoria.id).where(or_(Categoria.slug == categoria, Categoria.padre_id == padre))
        consulta = consulta.where(Negocio.categoria_id.in_(ids))
    return consulta


def buscar(
    db: Session,
    oeste: float,
    sur: float,
    este: float,
    norte: float,
    categoria: str | None = None,
    desde: tuple[float, float] | None = None,
    momento: datetime | None = None,
    texto: str | None = None,
) -> MapaOut:
    if not (oeste < este and sur < norte):
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Recuadro del mapa no válido.")
    if este - oeste > settings.MAX_LADO_RECUADRO or norte - sur > settings.MAX_LADO_RECUADRO:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, "Acerca un poco el mapa para ver los negocios.")
    recuadro = (oeste, sur, este, norte)
    buscadas = palabras(texto) if texto else []
    relevancia = puntaje(buscadas) if buscadas else None

    def filtrar(consulta: Select) -> Select:
        consulta = _filtrar(consulta, recuadro, categoria)
        return consulta.where(relevancia > 0) if relevancia is not None else consulta

    total = db.scalar(filtrar(select(func.count()).select_from(Negocio))) or 0
    if total == 0:
        return MapaOut(total=0, puntos=[], grupos=[])

    # Con texto no se agrupa: se muestran los más relevantes, uno por uno.
    if total > settings.LIMITE_PUNTOS_MAPA and relevancia is None:
        geom = cast(Negocio.ubicacion, Geometry(srid=4326))
        tam = max(este - oeste, norte - sur) / CELDAS_POR_LADO
        centro = func.ST_Centroid(func.ST_Collect(geom))
        filas = db.execute(
            filtrar(select(func.ST_X(centro), func.ST_Y(centro), func.count()).select_from(Negocio)).group_by(
                func.ST_SnapToGrid(geom, tam)
            )
        ).all()
        return MapaOut(total=total, puntos=[], grupos=[GrupoMapa(lng=x, lat=y, cantidad=n) for x, y, n in filas])

    geom = cast(Negocio.ubicacion, Geometry(srid=4326))
    distancia = (
        func.ST_Distance(Negocio.ubicacion, cast(func.ST_SetSRID(func.ST_MakePoint(*desde), 4326), Geography(srid=4326)))
        if desde
        else None
    )
    columnas = [Negocio, func.ST_X(geom), func.ST_Y(geom), Categoria.nombre]
    orden = [distancia if distancia is not None else Negocio.nombre]
    if relevancia is not None:
        orden.insert(0, relevancia.desc())
    consulta = (
        filtrar(
            select(*columnas, *([distancia] if distancia is not None else []))
            .join(Categoria, Categoria.id == Negocio.categoria_id)
            .options(selectinload(Negocio.horarios))
        )
        .order_by(*orden)
        .limit(settings.LIMITE_PUNTOS_MAPA)
    )

    momento = momento or ahora()
    puntos = []
    for fila in db.execute(consulta).all():
        negocio, lng, lat, nombre_categoria = fila[0], fila[1], fila[2], fila[3]
        atencion = estado_atencion(negocio.horarios, momento)
        puntos.append(
            PuntoMapa(
                id=negocio.id,
                slug=negocio.slug,
                nombre=negocio.nombre,
                categoria=nombre_categoria,
                lng=lng,
                lat=lat,
                distrito=negocio.distrito,
                direccion=negocio.direccion,
                referencia=negocio.referencia,
                telefono=negocio.telefono,
                whatsapp=negocio.whatsapp,
                tiene_delivery=negocio.tiene_delivery,
                abierto=atencion.abierto if atencion else None,
                cierra_a=atencion.cierra_a if atencion else None,
                distancia_m=round(fila[4]) if distancia is not None else None,
            )
        )
    return MapaOut(total=total, puntos=puntos, grupos=[])
