"use client";

// Dirección ↔ pin del negocio. Las dos son ayudas: el dueño siempre puede corregir el texto o mover el pin.
import { useEffect, useRef, useState } from "react";

import { ErrorApi, pedir } from "./api";

export interface Sugerencia {
  direccion: string | null;
  distrito: string | null;
}

export interface Lugar extends Sugerencia {
  lng: number;
  lat: number;
  completa: string;
}

/**
 * Pin → dirección (reverse geocoding). Solo cuando el dueño movió el pin (`activo`),
 * y esperando 600 ms quieto para no preguntar en cada arrastre.
 */
export function useDireccionDelPin(
  pin: [number, number],
  activo: boolean,
  alLlegar?: (s: Sugerencia) => void,
): Sugerencia | null {
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const alLlegarRef = useRef(alLlegar);
  useEffect(() => {
    alLlegarRef.current = alLlegar;
  });
  useEffect(() => {
    if (!activo) return;
    const espera = setTimeout(() => {
      pedir<Sugerencia>(`/geocoding/inverso?lng=${pin[0].toFixed(6)}&lat=${pin[1].toFixed(6)}`, { conSesion: true })
        .then((s) => {
          setSugerencia(s);
          alLlegarRef.current?.(s);
        })
        .catch(() => setSugerencia(null));
    }, 600);
    return () => clearTimeout(espera);
  }, [pin, activo]);
  return sugerencia;
}

type EstadoBusqueda = { tipo: "buscando" } | { tipo: "ok"; texto: string } | { tipo: "error"; texto: string } | null;

/** Dirección escrita → punto en el mapa (geocoding). */
export function useUbicarDireccion() {
  const [estado, setEstado] = useState<EstadoBusqueda>(null);
  // La última dirección buscada: salir del campo sin cambiarla no vuelve a preguntar.
  const [ultima, setUltima] = useState("");

  async function ubicar(direccion: string, distrito: string): Promise<Lugar | null> {
    const texto = direccion.trim();
    const clave = `${texto}|${distrito}`;
    if (texto.length < 5 || clave === ultima) return null;
    setUltima(clave);
    setEstado({ tipo: "buscando" });
    const p = new URLSearchParams({ direccion: texto });
    if (distrito) p.set("distrito", distrito);
    try {
      const lugar = await pedir<Lugar>(`/geocoding/buscar?${p}`, { conSesion: true });
      setEstado({ tipo: "ok", texto: "Ubicamos la dirección en el mapa. Si el pin no está en la puerta, muévelo." });
      return lugar;
    } catch (e) {
      setEstado({
        tipo: "error",
        texto: e instanceof ErrorApi && e.estado === 404 ? e.message : "No pudimos buscar la dirección. Ubica el pin en el mapa.",
      });
      return null;
    }
  }

  return { ubicar, estado };
}

/** Texto de ayuda bajo el campo Dirección. */
export function textoBusqueda(estado: EstadoBusqueda): { texto: string; error: boolean } | null {
  if (!estado) return null;
  if (estado.tipo === "buscando") return { texto: "Buscando la dirección en el mapa…", error: false };
  return { texto: estado.texto, error: estado.tipo === "error" };
}
