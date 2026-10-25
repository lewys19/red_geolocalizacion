// Piezas comunes de los formularios de cuenta.
import type { InputHTMLAttributes, ReactNode } from "react";

export function Campo({ etiqueta, ...props }: { etiqueta: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-texto-2">{etiqueta}</span>
      <input
        {...props}
        className="w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-texto outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/30"
      />
    </label>
  );
}

export function Tarjeta({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-10">
      <h1 className="mb-6 text-center text-2xl font-bold tracking-tight">{titulo}</h1>
      <div className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">{children}</div>
    </div>
  );
}

export function Boton({ cargando, children }: { cargando: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={cargando}
      className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-sobre-marca transition hover:bg-marca-fuerte disabled:opacity-60"
    >
      {cargando ? "Un momento…" : children}
    </button>
  );
}

export function MensajeError({ mensaje }: { mensaje: string | null }) {
  if (!mensaje) return null;
  return (
    <p role="alert" className="rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
      {mensaje}
    </p>
  );
}
