"""Lo mínimo del corazón geográfico: categorías sembradas y PostGIS respondiendo."""

from fastapi.testclient import TestClient
from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Categoria, Negocio


def test_categorias_en_arbol(client: TestClient) -> None:
    r = client.get("/api/v1/categorias")
    assert r.status_code == 200
    raices = {c["slug"]: c for c in r.json()}
    assert "comida" in raices
    assert "pollerias" in {h["slug"] for h in raices["comida"]["hijas"]}
    assert "ferreterias" in raices


def test_postgis_encuentra_lo_cercano(db: Session) -> None:
    polleria = db.scalar(select(Categoria).where(Categoria.slug == "pollerias"))
    assert polleria is not None

    def negocio(nombre: str, lng: float, lat: float) -> Negocio:
        return Negocio(
            nombre=nombre,
            slug=nombre.lower().replace(" ", "-"),
            categoria_id=polleria.id,
            distrito="Miraflores",
            direccion="Av. Larco 100",
            ubicacion=from_shape(Point(lng, lat), srid=4326),
        )

    # Parque Kennedy (Miraflores) y la Plaza de Armas de Lima, a unos 8 km.
    db.add_all([negocio("Cerca", -77.0300, -12.1215), negocio("Lejos", -77.0300, -12.0464)])
    db.commit()

    yo = func.ST_GeogFromText("SRID=4326;POINT(-77.0310 -12.1220)")
    cerca = db.scalars(select(Negocio.nombre).where(func.ST_DWithin(Negocio.ubicacion, yo, 1000))).all()
    assert cerca == ["Cerca"]
