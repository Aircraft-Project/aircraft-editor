import "server-only";

import type { AuthSession, SessionUser } from "@/modules/session";
import type { LoginCredentials } from "../types";

type MockUserRecord = SessionUser & {
  password: string;
};

const MOCK_USERS: readonly MockUserRecord[] = [
  {
    id: "usr-admin-001",
    username: "admin",
    password: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
  {
    id: "usr-developer-001",
    username: "developer",
    password: "developer",
    displayName: "Desarrollador",
    initials: "DE",
    role: "DEVELOPER",
  },
];

function toSession(user: MockUserRecord): AuthSession {
  return {
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      initials: user.initials,
      role: user.role,
    },
  };
}

export function findMockSessionByUserId(userId: string): AuthSession | null {
  const user = MOCK_USERS.find(
    (candidate) => candidate.id === userId.trim(),
  );

  return user ? toSession(user) : null;
}
export function authenticateMockUser(credentials: LoginCredentials): AuthSession | null {
  const user = MOCK_USERS.find(
    (candidate) =>
      candidate.username === credentials.username &&
      candidate.password === credentials.password,
  );

  return user ? toSession(user) : null;
}
