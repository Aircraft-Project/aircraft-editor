import { type NextRequest, type NextResponse } from "next/server";

import { verifyRegistrationCode } from "@/modules/registration/server";
import {
  clearPendingRegistrationCookie,
  getPendingRegistrationId,
  readJson,
  registrationResponse,
} from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = verifyRegistrationCode(
    getPendingRegistrationId(request),
    await readJson(request),
  );
  const response = registrationResponse(result);
  if (result.ok) clearPendingRegistrationCookie(response);
  return response;
}
