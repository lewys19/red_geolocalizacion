"""Valores fijos que se guardan como tipos ENUM de PostgreSQL."""

from enum import StrEnum

from sqlalchemy import Enum


class RolPlataforma(StrEnum):
    """Rol de la persona en Altoque. "Negocio" no es un rol aquí: sale de ser miembro de un negocio."""

    CLIENTE = "cliente"
    # El equipo de Altoque entra al panel por su rol de panel (models.panel), no por aquí.
    # "operador" sigue en el tipo de la base (0001) pero ya no se usa desde la migración 0008.
    SUPERADMIN = "superadmin"


class EstadoNegocio(StrEnum):
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    SUSPENDIDO = "suspendido"


def tipo_enum(clase: type[StrEnum], nombre: str) -> Enum:
    """Guarda el valor ("cliente"), no el nombre del miembro ("CLIENTE")."""
    return Enum(clase, name=nombre, values_callable=lambda e: [m.value for m in e])
