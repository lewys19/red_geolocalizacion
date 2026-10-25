"use client";

import Link from "next/link";

import { useSesion } from "@/lib/usarSesion";

import { Logo } from "./Logo";

export function Encabezado() {
  const sesion = useSesion();
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-borde bg-superficie px-4">
      <Logo />
      <nav className="flex items-center gap-2 text-sm">
        {sesion ? (
          <>
            {(sesion.usuario.rol === "operador" || sesion.usuario.rol === "superadmin") && (
              <Link href="/admin" className="px-2 py-1.5 text-texto-2 hover:text-texto">
                Panel
              </Link>
            )}
            <Link href="/cuenta" className="rounded-full bg-marca-suave px-3 py-1.5 font-medium text-marca-fuerte">
              {sesion.usuario.nombre.split(" ")[0]}
            </Link>
          </>
        ) : (
          <>
            <Link href="/ingresar" className="px-2 py-1.5 text-texto-2 hover:text-texto">
              Ingresar
            </Link>
            <Link href="/registro" className="rounded-full bg-marca px-3 py-1.5 font-medium text-sobre-marca hover:bg-marca-fuerte">
              Crear cuenta
            </Link>
          </>
        )}
      </nav>
    </header>
  );
}
