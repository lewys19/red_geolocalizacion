// Validación de formularios con mensajes propios en vez del globo del navegador
// ("Selecciona un elemento de la lista"), que queda tapado por el encabezado fijo.

/** Nombre visible del campo: su <label>, o el encabezado de su fila en las tablas de /perfil. */
function etiquetaDe(campo: Element): string {
  const texto =
    campo.closest("label")?.querySelector("span")?.textContent ??
    campo.closest("tr")?.querySelector("th")?.textContent ??
    campo.getAttribute("aria-label") ??
    "un campo";
  return texto.replace("*", "").trim();
}

/**
 * Revisa el formulario (usar con `noValidate`). Si falta algo, lleva al primer campo con problema
 * y devuelve el mensaje para mostrar; si está todo bien, null.
 */
export function revisarFormulario(formulario: HTMLFormElement): string | null {
  const invalidos = Array.from(formulario.elements).filter(
    (e): e is HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement =>
      "validity" in e && !(e as HTMLInputElement).validity.valid,
  );
  if (!invalidos.length) return null;
  const primero = invalidos[0];
  primero.scrollIntoView({ behavior: "smooth", block: "center" });
  primero.focus({ preventScroll: true });
  const faltan = invalidos.filter((e) => e.validity.valueMissing).map(etiquetaDe);
  const malos = invalidos.filter((e) => !e.validity.valueMissing).map(etiquetaDe);
  return [
    faltan.length ? `Falta completar: ${[...new Set(faltan)].join(", ")}.` : "",
    malos.length ? `Revisa: ${[...new Set(malos)].join(", ")}.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
