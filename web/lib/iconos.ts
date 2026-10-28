// Emoji de cada categoría. Desde la migración 0011 el campo `icono` ya es el emoji (se elige en el panel);
// los nombres viejos se siguen traduciendo por si alguna base aún no migró.
const EMOJIS: Record<string, string> = {
  utensils: "🍽️",
  drumstick: "🍗",
  bowl: "🥡",
  fish: "🐟",
  pot: "🍲",
  burger: "🍔",
  pizza: "🍕",
  coffee: "☕",
  cup: "🥤",
  store: "🏪",
  pill: "💊",
  hammer: "🔨",
  scissors: "✂️",
  wrench: "🔧",
  shirt: "👕",
  paw: "🐾",
};

export function emojiDe(icono: string | null): string {
  return (icono && (EMOJIS[icono] ?? icono)) || "📍";
}
