import {
  isProject,
  type Project,
  type ProjectSummary,
} from "@/modules/projects";

export interface DashboardData {
  summary: ProjectSummary;
  projects: Project[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0;

export const isProjectSummary = (
  value: unknown,
): value is ProjectSummary =>
  isRecord(value) &&
  isNonNegativeInteger(value.totalProjects) &&
  isNonNegativeInteger(value.editingProjects) &&
  isNonNegativeInteger(value.publishedProjects);

export const isDashboardData = (
  value: unknown,
): value is DashboardData =>
  isRecord(value) &&
  isProjectSummary(value.summary) &&
  Array.isArray(value.projects) &&
  value.projects.every(isProject);
