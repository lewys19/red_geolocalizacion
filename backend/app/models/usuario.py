from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import RolPlataforma, tipo_enum


class Usuario(Base):
    __tablename__ = "usuarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(254), unique=True)
    nombre: Mapped[str] = mapped_column(String(80))
    # Celular peruano normalizado (9 dígitos, empieza con 9): también sirve para ingresar.
    telefono: Mapped[str | None] = mapped_column(String(20), unique=True)
    hash_contrasena: Mapped[str] = mapped_column(String(255))
    rol: Mapped[RolPlataforma] = mapped_column(
        tipo_enum(RolPlataforma, "rol_plataforma"), default=RolPlataforma.CLIENTE
    )
    # Ley 29733: consentimiento expreso para tratar sus datos.
    acepto_terminos_en: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Borrado lógico: la cuenta se anonimiza y no puede volver a entrar.
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    membresias: Mapped[list["MiembroNegocio"]] = relationship(back_populates="usuario")  # noqa: F821


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
