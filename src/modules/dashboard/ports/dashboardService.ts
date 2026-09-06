import type { DashboardData } from "../domain/dashboard";

export interface DashboardService {
  getDashboard(userId: string): Promise<DashboardData>;
}
