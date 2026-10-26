"use client";

// Formularios de ingreso y registro: los usa la ventana flotante y las páginas /ingresar y /registro.
import { type FormEvent, useEffect, useState } from "react";

import { ErrorApi, pedir } from "@/lib/api";
import { guardarSesion, type Sesion } from "@/lib/sesion";

import { Boton, Campo, MensajeError } from "./Formulario";

function mensaje(err: unknown): string {
  return err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.";
}

function CampoContrasena({ etiqueta, nueva = false }: { etiqueta: string; nueva?: boolean }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-texto-2">{etiqueta}</span>
      <span className="relative block">
        <input
          name="contrasena"
          type={visible ? "text" : "password"}
          autoComplete={nueva ? "new-password" : "current-password"}
          minLength={nueva ? 8 : undefined}
          maxLength={128}
          required
          className="w-full rounded-lg border border-borde bg-superficie py-2.5 pr-20 pl-3.5 text-texto outline-none transition focus:border-marca focus:ring-2 focus:ring-marca/30"
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-2 my-auto h-8 rounded-md px-2 text-xs font-medium text-texto-2 hover:bg-fondo hover:text-texto"
        >
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </span>
    </label>
  );
}

export function FormIngreso({ alEntrar }: { alEntrar: () => void }) {
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
        cuerpo: { usuario: datos.get("usuario"), contrasena: datos.get("contrasena") },
      });
      guardarSesion(sesion);
      alEntrar();
    } catch (err) {
      setError(mensaje(err));
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <Campo etiqueta="Correo o número de celular" name="usuario" autoComplete="username" autoFocus required />
      <CampoContrasena etiqueta="Contraseña" />
      <MensajeError mensaje={error} />
      <Boton cargando={cargando}>Ingresar</Boton>
    </form>
  );
}

export function FormRegistro({ alEntrar }: { alEntrar: () => void }) {
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
          celular: datos.get("celular") || null,
          contrasena: datos.get("contrasena"),
          acepta_terminos: datos.get("acepta") === "on",
        },
      });
      guardarSesion(sesion);
      alEntrar();
    } catch (err) {
      setError(mensaje(err));
      setCargando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-3.5">
      <Campo etiqueta="Nombre" name="nombre" autoComplete="name" minLength={2} maxLength={80} autoFocus required />
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required />
      <Campo
        etiqueta="Celular (opcional, para ingresar con él)"
        name="celular"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="987 654 321"
        pattern="[+\d\s\-]{9,16}"
      />
      <CampoContrasena etiqueta="Contraseña (mínimo 8 caracteres)" nueva />
      {/* Ley 29733: consentimiento expreso, nunca marcado de antemano. */}
      <label className="flex items-start gap-2 text-sm text-texto-2">
        <input type="checkbox" name="acepta" required className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--marca)]" />
        <span>Acepto los términos de uso y el tratamiento de mis datos personales según la política de privacidad.</span>
      </label>
      <MensajeError mensaje={error} />
      <Boton cargando={cargando}>Crear cuenta</Boton>
    </form>
  );
}

// Medios configurados en el servidor: se piden una sola vez por visita.
let proveedoresEnCurso: Promise<string[]> | null = null;

function cargarProveedores(): Promise<string[]> {
  proveedoresEnCurso ??= pedir<{ proveedores: string[] }>("/auth/externo")
    .then((r) => r.proveedores)
    .catch(() => {
      proveedoresEnCurso = null;
      return [];
    });
  return proveedoresEnCurso;
}

const EXTERNOS = [
  {
    id: "google",
    texto: "Continuar con Google",
    icono: (
      <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
    ),
  },
  {
    id: "microsoft",
    texto: "Continuar con Hotmail / Outlook",
    icono: (
      <svg viewBox="0 0 21 21" className="h-5 w-5" aria-hidden="true">
        <path fill="#F25022" d="M1 1h9v9H1z" />
        <path fill="#7FBA00" d="M11 1h9v9h-9z" />
        <path fill="#00A4EF" d="M1 11h9v9H1z" />
        <path fill="#FFB900" d="M11 11h9v9h-9z" />
      </svg>
    ),
  },
];

/** Botones de Google y Microsoft. Llevan a su pantalla y vuelven a esta misma página. */
export function BotonesExternos() {
  const [activos, setActivos] = useState<string[] | null>(null);
  useEffect(() => {
    cargarProveedores().then(setActivos);
  }, []);

  function ir(id: string) {
    const volver = window.location.pathname + window.location.search;
    // Es la API (que redirige a Google/Microsoft), no una página de Next: va con navegación completa.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/api/v1/auth/externo/${id}?volver=${encodeURIComponent(volver)}`);
  }

  return (
    <div className="space-y-2.5">
      {EXTERNOS.map((e) => {
        const listo = activos?.includes(e.id) ?? false;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => ir(e.id)}
            disabled={!listo}
            title={activos && !listo ? "Muy pronto" : undefined}
            className="relative flex w-full items-center justify-center rounded-full bg-black/[0.05] px-12 py-3 text-sm font-semibold transition hover:bg-black/[0.09] disabled:cursor-not-allowed disabled:opacity-55 dark:bg-white/[0.08] dark:hover:bg-white/[0.13]"
          >
            {/* Como en TikTok: ícono pegado a la izquierda, texto al centro. */}
            <span className="absolute left-4">{e.icono}</span>
            {e.texto}
            {activos && !listo && <span className="ml-1.5 hidden text-xs font-normal text-texto-2 sm:inline">(pronto)</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Separador() {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-texto-2" aria-hidden="true">
      <span className="h-px flex-1 bg-borde" />o<span className="h-px flex-1 bg-borde" />
    </div>
  );
}
