import io
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.almacen import AlmacenLocal, obtener_almacen
from app.main import app
from app.models import EstadoNegocio, Negocio
from tests.conftest import cabeceras, datos_negocio


@pytest.fixture()
def carpeta_fotos(tmp_path: Path) -> Generator[Path, None, None]:
    app.dependency_overrides[obtener_almacen] = lambda: AlmacenLocal(str(tmp_path))
    yield tmp_path
    app.dependency_overrides.pop(obtener_almacen, None)


def _negocio(client: TestClient, db: Session, sesion: dict, aprobar: bool = True, **cambios: object) -> dict:
    r = client.post("/api/v1/negocios", json=datos_negocio(**cambios), headers=cabeceras(sesion))
    assert r.status_code == 201, r.text
    if aprobar:
        n = db.get(Negocio, r.json()["id"])
        assert n is not None
        n.estado = EstadoNegocio.APROBADO
        db.commit()
    return r.json()


def _jpeg() -> bytes:
    salida = io.BytesIO()
    Image.new("RGB", (800, 600), (234, 88, 12)).save(salida, "JPEG")
    return salida.getvalue()


def _publicar(client: TestClient, sesion: dict, negocio_id: int, texto: str, fotos: int = 0):  # type: ignore[no-untyped-def]
    archivos = [("fotos", (f"f{i}.jpg", _jpeg(), "image/jpeg")) for i in range(fotos)]
    return client.post(
        f"/api/v1/negocios/{negocio_id}/publicaciones",
        data={"texto": texto},
        files=archivos or None,
        headers=cabeceras(sesion),
    )


def test_publicar_con_fotos_y_verlo_en_el_muro(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    r = _publicar(client, ana, n["id"], "¡Hoy 2x1 en cuartos de pollo!", fotos=2)
    assert r.status_code == 201, r.text
    pub = r.json()
    assert pub["negocio"]["nombre"] == "Pollería El Buen Sabor"
    assert len(pub["fotos"]) == 2
    assert len(list(carpeta_fotos.rglob("*.webp"))) == 2

    muro = client.get("/api/v1/muro").json()  # sin sesión: el muro es público
    assert [p["texto"] for p in muro["publicaciones"]] == ["¡Hoy 2x1 en cuartos de pollo!"]
    propio = client.get(f"/api/v1/negocios/ficha/{n['slug']}/publicaciones").json()
    assert len(propio["publicaciones"]) == 1


def test_reglas_para_publicar(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana, beto = registrar("ana@example.com"), registrar("beto@example.com")
    pendiente = _negocio(client, db, ana, aprobar=False)
    assert _publicar(client, ana, pendiente["id"], "Hola").status_code == 400  # todavía en revisión
    n = _negocio(client, db, ana)
    assert _publicar(client, beto, n["id"], "Intruso").status_code == 404  # no es miembro
    assert _publicar(client, ana, n["id"], "   ").status_code == 422  # vacía
    assert _publicar(client, ana, n["id"], "Muchas", fotos=5).status_code == 422  # máximo 4 fotos


def test_muro_por_radio_mas_nuevo_primero_y_paginado(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana = registrar()
    cerca = _negocio(client, db, ana, nombre="Cerca")  # Parque Kennedy
    lejos = _negocio(client, db, ana, nombre="Lejos", distrito="Lima", ubicacion={"lng": -77.03, "lat": -12.0464})
    for i in range(3):
        _publicar(client, ana, cerca["id"], f"cerca {i}")
    _publicar(client, ana, lejos["id"], "lejos")

    general = client.get("/api/v1/muro").json()
    assert [p["texto"] for p in general["publicaciones"]] == ["lejos", "cerca 2", "cerca 1", "cerca 0"]

    yo = {"lng": -77.0300, "lat": -12.1215}
    en_2km = client.get("/api/v1/muro", params={**yo, "radio_m": 2000}).json()
    assert [p["texto"] for p in en_2km["publicaciones"]] == ["cerca 2", "cerca 1", "cerca 0"]
    assert en_2km["publicaciones"][0]["negocio"]["distancia_m"] < 50

    pagina1 = client.get("/api/v1/muro", params={"limite": 2}).json()
    assert len(pagina1["publicaciones"]) == 2 and pagina1["siguiente"] is not None
    pagina2 = client.get("/api/v1/muro", params={"limite": 2, "antes_de": pagina1["siguiente"]}).json()
    assert [p["texto"] for p in pagina2["publicaciones"]] == ["cerca 1", "cerca 0"]
    assert pagina2["siguiente"] is None


def test_borrar_publicacion_borra_sus_fotos(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    pid = _publicar(client, ana, n["id"], "Se va", fotos=1).json()["id"]
    r = client.delete(f"/api/v1/negocios/{n['id']}/publicaciones/{pid}", headers=cabeceras(ana))
    assert r.status_code == 204
    assert list(carpeta_fotos.rglob("*.webp")) == []
    assert client.get("/api/v1/muro").json()["publicaciones"] == []


def test_lista_y_conteo_por_categoria(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    _negocio(client, db, ana, nombre="Pollería")
    _negocio(client, db, ana, nombre="Ferretería", categoria_id=12, ubicacion={"lng": -77.04, "lat": -12.12})
    _negocio(client, db, ana, aprobar=False, nombre="Pendiente")

    conteo = client.get("/api/v1/categorias/conteo").json()
    assert conteo == {"pollerias": 1, "comida": 1, "ferreterias": 1}

    nombres = [n["nombre"] for n in client.get("/api/v1/negocios/lista", params={"categoria": "comida"}).json()]
    assert nombres == ["Pollería"]
    cercanos = client.get("/api/v1/negocios/lista", params={"lng": -77.0405, "lat": -12.12}).json()
    assert [n["nombre"] for n in cercanos] == ["Ferretería", "Pollería"]
    assert cercanos[0]["distancia_m"] < 100
