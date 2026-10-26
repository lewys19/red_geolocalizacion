"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";

import { Boton, MensajeError, Tarjeta } from "@/components/Formulario";
import { BotonAcceso } from "@/components/VentanaAcceso";
import { ErrorApi, pedir } from "@/lib/api";
import type { Negocio } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const MAX_FOTOS = 4;
const MAX_TEXTO = 2000;

/** Crear publicación: un negocio aprobado publica texto y hasta 4 fotos en el muro. */
export default function Publicar() {
  const sesion = useSesion();
  const router = useRouter();
  const [negocios, setNegocios] = useState<Negocio[] | null>(null);
  const [negocioId, setNegocioId] = useState<number | null>(null);
  const [texto, setTexto] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!sesion) return;
    pedir<Negocio[]>("/negocios/mios", { conSesion: true })
      .then((todos) => {
        const aprobados = todos.filter((n) => n.estado === "aprobado");
        setNegocios(aprobados);
        setNegocioId(aprobados[0]?.id ?? null);
      })
      .catch(() => setNegocios([]));
  }, [sesion]);

  // Vista previa de las fotos elegidas (se liberan al cambiarlas).
  const previas = useMemo(() => fotos.map((f) => URL.createObjectURL(f)), [fotos]);
  useEffect(() => () => previas.forEach((u) => URL.revokeObjectURL(u)), [previas]);

  if (!sesion) {
    return (
      <Tarjeta titulo="Crear publicación">
        <p className="text-center text-texto-2">
          <BotonAcceso>Ingresa</BotonAcceso>{" "}
          con la cuenta de tu negocio para publicar.
        </p>
      </Tarjeta>
    );
  }
  if (negocios?.length === 0) {
    return (
      <Tarjeta titulo="Crear publicación">
        <p className="text-center text-texto-2">
          Para publicar necesitas un negocio aprobado.{" "}
          <Link href="/negocios/nuevo" className="font-medium text-marca-fuerte underline">
            Registra tu negocio
          </Link>{" "}
          o espera a que revisemos el tuyo.
        </p>
      </Tarjeta>
    );
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    if (!negocioId) return;
    setError(null);
    setEnviando(true);
    const datos = new FormData();
    datos.append("texto", texto);
    fotos.forEach((f) => datos.append("fotos", f));
    try {
      await pedir(`/negocios/${negocioId}/publicaciones`, { metodo: "POST", conSesion: true, cuerpo: datos });
      router.push("/");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Crear publicación</h1>
      <form onSubmit={enviar} className="mt-5 space-y-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
        {negocios && negocios.length > 1 && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-texto-2">Publicar como</span>
            <select
              value={negocioId ?? ""}
              onChange={(e) => setNegocioId(Number(e.target.value))}
              className="w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5"
            >
              {negocios.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {negocios?.length === 1 && <p className="text-sm text-texto-2">Publicas como <strong>{negocios[0].nombre}</strong></p>}

        <label className="block">
          <span className="sr-only">¿Qué quieres contar?</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={5}
            maxLength={MAX_TEXTO}
            placeholder="¿Qué hay de nuevo? Una oferta, un plato nuevo, tu horario de feriado…"
            className="w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 outline-none focus:border-marca"
          />
          <span className="block text-right text-xs text-texto-2">
            {texto.length}/{MAX_TEXTO}
          </span>
        </label>

        <div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-borde px-4 py-2 text-sm font-medium hover:border-marca">
            📷 Agregar fotos ({fotos.length}/{MAX_FOTOS})
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                setFotos([...fotos, ...Array.from(e.target.files ?? [])].slice(0, MAX_FOTOS));
                e.target.value = "";
              }}
            />
          </label>
          {previas.length > 0 && (
            <ul className="mt-3 grid grid-cols-4 gap-2">
              {previas.map((url, i) => (
                <li key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Foto ${i + 1}`} className="aspect-square w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                    aria-label={`Quitar foto ${i + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 text-xs text-white"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-texto-2">Quitamos la ubicación GPS de tus fotos antes de publicarlas.</p>
        </div>

        <MensajeError mensaje={error} />
        <Boton cargando={enviando}>Publicar</Boton>
      </form>
    </div>
  );
}
