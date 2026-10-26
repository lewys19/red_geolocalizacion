"use client";

import Link from "next/link";
import { type FormEvent, use, useEffect, useState } from "react";

import { CamposDatos, CamposUbicacion, type DatosNegocio, aCuerpo } from "@/components/CamposNegocio";
import { EditorHorario, type HorarioSemana, aHorarios, deHorarios } from "@/components/EditorHorario";
import { Boton, MensajeError, Tarjeta } from "@/components/Formulario";
import { BotonAcceso } from "@/components/VentanaAcceso";
import { PanelCarta } from "@/components/PanelCarta";
import { PanelFotos } from "@/components/PanelFotos";
import { ErrorApi, pedir } from "@/lib/api";
import { LIMA } from "@/lib/mapaBase";
import type { Catalogo, NegocioDetalle } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const PESTANAS = ["Datos", "Carta", "Fotos"] as const;
type Pestana = (typeof PESTANAS)[number];

function aDatos(n: NegocioDetalle): DatosNegocio {
  return {
    nombre: n.nombre,
    categoria_id: String(n.categoria_id),
    descripcion: n.descripcion ?? "",
    whatsapp: n.whatsapp ?? "",
    telefono: n.telefono ?? "",
    tiene_delivery: n.tiene_delivery,
    distrito: n.distrito,
    direccion: n.direccion,
    referencia: n.referencia ?? "",
  };
}

export default function PanelNegocio({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sesion = useSesion();
  const [negocio, setNegocio] = useState<NegocioDetalle | null>(null);
  const [catalogo, setCatalogo] = useState<Catalogo>({ productos: [], fotos: [] });
  const [pestana, setPestana] = useState<Pestana>("Datos");
  const [datos, setDatos] = useState<DatosNegocio | null>(null);
  const [pin, setPin] = useState<[number, number]>(LIMA);
  const [semana, setSemana] = useState<HorarioSemana | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [noExiste, setNoExiste] = useState(false);

  useEffect(() => {
    if (!sesion) return;
    pedir<NegocioDetalle>(`/negocios/mios/${id}`, { conSesion: true })
      .then((n) => {
        setNegocio(n);
        setDatos(aDatos(n));
        if (n.ubicacion) setPin([n.ubicacion.lng, n.ubicacion.lat]);
        setSemana(deHorarios(n.horarios));
      })
      .catch(() => setNoExiste(true));
    pedir<Catalogo>(`/negocios/mios/${id}/catalogo`, { conSesion: true }).then(setCatalogo).catch(() => {});
  }, [sesion, id]);

  if (!sesion || noExiste) {
    return (
      <Tarjeta titulo="Mi negocio">
        <p className="text-center text-texto-2">
          {sesion ? "No encontramos este negocio en tu cuenta." : "Ingresa para administrar tu negocio."}{" "}
          {sesion ? (
            <Link href="/cuenta" className="font-medium text-marca-fuerte underline">
              Ver mis negocios
            </Link>
          ) : (
            <BotonAcceso>Ingresar</BotonAcceso>
          )}
        </p>
      </Tarjeta>
    );
  }
  if (!negocio || !datos || !semana) return <p className="p-8 text-center text-texto-2">Cargando…</p>;

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!datos || !semana) return;
    setError(null);
    setAviso(null);
    setGuardando(true);
    try {
      const n = await pedir<NegocioDetalle>(`/negocios/${id}`, {
        metodo: "PATCH",
        conSesion: true,
        cuerpo: { ...aCuerpo(datos, pin), horarios: aHorarios(semana) },
      });
      setNegocio(n);
      setAviso(n.estado === "pendiente" ? "Guardado. Lo revisaremos de nuevo." : "Cambios guardados.");
    } catch (err) {
      setError(err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6">
      <Link href="/cuenta" className="text-sm text-texto-2 hover:text-texto">
        ← Mis negocios
      </Link>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">{negocio.nombre}</h1>
        {negocio.estado === "aprobado" && (
          <Link href={`/n/${negocio.slug}`} className="text-sm font-medium text-marca-fuerte underline">
            Ver mi página pública
          </Link>
        )}
      </div>
      {negocio.estado === "rechazado" && negocio.motivo_rechazo && (
        <p className="mt-2 rounded-lg bg-error/10 px-3 py-2 text-sm text-error">
          Por corregir: {negocio.motivo_rechazo}. Al guardar los cambios vuelve a revisión.
        </p>
      )}
      {negocio.estado === "pendiente" && (
        <p className="mt-2 rounded-lg bg-marca-suave px-3 py-2 text-sm text-marca-fuerte">
          En revisión: aparecerá en el mapa cuando lo aprobemos. Ya puedes cargar tu carta y fotos.
        </p>
      )}

      <div role="tablist" className="mt-5 flex gap-1 rounded-full bg-borde p-1 text-sm font-medium">
        {PESTANAS.map((p) => (
          <button
            key={p}
            role="tab"
            type="button"
            aria-selected={pestana === p}
            onClick={() => setPestana(p)}
            className={`flex-1 rounded-full px-3 py-1.5 ${pestana === p ? "bg-superficie shadow-sm" : "text-texto-2"}`}
          >
            {p}
            {p === "Carta" && ` (${catalogo.productos.length})`}
            {p === "Fotos" && ` (${catalogo.fotos.length})`}
          </button>
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-borde bg-superficie p-5 shadow-sm">
        {pestana === "Datos" && (
          <form onSubmit={guardar} className="space-y-4">
            <CamposDatos datos={datos} alCambiar={setDatos} />
            <CamposUbicacion datos={datos} alCambiar={setDatos} pin={pin} alMoverPin={setPin} />
            <h2 className="pt-2 font-semibold">Horario</h2>
            <EditorHorario valor={semana} alCambiar={setSemana} />
            <MensajeError mensaje={error} />
            {aviso && <p className="text-sm font-medium text-green-700 dark:text-green-400">{aviso}</p>}
            <Boton cargando={guardando}>Guardar cambios</Boton>
          </form>
        )}
        {pestana === "Carta" && (
          <PanelCarta
            negocioId={negocio.id}
            productos={catalogo.productos}
            alCambiar={(productos) => setCatalogo({ ...catalogo, productos })}
          />
        )}
        {pestana === "Fotos" && (
          <PanelFotos negocioId={negocio.id} fotos={catalogo.fotos} alCambiar={(fotos) => setCatalogo({ ...catalogo, fotos })} />
        )}
      </div>
    </div>
  );
}
