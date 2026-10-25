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

export type ZoomLevel = "day" | "week" | "month" | "quarter" | "year";

export type ViewMode = "3d" | "gantt" | "lookahead" | "network" | "list" | "calendar" | "reports" | "portfolio";

export type ReportPeriod = "lifecycle" | "month" | "2-weeks" | "4-weeks";

export type FocusPreset =
  | "all"
  | "today"
  | "this-week"
  | "next-2-weeks"
  | "next-4-weeks"
  | "critical-path"
  | "my-work"
  | "blocked";

export type LookaheadPeriod = "1-week" | "2-weeks" | "4-weeks" | "6-weeks";

export type LookaheadReadiness =
  | "ready"
  | "dependency-risk"
  | "blocked"
  | "overdue"
  | "unassigned";

export interface LookaheadTaskItem {
  task: ProgrammeTask;
  readiness: LookaheadReadiness;
  readinessReason?: string;
  timingInWindow: "starts-in-window" | "finishes-in-window" | "spans-window" | "within-window";
  daysUntilStart: number;
  daysUntilFinish: number;
  unresolvedPredecessors: { id: string; name: string; status: TaskStatus; progress: number; endDate: string }[];
}

// ─── Core Data Models ───────────────────────────────────────

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export type ConstraintType =
  | "ASAP"
  | "ALAP"
  | "MSO"
  | "MFO"
  | "SNET"
  | "SNLT"
  | "FNET"
  | "FNLT"
  | number
  | string;

export interface DependencyDetail {
  id: string;
  name?: string;
  relation?: string; // e.g., "Finishes before this starts (FS)" or "Starts after this finishes (FS)"
  statusColor?: string; // e.g., "emerald" or "gray"
  type?: DependencyType; // "FS" | "SS" | "FF" | "SF" (default: "FS")
  lag?: number; // working days (positive = lag / delay, negative = lead / overlap, default: 0)
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
  subcontractor?: string | null;
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
  freeFloat?: number; // free float in days
  lateStart?: string; // Late Start ISO date
  lateFinish?: string; // Late Finish ISO date
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
  baseline0Start?: string;
  baseline0Finish?: string;
  baseline0Duration?: number;
  baseline0Cost?: number;
  baseline0Work?: number;
  workingForecastStart?: string;
  workingForecastFinish?: string;
  manualStartDate?: string;
  manualEndDate?: string;
  // Microsoft Project (MPP/MSPDI) Source Identifiers & Hierarchy
  sourceId?: number | string; // 1-based MS Project Row ID (e.g. 1..800)
  sourceUid?: number | string; // MS Project UniqueID (stable across outline edits)
  sourceGuid?: string; // MS Project GUID
  outlineNumber?: string; // e.g. "1.1.2.1"
  outlineLevel?: number; // 1 to 8+
  summary?: boolean; // Whether task is a summary task (phase / work-package)
  isSummary?: boolean; // Convenience alias for summary task
  isSummaryMilestone?: boolean;
  active?: boolean; // true = active, false = inactive / hidden task
  // Scheduling & Constraint Logic
  constraintType?: number | string; // 0=ASAP, 1=ALAP, 2=MSO, 3=MFO, 4=SNET, 5=SNLT, 6=FNET, 7=FNLT
  constraintDate?: string;
  deadline?: string;
  schedulingMode?: "auto" | "manual";
  actualStart?: string;
  actualFinish?: string;
  actualDuration?: number;
  remainingDuration?: number;
  physicalPercentComplete?: number;
  sourceCritical?: boolean; // Preserves source calculation separately from recalculated critical path
  earlyStart?: string;
  earlyFinish?: string;
  calendarUid?: string;
  calendarName?: string;
  // Calculation settings & Work Breakdown
  taskType?: "fixed-duration" | "fixed-work" | "fixed-units";
  effortDriven?: boolean;
  workHours?: number;
  assignmentUnits?: number; // 1.0 = 100%
  actualWorkHours?: number;
  remainingWorkHours?: number;
  cost?: number;
  // Progress & Physical Verification Governance
  verifiedPhysicalProgress?: boolean; // NEVER equate % complete with verified physical completion
  verifiedBy?: string;
  verifiedAt?: string;
  physicalVerificationNotes?: string;
  subcontractorClaimedProgress?: number; // Subcontractor submitted claim %
  subcontractorClaimedDate?: string; // Date subcontractor submitted claim
  subcontractorClaimNotes?: string; // Subcontractor remarks/claim justification
  statusDate?: string; // Project status date at evaluation
  forecastFinish?: string; // Projected finish date for incomplete work from status date
  // Constraints & Deadlines Enforcement
  deadlineViolated?: boolean;
  daysPastDeadline?: number;
  constraintConflict?: boolean;
  constraintConflictReason?: string;
  // Resource Workload & Allocation
  overallocated?: boolean;
  peakAllocationPercent?: number;
  assignments?: TaskResourceAssignment[];
  assignedResources?: string[];
  subcontractorRecordId?: string;
  isSubcontractorVerified?: boolean;
  siteAttendance?: SiteAttendanceRecord[];
  // Advanced Working Time & Critical Path Logic
  isElapsedDuration?: boolean; // Elapsed duration (ed), continuous 24h calendar days
  calendarId?: string; // Task-specific calendar override
  isCalculatedCritical?: boolean; // Recalculated critical path flag
  isNearCritical?: boolean; // Low float (0 < float <= 5d)
  hasNegativeFloat?: boolean; // Float < 0 due to deadline or hard constraint breach
  criticalityReason?: string; // Human explanation of criticality
  drivingPredecessorId?: string; // Predecessor that determines early start
  // Multiple Baseline Slots (Baseline 0 - 10)
  baselineSlots?: Record<number, BaselineSlot>;
  // Custom Fields & Responsibility Attributes (Preserved exact from source)
  tradeText?: string; // Raw trade text (e.g. "Civil", "Concrete", "Cleaning", "Façade")
  byWhom?: string; // Raw responsibility text (e.g. "Mettle", "Supplier award")
  todayText?: string; // Text field "Today"
  fourWeeksText?: string; // Text field "4 Weeks"
  customFields?: Record<string, string | number | boolean>;
  integrations?: TaskConstructionIntegrations;
  rawExtendedAttributes?: Array<{ fieldId: string; fieldName?: string; value: string }>;
}

export type TaskType = "fixed-duration" | "fixed-work" | "fixed-units";

export interface BaselineSlot {
  slot: number; // 0 to 10
  slotNumber?: number; // alias
  name: string;
  start?: string;
  finish?: string;
  startDate?: string; // alias
  finishDate?: string; // alias
  duration?: number;
  cost?: number;
  work?: number;
  workHours?: number; // alias
  capturedAt?: string;
  savedAt?: string; // alias
  approvedBy?: string;
}

export interface SchedulingWarning {
  taskId: string;
  taskName: string;
  type: "cycle" | "constraint-conflict" | "deadline-violated" | "negative-lag-warning" | "overallocated" | "dependency-conflict";
  message: string;
  severity: "critical" | "warning" | "info";
}

export type ResourceType = "work" | "equipment" | "material" | "cost" | "labour";

export interface ProjectResource {
  id: string;
  name: string;
  type: ResourceType;
  category?: "labour" | "equipment" | "material" | "cost";
  initials: string;
  color?: string;
  trade?: string;
  email?: string;
  phone?: string;
  maxUnits: number; // e.g. 1.0 = 100%, 2.0 = 200%
  standardRate?: number; // $/hr or $/unit
  overtimeRate?: number; // $/hr
  costPerUse?: number; // fixed mobilization / engagement fee
  unitOfMeasure?: string; // for materials (e.g. "m3", "tonnes", "pcs")
  calendarId?: string;
  calendarName?: string;
  isVerifiedVendor: boolean; // linked to verified PlanD-X vendor record
  vendorRecordId?: string;
  sourceUid?: string | number; // MS Project resource UID
  notes?: string;
}

export interface TaskResourceAssignment {
  assignmentId: string;
  resourceId: string;
  resourceName: string;
  resourceType: ResourceType;
  units: number; // 1.0 = 100%
  plannedWorkHours: number;
  actualWorkHours: number;
  remainingWorkHours: number;
  standardRate?: number;
  cost: number;
  overtimeHours?: number;
  notes?: string;
}

export interface SiteAttendanceRecord {
  id: string;
  date: string; // ISO date YYYY-MM-DD
  headcount: number;
  trade?: string;
  subcontractorName?: string;
  equipmentOnSite?: string[];
  verifiedBy: string;
  verifiedAt?: string;
  notes?: string;
}

export interface WeeklyWorkloadRecord {
  weekNumber: number;
  weekLabel: string;
  startDate: string;
  endDate: string;
  totalHours: number;
  capacityHours: number;
  peakUnits: number;
  isOverallocated: boolean;
  taskIds: string[];
}

export interface MonthlyWorkloadRecord {
  monthStr: string; // YYYY-MM
  monthLabel: string; // e.g. "Nov 2025"
  totalHours: number;
  capacityHours: number;
  peakUnits: number;
  isOverallocated: boolean;
  taskIds: string[];
}

export interface ResourceDailyWorkload {
  date: string;
  units: number; // 1.0 = 100%
  hours: number;
  taskIds: string[];
  isOverallocated: boolean;
}

export interface ResourceWorkloadSummary {
  resourceId?: string;
  resourceName: string;
  resourceInitials: string;
  resourceType?: ResourceType;
  trade?: string;
  maxDailyUnits: number;
  maxCapacityUnits?: number; // configured availability limit (default: 1.0)
  overallocatedDaysCount: number;
  totalPlannedHours?: number;
  totalActualHours?: number;
  totalRemainingHours?: number;
  totalCost?: number;
  assignedTaskCount?: number;
  assignedTaskIds?: string[];
  isVerifiedVendor?: boolean;
  vendorRecordId?: string;
  standardRate?: number;
  dailyWorkloads: Record<string, ResourceDailyWorkload>;
  weeklyWorkloads?: Record<string, WeeklyWorkloadRecord>;
  monthlyWorkloads?: Record<string, MonthlyWorkloadRecord>;
}

export type ReconciliationCategory =
  | "schedule"
  | "wbs"
  | "logic"
  | "progress"
  | "calendar_constraints"
  | "resources_costs"
  | "baseline";

export interface TaskFieldChange {
  field: string;
  fieldLabel: string;
  from: any;
  to: any;
  category?: ReconciliationCategory;
  varianceDays?: number;
}

export type TaskMatchConfidence =
  | "exact-uid"
  | "exact-id"
  | "exact-wbs-name"
  | "uncertain-wbs-only"
  | "uncertain-name-only"
  | "unmatched";

export type ReconciliationAction = "accept" | "keep" | "skip" | "manual-merge";

export interface TaskReconciliationItem {
  id?: string;
  taskId: string;
  workingTaskId?: string;
  incomingTaskId?: string;
  taskName: string;
  workingTaskName?: string;
  incomingTaskName?: string;
  changeType: "added" | "removed" | "modified" | "unchanged" | "renamed" | "moved";
  isRenamed?: boolean;
  isMoved?: boolean;
  isUncertain?: boolean;
  uncertainReason?: string;
  matchConfidence?: TaskMatchConfidence;
  action?: ReconciliationAction;
  sourceUid?: string | number;
  wbs: string;
  workingWbs?: string;
  incomingWbs?: string;
  depth?: number;
  changes: TaskFieldChange[];
  task: ProgrammeTask;
  workingTask?: ProgrammeTask;
  incomingTask?: ProgrammeTask;
}

export interface ProgrammeReconciliationSummary {
  previousTaskCount: number;
  incomingTaskCount: number;
  addedCount: number;
  removedCount: number;
  modifiedCount: number;
  renamedCount?: number;
  movedCount?: number;
  uncertainCount?: number;
  unchangedCount: number;
  items?: TaskReconciliationItem[];
  addedTasks: ProgrammeTask[];
  removedTasks: ProgrammeTask[];
  modifiedTasks: TaskReconciliationItem[];
  unchangedTasks: ProgrammeTask[];
  dateShiftSummary: {
    earlierCount: number;
    laterCount: number;
    maxSlipDays: number;
    projectFinishSlipDays?: number;
    currentFinishDate?: string;
    incomingFinishDate?: string;
  };
  milestoneImpacts?: Array<{
    id: string;
    name: string;
    workingDate: string;
    incomingDate: string;
    slipDays: number;
  }>;
  logicChangesCount?: number;
  constraintChangesCount?: number;
}

export interface SavedProgrammeRevision {
  revisionId: string;
  revisionCode: string;
  name: string;
  appliedAt: string;
  appliedBy: string;
  reason: string;
  sourceFileName?: string;
  sourceFingerprint?: string;
  summary: {
    totalTasks: number;
    addedCount: number;
    removedCount: number;
    modifiedCount: number;
    renamedCount: number;
    movedCount: number;
    uncertainCount: number;
    acceptedCount: number;
    rejectedCount: number;
    projectFinishDate: string;
    projectFinishSlipDays: number;
  };
  reconciledItems: TaskReconciliationItem[];
  workingTasksBeforeRevision: ProgrammeTask[];
  appliedTasks: ProgrammeTask[];
  calendarSnapshot?: any;
  isRolledBack?: boolean;
  rolledBackAt?: string;
  rolledBackBy?: string;
  rollbackReason?: string;
}

export interface ProgrammeImportBatch {
  id: string;
  fileHash: string; // SHA-256 fingerprint
  fileName: string;
  fileSizeBytes: number;
  format: string;
  importedAt: string;
  importedBy: string;
  projectName: string;
  taskCount: number;
  status: "active" | "archived" | "superseded";
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

export interface SavedView {
  id: string;
  name: string;
  viewMode: ViewMode;
  filters: FilterState;
  createdAt: string;
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

// ─── What-If Schedule Scenarios ───────────────────────────────

export interface ScheduleScenario {
  id: string;
  name: string;
  description: string;
  author: string;
  createdAt: string;
  tasks: ProgrammeTask[];
  status: "active" | "draft" | "approved" | "discarded";
  projectFinishDate?: string;
}

// ─── Role-Based Access Control (RBAC) ─────────────────────────

export type ConstructionRole =
  | "planner"
  | "project-manager"
  | "site-engineer"
  | "subcontractor"
  | "client";

export interface RolePermissions {
  role: ConstructionRole;
  label: string;
  canEditScheduleLogic: boolean;
  canFreezeBaseline: boolean;
  canCertifyProgress: boolean;
  canSubmitClaims: boolean;
  canManageScenarios: boolean;
  canRecordSiteDiary: boolean;
  isReadOnly: boolean;
}

// ─── Construction Module Integration Records ──────────────────

export interface BOQItemReference {
  code: string;
  description: string;
  unit: string;
  quantity: number;
  rate: number;
  totalValue: number;
  measuredQuantityToDate?: number;
}

export interface TradeContractReference {
  contractPackageId: string;
  subcontractorName: string;
  contactPerson?: string;
  contractSum: number;
  retentionPercent: number;
  afpReference?: string;
  valuationStatus: "pending-measure" | "certified" | "disputed";
}

export interface SiteDiaryEntry {
  id: string;
  date: string;
  shiftHours: number;
  weather: string;
  temperatureC: number;
  operativesCount: number;
  notes: string;
  plantOnSite?: string[];
}

export interface TechnicalDocumentReference {
  id: string;
  docNumber: string;
  title: string;
  revision: string;
  type: "Drawing" | "ITP" | "PTW" | "MethodStatement" | "RFI";
  status: "Approved" | "UnderReview" | "Superseded";
  url?: string;
}

export interface TaskConstructionIntegrations {
  boq?: BOQItemReference;
  vendorContract?: TradeContractReference;
  siteDiary?: SiteDiaryEntry[];
  documents?: TechnicalDocumentReference[];
}

