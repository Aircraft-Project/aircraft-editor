import { type NextRequest, type NextResponse } from "next/server";

import { sendVerificationCode } from "@/modules/registration/server";
import { getPendingRegistrationId, readJson, registrationResponse } from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  return registrationResponse(
    sendVerificationCode(getPendingRegistrationId(request), await readJson(request)),
  );
}
