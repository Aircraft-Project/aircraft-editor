export const USER_ROLES = ["ADMIN", "DEVELOPER"] as const;

export type UserRole = (typeof USER_ROLES)[number];

export const ROLE_LABELS: Readonly<Record<UserRole, string>> = {
  ADMIN: "Administrador",
  DEVELOPER: "Desarrollador",
};

export type SessionUser = {
  id: string;
  username: string;
  displayName: string;
  initials: string;
  role: UserRole;
};

export type AuthSession = {
  user: SessionUser;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === "string" && USER_ROLES.some((role) => role === value);
}

export function isSessionUser(value: unknown): value is SessionUser {
  if (!isRecord(value)) return false;

  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.username) &&
    isNonEmptyString(value.displayName) &&
    isNonEmptyString(value.initials) &&
    isUserRole(value.role)
  );
}

export function isAuthSession(value: unknown): value is AuthSession {
  return isRecord(value) && isSessionUser(value.user);
}
