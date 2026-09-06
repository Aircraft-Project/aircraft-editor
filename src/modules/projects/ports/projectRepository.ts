import type {
  CreateProjectRequest,
  Project,
} from "../domain/project";

export interface ProjectRepository {
  getProjects(userId: string): Promise<Project[]>;
  createProject(request: CreateProjectRequest): Promise<Project>;
}
