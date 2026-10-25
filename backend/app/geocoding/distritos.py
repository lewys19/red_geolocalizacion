"""Reconoce el distrito de Lima o Callao en la respuesta de un geocodificador."""

import unicodedata

from app.core.geo import DISTRITOS

# Nombres alternativos con que aparecen en OpenStreetMap o como los dice la gente.
ALIAS = {
    "surco": "Santiago de Surco",
    "cercado de lima": "Lima",
    "lima cercado": "Lima",
    "sjl": "San Juan de Lurigancho",
    "sjm": "San Juan de Miraflores",
    "smp": "San Martín de Porres",
    "vmt": "Villa María del Triunfo",
    "ves": "Villa El Salvador",
    "magdalena": "Magdalena del Mar",
    "carmen de la legua": "Carmen de la Legua Reynoso",
    "pachacamac": "Pachacámac",
}


def _clave(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode("ascii")
    return " ".join(sin_tildes.lower().replace("distrito de", "").split())


_POR_CLAVE = {_clave(d): d for d in DISTRITOS} | {_clave(a): d for a, d in ALIAS.items()}

# Campos de la dirección donde suele venir el distrito, del más específico al más general.
# "Lima" (city) va al final: es también el nombre de la provincia y aparece casi siempre.
CAMPOS = ("city_district", "suburb", "town", "village", "municipality", "city")


def distrito_de(direccion: dict[str, str]) -> str | None:
    for campo in CAMPOS:
        valor = direccion.get(campo)
        if valor and (distrito := _POR_CLAVE.get(_clave(valor))):
            return distrito
    return None
