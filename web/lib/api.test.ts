import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ErrorApi, conReintentos, pedir } from "./api";
import { guardarSesion, leerSesion, type Sesion } from "./sesion";

function sesion(acceso: string, refresco: string): Sesion {
  return {
    token_acceso: acceso,
    token_refresco: refresco,
    acceso_expira_en: "2030-01-01T00:00:00Z",
    usuario: { id: 1, email: "ana@example.com", nombre: "Ana", rol: "cliente" },
  };
}

function respuesta(estado: number, cuerpo?: unknown): Response {
  return new Response(cuerpo === undefined ? null : JSON.stringify(cuerpo), {
    status: estado,
    headers: { "Content-Type": "application/json" },
  });
}

describe("pedir", () => {
  const fetchFalso = vi.fn<typeof fetch>();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchFalso);
    guardarSesion(sesion("acceso-viejo", "refresco-viejo"));
  });

  afterEach(() => {
    fetchFalso.mockReset();
    vi.unstubAllGlobals();
    guardarSesion(null);
  });

  it("si la respuesta no llega a tiempo, avisa en vez de esperar para siempre", async () => {
    fetchFalso.mockRejectedValueOnce(new DOMException("se acabó el tiempo", "TimeoutError"));
    const error = await pedir("/auth/login", { metodo: "POST", cuerpo: {} }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ErrorApi);
    expect((error as ErrorApi).estado).toBe(0);
    expect((error as ErrorApi).message).toContain("tardó demasiado");
  });

  it("envía el token de acceso solo cuando se pide", async () => {
    fetchFalso.mockImplementation(async () => respuesta(200, []));
    await pedir("/categorias");
    await pedir("/yo", { conSesion: true });
    const cabeceras = fetchFalso.mock.calls.map(([, init]) => (init?.headers ?? {}) as Record<string, string>);
    expect(cabeceras[0].Authorization).toBeUndefined();
    expect(cabeceras[1].Authorization).toBe("Bearer acceso-viejo");
  });

  it("si el acceso venció, refresca la sesión y reintenta una vez", async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta(401, { detail: "Inicia sesión para continuar." }))
      .mockResolvedValueOnce(respuesta(200, sesion("acceso-nuevo", "refresco-nuevo")))
      .mockResolvedValueOnce(respuesta(200, { nombre: "Ana" }));

    await expect(pedir("/yo", { conSesion: true })).resolves.toEqual({ nombre: "Ana" });
    expect(fetchFalso.mock.calls[1][0]).toBe("/api/v1/auth/refresco");
    const reintento = fetchFalso.mock.calls[2][1]?.headers as Record<string, string>;
    expect(reintento.Authorization).toBe("Bearer acceso-nuevo");
    expect(leerSesion()?.token_refresco).toBe("refresco-nuevo");
  });

  it("si el refresco también falla, cierra la sesión", async () => {
    fetchFalso
      .mockResolvedValueOnce(respuesta(401, { detail: "Inicia sesión para continuar." }))
      .mockResolvedValueOnce(respuesta(401, { detail: "La sesión venció. Vuelve a ingresar." }));

    await expect(pedir("/yo", { conSesion: true })).rejects.toBeInstanceOf(ErrorApi);
    expect(leerSesion()).toBeNull();
  });

  it("dos peticiones vencidas a la vez comparten un solo refresco", async () => {
    fetchFalso.mockImplementation(async (url, init) => {
      if (url === "/api/v1/auth/refresco") return respuesta(200, sesion("acceso-nuevo", "refresco-nuevo"));
      const auth = (init?.headers as Record<string, string>).Authorization;
      return auth === "Bearer acceso-nuevo" ? respuesta(200, {}) : respuesta(401, {});
    });

    await Promise.all([pedir("/yo", { conSesion: true }), pedir("/yo", { conSesion: true })]);
    const refrescos = fetchFalso.mock.calls.filter(([url]) => url === "/api/v1/auth/refresco");
    expect(refrescos).toHaveLength(1);
  });

  it("muestra el mensaje de error de la API", async () => {
    fetchFalso.mockResolvedValue(respuesta(409, { detail: "Ya existe una cuenta con ese email." }));
    await expect(pedir("/auth/registro", { metodo: "POST", cuerpo: {} })).rejects.toThrow(
      "Ya existe una cuenta con ese email.",
    );
  });
});

describe("conReintentos", () => {
  it("reintenta un error del servidor y devuelve el segundo intento", async () => {
    let llamadas = 0;
    const r = await conReintentos(async () => {
      llamadas++;
      if (llamadas === 1) throw new ErrorApi(500, "caído");
      return "ok";
    }, 2, 1);
    expect(r).toBe("ok");
    expect(llamadas).toBe(2);
  });

  it("no reintenta un error del cliente (4xx)", async () => {
    let llamadas = 0;
    await expect(
      conReintentos(async () => {
        llamadas++;
        throw new ErrorApi(422, "datos inválidos");
      }, 3, 1),
    ).rejects.toThrow("datos inválidos");
    expect(llamadas).toBe(1);
  });
});
