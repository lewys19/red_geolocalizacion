"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { abrirAcceso } from "@/lib/acceso";
import { conReintentos, pedir } from "@/lib/api";
import type { Muro, NegocioMini, Publicacion } from "@/lib/tipos";
import { pedirGps, useUbicacion } from "@/lib/ubicacion";
import { useSesion } from "@/lib/usarSesion";

import { Avatar, TarjetaPublicacion } from "./TarjetaPublicacion";

type Modo = "general" | "radio";

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="relative rounded-xl border border-borde bg-superficie p-3 pt-4">
      <h2 className="absolute -top-2.5 left-3 rounded-full bg-fondo px-2 text-xs font-semibold text-texto-2">{titulo}</h2>
      {children}
    </section>
  );
}

/** Columna izquierda: qué negocios mostrar, atajos y el botón de publicar. */
function PanelIzquierdo({
  modo,
  radioKm,
  alCambiarModo,
  alCambiarRadio,
}: {
  modo: Modo;
  radioKm: number;
  alCambiarModo: (m: Modo) => void;
  alCambiarRadio: (km: number) => void;
}) {
  const ubicacion = useUbicacion();
  const sesion = useSesion();
  const [sinGps, setSinGps] = useState(false);

  async function elegirRadio() {
    alCambiarModo("radio");
    if (!ubicacion) setSinGps((await pedirGps()) !== "ok");
  }

  return (
    <div className="space-y-5">
      <Caja titulo="Mostrar negocios">
        <fieldset className="space-y-2 text-sm">
          <legend className="sr-only">Qué publicaciones ver</legend>
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" checked={modo === "general"} onChange={() => alCambiarModo("general")} className="accent-[var(--marca)]" />
            General (toda Lima)
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="modo" checked={modo === "radio"} onChange={elegirRadio} className="accent-[var(--marca)]" />
            Cerca de mí: {radioKm} km
          </label>
          <input
            type="range"
            min={1}
            max={50}
            value={radioKm}
            disabled={modo !== "radio"}
            onChange={(e) => alCambiarRadio(Number(e.target.value))}
            aria-label="Radio en kilómetros"
            className="w-full accent-[var(--marca)] disabled:opacity-40"
          />
          {modo === "radio" && !ubicacion && (
            <p className="text-xs text-texto-2">
              {sinGps ? "Tu navegador no dio el GPS. " : "Necesitamos tu ubicación. "}
              <Link href="/mapa" className="font-medium text-marca-fuerte underline">
                Márcala en el mapa
              </Link>
            </p>
          )}
        </fieldset>
      </Caja>

      {/* En el celular se oculta (por ahora solo dice «Pronto») para que el muro quede a la vista. */}
      <div className="hidden lg:block">
        <Caja titulo="Aprovecha">
        <ul className="space-y-1.5 text-sm">
          {["Referencias", "Notificaciones", "Ofertas"].map((t) => (
            <li key={t} className="flex items-center justify-between text-texto-2">
              <span>• {t}</span>
              <span className="rounded-full bg-fondo px-2 py-0.5 text-[11px]">Pronto</span>
            </li>
          ))}
        </ul>
        </Caja>
      </div>

      {/* Sin sesión, primero la ventana de ingreso (sin salir del Inicio). */}
      <Link
        href="/publicar"
        onClick={(e) => {
          if (sesion) return;
          e.preventDefault();
          abrirAcceso("ingresar", "Ingresa con la cuenta de tu negocio para publicar.");
        }}
        className="block rounded-2xl bg-[#1e2a4a] px-4 py-3 text-center font-semibold text-white shadow hover:brightness-110 dark:bg-marca dark:text-sobre-marca"
      >
        Crear publicación
      </Link>
    </div>
  );
}

/** Círculos de arriba: negocios cercanos (o los más nuevos si no hay ubicación). */
function Circulos({ desde }: { desde: [number, number] | null }) {
  const [negocios, setNegocios] = useState<NegocioMini[]>([]);
  useEffect(() => {
    const params = new URLSearchParams({ limite: "12" });
    if (desde) {
      params.set("lng", desde[0].toFixed(5));
      params.set("lat", desde[1].toFixed(5));
    }
    pedir<NegocioMini[]>(`/negocios/lista?${params}`).then(setNegocios).catch(() => setNegocios([]));
  }, [desde]);

  if (!negocios.length) return null;
  return (
    <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-2 [scrollbar-width:none]">
      {negocios.map((n) => (
        <Link key={n.id} href={`/n/${n.slug}`} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
          <span className="rounded-full bg-gradient-to-tr from-marca to-amber-400 p-[3px]">
            <span className="block rounded-full bg-superficie p-[2px]">
              <Avatar negocio={n} tamano="h-16 w-16 text-2xl" />
            </span>
          </span>
          <span className="line-clamp-2 text-xs leading-tight">{n.nombre}</span>
        </Link>
      ))}
    </div>
  );
}

/** Columna derecha: espacios que más adelante serán publicidad pagada. */
function Publicidad() {
  return (
    <aside aria-label="Publicidad" className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex h-48 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-borde bg-superficie p-4 text-center"
        >
          <span className="text-sm font-semibold text-texto-2">Espacio publicitario</span>
          <span className="mt-1 text-xs text-texto-2">Muy pronto, tu negocio aquí</span>
        </div>
      ))}
    </aside>
  );
}

/** Pestaña Inicio: el muro con las publicaciones de los negocios. */
export function Inicio() {
  const ubicacion = useUbicacion();
  const sesion = useSesion();
  const usuarioId = sesion?.usuario.id ?? null;
  const [modo, setModo] = useState<Modo>("general");
  const [radioKm, setRadioKm] = useState(10);
  const [publicaciones, setPublicaciones] = useState<Publicacion[] | null>(null);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [error, setError] = useState(false);

  const desde = modo === "radio" ? ubicacion : null;
  const parametros = useCallback(
    (antesDe?: number) => {
      const p = new URLSearchParams({ limite: "10" });
      if (desde) {
        p.set("lng", desde[0].toFixed(5));
        p.set("lat", desde[1].toFixed(5));
        p.set("radio_m", String(radioKm * 1000));
      }
      if (antesDe) p.set("antes_de", String(antesDe));
      return p;
    },
    [desde, radioKm],
  );

  useEffect(() => {
    if (modo === "radio" && !ubicacion) return; // espera la ubicación
    const control = new AbortController();
    // Con el deslizador del radio, espera a que la persona lo suelte.
    const espera = setTimeout(() => {
      conReintentos(() => pedir<Muro>(`/muro?${parametros()}`, { senal: control.signal, conSesion: true }))
        .then((m) => {
          setPublicaciones(m.publicaciones);
          setSiguiente(m.siguiente);
          setError(false);
        })
        .catch((e: Error) => e.name !== "AbortError" && setError(true));
    }, 300);
    return () => {
      clearTimeout(espera);
      control.abort();
    };
    // usuarioId: al entrar o salir se vuelve a pedir, para marcar (o no) tus reacciones.
  }, [modo, ubicacion, parametros, usuarioId]);

  async function verMas() {
    if (!siguiente) return;
    setCargandoMas(true);
    try {
      const m = await pedir<Muro>(`/muro?${parametros(siguiente)}`, { conSesion: true });
      setPublicaciones((actuales) => [...(actuales ?? []), ...m.publicaciones]);
      setSiguiente(m.siguiente);
    } finally {
      setCargandoMas(false);
    }
  }

  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-3 py-4 lg:grid-cols-[240px_minmax(0,1fr)_260px]">
      <div className="lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <div className="flex h-full flex-col justify-between gap-6">
          <PanelIzquierdo modo={modo} radioKm={radioKm} alCambiarModo={setModo} alCambiarRadio={setRadioKm} />
          <p className="hidden text-sm text-texto-2 lg:block">Lima - Perú</p>
        </div>
      </div>

      <main className="min-w-0 space-y-4">
        <Circulos desde={desde} />
        {error && <p className="rounded-xl bg-error/10 p-3 text-sm text-error">No pudimos cargar el muro. Recarga la página.</p>}
        {publicaciones === null && !error && <p className="py-10 text-center text-texto-2">Cargando publicaciones…</p>}
        {publicaciones?.length === 0 && (
          <div className="rounded-2xl border border-borde bg-superficie p-8 text-center">
            <p className="font-semibold">Todavía no hay publicaciones {modo === "radio" ? `a menos de ${radioKm} km` : ""}.</p>
            <p className="mt-1 text-sm text-texto-2">Cuando los negocios publiquen ofertas y novedades, las verás aquí.</p>
          </div>
        )}
        {publicaciones?.map((p) => <TarjetaPublicacion key={p.id} publicacion={p} />)}
        {siguiente && (
          <button
            type="button"
            onClick={verMas}
            disabled={cargandoMas}
            className="w-full rounded-xl border border-borde bg-superficie py-3 font-medium hover:border-marca disabled:opacity-60"
          >
            {cargandoMas ? "Cargando…" : "Ver más publicaciones"}
          </button>
        )}
      </main>

      <div className="hidden lg:block">
        <div className="sticky top-20">
          <Publicidad />
        </div>
      </div>
    </div>
  );
}
