import {
  isProject,
  type CreateProjectRequest,
  type Project,
} from "@/modules/projects";

export interface ProjectsService {
  createProject(request: CreateProjectRequest): Promise<Project>;
}

export class ProjectsServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProjectsServiceError";
  }
}

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSuccessfulResponse = (
  value: unknown,
): value is {
  success: true;
  data: {
    project: Project;
  };
} =>
  isRecord(value) &&
  value.success === true &&
  isRecord(value.data) &&
  isProject(value.data.project);

const getErrorMessage = (status: number): string => {
  if (status === 400) {
    return "Los datos del proyecto no son válidos.";
  }

  if (status === 403) {
    return "No tienes permiso para crear proyectos.";
  }

  return "No fue posible crear el proyecto.";
};

export class HttpProjectsService implements ProjectsService {
  constructor(private readonly fetcher?: Fetcher) {}

  async createProject(
    request: CreateProjectRequest,
  ): Promise<Project> {
    let response: Response;

    try {
      const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
      response = await fetcher("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: request.name,
          description: request.description,
          userId: request.userId,
        }),
      });
    } catch {
      throw new ProjectsServiceError(
        "No fue posible conectar con el servicio de proyectos.",
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new ProjectsServiceError(
        response.ok
          ? "El servicio de proyectos devolvió una respuesta inválida."
          : getErrorMessage(response.status),
        response.status,
      );
    }

    if (!response.ok) {
      throw new ProjectsServiceError(
        getErrorMessage(response.status),
        response.status,
      );
    }

    if (!isSuccessfulResponse(payload)) {
      throw new ProjectsServiceError(
        "El servicio de proyectos devolvió una respuesta inválida.",
        response.status,
      );
    }

    return payload.data.project;
  }
}

export const httpProjectsService = new HttpProjectsService();
