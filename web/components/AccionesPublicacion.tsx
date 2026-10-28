"use client";

// Debajo de cada publicación: las 3 reacciones, comentarios y compartir.
import { type FormEvent, useEffect, useState } from "react";

import { abrirAcceso } from "@/lib/acceso";
import { ErrorApi, pedir } from "@/lib/api";
import { hace } from "@/lib/formato";
import { REACCIONES } from "@/lib/reacciones";
import type { Comentario, Comentarios, Publicacion, Reacciones, TipoReaccion } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const ICONO = "h-[18px] w-[18px]";

function Iniciales({ nombre }: { nombre: string }) {
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-borde text-sm font-bold text-texto-2">
      {nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

function ListaComentarios({ publicacionId, alCambiarTotal }: { publicacionId: number; alCambiarTotal: (n: number) => void }) {
  const sesion = useSesion();
  const [datos, setDatos] = useState<Comentarios | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se piden al abrir la sección (no antes: la mayoría de la gente no la abre).
  useEffect(() => {
    pedir<Comentarios>(`/publicaciones/${publicacionId}/comentarios`)
      .then(setDatos)
      .catch(() => setError("No pudimos cargar los comentarios."));
  }, [publicacionId]);

  async function verMas() {
    if (!datos?.siguiente) return;
    const mas = await pedir<Comentarios>(`/publicaciones/${publicacionId}/comentarios?despues_de=${datos.siguiente}`);
    setDatos({ ...mas, comentarios: [...datos.comentarios, ...mas.comentarios] });
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!sesion) return abrirAcceso("ingresar", "Ingresa para comentar.");
    if (!texto.trim()) return;
    setEnviando(true);
    setError(null);
    try {
      const nuevo = await pedir<Comentario>(`/publicaciones/${publicacionId}/comentarios`, {
        metodo: "POST",
        conSesion: true,
        cuerpo: { texto },
      });
      const total = (datos?.total ?? 0) + 1;
      // Si todavía hay páginas sin ver, el nuevo aparecerá al final al pedirlas.
      setDatos((d) => ({
        comentarios: d?.siguiente ? (d?.comentarios ?? []) : [...(d?.comentarios ?? []), nuevo],
        siguiente: d?.siguiente ?? null,
        total,
      }));
      alCambiarTotal(total);
      setTexto("");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
    } finally {
      setEnviando(false);
    }
  }

  async function borrar(c: Comentario) {
    if (!window.confirm("¿Borrar este comentario?")) return;
    await pedir(`/publicaciones/${publicacionId}/comentarios/${c.id}`, { metodo: "DELETE", conSesion: true });
    const total = (datos?.total ?? 1) - 1;
    setDatos((d) => (d ? { ...d, comentarios: d.comentarios.filter((x) => x.id !== c.id), total } : d));
    alCambiarTotal(total);
  }

  const esEquipo = Boolean(sesion?.usuario.en_panel) || sesion?.usuario.rol === "superadmin";

  return (
    <div className="mt-3 space-y-3 border-t border-borde pt-3">
      {datos === null && !error && <p className="text-sm text-texto-2">Cargando comentarios…</p>}
      {datos?.comentarios.length === 0 && <p className="text-sm text-texto-2">Sé el primero en comentar.</p>}
      <ul className="space-y-3">
        {datos?.comentarios.map((c) => (
          <li key={c.id} className="flex gap-2.5">
            <Iniciales nombre={c.autor.nombre} />
            <div className="min-w-0 flex-1">
              <div className="rounded-2xl bg-fondo px-3 py-2 ring-1 ring-borde">
                <p className="text-sm font-semibold">{c.autor.nombre}</p>
                <p className="whitespace-pre-line break-words text-sm">{c.texto}</p>
              </div>
              <p className="mt-0.5 flex gap-3 px-3 text-xs text-texto-2">
                <span>{hace(c.creado_en)}</span>
                {(c.autor.id === sesion?.usuario.id || esEquipo) && (
                  <button type="button" onClick={() => borrar(c)} className="font-medium hover:text-error">
                    Borrar
                  </button>
                )}
              </p>
            </div>
          </li>
        ))}
      </ul>
      {datos?.siguiente && (
        <button type="button" onClick={verMas} className="text-sm font-medium text-texto-2 hover:text-texto">
          Ver más comentarios
        </button>
      )}
      <form onSubmit={enviar} className="flex items-center gap-2">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onFocus={() => !sesion && abrirAcceso("ingresar", "Ingresa para comentar.")}
          maxLength={1000}
          aria-label="Escribe un comentario"
          placeholder="Escribe un comentario…"
          className="min-w-0 flex-1 rounded-full bg-fondo px-4 py-2 text-sm outline-none ring-1 ring-borde focus:ring-marca"
        />
        <button
          type="submit"
          disabled={enviando || !texto.trim()}
          className="rounded-full bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-50"
        >
          {enviando ? "…" : "Enviar"}
        </button>
      </form>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}

export function AccionesPublicacion({ publicacion: p }: { publicacion: Publicacion }) {
  const sesion = useSesion();
  const [estado, setEstado] = useState<Reacciones>({
    reacciones: p.reacciones,
    total: p.total_reacciones,
    mi_reaccion: p.mi_reaccion,
  });
  const [comentarios, setComentarios] = useState(p.total_comentarios);
  const [abiertos, setAbiertos] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  async function reaccionar(tipo: TipoReaccion) {
    if (!sesion) return abrirAcceso("ingresar", "Ingresa para reaccionar a las publicaciones.");
    const anterior = estado;
    const quitar = estado.mi_reaccion === tipo;
    // Se ve al instante; si la API falla, se vuelve atrás.
    const reacciones = { ...estado.reacciones };
    if (estado.mi_reaccion) reacciones[estado.mi_reaccion] -= 1;
    if (!quitar) reacciones[tipo] += 1;
    setEstado({
      reacciones,
      total: Object.values(reacciones).reduce((a, b) => a + b, 0),
      mi_reaccion: quitar ? null : tipo,
    });
    try {
      const r = await pedir<Reacciones>(`/publicaciones/${p.id}/reaccion`, {
        metodo: quitar ? "DELETE" : "PUT",
        conSesion: true,
        cuerpo: quitar ? undefined : { tipo },
      });
      setEstado(r);
    } catch {
      setEstado(anterior);
    }
  }

  async function compartir() {
    const url = `${window.location.origin}/n/${p.negocio.slug}#publicacion-${p.id}`;
    const titulo = `${p.negocio.nombre} en Altoque`;
    try {
      if (navigator.share) {
        await navigator.share({ title: titulo, text: p.texto.slice(0, 120), url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setAviso("¡Enlace copiado!");
    } catch (e) {
      if ((e as Error).name !== "AbortError") setAviso("No se pudo compartir. Copia el enlace de la barra.");
    }
    setTimeout(() => setAviso(null), 2500);
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1 border-t border-borde pt-2 text-sm">
        {REACCIONES.map((r) => {
          const mia = estado.mi_reaccion === r.tipo;
          const n = estado.reacciones[r.tipo];
          return (
            <button
              key={r.tipo}
              type="button"
              onClick={() => reaccionar(r.tipo)}
              aria-pressed={mia}
              title={r.texto}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1.5 transition ${
                mia ? "bg-marca-suave font-semibold text-marca-fuerte ring-1 ring-marca/40" : "text-texto-2 hover:bg-fondo"
              }`}
            >
              <span className={`text-lg leading-none transition ${mia ? "scale-110" : ""}`} aria-hidden="true">
                {r.emoji}
              </span>
              <span className="sr-only">{r.texto}</span>
              <span className="min-w-3 tabular-nums">{n > 0 ? n : ""}</span>
            </button>
          );
        })}

        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => setAbiertos((a) => !a)}
            aria-expanded={abiertos}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-texto-2 hover:bg-fondo hover:text-texto"
          >
            <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
              <path d="M4 4h16v12H8l-4 4z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span className="tabular-nums">{comentarios > 0 ? comentarios : ""}</span>
            <span className="hidden sm:inline">Comentar</span>
          </button>
          <button
            type="button"
            onClick={compartir}
            className="flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-texto-2 hover:bg-fondo hover:text-texto"
          >
            <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
              <path
                d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">Compartir</span>
          </button>
        </span>
      </div>
      {aviso && (
        <p role="status" className="mt-1 text-right text-xs font-medium text-marca-fuerte">
          {aviso}
        </p>
      )}
      {abiertos && <ListaComentarios publicacionId={p.id} alCambiarTotal={setComentarios} />}
    </div>
  );
}
