"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Tarjeta } from "@/components/Formulario";
import { pedir } from "@/lib/api";
import { guardarSesion, leerSesion } from "@/lib/sesion";
import type { EstadoNegocio, Negocio } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

interface Yo {
  nombre: string;
  email: string;
  rol: "cliente" | "operador" | "superadmin";
  negocios: { negocio_id: number; negocio_nombre: string; rol: string }[];
  es_negocio: boolean;
  es_operador: boolean;
  es_superadmin: boolean;
}

const NOMBRE_ROL = { cliente: "Cliente", operador: "Operador", superadmin: "Superadministrador" };

const ESTADO: Record<EstadoNegocio, { texto: string; clase: string }> = {
  pendiente: { texto: "En revisión", clase: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  aprobado: { texto: "En el mapa", clase: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300" },
  rechazado: { texto: "Por corregir", clase: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
  suspendido: { texto: "Suspendido", clase: "bg-borde text-texto-2" },
};

export default function Cuenta() {
  const sesion = useSesion();
  const router = useRouter();
  const [yo, setYo] = useState<Yo | null>(null);
  const [negocios, setNegocios] = useState<Negocio[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    pedir<Yo>("/yo", { conSesion: true })
      .then(setYo)
      .catch(() => setError("No se pudo cargar tu cuenta."));
    pedir<Negocio[]>("/negocios/mios", { conSesion: true })
      .then(setNegocios)
      .catch(() => {});
  }, [sesion]);

  async function salir() {
    const actual = leerSesion();
    if (actual) {
      await pedir("/auth/salir", { metodo: "POST", cuerpo: { token_refresco: actual.token_refresco } }).catch(() => {});
    }
    guardarSesion(null);
    router.push("/");
  }

  async function eliminar() {
    if (!window.confirm("¿Eliminar tu cuenta? Tus datos personales se borran y no se puede deshacer.")) return;
    await pedir("/yo", { metodo: "DELETE", conSesion: true });
    guardarSesion(null);
    router.push("/");
  }

  if (!sesion) {
    return (
      <Tarjeta titulo="Tu cuenta">
        <p className="text-center text-texto-2">
          <Link href="/ingresar" className="font-medium text-marca-fuerte underline">
            Ingresa
          </Link>{" "}
          para ver tu cuenta.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta titulo={`Hola, ${sesion.usuario.nombre.split(" ")[0]}`}>
      {error && <p className="text-sm text-error">{error}</p>}
      {yo && (
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="text-texto-2">Email</dt>
            <dd className="font-medium">{yo.email}</dd>
          </div>
          <div>
            <dt className="text-texto-2">Rol</dt>
            <dd className="font-medium">
              {NOMBRE_ROL[yo.rol]}
              {yo.es_negocio && " · Negocio"}
            </dd>
          </div>
          <div>
            <dt className="text-texto-2">Mis negocios</dt>
            <dd>
              {negocios.length ? (
                <ul className="mt-1 space-y-2">
                  {negocios.map((n) => (
                    <li key={n.id} className="rounded-lg border border-borde p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{n.nombre}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO[n.estado].clase}`}>
                          {ESTADO[n.estado].texto}
                        </span>
                      </div>
                      <p className="text-xs text-texto-2">
                        {n.categoria} · {n.distrito}
                      </p>
                      {n.motivo_rechazo && <p className="mt-1 text-xs text-error">Motivo: {n.motivo_rechazo}</p>}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-medium">Todavía ninguno.</p>
              )}
              <Link
                href="/negocios/nuevo"
                className="mt-2 inline-block rounded-full bg-marca px-3 py-1.5 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte"
              >
                Registrar {negocios.length ? "otro" : "mi"} negocio
              </Link>
            </dd>
          </div>
        </dl>
      )}
      <div className="mt-6 space-y-2">
        <button
          type="button"
          onClick={salir}
          className="w-full rounded-lg border border-borde px-4 py-2.5 font-medium hover:border-marca"
        >
          Cerrar sesión
        </button>
        <button type="button" onClick={eliminar} className="w-full px-4 py-2 text-sm text-error hover:underline">
          Eliminar mi cuenta
        </button>
      </div>
    </Tarjeta>
  );
}
