// PlanD-X Schedule Change Tracking & Audit History Module
// ========================================================
// Records and tracks changes to start/finish dates, durations,
// progress, dependencies, and resource assignments with user attribution.

export type ScheduleChangeField =
  | "startDate"
  | "endDate"
  | "duration"
  | "progress"
  | "status"
  | "predecessors"
  | "resource"
  | "baseline"
  | "name"
  | "verifiedPhysicalProgress"
  | "subcontractorClaimedProgress"
  | "wbs"
  | "parentId"
  | "scenarioApproval"
  | "programmePublish";

export type ScheduleChangeSource =
  | "user-edit"
  | "cpm-recalculation"
  | "baseline-snapshot"
  | "schedule-import"
  | "restored-baseline"
  | "revision-import"
  | "revision-rollback"
  | "scenario-merge"
  | "programme-publish";

export interface ScheduleChangeEvent {
  id: string;
  taskId: string;
  taskName: string;
  wbs?: string;
  field: ScheduleChangeField;
  fieldLabel: string;
  previousValue: string | number | null;
  newValue: string | number | null;
  timestamp: string; // ISO datetime
  changedBy: string; // e.g. "Demo Builder"
  userRole?: string; // e.g. "Project Manager"
  reason?: string;
  changeSource: ScheduleChangeSource;
}

export const INITIAL_CHANGE_HISTORY: ScheduleChangeEvent[] = [
  {
    id: "chg-001",
    taskId: "task-columns",
    taskName: "Reinforced Concrete Columns - Grid C",
    wbs: "3.2.1",
    field: "duration",
    fieldLabel: "Duration",
    previousValue: "14d",
    newValue: "18d",
    timestamp: "2025-10-14T16:30:00Z",
    changedBy: "Demo Builder",
    userRole: "Construction Management",
    reason: "Formwork alignment re-work required after initial laser scan.",
    changeSource: "user-edit",
  },
  {
    id: "chg-002",
    taskId: "task-columns",
    taskName: "Reinforced Concrete Columns - Grid C",
    wbs: "3.2.1",
    field: "endDate",
    fieldLabel: "Finish Date",
    previousValue: "2026-01-08",
    newValue: "2026-01-16",
    timestamp: "2025-10-14T16:31:00Z",
    changedBy: "PlanD-X CPM Engine",
    userRole: "Topological Recalculation",
    reason: "Downstream finish date extended due to duration revision.",
    changeSource: "cpm-recalculation",
  },
  {
    id: "chg-003",
    taskId: "task-level-1-slab",
    taskName: "Level 1 Suspended Slab Concrete Pour",
    wbs: "3.1.2",
    field: "progress",
    fieldLabel: "Progress",
    previousValue: "80%",
    newValue: "100%",
    timestamp: "2025-10-12T14:15:00Z",
    changedBy: "Demo Builder",
    userRole: "Construction Management",
    reason: "28-day core compression test reached 32 MPa target. Signoff completed.",
    changeSource: "user-edit",
  },
  {
    id: "chg-004",
    taskId: "task-level-1-slab",
    taskName: "Level 1 Suspended Slab Concrete Pour",
    wbs: "3.1.2",
    field: "status",
    fieldLabel: "Status",
    previousValue: "in-progress",
    newValue: "complete",
    timestamp: "2025-10-12T14:15:00Z",
    changedBy: "Demo Builder",
    userRole: "Construction Management",
    reason: "Auto-transitioned to complete upon reaching 100% progress.",
    changeSource: "user-edit",
  },
  {
    id: "chg-005",
    taskId: "task-columns",
    taskName: "Reinforced Concrete Columns - Grid C",
    wbs: "3.2.1",
    field: "resource",
    fieldLabel: "Subcontractor",
    previousValue: "Apex Formwork",
    newValue: "Apex Formwork Ltd",
    timestamp: "2025-10-10T11:00:00Z",
    changedBy: "Sarah Jenkins",
    userRole: "Contract Admin",
    reason: "Updated verified legal contractor entity.",
    changeSource: "user-edit",
  },
];

/**
 * Creates a unique change event record.
 */
export function createScheduleChangeEvent(
  params: Omit<ScheduleChangeEvent, "id" | "timestamp"> & { timestamp?: string }
): ScheduleChangeEvent {
  const timestamp = params.timestamp || new Date().toISOString();
  const id = `chg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return {
    ...params,
    id,
    timestamp,
  };
}

/**
 * Formats a change event for user-facing audit presentation.
 */
export function formatChangeSummary(event: ScheduleChangeEvent): string {
  const prevStr = event.previousValue !== null ? String(event.previousValue) : "(empty)";
  const newStr = event.newValue !== null ? String(event.newValue) : "(cleared)";
  return `${event.fieldLabel} changed from ${prevStr} to ${newStr}`;
}

/**
 * Local storage persistence helper for schedule changes.
 */
const AUDIT_STORAGE_KEY = "plandx_schedule_audit_history";

export function loadSavedAuditHistory(): ScheduleChangeEvent[] {
  if (typeof window === "undefined") return INITIAL_CHANGE_HISTORY;
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load saved audit history:", err);
  }
  return INITIAL_CHANGE_HISTORY;
}

export function saveAuditHistory(events: ScheduleChangeEvent[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(events));
  } catch (err) {
    console.warn("Failed to save audit history:", err);
  }
}
