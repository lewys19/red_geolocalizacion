"use client";

// Campos del negocio, compartidos por el asistente de registro y el panel del dueño.
import { useEffect, useState } from "react";

import { pedir } from "@/lib/api";
import type { Categoria } from "@/lib/tipos";

import { Campo } from "./Formulario";
import { SelectorPin } from "./SelectorPin";

export interface DatosNegocio {
  nombre: string;
  categoria_id: string;
  descripcion: string;
  whatsapp: string;
  telefono: string;
  tiene_delivery: boolean;
  distrito: string;
  direccion: string;
  referencia: string;
}

export const DATOS_VACIOS: DatosNegocio = {
  nombre: "",
  categoria_id: "",
  descripcion: "",
  whatsapp: "",
  telefono: "",
  tiene_delivery: false,
  distrito: "",
  direccion: "",
  referencia: "",
};

/** Lo que espera la API (POST /negocios o PATCH /negocios/{id}). */
export function aCuerpo(d: DatosNegocio, pin: [number, number]) {
  return {
    nombre: d.nombre,
    categoria_id: Number(d.categoria_id),
    descripcion: d.descripcion || null,
    whatsapp: d.whatsapp || null,
    telefono: d.telefono || null,
    tiene_delivery: d.tiene_delivery,
    distrito: d.distrito,
    direccion: d.direccion,
    referencia: d.referencia || null,
    ubicacion: { lng: pin[0], lat: pin[1] },
  };
}

export const SELECT =
  "w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/30";

interface Props {
  datos: DatosNegocio;
  alCambiar: (d: DatosNegocio) => void;
}

function useListas() {
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);
  useEffect(() => {
    pedir<Categoria[]>("/categorias").then(setCategorias).catch(() => {});
    pedir<string[]>("/distritos").then(setDistritos).catch(() => {});
  }, []);
  return { categorias, distritos };
}

function enlazar(datos: DatosNegocio, alCambiar: (d: DatosNegocio) => void, nombre: keyof DatosNegocio) {
  return {
    name: nombre,
    value: datos[nombre] as string,
    onChange: (e: { target: { value: string } }) => alCambiar({ ...datos, [nombre]: e.target.value }),
  };
}

export function CamposDatos({ datos, alCambiar }: Props) {
  const { categorias } = useListas();
  const campo = (n: keyof DatosNegocio) => enlazar(datos, alCambiar, n);
  return (
    <>
      <Campo etiqueta="Nombre del negocio" required minLength={2} maxLength={120} {...campo("nombre")} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-texto-2">Categoría</span>
        <select required className={SELECT} {...campo("categoria_id")}>
          <option value="">Elige una…</option>
          {categorias.map((c) =>
            c.hijas.length ? (
              <optgroup key={c.id} label={c.nombre}>
                {c.hijas.map((h) => (
                  <option key={h.id} value={h.id}>
                    {h.nombre}
                  </option>
                ))}
              </optgroup>
            ) : (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ),
          )}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-texto-2">¿Qué ofreces? (opcional)</span>
        <textarea rows={3} maxLength={1000} className={SELECT} {...campo("descripcion")} />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="WhatsApp" type="tel" placeholder="987 654 321" {...campo("whatsapp")} />
        <Campo etiqueta="Teléfono (opcional)" type="tel" {...campo("telefono")} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={datos.tiene_delivery}
          onChange={(e) => alCambiar({ ...datos, tiene_delivery: e.target.checked })}
          className="h-4 w-4 accent-[var(--marca)]"
        />
        Hago delivery
      </label>
    </>
  );
}

interface Sugerencia {
  direccion: string | null;
  distrito: string | null;
}

export function CamposUbicacion({
  datos,
  alCambiar,
  pin,
  alMoverPin,
}: Props & { pin: [number, number]; alMoverPin: (p: [number, number]) => void }) {
  const { distritos } = useListas();
  const campo = (n: keyof DatosNegocio) => enlazar(datos, alCambiar, n);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);
  const [movido, setMovido] = useState(false);

  // Al mover el pin se pide la dirección de ese punto (reverse geocoding). Espera 600 ms quieto.
  useEffect(() => {
    if (!movido) return;
    const espera = setTimeout(() => {
      pedir<Sugerencia>(`/geocoding/inverso?lng=${pin[0].toFixed(6)}&lat=${pin[1].toFixed(6)}`, { conSesion: true })
        .then(setSugerencia)
        .catch(() => setSugerencia(null));
    }, 600);
    return () => clearTimeout(espera);
  }, [pin, movido]);

  // Si todavía no escribió nada, la sugerencia se completa sola; si ya escribió, solo se ofrece.
  useEffect(() => {
    if (!sugerencia) return;
    if ((!datos.direccion && sugerencia.direccion) || (!datos.distrito && sugerencia.distrito)) {
      alCambiar({
        ...datos,
        direccion: datos.direccion || sugerencia.direccion || "",
        distrito: datos.distrito || sugerencia.distrito || "",
      });
    }
    // Solo cuando llega una sugerencia nueva.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sugerencia]);

  const ofrecer =
    sugerencia &&
    (sugerencia.direccion || sugerencia.distrito) &&
    ((sugerencia.direccion && sugerencia.direccion !== datos.direccion) ||
      (sugerencia.distrito && sugerencia.distrito !== datos.distrito));

  return (
    <>
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-texto-2">Distrito *</span>
        <select required className={SELECT} {...campo("distrito")}>
          <option value="">Elige tu distrito…</option>
          {distritos.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </label>
      {/* La dirección y el pin son lo que pone al negocio en el mapa. */}
      <Campo etiqueta="Dirección *" required minLength={5} maxLength={200} placeholder="Av. Larco 345" {...campo("direccion")} />
      <Campo etiqueta="Referencia (opcional)" maxLength={200} placeholder="Frente al parque" {...campo("referencia")} />
      {ofrecer && sugerencia && (
        <button
          type="button"
          onClick={() =>
            alCambiar({
              ...datos,
              direccion: sugerencia.direccion ?? datos.direccion,
              distrito: sugerencia.distrito ?? datos.distrito,
            })
          }
          className="w-full rounded-lg border border-dashed border-marca bg-marca-suave px-3 py-2 text-left text-sm text-marca-fuerte"
        >
          Usar: <strong>{[sugerencia.direccion, sugerencia.distrito].filter(Boolean).join(", ")}</strong>
        </button>
      )}
      <SelectorPin
        valor={pin}
        alCambiar={(p) => {
          setMovido(true);
          alMoverPin(p);
        }}
      />
    </>
  );
}
