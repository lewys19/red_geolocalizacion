// Ventana flotante de ingreso / registro: cualquier botón la abre sin cambiar de página.
"use client";

import { useSyncExternalStore } from "react";

export type Vista = "ingresar" | "registro";

export interface EstadoAcceso {
  vista: Vista | null;
  aviso: string | null; // p. ej. "Se canceló el ingreso con Google"
}

const CERRADA: EstadoAcceso = { vista: null, aviso: null };
let estado: EstadoAcceso = CERRADA;
const oyentes = new Set<() => void>();

function cambiar(nuevo: EstadoAcceso): void {
  estado = nuevo;
  oyentes.forEach((avisar) => avisar());
}

export function abrirAcceso(vista: Vista = "ingresar", aviso: string | null = null): void {
  cambiar({ vista, aviso });
}

export function cerrarAcceso(): void {
  if (estado.vista) cambiar(CERRADA);
}

function suscribir(avisar: () => void): () => void {
  oyentes.add(avisar);
  return () => oyentes.delete(avisar);
}

export function useAcceso(): EstadoAcceso {
  return useSyncExternalStore(suscribir, () => estado, () => CERRADA);
}
