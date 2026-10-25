"use client";

import { useState } from "react";

import { ErrorApi, pedir } from "@/lib/api";
import type { Foto } from "@/lib/tipos";

import { MensajeError } from "./Formulario";

const MAX_FOTOS = 10;

export function PanelFotos({ negocioId, fotos, alCambiar }: { negocioId: number; fotos: Foto[]; alCambiar: (f: Foto[]) => void }) {
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subir(archivos: FileList | null) {
    if (!archivos?.length) return;
    setError(null);
    let actuales = fotos;
    const lista = Array.from(archivos).slice(0, MAX_FOTOS - fotos.length);
    for (const [i, archivo] of lista.entries()) {
      setSubiendo(`Subiendo ${i + 1} de ${lista.length}…`);
      const datos = new FormData();
      datos.append("foto", archivo);
      try {
        const foto = await pedir<Foto>(`/negocios/${negocioId}/fotos`, { metodo: "POST", conSesion: true, cuerpo: datos });
        actuales = [...actuales, foto];
        alCambiar(actuales);
      } catch (err) {
        setError(`${archivo.name}: ${err instanceof ErrorApi ? err.message : "no se pudo subir."}`);
      }
    }
    setSubiendo(null);
  }

  async function borrar(foto: Foto) {
    if (!window.confirm("¿Borrar esta foto?")) return;
    await pedir(`/negocios/${negocioId}/fotos/${foto.id}`, { metodo: "DELETE", conSesion: true });
    alCambiar(fotos.filter((f) => f.id !== foto.id));
  }

  return (
    <div className="space-y-4">
      <label
        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed border-borde px-4 py-6 text-center hover:border-marca ${
          fotos.length >= MAX_FOTOS || subiendo ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <span className="font-semibold">{subiendo ?? "Subir fotos"}</span>
        <span className="text-sm text-texto-2">
          JPG, PNG o WebP de hasta 8 MB · {fotos.length} de {MAX_FOTOS}. Quitamos la ubicación GPS de tus fotos.
        </span>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="sr-only"
          onChange={(e) => {
            subir(e.target.files);
            e.target.value = "";
          }}
        />
      </label>
      <MensajeError mensaje={error} />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {fotos.map((f, i) => (
          <li key={f.id} className="relative">
            {/* Fotos ya optimizadas por la API (WebP de 1600 px). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" loading="lazy" />
            <button
              type="button"
              onClick={() => borrar(f)}
              className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white hover:bg-black/80"
            >
              Borrar
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
