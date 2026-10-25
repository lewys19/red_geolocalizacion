from datetime import datetime

from geoalchemy2 import Geography, WKBElement
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Numeric, String, Text, false, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import EstadoNegocio, RolMiembro, tipo_enum


class Negocio(Base):
    __tablename__ = "negocios"
    # Índice espacial (GIST): es lo que hace instantánea la pregunta "qué hay en este recuadro".
    __table_args__ = (Index("ix_negocios_ubicacion", "ubicacion", postgresql_using="gist"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(120))
    slug: Mapped[str] = mapped_column(String(140), unique=True)
    descripcion: Mapped[str | None] = mapped_column(Text)
    categoria_id: Mapped[int] = mapped_column(ForeignKey("categorias.id", ondelete="RESTRICT"), index=True)
    distrito: Mapped[str] = mapped_column(String(60))
    direccion: Mapped[str] = mapped_column(String(200))
    referencia: Mapped[str | None] = mapped_column(String(200))
    # Punto exacto (longitud, latitud) en WGS84, el sistema del GPS. El pin del dueño manda.
    ubicacion: Mapped[WKBElement] = mapped_column(
        Geography(geometry_type="POINT", srid=4326, spatial_index=False)
    )
    telefono: Mapped[str | None] = mapped_column(String(20))
    whatsapp: Mapped[str | None] = mapped_column(String(20))
    tiene_delivery: Mapped[bool] = mapped_column(Boolean, default=False)
    # Datos de demostración (python -m app.cli sembrar-demo): se borran con borrar-demo.
    es_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    motivo_rechazo: Mapped[str | None] = mapped_column(String(300))
    estado: Mapped[EstadoNegocio] = mapped_column(
        tipo_enum(EstadoNegocio, "estado_negocio"), default=EstadoNegocio.PENDIENTE, index=True
    )
    # Se recalcula al aprobar una reseña, para no calcularla en cada búsqueda.
    calificacion_promedio: Mapped[float | None] = mapped_column(Numeric(2, 1))
    total_resenas: Mapped[int] = mapped_column(default=0)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    eliminado_en: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    categoria: Mapped["Categoria"] = relationship()  # noqa: F821
    miembros: Mapped[list["MiembroNegocio"]] = relationship(back_populates="negocio")
    horarios: Mapped[list["Horario"]] = relationship(  # noqa: F821
        back_populates="negocio", cascade="all, delete-orphan", order_by="(Horario.dia_semana, Horario.abre)"
    )


class MiembroNegocio(Base):
    """Quién puede editar cada negocio. Un usuario puede tener varios negocios."""

    __tablename__ = "miembros_negocio"

    usuario_id: Mapped[int] = mapped_column(ForeignKey("usuarios.id", ondelete="CASCADE"), primary_key=True)
    negocio_id: Mapped[int] = mapped_column(
        ForeignKey("negocios.id", ondelete="CASCADE"), primary_key=True, index=True
    )
    rol: Mapped[RolMiembro] = mapped_column(tipo_enum(RolMiembro, "rol_miembro"))

    usuario: Mapped["Usuario"] = relationship(back_populates="membresias")  # noqa: F821
    negocio: Mapped[Negocio] = relationship(back_populates="miembros")
