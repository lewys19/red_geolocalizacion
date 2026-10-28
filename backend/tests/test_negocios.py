from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Usuario
from tests.conftest import SUBADMINISTRADOR, cabeceras, datos_negocio


def _registrar_negocio(client: TestClient, sesion: dict, **cambios: object) -> dict:
    r = client.post("/api/v1/negocios", json=datos_negocio(**cambios), headers=cabeceras(sesion))
    assert r.status_code == 201, r.text
    return r.json()


def _operador(db: Session, registrar: Callable[..., dict]) -> dict:
    sesion = registrar("ope@example.com")
    usuario = db.get(Usuario, sesion["usuario"]["id"])
    assert usuario is not None
    usuario.rol_panel_id = SUBADMINISTRADOR
    db.commit()
    return sesion


def test_registrar_negocio_queda_pendiente_y_me_hace_negocio(
    client: TestClient, registrar: Callable[..., dict]
) -> None:
    ana = registrar()
    negocio = _registrar_negocio(client, ana)
    assert negocio["estado"] == "pendiente"
    assert negocio["slug"] == "polleria-el-buen-sabor-miraflores"
    assert negocio["whatsapp"] == "51987654321"  # celular peruano normalizado para WhatsApp
    assert negocio["categoria"] == "Pollerías"
    assert len(negocio["horarios"]) == 7
    yo = client.get("/api/v1/yo", headers=cabeceras(ana)).json()
    assert yo["es_negocio"] is True
    assert yo["negocios"][0]["negocio_nombre"] == "Pollería El Buen Sabor"


def test_slug_repetido_recibe_sufijo(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    _registrar_negocio(client, ana)
    otro = _registrar_negocio(client, ana)
    assert otro["slug"] == "polleria-el-buen-sabor-miraflores-2"


def test_validaciones(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    fuera = client.post(
        "/api/v1/negocios", json=datos_negocio(ubicacion={"lng": -71.54, "lat": -16.40}), headers=cabeceras(ana)
    )  # Arequipa
    assert fuera.status_code == 422
    distrito = client.post("/api/v1/negocios", json=datos_negocio(distrito="Narnia"), headers=cabeceras(ana))
    assert distrito.status_code == 422
    padre = client.post("/api/v1/negocios", json=datos_negocio(categoria_id=1), headers=cabeceras(ana))  # Comida
    assert padre.status_code == 400
    assert "Comida" in padre.json()["detail"]
    sin_sesion = client.post("/api/v1/negocios", json=datos_negocio())
    assert sin_sesion.status_code == 401


def test_solo_sus_miembros_lo_ven_y_editan(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana, beto = registrar("ana@example.com"), registrar("beto@example.com")
    negocio = _registrar_negocio(client, ana)
    ruta = f"/api/v1/negocios/{negocio['id']}"
    assert client.patch(ruta, json={"nombre": "Robado"}, headers=cabeceras(beto)).status_code == 404
    assert client.get(f"/api/v1/negocios/mios/{negocio['id']}", headers=cabeceras(beto)).status_code == 404

    r = client.patch(
        ruta,
        json={"tiene_delivery": False, "horarios": [{"dia_semana": 0, "abre": "18:00", "cierra": "02:00"}]},
        headers=cabeceras(ana),
    )
    assert r.status_code == 200
    assert r.json()["tiene_delivery"] is False
    assert r.json()["nombre"] == "Pollería El Buen Sabor"  # lo no enviado no cambia
    assert r.json()["horarios"] == [{"dia_semana": 0, "abre": "18:00:00", "cierra": "02:00:00"}]


def test_limite_de_pendientes(client: TestClient, registrar: Callable[..., dict]) -> None:
    ana = registrar()
    for _ in range(5):
        _registrar_negocio(client, ana)
    r = client.post("/api/v1/negocios", json=datos_negocio(), headers=cabeceras(ana))
    assert r.status_code == 429


def test_operador_aprueba_y_rechaza(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    ope = _operador(db, registrar)
    uno = _registrar_negocio(client, ana)
    dos = _registrar_negocio(client, ana, nombre="Chifa Dragón", categoria_id=3)

    assert client.get("/api/v1/admin/negocios", headers=cabeceras(ana)).status_code == 403
    cola = client.get("/api/v1/admin/negocios", headers=cabeceras(ope)).json()
    assert [n["id"] for n in cola] == [uno["id"], dos["id"]]
    # Cada negocio trae a su dueño, y se busca por nombre, código del negocio o datos del dueño.
    assert cola[0]["dueno"]["username"] == ana["usuario"]["username"]

    def buscar(q: str) -> list[int]:
        r = client.get("/api/v1/admin/negocios", params={"q": q}, headers=cabeceras(ope))
        return [n["id"] for n in r.json()]

    assert buscar("dragón") == [dos["id"]]
    assert buscar(f"n{dos['id']:08d}") == [dos["id"]]
    assert buscar(f"@{ana['usuario']['username']}") == [uno["id"], dos["id"]]
    assert buscar(f"u{ana['usuario']['id']:08d}") == [uno["id"], dos["id"]]
    assert buscar("no-existe-xyz") == []

    ok = client.post(f"/api/v1/admin/negocios/{uno['id']}/aprobar", headers=cabeceras(ope))
    assert ok.json()["estado"] == "aprobado"
    no = client.post(
        f"/api/v1/admin/negocios/{dos['id']}/rechazar", json={"motivo": "Falta la dirección exacta"}, headers=cabeceras(ope)
    )
    assert no.json()["estado"] == "rechazado"

    mios = {n["id"]: n for n in client.get("/api/v1/negocios/mios", headers=cabeceras(ana)).json()}
    assert mios[dos["id"]]["motivo_rechazo"] == "Falta la dirección exacta"

    # El dueño corrige y el negocio vuelve a la cola.
    r = client.patch(f"/api/v1/negocios/{dos['id']}", json={"direccion": "Jr. Capón 123, int. 4"}, headers=cabeceras(ana))
    assert r.json()["estado"] == "pendiente"
    assert r.json()["motivo_rechazo"] is None
