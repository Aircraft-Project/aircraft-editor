import {
  isDashboardData,
  type DashboardData,
  type DashboardService,
} from "@/modules/dashboard";

type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class DashboardServiceError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "DashboardServiceError";
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isSuccessfulResponse = (
  value: unknown,
): value is {
  success: true;
  data: DashboardData;
} =>
  isRecord(value) &&
  value.success === true &&
  isDashboardData(value.data);

const getHttpErrorMessage = (status: number): string =>
  status === 400
    ? "No fue posible identificar al usuario."
    : "No fue posible cargar tus proyectos.";

export class HttpDashboardService implements DashboardService {
  constructor(private readonly fetcher?: Fetcher) {}

  async getDashboard(userId: string): Promise<DashboardData> {
    let response: Response;

    try {
      const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
      response = await fetcher(
        `/api/dashboard?userId=${encodeURIComponent(userId)}`,
        {
          method: "GET",
        },
      );
    } catch {
      throw new DashboardServiceError(
        "No fue posible cargar tus proyectos.",
      );
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throw new DashboardServiceError(
        response.ok
          ? "El servicio del dashboard devolvió una respuesta inválida."
          : getHttpErrorMessage(response.status),
        response.status,
      );
    }

    if (!response.ok) {
      throw new DashboardServiceError(
        getHttpErrorMessage(response.status),
        response.status,
      );
    }

    if (!isSuccessfulResponse(payload)) {
      throw new DashboardServiceError(
        "El servicio del dashboard devolvió una respuesta inválida.",
        response.status,
      );
    }

    return payload.data;
  }
}

export const httpDashboardService = new HttpDashboardService();
