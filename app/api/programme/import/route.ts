import { NextRequest, NextResponse } from "next/server";
import {
  importProjectProgramme,
  ProgrammeValidationError,
  type AuthorUser,
} from "@/lib/programme-server-storage";

function getContext(request: NextRequest): { projectId: string; user: AuthorUser } {
  const projectId = request.headers.get("x-project-id") || "default-project";
  const userId = request.headers.get("x-user-id") || "user-planner-1";
  const userName = request.headers.get("x-user-name") || "Lead Construction Planner";
  const userEmail = request.headers.get("x-user-email") || "planner@plandx.com";

  return {
    projectId,
    user: {
      id: userId,
      name: userName,
      email: userEmail,
    },
  };
}

/**
 * POST /api/programme/import
 * Validates, deduplicates and atomically commits imported schedules.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, user } = getContext(request);
    const body = await request.json();

    if (!body.tasks || !Array.isArray(body.tasks)) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_PAYLOAD",
          message: "Import payload must include a tasks array.",
        },
        { status: 400 }
      );
    }

    const result = importProjectProgramme(
      projectId,
      {
        sourceFileName: body.sourceFileName || "Imported Schedule.mpp",
        tasks: body.tasks,
        calendar: body.calendar,
        assignments: body.assignments,
        idempotencyKey: body.idempotencyKey,
      },
      user
    );

    return NextResponse.json({
      success: true,
      version: result.version,
      importedTasksCount: result.importedTasksCount,
      revisionId: result.revisionId,
    });
  } catch (error: any) {
    if (error instanceof ProgrammeValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: "IMPORT_VALIDATION_FAILED",
          message: error.message,
          errors: error.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "IMPORT_FAILED",
        message: error?.message || "Failed to import schedule atomically.",
      },
      { status: 500 }
    );
  }
}
