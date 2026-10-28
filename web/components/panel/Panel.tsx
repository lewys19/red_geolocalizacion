"use client";

// Armazón del panel administrativo: ingreso propio, barra lateral y barra superior.
// No usa el encabezado del sitio. Qué menús se ven lo deciden los permisos de GET /yo;
// la API vuelve a verificarlos en cada petición.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, type ReactNode, useContext, useEffect, useState } from "react";

import { FormIngreso } from "@/components/FormulariosAcceso";
import { Isotipo } from "@/components/Logo";
import { pedir } from "@/lib/api";
import { guardarSesion, leerSesion } from "@/lib/sesion";
import type { Yo } from "@/lib/tipos";
import { useSesion } from "@/lib/usarSesion";

const ContextoPanel = createContext<Yo | null>(null);

/** Quien está en el panel. Solo dentro de <Panel>. */
export function usePanel(): Yo {
  const yo = useContext(ContextoPanel);
  if (!yo) throw new Error("usePanel fuera del panel");
  return yo;
}

export function puede(yo: Yo, permiso: string): boolean {
  return yo.permisos.includes(permiso);
}

interface Opcion {
  href: string;
  texto: string;
  icono: string; // trazo SVG 24x24
  permiso?: string;
}

const MENU: Opcion[] = [
  { href: "/admin", texto: "Dashboard", icono: "M4 13h6V4H4zm0 7h6v-5H4zm10 0h6v-9h-6zm0-16v5h6V4z" },
  {
    href: "/admin/usuarios",
    texto: "Usuarios",
    icono: "M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zM8 12a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 1c-2.7 0-8 1.3-8 4v3h16v-3c0-2.7-5.3-4-8-4zM8 14c-.3 0-.7 0-1.1.1C4.6 14.4 1 15.5 1 17.5V20h5v-3c0-1.2.7-2.2 2-3z",
    permiso: "usuarios.ver",
  },
  {
    href: "/admin/negocios",
    texto: "Negocios",
    icono: "M4 4h16l1 5a3 3 0 0 1-5 2 3 3 0 0 1-4 0 3 3 0 0 1-4 0 3 3 0 0 1-5-2zm1 9v7h14v-7",
    permiso: "negocios.ver",
  },
  {
    href: "/admin/categorias",
    texto: "Categorías",
    icono: "M4 4h7v7H4zm9 0h7v7h-7zM4 13h7v7H4zm9 0h7v7h-7z",
  },
  {
    href: "/admin/roles",
    texto: "Roles y permisos",
    icono: "M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5zm-1 14-4-4 1.4-1.4 2.6 2.6 5.6-5.6L18 9z",
    permiso: "roles.gestionar",
  },
];

function Icono({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}

async function salir() {
  const actual = leerSesion();
  if (actual) {
    await pedir("/auth/salir", { metodo: "POST", cuerpo: { token_refresco: actual.token_refresco } }).catch(() => {});
  }
  guardarSesion(null);
}

function PantallaIngreso({ aviso }: { aviso?: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-100 px-4 dark:bg-stone-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <Isotipo className="h-12 w-12" />
          <h1 className="text-xl font-bold tracking-tight">Altoque · Panel administrativo</h1>
          <p className="text-sm text-texto-2">Ingresa con tu cuenta del equipo.</p>
        </div>
        <div className="rounded-2xl border border-borde bg-superficie p-6 shadow-sm">
          {aviso ?? <FormIngreso alEntrar={() => {}} />}
        </div>
      </div>
    </div>
  );
}

function BarraLateral({ yo, abierta, alCerrar }: { yo: Yo; abierta: boolean; alCerrar: () => void }) {
  const ruta = usePathname();
  const opciones = MENU.filter((o) => !o.permiso || puede(yo, o.permiso));
  return (
    <>
      {/* En el celular el menú flota sobre el contenido; tocar fuera lo cierra. */}
      {abierta && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={alCerrar} aria-hidden="true" />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-stone-900 text-stone-300 transition-transform lg:static lg:z-auto ${
          abierta ? "translate-x-0" : "-translate-x-full lg:hidden"
        }`}
      >
        <div className="flex items-center gap-2.5 border-b border-white/10 px-5 py-4">
          <Isotipo className="h-9 w-9" />
          <div className="leading-tight">
            <p className="font-bold text-white">Altoque</p>
            <p className="text-xs text-stone-400">Panel administrativo</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          <p className="px-5 pb-2 text-xs font-semibold tracking-wider text-stone-500 uppercase">Gestión</p>
          {opciones.map((o) => {
            const activa = o.href === "/admin" ? ruta === "/admin" : ruta.startsWith(o.href);
            return (
              <Link
                key={o.href}
                href={o.href}
                onClick={() => window.innerWidth < 1024 && alCerrar()}
                className={`flex items-center gap-3 border-l-4 px-5 py-2.5 text-sm ${
                  activa ? "border-marca bg-white/10 font-semibold text-white" : "border-transparent hover:bg-white/5 hover:text-white"
                }`}
              >
                <Icono d={o.icono} />
                {o.texto}
              </Link>
            );
          })}
        </nav>
        <p className="border-t border-white/10 px-5 py-3 text-xs text-stone-500">
          Rol: <span className="text-stone-300">{yo.rol_panel}</span>
        </p>
      </aside>
    </>
  );
}

function BarraSuperior({ yo, alAlternarMenu }: { yo: Yo; alAlternarMenu: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-borde bg-superficie px-4 shadow-sm">
      <button type="button" onClick={alAlternarMenu} aria-label="Mostrar u ocultar el menú" className="rounded-lg p-2 text-texto-2 hover:bg-fondo">
        <Icono d="M3 6h18v2H3zm0 5h18v2H3zm0 5h18v2H3z" />
      </button>
      <p className="flex-1 truncate text-sm font-semibold">Panel administrativo</p>
      <div className="text-right leading-tight">
        <p className="text-sm font-semibold">{yo.nombre}</p>
        <p className="text-xs text-texto-2">{yo.rol_panel}</p>
      </div>
      <button type="button" onClick={salir} className="rounded-lg border border-borde px-3 py-1.5 text-sm hover:bg-fondo">
        Salir
      </button>
    </header>
  );
}

export function Panel({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const [yo, setYo] = useState<Yo | null>(null);
  const [error, setError] = useState<string | null>(null);
  // En el celular el menú empieza cerrado. (En el servidor no se dibuja: sin sesión se ve el ingreso.)
  const [menuAbierto, setMenuAbierto] = useState(() => typeof window === "undefined" || window.innerWidth >= 1024);
  const usuarioId = sesion?.usuario.id;

  useEffect(() => {
    if (!usuarioId) return;
    let vigente = true;
    pedir<Yo>("/yo", { conSesion: true })
      .then((datos) => vigente && (setYo(datos), setError(null)))
      .catch(() => vigente && setError("No se pudo cargar tu cuenta. Recarga la página."));
    return () => {
      vigente = false;
    };
  }, [usuarioId]);

  if (!sesion) return <PantallaIngreso />;
  const actual = yo?.id === usuarioId ? yo : null;
  if (error) return <PantallaIngreso aviso={<p className="text-center text-sm text-error">{error}</p>} />;
  if (!actual) return <div className="flex min-h-screen items-center justify-center text-texto-2">Cargando…</div>;
  if (!actual.en_panel) {
    return (
      <PantallaIngreso
        aviso={
          <div className="space-y-4 text-center text-sm">
            <p>
              La cuenta <strong>{actual.email}</strong> no tiene acceso al panel administrativo.
            </p>
            <button type="button" onClick={salir} className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-sobre-marca">
              Ingresar con otra cuenta
            </button>
          </div>
        }
      />
    );
  }

  return (
    <ContextoPanel.Provider value={actual}>
      <div className="flex min-h-screen bg-stone-100 dark:bg-stone-950">
        <BarraLateral yo={actual} abierta={menuAbierto} alCerrar={() => setMenuAbierto(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <BarraSuperior yo={actual} alAlternarMenu={() => setMenuAbierto((a) => !a)} />
          <main className="flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ContextoPanel.Provider>
  );
}

/** Ruta de migas: Inicio / Usuarios / … */
export function Migas({ items }: { items: { texto: string; href?: string }[] }) {
  return (
    <nav aria-label="Ruta" className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-texto-2">
      <Link href="/admin" className="hover:text-texto">
        Inicio
      </Link>
      {items.map((i) => (
        <span key={i.texto} className="flex items-center gap-1.5">
          <span aria-hidden="true">/</span>
          {i.href ? (
            <Link href={i.href} className="hover:text-texto">
              {i.texto}
            </Link>
          ) : (
            <span className="text-texto">{i.texto}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

/** Mensaje cuando el rol no tiene el permiso de la página. */
export function SinPermiso() {
  return <p className="rounded-xl border border-borde bg-superficie p-6 text-center text-texto-2">Tu rol no tiene permiso para ver esta sección.</p>;
}
