import "server-only";

import type {
  CreateProjectRequest,
  Project,
  ProjectRepository,
} from "@/modules/projects";

const ADMIN_USER_ID = "usr-admin-001";

const PROJECT_FIXTURES: readonly Project[] = Object.freeze([
  Object.freeze({
    id: "project-ecommerce",
    name: "Mi App E-Commerce",
    description: "App de compras multiplataforma",
    status: "ACTIVE",
    screensCount: 3,
    updatedAt: "2026-09-05T10:24:00.000Z",
    icon: "SHOPPING_CART",
    accent: "BLUE",
    ownerId: ADMIN_USER_ID,
  }),
  Object.freeze({
    id: "project-onboarding",
    name: "Prototipo Onboarding",
    description: "Flujo de registro y bienvenida",
    status: "DRAFT",
    screensCount: 5,
    updatedAt: "2026-09-03T14:30:00.000Z",
    icon: "USERS",
    accent: "PURPLE",
    ownerId: "usr-developer-001",
  }),
  Object.freeze({
    id: "project-wallet",
    name: "Wallet Mobile",
    description: "Billetera digital y pagos",
    status: "IN_REVIEW",
    screensCount: 8,
    updatedAt: "2026-09-01T09:15:00.000Z",
    icon: "WALLET",
    accent: "GREEN",
    ownerId: "usr-developer-001",
  }),
  Object.freeze({
    id: "project-delivery",
    name: "App Delivery",
    description: "Pedidos y seguimiento en tiempo real",
    status: "ACTIVE",
    screensCount: 6,
    updatedAt: "2026-09-04T16:45:00.000Z",
    icon: "TRUCK",
    accent: "ORANGE",
    ownerId: "usr-developer-001",
  }),
  Object.freeze({
    id: "project-sales",
    name: "Portal Ventas",
    description: "Panel de gestión comercial",
    status: "PUBLISHED",
    screensCount: 4,
    updatedAt: "2026-09-02T11:00:00.000Z",
    icon: "CHART",
    accent: "PINK",
    ownerId: ADMIN_USER_ID,
  }),
]);

const cloneProject = (project: Project): Project => ({ ...project });

export const createMockProjectRepository = (
  seed: readonly Project[] = PROJECT_FIXTURES,
): ProjectRepository => {
  const projects = seed.map(cloneProject);
  let nextProjectNumber = projects.length + 1;

  return {
    async getProjects(userId: string): Promise<Project[]> {
      const visibleProjects =
        userId === ADMIN_USER_ID
          ? projects
          : projects.filter((project) => project.ownerId === userId);

      return visibleProjects.map(cloneProject);
    },

    async createProject(
      request: CreateProjectRequest,
    ): Promise<Project> {
      const project: Project = {
        id: `project-${nextProjectNumber}`,
        name: request.name,
        description: request.description ?? "",
        status: "DRAFT",
        screensCount: 0,
        updatedAt: new Date().toISOString(),
        icon: "LAYOUT",
        accent: "BLUE",
        ownerId: request.userId,
      };

      nextProjectNumber += 1;
      projects.push(project);

      return cloneProject(project);
    },
  };
};

export const mockProjectRepository = createMockProjectRepository();
