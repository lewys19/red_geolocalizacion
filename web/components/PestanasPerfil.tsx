"use client";

// Pestañas del perfil. Todo el contenido viene armado del servidor (Google lo lee completo);
// aquí solo se elige cuál se ve.
import { type ReactNode, useState } from "react";

export function PestanasPerfil({ pestanas }: { pestanas: { titulo: string; contenido: ReactNode }[] }) {
  const [actual, setActual] = useState(0);
  return (
    <div className="mt-4">
      <div role="tablist" aria-label="Secciones del perfil" className="flex overflow-x-auto border-b border-borde [scrollbar-width:none]">
        {pestanas.map((p, i) => (
          <button
            key={p.titulo}
            role="tab"
            type="button"
            id={`pestana-${i}`}
            aria-selected={actual === i}
            aria-controls={`panel-${i}`}
            onClick={() => setActual(i)}
            className={`relative flex-1 whitespace-nowrap px-4 py-3 text-sm font-semibold transition ${
              actual === i ? "text-texto" : "text-texto-2 hover:bg-fondo hover:text-texto"
            }`}
          >
            {p.titulo}
            {actual === i && <span className="absolute inset-x-1/4 bottom-0 h-1 rounded-full bg-marca" />}
          </button>
        ))}
      </div>
      {pestanas.map((p, i) => (
        <div key={p.titulo} role="tabpanel" id={`panel-${i}`} aria-labelledby={`pestana-${i}`} hidden={actual !== i} className="pt-4">
          {p.contenido}
        </div>
      ))}
    </div>
  );
}
