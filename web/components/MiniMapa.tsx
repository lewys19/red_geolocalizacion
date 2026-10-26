"use client";

import { Map as MapaLibre, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { ESTILO, TEXTOS_MAPA, nombresEnEspanol } from "@/lib/mapaBase";

/** Mapa fijo con el pin del negocio (solo para ver dónde queda). */
export function MiniMapa({ lng, lat, nombre }: { lng: number; lat: number; nombre: string }) {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const div = contenedor.current;
    if (!div) return;
    let mapa: MapaLibre | null = null;
    // Se crea recién cuando se ve (p. ej. al abrir la pestaña Información): un mapa oculto
    // gasta memoria y procesador del celular para nada.
    const observador = new IntersectionObserver(([entrada]) => {
      if (!entrada.isIntersecting || mapa) return;
      mapa = new MapaLibre({
        container: div,
        style: ESTILO,
        center: [lng, lat],
        zoom: 16,
        interactive: false,
        locale: TEXTOS_MAPA,
      });
      const listo = mapa;
      listo.on("load", () => nombresEnEspanol(listo));
      new Marker({ color: "#ea580c" }).setLngLat([lng, lat]).addTo(listo);
      observador.disconnect();
    });
    observador.observe(div);
    return () => {
      observador.disconnect();
      mapa?.remove();
    };
  }, [lng, lat]);

  return (
    <div className="relative h-48 overflow-hidden rounded-xl border border-borde">
      <div className="absolute inset-0">
        <div ref={contenedor} className="h-full w-full" role="img" aria-label={`Ubicación de ${nombre} en el mapa`} />
      </div>
    </div>
  );
}
