from collections.abc import Callable

from fastapi.testclient import TestClient

from tests.conftest import cabeceras


def test_registro_abre_sesion_y_yo_responde(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    assert sesion["usuario"]["rol"] == "cliente"
    r = client.get("/api/v1/yo", headers=cabeceras(sesion))
    assert r.status_code == 200
    yo = r.json()
    assert yo["email"] == "ana@example.com"
    assert yo["negocios"] == []
    assert (yo["es_negocio"], yo["es_operador"], yo["es_superadmin"]) == (False, False, False)


def test_registro_exige_aceptar_terminos(client: TestClient) -> None:
    r = client.post(
        "/api/v1/auth/registro",
        json={"email": "a@example.com", "nombre": "Ana", "contrasena": "clave-segura-1", "acepta_terminos": False},
    )
    assert r.status_code == 422


def test_email_duplicado_sin_importar_mayusculas(client: TestClient, registrar: Callable[..., dict]) -> None:
    registrar("ana@example.com")
    r = client.post(
        "/api/v1/auth/registro",
        json={"email": "ANA@Example.com", "nombre": "Otra", "contrasena": "clave-segura-1", "acepta_terminos": True},
    )
    assert r.status_code == 409


def test_login_correcto_e_incorrecto(client: TestClient, registrar: Callable[..., dict]) -> None:
    registrar()
    ok = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "contrasena": "clave-segura-1"})
    assert ok.status_code == 200
    mal = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "contrasena": "otra-clave-x"})
    nadie = client.post("/api/v1/auth/login", json={"email": "nadie@example.com", "contrasena": "clave-segura-1"})
    # Mismo mensaje para clave mala y para email inexistente: no se revela qué cuentas existen.
    assert mal.status_code == nadie.status_code == 401
    assert mal.json() == nadie.json()


def test_sin_token_o_con_token_falso(client: TestClient) -> None:
    assert client.get("/api/v1/yo").status_code == 401
    assert client.get("/api/v1/yo", headers={"Authorization": "Bearer falso"}).status_code == 401


def test_refresco_rota_el_token(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    r = client.post("/api/v1/auth/refresco", json={"token_refresco": sesion["token_refresco"]})
    assert r.status_code == 200
    nueva = r.json()
    assert nueva["token_refresco"] != sesion["token_refresco"]
    assert client.get("/api/v1/yo", headers=cabeceras(nueva)).status_code == 200


def test_reusar_un_refresco_cierra_todas_las_sesiones(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    nueva = client.post("/api/v1/auth/refresco", json={"token_refresco": sesion["token_refresco"]}).json()
    # Alguien vuelve a usar el token viejo (posible robo): se rechaza...
    r = client.post("/api/v1/auth/refresco", json={"token_refresco": sesion["token_refresco"]})
    assert r.status_code == 401
    # ...y también deja de servir el token nuevo.
    r = client.post("/api/v1/auth/refresco", json={"token_refresco": nueva["token_refresco"]})
    assert r.status_code == 401


def test_salir_invalida_el_refresco(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    assert client.post("/api/v1/auth/salir", json={"token_refresco": sesion["token_refresco"]}).status_code == 204
    r = client.post("/api/v1/auth/refresco", json={"token_refresco": sesion["token_refresco"]})
    assert r.status_code == 401


def test_eliminar_cuenta_anonimiza_y_libera_el_email(client: TestClient, registrar: Callable[..., dict]) -> None:
    sesion = registrar()
    assert client.delete("/api/v1/yo", headers=cabeceras(sesion)).status_code == 204
    assert client.get("/api/v1/yo", headers=cabeceras(sesion)).status_code == 401
    r = client.post("/api/v1/auth/login", json={"email": "ana@example.com", "contrasena": "clave-segura-1"})
    assert r.status_code == 401
    # El email queda libre para una cuenta nueva.
    registrar("ana@example.com")
