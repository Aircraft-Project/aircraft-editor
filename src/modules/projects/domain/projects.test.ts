import { calculateProjectSummary } from "./calculateProjectSummary";
import { filterProjects } from "./filterProjects";
import { formatProjectUpdatedAt } from "./formatProjectUpdatedAt";
import type { Project } from "./project";
import {
  canCreateProject,
  canEditProject,
  canViewProject,
} from "./projectPermissions";
import { validateCreateProject } from "./validateCreateProject";

const projects: Project[] = [
  {
    id: "project-one",
    name: "Wallet Mobile",
    description: "Billetera digital y pagos",
    status: "IN_REVIEW",
    screensCount: 8,
    updatedAt: "2026-09-01T10:00:00.000Z",
    icon: "WALLET",
    accent: "GREEN",
    ownerId: "developer-id",
  },
  {
    id: "project-two",
    name: "Portal Ventas",
    description: "Panel de gestión comercial",
    status: "PUBLISHED",
    screensCount: 4,
    updatedAt: "2026-09-02T10:00:00.000Z",
    icon: "CHART",
    accent: "PINK",
    ownerId: "admin-id",
  },
  {
    id: "project-three",
    name: "Onboarding",
    description: "Registro inicial",
    status: "DRAFT",
    screensCount: 5,
    updatedAt: "2026-09-03T10:00:00.000Z",
    icon: "USERS",
    accent: "PURPLE",
    ownerId: "developer-id",
  },
];

describe("project domain", () => {
  it("filters by name or description without case sensitivity", () => {
    expect(filterProjects(projects, "  WALLET  ")).toEqual([projects[0]]);
    expect(filterProjects(projects, "GESTIÓN COMERCIAL")).toEqual([
      projects[1],
    ]);
    expect(filterProjects(projects, "")).toEqual(projects);
  });

  it("calculates summary values from project status", () => {
    expect(calculateProjectSummary(projects)).toEqual({
      totalProjects: 3,
      editingProjects: 2,
      publishedProjects: 1,
    });
  });

  it("validates and normalizes project input", () => {
    expect(validateCreateProject({ name: "   " })).toEqual({
      isValid: false,
      values: {
        name: "",
        description: undefined,
      },
      errors: {
        name: "El nombre del proyecto es obligatorio.",
      },
    });

    expect(
      validateCreateProject({
        name: "  Proyecto nuevo  ",
        description: "  Descripción  ",
      }),
    ).toEqual({
      isValid: true,
      values: {
        name: "Proyecto nuevo",
        description: "Descripción",
      },
      errors: {},
    });
  });

  it("rejects values over their maximum lengths", () => {
    const result = validateCreateProject({
      name: "a".repeat(81),
      description: "b".repeat(201),
    });

    expect(result.isValid).toBe(false);
    expect(result.errors.name).toBeDefined();
    expect(result.errors.description).toBeDefined();
  });

  it("centralizes project permissions", () => {
    expect(canCreateProject("ADMIN")).toBe(true);
    expect(canCreateProject("DEVELOPER")).toBe(true);
    expect(canViewProject("ADMIN", "admin-id", projects[0])).toBe(true);
    expect(
      canViewProject("DEVELOPER", "developer-id", projects[0]),
    ).toBe(true);
    expect(
      canViewProject("DEVELOPER", "developer-id", projects[1]),
    ).toBe(false);
    expect(
      canEditProject("DEVELOPER", "developer-id", projects[0]),
    ).toBe(true);
  });

  it("formats relative update dates deterministically", () => {
    const now = new Date(2026, 8, 5, 12, 0);
    const today = new Date(2026, 8, 5, 10, 24).toISOString();
    const yesterday = new Date(2026, 8, 4, 10, 24).toISOString();
    const threeDaysAgo = new Date(2026, 8, 2, 10, 24).toISOString();

    expect(formatProjectUpdatedAt(today, now)).toContain(
      "Editado: hoy, 10:24",
    );
    expect(formatProjectUpdatedAt(yesterday, now)).toBe("Editado: ayer");
    expect(formatProjectUpdatedAt(threeDaysAgo, now)).toBe(
      "Editado: hace 3 días",
    );
  });
});
