"use client";

import { useEffect, useState } from "react";

import { pedir } from "@/lib/api";
import type { Categoria } from "@/lib/tipos";

// Chips: las subcategorías de comida primero (lo más buscado) y luego el resto.
function aplanar(raices: Categoria[]): Categoria[] {
  return raices.flatMap((c) => (c.hijas.length ? c.hijas : [c]));
}

interface PropsBuscador {
  elegida: string | null;
  alCambiar: (slug: string | null) => void;
  alBuscar: (texto: string) => void;
}

export function Buscador({ elegida, alCambiar, alBuscar }: PropsBuscador) {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [texto, setTexto] = useState("");

  // Busca solo cuando la persona deja de escribir (400 ms).
  useEffect(() => {
    const espera = setTimeout(() => alBuscar(texto.trim()), 400);
    return () => clearTimeout(espera);
  }, [texto, alBuscar]);

  useEffect(() => {
    pedir<Categoria[]>("/categorias")
      .then((raices) => setCategorias(aplanar(raices)))
      .catch(() => setCategorias([]));
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 space-y-2 p-3">
      <div className="pointer-events-auto mx-auto max-w-xl">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            alBuscar(texto.trim());
            (document.activeElement as HTMLElement | null)?.blur(); // cierra el teclado del celular
          }}
          className="flex items-center gap-2 rounded-full border border-borde bg-superficie px-4 py-3 shadow-md"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 text-texto-2" aria-hidden="true">
            <path d="M11 4a7 7 0 1 0 4.3 12.5l4.1 4.1 1.4-1.4-4.1-4.1A7 7 0 0 0 11 4zm0 2a5 5 0 1 1 0 10 5 5 0 0 1 0-10z" fill="currentColor" />
          </svg>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar negocios"
            placeholder="Pollo a la brasa, ferretería, botica…"
            maxLength={100}
            enterKeyHint="search"
            className="w-full bg-transparent text-base outline-none placeholder:text-texto-2"
          />
        </form>
      </div>
      <div className="pointer-events-auto mx-auto flex max-w-3xl gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {categorias.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => alCambiar(elegida === c.slug ? null : c.slug)}
            aria-pressed={elegida === c.slug}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-sm shadow-sm transition ${
              elegida === c.slug
                ? "border-marca bg-marca text-sobre-marca"
                : "border-borde bg-superficie text-texto hover:border-marca"
            }`}
          >
            {c.nombre}
          </button>
        ))}
      </div>
    </div>
  );
}
