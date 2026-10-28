from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import RolPlataforma, Usuario
from tests.conftest import SUBADMINISTRADOR, SUSCRIPTOR, cabeceras, datos_negocio


def _dar_rol(db: Session, usuario_id: int, rol: RolPlataforma | None = None, rol_panel: int | None = None) -> None:
    usuario = db.get(Usuario, usuario_id)
    assert usuario is not None
    if rol is not None:
        usuario.rol = rol
    usuario.rol_panel_id = rol_panel
    db.commit()


def _administrador(db: Session, registrar: Callable[..., dict]) -> dict:
    jefe = registrar("jefe@example.com")
    _dar_rol(db, jefe["usuario"]["id"], RolPlataforma.SUPERADMIN)
    return jefe


def test_cliente_no_entra_al_panel(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    assert sesion["usuario"]["en_panel"] is False
    assert client.get("/api/v1/admin/resumen", headers=cabeceras(sesion)).status_code == 403


def test_el_administrador_lo_puede_todo(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    jefe = _administrador(db, registrar)
    yo = client.get("/api/v1/yo", headers=cabeceras(jefe)).json()
    assert yo["rol_panel"] == "Administrador"
    assert "roles.gestionar" in yo["permisos"]
    r = client.get("/api/v1/admin/resumen", headers=cabeceras(jefe)).json()
    assert r["usuarios"] == 1 and r["equipo"] == 1


def test_dashboard_cuenta_usuarios_con_y_sin_negocio(
    client: TestClient, registrar: Callable[..., dict], db: Session
) -> None:
    jefe = _administrador(db, registrar)
    ana = registrar()
    registrar("luis@example.com")
    client.post("/api/v1/negocios", json=datos_negocio(), headers=cabeceras(ana))
    client.post("/api/v1/negocios", json=datos_negocio(nombre="Pollería Dos"), headers=cabeceras(ana))
    r = client.get("/api/v1/admin/resumen", headers=cabeceras(jefe)).json()
    assert (r["usuarios"], r["usuarios_con_negocio"], r["usuarios_sin_negocio"], r["negocios"]) == (3, 1, 2, 2)
    assert r["categorias"] > 0
    assert r["por_categoria"][0]["negocios"] == 2


def test_suscriptor_solo_consulta(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    sus = registrar("sus@example.com")
    _dar_rol(db, sus["usuario"]["id"], rol_panel=SUSCRIPTOR)
    h = cabeceras(sus)
    yo = client.get("/api/v1/yo", headers=h).json()
    assert (yo["rol_panel"], yo["es_operador"]) == ("Suscriptor", True)
    assert client.get("/api/v1/admin/usuarios", headers=h).status_code == 200
    ruta = f"/api/v1/admin/usuarios/{ana['usuario']['id']}"
    assert client.patch(ruta, json={"nombre": "Otra"}, headers=h).status_code == 403
    assert client.delete(ruta, headers=h).status_code == 403
    assert client.post("/api/v1/admin/roles", json={"nombre": "X", "permisos": []}, headers=h).status_code == 403


def test_tabla_de_usuarios_busca_y_pagina(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    jefe = _administrador(db, registrar)
    for i in range(12):
        registrar(f"persona{i}@example.com")
    h = cabeceras(jefe)
    r = client.get("/api/v1/admin/usuarios?pagina=2&por_pagina=5", headers=h).json()
    assert (r["total"], r["pagina"], len(r["usuarios"])) == (13, 2, 5)
    r = client.get("/api/v1/admin/usuarios?q=persona1", headers=h).json()
    assert {u["email"] for u in r["usuarios"]} == {"persona1@example.com", "persona10@example.com", "persona11@example.com"}
    r = client.get(f"/api/v1/admin/usuarios?q=u{jefe['usuario']['id']:08d}", headers=h).json()
    assert [u["email"] for u in r["usuarios"]] == ["jefe@example.com"]
    csv = client.get("/api/v1/admin/usuarios/exportar?q=persona", headers=h)
    assert csv.status_code == 200 and csv.headers["content-type"].startswith("text/csv")
    assert len(csv.text.strip().splitlines()) == 13  # encabezado + 12


def test_editar_y_eliminar_usuario(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    jefe = _administrador(db, registrar)
    ana = registrar()
    h = cabeceras(jefe)
    ruta = f"/api/v1/admin/usuarios/{ana['usuario']['id']}"
    r = client.patch(ruta, json={"nombre": "Ana María", "celular": "987 654 321"}, headers=h)
    assert r.status_code == 200, r.text
    assert (r.json()["nombre"], r.json()["telefono"]) == ("Ana María", "987654321")
    assert client.delete(ruta, headers=h).status_code == 204
    assert client.get(ruta, headers=h).status_code == 404
    # Al Administrador no lo toca nadie, ni él mismo desde el panel.
    assert client.delete(f"/api/v1/admin/usuarios/{jefe['usuario']['id']}", headers=h).status_code == 400


def test_roles_se_crean_asignan_y_eliminan(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    jefe = _administrador(db, registrar)
    ana = registrar()
    h = cabeceras(jefe)
    r = client.post(
        "/api/v1/admin/roles",
        json={"nombre": "Marketing", "permisos": ["negocios.ver", "usuarios.ver", "negocios.ver"]},
        headers=h,
    )
    assert r.status_code == 201, r.text
    rol = r.json()
    assert rol["permisos"] == ["usuarios.ver", "negocios.ver"]
    assert client.post("/api/v1/admin/roles", json={"nombre": "Marketing", "permisos": []}, headers=h).status_code == 409
    assert client.post("/api/v1/admin/roles", json={"nombre": "Administrador", "permisos": []}, headers=h).status_code == 422
    assert client.post("/api/v1/admin/roles", json={"nombre": "Raro", "permisos": ["todo"]}, headers=h).status_code == 422

    ruta_rol = f"/api/v1/admin/usuarios/{ana['usuario']['id']}/rol-panel"
    r = client.put(ruta_rol, json={"rol_panel_id": rol["id"]}, headers=h)
    assert r.json()["rol_panel"] == {"id": rol["id"], "nombre": "Marketing"}
    yo = client.get("/api/v1/yo", headers=cabeceras(ana)).json()
    assert (yo["rol_panel"], yo["permisos"]) == ("Marketing", ["usuarios.ver", "negocios.ver"])

    # Con usuarios no se borra; al quitárselo, sí.
    assert client.delete(f"/api/v1/admin/roles/{rol['id']}", headers=h).status_code == 409
    client.put(ruta_rol, json={"rol_panel_id": None}, headers=h)
    assert client.delete(f"/api/v1/admin/roles/{rol['id']}", headers=h).status_code == 204
    assert client.get("/api/v1/admin/resumen", headers=cabeceras(ana)).status_code == 403


def test_subadministrador_no_gestiona_roles(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    sub = registrar("sub@example.com")
    ana = registrar()
    _dar_rol(db, sub["usuario"]["id"], rol_panel=SUBADMINISTRADOR)
    r = client.put(
        f"/api/v1/admin/usuarios/{ana['usuario']['id']}/rol-panel", json={"rol_panel_id": SUBADMINISTRADOR},
        headers=cabeceras(sub),
    )
    assert r.status_code == 403
    roles = client.get("/api/v1/admin/roles", headers=cabeceras(sub)).json()
    assert [x["nombre"] for x in roles] == ["Subadministrador", "Suscriptor"]
