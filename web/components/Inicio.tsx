"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

import { abrirAcceso } from "@/lib/acceso";
import { ErrorApi, conReintentos, pedir } from "@/lib/api";
import type { Anuncio, Muro, NegocioMini, Publicacion } from "@/lib/tipos";
import { pedirGps, useUbicacion } from "@/lib/ubicacion";
import { useSesion } from "@/lib/usarSesion";

import { Avatar, TarjetaPublicacion } from "./TarjetaPublicacion";

type Modo = "general" | "radio";

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="relative rounded-xl border border-borde bg-superficie p-3 pt-4">
      <h2 className="absolute -top-2.5 left-3 rounded-full bg-fondo px-2 text-xs font-semibold text-texto-2">
        {titulo}
      </h2>
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
            <input
              type="radio"
              name="modo"
              checked={modo === "general"}
              onChange={() => alCambiarModo("general")}
              className="accent-[var(--marca)]"
            />
            General (toda Lima)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              name="modo"
              checked={modo === "radio"}
              onChange={elegirRadio}
              className="accent-[var(--marca)]"
            />
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
      <NotaSugerencia />
    </div>
  );
}

const CADA_MS = 10_000;
const ANCHO_SM = "(min-width: 640px)";

/** 6 círculos a la vista; en el celular, 4 (no entran más sin cortarse). */
function useVisibles(): number {
  return useSyncExternalStore(
    (avisar) => {
      const consulta = window.matchMedia(ANCHO_SM);
      consulta.addEventListener("change", avisar);
      return () => consulta.removeEventListener("change", avisar);
    },
    () => (window.matchMedia(ANCHO_SM).matches ? 6 : 4),
    () => 6,
  );
}

function Flecha({ lado, onClick }: { lado: "izquierda" | "derecha"; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={lado === "izquierda" ? "Anteriores" : "Siguientes"}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-borde bg-superficie text-texto-2 shadow-sm hover:border-marca hover:text-marca-fuerte"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          d={lado === "izquierda" ? "M15 5 8 12l7 7" : "m9 5 7 7-7 7"}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
        />
      </svg>
    </button>
  );
}

/**
 * Círculos de arriba (negocios cercanos, o los más nuevos sin ubicación) en carrusel:
 * 6 a la vista (4 en el celular), flechas a los lados y avanza solo cada 10 s (se detiene mientras el mouse está encima).
 */
function Circulos({ desde }: { desde: [number, number] | null }) {
  const VISIBLES = useVisibles();
  const [negocios, setNegocios] = useState<NegocioMini[]>([]);
  const [inicio, setInicio] = useState(0);
  const [pausado, setPausado] = useState(false);
  // Cambia con cada clic en una flecha: reinicia la cuenta de 10 s.
  const [vuelta, setVuelta] = useState(0);

  useEffect(() => {
    const params = new URLSearchParams({ limite: "18" });
    if (desde) {
      params.set("lng", desde[0].toFixed(5));
      params.set("lat", desde[1].toFixed(5));
    }
    pedir<NegocioMini[]>(`/negocios/lista?${params}`)
      .then((lista) => {
        setNegocios(lista);
        setInicio(0);
      })
      .catch(() => setNegocios([]));
  }, [desde]);

  const ultimo = Math.max(0, negocios.length - VISIBLES);
  const mover = useCallback(
    (paso: number) => {
      setInicio((i) => {
        const max = Math.max(0, negocios.length - VISIBLES);
        if (paso > 0) return i >= max ? 0 : i + 1;
        return i <= 0 ? max : i - 1;
      });
    },
    [negocios.length, VISIBLES],
  );

  useEffect(() => {
    if (pausado || ultimo === 0) return;
    const reloj = setInterval(() => mover(1), CADA_MS);
    return () => clearInterval(reloj);
  }, [pausado, ultimo, mover, vuelta]);

  if (!negocios.length) return null;
  const conFlechas = ultimo > 0;
  const flecha = (paso: number) => () => {
    mover(paso);
    setVuelta((v) => v + 1);
  };

  return (
    <div
      className="flex items-center justify-center gap-2"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      role="region"
      aria-roledescription="carrusel"
      aria-label="Negocios"
    >
      {conFlechas && <Flecha lado="izquierda" onClick={flecha(-1)} />}
      <div className="min-w-0 flex-1 overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${(inicio * 100) / VISIBLES}%)` }}
        >
          {negocios.map((n, i) => (
            <Link
              key={n.id}
              href={`/n/${n.slug}`}
              tabIndex={i >= inicio && i < inicio + VISIBLES ? 0 : -1}
              style={{ flexBasis: `${100 / VISIBLES}%` }}
              className="flex shrink-0 flex-col items-center gap-1.5 px-1 text-center"
            >
              <span className="rounded-full bg-gradient-to-tr from-marca to-amber-400 p-[3px]">
                <span className="block rounded-full bg-superficie p-[2px]">
                  <Avatar negocio={n} tamano="h-11 w-11 text-lg sm:h-14 sm:w-14 sm:text-2xl" />
                </span>
              </span>
              <span className="line-clamp-2 w-full text-[11px] leading-tight sm:text-xs">{n.nombre}</span>
            </Link>
          ))}
        </div>
      </div>
      {conFlechas && <Flecha lado="derecha" onClick={flecha(1)} />}
    </div>
  );
}

/** Columna derecha: los banners que el equipo activa en el panel (0 a 3). Sin ninguno, los espacios en blanco. */
function Publicidad() {
  const [anuncios, setAnuncios] = useState<Anuncio[] | null>(null);
  useEffect(() => {
    pedir<Anuncio[]>("/anuncios")
      .then(setAnuncios)
      .catch(() => setAnuncios([]));
  }, []);

  if (anuncios === null) return null;
  if (!anuncios.length) {
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
  return (
    <aside aria-label="Publicidad" className="space-y-3">
      {anuncios.map((a) => {
        const imagen = (
          // Mismo cuadro que los espacios vacíos (h-48): la imagen se recorta para llenarlo, nunca lo estira.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={a.imagen}
            alt={a.titulo ?? "Publicidad"}
            className="h-48 w-full rounded-2xl border border-borde object-cover"
          />
        );
        if (!a.enlace) return <div key={a.posicion}>{imagen}</div>;
        // Enlaces de afuera se abren aparte y se marcan como patrocinados (no pasan reputación a buscadores).
        return a.enlace.startsWith("/") ? (
          <Link key={a.posicion} href={a.enlace} className="block transition hover:opacity-90">
            {imagen}
          </Link>
        ) : (
          <a
            key={a.posicion}
            href={a.enlace}
            target="_blank"
            rel="noopener noreferrer sponsored"
            className="block transition hover:opacity-90"
          >
            {imagen}
          </a>
        );
      })}
      <p className="text-center text-[11px] text-texto-2">Publicidad</p>
    </aside>
  );
}

/** Notita de sugerencias: un texto pequeño que se despliega en un cuadro con su botón de enviar. */
function NotaSugerencia() {
  const [abierta, setAbierta] = useState(false);
  const [texto, setTexto] = useState("");
  const [estado, setEstado] = useState<"enviando" | "ok" | string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setEstado("enviando");
    try {
      await pedir("/sugerencias", { metodo: "POST", conSesion: true, cuerpo: { texto } });
      setTexto("");
      setEstado("ok");
    } catch (err) {
      setEstado(err instanceof ErrorApi ? err.message : "No se pudo enviar. Revisa tu conexión.");
    }
  }

  return (
    <div className="text-xs">
      <button
        type="button"
        onClick={() => setAbierta((a) => !a)}
        aria-expanded={abierta}
        className="flex items-center gap-1 text-texto-2 hover:text-texto"
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-3 w-3 transition-transform ${abierta ? "rotate-90" : ""}`}
          aria-hidden="true"
        >
          <path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.5" />
        </svg>
        ¿Tienes una sugerencia?
      </button>
      {abierta && (
        <form onSubmit={enviar} className="mt-2 space-y-1.5">
          <textarea
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value);
              if (estado && estado !== "enviando") setEstado(null);
            }}
            rows={3}
            minLength={3}
            maxLength={1000}
            required
            placeholder="Cuéntanos qué te gustaría ver en Altoque…"
            aria-label="Tu sugerencia"
            className="w-full resize-none rounded-lg border border-borde bg-superficie px-2 py-1.5 text-xs outline-none focus:border-marca"
          />
          <div className="flex items-center justify-between gap-2">
            <span className={estado === "ok" ? "text-green-700 dark:text-green-400" : "text-error"}>
              {estado === "ok" ? "¡Gracias! La recibimos." : estado && estado !== "enviando" ? estado : ""}
            </span>
            <button
              type="submit"
              disabled={estado === "enviando" || texto.trim().length < 3}
              className="rounded-md border border-borde px-2 py-0.5 text-[11px] text-texto-2 hover:border-marca hover:text-texto disabled:opacity-50"
            >
              {estado === "enviando" ? "Enviando…" : "Enviar"}
            </button>
          </div>
        </form>
      )}
    </div>
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

      {/* La columna central ocupa el 90 % de su espacio, centrada: algo más angosta que las tarjetas laterales piden. */}
      <main className="w-full min-w-0 space-y-4 lg:max-w-[90%] lg:justify-self-center">
        <Circulos desde={desde} />
        {error && (
          <p className="rounded-xl bg-error/10 p-3 text-sm text-error">No pudimos cargar el muro. Recarga la página.</p>
        )}
        {publicaciones === null && !error && <p className="py-10 text-center text-texto-2">Cargando publicaciones…</p>}
        {publicaciones?.length === 0 && (
          <div className="rounded-2xl border border-borde bg-superficie p-8 text-center">
            <p className="font-semibold">
              Todavía no hay publicaciones {modo === "radio" ? `a menos de ${radioKm} km` : ""}.
            </p>
            <p className="mt-1 text-sm text-texto-2">
              Cuando los negocios publiquen ofertas y novedades, las verás aquí.
            </p>
          </div>
        )}
        {publicaciones?.map((p) => (
          <TarjetaPublicacion key={p.id} publicacion={p} />
        ))}
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
