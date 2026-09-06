import { isAuthSession, type AuthSession, type SessionUser } from "../domain/session";

export const SESSION_STORAGE_KEY = "aircraft.auth.session";

function getSessionStorage(): Storage | null {
  return typeof window === "undefined" ? null : window.sessionStorage;
}

function sanitizeUser(user: SessionUser): SessionUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    initials: user.initials,
    role: user.role,
  };
}

export function getSession(): AuthSession | null {
  const storage = getSessionStorage();
  if (!storage) return null;

  const serializedSession = storage.getItem(SESSION_STORAGE_KEY);
  if (!serializedSession) return null;

  try {
    const parsedSession: unknown = JSON.parse(serializedSession);
    if (!isAuthSession(parsedSession)) {
      storage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }

    return { user: sanitizeUser(parsedSession.user) };
  } catch {
    storage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

export function setSession(session: AuthSession): void {
  const storage = getSessionStorage();
  if (!storage || !isAuthSession(session)) return;

  const safeSession: AuthSession = { user: sanitizeUser(session.user) };
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(safeSession));
}

export function clearSession(): void {
  getSessionStorage()?.removeItem(SESSION_STORAGE_KEY);
}

export function hasSession(): boolean {
  return getSession() !== null;
}
