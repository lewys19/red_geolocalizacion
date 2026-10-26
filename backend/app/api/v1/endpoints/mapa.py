from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Db
from app.core.config import settings
from app.core.errores import ErrorNegocio
from app.core.geo import DISTRITOS, dentro_del_piloto
from app.schemas.negocio import MapaOut
from app.services import mapa

router = APIRouter(tags=["Mapa"])

Grados = Annotated[float, Query(ge=-180, le=180)]


@router.get("/mapa", response_model=MapaOut)
def buscar_en_mapa(
    db: Db,
    oeste: Grados,
    sur: Grados,
    este: Grados,
    norte: Grados,
    categoria: Annotated[str | None, Query(max_length=70)] = None,
    q: Annotated[str | None, Query(max_length=100, description="Texto libre: «pollo a la brasa»")] = None,
    lng: Grados | None = None,
    lat: Grados | None = None,
) -> MapaOut:
    """Negocios aprobados dentro del recuadro visible. Con lng/lat, ordenados por cercanía;
    con q, primero los que más se parecen al texto (nombre, descripción, categoría y carta).

    La ubicación de quien busca solo se usa para esta respuesta: no se guarda.
    """
    desde = (lng, lat) if lng is not None and lat is not None else None
    return mapa.buscar(db, oeste, sur, este, norte, categoria, desde, texto=q)


@router.get("/mapa/cerca", response_model=MapaOut)
def buscar_cerca(
    db: Db,
    lng: Grados,
    lat: Grados,
    radio_m: Annotated[int, Query(ge=100, le=settings.MAX_RADIO_M, description="Radio en metros (máx. 50 km)")] = 5000,
    categoria: Annotated[str | None, Query(max_length=70)] = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
) -> MapaOut:
    """Los negocios más cercanos a quien busca, dentro del radio elegido (hasta 100).

    La ubicación solo se usa para esta respuesta: no se guarda.
    """
    if not dentro_del_piloto(lng, lat):
        raise ErrorNegocio(400, "Por ahora Altoque solo funciona en Lima y Callao.")
    return mapa.cerca(db, lng, lat, radio_m, categoria, texto=q)


@router.get("/distritos", response_model=list[str])
def distritos() -> list[str]:
    return sorted(DISTRITOS)
