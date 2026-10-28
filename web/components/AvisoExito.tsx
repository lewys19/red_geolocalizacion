"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/** Aviso verde fijo arriba de la pantalla (como un "alert" de Bootstrap), hasta que la persona lo cierre. */
export function AvisoExito({ titulo, children, alCerrar }: { titulo: string; children?: ReactNode; alCerrar: () => void }) {
  return (
    <div className="fixed inset-x-0 top-[4.5rem] z-50 flex justify-center px-4">
      <div
        role="status"
        className="aviso-exito flex w-full max-w-xl items-start gap-3 rounded-xl border border-green-600/30 bg-green-50 p-4 text-green-900 shadow-lg dark:bg-green-950 dark:text-green-100"
      >
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
          ✓
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{titulo}</p>
          {children && <div className="mt-0.5 text-sm">{children}</div>}
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <button type="button" onClick={alCerrar} className="rounded-lg bg-green-600 px-3 py-1.5 font-semibold text-white hover:bg-green-700">
              Seguir aquí
            </button>
            <Link href="/" className="rounded-lg border border-green-600/40 px-3 py-1.5 font-semibold hover:bg-green-100 dark:hover:bg-green-900">
              Ir al inicio
            </Link>
          </div>
        </div>
        <button type="button" onClick={alCerrar} aria-label="Cerrar aviso" className="text-xl leading-none opacity-60 hover:opacity-100">
          ×
        </button>
      </div>
    </div>
  );
}
