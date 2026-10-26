// Las 3 reacciones de las publicaciones (deben coincidir con backend/app/models/social.py).
import type { TipoReaccion } from "./tipos";

export const REACCIONES: { tipo: TipoReaccion; emoji: string; texto: string }[] = [
  { tipo: "me_gusta", emoji: "👍", texto: "Me gusta" },
  { tipo: "me_encanta", emoji: "❤️", texto: "Me encanta" },
  { tipo: "wow", emoji: "😮", texto: "¡Wow!" },
];
