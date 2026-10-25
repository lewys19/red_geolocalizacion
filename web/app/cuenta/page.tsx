"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Tarjeta } from "@/components/Formulario";
import { pedir } from "@/lib/api";
import { guardarSesion, leerSesion } from "@/lib/sesion";
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

export default function Cuenta() {
  const sesion = useSesion();
  const router = useRouter();
  const [yo, setYo] = useState<Yo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sesion) return;
    pedir<Yo>("/yo", { conSesion: true })
      .then(setYo)
      .catch(() => setError("No se pudo cargar tu cuenta."));
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
            <dd className="font-medium">
              {yo.negocios.length
                ? yo.negocios.map((n) => n.negocio_nombre).join(", ")
                : "Todavía ninguno. Podrás registrarlo muy pronto."}
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
