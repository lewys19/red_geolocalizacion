"""Geocodificación: se prueba sin internet gracias al patrón Strategy (estrategias falsas)."""

from collections.abc import Callable

import pytest
import redis
from fastapi.testclient import TestClient

from app.core.config import settings
from app.geocoding import obtener_geocodificador
from app.geocoding.base import DireccionSugerida, LugarEncontrado
from app.geocoding.cache import ConCacheYRitmo
from app.geocoding.distritos import distrito_de
from app.geocoding.nominatim import interpretar, interpretar_busqueda
from app.main import app
from tests.conftest import cabeceras

# Respuesta real de Nominatim para un punto de la Av. José Pardo (recortada).
NOMINATIM_PARDO = {
    "display_name": "Clafer Divisas, 140, Avenida José Pardo, Miraflores, Lima, Lima Metropolitana, Lima, 15074, Perú",
    "address": {"house_number": "140", "road": "Avenida José Pardo", "suburb": "Miraflores", "city": "Miraflores"},
}


class Contador:
    """Estrategia falsa que cuenta cuántas veces se le pregunta."""

    nombre = "falso"

    def __init__(self) -> None:
        self.llamadas = 0

    def inverso(self, lng: float, lat: float) -> DireccionSugerida | None:
        self.llamadas += 1
        return DireccionSugerida(direccion="Av. Falsa 123", distrito="Lince", completa="Av. Falsa 123, Lince")

    def directo(self, texto: str) -> LugarEncontrado | None:
        self.llamadas += 1
        if "nada" in texto:
            return None
        return LugarEncontrado(-77.036, -12.085, self.inverso(-77.036, -12.085))  # type: ignore[arg-type]


def test_interpretar_respuesta_de_nominatim() -> None:
    s = interpretar(NOMINATIM_PARDO)
    assert s == DireccionSugerida("Avenida José Pardo 140", "Miraflores", NOMINATIM_PARDO["display_name"])
    assert interpretar({"error": "Unable to geocode"}) is None


@pytest.mark.parametrize(
    ("direccion", "esperado"),
    [
        ({"suburb": "Surco", "city": "Lima"}, "Santiago de Surco"),  # alias
        ({"city": "Lima"}, "Lima"),  # solo la ciudad: Cercado
        ({"city_district": "San Juan de Lurigancho", "city": "Lima"}, "San Juan de Lurigancho"),
        ({"suburb": "Magdalena", "city": "Lima"}, "Magdalena del Mar"),
        ({"town": "Arequipa"}, None),  # fuera del piloto
    ],
)
def test_reconoce_el_distrito(direccion: dict[str, str], esperado: str | None) -> None:
    assert distrito_de(direccion) == esperado


def test_cache_evita_repetir_la_consulta() -> None:
    base = Contador()
    cliente = redis.Redis.from_url(settings.REDIS_URL, db=15, decode_responses=True)  # base 15: solo pruebas
    cliente.flushdb()
    geo = ConCacheYRitmo(base, cliente, dias_cache=1)
    assert geo.inverso(-77.03, -12.12).distrito == "Lince"
    assert geo.inverso(-77.03, -12.12).distrito == "Lince"
    assert base.llamadas == 1
    cliente.flushdb()


def test_endpoint_usa_la_estrategia_configurada(client: TestClient, registrar: Callable[..., dict]) -> None:
    falso = Contador()
    app.dependency_overrides[obtener_geocodificador] = lambda: falso
    sesion = registrar()
    try:
        assert client.get("/api/v1/geocoding/inverso", params={"lng": -77.03, "lat": -12.12}).status_code == 401
        r = client.get("/api/v1/geocoding/inverso", params={"lng": -77.03, "lat": -12.12}, headers=cabeceras(sesion))
        assert r.status_code == 200
        assert r.json() == {"direccion": "Av. Falsa 123", "distrito": "Lince", "completa": "Av. Falsa 123, Lince"}
        fuera = client.get("/api/v1/geocoding/inverso", params={"lng": -71.5, "lat": -16.4}, headers=cabeceras(sesion))
        assert fuera.status_code == 400
    finally:
        app.dependency_overrides.pop(obtener_geocodificador, None)


def test_interpretar_busqueda_de_nominatim() -> None:
    lugar = interpretar_busqueda({**NOMINATIM_PARDO, "lat": "-12.1203", "lon": "-77.0335"})
    assert lugar is not None
    assert (lugar.lng, lugar.lat, lugar.sugerencia.distrito) == (-77.0335, -12.1203, "Miraflores")


def test_buscar_direccion_devuelve_el_punto(client: TestClient, registrar: Callable[..., dict]) -> None:
    falso = Contador()
    app.dependency_overrides[obtener_geocodificador] = lambda: falso
    h = cabeceras(registrar())
    try:
        r = client.get("/api/v1/geocoding/buscar", params={"direccion": "Av. Arequipa 2000", "distrito": "Lince"}, headers=h)
        assert r.status_code == 200, r.text
        assert r.json()["lng"] == -77.036 and r.json()["distrito"] == "Lince"
        assert client.get("/api/v1/geocoding/buscar", params={"direccion": "nada aquí"}, headers=h).status_code == 404
    finally:
        app.dependency_overrides.pop(obtener_geocodificador, None)


def test_cache_de_busqueda() -> None:
    base = Contador()
    cliente = redis.Redis.from_url(settings.REDIS_URL, db=15, decode_responses=True)
    cliente.flushdb()
    geo = ConCacheYRitmo(base, cliente, dias_cache=1)
    assert geo.directo("Av. Arequipa 2000, Lince") == geo.directo("av. arequipa   2000, lince")
    assert base.llamadas == 2  # la búsqueda (1) + el inverso que arma la respuesta falsa (1); la segunda vino de caché
    cliente.flushdb()
