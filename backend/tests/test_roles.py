from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import RolPlataforma, Usuario
from tests.conftest import cabeceras


def _dar_rol(db: Session, usuario_id: int, rol: RolPlataforma) -> None:
    usuario = db.get(Usuario, usuario_id)
    assert usuario is not None
    usuario.rol = rol
    db.commit()


def test_cliente_no_entra_al_panel_de_operador(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    assert client.get("/api/v1/admin/resumen", headers=cabeceras(sesion)).status_code == 403


def test_operador_ve_el_resumen(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    sesion = registrar()
    _dar_rol(db, sesion["usuario"]["id"], RolPlataforma.OPERADOR)
    r = client.get("/api/v1/admin/resumen", headers=cabeceras(sesion))
    assert r.status_code == 200
    assert r.json() == {
        "usuarios": 1,
        "negocios_por_estado": {"pendiente": 0, "aprobado": 0, "rechazado": 0, "suspendido": 0},
    }


def test_solo_el_superadmin_cambia_roles(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    jefe = registrar("jefe@example.com")
    operador = registrar("ope@example.com")
    cliente = registrar("cli@example.com")
    _dar_rol(db, jefe["usuario"]["id"], RolPlataforma.SUPERADMIN)
    _dar_rol(db, operador["usuario"]["id"], RolPlataforma.OPERADOR)
    ruta = f"/api/v1/superadmin/usuarios/{cliente['usuario']['id']}/rol"

    assert client.patch(ruta, json={"rol": "operador"}, headers=cabeceras(operador)).status_code == 403
    r = client.patch(ruta, json={"rol": "operador"}, headers=cabeceras(jefe))
    assert r.status_code == 200
    assert r.json()["rol"] == "operador"
    yo = client.get("/api/v1/yo", headers=cabeceras(cliente)).json()
    assert yo["es_operador"] is True


def test_el_superadmin_no_se_quita_su_propio_rol(
    client: TestClient, registrar: Callable[..., dict], db: Session
) -> None:
    jefe = registrar("jefe@example.com")
    _dar_rol(db, jefe["usuario"]["id"], RolPlataforma.SUPERADMIN)
    r = client.patch(
        f"/api/v1/superadmin/usuarios/{jefe['usuario']['id']}/rol", json={"rol": "cliente"}, headers=cabeceras(jefe)
    )
    assert r.status_code == 400
