import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MiniMapa } from "@/components/MiniMapa";
import { DIAS, enlaceComoLlegar, enlaceWhatsapp, hora, hoyEnLima, precio } from "@/lib/formato";
import { obtener } from "@/lib/servidor";
import type { Ficha } from "@/lib/tipos";

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
    openGraph: { title: f.nombre, description: descripcion, images: f.fotos[0] ? [f.fotos[0].url] : [] },
  };
}

const BOTON = "flex flex-1 items-center justify-center rounded-xl px-3 py-3 text-sm font-semibold transition";

export default async function PaginaNegocio({ params }: Props) {
  const { slug } = await params;
  const f = await obtener<Ficha>(`/negocios/ficha/${encodeURIComponent(slug)}`);
  if (!f) notFound();
  const hoy = hoyEnLima();

  return (
    <article className="mx-auto w-full max-w-2xl px-4 pb-10 pt-4">
      <Link href="/" className="text-sm text-texto-2 hover:text-texto">
        ← Volver al mapa
      </Link>

      {f.fotos.length > 0 && (
        <div className="-mx-4 mt-3 flex snap-x gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {f.fotos.map((foto, i) => (
            // Fotos ya optimizadas por la API (WebP de 1600 px): no hace falta next/image.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={foto.id}
              src={foto.url}
              width={foto.ancho}
              height={foto.alto}
              alt={`${f.nombre}, foto ${i + 1}`}
              loading={i === 0 ? "eager" : "lazy"}
              className="h-52 w-auto shrink-0 snap-start rounded-2xl object-cover"
            />
          ))}
        </div>
      )}

      <header className="mt-4">
        <h1 className="text-2xl font-bold tracking-tight">{f.nombre}</h1>
        <p className="mt-1 text-texto-2">
          {f.categoria} · {f.distrito}
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          {f.abierto === null ? (
            <span className="text-texto-2">Horario no informado</span>
          ) : f.abierto ? (
            <span className="font-semibold text-green-700 dark:text-green-400">
              Abierto ahora{f.cierra_a ? ` · cierra ${hora(f.cierra_a)}` : ""}
            </span>
          ) : (
            <span className="font-semibold text-error">Cerrado ahora</span>
          )}
          {f.tiene_delivery && (
            <span className="rounded-full bg-marca-suave px-2 py-0.5 text-xs font-semibold text-marca-fuerte">Delivery</span>
          )}
        </p>
      </header>

      <div className="mt-4 flex gap-2">
        {f.whatsapp && (
          <a href={enlaceWhatsapp(f.whatsapp, f.nombre)} target="_blank" rel="noopener noreferrer" className={`${BOTON} bg-[#25d366] text-[#0b3d1e]`}>
            WhatsApp
          </a>
        )}
        {f.telefono && (
          <a href={`tel:+${f.telefono}`} className={`${BOTON} border border-borde hover:border-marca`}>
            Llamar
          </a>
        )}
        <a href={enlaceComoLlegar(f.lat, f.lng)} target="_blank" rel="noopener noreferrer" className={`${BOTON} bg-marca text-sobre-marca hover:bg-marca-fuerte`}>
          Cómo llegar
        </a>
      </div>

      {f.descripcion && <p className="mt-5 whitespace-pre-line">{f.descripcion}</p>}

      <section className="mt-6">
        <h2 className="text-lg font-bold">Carta y precios</h2>
        {f.productos.length ? (
          <ul className="mt-2 divide-y divide-borde rounded-xl border border-borde">
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
          <p className="mt-2 text-sm text-texto-2">Este negocio todavía no publicó su carta.</p>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Horario</h2>
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

      <section className="mt-6 space-y-2">
        <h2 className="text-lg font-bold">Dónde queda</h2>
        <p className="text-sm">
          {f.direccion}, {f.distrito}
          {f.referencia && <span className="text-texto-2"> · {f.referencia}</span>}
        </p>
        <MiniMapa lng={f.lng} lat={f.lat} nombre={f.nombre} />
      </section>
    </article>
  );
}
