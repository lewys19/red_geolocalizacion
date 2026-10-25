from pydantic import BaseModel, ConfigDict

from app.models import RolMiembro, RolPlataforma


class UsuarioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    nombre: str
    rol: RolPlataforma


class MembresiaOut(BaseModel):
    negocio_id: int
    negocio_nombre: str
    rol: RolMiembro


class YoOut(UsuarioOut):
    negocios: list[MembresiaOut]
    # Niveles que la web usa para mostrar u ocultar menús (los permisos los decide la API).
    es_negocio: bool
    es_operador: bool
    es_superadmin: bool


class CambioRolIn(BaseModel):
    rol: RolPlataforma
