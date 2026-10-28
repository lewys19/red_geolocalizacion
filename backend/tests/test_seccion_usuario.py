import io
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.almacen import AlmacenLocal, obtener_almacen
from app.main import app
from app.models import Usuario
from tests.conftest import SUBADMINISTRADOR, cabeceras, datos_negocio


@pytest.fixture()
def carpeta_fotos(tmp_path: Path) -> Generator[Path, None, None]:
    app.dependency_overrides[obtener_almacen] = lambda: AlmacenLocal(str(tmp_path))
    yield tmp_path
    app.dependency_overrides.pop(obtener_almacen, None)


def _png() -> bytes:
    salida = io.BytesIO()
    Image.new("RGB", (400, 300), (234, 88, 12)).save(salida, "PNG")
    return salida.getvalue()


def test_el_usuario_cambia_su_nombre_y_celular(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    r = client.patch("/api/v1/yo", json={"nombre": "Ana Torres", "celular": "+51 987 654 321"}, headers=cabeceras(ana))
    assert r.status_code == 200, r.text
    assert r.json()["nombre"] == "Ana Torres"
    assert r.json()["telefono"] == "987654321"
    assert r.json()["email"] == "ana@example.com"

    # Vacío lo quita; sin enviarlo, no se toca.
    r = client.patch("/api/v1/yo", json={"celular": ""}, headers=cabeceras(ana))
    assert r.json()["telefono"] is None
    assert r.json()["nombre"] == "Ana Torres"


def test_celular_invalido_o_repetido(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    beto = registrar("beto@example.com")
    assert client.patch("/api/v1/yo", json={"celular": "12345"}, headers=cabeceras(ana)).status_code == 422
    client.patch("/api/v1/yo", json={"celular": "987654321"}, headers=cabeceras(ana))
    r = client.patch("/api/v1/yo", json={"celular": "987654321"}, headers=cabeceras(beto))
    assert r.status_code == 409


def test_el_admin_ve_todo_lo_que_cargo_el_usuario(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path
) -> None:
    ana = registrar()
    n = client.post("/api/v1/negocios", json=datos_negocio(descripcion="Pollo a la leña"), headers=cabeceras(ana)).json()
    archivo = {"foto": ("a.png", _png(), "image/png")}
    client.put(f"/api/v1/negocios/{n['id']}/imagen/portada", files=archivo, headers=cabeceras(ana))
    client.put(f"/api/v1/negocios/{n['id']}/imagen/logo", files=archivo, headers=cabeceras(ana))
    for _ in range(2):
        client.post(f"/api/v1/negocios/{n['id']}/fotos", files=archivo, headers=cabeceras(ana))

    # Un cliente común no puede ver la lista.
    assert client.get("/api/v1/admin/usuarios", headers=cabeceras(ana)).status_code == 403

    jefe = registrar("ope@example.com")
    operador = db.get(Usuario, jefe["usuario"]["id"])
    assert operador is not None
    operador.rol_panel_id = SUBADMINISTRADOR
    db.commit()

    r = client.get("/api/v1/admin/usuarios", headers=cabeceras(jefe))
    assert r.status_code == 200, r.text
    fila = next(u for u in r.json()["usuarios"] if u["email"] == "ana@example.com")
    assert fila["negocios"] == 1
    r = client.get(f"/api/v1/admin/usuarios/{fila['id']}", headers=cabeceras(jefe))
    [negocio] = r.json()["negocios"]
    assert negocio["nombre"] == "Pollería El Buen Sabor"
    assert negocio["descripcion"] == "Pollo a la leña"
    assert negocio["categoria"]
    assert negocio["ubicacion"] == {"lng": -77.03, "lat": -12.1215}
    assert negocio["logo"] and negocio["portada"]
    assert len(negocio["fotos"]) == 2
