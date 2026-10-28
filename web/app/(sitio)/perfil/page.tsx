"use client";

// Mi Perfil (/perfil): sus datos y los de su negocio en tablas simples. Lo público está en /{username}.
// Primero que todo cargue y se guarde bien; el diseño viene después.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, type ReactNode, useEffect, useState } from "react";

import { AvisoExito } from "@/components/AvisoExito";
import { DATOS_VACIOS, type DatosNegocio, SELECT, aCuerpo, useListas } from "@/components/CamposNegocio";
import { MensajeError, Tarjeta } from "@/components/Formulario";
import { PanelFotos } from "@/components/PanelFotos";
import { SelectorPin } from "@/components/SelectorPin";
import { BotonAcceso } from "@/components/VentanaAcceso";
import { ErrorApi, pedir } from "@/lib/api";
import { fecha } from "@/lib/formato";
import { textoBusqueda, useDireccionDelPin, useUbicarDireccion } from "@/lib/direcciones";
import { revisarFormulario } from "@/lib/formularios";
import { LIMA } from "@/lib/mapaBase";
import { guardarSesion, leerSesion } from "@/lib/sesion";
import type { Catalogo, EstadoNegocio, NegocioDetalle, Yo } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";


const ESTADO: Record<EstadoNegocio, string> = {
  pendiente: "En revisión (aún no sale en el mapa)",
  aprobado: "Aprobado (sale en el mapa)",
  rechazado: "Por corregir",
  suspendido: "Suspendido",
};

const ENTRADA = "w-full rounded border border-borde bg-superficie px-2 py-1.5 text-sm";
const BOTON = "rounded bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte disabled:opacity-60";

function Tabla({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-lg font-bold">{titulo}</h2>
      <table className="w-full border-collapse border border-borde bg-superficie text-sm">
        <tbody>{children}</tbody>
      </table>
    </section>
  );
}

function Fila({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <tr className="border-b border-borde align-top">
      <th className="w-1/3 bg-fondo px-3 py-2 text-left font-medium text-texto-2">{etiqueta}</th>
      <td className="px-3 py-2">{children}</td>
    </tr>
  );
}

function Aviso({ ok, error }: { ok: string | null; error: string | null }) {
  return (
    <>
      <MensajeError mensaje={error} />
      {ok && <p className="text-sm font-medium text-green-700 dark:text-green-400">{ok}</p>}
    </>
  );
}

function mensajeDe(err: unknown): string {
  return err instanceof ErrorApi ? err.message : "No hay conexión. Revisa tu internet.";
}

// ---------- Mis datos ----------

function FotoPerfil({ yo, alCambiar }: { yo: Yo; alCambiar: (y: Yo) => void }) {
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    const cuerpo = new FormData();
    cuerpo.append("foto", archivo);
    setError(null);
    setSubiendo(true);
    try {
      alCambiar(await pedir<Yo>("/yo/avatar", { metodo: "PUT", conSesion: true, cuerpo }));
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    alCambiar(await pedir<Yo>("/yo/avatar", { metodo: "DELETE", conSesion: true }));
  }

  return (
    <div className="flex items-center gap-3">
      {yo.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={yo.avatar} alt="" className="h-16 w-16 rounded-full object-cover" />
      ) : (
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-marca-suave text-xl font-bold text-marca-fuerte">
          {yo.nombre.charAt(0).toUpperCase()}
        </span>
      )}
      <label className="cursor-pointer rounded border border-borde px-3 py-1.5 text-sm hover:bg-fondo">
        {subiendo ? "Subiendo…" : yo.avatar ? "Cambiar foto" : "Subir foto"}
        <input type="file" accept="image/*" className="sr-only" onChange={cambiar} disabled={subiendo} />
      </label>
      {yo.avatar && (
        <button type="button" onClick={quitar} className="text-sm text-texto-2 underline">
          Quitar
        </button>
      )}
      <MensajeError mensaje={error} />
    </div>
  );
}

function MisDatos({ yo, alGuardar }: { yo: Yo; alGuardar: (y: Yo) => void }) {
  const [nombre, setNombre] = useState(yo.nombre);
  const [celular, setCelular] = useState(yo.telefono ?? "");
  const [username, setUsername] = useState(yo.username);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setOk(null);
    setError(null);
    setGuardando(true);
    try {
      const nuevo = await pedir<Yo>("/yo", { metodo: "PATCH", conSesion: true, cuerpo: { nombre, celular, username } });
      alGuardar(nuevo);
      setUsername(nuevo.username);
      // El encabezado muestra el nombre y enlaza al perfil con lo guardado en la sesión.
      const sesion = leerSesion();
      if (sesion) {
        guardarSesion({ ...sesion, usuario: { ...sesion.usuario, nombre: nuevo.nombre, username: nuevo.username } });
      }
      setOk("Datos guardados.");
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar}>
      <Tabla titulo="Mis datos">
        <Fila etiqueta="Foto de perfil">
          <FotoPerfil yo={yo} alCambiar={alGuardar} />
        </Fila>
        <Fila etiqueta="Nombre de usuario">
          <div className="flex items-center rounded border border-borde bg-superficie">
            <span className="pl-2 text-sm text-texto-2">altoque.pe/</span>
            <input
              className="min-w-0 flex-1 bg-transparent py-1.5 pr-2 text-sm outline-none"
              required
              minLength={3}
              maxLength={30}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              title="Minúsculas, números y guiones"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase())}
            />
          </div>
          <Link href={`/${yo.username}`} className="mt-1 inline-block text-xs text-marca-fuerte underline">
            Ver mi perfil público
          </Link>
        </Fila>
        <Fila etiqueta="Correo">{yo.email}</Fila>
        <Fila etiqueta="Nombre">
          <input className={ENTRADA} required minLength={2} maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </Fila>
        <Fila etiqueta="Celular">
          <input className={ENTRADA} type="tel" placeholder="987 654 321" value={celular} onChange={(e) => setCelular(e.target.value)} />
        </Fila>
        <Fila etiqueta="Rol">
          {yo.rol_panel ?? "Cliente"}
          {yo.es_negocio && " · Negocio"}
        </Fila>
        <Fila etiqueta="Registrado el">{fecha(yo.creado_en)}</Fila>
      </Tabla>
      <div className="mt-2 space-y-2">
        <Aviso ok={ok} error={error} />
        <button className={BOTON} disabled={guardando}>
          {guardando ? "Guardando…" : "Guardar mis datos"}
        </button>
      </div>
    </form>
  );
}

// ---------- Mi negocio ----------

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

/** Datos del negocio. Sin `negocio` es el formulario para crearlo. */
function DatosDelNegocio({ negocio, alGuardar }: { negocio: NegocioDetalle | null; alGuardar: (n: NegocioDetalle) => void }) {
  const { categorias, distritos } = useListas();
  const [datos, setDatos] = useState<DatosNegocio>(negocio ? aDatos(negocio) : DATOS_VACIOS);
  const [pin, setPin] = useState<[number, number]>(negocio?.ubicacion ? [negocio.ubicacion.lng, negocio.ubicacion.lat] : LIMA);
  // true cuando el dueño movió el pin a mano: entonces se sugiere la dirección de ese punto.
  const [pinMovido, setPinMovido] = useState(false);
  // Pin → dirección: si todavía no escribió, se completa sola; si ya escribió, se ofrece abajo del campo.
  const sugerencia = useDireccionDelPin(pin, pinMovido, (s) =>
    setDatos((d) => ({ ...d, direccion: d.direccion || s.direccion || "", distrito: d.distrito || s.distrito || "" })),
  );
  const { ubicar, estado: busqueda } = useUbicarDireccion();
  const ayuda = textoBusqueda(busqueda);
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const campo = (n: keyof DatosNegocio) => ({
    value: datos[n] as string,
    onChange: (e: { target: { value: string } }) => setDatos({ ...datos, [n]: e.target.value }),
  });

  const ofrecer =
    sugerencia &&
    ((sugerencia.direccion && sugerencia.direccion !== datos.direccion) ||
      (sugerencia.distrito && sugerencia.distrito !== datos.distrito));

  // Dirección → pin: al terminar de escribirla, el mapa va a ese lugar.
  async function ubicarDireccion() {
    const lugar = await ubicar(datos.direccion, datos.distrito);
    if (!lugar) return;
    setPinMovido(false);
    setPin([lugar.lng, lugar.lat]);
    if (lugar.distrito) setDatos((d) => (d.distrito ? d : { ...d, distrito: lugar.distrito ?? "" }));
  }

  async function guardar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setOk(null);
    setError(null);
    const problema = revisarFormulario(e.currentTarget);
    if (problema) {
      setError(problema);
      return;
    }
    setGuardando(true);
    try {
      const n = await pedir<NegocioDetalle>(negocio ? `/negocios/${negocio.id}` : "/negocios", {
        metodo: negocio ? "PATCH" : "POST",
        conSesion: true,
        cuerpo: aCuerpo(datos, pin),
      });
      alGuardar(n);
      // Al crearlo, el formulario se rearma en modo edición: el aviso lo muestra la página.
      if (negocio) setOk("Cambios guardados.");
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} noValidate>
      <Tabla titulo={negocio ? "Datos del negocio" : "Registrar mi negocio"}>
        {negocio && (
          <Fila etiqueta="Estado">
            {ESTADO[negocio.estado]}
            {negocio.motivo_rechazo && <p className="text-error">Motivo: {negocio.motivo_rechazo}</p>}
            {negocio.estado === "aprobado" && (
              <Link href={`/n/${negocio.slug}`} className="ml-2 text-marca-fuerte underline">
                Ver página pública
              </Link>
            )}
          </Fila>
        )}
        <Fila etiqueta="Nombre del negocio *">
          <input className={ENTRADA} required minLength={2} maxLength={120} {...campo("nombre")} />
        </Fila>
        <Fila etiqueta="Categoría *">
          <select className={SELECT} required {...campo("categoria_id")}>
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
        </Fila>
        <Fila etiqueta="Descripción">
          <textarea className={ENTRADA} rows={4} maxLength={1000} placeholder="Qué ofreces, especialidades…" {...campo("descripcion")} />
        </Fila>
        <Fila etiqueta="Distrito *">
          <select className={SELECT} required {...campo("distrito")}>
            <option value="">Elige tu distrito…</option>
            {distritos.map((d) => (
              <option key={d}>{d}</option>
            ))}
          </select>
        </Fila>
        <Fila etiqueta="Dirección *">
          <input
            className={ENTRADA}
            required
            minLength={5}
            maxLength={200}
            placeholder="Av. Larco 345"
            {...campo("direccion")}
            onBlur={ubicarDireccion}
          />
          {ayuda && <p className={`mt-1 text-xs ${ayuda.error ? "text-error" : "text-texto-2"}`}>{ayuda.texto}</p>}
          {ofrecer && sugerencia && (
            <button
              type="button"
              onClick={() =>
                setDatos({ ...datos, direccion: sugerencia.direccion ?? datos.direccion, distrito: sugerencia.distrito ?? datos.distrito })
              }
              className="mt-1 w-full rounded border border-dashed border-marca bg-marca-suave px-2 py-1.5 text-left text-xs text-marca-fuerte"
            >
              Según el pin: <strong>{[sugerencia.direccion, sugerencia.distrito].filter(Boolean).join(", ")}</strong> — usar esta
            </button>
          )}
        </Fila>
        <Fila etiqueta="Referencia">
          <input className={ENTRADA} maxLength={200} placeholder="Frente al parque" {...campo("referencia")} />
        </Fila>
        <Fila etiqueta="Ubicación *">
          <SelectorPin
            valor={pin}
            alCambiar={(p) => {
              setPinMovido(true);
              setPin(p);
            }}
          />
          <p className="mt-1 font-mono text-xs">
            lat {pin[1].toFixed(6)}, lng {pin[0].toFixed(6)}
          </p>
        </Fila>
        <Fila etiqueta="WhatsApp">
          <input className={ENTRADA} type="tel" placeholder="987 654 321" {...campo("whatsapp")} />
        </Fila>
        <Fila etiqueta="Teléfono">
          <input className={ENTRADA} type="tel" {...campo("telefono")} />
        </Fila>
        <Fila etiqueta="Delivery">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={datos.tiene_delivery}
              onChange={(e) => setDatos({ ...datos, tiene_delivery: e.target.checked })}
            />
            Hago delivery
          </label>
        </Fila>
      </Tabla>
      <div className="mt-2 space-y-2">
        <Aviso ok={ok} error={error} />
        <button className={BOTON} disabled={guardando}>
          {guardando ? "Guardando…" : negocio ? "Guardar datos del negocio" : "Crear negocio"}
        </button>
      </div>
    </form>
  );
}

type TipoImagen = "logo" | "portada";

function FilaImagen({
  negocioId,
  tipo,
  url,
  alCambiar,
}: {
  negocioId: number;
  tipo: TipoImagen;
  url: string | null;
  alCambiar: (url: string | null) => void;
}) {
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(archivo: File | null) {
    setError(null);
    setOcupado(true);
    try {
      let cuerpo: FormData | undefined;
      if (archivo) {
        cuerpo = new FormData();
        cuerpo.append("foto", archivo);
      }
      const r = await pedir<{ url: string | null }>(`/negocios/${negocioId}/imagen/${tipo}`, {
        metodo: archivo ? "PUT" : "DELETE",
        conSesion: true,
        cuerpo,
      });
      alCambiar(r.url);
    } catch (err) {
      setError(mensajeDe(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Fila etiqueta={tipo === "logo" ? "Foto de perfil" : "Portada"}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={tipo === "logo" ? "Foto de perfil" : "Portada"}
          className={tipo === "logo" ? "h-24 w-24 rounded-full object-cover" : "aspect-[3/1] w-full max-w-md rounded object-cover"}
        />
      ) : (
        <p className="text-texto-2">Sin {tipo === "logo" ? "foto de perfil" : "portada"}.</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <label className={`${BOTON} cursor-pointer ${ocupado ? "pointer-events-none opacity-60" : ""}`}>
          {ocupado ? "Subiendo…" : url ? "Cambiar" : "Subir"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              const archivo = e.target.files?.[0];
              if (archivo) cambiar(archivo);
              e.target.value = "";
            }}
          />
        </label>
        {url && (
          <button type="button" onClick={() => cambiar(null)} className="rounded border border-borde px-3 py-2 text-sm hover:border-error hover:text-error">
            Quitar
          </button>
        )}
      </div>
      <MensajeError mensaje={error} />
    </Fila>
  );
}

function ImagenesDelNegocio({ negocioId }: { negocioId: number }) {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);

  useEffect(() => {
    pedir<Catalogo>(`/negocios/mios/${negocioId}/catalogo`, { conSesion: true })
      .then(setCatalogo)
      .catch(() => {});
  }, [negocioId]);

  if (!catalogo) return <p className="mt-6 text-texto-2">Cargando imágenes…</p>;
  return (
    <>
      <Tabla titulo="Imágenes del negocio">
        <FilaImagen negocioId={negocioId} tipo="logo" url={catalogo.logo} alCambiar={(logo) => setCatalogo({ ...catalogo, logo })} />
        <FilaImagen
          negocioId={negocioId}
          tipo="portada"
          url={catalogo.portada}
          alCambiar={(portada) => setCatalogo({ ...catalogo, portada })}
        />
      </Tabla>
      <section className="mt-6">
        <h2 className="mb-2 text-lg font-bold">Galería de fotos ({catalogo.fotos.length})</h2>
        <PanelFotos negocioId={negocioId} fotos={catalogo.fotos} alCambiar={(fotos) => setCatalogo({ ...catalogo, fotos })} />
      </section>
    </>
  );
}

// ---------- Página ----------

export default function MiPerfil() {
  const sesion = useSesion();
  const router = useRouter();
  const [yo, setYo] = useState<Yo | null>(null);
  const [negocios, setNegocios] = useState<NegocioDetalle[] | null>(null);
  // id del negocio que se edita; "nuevo" = formulario para registrar otro.
  const [elegido, setElegido] = useState<number | "nuevo" | null>(null);
  const [recienCreado, setRecienCreado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usuarioId = sesion?.usuario.id;

  useEffect(() => {
    if (!usuarioId) return;
    pedir<Yo>("/yo", { conSesion: true })
      .then(setYo)
      .catch(() => setError("No se pudo cargar tu cuenta."));
    pedir<NegocioDetalle[]>("/negocios/mios", { conSesion: true })
      .then((lista) => {
        setNegocios(lista);
        setElegido(lista[0]?.id ?? "nuevo");
      })
      .catch(() => setNegocios([]));
  }, [usuarioId]);

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
      <Tarjeta titulo="Mi perfil">
        <p className="text-center text-texto-2">
          <BotonAcceso>Ingresa</BotonAcceso> para ver tu perfil.
        </p>
      </Tarjeta>
    );
  }

  const negocio = negocios?.find((n) => n.id === elegido) ?? null;

  function elegir(id: number | "nuevo") {
    setRecienCreado(false);
    setElegido(id);
  }

  function alGuardarNegocio(n: NegocioDetalle) {
    if (elegido === "nuevo") setRecienCreado(true);
    setNegocios((lista) =>
      lista?.some((x) => x.id === n.id) ? lista.map((x) => (x.id === n.id ? n : x)) : [n, ...(lista ?? [])],
    );
    setElegido(n.id);
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-bold">Mi perfil</h1>
      <MensajeError mensaje={error} />
      {yo ? <MisDatos yo={yo} alGuardar={setYo} /> : <p className="mt-6 text-texto-2">Cargando tus datos…</p>}

      {negocios === null ? (
        <p className="mt-6 text-texto-2">Cargando tu negocio…</p>
      ) : (
        <>
          {/* Con más de un negocio (o al registrar otro) se elige cuál editar. */}
          <div className="mt-8 flex flex-wrap gap-2 text-sm">
            {negocios.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => elegir(n.id)}
                className={`rounded border px-3 py-1.5 ${elegido === n.id ? "border-marca bg-marca-suave font-semibold" : "border-borde"}`}
              >
                {n.nombre}
              </button>
            ))}
            {negocios.length > 0 && (
              <button
                type="button"
                onClick={() => elegir("nuevo")}
                className={`rounded border px-3 py-1.5 ${elegido === "nuevo" ? "border-marca bg-marca-suave font-semibold" : "border-borde"}`}
              >
                + Registrar otro negocio
              </button>
            )}
          </div>
          {recienCreado && (
            <AvisoExito titulo="¡Se creó tu negocio con éxito!" alCerrar={() => setRecienCreado(false)}>
              Lo revisamos y, al aprobarlo, aparece en el mapa. Mientras tanto puedes subir su foto de perfil, portada y
              galería aquí abajo.
            </AvisoExito>
          )}
          {/* key: al cambiar de negocio el formulario se rellena desde cero. */}
          <DatosDelNegocio key={`datos-${elegido}`} negocio={negocio} alGuardar={alGuardarNegocio} />
          {negocio && <ImagenesDelNegocio key={`imagenes-${negocio.id}`} negocioId={negocio.id} />}
        </>
      )}

      <div className="mt-10 flex flex-wrap gap-3 border-t border-borde pt-6">
        <button type="button" onClick={salir} className="rounded border border-borde px-4 py-2 text-sm font-medium hover:border-marca">
          Cerrar sesión
        </button>
        <button type="button" onClick={eliminar} className="px-4 py-2 text-sm text-error hover:underline">
          Eliminar mi cuenta
        </button>
      </div>
    </div>
  );
}
