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
