"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { pedir } from "@/lib/api";
import { emojiDe } from "@/lib/iconos";
import type { Categoria } from "@/lib/tipos";

/** Pestaña Categorías: todas en tarjetas, con cuántos negocios tiene cada una. */
export default function Categorias() {
  const [raices, setRaices] = useState<Categoria[] | null>(null);
  const [conteo, setConteo] = useState<Record<string, number>>({});

  useEffect(() => {
    pedir<Categoria[]>("/categorias").then(setRaices).catch(() => setRaices([]));
    pedir<Record<string, number>>("/categorias/conteo").then(setConteo).catch(() => {});
  }, []);

  const tarjeta = (c: Categoria) => (
    <Link
      key={c.id}
      href={`/categorias/${c.slug}`}
      className="group flex flex-col justify-between gap-6 rounded-2xl border border-borde bg-superficie p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-marca hover:shadow-md"
    >
      <span className="text-4xl" aria-hidden="true">
        {emojiDe(c.icono)}
      </span>
      <span>
        <span className="block font-semibold leading-tight group-hover:text-marca-fuerte">{c.nombre}</span>
        <span className="text-sm text-texto-2">
          {conteo[c.slug] ? `${conteo[c.slug]} ${conteo[c.slug] === 1 ? "negocio" : "negocios"}` : "Sin negocios aún"}
        </span>
      </span>
    </Link>
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Categorías</h1>
      <p className="mt-1 text-texto-2">Elige qué buscas y te mostramos los negocios, los más cercanos primero.</p>
      {raices === null && <p className="mt-8 text-texto-2">Cargando…</p>}
      {raices?.map((r) =>
        r.hijas.length ? (
          <section key={r.id} className="mt-8">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-bold">
              {emojiDe(r.icono)} {r.nombre}
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{r.hijas.map(tarjeta)}</div>
          </section>
        ) : null,
      )}
      {raices && (
        <section className="mt-8">
          <h2 className="mb-3 text-lg font-bold">Servicios y tiendas</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {raices.filter((r) => !r.hijas.length).map(tarjeta)}
          </div>
        </section>
      )}
    </div>
  );
}
