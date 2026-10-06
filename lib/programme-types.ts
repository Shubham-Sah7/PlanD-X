// Programme Management TypeScript Types
// ========================================

export type TaskStatus = "not-started" | "in-progress" | "complete" | "blocked";

export type WBSLevel = "programme" | "phase" | "work-package" | "task" | "milestone";

export type Trade =
  | "Structural"
  | "M&E"
  | "Envelope"
  | "Façade"
  | "Finishes"
  | "External Works"
  | "Civils"
  | "Design"
  | "Management"
  | "Substructure";

export type ProgrammeState =
  | "baseline-0"
  | "approved-baseline"
  | "working-forecast"
  | "daily-snapshot"
  | "client-issue"
  | "imported-branch";

export type ZoomLevel = "day" | "week" | "month" | "quarter";

export type ViewMode = "3d" | "gantt" | "network" | "list" | "calendar";

export type FocusPreset =
  | "all"
  | "today"
  | "this-week"
  | "next-2-weeks"
  | "critical-path"
  | "my-work"
  | "blocked";

// ─── Core Data Models ───────────────────────────────────────

export interface DependencyDetail {
  id: string;
  name: string;
  relation: string; // e.g., "Finishes before this starts (FS)" or "Starts after this finishes (FS)"
  statusColor: string; // e.g., "emerald" or "gray"
}

export interface ProgrammeTask {
  id: string;
  wbs: string; // e.g., "1.2.3.4"
  name: string;
  level: WBSLevel;
  parentId: string | null;
  status: TaskStatus;
  startDate: string; // ISO date
  endDate: string; // ISO date
  displayStart?: string; // e.g., "20 Dec 25"
  displayEnd?: string; // e.g., "16 Jan 26"
  duration: number; // working days
  progress: number; // 0-100
  trade: Trade | string | null;
  costCode?: string; // e.g., "STR-CL-02"
  assignee: string | null;
  assigneeInitials?: string;
  description?: string;
  isCritical: boolean;
  isMilestone: boolean;
  predecessors: string[]; // task IDs
  successors: string[]; // task IDs
  predecessorDetails?: DependencyDetail[];
  successorDetails?: DependencyDetail[];
  notes: string;
  children: string[]; // child task IDs
  depth: number; // nesting depth (0 = programme, 1 = phase, etc.)
  isExpanded?: boolean;
  float: number; // total float in days
  taskCount?: number; // e.g. 120 tasks for Superstructure
  isOverdue?: boolean;
  isBlocked?: boolean;
  isDueThisWeek?: boolean;
  iconType?: string;
  stage?: string; // e.g. "Piling", "Groundworks", "Foundations", "Basement"
  stageColumn?: string;
  blockedBy?: string; // explanation of blocker
  colIndex?: number;
  rowIndex?: number;
}

export interface ProgrammeVersion {
  id: string;
  name: string;
  state: ProgrammeState;
  createdAt: string;
  isActive: boolean;
  isEditable: boolean;
}

export interface ProgrammeData {
  id: string;
  name: string;
  description: string;
  versions: ProgrammeVersion[];
  activeVersion: ProgrammeVersion;
  tasks: ProgrammeTask[];
  taskMap: Map<string, ProgrammeTask>;
  phases: ProgrammeTask[];
  totalTasks: number;
  completedTasks: number;
  blockedTasks: number;
  avgProgress: number;
  startDate: string;
  endDate: string;
}

// ─── Filter & UI State ──────────────────────────────────────

export interface FilterState {
  search: string;
  status: TaskStatus[];
  trades: Trade[];
  dateRange: { start: string | null; end: string | null };
  criticalPathOnly: boolean;
  milestonesOnly: boolean;
  blockedOnly: boolean;
  myTasksOnly: boolean;
  focusPreset: FocusPreset;
  focusWbsId: string | null; // focus on a specific WBS node
}

export interface ProgrammeUIState {
  activeView: ViewMode;
  selectedTaskId: string | null;
  drawerOpen: boolean;
  expandedNodes: Set<string>;
  zoomLevel: ZoomLevel;
  filters: FilterState;
  calendarDate: string; // current month being viewed
  timelineScrollDate: string; // center date of Gantt timeline
}

// ─── Change History ─────────────────────────────────────────

export interface ChangeRecord {
  id: string;
  taskId: string;
  field: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  version: string;
}

// ─── Calendar Types ─────────────────────────────────────────

export interface CalendarDay {
  date: string;
  dayOfMonth: number;
  isToday: boolean;
  isWeekend: boolean;
  isCurrentMonth: boolean;
  tasks: ProgrammeTask[];
  milestones: ProgrammeTask[];
  overflowCount: number;
}

export interface CalendarWeek {
  weekNumber: number;
  days: CalendarDay[];
}

// ─── Gantt Types ────────────────────────────────────────────

export interface GanttColumn {
  id: string;
  label: string;
  width: number;
  visible: boolean;
}

export interface TimelineUnit {
  label: string;
  startDate: string;
  endDate: string;
  width: number;
  isWeekend?: boolean;
  isToday?: boolean;
}
