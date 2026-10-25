"""Geocodificación con el patrón Strategy.

Toda la app depende solo de `ProveedorGeocoding`. Cada servicio externo
(Nominatim hoy; Google, Mapbox o HERE mañana) es una estrategia intercambiable
que se elige por configuración, sin tocar el resto del código.
"""

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class DireccionSugerida:
    direccion: str | None  # "Avenida José Pardo 140"
    distrito: str | None  # uno de app.core.geo.DISTRITOS, o None si no se reconoce
    completa: str  # el texto entero del proveedor, para mostrarlo


class ProveedorGeocoding(Protocol):
    nombre: str

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        """Coordenadas → dirección (reverse geocoding). None si no encuentra nada."""
        ...


class SinGeocoding:
    """Estrategia nula: la app funciona igual, solo que sin sugerencias."""

    nombre = "ninguno"

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        return None
