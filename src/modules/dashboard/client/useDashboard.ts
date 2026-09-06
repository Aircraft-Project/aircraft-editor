"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";

import {
  calculateProjectSummary,
  canCreateProject as roleCanCreateProject,
  filterProjects,
  validateCreateProject,
  type CreateProjectErrors,
  type CreateProjectValues,
  type Project,
} from "@/modules/projects";
import {
  httpProjectsService,
  useProjectsStore,
  type ProjectsService,
} from "@/modules/projects/client";
import {
  getSession,
  type AuthSession,
} from "@/modules/session";

import type { DashboardService } from "../ports/dashboardService";
import { httpDashboardService } from "../infrastructure/httpDashboardService";
import { useDashboardStore } from "./useDashboardStore";

const doNothing = (): void => undefined;

export interface UseDashboardOptions {
  dashboardService?: DashboardService;
  projectsService?: ProjectsService;
  getCurrentSession?: () => AuthSession | null;
  onMissingSession?: () => void;
  autoLoad?: boolean;
}

export type CreateProjectActionResult =
  | {
      success: true;
      project: Project;
    }
  | {
      success: false;
      errors: CreateProjectErrors;
      message?: string;
    };

export const useDashboard = ({
  dashboardService = httpDashboardService,
  projectsService = httpProjectsService,
  getCurrentSession = getSession,
  onMissingSession = doNothing,
  autoLoad = true,
}: UseDashboardOptions = {}) => {
  const summary = useDashboardStore((state) => state.summary);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);
  const startLoading = useDashboardStore(
    (state) => state.startLoading,
  );
  const setSuccess = useDashboardStore((state) => state.setSuccess);
  const setError = useDashboardStore((state) => state.setError);
  const updateSummary = useDashboardStore(
    (state) => state.updateSummary,
  );
  const resetDashboard = useDashboardStore((state) => state.reset);

  const projects = useProjectsStore((state) => state.projects);
  const searchQuery = useProjectsStore((state) => state.searchQuery);
  const setProjects = useProjectsStore((state) => state.setProjects);
  const addProject = useProjectsStore((state) => state.addProject);
  const setSearchQuery = useProjectsStore(
    (state) => state.setSearchQuery,
  );
  const clearProjects = useProjectsStore((state) => state.clear);

  const activeLoad = useRef<Promise<void> | null>(null);
  const session = getCurrentSession();

  const filteredProjects = useMemo(
    () => filterProjects(projects, searchQuery),
    [projects, searchQuery],
  );

  const load = useCallback((): Promise<void> => {
    if (activeLoad.current) {
      return activeLoad.current;
    }

    const loadPromise = (async (): Promise<void> => {
      const currentSession = getCurrentSession();

      if (!currentSession) {
        clearProjects();
        resetDashboard();
        onMissingSession();
        return;
      }

      startLoading();

      const isCurrentSession = (): boolean =>
        getCurrentSession()?.user.id === currentSession.user.id;

      try {
        const data = await dashboardService.getDashboard(
          currentSession.user.id,
        );

        if (!isCurrentSession()) {
          return;
        }

        setProjects(data.projects);
        setSuccess(data.summary);
      } catch {
        if (isCurrentSession()) {
          setError("No fue posible cargar tus proyectos.");
        }
      }
    })();

    activeLoad.current = loadPromise;
    void loadPromise.finally(() => {
      if (activeLoad.current === loadPromise) {
        activeLoad.current = null;
      }
    });

    return loadPromise;
  }, [
    clearProjects,
    dashboardService,
    getCurrentSession,
    onMissingSession,
    resetDashboard,
    setError,
    setProjects,
    setSuccess,
    startLoading,
  ]);

  const createProject = useCallback(
    async (
      values: CreateProjectValues,
    ): Promise<CreateProjectActionResult> => {
      const validation = validateCreateProject(values);

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
        };
      }

      const currentSession = getCurrentSession();

      if (!currentSession) {
        onMissingSession();
        return {
          success: false,
          errors: {},
          message: "La sesión ha finalizado.",
        };
      }

      if (!roleCanCreateProject(currentSession.user.role)) {
        return {
          success: false,
          errors: {},
          message: "No tienes permiso para crear proyectos.",
        };
      }

      try {
        const project = await projectsService.createProject({
          ...validation.values,
          userId: currentSession.user.id,
        });
        const currentProjects =
          useProjectsStore.getState().projects;
        const nextProjects = [project, ...currentProjects];

        addProject(project);
        updateSummary(calculateProjectSummary(nextProjects));

        return {
          success: true,
          project,
        };
      } catch {
        return {
          success: false,
          errors: {},
          message: "No fue posible crear el proyecto.",
        };
      }
    },
    [
      addProject,
      getCurrentSession,
      onMissingSession,
      projectsService,
      updateSummary,
    ],
  );

  useEffect(() => {
    if (autoLoad) {
      void load();
    }
  }, [autoLoad, load]);

  return {
    summary,
    status,
    error,
    projects,
    filteredProjects,
    searchQuery,
    canCreateProject:
      session !== null &&
      roleCanCreateProject(session.user.role),
    loadDashboard: load,
    createProject,
    setSearchQuery,
    clearSearch: () => setSearchQuery(""),
  };
};
