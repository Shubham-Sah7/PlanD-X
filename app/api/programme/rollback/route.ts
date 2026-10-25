import { NextRequest, NextResponse } from "next/server";
import {
  rollbackProjectProgramme,
  getProjectProgramme,
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
 * GET /api/programme/rollback
 * Returns all available revisions eligible for rollback.
 */
export async function GET(request: NextRequest) {
  try {
    const { projectId, user } = getContext(request);
    const programme = getProjectProgramme(projectId, user);

    const revisionSummaries = programme.revisions.map((rev) => ({
      id: rev.id,
      revisionNumber: rev.revisionNumber,
      name: rev.name,
      sourceFileName: rev.sourceFileName,
      createdAt: rev.createdAt,
      author: rev.author,
      changeSummary: rev.changeSummary,
      tasksCount: rev.snapshot.tasks.length,
    }));

    return NextResponse.json({
      success: true,
      currentVersion: programme.version,
      revisions: revisionSummaries,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_LIST_REVISIONS",
        message: error?.message || "Failed to retrieve programme revisions.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programme/rollback
 * Restores working programme to any previous revision.
 */
export async function POST(request: NextRequest) {
  try {
    const { projectId, user } = getContext(request);
    const body = await request.json();

    const targetRevisionNumber = Number(body.targetRevisionNumber);
    if (!targetRevisionNumber || isNaN(targetRevisionNumber) || targetRevisionNumber < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "INVALID_REVISION_NUMBER",
          message: "Target revision number must be a valid positive integer.",
        },
        { status: 400 }
      );
    }

    const result = rollbackProjectProgramme(projectId, targetRevisionNumber, user);

    return NextResponse.json({
      success: true,
      version: result.version,
      restoredRevisionNumber: result.restoredRevisionNumber,
      tasksCount: result.tasksCount,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "ROLLBACK_FAILED",
        message: error?.message || "Failed to execute schedule rollback.",
      },
      { status: 500 }
    );
  }
}
