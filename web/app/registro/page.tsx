"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Boton, Campo, MensajeError, Tarjeta } from "@/components/Formulario";
import { ErrorApi, pedir } from "@/lib/api";
import { guardarSesion, type Sesion } from "@/lib/sesion";

export default function Registro() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    setCargando(true);
    try {
      const sesion = await pedir<Sesion>("/auth/registro", {
        metodo: "POST",
        cuerpo: {
          email: datos.get("email"),
          nombre: datos.get("nombre"),
          contrasena: datos.get("contrasena"),
          acepta_terminos: datos.get("acepta") === "on",
        },
      });
      guardarSesion(sesion);
      router.push("/cuenta");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
      setCargando(false);
    }
  }

  return (
    <Tarjeta titulo="Crea tu cuenta">
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Nombre" name="nombre" autoComplete="name" minLength={2} maxLength={80} required />
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo
          etiqueta="Contraseña (mínimo 8 caracteres)"
          name="contrasena"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          required
        />
        {/* Ley 29733: consentimiento expreso, nunca marcado de antemano. */}
        <label className="flex items-start gap-2 text-sm text-texto-2">
          <input type="checkbox" name="acepta" required className="mt-0.5 h-4 w-4 accent-[var(--marca)]" />
          <span>Acepto los términos de uso y el tratamiento de mis datos personales según la política de privacidad.</span>
        </label>
        <MensajeError mensaje={error} />
        <Boton cargando={cargando}>Crear cuenta</Boton>
      </form>
      <p className="mt-5 text-center text-sm text-texto-2">
        ¿Ya tienes cuenta?{" "}
        <Link href="/ingresar" className="font-medium text-marca-fuerte underline">
          Ingresa
        </Link>
      </p>
    </Tarjeta>
  );
}
