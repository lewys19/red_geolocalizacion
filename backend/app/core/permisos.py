"""Permisos del panel administrativo.

La lista es fija (la define el código); los roles sí se crean desde el panel y
eligen cuáles de estos permisos tienen. El administrador (superadmin) los tiene todos.
"""

PERMISOS: dict[str, str] = {
    "usuarios.ver": "Ver usuarios",
    "usuarios.editar": "Editar nombre y celular de usuarios",
    "usuarios.eliminar": "Eliminar cuentas de usuarios",
    "negocios.ver": "Ver negocios",
    "negocios.moderar": "Aprobar o rechazar negocios",
    "categorias.gestionar": "Crear, editar y eliminar categorías",
    "publicaciones.moderar": "Borrar comentarios de cualquier publicación",
    "roles.gestionar": "Crear roles y asignarlos a usuarios",
}
