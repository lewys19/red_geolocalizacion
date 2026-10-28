"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Fragment, useCallback, useEffect, useState } from "react";

import { MiniMapa } from "@/components/MiniMapa";
import { Migas, SinPermiso, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, BotonAccion, Caja, GrupoAcciones, TD, TH } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import { DIAS, hora } from "@/lib/formato";
import type { EstadoNegocio, NegocioDetalle } from "@/lib/tipos";

const ESTADOS: { valor: EstadoNegocio; texto: string }[] = [
  { valor: "pendiente", texto: "Por revisar" },
  { valor: "rechazado", texto: "Rechazados" },
  { valor: "aprobado", texto: "Aprobados" },
];

function Detalle({ n }: { n: NegocioDetalle }) {
  return (
    <div className="grid gap-4 p-4 text-sm md:grid-cols-2">
      <div className="space-y-1.5">
        {n.descripcion && <p>{n.descripcion}</p>}
        <p className="text-texto-2">
          {n.direccion}
          {n.referencia && ` (${n.referencia})`}
        </p>
        <p>
          {n.whatsapp ? `WhatsApp +${n.whatsapp}` : "Sin WhatsApp"}
          {n.telefono && ` · Tel. +${n.telefono}`}
          {n.tiene_delivery && " · Delivery"}
        </p>
        <p className="text-xs text-texto-2">
          {n.horarios.length
            ? n.horarios.map((h) => `${DIAS[h.dia_semana].slice(0, 3)} ${hora(h.abre)}–${hora(h.cierra)}`).join(" · ")
            : "Sin horario"}
        </p>
        {n.estado === "aprobado" && (
          <Link href={`/n/${n.slug}`} target="_blank" className="inline-block text-marca-fuerte underline">
            Ver página pública
          </Link>
        )}
      </div>
      {n.ubicacion && <MiniMapa lng={n.ubicacion.lng} lat={n.ubicacion.lat} nombre={n.nombre} />}
    </div>
  );
}

function Decision({ n, alDecidir, alError }: { n: NegocioDetalle; alDecidir: (texto: string) => void; alError: (e: string) => void }) {
  const [rechazando, setRechazando] = useState(false);
  const [motivo, setMotivo] = useState("");

  async function decidir(aprobar: boolean) {
    try {
      await pedir(`/admin/negocios/${n.id}/${aprobar ? "aprobar" : "rechazar"}`, {
        metodo: "POST",
        conSesion: true,
        cuerpo: aprobar ? undefined : { motivo },
      });
      alDecidir(`«${n.nombre}» quedó ${aprobar ? "aprobado" : "rechazado"}.`);
    } catch (err) {
      alError(err instanceof ErrorApi ? err.message : "No se pudo guardar.");
    }
  }

  if (rechazando) {
    return (
      <div className="flex min-w-64 flex-col gap-2">
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          rows={2}
          maxLength={300}
          placeholder="Qué debe corregir (lo verá el dueño)"
          aria-label="Motivo del rechazo"
          className="rounded-md border border-borde bg-superficie px-2 py-1.5 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={() => setRechazando(false)} className="rounded-md border border-borde px-2 py-1 text-xs">
            Cancelar
          </button>
          <button
            type="button"
            disabled={motivo.trim().length < 5}
            onClick={() => decidir(false)}
            className="flex-1 rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
          >
            Rechazar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => decidir(true)} className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">
        Aprobar
      </button>
      {n.estado !== "rechazado" && (
        <button type="button" onClick={() => setRechazando(true)} className="rounded-md border border-borde px-3 py-1.5 text-xs font-semibold hover:border-red-600">
          Rechazar
        </button>
      )}
    </div>
  );
}

export function Negocios() {
  const yo = usePanel();
  // El dashboard enlaza con ?estado=aprobado.
  const pedido = useSearchParams().get("estado");
  const [estado, setEstado] = useState<EstadoNegocio>(ESTADOS.find((e) => e.valor === pedido)?.valor ?? "pendiente");
  const [negocios, setNegocios] = useState<NegocioDetalle[] | null>(null);
  const [abierto, setAbierto] = useState<number | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    pedir<NegocioDetalle[]>(`/admin/negocios?estado=${estado}`, { conSesion: true })
      .then(setNegocios)
      .catch((e) => setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la lista."));
  }, [estado]);

  useEffect(() => {
    if (puede(yo, "negocios.ver")) cargar();
  }, [yo, cargar]);

  if (!puede(yo, "negocios.ver")) return <SinPermiso />;
  const moderar = puede(yo, "negocios.moderar");
  const columnas = moderar && estado !== "aprobado" ? 6 : 5;

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Negocios" }]} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Negocios</h1>

      <div role="tablist" className="mb-4 inline-flex rounded-lg border border-borde bg-superficie p-1 text-sm font-medium shadow-sm">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            role="tab"
            type="button"
            aria-selected={estado === e.valor}
            onClick={() => {
              setNegocios(null);
              setAbierto(null);
              setOk(null);
              setEstado(e.valor);
            }}
            className={`rounded-md px-4 py-1.5 ${estado === e.valor ? "bg-marca text-sobre-marca" : "text-texto-2 hover:text-texto"}`}
          >
            {e.texto}
          </button>
        ))}
      </div>

      <div className="mb-3 space-y-2">
        <Aviso ok={ok} error={error} />
      </div>

      <Caja>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-stone-500 text-white dark:bg-stone-700">
              <tr>
                <th className={TH}>Ver</th>
                <th className={TH}>Nombre</th>
                <th className={TH}>Categoría</th>
                <th className={TH}>Distrito</th>
                <th className={TH}>{estado === "rechazado" ? "Motivo" : "Dirección"}</th>
                {columnas === 6 && <th className={TH}>Decisión</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {negocios === null ? (
                <tr>
                  <td colSpan={columnas} className={`${TD} text-center text-texto-2`}>
                    Cargando…
                  </td>
                </tr>
              ) : negocios.length === 0 ? (
                <tr>
                  <td colSpan={columnas} className={`${TD} text-center text-texto-2`}>
                    No hay negocios en esta lista.
                  </td>
                </tr>
              ) : (
                negocios.map((n) => (
                  <Fragment key={n.id}>
                    <tr className="odd:bg-fondo/60">
                      <td className={TD}>
                        <GrupoAcciones>
                          <BotonAccion tipo="ver" titulo="Ver detalle" onClick={() => setAbierto(abierto === n.id ? null : n.id)} />
                        </GrupoAcciones>
                      </td>
                      <td className={`${TD} font-medium`}>{n.nombre}</td>
                      <td className={TD}>{n.categoria}</td>
                      <td className={TD}>{n.distrito}</td>
                      <td className={`${TD} ${estado === "rechazado" ? "text-error" : ""}`}>
                        {estado === "rechazado" ? n.motivo_rechazo : n.direccion}
                      </td>
                      {columnas === 6 && (
                        <td className={TD}>
                          <Decision
                            n={n}
                            alError={setError}
                            alDecidir={(texto) => {
                              setOk(texto);
                              setError(null);
                              cargar();
                            }}
                          />
                        </td>
                      )}
                    </tr>
                    {abierto === n.id && (
                      <tr>
                        <td colSpan={columnas} className="bg-fondo">
                          <Detalle n={n} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Caja>
    </div>
  );
}
