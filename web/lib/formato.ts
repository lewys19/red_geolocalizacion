// Textos cortos para la interfaz.

export function hora(valor: string): string {
  return valor.slice(0, 5); // "23:00:00" → "23:00"
}

export function distancia(metros: number): string {
  return metros < 1000 ? `a ${Math.round(metros / 10) * 10} m` : `a ${(metros / 1000).toFixed(1).replace(".", ",")} km`;
}

export function enlaceWhatsapp(numero: string, negocio: string): string {
  const texto = encodeURIComponent(`Hola, te encontré en Altoque. Quisiera consultar sobre ${negocio}.`);
  return `https://wa.me/${numero}?text=${texto}`;
}

export function enlaceComoLlegar(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export function precio(centimos: number | null): string {
  if (centimos === null) return "Consultar";
  return `S/ ${(centimos / 100).toFixed(2)}`;
}

export const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** Día de hoy en Lima, 0 = lunes (como en la API). */
export function hoyEnLima(momento: Date = new Date()): number {
  const nombre = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/Lima" }).format(momento);
  return ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(nombre);
}

/** Tiempo a pie estimado en línea recta (4,5 km/h). Es aproximado: las calles suman algo más. */
export function aPie(metros: number): string {
  const minutos = Math.max(1, Math.round(metros / 75));
  if (minutos < 60) return `${minutos} min a pie`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `${h} h ${m} min a pie` : `${h} h a pie`;
}

export function coordenadas(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
