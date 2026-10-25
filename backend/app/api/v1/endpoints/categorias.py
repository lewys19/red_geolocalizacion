from fastapi import APIRouter

from app.api.deps import Db
from app.schemas.categoria import CategoriaOut
from app.services import categorias

router = APIRouter(prefix="/categorias", tags=["Mapa"])


@router.get("", response_model=list[CategoriaOut])
def listar(db: Db) -> list[CategoriaOut]:
    return categorias.arbol(db)
