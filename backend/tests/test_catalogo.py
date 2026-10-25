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


def _negocio(client: TestClient, sesion: dict, aprobar: Session | None = None) -> dict:
    r = client.post("/api/v1/negocios", json=datos_negocio(), headers=cabeceras(sesion))
    assert r.status_code == 201
    if aprobar is not None:
        n = aprobar.get(Negocio, r.json()["id"])
        assert n is not None
        n.estado = EstadoNegocio.APROBADO
        aprobar.commit()
    return r.json()


def _jpeg_con_gps(ancho: int = 3000, alto: int = 2000) -> bytes:
    """Foto de celular simulada: grande y con coordenadas GPS en el EXIF."""
    imagen = Image.new("RGB", (ancho, alto), (234, 88, 12))
    exif = Image.Exif()
    exif[0x8825] = {1: "S", 2: (12.0, 7.0, 3.0), 3: "W", 4: (77.0, 1.0, 46.0)}  # GPSInfo
    salida = io.BytesIO()
    imagen.save(salida, "JPEG", exif=exif)
    return salida.getvalue()


def test_catalogo_con_precios(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    n = _negocio(client, ana)
    ruta = f"/api/v1/negocios/{n['id']}/productos"
    r = client.post(ruta, json={"nombre": "1/4 de pollo a la brasa", "precio_centimos": 1850}, headers=cabeceras(ana))
    assert r.status_code == 201
    pid = r.json()["id"]
    client.post(ruta, json={"nombre": "Chicha morada (jarra)"}, headers=cabeceras(ana))  # sin precio: consultar

    r = client.patch(f"{ruta}/{pid}", json={"precio_centimos": 1990, "disponible": False}, headers=cabeceras(ana))
    assert r.json()["precio_centimos"] == 1990
    assert r.json()["disponible"] is False
    assert r.json()["nombre"] == "1/4 de pollo a la brasa"

    cat = client.get(f"/api/v1/negocios/mios/{n['id']}/catalogo", headers=cabeceras(ana)).json()
    assert [p["nombre"] for p in cat["productos"]] == ["1/4 de pollo a la brasa", "Chicha morada (jarra)"]

    assert client.delete(f"{ruta}/{pid}", headers=cabeceras(ana)).status_code == 204
    assert client.patch(f"{ruta}/{pid}", json={"orden": 1}, headers=cabeceras(ana)).status_code == 404


def test_precio_negativo_rechazado(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    n = _negocio(client, ana)
    r = client.post(
        f"/api/v1/negocios/{n['id']}/productos", json={"nombre": "Gratis", "precio_centimos": -1}, headers=cabeceras(ana)
    )
    assert r.status_code == 422


def test_un_extrano_no_toca_el_catalogo(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana, beto = registrar("ana@example.com"), registrar("beto@example.com")
    n = _negocio(client, ana)
    r = client.post(f"/api/v1/negocios/{n['id']}/productos", json={"nombre": "Intruso"}, headers=cabeceras(beto))
    assert r.status_code == 404
    pid = client.post(f"/api/v1/negocios/{n['id']}/productos", json={"nombre": "Pollo"}, headers=cabeceras(ana)).json()["id"]
    # Tampoco puede tocar un producto de Ana usando un negocio suyo.
    m = _negocio(client, beto)
    assert client.delete(f"/api/v1/negocios/{m['id']}/productos/{pid}", headers=cabeceras(beto)).status_code == 404


def test_foto_se_reduce_y_pierde_el_gps(
    client: TestClient, registrar: Callable[..., dict], carpeta_fotos: Path
) -> None:
    ana = registrar()
    n = _negocio(client, ana)
    r = client.post(
        f"/api/v1/negocios/{n['id']}/fotos",
        files={"foto": ("local.jpg", _jpeg_con_gps(), "image/jpeg")},
        headers=cabeceras(ana),
    )
    assert r.status_code == 201, r.text
    foto = r.json()
    assert (foto["ancho"], foto["alto"]) == (1600, 1067)
    assert foto["url"].startswith(f"/media/negocios/{n['id']}/") and foto["url"].endswith(".webp")

    guardada = carpeta_fotos / foto["url"].removeprefix("/media/")
    with Image.open(guardada) as img:
        assert img.format == "WEBP"
        assert 0x8825 not in img.getexif()  # sin coordenadas GPS
        assert not img.info.get("exif")

    assert client.delete(f"/api/v1/negocios/{n['id']}/fotos/{foto['id']}", headers=cabeceras(ana)).status_code == 204
    assert not guardada.exists()


def test_archivo_que_no_es_foto(client: TestClient, registrar: Callable[..., dict], carpeta_fotos: Path) -> None:
    ana = registrar()
    n = _negocio(client, ana)
    r = client.post(
        f"/api/v1/negocios/{n['id']}/fotos",
        files={"foto": ("virus.jpg", b"MZ\x90\x00 esto no es una imagen", "image/jpeg")},
        headers=cabeceras(ana),
    )
    assert r.status_code == 415
    assert list(carpeta_fotos.rglob("*")) == []


def test_ficha_publica_solo_si_esta_aprobado(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana = registrar()
    pendiente = _negocio(client, ana)
    assert client.get(f"/api/v1/negocios/ficha/{pendiente['slug']}").status_code == 404

    n = _negocio(client, ana, aprobar=db)
    ruta = f"/api/v1/negocios/{n['id']}/productos"
    client.post(ruta, json={"nombre": "Pollo entero", "precio_centimos": 6500}, headers=cabeceras(ana))
    client.post(ruta, json={"nombre": "Agotado", "disponible": False}, headers=cabeceras(ana))
    client.post(
        f"/api/v1/negocios/{n['id']}/fotos",
        files={"foto": ("a.jpg", _jpeg_con_gps(800, 600), "image/jpeg")},
        headers=cabeceras(ana),
    )

    r = client.get(f"/api/v1/negocios/ficha/{n['slug']}")  # sin sesión: es pública
    assert r.status_code == 200
    ficha = r.json()
    assert ficha["nombre"] == "Pollería El Buen Sabor"
    assert ficha["categoria_slug"] == "pollerias"
    assert [p["nombre"] for p in ficha["productos"]] == ["Pollo entero"]  # lo no disponible no se muestra
    assert len(ficha["fotos"]) == 1
    assert len(ficha["horarios"]) == 7
