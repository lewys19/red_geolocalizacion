"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { type FormEvent, type ReactNode, Suspense, useState } from "react";

import { useSesion } from "@/lib/usarSesion";

import { Logo } from "./Logo";

const ICONO = "h-5 w-5";

const PESTANAS: { href: string; texto: string; icono: ReactNode }[] = [
  {
    href: "/",
    texto: "Inicio",
    icono: (
      <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
        <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/mapa",
    texto: "Mapa",
    icono: (
      <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
        <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/categorias",
    texto: "Categorías",
    icono: (
      <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
        <path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z" fill="currentColor" />
      </svg>
    ),
  },
];

function activa(ruta: string | null, href: string): boolean {
  if (ruta === null) return false;
  return href === "/" ? ruta === "/" : ruta.startsWith(href);
}

function ListaPestanas({ ruta }: { ruta: string | null }) {
  return (
    <nav aria-label="Secciones" className="flex justify-center gap-1">
      {PESTANAS.map((p) => {
        const actual = activa(ruta, p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={actual ? "page" : undefined}
            title={p.texto}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition sm:px-5 ${
              actual ? "bg-marca-suave text-marca-fuerte" : "text-texto-2 hover:bg-fondo hover:text-texto"
            }`}
          >
            {p.icono}
            <span className="hidden sm:inline">{p.texto}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Lee la ruta para resaltar la pestaña actual. Con Cache Components, leer la URL
 * debe ir dentro de <Suspense>: mientras tanto se ven las mismas pestañas sin resaltar. */
function PestanasConRuta() {
  return <ListaPestanas ruta={usePathname()} />;
}

/** Barra superior: logo, buscador, Inicio · Mapa · Categorías, configuración y perfil. */
export function Encabezado() {
  const sesion = useSesion();
  const router = useRouter();
  const [texto, setTexto] = useState("");

  function buscar(e: FormEvent) {
    e.preventDefault();
    const q = texto.trim();
    if (q) router.push(`/mapa?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-30 grid h-14 grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-borde bg-superficie px-3 md:grid-cols-[1fr_auto_1fr]">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <form role="search" onSubmit={buscar} className="hidden max-w-64 flex-1 lg:block">
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            aria-label="Buscar en Altoque"
            placeholder="Buscar negocios…"
            className="w-full rounded-full bg-fondo px-4 py-2 text-sm outline-none ring-1 ring-borde focus:ring-marca"
          />
        </form>
      </div>

      <Suspense fallback={<ListaPestanas ruta={null} />}>
        <PestanasConRuta />
      </Suspense>

      <div className="flex items-center justify-end gap-2 text-sm">
        {sesion ? (
          <>
            {(sesion.usuario.rol === "operador" || sesion.usuario.rol === "superadmin") && (
              <Link href="/admin" className="hidden px-2 py-1.5 text-texto-2 hover:text-texto sm:block">
                Panel
              </Link>
            )}
            <Link href="/cuenta" title="Configuración" className="rounded-full p-2 text-texto-2 hover:bg-fondo hover:text-texto">
              <svg viewBox="0 0 24 24" className={ICONO} aria-hidden="true">
                <path
                  d="M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6-2-3.5-2.5 1a7.4 7.4 0 0 0-1.7-1L15 3.3h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.5L6.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6 2 3.5 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.5zM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7z"
                  fill="currentColor"
                />
              </svg>
              <span className="sr-only">Configuración</span>
            </Link>
            <Link
              href="/cuenta"
              title={sesion.usuario.nombre}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-marca font-bold text-sobre-marca"
            >
              {sesion.usuario.nombre.trim().charAt(0).toUpperCase()}
              <span className="sr-only">Mi perfil</span>
            </Link>
          </>
        ) : (
          <>
            <Link href="/ingresar" className="hidden px-2 py-1.5 text-texto-2 hover:text-texto sm:block">
              Ingresar
            </Link>
            <Link href="/registro" className="rounded-full bg-marca px-3 py-1.5 font-medium text-sobre-marca hover:bg-marca-fuerte">
              Crear cuenta
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
