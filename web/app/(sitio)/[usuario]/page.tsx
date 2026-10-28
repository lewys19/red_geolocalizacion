import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { fecha } from "@/lib/formato";
import { obtener } from "@/lib/servidor";
import type { PerfilPublico } from "@/lib/tipos";

// Perfil público: altoque.pe/{username}. La URL es solo visual; la API lo resuelve a su id.
type Props = { params: Promise<{ usuario: string }> };

async function cargar(usuario: string): Promise<PerfilPublico | null> {
  return obtener<PerfilPublico>(`/perfiles/${encodeURIComponent(usuario.toLowerCase())}`);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await cargar((await params).usuario);
  if (!p) return { title: "Perfil no encontrado" };
  return {
    title: `${p.nombre} (@${p.username})`,
    description: p.negocios.length
      ? `${p.nombre} en Altoque: ${p.negocios.map((n) => n.nombre).join(", ")}.`
      : `${p.nombre} en Altoque.`,
    openGraph: { title: p.nombre, images: p.avatar ? [p.avatar] : [] },
  };
}

export default async function PerfilDeUsuario({ params }: Props) {
  const p = await cargar((await params).usuario);
  if (!p) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="flex items-center gap-4">
        {p.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatar} alt="" className="h-24 w-24 rounded-full object-cover ring-1 ring-borde" />
        ) : (
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-marca-suave text-4xl font-bold text-marca-fuerte">
            {p.nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{p.nombre}</h1>
          <p className="text-texto-2">@{p.username}</p>
          <p className="text-sm text-texto-2">En Altoque desde {fecha(p.creado_en)}</p>
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-bold">Negocios</h2>
      {p.negocios.length === 0 ? (
        <p className="text-texto-2">Todavía no tiene negocios publicados.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {p.negocios.map((n) => (
            <Link
              key={n.slug}
              href={`/n/${n.slug}`}
              className="flex items-center gap-3 rounded-2xl border border-borde bg-superficie p-3 shadow-sm hover:border-marca"
            >
              {n.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={n.logo} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-marca-suave text-xl font-bold text-marca-fuerte">
                  {n.nombre.charAt(0)}
                </span>
              )}
              <span className="min-w-0">
                <span className="block truncate font-semibold">{n.nombre}</span>
                <span className="block text-sm text-texto-2">
                  {n.categoria} · {n.distrito}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
