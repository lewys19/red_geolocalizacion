"""Comandos de administración.

    python -m app.cli crear-superadmin --email tu@correo.com --nombre "Tu nombre"

Pide la contraseña sin mostrarla. Si el email ya existe, solo lo asciende a superadmin.
"""

import argparse
import getpass
import sys

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.fechas import ahora
from app.core.security import hash_contrasena
from app.models import RolPlataforma, Usuario


def crear_superadmin(email: str, nombre: str) -> None:
    email = email.strip().lower()
    with SessionLocal() as db:
        usuario = db.scalar(select(Usuario).where(Usuario.email == email))
        if usuario is None:
            contrasena = getpass.getpass("Contraseña (mínimo 8 caracteres): ")
            if len(contrasena) < 8:
                sys.exit("La contraseña es demasiado corta.")
            usuario = Usuario(
                email=email,
                nombre=nombre,
                hash_contrasena=hash_contrasena(contrasena),
                acepto_terminos_en=ahora(),
            )
            db.add(usuario)
        usuario.rol = RolPlataforma.SUPERADMIN
        db.commit()
        print(f"Listo: {email} es superadmin.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="comando", required=True)
    p = sub.add_parser("crear-superadmin", help="Crea el primer superadmin (o asciende una cuenta)")
    p.add_argument("--email", required=True)
    p.add_argument("--nombre", default="Superadmin")
    args = parser.parse_args()
    if args.comando == "crear-superadmin":
        crear_superadmin(args.email, args.nombre)


if __name__ == "__main__":
    main()
