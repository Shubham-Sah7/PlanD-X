import { NextRequest, NextResponse } from "next/server";
import {
  getProject,
  updateProject,
  deleteProject,
} from "@/lib/programme-server-storage";
import type { ConstructionProject } from "@/lib/project-types";

interface RouteParams {
  params: Promise<{
    projectId: string;
  }>;
}

/**
 * GET /api/programme/projects/[projectId]
 * Retrieves metadata for a specific project.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const project = getProject(projectId);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: "PROJECT_NOT_FOUND",
          message: `Project ${projectId} does not exist.`,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      project,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_GET_PROJECT",
        message: error?.message || "Failed to retrieve project details.",
      },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/programme/projects/[projectId]
 * Updates project configuration or metadata.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const updates = (await request.json()) as Partial<ConstructionProject>;

    const updated = updateProject(projectId, updates);

    return NextResponse.json({
      success: true,
      project: updated,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_UPDATE_PROJECT",
        message: error?.message || "Failed to update project settings.",
      },
      { status: error?.message?.includes("not found") ? 404 : 500 }
    );
  }
}

/**
 * DELETE /api/programme/projects/[projectId]
 * Deletes a project and its programme file (excluding demo projects).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const result = deleteProject(projectId);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: "FAILED_TO_DELETE_PROJECT",
        message: error?.message || "Failed to delete project.",
      },
      { status: 400 }
    );
  }
}
