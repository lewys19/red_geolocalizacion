"use client";

// Página para enlaces directos (/registro). Dentro de la web se usa la ventana flotante.
import { useRouter } from "next/navigation";

import { Tarjeta } from "@/components/Formulario";
import { BotonesExternos, FormRegistro, Separador } from "@/components/FormulariosAcceso";
import { BotonAcceso } from "@/components/VentanaAcceso";

export default function Registro() {
  const router = useRouter();
  return (
    <Tarjeta titulo="Crea tu cuenta en Altoque">
      <FormRegistro alEntrar={() => router.push("/")} />
      <Separador />
      <BotonesExternos />
      <p className="mt-5 text-center text-sm text-texto-2">
        ¿Ya tienes cuenta? <BotonAcceso>Inicia sesión</BotonAcceso>
      </p>
    </Tarjeta>
  );
}
