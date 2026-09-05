import type {
  AuthSession,
  LoginApiResponse,
  LoginCredentials,
} from "@/modules/auth/types";

export type AuthErrorCode =
  | "BAD_REQUEST"
  | "INVALID_CREDENTIALS"
  | "SERVER_ERROR"
  | "NETWORK_ERROR"
  | "INVALID_RESPONSE";

export class AuthServiceError extends Error {
  constructor(
    message: string,
    public readonly code: AuthErrorCode,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AuthServiceError";
  }
}

export interface AuthService {
  login(credentials: LoginCredentials): Promise<AuthSession>;
}

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isLoginApiResponse(value: unknown): value is LoginApiResponse {
  if (!isRecord(value) || typeof value.success !== "boolean") return false;

  if (value.success) {
    return (
      isRecord(value.user) &&
      typeof value.user.username === "string" &&
      typeof value.user.displayName === "string"
    );
  }

  return typeof value.message === "string";
}

async function parseResponse(response: Response): Promise<LoginApiResponse> {
  let body: unknown;

  try {
    body = await response.json();
  } catch {
    throw new AuthServiceError(
      "Recibimos una respuesta inválida del servidor.",
      "INVALID_RESPONSE",
      response.status,
    );
  }

  if (!isLoginApiResponse(body)) {
    throw new AuthServiceError(
      "Recibimos una respuesta inválida del servidor.",
      "INVALID_RESPONSE",
      response.status,
    );
  }

  return body;
}

function createHttpError(response: Response, body: LoginApiResponse): AuthServiceError {
  if (response.status === 401) {
    return new AuthServiceError("Usuario o contraseña incorrectos.", "INVALID_CREDENTIALS", 401);
  }

  if (response.status === 400) {
    return new AuthServiceError(body.success ? "Solicitud inválida." : body.message, "BAD_REQUEST", 400);
  }

  return new AuthServiceError(
    "No pudimos iniciar sesión. Intentá nuevamente.",
    "SERVER_ERROR",
    response.status,
  );
}

export class HttpAuthService implements AuthService {
  constructor(
    private readonly endpoint = "/api/auth/login",
    private readonly fetcher?: Fetcher,
  ) {}

  async login(credentials: LoginCredentials): Promise<AuthSession> {
    let response: Response;

    try {
      const fetcher = this.fetcher ?? globalThis.fetch.bind(globalThis);
      response = await fetcher(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
      });
    } catch (error) {
      if (error instanceof AuthServiceError) throw error;

      throw new AuthServiceError(
        "No pudimos conectar con el servidor. Revisá tu conexión e intentá nuevamente.",
        "NETWORK_ERROR",
      );
    }

    const body = await parseResponse(response);

    if (!response.ok || !body.success) {
      throw createHttpError(response, body);
    }

    return body.user;
  }
}

export const authService = new HttpAuthService();
