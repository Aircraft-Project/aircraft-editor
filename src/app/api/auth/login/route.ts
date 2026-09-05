import { NextResponse } from "next/server";
import type { LoginErrorResponse, LoginSuccessResponse } from "@/modules/auth/types";
import { hasLoginErrors, normalizeLoginCredentials, validateLogin } from "@/modules/auth/validation";

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

  // Temporary credential boundary. Replace this branch when the real auth backend is connected.
  if (credentials.username !== "admin" || credentials.password !== "admin") {
    return NextResponse.json<LoginErrorResponse>(
      { success: false, message: "Usuario o contraseña incorrectos." },
      { status: 401 },
    );
  }

  return NextResponse.json<LoginSuccessResponse>({
    success: true,
    user: {
      username: "admin",
      displayName: "Administrador",
    },
  });
}
