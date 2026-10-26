import Link from "next/link";

/** El ícono solo: pin de mapa con un rayo (ubicar rápido). */
export function Isotipo({ className = "h-8 w-8", redondo = false }: { className?: string; redondo?: boolean }) {
  return (
    <svg viewBox="0 0 32 32" className={`shrink-0 ${className}`} aria-hidden="true">
      <rect width="32" height="32" rx={redondo ? 16 : 9} fill="var(--marca)" />
      <path d="M16 6c-4.4 0-8 3.4-8 7.7C8 19.5 16 26 16 26s8-6.5 8-12.3C24 9.4 20.4 6 16 6z" fill="#fff" />
      <path d="M17.2 9.5l-4 5.3h2.6l-1 4.2 4-5.4h-2.6z" fill="var(--marca)" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" aria-label="Altoque, inicio" className="flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight">
      <Isotipo />
      {/* En el celular solo el ícono: el nombre no entra junto a las pestañas. */}
      <span className="hidden sm:inline">Altoque</span>
    </Link>
  );
}
