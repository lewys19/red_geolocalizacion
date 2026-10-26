import { describe, expect, it } from "vitest";

import { aCentimos } from "@/components/PanelCarta";

import { aPie, distancia, enlaceComoLlegar, enlaceWhatsapp, hace, hora, hoyEnLima, precio } from "./formato";
import { circulo, limitesDelCirculo } from "./geo";

describe("formato", () => {
  it("acorta la hora", () => expect(hora("23:00:00")).toBe("23:00"));
  it("muestra metros o kilómetros", () => {
    expect(distancia(656)).toBe("a 660 m");
    expect(distancia(1840)).toBe("a 1,8 km");
  });
  it("arma los enlaces", () => {
    expect(enlaceWhatsapp("51987654321", "Pollería")).toMatch(/^https:\/\/wa\.me\/51987654321\?text=/);
    expect(enlaceComoLlegar(-12.12, -77.03)).toContain("destination=-12.12,-77.03");
  });
});

describe("precio y día", () => {
  it("muestra soles o consultar", () => {
    expect(precio(1850)).toBe("S/ 18.50");
    expect(precio(0)).toBe("S/ 0.00");
    expect(precio(null)).toBe("Consultar");
  });
  it("usa la hora de Lima para el día", () => {
    // Martes 2026-10-20 23:30 en Lima = miércoles 04:30 UTC.
    expect(hoyEnLima(new Date("2026-10-21T04:30:00Z"))).toBe(1);
  });
});

describe("precio escrito por el dueño", () => {
  it("acepta punto, coma y S/", () => {
    expect(aCentimos("18.50")).toBe(1850);
    expect(aCentimos("18,5")).toBe(1850);
    expect(aCentimos("S/ 7")).toBe(700);
  });
  it("vacío es consultar y lo inválido se rechaza", () => {
    expect(aCentimos("  ")).toBeNull();
    expect(aCentimos("diez")).toBeUndefined();
    expect(aCentimos("-3")).toBeUndefined();
  });
});

describe("a pie y radio", () => {
  it("estima el tiempo a pie", () => {
    expect(aPie(300)).toBe("4 min a pie");
    expect(aPie(20)).toBe("1 min a pie");
    expect(aPie(6000)).toBe("1 h 20 min a pie");
  });
  it("el círculo queda a la distancia pedida del centro", () => {
    const [lng, lat] = [-77.03, -12.12];
    const borde = circulo(lng, lat, 1000)[0]; // el punto al este
    const metros = (borde[0] - lng) * 111_320 * Math.cos((lat * Math.PI) / 180);
    expect(Math.round(metros)).toBe(1000);
    const [[oeste], [este]] = limitesDelCirculo(lng, lat, 1000);
    expect(oeste).toBeLessThan(lng);
    expect(este).toBeGreaterThan(lng);
  });
});

describe("hace", () => {
  const ahora = new Date("2026-10-26T15:00:00Z");
  it("dice cuánto pasó", () => {
    expect(hace("2026-10-26T14:59:30Z", ahora)).toBe("ahora");
    expect(hace("2026-10-26T14:55:00Z", ahora)).toBe("hace 5 min");
    expect(hace("2026-10-26T12:00:00Z", ahora)).toBe("hace 3 h");
    expect(hace("2026-10-25T12:00:00Z", ahora)).toBe("ayer");
    expect(hace("2026-10-22T12:00:00Z", ahora)).toBe("hace 4 días");
  });
});
