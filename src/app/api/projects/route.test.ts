/** @jest-environment node */

jest.mock("server-only", () => ({}));

import { POST } from "./route";

const createRequest = (body: unknown): Request =>
  new Request("http://localhost/api/projects", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

describe("POST /api/projects", () => {
  it("creates a normalized draft project", async () => {
    const response = await POST(
      createRequest({
        name: "  Nuevo proyecto  ",
        description: "  Descripción  ",
        userId: "usr-developer-001",
        password: "must-not-be-forwarded",
      }),
    );
    const payload: unknown = await response.json();
    const serializedPayload = JSON.stringify(payload);

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      success: true,
      data: {
        project: {
          name: "Nuevo proyecto",
          description: "Descripción",
          status: "DRAFT",
          screensCount: 0,
          icon: "LAYOUT",
          accent: "BLUE",
          ownerId: "usr-developer-001",
        },
      },
    });
    expect(serializedPayload).not.toContain("password");
    expect(serializedPayload).not.toContain(
      "must-not-be-forwarded",
    );
  });

  it("returns 400 for an empty name", async () => {
    const response = await POST(
      createRequest({
        name: "   ",
        userId: "usr-developer-001",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "Los datos del proyecto no son válidos.",
      errors: {
        name: "El nombre del proyecto es obligatorio.",
      },
    });
  });

  it("returns 400 for an invalid request shape", async () => {
    const response = await POST(
      createRequest({
        name: "Proyecto sin usuario",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      success: false,
      message: "La solicitud para crear el proyecto no es válida.",
    });
  });

  it("returns 401 without creating a project for an unknown owner", async () => {
    const response = await POST(
      createRequest({
        name: "Proyecto fantasma",
        userId: "usr-unknown",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      success: false,
      message: "No fue posible identificar al usuario.",
    });
    expect(payload).not.toHaveProperty("data");
  });

  it("allows an administrator to create a project", async () => {
    const response = await POST(
      createRequest({
        name: "Proyecto administrador",
        userId: "usr-admin-001",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload).toMatchObject({
      success: true,
      data: {
        project: {
          name: "Proyecto administrador",
          ownerId: "usr-admin-001",
          status: "DRAFT",
        },
      },
    });
  });});
