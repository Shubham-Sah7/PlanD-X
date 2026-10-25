import { NextRequest, NextResponse } from "next/server";
import {
  listAllProjects,
  createProject,
  type AuthorUser,
} from "@/lib/programme-server-storage";
import type { CreateProjectInput } from "@/lib/project-types";

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
 * GET /api/programme/projects
 * Lists all active and registered construction projects.
 */
export async function GET() {
  try {
    const projects = listAllProjects();
    return NextResponse.json({
      success: true,
      projects,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_LIST_PROJECTS",
        message: error?.message || "Failed to list construction projects.",
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programme/projects
 * Creates a new project from scratch, template, or blank programme.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUser(request);
    const body = (await request.json()) as CreateProjectInput;

    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "PROJECT_NAME_REQUIRED",
          message: "Project name is required to create a new project.",
        },
        { status: 400 }
      );
    }

    const { project, programme } = createProject(body, user);

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
        error: "FAILED_TO_CREATE_PROJECT",
        message: error?.message || "Failed to create construction project.",
      },
      { status: 500 }
    );
  }
}
