import { NextResponse } from "next/server";

import { findMockSessionByUserId } from "@/modules/auth/server";

import {
  canCreateProject,
  validateCreateProject,
  type CreateProjectErrors,
  type Project,
} from "@/modules/projects";
import { mockProjectRepository } from "@/modules/projects/server";

interface CreateProjectSuccessResponse {
  success: true;
  data: {
    project: Project;
  };
}

interface CreateProjectErrorResponse {
  success: false;
  message: string;
  errors?: CreateProjectErrors;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isCreateProjectBody = (
  value: unknown,
): value is {
  name: string;
  description?: string;
  userId: string;
} =>
  isRecord(value) &&
  typeof value.name === "string" &&
  (value.description === undefined ||
    typeof value.description === "string") &&
  typeof value.userId === "string" &&
  value.userId.trim().length > 0;

export async function POST(
  request: Request,
): Promise<NextResponse> {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json<CreateProjectErrorResponse>(
      {
        success: false,
        message: "La solicitud para crear el proyecto no es válida.",
      },
      { status: 400 },
    );
  }

  if (!isCreateProjectBody(body)) {
    return NextResponse.json<CreateProjectErrorResponse>(
      {
        success: false,
        message: "La solicitud para crear el proyecto no es válida.",
      },
      { status: 400 },
    );
  }

  const session = findMockSessionByUserId(body.userId);

  if (!session) {
    return NextResponse.json<CreateProjectErrorResponse>(
      {
        success: false,
        message: "No fue posible identificar al usuario.",
      },
      { status: 401 },
    );
  }

  if (!canCreateProject(session.user.role)) {
    return NextResponse.json<CreateProjectErrorResponse>(
      {
        success: false,
        message: "No tienes permiso para crear proyectos.",
      },
      { status: 403 },
    );
  }

  const validation = validateCreateProject({
    name: body.name,
    description: body.description,
  });

  if (!validation.isValid) {
    return NextResponse.json<CreateProjectErrorResponse>(
      {
        success: false,
        message: "Los datos del proyecto no son válidos.",
        errors: validation.errors,
      },
      { status: 400 },
    );
  }

  const project = await mockProjectRepository.createProject({
    name: validation.values.name,
    description: validation.values.description,
    userId: session.user.id,
  });

  return NextResponse.json<CreateProjectSuccessResponse>(
    {
      success: true,
      data: {
        project,
      },
    },
    { status: 201 },
  );
}
