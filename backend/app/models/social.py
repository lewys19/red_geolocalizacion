"""Comunidad: seguidores de los negocios, reacciones y comentarios en sus publicaciones."""

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

# Las 3 reacciones. Cambiarlas = esta lista + la migración (restricción) + la web (lib/reacciones.ts).
TIPOS_REACCION = ("me_gusta", "me_encanta", "wow")


class Seguidor(Base):
    __tablename__ = "seguidores"

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    negocio_id: Mapped[int] = mapped_column(
        ForeignKey("negocios.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Reaccion(Base):
    """Una reacción por persona y publicación (cambiarla reemplaza la anterior)."""

    __tablename__ = "reacciones"
    __table_args__ = (CheckConstraint(f"tipo IN {TIPOS_REACCION}", name="tipo"),)

    publicacion_id: Mapped[int] = mapped_column(
        ForeignKey("publicaciones.id", ondelete="CASCADE"), primary_key=True
    )
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True, index=True)
    tipo: Mapped[str] = mapped_column(String(12))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Comentario(Base):
    __tablename__ = "comentarios"

    id: Mapped[int] = mapped_column(primary_key=True)
    publicacion_id: Mapped[int] = mapped_column(ForeignKey("publicaciones.id", ondelete="CASCADE"), index=True)
    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), index=True)
    texto: Mapped[str] = mapped_column(String(1000))
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    autor: Mapped["Usuario"] = relationship()  # noqa: F821
