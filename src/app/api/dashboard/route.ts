import { NextResponse } from "next/server";

import { findMockSessionByUserId } from "@/modules/auth/server";
import type { DashboardData } from "@/modules/dashboard";
import { loadDashboard } from "@/modules/dashboard/server";

interface DashboardSuccessResponse {
  success: true;
  data: DashboardData;
}

interface DashboardErrorResponse {
  success: false;
  message: string;
}

export async function GET(
  request: Request,
): Promise<NextResponse> {
  const userId = new URL(request.url).searchParams
    .get("userId")
    ?.trim();

  if (!userId) {
    return NextResponse.json<DashboardErrorResponse>(
      {
        success: false,
        message: "No fue posible identificar al usuario.",
      },
      { status: 400 },
    );
  }

  const session = findMockSessionByUserId(userId);

  if (!session) {
    return NextResponse.json<DashboardErrorResponse>(
      {
        success: false,
        message: "No fue posible identificar al usuario.",
      },
      { status: 401 },
    );
  }

  const dashboard = await loadDashboard(session.user.id);

  return NextResponse.json<DashboardSuccessResponse>({
    success: true,
    data: dashboard,
  });
}
