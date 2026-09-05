import type { AuthSession } from "@/modules/auth/types";

const AUTH_SESSION_KEY = "aircraft.auth.session";

function isAuthSession(value: unknown): value is AuthSession {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.username === "string" && typeof candidate.displayName === "string";
}

function getSessionStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

export function getSession(): AuthSession | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const serializedSession = storage.getItem(AUTH_SESSION_KEY);
  if (!serializedSession) return null;

  try {
    const parsedSession: unknown = JSON.parse(serializedSession);
    return isAuthSession(parsedSession) ? parsedSession : null;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession): void {
  getSessionStorage()?.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  getSessionStorage()?.removeItem(AUTH_SESSION_KEY);
}
