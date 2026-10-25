"""Router principal de la versión v1: une todos los endpoints."""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, categorias, mapa, negocios, yo

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(yo.router)
api_router.include_router(categorias.router)
api_router.include_router(mapa.router)
api_router.include_router(negocios.router)
api_router.include_router(admin.router)
