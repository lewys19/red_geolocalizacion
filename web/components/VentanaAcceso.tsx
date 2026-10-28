"use client";

import { useEffect, useRef } from "react";

import { abrirAcceso, cerrarAcceso, useAcceso, type Vista } from "@/lib/acceso";
import { pedir } from "@/lib/api";
import { guardarSesion, type Sesion } from "@/lib/sesion";

import { BotonesExternos, FormIngreso, FormRegistro, Separador } from "./FormulariosAcceso";
import { Isotipo } from "./Logo";

const TEXTOS: Record<Vista, { titulo: string; bajada: string }> = {
  ingresar: {
    titulo: "Inicia sesión en Altoque",
    bajada: "Encuentra lo que buscas, al toque.",
  },
  registro: {
    titulo: "Crea tu cuenta en Altoque",
    bajada: "Es gratis. Encuentra lo que buscas.",
  },
};

const ERRORES_EXTERNOS: Record<string, string> = {
  cancelado: "Se canceló el ingreso. Puedes intentarlo otra vez.",
  fallo: "No pudimos conectar con Google. Inténtalo en un momento.",
  eliminada: "Esa cuenta fue eliminada.",
};

/** Al volver de Google (o Microsoft) la URL trae ?ingreso=<código> (o ?ingreso_error=...). */
function useVueltaExterna() {
  useEffect(() => {
    const url = new URL(window.location.href);
    const codigo = url.searchParams.get("ingreso");
    const error = url.searchParams.get("ingreso_error");
    if (!codigo && !error) return;
    url.searchParams.delete("ingreso");
    url.searchParams.delete("ingreso_error");
    window.history.replaceState(window.history.state, "", url);
    if (error) {
      abrirAcceso("ingresar", ERRORES_EXTERNOS[error] ?? ERRORES_EXTERNOS.fallo);
      return;
    }
    pedir<Sesion>("/auth/externo/canje", { metodo: "POST", cuerpo: { codigo } })
      .then(guardarSesion)
      .catch((e: Error) => abrirAcceso("ingresar", e.message));
  }, []);
}

/** Ventana flotante de ingreso y registro. Va una sola vez en el layout. */
export function VentanaAcceso() {
  const { vista, aviso } = useAcceso();
  const dialogo = useRef<HTMLDialogElement>(null);
  useVueltaExterna();

  // <dialog> nativo: oscurece el fondo, atrapa el foco y se cierra con Esc.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (vista && !d.open) d.showModal();
    if (!vista && d.open) d.close();
  }, [vista]);

  const textos = TEXTOS[vista ?? "ingresar"];

  return (
    <dialog
      ref={dialogo}
      aria-labelledby="titulo-acceso"
      onClose={cerrarAcceso}
      // Clic en la parte oscura (fuera de la tarjeta) = cerrar.
      onClick={(e) => e.target === e.currentTarget && cerrarAcceso()}
      // overflow visible: el logo sobresale del borde superior; lo que se desplaza es la tarjeta de adentro.
      className="ventana-acceso m-auto w-[min(24rem,calc(100%-2rem))] overflow-visible bg-transparent p-0 text-texto"
    >
      {vista && (
        <div className="relative mt-10">
          {/* Logo a medio salir del borde (la mitad afuera). */}
          <span className="absolute top-0 left-1/2 z-10 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-borde bg-superficie shadow-md">
            <Isotipo className="h-14 w-14" redondo />
          </span>
          <div
            key={vista}
            className="relative max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-3xl border border-borde bg-superficie px-6 pt-12 pb-5 shadow-2xl sm:px-7 [&_form]:space-y-2.5 [&_input]:py-1.5 [&_label>span:first-child]:mb-0.5 [&_label>span:first-child]:text-xs"
          >
            <button
              type="button"
              onClick={cerrarAcceso}
              aria-label="Cerrar"
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-full text-xl text-texto-2 hover:bg-fondo hover:text-texto"
            >
              ×
            </button>

            <header className="mb-4 text-center">
              <h2 id="titulo-acceso" className="text-xl font-bold tracking-tight">
                {textos.titulo}
              </h2>
              <p className="mt-1 text-xs text-texto-2">{textos.bajada}</p>
            </header>

            {aviso && <p className="mb-4 rounded-lg bg-marca-suave px-3 py-2 text-sm text-marca-fuerte">{aviso}</p>}

            {vista === "ingresar" ? <FormIngreso alEntrar={cerrarAcceso} /> : <FormRegistro alEntrar={cerrarAcceso} />}

            <Separador />
            <BotonesExternos />
            <p className="mt-2 text-center text-[11px] leading-snug text-texto-2">
              Con Google aceptas los términos y la privacidad.
            </p>

            <p className="mt-4 border-t border-borde pt-3 text-center text-sm text-texto-2">
              {vista === "ingresar" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
              <button
                type="button"
                onClick={() => abrirAcceso(vista === "ingresar" ? "registro" : "ingresar")}
                className="font-semibold text-marca-fuerte hover:underline"
              >
                {vista === "ingresar" ? "Regístrate" : "Inicia sesión"}
              </button>
            </p>
          </div>
        </div>
      )}
    </dialog>
  );
}

/** Enlace que abre la ventana (para las páginas que piden ingresar). */
export function BotonAcceso({ vista = "ingresar", children }: { vista?: Vista; children: React.ReactNode }) {
  return (
    <button type="button" onClick={() => abrirAcceso(vista)} className="font-medium text-marca-fuerte underline">
      {children}
    </button>
  );
}
