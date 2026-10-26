import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CabeceraPerfil } from "@/components/CabeceraPerfil";
import { MiniMapa } from "@/components/MiniMapa";
import { MuroNegocio } from "@/components/MuroNegocio";
import { PestanasPerfil } from "@/components/PestanasPerfil";
import { DIAS, enlaceComoLlegar, hora, hoyEnLima, precio } from "@/lib/formato";
import { obtener } from "@/lib/servidor";
import type { Ficha, Muro } from "@/lib/tipos";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const f = await obtener<Ficha>(`/negocios/ficha/${encodeURIComponent(slug)}`);
  if (!f) return { title: "Negocio no encontrado" };
  const descripcion =
    f.descripcion ?? `${f.categoria} en ${f.distrito}, Lima. Precios, horario${f.tiene_delivery ? ", delivery" : ""} y cómo llegar.`;
  return {
    title: `${f.nombre} · ${f.categoria} en ${f.distrito}`,
    description: descripcion,
    openGraph: { title: f.nombre, description: descripcion, images: f.portada ? [f.portada] : f.fotos[0] ? [f.fotos[0].url] : [] },
  };
}

export default async function PaginaNegocio({ params }: Props) {
  const { slug } = await params;
  const f = await obtener<Ficha>(`/negocios/ficha/${encodeURIComponent(slug)}`);
  if (!f) notFound();
  const muro = (await obtener<Muro>(`/negocios/ficha/${encodeURIComponent(slug)}/publicaciones`)) ?? {
    publicaciones: [],
    siguiente: null,
  };
  const hoy = hoyEnLima();
  // Galería: las fotos del negocio y las de sus publicaciones recientes.
  const galeria = [...f.fotos, ...muro.publicaciones.flatMap((p) => p.fotos)];

  const publicaciones = <MuroNegocio slug={f.slug} inicial={muro} />;

  const fotos = galeria.length ? (
    <ul className="grid grid-cols-3 gap-1 overflow-hidden rounded-2xl">
      {galeria.map((foto, i) => (
        <li key={`${foto.id}-${foto.url}`}>
          <a href={foto.url} target="_blank" rel="noopener noreferrer" className="block aspect-square">
            {/* Fotos ya optimizadas por la API (WebP): no hace falta next/image. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={foto.url} alt={`${f.nombre}, foto ${i + 1}`} loading="lazy" className="h-full w-full object-cover transition hover:opacity-90" />
          </a>
        </li>
      ))}
    </ul>
  ) : (
    <p className="py-10 text-center text-texto-2">Todavía no hay fotos.</p>
  );

  const carta = f.productos.length ? (
    <ul className="divide-y divide-borde rounded-2xl border border-borde bg-superficie">
      {f.productos.map((p) => (
        <li key={p.id} className="flex items-start justify-between gap-4 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">{p.nombre}</p>
            {p.descripcion && <p className="text-sm text-texto-2">{p.descripcion}</p>}
          </div>
          <p className="shrink-0 font-semibold tabular-nums">{precio(p.precio_centimos)}</p>
        </li>
      ))}
    </ul>
  ) : (
    <p className="py-10 text-center text-texto-2">Este negocio todavía no publicó su carta.</p>
  );

  const informacion = (
    <div className="space-y-6">
      <section>
        <h2 className="font-bold">Horario</h2>
        <table className="mt-2 w-full text-sm">
          <tbody>
            {DIAS.map((dia, i) => {
              const tramos = f.horarios.filter((h) => h.dia_semana === i);
              return (
                <tr key={dia} className={i === hoy ? "font-semibold" : "text-texto-2"}>
                  <td className="py-1 pr-4">
                    {dia}
                    {i === hoy && " (hoy)"}
                  </td>
                  <td className="py-1 text-right tabular-nums">
                    {tramos.length ? tramos.map((t) => `${hora(t.abre)}–${hora(t.cierra)}`).join(", ") : "Cerrado"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
      <section className="space-y-2">
        <h2 className="font-bold">Dónde queda</h2>
        <p className="text-sm">
          {f.direccion}, {f.distrito}
          {f.referencia && <span className="text-texto-2"> · {f.referencia}</span>}
        </p>
        <MiniMapa lng={f.lng} lat={f.lat} nombre={f.nombre} />
        <a
          href={enlaceComoLlegar(f.lat, f.lng)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded-full bg-marca px-4 py-2 text-sm font-semibold text-sobre-marca hover:bg-marca-fuerte"
        >
          Cómo llegar
        </a>
      </section>
    </div>
  );

  return (
    <article className="mx-auto w-full max-w-3xl pb-10 sm:px-4 sm:pt-4">
      <CabeceraPerfil ficha={f} />
      <div className="px-3 sm:px-0">
        <PestanasPerfil
          pestanas={[
            { titulo: "Publicaciones", contenido: publicaciones },
            { titulo: `Fotos${galeria.length ? ` (${galeria.length})` : ""}`, contenido: fotos },
            { titulo: "Carta", contenido: carta },
            { titulo: "Información", contenido: informacion },
          ]}
        />
      </div>
    </article>
  );
}
