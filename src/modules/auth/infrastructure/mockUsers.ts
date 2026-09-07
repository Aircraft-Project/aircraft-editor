import "server-only";

import {
  authenticateAccount,
  findAccountSessionById,
} from "@/modules/accounts/server";
import type { AuthSession } from "@/modules/session";
import type { LoginCredentials } from "../types";

export function findMockSessionByUserId(userId: string): AuthSession | null {
  return findAccountSessionById(userId);
}

export function authenticateMockUser(credentials: LoginCredentials): AuthSession | null {
  return authenticateAccount(credentials.username, credentials.password);
}
