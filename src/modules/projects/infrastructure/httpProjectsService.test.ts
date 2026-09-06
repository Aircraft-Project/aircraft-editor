import {
  HttpProjectsService,
  ProjectsServiceError,
} from "./httpProjectsService";

const request = {
  name: "Proyecto nuevo",
  description: "Descripción",
  userId: "usr-developer-001",
};

const project = {
  id: "project-6",
  name: "Proyecto nuevo",
  description: "Descripción",
  status: "DRAFT",
  screensCount: 0,
  updatedAt: "2026-09-05T12:00:00.000Z",
  icon: "LAYOUT",
  accent: "BLUE",
  ownerId: "usr-developer-001",
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

describe("HttpProjectsService", () => {
  it("creates a project through POST without credentials", async () => {
    const fetcher = jest.fn().mockResolvedValue(
      createResponse(201, {
        success: true,
        data: {
          project,
        },
      }),
    );
    const service = new HttpProjectsService(fetcher);

    await expect(service.createProject(request)).resolves.toEqual(
      project,
    );

    const [, options] = fetcher.mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(options.method).toBe("POST");
    expect(options.body).not.toContain("password");
  });

  it.each([
    [400, "Los datos del proyecto no son válidos."],
    [403, "No tienes permiso para crear proyectos."],
    [500, "No fue posible crear el proyecto."],
  ])("maps HTTP %s to a safe error", async (status, message) => {
    const service = new HttpProjectsService(
      jest.fn().mockResolvedValue(
        createResponse(status, {
          success: false,
          message: "Internal detail",
        }),
      ),
    );

    await expect(service.createProject(request)).rejects.toMatchObject({
      name: "ProjectsServiceError",
      message,
      status,
    });
  });

  it("maps network failures to a safe error", async () => {
    const service = new HttpProjectsService(
      jest.fn().mockRejectedValue(new Error("network detail")),
    );

    await expect(service.createProject(request)).rejects.toEqual(
      new ProjectsServiceError(
        "No fue posible conectar con el servicio de proyectos.",
      ),
    );
  });

  it("rejects an invalid successful response", async () => {
    const service = new HttpProjectsService(
      jest.fn().mockResolvedValue(
        createResponse(201, {
          success: true,
          data: {},
        }),
      ),
    );

    await expect(service.createProject(request)).rejects.toMatchObject({
      message:
        "El servicio de proyectos devolvió una respuesta inválida.",
      status: 201,
    });
  });
});
