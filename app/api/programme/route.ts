import { NextRequest, NextResponse } from "next/server";
import {
  getProjectProgramme,
  saveProjectProgramme,
  getProject,
  DEFAULT_DEMO_PROJECT,
  ConcurrencyConflictError,
  ProgrammeValidationError,
  type AuthorUser,
} from "@/lib/programme-server-storage";

function getContext(request: NextRequest): { projectId: string; user: AuthorUser } {
  const projectId = request.headers.get("x-project-id") || "default-project";
  const userId = request.headers.get("x-user-id") || "user-planner-1";
  const userName = request.headers.get("x-user-name") || "Lead Construction Planner";
  const userEmail = request.headers.get("x-user-email") || "planner@plandx.com";
  const userRole = request.headers.get("x-user-role") || "Senior Planner";

  return {
    projectId,
    user: {
      id: userId,
      name: userName,
      email: userEmail,
      role: userRole,
    },
  };
}

/**
 * GET /api/programme
 * Fetches the active programme scoped by project and authorized user.
 */
export async function GET(request: NextRequest) {
  try {
    const { projectId, user } = getContext(request);
    const programme = getProjectProgramme(projectId, user);
    const project = getProject(projectId) || (projectId === "default-project" ? DEFAULT_DEMO_PROJECT : null);

    return NextResponse.json({
      success: true,
      project,
      programme: {
        id: programme.id,
        projectId: programme.projectId,
        projectName: programme.projectName,
        projectCode: programme.projectCode,
        version: programme.version,
        updatedAt: programme.updatedAt,
        lastModifiedBy: programme.lastModifiedBy,
        tasks: programme.tasks,
        calendar: programme.calendar,
        assignments: programme.assignments,
        baselines: programme.baselines,
        settings: programme.settings,
        revisionsCount: programme.revisions.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_LOAD_PROGRAMME",
        message: error?.message || "Failed to load project programme.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programme
 * Validates and atomically persists schedule changes with optimistic concurrency control.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, user } = getContext(request);
    const body = await request.json();

    const result = saveProjectProgramme(
      projectId,
      {
        expectedVersion: body.expectedVersion,
        idempotencyKey: body.idempotencyKey,
        tasks: body.tasks,
        calendar: body.calendar,
        assignments: body.assignments,
        baselines: body.baselines,
        settings: body.settings,
        changeDescription: body.changeDescription,
      },
      user
    );

    return NextResponse.json({
      success: true,
      version: result.version,
      updatedAt: result.updatedAt,
      revisionId: result.revisionId,
    });
  } catch (error: any) {
    if (error instanceof ConcurrencyConflictError) {
      return NextResponse.json(
        {
          success: false,
          error: "CONCURRENCY_CONFLICT",
          message: error.message,
          currentVersion: error.currentVersion,
          expectedVersion: error.expectedVersion,
          lastModifiedBy: error.lastModifiedBy,
          updatedAt: error.updatedAt,
        },
        { status: 409 }
      );
    }

    if (error instanceof ProgrammeValidationError) {
      return NextResponse.json(
        {
          success: false,
          error: "VALIDATION_FAILED",
          message: error.message,
          errors: error.errors,
        },
        { status: 422 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: "SAVE_ERROR",
        message: error?.message || "An unexpected error occurred while saving the programme.",
      },
      { status: 500 }
    );
  }
}
