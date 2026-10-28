from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import UsuarioActual
from app.core.geo import dentro_del_piloto
from app.geocoding import ProveedorGeocoding, obtener_geocodificador
from app.schemas.negocio import DireccionSugeridaOut, LugarOut

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


@router.get("/buscar", response_model=LugarOut)
def punto_de_la_direccion(
    _usuario: UsuarioActual,
    geo: Geocodificador,
    direccion: Annotated[str, Query(min_length=4, max_length=200)],
    distrito: Annotated[str | None, Query(max_length=60)] = None,
) -> LugarOut:
    """Dirección escrita → punto para el pin del negocio (solo Lima y Callao). Es una ayuda: el dueño lo ajusta."""
    texto = ", ".join(p for p in (direccion.strip(), distrito, "Lima", "Perú") if p)
    try:
        lugar = geo.directo(texto)
    except Exception:  # noqa: BLE001  (red caída, servicio lento: la ayuda es opcional)
        lugar = None
    if lugar is None or not dentro_del_piloto(lugar.lng, lugar.lat):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No encontramos esa dirección. Ubica el pin en el mapa.")
    s = lugar.sugerencia
    return LugarOut(lng=lugar.lng, lat=lugar.lat, direccion=s.direccion, distrito=s.distrito, completa=s.completa)
