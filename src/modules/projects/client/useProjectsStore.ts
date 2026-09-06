import { create } from "zustand";

import type { Project } from "@/modules/projects";

interface ProjectsState {
  projects: Project[];
  searchQuery: string;
  setProjects: (projects: Project[]) => void;
  addProject: (project: Project) => void;
  setSearchQuery: (query: string) => void;
  clear: () => void;
}

const initialState = {
  projects: [] as Project[],
  searchQuery: "",
};

export const useProjectsStore = create<ProjectsState>((set) => ({
  ...initialState,
  setProjects: (projects) =>
    set({
      projects: [...projects],
    }),
  addProject: (project) =>
    set((state) => ({
      projects: [project, ...state.projects],
    })),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  clear: () =>
    set({
      projects: [],
      searchQuery: "",
    }),
}));

export function resetProjectsState(): void {
  useProjectsStore.getState().clear();
}