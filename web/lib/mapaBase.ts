// Configuración común de los mapas de Altoque.
import { type Map as MapaLibre, setWorkerUrl } from "maplibre-gl";

// Mapa base gratuito de OpenStreetMap (OpenFreeMap, sin clave). Se cambia con NEXT_PUBLIC_ESTILO_MAPA.
export const ESTILO = process.env.NEXT_PUBLIC_ESTILO_MAPA ?? "https://tiles.openfreemap.org/styles/liberty";

// Centro de Lima (Plaza de Armas) mientras no haya permiso de ubicación.
export const LIMA: [number, number] = [-77.0428, -12.0464];

// Textos de los botones del mapa en español (MapLibre los trae en inglés).
export const TEXTOS_MAPA = {
  "GeolocateControl.FindMyLocation": "Mostrar mi ubicación",
  "GeolocateControl.LocationNotAvailable": "Ubicación no disponible",
  "NavigationControl.ZoomIn": "Acercar",
  "NavigationControl.ZoomOut": "Alejar",
  "NavigationControl.ResetBearing": "Orientar al norte",
  "AttributionControl.ToggleAttribution": "Ver créditos del mapa",
  "AttributionControl.MapFeedback": "Reportar un error del mapa",
};

// MapLibre dibuja las teselas en un worker aparte; el build lo copia a public/ (ver package.json).
setWorkerUrl("/maplibre-gl-worker.mjs");

/** El estilo muestra los nombres en inglés ("West Angamos Avenue"): se cambian por el español o el local. */
export function nombresEnEspanol(mapa: MapaLibre): void {
  for (const capa of mapa.getStyle().layers) {
    if (capa.type !== "symbol") continue;
    const texto = mapa.getLayoutProperty(capa.id, "text-field");
    if (JSON.stringify(texto ?? "").includes("name_en")) {
      mapa.setLayoutProperty(capa.id, "text-field", ["coalesce", ["get", "name:es"], ["get", "name"]]);
    }
  }
}
