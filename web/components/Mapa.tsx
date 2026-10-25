"use client";

import { GeolocateControl, Map as MapaLibre, NavigationControl, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

// Mapa base gratuito de OpenStreetMap (OpenFreeMap, sin clave). Se cambia con NEXT_PUBLIC_ESTILO_MAPA.
const ESTILO = process.env.NEXT_PUBLIC_ESTILO_MAPA ?? "https://tiles.openfreemap.org/styles/liberty";
// Centro de Lima (Plaza de Armas) mientras no haya permiso de ubicación.
const LIMA: [number, number] = [-77.0428, -12.0464];

// MapLibre dibuja las teselas en un worker aparte; el build lo copia a public/ (ver package.json).
setWorkerUrl("/maplibre-gl-worker.mjs");

export function Mapa() {
  const contenedor = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = new MapaLibre({ container: contenedor.current, style: ESTILO, center: LIMA, zoom: 12 });
    mapa.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    // La ubicación solo se pide si la persona pulsa el botón; no se guarda en ningún lado.
    mapa.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false }),
      "bottom-right",
    );
    return () => mapa.remove();
  }, []);

  // El CSS de MapLibre le pone position: relative a su contenedor; por eso va dentro de una capa absoluta.
  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="h-full w-full" aria-label="Mapa de Lima" role="region" />
    </div>
  );
}
