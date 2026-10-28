// Sesión guardada en el navegador (localStorage) y avisos a la interfaz cuando cambia.
// El token de acceso dura 30 min; el de refresco, 30 días (ver lib/api.ts).

export type Rol = "cliente" | "superadmin";

export interface Usuario {
  id: number;
  email: string;
  username: string;
  nombre: string;
  rol: Rol;
  /** Tiene acceso al panel administrativo (sesiones guardadas antes de existir el campo: undefined). */
  en_panel?: boolean;
}

export interface Sesion {
  token_acceso: string;
  token_refresco: string;
  acceso_expira_en: string;
  usuario: Usuario;
}

const CLAVE = "altoque.sesion";
const oyentes = new Set<() => void>();

// localStorage puede no existir (servidor) o fallar (modo privado): nunca debe romper la página.
let cacheTexto: string | null = null;
let cacheSesion: Sesion | null = null;

export function leerSesion(): Sesion | null {
  let texto: string | null = null;
  try {
    texto = typeof window === "undefined" ? null : window.localStorage.getItem(CLAVE);
  } catch {
    texto = null;
  }
  // Mismo texto = mismo objeto: useSyncExternalStore necesita una referencia estable.
  if (texto !== cacheTexto) {
    cacheTexto = texto;
    try {
      cacheSesion = texto ? (JSON.parse(texto) as Sesion) : null;
    } catch {
      cacheSesion = null;
    }
  }
  return cacheSesion;
}

export function guardarSesion(sesion: Sesion | null): void {
  try {
    if (sesion) window.localStorage.setItem(CLAVE, JSON.stringify(sesion));
    else window.localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento la sesión dura solo hasta recargar; la app sigue funcionando.
  }
  oyentes.forEach((avisar) => avisar());
}

export function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  // Otra pestaña inició o cerró sesión.
  const alCambiar = (e: StorageEvent) => {
    if (e.key === CLAVE) avisar();
  };
  window.addEventListener("storage", alCambiar);
  return () => {
    oyentes.delete(avisar);
    window.removeEventListener("storage", alCambiar);
  };
}
