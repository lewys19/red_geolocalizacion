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
