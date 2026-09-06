import type { DashboardData } from "@/modules/dashboard";

import {
  DashboardServiceError,
  HttpDashboardService,
} from "./httpDashboardService";

const dashboard: DashboardData = {
  summary: {
    totalProjects: 1,
    editingProjects: 1,
    publishedProjects: 0,
  },
  projects: [
    {
      id: "project-one",
      name: "Project one",
      description: "Description",
      status: "DRAFT",
      screensCount: 0,
      updatedAt: "2026-09-05T10:00:00.000Z",
      icon: "LAYOUT",
      accent: "BLUE",
      ownerId: "user-one",
    },
  ],
};

const createResponse = (
  status: number,
  payload: unknown,
): Response =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(payload),
  }) as unknown as Response;

describe("HttpDashboardService", () => {
  it("loads and validates dashboard data", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      createResponse(200, {
        success: true,
        data: dashboard,
      }),
    );
    const service = new HttpDashboardService(fetcher);

    await expect(
      service.getDashboard("user id"),
    ).resolves.toEqual(dashboard);
    expect(fetcher).toHaveBeenCalledWith(
      "/api/dashboard?userId=user%20id",
      { method: "GET" },
    );
  });

  it.each([
    [400, "No fue posible identificar al usuario."],
    [500, "No fue posible cargar tus proyectos."],
  ])("maps HTTP %s to a safe error", async (status, message) => {
    const service = new HttpDashboardService(
      jest.fn().mockResolvedValue(
        createResponse(status, {
          success: false,
          message: "Internal detail",
        }),
      ),
    );

    await expect(
      service.getDashboard("user-one"),
    ).rejects.toMatchObject({
      name: "DashboardServiceError",
      message,
      status,
    });
  });

  it("maps network failures to a safe error", async () => {
    const service = new HttpDashboardService(
      jest.fn().mockRejectedValue(new Error("network detail")),
    );

    await expect(
      service.getDashboard("user-one"),
    ).rejects.toEqual(
      new DashboardServiceError(
        "No fue posible cargar tus proyectos.",
      ),
    );
  });

  it("rejects an invalid successful response", async () => {
    const service = new HttpDashboardService(
      jest.fn().mockResolvedValue(
        createResponse(200, {
          success: true,
          data: {
            summary: dashboard.summary,
            projects: [{ id: "incomplete" }],
          },
        }),
      ),
    );

    await expect(
      service.getDashboard("user-one"),
    ).rejects.toMatchObject({
      message:
        "El servicio del dashboard devolvió una respuesta inválida.",
      status: 200,
    });
  });
});
