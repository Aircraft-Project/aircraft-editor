/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { POST } from "./route";

function createRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("authenticates admin credentials", async () => {
    const response = await POST(createRequest({ username: " admin ", password: "admin" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        session: {
          user: {
            id: "usr-admin-001",
            username: "admin",
            displayName: "Administrador",
            initials: "AD",
            role: "ADMIN",
          },
        },
      },
    });
  });

  it("authenticates developer credentials", async () => {
    const response = await POST(createRequest({ username: "developer", password: "developer" }));

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body).toEqual({
      success: true,
      data: {
        session: {
          user: {
            id: "usr-developer-001",
            username: "developer",
            displayName: "Desarrollador",
            initials: "DE",
            role: "DEVELOPER",
          },
        },
      },
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("rejects incorrect credentials without revealing which value failed", async () => {
    const response = await POST(createRequest({ username: "admin", password: "incorrecta" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Usuario o contraseña incorrectos.",
    });
  });

  it("returns 400 for malformed or incomplete requests", async () => {
    const incompleteResponse = await POST(createRequest({ username: "admin" }));
    const malformedResponse = await POST(createRequest(null));

    expect(incompleteResponse.status).toBe(400);
    expect(malformedResponse.status).toBe(400);
  });
});
