"use client";

import { type FormEvent, useState } from "react";

import { ErrorApi, pedir } from "@/lib/api";
import { precio } from "@/lib/formato";
import type { Producto } from "@/lib/tipos";

import { MensajeError } from "./Formulario";

/** "18.50" o "18,50" → 1850 céntimos; vacío → null (consultar). */
export function aCentimos(texto: string): number | null | undefined {
  const limpio = texto.trim().replace(",", ".").replace(/^s\/\s*/i, "");
  if (!limpio) return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) && valor >= 0 ? Math.round(valor * 100) : undefined;
}

const INPUT = "rounded-lg border border-borde bg-superficie px-3 py-2 outline-none focus:border-marca";

export function PanelCarta({
  negocioId,
  productos,
  alCambiar,
}: {
  negocioId: number;
  productos: Producto[];
  alCambiar: (p: Producto[]) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [monto, setMonto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const ruta = `/negocios/${negocioId}/productos`;

  async function agregar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const centimos = aCentimos(monto);
    if (centimos === undefined) {
      setError("Escribe el precio en soles, por ejemplo 18.50.");
      return;
    }
    try {
      const nuevo = await pedir<Producto>(ruta, {
        metodo: "POST",
        conSesion: true,
        cuerpo: { nombre, precio_centimos: centimos, orden: productos.length },
      });
      alCambiar([...productos, nuevo]);
      setNombre("");
      setMonto("");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar.");
    }
  }

  async function cambiar(p: Producto, cambios: Partial<Producto>) {
    try {
      const actualizado = await pedir<Producto>(`${ruta}/${p.id}`, { metodo: "PATCH", conSesion: true, cuerpo: cambios });
      alCambiar(productos.map((x) => (x.id === p.id ? actualizado : x)));
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar.");
    }
  }

  async function borrar(p: Producto) {
    if (!window.confirm(`¿Borrar «${p.nombre}» de la carta?`)) return;
    await pedir(`${ruta}/${p.id}`, { metodo: "DELETE", conSesion: true });
    alCambiar(productos.filter((x) => x.id !== p.id));
  }

  return (
    <div className="space-y-4">
      <form onSubmit={agregar} className="flex flex-wrap gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          required
          minLength={2}
          maxLength={120}
          placeholder="1/4 de pollo a la brasa"
          aria-label="Nombre del producto"
          className={`${INPUT} min-w-0 flex-1`}
        />
        <input
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          inputMode="decimal"
          placeholder="S/ 18.50"
          aria-label="Precio en soles (vacío = consultar)"
          className={`${INPUT} w-28`}
        />
        <button type="submit" className="rounded-lg bg-marca px-4 py-2 font-semibold text-sobre-marca hover:bg-marca-fuerte">
          Agregar
        </button>
      </form>
      <MensajeError mensaje={error} />
      {productos.length ? (
        <ul className="divide-y divide-borde rounded-xl border border-borde">
          {productos.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className={`min-w-0 flex-1 ${p.disponible ? "" : "opacity-50"}`}>
                <p className="truncate font-medium">{p.nombre}</p>
                <p className="text-sm text-texto-2">
                  {precio(p.precio_centimos)}
                  {!p.disponible && " · agotado"}
                </p>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-texto-2">
                <input
                  type="checkbox"
                  checked={p.disponible}
                  onChange={(e) => cambiar(p, { disponible: e.target.checked })}
                  className="h-4 w-4 accent-[var(--marca)]"
                />
                Hay
              </label>
              <button
                type="button"
                onClick={() => {
                  const nuevo = window.prompt("Nuevo precio en soles (vacío = consultar)", p.precio_centimos === null ? "" : (p.precio_centimos / 100).toFixed(2));
                  if (nuevo === null) return;
                  const c = aCentimos(nuevo);
                  if (c === undefined) setError("Precio no válido.");
                  else cambiar(p, { precio_centimos: c });
                }}
                className="text-sm font-medium text-marca-fuerte hover:underline"
              >
                Precio
              </button>
              <button type="button" onClick={() => borrar(p)} className="text-sm text-error hover:underline">
                Borrar
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-texto-2">Agrega lo que vendes con su precio. Si el precio varía, déjalo vacío: dirá «Consultar».</p>
      )}
    </div>
  );
}
