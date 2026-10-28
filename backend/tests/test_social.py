"""Perfil del negocio (foto de perfil y portada), seguidores, reacciones y comentarios."""

from collections.abc import Callable
from pathlib import Path

from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy.orm import Session

from tests.conftest import cabeceras
from tests.test_publicaciones import _jpeg, _negocio, _publicar, carpeta_fotos  # noqa: F401 (fixture)

API = "/api/v1"


def test_foto_de_perfil_y_portada_se_recortan_y_reemplazan(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path  # noqa: F811
) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    for tipo, medida in (("logo", (400, 400)), ("portada", (1500, 500))):
        r = client.put(f"{API}/negocios/{n['id']}/imagen/{tipo}", files={"foto": ("a.jpg", _jpeg(), "image/jpeg")},
                       headers=cabeceras(ana))  # fmt: skip
        assert r.status_code == 200, r.text
        archivo = carpeta_fotos / r.json()["url"].removeprefix("/media/")
        assert Image.open(archivo).size == medida
    # La segunda subida reemplaza a la primera (y borra el archivo viejo).
    client.put(f"{API}/negocios/{n['id']}/imagen/logo", files={"foto": ("b.jpg", _jpeg(), "image/jpeg")},
               headers=cabeceras(ana))  # fmt: skip
    assert len(list(carpeta_fotos.rglob("logo-*.webp"))) == 1
    ficha = client.get(f"{API}/negocios/ficha/{n['slug']}").json()
    assert ficha["logo"] and ficha["portada"]
    # En el muro, el avatar del negocio es su foto de perfil.
    _publicar(client, ana, n["id"], "Hola")
    assert client.get(f"{API}/muro").json()["publicaciones"][0]["negocio"]["foto"] == ficha["logo"]
    # Quitarla
    assert client.delete(f"{API}/negocios/{n['id']}/imagen/logo", headers=cabeceras(ana)).json() == {"url": None}


def test_solo_el_dueno_cambia_la_imagen(
    client: TestClient, registrar: Callable[..., dict], db: Session, carpeta_fotos: Path  # noqa: F811
) -> None:
    n = _negocio(client, db, registrar())
    beto = registrar("beto@example.com")
    r = client.put(f"{API}/negocios/{n['id']}/imagen/logo", files={"foto": ("a.jpg", _jpeg(), "image/jpeg")},
                   headers=cabeceras(beto))  # fmt: skip
    assert r.status_code == 404
    assert client.put(f"{API}/negocios/{n['id']}/imagen/otra", headers=cabeceras(beto)).status_code == 422


def test_seguir_y_dejar_de_seguir(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    beto = registrar("beto@example.com")
    assert client.get(f"{API}/negocios/{n['id']}/relacion", headers=cabeceras(beto)).json() == {
        "lo_sigo": False, "me_gusta": False, "es_miembro": False}  # fmt: skip
    for _ in range(2):  # seguir dos veces no suma dos
        r = client.put(f"{API}/negocios/{n['id']}/seguir", headers=cabeceras(beto))
        assert r.json() == {"seguidores": 1, "lo_sigo": True}
    assert client.get(f"{API}/negocios/ficha/{n['slug']}").json()["seguidores"] == 1
    assert client.get(f"{API}/negocios/{n['id']}/relacion", headers=cabeceras(ana)).json()["es_miembro"] is True
    assert client.delete(f"{API}/negocios/{n['id']}/seguir", headers=cabeceras(beto)).json()["seguidores"] == 0
    assert client.put(f"{API}/negocios/{n['id']}/seguir").status_code == 401
    pendiente = _negocio(client, db, ana, aprobar=False, nombre="Otro local")
    assert client.put(f"{API}/negocios/{pendiente['id']}/seguir", headers=cabeceras(beto)).status_code == 404


def test_reacciones_una_por_persona(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    pid = _publicar(client, ana, n["id"], "Promo").json()["id"]
    beto, caro = registrar("beto@example.com"), registrar("caro@example.com")
    client.put(f"{API}/publicaciones/{pid}/reaccion", json={"tipo": "me_gusta"}, headers=cabeceras(beto))
    r = client.put(f"{API}/publicaciones/{pid}/reaccion", json={"tipo": "me_encanta"}, headers=cabeceras(beto))
    assert r.json() == {"reacciones": {"me_gusta": 0, "me_encanta": 1, "wow": 0}, "total": 1, "mi_reaccion": "me_encanta"}
    client.put(f"{API}/publicaciones/{pid}/reaccion", json={"tipo": "wow"}, headers=cabeceras(caro))
    assert client.put(f"{API}/publicaciones/{pid}/reaccion", json={"tipo": "enojo"}, headers=cabeceras(caro)).status_code == 422

    # El muro trae los conteos; con sesión, también tu reacción.
    visitante = client.get(f"{API}/muro").json()["publicaciones"][0]
    assert (visitante["total_reacciones"], visitante["mi_reaccion"]) == (2, None)
    propia = client.get(f"{API}/negocios/ficha/{n['slug']}/publicaciones", headers=cabeceras(beto)).json()
    assert propia["publicaciones"][0]["mi_reaccion"] == "me_encanta"
    assert client.get(f"{API}/negocios/ficha/{n['slug']}").json()["total_reacciones"] == 2

    r = client.delete(f"{API}/publicaciones/{pid}/reaccion", headers=cabeceras(beto))
    assert (r.json()["total"], r.json()["mi_reaccion"]) == (1, None)


def test_comentarios_y_quien_puede_borrarlos(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    ana = registrar()
    n = _negocio(client, db, ana)
    pid = _publicar(client, ana, n["id"], "Promo").json()["id"]
    beto, caro = registrar("beto@example.com"), registrar("caro@example.com")
    r = client.post(f"{API}/publicaciones/{pid}/comentarios", json={"texto": "  ¿Hacen delivery a Surco?  "},
                    headers=cabeceras(beto))  # fmt: skip
    assert r.status_code == 201
    c1 = r.json()
    assert (c1["texto"], c1["autor"]["nombre"]) == ("¿Hacen delivery a Surco?", "Ana")
    c2 = client.post(f"{API}/publicaciones/{pid}/comentarios", json={"texto": "¡Sí!"}, headers=cabeceras(ana)).json()
    assert client.post(f"{API}/publicaciones/{pid}/comentarios", json={"texto": "   "}, headers=cabeceras(beto)).status_code == 422

    lista = client.get(f"{API}/publicaciones/{pid}/comentarios").json()
    assert [c["id"] for c in lista["comentarios"]] == [c1["id"], c2["id"]]
    assert lista["total"] == 2
    assert client.get(f"{API}/muro").json()["publicaciones"][0]["total_comentarios"] == 2

    # Caro no puede borrar el de Beto; Beto sí el suyo; el negocio puede moderar su muro.
    assert client.delete(f"{API}/publicaciones/{pid}/comentarios/{c1['id']}", headers=cabeceras(caro)).status_code == 403
    assert client.delete(f"{API}/publicaciones/{pid}/comentarios/{c1['id']}", headers=cabeceras(beto)).status_code == 204
    otro = client.post(f"{API}/publicaciones/{pid}/comentarios", json={"texto": "spam"}, headers=cabeceras(caro)).json()
    assert client.delete(f"{API}/publicaciones/{pid}/comentarios/{otro['id']}", headers=cabeceras(ana)).status_code == 204
    assert client.get(f"{API}/publicaciones/{pid}/comentarios").json()["total"] == 1


def test_me_gusta_de_la_pagina(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    dueno = registrar("dueno@example.com")
    n = _negocio(client, db, dueno)
    ana = registrar()
    ruta = f"{API}/negocios/{n['id']}/me-gusta"
    assert client.put(ruta).status_code == 401
    for _ in range(2):  # dos veces: sigue contando 1
        r = client.put(ruta, headers=cabeceras(ana))
        assert r.json() == {"me_gusta": True, "total": 1}
    assert client.get(f"{API}/negocios/{n['id']}/relacion", headers=cabeceras(ana)).json()["me_gusta"] is True
    assert client.get(f"{API}/negocios/ficha/{n['slug']}").json()["total_me_gusta"] == 1
    assert client.delete(ruta, headers=cabeceras(ana)).json() == {"me_gusta": False, "total": 0}


def test_editar_publicacion_y_compartidos(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    dueno = registrar("dueno@example.com")
    n = _negocio(client, db, dueno)
    p = _publicar(client, dueno, n["id"], "Ceviche a S/ 25").json()
    assert p["es_mia"] is True and p["editado_en"] is None and p["compartidos"] == 0
    ruta = f"{API}/negocios/{n['id']}/publicaciones/{p['id']}"
    intruso = registrar("intruso@example.com")
    assert client.patch(ruta, json={"texto": "Hackeado"}, headers=cabeceras(intruso)).status_code == 404
    r = client.patch(ruta, json={"texto": "Ceviche a S/ 22, solo hoy"}, headers=cabeceras(dueno))
    assert r.status_code == 200, r.text
    assert r.json()["texto"] == "Ceviche a S/ 22, solo hoy" and r.json()["editado_en"]
    # En el muro: el dueño la ve como suya; otro no.
    muro = f"{API}/negocios/ficha/{n['slug']}/publicaciones"
    assert client.get(muro, headers=cabeceras(dueno)).json()["publicaciones"][0]["es_mia"] is True
    assert client.get(muro, headers=cabeceras(intruso)).json()["publicaciones"][0]["es_mia"] is False
    assert client.post(f"{API}/publicaciones/{p['id']}/compartido").json() == {"compartidos": 1}
    assert client.post(f"{API}/publicaciones/{p['id']}/compartido").json() == {"compartidos": 2}
    assert client.post(f"{API}/publicaciones/999999/compartido").status_code == 404
