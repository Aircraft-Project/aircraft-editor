export {
  HttpProjectsService,
  ProjectsServiceError,
  httpProjectsService,
} from "../infrastructure/httpProjectsService";
export type { ProjectsService } from "../infrastructure/httpProjectsService";
export {
  resetProjectsState,
  useProjectsStore,
} from "./state";
export {
  CreateProjectModal,
  NewProjectCard,
  ProjectCard,
  PROJECT_ACCENT_CLASS,
  PROJECT_ICON_MAP,
  PROJECT_STATUS_CONFIG,
} from "../ui";
export type {
  CreateProjectModalProps,
  CreateProjectSubmissionResult,
  NewProjectCardProps,
  ProjectCardProps,
  ProjectStatusVisual,
} from "../ui";
