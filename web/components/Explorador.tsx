"use client";

import Link from "next/link";
import { type CSSProperties, useState } from "react";

import type { PuntoMapa } from "@/lib/tipos";

import { Buscador } from "./Buscador";
import { FichaResumen } from "./FichaResumen";
import { Mapa } from "./Mapa";

/** Pantalla principal: mapa + categorías + ficha del negocio elegido. */
export function Explorador() {
  const [categoria, setCategoria] = useState<string | null>(null);
  const [desde, setDesde] = useState<[number, number] | null>(null);
  const [elegido, setElegido] = useState<PuntoMapa | null>(null);
  const [total, setTotal] = useState<number | null | undefined>(undefined); // undefined = cargando

  // Los controles del mapa suben por encima de lo que se muestra abajo (ver globals.css).
  const estilo = { "--alto-panel": elegido ? "230px" : "96px" } as CSSProperties;

  return (
    <section className="relative flex-1" style={estilo}>
      <Mapa
        categoria={categoria}
        desde={desde}
        elegido={elegido?.id ?? null}
        alElegir={setElegido}
        alUbicarme={setDesde}
        alResultado={setTotal}
      />
      <Buscador
        elegida={categoria}
        alCambiar={(slug) => {
          setCategoria(slug);
          setElegido(null);
        }}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto">
          {elegido ? (
            <FichaResumen punto={elegido} alCerrar={() => setElegido(null)} />
          ) : (
            <div className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-borde bg-superficie px-4 py-3 shadow-lg">
              <p className="text-sm">
                {total === undefined
                  ? "Buscando negocios…"
                  : total === null
                    ? "Acerca el mapa para ver los negocios."
                    : total === 0
                      ? "No hay negocios aquí todavía."
                      : `${total} ${total === 1 ? "negocio" : "negocios"} en esta zona`}
              </p>
              <Link
                href="/negocios/nuevo"
                className="shrink-0 rounded-full bg-marca px-3 py-1.5 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte"
              >
                Registra tu negocio
              </Link>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
