// Llamadas a la API desde el servidor de Next.js (páginas que Google indexa).
import "server-only";

const API_INTERNA = process.env.API_INTERNA ?? "http://localhost:8100";

/** GET a la API sin caché (los datos como "abierto ahora" cambian). null si no existe. */
export async function obtener<T>(ruta: string): Promise<T | null> {
  const r = await fetch(`${API_INTERNA}/api/v1${ruta}`, { cache: "no-store" });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`La API respondió ${r.status} en ${ruta}`);
  return (await r.json()) as T;
}
