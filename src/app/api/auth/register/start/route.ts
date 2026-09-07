import { type NextRequest, type NextResponse } from "next/server";

import { startRegistration } from "@/modules/registration/server";
import {
  getPendingRegistrationId,
  readJson,
  registrationResponse,
  setPendingRegistrationCookie,
} from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const result = startRegistration(
    await readJson(request),
    getPendingRegistrationId(request),
  );
  const response = registrationResponse(result, 201);
  if (result.ok) setPendingRegistrationCookie(response, result.data.registrationId);
  return response;
}
