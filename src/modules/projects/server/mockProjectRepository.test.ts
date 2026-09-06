jest.mock("server-only", () => ({}));

import { createMockProjectRepository } from "./mockProjectRepository";

describe("mockProjectRepository", () => {
  it("returns every fixture for the administrator", async () => {
    const repository = createMockProjectRepository();

    const projects = await repository.getProjects("usr-admin-001");

    expect(projects).toHaveLength(5);
  });

  it("returns only owned projects for the developer", async () => {
    const repository = createMockProjectRepository();

    const projects = await repository.getProjects("usr-developer-001");

    expect(projects.map(({ name }) => name)).toEqual([
      "Prototipo Onboarding",
      "Wallet Mobile",
      "App Delivery",
    ]);
    expect(
      projects.every(
        ({ ownerId }) => ownerId === "usr-developer-001",
      ),
    ).toBe(true);
  });

  it("creates and persists a draft project", async () => {
    const repository = createMockProjectRepository();

    const project = await repository.createProject({
      name: "Nuevo proyecto",
      description: "Descripción",
      userId: "usr-developer-001",
    });
    const visibleProjects = await repository.getProjects(
      "usr-developer-001",
    );

    expect(project).toMatchObject({
      name: "Nuevo proyecto",
      description: "Descripción",
      status: "DRAFT",
      screensCount: 0,
      icon: "LAYOUT",
      accent: "BLUE",
      ownerId: "usr-developer-001",
    });
    expect(Number.isNaN(Date.parse(project.updatedAt))).toBe(false);
    expect(visibleProjects).toContainEqual(project);
  });
});
