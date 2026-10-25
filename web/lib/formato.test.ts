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
