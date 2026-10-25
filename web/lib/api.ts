// Cliente de la API de Altoque. La misma API la usará la app móvil.
import { guardarSesion, leerSesion, type Sesion } from "./sesion";

const BASE = "/api/v1";

export class ErrorApi extends Error {
  constructor(
    public estado: number,
    mensaje: string,
  ) {
    super(mensaje);
  }
}

// Convierte la respuesta de error de FastAPI en un mensaje legible.
async function mensajeDeError(r: Response): Promise<string> {
  try {
    const cuerpo = await r.json();
    if (typeof cuerpo.detail === "string") return cuerpo.detail;
    if (Array.isArray(cuerpo.detail) && cuerpo.detail[0]?.msg) return "Revisa los datos del formulario.";
  } catch {
    // respuesta sin JSON
  }
  return r.status >= 500 ? "El servidor no responde. Intenta en un momento." : "No se pudo completar.";
}

// Un solo refresco a la vez: si varias peticiones vencen juntas, comparten el mismo.
let refrescoEnCurso: Promise<Sesion | null> | null = null;

async function refrescar(): Promise<Sesion | null> {
  const actual = leerSesion();
  if (!actual) return null;
  refrescoEnCurso ??= (async () => {
    try {
      const r = await fetch(`${BASE}/auth/refresco`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token_refresco: actual.token_refresco }),
      });
      const nueva = r.ok ? ((await r.json()) as Sesion) : null;
      guardarSesion(nueva);
      return nueva;
    } finally {
      refrescoEnCurso = null;
    }
  })();
  return refrescoEnCurso;
}

interface Opciones {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
  conSesion?: boolean;
  senal?: AbortSignal; // para cancelar una búsqueda que ya no sirve
}

export async function pedir<T>(
  ruta: string,
  { metodo = "GET", cuerpo, conSesion = false, senal }: Opciones = {},
): Promise<T> {
  // Un FormData (fotos) se envía tal cual: el navegador pone el Content-Type con su separador.
  const esArchivo = cuerpo instanceof FormData;
  const enviar = (sesion: Sesion | null) =>
    fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && !esArchivo ? { "Content-Type": "application/json" } : {}),
        ...(conSesion && sesion ? { Authorization: `Bearer ${sesion.token_acceso}` } : {}),
      },
      body: esArchivo ? cuerpo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: senal,
    });

  let r = await enviar(leerSesion());
  if (r.status === 401 && conSesion) {
    // El acceso venció: se pide uno nuevo con el refresco y se reintenta una vez.
    const nueva = await refrescar();
    if (nueva) r = await enviar(nueva);
  }
  if (!r.ok) throw new ErrorApi(r.status, await mensajeDeError(r));
  return (r.status === 204 ? undefined : await r.json()) as T;
}
