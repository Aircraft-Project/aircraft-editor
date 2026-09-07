import { type NextRequest, type NextResponse } from "next/server";

import { checkUsername } from "@/modules/registration/server";
import { getProperty, readJson, registrationResponse } from "../_shared";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = await readJson(request);
  return registrationResponse(checkUsername(getProperty(body, "username")));
}
