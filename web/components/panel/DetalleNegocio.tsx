import Link from "next/link";
import type { ReactNode } from "react";

import { codigoNegocio } from "@/lib/formato";
import type { NegocioAdmin } from "@/lib/tipos";

const CELDA = "border-b border-borde px-3 py-2 text-left align-top";

/** Todo lo que el negocio cargó en la sección de su dueño. */
export function DetalleNegocio({ n }: { n: NegocioAdmin }) {
  const filas: [string, ReactNode][] = [
    ["Código", codigoNegocio(n.id)],
    ["Estado", n.estado + (n.motivo_rechazo ? ` (${n.motivo_rechazo})` : "")],
    ["Categoría", n.categoria],
    ["Descripción", n.descripcion ?? "—"],
    ["Distrito", n.distrito],
    ["Dirección", n.direccion + (n.referencia ? ` (${n.referencia})` : "")],
    ["Ubicación", n.ubicacion ? `lat ${n.ubicacion.lat.toFixed(6)}, lng ${n.ubicacion.lng.toFixed(6)}` : "—"],
    ["WhatsApp", n.whatsapp ? `+${n.whatsapp}` : "—"],
    ["Teléfono", n.telefono ? `+${n.telefono}` : "—"],
    ["Delivery", n.tiene_delivery ? "Sí" : "No"],
  ];
  return (
    <div className="rounded-xl border border-borde bg-superficie shadow-sm">
      <p className="flex items-center justify-between gap-2 border-b border-borde px-4 py-3 font-semibold">
        {n.nombre}
        {n.estado === "aprobado" && (
          <Link href={`/n/${n.slug}`} target="_blank" className="text-xs font-normal text-marca-fuerte underline">
            ver página pública
          </Link>
        )}
      </p>
      <table className="w-full text-sm">
        <tbody>
          {filas.map(([etiqueta, valor]) => (
            <tr key={etiqueta}>
              <th className={`${CELDA} w-36 bg-fondo font-medium text-texto-2`}>{etiqueta}</th>
              <td className={CELDA}>{valor}</td>
            </tr>
          ))}
          <tr>
            <th className={`${CELDA} bg-fondo font-medium text-texto-2`}>Foto de perfil</th>
            <td className={CELDA}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {n.logo ? <img src={n.logo} alt="" className="h-14 w-14 rounded-full object-cover" /> : "—"}
            </td>
          </tr>
          <tr>
            <th className={`${CELDA} bg-fondo font-medium text-texto-2`}>Portada</th>
            <td className={CELDA}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {n.portada ? <img src={n.portada} alt="" className="aspect-[3/1] w-60 rounded object-cover" /> : "—"}
            </td>
          </tr>
          <tr>
            <th className="bg-fondo px-3 py-2 text-left align-top font-medium text-texto-2">
              Galería ({n.fotos.length})
            </th>
            <td className="px-3 py-2">
              <div className="flex flex-wrap gap-1">
                {n.fotos.length
                  ? n.fotos.map((f) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={f.id} src={f.url} alt="" className="h-14 w-14 rounded object-cover" loading="lazy" />
                    ))
                  : "—"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
