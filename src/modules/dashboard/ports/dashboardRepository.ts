import type { DashboardData } from "../domain/dashboard";

export interface DashboardRepository {
  getDashboard(userId: string): Promise<DashboardData>;
}
