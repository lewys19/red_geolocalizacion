// Emoji de cada categoría según su campo `icono` (ver la migración 0001 del backend).
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
  return (icono && EMOJIS[icono]) || "📍";
}
