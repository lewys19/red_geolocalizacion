import { Dashboard } from "./Vista";

// El panel solo se dibuja en el navegador y con sesión (ver components/panel/Panel.tsx).
export const instant = false;

export default function Pagina() {
  return <Dashboard />;
}
