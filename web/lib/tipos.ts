// Tipos de las respuestas de la API (ver backend/app/schemas).

export interface Categoria {
  id: number;
  nombre: string;
  slug: string;
  icono: string | null;
  hijas: Categoria[];
}

export interface PuntoMapa {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  lng: number;
  lat: number;
  distrito: string;
  direccion: string;
  referencia: string | null;
  telefono: string | null;
  whatsapp: string | null;
  tiene_delivery: boolean;
  abierto: boolean | null;
  cierra_a: string | null; // "23:00:00"
  distancia_m: number | null;
}

export interface GrupoMapa {
  lng: number;
  lat: number;
  cantidad: number;
}

export interface RespuestaMapa {
  total: number;
  puntos: PuntoMapa[];
  grupos: GrupoMapa[];
}

export interface Horario {
  dia_semana: number; // 0 = lunes
  abre: string; // "12:00"
  cierra: string;
}

export type EstadoNegocio = "pendiente" | "aprobado" | "rechazado" | "suspendido";

export interface Negocio {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  distrito: string;
  direccion: string;
  estado: EstadoNegocio;
  motivo_rechazo: string | null;
  horarios: Horario[];
}

export interface Producto {
  id: number;
  nombre: string;
  descripcion: string | null;
  precio_centimos: number | null;
  disponible: boolean;
  orden: number;
}

export interface Foto {
  id: number;
  url: string;
  ancho: number;
  alto: number;
}

export interface Ficha {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  categoria_slug: string;
  descripcion: string | null;
  distrito: string;
  direccion: string;
  referencia: string | null;
  lng: number;
  lat: number;
  telefono: string | null;
  whatsapp: string | null;
  tiene_delivery: boolean;
  abierto: boolean | null;
  cierra_a: string | null;
  horarios: Horario[];
  productos: Producto[];
  fotos: Foto[];
  calificacion_promedio: number | null;
  total_resenas: number;
  logo: string | null;
  portada: string | null;
  seguidores: number;
  total_reacciones: number;
  /** «Me gusta» a la página del negocio. */
  total_me_gusta: number;
  total_publicaciones: number;
}

/** Lo que ve el dueño de su negocio (GET /negocios/mios/{id}). */
export interface NegocioDetalle extends Negocio {
  categoria_id: number;
  descripcion: string | null;
  referencia: string | null;
  ubicacion: { lng: number; lat: number } | null;
  telefono: string | null;
  whatsapp: string | null;
  tiene_delivery: boolean;
  es_mio: boolean;
}

export interface Catalogo {
  productos: Producto[];
  fotos: Foto[];
  logo: string | null;
  portada: string | null;
}

/** Un negocio en pocas palabras: círculos del Inicio, tarjetas y cabecera de publicación. */
export interface NegocioMini {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  distrito: string;
  foto: string | null;
  distancia_m: number | null;
}

export interface Publicacion {
  id: number;
  texto: string;
  creado_en: string;
  editado_en: string | null;
  negocio: NegocioMini;
  fotos: Foto[];
  reacciones: Record<TipoReaccion, number>;
  total_reacciones: number;
  total_comentarios: number;
  compartidos: number;
  mi_reaccion: TipoReaccion | null;
  /** Quien mira es el dueño del negocio: puede editarla o borrarla. */
  es_mia: boolean;
}

export type TipoReaccion = "me_gusta" | "me_encanta" | "wow";

export interface Reacciones {
  reacciones: Record<TipoReaccion, number>;
  total: number;
  mi_reaccion: TipoReaccion | null;
}

export interface Comentario {
  id: number;
  texto: string;
  creado_en: string;
  autor: { id: number; nombre: string };
}

export interface Comentarios {
  comentarios: Comentario[];
  siguiente: number | null;
  total: number;
}

export interface Muro {
  publicaciones: Publicacion[];
  siguiente: number | null;
}

/** Cuenta propia (GET /yo). */
export interface Yo {
  id: number;
  username: string;
  nombre: string;
  avatar: string | null;
  email: string;
  telefono: string | null;
  rol: "cliente" | "superadmin";
  creado_en: string;
  negocios: { negocio_id: number; negocio_nombre: string }[];
  en_panel: boolean;
  es_negocio: boolean;
  es_operador: boolean;
  es_superadmin: boolean;
  /** «Administrador», «Subadministrador»… o null si no entra al panel. */
  rol_panel: string | null;
  permisos: string[];
}

/** Negocio completo, con imágenes, tal como lo ve el equipo de Altoque. */
export interface NegocioAdmin extends NegocioDetalle {
  logo: string | null;
  portada: string | null;
  fotos: Foto[];
}

/** Una fila de la tabla de usuarios del panel. */
export interface UsuarioFila {
  id: number;
  email: string;
  username: string;
  nombre: string;
  telefono: string | null;
  rol: "cliente" | "superadmin";
  rol_panel: { id: number; nombre: string } | null;
  creado_en: string;
  negocios: number;
}

export interface PaginaUsuarios {
  total: number;
  pagina: number;
  por_pagina: number;
  usuarios: UsuarioFila[];
}

/** Ficha de un usuario en el panel: sus datos y sus negocios completos. */
export interface UsuarioAdmin extends Omit<UsuarioFila, "negocios"> {
  negocios: NegocioAdmin[];
}

export interface ResumenAdmin {
  usuarios: number;
  usuarios_nuevos_7d: number;
  usuarios_con_negocio: number;
  usuarios_sin_negocio: number;
  negocios: number;
  negocios_por_estado: Record<EstadoNegocio, number>;
  categorias: number;
  por_categoria: { categoria: string; negocios: number }[];
  equipo: number;
}

export interface Permiso {
  clave: string;
  texto: string;
}

export interface RolPanel {
  id: number;
  nombre: string;
  descripcion: string | null;
  permisos: string[];
  usuarios: number;
}

/** Perfil público (/{username}). */
export interface PerfilPublico {
  username: string;
  nombre: string;
  avatar: string | null;
  creado_en: string;
  negocios: { nombre: string; slug: string; categoria: string; distrito: string; logo: string | null }[];
}

/** Una fila de la tabla de categorías del panel. */
export interface CategoriaAdmin {
  id: number;
  nombre: string;
  slug: string;
  icono: string | null;
  orden: number;
  padre_id: number | null;
  padre: string | null;
  hijas: number;
  negocios: number;
}

/** Banner activo de la columna derecha del Inicio. */
export interface Anuncio {
  posicion: number;
  titulo: string | null;
  enlace: string | null;
  imagen: string;
}

/** Un espacio publicitario en el panel (puede estar vacío). */
export interface AnuncioAdmin {
  posicion: number;
  titulo: string | null;
  enlace: string | null;
  imagen: string | null;
  activo: boolean;
}

export interface Sugerencia {
  id: number;
  texto: string;
  creado_en: string;
  usuario: { id: number; username: string; nombre: string } | null;
}

export interface PaginaSugerencias {
  total: number;
  pagina: number;
  por_pagina: number;
  sugerencias: Sugerencia[];
}
