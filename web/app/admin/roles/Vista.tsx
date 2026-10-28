"use client";

import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Migas, SinPermiso, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, BotonAccion, Caja, GrupoAcciones, TD, TH } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import type { Permiso, RolPanel } from "@/lib/tipos";

const ENTRADA = "w-full rounded-md border border-borde bg-superficie px-3 py-2 text-sm outline-none focus:border-marca";

interface Borrador {
  id: number | null; // null = rol nuevo
  nombre: string;
  descripcion: string;
  permisos: string[];
}

const VACIO: Borrador = { id: null, nombre: "", descripcion: "", permisos: [] };

function mensaje(e: unknown, otro: string): string {
  return e instanceof ErrorApi ? e.message : otro;
}

export function Roles() {
  const yo = usePanel();
  const [roles, setRoles] = useState<RolPanel[] | null>(null);
  const [permisos, setPermisos] = useState<Permiso[]>([]);
  const [borrador, setBorrador] = useState<Borrador | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    pedir<RolPanel[]>("/admin/roles", { conSesion: true })
      .then(setRoles)
      .catch((e) => setError(mensaje(e, "No se pudieron cargar los roles.")));
  }, []);

  useEffect(() => {
    if (!puede(yo, "roles.gestionar")) return;
    cargar();
    pedir<Permiso[]>("/admin/permisos", { conSesion: true }).then(setPermisos).catch(() => {});
  }, [yo, cargar]);

  if (!puede(yo, "roles.gestionar")) return <SinPermiso />;

  const textoPermiso = (clave: string) => permisos.find((p) => p.clave === clave)?.texto ?? clave;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!borrador) return;
    setOk(null);
    setError(null);
    try {
      const cuerpo = { nombre: borrador.nombre, descripcion: borrador.descripcion || null, permisos: borrador.permisos };
      await pedir(borrador.id ? `/admin/roles/${borrador.id}` : "/admin/roles", {
        metodo: borrador.id ? "PUT" : "POST",
        conSesion: true,
        cuerpo,
      });
      setOk(borrador.id ? `Se guardó el rol «${borrador.nombre}».` : `Se creó el rol «${borrador.nombre}».`);
      setBorrador(null);
      cargar();
    } catch (err) {
      setError(mensaje(err, "No se pudo guardar el rol."));
    }
  }

  async function eliminar(r: RolPanel) {
    if (!window.confirm(`¿Eliminar el rol «${r.nombre}»?`)) return;
    setOk(null);
    setError(null);
    try {
      await pedir(`/admin/roles/${r.id}`, { metodo: "DELETE", conSesion: true });
      setOk(`Se eliminó el rol «${r.nombre}».`);
      cargar();
    } catch (err) {
      setError(mensaje(err, "No se pudo eliminar el rol."));
    }
  }

  function alternar(clave: string) {
    setBorrador((b) =>
      b && { ...b, permisos: b.permisos.includes(clave) ? b.permisos.filter((p) => p !== clave) : [...b.permisos, clave] },
    );
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Roles y permisos" }]} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">Roles y permisos</h1>
        <button
          type="button"
          onClick={() => {
            setOk(null);
            setBorrador({ ...VACIO });
          }}
          className="flex items-center gap-2 rounded-md bg-stone-800 px-3 py-2 text-sm font-semibold text-white uppercase hover:bg-stone-900"
        >
          <span aria-hidden="true" className="text-lg leading-none">+</span> Nuevo rol
        </button>
      </div>
      <p className="mb-4 text-sm text-texto-2">
        El <strong>Administrador</strong> tiene todos los permisos y no se puede cambiar. Para dar acceso a alguien, entra a su ficha
        en Usuarios y elige su rol.
      </p>

      <div className="mb-3 space-y-2">
        <Aviso ok={ok} error={error} />
      </div>

      {borrador && (
        <form onSubmit={guardar} className="mb-6">
          <Caja className="p-5">
            <h2 className="mb-4 font-bold">{borrador.id ? `Editar «${borrador.nombre}»` : "Nuevo rol"}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-texto-2">Nombre</span>
                <input
                  className={ENTRADA}
                  required
                  minLength={3}
                  maxLength={40}
                  value={borrador.nombre}
                  onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                  placeholder="Ej. Soporte, Marketing"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-texto-2">Descripción (opcional)</span>
                <input
                  className={ENTRADA}
                  maxLength={200}
                  value={borrador.descripcion}
                  onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                />
              </label>
            </div>
            <fieldset className="mt-4">
              <legend className="mb-2 text-sm font-medium text-texto-2">Permisos</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {permisos.map((p) => (
                  <label key={p.clave} className="flex items-center gap-2 rounded-md border border-borde px-3 py-2 text-sm hover:bg-fondo">
                    <input type="checkbox" checked={borrador.permisos.includes(p.clave)} onChange={() => alternar(p.clave)} className="accent-marca" />
                    {p.texto}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setBorrador(null)} className="rounded-md border border-borde px-3 py-2 text-sm">
                Cancelar
              </button>
              <button type="submit" className="rounded-md bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte">
                Guardar rol
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
                <th className={TH}>Acciones</th>
                <th className={TH}>Rol</th>
                <th className={TH}>Permisos</th>
                <th className={`${TH} text-center`}>Usuarios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              <tr className="bg-marca-suave/40">
                <td className={TD}>—</td>
                <td className={TD}>
                  <p className="font-semibold">Administrador</p>
                  <p className="text-xs text-texto-2">Delega y da permisos.</p>
                </td>
                <td className={TD}>Todos</td>
                <td className={`${TD} text-center`}>—</td>
              </tr>
              {roles === null ? (
                <tr>
                  <td colSpan={4} className={`${TD} text-center text-texto-2`}>
                    Cargando…
                  </td>
                </tr>
              ) : (
                roles.map((r) => (
                  <tr key={r.id} className="odd:bg-fondo/60">
                    <td className={TD}>
                      <GrupoAcciones>
                        <BotonAccion
                          tipo="editar"
                          titulo="Editar"
                          onClick={() => {
                            setOk(null);
                            setBorrador({ id: r.id, nombre: r.nombre, descripcion: r.descripcion ?? "", permisos: r.permisos });
                          }}
                        />
                        <BotonAccion tipo="eliminar" titulo="Eliminar" onClick={() => eliminar(r)} />
                      </GrupoAcciones>
                    </td>
                    <td className={TD}>
                      <p className="font-semibold">{r.nombre}</p>
                      {r.descripcion && <p className="text-xs text-texto-2">{r.descripcion}</p>}
                    </td>
                    <td className={TD}>
                      {r.permisos.length === 0 ? (
                        <span className="text-texto-2">Ninguno</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.permisos.map((p) => (
                            <span key={p} className="rounded-full bg-fondo px-2 py-0.5 text-xs ring-1 ring-borde">
                              {textoPermiso(p)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className={`${TD} text-center tabular-nums`}>{r.usuarios}</td>
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
