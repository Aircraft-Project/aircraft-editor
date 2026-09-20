import { act, renderHook } from "@testing-library/react";
import type { DashboardService } from "../ports/dashboardService";
import {
  InMemoryLocalProjectRepository,
} from "@/modules/local-project";
import type { Project } from "@/modules/projects";
import type { AuthSession } from "@/modules/session";
import { useDashboardStore } from "./useDashboardStore";
import { useProjectsStore } from "@/modules/projects/client/useProjectsStore";
import { useDashboard } from "./useDashboard";

const session: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

function cloudProject(id: string): Project {
  return {
    id,
    name: "Cloud project",
    description: "Remote project",
    status: "ACTIVE",
    screensCount: 2,
    updatedAt: "2026-09-19T10:00:00.000Z",
    icon: "LAYOUT",
    accent: "BLUE",
    ownerId: session.user.id,
  };
}

function dashboardService(projects: readonly Project[]): DashboardService {
  return {
    getDashboard: jest.fn().mockResolvedValue({
      projects,
      summary: {
        totalProjects: projects.length,
        editingProjects: projects.length,
        publishedProjects: 0,
      },
    }),
  };
}

describe("useDashboard local projects", () => {
  beforeEach(() => {
    useProjectsStore.getState().clear();
    useDashboardStore.getState().reset();
  });

  it("merges LOCAL and CLOUD without colliding equal project ids and filters by source", async () => {
    const localProjects = new InMemoryLocalProjectRepository();
    const local = await localProjects.create({
      ownerId: session.user.id,
      name: "Local project",
      schemaVersion: "snapshot-1",
    });
    const sharedId = local.manifest.projectId;
    const { result } = renderHook(() =>
      useDashboard({
        dashboardService: dashboardService([cloudProject(sharedId)]),
        localProjects,
        getCurrentSession: () => session,
        autoLoad: false,
      }),
    );

    await act(async () => result.current.loadDashboard());

    expect(result.current.projects).toHaveLength(2);
    expect(result.current.projects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: sharedId, source: "LOCAL" }),
        expect.objectContaining({ id: sharedId, source: "CLOUD" }),
      ]),
    );

    act(() => result.current.setSourceFilter("LOCAL"));
    expect(result.current.filteredProjects).toEqual([
      expect.objectContaining({ id: sharedId, source: "LOCAL" }),
    ]);

    act(() => result.current.setSourceFilter("CLOUD"));
    expect(result.current.filteredProjects).toEqual([
      expect.objectContaining({ id: sharedId, source: "CLOUD" }),
    ]);
  });

  it("creates new projects in the LOCAL repository when no cloud creator is injected", async () => {
    const localProjects = new InMemoryLocalProjectRepository();
    const { result } = renderHook(() =>
      useDashboard({
        dashboardService: dashboardService([]),
        localProjects,
        getCurrentSession: () => session,
        autoLoad: false,
      }),
    );

    let creation: Awaited<ReturnType<typeof result.current.createProject>> | undefined;
    await act(async () => {
      creation = await result.current.createProject({
        name: "Local Demo",
        description: "Created on this device",
      });
    });

    expect(creation).toEqual(
      expect.objectContaining({
        success: true,
        project: expect.objectContaining({
          name: "Local Demo",
          source: "LOCAL",
          syncState: "LOCAL_ONLY",
        }),
      }),
    );
    await expect(localProjects.listByOwner(session.user.id)).resolves.toEqual([
      expect.objectContaining({ name: "Local Demo", source: "LOCAL" }),
    ]);
  });
});
