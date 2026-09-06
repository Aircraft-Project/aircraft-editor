import type { AuthSession } from "../domain/session";
import {
  clearSession,
  getSession,
  hasSession,
  SESSION_STORAGE_KEY,
  setSession,
} from "./sessionStorage";

const adminSession: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

describe("session storage", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("stores and reads a complete session", () => {
    setSession(adminSession);

    expect(getSession()).toEqual(adminSession);
    expect(hasSession()).toBe(true);
  });

  it("stores only supported identity fields", () => {
    setSession({
      user: { ...adminSession.user, password: "secret" },
    } as AuthSession);

    const serialized = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    expect(serialized).not.toContain("password");
    expect(serialized).not.toContain("secret");
  });

  it("rejects incomplete stored values", () => {
    window.sessionStorage.setItem(
      SESSION_STORAGE_KEY,
      JSON.stringify({ user: { username: "admin" } }),
    );

    expect(getSession()).toBeNull();
    expect(window.sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  });

  it("clears the current session", () => {
    setSession(adminSession);
    clearSession();

    expect(getSession()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});
