import { create } from "zustand";

import type { ProjectSummary } from "@/modules/projects";

export type DashboardStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

interface DashboardState {
  summary: ProjectSummary | null;
  status: DashboardStatus;
  error: string | null;
  startLoading: () => void;
  setSuccess: (summary: ProjectSummary) => void;
  setError: (message: string) => void;
  updateSummary: (summary: ProjectSummary) => void;
  reset: () => void;
}

const initialState: Pick<
  DashboardState,
  "summary" | "status" | "error"
> = {
  summary: null,
  status: "idle",
  error: null,
};

export const useDashboardStore = create<DashboardState>((set) => ({
  ...initialState,
  startLoading: () =>
    set({
      status: "loading",
      error: null,
    }),
  setSuccess: (summary) =>
    set({
      summary,
      status: "success",
      error: null,
    }),
  setError: (error) =>
    set({
      status: "error",
      error,
    }),
  updateSummary: (summary) => set({ summary }),
  reset: () => set(initialState),
}));

export function resetDashboardState(): void {
  useDashboardStore.getState().reset();
}