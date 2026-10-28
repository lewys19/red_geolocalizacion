"use client";

// Una publicación del muro (Inicio y perfil del negocio). Su dueño ve un menú de tres puntos
// para editar el texto o borrarla.
import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { AccionesPublicacion } from "./AccionesPublicacion";

import { ErrorApi, pedir } from "@/lib/api";
import { distancia, hace } from "@/lib/formato";
import type { Foto, NegocioMini, Publicacion } from "@/lib/tipos";

export function Avatar({ negocio, tamano = "h-11 w-11 text-lg" }: { negocio: NegocioMini; tamano?: string }) {
  return negocio.foto ? (
    // Fotos ya optimizadas por la API (WebP de 1600 px): no hace falta next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={negocio.foto} alt="" className={`${tamano} shrink-0 rounded-full object-cover`} loading="lazy" />
  ) : (
    <span
      className={`${tamano} flex shrink-0 items-center justify-center rounded-full bg-marca font-bold text-sobre-marca`}
    >
      {negocio.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Mosaico como en el diseño: 1 foto ancha; 2 lado a lado; 3 = dos a la izquierda y una alta a la derecha; 4 = cuadrícula. */
function Mosaico({ fotos, nombre }: { fotos: Foto[]; nombre: string }) {
  if (!fotos.length) return null;
  const celda = (f: Foto, i: number, clase: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={f.id}
      src={f.url}
      alt={`${nombre}, foto ${i + 1}`}
      loading="lazy"
      className={`h-full w-full rounded-xl object-cover ${clase}`}
    />
  );
  if (fotos.length === 1) return <div className="mt-3">{celda(fotos[0], 0, "max-h-[28rem]")}</div>;
  if (fotos.length === 2)
    return <div className="mt-3 grid h-64 grid-cols-2 gap-2">{fotos.map((f, i) => celda(f, i, ""))}</div>;
  if (fotos.length === 3)
    return (
      <div className="mt-3 grid h-80 grid-cols-2 grid-rows-2 gap-2">
        {celda(fotos[0], 0, "")}
        {celda(fotos[1], 1, "row-span-2 col-start-2 row-start-1")}
        {celda(fotos[2], 2, "")}
      </div>
    );
  return (
    <div className="mt-3 grid h-80 grid-cols-2 grid-rows-2 gap-2">
      {fotos.slice(0, 4).map((f, i) => celda(f, i, ""))}
    </div>
  );
}

function MenuPublicacion({ alEditar, alBorrar }: { alEditar: () => void; alBorrar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!caja.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("pointerdown", fuera);
    return () => document.removeEventListener("pointerdown", fuera);
  }, [abierto]);
  const opcion = "block w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-fondo";
  return (
    <div ref={caja} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setAbierto((a) => !a)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label="Opciones de la publicación"
        className="flex h-9 w-9 items-center justify-center rounded-full text-texto-2 hover:bg-fondo hover:text-texto"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
          <circle cx="5" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="12" r="2" fill="currentColor" />
          <circle cx="19" cy="12" r="2" fill="currentColor" />
        </svg>
      </button>
      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-borde bg-superficie p-1.5 shadow-lg"
        >
          <button
            role="menuitem"
            type="button"
            className={opcion}
            onClick={() => {
              setAbierto(false);
              alEditar();
            }}
          >
            ✏️ Editar texto
          </button>
          <button
            role="menuitem"
            type="button"
            className={`${opcion} text-error`}
            onClick={() => {
              setAbierto(false);
              alBorrar();
            }}
          >
            🗑️ Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

export function TarjetaPublicacion({ publicacion, ahora }: { publicacion: Publicacion; ahora?: Date }) {
  const [p, setP] = useState(publicacion);
  const [editando, setEditando] = useState(false);
  const [borrador, setBorrador] = useState(publicacion.texto);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [borrada, setBorrada] = useState(false);
  const ruta = `/negocios/${p.negocio.id}/publicaciones/${p.id}`;

  // Llegan datos nuevos (p. ej. al iniciar sesión se marca tu reacción): se toman, salvo mientras se edita.
  const [vista, setVista] = useState(publicacion);
  if (publicacion !== vista) {
    setVista(publicacion);
    if (!editando) setP(publicacion);
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      setP(await pedir<Publicacion>(ruta, { metodo: "PATCH", conSesion: true, cuerpo: { texto: borrador } }));
      setEditando(false);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    if (!window.confirm("¿Eliminar esta publicación? No se puede deshacer.")) return;
    try {
      await pedir(ruta, { metodo: "DELETE", conSesion: true });
      setBorrada(true);
    } catch (err) {
      window.alert(err instanceof ErrorApi ? err.message : "No se pudo eliminar.");
    }
  }

  if (borrada) return null;
  return (
    <article
      id={`publicacion-${p.id}`}
      className="scroll-mt-20 rounded-2xl border border-borde bg-superficie p-4 shadow-sm"
    >
      <header className="flex items-center gap-3">
        <Link href={`/n/${p.negocio.slug}`}>
          <Avatar negocio={p.negocio} />
        </Link>
        <div className="min-w-0">
          <Link
            href={`/n/${p.negocio.slug}`}
            className="block truncate font-bold uppercase tracking-tight hover:underline"
          >
            {p.negocio.nombre}
          </Link>
          <p className="truncate text-sm text-texto-2">
            {p.negocio.distrito} - Lima · {hace(p.creado_en, ahora)}
            {p.editado_en && " · (editado)"}
            {p.negocio.distancia_m !== null && ` · ${distancia(p.negocio.distancia_m)}`}
          </p>
        </div>
        {p.es_mia && !editando && (
          <MenuPublicacion
            alEditar={() => {
              setBorrador(p.texto);
              setEditando(true);
            }}
            alBorrar={borrar}
          />
        )}
      </header>
      {editando ? (
        <form onSubmit={guardar} className="mt-3 space-y-2">
          <textarea
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            rows={4}
            maxLength={2000}
            autoFocus
            aria-label="Texto de la publicación"
            className="w-full rounded-xl border border-borde bg-superficie px-3 py-2 text-[15px] outline-none focus:border-marca"
          />
          {error && <p className="text-sm text-error">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="rounded-full border border-borde px-4 py-1.5 text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="rounded-full bg-marca px-4 py-1.5 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-60"
            >
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      ) : (
        p.texto && <p className="mt-3 whitespace-pre-line text-[15px]">{p.texto}</p>
      )}
      <Mosaico fotos={p.fotos} nombre={p.negocio.nombre} />
      {/* La clave cambia cuando llegan datos nuevos (p. ej. al iniciar sesión se marca tu reacción). */}
      <AccionesPublicacion key={`${p.mi_reaccion}-${p.total_reacciones}-${p.total_comentarios}`} publicacion={p} />
    </article>
  );
}
