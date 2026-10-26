"use client";

// Foto de perfil y portada del negocio, con vista previa tal como se verá en su página.
import { useState } from "react";

import { ErrorApi, pedir } from "@/lib/api";

import { MensajeError } from "./Formulario";

type Tipo = "logo" | "portada";

function BotonArchivo({ texto, ocupado, alElegir }: { texto: string; ocupado: boolean; alElegir: (f: File) => void }) {
  return (
    <label
      className={`cursor-pointer rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/75 ${
        ocupado ? "pointer-events-none opacity-60" : ""
      }`}
    >
      {ocupado ? "Subiendo…" : texto}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => {
          const archivo = e.target.files?.[0];
          if (archivo) alElegir(archivo);
          e.target.value = "";
        }}
      />
    </label>
  );
}

export function PanelPerfil({
  negocioId,
  nombre,
  logo,
  portada,
  alCambiar,
}: {
  negocioId: number;
  nombre: string;
  logo: string | null;
  portada: string | null;
  alCambiar: (tipo: Tipo, url: string | null) => void;
}) {
  const [ocupado, setOcupado] = useState<Tipo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(tipo: Tipo, archivo: File | null) {
    setError(null);
    setOcupado(tipo);
    try {
      let r: { url: string | null };
      if (archivo) {
        const datos = new FormData();
        datos.append("foto", archivo);
        r = await pedir(`/negocios/${negocioId}/imagen/${tipo}`, { metodo: "PUT", conSesion: true, cuerpo: datos });
      } else {
        r = await pedir(`/negocios/${negocioId}/imagen/${tipo}`, { metodo: "DELETE", conSesion: true });
      }
      alCambiar(tipo, r.url);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo subir. Revisa tu internet.");
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-texto-2">
        Así se verá la cabecera de tu página. La portada se recorta en formato ancho (3:1) y la foto de perfil en
        círculo. JPG, PNG o WebP de hasta 8 MB.
      </p>

      <div className="overflow-hidden rounded-2xl border border-borde">
        <div className="relative aspect-[3/1] bg-gradient-to-br from-marca via-orange-400 to-amber-300">
          {portada && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={portada} alt="Portada" className="h-full w-full object-cover" />
          )}
          <div className="absolute right-2 bottom-2 flex gap-2">
            <BotonArchivo texto={portada ? "Cambiar portada" : "Subir portada"} ocupado={ocupado === "portada"} alElegir={(f) => cambiar("portada", f)} />
            {portada && (
              <button type="button" onClick={() => cambiar("portada", null)} className="rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white hover:bg-black/75">
                Quitar
              </button>
            )}
          </div>
        </div>
        <div className="flex items-end gap-4 px-4 pb-4">
          <div className="-mt-10 shrink-0 rounded-full bg-superficie p-1">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logo} alt="Foto de perfil" className="h-24 w-24 rounded-full object-cover" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-marca text-4xl font-bold text-sobre-marca">
                {nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2 pb-1 [&_label]:bg-marca [&_label]:hover:bg-marca-fuerte">
            <BotonArchivo texto={logo ? "Cambiar foto de perfil" : "Subir foto de perfil"} ocupado={ocupado === "logo"} alElegir={(f) => cambiar("logo", f)} />
            {logo && (
              <button type="button" onClick={() => cambiar("logo", null)} className="rounded-full border border-borde px-3 py-1.5 text-xs font-semibold hover:border-error hover:text-error">
                Quitar
              </button>
            )}
          </div>
        </div>
      </div>
      <MensajeError mensaje={error} />
    </div>
  );
}
