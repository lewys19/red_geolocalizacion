// Geometría simple para dibujar el radio de búsqueda en el mapa.

const METROS_POR_GRADO = 111_320;

/** Polígono que aproxima un círculo de `radio` metros (64 lados alcanza para verse redondo). */
export function circulo(lng: number, lat: number, radio: number, lados = 64): [number, number][] {
  const dLat = radio / METROS_POR_GRADO;
  const dLng = radio / (METROS_POR_GRADO * Math.cos((lat * Math.PI) / 180));
  const puntos: [number, number][] = [];
  for (let i = 0; i <= lados; i++) {
    const a = (i / lados) * 2 * Math.PI;
    puntos.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return puntos;
}

/** Recuadro [[oeste, sur], [este, norte]] que contiene el círculo. */
export function limitesDelCirculo(lng: number, lat: number, radio: number): [[number, number], [number, number]] {
  const dLat = radio / METROS_POR_GRADO;
  const dLng = radio / (METROS_POR_GRADO * Math.cos((lat * Math.PI) / 180));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat + dLat],
  ];
}
