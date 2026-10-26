// Una publicación del muro. Sin estado ni efectos: sirve tanto en el Inicio (cliente)
// como en la página del negocio (armada en el servidor para Google).
import Link from "next/link";

import { distancia, hace } from "@/lib/formato";
import type { Foto, NegocioMini, Publicacion } from "@/lib/tipos";

export function Avatar({ negocio, tamano = "h-11 w-11 text-lg" }: { negocio: NegocioMini; tamano?: string }) {
  return negocio.foto ? (
    // Fotos ya optimizadas por la API (WebP de 1600 px): no hace falta next/image.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={negocio.foto} alt="" className={`${tamano} shrink-0 rounded-full object-cover`} loading="lazy" />
  ) : (
    <span className={`${tamano} flex shrink-0 items-center justify-center rounded-full bg-marca font-bold text-sobre-marca`}>
      {negocio.nombre.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Mosaico como en el diseño: 1 foto ancha; 2 lado a lado; 3 = dos a la izquierda y una alta a la derecha; 4 = cuadrícula. */
function Mosaico({ fotos, nombre }: { fotos: Foto[]; nombre: string }) {
  if (!fotos.length) return null;
  const celda = (f: Foto, i: number, clase: string) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img key={f.id} src={f.url} alt={`${nombre}, foto ${i + 1}`} loading="lazy" className={`h-full w-full rounded-xl object-cover ${clase}`} />
  );
  if (fotos.length === 1) return <div className="mt-3">{celda(fotos[0], 0, "max-h-[28rem]")}</div>;
  if (fotos.length === 2) return <div className="mt-3 grid h-64 grid-cols-2 gap-2">{fotos.map((f, i) => celda(f, i, ""))}</div>;
  if (fotos.length === 3)
    return (
      <div className="mt-3 grid h-80 grid-cols-2 grid-rows-2 gap-2">
        {celda(fotos[0], 0, "")}
        {celda(fotos[1], 1, "row-span-2 col-start-2 row-start-1")}
        {celda(fotos[2], 2, "")}
      </div>
    );
  return <div className="mt-3 grid h-80 grid-cols-2 grid-rows-2 gap-2">{fotos.slice(0, 4).map((f, i) => celda(f, i, ""))}</div>;
}

export function TarjetaPublicacion({ publicacion: p, ahora }: { publicacion: Publicacion; ahora?: Date }) {
  return (
    <article className="rounded-2xl border border-borde bg-superficie p-4 shadow-sm">
      <header className="flex items-center gap-3">
        <Link href={`/n/${p.negocio.slug}`}>
          <Avatar negocio={p.negocio} />
        </Link>
        <div className="min-w-0">
          <Link href={`/n/${p.negocio.slug}`} className="block truncate font-bold uppercase tracking-tight hover:underline">
            {p.negocio.nombre}
          </Link>
          <p className="truncate text-sm text-texto-2">
            {p.negocio.distrito} - Lima · {hace(p.creado_en, ahora)}
            {p.negocio.distancia_m !== null && ` · ${distancia(p.negocio.distancia_m)}`}
          </p>
        </div>
      </header>
      {p.texto && <p className="mt-3 whitespace-pre-line text-[15px]">{p.texto}</p>}
      <Mosaico fotos={p.fotos} nombre={p.negocio.nombre} />
    </article>
  );
}
