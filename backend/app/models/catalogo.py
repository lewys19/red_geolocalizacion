from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, Integer, SmallInteger, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Producto(Base):
    """Lo que vende el negocio, con su precio en céntimos (1850 = S/ 18.50)."""

    __tablename__ = "productos"
    __table_args__ = (CheckConstraint("precio_centimos >= 0", name="precio_no_negativo"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id", ondelete="CASCADE"), index=True)
    nombre: Mapped[str] = mapped_column(String(120))
    descripcion: Mapped[str | None] = mapped_column(String(300))
    precio_centimos: Mapped[int | None] = mapped_column(Integer)  # None = "consultar"
    disponible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    orden: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Foto(Base):
    __tablename__ = "fotos"

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id", ondelete="CASCADE"), index=True)
    clave: Mapped[str] = mapped_column(String(200), unique=True)  # ruta dentro del almacén
    ancho: Mapped[int] = mapped_column(SmallInteger)
    alto: Mapped[int] = mapped_column(SmallInteger)
    orden: Mapped[int] = mapped_column(SmallInteger, default=0, server_default="0")
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
