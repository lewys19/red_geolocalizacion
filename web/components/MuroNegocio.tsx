"use client";

// Publicaciones en el perfil del negocio. Llegan armadas del servidor; con sesión se vuelven
// a pedir para marcar tus reacciones.
import { useEffect, useState } from "react";

import { pedir } from "@/lib/api";
import type { Muro } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

import { TarjetaPublicacion } from "./TarjetaPublicacion";

export function MuroNegocio({ slug, inicial }: { slug: string; inicial: Muro }) {
  const sesion = useSesion();
  const usuarioId = sesion?.usuario.id ?? null;
  const [muro, setMuro] = useState(inicial);
  const [cargando, setCargando] = useState(false);
  const ruta = `/negocios/ficha/${encodeURIComponent(slug)}/publicaciones`;

  useEffect(() => {
    if (usuarioId === null) return;
    pedir<Muro>(ruta, { conSesion: true })
      .then(setMuro)
      .catch(() => {});
  }, [ruta, usuarioId]);

  async function verMas() {
    if (!muro.siguiente) return;
    setCargando(true);
    try {
      const m = await pedir<Muro>(`${ruta}?antes_de=${muro.siguiente}`, { conSesion: true });
      setMuro({ publicaciones: [...muro.publicaciones, ...m.publicaciones], siguiente: m.siguiente });
    } finally {
      setCargando(false);
    }
  }

  if (!muro.publicaciones.length) {
    return <p className="py-10 text-center text-texto-2">Todavía no hay publicaciones.</p>;
  }
  return (
    <div className="space-y-4">
      {muro.publicaciones.map((p) => (
        <TarjetaPublicacion key={p.id} publicacion={p} />
      ))}
      {muro.siguiente && (
        <button
          type="button"
          onClick={verMas}
          disabled={cargando}
          className="w-full rounded-xl border border-borde bg-superficie py-3 font-medium hover:border-marca disabled:opacity-60"
        >
          {cargando ? "Cargando…" : "Ver más publicaciones"}
        </button>
      )}
    </div>
  );
}
