"use client";

import { Map as MapaLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef, useState } from "react";

import { ESTILO, TEXTOS_MAPA, nombresEnEspanol } from "@/lib/mapaBase";

/** Mapa chico con un pin que el dueño arrastra hasta la puerta de su negocio. */
export function SelectorPin({
  valor,
  alCambiar,
}: {
  valor: [number, number];
  alCambiar: (lngLat: [number, number]) => void;
}) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLibre | null>(null);
  const pinRef = useRef<Marker | null>(null);
  const alCambiarRef = useRef(alCambiar);
  useEffect(() => {
    alCambiarRef.current = alCambiar;
  });
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = new MapaLibre({ container: contenedor.current, style: ESTILO, center: valor, zoom: 16, locale: TEXTOS_MAPA });
    mapa.addControl(new NavigationControl({ showCompass: false }), "top-right");
    mapa.on("load", () => nombresEnEspanol(mapa));
    const pin = new Marker({ draggable: true, color: "#ea580c" }).setLngLat(valor).addTo(mapa);
    pin.on("dragend", () => {
      const { lng, lat } = pin.getLngLat();
      alCambiarRef.current([lng, lat]);
    });
    // Tocar el mapa también mueve el pin (más fácil en el celular que arrastrar).
    mapa.on("click", (e) => {
      pin.setLngLat(e.lngLat);
      alCambiarRef.current([e.lngLat.lng, e.lngLat.lat]);
    });
    mapaRef.current = mapa;
    pinRef.current = pin;
    return () => mapa.remove();
    // Solo al montar: después el pin se mueve con el mapa, no recreándolo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function usarMiUbicacion() {
    if (!navigator.geolocation) {
      setAviso("Tu navegador no permite obtener la ubicación.");
      return;
    }
    setBuscando(true);
    setAviso(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const lngLat: [number, number] = [coords.longitude, coords.latitude];
        pinRef.current?.setLngLat(lngLat);
        mapaRef.current?.flyTo({ center: lngLat, zoom: 17 });
        alCambiarRef.current(lngLat);
        setBuscando(false);
      },
      () => {
        setAviso("No pudimos obtener tu ubicación. Mueve el pin a mano.");
        setBuscando(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative h-72 overflow-hidden rounded-xl border border-borde">
        <div className="absolute inset-0">
          <div ref={contenedor} className="h-full w-full" aria-label="Ubicación de tu negocio" role="region" />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="text-texto-2">Arrastra el pin o toca el mapa hasta la puerta de tu negocio.</span>
        <button
          type="button"
          onClick={usarMiUbicacion}
          disabled={buscando}
          className="rounded-full border border-borde px-3 py-1.5 font-medium hover:border-marca disabled:opacity-60"
        >
          {buscando ? "Ubicando…" : "Estoy en mi negocio"}
        </button>
      </div>
      {aviso && <p className="text-sm text-error">{aviso}</p>}
    </div>
  );
}
