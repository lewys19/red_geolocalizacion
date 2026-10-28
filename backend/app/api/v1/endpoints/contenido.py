from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import Db, UsuarioOpcional
from app.schemas.contenido import AnuncioOut, SugerenciaIn
from app.services import contenido

router = APIRouter(tags=["Inicio"])


@router.get("/anuncios", response_model=list[AnuncioOut])
def anuncios(db: Db, almacen: Annotated[Almacen, Depends(obtener_almacen)]) -> list[AnuncioOut]:
    """Banners activos de la columna derecha del Inicio (0 a 3), en orden."""
    return contenido.activos(db, almacen)


@router.post("/sugerencias", status_code=status.HTTP_204_NO_CONTENT)
def enviar_sugerencia(datos: SugerenciaIn, usuario: UsuarioOpcional, db: Db, request: Request) -> Response:
    """Cualquiera puede enviar (con sesión queda el autor). Máximo 5 por hora desde la misma dirección."""
    ip = request.client.host if request.client else "desconocida"
    contenido.enviar(db, usuario, datos.texto, ip)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
