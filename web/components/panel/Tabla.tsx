// Piezas de las tablas del panel: botones de acción, paginación y avisos.
import type { ReactNode } from "react";

export const TH = "px-4 py-3 text-left text-xs font-semibold tracking-wide uppercase";
export const TD = "px-4 py-3 align-middle";

const COLOR_ACCION = {
  ver: "bg-stone-700 hover:bg-stone-800",
  editar: "bg-amber-500 hover:bg-amber-600",
  eliminar: "bg-red-600 hover:bg-red-700",
} as const;

const ICONO_ACCION = {
  ver: "M12 5C6.5 5 2.7 9.4 1.5 12c1.2 2.6 5 7 10.5 7s9.3-4.4 10.5-7C21.3 9.4 17.5 5 12 5zm0 11a4 4 0 1 1 4-4 4 4 0 0 1-4 4zm0-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2z",
  editar: "M3 17.2V21h3.8l11-11-3.8-3.8zM20.7 7a1 1 0 0 0 0-1.4l-2.3-2.3a1 1 0 0 0-1.4 0l-1.8 1.8 3.8 3.8z",
  eliminar: "M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z",
} as const;

/** Botón cuadrado de color (ver / editar / eliminar), como en las tablas de administración clásicas. */
export function BotonAccion({
  tipo,
  titulo,
  onClick,
}: {
  tipo: keyof typeof COLOR_ACCION;
  titulo: string;
  onClick: () => void;
}) {
  return (
    <button type="button" title={titulo} aria-label={titulo} onClick={onClick} className={`p-2 text-white ${COLOR_ACCION[tipo]}`}>
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path d={ICONO_ACCION[tipo]} fill="currentColor" />
      </svg>
    </button>
  );
}

export function GrupoAcciones({ children }: { children: ReactNode }) {
  return <div className="inline-flex overflow-hidden rounded-md shadow-sm">{children}</div>;
}

/** Páginas numeradas (con «…» si son muchas) y el texto «Resultados 1 a 10 de 57». */
export function Paginacion({
  pagina,
  porPagina,
  total,
  alCambiar,
}: {
  pagina: number;
  porPagina: number;
  total: number;
  alCambiar: (pagina: number) => void;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  const visibles = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])]
    .filter((p) => p >= 1 && p <= paginas)
    .sort((a, b) => a - b);
  const desde = total === 0 ? 0 : (pagina - 1) * porPagina + 1;
  const hasta = Math.min(total, pagina * porPagina);
  const clase = "min-w-9 rounded-md px-2.5 py-1.5 text-sm disabled:opacity-40";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-4 py-3">
      <div className="flex items-center gap-1">
        <span className="mr-1 text-sm text-texto-2">Página</span>
        <button type="button" className={`${clase} hover:bg-fondo`} disabled={pagina === 1} onClick={() => alCambiar(pagina - 1)} aria-label="Anterior">
          ‹
        </button>
        {visibles.map((p, i) => (
          <span key={p} className="flex items-center gap-1">
            {i > 0 && p - visibles[i - 1] > 1 && <span className="px-1 text-texto-2">…</span>}
            <button
              type="button"
              onClick={() => alCambiar(p)}
              aria-current={p === pagina ? "page" : undefined}
              className={`${clase} ${p === pagina ? "bg-marca font-semibold text-sobre-marca" : "hover:bg-fondo"}`}
            >
              {p}
            </button>
          </span>
        ))}
        <button
          type="button"
          className={`${clase} hover:bg-fondo`}
          disabled={pagina === paginas}
          onClick={() => alCambiar(pagina + 1)}
          aria-label="Siguiente"
        >
          ›
        </button>
      </div>
      <p className="text-sm text-texto-2">
        Resultados {desde} a {hasta} de {total}
      </p>
    </div>
  );
}

export function Aviso({ ok, error }: { ok?: string | null; error?: string | null }) {
  if (error) return <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">{error}</p>;
  if (ok) return <p role="status" className="rounded-lg bg-green-600/10 px-3 py-2 text-sm text-green-700 dark:text-green-400">{ok}</p>;
  return null;
}

export function Caja({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`overflow-hidden rounded-xl border border-borde bg-superficie shadow-sm ${className}`}>{children}</div>;
}
