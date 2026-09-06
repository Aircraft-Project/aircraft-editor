"use client";

import {
  resetDashboardState,
} from "@/modules/dashboard/client/state";
import {
  resetProjectsState,
} from "@/modules/projects/client/state";
import { clearSession } from "@/modules/session";

export function logout(): void {
  clearSession();
  resetProjectsState();
  resetDashboardState();
}
