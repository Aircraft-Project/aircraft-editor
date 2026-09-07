import { type NextRequest, type NextResponse } from "next/server";

import { cancelRegistration } from "@/modules/registration/server";
import {
  clearPendingRegistrationCookie,
  getPendingRegistrationId,
  registrationResponse,
} from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = cancelRegistration(getPendingRegistrationId(request));
  const response = registrationResponse(result);
  clearPendingRegistrationCookie(response);
  return response;
}
