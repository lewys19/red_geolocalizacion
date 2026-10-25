"""¿Está abierto ahora? Se calcula en hora de Lima.

Un tramo con `cierra` menor o igual que `abre` cruza la medianoche
(18:00-02:00 del viernes abre el viernes y cierra el sábado de madrugada).
"""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import datetime, time
from typing import Protocol
from zoneinfo import ZoneInfo

from app.core.config import settings


class Tramo(Protocol):
    dia_semana: int
    abre: time
    cierra: time


@dataclass(frozen=True)
class EstadoAtencion:
    abierto: bool
    cierra_a: time | None  # solo si está abierto


def estado_atencion(tramos: Iterable[Tramo], momento: datetime) -> EstadoAtencion | None:
    """None si el negocio no cargó horarios (no se sabe)."""
    tramos = list(tramos)
    if not tramos:
        return None
    local = momento.astimezone(ZoneInfo(settings.ZONA_HORARIA))
    hoy, ayer, ahora = local.weekday(), (local.weekday() - 1) % 7, local.time()
    for t in tramos:
        if t.abre < t.cierra:
            if t.dia_semana == hoy and t.abre <= ahora < t.cierra:
                return EstadoAtencion(True, t.cierra)
        else:  # cruza la medianoche
            if (t.dia_semana == hoy and ahora >= t.abre) or (t.dia_semana == ayer and ahora < t.cierra):
                return EstadoAtencion(True, t.cierra)
    return EstadoAtencion(False, None)
