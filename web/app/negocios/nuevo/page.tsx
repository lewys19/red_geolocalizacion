"use client";

import Link from "next/link";
import { type FormEvent, useState } from "react";

import { CamposDatos, CamposUbicacion, DATOS_VACIOS, type DatosNegocio, aCuerpo } from "@/components/CamposNegocio";
import { EditorHorario, type HorarioSemana, SEMANA_VACIA, aHorarios } from "@/components/EditorHorario";
import { Boton, MensajeError, Tarjeta } from "@/components/Formulario";
import { ErrorApi, pedir } from "@/lib/api";
import { LIMA } from "@/lib/mapaBase";
import type { Negocio } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const PASOS = ["Tu negocio", "Ubicación", "Horario"];

export default function NuevoNegocio() {
  const sesion = useSesion();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<DatosNegocio>(DATOS_VACIOS);
  const [pin, setPin] = useState<[number, number]>(LIMA);
  const [pinMovido, setPinMovido] = useState(false);
  const [semana, setSemana] = useState<HorarioSemana>(SEMANA_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState<Negocio | null>(null);

  if (!sesion) {
    return (
      <Tarjeta titulo="Registra tu negocio">
        <p className="text-center text-texto-2">
          Primero{" "}
          <Link href="/registro" className="font-medium text-marca-fuerte underline">
            crea tu cuenta
          </Link>{" "}
          o{" "}
          <Link href="/ingresar" className="font-medium text-marca-fuerte underline">
            ingresa
          </Link>
          . Es gratis.
        </p>
      </Tarjeta>
    );
  }

  if (creado) {
    return (
      <Tarjeta titulo="¡Listo!">
        <p className="text-center">
          Recibimos <strong>{creado.nombre}</strong>. Lo revisaremos y aparecerá en el mapa cuando esté aprobado. Mientras
          tanto, puedes agregar tu carta y fotos.
        </p>
        <Link
          href={`/mis-negocios/${creado.id}`}
          className="mt-5 block rounded-lg bg-marca px-4 py-2.5 text-center font-semibold text-sobre-marca hover:bg-marca-fuerte"
        >
          Agregar carta y fotos
        </Link>
      </Tarjeta>
    );
  }

  function siguiente(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (paso === 1 && !pinMovido) {
      setError("Ubica el pin en la puerta de tu negocio (o pulsa «Estoy en mi negocio»).");
      return;
    }
    if (paso < PASOS.length - 1) {
      setPaso(paso + 1);
      return;
    }
    enviar();
  }

  async function enviar() {
    setEnviando(true);
    try {
      const negocio = await pedir<Negocio>("/negocios", {
        metodo: "POST",
        conSesion: true,
        cuerpo: { ...aCuerpo(datos, pin), horarios: aHorarios(semana) },
      });
      setCreado(negocio);
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
      setEnviando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Registra tu negocio</h1>
      <ol className="mt-4 flex gap-2 text-xs font-medium">
        {PASOS.map((nombre, i) => (
          <li
            key={nombre}
            className={`flex-1 rounded-full px-2 py-1 text-center ${i <= paso ? "bg-marca text-sobre-marca" : "bg-borde text-texto-2"}`}
          >
            {i + 1}. {nombre}
          </li>
        ))}
      </ol>

      <form onSubmit={siguiente} className="mt-6 space-y-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
        {paso === 0 && <CamposDatos datos={datos} alCambiar={setDatos} />}
        {paso === 1 && (
          <CamposUbicacion
            datos={datos}
            alCambiar={setDatos}
            pin={pin}
            alMoverPin={(p) => {
              setPin(p);
              setPinMovido(true);
              setError(null);
            }}
          />
        )}
        {paso === 2 && (
          <>
            <p className="text-sm text-texto-2">
              Así la gente sabe si estás abierto ahora. Si cierras después de medianoche, pon la hora tal cual (por ejemplo
              18:00 a 02:00).
            </p>
            <EditorHorario valor={semana} alCambiar={setSemana} />
          </>
        )}

        <MensajeError mensaje={error} />
        <div className="flex gap-2">
          {paso > 0 && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPaso(paso - 1);
              }}
              className="rounded-lg border border-borde px-4 py-2.5 font-medium hover:border-marca"
            >
              Atrás
            </button>
          )}
          <div className="flex-1">
            <Boton cargando={enviando}>{paso < PASOS.length - 1 ? "Siguiente" : "Enviar para revisión"}</Boton>
          </div>
        </div>
      </form>
    </div>
  );
}
