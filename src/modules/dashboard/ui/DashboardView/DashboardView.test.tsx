import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import type {
  DashboardData,
  DashboardService,
} from "@/modules/dashboard";
import { useDashboardStore } from "@/modules/dashboard/client";
import type {
  Project,
  ProjectSummary,
} from "@/modules/projects";
import {
  useProjectsStore,
  type ProjectsService,
} from "@/modules/projects/client";
import {
  clearSession,
  getSession,
  setSession,
  type AuthSession,
} from "@/modules/session";

import { DashboardView } from "./DashboardView";

const mockPush = jest.fn();
const mockReplace = jest.fn();

const mockRouter = {
  push: mockPush,
  replace: mockReplace,
};

jest.mock("next/navigation", () => ({
  useRouter: () => mockRouter,
}));

const session: AuthSession = {
  user: {
    id: "usr-admin-001",
    username: "admin",
    displayName: "Administrador",
    initials: "AD",
    role: "ADMIN",
  },
};

const projects: Project[] = [
  {
    id: "project-wallet",
    name: "Wallet Mobile",
    description: "Billetera digital y pagos",
    status: "IN_REVIEW",
    screensCount: 8,
    updatedAt: "2026-09-05T10:24:00.000Z",
    icon: "WALLET",
    accent: "GREEN",
    ownerId: session.user.id,
  },
  {
    id: "project-sales",
    name: "Portal Ventas",
    description: "Panel de gestión comercial",
    status: "PUBLISHED",
    screensCount: 4,
    updatedAt: "2026-09-02T10:24:00.000Z",
    icon: "CHART",
    accent: "PINK",
    ownerId: session.user.id,
  },
];

const summary: ProjectSummary = {
  totalProjects: 2,
  editingProjects: 1,
  publishedProjects: 1,
};

const dashboard: DashboardData = {
  summary,
  projects,
};

const createDashboardService = (
  value: DashboardData = dashboard,
): DashboardService => ({
  getDashboard: jest.fn().mockResolvedValue(value),
});

const createProjectsService = (
  project: Project = {
    id: "project-new",
    name: "Nueva experiencia",
    description: "Proyecto creado",
    status: "DRAFT",
    screensCount: 0,
    updatedAt: "2026-09-05T12:00:00.000Z",
    icon: "LAYOUT",
    accent: "BLUE",
    ownerId: session.user.id,
  },
): ProjectsService => ({
  createProject: jest.fn().mockResolvedValue(project),
});

const renderDashboard = ({
  dashboardService = createDashboardService(),
  projectsService = createProjectsService(),
  currentSession = session,
}: {
  dashboardService?: DashboardService;
  projectsService?: ProjectsService;
  currentSession?: AuthSession | null;
} = {}) =>
  render(
    <DashboardView
      dashboardService={dashboardService}
      projectsService={projectsService}
      getCurrentSession={() => currentSession}
    />,
  );

describe("DashboardView", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockReplace.mockReset();
    clearSession();
    useProjectsStore.getState().clear();
    useDashboardStore.getState().reset();
  });

  it("renders the authenticated user, role, summary and projects", async () => {
    renderDashboard();

    expect(await screen.findAllByText("Administrador")).toHaveLength(2);
    expect(screen.getByText("Mis proyectos")).toBeInTheDocument();
    expect(screen.getByText("Wallet Mobile")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Total proyectos: 2"),
    ).toBeInTheDocument();
    expect(screen.getByText("Publicado")).toBeInTheDocument();
  });

  it("filters by name and description without case sensitivity", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Wallet Mobile");

    const search = screen.getByRole("searchbox", {
      name: "Buscar proyectos",
    });
    await user.type(search, "WALLET");

    expect(screen.getByText("Wallet Mobile")).toBeInTheDocument();
    expect(screen.queryByText("Portal Ventas")).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "GESTIÓN COMERCIAL");

    expect(screen.getByText("Portal Ventas")).toBeInTheDocument();
    expect(screen.queryByText("Wallet Mobile")).not.toBeInTheDocument();
  });

  it("shows no results and clears the search", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Wallet Mobile");

    await user.type(
      screen.getByRole("searchbox", {
        name: "Buscar proyectos",
      }),
      "sin coincidencias",
    );

    expect(
      screen.getByText(
        "No encontramos proyectos que coincidan con tu búsqueda.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Limpiar búsqueda",
      }),
    );

    expect(screen.getByText("Wallet Mobile")).toBeInTheDocument();
  });

  it("opens, validates and closes the creation modal with Escape", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Wallet Mobile");

    await user.click(
      screen.getByRole("button", { name: /Nuevo proyecto/i }),
    );
    expect(
      screen.getByRole("dialog", {
        name: "Crear nuevo proyecto",
      }),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Crear proyecto" }),
    );
    expect(
      await screen.findByText(
        "El nombre del proyecto es obligatorio.",
      ),
    ).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("adds a created project and recalculates summary without reload", async () => {
    const user = userEvent.setup();
    const dashboardService = createDashboardService();
    const projectsService = createProjectsService();
    const addProject = jest.fn(
      useProjectsStore.getState().addProject,
    );
    useProjectsStore.setState({ addProject });
    renderDashboard({ dashboardService, projectsService });
    await screen.findByText("Wallet Mobile");

    await user.click(
      screen.getByRole("button", { name: /Nuevo proyecto/i }),
    );
    await user.type(
      screen.getByLabelText("Nombre del proyecto *"),
      "Nueva experiencia",
    );
    await user.type(
      screen.getByLabelText("Descripción"),
      "Proyecto creado",
    );
    await user.click(
      screen.getByRole("button", { name: "Crear proyecto" }),
    );

    await waitFor(() => {
      expect(projectsService.createProject).toHaveBeenCalled();
    });
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      expect(
        useProjectsStore
          .getState()
          .projects.some(
            (project) => project.name === "Nueva experiencia",
          ),
      ).toBe(true);
    });
    expect(
      await screen.findByText("Nueva experiencia"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Total proyectos: 3"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("En edición: 2"),
    ).toBeInTheDocument();
    expect(projectsService.createProject).toHaveBeenCalledWith({
      name: "Nueva experiencia",
      description: "Proyecto creado",
      userId: session.user.id,
    });
  });

  it("routes open and edit actions with only the project id", async () => {
    const user = userEvent.setup();
    renderDashboard();
    await screen.findByText("Wallet Mobile");

    await user.click(
      screen.getAllByRole("button", { name: "Abrir" })[0],
    );
    expect(mockPush).toHaveBeenCalledWith(
      "/editor?projectId=project-wallet",
    );

    await user.click(
      screen.getByRole("button", {
        name: "Editar Wallet Mobile",
      }),
    );
    expect(mockPush).toHaveBeenLastCalledWith(
      "/editor?projectId=project-wallet",
    );
  });

  it("renders a loading skeleton", () => {
    const dashboardService: DashboardService = {
      getDashboard: jest.fn(
        () => new Promise<DashboardData>(() => undefined),
      ),
    };

    renderDashboard({ dashboardService });

    expect(
      screen.getByRole("status", {
        name: "Cargando proyectos",
      }),
    ).toBeInTheDocument();
  });

  it("renders a safe error and retries", async () => {
    const user = userEvent.setup();
    const getDashboard = jest
      .fn()
      .mockRejectedValueOnce(new Error("network detail"))
      .mockResolvedValueOnce(dashboard);
    const dashboardService: DashboardService = {
      getDashboard,
    };

    renderDashboard({ dashboardService });

    expect(
      await screen.findByText(
        "No fue posible cargar tus proyectos.",
      ),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: "Reintentar" }),
    );

    expect(await screen.findByText("Wallet Mobile")).toBeInTheDocument();
    expect(getDashboard).toHaveBeenCalledTimes(2);
  });

  it("renders the empty state and creation entry point", async () => {
    renderDashboard({
      dashboardService: createDashboardService({
        summary: {
          totalProjects: 0,
          editingProjects: 0,
          publishedProjects: 0,
        },
        projects: [],
      }),
    });

    expect(
      await screen.findByText("Aún no tienes proyectos."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Crea tu primer proyecto para comenzar."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Nuevo proyecto/i }),
    ).toBeInTheDocument();
  });

  it("clears the authenticated state and replaces the route on logout", async () => {
    const user = userEvent.setup();
    setSession(session);
    renderDashboard();
    await screen.findByText("Wallet Mobile");

    await user.click(
      screen.getByRole("button", {
        name: "Abrir menú de usuario de Administrador",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    );

    expect(getSession()).toBeNull();
    expect(useProjectsStore.getState().projects).toEqual([]);
    expect(useProjectsStore.getState().searchQuery).toBe("");
    expect(useDashboardStore.getState().summary).toBeNull();
    expect(useDashboardStore.getState().status).toBe("idle");
    expect(mockReplace).toHaveBeenCalledWith("/");
  });

  it("ignores a dashboard response that arrives after logout", async () => {
    const user = userEvent.setup();
    let resolveDashboard!: (value: DashboardData) => void;
    const dashboardService: DashboardService = {
      getDashboard: jest.fn(
        () =>
          new Promise<DashboardData>((resolve) => {
            resolveDashboard = resolve;
          }),
      ),
    };
    setSession(session);

    render(
      <DashboardView
        dashboardService={dashboardService}
        projectsService={createProjectsService()}
        getCurrentSession={getSession}
      />,
    );
    await waitFor(() => {
      expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1);
    });

    await user.click(
      screen.getByRole("button", {
        name: "Abrir menú de usuario de Administrador",
      }),
    );
    await user.click(
      screen.getByRole("menuitem", { name: "Cerrar sesión" }),
    );

    await act(async () => {
      resolveDashboard(dashboard);
      await Promise.resolve();
    });

    expect(getSession()).toBeNull();
    expect(useProjectsStore.getState().projects).toEqual([]);
    expect(useDashboardStore.getState().summary).toBeNull();
    expect(mockReplace).toHaveBeenCalledWith("/");
  });
  it("redirects to login when the session is missing", async () => {
    renderDashboard({ currentSession: null });

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/");
    });
  });
});
