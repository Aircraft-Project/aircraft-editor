import type { Project } from "@/modules/projects";

import { useProjectsStore } from "./useProjectsStore";

const project: Project = {
  id: "project-one",
  name: "Project one",
  description: "Description",
  status: "ACTIVE",
  screensCount: 1,
  updatedAt: "2026-09-05T10:00:00.000Z",
  icon: "LAYOUT",
  accent: "BLUE",
  ownerId: "user-one",
};

describe("useProjectsStore", () => {
  beforeEach(() => {
    useProjectsStore.getState().clear();
  });

  it("sets projects without storing derived results", () => {
    useProjectsStore.getState().setProjects([project]);

    expect(useProjectsStore.getState()).toMatchObject({
      projects: [project],
      searchQuery: "",
    });
  });

  it("adds a new project at the beginning", () => {
    const secondProject: Project = {
      ...project,
      id: "project-two",
      name: "Project two",
    };

    useProjectsStore.getState().setProjects([project]);
    useProjectsStore.getState().addProject(secondProject);

    expect(useProjectsStore.getState().projects).toEqual([
      secondProject,
      project,
    ]);
  });

  it("updates search and clears all project state", () => {
    useProjectsStore.getState().setProjects([project]);
    useProjectsStore.getState().setSearchQuery("project");

    expect(useProjectsStore.getState().searchQuery).toBe("project");

    useProjectsStore.getState().clear();

    expect(useProjectsStore.getState()).toMatchObject({
      projects: [],
      searchQuery: "",
    });
  });
});
