from fastapi import APIRouter, Response, status

from app.api.deps import Db
from app.schemas.auth import LoginIn, RefrescoIn, RegistroIn, SesionOut
from app.services import auth

router = APIRouter(prefix="/auth", tags=["Cuenta"])


@router.post("/registro", response_model=SesionOut, status_code=status.HTTP_201_CREATED)
def registro(datos: RegistroIn, db: Db) -> SesionOut:
    return auth.registrar(db, datos)


@router.post("/login", response_model=SesionOut)
def login(datos: LoginIn, db: Db) -> SesionOut:
    return auth.ingresar(db, datos)


@router.post("/refresco", response_model=SesionOut)
def refresco(datos: RefrescoIn, db: Db) -> SesionOut:
    return auth.refrescar(db, datos.token_refresco)


@router.post("/salir", status_code=status.HTTP_204_NO_CONTENT)
def salir(datos: RefrescoIn, db: Db) -> Response:
    auth.salir(db, datos.token_refresco)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
