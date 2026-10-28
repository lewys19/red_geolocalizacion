"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Migas, puede, usePanel } from "@/components/panel/Panel";
import { pedir } from "@/lib/api";
import type { ResumenAdmin } from "@/lib/tipos";

function Cifra({ titulo, valor, detalle, href }: { titulo: string; valor: number | string; detalle?: string; href?: string }) {
  const contenido = (
    <>
      <p className="text-sm text-texto-2">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{valor}</p>
      {detalle && <p className="mt-1 text-xs text-texto-2">{detalle}</p>}
    </>
  );
  const clase = "block rounded-xl border border-borde bg-superficie p-5 shadow-sm";
  return href ? (
    <Link href={href} className={`${clase} hover:border-marca`}>
      {contenido}
    </Link>
  ) : (
    <div className={clase}>{contenido}</div>
  );
}

export function Dashboard() {
  const yo = usePanel();
  const [resumen, setResumen] = useState<ResumenAdmin | null>(null);

  useEffect(() => {
    pedir<ResumenAdmin>("/admin/resumen", { conSesion: true }).then(setResumen).catch(() => {});
  }, []);

  const verUsuarios = puede(yo, "usuarios.ver");
  const verNegocios = puede(yo, "negocios.ver");
  const n = resumen?.negocios_por_estado;

  return (
    <div className="mx-auto max-w-6xl">
      <Migas items={[{ texto: "Dashboard" }]} />
      <h1 className="text-2xl font-bold tracking-tight">Hola, {yo.nombre.split(" ")[0]}</h1>
      <p className="text-sm text-texto-2">Resumen de Altoque.</p>
      {!resumen ? (
        <p className="mt-6 text-texto-2">Cargando…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Cifra
              titulo="Usuarios registrados"
              valor={resumen.usuarios}
              detalle={`${resumen.usuarios_nuevos_7d} nuevos en los últimos 7 días`}
              href={verUsuarios ? "/admin/usuarios" : undefined}
            />
            <Cifra titulo="Usuarios con negocio" valor={resumen.usuarios_con_negocio} />
            <Cifra titulo="Usuarios sin negocio" valor={resumen.usuarios_sin_negocio} />
            <Cifra
              titulo="Negocios registrados"
              valor={resumen.negocios}
              detalle={`${n?.aprobado ?? 0} aprobados · ${n?.pendiente ?? 0} por revisar`}
              href={verNegocios ? "/admin/negocios" : undefined}
            />
            <Cifra titulo="Categorías registradas" valor={resumen.categorias} />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="rounded-xl border border-borde bg-superficie shadow-sm lg:col-span-2">
              <h2 className="border-b border-borde px-5 py-3 font-bold">Negocios por categoría</h2>
              {resumen.por_categoria.length === 0 ? (
                <p className="px-5 py-4 text-sm text-texto-2">Todavía no hay negocios.</p>
              ) : (
                <ul className="divide-y divide-borde">
                  {resumen.por_categoria.map((c) => (
                    <li key={c.categoria} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      <span className="w-40 shrink-0 truncate">{c.categoria}</span>
                      <span className="h-2 flex-1 overflow-hidden rounded-full bg-fondo">
                        <span
                          className="block h-full rounded-full bg-marca"
                          style={{ width: `${(c.negocios / resumen.por_categoria[0].negocios) * 100}%` }}
                        />
                      </span>
                      <span className="w-10 text-right font-semibold tabular-nums">{c.negocios}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <div className="grid content-start gap-4">
              <Cifra
                titulo="Negocios por revisar"
                valor={n?.pendiente ?? 0}
                href={verNegocios ? "/admin/negocios" : undefined}
              />
              <Cifra titulo="Equipo con acceso al panel" valor={resumen.equipo} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
