from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.core.permisos import PERMISOS
from app.models.enums import RolPlataforma, tipo_enum
from app.models.panel import RolPanel


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    # URL pública del perfil (altoque.pe/lewys). Solo visual: las relaciones van por id (ver core/usernames.py).
    username: Mapped[str] = mapped_column(String(30), unique=True)
    nombre: Mapped[str] = mapped_column(String(80))
    # Foto de perfil en el almacén de fotos.
    avatar_clave: Mapped[str | None] = mapped_column(String(200))
    # Celular peruano normalizado (9 dígitos, empieza con 9): también sirve para ingresar.
    telefono: Mapped[str | None] = mapped_column(String(20), unique=True)
    hash_contrasena: Mapped[str] = mapped_column(String(255))
    rol: Mapped[RolPlataforma] = mapped_column(
        tipo_enum(RolPlataforma, "rol_plataforma"), default=RolPlataforma.CLIENTE
    )
    # Acceso al panel administrativo. El superadmin (Administrador) entra sin rol de panel: lo puede todo.
    rol_panel_id: Mapped[int | None] = mapped_column(ForeignKey("roles_panel.id", ondelete="RESTRICT"), index=True)
    # Ley 29733: consentimiento expreso para tratar sus datos.
    acepto_terminos_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    # Borrado lógico: la cuenta se anonimiza y no puede volver a entrar.
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    negocios: Mapped[list["Negocio"]] = relationship(back_populates="dueno")  # noqa: F821
    rol_panel: Mapped[RolPanel | None] = relationship(lazy="joined")

    @property
    def en_panel(self) -> bool:
        return self.rol == RolPlataforma.SUPERADMIN or self.rol_panel_id is not None

    @property
    def permisos(self) -> list[str]:
        if self.rol == RolPlataforma.SUPERADMIN:
            return list(PERMISOS)
        return list(self.rol_panel.permisos) if self.rol_panel else []

    def puede(self, permiso: str) -> bool:
        return permiso in self.permisos


class TokenRefresco(Base):
    __tablename__ = "tokens_refresco"

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    huella: Mapped[str] = mapped_column(String(64), unique=True)
    expira_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revocado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CuentaExterna(Base):
    """Cuenta de Google o Microsoft (Hotmail/Outlook) enlazada a un usuario de Altoque."""

    __tablename__ = "cuentas_externas"
    __table_args__ = (UniqueConstraint("proveedor", "sujeto"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    proveedor: Mapped[str] = mapped_column(String(20))
    # Identificador que da el proveedor ("sub"): no cambia aunque la persona cambie de correo.
    sujeto: Mapped[str] = mapped_column(String(255))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
