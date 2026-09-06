import type { AuthSession } from "@/modules/session";
import type { LoginCredentials } from "../types";

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
