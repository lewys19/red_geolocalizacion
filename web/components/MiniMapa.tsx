"use client";

import { Map as MapaLibre, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { ESTILO, TEXTOS_MAPA, nombresEnEspanol } from "@/lib/mapaBase";

/** Mapa fijo con el pin del negocio (solo para ver dónde queda). */
export function MiniMapa({ lng, lat, nombre }: { lng: number; lat: number; nombre: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = new MapaLibre({
      container: contenedor.current,
      style: ESTILO,
      center: [lng, lat],
      zoom: 16,
      interactive: false,
      locale: TEXTOS_MAPA,
    });
    mapa.on("load", () => nombresEnEspanol(mapa));
    new Marker({ color: "#ea580c" }).setLngLat([lng, lat]).addTo(mapa);
    return () => mapa.remove();
  }, [lng, lat]);

  return (
    <div className="relative h-48 overflow-hidden rounded-xl border border-borde">
      <div className="absolute inset-0">
        <div ref={contenedor} className="h-full w-full" role="img" aria-label={`Ubicación de ${nombre} en el mapa`} />
      </div>
    </div>
  );
}
