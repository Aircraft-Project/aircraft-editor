import {
  resetDashboardState,
  useDashboardStore,
} from "@/modules/dashboard/client/state";
import type { Project } from "@/modules/projects";
import { registerActiveProjectFlush } from "@/modules/local-project";
import {
  resetProjectsState,
  useProjectsStore,
} from "@/modules/projects/client/state";
import {
  SESSION_STORAGE_KEY,
  clearSession,
  getSession,
  setSession,
  type AuthSession,
} from "@/modules/session";

import { logout } from "./index";

const session: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

const project: Project = {
  id: "project-wallet",
  name: "Wallet Mobile",
  description: "Billetera digital y pagos",
  status: "IN_REVIEW",
  screensCount: 8,
  updatedAt: "2026-09-05T10:24:00.000Z",
  icon: "WALLET",
  accent: "GREEN",
  ownerId: session.user.id,
};

describe("logout", () => {
  beforeEach(() => {
    clearSession();
    sessionStorage.removeItem("aircraft.unrelated");
    resetProjectsState();
    resetDashboardState();
  });

  it("clears only Aircraft session and resets user-scoped state", () => {
    setSession(session);
    sessionStorage.setItem("aircraft.unrelated", "preserve");
    useProjectsStore.setState({
      projects: [project],
      searchQuery: "wallet",
    });
    useDashboardStore.setState({
      summary: {
        totalProjects: 1,
        editingProjects: 1,
        publishedProjects: 0,
      },
      status: "success",
      error: "stale error",
    });

    logout();

    expect(getSession()).toBeNull();
    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
    expect(sessionStorage.getItem("aircraft.unrelated")).toBe(
      "preserve",
    );
    expect(useProjectsStore.getState()).toMatchObject({
      projects: [],
      searchQuery: "",
    });
    expect(useDashboardStore.getState()).toMatchObject({
      summary: null,
      status: "idle",
      error: null,
    });
  });

  it("waits for pending local writes before clearing the session", async () => {
    let resolveFlush: () => void = () => undefined;
    const flush = new Promise<void>((resolve) => {
      resolveFlush = resolve;
    });
    const unregister = registerActiveProjectFlush(() => flush);
    setSession(session);

    const result = logout();
    expect(result).toBeInstanceOf(Promise);
    expect(getSession()).toEqual(session);

    resolveFlush();
    await result;
    expect(getSession()).toBeNull();
    unregister();
  });

  it("keeps the session when local persistence flush fails", async () => {
    const unregister = registerActiveProjectFlush(() =>
      Promise.reject(new Error("disk full")),
    );
    setSession(session);

    await expect(logout()).rejects.toThrow("disk full");
    expect(getSession()).toEqual(session);
    unregister();
  });
});
