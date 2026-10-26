"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type CSSProperties, useCallback, useEffect, useState } from "react";

import { conReintentos, pedir } from "@/lib/api";
import { aPie, distancia, hora } from "@/lib/formato";
import type { PuntoMapa, RespuestaMapa } from "@/lib/tipos";

import { Buscador } from "./Buscador";
import { Mapa } from "./Mapa";

// Radios para elegir (km). El máximo, 50 km, lo fija también la API.
const RADIOS_KM = [1, 2, 5, 10, 20, 50];

type EstadoGps = "inactivo" | "buscando" | "no-disponible";

/** Pantalla principal: primero tu ubicación, luego el radio; los negocios más cercanos primero. */
export function Explorador() {
  const router = useRouter();
  const [ubicacion, setUbicacion] = useState<[number, number] | null>(null);
  const [radioKm, setRadioKm] = useState(5);
  const [categoria, setCategoria] = useState<string | null>(null);
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<RespuestaMapa | null>(null);
  const [gps, setGps] = useState<EstadoGps>("inactivo");
  const [aviso, setAviso] = useState<string | null>(null);
  const [intento, setIntento] = useState(0); // al pulsar «Reintentar» se vuelve a buscar

  function usarMiUbicacion() {
    // Los navegadores solo dan el GPS en sitios seguros (https o localhost).
    if (!window.isSecureContext || !navigator.geolocation) {
      setGps("no-disponible");
      return;
    }
    setGps("buscando");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setUbicacion([coords.longitude, coords.latitude]);
        setGps("inactivo");
      },
      () => setGps("no-disponible"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  // Busca los cercanos cada vez que cambia la ubicación, el radio, la categoría o el texto.
  useEffect(() => {
    if (!ubicacion) return;
    const control = new AbortController();
    const params = new URLSearchParams({
      lng: ubicacion[0].toFixed(5),
      lat: ubicacion[1].toFixed(5),
      radio_m: String(radioKm * 1000),
    });
    if (categoria) params.set("categoria", categoria);
    if (texto) params.set("q", texto);
    conReintentos(() => pedir<RespuestaMapa>(`/mapa/cerca?${params}`, { senal: control.signal }))
      .then((r) => {
        setResultado(r);
        setAviso(null);
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setResultado(null);
        setAviso(e.message);
      });
    return () => control.abort();
  }, [ubicacion, radioKm, categoria, texto, intento]);

  const buscar = useCallback((t: string) => setTexto(t), []);
  const abrir = useCallback((p: PuntoMapa) => router.push(`/n/${p.slug}`), [router]);

  const puntos = resultado?.puntos ?? [];
  // Los controles del mapa suben por encima del panel de abajo (ver globals.css).
  const estilo = { "--alto-panel": ubicacion ? "290px" : "190px" } as CSSProperties;

  return (
    <section className="relative flex-1" style={estilo}>
      <Mapa ubicacion={ubicacion} radio={radioKm * 1000} puntos={puntos} alMarcarUbicacion={setUbicacion} alAbrir={abrir} />
      <Buscador alBuscar={buscar} elegida={categoria} alCambiar={setCategoria} />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="pointer-events-auto mx-auto max-w-xl rounded-2xl border border-borde bg-superficie p-4 shadow-lg">
          {!ubicacion ? (
            <div className="space-y-3 text-center">
              <p className="font-semibold">¿Dónde estás?</p>
              <p className="text-sm text-texto-2">Así te mostramos los negocios más cercanos, con su distancia.</p>
              <button
                type="button"
                onClick={usarMiUbicacion}
                disabled={gps === "buscando"}
                className="w-full rounded-xl bg-marca px-4 py-3 font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-60"
              >
                {gps === "buscando" ? "Buscando tu ubicación…" : "Usar mi ubicación"}
              </button>
              <p className="text-sm text-texto-2">
                {gps === "no-disponible"
                  ? "No pudimos usar el GPS en este navegador. Toca el mapa en el lugar donde estás."
                  : "O toca el mapa en el lugar donde estás."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-sm text-texto-2">Radio</span>
                <div className="flex flex-1 gap-1 overflow-x-auto [scrollbar-width:none]">
                  {RADIOS_KM.map((km) => (
                    <button
                      key={km}
                      type="button"
                      aria-pressed={radioKm === km}
                      onClick={() => setRadioKm(km)}
                      className={`shrink-0 rounded-full border px-3 py-1 text-sm font-medium ${
                        radioKm === km ? "border-marca bg-marca text-sobre-marca" : "border-borde hover:border-marca"
                      }`}
                    >
                      {km} km
                    </button>
                  ))}
                </div>
              </div>

              {aviso && (
                <p className="flex items-center justify-between gap-2 text-sm text-error">
                  {aviso}
                  <button
                    type="button"
                    onClick={() => setIntento((n) => n + 1)}
                    className="shrink-0 rounded-full border border-borde px-3 py-1 font-medium text-texto hover:border-marca"
                  >
                    Reintentar
                  </button>
                </p>
              )}
              <p className={`text-sm font-medium ${aviso ? "hidden" : ""}`}>
                {aviso ??
                  (resultado === null
                    ? "Buscando…"
                    : resultado.total === 0
                      ? `Nada a menos de ${radioKm} km${texto ? ` para «${texto}»` : ""}. Prueba con un radio mayor.`
                      : `${resultado.total} ${resultado.total === 1 ? "negocio" : "negocios"} a menos de ${radioKm} km${
                          texto ? ` para «${texto}»` : ""
                        }${resultado.total > puntos.length ? ` (los ${puntos.length} más cercanos)` : ""}`)}
              </p>

              {puntos.length > 0 && (
                <ul className="-mx-1 max-h-36 space-y-1 overflow-y-auto px-1">
                  {puntos.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/n/${p.slug}`}
                        className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-marca-suave"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{p.nombre}</span>
                          <span className="block truncate text-xs text-texto-2">
                            {p.categoria} ·{" "}
                            {p.abierto === null
                              ? "sin horario"
                              : p.abierto
                                ? `abierto${p.cierra_a ? ` hasta ${hora(p.cierra_a)}` : ""}`
                                : "cerrado"}
                            {p.tiene_delivery && " · delivery"}
                          </span>
                        </span>
                        {p.distancia_m !== null && (
                          <span className="shrink-0 text-right text-xs">
                            <span className="block font-semibold">{distancia(p.distancia_m).replace("a ", "")}</span>
                            <span className="block text-texto-2">{aPie(p.distancia_m).replace(" a pie", "")} a pie</span>
                          </span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <p className="flex items-center justify-between gap-2 text-xs text-texto-2">
                <span>Arrastra el punto azul para corregir tu ubicación.</span>
                <Link href="/negocios/nuevo" className="shrink-0 font-medium text-marca-fuerte underline">
                  Registra tu negocio
                </Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
