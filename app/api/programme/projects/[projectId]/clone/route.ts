import { NextRequest, NextResponse } from "next/server";
import {
  cloneProject,
  type AuthorUser,
} from "@/lib/programme-server-storage";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

function getUser(request: NextRequest): AuthorUser {
  const userId = request.headers.get("x-user-id") || "user-planner-1";
  const userName = request.headers.get("x-user-name") || "Lead Construction Planner";
  const userEmail = request.headers.get("x-user-email") || "planner@plandx.com";
  const userRole = request.headers.get("x-user-role") || "Senior Planner";

  return {
    id: userId,
    name: userName,
    email: userEmail,
    role: userRole,
  };
}

/**
 * POST /api/programme/projects/[projectId]/clone
 * Clones an existing project with completely regenerated task IDs and dependency links.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const user = getUser(request);
    let newName: string | undefined;

    try {
      const body = await request.json();
      if (body?.name && typeof body.name === "string") {
        newName = body.name.trim();
      }
    } catch {}

    const { project, programme } = cloneProject(projectId, newName, user);

    return NextResponse.json({
      success: true,
      project,
      programme: {
        id: programme.id,
        version: programme.version,
        tasksCount: programme.tasks.length,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_CLONE_PROJECT",
        message: error?.message || "Failed to duplicate project.",
      },
      { status: 500 }
    );
  }
}
