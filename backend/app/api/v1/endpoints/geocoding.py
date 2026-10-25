from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import UsuarioActual
from app.core.geo import dentro_del_piloto
from app.geocoding import ProveedorGeocoding, obtener_geocodificador
from app.schemas.negocio import DireccionSugeridaOut

router = APIRouter(prefix="/geocoding", tags=["Mapa"])

Geocodificador = Annotated[ProveedorGeocoding, Depends(obtener_geocodificador)]


@router.get("/inverso", response_model=DireccionSugeridaOut)
def direccion_del_punto(
    _usuario: UsuarioActual,  # solo con sesión: evita que se use como servicio gratuito de terceros
    geo: Geocodificador,
    lng: Annotated[float, Query(ge=-180, le=180)],
    lat: Annotated[float, Query(ge=-90, le=90)],
) -> DireccionSugeridaOut:
    """Dirección y distrito sugeridos para el pin del negocio. Es una sugerencia: el dueño la corrige."""
    if not dentro_del_piloto(lng, lat):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Por ahora Altoque solo funciona en Lima y Callao.")
    try:
        sugerencia = geo.inverso(lng, lat)
    except Exception:  # noqa: BLE001  (red caída, servicio lento: la sugerencia es opcional)
        sugerencia = None
    if sugerencia is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos una dirección para ese punto.")
    return DireccionSugeridaOut(direccion=sugerencia.direccion, distrito=sugerencia.distrito, completa=sugerencia.completa)
