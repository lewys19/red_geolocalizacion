"""Panel administrativo: resumen, usuarios (tabla paginada, ficha, edición) y roles con permisos."""

import csv
import io
from datetime import timedelta

from fastapi import status
from sqlalchemy import Select, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.almacen import Almacen
from app.core.errores import ErrorNegocio
from app.core.fechas import ahora
from app.core.permisos import PERMISOS
from app.models import Categoria, EstadoNegocio, Negocio, RolPanel, RolPlataforma, Usuario
from app.schemas.admin import (
    ConteoCategoria,
    NegocioAdminOut,
    PaginaUsuarios,
    PermisoOut,
    ResumenOut,
    RolCorto,
    RolPanelIn,
    RolPanelOut,
    UsuarioAdminOut,
    UsuarioFilaOut,
)
from app.schemas.usuario import YoCambios
from app.services import auth, usuarios
from app.services.catalogo import foto_out
from app.services.negocios import a_salida


def resumen(db: Session) -> ResumenOut:
    vivos = select(func.count()).select_from(Usuario).where(Usuario.eliminado_en.is_(None))
    negocio_vivo = Negocio.eliminado_en.is_(None)
    usuarios = db.scalar(vivos) or 0
    # "Con negocio" se calcula, no se guarda: dueños distintos de negocios no eliminados.
    con_negocio = db.scalar(
        select(func.count(func.distinct(Negocio.usuario_id)))
        .join(Usuario, Usuario.id == Negocio.usuario_id)
        .where(negocio_vivo, Usuario.eliminado_en.is_(None))
    ) or 0
    conteos = dict(db.execute(select(Negocio.estado, func.count()).where(negocio_vivo).group_by(Negocio.estado)).all())
    por_categoria = db.execute(
        select(Categoria.nombre, func.count(Negocio.id))
        .join(Negocio, (Negocio.categoria_id == Categoria.id) & negocio_vivo)
        .group_by(Categoria.id, Categoria.nombre)
        .order_by(func.count(Negocio.id).desc(), Categoria.nombre)
    ).all()
    return ResumenOut(
        usuarios=usuarios,
        usuarios_nuevos_7d=db.scalar(vivos.where(Usuario.creado_en >= ahora() - timedelta(days=7))) or 0,
        usuarios_con_negocio=con_negocio,
        usuarios_sin_negocio=usuarios - con_negocio,
        negocios=sum(conteos.values()),
        negocios_por_estado={estado.value: conteos.get(estado, 0) for estado in EstadoNegocio},
        categorias=db.scalar(select(func.count()).select_from(Categoria)) or 0,
        por_categoria=[ConteoCategoria(categoria=nombre, negocios=n) for nombre, n in por_categoria],
        equipo=db.scalar(
            vivos.where(or_(Usuario.rol == RolPlataforma.SUPERADMIN, Usuario.rol_panel_id.is_not(None)))
        )
        or 0,
    )


# ---------- Usuarios ----------


def _id_de_codigo(texto: str) -> int | None:
    """«u00000012» o «12» → 12 (el código que muestra la web es u + id en 8 cifras)."""
    t = texto.strip().lower().removeprefix("u")
    return int(t) if t.isdigit() and len(t) <= 9 else None


def _consulta_usuarios(q: str | None) -> Select[tuple[Usuario]]:
    consulta = select(Usuario).where(Usuario.eliminado_en.is_(None))
    if q and q.strip():
        patron = f"%{q.strip()}%"
        condiciones = [
            Usuario.nombre.ilike(patron),
            Usuario.email.ilike(patron),
            Usuario.telefono.ilike(patron),
            Usuario.username.ilike(f"%{q.strip().lower().removeprefix('@')}%"),
        ]
        if (usuario_id := _id_de_codigo(q)) is not None:
            condiciones.append(Usuario.id == usuario_id)
        consulta = consulta.where(or_(*condiciones))
    return consulta


def _conteo_negocios(db: Session, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    return dict(
        db.execute(
            select(Negocio.usuario_id, func.count())
            .where(Negocio.usuario_id.in_(ids), Negocio.eliminado_en.is_(None))
            .group_by(Negocio.usuario_id)
        ).all()
    )


def _fila(u: Usuario, negocios: int) -> UsuarioFilaOut:
    return UsuarioFilaOut(
        id=u.id, email=u.email, username=u.username, nombre=u.nombre, telefono=u.telefono, rol=u.rol,
        rol_panel=RolCorto.model_validate(u.rol_panel) if u.rol_panel else None,
        creado_en=u.creado_en, negocios=negocios,
    )  # fmt: skip


def listar_usuarios(db: Session, q: str | None, pagina: int, por_pagina: int) -> PaginaUsuarios:
    """Búsqueda por nombre, correo, celular, username o código; el más nuevo primero."""
    consulta = _consulta_usuarios(q)
    total = db.scalar(select(func.count()).select_from(consulta.subquery())) or 0
    usuarios = db.scalars(
        consulta.order_by(Usuario.creado_en.desc(), Usuario.id.desc())
        .offset((pagina - 1) * por_pagina)
        .limit(por_pagina)
    ).all()
    conteos = _conteo_negocios(db, [u.id for u in usuarios])
    return PaginaUsuarios(
        total=total,
        pagina=pagina,
        por_pagina=por_pagina,
        usuarios=[_fila(u, conteos.get(u.id, 0)) for u in usuarios],
    )


def exportar_usuarios(db: Session, q: str | None) -> str:
    """CSV (con BOM para que Excel respete las tildes) de todos los usuarios que coinciden con la búsqueda."""
    usuarios = db.scalars(_consulta_usuarios(q).order_by(Usuario.creado_en.desc(), Usuario.id.desc())).all()
    conteos = _conteo_negocios(db, [u.id for u in usuarios])
    salida = io.StringIO()
    salida.write("﻿")
    escritor = csv.writer(salida)
    escritor.writerow(["Código", "Username", "Nombre", "Correo", "Celular", "Rol en el panel", "Registro", "Negocios"])
    for u in usuarios:
        rol = "Administrador" if u.rol == RolPlataforma.SUPERADMIN else (u.rol_panel.nombre if u.rol_panel else "")
        escritor.writerow(
            [f"u{u.id:08d}", u.username, u.nombre, u.email, u.telefono or "", rol, u.creado_en.date().isoformat(),
             conteos.get(u.id, 0)]
        )  # fmt: skip
    return salida.getvalue()


def _usuario_vivo(db: Session, usuario_id: int) -> Usuario:
    usuario = db.get(Usuario, usuario_id)
    if usuario is None or usuario.eliminado_en is not None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Usuario no encontrado.")
    return usuario


def detalle_usuario(db: Session, almacen: Almacen, usuario_id: int) -> UsuarioAdminOut:
    """El usuario con sus negocios completos (datos, imágenes y galería)."""
    u = _usuario_vivo(db, usuario_id)
    propios = db.scalars(
        select(Negocio)
        .options(selectinload(Negocio.categoria), selectinload(Negocio.horarios), selectinload(Negocio.fotos))
        .where(Negocio.usuario_id == u.id, Negocio.eliminado_en.is_(None))
        .order_by(Negocio.creado_en.desc())
    ).all()
    negocios = [
        NegocioAdminOut(
            **a_salida(n).model_dump(),
            logo=almacen.url(n.logo_clave) if n.logo_clave else None,
            portada=almacen.url(n.portada_clave) if n.portada_clave else None,
            fotos=[foto_out(f, almacen) for f in n.fotos],
        )
        for n in propios
    ]
    return UsuarioAdminOut(**_fila(u, len(negocios)).model_dump(exclude={"negocios"}), negocios=negocios)


def editar_usuario(db: Session, almacen: Almacen, usuario_id: int, cambios: YoCambios) -> UsuarioAdminOut:
    usuarios.aplicar_cambios(db, _usuario_vivo(db, usuario_id), cambios)
    return detalle_usuario(db, almacen, usuario_id)


def _no_a_si_mismo_ni_al_administrador(quien: Usuario, u: Usuario, accion: str) -> None:
    if u.id == quien.id:
        raise ErrorNegocio(status.HTTP_400_BAD_REQUEST, f"No puedes {accion} tu propia cuenta desde el panel.")
    if u.rol == RolPlataforma.SUPERADMIN:
        raise ErrorNegocio(status.HTTP_403_FORBIDDEN, f"No se puede {accion} al Administrador.")


def eliminar_usuario(db: Session, quien: Usuario, usuario_id: int) -> None:
    u = _usuario_vivo(db, usuario_id)
    _no_a_si_mismo_ni_al_administrador(quien, u, "eliminar")
    auth.eliminar_cuenta(db, u)


def asignar_rol(db: Session, almacen: Almacen, quien: Usuario, usuario_id: int, rol_id: int | None) -> UsuarioAdminOut:
    u = _usuario_vivo(db, usuario_id)
    _no_a_si_mismo_ni_al_administrador(quien, u, "cambiar el rol de")
    if rol_id is not None and db.get(RolPanel, rol_id) is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Rol no encontrado.")
    u.rol_panel_id = rol_id
    db.commit()
    db.refresh(u)
    return detalle_usuario(db, almacen, usuario_id)


# ---------- Roles ----------


def permisos() -> list[PermisoOut]:
    return [PermisoOut(clave=c, texto=t) for c, t in PERMISOS.items()]


def _rol_out(db: Session, rol: RolPanel) -> RolPanelOut:
    cuantos = db.scalar(
        select(func.count()).select_from(Usuario).where(Usuario.rol_panel_id == rol.id, Usuario.eliminado_en.is_(None))
    )
    return RolPanelOut(
        id=rol.id, nombre=rol.nombre, descripcion=rol.descripcion, permisos=list(rol.permisos), usuarios=cuantos or 0
    )


def listar_roles(db: Session) -> list[RolPanelOut]:
    return [_rol_out(db, r) for r in db.scalars(select(RolPanel).order_by(RolPanel.id)).all()]


def _guardar_rol(db: Session, rol: RolPanel, datos: RolPanelIn) -> RolPanelOut:
    rol.nombre = datos.nombre
    rol.descripcion = datos.descripcion or None
    rol.permisos = datos.permisos
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise ErrorNegocio(status.HTTP_409_CONFLICT, "Ya existe un rol con ese nombre.") from None
    return _rol_out(db, rol)


def crear_rol(db: Session, datos: RolPanelIn) -> RolPanelOut:
    rol = RolPanel()
    db.add(rol)
    return _guardar_rol(db, rol, datos)


def _rol(db: Session, rol_id: int) -> RolPanel:
    rol = db.get(RolPanel, rol_id)
    if rol is None:
        raise ErrorNegocio(status.HTTP_404_NOT_FOUND, "Rol no encontrado.")
    return rol


def editar_rol(db: Session, rol_id: int, datos: RolPanelIn) -> RolPanelOut:
    return _guardar_rol(db, _rol(db, rol_id), datos)


def eliminar_rol(db: Session, rol_id: int) -> None:
    rol = _rol(db, rol_id)
    if _rol_out(db, rol).usuarios:
        raise ErrorNegocio(
            status.HTTP_409_CONFLICT, "Ese rol todavía tiene usuarios. Cámbiales el rol antes de eliminarlo."
        )
    # Las cuentas eliminadas (anonimizadas) que lo tenían lo sueltan.
    for u in db.scalars(select(Usuario).where(Usuario.rol_panel_id == rol.id)).all():
        u.rol_panel_id = None
    db.delete(rol)
    db.commit()
