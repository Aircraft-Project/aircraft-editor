import type { Project, ProjectSummary } from "./project";

export const calculateProjectSummary = (
  projects: readonly Project[],
): ProjectSummary => ({
  totalProjects: projects.length,
  editingProjects: projects.filter(
    ({ status }) => status === "DRAFT" || status === "IN_REVIEW",
  ).length,
  publishedProjects: projects.filter(
    ({ status }) => status === "PUBLISHED",
  ).length,
});
