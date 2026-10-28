"""Nombre de usuario: la URL pública del perfil (altoque.pe/lewys).

La URL es solo visual: las relaciones siempre van por usuarios.id, nunca por el username.
Como el perfil vive en la raíz del sitio, ningún username puede coincidir con una ruta de la web.
"""

import re
import unicodedata

MINIMO, MAXIMO = 3, 30
# Minúsculas, números y guiones; sin guion al inicio, al final ni dos seguidos.
FORMATO = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")

# Rutas actuales y futuras de la web (app/(sitio)/ y app/admin) y nombres que se prestan a engaño.
# Al agregar una página nueva en la raíz de la web, agregarla aquí (lo verifica tests/test_username.py).
RESERVADOS = frozenset(
    {
        # rutas de la web
        "admin", "api", "login", "ingresar", "registro", "register", "perfil", "cuenta", "mapa", "negocios",
        "categorias", "publicar", "mis-negocios", "n", "u", "media", "configuracion", "buscar", "inicio",
        # archivos y rutas técnicas
        "_next", "static", "public", "assets", "favicon", "robots", "sitemap", "manifest", "health", "salud",
        # cuentas que se hacen pasar por el equipo
        "altoque", "soporte", "ayuda", "administrador", "admins", "root", "sistema", "staff", "equipo", "oficial",
        "seguridad", "legal", "terminos", "privacidad", "contacto", "nosotros", "blog", "app", "www", "mail",
        "logout", "salir", "signup", "signin", "auth", "oauth", "settings", "user", "users", "usuario", "usuarios",
    }
)  # fmt: skip


def problema(username: str) -> str | None:
    """Por qué no sirve (texto para el usuario) o None si es válido. No revisa si ya está tomado."""
    if not MINIMO <= len(username) <= MAXIMO:
        return f"El nombre de usuario debe tener entre {MINIMO} y {MAXIMO} caracteres."
    if not FORMATO.match(username):
        return "Usa solo minúsculas, números y guiones (sin guion al inicio ni al final)."
    if username in RESERVADOS or username.startswith("eliminado-"):
        return "Nombre de usuario no disponible."
    return None


def de_cuenta_eliminada(usuario_id: int) -> str:
    """Al borrar una cuenta su username queda libre; este lo reemplaza y nadie más puede pedirlo."""
    return f"eliminado-{usuario_id}"


def base_desde(texto: str) -> str:
    """«Lewys Ramos» → «lewys-ramos»; «José Ñique» → «jose-nique». Siempre devuelve algo válido de formato."""
    plano = unicodedata.normalize("NFKD", texto).encode("ascii", "ignore").decode().lower()
    base = re.sub(r"[^a-z0-9]+", "-", plano).strip("-")[: MAXIMO - 4].strip("-")
    return base if len(base) >= MINIMO else f"usuario-{base}".strip("-")
