from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Anuncio(Base):
    """Banner publicitario de la columna derecha del Inicio. Hay 3 espacios (posición 1, 2 y 3)."""

    __tablename__ = "anuncios"
    __table_args__ = (CheckConstraint("posicion BETWEEN 1 AND 3", name="posicion_valida"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    posicion: Mapped[int] = mapped_column(SmallInteger, unique=True)
    titulo: Mapped[str | None] = mapped_column(String(120))  # texto alternativo de la imagen
    enlace: Mapped[str | None] = mapped_column(String(300))  # a dónde lleva al hacer clic (opcional)
    imagen_clave: Mapped[str | None] = mapped_column(String(200))
    # Solo los activos y con imagen se muestran: así se usan los 3 o solo 1.
    activo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Sugerencia(Base):
    """Nota que cualquiera envía desde el Inicio; el equipo la lee en el panel. Cada envío es una fila."""

    __tablename__ = "sugerencias"

    id: Mapped[int] = mapped_column(primary_key=True)
    texto: Mapped[str] = mapped_column(Text)
    # Quién la envió, si había iniciado sesión. Si borra su cuenta, la sugerencia queda (anónima).
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"), index=True)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
