import { isSessionUser } from "@/modules/session";
import {
  RegistrationServiceError,
  type RegistrationService,
} from "../application";
import type {
  PendingRegistration,
  RegisteredUser,
  RegistrationApiResponse,
  RegistrationErrorCode,
  RegistrationErrors,
  RegistrationFormData,
  RegistrationStatus,
  SendVerificationCodeRequest,
  UsernameAvailability,
  VerificationChallenge,
  VerifyRegistrationRequest,
} from "../domain";

const ERROR_CODES = new Set<RegistrationErrorCode>([
  "USERNAME_ALREADY_EXISTS",
  "INVALID_REGISTRATION_DATA",
  "REGISTRATION_NOT_FOUND",
  "VERIFICATION_CODE_INVALID",
  "VERIFICATION_CODE_EXPIRED",
  "VERIFICATION_ATTEMPTS_EXCEEDED",
  "RESEND_TOO_SOON",
  "SERVER_ERROR",
  "NETWORK_ERROR",
  "INVALID_RESPONSE",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isContacts(value: unknown): boolean {
  return isRecord(value) && isString(value.emailMasked) && isString(value.phoneMasked);
}

function isAvailability(value: unknown): value is UsernameAvailability {
  return isRecord(value) && isString(value.username) && typeof value.available === "boolean";
}

function isPending(value: unknown): value is PendingRegistration {
  return isRecord(value) && isString(value.registrationId) && value.status === "PENDING_VERIFICATION" && isContacts(value.contacts);
}

function isStatus(value: unknown): value is RegistrationStatus {
  if (!isRecord(value)) return false;
  if (value.stage === "DETAILS") return true;
  return (
    value.stage === "VERIFICATION" &&
    isString(value.registrationId) &&
    isContacts(value.contacts) &&
    (value.selectedChannel === undefined || value.selectedChannel === "EMAIL" || value.selectedChannel === "SMS") &&
    isNonNegativeNumber(value.resendAvailableInSeconds) &&
    isNonNegativeNumber(value.codeExpiresInSeconds)
  );
}

function isChallenge(value: unknown): value is VerificationChallenge {
  return (
    isRecord(value) &&
    (value.channel === "EMAIL" || value.channel === "SMS") &&
    isString(value.maskedDestination) &&
    isNonNegativeNumber(value.expiresInSeconds) &&
    isNonNegativeNumber(value.resendAvailableInSeconds) &&
    (value.debugCode === undefined || isString(value.debugCode))
  );
}

function isRegistered(value: unknown): value is RegisteredUser {
  return isRecord(value) && isSessionUser(value.user);
}

function isErrors(value: unknown): value is RegistrationErrors {
  return isRecord(value) && Object.values(value).every((entry) => typeof entry === "string");
}

function isErrorCode(value: unknown): value is RegistrationErrorCode {
  return typeof value === "string" && ERROR_CODES.has(value as RegistrationErrorCode);
}

function readError(value: unknown, status: number): RegistrationServiceError | null {
  if (!isRecord(value) || value.success !== false || !isErrorCode(value.code) || !isString(value.message)) return null;
  const retryAfterSeconds = isNonNegativeNumber(value.retryAfterSeconds) ? value.retryAfterSeconds : undefined;
  return new RegistrationServiceError(
    value.message,
    value.code,
    status,
    retryAfterSeconds,
    isErrors(value.errors) ? value.errors : undefined,
  );
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new RegistrationServiceError(
      "El servidor devolvió una respuesta no válida.",
      "INVALID_RESPONSE",
      response.status,
    );
  }
}

export class HttpRegistrationService implements RegistrationService {
  constructor(private readonly fetcher: typeof fetch = globalThis.fetch) {}

  private async request<T>(
    path: string,
    init: RequestInit,
    guard: (value: unknown) => value is T,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(path, {
        ...init,
        credentials: "same-origin",
        headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
      });
    } catch {
      throw new RegistrationServiceError(
        "No fue posible conectar con el servidor.",
        "NETWORK_ERROR",
      );
    }

    const body = await parseJson(response);
    if (!response.ok) {
      const error = readError(body, response.status);
      if (error) throw error;
      throw new RegistrationServiceError(
        "El servidor devolvió una respuesta no válida.",
        "INVALID_RESPONSE",
        response.status,
      );
    }

    if (!isRecord(body) || body.success !== true || !guard(body.data)) {
      throw new RegistrationServiceError(
        "El servidor devolvió una respuesta no válida.",
        "INVALID_RESPONSE",
        response.status,
      );
    }
    return body.data;
  }

  checkUsername(username: string): Promise<UsernameAvailability> {
    return this.request(
      "/api/auth/register/check-username",
      { method: "POST", body: JSON.stringify({ username }) },
      isAvailability,
    );
  }

  startRegistration(request: RegistrationFormData): Promise<PendingRegistration> {
    return this.request(
      "/api/auth/register/start",
      { method: "POST", body: JSON.stringify(request) },
      isPending,
    );
  }

  getStatus(): Promise<RegistrationStatus> {
    return this.request("/api/auth/register/status", { method: "GET" }, isStatus);
  }

  sendVerificationCode(request: SendVerificationCodeRequest): Promise<VerificationChallenge> {
    return this.request(
      "/api/auth/register/send-code",
      { method: "POST", body: JSON.stringify(request) },
      isChallenge,
    );
  }

  verifyCode(request: VerifyRegistrationRequest): Promise<RegisteredUser> {
    return this.request(
      "/api/auth/register/verify",
      { method: "POST", body: JSON.stringify(request) },
      isRegistered,
    );
  }

  async cancel(): Promise<void> {
    await this.request(
      "/api/auth/register/cancel",
      { method: "POST" },
      (value): value is undefined => value === undefined,
    );
  }
}

export const registrationService = new HttpRegistrationService();

export type { RegistrationApiResponse };

