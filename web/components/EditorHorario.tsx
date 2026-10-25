"use client";

import type { Horario } from "@/lib/tipos";

const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Un tramo por día (el caso más común). Si cierra antes de abrir, cruza la medianoche. */
export type HorarioSemana = ({ abre: string; cierra: string } | null)[];

export const SEMANA_VACIA: HorarioSemana = Array(7).fill(null);

export function aHorarios(semana: HorarioSemana): Horario[] {
  return semana.flatMap((t, dia) => (t ? [{ dia_semana: dia, abre: t.abre, cierra: t.cierra }] : []));
}

const ATAJOS: { nombre: string; dias: number[]; abre: string; cierra: string }[] = [
  { nombre: "Todos los días 12:00–23:00", dias: [0, 1, 2, 3, 4, 5, 6], abre: "12:00", cierra: "23:00" },
  { nombre: "Lun–Sáb 9:00–18:00", dias: [0, 1, 2, 3, 4, 5], abre: "09:00", cierra: "18:00" },
  { nombre: "Lun–Dom 8:00–22:00", dias: [0, 1, 2, 3, 4, 5, 6], abre: "08:00", cierra: "22:00" },
];

export function EditorHorario({ valor, alCambiar }: { valor: HorarioSemana; alCambiar: (s: HorarioSemana) => void }) {
  const cambiarDia = (dia: number, tramo: { abre: string; cierra: string } | null) =>
    alCambiar(valor.map((t, i) => (i === dia ? tramo : t)));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ATAJOS.map((a) => (
          <button
            key={a.nombre}
            type="button"
            onClick={() => alCambiar(DIAS.map((_, i) => (a.dias.includes(i) ? { abre: a.abre, cierra: a.cierra } : null)))}
            className="rounded-full border border-borde px-3 py-1 text-xs font-medium hover:border-marca"
          >
            {a.nombre}
          </button>
        ))}
      </div>
      <ul className="divide-y divide-borde rounded-xl border border-borde">
        {DIAS.map((nombre, dia) => {
          const tramo = valor[dia];
          return (
            <li key={nombre} className="flex items-center gap-3 px-3 py-2 text-sm">
              <label className="flex w-28 shrink-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={tramo !== null}
                  onChange={(e) => cambiarDia(dia, e.target.checked ? { abre: "09:00", cierra: "18:00" } : null)}
                  className="h-4 w-4 accent-[var(--marca)]"
                />
                {nombre}
              </label>
              {tramo ? (
                <span className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={tramo.abre}
                    aria-label={`${nombre}: abre`}
                    onChange={(e) => cambiarDia(dia, { ...tramo, abre: e.target.value })}
                    className="rounded-md border border-borde bg-superficie px-2 py-1"
                  />
                  <span className="text-texto-2">a</span>
                  <input
                    type="time"
                    value={tramo.cierra}
                    aria-label={`${nombre}: cierra`}
                    onChange={(e) => cambiarDia(dia, { ...tramo, cierra: e.target.value })}
                    className="rounded-md border border-borde bg-superficie px-2 py-1"
                  />
                </span>
              ) : (
                <span className="text-texto-2">Cerrado</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** De la lista de la API a la semana del editor (un tramo por día: el primero). */
export function deHorarios(horarios: Horario[]): HorarioSemana {
  return SEMANA_VACIA.map((_, dia) => {
    const t = horarios.find((h) => h.dia_semana === dia);
    return t ? { abre: t.abre.slice(0, 5), cierra: t.cierra.slice(0, 5) } : null;
  });
}
