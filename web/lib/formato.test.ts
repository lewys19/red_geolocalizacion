import { describe, expect, it } from "vitest";

import { distancia, enlaceComoLlegar, enlaceWhatsapp, hora } from "./formato";

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

describe("precio y día", async () => {
  const { precio, hoyEnLima } = await import("./formato");
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

describe("precio escrito por el dueño", async () => {
  const { aCentimos } = await import("@/components/PanelCarta");
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
