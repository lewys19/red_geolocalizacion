from dataclasses import dataclass
from datetime import UTC, datetime, time

from app.services.horarios import estado_atencion


@dataclass
class T:
    dia_semana: int
    abre: time
    cierra: time


def lima(dia: int, hora: str) -> datetime:
    """Un momento en hora de Lima (UTC-5). dia: 0 = lunes. Semana del lunes 2026-10-19."""
    h, m = map(int, hora.split(":"))
    return datetime(2026, 10, 19 + dia, h + 5, m, tzinfo=UTC) if h + 5 < 24 else datetime(
        2026, 10, 20 + dia, h + 5 - 24, m, tzinfo=UTC
    )


def test_sin_horarios_no_se_sabe() -> None:
    assert estado_atencion([], lima(0, "12:00")) is None


def test_tramo_normal() -> None:
    tramos = [T(0, time(12), time(23))]
    assert estado_atencion(tramos, lima(0, "12:00")).abierto is True
    assert estado_atencion(tramos, lima(0, "22:59")).cierra_a == time(23)
    assert estado_atencion(tramos, lima(0, "23:00")).abierto is False
    assert estado_atencion(tramos, lima(1, "13:00")).abierto is False  # martes no atiende


def test_dos_tramos_el_mismo_dia() -> None:
    tramos = [T(4, time(12), time(16)), T(4, time(19), time(23))]
    assert estado_atencion(tramos, lima(4, "17:30")).abierto is False
    assert estado_atencion(tramos, lima(4, "20:00")).cierra_a == time(23)


def test_tramo_que_cruza_la_medianoche() -> None:
    tramos = [T(4, time(18), time(2))]  # viernes 18:00 a sábado 02:00
    assert estado_atencion(tramos, lima(4, "23:30")).abierto is True
    assert estado_atencion(tramos, lima(5, "01:30")).abierto is True
    assert estado_atencion(tramos, lima(5, "02:00")).abierto is False
    assert estado_atencion(tramos, lima(5, "19:00")).abierto is False  # el sábado no abre
