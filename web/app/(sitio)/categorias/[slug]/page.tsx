"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";

import { Avatar } from "@/components/TarjetaPublicacion";
import { pedir } from "@/lib/api";
import { aPie, distancia } from "@/lib/formato";
import { emojiDe } from "@/lib/iconos";
import type { Categoria, NegocioMini } from "@/lib/tipos";
import { useUbicacion } from "@/lib/ubicacion";

function buscarCategoria(raices: Categoria[], slug: string): Categoria | null {
  for (const c of raices) {
    if (c.slug === slug) return c;
    const hija = c.hijas.find((h) => h.slug === slug);
    if (hija) return hija;
  }
  return null;
}

/** Los negocios de una categoría en tarjetas: con tu ubicación, los más cercanos primero. */
export default function NegociosDeCategoria({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const ubicacion = useUbicacion();
  const [categoria, setCategoria] = useState<Categoria | null>(null);
  const [negocios, setNegocios] = useState<NegocioMini[] | null>(null);

  useEffect(() => {
    pedir<Categoria[]>("/categorias")
      .then((r) => setCategoria(buscarCategoria(r, slug)))
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    const p = new URLSearchParams({ categoria: slug, limite: "60" });
    if (ubicacion) {
      p.set("lng", ubicacion[0].toFixed(5));
      p.set("lat", ubicacion[1].toFixed(5));
    }
    pedir<NegocioMini[]>(`/negocios/lista?${p}`).then(setNegocios).catch(() => setNegocios([]));
  }, [slug, ubicacion]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <Link href="/categorias" className="text-sm text-texto-2 hover:text-texto">
        ← Categorías
      </Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {categoria ? `${emojiDe(categoria.icono)} ${categoria.nombre}` : " "}
          </h1>
          <p className="text-texto-2">
            {ubicacion ? "Los más cercanos a ti primero." : "Los más nuevos primero. Marca tu ubicación en el mapa para ver los más cercanos."}
          </p>
        </div>
        <Link
          href={`/mapa?categoria=${slug}`}
          className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte"
        >
          Ver en el mapa
        </Link>
      </div>

      {negocios === null && <p className="mt-8 text-texto-2">Cargando…</p>}
      {negocios?.length === 0 && <p className="mt-8 text-texto-2">Todavía no hay negocios en esta categoría.</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {negocios?.map((n) => (
          <Link
            key={n.id}
            href={`/n/${n.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-sm hover:border-marca"
          >
            <Avatar negocio={n} tamano="h-16 w-16 text-2xl" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{n.nombre}</span>
              <span className="block text-sm text-texto-2">{n.distrito}</span>
              {n.distancia_m !== null && (
                <span className="block text-sm text-marca-fuerte">
                  {distancia(n.distancia_m)} · {aPie(n.distancia_m)}
                </span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
