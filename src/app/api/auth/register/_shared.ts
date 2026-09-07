import { NextRequest, NextResponse } from "next/server";

import {
  PENDING_REGISTRATION_COOKIE,
  PENDING_REGISTRATION_TTL_SECONDS,
  type RegistrationServerResult,
} from "@/modules/registration/server";

export function getPendingRegistrationId(request: NextRequest): string | undefined {
  return request.cookies.get(PENDING_REGISTRATION_COOKIE)?.value;
}

export async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export function registrationResponse<T>(
  result: RegistrationServerResult<T>,
  successStatus = 200,
): NextResponse {
  if (!result.ok) {
    const response = NextResponse.json(
      {
        success: false,
        code: result.code,
        message: result.message,
        ...(result.errors ? { errors: result.errors } : {}),
        ...(result.retryAfterSeconds !== undefined
          ? { retryAfterSeconds: result.retryAfterSeconds }
          : {}),
      },
      { status: result.status },
    );
    if (result.retryAfterSeconds !== undefined) {
      response.headers.set("Retry-After", String(result.retryAfterSeconds));
    }
    return response;
  }

  return NextResponse.json(
    { success: true, data: result.data },
    { status: successStatus },
  );
}

export function setPendingRegistrationCookie(response: NextResponse, registrationId: string): void {
  response.cookies.set(PENDING_REGISTRATION_COOKIE, registrationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PENDING_REGISTRATION_TTL_SECONDS,
  });
}

export function clearPendingRegistrationCookie(response: NextResponse): void {
  response.cookies.set(PENDING_REGISTRATION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function getProperty(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return (value as Record<string, unknown>)[key];
}
