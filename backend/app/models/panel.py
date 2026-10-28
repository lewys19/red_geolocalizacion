from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class RolPanel(Base):
    """Rol del panel administrativo (Subadministrador, Suscriptor…), creado por el administrador."""

    __tablename__ = "roles_panel"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(40), unique=True)
    descripcion: Mapped[str | None] = mapped_column(String(200))
    # Claves de app.core.permisos.PERMISOS.
    permisos: Mapped[list[str]] = mapped_column(ARRAY(String(40)), default=list)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
