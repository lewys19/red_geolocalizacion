"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import { Migas, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, Caja } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import type { AnuncioAdmin } from "@/lib/tipos";

const ENTRADA = "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm outline-none focus:border-marca";

function mensaje(e: unknown, otro: string): string {
  return e instanceof ErrorApi ? e.message : otro;
}

/** Un espacio publicitario: imagen, texto alternativo, enlace y si se muestra. */
function Espacio({ inicial, gestiona }: { inicial: AnuncioAdmin; gestiona: boolean }) {
  const [anuncio, setAnuncio] = useState(inicial);
  const [titulo, setTitulo] = useState(inicial.titulo ?? "");
  const [enlace, setEnlace] = useState(inicial.enlace ?? "");
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ruta = `/admin/anuncios/${anuncio.posicion}`;

  async function hacer(accion: () => Promise<AnuncioAdmin>, exito: string) {
    setOk(null);
    setError(null);
    setOcupado(true);
    try {
      setAnuncio(await accion());
      setOk(exito);
    } catch (e) {
      setError(mensaje(e, "No se pudo guardar."));
    } finally {
      setOcupado(false);
    }
  }

  function subir(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("foto", archivo);
    hacer(() => pedir<AnuncioAdmin>(`${ruta}/imagen`, { metodo: "PUT", conSesion: true, cuerpo }), "Imagen subida.");
  }

  function guardar(activo: boolean) {
    return (e?: FormEvent) => {
      e?.preventDefault();
      hacer(
        () =>
          pedir<AnuncioAdmin>(ruta, {
            metodo: "PUT",
            conSesion: true,
            cuerpo: { titulo: titulo || null, enlace: enlace || null, activo },
          }),
        activo ? "Guardado: se muestra en el Inicio." : "Guardado: no se muestra.",
      );
    };
  }

  return (
    <Caja className="flex flex-col">
      <div className="flex items-center justify-between border-b border-borde px-4 py-3">
        <h2 className="font-bold">Banner {anuncio.posicion}</h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            anuncio.activo ? "bg-green-600/15 text-green-700 dark:text-green-400" : "bg-fondo text-texto-2"
          }`}
        >
          {anuncio.activo ? "Visible" : "Oculto"}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        {anuncio.imagen ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={anuncio.imagen} alt="" className="max-h-72 w-full rounded-lg border border-borde object-contain" />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-borde text-center text-sm text-texto-2">
            Sin imagen
            <br />
            (recomendado: 520 × 380 px o más alta)
          </div>
        )}
        {gestiona && (
          <>
            <div className="flex gap-2">
              <label className="flex-1 cursor-pointer rounded-md bg-stone-800 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-stone-900">
                {anuncio.imagen ? "Cambiar imagen" : "Subir imagen"}
                <input type="file" accept="image/*" className="sr-only" onChange={subir} disabled={ocupado} />
              </label>
              {anuncio.imagen && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    hacer(
                      () => pedir<AnuncioAdmin>(`${ruta}/imagen`, { metodo: "DELETE", conSesion: true }),
                      "Imagen quitada; el banner quedó oculto.",
                    )
                  }
                  className="rounded-md border border-borde px-3 py-2 text-sm text-error hover:border-error"
                >
                  Quitar
                </button>
              )}
            </div>
            <form onSubmit={guardar(anuncio.activo)} className="space-y-2">
              <label className="block text-sm">
                <span className="mb-1 block text-texto-2">Texto alternativo (quién anuncia)</span>
                <input className={ENTRADA} maxLength={120} value={titulo} onChange={(e) => setTitulo(e.target.value)} />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block text-texto-2">Enlace al hacer clic (opcional)</span>
                <input
                  className={ENTRADA}
                  maxLength={300}
                  value={enlace}
                  onChange={(e) => setEnlace(e.target.value)}
                  placeholder="https://… o /n/nombre-del-negocio"
                />
              </label>
              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={ocupado}
                  className="flex-1 rounded-md border border-borde px-3 py-2 text-sm font-semibold hover:border-marca"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  disabled={ocupado || (!anuncio.activo && !anuncio.imagen)}
                  onClick={guardar(!anuncio.activo)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold text-white disabled:opacity-50 ${
                    anuncio.activo ? "bg-stone-500 hover:bg-stone-600" : "bg-green-600 hover:bg-green-700"
                  }`}
                >
                  {anuncio.activo ? "Ocultar" : "Mostrar en el Inicio"}
                </button>
              </div>
            </form>
          </>
        )}
        <Aviso ok={ok} error={error} />
      </div>
    </Caja>
  );
}

export function Publicidad() {
  const yo = usePanel();
  const [espacios, setEspacios] = useState<AnuncioAdmin[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedir<AnuncioAdmin[]>("/admin/anuncios", { conSesion: true })
      .then(setEspacios)
      .catch((e) => setError(mensaje(e, "No se pudieron cargar los banners.")));
  }, []);

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Publicidad" }]} />
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Publicidad</h1>
      <p className="mb-4 text-sm text-texto-2">
        Hasta 3 banners en la columna derecha del Inicio, en este orden. Se muestran solo los que estén en{" "}
        <strong>Visible</strong>: puedes usar los 3 o solo 1. Si ninguno está visible, se ven los espacios en blanco de
        «Espacio publicitario».
      </p>
      <Aviso error={error} />
      {espacios && (
        <div className="grid gap-4 md:grid-cols-3">
          {espacios.map((e) => (
            <Espacio key={e.posicion} inicial={e} gestiona={puede(yo, "publicidad.gestionar")} />
          ))}
        </div>
      )}
    </div>
  );
}
