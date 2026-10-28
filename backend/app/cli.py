"""Comandos de administración.

    python -m app.cli crear-superadmin --email tu@correo.com --nombre "Tu nombre"
        Pide la contraseña sin mostrarla. Si el email ya existe, solo lo asciende a superadmin.

    python -m app.cli sembrar-demo [--cantidad 120]
    python -m app.cli borrar-demo
        Negocios inventados para probar el mapa en desarrollo. Quedan marcados (es_demo)
        y se borran con un comando. Nunca usarlos en producción.
"""

import argparse
import getpass
import random
import sys
from datetime import time

from sqlalchemy import delete, select

from app.core.database import SessionLocal
from app.core.fechas import ahora
from app.core.geo import punto
from app.core.security import HASH_SEÑUELO, hash_contrasena
from app.models import (
    Categoria,
    EstadoNegocio,
    Horario,
    Negocio,
    RolPlataforma,
    Usuario,
)
from app.services.negocios import slug_unico
from app.services.usuarios import username_libre

EMAIL_DEMO = "demo@altoque.invalid"

# (distrito, lng, lat del centro, radio en grados ~ 1 km = 0.009)
ZONAS_DEMO = [
    ("Miraflores", -77.0300, -12.1215, 0.012),
    ("San Isidro", -77.0365, -12.0970, 0.010),
    ("Santiago de Surco", -76.9940, -12.1390, 0.015),
    ("Lince", -77.0360, -12.0840, 0.006),
    ("Lima", -77.0300, -12.0500, 0.010),
    ("Jesús María", -77.0470, -12.0760, 0.007),
    ("Barranco", -77.0210, -12.1490, 0.006),
    ("San Juan de Lurigancho", -77.0050, -11.9850, 0.020),
    ("Los Olivos", -77.0700, -11.9700, 0.015),
]

NOMBRES_DEMO = {
    "pollerias": ["Pollería El Buen Sabor", "Pardos del Barrio", "La Granja Brasa", "Pollos Don Lucho", "El Carbón Dorado"],
    "chifas": ["Chifa Dragón Rojo", "Chifa Kam Lung", "Chifa Hong Kong", "Chifa Mi Barrio"],
    "cevicherias": ["Cevichería El Muelle", "Al Toque Marino", "La Red de Pepe", "Mar Bravo"],
    "comida-criolla": ["Sazón Criolla", "La Tía Veneno", "El Rincón Limeño"],
    "hamburguesas-y-sanguches": ["Sanguchería La 28", "Burger Lima", "El Chicharrón de Oro"],
    "pizzerias": ["Pizzería Napoli", "La Leña Pizzas", "Pizza al Paso"],
    "cafes-y-panaderias": ["Panadería San Antonio", "Café de la Esquina", "Pan del Barrio"],
    "juguerias": ["Juguería Frutal", "Jugos Rosita"],
    "bodegas": ["Bodega Don Pepe", "Minimarket La Económica", "Bodega El Ahorro"],
    "farmacias": ["Botica Salud Total", "Farmacia Vida", "Botica del Pueblo"],
    "ferreterias": ["Ferretería El Clavo", "Ferretería Unión"],
    "peluquerias": ["Barbería Clásica", "Salón Bella", "Peluquería Estilo"],
    "talleres": ["Taller Mecánico Rápido", "Taller El Pistón"],
    "lavanderias": ["Lavandería Espuma", "Lava Express"],
    "veterinarias": ["Veterinaria Patitas", "Vet Huellitas"],
}


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
                username=username_libre(db, nombre),
                nombre=nombre,
                hash_contrasena=hash_contrasena(contrasena),
                acepto_terminos_en=ahora(),
            )
            db.add(usuario)
        usuario.rol = RolPlataforma.SUPERADMIN
        db.commit()
        print(f"Listo: {email} es superadmin.")


def sembrar_demo(cantidad: int) -> None:
    azar = random.Random(25)  # siempre los mismos negocios
    with SessionLocal() as db:
        demo = db.scalar(select(Usuario).where(Usuario.email == EMAIL_DEMO))
        if demo is None:
            demo = Usuario(
                email=EMAIL_DEMO,
                username=username_libre(db, "demo"),
                nombre="Demo",
                hash_contrasena=HASH_SEÑUELO,
                acepto_terminos_en=ahora(),
            )
            db.add(demo)
            db.flush()
        categorias = {c.slug: c.id for c in db.scalars(select(Categoria))}
        for _ in range(cantidad):
            slug_cat = azar.choice(list(NOMBRES_DEMO))
            distrito, lng, lat, radio = azar.choice(ZONAS_DEMO)
            nombre = azar.choice(NOMBRES_DEMO[slug_cat])
            abre, cierra = azar.choice([(time(8), time(20)), (time(12), time(23)), (time(18), time(2)), (time(9), time(18))])
            negocio = Negocio(
                usuario_id=demo.id,
                nombre=nombre,
                slug=slug_unico(db, nombre, distrito),
                categoria_id=categorias[slug_cat],
                distrito=distrito,
                direccion=f"Av. Demo {azar.randint(100, 2999)}",
                referencia="Negocio de demostración",
                ubicacion=punto(lng + azar.uniform(-radio, radio), lat + azar.uniform(-radio, radio)),
                whatsapp=f"519{azar.randint(10000000, 99999999)}",
                tiene_delivery=azar.random() < 0.6,
                estado=EstadoNegocio.APROBADO,
                es_demo=True,
                horarios=[Horario(dia_semana=d, abre=abre, cierra=cierra) for d in range(7) if azar.random() < 0.9],
            )
            db.add(negocio)
        db.commit()
    print(f"Listo: {cantidad} negocios de demostración en Lima.")


def borrar_demo() -> None:
    with SessionLocal() as db:
        borrados = db.execute(delete(Negocio).where(Negocio.es_demo.is_(True))).rowcount
        db.execute(delete(Usuario).where(Usuario.email == EMAIL_DEMO))
        db.commit()
    print(f"Listo: {borrados} negocios de demostración borrados.")


def main() -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    sub = parser.add_subparsers(dest="comando", required=True)
    p = sub.add_parser("crear-superadmin", help="Crea el primer superadmin (o asciende una cuenta)")
    p.add_argument("--email", required=True)
    p.add_argument("--nombre", default="Superadmin")
    p = sub.add_parser("sembrar-demo", help="Negocios inventados para probar el mapa (solo desarrollo)")
    p.add_argument("--cantidad", type=int, default=120)
    sub.add_parser("borrar-demo", help="Borra los negocios de demostración")
    args = parser.parse_args()
    if args.comando == "crear-superadmin":
        crear_superadmin(args.email, args.nombre)
    elif args.comando == "sembrar-demo":
        sembrar_demo(args.cantidad)
    elif args.comando == "borrar-demo":
        borrar_demo()


if __name__ == "__main__":
    main()
