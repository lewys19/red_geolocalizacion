"use client";

import { distancia, enlaceComoLlegar, enlaceWhatsapp, hora } from "@/lib/formato";
import type { PuntoMapa } from "@/lib/tipos";

function Atencion({ punto }: { punto: PuntoMapa }) {
  if (punto.abierto === null) return <span className="text-texto-2">Horario no informado</span>;
  return punto.abierto ? (
    <span className="font-medium text-green-700 dark:text-green-400">
      Abierto{punto.cierra_a ? ` · cierra ${hora(punto.cierra_a)}` : ""}
    </span>
  ) : (
    <span className="font-medium text-error">Cerrado ahora</span>
  );
}

const BOTON =
  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-semibold transition";

export function FichaResumen({ punto, alCerrar }: { punto: PuntoMapa; alCerrar: () => void }) {
  return (
    <article className="mx-auto max-w-xl rounded-2xl border border-borde bg-superficie p-4 shadow-lg" aria-live="polite">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-bold">{punto.nombre}</h2>
          <p className="text-sm text-texto-2">
            {punto.categoria} · {punto.distrito}
            {punto.distancia_m !== null && ` · ${distancia(punto.distancia_m)}`}
          </p>
        </div>
        <button type="button" onClick={alCerrar} aria-label="Cerrar" className="-m-1 rounded-full p-1.5 text-texto-2 hover:bg-fondo">
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <Atencion punto={punto} />
        {punto.tiene_delivery && (
          <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca-fuerte">Delivery</span>
        )}
      </p>
      <p className="mt-1 truncate text-sm text-texto-2">
        {punto.direccion}
        {punto.referencia && ` · ${punto.referencia}`}
      </p>
      <div className="mt-3 flex gap-2">
        {punto.whatsapp && (
          <a
            href={enlaceWhatsapp(punto.whatsapp, punto.nombre)}
            target="_blank"
            rel="noopener noreferrer"
            className={`${BOTON} bg-[#25d366] text-[#0b3d1e] hover:brightness-95`}
          >
            WhatsApp
          </a>
        )}
        {punto.telefono && (
          <a href={`tel:+${punto.telefono}`} className={`${BOTON} border border-borde hover:border-marca`}>
            Llamar
          </a>
        )}
        <a
          href={enlaceComoLlegar(punto.lat, punto.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BOTON} bg-marca text-sobre-marca hover:bg-marca-fuerte`}
        >
          Cómo llegar
        </a>
      </div>
    </article>
  );
}
