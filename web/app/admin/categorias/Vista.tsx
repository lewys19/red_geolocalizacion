"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Migas, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, BotonAccion, Caja, GrupoAcciones, TD, TH } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import { emojiDe } from "@/lib/iconos";
import type { CategoriaAdmin } from "@/lib/tipos";

const ENTRADA = "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm outline-none focus:border-marca";
// Para elegir rápido; también se puede escribir o pegar cualquier otro emoji.
const SUGERIDOS = ["🐾", "🐶", "🛒", "🏨", "🏥", "🦷", "💇", "🧺", "🔧", "🚗", "🏋️", "📚", "🎉", "🌸", "📱", "👗"];

interface Borrador {
  id: number | null; // null = categoría nueva
  nombre: string;
  icono: string;
  padre_id: string; // "" = categoría principal
  orden: string;
}

function mensaje(e: unknown, otro: string): string {
  return e instanceof ErrorApi ? e.message : otro;
}

export function Categorias() {
  const yo = usePanel();
  const [categorias, setCategorias] = useState<CategoriaAdmin[] | null>(null);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    pedir<CategoriaAdmin[]>("/admin/categorias", { conSesion: true })
      .then(setCategorias)
      .catch((e) => setError(mensaje(e, "No se pudieron cargar las categorías.")));
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const gestiona = puede(yo, "categorias.gestionar");
  // Solo las principales pueden tener subcategorías (dos niveles).
  const principales = (categorias ?? []).filter((c) => c.padre_id === null && c.id !== borrador?.id);

  function nueva() {
    setOk(null);
    setError(null);
    const siguiente = Math.max(0, ...(categorias ?? []).map((c) => c.orden)) + 1;
    setBorrador({ id: null, nombre: "", icono: "", padre_id: "", orden: String(siguiente) });
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    setOk(null);
    setError(null);
    const cuerpo = {
      nombre: borrador.nombre,
      icono: borrador.icono || null,
      padre_id: borrador.padre_id ? Number(borrador.padre_id) : null,
      orden: Number(borrador.orden) || 0,
    };
    try {
      await pedir(borrador.id ? `/admin/categorias/${borrador.id}` : "/admin/categorias", {
        metodo: borrador.id ? "PUT" : "POST",
        conSesion: true,
        cuerpo,
      });
      setOk(borrador.id ? `Se guardó «${borrador.nombre}».` : `Se creó «${borrador.nombre}». Ya aparece en la web.`);
      setBorrador(null);
      cargar();
    } catch (err) {
      setError(mensaje(err, "No se pudo guardar."));
    }
  }

  async function eliminar(c: CategoriaAdmin) {
    if (!window.confirm(`¿Eliminar la categoría «${c.nombre}»?`)) return;
    setOk(null);
    setError(null);
    try {
      await pedir(`/admin/categorias/${c.id}`, { metodo: "DELETE", conSesion: true });
      setOk(`Se eliminó «${c.nombre}».`);
      cargar();
    } catch (err) {
      setError(mensaje(err, "No se pudo eliminar."));
    }
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Categorías" }]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Categorías</h1>
        {gestiona && (
          <button
            type="button"
            onClick={nueva}
            className="flex items-center gap-2 rounded-md bg-stone-800 px-3 py-2 text-sm font-semibold text-white uppercase hover:bg-stone-900"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span> Nueva categoría
          </button>
        )}
      </div>
      <p className="mb-4 text-sm text-texto-2">
        Lo que cambies aquí aparece al instante en la sección Categorías, en los filtros del mapa y al crear un negocio. Hay
        dos niveles: una categoría principal (Comida) puede tener subcategorías (Pollerías, Chifas…); los negocios se
        asignan a la del último nivel.
      </p>

      <div className="mb-3 space-y-2">
        <Aviso ok={ok} error={error} />
      </div>

      {borrador && (
        <form onSubmit={guardar} className="mb-6">
          <Caja className="p-5">
            <h2 className="mb-4 font-bold">{borrador.id ? `Editar «${borrador.nombre}»` : "Nueva categoría"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-texto-2">Nombre</span>
                <input
                  className={ENTRADA}
                  required
                  minLength={2}
                  maxLength={60}
                  value={borrador.nombre}
                  onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                  placeholder="Ej. Animales"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-texto-2">Va dentro de</span>
                <select
                  className={ENTRADA}
                  value={borrador.padre_id}
                  onChange={(e) => setBorrador({ ...borrador, padre_id: e.target.value })}
                >
                  <option value="">— Es una categoría principal —</option>
                  {principales.map((c) => (
                    <option key={c.id} value={c.id}>
                      {emojiDe(c.icono)} {c.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <div className="text-sm">
                <span className="mb-1 block font-medium text-texto-2">Ícono (un emoji)</span>
                <div className="flex items-center gap-2">
                  <input
                    className={`${ENTRADA} w-20 text-center text-lg`}
                    maxLength={16}
                    value={borrador.icono}
                    onChange={(e) => setBorrador({ ...borrador, icono: e.target.value })}
                    placeholder="📍"
                    aria-label="Emoji"
                  />
                  <div className="flex flex-wrap gap-1">
                    {SUGERIDOS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => setBorrador({ ...borrador, icono: e })}
                        className={`rounded-md px-1.5 py-1 text-lg hover:bg-fondo ${borrador.icono === e ? "ring-2 ring-marca" : ""}`}
                        aria-label={`Usar ${e}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-texto-2">Orden (menor = aparece antes)</span>
                <input
                  className={`${ENTRADA} w-28`}
                  type="number"
                  min={0}
                  max={999}
                  value={borrador.orden}
                  onChange={(e) => setBorrador({ ...borrador, orden: e.target.value })}
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBorrador(null)} className="rounded-md border border-borde px-3 py-2 text-sm">
                Cancelar
              </button>
              <button type="submit" className="rounded-md bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte">
                Guardar categoría
              </button>
            </div>
          </Caja>
        </form>
      )}

      <Caja>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="bg-stone-500 text-white dark:bg-stone-700">
              <tr>
                {gestiona && <th className={TH}>Acciones</th>}
                <th className={TH}>Categoría</th>
                <th className={TH}>Va dentro de</th>
                <th className={`${TH} text-center`}>Negocios</th>
                <th className={`${TH} text-center`}>Orden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {categorias === null ? (
                <tr>
                  <td colSpan={5} className={`${TD} text-center text-texto-2`}>
                    Cargando…
                  </td>
                </tr>
              ) : (
                categorias.map((c) => (
                  <tr key={c.id} className={c.padre_id === null ? "bg-fondo/60" : ""}>
                    {gestiona && (
                      <td className={TD}>
                        <GrupoAcciones>
                          <BotonAccion
                            tipo="editar"
                            titulo="Editar"
                            onClick={() => {
                              setOk(null);
                              setError(null);
                              setBorrador({
                                id: c.id,
                                nombre: c.nombre,
                                icono: c.icono ?? "",
                                padre_id: c.padre_id ? String(c.padre_id) : "",
                                orden: String(c.orden),
                              });
                            }}
                          />
                          <BotonAccion tipo="eliminar" titulo="Eliminar" onClick={() => eliminar(c)} />
                        </GrupoAcciones>
                      </td>
                    )}
                    <td className={`${TD} ${c.padre_id ? "pl-10" : "font-semibold"}`}>
                      <span className="mr-2 text-lg" aria-hidden="true">
                        {emojiDe(c.icono)}
                      </span>
                      {c.nombre}
                      {c.hijas > 0 && <span className="ml-2 text-xs font-normal text-texto-2">({c.hijas} subcategorías)</span>}
                    </td>
                    <td className={`${TD} text-texto-2`}>{c.padre ?? "—"}</td>
                    <td className={`${TD} text-center tabular-nums`}>{c.hijas > 0 ? "—" : c.negocios}</td>
                    <td className={`${TD} text-center tabular-nums`}>{c.orden}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Caja>
    </div>
  );
}
