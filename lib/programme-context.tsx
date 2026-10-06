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
} from "./programme-types";
import { ALL_PROGRAMME_TASKS } from "./programme-data";
import {
  INITIAL_VENDORS_AND_TEAM,
  INITIAL_COST_CODES,
  INITIAL_SITE_PHOTOS,
  INITIAL_VENDOR_UPDATES,
} from "@/data/mock-programme";

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
  addTaskNote: (taskId: string, note: string) => void;
  // Calendar
  setCalendarDate: (date: string) => void;
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
  const [tasks, setTasks] = useState<ProgrammeTask[]>(ALL_PROGRAMME_TASKS);
  const [calendarDate, setCalendarDate] = useState<string>("2025-10-15");
  const [timelineScrollDate, setTimelineScrollDate] = useState<string>("2025-10-15");

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
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          const newStatus =
            status || (progress >= 100 ? "complete" : progress > 0 ? "in-progress" : "not-started");
          return {
            ...t,
            progress,
            status: newStatus,
          };
        }),
      );
    },
    [],
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

  // Linear Parity States
  const [toastMessage, setToastMessage] = useState<string | null>(null);
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

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  }, []);

  const openAddTask = useCallback(() => setIsAddTaskOpen(true), []);
  const closeAddTask = useCallback(() => setIsAddTaskOpen(false), []);

  const openImport = useCallback(() => setIsImportOpen(true), []);
  const closeImport = useCallback(() => setIsImportOpen(false), []);

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
    const newTask: ProgrammeTask = {
      id: `PRG-${Math.floor(820 + Math.random() * 100)}`,
      wbs: "1.3.6.3",
      name: taskData.name,
      level: taskData.isMilestone ? "milestone" : "task",
      parentId: "task-columns",
      status: "not-started",
      startDate: taskData.startDate || "2025-10-01",
      endDate: taskData.endDate || "2025-10-05",
      displayStart: "01 Oct 25",
      displayEnd: "05 Oct 25",
      duration: taskData.isMilestone ? 0 : 5,
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
  }, [showToast]);

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
      addTaskNote,
      setCalendarDate,
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
    }),
    [
      uiState,
      setActiveView,
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
      addTaskNote,
      setCalendarDate,
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
