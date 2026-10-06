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

export type AttentionFilter = "all" | "overdue" | "blocked" | "due-this-week";

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
  const [activeView, setActiveViewState] = useState<ViewMode>("3d"); // default to 3d PlanD-X Programme screen per reference image
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
