import type { Metadata, Viewport } from "next";

import { Encabezado } from "@/components/Encabezado";
import { VentanaAcceso } from "@/components/VentanaAcceso";

import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Altoque · Negocios cerca de ti", template: "%s · Altoque" },
  description: "Encuentra al toque qué negocios hay cerca: precios, horarios y delivery en el mapa. Piloto en Lima.",
};

export const viewport: Viewport = {
  themeColor: "#ea580c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <Encabezado />
        <main className="flex flex-1 flex-col">{children}</main>
        <VentanaAcceso />
      </body>
    </html>
  );
}
