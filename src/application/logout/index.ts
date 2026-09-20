"use client";

import { resetDashboardState } from "@/modules/dashboard/client/state";
import { flushActiveProjectWrites } from "@/modules/local-project";
import { resetProjectsState } from "@/modules/projects/client/state";
import { clearSession } from "@/modules/session";

function clearUserState(): void {
  clearSession();
  resetProjectsState();
  resetDashboardState();
}

export function logout(): void | Promise<void> {
  const pendingFlush = flushActiveProjectWrites();
  if (!pendingFlush) {
    clearUserState();
    return;
  }

  return pendingFlush.then(() => {
    clearUserState();
  });
}
