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
    if (Array.isArray(cuerpo.detail) && cuerpo.detail[0]?.msg) {
      // Los mensajes propios de la API (en español) llegan como "Value error, …"; los genéricos de Pydantic, no.
      const msg: string = cuerpo.detail[0].msg;
      return msg.startsWith("Value error, ") ? msg.slice("Value error, ".length) : "Revisa los datos del formulario.";
    }
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
  metodo?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
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
  // Nunca esperar para siempre: si la respuesta se pierde, el formulario muestra un error en vez de quedarse
  // en "Un momento…". Las fotos tienen más margen (redes móviles lentas).
  const limite = AbortSignal.timeout(esArchivo ? 60_000 : 20_000);
  const enviar = (sesion: Sesion | null) =>
    fetch(`${BASE}${ruta}`, {
      method: metodo,
      headers: {
        ...(cuerpo !== undefined && !esArchivo ? { "Content-Type": "application/json" } : {}),
        ...(conSesion && sesion ? { Authorization: `Bearer ${sesion.token_acceso}` } : {}),
      },
      body: esArchivo ? cuerpo : cuerpo !== undefined ? JSON.stringify(cuerpo) : undefined,
      signal: senal ? AbortSignal.any([senal, limite]) : limite,
    });

  let r: Response;
  try {
    r = await enviar(leerSesion());
  } catch (e) {
    if (e instanceof DOMException && e.name === "TimeoutError") {
      throw new ErrorApi(0, "El servidor tardó demasiado en responder. Inténtalo otra vez.");
    }
    throw e;
  }
  if (r.status === 401 && conSesion) {
    // El acceso venció: se pide uno nuevo con el refresco y se reintenta una vez.
    const nueva = await refrescar();
    if (nueva) r = await enviar(nueva);
  }
  if (!r.ok) throw new ErrorApi(r.status, await mensajeDeError(r));
  return (r.status === 204 ? undefined : await r.json()) as T;
}

/** Reintenta una lectura si falló la red o el servidor (5xx). Los errores 4xx no se reintentan. */
export async function conReintentos<T>(leer: () => Promise<T>, intentos = 2, esperaMs = 1200): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await leer();
    } catch (e) {
      // estado 0 = no respondió a tiempo.
      const reintentable = (e instanceof ErrorApi && (e.estado >= 500 || e.estado === 0)) || e instanceof TypeError;
      if (!reintentable || i >= intentos) throw e;
      await new Promise((r) => setTimeout(r, esperaMs));
    }
  }
}

/** Descarga un archivo de la API (p. ej. el CSV del panel) con la sesión actual y lo entrega al navegador. */
export async function descargar(ruta: string, nombreArchivo: string): Promise<void> {
  const enviar = (sesion: Sesion | null) =>
    fetch(`${BASE}${ruta}`, { headers: sesion ? { Authorization: `Bearer ${sesion.token_acceso}` } : {} });
  let r = await enviar(leerSesion());
  if (r.status === 401) {
    const nueva = await refrescar();
    if (nueva) r = await enviar(nueva);
  }
  if (!r.ok) throw new ErrorApi(r.status, await mensajeDeError(r));
  const url = URL.createObjectURL(await r.blob());
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  enlace.click();
  URL.revokeObjectURL(url);
}
