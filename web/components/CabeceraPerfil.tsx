"use client";

// Cabecera del perfil del negocio (como la de X/Twitter): portada, foto de perfil, «Me gusta», seguir y contadores.
// Su dueño ve en cambio los botones para editar la portada, la foto y el perfil.
import Link from "next/link";
import { type ChangeEvent, useEffect, useState } from "react";

import { abrirAcceso } from "@/lib/acceso";
import { ErrorApi, pedir } from "@/lib/api";
import { enlaceWhatsapp, hora } from "@/lib/formato";
import type { Ficha } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

interface Relacion {
  lo_sigo: boolean;
  me_gusta: boolean;
  es_miembro: boolean;
}

const ICONO_CAMARA =
  "M9 4 7.2 6H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-3.2L15 4zm3 4.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 2a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z";

/** Botón que abre el selector de archivos y sube la imagen (solo lo ve el dueño). */
function BotonImagen({
  texto,
  className,
  alElegir,
}: {
  texto: string;
  className: string;
  alElegir: (archivo: File) => void;
}) {
  return (
    <label className={`cursor-pointer ${className}`} title={texto}>
      <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" aria-hidden="true">
        <path d={ICONO_CAMARA} fill="currentColor" />
      </svg>
      <span className="sr-only sm:not-sr-only">{texto}</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e: ChangeEvent<HTMLInputElement>) => {
          const archivo = e.target.files?.[0];
          e.target.value = "";
          if (archivo) alElegir(archivo);
        }}
      />
    </label>
  );
}

function cifra(n: number): string {
  return new Intl.NumberFormat("es-PE", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

function Fila({ icono, children }: { icono: string; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2">
      <span aria-hidden="true" className="w-5 shrink-0 text-center">
        {icono}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function CabeceraPerfil({ ficha: f }: { ficha: Ficha }) {
  const sesion = useSesion();
  const usuarioId = sesion?.usuario.id ?? null;
  const [relacion, setRelacion] = useState<Relacion | null>(null);
  const [seguidores, setSeguidores] = useState(f.seguidores);
  const [meGusta, setMeGusta] = useState(f.total_me_gusta);
  const [portada, setPortada] = useState(f.portada);
  const [logo, setLogo] = useState(f.logo);
  const [subiendo, setSubiendo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (usuarioId === null) return;
    pedir<Relacion>(`/negocios/${f.id}/relacion`, { conSesion: true })
      .then(setRelacion)
      .catch(() => setRelacion(null));
  }, [f.id, usuarioId]);
  const rel = usuarioId === null ? null : relacion;

  async function alternarSeguir() {
    if (!sesion) return abrirAcceso("ingresar", `Ingresa para seguir a ${f.nombre}.`);
    setOcupado(true);
    try {
      const r = await pedir<{ seguidores: number; lo_sigo: boolean }>(`/negocios/${f.id}/seguir`, {
        metodo: rel?.lo_sigo ? "DELETE" : "PUT",
        conSesion: true,
      });
      setSeguidores(r.seguidores);
      setRelacion({ lo_sigo: r.lo_sigo, me_gusta: rel?.me_gusta ?? false, es_miembro: rel?.es_miembro ?? false });
    } finally {
      setOcupado(false);
    }
  }

  async function alternarMeGusta() {
    if (!sesion) return abrirAcceso("ingresar", `Ingresa para darle «Me gusta» a ${f.nombre}.`);
    setOcupado(true);
    try {
      const r = await pedir<{ me_gusta: boolean; total: number }>(`/negocios/${f.id}/me-gusta`, {
        metodo: rel?.me_gusta ? "DELETE" : "PUT",
        conSesion: true,
      });
      setMeGusta(r.total);
      setRelacion({ lo_sigo: rel?.lo_sigo ?? false, me_gusta: r.me_gusta, es_miembro: rel?.es_miembro ?? false });
    } finally {
      setOcupado(false);
    }
  }

  /** El dueño cambia la portada o la foto de perfil sin salir de la página. */
  async function subir(tipo: "portada" | "logo", archivo: File) {
    const cuerpo = new FormData();
    cuerpo.append("foto", archivo);
    setAviso(null);
    setSubiendo(tipo);
    try {
      const r = await pedir<{ url: string | null }>(`/negocios/${f.id}/imagen/${tipo}`, {
        metodo: "PUT",
        conSesion: true,
        cuerpo,
      });
      if (tipo === "portada") setPortada(r.url);
      else setLogo(r.url);
    } catch (e) {
      setAviso(e instanceof ErrorApi ? e.message : "No se pudo subir la imagen.");
    } finally {
      setSubiendo(null);
    }
  }

  return (
    <header className="overflow-hidden rounded-b-3xl border-x border-b border-borde bg-superficie sm:rounded-3xl sm:border">
      {/* Portada 3:1; sin foto, un degradado de la marca. */}
      <div className="relative aspect-[3/1] w-full bg-gradient-to-br from-marca via-orange-400 to-amber-300">
        {portada && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={portada} alt="" className="h-full w-full object-cover" />
        )}
        {rel?.es_miembro && (
          <BotonImagen
            texto={subiendo === "portada" ? "Subiendo…" : "Editar portada"}
            alElegir={(a) => subir("portada", a)}
            className="absolute right-3 bottom-3 flex items-center gap-1.5 rounded-lg bg-black/55 px-3 py-1.5 text-sm font-semibold text-white backdrop-blur hover:bg-black/70"
          />
        )}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="flex items-end justify-between gap-3">
          <div className="relative -mt-12 rounded-full bg-superficie p-1 sm:-mt-16">
            {rel?.es_miembro && (
              <BotonImagen
                texto={subiendo === "logo" ? "Subiendo…" : "Cambiar foto"}
                alElegir={(a) => subir("logo", a)}
                className="absolute right-1 bottom-1 z-10 flex h-9 w-9 items-center justify-center rounded-full border-2 border-superficie bg-fondo text-texto shadow hover:bg-borde [&>span]:sr-only"
              />
            )}
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logo}
                alt={`Foto de perfil de ${f.nombre}`}
                className="h-24 w-24 rounded-full object-cover sm:h-32 sm:w-32"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-marca text-4xl font-bold text-sobre-marca sm:h-32 sm:w-32 sm:text-5xl">
                {f.nombre.trim().charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            {rel?.es_miembro ? (
              <Link
                href={`/mis-negocios/${f.id}`}
                className="rounded-full border-[1.5px] border-texto-2/60 px-4 py-2 text-sm font-semibold hover:border-marca hover:text-marca-fuerte"
              >
                Editar perfil
              </Link>
            ) : (
              <>
                <button
                  type="button"
                  onClick={alternarMeGusta}
                  disabled={ocupado}
                  aria-pressed={rel?.me_gusta ?? false}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                    rel?.me_gusta
                      ? "bg-marca-suave text-marca-fuerte ring-1 ring-marca/40"
                      : "border-[1.5px] border-borde hover:border-marca hover:text-marca-fuerte"
                  }`}
                >
                  <span aria-hidden="true">👍</span>
                  {rel?.me_gusta ? "Te gusta" : "Me gusta"}
                </button>
                <button
                  type="button"
                  onClick={alternarSeguir}
                  disabled={ocupado}
                  aria-pressed={rel?.lo_sigo ?? false}
                  className={`rounded-full px-5 py-2 text-sm font-semibold transition disabled:opacity-60 ${
                    rel?.lo_sigo
                      ? "border-[1.5px] border-borde hover:border-error hover:text-error"
                      : "bg-marca text-sobre-marca hover:bg-marca-fuerte"
                  }`}
                >
                  {rel?.lo_sigo ? "Siguiendo" : "Seguir"}
                </button>
              </>
            )}
          </div>
        </div>

        {aviso && <p className="mt-2 text-sm text-error">{aviso}</p>}
        <h1 className="mt-3 text-2xl font-bold tracking-tight">{f.nombre}</h1>
        <p className="text-sm text-texto-2">
          <Link href={`/categorias/${f.categoria_slug}`} className="hover:underline">
            {f.categoria}
          </Link>{" "}
          · {f.distrito}, Lima
        </p>
        {f.descripcion && <p className="mt-3 whitespace-pre-line">{f.descripcion}</p>}

        <ul className="mt-3 space-y-1.5 text-sm">
          <Fila icono="📍">
            {f.direccion}, {f.distrito}
            {f.referencia && <span className="text-texto-2"> · {f.referencia}</span>}
          </Fila>
          {(f.whatsapp || f.telefono) && (
            <Fila icono="📞">
              {f.whatsapp && (
                <a
                  href={enlaceWhatsapp(f.whatsapp, f.nombre)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-marca-fuerte hover:underline"
                >
                  WhatsApp
                </a>
              )}
              {f.whatsapp && f.telefono && " · "}
              {f.telefono && (
                <a href={`tel:+${f.telefono}`} className="font-medium text-marca-fuerte hover:underline">
                  Llamar
                </a>
              )}
            </Fila>
          )}
          <Fila icono="🕒">
            {f.abierto === null ? (
              <span className="text-texto-2">Horario no informado</span>
            ) : f.abierto ? (
              <span className="font-semibold text-green-700 dark:text-green-400">
                Abierto ahora{f.cierra_a ? ` · cierra ${hora(f.cierra_a)}` : ""}
              </span>
            ) : (
              <span className="font-semibold text-error">Cerrado ahora</span>
            )}
            {f.tiene_delivery && (
              <span className="ml-2 rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca-fuerte">
                Delivery
              </span>
            )}
          </Fila>
        </ul>

        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm text-texto-2">
          <span>
            <strong className="text-texto">{cifra(seguidores)}</strong> {seguidores === 1 ? "seguidor" : "seguidores"}
          </span>
          <span>
            <strong className="text-texto">{cifra(meGusta)}</strong> me gusta
          </span>
          <span>
            <strong className="text-texto">{cifra(f.total_publicaciones)}</strong>{" "}
            {f.total_publicaciones === 1 ? "publicación" : "publicaciones"}
          </span>
        </p>
      </div>
    </header>
  );
}
