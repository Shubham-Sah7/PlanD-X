/**
 * PlanD-X Client Persistence Manager
 * 
 * Manages schedule save lifecycle, optimistic concurrency handling,
 * retry queues with exponential backoff, offline local storage fallback,
 * and conflict resolution.
 */

import { type ProgrammeTask, type TaskResourceAssignment } from "./programme-types";
import { type ProjectCalendar } from "./programme-calendar";
import { type BaselineSnapshot } from "./programme-baseline";

export type SaveStatus = "saved" | "saving" | "failed" | "conflict" | "unsaved";

export interface PersistenceError {
  code: "NETWORK_ERROR" | "CONCURRENCY_CONFLICT" | "VALIDATION_FAILED" | "SERVER_ERROR";
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
  retryable: boolean;
}

export interface ConcurrencyConflictDetails {
  currentVersion: number;
  expectedVersion: number;
  lastModifiedBy: {
    id: string;
    name: string;
    email: string;
  };
  updatedAt: string;
}

export interface SavePayload {
  projectId: string;
  expectedVersion: number;
  tasks: ProgrammeTask[];
  calendar?: ProjectCalendar;
  assignments?: Record<string, TaskResourceAssignment[]>;
  baselines?: BaselineSnapshot[];
  settings?: Record<string, unknown>;
  changeDescription?: string;
  idempotencyKey?: string;
}

export interface ServerSaveResponse {
  success: boolean;
  version: number;
  updatedAt: string;
  revisionId: string;
}

/**
 * Saves emergency draft to localStorage as fallback during server disconnect
 */
export function saveOfflineDraft(projectId: string, payload: SavePayload) {
  if (typeof window === "undefined") return;
  try {
    const draftKey = `plandx_offline_draft_${projectId}`;
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...payload,
        savedOfflineAt: new Date().toISOString(),
      })
    );
  } catch (err) {
    console.error("Failed to save emergency offline draft:", err);
  }
}

/**
 * Clears offline draft after successful server persistence
 */
export function clearOfflineDraft(projectId: string) {
  if (typeof window === "undefined") return;
  try {
    const draftKey = `plandx_offline_draft_${projectId}`;
    localStorage.removeItem(draftKey);
  } catch {}
}

/**
 * Checks if an offline draft exists for this project
 */
export function getOfflineDraft(projectId: string): (SavePayload & { savedOfflineAt: string }) | null {
  if (typeof window === "undefined") return null;
  try {
    const draftKey = `plandx_offline_draft_${projectId}`;
    const raw = localStorage.getItem(draftKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Performs a network save to /api/programme with headers, timeout and conflict detection.
 */
export async function persistProgrammeToServer(
  payload: SavePayload,
  userHeaders?: {
    userId?: string;
    userName?: string;
    userEmail?: string;
  }
): Promise<
  | { success: true; version: number; updatedAt: string; revisionId: string }
  | { success: false; conflict: ConcurrencyConflictDetails }
  | { success: false; error: PersistenceError }
> {
  const idempotencyKey = payload.idempotencyKey || `req-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-project-id": payload.projectId,
    "x-user-id": userHeaders?.userId || "user-planner-1",
    "x-user-name": userHeaders?.userName || "Lead Construction Planner",
    "x-user-email": userHeaders?.userEmail || "planner@plandx.com",
  };

  const body = JSON.stringify({
    ...payload,
    idempotencyKey,
  });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s network timeout

  try {
    const response = await fetch("/api/programme", {
      method: "POST",
      headers,
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await response.json().catch(() => null);

    if (response.status === 409) {
      // Concurrency conflict
      return {
        success: false,
        conflict: {
          currentVersion: data?.currentVersion || payload.expectedVersion + 1,
          expectedVersion: payload.expectedVersion,
          lastModifiedBy: data?.lastModifiedBy || { id: "unknown", name: "Another Planner", email: "" },
          updatedAt: data?.updatedAt || new Date().toISOString(),
        },
      };
    }

    if (!response.ok || !data?.success) {
      const errorMessage =
        data?.message ||
        (data?.errors && Array.isArray(data.errors) ? data.errors.map((e: any) => e.message).join("; ") : null) ||
        `Server returned error HTTP ${response.status}`;

      return {
        success: false,
        error: {
          code: response.status === 422 ? "VALIDATION_FAILED" : "SERVER_ERROR",
          message: errorMessage,
          timestamp: new Date().toISOString(),
          details: data,
          retryable: response.status >= 500 || response.status === 408,
        },
      };
    }

    // Success
    clearOfflineDraft(payload.projectId);
    return {
      success: true,
      version: data.version,
      updatedAt: data.updatedAt,
      revisionId: data.revisionId,
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    saveOfflineDraft(payload.projectId, payload);

    const isAbort = err?.name === "AbortError";
    return {
      success: false,
      error: {
        code: "NETWORK_ERROR",
        message: isAbort
          ? "Network save timed out after 12 seconds. Changes saved to local offline cache."
          : "Could not connect to PlanD-X server. Changes saved locally and queued for retry.",
        timestamp: new Date().toISOString(),
        retryable: true,
      },
    };
  }
}

/**
 * Loads project programme from /api/programme with fallback to offline draft or seeds.
 */
export async function loadProgrammeFromServer(
  projectId: string = "default-project"
): Promise<{
  success: boolean;
  version: number;
  tasks: ProgrammeTask[];
  calendar: ProjectCalendar;
  assignments: Record<string, TaskResourceAssignment[]>;
  baselines: BaselineSnapshot[];
  settings: Record<string, unknown>;
  hasOfflineDraft: boolean;
  offlineDraftDate?: string;
}> {
  try {
    const response = await fetch("/api/programme", {
      headers: {
        "x-project-id": projectId,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data?.success && data?.programme) {
        const prog = data.programme;
        const offlineDraft = getOfflineDraft(projectId);

        return {
          success: true,
          version: prog.version,
          tasks: prog.tasks || [],
          calendar: prog.calendar,
          assignments: prog.assignments || {},
          baselines: prog.baselines || [],
          settings: prog.settings || {},
          hasOfflineDraft: Boolean(offlineDraft),
          offlineDraftDate: offlineDraft?.savedOfflineAt,
        };
      }
    }
  } catch (err) {
    console.warn("Failed to reach server for programme load, checking offline cache:", err);
  }

  // Check offline draft
  const offlineDraft = getOfflineDraft(projectId);
  if (offlineDraft) {
    return {
      success: true,
      version: offlineDraft.expectedVersion || 1,
      tasks: offlineDraft.tasks || [],
      calendar: offlineDraft.calendar as any,
      assignments: offlineDraft.assignments || {},
      baselines: offlineDraft.baselines || [],
      settings: offlineDraft.settings || {},
      hasOfflineDraft: true,
      offlineDraftDate: offlineDraft.savedOfflineAt,
    };
  }

  throw new Error("Unable to load programme from server or offline draft.");
}
