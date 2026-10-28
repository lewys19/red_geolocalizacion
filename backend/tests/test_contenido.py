import io
from collections.abc import Callable, Generator
from pathlib import Path

import pytest
import redis
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from app.almacen import AlmacenLocal, obtener_almacen
from app.core.config import settings
from app.main import app
from app.models import RolPlataforma, Usuario
from tests.conftest import SUSCRIPTOR, cabeceras


@pytest.fixture(autouse=True)
def carpeta_fotos(tmp_path: Path) -> Generator[Path, None, None]:
    app.dependency_overrides[obtener_almacen] = lambda: AlmacenLocal(str(tmp_path))
    yield tmp_path
    app.dependency_overrides.pop(obtener_almacen, None)


@pytest.fixture(autouse=True)
def sin_limite_previo() -> None:
    # El límite de sugerencias vive en Redis: se limpia para que cada prueba empiece de cero.
    cliente = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)
    for clave in cliente.scan_iter("sugerencias:*"):
        cliente.delete(clave)


def _admin(db: Session, registrar: Callable[..., dict]) -> dict:
    jefe = registrar("jefe@example.com")
    u = db.get(Usuario, jefe["usuario"]["id"])
    assert u is not None
    u.rol = RolPlataforma.SUPERADMIN
    db.commit()
    return cabeceras(jefe)


def _png() -> bytes:
    b = io.BytesIO()
    Image.new("RGB", (600, 800), "teal").save(b, "PNG")
    return b.getvalue()


def test_banners_se_usan_los_que_esten_activos(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    h = _admin(db, registrar)
    espacios = client.get("/api/v1/admin/anuncios", headers=h).json()
    assert [e["posicion"] for e in espacios] == [1, 2, 3] and not any(e["imagen"] for e in espacios)
    assert client.get("/api/v1/anuncios").json() == []

    # Sin imagen no se puede activar.
    assert client.put("/api/v1/admin/anuncios/1", json={"activo": True}, headers=h).status_code == 400
    r = client.put("/api/v1/admin/anuncios/1/imagen", files={"foto": ("b.png", _png(), "image/png")}, headers=h)
    assert r.status_code == 200 and r.json()["imagen"]
    r = client.put(
        "/api/v1/admin/anuncios/1", json={"titulo": "Pollería X", "enlace": "/n/polleria-x", "activo": True}, headers=h
    )
    assert r.status_code == 200, r.text
    publicos = client.get("/api/v1/anuncios").json()
    assert [(a["posicion"], a["enlace"]) for a in publicos] == [(1, "/n/polleria-x")]

    # Enlaces peligrosos, no; y un 4.º espacio no existe.
    malo = client.put("/api/v1/admin/anuncios/2", json={"enlace": "javascript:alert(1)"}, headers=h)
    assert malo.status_code == 422
    assert client.put("/api/v1/admin/anuncios/4", json={}, headers=h).status_code == 404

    # Quitar la imagen lo desactiva.
    client.delete("/api/v1/admin/anuncios/1/imagen", headers=h)
    assert client.get("/api/v1/anuncios").json() == []


def test_sugerencias_cada_envio_es_una_fila(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    assert client.post("/api/v1/sugerencias", json={"texto": "Agreguen veterinarias 24 h"}).status_code == 204
    assert client.post("/api/v1/sugerencias", json={"texto": "Modo oscuro"}, headers=cabeceras(ana)).status_code == 204
    assert client.post("/api/v1/sugerencias", json={"texto": "x"}).status_code == 422
    h = _admin(db, registrar)
    r = client.get("/api/v1/admin/sugerencias", headers=h).json()
    assert r["total"] == 2
    ultima, primera = r["sugerencias"]
    assert (ultima["texto"], ultima["usuario"]["username"]) == ("Modo oscuro", "ana")
    assert primera["usuario"] is None and primera["creado_en"]
    assert client.delete(f"/api/v1/admin/sugerencias/{primera['id']}", headers=h).status_code == 204
    assert client.get("/api/v1/admin/sugerencias", headers=h).json()["total"] == 1


def test_limite_de_sugerencias(client: TestClient) -> None:
    for i in range(5):
        assert client.post("/api/v1/sugerencias", json={"texto": f"idea {i}"}).status_code == 204
    assert client.post("/api/v1/sugerencias", json={"texto": "una más"}).status_code == 429


def test_permisos(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    sus = registrar("sus@example.com")
    u = db.get(Usuario, sus["usuario"]["id"])
    assert u is not None
    u.rol_panel_id = SUSCRIPTOR
    db.commit()
    h = cabeceras(sus)
    assert client.get("/api/v1/admin/anuncios", headers=h).status_code == 200
    assert client.put("/api/v1/admin/anuncios/1", json={}, headers=h).status_code == 403
    assert client.get("/api/v1/admin/sugerencias", headers=h).status_code == 403
