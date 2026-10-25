"""Fechas: todo se guarda en UTC; se muestra en hora de Lima."""

from datetime import UTC, datetime


def ahora() -> datetime:
    return datetime.now(UTC)
