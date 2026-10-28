"""Panel administrativo. Cada ruta pide un permiso (app.core.permisos); el Administrador los tiene todos."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Response, status

from app.almacen import Almacen, obtener_almacen
from app.api.deps import (
    Db,
    EditarUsuarios,
    EliminarUsuarios,
    GestionarCategorias,
    GestionarRoles,
    MiembroPanel,
    ModerarNegocios,
    VerNegocios,
    VerUsuarios,
)
from app.models import EstadoNegocio
from app.schemas.admin import (
    AsignarRolIn,
    PaginaUsuarios,
    PermisoOut,
    ResumenOut,
    RolPanelIn,
    RolPanelOut,
    UsuarioAdminOut,
)
from app.schemas.categoria import CategoriaAdminOut, CategoriaIn
from app.schemas.negocio import NegocioOut, RechazoIn
from app.schemas.usuario import YoCambios
from app.services import categorias, negocios, panel

router = APIRouter(prefix="/admin", tags=["Administración"])

AlmacenDep = Annotated[Almacen, Depends(obtener_almacen)]


@router.get("/resumen", response_model=ResumenOut)
def resumen(_quien: MiembroPanel, db: Db) -> ResumenOut:
    return panel.resumen(db)


# ---------- Usuarios ----------


@router.get("/usuarios", response_model=PaginaUsuarios)
def listar_usuarios(
    _quien: VerUsuarios,
    db: Db,
    q: Annotated[str | None, Query(max_length=100, description="Nombre, correo, celular, username o código")] = None,
    pagina: Annotated[int, Query(ge=1)] = 1,
    por_pagina: Annotated[int, Query(ge=1, le=100)] = 10,
) -> PaginaUsuarios:
    return panel.listar_usuarios(db, q, pagina, por_pagina)


@router.get("/usuarios/exportar", response_class=Response)
def exportar_usuarios(
    _quien: VerUsuarios, db: Db, q: Annotated[str | None, Query(max_length=100)] = None
) -> Response:
    """Todos los que coinciden con la búsqueda, en CSV para Excel."""
    return Response(
        panel.exportar_usuarios(db, q),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="usuarios-altoque.csv"'},
    )


@router.get("/usuarios/{usuario_id}", response_model=UsuarioAdminOut)
def ver_usuario(usuario_id: int, _quien: VerUsuarios, db: Db, almacen: AlmacenDep) -> UsuarioAdminOut:
    return panel.detalle_usuario(db, almacen, usuario_id)


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioAdminOut)
def editar_usuario(
    usuario_id: int, cambios: YoCambios, _quien: EditarUsuarios, db: Db, almacen: AlmacenDep
) -> UsuarioAdminOut:
    return panel.editar_usuario(db, almacen, usuario_id, cambios)


@router.delete("/usuarios/{usuario_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_usuario(usuario_id: int, quien: EliminarUsuarios, db: Db) -> Response:
    """Borrado lógico: se anonimiza y pierde el acceso, igual que si la persona borrara su cuenta."""
    panel.eliminar_usuario(db, quien, usuario_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.put("/usuarios/{usuario_id}/rol-panel", response_model=UsuarioAdminOut)
def asignar_rol(
    usuario_id: int, datos: AsignarRolIn, quien: GestionarRoles, db: Db, almacen: AlmacenDep
) -> UsuarioAdminOut:
    return panel.asignar_rol(db, almacen, quien, usuario_id, datos.rol_panel_id)


# ---------- Roles ----------


@router.get("/permisos", response_model=list[PermisoOut])
def listar_permisos(_quien: MiembroPanel) -> list[PermisoOut]:
    return panel.permisos()


@router.get("/roles", response_model=list[RolPanelOut])
def listar_roles(_quien: MiembroPanel, db: Db) -> list[RolPanelOut]:
    return panel.listar_roles(db)


@router.post("/roles", response_model=RolPanelOut, status_code=status.HTTP_201_CREATED)
def crear_rol(datos: RolPanelIn, _quien: GestionarRoles, db: Db) -> RolPanelOut:
    return panel.crear_rol(db, datos)


@router.put("/roles/{rol_id}", response_model=RolPanelOut)
def editar_rol(rol_id: int, datos: RolPanelIn, _quien: GestionarRoles, db: Db) -> RolPanelOut:
    return panel.editar_rol(db, rol_id, datos)


@router.delete("/roles/{rol_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_rol(rol_id: int, _quien: GestionarRoles, db: Db) -> Response:
    panel.eliminar_rol(db, rol_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- Negocios ----------


@router.get("/negocios", response_model=list[NegocioOut])
def cola(_quien: VerNegocios, db: Db, estado: EstadoNegocio = EstadoNegocio.PENDIENTE) -> list[NegocioOut]:
    """Negocios por estado; por defecto, los que esperan aprobación (el más antiguo primero)."""
    return negocios.listar_por_estado(db, estado)


@router.post("/negocios/{negocio_id}/aprobar", response_model=NegocioOut)
def aprobar(negocio_id: int, _quien: ModerarNegocios, db: Db) -> NegocioOut:
    return negocios.decidir(db, negocio_id, aprobar=True)


@router.post("/negocios/{negocio_id}/rechazar", response_model=NegocioOut)
def rechazar(negocio_id: int, datos: RechazoIn, _quien: ModerarNegocios, db: Db) -> NegocioOut:
    """El motivo lo ve el dueño, para que corrija y vuelva a enviar."""
    return negocios.decidir(db, negocio_id, aprobar=False, motivo=datos.motivo)


# ---------- Categorías ----------


@router.get("/categorias", response_model=list[CategoriaAdminOut])
def listar_categorias(_quien: MiembroPanel, db: Db) -> list[CategoriaAdminOut]:
    return categorias.listar_admin(db)


@router.post("/categorias", response_model=CategoriaAdminOut, status_code=status.HTTP_201_CREATED)
def crear_categoria(datos: CategoriaIn, _quien: GestionarCategorias, db: Db) -> CategoriaAdminOut:
    """Aparece al instante en la web: sección Categorías, filtros del mapa y formulario de negocio."""
    return categorias.crear(db, datos)


@router.put("/categorias/{categoria_id}", response_model=CategoriaAdminOut)
def editar_categoria(categoria_id: int, datos: CategoriaIn, _quien: GestionarCategorias, db: Db) -> CategoriaAdminOut:
    return categorias.editar(db, categoria_id, datos)


@router.delete("/categorias/{categoria_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_categoria(categoria_id: int, _quien: GestionarCategorias, db: Db) -> Response:
    """Solo si no tiene negocios ni subcategorías."""
    categorias.eliminar(db, categoria_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
