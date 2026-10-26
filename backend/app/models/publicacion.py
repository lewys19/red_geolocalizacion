from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, SmallInteger, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Publicacion(Base):
    """Lo que un negocio publica en el muro: una oferta, una novedad, fotos de su carta."""

    __tablename__ = "publicaciones"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id", ondelete="CASCADE"), index=True)
    # Quién del negocio la escribió (si borra su cuenta, la publicación sigue siendo del negocio).
    autor_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id", ondelete="SET NULL"))
    texto: Mapped[str] = mapped_column(Text)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)

    fotos: Mapped[list["FotoPublicacion"]] = relationship(
        cascade="all, delete-orphan", order_by="FotoPublicacion.orden"
    )
    negocio: Mapped["Negocio"] = relationship()  # noqa: F821


class FotoPublicacion(Base):
    __tablename__ = "fotos_publicacion"

    id: Mapped[int] = mapped_column(primary_key=True)
    publicacion_id: Mapped[int] = mapped_column(ForeignKey("publicaciones.id", ondelete="CASCADE"), index=True)
    clave: Mapped[str] = mapped_column(String(200), unique=True)
    ancho: Mapped[int] = mapped_column(SmallInteger)
    alto: Mapped[int] = mapped_column(SmallInteger)
    orden: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
