import {
  calculateProjectSummary,
  type ProjectRepository,
} from "@/modules/projects";
import { mockProjectRepository } from "@/modules/projects/server";

import type { DashboardData } from "../domain/dashboard";

export const loadDashboard = async (
  userId: string,
  repository: ProjectRepository = mockProjectRepository,
): Promise<DashboardData> => {
  const projects = await repository.getProjects(userId);

  return {
    summary: calculateProjectSummary(projects),
    projects,
  };
};
