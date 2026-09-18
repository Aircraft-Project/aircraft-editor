"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";

import { logout } from "@/application/logout";

import type { DashboardService } from "@/modules/dashboard";
import {
  DashboardStatCard,
  useDashboard,
} from "@/modules/dashboard/client";
import type { ProjectsService } from "@/modules/projects/client";
import {
  CreateProjectModal,
  NewProjectCard,
  ProjectCard,
} from "@/modules/projects/client";
import {
  getSession,
  ROLE_LABELS,
  type AuthSession,
} from "@/modules/session";
import {
  AircraftLoadingOverlay,
  AppHeader,
  AppShell,
  AppSidebar,
} from "@/shared/ui";

import styles from "./DashboardView.module.css";

export interface DashboardViewProps {
  dashboardService?: DashboardService;
  projectsService?: ProjectsService;
  getCurrentSession?: () => AuthSession | null;
  autoLoad?: boolean;
  logoutAction?: () => void | Promise<void>;
}

export function DashboardView({
  dashboardService,
  projectsService,
  getCurrentSession = getSession,
  autoLoad = true,
  logoutAction = logout,
}: DashboardViewProps) {
  const router = useRouter();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isNavigating, startNavigation] = useTransition();
  const logoutInProgress = useRef(false);
  const session = getCurrentSession();
  const redirectToLogin = useCallback(
    (): void => router.replace("/"),
    [router],
  );
  const handleLogout = useCallback(async (): Promise<void> => {
    if (logoutInProgress.current) return;

    logoutInProgress.current = true;
    flushSync(() => setIsLoggingOut(true));

    try {
      await logoutAction();
      startNavigation(() => router.replace("/"));
      setIsLoggingOut(false);
    } catch {
      logoutInProgress.current = false;
      setIsLoggingOut(false);
    }
  }, [logoutAction, router, startNavigation]);

  const {
    summary,
    status,
    error,
    projects,
    filteredProjects,
    searchQuery,
    canCreateProject,
    loadDashboard,
    createProject,
    setSearchQuery,
    clearSearch,
  } = useDashboard({
    dashboardService,
    projectsService,
    getCurrentSession,
    onMissingSession: redirectToLogin,
    autoLoad,
  });

  const openProject = (projectId: string): void => {
    router.push("/editor?projectId=" + encodeURIComponent(projectId));
  };

  const statSummary = summary ?? {
    totalProjects: 0,
    editingProjects: 0,
    publishedProjects: 0,
  };

  const renderProjectContent = () => {
    if (status === "idle" || status === "loading") {
      return (
        <section
          className={styles.skeletonGrid}
          role="status"
          aria-label="Cargando proyectos"
        >
          <span className={styles.srOnly}>Cargando proyectos...</span>
          {Array.from({ length: 6 }, (_, index) => (
            <span className={styles.skeleton} key={index} />
          ))}
        </section>
      );
    }

    if (status === "error") {
      return (
        <section className={styles.feedback} role="alert">
          <p>{error ?? "No fue posible cargar tus proyectos."}</p>
          <button type="button" onClick={() => void loadDashboard()}>
            Reintentar
          </button>
        </section>
      );
    }

    if (projects.length === 0) {
      return (
        <section className={styles.emptyState}>
          <div className={styles.emptyCopy}>
            <h2>Aún no tienes proyectos.</h2>
            <p>Crea tu primer proyecto para comenzar.</p>
          </div>
          {canCreateProject ? (
            <NewProjectCard
              onClick={() => setIsCreateModalOpen(true)}
            />
          ) : null}
        </section>
      );
    }

    if (filteredProjects.length === 0) {
      return (
        <section className={styles.feedback}>
          <p>
            No encontramos proyectos que coincidan con tu búsqueda.
          </p>
          <button type="button" onClick={clearSearch}>
            Limpiar búsqueda
          </button>
        </section>
      );
    }

    return (
      <section
        className={styles.projectGrid}
        aria-label="Listado de proyectos"
      >
        {filteredProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            onOpen={({ id }) => openProject(id)}
            onEdit={({ id }) => openProject(id)}
          />
        ))}
        {canCreateProject ? (
          <NewProjectCard
            onClick={() => setIsCreateModalOpen(true)}
          />
        ) : null}
      </section>
    );
  };

  return (
    <>
      <AppShell
        header={
          <AppHeader
            displayName={session?.user.displayName ?? ""}
            roleLabel={
              session ? ROLE_LABELS[session.user.role] : ""
            }
            initials={session?.user.initials ?? ""}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onLogout={handleLogout}
          />
        }
        sidebar={<AppSidebar />}
      >
        <div className={styles.content}>
          <Image
            className={styles.brandDecoration}
            src="/assets/branding/aircraft-mark.svg"
            width={760}
            height={760}
            alt=""
            aria-hidden="true"
          />

          <header className={styles.heading}>
            <h1>Mis proyectos</h1>
            <p>Gestiona, edita y crear nuevos proyectos</p>
          </header>

          <section
            className={styles.statsGrid}
            aria-label="Resumen de proyectos"
          >
            <DashboardStatCard
              kind="TOTAL"
              value={statSummary.totalProjects}
              label="Total proyectos"
            />
            <DashboardStatCard
              kind="EDITING"
              value={statSummary.editingProjects}
              label="En edición"
            />
            <DashboardStatCard
              kind="PUBLISHED"
              value={statSummary.publishedProjects}
              label="Publicados"
            />
          </section>

          {renderProjectContent()}
        </div>
      </AppShell>

      <AircraftLoadingOverlay
        open={isLoggingOut || isNavigating}
        title="Cerrando sesión..."
        description="Cerrando tu sesión de forma segura."
      />

      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={createProject}
      />
    </>
  );
}
