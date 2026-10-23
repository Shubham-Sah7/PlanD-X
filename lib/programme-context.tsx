"use client";

import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
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
} from "./programme-types";
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
  openAddTask: () => void;
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

export function ProgrammeProvider({ children }: { children: React.ReactNode }) {
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
      } catch {}
    }
    try {
      return recalculateSchedule(initial, cal).updatedTasks;
    } catch {
      return initial;
    }
  });
  const [timelineScrollDate, setTimelineScrollDate] = useState<string>("2025-10-15");

  // Toast Message State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

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

  // Baseline Snapshots and Change History State
  const [scheduleAuditLog, setScheduleAuditLog] = useState<ScheduleChangeEvent[]>(() =>
    loadSavedAuditHistory(),
  );
  const [baselineSnapshots, setBaselineSnapshots] = useState<BaselineSnapshot[]>(() =>
    loadSavedBaselines(),
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
  );

  const updateTaskDetails = useCallback(
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
      },
    ) => {
      const target = tasks.find((t) => t.id === taskId);
      if (!target) {
        showToast("Task not found.");
        return { success: false, error: "Task not found." };
      }

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

      const newDuration = updates.duration !== undefined ? updates.duration : target.duration;
      const isMilestone = newDuration === 0;

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
            duration: newDuration,
            isMilestone,
          };
        }
        return t;
      });

      const needsRecalculation =
        updates.duration !== undefined || updates.startDate !== undefined;
      let finalTasks = updatedTasks;
      let changeCount = 0;

      if (needsRecalculation) {
        const result = recalculateSchedule(updatedTasks, projectCalendar);
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
          newValue: `${newDuration}d`,
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
          fieldLabel: "Progress",
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
            };
            localStorage.setItem("plandx_task_overrides", JSON.stringify(map));
          }
        } catch {}
      }

      showToast(`Saved changes for '${updates.name?.trim() || target.name}'.`);
      return { success: true };
    },
    [tasks, projectCalendar, recordScheduleChange, showToast],
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
      const validation = validateDependency(tasks, predId, succId, type, lag);
      if (!validation.valid) {
        showToast(`Cannot link: ${validation.error}`);
        return { success: false, error: validation.error };
      }

      const result = linkTasks(tasks, predId, succId, type, lag, projectCalendar);
      setTasks(result.updatedTasks);

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
    [tasks, projectCalendar, recordScheduleChange, showToast],
  );

  const updateDependency = useCallback(
    (predId: string, succId: string, type: DependencyType, lag: number) => {
      const result = linkTasks(tasks, predId, succId, type, lag, projectCalendar);
      setTasks(result.updatedTasks);

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
    [tasks, projectCalendar, recordScheduleChange, showToast],
  );

  const removeDependency = useCallback(
    (predId: string, succId: string) => {
      const result = unlinkTasks(tasks, predId, succId, projectCalendar);
      setTasks(result.updatedTasks);

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
    [tasks, projectCalendar, recordScheduleChange, showToast],
  );

  // Linear Parity States
  const [currentScreen, setCurrentScreen] = useState<"builder" | "vendor_portal" | "first_time">("builder");
  const [isAddTaskOpen, setIsAddTaskOpen] = useState(false);
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

  const openAddTask = useCallback(() => setIsAddTaskOpen(true), []);
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

      // Preserve baseline integrity: protect existing approved baseline dates if incoming tasks don't specify them
      const baselineSafeTasks = preserveExistingBaselinesOnImport(newTasks, tasks);
      const recalculated = recalculateSchedule(baselineSafeTasks, targetCalendar);
      setTasks(recalculated.updatedTasks);
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

  const openExport = useCallback(() => setIsExportOpen(true), []);
  const closeExport = useCallback(() => setIsExportOpen(false), []);

  const openRevisions = useCallback(() => setIsRevisionsOpen(true), []);
  const closeRevisions = useCallback(() => setIsRevisionsOpen(false), []);

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
