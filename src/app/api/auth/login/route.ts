import { NextResponse } from "next/server";
import { authenticateMockUser } from "@/modules/auth/server";
import type { LoginErrorResponse, LoginSuccessResponse } from "@/modules/auth";
import { hasLoginErrors, normalizeLoginCredentials, validateLogin } from "@/modules/auth";

function invalidRequest(message = "Solicitud de autenticación inválida.") {
  return NextResponse.json<LoginErrorResponse>({ success: false, message }, { status: 400 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return invalidRequest();
  }

  if (
    !isRecord(body) ||
    typeof body.username !== "string" ||
    typeof body.password !== "string"
  ) {
    return invalidRequest();
  }

  const credentials = normalizeLoginCredentials({
    username: body.username,
    password: body.password,
  });
  const errors = validateLogin(credentials);

  if (hasLoginErrors(errors)) {
    return NextResponse.json<LoginErrorResponse>(
      { success: false, message: "Completá los datos requeridos.", errors },
      { status: 400 },
    );
  }

  const session = authenticateMockUser(credentials);

  if (!session) {
    return NextResponse.json<LoginErrorResponse>(
      { success: false, message: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  return NextResponse.json<LoginSuccessResponse>({
    success: true,
    data: { session },
  });
}
