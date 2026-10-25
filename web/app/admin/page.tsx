"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { MensajeError, Tarjeta } from "@/components/Formulario";
import { MiniMapa } from "@/components/MiniMapa";
import { ErrorApi, pedir } from "@/lib/api";
import { DIAS, hora } from "@/lib/formato";
import type { EstadoNegocio, NegocioDetalle } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const ESTADOS: { valor: EstadoNegocio; texto: string }[] = [
  { valor: "pendiente", texto: "Por revisar" },
  { valor: "rechazado", texto: "Rechazados" },
  { valor: "aprobado", texto: "Aprobados" },
];

function TarjetaRevision({ n, alDecidir }: { n: NegocioDetalle; alDecidir: () => void }) {
  const [motivo, setMotivo] = useState("");
  const [rechazando, setRechazando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decidir(aprobar: boolean) {
    setError(null);
    try {
      await pedir(`/admin/negocios/${n.id}/${aprobar ? "aprobar" : "rechazar"}`, {
        metodo: "POST",
        conSesion: true,
        cuerpo: aprobar ? undefined : { motivo },
      });
      alDecidir();
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <li className="rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <h2 className="text-lg font-bold">{n.nombre}</h2>
      <p className="text-sm text-texto-2">
        {n.categoria} · {n.distrito} · {n.direccion}
        {n.referencia && ` (${n.referencia})`}
      </p>
      <p className="mt-1 text-sm">
        {n.whatsapp ? `WhatsApp +${n.whatsapp}` : "Sin WhatsApp"}
        {n.telefono && ` · Tel. +${n.telefono}`}
        {n.tiene_delivery && " · Delivery"}
      </p>
      {n.descripcion && <p className="mt-2 text-sm">{n.descripcion}</p>}
      <p className="mt-2 text-xs text-texto-2">
        {n.horarios.length
          ? n.horarios.map((h) => `${DIAS[h.dia_semana].slice(0, 3)} ${hora(h.abre)}–${hora(h.cierra)}`).join(" · ")
          : "Sin horario"}
      </p>
      {n.ubicacion && (
        <div className="mt-3">
          <MiniMapa lng={n.ubicacion.lng} lat={n.ubicacion.lat} nombre={n.nombre} />
        </div>
      )}
      {n.motivo_rechazo && <p className="mt-2 text-sm text-error">Rechazado: {n.motivo_rechazo}</p>}
      <MensajeError mensaje={error} />
      {n.estado !== "aprobado" &&
        (rechazando ? (
          <div className="mt-3 space-y-2">
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              maxLength={300}
              placeholder="Qué debe corregir (lo verá el dueño)"
              aria-label="Motivo del rechazo"
              className="w-full rounded-lg border border-borde bg-superficie px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="button" onClick={() => setRechazando(false)} className="rounded-lg border border-borde px-3 py-2 text-sm">
                Cancelar
              </button>
              <button
                type="button"
                disabled={motivo.trim().length < 5}
                onClick={() => decidir(false)}
                className="flex-1 rounded-lg bg-error px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Rechazar con este motivo
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setRechazando(true)} className="flex-1 rounded-lg border border-borde px-3 py-2 font-medium hover:border-error">
              Rechazar
            </button>
            <button
              type="button"
              onClick={() => decidir(true)}
              className="flex-1 rounded-lg bg-green-600 px-3 py-2 font-semibold text-white hover:bg-green-700"
            >
              Aprobar
            </button>
          </div>
        ))}
    </li>
  );
}

export default function Admin() {
  const sesion = useSesion();
  const [estado, setEstado] = useState<EstadoNegocio>("pendiente");
  const [negocios, setNegocios] = useState<NegocioDetalle[] | null>(null);
  const [sinPermiso, setSinPermiso] = useState(false);
  const esOperador = sesion?.usuario.rol === "operador" || sesion?.usuario.rol === "superadmin";

  const cargar = useCallback(() => {
    pedir<NegocioDetalle[]>(`/admin/negocios?estado=${estado}`, { conSesion: true })
      .then(setNegocios)
      .catch((err) => (err instanceof ErrorApi && err.estado === 403 ? setSinPermiso(true) : setNegocios([])));
  }, [estado]);

  useEffect(() => {
    if (esOperador) cargar();
  }, [esOperador, cargar]);

  if (!sesion || !esOperador || sinPermiso) {
    return (
      <Tarjeta titulo="Panel de operación">
        <p className="text-center text-texto-2">
          Esta sección es solo para el equipo de Altoque.{" "}
          <Link href="/" className="font-medium text-marca-fuerte underline">
            Volver al mapa
          </Link>
        </p>
      </Tarjeta>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight">Panel de operación</h1>
      <div role="tablist" className="mt-4 flex gap-1 rounded-full bg-borde p-1 text-sm font-medium">
        {ESTADOS.map((e) => (
          <button
            key={e.valor}
            role="tab"
            type="button"
            aria-selected={estado === e.valor}
            onClick={() => {
              setNegocios(null);
              setEstado(e.valor);
            }}
            className={`flex-1 rounded-full px-3 py-1.5 ${estado === e.valor ? "bg-superficie shadow-sm" : "text-texto-2"}`}
          >
            {e.texto}
          </button>
        ))}
      </div>
      {negocios === null ? (
        <p className="mt-6 text-center text-texto-2">Cargando…</p>
      ) : negocios.length === 0 ? (
        <p className="mt-6 text-center text-texto-2">No hay negocios en esta lista.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {negocios.map((n) => (
            <TarjetaRevision key={n.id} n={n} alDecidir={cargar} />
          ))}
        </ul>
      )}
    </div>
  );
}
