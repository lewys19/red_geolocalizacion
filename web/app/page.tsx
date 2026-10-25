import Link from "next/link";

import { Buscador } from "@/components/Buscador";
import { Mapa } from "@/components/Mapa";

export default function Inicio() {
  return (
    <section className="relative flex-1 [--alto-panel:140px]">
      <Mapa />
      <Buscador />
      {/* Sprint 0: todavía no hay negocios cargados; el Sprint 1 los pone en el mapa. */}
      <div className="absolute inset-x-0 bottom-0 z-10 p-3">
        <div className="mx-auto max-w-xl rounded-2xl border border-borde bg-superficie p-4 shadow-lg">
          <p className="font-semibold">Muy pronto, los negocios de Lima en el mapa.</p>
          <p className="mt-1 text-sm text-texto-2">
            ¿Tienes un negocio?{" "}
            <Link href="/registro" className="font-medium text-marca-fuerte underline">
              Crea tu cuenta
            </Link>{" "}
            y sé de los primeros en aparecer.
          </p>
        </div>
      </div>
    </section>
  );
}
