/** @jest-environment node */

import { AuthServiceError, HttpAuthService } from "./authService";

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("HttpAuthService", () => {
  it("returns the minimal authenticated session", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(
        {
          success: true,
          user: { username: "admin", displayName: "Administrador" },
        },
        200,
      ),
    );
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "admin" })).resolves.toEqual({
      username: "admin",
      displayName: "Administrador",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/auth/login",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ username: "admin", password: "admin" }),
      }),
    );
  });

  it("maps HTTP 401 to a generic credential error", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse(
        { success: false, message: "Usuario o contraseña incorrectos." },
        401,
      ),
    );
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "incorrecta" })).rejects.toMatchObject({
      name: "AuthServiceError",
      code: "INVALID_CREDENTIALS",
      status: 401,
      message: "Usuario o contraseña incorrectos.",
    } satisfies Partial<AuthServiceError>);
  });

  it("maps HTTP 400 and preserves the safe server message", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse({ success: false, message: "Completá los datos requeridos." }, 400),
    );
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "", password: "" })).rejects.toMatchObject({
      code: "BAD_REQUEST",
      status: 400,
      message: "Completá los datos requeridos.",
    });
  });

  it("maps server failures to a safe generic error", async () => {
    const fetcher = jest.fn(async () =>
      jsonResponse({ success: false, message: "internal detail" }, 500),
    );
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "admin" })).rejects.toMatchObject({
      code: "SERVER_ERROR",
      status: 500,
      message: "No pudimos iniciar sesión. Intentá nuevamente.",
    });
  });

  it("maps connection failures without exposing credentials", async () => {
    const fetcher = jest.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "secret-value" })).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.",
    });
  });

  it("rejects malformed successful responses", async () => {
    const fetcher = jest.fn(async () => jsonResponse({ success: true }, 200));
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "admin" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
    });
  });

  it("rejects non-JSON responses", async () => {
    const fetcher = jest.fn(async () => new Response("not-json", { status: 200 }));
    const service = new HttpAuthService("/api/auth/login", fetcher);

    await expect(service.login({ username: "admin", password: "admin" })).rejects.toMatchObject({
      code: "INVALID_RESPONSE",
      status: 200,
    });
  });
});
