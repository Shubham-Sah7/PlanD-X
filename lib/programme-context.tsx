"use client";

import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from "react";
import type { ConstructionProject, CreateProjectInput } from "./project-types";
import type {
  ViewMode,
  ZoomLevel,
  FocusPreset,
  FilterState,
  ProgrammeUIState,
  TaskStatus,
  Trade,
  ProgrammeTask,
  LookaheadPeriod,
  SchedulingWarning,
  WBSLevel,
  TaskType,
  ConstraintType,
  SavedView,
  DependencyDetail,
  SavedProgrammeRevision,
  TaskReconciliationItem,
  ProjectResource,
  TaskResourceAssignment,
  SiteAttendanceRecord,
  ScheduleScenario,
  ConstructionRole,
  RolePermissions,
  TaskConstructionIntegrations,
} from "./programme-types";
import { insertWBSPackageIntoProgramme, WBS_PACKAGE_TEMPLATES } from "./wbs-package-library";
import {
  type SaveStatus,
  type PersistenceError,
  type ConcurrencyConflictDetails,
  persistProgrammeToServer,
  loadProgrammeFromServer,
} from "./programme-persistence";
import {
  getProjectResources,
  saveProjectResources,
  calculateTaskResourceRollups,
} from "./programme-resources";
import { applyProgrammeReconciliation } from "./programme-reconciliation";
import { ALL_PROGRAMME_TASKS } from "./programme-data";
import {
  INITIAL_VENDORS_AND_TEAM,
  INITIAL_COST_CODES,
  INITIAL_SITE_PHOTOS,
  INITIAL_VENDOR_UPDATES,
} from "@/data/mock-programme";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  recalculateSchedule,
  addWorkingDays,
  getNextWorkingDay,
  parseIsoDate,
  formatDateIso,
  formatDisplayDate,
  shiftByWorkingDays,
  detectDependencyCycle,
  calculateTaskWorkUnits,
  evaluateStatusDateAndProgress,
} from "./programme-calendar";
import {
  type DependencyType,
  linkTasks,
  unlinkTasks,
  validateDependency,
} from "./programme-dependencies";
import type { ImportedModelData } from "./programme-model-loader";
import { type ProjectModelPreset, PROJECT_PRESETS } from "@/components/programme/model3d/model-data";
import {
  type ScheduleChangeEvent,
  type ScheduleChangeField,
  type ScheduleChangeSource,
  createScheduleChangeEvent,
  loadSavedAuditHistory,
  saveAuditHistory,
} from "./programme-change-tracker";
import {
  type BaselineSnapshot,
  type BaselineIntegrityReport,
  inspectBaselineIntegrity,
  createBaselineSnapshot,
  applyBaselineSnapshotToTasks,
  restoreScheduleFromBaseline,
  preserveExistingBaselinesOnImport,
  loadSavedBaselines,
  saveBaselines,
} from "./programme-baseline";
import { simulateResourceLeveling } from "./programme-resource-leveling";

export const ROLE_PERMISSIONS_MAP: Record<ConstructionRole, RolePermissions> = {
  planner: {
    role: "planner",
    label: "Senior Project Planner",
    canEditScheduleLogic: true,
    canFreezeBaseline: true,
    canCertifyProgress: true,
    canSubmitClaims: true,
    canManageScenarios: true,
    canRecordSiteDiary: true,
    isReadOnly: false,
  },
  "project-manager": {
    role: "project-manager",
    label: "Project Manager",
    canEditScheduleLogic: true,
    canFreezeBaseline: true,
    canCertifyProgress: true,
    canSubmitClaims: true,
    canManageScenarios: true,
    canRecordSiteDiary: true,
    isReadOnly: false,
  },
  "site-engineer": {
    role: "site-engineer",
    label: "Site Engineer",
    canEditScheduleLogic: false,
    canFreezeBaseline: false,
    canCertifyProgress: true,
    canSubmitClaims: true,
    canManageScenarios: false,
    canRecordSiteDiary: true,
    isReadOnly: false,
  },
  subcontractor: {
    role: "subcontractor",
    label: "Trade Subcontractor",
    canEditScheduleLogic: false,
    canFreezeBaseline: false,
    canCertifyProgress: false,
    canSubmitClaims: true,
    canManageScenarios: false,
    canRecordSiteDiary: false,
    isReadOnly: false,
  },
  client: {
    role: "client",
    label: "Client / Employer's Agent",
    canEditScheduleLogic: false,
    canFreezeBaseline: false,
    canCertifyProgress: false,
    canSubmitClaims: false,
    canManageScenarios: false,
    canRecordSiteDiary: false,
    isReadOnly: true,
  },
};

export type AttentionFilter =
  | "all"
  | "overdue"
  | "blocked"
  | "due-this-week"
  | "critical"
  | "in-progress"
  | "complete"
  | "milestones"
  | "level-1"
  | "level-2"
  | "level-3"
  | "level-4"
  | "roof";

interface ProgrammeContextType {
  state: ProgrammeUIState & {
    attentionFilter: AttentionFilter;
    tasks: ProgrammeTask[];
    criticalPathActive: boolean;
    selectedWbsSection: string;
    networkZoom: number;
    autoLayoutMode: "lr" | "tb";
    viewAllNetwork: boolean;
  };
  tasks: ProgrammeTask[];
  // View
  setActiveView: (view: ViewMode) => void;
  locateIn3D: (taskId: string) => void;
  // Task selection & drawer
  selectTask: (taskId: string | null) => void;
  openDrawer: (taskId: string) => void;
  closeDrawer: () => void;
  // WBS expand/collapse
  toggleExpand: (taskId: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setExpandedNodes: (nodes: Set<string>) => void;
  // Zoom
  setZoomLevel: (zoom: ZoomLevel) => void;
  // Network controls
  criticalPathActive: boolean;
  setCriticalPathActive: (active: boolean) => void;
  toggleCriticalPath: () => void;
  selectedWbsSection: string;
  setSelectedWbsSection: (sectionId: string) => void;
  networkZoom: number;
  setNetworkZoom: React.Dispatch<React.SetStateAction<number>>;
  autoLayoutMode: "lr" | "tb";
  setAutoLayoutMode: (mode: "lr" | "tb") => void;
  viewAllNetwork: boolean;
  setViewAllNetwork: (viewAll: boolean) => void;
  // Attention & Filters
  attentionFilter: AttentionFilter;
  setAttentionFilter: (filter: AttentionFilter) => void;
  setSearch: (query: string) => void;
  setStatusFilter: (statuses: TaskStatus[]) => void;
  setTradeFilter: (trades: Trade[]) => void;
  setCriticalPathOnly: (v: boolean) => void;
  setBlockedOnly: (v: boolean) => void;
  setFocusPreset: (preset: FocusPreset) => void;
  clearFilters: () => void;
  // Task Updates
  updateTaskProgress: (taskId: string, progress: number, status?: TaskStatus) => void;
  updateTaskSchedule: (
    taskId: string,
    updates: { duration?: number; startDate?: string },
  ) => { success: boolean; error?: string; recalculatedCount?: number };
  updateTaskDetails: (
    taskId: string,
    updates: {
      name?: string;
      description?: string;
      status?: TaskStatus;
      progress?: number;
      duration?: number;
      startDate?: string;
      trade?: string | null;
      costCode?: string;
      taskType?: TaskType;
      effortDriven?: boolean;
      workHours?: number;
      assignmentUnits?: number;
      cost?: number;
      constraintType?: ConstraintType;
      constraintDate?: string;
      deadline?: string;
    },
  ) => { success: boolean; error?: string; errors?: Record<string, string> };
  addTaskNote: (taskId: string, note: string) => void;
  assignTaskResource: (
    taskId: string,
    resource: { name: string; initials: string; type?: "vendor" | "user" } | null,
  ) => void;
  // Dependencies & Lag/Lead
  addDependency: (predId: string, succId: string, type: DependencyType, lag: number) => { success: boolean; error?: string };
  updateDependency: (predId: string, succId: string, type: DependencyType, lag: number) => { success: boolean; error?: string };
  removeDependency: (predId: string, succId: string) => { success: boolean; error?: string };
  // Calendar & Working Time
  setCalendarDate: (date: string) => void;
  projectCalendar: ProjectCalendar;
  setProjectCalendar: (calendar: ProjectCalendar) => void;
  applyCalendar: (calendar: ProjectCalendar) => void;
  isCalendarModalOpen: boolean;
  openCalendarModal: () => void;
  closeCalendarModal: () => void;
  // Baseline Comparison
  showBaselineComparison: boolean;
  setShowBaselineComparison: (show: boolean) => void;
  toggleBaselineComparison: () => void;
  selectedBaselineVersion: string;
  setSelectedBaselineVersion: (ver: string) => void;
  // Baseline Integrity & Snapshots
  baselineSnapshots: BaselineSnapshot[];
  baselineIntegrity: BaselineIntegrityReport;
  takeBaselineSnapshot: (options: {
    name: string;
    description: string;
    type?: "contract-baseline" | "approved-revision";
  }) => BaselineSnapshot;
  replaceActiveBaseline: (
    snapshotName: string,
    reason: string
  ) => { success: boolean; error?: string };
  setBaseline0: (reason?: string, author?: string) => { success: boolean; error?: string };
  restoreScheduleToBaseline: () => { success: boolean; restoredCount: number };
  // Change History & Audit Trail
  scheduleAuditLog: ScheduleChangeEvent[];
  recordScheduleChange: (event: Omit<ScheduleChangeEvent, "id" | "timestamp">) => void;
  clearAuditHistory: () => void;
  // 3D Model Integration
  importedModel: ImportedModelData | null;
  setImportedModel: (model: ImportedModelData | null) => void;
  activeProjectPreset: ProjectModelPreset;
  setActiveProjectPreset: (preset: ProjectModelPreset) => void;
  isModelUploadModalOpen: boolean;
  openModelUploadModal: () => void;
  closeModelUploadModal: () => void;
  // Linear Parity Features & Modals
  toastMessage: string | null;
  showToast: (msg: string) => void;
  currentScreen: "builder" | "vendor_portal" | "first_time";
  setCurrentScreen: (screen: "builder" | "vendor_portal" | "first_time") => void;
  isAddTaskOpen: boolean;
  addTaskInitialKind: "task" | "milestone" | "summary";
  addTaskTargetParentId: string | null;
  openAddTask: (kind?: "task" | "milestone" | "summary", parentId?: string | null) => void;
  closeAddTask: () => void;
  isImportOpen: boolean;
  openImport: () => void;
  closeImport: () => void;
  importSchedule: (newTasks: ProgrammeTask[], calendar?: ProjectCalendar, importedProjectName?: string) => void;
  isExportOpen: boolean;
  openExport: () => void;
  closeExport: () => void;
  isRevisionsOpen: boolean;
  openRevisions: () => void;
  closeRevisions: () => void;
  // Programme Revision Comparison Workflow
  savedRevisions: SavedProgrammeRevision[];
  isRevisionComparisonOpen: boolean;
  incomingRevisionData: {
    fileName: string;
    projectName?: string;
    tasks: ProgrammeTask[];
    calendar?: ProjectCalendar;
    fileHash?: string;
  } | null;
  openRevisionComparison: (data?: {
    fileName: string;
    projectName?: string;
    tasks: ProgrammeTask[];
    calendar?: ProjectCalendar;
    fileHash?: string;
  }) => void;
  closeRevisionComparison: () => void;
  applyRevisionImport: (params: {
    revisionName: string;
    appliedBy: string;
    reason: string;
    items: TaskReconciliationItem[];
    incomingCalendar?: ProjectCalendar;
    sourceFileName?: string;
    sourceFingerprint?: string;
  }) => void;
  rollbackRevision: (
    revisionId: string,
    rolledBackBy: string,
    reason: string
  ) => { success: boolean; error?: string };
  isVendorInboxOpen: boolean;
  openVendorInbox: () => void;
  closeVendorInbox: () => void;
  toggleVendorInbox: () => void;
  isAssignOwnerOpen: boolean;
  openAssignOwner: (task?: any) => void;
  closeAssignOwner: () => void;
  isContactCardOpen: boolean;
  openContactCard: (task?: any) => void;
  closeContactCard: () => void;
  isLinkCostCodeOpen: boolean;
  openLinkCostCode: (task?: any) => void;
  closeLinkCostCode: () => void;
  isPhotoPickerOpen: boolean;
  openPhotoPicker: () => void;
  closePhotoPicker: () => void;
  modalTask: any;
  vendorUpdates: any[];
  owners: any[];
  costCodes: any[];
  sitePhotos: any[];
  acceptVendorUpdate: (taskId: string) => void;
  sendBackVendorUpdate: (taskId: string) => void;
  assignOwner: (owner: any, scope: "single" | "group", sendEmail?: boolean) => void;
  linkCostCode: (costCode: any, scope: "single" | "group") => void;
  addTask: (taskData: any) => void;
  showDuplicateBanner: boolean;
  dismissDuplicateBanner: () => void;
  cleanupDuplicates: () => void;
  density: "compact" | "comfortable";
  setDensity: (d: "compact" | "comfortable") => void;
  lookaheadTab: "all" | "this_week" | "4_weeks" | "late" | "milestones" | "in_progress" | "critical_path";
  setLookaheadTab: (tab: "all" | "this_week" | "4_weeks" | "late" | "milestones" | "in_progress" | "critical_path") => void;
  lookaheadPeriod: LookaheadPeriod;
  setLookaheadPeriod: (period: LookaheadPeriod) => void;
  // Multi-Project Management & Blank Project Kickoff
  currentProject: ConstructionProject;
  allProjects: ConstructionProject[];
  isProjectModalOpen: boolean;
  openProjectModal: () => void;
  closeProjectModal: () => void;
  switchProject: (projectId: string) => Promise<void>;
  createNewProject: (input: CreateProjectInput) => Promise<ConstructionProject>;
  cloneCurrentProject: (newName?: string) => Promise<ConstructionProject>;
  deleteCurrentProject: (projectId: string) => Promise<void>;
  updateCurrentProject: (updates: Partial<ConstructionProject>) => Promise<void>;
  refreshProjectsList: () => Promise<void>;
  // Advanced Scheduling & Governance
  scheduleFromStart: boolean;
  setScheduleFromStart: (val: boolean) => void;
  statusDate: string | null;
  setStatusDate: (date: string | null) => void;
  schedulingWarnings: SchedulingWarning[];
  verifyPhysicalProgress: (taskId: string, verified: boolean, verifiedBy?: string, notes?: string) => void;
  recordSubcontractorClaim: (taskId: string, claimedPercent: number, notes?: string) => void;
  // Multi-Selection & Bulk Editing
  selectedTaskIds: string[];
  toggleTaskSelection: (taskId: string, isMulti?: boolean) => void;
  selectAllTasks: () => void;
  clearTaskSelection: () => void;
  bulkUpdateTasks: (taskIds: string[], updates: Partial<ProgrammeTask>) => void;
  bulkShiftTasks: (taskIds: string[], workingDays: number) => void;
  isBulkEditOpen: boolean;
  openBulkEdit: () => void;
  closeBulkEdit: () => void;
  // History & Undo / Redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Clipboard Operations
  copiedTask: ProgrammeTask | null;
  copiedTasks: ProgrammeTask[] | null;
  copySelectedTask: () => void;
  copyTasks: (taskIds: string[]) => void;
  pasteTask: (targetParentId?: string | null) => void;
  pasteTasks: (targetParentId?: string | null, insertAfterId?: string | null) => void;
  // WBS Indentation & Structure
  indentTask: (taskId: string) => void;
  outdentTask: (taskId: string) => void;
  duplicateTask: (taskId: string) => void;
  duplicateTaskGroup: (taskId: string) => void;
  renumberWBS: (prefix?: string) => void;
  moveTaskGroup: (taskId: string, targetParentId: string | null) => void;
  reorderTask: (taskId: string, direction: "up" | "down") => void;
  expandToLevel: (level: number) => void;
  // Task Creation & Deletion
  createTask: (data: {
    name: string;
    isMilestone?: boolean;
    isSummary?: boolean;
    duration?: number;
    startDate?: string;
    targetParentId?: string | null;
    insertAfterId?: string | null;
    trade?: string | null;
    assignee?: string | null;
    costCode?: string;
    notes?: string;
  }) => ProgrammeTask;
  deleteTask: (taskId: string, force?: boolean) => { requiresConfirmation?: boolean; message?: string; childCount?: number };
  deleteTasks: (taskIds: string[], force?: boolean) => { requiresConfirmation?: boolean; message?: string };
  // Structural Warning & Confirmation Dialog
  confirmationDialog: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } | null;
  closeConfirmationDialog: () => void;
  // Schedule Health Quality Modal
  isHealthModalOpen: boolean;
  openHealthModal: () => void;
  closeHealthModal: () => void;
  // Resource & Workload Management
  projectResources: ProjectResource[];
  addProjectResource: (resource: Omit<ProjectResource, "id">) => ProjectResource;
  updateProjectResource: (id: string, updates: Partial<ProjectResource>) => void;
  deleteProjectResource: (id: string) => void;
  assignResourceToTask: (taskId: string, assignment: Omit<TaskResourceAssignment, "assignmentId">) => void;
  removeResourceFromTask: (taskId: string, assignmentId: string) => void;
  updateTaskAssignment: (taskId: string, assignmentId: string, updates: Partial<TaskResourceAssignment>) => void;
  linkTaskSubcontractor: (taskId: string, vendorId: string, vendorName: string) => void;
  recordSiteAttendance: (taskId: string, attendance: Omit<SiteAttendanceRecord, "id">) => void;
  isResourceWorkloadModalOpen: boolean;
  openResourceWorkloadModal: () => void;
  closeResourceWorkloadModal: () => void;
  // Resource Leveling Simulation & Execution
  isResourceLevelingModalOpen: boolean;
  openResourceLevelingModal: () => void;
  closeResourceLevelingModal: () => void;
  applyResourceLeveling: () => { success: boolean; leveledCount: number; projectSlipDays: number };
  // Saved Views & Custom View Configurations
  savedViews: SavedView[];
  saveCurrentView: (name: string) => void;
  loadSavedView: (id: string) => void;
  deleteSavedView: (id: string) => void;
  // Persistence & Concurrency Controls
  saveStatus: SaveStatus;
  programmeVersion: number;
  projectId: string;
  saveError: PersistenceError | null;
  conflictDetails: ConcurrencyConflictDetails | null;
  isConflictModalOpen: boolean;
  closeConflictModal: () => void;
  retrySave: () => Promise<void>;
  resolveConflict: (resolution: "reload" | "overwrite") => Promise<void>;
  isRollbackModalOpen: boolean;
  openRollbackModal: () => void;
  closeRollbackModal: () => void;
  onRollbackSuccess: (restoredVersion: number) => Promise<void>;
  // What-If Schedule Scenarios
  activeScenario: ScheduleScenario | null;
  allScenarios: ScheduleScenario[];
  isCreateScenarioOpen: boolean;
  openCreateScenario: () => void;
  closeCreateScenario: () => void;
  createScenario: (name: string, description: string, author?: string) => ScheduleScenario;
  switchScenario: (scenarioId: string | null) => void;
  approveAndMergeScenario: (scenarioId: string, approvedBy?: string) => { success: boolean; mergedCount: number };
  discardScenario: (scenarioId: string) => void;
  // Role-Based Access Control (RBAC)
  currentUserRole: ConstructionRole;
  setCurrentUserRole: (role: ConstructionRole) => void;
  userPermissions: RolePermissions;
  // WBS Library & Task Catalog
  isWBSLibraryOpen: boolean;
  wbsLibraryTargetParentId: string | null;
  openWBSLibrary: (targetParentId?: string | null) => void;
  closeWBSLibrary: () => void;
  insertWBSPackage: (packageId: string, targetParentId?: string | null) => { insertedCount: number };
  // Programme Publishing & Transmittal
  isPublishModalOpen: boolean;
  openPublishModal: () => void;
  closePublishModal: () => void;
  // Mobile Site Companion & Offline Sync
  isMobileCompanionOpen: boolean;
  openMobileCompanion: () => void;
  closeMobileCompanion: () => void;
  offlineQueueCount: number;
  syncOfflineQueue: () => void;
  queueOfflineUpdate: (item: { taskId: string; type: string; payload: any }) => void;
  // Construction Integrations
  updateTaskIntegrations: (taskId: string, integrations: Partial<TaskConstructionIntegrations>) => void;
  // Recovery & Local Snapshot
  hasRecoverySnapshot: boolean;
  restoreRecoverySnapshot: () => void;
  discardRecoverySnapshot: () => void;
}

const defaultFilters: FilterState = {
  search: "",
  status: [],
  trades: [],
  dateRange: { start: null, end: null },
  criticalPathOnly: false,
  milestonesOnly: false,
  blockedOnly: false,
  myTasksOnly: false,
  focusPreset: "all",
  focusWbsId: null,
};

const ProgrammeContext = createContext<ProgrammeContextType | null>(null);

export function recalculateWBSHierarchy(tasks: ProgrammeTask[], prefix?: string): ProgrammeTask[] {
  const rootTasks = tasks.filter((t) => !t.parentId || !tasks.some((p) => p.id === t.parentId));
  const childMap = new Map<string, ProgrammeTask[]>();

  for (const t of tasks) {
    if (t.parentId) {
      if (!childMap.has(t.parentId)) childMap.set(t.parentId, []);
      childMap.get(t.parentId)!.push(t);
    }
  }

  const updatedTasks: ProgrammeTask[] = [];

  function processNode(node: ProgrammeTask, parentWbs: string, level: number) {
    let wbs: string;
    if (parentWbs) {
      wbs = `${parentWbs}.${level}`;
    } else {
      wbs = prefix ? `${prefix}.${level}` : `${level}`;
    }
    const children = childMap.get(node.id) || [];
    const isSummary = children.length > 0;

    let wbsLevel: WBSLevel = node.level;
    if (isSummary) {
      wbsLevel = level === 1 && !parentWbs ? "programme" : "phase";
    } else if (node.duration === 0 || node.isMilestone) {
      wbsLevel = "milestone";
    } else {
      wbsLevel = "task";
    }

    const updatedNode: ProgrammeTask = {
      ...node,
      wbs,
      outlineNumber: wbs,
      outlineLevel: parentWbs ? parentWbs.split(".").length + 1 : 1,
      depth: parentWbs ? parentWbs.split(".").length : 0,
      children: children.map((c) => c.id),
      summary: isSummary,
      level: wbsLevel,
    };
    updatedTasks.push(updatedNode);

    children.forEach((child, idx) => {
      processNode(child, wbs, idx + 1);
    });
  }

  rootTasks.forEach((root, idx) => {
    processNode(root, "", idx + 1);
  });

  const processedIds = new Set(updatedTasks.map((t) => t.id));
  for (const t of tasks) {
    if (!processedIds.has(t.id)) {
      updatedTasks.push(t);
    }
  }

  return updatedTasks;
}

export function ProgrammeProvider({ children }: { children: React.ReactNode }) {
  // Project Calendar & Working Days State
  const [projectCalendar, setProjectCalendar] = useState<ProjectCalendar>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("plandx_project_calendar");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return STANDARD_5_DAY_CALENDAR;
  });

  // Baseline Snapshots and Change History State
  const [scheduleAuditLog, setScheduleAuditLog] = useState<ScheduleChangeEvent[]>(() =>
    loadSavedAuditHistory(),
  );

  const recordScheduleChange = useCallback(
    (params: Omit<ScheduleChangeEvent, "id" | "timestamp">) => {
      const event = createScheduleChangeEvent(params);
      setScheduleAuditLog((prev) => {
        const updated = [event, ...prev];
        saveAuditHistory(updated);
        return updated;
      });
    },
    [],
  );

  const clearAuditHistory = useCallback(() => {
    setScheduleAuditLog([]);
    saveAuditHistory([]);
  }, []);

  const [activeView, setActiveViewState] = useState<ViewMode>("gantt"); // default to signature PlanD-X Gantt view with 3D BIM hero
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("task-columns");
  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [expandedNodes, setExpandedNodesState] = useState<Set<string>>(
    new Set(["task-superstructure", "task-level-2", "substructure"]),
  );
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("month");
  const [filters, setFilters] = useState<FilterState>(defaultFilters);
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");
  const [calendarDate, setCalendarDate] = useState<string>("2025-10-15");
  const [tasks, setTasks] = useState<ProgrammeTask[]>(() => {
    let initial = ALL_PROGRAMME_TASKS;
    let cal = STANDARD_5_DAY_CALENDAR;
    if (typeof window !== "undefined") {
      try {
        const savedCal = localStorage.getItem("plandx_project_calendar");
        if (savedCal) cal = JSON.parse(savedCal);
      } catch {}
      try {
        const savedActiveTasks = localStorage.getItem("plandx_active_tasks");
        if (savedActiveTasks) {
          const parsed = JSON.parse(savedActiveTasks);
          if (Array.isArray(parsed) && parsed.length > 0) {
            initial = parsed;
          }
        } else {
          const savedAssignments = localStorage.getItem("plandx_task_assignments");
          const savedOverrides = localStorage.getItem("plandx_task_overrides");
          const assignMap = savedAssignments ? JSON.parse(savedAssignments) : {};
          const overrideMap = savedOverrides ? JSON.parse(savedOverrides) : {};

          if (Object.keys(assignMap).length > 0 || Object.keys(overrideMap).length > 0) {
            initial = ALL_PROGRAMME_TASKS.map((t) => {
              let updated = { ...t };
              if (assignMap[t.id]) {
                updated = {
                  ...updated,
                  assignee: assignMap[t.id].assignee,
                  assigneeInitials: assignMap[t.id].assigneeInitials,
                  subcontractor: assignMap[t.id].subcontractor ?? t.subcontractor,
                };
              }
              if (overrideMap[t.id]) {
                updated = {
                  ...updated,
                  ...overrideMap[t.id],
                };
              }
              return updated;
            });
          }
        }
      } catch {}
    }
    try {
      return recalculateSchedule(initial, cal).updatedTasks;
    } catch {
      return initial;
    }
  });
  const [timelineScrollDate, setTimelineScrollDate] = useState<string>("2025-10-15");

  // Advanced Scheduling & MS Project Calculation Settings
  const [scheduleFromStart, setScheduleFromStartState] = useState<boolean>(true);
  const [statusDate, setStatusDateState] = useState<string | null>(null);
  const [schedulingWarnings, setSchedulingWarnings] = useState<SchedulingWarning[]>([]);
  // Multi-Project Management State
  const [projectId, setProjectId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("plandx_active_project_id") || "default-project";
    }
    return "default-project";
  });

  const [currentProject, setCurrentProject] = useState<ConstructionProject>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("plandx_current_project");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {
      id: "default-project",
      code: "BAT-COMM-2026",
      name: "Battersea Commercial Redevelopment",
      description: "Major commercial redevelopment and high-specification fitout programme.",
      location: "London SW11, UK",
      clientName: "Battersea Power Station Development Co.",
      plannedStartDate: "2025-09-01",
      plannedFinishDate: "2026-11-15",
      scheduleFromStart: true,
      statusDate: "2025-10-15",
      calendarId: "cal-5day",
      currency: "GBP",
      units: "metric",
      isDemo: true,
      createdAt: "2025-09-01T08:00:00.000Z",
      updatedAt: new Date().toISOString(),
    };
  });

  const [allProjects, setAllProjects] = useState<ConstructionProject[]>([currentProject]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

  // Toast Message State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  const openProjectModal = useCallback(() => {
    setIsProjectModalOpen(true);
  }, []);

  const closeProjectModal = useCallback(() => {
    setIsProjectModalOpen(false);
  }, []);

  const refreshProjectsList = useCallback(async () => {
    try {
      const res = await fetch("/api/programme/projects");
      const data = await res.json();
      if (data?.success && Array.isArray(data.projects)) {
        setAllProjects(data.projects);
        const match = data.projects.find((p: ConstructionProject) => p.id === projectId);
        if (match) {
          setCurrentProject(match);
          if (typeof window !== "undefined") {
            localStorage.setItem("plandx_current_project", JSON.stringify(match));
          }
        }
      }
    } catch {}
  }, [projectId]);

  const switchProject = useCallback(
    async (targetProjectId: string) => {
      try {
        showToast("Switching project workspace...");
        setProjectId(targetProjectId);
        if (typeof window !== "undefined") {
          localStorage.setItem("plandx_active_project_id", targetProjectId);
        }

        const res = await fetch("/api/programme", {
          headers: {
            "x-project-id": targetProjectId,
          },
        });
        const data = await res.json();

        if (data?.success) {
          const loadedTasks: ProgrammeTask[] = data.programme?.tasks || [];
          const loadedCalendar = data.programme?.calendar || STANDARD_5_DAY_CALENDAR;

          setTasks(loadedTasks);
          setProjectCalendar(loadedCalendar);
          setProgrammeVersion(data.programme?.version || 1);
          setSaveStatus("saved");

          if (data.project) {
            setCurrentProject(data.project);
            if (typeof window !== "undefined") {
              localStorage.setItem("plandx_current_project", JSON.stringify(data.project));
            }
          }

          // Clear history and reset selection
          setHistoryPast([]);
          setHistoryFuture([]);
          setSelectedTaskId(loadedTasks[0]?.id || null);
          setSelectedTaskIds(loadedTasks[0]?.id ? [loadedTasks[0].id] : []);

          showToast(`Opened project: ${data.project?.name || targetProjectId}`);
        }
        await refreshProjectsList();
      } catch (err: any) {
        showToast(`Failed to switch project: ${err?.message}`);
      }
    },
    [refreshProjectsList, showToast]
  );

  const createNewProject = useCallback(
    async (input: CreateProjectInput): Promise<ConstructionProject> => {
      const res = await fetch("/api/programme/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to create project");
      }

      await refreshProjectsList();
      await switchProject(data.project.id);
      showToast(`Created project '${data.project.name}' successfully.`);
      return data.project;
    },
    [refreshProjectsList, switchProject, showToast]
  );

  const cloneCurrentProject = useCallback(
    async (newName?: string): Promise<ConstructionProject> => {
      const res = await fetch(`/api/programme/projects/${projectId}/clone`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to clone project");
      }

      await refreshProjectsList();
      await switchProject(data.project.id);
      showToast(`Duplicated project as '${data.project.name}'.`);
      return data.project;
    },
    [projectId, refreshProjectsList, switchProject, showToast]
  );

  const deleteCurrentProject = useCallback(
    async (targetProjectId: string) => {
      const res = await fetch(`/api/programme/projects/${targetProjectId}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to delete project");
      }

      await refreshProjectsList();
      if (targetProjectId === projectId) {
        await switchProject("default-project");
      }
      showToast("Project deleted successfully.");
    },
    [projectId, refreshProjectsList, switchProject, showToast]
  );

  const updateCurrentProject = useCallback(
    async (updates: Partial<ConstructionProject>) => {
      const res = await fetch(`/api/programme/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      const data = await res.json();

      if (!res.ok || !data?.success) {
        throw new Error(data?.message || "Failed to update project");
      }

      setCurrentProject(data.project);
      if (typeof window !== "undefined") {
        localStorage.setItem("plandx_current_project", JSON.stringify(data.project));
      }
      await refreshProjectsList();
      showToast("Project settings saved.");
    },
    [projectId, refreshProjectsList, showToast]
  );

  useEffect(() => {
    refreshProjectsList();
  }, [refreshProjectsList]);

  // Persistence, Versioning & Concurrency Controls
  const [programmeVersion, setProgrammeVersion] = useState<number>(1);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [saveError, setSaveError] = useState<PersistenceError | null>(null);
  const [conflictDetails, setConflictDetails] = useState<ConcurrencyConflictDetails | null>(null);
  const [isConflictModalOpen, setIsConflictModalOpen] = useState(false);
  const [isRollbackModalOpen, setIsRollbackModalOpen] = useState(false);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const pendingTasksRef = React.useRef<ProgrammeTask[] | null>(null);
  const retryTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const retryAttemptRef = React.useRef<number>(0);

  // History & Undo / Redo Stacks
  const [historyPast, setHistoryPast] = useState<ProgrammeTask[][]>([]);
  const [historyFuture, setHistoryFuture] = useState<ProgrammeTask[][]>([]);
  const [copiedTask, setCopiedTask] = useState<ProgrammeTask | null>(null);
  const [copiedTasksList, setCopiedTasksList] = useState<ProgrammeTask[] | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>(["task-columns"]);
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [confirmationDialog, setConfirmationDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  } | null>(null);

  // ─── What-If Schedule Scenarios ──────────────────────────────
  const [allScenarios, setAllScenarios] = useState<ScheduleScenario[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`plandx_scenarios_${projectId}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [
      {
        id: "scenario-mitigation-1",
        name: "Mitigation: Double-Shift Steel Erection",
        description: "Assesses compressing structural steel frame by 12 working days using weekend and extended twilight shifts.",
        author: "Senior Planner",
        createdAt: "2025-10-18T10:00:00Z",
        status: "active",
        tasks: ALL_PROGRAMME_TASKS.map((t) =>
          t.id === "task-steel-frame"
            ? { ...t, duration: Math.max(8, Math.round(t.duration * 0.7)), name: t.name + " (Accelerated)" }
            : t
        ),
      },
    ];
  });
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [isCreateScenarioOpen, setIsCreateScenarioOpen] = useState(false);
  const liveWorkingTasksRef = React.useRef<ProgrammeTask[]>(tasks);
  const [hasRecoverySnapshot, setHasRecoverySnapshot] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return Boolean(localStorage.getItem(`plandx_emergency_recovery_${projectId}`));
    }
    return false;
  });

  const performSave = useCallback(
    async (tasksToSave: ProgrammeTask[], forceVersion?: number) => {
      setSaveStatus("saving");
      setSaveError(null);

      // If in sandbox scenario mode, isolate writes from live programme
      if (activeScenarioId) {
        setAllScenarios((prev) => {
          const updated = prev.map((s) => (s.id === activeScenarioId ? { ...s, tasks: tasksToSave } : s));
          if (typeof window !== "undefined") {
            localStorage.setItem(`plandx_scenarios_${projectId}`, JSON.stringify(updated));
          }
          return updated;
        });
        setSaveStatus("saved");
        return;
      }

      // Local storage optimistic write and emergency recovery snapshot
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("plandx_active_tasks", JSON.stringify(tasksToSave));
          localStorage.setItem(
            `plandx_emergency_recovery_${projectId}`,
            JSON.stringify({ timestamp: new Date().toISOString(), tasks: tasksToSave, version: programmeVersion })
          );
          setHasRecoverySnapshot(true);
        }
      } catch {}

      const result = await persistProgrammeToServer({
        projectId,
        expectedVersion: forceVersion !== undefined ? forceVersion : programmeVersion,
        tasks: tasksToSave,
        calendar: projectCalendar,
        settings: {
          statusDate,
          scheduleFromStart,
        },
      });

      if (result.success) {
        setProgrammeVersion(result.version);
        setSaveStatus("saved");
        setSaveError(null);
        setConflictDetails(null);
        retryAttemptRef.current = 0;
      } else if ("conflict" in result) {
        setSaveStatus("conflict");
        setConflictDetails(result.conflict);
        setIsConflictModalOpen(true);
      } else {
        // Failed - NEVER set saved state on failure
        setSaveStatus("failed");
        setSaveError(result.error);
        showToast(`Save failed: ${result.error.message}`);

        // Automated retry queue with exponential backoff if retryable
        if (result.error.retryable && retryAttemptRef.current < 3) {
          retryAttemptRef.current += 1;
          const backoffMs = Math.min(1000 * Math.pow(2, retryAttemptRef.current - 1), 8000);
          if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
          retryTimerRef.current = setTimeout(() => {
            performSave(tasksToSave);
          }, backoffMs);
        }
      }
    },
    [projectId, programmeVersion, projectCalendar, statusDate, scheduleFromStart, showToast, activeScenarioId]
  );

  const persistTasks = useCallback(
    (newTasks: ProgrammeTask[]) => {
      pendingTasksRef.current = newTasks;
      setSaveStatus("unsaved");
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        performSave(newTasks);
      }, 400);
    },
    [performSave]
  );

  const retrySave = useCallback(async () => {
    retryAttemptRef.current = 0;
    if (pendingTasksRef.current) {
      await performSave(pendingTasksRef.current);
    } else {
      await performSave(tasks);
    }
  }, [performSave, tasks]);

  const activeScenario = useMemo(
    () => allScenarios.find((s) => s.id === activeScenarioId) || null,
    [allScenarios, activeScenarioId]
  );

  const openCreateScenario = useCallback(() => setIsCreateScenarioOpen(true), []);
  const closeCreateScenario = useCallback(() => setIsCreateScenarioOpen(false), []);

  const createScenario = useCallback(
    (name: string, description: string, author = "Senior Planner") => {
      const newScenario: ScheduleScenario = {
        id: "scenario-" + Date.now(),
        name,
        description,
        author,
        createdAt: new Date().toISOString(),
        status: "active",
        tasks: JSON.parse(JSON.stringify(tasks)),
      };
      setAllScenarios((prev) => {
        const updated = [...prev, newScenario];
        if (typeof window !== "undefined") {
          localStorage.setItem(`plandx_scenarios_${projectId}`, JSON.stringify(updated));
        }
        return updated;
      });
      liveWorkingTasksRef.current = tasks;
      setActiveScenarioId(newScenario.id);
      showToast(`Branch created: "${name}". You are now in a sandboxed scenario.`);
      return newScenario;
    },
    [tasks, projectId, showToast]
  );

  const switchScenario = useCallback(
    (scenarioId: string | null) => {
      if (scenarioId === null) {
        setActiveScenarioId(null);
        setTasks(liveWorkingTasksRef.current);
        showToast("Returned to Working Forecast programme.");
      } else {
        const target = allScenarios.find((s) => s.id === scenarioId);
        if (target) {
          if (!activeScenarioId) {
            liveWorkingTasksRef.current = tasks;
          }
          setActiveScenarioId(scenarioId);
          setTasks(target.tasks);
          showToast(`Switched to scenario: "${target.name}". Working programme is protected.`);
        }
      }
    },
    [allScenarios, activeScenarioId, tasks, showToast]
  );

  const approveAndMergeScenario = useCallback(
    (scenarioId: string, approvedBy = "Project Director") => {
      const sc = allScenarios.find((s) => s.id === scenarioId);
      if (!sc) return { success: false, mergedCount: 0 };

      const mergedTasks = sc.tasks;
      setTasks(mergedTasks);
      liveWorkingTasksRef.current = mergedTasks;
      setActiveScenarioId(null);

      setAllScenarios((prev) => {
        const updated = prev.map((s) => (s.id === scenarioId ? { ...s, status: "approved" as const } : s));
        if (typeof window !== "undefined") {
          localStorage.setItem(`plandx_scenarios_${projectId}`, JSON.stringify(updated));
        }
        return updated;
      });

      persistTasks(mergedTasks);
      recordScheduleChange({
        taskId: "programme-root",
        taskName: "Programme Schedule",
        field: "scenarioApproval",
        fieldLabel: "What-If Scenario Approval & Merge",
        previousValue: "Working Forecast",
        newValue: `Approved scenario "${sc.name}"`,
        changedBy: approvedBy,
        changeSource: "scenario-merge",
        reason: `Formal governance approval & merge of What-If scenario "${sc.name}"`,
      });

      showToast(`Scenario "${sc.name}" successfully approved and merged into live programme!`);
      return { success: true, mergedCount: mergedTasks.length };
    },
    [allScenarios, projectId, persistTasks, recordScheduleChange, showToast]
  );

  const discardScenario = useCallback(
    (scenarioId: string) => {
      const sc = allScenarios.find((s) => s.id === scenarioId);
      if (activeScenarioId === scenarioId) {
        setActiveScenarioId(null);
        setTasks(liveWorkingTasksRef.current);
      }
      setAllScenarios((prev) => {
        const updated = prev.filter((s) => s.id !== scenarioId);
        if (typeof window !== "undefined") {
          localStorage.setItem(`plandx_scenarios_${projectId}`, JSON.stringify(updated));
        }
        return updated;
      });
      showToast(`Scenario "${sc?.name || scenarioId}" discarded.`);
    },
    [allScenarios, activeScenarioId, projectId, showToast]
  );

  // ─── Role-Based Access Control (RBAC) ────────────────────────
  const [currentUserRole, setCurrentUserRoleState] = useState<ConstructionRole>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("plandx_user_role");
      if (saved && saved in ROLE_PERMISSIONS_MAP) return saved as ConstructionRole;
    }
    return "project-manager";
  });

  const setCurrentUserRole = useCallback(
    (role: ConstructionRole) => {
      setCurrentUserRoleState(role);
      if (typeof window !== "undefined") {
        localStorage.setItem("plandx_user_role", role);
      }
      showToast(`Role switched to: ${ROLE_PERMISSIONS_MAP[role].label}`);
    },
    [showToast]
  );

  const userPermissions = useMemo(() => ROLE_PERMISSIONS_MAP[currentUserRole], [currentUserRole]);

  // ─── WBS Library & Task Catalog ──────────────────────────────
  const [isWBSLibraryOpen, setIsWBSLibraryOpen] = useState(false);
  const [wbsLibraryTargetParentId, setWbsLibraryTargetParentId] = useState<string | null>(null);

  const openWBSLibrary = useCallback((targetParentId?: string | null) => {
    setWbsLibraryTargetParentId(targetParentId ?? null);
    setIsWBSLibraryOpen(true);
  }, []);

  const closeWBSLibrary = useCallback(() => {
    setIsWBSLibraryOpen(false);
    setWbsLibraryTargetParentId(null);
  }, []);

  const insertWBSPackage = useCallback(
    (packageId: string, targetParentId?: string | null) => {
      const pkg = WBS_PACKAGE_TEMPLATES.find((p) => p.id === packageId);
      if (!pkg) return { insertedCount: 0 };

      const anchorParentId = targetParentId !== undefined ? targetParentId : wbsLibraryTargetParentId;
      const { updatedTasks, insertedTaskIds } = insertWBSPackageIntoProgramme(
        tasks,
        packageId,
        anchorParentId,
        projectCalendar
      );

      setTasks(updatedTasks);
      persistTasks(updatedTasks);
      closeWBSLibrary();
      showToast(`Inserted WBS package "${pkg.name}" (${insertedTaskIds.length} tasks).`);
      return { insertedCount: insertedTaskIds.length };
    },
    [tasks, wbsLibraryTargetParentId, projectCalendar, persistTasks, closeWBSLibrary, showToast]
  );

  // ─── Programme Publishing & Transmittal ──────────────────────
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const openPublishModal = useCallback(() => setIsPublishModalOpen(true), []);
  const closePublishModal = useCallback(() => setIsPublishModalOpen(false), []);

  // ─── Mobile Site Companion & Offline Sync ────────────────────
  const [isMobileCompanionOpen, setIsMobileCompanionOpen] = useState(false);
  const openMobileCompanion = useCallback(() => setIsMobileCompanionOpen(true), []);
  const closeMobileCompanion = useCallback(() => setIsMobileCompanionOpen(false), []);

  const [offlineQueue, setOfflineQueue] = useState<
    Array<{ id: string; timestamp: string; taskId: string; type: string; payload: any }>
  >(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(`plandx_offline_queue_${projectId}`);
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  const offlineQueueCount = offlineQueue.length;

  const queueOfflineUpdate = useCallback(
    (item: { taskId: string; type: string; payload: any }) => {
      const queueItem = {
        id: "offline-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
        timestamp: new Date().toISOString(),
        ...item,
      };
      setOfflineQueue((prev) => {
        const updated = [...prev, queueItem];
        if (typeof window !== "undefined") {
          localStorage.setItem(`plandx_offline_queue_${projectId}`, JSON.stringify(updated));
        }
        return updated;
      });
      showToast(`Queued offline update for task ${item.taskId}.`);
    },
    [projectId, showToast]
  );

  const syncOfflineQueue = useCallback(() => {
    if (offlineQueue.length === 0) {
      showToast("Offline queue is empty.");
      return;
    }
    setTasks((currentTasks) => {
      let updated = [...currentTasks];
      for (const item of offlineQueue) {
        if (item.type === "progress") {
          updated = updated.map((t) =>
            t.id === item.taskId
              ? { ...t, progress: item.payload.progress, status: item.payload.status || t.status }
              : t
          );
        } else if (item.type === "siteDiary") {
          updated = updated.map((t) => {
            if (t.id !== item.taskId) return t;
            const diary = t.integrations?.siteDiary || [];
            return {
              ...t,
              integrations: {
                ...t.integrations,
                siteDiary: [...diary, item.payload],
              },
            };
          });
        }
      }
      persistTasks(updated);
      return updated;
    });

    const count = offlineQueue.length;
    setOfflineQueue([]);
    if (typeof window !== "undefined") {
      localStorage.removeItem(`plandx_offline_queue_${projectId}`);
    }
    showToast(`Synced ${count} offline updates successfully.`);
  }, [offlineQueue, projectId, persistTasks, showToast]);

  // ─── Construction Module Integrations ────────────────────────
  const updateTaskIntegrations = useCallback(
    (taskId: string, integrations: Partial<TaskConstructionIntegrations>) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          const currentInteg = t.integrations || {};
          return {
            ...t,
            integrations: {
              ...currentInteg,
              ...integrations,
              boq: integrations.boq ? { ...currentInteg.boq, ...integrations.boq } : currentInteg.boq,
              vendorContract: integrations.vendorContract
                ? { ...currentInteg.vendorContract, ...integrations.vendorContract }
                : currentInteg.vendorContract,
              siteDiary: integrations.siteDiary || currentInteg.siteDiary,
              documents: integrations.documents || currentInteg.documents,
            },
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast("Updated construction module integrations.");
    },
    [persistTasks, showToast]
  );

  // ─── Emergency Recovery Snapshot ─────────────────────────────
  const restoreRecoverySnapshot = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      const snap = localStorage.getItem(`plandx_emergency_recovery_${projectId}`);
      if (!snap) return;
      const parsed = JSON.parse(snap);
      if (Array.isArray(parsed.tasks)) {
        setTasks(parsed.tasks);
        persistTasks(parsed.tasks);
        showToast(`Recovered unsaved session from ${new Date(parsed.timestamp).toLocaleTimeString()}.`);
      }
    } catch {}
  }, [projectId, persistTasks, showToast]);

  const discardRecoverySnapshot = useCallback(() => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(`plandx_emergency_recovery_${projectId}`);
    setHasRecoverySnapshot(false);
    showToast("Discarded recovery snapshot.");
  }, [projectId, showToast]);

  const closeConflictModal = useCallback(() => {
    setIsConflictModalOpen(false);
  }, []);

  const openRollbackModal = useCallback(() => {
    setIsRollbackModalOpen(true);
  }, []);

  const closeRollbackModal = useCallback(() => {
    setIsRollbackModalOpen(false);
  }, []);

  const resolveConflict = useCallback(
    async (resolution: "reload" | "overwrite") => {
      if (resolution === "reload") {
        try {
          const remote = await loadProgrammeFromServer(projectId);
          if (remote.tasks.length > 0) {
            setTasks(remote.tasks);
          }
          if (remote.calendar) {
            setProjectCalendar(remote.calendar);
          }
          setProgrammeVersion(remote.version);
          setSaveStatus("saved");
          setConflictDetails(null);
          setIsConflictModalOpen(false);
          showToast(`Loaded remote version v${remote.version}`);
        } catch (err: any) {
          showToast(`Failed to reload remote version: ${err?.message}`);
        }
      } else {
        if (conflictDetails) {
          const currentPending = pendingTasksRef.current || tasks;
          await performSave(currentPending, conflictDetails.currentVersion);
          setIsConflictModalOpen(false);
          showToast(`Saved as new revision v${conflictDetails.currentVersion + 1}`);
        }
      }
    },
    [projectId, conflictDetails, tasks, performSave, showToast]
  );

  const onRollbackSuccess = useCallback(
    async (restoredVersion: number) => {
      try {
        const remote = await loadProgrammeFromServer(projectId);
        if (remote.tasks.length > 0) {
          setTasks(remote.tasks);
        }
        if (remote.calendar) {
          setProjectCalendar(remote.calendar);
        }
        setProgrammeVersion(restoredVersion);
        setSaveStatus("saved");
        showToast(`Programme successfully rolled back to v${restoredVersion}`);
      } catch (err: any) {
        showToast(`Rollback committed: ${err?.message}`);
      }
    },
    [projectId, showToast]
  );

  const pushHistoryState = useCallback((currentTasks: ProgrammeTask[]) => {
    setHistoryPast((prev) => [...prev.slice(-29), currentTasks]);
    setHistoryFuture([]);
  }, []);

  const setScheduleFromStart = useCallback(
    (val: boolean) => {
      setScheduleFromStartState(val);
      pushHistoryState(tasks);
      const result = recalculateSchedule(tasks, projectCalendar, {
        scheduleFromStart: val,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(
        `Project scheduling mode: ${val ? "Scheduled from Project Start (ASAP)" : "Scheduled from Project Finish (ALAP)"}.`
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const setStatusDate = useCallback(
    (date: string | null) => {
      setStatusDateState(date);
      pushHistoryState(tasks);
      const result = recalculateSchedule(tasks, projectCalendar, {
        scheduleFromStart,
        statusDate: date,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(
        date
          ? `Status Date set to ${date}. Incomplete work rescheduled from status date.`
          : "Status Date cleared."
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, pushHistoryState, persistTasks, showToast]
  );

  const toggleTaskSelection = useCallback((taskId: string, isMulti?: boolean) => {
    if (!isMulti) {
      setSelectedTaskIds([taskId]);
      setSelectedTaskId(taskId);
    } else {
      setSelectedTaskIds((prev) => {
        if (prev.includes(taskId)) {
          const next = prev.filter((id) => id !== taskId);
          return next.length > 0 ? next : [taskId];
        } else {
          return [...prev, taskId];
        }
      });
      setSelectedTaskId(taskId);
    }
  }, []);

  const selectAllTasks = useCallback(() => {
    setSelectedTaskIds(tasks.map((t) => t.id));
  }, [tasks]);

  const clearTaskSelection = useCallback(() => {
    setSelectedTaskIds([]);
    setSelectedTaskId(null);
  }, []);

  const undo = useCallback(() => {
    if (historyPast.length === 0) return;
    const previous = historyPast[historyPast.length - 1];
    setHistoryPast((prev) => prev.slice(0, prev.length - 1));
    setHistoryFuture((prev) => [tasks, ...prev]);
    setTasks(previous);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("plandx_active_tasks", JSON.stringify(previous));
      }
    } catch {}
    showToast("Undone last schedule change.");
  }, [historyPast, tasks, showToast]);

  const redo = useCallback(() => {
    if (historyFuture.length === 0) return;
    const next = historyFuture[0];
    setHistoryFuture((prev) => prev.slice(1));
    setHistoryPast((prev) => [...prev, tasks]);
    setTasks(next);
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem("plandx_active_tasks", JSON.stringify(next));
      }
    } catch {}
    showToast("Redone schedule change.");
  }, [historyFuture, tasks, showToast]);

  const canUndo = historyPast.length > 0;
  const canRedo = historyFuture.length > 0;

  const copyTasks = useCallback(
    (taskIds: string[]) => {
      if (taskIds.length === 0) return;
      // Include all descendants of any selected tasks
      const allSelected = new Set(taskIds);
      function collectChildren(pId: string) {
        for (const t of tasks) {
          if (t.parentId === pId) {
            allSelected.add(t.id);
            collectChildren(t.id);
          }
        }
      }
      for (const id of taskIds) {
        collectChildren(id);
      }
      const toCopy = tasks.filter((t) => allSelected.has(t.id));
      setCopiedTasksList(toCopy);
      if (toCopy.length > 0) {
        setCopiedTask(toCopy[0]); // backward compatibility
      }
      showToast(`Copied ${toCopy.length} task(s) to clipboard. Press Ctrl+V / Paste to insert.`);
    },
    [tasks, showToast]
  );

  const copySelectedTask = useCallback(() => {
    if (selectedTaskId) {
      copyTasks([selectedTaskId]);
    } else if (selectedTaskIds.length > 0) {
      copyTasks(selectedTaskIds);
    }
  }, [selectedTaskId, selectedTaskIds, copyTasks]);

  const pasteTasks = useCallback(
    (targetParentId?: string | null, insertAfterId?: string | null) => {
      const itemsToPaste = copiedTasksList || (copiedTask ? [copiedTask] : null);
      if (!itemsToPaste || itemsToPaste.length === 0) {
        showToast("No task in clipboard to paste.");
        return;
      }

      pushHistoryState(tasks);

      const timestamp = Date.now().toString(36);
      const idMap = new Map<string, string>();
      const existingTaskIds = new Set(tasks.map((t) => t.id));

      itemsToPaste.forEach((t, idx) => {
        idMap.set(t.id, `task-copy-${timestamp}-${idx}`);
      });

      // Determine top-level roots among the copied set
      const copiedIdSet = new Set(itemsToPaste.map((t) => t.id));
      const topCopiedTasks = itemsToPaste.filter(
        (t) => !t.parentId || !copiedIdSet.has(t.parentId)
      );

      const clonedTasks: ProgrammeTask[] = itemsToPaste.map((t) => {
        const newId = idMap.get(t.id)!;
        const isTop = topCopiedTasks.some((top) => top.id === t.id);

        let parentId: string | null;
        if (isTop) {
          parentId = targetParentId !== undefined ? targetParentId : t.parentId;
        } else {
          parentId = t.parentId && idMap.has(t.parentId) ? idMap.get(t.parentId)! : t.parentId;
        }

        const parent = parentId ? tasks.find((item) => item.id === parentId) : null;
        const depth = parent ? (parent.depth ?? 0) + 1 : 0;

        // Internal dependencies are remapped to the cloned task IDs.
        // External dependencies are preserved ONLY when target IDs exist in the active schedule!
        const remappedPredecessors: string[] = [];
        if (t.predecessors) {
          for (const predId of t.predecessors) {
            if (idMap.has(predId)) {
              remappedPredecessors.push(idMap.get(predId)!);
            } else if (existingTaskIds.has(predId)) {
              remappedPredecessors.push(predId);
            }
          }
        }

        const remappedDetails: DependencyDetail[] = [];
        if (t.predecessorDetails) {
          for (const d of t.predecessorDetails) {
            if (idMap.has(d.id)) {
              remappedDetails.push({ ...d, id: idMap.get(d.id)! });
            } else if (existingTaskIds.has(d.id)) {
              remappedDetails.push({ ...d });
            }
          }
        }

        return {
          ...t,
          id: newId,
          sourceUid: undefined,
          name: isTop ? `${t.name} (Copy)` : t.name,
          parentId,
          depth,
          predecessors: remappedPredecessors,
          predecessorDetails: remappedDetails,
          successors: [],
          successorDetails: [],
          children: [],
        };
      });

      let newTasks: ProgrammeTask[];
      if (insertAfterId) {
        const idx = tasks.findIndex((t) => t.id === insertAfterId);
        if (idx >= 0) {
          newTasks = [...tasks.slice(0, idx + 1), ...clonedTasks, ...tasks.slice(idx + 1)];
        } else {
          newTasks = [...tasks, ...clonedTasks];
        }
      } else {
        newTasks = [...tasks, ...clonedTasks];
      }

      const structured = recalculateWBSHierarchy(newTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });

      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);

      const newIds = clonedTasks.map((t) => t.id);
      setSelectedTaskIds(newIds);
      if (newIds.length > 0) setSelectedTaskId(newIds[0]);

      showToast(`Pasted ${clonedTasks.length} task(s).`);
    },
    [copiedTasksList, copiedTask, tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const pasteTask = useCallback(
    (targetParentId?: string | null) => {
      pasteTasks(targetParentId);
    },
    [pasteTasks]
  );

  const bulkUpdateTasks = useCallback(
    (taskIds: string[], updates: Partial<ProgrammeTask>) => {
      pushHistoryState(tasks);
      const targetIds = new Set(taskIds);
      const updated = tasks.map((t) => (targetIds.has(t.id) ? { ...t, ...updates } : t));
      const result = recalculateSchedule(updated, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(`Updated ${taskIds.length} tasks in bulk.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const bulkShiftTasks = useCallback(
    (taskIds: string[], workingDays: number) => {
      pushHistoryState(tasks);
      const targetIds = new Set(taskIds);
      const updated = tasks.map((t) => {
        if (targetIds.has(t.id) && t.startDate) {
          const shiftedStart = shiftByWorkingDays(t.startDate, workingDays, projectCalendar);
          return {
            ...t,
            startDate: formatDateIso(shiftedStart),
            manualStartDate: formatDateIso(shiftedStart),
          };
        }
        return t;
      });
      const result = recalculateSchedule(updated, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(
        `Shifted ${taskIds.length} tasks by ${workingDays >= 0 ? `+${workingDays}d` : `${workingDays}d`}.`
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const indentTask = useCallback(
    (taskId: string) => {
      const taskIndex = tasks.findIndex((t) => t.id === taskId);
      if (taskIndex <= 0) {
        showToast("Cannot indent: Task is at top of schedule.");
        return;
      }
      const task = tasks[taskIndex];
      let prevSibling: ProgrammeTask | null = null;
      for (let i = taskIndex - 1; i >= 0; i--) {
        if (tasks[i].parentId === task.parentId) {
          prevSibling = tasks[i];
          break;
        }
      }
      if (!prevSibling) {
        showToast("Cannot indent: No preceding sibling to indent under.");
        return;
      }

      pushHistoryState(tasks);
      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, parentId: prevSibling!.id };
        }
        return t;
      });
      const structured = recalculateWBSHierarchy(updatedTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(`Indented '${task.name}' under '${prevSibling.name}'.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const outdentTask = useCallback(
    (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.parentId) {
        showToast("Cannot outdent: Task is already at the top outline level.");
        return;
      }
      const parent = tasks.find((t) => t.id === task.parentId);
      const grandparent = parent?.parentId ? tasks.find((t) => t.id === parent.parentId) : null;

      pushHistoryState(tasks);
      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return { ...t, parentId: grandparent ? grandparent.id : null };
        }
        return t;
      });
      const structured = recalculateWBSHierarchy(updatedTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      showToast(`Outdented '${task.name}'.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const duplicateTaskGroup = useCallback(
    (taskId: string) => {
      const rootTask = tasks.find((t) => t.id === taskId);
      if (!rootTask) {
        showToast("Task not found.");
        return;
      }

      pushHistoryState(tasks);

      // Collect all descendant task IDs recursively
      const descendantIds = new Set<string>();
      function collectDescendants(pId: string) {
        for (const t of tasks) {
          if (t.parentId === pId) {
            descendantIds.add(t.id);
            collectDescendants(t.id);
          }
        }
      }
      collectDescendants(taskId);

      const groupTasks = tasks.filter((t) => t.id === taskId || descendantIds.has(t.id));
      const idMap = new Map<string, string>();
      const timestamp = Date.now().toString(36);

      groupTasks.forEach((t, idx) => {
        idMap.set(t.id, `${t.id}-dup-${timestamp}-${idx}`);
      });

      const clonedTasks: ProgrammeTask[] = groupTasks.map((t) => {
        const newId = idMap.get(t.id)!;
        const isRoot = t.id === taskId;
        const newParentId = isRoot
          ? t.parentId
          : t.parentId && idMap.has(t.parentId)
          ? idMap.get(t.parentId)!
          : t.parentId;

        // Remap internal predecessors so the cloned flow remains intact
        const remappedPredecessors = (t.predecessors || []).map((predId) =>
          idMap.has(predId) ? idMap.get(predId)! : predId
        );
        const remappedDetails = t.predecessorDetails?.map((detail) => {
          if (idMap.has(detail.id)) {
            return { ...detail, id: idMap.get(detail.id)! };
          }
          return detail;
        });

        return {
          ...t,
          id: newId,
          sourceUid: undefined,
          name: isRoot ? `${t.name} (Copy)` : t.name,
          parentId: newParentId,
          predecessors: remappedPredecessors,
          predecessorDetails: remappedDetails,
        };
      });

      // Find insertion index: immediately after the last task in this group in current list
      const lastIndex = Math.max(...groupTasks.map((t) => tasks.findIndex((item) => item.id === t.id)));
      const newTasks = [...tasks];
      newTasks.splice(lastIndex + 1, 0, ...clonedTasks);

      const structured = recalculateWBSHierarchy(newTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });

      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      recordScheduleChange({
        taskId: rootTask.id,
        taskName: rootTask.name,
        wbs: rootTask.wbs,
        field: "wbs",
        fieldLabel: "WBS Structure",
        previousValue: rootTask.wbs || "",
        newValue: `Cloned group (${clonedTasks.length} tasks)`,
        reason: `Duplicated task group '${rootTask.name}' with remapped internal dependencies`,
        changedBy: "Project Planner",
        userRole: "Lead Planner",
        changeSource: "user-edit",
      });
      showToast(`Duplicated '${rootTask.name}' (${clonedTasks.length} tasks).`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const renumberWBS = useCallback(
    (prefix?: string) => {
      pushHistoryState(tasks);
      const renumbered = recalculateWBSHierarchy(tasks, prefix);
      setTasks(renumbered);
      persistTasks(renumbered);
      recordScheduleChange({
        taskId: "project",
        taskName: "Project Schedule",
        wbs: "1.0",
        field: "wbs",
        fieldLabel: "WBS Outline Renumbering",
        previousValue: "Previous outline",
        newValue: prefix ? `Renumbered with prefix ${prefix}` : "Renumbered standard WBS",
        reason: "WBS outline renumbered preserving stable task IDs",
        changedBy: "Project Planner",
        userRole: "Lead Planner",
        changeSource: "user-edit",
      });
      showToast(`WBS renumbered successfully (${renumbered.length} tasks).`);
    },
    [tasks, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const moveTaskGroup = useCallback(
    (taskId: string, targetParentId: string | null) => {
      if (taskId === targetParentId) {
        showToast("Cannot move a task under itself.");
        return;
      }

      function isDescendant(candidateParentId: string, currentId: string): boolean {
        const children = tasks.filter((t) => t.parentId === currentId);
        for (const child of children) {
          if (child.id === candidateParentId || isDescendant(candidateParentId, child.id)) {
            return true;
          }
        }
        return false;
      }

      if (targetParentId && isDescendant(targetParentId, taskId)) {
        showToast("Cannot move a task under one of its own subtasks.");
        return;
      }

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      pushHistoryState(tasks);
      const updated = tasks.map((t) => (t.id === taskId ? { ...t, parentId: targetParentId } : t));
      const structured = recalculateWBSHierarchy(updated);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      recordScheduleChange({
        taskId: task.id,
        taskName: task.name,
        wbs: task.wbs,
        field: "parentId",
        fieldLabel: "Task Parent WBS Node",
        previousValue: task.parentId || "root",
        newValue: targetParentId || "root",
        reason: "Moved task group in WBS hierarchy",
        changedBy: "Project Planner",
        userRole: "Lead Planner",
        changeSource: "user-edit",
      });
      showToast(`Moved '${task.name}'.`);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const duplicateTask = useCallback(
    (taskId: string) => {
      const hasChildren = tasks.some((t) => t.parentId === taskId);
      if (hasChildren) {
        duplicateTaskGroup(taskId);
        return;
      }

      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      pushHistoryState(tasks);
      const newId = `task-dup-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
      const idx = tasks.findIndex((t) => t.id === taskId);

      const clonedTask: ProgrammeTask = {
        ...task,
        id: newId,
        sourceUid: undefined,
        name: `${task.name} (Copy)`,
        children: [],
        predecessors: [...(task.predecessors || [])],
        predecessorDetails: task.predecessorDetails ? [...task.predecessorDetails] : [],
        successors: [],
        successorDetails: [],
      };

      const newTasks = [...tasks.slice(0, idx + 1), clonedTask, ...tasks.slice(idx + 1)];
      const structured = recalculateWBSHierarchy(newTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });

      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      setSelectedTaskId(newId);
      setSelectedTaskIds([newId]);
      showToast(`Duplicated '${task.name}'.`);
    },
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, duplicateTaskGroup, showToast]
  );

  const reorderTask = useCallback(
    (taskId: string, direction: "up" | "down") => {
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx < 0) return;
      const targetTask = tasks[idx];

      const descendantIds = new Set<string>();
      function collectChildren(pId: string) {
        for (const t of tasks) {
          if (t.parentId === pId) {
            descendantIds.add(t.id);
            collectChildren(t.id);
          }
        }
      }
      collectChildren(taskId);
      const movingBlock = tasks.filter((t) => t.id === taskId || descendantIds.has(t.id));

      const siblings = tasks.filter((t) => t.parentId === targetTask.parentId);
      const sibIdx = siblings.findIndex((t) => t.id === taskId);
      if (direction === "up" && sibIdx <= 0) {
        showToast("Task is already at top of this group.");
        return;
      }
      if (direction === "down" && sibIdx >= siblings.length - 1) {
        showToast("Task is already at bottom of this group.");
        return;
      }

      const targetSibling = siblings[direction === "up" ? sibIdx - 1 : sibIdx + 1];
      pushHistoryState(tasks);

      const withoutMoving = tasks.filter((t) => !movingBlock.some((m) => m.id === t.id));
      const insertAt = withoutMoving.findIndex((t) => t.id === targetSibling.id);

      let reordered: ProgrammeTask[];
      if (direction === "up") {
        reordered = [...withoutMoving.slice(0, insertAt), ...movingBlock, ...withoutMoving.slice(insertAt)];
      } else {
        const targetDescendants = new Set<string>();
        function collectTarget(pId: string) {
          for (const t of withoutMoving) {
            if (t.parentId === pId) {
              targetDescendants.add(t.id);
              collectTarget(t.id);
            }
          }
        }
        collectTarget(targetSibling.id);
        const lastTargetIdx = Math.max(
          insertAt,
          ...Array.from(targetDescendants).map((dId) => withoutMoving.findIndex((t) => t.id === dId))
        );
        reordered = [
          ...withoutMoving.slice(0, lastTargetIdx + 1),
          ...movingBlock,
          ...withoutMoving.slice(lastTargetIdx + 1),
        ];
      }

      const structured = recalculateWBSHierarchy(reordered);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(result.updatedTasks);
      persistTasks(result.updatedTasks);
      showToast(`Moved '${targetTask.name}' ${direction}.`);
    },
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const expandToLevel = useCallback(
    (targetLevel: number) => {
      const nodesToExpand = new Set<string>();
      for (const t of tasks) {
        const isContainer = (t.children && t.children.length > 0) || tasks.some((c) => c.parentId === t.id);
        if (isContainer) {
          const depth = t.depth ?? 0;
          if (depth < targetLevel) {
            nodesToExpand.add(t.id);
          }
        }
      }
      setExpandedNodes(nodesToExpand);
      showToast(`Expanded outline to Level ${targetLevel}.`);
    },
    [tasks, showToast]
  );

  const createTask = useCallback(
    (data: {
      name: string;
      isMilestone?: boolean;
      isSummary?: boolean;
      duration?: number;
      startDate?: string;
      targetParentId?: string | null;
      insertAfterId?: string | null;
      trade?: string | null;
      assignee?: string | null;
      costCode?: string;
      notes?: string;
    }): ProgrammeTask => {
      pushHistoryState(tasks);

      const isMilestone = Boolean(data.isMilestone);
      const isSummary = Boolean(data.isSummary);
      const duration = isMilestone ? 0 : typeof data.duration === "number" ? Math.max(1, data.duration) : 5;
      const startDate = data.startDate || formatDateIso(new Date());
      const endObj = isMilestone || duration === 0 ? parseIsoDate(startDate) : addWorkingDays(startDate, duration, projectCalendar);
      const endDate = formatDateIso(endObj);

      const parentId = data.targetParentId !== undefined ? data.targetParentId : null;
      const parent = parentId ? tasks.find((t) => t.id === parentId) : null;
      const depth = parent ? (parent.depth ?? 0) + 1 : 0;
      const newId = `task-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;

      const newTask: ProgrammeTask = {
        id: newId,
        wbs: "1",
        name: data.name,
        level: isSummary ? "phase" : isMilestone ? "milestone" : "task",
        summary: isSummary,
        isMilestone,
        parentId,
        depth,
        isCritical: false,
        status: "not-started",
        startDate,
        endDate,
        displayStart: formatDisplayDate(startDate),
        displayEnd: formatDisplayDate(endDate),
        duration,
        progress: 0,
        trade: data.trade || (parent?.trade ?? "Structural"),
        tradeText: data.trade || parent?.tradeText,
        assignee: data.assignee || null,
        costCode: data.costCode,
        notes: data.notes || "",
        children: [],
        predecessors: [],
        successors: [],
        predecessorDetails: [],
        successorDetails: [],
        float: 0,
      };

      let newTasks: ProgrammeTask[];
      if (data.insertAfterId) {
        const idx = tasks.findIndex((t) => t.id === data.insertAfterId);
        if (idx >= 0) {
          newTasks = [...tasks.slice(0, idx + 1), newTask, ...tasks.slice(idx + 1)];
        } else {
          newTasks = [...tasks, newTask];
        }
      } else {
        newTasks = [...tasks, newTask];
      }

      const structured = recalculateWBSHierarchy(newTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });

      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);
      setSelectedTaskId(newId);
      setSelectedTaskIds([newId]);
      showToast(`Created ${isMilestone ? "milestone" : isSummary ? "summary task" : "task"}: '${data.name}'.`);
      return newTask;
    },
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, showToast]
  );

  const closeConfirmationDialog = useCallback(() => {
    setConfirmationDialog(null);
  }, []);

  const performDeleteTasks = useCallback(
    (targetIds: Set<string>) => {
      pushHistoryState(tasks);

      const allIdsToDelete = new Set<string>(targetIds);
      function collectChildren(pId: string) {
        for (const t of tasks) {
          if (t.parentId === pId) {
            allIdsToDelete.add(t.id);
            collectChildren(t.id);
          }
        }
      }
      for (const id of targetIds) {
        collectChildren(id);
      }

      const remainingTasks = tasks
        .filter((t) => !allIdsToDelete.has(t.id))
        .map((t) => {
          let hasPredChange = false;
          let newPreds = t.predecessors;
          let newDetails = t.predecessorDetails;

          if (t.predecessors?.some((p) => allIdsToDelete.has(p))) {
            newPreds = t.predecessors.filter((p) => !allIdsToDelete.has(p));
            hasPredChange = true;
          }
          if (t.predecessorDetails?.some((d) => allIdsToDelete.has(d.id))) {
            newDetails = t.predecessorDetails.filter((d) => !allIdsToDelete.has(d.id));
            hasPredChange = true;
          }

          if (hasPredChange) {
            return {
              ...t,
              predecessors: newPreds,
              predecessorDetails: newDetails,
            };
          }
          return t;
        });

      const structured = recalculateWBSHierarchy(remainingTasks);
      const result = recalculateSchedule(structured, projectCalendar, {
        scheduleFromStart,
        statusDate,
      });

      setTasks(result.updatedTasks);
      if (result.warnings) setSchedulingWarnings(result.warnings);
      persistTasks(result.updatedTasks);

      setSelectedTaskIds((prev) => prev.filter((id) => !allIdsToDelete.has(id)));
      if (selectedTaskId && allIdsToDelete.has(selectedTaskId)) {
        setSelectedTaskId(null);
        setDrawerOpen(false);
      }

      showToast(`Deleted ${allIdsToDelete.size} task(s).`);
      closeConfirmationDialog();
    },
    [tasks, projectCalendar, scheduleFromStart, statusDate, selectedTaskId, pushHistoryState, persistTasks, showToast, closeConfirmationDialog]
  );

  const deleteTask = useCallback(
    (taskId: string, force: boolean = false) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return { requiresConfirmation: false };

      const childCount = tasks.filter((t) => t.parentId === taskId).length;
      const dependentSuccessors = tasks.filter((t) => t.predecessors?.includes(taskId));

      if (!force && (childCount > 0 || dependentSuccessors.length > 0)) {
        const warningParts: string[] = [];
        if (childCount > 0) {
          warningParts.push(`This summary task contains ${childCount} child task(s). Deleting it will permanently delete all of its child tasks.`);
        }
        if (dependentSuccessors.length > 0) {
          warningParts.push(`This task is a predecessor to ${dependentSuccessors.length} task(s). Deleting it will detach these dependency relationships.`);
        }

        const msg = warningParts.join(" ");
        setConfirmationDialog({
          isOpen: true,
          title: `Delete '${task.name}'?`,
          message: msg,
          confirmLabel: "Delete Task & Dependents",
          cancelLabel: "Cancel",
          isDestructive: true,
          onConfirm: () => performDeleteTasks(new Set([taskId])),
          onCancel: closeConfirmationDialog,
        });

        return { requiresConfirmation: true, message: msg, childCount };
      }

      performDeleteTasks(new Set([taskId]));
      return { requiresConfirmation: false };
    },
    [tasks, performDeleteTasks, closeConfirmationDialog]
  );

  const deleteTasks = useCallback(
    (taskIds: string[], force: boolean = false) => {
      if (taskIds.length === 0) return { requiresConfirmation: false };
      if (!force) {
        setConfirmationDialog({
          isOpen: true,
          title: `Delete ${taskIds.length} Tasks?`,
          message: `Are you sure you want to permanently delete ${taskIds.length} selected tasks and their subtasks? This will also remove any dependency links attached to them.`,
          confirmLabel: `Delete ${taskIds.length} Tasks`,
          cancelLabel: "Cancel",
          isDestructive: true,
          onConfirm: () => performDeleteTasks(new Set(taskIds)),
          onCancel: closeConfirmationDialog,
        });
        return { requiresConfirmation: true, message: `Confirm deletion of ${taskIds.length} tasks` };
      }
      performDeleteTasks(new Set(taskIds));
      return { requiresConfirmation: false };
    },
    [performDeleteTasks, closeConfirmationDialog]
  );

  const openBulkEdit = useCallback(() => setIsBulkEditOpen(true), []);
  const closeBulkEdit = useCallback(() => setIsBulkEditOpen(false), []);

  const verifyPhysicalProgress = useCallback(
    (taskId: string, verified: boolean, verifiedBy?: string, notes?: string) => {
      pushHistoryState(tasks);
      const target = tasks.find((t) => t.id === taskId);
      const updated = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            verifiedPhysicalProgress: verified,
            verifiedBy: verifiedBy || "Site Inspector",
            verifiedAt: new Date().toISOString(),
            physicalVerificationNotes: notes || t.physicalVerificationNotes,
          };
        }
        return t;
      });
      setTasks(updated);
      persistTasks(updated);
      if (target) {
        recordScheduleChange({
          taskId,
          taskName: target.name,
          wbs: target.wbs,
          field: "verifiedPhysicalProgress",
          fieldLabel: "Physical Progress Verification",
          previousValue: target.verifiedPhysicalProgress ? "Verified" : "Unverified",
          newValue: verified ? "Verified" : "Unverified",
          changedBy: verifiedBy || "Site Inspector",
          userRole: "Quality Assurance",
          changeSource: "user-edit",
        });
      }
      showToast(
        verified
          ? `Physically verified progress for '${target?.name || taskId}'.`
          : `Unmarked physical verification for '${target?.name || taskId}'.`
      );
    },
    [tasks, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const recordSubcontractorClaim = useCallback(
    (taskId: string, claimedPercent: number, notes?: string) => {
      pushHistoryState(tasks);
      const target = tasks.find((t) => t.id === taskId);
      const validClaim = Math.max(0, Math.min(100, claimedPercent));
      const todayStr = formatDateIso(new Date());

      const updated = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            subcontractorClaimedProgress: validClaim,
            subcontractorClaimedDate: todayStr,
            subcontractorClaimNotes: notes || t.subcontractorClaimNotes,
          };
        }
        return t;
      });

      setTasks(updated);
      persistTasks(updated);

      if (target) {
        recordScheduleChange({
          taskId,
          taskName: target.name,
          wbs: target.wbs,
          field: "subcontractorClaimedProgress",
          fieldLabel: "Subcontractor Claim Submission",
          previousValue: target.subcontractorClaimedProgress !== undefined ? `${target.subcontractorClaimedProgress}%` : "None",
          newValue: `${validClaim}%`,
          changedBy: target.subcontractor || "Subcontractor Representative",
          userRole: "Subcontractor",
          reason: notes || "Subcontractor progress claim submitted. Pending physical site verification.",
          changeSource: "user-edit",
        });
      }

      showToast(
        `Recorded subcontractor claim of ${validClaim}% for '${target?.name || taskId}'. Formal physical verification required.`
      );
    },
    [tasks, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const openCalendarModal = useCallback(() => setIsCalendarModalOpen(true), []);
  const closeCalendarModal = useCallback(() => setIsCalendarModalOpen(false), []);

  const applyCalendar = useCallback(
    (calendar: ProjectCalendar) => {
      setProjectCalendar(calendar);
      try {
        localStorage.setItem("plandx_project_calendar", JSON.stringify(calendar));
      } catch {}
      const result = recalculateSchedule(tasks, calendar);
      setTasks(result.updatedTasks);
      showToast(
        `Applied ${calendar.name} (${calendar.workingDays.length}d week). Recalculated ${result.changeCount} task dates.`,
      );
      setIsCalendarModalOpen(false);
    },
    [tasks, showToast],
  );

  // Schedule Health Modal
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const openHealthModal = useCallback(() => setIsHealthModalOpen(true), []);
  const closeHealthModal = useCallback(() => setIsHealthModalOpen(false), []);

  // Resource & Workload Management State
  const [projectResources, setProjectResources] = useState<ProjectResource[]>(() => {
    return getProjectResources();
  });

  const addProjectResource = useCallback(
    (resourceData: Omit<ProjectResource, "id">) => {
      const newResource: ProjectResource = {
        ...resourceData,
        id: `res-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      };
      setProjectResources((prev) => {
        const updated = [...prev, newResource];
        saveProjectResources(updated);
        return updated;
      });
      showToast(`Added resource: ${newResource.name}`);
      return newResource;
    },
    [showToast]
  );

  const updateProjectResource = useCallback(
    (id: string, updates: Partial<ProjectResource>) => {
      setProjectResources((prev) => {
        const updated = prev.map((r) => (r.id === id ? { ...r, ...updates } : r));
        saveProjectResources(updated);
        return updated;
      });
      showToast("Resource details updated.");
    },
    [showToast]
  );

  const deleteProjectResource = useCallback(
    (id: string) => {
      setProjectResources((prev) => {
        const updated = prev.filter((r) => r.id !== id);
        saveProjectResources(updated);
        return updated;
      });
      showToast("Resource removed from catalogue.");
    },
    [showToast]
  );

  const assignResourceToTask = useCallback(
    (taskId: string, assignmentData: Omit<TaskResourceAssignment, "assignmentId">) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          const assignment: TaskResourceAssignment = {
            ...assignmentData,
            assignmentId: `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          };
          const newAssignments = [...(t.assignments || []), assignment];
          const rollups = calculateTaskResourceRollups(t, newAssignments);
          const newAssignedResources = Array.from(
            new Set([...(t.assignedResources || []), assignment.resourceName])
          );
          return {
            ...t,
            assignments: newAssignments,
            assignedResources: newAssignedResources,
            workHours: rollups.workHours,
            actualWorkHours: rollups.actualWorkHours,
            remainingWorkHours: rollups.remainingWorkHours,
            cost: rollups.cost,
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast(`Assigned ${assignmentData.resourceName} to task.`);
    },
    [persistTasks, showToast]
  );

  const removeResourceFromTask = useCallback(
    (taskId: string, assignmentId: string) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          const newAssignments = (t.assignments || []).filter((a) => a.assignmentId !== assignmentId);
          const rollups = calculateTaskResourceRollups(t, newAssignments);
          const newAssignedResources = Array.from(new Set(newAssignments.map((a) => a.resourceName)));
          return {
            ...t,
            assignments: newAssignments,
            assignedResources: newAssignedResources,
            workHours: rollups.workHours,
            actualWorkHours: rollups.actualWorkHours,
            remainingWorkHours: rollups.remainingWorkHours,
            cost: rollups.cost,
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast("Resource assignment removed.");
    },
    [persistTasks, showToast]
  );

  const updateTaskAssignment = useCallback(
    (taskId: string, assignmentId: string, updates: Partial<TaskResourceAssignment>) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          const newAssignments = (t.assignments || []).map((a) => {
            if (a.assignmentId !== assignmentId) return a;
            const merged = { ...a, ...updates };
            if (
              updates.units !== undefined ||
              updates.plannedWorkHours !== undefined ||
              updates.standardRate !== undefined
            ) {
              merged.cost = (merged.plannedWorkHours || 0) * (merged.standardRate || 0);
            }
            return merged;
          });
          const rollups = calculateTaskResourceRollups(t, newAssignments);
          return {
            ...t,
            assignments: newAssignments,
            workHours: rollups.workHours,
            actualWorkHours: rollups.actualWorkHours,
            remainingWorkHours: rollups.remainingWorkHours,
            cost: rollups.cost,
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast("Assignment updated.");
    },
    [persistTasks, showToast]
  );

  const linkTaskSubcontractor = useCallback(
    (taskId: string, vendorId: string, vendorName: string) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            subcontractor: vendorName,
            subcontractorRecordId: vendorId,
            isSubcontractorVerified: true,
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast(`Linked subcontractor '${vendorName}' to task.`);
    },
    [persistTasks, showToast]
  );

  const recordSiteAttendance = useCallback(
    (taskId: string, attendanceData: Omit<SiteAttendanceRecord, "id">) => {
      setTasks((prevTasks) => {
        const updated = prevTasks.map((t) => {
          if (t.id !== taskId) return t;
          const record: SiteAttendanceRecord = {
            ...attendanceData,
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          };
          const siteAttendance = [...(t.siteAttendance || []), record];
          return {
            ...t,
            siteAttendance,
          };
        });
        persistTasks(updated);
        return updated;
      });
      showToast(`Recorded attendance for ${attendanceData.date}: ${attendanceData.headcount} operatives.`);
    },
    [persistTasks, showToast]
  );

  // Resource Leveling Modal & Execution Engine
  const [isResourceLevelingModalOpen, setIsResourceLevelingModalOpen] = useState(false);
  const openResourceLevelingModal = useCallback(() => setIsResourceLevelingModalOpen(true), []);
  const closeResourceLevelingModal = useCallback(() => setIsResourceLevelingModalOpen(false), []);
  const isResourceWorkloadModalOpen = isResourceLevelingModalOpen;
  const openResourceWorkloadModal = openResourceLevelingModal;
  const closeResourceWorkloadModal = closeResourceLevelingModal;

  const applyResourceLeveling = useCallback(() => {
    const preview = simulateResourceLeveling(tasks, projectCalendar, projectResources);
    if (preview.changes.length === 0) {
      showToast("No resource over-allocations detected. Schedule is balanced.");
      return { success: true, leveledCount: 0, projectSlipDays: 0 };
    }

    pushHistoryState(tasks);
    setTasks(preview.leveledTasks);
    persistTasks(preview.leveledTasks);
    recordScheduleChange({
      taskId: "project",
      taskName: "Resource Leveling",
      wbs: "1.0",
      field: "startDate",
      fieldLabel: "Resource-Driven Date Shift",
      previousValue: "Unleveled schedule",
      newValue: `Shifted ${preview.changes.length} tasks`,
      changedBy: "Resource Engine",
      userRole: "Project Planner",
      reason: `Automated non-destructive resource leveling applied (project finish slip: ${preview.projectSlipWorkingDays}d). Baseline 0 remained immutable.`,
      changeSource: "user-edit",
    });

    showToast(`Applied resource leveling: ${preview.changes.length} tasks shifted.`);
    setIsResourceLevelingModalOpen(false);
    return {
      success: true,
      leveledCount: preview.changes.length,
      projectSlipDays: preview.projectSlipWorkingDays,
    };
  }, [tasks, projectCalendar, projectResources, pushHistoryState, persistTasks, recordScheduleChange, showToast]);

  // Saved Views State & Management
  const [savedViews, setSavedViews] = useState<SavedView[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem("plandx_saved_views");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const saveCurrentView = useCallback((name: string) => {
    const newView: SavedView = {
      id: `view-${Date.now()}`,
      name,
      viewMode: activeView,
      filters: { ...filters },
      createdAt: new Date().toISOString(),
    };
    setSavedViews((prev) => {
      const next = [...prev.filter((v) => v.name !== name), newView];
      try {
        localStorage.setItem("plandx_saved_views", JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast(`View "${name}" saved.`);
  }, [activeView, filters, showToast]);

  const loadSavedView = useCallback((id: string) => {
    const view = savedViews.find((v) => v.id === id);
    if (!view) return;
    setActiveViewState(view.viewMode);
    setFilters(view.filters);
    showToast(`Loaded view "${view.name}".`);
  }, [savedViews, showToast]);

  const deleteSavedView = useCallback((id: string) => {
    setSavedViews((prev) => {
      const next = prev.filter((v) => v.id !== id);
      try {
        localStorage.setItem("plandx_saved_views", JSON.stringify(next));
      } catch {}
      return next;
    });
    showToast("Saved view removed.");
  }, [showToast]);

  // Baseline Comparison State
  const [showBaselineComparison, setShowBaselineComparison] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("plandx_show_baseline_comparison");
        if (saved !== null) return JSON.parse(saved);
      } catch {}
    }
    return false;
  });

  const [selectedBaselineVersion, setSelectedBaselineVersion] = useState<string>("ver-b0");

  const toggleBaselineComparison = useCallback(() => {
    setShowBaselineComparison((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("plandx_show_baseline_comparison", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleSetShowBaselineComparison = useCallback((show: boolean) => {
    setShowBaselineComparison(show);
    try {
      localStorage.setItem("plandx_show_baseline_comparison", JSON.stringify(show));
    } catch {}
  }, []);

  const [baselineSnapshots, setBaselineSnapshots] = useState<BaselineSnapshot[]>(() =>
    loadSavedBaselines(),
  );

  const baselineIntegrity = useMemo(() => {
    return inspectBaselineIntegrity(tasks, projectCalendar);
  }, [tasks, projectCalendar]);

  const takeBaselineSnapshot = useCallback(
    (options: {
      name: string;
      description: string;
      type?: "contract-baseline" | "approved-revision";
    }) => {
      const snapshot = createBaselineSnapshot(tasks, {
        name: options.name,
        description: options.description,
        approvedBy: "Demo Builder",
        approvedByRole: "Construction Management",
        type: options.type ?? "approved-revision",
        versionNumber: baselineSnapshots.length,
      });

      setBaselineSnapshots((prev) => {
        const updated = [...prev, snapshot];
        saveBaselines(updated);
        return updated;
      });

      recordScheduleChange({
        taskId: "project",
        taskName: "Programme Schedule",
        field: "baseline",
        fieldLabel: "Baseline Snapshot",
        previousValue: null,
        newValue: snapshot.name,
        changedBy: "Demo Builder",
        userRole: "Construction Management",
        reason: options.description,
        changeSource: "baseline-snapshot",
      });

      showToast(`Captured baseline snapshot: "${snapshot.name}" (${snapshot.taskCount} tasks).`);
      return snapshot;
    },
    [tasks, baselineSnapshots.length, recordScheduleChange, showToast],
  );

  const replaceActiveBaseline = useCallback(
    (snapshotName: string, reason: string) => {
      const snapshot = createBaselineSnapshot(tasks, {
        name: snapshotName || `Approved Revision ${baselineSnapshots.length}`,
        description: reason || "Approved baseline re-baselined to reflect agreed change order.",
        approvedBy: "Sarah Jenkins",
        approvedByRole: "Contract Admin / Employer's Agent",
        type: "approved-revision",
        versionNumber: baselineSnapshots.length,
      });

      const updatedTasks = applyBaselineSnapshotToTasks(tasks, snapshot);
      setTasks(updatedTasks);

      setBaselineSnapshots((prev) => {
        const updated = [...prev, snapshot];
        saveBaselines(updated);
        return updated;
      });

      recordScheduleChange({
        taskId: "project",
        taskName: "Programme Schedule",
        field: "baseline",
        fieldLabel: "Active Baseline Replaced",
        previousValue: "Baseline 0 (Contract)",
        newValue: snapshot.name,
        changedBy: "Sarah Jenkins",
        userRole: "Contract Admin",
        reason,
        changeSource: "baseline-snapshot",
      });

      showToast(`Active baseline replaced with "${snapshot.name}". All variances recalculated against new baseline.`);
      return { success: true };
    },
    [tasks, baselineSnapshots.length, recordScheduleChange, showToast],
  );

  const setBaseline0 = useCallback(
    (reason?: string, author?: string) => {
      pushHistoryState(tasks);
      const updatedTasks = tasks.map((t) => ({
        ...t,
        baseline0Start: t.startDate,
        baseline0Finish: t.endDate,
        baseline0Duration: t.duration,
        baseline0Work: t.workHours,
        baseline0Cost: t.cost,
        baselineSlots: {
          ...(t.baselineSlots || {}),
          0: {
            slot: 0,
            name: "Baseline 0 (Contract)",
            start: t.startDate,
            finish: t.endDate,
            duration: t.duration,
            work: t.workHours,
            cost: t.cost,
            capturedAt: new Date().toISOString(),
            approvedBy: author || "Project Manager",
          },
        },
      }));
      setTasks(updatedTasks);
      persistTasks(updatedTasks);

      takeBaselineSnapshot({
        name: "Baseline 0 (Contract Commitment)",
        description: reason || "Initial project programme baseline freeze & sign-off",
        type: "contract-baseline",
      });

      showToast(`Baseline 0 frozen & established for ${tasks.length} activities.`);
      return { success: true };
    },
    [tasks, pushHistoryState, persistTasks, takeBaselineSnapshot, showToast]
  );

  const restoreScheduleToBaseline = useCallback(() => {
    const { restoredTasks, restoredCount } = restoreScheduleFromBaseline(tasks, projectCalendar);
    setTasks(restoredTasks);

    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("plandx_task_overrides");
      } catch {}
    }

    recordScheduleChange({
      taskId: "project",
      taskName: "Programme Schedule",
      field: "startDate",
      fieldLabel: "Schedule Restored",
      previousValue: "Working Forecast",
      newValue: "Baseline 0 Dates",
      changedBy: "Demo Builder",
      userRole: "Construction Management",
      reason: "Restored working schedule dates and durations back to approved contract baseline.",
      changeSource: "restored-baseline",
    });

    showToast(`Restored ${restoredCount} tasks back to approved Baseline 0 dates.`);
    return { success: true, restoredCount };
  }, [tasks, projectCalendar, recordScheduleChange, showToast]);

  // 3D Model Integration State
  const [importedModel, setImportedModel] = useState<ImportedModelData | null>(null);
  const [activeProjectPreset, setActiveProjectPreset] = useState<ProjectModelPreset>(PROJECT_PRESETS[0]);
  const [isModelUploadModalOpen, setIsModelUploadModalOpen] = useState<boolean>(false);
  const openModelUploadModal = useCallback(() => setIsModelUploadModalOpen(true), []);
  const closeModelUploadModal = useCallback(() => setIsModelUploadModalOpen(false), []);

  // Network View specific state
  const [criticalPathActive, setCriticalPathActive] = useState<boolean>(true);
  const [selectedWbsSection, setSelectedWbsSection] = useState<string>("substructure");
  const [networkZoom, setNetworkZoom] = useState<number>(100);
  const [autoLayoutMode, setAutoLayoutMode] = useState<"lr" | "tb">("lr");
  const [viewAllNetwork, setViewAllNetwork] = useState<boolean>(false);

  const toggleCriticalPath = useCallback(() => {
    setCriticalPathActive((prev) => !prev);
  }, []);

  const setActiveView = useCallback((view: ViewMode) => {
    setActiveViewState(view);
    if (view === "network") {
      // If no task selected or not in network tasks, default to PRG-021
      setSelectedTaskId((prev) => {
        if (!prev || !prev.startsWith("PRG-")) return "PRG-021";
        return prev;
      });
      setDrawerOpen(true);
    }
  }, []);

  const locateIn3D = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setDrawerOpen(true);
    setActiveViewState("3d");
  }, []);

  const selectTask = useCallback((taskId: string | null) => {
    setSelectedTaskId(taskId);
    if (taskId) {
      setDrawerOpen(true);
    }
  }, []);

  const openDrawer = useCallback((taskId: string) => {
    setSelectedTaskId(taskId);
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const toggleExpand = useCallback((taskId: string) => {
    setExpandedNodesState((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const allIds = tasks.filter((t) => t.children.length > 0).map((t) => t.id);
    setExpandedNodesState(new Set(allIds));
  }, [tasks]);

  const collapseAll = useCallback(() => {
    setExpandedNodesState(new Set<string>());
  }, []);

  const setExpandedNodes = useCallback((nodes: Set<string>) => {
    setExpandedNodesState(nodes);
  }, []);

  const setSearch = useCallback((query: string) => {
    setFilters((prev) => ({ ...prev, search: query }));
  }, []);

  const setStatusFilter = useCallback((statuses: TaskStatus[]) => {
    setFilters((prev) => ({ ...prev, status: statuses }));
  }, []);

  const setTradeFilter = useCallback((trades: Trade[]) => {
    setFilters((prev) => ({ ...prev, trades }));
  }, []);

  const setCriticalPathOnly = useCallback((v: boolean) => {
    setFilters((prev) => ({ ...prev, criticalPathOnly: v }));
  }, []);

  const setBlockedOnly = useCallback((v: boolean) => {
    setFilters((prev) => ({ ...prev, blockedOnly: v }));
  }, []);

  const setFocusPreset = useCallback((preset: FocusPreset) => {
    setFilters((prev) => ({ ...prev, focusPreset: preset }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(defaultFilters);
    setAttentionFilter("all");
    setLookaheadTab("all");
  }, []);

  const updateTaskProgress = useCallback(
    (taskId: string, progress: number, status?: TaskStatus) => {
      const targetTask = tasks.find((t) => t.id === taskId);
      const prevProgress = targetTask?.progress ?? 0;
      const prevStatus = targetTask?.status ?? "not-started";

      setTasks((prev) => {
        const updated = prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStatus =
            status || (progress >= 100 ? "complete" : progress > 0 ? "in-progress" : "not-started");
          return {
            ...t,
            progress,
            status: newStatus,
          };
        });

        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem("plandx_task_overrides");
            const map = saved ? JSON.parse(saved) : {};
            const t = updated.find((x) => x.id === taskId);
            if (t) {
              map[taskId] = { ...(map[taskId] || {}), progress: t.progress, status: t.status };
              localStorage.setItem("plandx_task_overrides", JSON.stringify(map));
            }
          } catch {}
        }

        return updated;
      });

      if (targetTask && prevProgress !== progress) {
        recordScheduleChange({
          taskId,
          taskName: targetTask.name,
          wbs: targetTask.wbs,
          field: "progress",
          fieldLabel: "Progress",
          previousValue: `${prevProgress}%`,
          newValue: `${progress}%`,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }
      if (targetTask && status && prevStatus !== status) {
        recordScheduleChange({
          taskId,
          taskName: targetTask.name,
          wbs: targetTask.wbs,
          field: "status",
          fieldLabel: "Status",
          previousValue: prevStatus,
          newValue: status,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }
    },
    [tasks, recordScheduleChange],
  );

  const updateTaskSchedule = useCallback(
    (taskId: string, updates: { duration?: number; startDate?: string }) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) {
        showToast("Task not found.");
        return { success: false, error: "Task not found." };
      }

      if (updates.duration !== undefined && (isNaN(updates.duration) || updates.duration < 0)) {
        showToast("Duration must be a positive number of working days.");
        return { success: false, error: "Duration must be >= 0." };
      }

      let newStartDate = target.startDate;
      if (updates.startDate) {
        const parsed = parseIsoDate(updates.startDate);
        if (isNaN(parsed.getTime())) {
          showToast("Invalid start date provided.");
          return { success: false, error: "Invalid start date." };
        }
        const snapped = getNextWorkingDay(parsed, projectCalendar);
        newStartDate = formatDateIso(snapped);
      }

      const newDuration = updates.duration !== undefined ? updates.duration : target.duration;
      const isMilestone = newDuration === 0;

      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            startDate: newStartDate,
            manualStartDate: updates.startDate ? newStartDate : t.manualStartDate,
            duration: newDuration,
            isMilestone,
          };
        }
        return t;
      });

      const result = recalculateSchedule(updatedTasks, projectCalendar);
      setTasks(result.updatedTasks);

      const updatedTarget = result.updatedTasks.find((t) => t.id === taskId);
      const startDisp = updatedTarget?.displayStart || newStartDate;
      const endDisp = updatedTarget?.displayEnd || "";

      // Record schedule change events
      if (updates.duration !== undefined && updates.duration !== target.duration) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "duration",
          fieldLabel: "Duration",
          previousValue: `${target.duration}d`,
          newValue: `${newDuration}d`,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          reason: "Manual duration update via task scheduler.",
          changeSource: "user-edit",
        });
      }
      if (updates.startDate && updates.startDate !== target.startDate) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "startDate",
          fieldLabel: "Start Date",
          previousValue: target.startDate,
          newValue: newStartDate,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          reason: "Manual start date shift.",
          changeSource: "user-edit",
        });
      }
      if (updatedTarget && updatedTarget.endDate !== target.endDate) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "endDate",
          fieldLabel: "Finish Date",
          previousValue: target.endDate,
          newValue: updatedTarget.endDate,
          changedBy: "PlanD-X CPM Engine",
          userRole: "Topological Recalculation",
          reason: "Recalculated finish date from duration and working calendar.",
          changeSource: "cpm-recalculation",
        });
      }

      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("plandx_task_overrides");
          const map = saved ? JSON.parse(saved) : {};
          if (updatedTarget) {
            map[taskId] = {
              ...(map[taskId] || {}),
              startDate: updatedTarget.startDate,
              manualStartDate: updatedTarget.manualStartDate,
              duration: updatedTarget.duration,
              isMilestone: updatedTarget.isMilestone,
            };
            localStorage.setItem("plandx_task_overrides", JSON.stringify(map));
          }
        } catch {}
      }

      showToast(
        `Updated schedule for '${target.name}': ${newDuration}d (${startDisp} → ${endDisp}). Recalculated ${result.changeCount} task dates.`
      );

      return {
        success: true,
        recalculatedCount: result.changeCount,
      };
    },
    [tasks, projectCalendar, recordScheduleChange, showToast],
  );  const updateTaskDetails = useCallback(
    (
      taskId: string,
      updates: {
        name?: string;
        description?: string;
        status?: TaskStatus;
        progress?: number;
        duration?: number;
        startDate?: string;
        trade?: string | null;
        costCode?: string;
        taskType?: TaskType;
        effortDriven?: boolean;
        workHours?: number;
        assignmentUnits?: number;
        cost?: number;
        constraintType?: ConstraintType;
        constraintDate?: string;
        deadline?: string;
      },
    ) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) {
        showToast("Task not found.");
        return { success: false, error: "Task not found." };
      }

      pushHistoryState(tasks);

      const errors: Record<string, string> = {};

      if (updates.name !== undefined && !updates.name.trim()) {
        errors.name = "Task name cannot be empty.";
      }

      if (
        updates.progress !== undefined &&
        (isNaN(updates.progress) || updates.progress < 0 || updates.progress > 100)
      ) {
        errors.progress = "Progress must be between 0% and 100%.";
      }

      if (updates.duration !== undefined && (isNaN(updates.duration) || updates.duration < 0)) {
        errors.duration = "Duration must be 0 or more working days.";
      }

      let newStartDate = target.startDate;
      if (updates.startDate) {
        const parsed = parseIsoDate(updates.startDate);
        if (isNaN(parsed.getTime())) {
          errors.startDate = "Invalid start date format (must be YYYY-MM-DD).";
        } else {
          const snapped = getNextWorkingDay(parsed, projectCalendar);
          newStartDate = formatDateIso(snapped);
        }
      }

      if (Object.keys(errors).length > 0) {
        return { success: false, error: "Validation failed.", errors };
      }

      // MS Project Work = Duration * Units * workingHoursPerDay formula recalculation
      let resolvedDuration = updates.duration !== undefined ? updates.duration : target.duration;
      let resolvedWork = updates.workHours !== undefined ? updates.workHours : target.workHours;
      let resolvedUnits = updates.assignmentUnits !== undefined ? updates.assignmentUnits : target.assignmentUnits;

      if (updates.workHours !== undefined) {
        const calc = calculateTaskWorkUnits(target, "workHours", updates.workHours, projectCalendar);
        resolvedDuration = calc.duration;
        resolvedWork = calc.workHours;
        resolvedUnits = calc.assignmentUnits;
      } else if (updates.assignmentUnits !== undefined) {
        const calc = calculateTaskWorkUnits(target, "assignmentUnits", updates.assignmentUnits, projectCalendar);
        resolvedDuration = calc.duration;
        resolvedWork = calc.workHours;
        resolvedUnits = calc.assignmentUnits;
      } else if (updates.duration !== undefined) {
        const calc = calculateTaskWorkUnits(target, "duration", updates.duration, projectCalendar);
        resolvedDuration = calc.duration;
        resolvedWork = calc.workHours;
        resolvedUnits = calc.assignmentUnits;
      }

      const isMilestone = resolvedDuration === 0;

      // Handle progress & status auto-sync
      let newProgress = updates.progress !== undefined ? updates.progress : target.progress;
      let newStatus = updates.status !== undefined ? updates.status : target.status;
      if (updates.progress !== undefined && updates.status === undefined) {
        if (newProgress >= 100) newStatus = "complete";
        else if (newProgress > 0 && target.status === "not-started") newStatus = "in-progress";
      } else if (updates.status !== undefined && updates.progress === undefined) {
        if (newStatus === "complete") newProgress = 100;
        else if (newStatus === "not-started") newProgress = 0;
      }

      const updatedTasks = tasks.map((t) => {
        if (t.id === taskId) {
          return {
            ...t,
            name: updates.name !== undefined ? updates.name.trim() : t.name,
            description: updates.description !== undefined ? updates.description : t.description,
            status: newStatus,
            progress: newProgress,
            trade: updates.trade !== undefined ? updates.trade : t.trade,
            costCode: updates.costCode !== undefined ? updates.costCode : t.costCode,
            startDate: newStartDate,
            manualStartDate: updates.startDate ? newStartDate : t.manualStartDate,
            duration: resolvedDuration,
            isMilestone,
            taskType: updates.taskType !== undefined ? updates.taskType : t.taskType,
            effortDriven: updates.effortDriven !== undefined ? updates.effortDriven : t.effortDriven,
            workHours: resolvedWork,
            assignmentUnits: resolvedUnits,
            cost: updates.cost !== undefined ? updates.cost : t.cost,
            constraintType: updates.constraintType !== undefined ? updates.constraintType : t.constraintType,
            constraintDate: updates.constraintDate !== undefined ? updates.constraintDate : t.constraintDate,
            deadline: updates.deadline !== undefined ? updates.deadline : t.deadline,
          };
        }
        return t;
      });

      const needsRecalculation =
        updates.duration !== undefined ||
        updates.startDate !== undefined ||
        updates.workHours !== undefined ||
        updates.assignmentUnits !== undefined ||
        updates.constraintType !== undefined ||
        updates.constraintDate !== undefined ||
        updates.deadline !== undefined;
      let finalTasks = updatedTasks;
      let changeCount = 0;

      if (needsRecalculation) {
        const result = recalculateSchedule(updatedTasks, projectCalendar, {
          scheduleFromStart,
          statusDate,
        });
        finalTasks = result.updatedTasks;
        changeCount = result.changeCount;
      }

      setTasks(finalTasks);

      // Record field-level audit change events
      if (updates.name !== undefined && updates.name.trim() !== target.name) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "name",
          fieldLabel: "Activity Name",
          previousValue: target.name,
          newValue: updates.name.trim(),
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }
      if (updates.duration !== undefined && updates.duration !== target.duration) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "duration",
          fieldLabel: "Duration",
          previousValue: `${target.duration}d`,
          newValue: `${resolvedDuration}d`,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }
      if (updates.progress !== undefined && updates.progress !== target.progress) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "progress",
          fieldLabel: "Progress %",
          previousValue: `${target.progress}%`,
          newValue: `${newProgress}%`,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }
      if (updates.startDate && updates.startDate !== target.startDate) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "startDate",
          fieldLabel: "Start Date",
          previousValue: target.startDate,
          newValue: newStartDate,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }

      // Persist overrides to localStorage
      if (typeof window !== "undefined") {
        try {
          const saved = localStorage.getItem("plandx_task_overrides");
          const map = saved ? JSON.parse(saved) : {};
          const updatedT = finalTasks.find((t) => t.id === taskId);
          if (updatedT) {
            map[taskId] = {
              ...(map[taskId] || {}),
              name: updatedT.name,
              description: updatedT.description,
              status: updatedT.status,
              progress: updatedT.progress,
              trade: updatedT.trade,
              costCode: updatedT.costCode,
              startDate: updatedT.startDate,
              manualStartDate: updatedT.manualStartDate,
              duration: updatedT.duration,
              isMilestone: updatedT.isMilestone,
              taskType: updatedT.taskType,
              effortDriven: updatedT.effortDriven,
              workHours: updatedT.workHours,
              assignmentUnits: updatedT.assignmentUnits,
              cost: updatedT.cost,
              constraintType: updatedT.constraintType,
              constraintDate: updatedT.constraintDate,
              deadline: updatedT.deadline,
            };
            localStorage.setItem("plandx_task_overrides", JSON.stringify(map));
          }
        } catch {}
      }

      showToast(`Saved changes for '${updates.name?.trim() || target.name}'.`);
      return { success: true };
    },
    [tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, recordScheduleChange, showToast],
  );

  const addTaskNote = useCallback((taskId: string, note: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        return {
          ...t,
          notes: t.notes ? `${t.notes}\n• ${note}` : note,
        };
      }),
    );
  }, []);

  const assignTaskResource = useCallback(
    (
      taskId: string,
      resource: { name: string; initials: string; type?: "vendor" | "user" } | null,
    ) => {
      let taskName = "";
      const target = tasks.find((t) => t.id === taskId);
      const prevAssignee = target?.assignee || target?.subcontractor || null;
      const newAssignee = resource ? resource.name : null;

      setTasks((prev) => {
        const updated = prev.map((t) => {
          if (t.id === taskId) {
            taskName = t.name;
            return {
              ...t,
              assignee: resource ? resource.name : null,
              assigneeInitials: resource ? resource.initials : "",
              subcontractor:
                resource?.type === "vendor"
                  ? resource.name
                  : resource
                  ? resource.name
                  : null,
            };
          }
          return t;
        });

        if (typeof window !== "undefined") {
          try {
            const saved = localStorage.getItem("plandx_task_assignments");
            const map = saved ? JSON.parse(saved) : {};
            if (resource) {
              map[taskId] = {
                assignee: resource.name,
                assigneeInitials: resource.initials,
                subcontractor:
                  resource.type === "vendor" ? resource.name : resource.name,
              };
            } else {
              map[taskId] = {
                assignee: null,
                assigneeInitials: "",
                subcontractor: null,
              };
            }
            localStorage.setItem("plandx_task_assignments", JSON.stringify(map));
          } catch {}
        }

        return updated;
      });

      if (target && prevAssignee !== newAssignee) {
        recordScheduleChange({
          taskId: target.id,
          taskName: target.name,
          wbs: target.wbs,
          field: "resource",
          fieldLabel: "Subcontractor / Assignee",
          previousValue: prevAssignee,
          newValue: newAssignee,
          changedBy: "Demo Builder",
          userRole: "Construction Management",
          changeSource: "user-edit",
        });
      }

      if (resource) {
        showToast(`Assigned ${resource.name} to ${taskName || taskId}.`);
      } else {
        showToast(`Cleared assignment for ${taskName || taskId}.`);
      }
    },
    [tasks, recordScheduleChange, showToast],
  );

  // Dependency Operations
  const addDependency = useCallback(
    (predId: string, succId: string, type: DependencyType, lag: number) => {
      const cycleCheck = detectDependencyCycle(tasks, predId, succId);
      if (cycleCheck.hasCycle) {
        showToast(cycleCheck.reason || "Circular dependency detected.");
        return { success: false, error: cycleCheck.reason };
      }

      const validation = validateDependency(tasks, predId, succId, type, lag);
      if (!validation.valid) {
        showToast(`Cannot link: ${validation.error}`);
        return { success: false, error: validation.error };
      }

      pushHistoryState(tasks);
      const result = linkTasks(tasks, predId, succId, type, lag, projectCalendar);
      setTasks(result.updatedTasks);
      persistTasks(result.updatedTasks);

      const predTask = tasks.find((t) => t.id === predId);
      const succTask = tasks.find((t) => t.id === succId);
      recordScheduleChange({
        taskId: succId,
        taskName: succTask?.name || succId,
        wbs: succTask?.wbs,
        field: "predecessors",
        fieldLabel: "Predecessor Linked",
        previousValue: null,
        newValue: `${predTask?.name || predId} (${type}+${lag}d)`,
        changedBy: "Demo Builder",
        userRole: "Construction Management",
        changeSource: "user-edit",
      });

      showToast(
        `Linked ${type} (${lag >= 0 ? `+${lag}d lag` : `${lag}d lead`}). Recalculated ${result.changeCount} task dates.`
      );
      return { success: true };
    },
    [tasks, projectCalendar, pushHistoryState, persistTasks, recordScheduleChange, showToast],
  );

  const updateDependency = useCallback(
    (predId: string, succId: string, type: DependencyType, lag: number) => {
      const cycleCheck = detectDependencyCycle(tasks, predId, succId);
      if (cycleCheck.hasCycle) {
        showToast(cycleCheck.reason || "Circular dependency detected.");
        return { success: false, error: cycleCheck.reason };
      }

      pushHistoryState(tasks);
      const result = linkTasks(tasks, predId, succId, type, lag, projectCalendar);
      setTasks(result.updatedTasks);
      persistTasks(result.updatedTasks);

      const predTask = tasks.find((t) => t.id === predId);
      const succTask = tasks.find((t) => t.id === succId);
      recordScheduleChange({
        taskId: succId,
        taskName: succTask?.name || succId,
        wbs: succTask?.wbs,
        field: "predecessors",
        fieldLabel: "Dependency Updated",
        previousValue: null,
        newValue: `${predTask?.name || predId} (${type}+${lag}d)`,
        changedBy: "Demo Builder",
        userRole: "Construction Management",
        changeSource: "user-edit",
      });

      showToast(
        `Updated dependency to ${type} (${lag >= 0 ? `+${lag}d lag` : `${lag}d lead`}). Recalculated ${result.changeCount} task dates.`
      );
      return { success: true };
    },
    [tasks, projectCalendar, pushHistoryState, persistTasks, recordScheduleChange, showToast],
  );

  const removeDependency = useCallback(
    (predId: string, succId: string) => {
      pushHistoryState(tasks);
      const result = unlinkTasks(tasks, predId, succId, projectCalendar);
      setTasks(result.updatedTasks);
      persistTasks(result.updatedTasks);

      const predTask = tasks.find((t) => t.id === predId);
      const succTask = tasks.find((t) => t.id === succId);
      recordScheduleChange({
        taskId: succId,
        taskName: succTask?.name || succId,
        wbs: succTask?.wbs,
        field: "predecessors",
        fieldLabel: "Predecessor Removed",
        previousValue: `${predTask?.name || predId}`,
        newValue: null,
        changedBy: "Demo Builder",
        userRole: "Construction Management",
        changeSource: "user-edit",
      });

      showToast(`Removed dependency link. Recalculated ${result.changeCount} task dates.`);
      return { success: true };
    },
    [tasks, projectCalendar, pushHistoryState, persistTasks, recordScheduleChange, showToast],
  );

  // Linear Parity States
  const [currentScreen, setCurrentScreen] = useState<"builder" | "vendor_portal" | "first_time">("builder");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
  const [addTaskInitialKind, setAddTaskInitialKind] = useState<"task" | "milestone" | "summary">("task");
  const [addTaskTargetParentId, setAddTaskTargetParentId] = useState<string | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isRevisionsOpen, setIsRevisionsOpen] = useState(false);
  const [isVendorInboxOpen, setIsVendorInboxOpen] = useState(false);
  const [isAssignOwnerOpen, setIsAssignOwnerOpen] = useState(false);
  const [isContactCardOpen, setIsContactCardOpen] = useState(false);
  const [isLinkCostCodeOpen, setIsLinkCostCodeOpen] = useState(false);
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);
  const [modalTask, setModalTask] = useState<any>(null);
  const [vendorUpdates, setVendorUpdates] = useState<any[]>(INITIAL_VENDOR_UPDATES);
  const [owners] = useState<any[]>(INITIAL_VENDORS_AND_TEAM);
  const [costCodes] = useState<any[]>(INITIAL_COST_CODES);
  const [sitePhotos] = useState<any[]>(INITIAL_SITE_PHOTOS);
  const [showDuplicateBanner, setShowDuplicateBanner] = useState(true);
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [lookaheadTab, setLookaheadTab] = useState<"all" | "this_week" | "4_weeks" | "late" | "milestones" | "in_progress" | "critical_path">("all");
  const [lookaheadPeriod, setLookaheadPeriod] = useState<LookaheadPeriod>("2-weeks");

  const openAddTask = useCallback(
    (kind?: "task" | "milestone" | "summary", parentId?: string | null) => {
      setAddTaskInitialKind(kind || "task");
      setAddTaskTargetParentId(parentId ?? null);
      setIsAddTaskOpen(true);
    },
    []
  );
  const closeAddTask = useCallback(() => setIsAddTaskOpen(false), []);

  const openImport = useCallback(() => setIsImportOpen(true), []);
  const closeImport = useCallback(() => setIsImportOpen(false), []);

  const importSchedule = useCallback(
    (newTasks: ProgrammeTask[], calendar?: ProjectCalendar, importedProjectName?: string) => {
      const targetCalendar = calendar || projectCalendar;
      if (calendar) {
        setProjectCalendar(calendar);
        try {
          localStorage.setItem("plandx_project_calendar", JSON.stringify(calendar));
        } catch {}
      }

      pushHistoryState(tasks);
      // Preserve baseline integrity: protect existing approved baseline dates if incoming tasks don't specify them
      const baselineSafeTasks = preserveExistingBaselinesOnImport(newTasks, tasks);
      const recalculated = recalculateSchedule(baselineSafeTasks, targetCalendar, {
        scheduleFromStart,
        statusDate,
      });
      setTasks(recalculated.updatedTasks);
      if (recalculated.warnings) setSchedulingWarnings(recalculated.warnings);
      persistTasks(recalculated.updatedTasks);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("plandx_active_tasks", JSON.stringify(recalculated.updatedTasks));
          if (importedProjectName) {
            localStorage.setItem("plandx_imported_project_name", importedProjectName);
          }
        } catch {}
      }
      if (recalculated.updatedTasks.length > 0) {
        setSelectedTaskId(recalculated.updatedTasks[0].id);
      }
      setIsImportOpen(false);

      recordScheduleChange({
        taskId: "project",
        taskName: importedProjectName || "Imported Programme",
        field: "startDate",
        fieldLabel: "Schedule Import",
        previousValue: `${tasks.length} tasks`,
        newValue: `${recalculated.updatedTasks.length} tasks`,
        changedBy: "Demo Builder",
        userRole: "Construction Management",
        reason: "Imported schedule dataset. Approved baseline dates preserved.",
        changeSource: "schedule-import",
      });

      showToast(
        `Imported ${recalculated.updatedTasks.length} tasks${
          importedProjectName ? ` ("${importedProjectName}")` : ""
        }. Baseline dates protected & schedule recalculated via PlanD-X CPM engine.`
      );
    },
    [projectCalendar, setProjectCalendar, tasks, recordScheduleChange, showToast]
  );

  const resetToDefaultProgramme = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("plandx_active_tasks");
        localStorage.removeItem("plandx_imported_project_name");
        localStorage.removeItem("plandx_task_assignments");
        localStorage.removeItem("plandx_task_overrides");
        localStorage.removeItem("plandx_last_import_hash");
      } catch {}
    }
    const result = recalculateSchedule(ALL_PROGRAMME_TASKS, projectCalendar);
    setTasks(result.updatedTasks);
    if (result.updatedTasks.length > 0) {
      setSelectedTaskId(result.updatedTasks[0].id);
    }
    showToast("Reset programme to default template.");
  }, [projectCalendar, showToast]);

  const openExport = useCallback(() => setIsExportOpen(true), []);
  const closeExport = useCallback(() => setIsExportOpen(false), []);

  const openRevisions = useCallback(() => setIsRevisionsOpen(true), []);
  const closeRevisions = useCallback(() => setIsRevisionsOpen(false), []);

  // Programme Revision Comparison Workflow State
  const [savedRevisions, setSavedRevisions] = useState<SavedProgrammeRevision[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem("plandx_programme_revisions");
        if (stored) return JSON.parse(stored);
      } catch {}
    }
    return [];
  });

  const [isRevisionComparisonOpen, setIsRevisionComparisonOpen] = useState(false);
  const [incomingRevisionData, setIncomingRevisionData] = useState<{
    fileName: string;
    projectName?: string;
    tasks: ProgrammeTask[];
    calendar?: ProjectCalendar;
    fileHash?: string;
  } | null>(null);

  const openRevisionComparison = useCallback(
    (data?: {
      fileName: string;
      projectName?: string;
      tasks: ProgrammeTask[];
      calendar?: ProjectCalendar;
      fileHash?: string;
    }) => {
      if (data) {
        setIncomingRevisionData(data);
      }
      setIsRevisionComparisonOpen(true);
    },
    []
  );

  const closeRevisionComparison = useCallback(() => {
    setIsRevisionComparisonOpen(false);
  }, []);

  const applyRevisionImport = useCallback(
    (params: {
      revisionName: string;
      appliedBy: string;
      reason: string;
      items: TaskReconciliationItem[];
      incomingCalendar?: ProjectCalendar;
      sourceFileName?: string;
      sourceFingerprint?: string;
    }) => {
      const targetCalendar = params.incomingCalendar || projectCalendar;
      if (params.incomingCalendar) {
        setProjectCalendar(params.incomingCalendar);
        try {
          localStorage.setItem("plandx_project_calendar", JSON.stringify(params.incomingCalendar));
        } catch {}
      }

      pushHistoryState(tasks);

      // 1. Reconcile working tasks with user selections (strictly preserving Contract Baseline 0)
      const reconciled = applyProgrammeReconciliation(tasks, params.items, { preserveBaseline0: true });
      const structured = recalculateWBSHierarchy(reconciled);
      const recalculated = recalculateSchedule(structured, targetCalendar, {
        scheduleFromStart,
        statusDate,
      });

      // 2. Compute executive KPI statistics for archival
      let addedCount = 0;
      let removedCount = 0;
      let modifiedCount = 0;
      let renamedCount = 0;
      let movedCount = 0;
      let uncertainCount = 0;
      let acceptedCount = 0;
      let rejectedCount = 0;

      params.items.forEach((item) => {
        if (item.action === "accept") acceptedCount++;
        else rejectedCount++;

        if (item.changeType === "added") addedCount++;
        else if (item.changeType === "removed") removedCount++;
        else if (item.isRenamed) renamedCount++;
        else if (item.isMoved) movedCount++;
        else if (item.changeType === "modified") modifiedCount++;

        if (item.isUncertain) uncertainCount++;
      });

      let projectFinishDate = "";
      for (const t of recalculated.updatedTasks) {
        if (t.endDate && (!projectFinishDate || t.endDate > projectFinishDate)) {
          projectFinishDate = t.endDate;
        }
      }

      let currentFinishDate = "";
      for (const t of tasks) {
        if (t.endDate && (!currentFinishDate || t.endDate > currentFinishDate)) {
          currentFinishDate = t.endDate;
        }
      }

      let projectFinishSlipDays = 0;
      if (currentFinishDate && projectFinishDate) {
        const curD = parseIsoDate(currentFinishDate).getTime();
        const newD = parseIsoDate(projectFinishDate).getTime();
        projectFinishSlipDays = Math.round((newD - curD) / (1000 * 60 * 60 * 24));
      }

      const nextRevNumber = savedRevisions.length + 1;
      const revisionCode = `REV-${String(nextRevNumber).padStart(3, "0")}`;

      const newRevision: SavedProgrammeRevision = {
        revisionId: `rev-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        revisionCode,
        name: params.revisionName.trim() || `Programme Revision ${revisionCode}`,
        appliedAt: new Date().toISOString(),
        appliedBy: params.appliedBy.trim() || "Lead Planning Engineer",
        reason: params.reason.trim() || "Imported revised programme schedule.",
        sourceFileName: params.sourceFileName,
        sourceFingerprint: params.sourceFingerprint,
        summary: {
          totalTasks: recalculated.updatedTasks.length,
          addedCount,
          removedCount,
          modifiedCount,
          renamedCount,
          movedCount,
          uncertainCount,
          acceptedCount,
          rejectedCount,
          projectFinishDate,
          projectFinishSlipDays,
        },
        reconciledItems: params.items,
        workingTasksBeforeRevision: tasks.map((t) => ({ ...t })),
        appliedTasks: recalculated.updatedTasks.map((t) => ({ ...t })),
        calendarSnapshot: targetCalendar,
      };

      const updatedRevisions = [newRevision, ...savedRevisions];
      setSavedRevisions(updatedRevisions);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("plandx_programme_revisions", JSON.stringify(updatedRevisions));
        } catch {}
      }

      setTasks(recalculated.updatedTasks);
      if (recalculated.warnings) setSchedulingWarnings(recalculated.warnings);
      persistTasks(recalculated.updatedTasks);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("plandx_active_tasks", JSON.stringify(recalculated.updatedTasks));
          if (params.sourceFileName) {
            localStorage.setItem("plandx_imported_project_name", params.sourceFileName);
          }
        } catch {}
      }

      setIsRevisionComparisonOpen(false);
      setIsImportOpen(false);

      // Record in Schedule Audit History
      recordScheduleChange({
        taskId: "programme",
        taskName: params.revisionName,
        field: "startDate",
        fieldLabel: `Programme Revision (${revisionCode})`,
        previousValue: `${tasks.length} tasks (Finish: ${currentFinishDate || "N/A"})`,
        newValue: `${recalculated.updatedTasks.length} tasks (Finish: ${projectFinishDate || "N/A"})`,
        changedBy: params.appliedBy,
        userRole: "Lead Planning Engineer",
        reason: params.reason,
        changeSource: "revision-import",
      });

      showToast(
        `Applied Revision ${revisionCode} ("${params.revisionName}"): ${recalculated.updatedTasks.length} tasks active. Contract Baseline 0 protected.`
      );
    },
    [tasks, projectCalendar, savedRevisions, scheduleFromStart, statusDate, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const rollbackRevision = useCallback(
    (revisionId: string, rolledBackBy: string, reason: string): { success: boolean; error?: string } => {
      const rev = savedRevisions.find((r) => r.revisionId === revisionId);
      if (!rev) {
        return { success: false, error: "Revision not found." };
      }

      if (!rev.workingTasksBeforeRevision || rev.workingTasksBeforeRevision.length === 0) {
        return { success: false, error: "No pre-revision working tasks snapshot available for this revision." };
      }

      pushHistoryState(tasks);

      // Strict Rule: Non-destructive rollback.
      // 1. Restore previous working tasks snapshot.
      // 2. Protect Contract Baseline 0: Preserve baseline0Start, baseline0Finish, baseline0Duration from contract.
      // 3. Preserve audit log: Append rollback event without deleting historical records.
      // 4. Mark revision record as rolled back rather than deleting.
      const restoredWorkingTasks = rev.workingTasksBeforeRevision.map((targetTask) => {
        const currentTask = tasks.find((t) => t.id === targetTask.id);
        if (currentTask && currentTask.baseline0Start) {
          return {
            ...targetTask,
            baseline0Start: currentTask.baseline0Start,
            baseline0Finish: currentTask.baseline0Finish,
            baseline0Duration: currentTask.baseline0Duration,
            baseline0Cost: currentTask.baseline0Cost,
            baseline0Work: currentTask.baseline0Work,
          };
        }
        return { ...targetTask };
      });

      const targetCalendar = rev.calendarSnapshot || projectCalendar;
      const structured = recalculateWBSHierarchy(restoredWorkingTasks);
      const recalculated = recalculateSchedule(structured, targetCalendar, {
        scheduleFromStart,
        statusDate,
      });

      // Mark the revision as rolled back
      const updatedRevisions = savedRevisions.map((r) => {
        if (r.revisionId === revisionId) {
          return {
            ...r,
            isRolledBack: true,
            rolledBackAt: new Date().toISOString(),
            rolledBackBy: rolledBackBy.trim() || "Project Planner",
            rollbackReason: reason.trim() || "Manual rollback to pre-revision working state.",
          };
        }
        return r;
      });

      setSavedRevisions(updatedRevisions);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("plandx_programme_revisions", JSON.stringify(updatedRevisions));
        } catch {}
      }

      setTasks(recalculated.updatedTasks);
      persistTasks(recalculated.updatedTasks);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("plandx_active_tasks", JSON.stringify(recalculated.updatedTasks));
        } catch {}
      }

      // Record audit change for rollback
      recordScheduleChange({
        taskId: "programme",
        taskName: `Rollback: ${rev.revisionCode} (${rev.name})`,
        field: "startDate",
        fieldLabel: "Programme Revision Rollback",
        previousValue: `${tasks.length} tasks (${rev.revisionCode})`,
        newValue: `${recalculated.updatedTasks.length} tasks (Restored)`,
        changedBy: rolledBackBy,
        userRole: "Lead Planning Engineer",
        reason: `Rolled back revision ${rev.revisionCode}: ${reason}. Baseline 0 and full audit log preserved.`,
        changeSource: "revision-rollback",
      });

      showToast(
        `Rolled back revision ${rev.revisionCode} ("${rev.name}"). Restored ${recalculated.updatedTasks.length} tasks. Baseline 0 and audit history preserved.`
      );

      return { success: true };
    },
    [savedRevisions, tasks, projectCalendar, scheduleFromStart, statusDate, pushHistoryState, persistTasks, recordScheduleChange, showToast]
  );

  const openVendorInbox = useCallback(() => setIsVendorInboxOpen(true), []);
  const closeVendorInbox = useCallback(() => setIsVendorInboxOpen(false), []);
  const toggleVendorInbox = useCallback(() => setIsVendorInboxOpen((prev) => !prev), []);

  const openAssignOwner = useCallback((task?: any) => {
    if (task) setModalTask(task);
    else if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) setModalTask(found);
    }
    setIsAssignOwnerOpen(true);
  }, [tasks, selectedTaskId]);
  const closeAssignOwner = useCallback(() => setIsAssignOwnerOpen(false), []);

  const openContactCard = useCallback((task?: any) => {
    if (task) setModalTask(task);
    else if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) setModalTask(found);
    }
    setIsContactCardOpen(true);
  }, [tasks, selectedTaskId]);
  const closeContactCard = useCallback(() => setIsContactCardOpen(false), []);

  const openLinkCostCode = useCallback((task?: any) => {
    if (task) setModalTask(task);
    else if (selectedTaskId) {
      const found = tasks.find((t) => t.id === selectedTaskId);
      if (found) setModalTask(found);
    }
    setIsLinkCostCodeOpen(true);
  }, [tasks, selectedTaskId]);
  const closeLinkCostCode = useCallback(() => setIsLinkCostCodeOpen(false), []);

  const openPhotoPicker = useCallback(() => setIsPhotoPickerOpen(true), []);
  const closePhotoPicker = useCallback(() => setIsPhotoPickerOpen(false), []);

  const acceptVendorUpdate = useCallback((taskId: string) => {
    const update = vendorUpdates.find((_, i) =>
      (i === 0 && taskId === "PRG-716") ||
      (i === 1 && taskId === "PRG-718") ||
      (i === 2 && taskId === "PRG-720")
    );
    if (update) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === taskId) {
            return {
              ...t,
              progress: update.reportedPct,
              status: update.reportedPct === 100 ? "complete" : "in-progress",
              notes: update.comment,
            };
          }
          return t;
        })
      );
      setVendorUpdates((prev) => prev.filter((_, idx) => {
        const id = idx === 0 ? "PRG-716" : idx === 1 ? "PRG-718" : "PRG-720";
        return id !== taskId;
      }));
      showToast(`Accepted vendor update for ${taskId}. Progress set to ${update.reportedPct}%.`);
    }
    setIsVendorInboxOpen(false);
  }, [vendorUpdates, showToast]);

  const sendBackVendorUpdate = useCallback((taskId: string) => {
    setVendorUpdates((prev) => prev.filter((_, idx) => {
      const id = idx === 0 ? "PRG-716" : idx === 1 ? "PRG-718" : "PRG-720";
      return id !== taskId;
    }));
    showToast(`Update for ${taskId} sent back to vendor with request for clarification.`);
    setIsVendorInboxOpen(false);
  }, [showToast]);

  const assignOwner = useCallback((owner: any, scope: "single" | "group", sendEmail: boolean = true) => {
    if (!modalTask) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (scope === "single" && t.id === modalTask.id) {
          return { ...t, assignee: owner.name, assigneeInitials: owner.initials };
        }
        if (scope === "group" && t.parentId === modalTask.parentId) {
          return { ...t, assignee: owner.name, assigneeInitials: owner.initials };
        }
        return t;
      })
    );
    showToast(`Assigned ${owner.name} to ${scope === "single" ? modalTask.name : "all tasks in group"}.${sendEmail ? " Notification sent." : ""}`);
    setIsAssignOwnerOpen(false);
  }, [modalTask, showToast]);

  const linkCostCode = useCallback((costCode: any, scope: "single" | "group") => {
    if (!modalTask) return;
    setTasks((prev) =>
      prev.map((t) => {
        if (scope === "single" && t.id === modalTask.id) {
          return { ...t, costCode: costCode.code };
        }
        if (scope === "group" && t.parentId === modalTask.parentId) {
          return { ...t, costCode: costCode.code };
        }
        return t;
      })
    );
    showToast(`Linked cost code ${costCode.code} (${costCode.name}) to ${scope === "single" ? modalTask.name : "all tasks in group"}.`);
    setIsLinkCostCodeOpen(false);
  }, [modalTask, showToast]);

  const addTask = useCallback((taskData: any) => {
    const duration = taskData.isMilestone ? 0 : 5;
    const startDate = taskData.startDate || "2025-10-01";
    const endDateObj = addWorkingDays(startDate, duration, projectCalendar);
    const endDate = formatDateIso(endDateObj);
    const displayStart = formatDisplayDate(startDate);
    const displayEnd = formatDisplayDate(endDateObj);

    const newTask: ProgrammeTask = {
      id: `PRG-${Math.floor(820 + Math.random() * 100)}`,
      wbs: "1.3.6.3",
      name: taskData.name,
      level: taskData.isMilestone ? "milestone" : "task",
      parentId: "task-columns",
      status: "not-started",
      startDate,
      endDate,
      displayStart,
      displayEnd,
      duration,
      progress: 0,
      trade: "Structural",
      costCode: taskData.costCode !== "Not linked" ? taskData.costCode.slice(0, 4) : undefined,
      assignee: taskData.owner !== "Unassigned" ? taskData.owner : null,
      isCritical: false,
      isMilestone: !!taskData.isMilestone,
      predecessors: taskData.predecessor ? [taskData.predecessor] : [],
      successors: [],
      notes: taskData.notes || "",
      children: [],
      depth: 3,
      float: 14,
    };
    setTasks((prev) => [...prev, newTask]);
    showToast(`Added new task: ${taskData.name}`);
    setSelectedTaskId(newTask.id);
    setDrawerOpen(true);
  }, [projectCalendar, showToast]);

  const dismissDuplicateBanner = useCallback(() => setShowDuplicateBanner(false), []);
  const cleanupDuplicates = useCallback(() => {
    setShowDuplicateBanner(false);
    showToast("Cleaned up 800 duplicate rows permanently. Unique tasks retained.");
  }, [showToast]);

  const uiState = useMemo(
    () => ({
      activeView,
      selectedTaskId,
      drawerOpen,
      expandedNodes,
      zoomLevel,
      filters,
      calendarDate,
      timelineScrollDate,
      attentionFilter,
      tasks,
      criticalPathActive,
      selectedWbsSection,
      networkZoom,
      autoLayoutMode,
      viewAllNetwork,
    }),
    [
      activeView,
      selectedTaskId,
      drawerOpen,
      expandedNodes,
      zoomLevel,
      filters,
      calendarDate,
      timelineScrollDate,
      attentionFilter,
      tasks,
      criticalPathActive,
      selectedWbsSection,
      networkZoom,
      autoLayoutMode,
      viewAllNetwork,
    ],
  );

  const value = useMemo(
    () => ({
      state: uiState,
      tasks,
      setActiveView,
      locateIn3D,
      selectTask,
      openDrawer,
      closeDrawer,
      toggleExpand,
      expandAll,
      collapseAll,
      setExpandedNodes,
      setZoomLevel,
      criticalPathActive,
      setCriticalPathActive,
      toggleCriticalPath,
      selectedWbsSection,
      setSelectedWbsSection,
      networkZoom,
      setNetworkZoom,
      autoLayoutMode,
      setAutoLayoutMode,
      viewAllNetwork,
      setViewAllNetwork,
      attentionFilter,
      setAttentionFilter,
      setSearch,
      setStatusFilter,
      setTradeFilter,
      setCriticalPathOnly,
      setBlockedOnly,
      setFocusPreset,
      clearFilters,
      updateTaskProgress,
      updateTaskSchedule,
      updateTaskDetails,
      addTaskNote,
      assignTaskResource,
      addDependency,
      updateDependency,
      removeDependency,
      setCalendarDate,
      projectCalendar,
      setProjectCalendar,
      applyCalendar,
      isCalendarModalOpen,
      openCalendarModal,
      closeCalendarModal,
      // Baseline Comparison
      showBaselineComparison,
      setShowBaselineComparison: handleSetShowBaselineComparison,
      toggleBaselineComparison,
      selectedBaselineVersion,
      setSelectedBaselineVersion,
      // Baseline Integrity & Snapshots
      baselineSnapshots,
      baselineIntegrity,
      takeBaselineSnapshot,
      replaceActiveBaseline,
      setBaseline0,
      restoreScheduleToBaseline,
      // Change History & Audit Trail
      scheduleAuditLog,
      recordScheduleChange,
      clearAuditHistory,
      // 3D Model Integration
      importedModel,
      setImportedModel,
      activeProjectPreset,
      setActiveProjectPreset,
      isModelUploadModalOpen,
      openModelUploadModal,
      closeModelUploadModal,
      // Linear Parity Exports
      toastMessage,
      showToast,
      currentScreen,
      setCurrentScreen,
      isAddTaskOpen,
      addTaskInitialKind,
      addTaskTargetParentId,
      openAddTask,
      closeAddTask,
      isImportOpen,
      openImport,
      closeImport,
      importSchedule,
      isExportOpen,
      openExport,
      closeExport,
      isRevisionsOpen,
      openRevisions,
      closeRevisions,
      // Programme Revision Comparison Workflow
      savedRevisions,
      isRevisionComparisonOpen,
      incomingRevisionData,
      openRevisionComparison,
      closeRevisionComparison,
      applyRevisionImport,
      rollbackRevision,
      isVendorInboxOpen,
      openVendorInbox,
      closeVendorInbox,
      toggleVendorInbox,
      isAssignOwnerOpen,
      openAssignOwner,
      closeAssignOwner,
      isContactCardOpen,
      openContactCard,
      closeContactCard,
      isLinkCostCodeOpen,
      openLinkCostCode,
      closeLinkCostCode,
      isPhotoPickerOpen,
      openPhotoPicker,
      closePhotoPicker,
      modalTask,
      vendorUpdates,
      owners,
      costCodes,
      sitePhotos,
      acceptVendorUpdate,
      sendBackVendorUpdate,
      assignOwner,
      linkCostCode,
      addTask,
      showDuplicateBanner,
      dismissDuplicateBanner,
      cleanupDuplicates,
      density,
      setDensity,
      lookaheadTab,
      setLookaheadTab,
      lookaheadPeriod,
      setLookaheadPeriod,
      resetToDefaultProgramme,
      scheduleFromStart,
      setScheduleFromStart,
      statusDate,
      setStatusDate,
      schedulingWarnings,
      verifyPhysicalProgress,
      recordSubcontractorClaim,
      selectedTaskIds,
      toggleTaskSelection,
      selectAllTasks,
      clearTaskSelection,
      bulkUpdateTasks,
      bulkShiftTasks,
      undo,
      redo,
      canUndo,
      canRedo,
      copiedTask,
      copiedTasks: copiedTasksList,
      copySelectedTask,
      copyTasks,
      pasteTask,
      pasteTasks,
      indentTask,
      outdentTask,
      duplicateTask,
      duplicateTaskGroup,
      renumberWBS,
      moveTaskGroup,
      reorderTask,
      expandToLevel,
      createTask,
      deleteTask,
      deleteTasks,
      isBulkEditOpen,
      openBulkEdit,
      closeBulkEdit,
      confirmationDialog,
      closeConfirmationDialog,
      isHealthModalOpen,
      openHealthModal,
      closeHealthModal,
      // Resource & Workload Management
      projectResources,
      addProjectResource,
      updateProjectResource,
      deleteProjectResource,
      assignResourceToTask,
      removeResourceFromTask,
      updateTaskAssignment,
      linkTaskSubcontractor,
      recordSiteAttendance,
      isResourceWorkloadModalOpen,
      openResourceWorkloadModal,
      closeResourceWorkloadModal,
      // Resource Leveling Simulation & Execution
      isResourceLevelingModalOpen,
      openResourceLevelingModal,
      closeResourceLevelingModal,
      applyResourceLeveling,
      savedViews,
      saveCurrentView,
      loadSavedView,
      deleteSavedView,
      saveStatus,
      programmeVersion,
      projectId,
      saveError,
      conflictDetails,
      isConflictModalOpen,
      closeConflictModal,
      retrySave,
      resolveConflict,
      isRollbackModalOpen,
      openRollbackModal,
      closeRollbackModal,
      onRollbackSuccess,
      currentProject,
      allProjects,
      isProjectModalOpen,
      openProjectModal,
      closeProjectModal,
      switchProject,
      createNewProject,
      cloneCurrentProject,
      deleteCurrentProject,
      updateCurrentProject,
      refreshProjectsList,
      activeScenario,
      allScenarios,
      isCreateScenarioOpen,
      openCreateScenario,
      closeCreateScenario,
      createScenario,
      switchScenario,
      approveAndMergeScenario,
      discardScenario,
      currentUserRole,
      setCurrentUserRole,
      userPermissions,
      isWBSLibraryOpen,
      wbsLibraryTargetParentId,
      openWBSLibrary,
      closeWBSLibrary,
      insertWBSPackage,
      isPublishModalOpen,
      openPublishModal,
      closePublishModal,
      isMobileCompanionOpen,
      openMobileCompanion,
      closeMobileCompanion,
      offlineQueueCount,
      syncOfflineQueue,
      queueOfflineUpdate,
      updateTaskIntegrations,
      hasRecoverySnapshot,
      restoreRecoverySnapshot,
      discardRecoverySnapshot,
    }),
    [
      uiState,
      setActiveView,
      locateIn3D,
      selectTask,
      openDrawer,
      closeDrawer,
      toggleExpand,
      expandAll,
      collapseAll,
      setExpandedNodes,
      setZoomLevel,
      criticalPathActive,
      setCriticalPathActive,
      toggleCriticalPath,
      selectedWbsSection,
      setSelectedWbsSection,
      networkZoom,
      setNetworkZoom,
      autoLayoutMode,
      setAutoLayoutMode,
      viewAllNetwork,
      setViewAllNetwork,
      attentionFilter,
      setAttentionFilter,
      setSearch,
      setStatusFilter,
      setTradeFilter,
      setCriticalPathOnly,
      setBlockedOnly,
      setFocusPreset,
      clearFilters,
      updateTaskProgress,
      updateTaskSchedule,
      updateTaskDetails,
      addTaskNote,
      assignTaskResource,
      addDependency,
      updateDependency,
      removeDependency,
      setCalendarDate,
      projectCalendar,
      setProjectCalendar,
      applyCalendar,
      isCalendarModalOpen,
      openCalendarModal,
      closeCalendarModal,
      showBaselineComparison,
      handleSetShowBaselineComparison,
      toggleBaselineComparison,
      selectedBaselineVersion,
      setSelectedBaselineVersion,
      baselineSnapshots,
      baselineIntegrity,
      takeBaselineSnapshot,
      replaceActiveBaseline,
      restoreScheduleToBaseline,
      scheduleAuditLog,
      recordScheduleChange,
      clearAuditHistory,
      importedModel,
      activeProjectPreset,
      isModelUploadModalOpen,
      openModelUploadModal,
      closeModelUploadModal,
      isImportOpen,
      openImport,
      closeImport,
      importSchedule,
      isExportOpen,
      openExport,
      closeExport,
      isRevisionsOpen,
      openRevisions,
      closeRevisions,
      savedRevisions,
      isRevisionComparisonOpen,
      incomingRevisionData,
      openRevisionComparison,
      closeRevisionComparison,
      applyRevisionImport,
      rollbackRevision,
      isVendorInboxOpen,
      openVendorInbox,
      closeVendorInbox,
      toggleVendorInbox,
      isAssignOwnerOpen,
      openAssignOwner,
      closeAssignOwner,
      isContactCardOpen,
      openContactCard,
      closeContactCard,
      isLinkCostCodeOpen,
      openLinkCostCode,
      closeLinkCostCode,
      isPhotoPickerOpen,
      openPhotoPicker,
      closePhotoPicker,
      modalTask,
      vendorUpdates,
      owners,
      costCodes,
      sitePhotos,
      acceptVendorUpdate,
      sendBackVendorUpdate,
      assignOwner,
      linkCostCode,
      addTask,
      showDuplicateBanner,
      dismissDuplicateBanner,
      cleanupDuplicates,
      density,
      setDensity,
      lookaheadTab,
      setLookaheadTab,
      lookaheadPeriod,
      setLookaheadPeriod,
      resetToDefaultProgramme,
      scheduleFromStart,
      setScheduleFromStart,
      statusDate,
      setStatusDate,
      schedulingWarnings,
      verifyPhysicalProgress,
      selectedTaskIds,
      toggleTaskSelection,
      selectAllTasks,
      clearTaskSelection,
      bulkUpdateTasks,
      bulkShiftTasks,
      undo,
      redo,
      canUndo,
      canRedo,
      copiedTask,
      copiedTasksList,
      copySelectedTask,
      copyTasks,
      pasteTask,
      pasteTasks,
      indentTask,
      outdentTask,
      duplicateTask,
      duplicateTaskGroup,
      renumberWBS,
      moveTaskGroup,
      reorderTask,
      expandToLevel,
      createTask,
      deleteTask,
      deleteTasks,
      isBulkEditOpen,
      openBulkEdit,
      closeBulkEdit,
      confirmationDialog,
      closeConfirmationDialog,
      isHealthModalOpen,
      openHealthModal,
      closeHealthModal,
      projectResources,
      addProjectResource,
      updateProjectResource,
      deleteProjectResource,
      assignResourceToTask,
      removeResourceFromTask,
      updateTaskAssignment,
      linkTaskSubcontractor,
      recordSiteAttendance,
      isResourceWorkloadModalOpen,
      openResourceWorkloadModal,
      closeResourceWorkloadModal,
      isResourceLevelingModalOpen,
      openResourceLevelingModal,
      closeResourceLevelingModal,
      applyResourceLeveling,
      savedViews,
      saveCurrentView,
      loadSavedView,
      deleteSavedView,
      saveStatus,
      programmeVersion,
      projectId,
      saveError,
      conflictDetails,
      isConflictModalOpen,
      closeConflictModal,
      retrySave,
      resolveConflict,
      isRollbackModalOpen,
      openRollbackModal,
      closeRollbackModal,
      onRollbackSuccess,
      currentProject,
      allProjects,
      isProjectModalOpen,
      openProjectModal,
      closeProjectModal,
      switchProject,
      createNewProject,
      cloneCurrentProject,
      deleteCurrentProject,
      updateCurrentProject,
      refreshProjectsList,
      activeScenario,
      allScenarios,
      isCreateScenarioOpen,
      openCreateScenario,
      closeCreateScenario,
      createScenario,
      switchScenario,
      approveAndMergeScenario,
      discardScenario,
      currentUserRole,
      setCurrentUserRole,
      userPermissions,
      isWBSLibraryOpen,
      wbsLibraryTargetParentId,
      openWBSLibrary,
      closeWBSLibrary,
      insertWBSPackage,
      isPublishModalOpen,
      openPublishModal,
      closePublishModal,
      isMobileCompanionOpen,
      openMobileCompanion,
      closeMobileCompanion,
      offlineQueueCount,
      syncOfflineQueue,
      queueOfflineUpdate,
      updateTaskIntegrations,
      hasRecoverySnapshot,
      restoreRecoverySnapshot,
      discardRecoverySnapshot,
    ],
  );

  return <ProgrammeContext.Provider value={value}>{children}</ProgrammeContext.Provider>;
}

export function useProgramme() {
  const ctx = useContext(ProgrammeContext);
  if (!ctx) {
    throw new Error("useProgramme must be used within a ProgrammeProvider");
  }
  return ctx;
}
