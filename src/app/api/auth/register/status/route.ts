import { type NextRequest, type NextResponse } from "next/server";

import { getRegistrationStatus } from "@/modules/registration/server";
import {
  clearPendingRegistrationCookie,
  getPendingRegistrationId,
  registrationResponse,
} from "../_shared";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const result = getRegistrationStatus(getPendingRegistrationId(request));
  const response = registrationResponse(result);
  if (result.ok && result.data.stage === "DETAILS") {
    clearPendingRegistrationCookie(response);
  }
  return response;
}
