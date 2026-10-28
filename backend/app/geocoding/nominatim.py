"""Estrategia Nominatim (OpenStreetMap): gratis, con reglas de uso estrictas."""

import json
import urllib.parse
import urllib.request

from app.core.geo import LIMITES_PILOTO
from app.geocoding.base import DireccionSugerida, LugarEncontrado
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
        return interpretar(self._pedir(f"/reverse?{params}"))

    def directo(self, texto: str) -> LugarEncontrado | None:
        lim = LIMITES_PILOTO
        params = urllib.parse.urlencode(
            {"format": "jsonv2", "q": texto, "countrycodes": "pe", "limit": 1, "addressdetails": 1,
             "viewbox": f"{lim['oeste']},{lim['norte']},{lim['este']},{lim['sur']}", "bounded": 1,
             "accept-language": "es"}  # fmt: skip
        )
        resultados = self._pedir(f"/search?{params}")
        return interpretar_busqueda(resultados[0]) if resultados else None

    def _pedir(self, ruta: str):  # noqa: ANN202 (JSON: dict o lista)
        pedido = urllib.request.Request(f"{self.url}{ruta}", headers={"User-Agent": self.agente})
        with urllib.request.urlopen(pedido, timeout=self.timeout) as r:  # noqa: S310 (URL fija de configuración)
            return json.load(r)


def interpretar(datos: dict) -> DireccionSugerida | None:
    """Convierte la respuesta de Nominatim en una sugerencia. Separado para probarlo sin red."""
    if "error" in datos or "address" not in datos:
        return None
    a = datos["address"]
    calle = a.get("road") or a.get("pedestrian") or a.get("footway")
    direccion = " ".join(p for p in (calle, a.get("house_number")) if p) or None
    return DireccionSugerida(direccion=direccion, distrito=distrito_de(a), completa=datos.get("display_name", ""))


def interpretar_busqueda(dato: dict) -> LugarEncontrado | None:
    """Un resultado de /search: su punto y la dirección normalizada."""
    sugerencia = interpretar(dato)
    if sugerencia is None or "lat" not in dato or "lon" not in dato:
        return None
    return LugarEncontrado(lng=float(dato["lon"]), lat=float(dato["lat"]), sugerencia=sugerencia)
