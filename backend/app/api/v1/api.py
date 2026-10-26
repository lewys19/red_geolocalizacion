"""Router principal de la versión v1: une todos los endpoints."""

from fastapi import APIRouter

from app.api.v1.endpoints import admin, auth, categorias, geocoding, mapa, negocios, publicaciones, social, yo

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(yo.router)
api_router.include_router(categorias.router)
api_router.include_router(mapa.router)
api_router.include_router(geocoding.router)
# Antes que negocios: /negocios/lista y /negocios/ficha/{slug}/publicaciones son rutas fijas.
api_router.include_router(publicaciones.router)
api_router.include_router(social.router)
api_router.include_router(negocios.router)
api_router.include_router(admin.router)
