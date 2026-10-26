import type { Metadata } from "next";

import { Explorador } from "@/components/Explorador";

export const metadata: Metadata = { title: "Mapa" };

type Props = { searchParams: Promise<{ q?: string; categoria?: string }> };

/** Pestaña Mapa. ?q= viene del buscador de la barra superior; ?categoria=, de las tarjetas. */
export default async function PaginaMapa({ searchParams }: Props) {
  const { q = "", categoria = null } = await searchParams;
  // key: si cambia la búsqueda estando en el mapa, el explorador arranca de nuevo con ella.
  return <Explorador key={`${q}|${categoria}`} textoInicial={q} categoriaInicial={categoria} />;
}
