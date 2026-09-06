jest.mock("server-only", () => ({}));

import type {
  Project,
  ProjectRepository,
} from "@/modules/projects";

import { loadDashboard } from "./loadDashboard";

const projects: Project[] = [
  {
    id: "project-one",
    name: "Project one",
    description: "Description",
    status: "DRAFT",
    screensCount: 1,
    updatedAt: "2026-09-05T10:00:00.000Z",
    icon: "LAYOUT",
    accent: "BLUE",
    ownerId: "user-one",
  },
  {
    id: "project-two",
    name: "Project two",
    description: "Description",
    status: "PUBLISHED",
    screensCount: 2,
    updatedAt: "2026-09-05T11:00:00.000Z",
    icon: "CHART",
    accent: "PINK",
    ownerId: "user-one",
  },
];

describe("loadDashboard", () => {
  it("loads projects and derives the summary", async () => {
    const repository: ProjectRepository = {
      getProjects: jest.fn().mockResolvedValue(projects),
      createProject: jest.fn(),
    };

    await expect(
      loadDashboard("user-one", repository),
    ).resolves.toEqual({
      summary: {
        totalProjects: 2,
        editingProjects: 1,
        publishedProjects: 1,
      },
      projects,
    });
    expect(repository.getProjects).toHaveBeenCalledWith("user-one");
  });
});
