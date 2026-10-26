"""Ingreso con celular y con Google / Microsoft (sin red: el perfil del proveedor se simula)."""

from collections.abc import Callable
from urllib.parse import parse_qs, urlparse

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.services import externo
from tests.conftest import cabeceras


def test_registro_con_celular_y_login_con_celular(client: TestClient) -> None:
    r = client.post(
        "/api/v1/auth/registro",
        json={"email": "ana@example.com", "nombre": "Ana", "contrasena": "clave-segura-1", "celular": "+51 987 654 321",
              "acepta_terminos": True},  # fmt: skip
    )
    assert r.status_code == 201, r.text
    for forma in ("987654321", "987 654 321", "+51987654321", "ANA@example.com"):
        ok = client.post("/api/v1/auth/login", json={"usuario": forma, "contrasena": "clave-segura-1"})
        assert ok.status_code == 200, forma
    mal = client.post("/api/v1/auth/login", json={"usuario": "987654321", "contrasena": "otra-clave-x"})
    raro = client.post("/api/v1/auth/login", json={"usuario": "12345", "contrasena": "clave-segura-1"})
    assert mal.status_code == raro.status_code == 401
    assert mal.json() == raro.json()


def test_celular_invalido_o_repetido(client: TestClient) -> None:
    base = {"nombre": "Ana", "contrasena": "clave-segura-1", "acepta_terminos": True}
    malo = client.post("/api/v1/auth/registro", json={**base, "email": "a@example.com", "celular": "12345678"})
    assert malo.status_code == 422
    assert client.post("/api/v1/auth/registro", json={**base, "email": "a@example.com", "celular": "987654321"}).status_code == 201
    otro = client.post("/api/v1/auth/registro", json={**base, "email": "b@example.com", "celular": "987-654-321"})
    assert otro.status_code == 409
    assert "celular" in otro.json()["detail"]


@pytest.fixture()
def google(monkeypatch: pytest.MonkeyPatch) -> Callable[[str, str], None]:
    """Activa Google con credenciales falsas; devuelve cómo fijar el perfil que "responde" Google."""
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "id-de-prueba")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "secreto-de-prueba")

    def fijar(sujeto: str, email: str) -> None:
        perfil = externo.Perfil(sujeto=sujeto, email=email, nombre="Ana Google")
        monkeypatch.setattr(externo, "pedir_perfil", lambda *_: perfil)

    return fijar


def _ingresar_con_google(client: TestClient, volver: str = "/mapa") -> str:
    """Hace el viaje completo y devuelve a dónde vuelve la web."""
    ida = client.get("/api/v1/auth/externo/google", params={"volver": volver}, follow_redirects=False)
    assert ida.status_code == 302
    url = urlparse(ida.headers["location"])
    params = parse_qs(url.query)
    assert url.netloc == "accounts.google.com"
    assert params["code_challenge_method"] == ["S256"]
    vuelta = client.get(
        "/api/v1/auth/externo/google/vuelta",
        params={"code": "codigo-de-google", "state": params["state"][0]},
        follow_redirects=False,
    )
    assert vuelta.status_code == 302
    return vuelta.headers["location"]


def test_sin_credenciales_no_hay_google(client: TestClient) -> None:
    assert client.get("/api/v1/auth/externo").json() == {"proveedores": []}
    assert client.get("/api/v1/auth/externo/google", follow_redirects=False).status_code == 404


def test_google_crea_cuenta_y_el_canje_es_de_un_solo_uso(client: TestClient, google: Callable) -> None:
    google("sub-123", "ana@gmail.com")
    assert client.get("/api/v1/auth/externo").json() == {"proveedores": ["google"]}
    destino = _ingresar_con_google(client)
    assert destino.startswith(f"{settings.URL_PUBLICA}/mapa?ingreso=")
    codigo = parse_qs(urlparse(destino).query)["ingreso"][0]
    sesion = client.post("/api/v1/auth/externo/canje", json={"codigo": codigo})
    assert sesion.status_code == 200
    assert client.get("/api/v1/yo", headers=cabeceras(sesion.json())).json()["email"] == "ana@gmail.com"
    assert client.post("/api/v1/auth/externo/canje", json={"codigo": codigo}).status_code == 401


def test_google_se_enlaza_a_la_cuenta_del_mismo_correo(
    client: TestClient, registrar: Callable[..., dict], google: Callable
) -> None:
    propia = registrar("ana@gmail.com")
    google("sub-123", "ana@gmail.com")
    for _ in range(2):  # la segunda vez entra por el enlace, no por el correo
        codigo = parse_qs(urlparse(_ingresar_con_google(client)).query)["ingreso"][0]
        sesion = client.post("/api/v1/auth/externo/canje", json={"codigo": codigo}).json()
        assert sesion["usuario"]["id"] == propia["usuario"]["id"]


def test_estado_falso_o_volver_a_otro_sitio(client: TestClient, google: Callable) -> None:
    google("sub-123", "ana@gmail.com")
    falso = client.get(
        "/api/v1/auth/externo/google/vuelta", params={"code": "x", "state": "inventado"}, follow_redirects=False
    )
    assert falso.headers["location"] == f"{settings.URL_PUBLICA}/?ingreso_error=cancelado"
    # Un "volver" a otro dominio se ignora: siempre se vuelve a la propia web.
    assert _ingresar_con_google(client, volver="//malo.com").startswith(f"{settings.URL_PUBLICA}/?ingreso=")
