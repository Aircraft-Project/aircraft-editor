import { create } from "zustand";

import type { Project, ProjectSource } from "@/modules/projects";

export type ProjectSourceFilter = "ALL" | ProjectSource;

interface ProjectsState {
  projects: Project[];
  searchQuery: string;
  sourceFilter: ProjectSourceFilter;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  setSearchQuery: (query: string) => void;
  setSourceFilter: (filter: ProjectSourceFilter) => void;
  clear: () => void;
}

const initialState = {
  projects: [] as Project[],
  searchQuery: "",
  sourceFilter: "ALL" as ProjectSourceFilter,
};

export const useProjectsStore = create<ProjectsState>((set) => ({
  ...initialState,
  setProjects: (projects) => set({ projects: [...projects] }),
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSourceFilter: (sourceFilter) => set({ sourceFilter }),
  clear: () => set(initialState),
}));

export function resetProjectsState(): void {
  useProjectsStore.getState().clear();
}
