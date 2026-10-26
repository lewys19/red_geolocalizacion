"use client";

// Ubicación de quien busca, compartida entre Inicio, Mapa y Categorías.
// Solo vive en esta pestaña del navegador (sessionStorage): se borra al cerrarla y nunca se envía
// a la API salvo dentro de cada búsqueda.
import { useSyncExternalStore } from "react";

export type LngLat = [number, number];

const CLAVE = "altoque.ubicacion";
const oyentes = new Set<() => void>();
let cacheTexto: string | null = null;
let cache: LngLat | null = null;

function leer(): LngLat | null {
  let texto: string | null = null;
  try {
    texto = sessionStorage.getItem(CLAVE);
  } catch {
    texto = null;
  }
  if (texto !== cacheTexto) {
    cacheTexto = texto;
    try {
      cache = texto ? (JSON.parse(texto) as LngLat) : null;
    } catch {
      cache = null;
    }
  }
  return cache;
}

export function guardarUbicacion(lngLat: LngLat | null): void {
  try {
    if (lngLat) sessionStorage.setItem(CLAVE, JSON.stringify(lngLat));
    else sessionStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento, la ubicación dura solo en esta pantalla.
  }
  oyentes.forEach((avisar) => avisar());
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
}

export function useUbicacion(): LngLat | null {
  return useSyncExternalStore(suscribir, leer, () => null);
}

export type ResultadoGps = "ok" | "no-disponible";

/** Pide el GPS. Los navegadores solo lo dan en sitios seguros (https o localhost). */
export function pedirGps(): Promise<ResultadoGps> {
  return new Promise((resolver) => {
    if (!window.isSecureContext || !navigator.geolocation) {
      resolver("no-disponible");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        guardarUbicacion([coords.longitude, coords.latitude]);
        resolver("ok");
      },
      () => resolver("no-disponible"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  });
}
