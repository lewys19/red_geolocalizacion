import type { Metadata } from "next";

import { Panel } from "@/components/panel/Panel";

export const metadata: Metadata = { title: "Panel administrativo", robots: { index: false } };

// El panel es otra aplicación dentro del mismo sitio: sin el encabezado ni el buscador públicos.
export default function LayoutPanel({ children }: LayoutProps<"/admin">) {
  return <Panel>{children}</Panel>;
}
