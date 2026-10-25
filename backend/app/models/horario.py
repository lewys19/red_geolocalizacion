from datetime import time

from sqlalchemy import CheckConstraint, ForeignKey, SmallInteger, Time
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Horario(Base):
    """Un tramo de atención. Un día puede tener varios (12:00-16:00 y 19:00-23:00).

    Si `cierra` es menor que `abre`, el tramo cruza la medianoche (18:00-02:00).
    """

    __tablename__ = "horarios"
    __table_args__ = (CheckConstraint("dia_semana BETWEEN 0 AND 6", name="dia_valido"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    negocio_id: Mapped[int] = mapped_column(ForeignKey("negocios.id", ondelete="CASCADE"), index=True)
    dia_semana: Mapped[int] = mapped_column(SmallInteger)  # 0 = lunes … 6 = domingo
    abre: Mapped[time] = mapped_column(Time)
    cierra: Mapped[time] = mapped_column(Time)

    negocio: Mapped["Negocio"] = relationship(back_populates="horarios")  # noqa: F821
