"""Estrategia Nominatim (OpenStreetMap): gratis, con reglas de uso estrictas."""

import json
import urllib.parse
import urllib.request

from app.geocoding.base import DireccionSugerida
from app.geocoding.distritos import distrito_de


class Nominatim:
    nombre = "nominatim"

    def __init__(self, url: str, contacto: str, timeout: float = 6.0) -> None:
        self.url = url.rstrip("/")
        self.timeout = timeout
        # Nominatim bloquea a quien no se identifica.
        self.agente = f"Altoque/0.1 ({contacto})" if contacto else "Altoque/0.1"

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        params = urllib.parse.urlencode(
            {"format": "jsonv2", "lat": f"{lat:.6f}", "lon": f"{lng:.6f}", "zoom": 18, "addressdetails": 1,
             "accept-language": "es"}  # fmt: skip
        )
        pedido = urllib.request.Request(f"{self.url}/reverse?{params}", headers={"User-Agent": self.agente})
        with urllib.request.urlopen(pedido, timeout=self.timeout) as r:  # noqa: S310 (URL fija de configuración)
            datos = json.load(r)
        return interpretar(datos)


def interpretar(datos: dict) -> DireccionSugerida | None:
    """Convierte la respuesta de Nominatim en una sugerencia. Separado para probarlo sin red."""
    if "error" in datos or "address" not in datos:
        return None
    a = datos["address"]
    calle = a.get("road") or a.get("pedestrian") or a.get("footway")
    direccion = " ".join(p for p in (calle, a.get("house_number")) if p) or None
    return DireccionSugerida(direccion=direccion, distrito=distrito_de(a), completa=datos.get("display_name", ""))
