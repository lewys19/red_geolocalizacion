"""Datos geográficos del piloto: Lima Metropolitana y Callao."""

from geoalchemy2 import WKBElement
from geoalchemy2.shape import from_shape, to_shape
from shapely.geometry import Point

# Recuadro que contiene Lima Metropolitana y el Callao (de Ancón a Pucusana).
# Un negocio fuera de aquí se rechaza: durante el piloto solo se atiende Lima.
LIMITES_PILOTO = {"oeste": -77.25, "sur": -12.60, "este": -76.60, "norte": -11.55}

DISTRITOS = (
    # Lima Metropolitana (43)
    "Ancón", "Ate", "Barranco", "Breña", "Carabayllo", "Chaclacayo", "Chorrillos", "Cieneguilla",
    "Comas", "El Agustino", "Independencia", "Jesús María", "La Molina", "La Victoria", "Lima",
    "Lince", "Los Olivos", "Lurigancho", "Lurín", "Magdalena del Mar", "Miraflores", "Pachacámac",
    "Pucusana", "Pueblo Libre", "Puente Piedra", "Punta Hermosa", "Punta Negra", "Rímac",
    "San Bartolo", "San Borja", "San Isidro", "San Juan de Lurigancho", "San Juan de Miraflores",
    "San Luis", "San Martín de Porres", "San Miguel", "Santa Anita", "Santa María del Mar",
    "Santa Rosa", "Santiago de Surco", "Surquillo", "Villa El Salvador", "Villa María del Triunfo",
    # Callao (7)
    "Bellavista", "Callao", "Carmen de la Legua Reynoso", "La Perla", "La Punta", "Mi Perú", "Ventanilla",
)  # fmt: skip


def dentro_del_piloto(lng: float, lat: float) -> bool:
    lim = LIMITES_PILOTO
    return lim["oeste"] <= lng <= lim["este"] and lim["sur"] <= lat <= lim["norte"]


def punto(lng: float, lat: float) -> WKBElement:
    """Punto WGS84 (el sistema del GPS) listo para guardar en una columna geography."""
    return from_shape(Point(lng, lat), srid=4326)


def coordenadas(ubicacion: WKBElement) -> tuple[float, float]:
    """(lng, lat) de una columna geography leída de la base."""
    p = to_shape(ubicacion)
    return p.x, p.y
