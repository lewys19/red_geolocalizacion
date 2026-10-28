"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Avatar } from "@/components/TarjetaPublicacion";
import { pedir } from "@/lib/api";
import { aPie, distancia } from "@/lib/formato";
import type { NegocioMini } from "@/lib/tipos";
import { useUbicacion } from "@/lib/ubicacion";

/** Todos los negocios publicados en tarjetas: con tu ubicación, los más cercanos primero. */
export default function Negocios() {
  const ubicacion = useUbicacion();
  const [negocios, setNegocios] = useState<NegocioMini[] | null>(null);
  const [filtro, setFiltro] = useState("");

  useEffect(() => {
    const p = new URLSearchParams({ limite: "100" });
    if (ubicacion) {
      p.set("lng", ubicacion[0].toFixed(5));
      p.set("lat", ubicacion[1].toFixed(5));
    }
    pedir<NegocioMini[]>(`/negocios/lista?${p}`).then(setNegocios).catch(() => setNegocios([]));
  }, [ubicacion]);

  const texto = filtro.trim().toLowerCase();
  const visibles = negocios?.filter(
    (n) => !texto || `${n.nombre} ${n.categoria} ${n.distrito}`.toLowerCase().includes(texto),
  );

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Negocios</h1>
          <p className="text-texto-2">
            {ubicacion ? "Los más cercanos a ti primero." : "Los más nuevos primero. Marca tu ubicación en el mapa para ver los más cercanos."}
          </p>
        </div>
        <input
          type="search"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          placeholder="Filtrar por nombre, categoría o distrito"
          aria-label="Filtrar negocios"
          className="w-full rounded-full border border-borde bg-superficie px-4 py-2 text-sm sm:w-72"
        />
      </div>

      {negocios === null && <p className="mt-8 text-texto-2">Cargando…</p>}
      {visibles?.length === 0 && <p className="mt-8 text-texto-2">No hay negocios que coincidan.</p>}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visibles?.map((n) => (
          <Link
            key={n.id}
            href={`/n/${n.slug}`}
            className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-sm hover:border-marca"
          >
            <Avatar negocio={n} tamano="h-16 w-16 text-2xl" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{n.nombre}</span>
              <span className="block text-sm text-texto-2">
                {n.categoria} · {n.distrito}
              </span>
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
