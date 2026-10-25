"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import { Boton, Campo, MensajeError, Tarjeta } from "@/components/Formulario";
import { ErrorApi, pedir } from "@/lib/api";
import { guardarSesion, type Sesion } from "@/lib/sesion";

export default function Ingresar() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    setCargando(true);
    try {
      const sesion = await pedir<Sesion>("/auth/login", {
        metodo: "POST",
        cuerpo: { email: datos.get("email"), contrasena: datos.get("contrasena") },
      });
      guardarSesion(sesion);
      router.push("/cuenta");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
      setCargando(false);
    }
  }

  return (
    <Tarjeta titulo="Ingresa a Altoque">
      <form onSubmit={enviar} className="space-y-4">
        <Campo etiqueta="Email" name="email" type="email" autoComplete="email" required />
        <Campo etiqueta="Contraseña" name="contrasena" type="password" autoComplete="current-password" required />
        <MensajeError mensaje={error} />
        <Boton cargando={cargando}>Ingresar</Boton>
      </form>
      <p className="mt-5 text-center text-sm text-texto-2">
        ¿No tienes cuenta?{" "}
        <Link href="/registro" className="font-medium text-marca-fuerte underline">
          Créala gratis
        </Link>
      </p>
    </Tarjeta>
  );
}
