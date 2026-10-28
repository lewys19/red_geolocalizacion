import { Encabezado } from "@/components/Encabezado";
import { VentanaAcceso } from "@/components/VentanaAcceso";

// El sitio público: encabezado con buscador y ventana de ingreso. El panel administrativo (/admin) no los lleva.
export default function LayoutSitio({ children }: LayoutProps<"/">) {
  return (
    <>
      <Encabezado />
      <main className="flex flex-1 flex-col">{children}</main>
      <VentanaAcceso />
    </>
  );
}
