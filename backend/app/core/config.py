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


# Instancia única que importaremos en el resto del proyecto.
settings = Settings()
