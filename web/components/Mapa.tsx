"use client";

import { type GeoJSONSource, Map as MapaLibre, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";

import { aPie, coordenadas, distancia } from "@/lib/formato";
import { circulo, limitesDelCirculo } from "@/lib/geo";
import { ESTILO, LIMA, TEXTOS_MAPA, nombresEnEspanol } from "@/lib/mapaBase";
import type { PuntoMapa } from "@/lib/tipos";

const NARANJA = "#ea580c";
// Con muchos pines y el mapa alejado, las etiquetas se tapan: solo se ven al pasar el mouse.
const ZOOM_ETIQUETAS = 14;
const MAX_ETIQUETAS_SIEMPRE = 12;

export interface PropsMapa {
  ubicacion: [number, number] | null; // dónde está quien busca
  radio: number; // metros
  puntos: PuntoMapa[];
  alMarcarUbicacion: (lngLat: [number, number]) => void;
  alAbrir: (punto: PuntoMapa) => void;
}

function textoSeguro(texto: string): string {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/** Pin con su etiqueta. Al pasar el mouse se amplía con categoría, distancia, tiempo a pie y coordenadas. */
function crearMarcador(p: PuntoMapa, alAbrir: () => void): HTMLElement {
  const raiz = document.createElement("button");
  raiz.type = "button";
  raiz.className = "marcador-negocio group flex items-center gap-1.5 text-left";
  raiz.setAttribute("aria-label", `${p.nombre}, ${p.distancia_m !== null ? distancia(p.distancia_m) : ""}`);
  const color = p.abierto ? NARANJA : "#a8a29e"; // abierto ahora = naranja; cerrado o sin horario = gris
  raiz.innerHTML = `
    <span class="block h-3.5 w-3.5 shrink-0 rounded-full border-2 border-white shadow" style="background:${color}"></span>
    <span class="etiqueta-negocio rounded-lg border border-borde bg-superficie px-2 py-1 text-xs shadow-md transition-all group-hover:px-3 group-hover:py-2 group-hover:text-sm">
      <span class="block max-w-40 truncate font-semibold group-hover:max-w-64">${textoSeguro(p.nombre)}</span>
      <span class="hidden text-texto-2 group-hover:block">
        ${textoSeguro(p.categoria)} · ${p.abierto === null ? "sin horario" : p.abierto ? "abierto" : "cerrado"}<br>
        ${p.distancia_m !== null ? `${distancia(p.distancia_m)} · ${aPie(p.distancia_m)}<br>` : ""}
        <span class="tabular-nums">${coordenadas(p.lat, p.lng)}</span>
      </span>
    </span>`;
  raiz.addEventListener("mouseenter", () => (raiz.parentElement!.style.zIndex = "10"));
  raiz.addEventListener("mouseleave", () => (raiz.parentElement!.style.zIndex = ""));
  raiz.addEventListener("click", (e) => {
    e.stopPropagation();
    alAbrir();
  });
  return raiz;
}

/** Si dos etiquetas chocan, se queda la del negocio más cercano (los pines vienen ordenados por
 * distancia) y el otro muestra solo su punto; su etiqueta vuelve al pasar el mouse. */
function evitarChoques(marcadores: Marker[]): void {
  const visibles: DOMRect[] = [];
  for (const m of marcadores) m.getElement().classList.remove("etiqueta-tapada");
  for (const m of marcadores) {
    const etiqueta = m.getElement().querySelector(".etiqueta-negocio");
    if (!etiqueta) continue;
    const r = etiqueta.getBoundingClientRect();
    if (r.width === 0) continue; // oculta por el modo "sin etiquetas"
    const choca = visibles.some((v) => r.left < v.right && r.right > v.left && r.top < v.bottom && r.bottom > v.top);
    if (choca) m.getElement().classList.add("etiqueta-tapada");
    else visibles.push(r);
  }
}

function crearPuntoAzul(): HTMLElement {
  const el = document.createElement("div");
  el.className = "h-5 w-5 rounded-full border-[3px] border-white bg-blue-600 shadow-lg ring-8 ring-blue-500/20 cursor-grab";
  el.title = "Estás aquí (puedes arrastrarlo)";
  return el;
}

export function Mapa({ ubicacion, radio, puntos, alMarcarUbicacion, alAbrir }: PropsMapa) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<MapaLibre | null>(null);
  // Tareas que esperan a que cargue el estilo del mapa (por ejemplo, dibujar el radio).
  const listoRef = useRef(false);
  const pendientesRef = useRef<(() => void)[]>([]);
  const yoRef = useRef<Marker | null>(null);
  const marcadoresRef = useRef<Marker[]>([]);
  // Los eventos del mapa leen siempre la versión actual de estos valores.
  const actual = useRef({ ubicacion, alMarcarUbicacion, alAbrir, cantidad: puntos.length });
  useEffect(() => {
    actual.current = { ubicacion, alMarcarUbicacion, alAbrir, cantidad: puntos.length };
  });

  // Crear el mapa (una sola vez).
  useEffect(() => {
    if (!contenedor.current) return;
    const mapa = new MapaLibre({ container: contenedor.current, style: ESTILO, center: LIMA, zoom: 12, locale: TEXTOS_MAPA });
    mapaRef.current = mapa;
    mapa.addControl(new NavigationControl({ showCompass: false }), "bottom-right");

    const etiquetas = () => {
      const pocas = actual.current.cantidad <= MAX_ETIQUETAS_SIEMPRE;
      contenedor.current?.classList.toggle("sin-etiquetas", !pocas && mapa.getZoom() < ZOOM_ETIQUETAS);
    };
    mapa.on("zoomend", etiquetas);
    mapa.on("moveend", () => evitarChoques(marcadoresRef.current));

    mapa.on("load", () => {
      nombresEnEspanol(mapa);
      mapa.addSource("radio", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      mapa.addLayer({ id: "radio-relleno", type: "fill", source: "radio", paint: { "fill-color": NARANJA, "fill-opacity": 0.06 } });
      mapa.addLayer({
        id: "radio-borde",
        type: "line",
        source: "radio",
        paint: { "line-color": NARANJA, "line-width": 2, "line-dasharray": [2, 2] },
      });
      listoRef.current = true;
      pendientesRef.current.splice(0).forEach((tarea) => tarea());
    });

    // Sin ubicación todavía: tocar el mapa marca dónde está la persona (respaldo si no hay GPS).
    mapa.on("click", (e) => {
      if (!actual.current.ubicacion) actual.current.alMarcarUbicacion([e.lngLat.lng, e.lngLat.lat]);
    });

    return () => {
      marcadoresRef.current.forEach((m) => m.remove());
      mapa.remove();
      mapaRef.current = null;
      listoRef.current = false;
    };
  }, []);

  // Mi ubicación y el círculo del radio; el mapa se acomoda para mostrar todo el círculo.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa || !ubicacion) return;
    const dibujar = () => {
      if (!yoRef.current) {
        yoRef.current = new Marker({ element: crearPuntoAzul(), draggable: true }).setLngLat(ubicacion).addTo(mapa);
        yoRef.current.on("dragend", () => {
          const { lng, lat } = yoRef.current!.getLngLat();
          actual.current.alMarcarUbicacion([lng, lat]);
        });
      } else {
        yoRef.current.setLngLat(ubicacion);
      }
      mapa.getSource<GeoJSONSource>("radio")?.setData({
        type: "Feature",
        properties: {},
        geometry: { type: "Polygon", coordinates: [circulo(ubicacion[0], ubicacion[1], radio)] },
      });
      // Deja libre arriba (buscador) y abajo (lista de resultados).
      mapa.fitBounds(limitesDelCirculo(ubicacion[0], ubicacion[1], radio), {
        padding: { top: 150, bottom: 300, left: 30, right: 30 },
        maxZoom: 16,
        duration: 600,
      });
    };
    if (listoRef.current) dibujar();
    else pendientesRef.current.push(dibujar);
  }, [ubicacion, radio]);

  // Pines de los negocios.
  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    marcadoresRef.current.forEach((m) => m.remove());
    marcadoresRef.current = puntos.map((p) =>
      new Marker({ element: crearMarcador(p, () => actual.current.alAbrir(p)), anchor: "left", offset: [-7, 0] })
        .setLngLat([p.lng, p.lat])
        .addTo(mapa),
    );
    contenedor.current?.classList.toggle(
      "sin-etiquetas",
      puntos.length > MAX_ETIQUETAS_SIEMPRE && mapa.getZoom() < ZOOM_ETIQUETAS,
    );
    requestAnimationFrame(() => evitarChoques(marcadoresRef.current));
  }, [puntos]);

  // El CSS de MapLibre le pone position: relative a su contenedor; por eso va dentro de una capa absoluta.
  return (
    <div className="absolute inset-0">
      <div ref={contenedor} className="h-full w-full" aria-label="Mapa de negocios cercanos" role="region" />
    </div>
  );
}
