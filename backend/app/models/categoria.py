from sqlalchemy import ForeignKey, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class Categoria(Base):
    """Árbol de dos niveles: Comida → Pollerías."""

    __tablename__ = "categorias"

    id: Mapped[int] = mapped_column(primary_key=True)
    nombre: Mapped[str] = mapped_column(String(60))
    slug: Mapped[str] = mapped_column(String(70), unique=True)
    icono: Mapped[str | None] = mapped_column(String(40))
    padre_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id", ondelete="RESTRICT"))
    orden: Mapped[int] = mapped_column(SmallInteger, default=0)
