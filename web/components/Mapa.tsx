"use client";

import type { FeatureCollection, Point } from "geojson";
import { GeolocateControl, type GeoJSONSource, Map as MapaLibre, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { pedir } from "@/lib/api";
import { ESTILO, LIMA, TEXTOS_MAPA, nombresEnEspanol } from "@/lib/mapaBase";
import type { PuntoMapa, RespuestaMapa } from "@/lib/tipos";

// La API no acepta recuadros de más de 1 grado por lado (ver MAX_LADO_RECUADRO).
const MAX_LADO = 1;
const NARANJA = "#ea580c";
const GRIS = "#a8a29e";

export interface PropsMapa {
  categoria: string | null;
  desde: [number, number] | null; // ubicación de quien busca, para ordenar por cercanía
  elegido: number | null;
  alElegir: (punto: PuntoMapa | null) => void;
  alUbicarme: (lngLat: [number, number]) => void;
  alResultado: (total: number | null) => void; // null = mapa demasiado alejado
}

const VACIO: FeatureCollection<Point> = { type: "FeatureCollection", features: [] };

function aGeoJson(r: RespuestaMapa): FeatureCollection<Point> {
  return {
    type: "FeatureCollection",
    features: [
      ...r.grupos.map((g) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [g.lng, g.lat] },
        properties: { tipo: "grupo", cantidad: g.cantidad },
      })),
      ...r.puntos.map((p) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [p.lng, p.lat] },
        properties: { tipo: "punto", id: p.id, abierto: p.abierto ? 1 : 0 },
      })),
    ],
  };
}

export function Mapa(props: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLibre | null>(null);
  const recargarRef = useRef<() => void>(() => {});
  // Los props cambian sin recrear el mapa: los eventos del mapa leen siempre la versión actual.
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = new MapaLibre({ container: contenedor.current, style: ESTILO, center: LIMA, zoom: 13, locale: TEXTOS_MAPA });
    mapaRef.current = mapa;
    const puntos = new globalThis.Map<number, PuntoMapa>();
    let pedido: AbortController | null = null;
    let espera: ReturnType<typeof setTimeout> | undefined;

    mapa.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    // La ubicación solo se pide si la persona pulsa el botón; no se guarda en ningún lado.
    const ubicar = new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: false });
    mapa.addControl(ubicar, "bottom-right");
    ubicar.on("geolocate", (e) => {
      propsRef.current.alUbicarme([e.coords.longitude, e.coords.latitude]);
    });

    async function cargar() {
      const b = mapa.getBounds();
      const fuente = mapa.getSource<GeoJSONSource>("negocios");
      if (!fuente) return;
      if (b.getEast() - b.getWest() > MAX_LADO || b.getNorth() - b.getSouth() > MAX_LADO) {
        fuente.setData(VACIO);
        propsRef.current.alResultado(null);
        return;
      }
      const { categoria, desde } = propsRef.current;
      const params = new URLSearchParams({
        oeste: b.getWest().toFixed(5),
        sur: b.getSouth().toFixed(5),
        este: b.getEast().toFixed(5),
        norte: b.getNorth().toFixed(5),
      });
      if (categoria) params.set("categoria", categoria);
      if (desde) {
        params.set("lng", desde[0].toFixed(5));
        params.set("lat", desde[1].toFixed(5));
      }
      pedido?.abort(); // si el mapa se movió otra vez, la respuesta anterior ya no sirve
      pedido = new AbortController();
      try {
        const r = await pedir<RespuestaMapa>(`/mapa?${params}`, { senal: pedido.signal });
        puntos.clear();
        r.puntos.forEach((p) => puntos.set(p.id, p));
        fuente.setData(aGeoJson(r));
        propsRef.current.alResultado(r.total);
      } catch (e) {
        if ((e as Error).name !== "AbortError") propsRef.current.alResultado(0);
      }
    }

    // Espera 300 ms quieto antes de pedir: arrastrar el mapa no dispara una petición por cuadro.
    const cargarPronto = () => {
      clearTimeout(espera);
      espera = setTimeout(cargar, 300);
    };
    recargarRef.current = cargarPronto;

    mapa.on("load", () => {
      nombresEnEspanol(mapa);
      mapa.addSource("negocios", { type: "geojson", data: VACIO });
      mapa.addLayer({
        id: "grupos",
        type: "circle",
        source: "negocios",
        filter: ["==", ["get", "tipo"], "grupo"],
        paint: {
          "circle-color": NARANJA,
          "circle-opacity": 0.88,
          "circle-radius": ["step", ["get", "cantidad"], 15, 10, 19, 50, 25],
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      mapa.addLayer({
        id: "grupos-conteo",
        type: "symbol",
        source: "negocios",
        filter: ["==", ["get", "tipo"], "grupo"],
        layout: { "text-field": ["to-string", ["get", "cantidad"]], "text-font": ["Noto Sans Bold"], "text-size": 13 },
        paint: { "text-color": "#ffffff" },
      });
      mapa.addLayer({
        id: "puntos",
        type: "circle",
        source: "negocios",
        filter: ["==", ["get", "tipo"], "punto"],
        paint: {
          // Abierto ahora = naranja; cerrado o sin horario = gris.
          "circle-color": ["case", ["==", ["get", "abierto"], 1], NARANJA, GRIS],
          "circle-radius": 8,
          "circle-stroke-color": "#ffffff",
          "circle-stroke-width": 2,
        },
      });
      mapa.addLayer({
        id: "punto-elegido",
        type: "circle",
        source: "negocios",
        filter: ["==", ["get", "id"], -1],
        paint: { "circle-radius": 13, "circle-color": "rgba(0,0,0,0)", "circle-stroke-color": NARANJA, "circle-stroke-width": 3 },
      });
      cargar();
    });
    mapa.on("moveend", cargarPronto);

    mapa.on("click", "puntos", (e) => {
      const id = e.features?.[0]?.properties?.id as number | undefined;
      propsRef.current.alElegir(id !== undefined ? (puntos.get(id) ?? null) : null);
    });
    mapa.on("click", "grupos", (e) => {
      const f = e.features?.[0];
      if (f?.geometry.type === "Point") {
        mapa.easeTo({ center: f.geometry.coordinates as [number, number], zoom: mapa.getZoom() + 2 });
      }
    });
    mapa.on("click", (e) => {
      // Tocar el mapa fuera de un negocio cierra la ficha.
      const tocados = mapa.queryRenderedFeatures(e.point, { layers: ["puntos", "grupos"] });
      if (!tocados.length) propsRef.current.alElegir(null);
    });
    for (const capa of ["puntos", "grupos"]) {
      mapa.on("mouseenter", capa, () => (mapa.getCanvas().style.cursor = "pointer"));
      mapa.on("mouseleave", capa, () => (mapa.getCanvas().style.cursor = ""));
    }

    return () => {
      clearTimeout(espera);
      pedido?.abort();
      mapa.remove();
      mapaRef.current = null;
    };
  }, []);

  // Cambió la categoría o se conoce la ubicación: se vuelve a buscar.
  useEffect(() => {
    recargarRef.current();
  }, [props.categoria, props.desde]);

  // Resalta el negocio elegido.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (mapa?.getLayer("punto-elegido")) mapa.setFilter("punto-elegido", ["==", ["get", "id"], props.elegido ?? -1]);
  }, [props.elegido]);

  // El CSS de MapLibre le pone position: relative a su contenedor; por eso va dentro de una capa absoluta.
  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="h-full w-full" aria-label="Mapa de negocios de Lima" role="region" />
    </div>
  );
}
