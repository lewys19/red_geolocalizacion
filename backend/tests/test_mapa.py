from collections.abc import Callable
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import EstadoNegocio, Negocio
from app.services import mapa
from tests.conftest import cabeceras, datos_negocio

# Recuadro que cubre Miraflores y alrededores.
MIRAFLORES = {"oeste": -77.06, "sur": -12.14, "este": -77.00, "norte": -12.10}


def _aprobado(client: TestClient, db: Session, sesion: dict, **cambios: object) -> dict:
    r = client.post("/api/v1/negocios", json=datos_negocio(**cambios), headers=cabeceras(sesion))
    assert r.status_code == 201, r.text
    negocio = db.get(Negocio, r.json()["id"])
    assert negocio is not None
    negocio.estado = EstadoNegocio.APROBADO
    db.commit()
    return r.json()


def test_solo_aparecen_los_aprobados(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    client.post("/api/v1/negocios", json=datos_negocio(nombre="Pendiente"), headers=cabeceras(ana))
    _aprobado(client, db, ana, nombre="Aprobado")
    r = client.get("/api/v1/mapa", params=MIRAFLORES)
    assert r.status_code == 200
    assert [p["nombre"] for p in r.json()["puntos"]] == ["Aprobado"]


def test_fuera_del_recuadro_no_aparece(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    _aprobado(client, db, ana, distrito="Lima", ubicacion={"lng": -77.0300, "lat": -12.0464})  # Plaza de Armas
    assert client.get("/api/v1/mapa", params=MIRAFLORES).json()["total"] == 0


def test_filtro_por_categoria_padre_e_hija(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    _aprobado(client, db, ana, nombre="Pollería")  # Pollerías (hija de Comida)
    _aprobado(client, db, ana, nombre="Ferretería", categoria_id=12, ubicacion={"lng": -77.03, "lat": -12.12})

    def nombres(categoria: str) -> set[str]:
        return {p["nombre"] for p in client.get("/api/v1/mapa", params={**MIRAFLORES, "categoria": categoria}).json()["puntos"]}

    assert nombres("pollerias") == {"Pollería"}
    assert nombres("comida") == {"Pollería"}
    assert nombres("ferreterias") == {"Ferretería"}


def test_ordena_por_cercania_y_da_la_distancia(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    _aprobado(client, db, ana, nombre="Lejos", ubicacion={"lng": -77.0450, "lat": -12.1300})
    _aprobado(client, db, ana, nombre="Cerca", ubicacion={"lng": -77.0300, "lat": -12.1215})
    puntos = client.get("/api/v1/mapa", params={**MIRAFLORES, "lng": -77.0305, "lat": -12.1220}).json()["puntos"]
    assert [p["nombre"] for p in puntos] == ["Cerca", "Lejos"]
    assert 50 <= puntos[0]["distancia_m"] <= 100


def test_con_muchos_negocios_agrupa(
    client: TestClient, registrar: Callable[..., dict], db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    ana = registrar()
    for i in range(4):
        _aprobado(client, db, ana, nombre=f"Norte {i}", ubicacion={"lng": -77.050 + i * 0.001, "lat": -12.105})
    _aprobado(client, db, ana, nombre="Sur", ubicacion={"lng": -77.010, "lat": -12.135})
    monkeypatch.setattr(settings, "LIMITE_PUNTOS_MAPA", 3)
    r = client.get("/api/v1/mapa", params=MIRAFLORES).json()
    assert r["total"] == 5
    assert r["puntos"] == []
    assert sorted(g["cantidad"] for g in r["grupos"]) == [1, 4]


def test_recuadro_demasiado_grande(client: TestClient) -> None:
    r = client.get("/api/v1/mapa", params={"oeste": -78, "sur": -13, "este": -76, "norte": -11})
    assert r.status_code == 400


def test_abierto_ahora_en_el_mapa(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    _aprobado(client, db, ana)  # 12:00-23:00 todos los días
    # Martes 2026-10-20 a las 20:00 de Lima (01:00 UTC del miércoles).
    noche = mapa.buscar(db, *MIRAFLORES.values(), momento=datetime(2026, 10, 21, 1, 0, tzinfo=UTC))
    assert noche.puntos[0].abierto is True
    assert noche.puntos[0].cierra_a.hour == 23
    madrugada = mapa.buscar(db, *MIRAFLORES.values(), momento=datetime(2026, 10, 21, 8, 0, tzinfo=UTC))
    assert madrugada.puntos[0].abierto is False


def test_distritos(client: TestClient) -> None:
    distritos = client.get("/api/v1/distritos").json()
    assert len(distritos) == 50
    assert "San Juan de Lurigancho" in distritos


def test_busqueda_por_texto(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    polleria = _aprobado(client, db, ana, nombre="La Leñita")  # el nombre no dice "pollo"
    client.post(
        f"/api/v1/negocios/{polleria['id']}/productos",
        json={"nombre": "1/4 de pollo a la brasa", "precio_centimos": 1850},
        headers=cabeceras(ana),
    )
    _aprobado(client, db, ana, nombre="Chifa Dragón", categoria_id=3, ubicacion={"lng": -77.03, "lat": -12.12})
    _aprobado(client, db, ana, nombre="Ferretería El Clavo", categoria_id=12, ubicacion={"lng": -77.04, "lat": -12.12})

    def buscar(q: str) -> list[str]:
        return [p["nombre"] for p in client.get("/api/v1/mapa", params={**MIRAFLORES, "q": q}).json()["puntos"]]

    assert buscar("pollo a la brasa") == ["La Leñita"]  # por su carta y su categoría
    assert buscar("braza") == ["La Leñita"]  # error de tipeo
    assert buscar("dragon") == ["Chifa Dragón"]  # sin tilde
    assert buscar("ferreteria") == ["Ferretería El Clavo"]
    assert buscar("helados de lucuma") == []
    assert len(buscar("a la de")) == 3  # solo palabras vacías: no filtra


def test_palabras_utiles() -> None:
    from app.services.busqueda import palabras

    assert palabras("Pollo a la Brasa en Miraflores") == ["pollo", "brasa", "miraflores"]
    assert palabras("Ñandú, ñandú!!") == ["nandu"]
