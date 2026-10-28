from collections.abc import Callable

from fastapi.testclient import TestClient
from sqlalchemy import delete
from sqlalchemy.orm import Session

from app.models import Categoria, RolPlataforma, Usuario
from tests.conftest import SUSCRIPTOR, cabeceras, datos_negocio

API = "/api/v1/admin/categorias"


def _con_rol(db: Session, sesion: dict, rol: RolPlataforma | None = None, rol_panel: int | None = None) -> dict:
    u = db.get(Usuario, sesion["usuario"]["id"])
    assert u is not None
    if rol:
        u.rol = rol
    u.rol_panel_id = rol_panel
    db.commit()
    return cabeceras(sesion)


def _limpiar(db: Session, *slugs: str) -> None:
    # Las categorías no se vacían entre pruebas (vienen de la migración): se borran las creadas aquí.
    db.execute(delete(Categoria).where(Categoria.padre_id.in_(db.query(Categoria.id).filter(Categoria.slug.in_(slugs)))))
    db.execute(delete(Categoria).where(Categoria.slug.in_(slugs)))
    db.commit()


def test_crear_categoria_y_subcategoria(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    h = _con_rol(db, registrar("jefe@example.com"), RolPlataforma.SUPERADMIN)
    try:
        animales = client.post(API, json={"nombre": "Animales", "icono": "🐾", "orden": 20}, headers=h)
        assert animales.status_code == 201, animales.text
        a = animales.json()
        assert (a["slug"], a["icono"], a["padre_id"]) == ("animales", "🐾", None)
        sub = client.post(API, json={"nombre": "Pet shops", "padre_id": a["id"]}, headers=h).json()
        assert sub["padre"] == "Animales"
        # Aparece en el árbol público al instante.
        raiz = next(c for c in client.get("/api/v1/categorias").json() if c["slug"] == "animales")
        assert [x["nombre"] for x in raiz["hijas"]] == ["Pet shops"]
        # Repetida, tres niveles, y eliminar con subcategorías: no.
        assert client.post(API, json={"nombre": "animales"}, headers=h).status_code == 409
        assert client.post(API, json={"nombre": "Gatos", "padre_id": sub["id"]}, headers=h).status_code == 400
        assert client.delete(f"{API}/{a['id']}", headers=h).status_code == 409
        # Editar: el nombre cambia, el slug se queda (no rompe enlaces).
        r = client.put(f"{API}/{a['id']}", json={"nombre": "Mascotas", "icono": "🐶", "orden": 20}, headers=h).json()
        assert (r["nombre"], r["slug"], r["hijas"]) == ("Mascotas", "animales", 1)
        assert client.delete(f"{API}/{sub['id']}", headers=h).status_code == 204
        assert client.delete(f"{API}/{a['id']}", headers=h).status_code == 204
    finally:
        _limpiar(db, "animales", "pet-shops")


def test_no_se_borra_ni_se_subdivide_con_negocios(
    client: TestClient, registrar: Callable[..., dict], db: Session
) -> None:
    ana = registrar()
    h = _con_rol(db, registrar("jefe@example.com"), RolPlataforma.SUPERADMIN)
    n = client.post("/api/v1/negocios", json=datos_negocio(), headers=cabeceras(ana)).json()
    categoria_id = n["categoria_id"]
    r = client.delete(f"{API}/{categoria_id}", headers=h)
    assert r.status_code == 409 and "1 negocio" in r.json()["detail"]
    r = client.post(API, json={"nombre": "Pollos a la leña", "padre_id": categoria_id}, headers=h)
    assert r.status_code == 400  # Pollerías ya es subcategoría de Comida
    fila = next(c for c in client.get(API, headers=h).json() if c["id"] == categoria_id)
    assert fila["negocios"] == 1


def test_solo_con_permiso(client: TestClient, registrar: Callable[..., dict], db: Session) -> None:
    h = _con_rol(db, registrar("sus@example.com"), rol_panel=SUSCRIPTOR)
    assert client.get(API, headers=h).status_code == 200
    assert client.post(API, json={"nombre": "Animales"}, headers=h).status_code == 403
