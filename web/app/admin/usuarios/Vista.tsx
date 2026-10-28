"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Migas, SinPermiso, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, BotonAccion, Caja, GrupoAcciones, Paginacion, TD, TH } from "@/components/panel/Tabla";
import { ErrorApi, descargar, pedir } from "@/lib/api";
import { codigoUsuario, fecha } from "@/lib/formato";
import type { PaginaUsuarios, UsuarioFila } from "@/lib/tipos";

const POR_PAGINA = [10, 25, 50];

function rolEnPanel(u: UsuarioFila): string {
  if (u.rol === "superadmin") return "Administrador";
  return u.rol_panel?.nombre ?? "—";
}

export function Usuarios() {
  const yo = usePanel();
  const router = useRouter();
  const [texto, setTexto] = useState("");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [porPagina, setPorPagina] = useState(10);
  const [datos, setDatos] = useState<PaginaUsuarios | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // La búsqueda se aplica al dejar de escribir (no una petición por tecla).
  useEffect(() => {
    const espera = setTimeout(() => {
      setQ(texto.trim());
      setPagina(1);
    }, 350);
    return () => clearTimeout(espera);
  }, [texto]);

  const cargar = useCallback(() => {
    const params = new URLSearchParams({ pagina: String(pagina), por_pagina: String(porPagina) });
    if (q) params.set("q", q);
    pedir<PaginaUsuarios>(`/admin/usuarios?${params}`, { conSesion: true })
      .then((d) => (setDatos(d), setError(null)))
      .catch((e) => setError(e instanceof ErrorApi ? e.message : "No se pudo cargar la lista."));
  }, [q, pagina, porPagina]);

  useEffect(() => {
    if (puede(yo, "usuarios.ver")) cargar();
  }, [yo, cargar]);

  if (!puede(yo, "usuarios.ver")) return <SinPermiso />;

  async function eliminar(u: UsuarioFila) {
    if (!window.confirm(`¿Eliminar la cuenta de ${u.nombre} (${u.email})? Sus datos personales se borran y no se puede deshacer.`)) return;
    setOk(null);
    try {
      await pedir(`/admin/usuarios/${u.id}`, { metodo: "DELETE", conSesion: true });
      setOk(`Se eliminó la cuenta de ${u.nombre}.`);
      cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo eliminar.");
    }
  }

  async function exportar() {
    try {
      await descargar(`/admin/usuarios/exportar${q ? `?q=${encodeURIComponent(q)}` : ""}`, "usuarios-altoque.csv");
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : "No se pudo exportar.");
    }
  }

  const editar = puede(yo, "usuarios.editar");
  const borrar = puede(yo, "usuarios.eliminar");

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Usuarios" }]} />
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Usuarios registrados</h1>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={exportar}
          className="flex items-center gap-2 rounded-md border border-borde bg-superficie px-3 py-2 text-sm font-semibold uppercase shadow-sm hover:bg-fondo"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
            <path d="M5 20h14v-2H5zm7-16-5 5h3v6h4V9h3z" fill="currentColor" />
          </svg>
          Exportar
        </button>
        <label className="order-last flex w-full items-center overflow-hidden rounded-md border border-borde bg-superficie shadow-sm sm:order-none sm:w-auto sm:max-w-sm sm:flex-1">
          <span className="sr-only">Buscar</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por nombre, username, correo, celular o código"
            className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm outline-none"
          />
          <svg viewBox="0 0 24 24" className="mx-3 h-4 w-4 text-texto-2" aria-hidden="true">
            <path d="M10 2a8 8 0 0 1 6.3 12.9l5.4 5.4-1.4 1.4-5.4-5.4A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" fill="currentColor" />
          </svg>
        </label>
        <label className="ml-auto flex items-center gap-2 text-sm text-texto-2">
          Resultados
          <select
            value={porPagina}
            onChange={(e) => {
              setPorPagina(Number(e.target.value));
              setPagina(1);
            }}
            className="rounded-md border border-borde bg-superficie px-2 py-1.5 text-texto"
          >
            {POR_PAGINA.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-3 space-y-2">
        <Aviso ok={ok} error={error} />
      </div>

      <Caja>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead className="bg-stone-500 text-white dark:bg-stone-700">
              <tr>
                <th className={TH}>Acciones</th>
                <th className={TH}>Código</th>
                <th className={TH}>Username</th>
                <th className={TH}>Nombre</th>
                <th className={TH}>Correo</th>
                <th className={TH}>Celular</th>
                <th className={TH}>Rol</th>
                <th className={TH}>Registro</th>
                <th className={`${TH} text-center`}>Negocios</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {datos === null ? (
                <tr>
                  <td colSpan={9} className={`${TD} text-center text-texto-2`}>
                    Cargando…
                  </td>
                </tr>
              ) : datos.usuarios.length === 0 ? (
                <tr>
                  <td colSpan={9} className={`${TD} text-center text-texto-2`}>
                    {q ? "Nadie coincide con la búsqueda." : "Todavía no hay usuarios."}
                  </td>
                </tr>
              ) : (
                datos.usuarios.map((u) => (
                  <tr key={u.id} className="odd:bg-fondo/60 hover:bg-marca-suave/40">
                    <td className={TD}>
                      <GrupoAcciones>
                        <BotonAccion tipo="ver" titulo="Ver ficha" onClick={() => router.push(`/admin/usuarios/${u.id}`)} />
                        {editar && (
                          <BotonAccion tipo="editar" titulo="Editar" onClick={() => router.push(`/admin/usuarios/${u.id}?editar=1`)} />
                        )}
                        {borrar && u.rol !== "superadmin" && u.id !== yo.id && (
                          <BotonAccion tipo="eliminar" titulo="Eliminar" onClick={() => eliminar(u)} />
                        )}
                      </GrupoAcciones>
                    </td>
                    <td className={`${TD} font-mono text-xs`}>{codigoUsuario(u.id)}</td>
                    <td className={TD}>
                      <a href={`/${u.username}`} target="_blank" rel="noreferrer" className="text-marca-fuerte hover:underline">
                        @{u.username}
                      </a>
                    </td>
                    <td className={`${TD} font-medium`}>{u.nombre}</td>
                    <td className={TD}>{u.email}</td>
                    <td className={`${TD} tabular-nums`}>{u.telefono ?? "—"}</td>
                    <td className={TD}>{rolEnPanel(u)}</td>
                    <td className={`${TD} tabular-nums`}>{fecha(u.creado_en)}</td>
                    <td className={`${TD} text-center`}>
                      <span className="rounded-full bg-fondo px-2 py-0.5 text-xs font-semibold ring-1 ring-borde">{u.negocios}</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {datos && <Paginacion pagina={datos.pagina} porPagina={datos.por_pagina} total={datos.total} alCambiar={setPagina} />}
      </Caja>
    </div>
  );
}
