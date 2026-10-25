from typing import Annotated

from fastapi import APIRouter, Query

from app.api.deps import Db
from app.core.geo import DISTRITOS
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


@router.get("/distritos", response_model=list[str])
def distritos() -> list[str]:
    return sorted(DISTRITOS)
