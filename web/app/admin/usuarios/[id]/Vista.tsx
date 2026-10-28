"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { DetalleNegocio } from "@/components/panel/DetalleNegocio";
import { Migas, SinPermiso, puede, usePanel } from "@/components/panel/Panel";
import { Aviso, Caja } from "@/components/panel/Tabla";
import { ErrorApi, pedir } from "@/lib/api";
import { codigoUsuario, fecha } from "@/lib/formato";
import type { RolPanel, UsuarioAdmin } from "@/lib/tipos";

const ENTRADA = "w-full rounded-md border border-borde bg-superficie px-3 py-1.5 text-sm outline-none focus:border-marca";

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <tr className="border-b border-borde last:border-0">
      <th className="w-40 bg-fondo px-4 py-2.5 text-left align-middle text-sm font-medium text-texto-2">{etiqueta}</th>
      <td className="px-4 py-2.5 text-sm">{children}</td>
    </tr>
  );
}

function mensaje(e: unknown, otro: string): string {
  return e instanceof ErrorApi ? e.message : otro;
}

export function FichaUsuario() {
  const yo = usePanel();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [u, setU] = useState<UsuarioAdmin | null>(null);
  const [roles, setRoles] = useState<RolPanel[]>([]);
  // ?editar=1 viene del botón amarillo de la tabla.
  const [editando, setEditando] = useState(useSearchParams().has("editar"));
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [username, setUsername] = useState("");
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    pedir<UsuarioAdmin>(`/admin/usuarios/${id}`, { conSesion: true })
      .then((d) => {
        setU(d);
        setNombre(d.nombre);
        setCelular(d.telefono ?? "");
        setUsername(d.username);
      })
      .catch((e) => setError(mensaje(e, "No se pudo cargar el usuario.")));
    pedir<RolPanel[]>("/admin/roles", { conSesion: true }).then(setRoles).catch(() => {});
  }, [id]);

  if (!puede(yo, "usuarios.ver")) return <SinPermiso />;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);
    try {
      const d = await pedir<UsuarioAdmin>(`/admin/usuarios/${id}`, {
        metodo: "PATCH",
        conSesion: true,
        cuerpo: { nombre, celular, username },
      });
      setU(d);
      setCelular(d.telefono ?? "");
      setEditando(false);
      setOk("Datos guardados.");
    } catch (err) {
      setError(mensaje(err, "No se pudo guardar."));
    }
  }

  async function cambiarRol(valor: string) {
    setOk(null);
    setError(null);
    try {
      const d = await pedir<UsuarioAdmin>(`/admin/usuarios/${id}/rol-panel`, {
        metodo: "PUT",
        conSesion: true,
        cuerpo: { rol_panel_id: valor ? Number(valor) : null },
      });
      setU(d);
      setOk(d.rol_panel ? `Ahora es ${d.rol_panel.nombre}.` : "Ya no tiene acceso al panel.");
    } catch (err) {
      setError(mensaje(err, "No se pudo cambiar el rol."));
    }
  }

  async function eliminar() {
    if (!u || !window.confirm(`¿Eliminar la cuenta de ${u.nombre}? Sus datos personales se borran y no se puede deshacer.`)) return;
    try {
      await pedir(`/admin/usuarios/${id}`, { metodo: "DELETE", conSesion: true });
      router.push("/admin/usuarios");
    } catch (err) {
      setError(mensaje(err, "No se pudo eliminar."));
    }
  }

  const esAdministrador = u?.rol === "superadmin";
  const tocable = u && !esAdministrador && u.id !== yo.id;

  return (
    <div className="mx-auto max-w-4xl">
      <Migas items={[{ texto: "Usuarios", href: "/admin/usuarios" }, { texto: u ? codigoUsuario(u.id) : "…" }]} />
      {!u ? (
        error ? <Aviso error={error} /> : <p className="text-texto-2">Cargando…</p>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="flex-1 text-2xl font-bold tracking-tight">{u.nombre}</h1>
            {puede(yo, "usuarios.editar") && !editando && (
              <button type="button" onClick={() => setEditando(true)} className="rounded-md bg-amber-500 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                Editar
              </button>
            )}
            {puede(yo, "usuarios.eliminar") && tocable && (
              <button type="button" onClick={eliminar} className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
                Eliminar cuenta
              </button>
            )}
          </div>

          <Aviso ok={ok} error={error} />

          <form onSubmit={guardar}>
            <Caja>
              <table className="w-full">
                <tbody>
                  <Fila etiqueta="Código">
                    <span className="font-mono text-xs">{codigoUsuario(u.id)}</span>
                  </Fila>
                  <Fila etiqueta="Nombre">
                    {editando ? (
                      <input className={ENTRADA} required minLength={2} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
                    ) : (
                      u.nombre
                    )}
                  </Fila>
                  <Fila etiqueta="Username">
                    {editando ? (
                      <input
                        className={ENTRADA}
                        required
                        minLength={3}
                        maxLength={30}
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        title="Minúsculas, números y guiones"
                        value={username}
                        onChange={(e) => setUsername(e.target.value.toLowerCase())}
                      />
                    ) : (
                      <a href={`/${u.username}`} target="_blank" rel="noreferrer" className="text-marca-fuerte hover:underline">
                        @{u.username}
                      </a>
                    )}
                  </Fila>
                  <Fila etiqueta="Correo">{u.email}</Fila>
                  <Fila etiqueta="Celular">
                    {editando ? (
                      <input className={ENTRADA} type="tel" placeholder="987 654 321" value={celular} onChange={(e) => setCelular(e.target.value)} />
                    ) : (
                      (u.telefono ?? "—")
                    )}
                  </Fila>
                  <Fila etiqueta="Rol en el panel">
                    {esAdministrador ? (
                      "Administrador"
                    ) : puede(yo, "roles.gestionar") && tocable ? (
                      <select className={`${ENTRADA} max-w-xs`} value={u.rol_panel?.id ?? ""} onChange={(e) => cambiarRol(e.target.value)}>
                        <option value="">Sin acceso al panel</option>
                        {roles.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </select>
                    ) : (
                      (u.rol_panel?.nombre ?? "Sin acceso al panel")
                    )}
                  </Fila>
                  <Fila etiqueta="Registrado el">{fecha(u.creado_en)}</Fila>
                </tbody>
              </table>
            </Caja>
            {editando && (
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditando(false);
                    setNombre(u.nombre);
                    setCelular(u.telefono ?? "");
                    setUsername(u.username);
                  }}
                  className="rounded-md border border-borde px-3 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button type="submit" className="rounded-md bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte">
                  Guardar
                </button>
              </div>
            )}
          </form>

          <section>
            <h2 className="mb-3 text-lg font-bold">Negocios ({u.negocios.length})</h2>
            {u.negocios.length === 0 ? (
              <p className="text-sm text-texto-2">No ha registrado negocios.</p>
            ) : (
              <div className="space-y-4">
                {u.negocios.map((n) => (
                  <DetalleNegocio key={n.id} n={n} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
