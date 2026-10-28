import io
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.almacen import AlmacenLocal, obtener_almacen
from app.core.usernames import RESERVADOS, base_desde
from app.main import app
from app.models import EstadoNegocio, Negocio
from tests.conftest import cabeceras, datos_negocio

WEB = Path(__file__).resolve().parents[2] / "web" / "app"


@pytest.fixture(autouse=True)
def carpeta_fotos(tmp_path: Path) -> Generator[Path, None, None]:
    app.dependency_overrides[obtener_almacen] = lambda: AlmacenLocal(str(tmp_path))
    yield tmp_path
    app.dependency_overrides.pop(obtener_almacen, None)


def test_el_registro_genera_un_username_unico(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    otra = registrar("ana2@example.com")
    assert (ana["usuario"]["username"], otra["usuario"]["username"]) == ("ana", "ana-2")
    assert base_desde("José Ñique Pérez") == "jose-nique-perez"


def test_cambiar_username(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    registrar("luis@example.com")  # queda como ana-2
    h = cabeceras(ana)
    r = client.patch("/api/v1/yo", json={"username": "@Lewys"}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["username"] == "lewys"
    assert client.patch("/api/v1/yo", json={"username": "ana-2"}, headers=h).status_code == 409
    for malo in ("admin", "mapa", "ab", "-lewys", "lewys ramos", "eliminado-3"):
        assert client.patch("/api/v1/yo", json={"username": malo}, headers=h).status_code == 422, malo


def test_ninguna_ruta_de_la_web_puede_ser_username() -> None:
    """Si se agrega una página en la raíz de la web, tiene que entrar a RESERVADOS."""
    rutas = {p.name for p in (WEB / "(sitio)").iterdir() if p.is_dir()} | {
        p.name for p in WEB.iterdir() if p.is_dir() and not p.name.startswith("(")
    }
    assert rutas, "no se encontró web/app"
    assert rutas - {"[usuario]"} <= RESERVADOS


def test_perfil_publico(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    h = cabeceras(ana)
    aprobado = client.post("/api/v1/negocios", json=datos_negocio(), headers=h).json()
    negocio = db.get(Negocio, aprobado["id"])
    assert negocio is not None
    negocio.estado = EstadoNegocio.APROBADO
    db.commit()
    client.post("/api/v1/negocios", json=datos_negocio(nombre="Bodega Pendiente"), headers=h)

    r = client.get("/api/v1/perfiles/ANA")
    assert r.status_code == 200, r.text
    perfil = r.json()
    assert perfil["username"] == "ana" and "email" not in perfil and "telefono" not in perfil
    assert [n["nombre"] for n in perfil["negocios"]] == ["Pollería El Buen Sabor"]
    assert client.get("/api/v1/perfiles/nadie").status_code == 404

    client.delete("/api/v1/yo", headers=h)
    assert client.get("/api/v1/perfiles/ana").status_code == 404


def test_foto_de_perfil(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    h = cabeceras(ana)
    imagen = io.BytesIO()
    Image.new("RGB", (800, 500), "orange").save(imagen, "PNG")
    r = client.put("/api/v1/yo/avatar", files={"foto": ("a.png", imagen.getvalue(), "image/png")}, headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["avatar"]
    assert client.get("/api/v1/perfiles/ana").json()["avatar"] == r.json()["avatar"]
    assert client.delete("/api/v1/yo/avatar", headers=h).json()["avatar"] is None
