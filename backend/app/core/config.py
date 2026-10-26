"""Configuración central de la aplicación.

Lee las variables desde un archivo .env (si existe) o desde el entorno.
Así los valores sensibles no van en el código.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    PROJECT_NAME: str = "Altoque API"
    DATABASE_URL: str = "postgresql+psycopg://altoque:altoque@localhost:5433/altoque"
    REDIS_URL: str = "redis://localhost:6380/0"

    # Sesión. Obligatorio: una frase larga y aleatoria. Genera una con:
    #   python -c "import secrets; print(secrets.token_urlsafe(48))"
    SECRET_KEY: str = ""
    MINUTOS_TOKEN_ACCESO: int = 30
    DIAS_TOKEN_REFRESCO: int = 30

    # Orígenes del frontend que pueden llamar a la API (separados por coma).
    # La web pasa por el mismo dominio; esto es para la app móvil y herramientas.
    CORS_ORIGINS: str = "http://localhost:3100"

    ZONA_HORARIA: str = "America/Lima"

    # Mapa: hasta este número de negocios en pantalla se muestran uno por uno;
    # con más, se agrupan en burbujas con el conteo.
    LIMITE_PUNTOS_MAPA: int = 150
    # Recuadro máximo que se puede pedir (en grados, ~110 km por grado): evita consultas de todo el país.
    MAX_LADO_RECUADRO: float = 1.0
    # Búsqueda por radio alrededor de quien busca: máximo 50 km; se devuelven los más cercanos.
    MAX_RADIO_M: int = 50_000
    LIMITE_CERCANOS: int = 100
    MAX_PENDIENTES_POR_USUARIO: int = 5

    # Geocodificación (dirección ↔ coordenadas). "nominatim" (OpenStreetMap, gratis) o "ninguno".
    # Nominatim exige identificar la app con un contacto real y máximo 1 petición por segundo:
    # https://operations.osmfoundation.org/policies/nominatim/
    GEOCODING_PROVEEDOR: str = "nominatim"
    NOMINATIM_URL: str = "https://nominatim.openstreetmap.org"
    GEOCODING_CONTACTO: str = ""  # email o web de contacto que va en el User-Agent
    DIAS_CACHE_GEOCODING: int = 30

    # Fotos: "local" (disco del servidor, servidas en /media) o, más adelante, "r2" (Cloudflare R2).
    ALMACEN_FOTOS: str = "local"
    CARPETA_MEDIA: str = "./media"
    MAX_MB_FOTO: int = 8
    MAX_FOTOS_POR_NEGOCIO: int = 10
    MAX_PRODUCTOS_POR_NEGOCIO: int = 200


# Instancia única que importaremos en el resto del proyecto.
settings = Settings()
