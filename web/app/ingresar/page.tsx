"use client";

// Página para enlaces directos (/ingresar). Dentro de la web se usa la ventana flotante.
import { useRouter } from "next/navigation";

import { Tarjeta } from "@/components/Formulario";
import { BotonesExternos, FormIngreso, Separador } from "@/components/FormulariosAcceso";
import { BotonAcceso } from "@/components/VentanaAcceso";

export default function Ingresar() {
  const router = useRouter();
  return (
    <Tarjeta titulo="Inicia sesión en Altoque">
      <FormIngreso alEntrar={() => router.push("/")} />
      <Separador />
      <BotonesExternos />
      <p className="mt-5 text-center text-sm text-texto-2">
        ¿No tienes cuenta? <BotonAcceso vista="registro">Regístrate</BotonAcceso>
      </p>
    </Tarjeta>
  );
}
