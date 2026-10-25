import { NextRequest, NextResponse } from "next/server";
import {
  listCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  type AuthorUser,
} from "@/lib/programme-server-storage";
import { WBS_WORK_PACKAGES, STANDARD_TASK_CATALOG } from "@/lib/wbs-package-library";

function getUser(request: NextRequest): AuthorUser {
  return {
    id: request.headers.get("x-user-id") || "user-planner-1",
    name: request.headers.get("x-user-name") || "Lead Construction Planner",
    email: request.headers.get("x-user-email") || "planner@plandx.com",
    role: request.headers.get("x-user-role") || "Senior Planner",
  };
}

/**
 * GET /api/programme/templates
 * Returns all available templates: custom templates, WBS packages, and task catalog.
 */
export async function GET() {
  try {
    const customTemplates = listCustomTemplates();
    return NextResponse.json({
      success: true,
      customTemplates,
      wbsPackages: WBS_WORK_PACKAGES,
      standardTaskCatalog: STANDARD_TASK_CATALOG,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "FAILED_TO_LOAD_TEMPLATES", message: error?.message || "Failed to load templates" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/programme/templates
 * Saves an active project as a reusable template.
 */
export async function POST(request: NextRequest) {
  try {
    const user = getUser(request);
    const body = await request.json();
    const { name, description, category, projectId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "NAME_REQUIRED", message: "Template name is required." },
        { status: 400 }
      );
    }

    if (!projectId) {
      return NextResponse.json(
        { success: false, error: "PROJECT_ID_REQUIRED", message: "Source project ID is required." },
        { status: 400 }
      );
    }

    const savedTemplate = saveCustomTemplate(name, description, category, projectId, user);

    return NextResponse.json({
      success: true,
      template: savedTemplate,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "FAILED_TO_SAVE_TEMPLATE", message: error?.message || "Failed to save template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/programme/templates?id=...
 * Deletes a user custom template.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID_REQUIRED", message: "Template ID is required." },
        { status: 400 }
      );
    }

    const deleted = deleteCustomTemplate(id);
    return NextResponse.json({
      success: deleted,
      message: deleted ? "Template deleted successfully" : "Template not found",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "FAILED_TO_DELETE_TEMPLATE", message: error?.message || "Failed to delete template" },
      { status: 500 }
    );
  }
}
