export {
  PROJECT_ACCENTS,
  PROJECT_ICON_TYPES,
  PROJECT_STATUSES,
  isProject,
  isProjectAccent,
  isProjectIconType,
  isProjectStatus,
} from "./domain/project";
export type {
  CreateProjectRequest,
  Project,
  ProjectAccent,
  ProjectIconType,
  ProjectStatus,
  ProjectSummary,
} from "./domain/project";
export { filterProjects } from "./domain/filterProjects";
export { calculateProjectSummary } from "./domain/calculateProjectSummary";
export { formatProjectUpdatedAt } from "./domain/formatProjectUpdatedAt";
export {
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_NAME_MAX_LENGTH,
  validateCreateProject,
} from "./domain/validateCreateProject";
export type {
  CreateProjectErrors,
  CreateProjectValidationResult,
  CreateProjectValues,
} from "./domain/validateCreateProject";
export {
  canCreateProject,
  canEditProject,
  canViewProject,
} from "./domain/projectPermissions";
export type { ProjectRepository } from "./ports/projectRepository";
