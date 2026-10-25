"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { EditorHorario, type HorarioSemana, SEMANA_VACIA, aHorarios } from "@/components/EditorHorario";
import { Boton, Campo, MensajeError, Tarjeta } from "@/components/Formulario";
import { SelectorPin } from "@/components/SelectorPin";
import { ErrorApi, pedir } from "@/lib/api";
import { LIMA } from "@/lib/mapaBase";
import type { Categoria, Negocio } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

interface Sugerencia {
  direccion: string | null;
  distrito: string | null;
  completa: string;
}

const PASOS = ["Tu negocio", "Ubicación", "Horario"];

interface Datos {
  nombre: string;
  categoria_id: string;
  descripcion: string;
  whatsapp: string;
  telefono: string;
  tiene_delivery: boolean;
  distrito: string;
  direccion: string;
  referencia: string;
}

const INICIAL: Datos = {
  nombre: "",
  categoria_id: "",
  descripcion: "",
  whatsapp: "",
  telefono: "",
  tiene_delivery: false,
  distrito: "",
  direccion: "",
  referencia: "",
};

const SELECT =
  "w-full rounded-lg border border-borde bg-superficie px-3.5 py-2.5 text-texto outline-none focus:border-marca focus:ring-2 focus:ring-marca/30";

export default function NuevoNegocio() {
  const sesion = useSesion();
  const [paso, setPaso] = useState(0);
  const [datos, setDatos] = useState<Datos>(INICIAL);
  const [pin, setPin] = useState<[number, number]>(LIMA);
  const [pinMovido, setPinMovido] = useState(false);
  const [semana, setSemana] = useState<HorarioSemana>(SEMANA_VACIA);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [distritos, setDistritos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [creado, setCreado] = useState<Negocio | null>(null);
  const [sugerencia, setSugerencia] = useState<Sugerencia | null>(null);

  // Al mover el pin se pide la dirección de ese punto (reverse geocoding). Espera 600 ms quieto.
  useEffect(() => {
    if (!pinMovido) return;
    const espera = setTimeout(() => {
      pedir<Sugerencia>(`/geocoding/inverso?lng=${pin[0].toFixed(6)}&lat=${pin[1].toFixed(6)}`, { conSesion: true })
        .then((s) => {
          setSugerencia(s);
          // Si todavía no escribió nada, se completa solo; si ya escribió, solo se sugiere.
          setDatos((d) => ({
            ...d,
            direccion: d.direccion || s.direccion || "",
            distrito: d.distrito || s.distrito || "",
          }));
        })
        .catch(() => setSugerencia(null));
    }, 600);
    return () => clearTimeout(espera);
  }, [pin, pinMovido]);

  useEffect(() => {
    pedir<Categoria[]>("/categorias").then(setCategorias).catch(() => {});
    pedir<string[]>("/distritos").then(setDistritos).catch(() => {});
  }, []);

  const campo = (nombre: keyof Datos) => ({
    name: nombre,
    value: datos[nombre] as string,
    onChange: (e: { target: { value: string } }) => setDatos({ ...datos, [nombre]: e.target.value }),
  });

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
          Recibimos <strong>{creado.nombre}</strong>. Lo revisaremos y aparecerá en el mapa cuando esté aprobado.
        </p>
        <Link
          href="/cuenta"
          className="mt-5 block rounded-lg bg-marca px-4 py-2.5 text-center font-semibold text-sobre-marca hover:bg-marca-fuerte"
        >
          Ver mis negocios
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
    const horarios = aHorarios(semana);
    setEnviando(true);
    try {
      const negocio = await pedir<Negocio>("/negocios", {
        metodo: "POST",
        conSesion: true,
        cuerpo: {
          nombre: datos.nombre,
          categoria_id: Number(datos.categoria_id),
          descripcion: datos.descripcion || null,
          whatsapp: datos.whatsapp || null,
          telefono: datos.telefono || null,
          tiene_delivery: datos.tiene_delivery,
          distrito: datos.distrito,
          direccion: datos.direccion,
          referencia: datos.referencia || null,
          ubicacion: { lng: pin[0], lat: pin[1] },
          horarios,
        },
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
        {paso === 0 && (
          <>
            <Campo etiqueta="Nombre del negocio" required minLength={2} maxLength={120} {...campo("nombre")} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-texto-2">Categoría</span>
              <select required className={SELECT} {...campo("categoria_id")}>
                <option value="">Elige una…</option>
                {categorias.map((c) =>
                  c.hijas.length ? (
                    <optgroup key={c.id} label={c.nombre}>
                      {c.hijas.map((h) => (
                        <option key={h.id} value={h.id}>
                          {h.nombre}
                        </option>
                      ))}
                    </optgroup>
                  ) : (
                    <option key={c.id} value={c.id}>
                      {c.nombre}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-texto-2">¿Qué ofreces? (opcional)</span>
              <textarea rows={3} maxLength={1000} className={SELECT} {...campo("descripcion")} />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="WhatsApp" type="tel" placeholder="987 654 321" {...campo("whatsapp")} />
              <Campo etiqueta="Teléfono (opcional)" type="tel" {...campo("telefono")} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={datos.tiene_delivery}
                onChange={(e) => setDatos({ ...datos, tiene_delivery: e.target.checked })}
                className="h-4 w-4 accent-[var(--marca)]"
              />
              Hago delivery
            </label>
          </>
        )}

        {paso === 1 && (
          <>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-texto-2">Distrito</span>
              <select required className={SELECT} {...campo("distrito")}>
                <option value="">Elige tu distrito…</option>
                {distritos.map((d) => (
                  <option key={d}>{d}</option>
                ))}
              </select>
            </label>
            <Campo etiqueta="Dirección" required minLength={5} maxLength={200} placeholder="Av. Larco 345" {...campo("direccion")} />
            <Campo etiqueta="Referencia (opcional)" maxLength={200} placeholder="Frente al parque" {...campo("referencia")} />
            {sugerencia && (sugerencia.direccion || sugerencia.distrito) &&
              (sugerencia.direccion !== datos.direccion || (sugerencia.distrito ?? "") !== datos.distrito) && (
                <button
                  type="button"
                  onClick={() =>
                    setDatos({
                      ...datos,
                      direccion: sugerencia.direccion ?? datos.direccion,
                      distrito: sugerencia.distrito ?? datos.distrito,
                    })
                  }
                  className="w-full rounded-lg border border-dashed border-marca bg-marca-suave px-3 py-2 text-left text-sm text-marca-fuerte"
                >
                  Usar: <strong>{[sugerencia.direccion, sugerencia.distrito].filter(Boolean).join(", ")}</strong>
                </button>
              )}
            <SelectorPin
              valor={pin}
              alCambiar={(lngLat) => {
                setPin(lngLat);
                setPinMovido(true);
                setError(null);
              }}
            />
          </>
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
