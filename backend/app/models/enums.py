"""Valores fijos que se guardan como tipos ENUM de PostgreSQL."""

from enum import StrEnum

from sqlalchemy import Enum


class RolPlataforma(StrEnum):
    """Rol de la persona en Altoque. "Negocio" no es un rol aquí: sale de ser miembro de un negocio."""

    CLIENTE = "cliente"
    OPERADOR = "operador"
    SUPERADMIN = "superadmin"


class EstadoNegocio(StrEnum):
    PENDIENTE = "pendiente"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"
    SUSPENDIDO = "suspendido"


class RolMiembro(StrEnum):
    PROPIETARIO = "propietario"  # todo, incluso sumar o quitar miembros
    EDITOR = "editor"  # catálogo y promociones


def tipo_enum(clase: type[StrEnum], nombre: str) -> Enum:
    """Guarda el valor ("cliente"), no el nombre del miembro ("CLIENTE")."""
    return Enum(clase, name=nombre, values_callable=lambda e: [m.value for m in e])
