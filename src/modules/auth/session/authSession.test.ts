import { clearSession, getSession, setSession } from "./authSession";

describe("auth session helpers", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("stores and retrieves only the minimal session", () => {
    setSession({ username: "admin", displayName: "Administrador" });

    const rawSession = window.sessionStorage.getItem("aircraft.auth.session");

    expect(rawSession).not.toContain("password");
    expect(getSession()).toEqual({
      username: "admin",
      displayName: "Administrador",
    });
  });

  it("clears the current session", () => {
    setSession({ username: "admin", displayName: "Administrador" });
    clearSession();

    expect(getSession()).toBeNull();
  });

  it("ignores incomplete stored values", () => {
    window.sessionStorage.setItem("aircraft.auth.session", JSON.stringify({ username: "admin" }));

    expect(getSession()).toBeNull();
  });

  it("ignores invalid serialized sessions", () => {
    window.sessionStorage.setItem("aircraft.auth.session", "{invalid-json");

    expect(getSession()).toBeNull();
  });
});
