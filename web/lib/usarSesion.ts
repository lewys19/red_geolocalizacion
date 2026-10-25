"use client";

import { useSyncExternalStore } from "react";

import { leerSesion, suscribir, type Sesion } from "./sesion";

/** Sesión actual; la interfaz se actualiza sola al entrar o salir (también desde otra pestaña). */
export function useSesion(): Sesion | null {
  return useSyncExternalStore(suscribir, leerSesion, () => null);
}
