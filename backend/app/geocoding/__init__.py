"""Elige la estrategia de geocodificación según la configuración (punto único de cambio)."""

from functools import lru_cache

from app.core.cache import cliente_redis
from app.core.config import settings
from app.geocoding.base import DireccionSugerida, ProveedorGeocoding, SinGeocoding
from app.geocoding.cache import ConCacheYRitmo
from app.geocoding.nominatim import Nominatim

__all__ = ["DireccionSugerida", "ProveedorGeocoding", "obtener_geocodificador"]


@lru_cache
def obtener_geocodificador() -> ProveedorGeocoding:
    if settings.GEOCODING_PROVEEDOR == "nominatim":
        base = Nominatim(settings.NOMINATIM_URL, settings.GEOCODING_CONTACTO)
        return ConCacheYRitmo(base, cliente_redis(), settings.DIAS_CACHE_GEOCODING)
    return SinGeocoding()
