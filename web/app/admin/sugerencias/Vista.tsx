"use client";

import { useCallback, useEffect, useState } from "react";

import { Migas, SinPermiso, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, BotonAccion, Caja, GrupoAcciones, Paginacion, TD, TH } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import type { PaginaSugerencias, Sugerencia } from "@/lib/tipos";

/** Fecha y hora de Lima: "28/10/2026, 15:42". */
function fechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "short", timeStyle: "short" });
}

export function Sugerencias() {
  const yo = usePanel();
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<PaginaSugerencias | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    pedir<PaginaSugerencias>(`/admin/sugerencias?pagina=${pagina}&por_pagina=20`, { conSesion: true })
      .then((d) => (setDatos(d), setError(null)))
      .catch((e) => setError(e instanceof ErrorApi ? e.message : "No se pudieron cargar las sugerencias."));
  }, [pagina]);

  useEffect(() => {
    if (puede(yo, "sugerencias.ver")) cargar();
  }, [yo, cargar]);

  if (!puede(yo, "sugerencias.ver")) return <SinPermiso />;

  async function borrar(s: Sugerencia) {
    if (!window.confirm(`¿Borrar la sugerencia #${s.id}?`)) return;
    setOk(null);
    try {
      await pedir(`/admin/sugerencias/${s.id}`, { metodo: "DELETE", conSesion: true });
      setOk(`Se borró la sugerencia #${s.id}.`);
      cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo borrar.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Sugerencias" }]} />
      <h1 className="mb-2 text-2xl font-bold tracking-tight">Sugerencias</h1>
      <p className="mb-4 text-sm text-texto-2">
        Lo que la gente envía desde la notita del Inicio. Cada envío es una fila; la más reciente, arriba.
      </p>
      <div className="mb-3 space-y-2">
        <Aviso ok={ok} error={error} />
      </div>
      <Caja>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-stone-500 text-white dark:bg-stone-700">
              <tr>
                <th className={TH}>ID</th>
                <th className={TH}>Fecha de envío</th>
                <th className={TH}>Texto</th>
                <th className={TH}>Enviada por</th>
                <th className={TH}>Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {datos === null ? (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-texto-2`}>
                    Cargando…
                  </td>
                </tr>
              ) : datos.sugerencias.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-texto-2`}>
                    Todavía no hay sugerencias.
                  </td>
                </tr>
              ) : (
                datos.sugerencias.map((s) => (
                  <tr key={s.id} className="align-top odd:bg-fondo/60">
                    <td className={`${TD} font-mono text-xs`}>#{s.id}</td>
                    <td className={`${TD} whitespace-nowrap tabular-nums`}>{fechaHora(s.creado_en)}</td>
                    <td className={`${TD} max-w-xl whitespace-pre-wrap break-words`}>{s.texto}</td>
                    <td className={TD}>
                      {s.usuario ? (
                        <a
                          href={`/${s.usuario.username}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-marca-fuerte hover:underline"
                        >
                          @{s.usuario.username}
                        </a>
                      ) : (
                        <span className="text-texto-2">Visitante</span>
                      )}
                    </td>
                    <td className={TD}>
                      <GrupoAcciones>
                        <BotonAccion tipo="eliminar" titulo="Borrar" onClick={() => borrar(s)} />
                      </GrupoAcciones>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {datos && (
          <Paginacion pagina={datos.pagina} porPagina={datos.por_pagina} total={datos.total} alCambiar={setPagina} />
        )}
      </Caja>
    </div>
  );
}
