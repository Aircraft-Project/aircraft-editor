import type { UserRole } from "@/modules/session";

import type { Project } from "./project";

export const canCreateProject = (role: UserRole): boolean =>
  role === "ADMIN" || role === "DEVELOPER";

export const canViewProject = (
  role: UserRole,
  userId: string,
  project: Project,
): boolean => role === "ADMIN" || project.ownerId === userId;

export const canEditProject = (
  role: UserRole,
  userId: string,
  project: Project,
): boolean => canViewProject(role, userId, project);
