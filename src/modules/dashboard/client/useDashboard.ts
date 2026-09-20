"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";

import {
  aircraftSchemaProvider,
  type SchemaProvider,
} from "@/modules/aircraft-schema";
import {
  getLocalProjectRepository,
  localSummaryToProject,
  type LocalProjectRepository,
} from "@/modules/local-project";
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
  useProjectsStore,
  type ProjectsService,
} from "@/modules/projects/client";
import { getSession, type AuthSession } from "@/modules/session";

import type { DashboardService } from "../ports/dashboardService";
import { httpDashboardService } from "../infrastructure/httpDashboardService";
import { useDashboardStore } from "./useDashboardStore";

const doNothing = (): void => undefined;

export interface UseDashboardOptions {
  dashboardService?: DashboardService;
  projectsService?: ProjectsService;
  localProjects?: LocalProjectRepository;
  schemaProvider?: SchemaProvider;
  getCurrentSession?: () => AuthSession | null;
  onMissingSession?: () => void;
  autoLoad?: boolean;
}

export type CreateProjectActionResult =
  | { success: true; project: Project }
  | {
      success: false;
      errors: CreateProjectErrors;
      message?: string;
    };

export const useDashboard = ({
  dashboardService = httpDashboardService,
  projectsService,
  localProjects = getLocalProjectRepository(),
  schemaProvider = aircraftSchemaProvider,
  getCurrentSession = getSession,
  onMissingSession = doNothing,
  autoLoad = true,
}: UseDashboardOptions = {}) => {
  const summary = useDashboardStore((state) => state.summary);
  const status = useDashboardStore((state) => state.status);
  const error = useDashboardStore((state) => state.error);
  const startLoading = useDashboardStore((state) => state.startLoading);
  const setSuccess = useDashboardStore((state) => state.setSuccess);
  const setError = useDashboardStore((state) => state.setError);
  const updateSummary = useDashboardStore((state) => state.updateSummary);
  const resetDashboard = useDashboardStore((state) => state.reset);

  const projects = useProjectsStore((state) => state.projects);
  const searchQuery = useProjectsStore((state) => state.searchQuery);
  const sourceFilter = useProjectsStore((state) => state.sourceFilter);
  const setProjects = useProjectsStore((state) => state.setProjects);
  const addProject = useProjectsStore((state) => state.addProject);
  const setSearchQuery = useProjectsStore((state) => state.setSearchQuery);
  const setSourceFilter = useProjectsStore(
    (state) => state.setSourceFilter,
  );
  const clearProjects = useProjectsStore((state) => state.clear);

  const activeLoad = useRef<Promise<void> | null>(null);
  const session = getCurrentSession();

  const filteredProjects = useMemo(() => {
    const searched = filterProjects(projects, searchQuery);
    if (sourceFilter === "ALL") return searched;
    return searched.filter(
      (project) => (project.source ?? "CLOUD") === sourceFilter,
    );
  }, [projects, searchQuery, sourceFilter]);

  const load = useCallback((): Promise<void> => {
    if (activeLoad.current) return activeLoad.current;

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
        const [cloudData, localSummaries] = await Promise.all([
          dashboardService.getDashboard(currentSession.user.id),
          localProjects.listByOwner(currentSession.user.id),
        ]);
        if (!isCurrentSession()) return;

        const cloudProjects = cloudData.projects.map((project) => ({
          ...project,
          source: "CLOUD" as const,
          syncState: "CLOUD_ONLY" as const,
        }));
        const localProjectItems = localSummaries.map(localSummaryToProject);
        const combined = [...localProjectItems, ...cloudProjects];
        setProjects(combined);
        setSuccess(calculateProjectSummary(combined));
      } catch {
        if (isCurrentSession()) {
          setError("No fue posible cargar tus proyectos.");
        }
      }
    })();

    activeLoad.current = loadPromise;
    void loadPromise.finally(() => {
      if (activeLoad.current === loadPromise) activeLoad.current = null;
    });
    return loadPromise;
  }, [
    clearProjects,
    dashboardService,
    getCurrentSession,
    localProjects,
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
        return { success: false, errors: validation.errors };
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
        let project: Project;
        if (projectsService) {
          project = {
            ...(await projectsService.createProject({
              ...validation.values,
              userId: currentSession.user.id,
            })),
            source: "CLOUD",
            syncState: "CLOUD_ONLY",
          };
        } else {
          const manifest = await schemaProvider.getManifest();
          const created = await localProjects.create({
            ownerId: currentSession.user.id,
            ...validation.values,
            schemaVersion: manifest.schemaVersion,
            ...(manifest.sourceRevision
              ? { schemaSourceRevision: manifest.sourceRevision }
              : {}),
          });
          project = localSummaryToProject({
            id: created.manifest.projectId,
            ownerId: created.manifest.ownerId,
            name: created.metadata.name,
            description: created.metadata.description,
            status: created.metadata.status,
            screensCount: created.screens.length,
            updatedAt: created.metadata.updatedAt,
            icon: created.metadata.icon,
            accent: created.metadata.accent,
            source: "LOCAL",
            syncState: "LOCAL_ONLY",
          });
        }

        const currentProjects = useProjectsStore.getState().projects;
        const nextProjects = [project, ...currentProjects];
        addProject(project);
        updateSummary(calculateProjectSummary(nextProjects));
        return { success: true, project };
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
      localProjects,
      onMissingSession,
      projectsService,
      schemaProvider,
      updateSummary,
    ],
  );

  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  return {
    summary,
    status,
    error,
    projects,
    filteredProjects,
    searchQuery,
    sourceFilter,
    canCreateProject:
      session !== null && roleCanCreateProject(session.user.role),
    loadDashboard: load,
    createProject,
    setSearchQuery,
    setSourceFilter,
    clearSearch: () => setSearchQuery(""),
  };
};
