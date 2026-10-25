"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus, Trade, ProgrammeTask } from "@/lib/programme-types";
import { getVisibleTasks } from "@/lib/programme-data";
import {
  generateProgrammeReportData,
  exportProgrammeToCsv,
  downloadReportFile,
} from "@/lib/programme-reporting";
import {
  Building2,
  Search,
  SlidersHorizontal,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Flame,
  Folder,
  FileText,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  Layers,
  Calendar,
  Tag,
  User,
  Activity,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  ArrowLeft,
  X,
  Download,
  Milestone,
  Copy,
  Trash2,
  Sliders,
} from "lucide-react";
import { EmptyProjectState } from "../empty-project-state";

// Assignee avatar colors mapping
const ASSIGNEE_AVATARS: Record<string, { bg: string; text: string }> = {
  JS: { bg: "bg-gradient-to-br from-blue-600 to-indigo-700", text: "text-white" },
  PT: { bg: "bg-gradient-to-br from-purple-600 to-violet-700", text: "text-white" },
  SC: { bg: "bg-gradient-to-br from-fuchsia-600 to-pink-700", text: "text-white" },
  MJ: { bg: "bg-gradient-to-br from-indigo-600 to-blue-700", text: "text-white" },
  RW: { bg: "bg-gradient-to-br from-rose-600 to-red-700", text: "text-white" },
  EC: { bg: "bg-gradient-to-br from-amber-500 to-orange-600", text: "text-white" },
  DW: { bg: "bg-gradient-to-br from-teal-600 to-emerald-700", text: "text-white" },
  TH: { bg: "bg-gradient-to-br from-emerald-600 to-teal-700", text: "text-white" },
};

function getInitials(name?: string | null): string {
  if (!name) return "—";
  const parts = name.trim().split(" ");
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type SortField = "wbs" | "name" | "start" | "finish" | "duration" | "progress";
type SortOrder = "asc" | "desc";

export function ListView() {
  const {
    tasks,
    state,
    selectTask,
    openDrawer,
    toggleExpand,
    expandAll,
    collapseAll,
    expandToLevel,
    selectedTaskIds,
    toggleTaskSelection,
    selectAllTasks,
    clearTaskSelection,
    openAddTask,
    openBulkEdit,
    duplicateTask,
    deleteTask,
    deleteTasks,
    indentTask,
    outdentTask,
    reorderTask,
    updateTaskProgress,
  } = useProgramme();

  // Filter dropdown toggles
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [tradeFilterOpen, setTradeFilterOpen] = useState(false);
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);
  const [outlineLevelOpen, setOutlineLevelOpen] = useState(false);

  // Filter selections
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [selectedTrade, setSelectedTrade] = useState<string>("All Trades");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("All Assignees");
  const [criticalOnly, setCriticalOnly] = useState(false);

  // Local Search Input
  const [searchQuery, setSearchQuery] = useState("");

  // Density setting: "comfortable" | "compact"
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  const liveTasks = tasks && tasks.length > 0 ? tasks : [];

  // Available Trades from active tasks
  const trades = useMemo(() => {
    const set = new Set<string>();
    liveTasks.forEach((t) => {
      if (t.trade) set.add(t.trade);
    });
    return Array.from(set);
  }, [liveTasks]);

  // Available Assignees from active tasks
  const assignees = useMemo(() => {
    const set = new Set<string>();
    liveTasks.forEach((t) => {
      if (t.assignee) set.add(t.assignee);
    });
    return Array.from(set);
  }, [liveTasks]);

  // Compute visible tasks respecting hierarchy, search (auto-expanding collapsed parents), and filters
  const visibleTasks = useMemo(() => {
    let filtered = getVisibleTasks(
      liveTasks,
      state.expandedNodes,
      state.attentionFilter,
      searchQuery
    );

    if (selectedStatus !== "All Statuses") {
      filtered = filtered.filter((t) => {
        if (selectedStatus === "Complete") return t.status === "complete";
        if (selectedStatus === "In Progress") return t.status === "in-progress";
        if (selectedStatus === "Not Started") return t.status === "not-started";
        if (selectedStatus === "Blocked") return t.status === "blocked";
        return true;
      });
    }

    if (selectedTrade !== "All Trades") {
      filtered = filtered.filter((t) => t.trade === selectedTrade || t.tradeText === selectedTrade);
    }

    if (selectedAssignee !== "All Assignees") {
      filtered = filtered.filter((t) => t.assignee === selectedAssignee);
    }

    if (criticalOnly) {
      filtered = filtered.filter((t) => t.isCritical);
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        let valA: any = a[sortField as keyof ProgrammeTask];
        let valB: any = b[sortField as keyof ProgrammeTask];
        if (sortField === "start") {
          valA = a.startDate;
          valB = b.startDate;
        } else if (sortField === "finish") {
          valA = a.endDate;
          valB = b.endDate;
        }
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        const res = valA < valB ? -1 : 1;
        return sortOrder === "asc" ? res : -res;
      });
    }

    return filtered;
  }, [
    liveTasks,
    state.expandedNodes,
    state.attentionFilter,
    searchQuery,
    selectedStatus,
    selectedTrade,
    selectedAssignee,
    criticalOnly,
    sortField,
    sortOrder,
  ]);

  const allSelected =
    liveTasks.length > 0 && selectedTaskIds.length >= liveTasks.length;

  const handleToggleSelectAll = () => {
    if (selectedTaskIds.length > 0) {
      clearTaskSelection();
    } else {
      selectAllTasks();
    }
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortField(null);
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleExportCsv = () => {
    const report = generateProgrammeReportData(liveTasks);
    const csv = exportProgrammeToCsv(report);
    downloadReportFile(csv, "PlanD-X_Programme_List.csv", "text/csv;charset=utf-8;");
  };

  const rowPy = density === "comfortable" ? "py-2.5" : "py-1.5";
  const ROW_HEIGHT = density === "comfortable" ? 44 : 36;
  const OVERSCAN = 12;

  // Virtualization state & resize observer for high-performance large programmes
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setViewportHeight(el.clientHeight || 800);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const handleContainerScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalCount = visibleTasks.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT);
  const visibleSlice = useMemo(
    () => visibleTasks.slice(startIndex, endIndex),
    [visibleTasks, startIndex, endIndex]
  );

  if (liveTasks.length === 0) {
    return (
      <div className="flex h-full flex-col overflow-hidden bg-white rounded-xl border border-slate-200/90 shadow-2xs p-4">
        <EmptyProjectState />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-white rounded-xl border border-slate-200/90 shadow-2xs">
      {/* ─── 1. Controls & Filter Bar ───────────────────────────────── */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-white px-4 py-3">
        {/* Left: Search & Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box (works inside collapsed groups) */}
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search tasks, WBS, trades..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 w-full rounded-lg border border-slate-200/90 bg-slate-50/70 pl-8 pr-7 text-[12px] text-slate-800 placeholder:text-slate-400 outline-none focus:border-blue-500 focus:bg-white focus:ring-1 focus:ring-blue-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Outline Level Dropdown */}
          <div className="relative">
            <button
              onClick={() => setOutlineLevelOpen(!outlineLevelOpen)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Layers className="h-3.5 w-3.5 text-slate-400" />
              <span>Outline</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {outlineLevelOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-40 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                <button
                  onClick={() => {
                    expandToLevel(1);
                    setOutlineLevelOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  Level 1 (Phases)
                </button>
                <button
                  onClick={() => {
                    expandToLevel(2);
                    setOutlineLevelOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  Level 2 (Packages)
                </button>
                <button
                  onClick={() => {
                    expandToLevel(3);
                    setOutlineLevelOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  Level 3 (Activities)
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  onClick={() => {
                    expandAll();
                    setOutlineLevelOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-blue-600 hover:bg-blue-50"
                >
                  Expand All Levels
                </button>
                <button
                  onClick={() => {
                    collapseAll();
                    setOutlineLevelOpen(false);
                  }}
                  className="w-full px-3 py-1.5 text-left text-[12px] font-medium text-slate-600 hover:bg-slate-50"
                >
                  Collapse All
                </button>
              </div>
            )}
          </div>

          {/* Status Filter */}
          <div className="relative">
            <button
              onClick={() => setStatusFilterOpen(!statusFilterOpen)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
                selectedStatus !== "All Statuses"
                  ? "border-blue-500 bg-blue-50/50 text-blue-700"
                  : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{selectedStatus}</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>
            {statusFilterOpen && (
              <div className="absolute left-0 top-full z-30 mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                {["All Statuses", "Complete", "In Progress", "Not Started", "Blocked"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSelectedStatus(s);
                      setStatusFilterOpen(false);
                    }}
                    className={`w-full px-3 py-1.5 text-left text-[12px] hover:bg-slate-50 ${
                      selectedStatus === s ? "font-semibold text-blue-600 bg-blue-50/40" : "text-slate-700"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Trade Filter */}
          {trades.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setTradeFilterOpen(!tradeFilterOpen)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
                  selectedTrade !== "All Trades"
                    ? "border-blue-500 bg-blue-50/50 text-blue-700"
                    : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>{selectedTrade}</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>
              {tradeFilterOpen && (
                <div className="absolute left-0 top-full z-30 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg max-h-48 overflow-y-auto">
                  <button
                    onClick={() => {
                      setSelectedTrade("All Trades");
                      setTradeFilterOpen(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                  >
                    All Trades
                  </button>
                  {trades.map((tr) => (
                    <button
                      key={tr}
                      onClick={() => {
                        setSelectedTrade(tr);
                        setTradeFilterOpen(false);
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[12px] hover:bg-slate-50 ${
                        selectedTrade === tr ? "font-semibold text-blue-600 bg-blue-50/40" : "text-slate-700"
                      }`}
                    >
                      {tr}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Critical Path Toggle */}
          <button
            onClick={() => setCriticalOnly(!criticalOnly)}
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors ${
              criticalOnly
                ? "border-red-500 bg-red-50 text-red-700"
                : "border-slate-200/90 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Flame className={`h-3.5 w-3.5 ${criticalOnly ? "text-red-500 fill-red-500" : "text-slate-400"}`} />
            <span>Critical Path</span>
          </button>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Bulk Edit Button (active if selection) */}
          {selectedTaskIds.length > 0 && (
            <button
              onClick={openBulkEdit}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-indigo-50 border border-indigo-200 px-3 text-[12px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
            >
              <Sliders className="h-3.5 w-3.5" />
              <span>Bulk Edit ({selectedTaskIds.length})</span>
            </button>
          )}

          {/* Export CSV */}
          <button
            onClick={handleExportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-2.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {/* Add Item Modal Trigger */}
          <button
            onClick={() => openAddTask()}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-[12px] font-semibold text-white hover:bg-emerald-500 transition-colors shadow-2xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Item</span>
          </button>
        </div>
      </div>

      {/* ─── 2. Rigid Table Headers ─────────────────────────────────── */}
      <div className="flex shrink-0 items-center border-b border-slate-200/90 bg-slate-50/90 px-3 py-2 text-[11.5px] font-semibold text-slate-600 uppercase tracking-wider select-none">
        {/* Checkbox column */}
        <div className="w-10 shrink-0 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={handleToggleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            title={allSelected ? "Deselect all tasks" : "Select all tasks"}
          />
        </div>

        {/* WBS # */}
        <div
          onClick={() => handleSort("wbs")}
          className="w-14 shrink-0 font-mono text-slate-500 pl-1 cursor-pointer flex items-center gap-1 hover:text-slate-900"
        >
          <span>#</span>
          {sortField === "wbs" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Task Name */}
        <div
          onClick={() => handleSort("name")}
          className="flex-1 min-w-[300px] normal-case font-bold text-slate-700 flex items-center gap-1.5 cursor-pointer hover:text-slate-900"
        >
          <span>Task / Work Package</span>
          {sortField === "name" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Status */}
        <div className="w-28 shrink-0 normal-case font-bold text-slate-600">Status</div>

        {/* Start */}
        <div
          onClick={() => handleSort("start")}
          className="w-24 shrink-0 normal-case font-bold text-slate-600 flex items-center gap-1 cursor-pointer hover:text-slate-900"
        >
          <span>Start</span>
          {sortField === "start" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Finish */}
        <div
          onClick={() => handleSort("finish")}
          className="w-24 shrink-0 normal-case font-bold text-slate-600 flex items-center gap-1 cursor-pointer hover:text-slate-900"
        >
          <span>Finish</span>
          {sortField === "finish" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Duration */}
        <div
          onClick={() => handleSort("duration")}
          className="w-20 shrink-0 normal-case font-bold text-slate-600 flex items-center gap-1 cursor-pointer hover:text-slate-900"
        >
          <span>Duration</span>
          {sortField === "duration" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Progress */}
        <div
          onClick={() => handleSort("progress")}
          className="w-28 shrink-0 normal-case font-bold text-slate-600 flex items-center gap-1 cursor-pointer hover:text-slate-900"
        >
          <span>Progress</span>
          {sortField === "progress" && (
            sortOrder === "asc" ? <ArrowUp className="h-2.5 w-2.5 text-blue-600" /> : <ArrowDown className="h-2.5 w-2.5 text-blue-600" />
          )}
        </div>

        {/* Trade */}
        <div className="w-28 shrink-0 normal-case font-bold text-slate-600">Trade</div>

        {/* Assignee */}
        <div className="w-36 shrink-0 normal-case font-bold text-slate-600">Assignee</div>

        {/* Quick Operations */}
        <div className="w-28 shrink-0 text-right pr-2 normal-case font-bold text-slate-600">
          Actions
        </div>
      </div>

      {/* ─── 3. Table Rows Container ─────────────────────────────────── */}
      <div
        ref={containerRef}
        onScroll={handleContainerScroll}
        className="flex-1 overflow-y-auto divide-y divide-slate-100 text-[12.5px] bg-white"
      >
        {visibleTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <Layers className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="font-medium text-slate-600">No tasks match the active filters or search.</p>
            <p className="text-xs text-slate-400 mt-1">Try clearing the search query or adjusting your filters.</p>
          </div>
        ) : (
          <>
            {topSpacerHeight > 0 && (
              <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
            )}
            {visibleSlice.map((task) => {
            const isExpanded = state.expandedNodes.has(task.id);
            const isChecked = selectedTaskIds.includes(task.id);
            const hasChildren =
              (task.children && task.children.length > 0) ||
              liveTasks.some((c) => c.parentId === task.id);
            const isSummary = Boolean(task.summary || task.level === "phase" || hasChildren);
            const isMilestone = Boolean(task.isMilestone || task.duration === 0);
            const depth = task.depth ?? 0;
            const indentPx = Math.min(depth * 18, 140);

            // Status pill styling
            const statusConfig = {
              complete: {
                bg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
                dot: "bg-emerald-500",
                label: "Complete",
              },
              "in-progress": {
                bg: "bg-blue-50 text-blue-700 border-blue-200/80",
                dot: "bg-blue-500",
                label: "In Progress",
              },
              blocked: {
                bg: "bg-red-50 text-red-700 border-red-200/80",
                dot: "bg-red-500",
                label: "Blocked",
              },
              "not-started": {
                bg: "bg-slate-100 text-slate-600 border-slate-200/80",
                dot: "bg-slate-400",
                label: "Not Started",
              },
            }[task.status || "not-started"] || {
              bg: "bg-slate-100 text-slate-600 border-slate-200/80",
              dot: "bg-slate-400",
              label: "Not Started",
            };

            const initials = getInitials(task.assignee);
            const avatarStyle =
              ASSIGNEE_AVATARS[initials] || {
                bg: "bg-slate-600",
                text: "text-white",
              };

            return (
              <div
                key={task.id}
                style={{ height: `${ROW_HEIGHT}px` }}
                onClick={() => {
                  selectTask(task.id);
                  openDrawer(task.id);
                }}
                className={`flex items-center px-3 ${rowPy} ${
                  isChecked
                    ? "bg-blue-50/70"
                    : isSummary
                    ? "bg-slate-50/60 font-semibold"
                    : "bg-white hover:bg-slate-50/80"
                } cursor-pointer transition-colors border-l-3 ${
                  state.selectedTaskId === task.id
                    ? "border-blue-600"
                    : isChecked
                    ? "border-blue-400"
                    : "border-transparent hover:border-slate-300"
                }`}
              >
                {/* Checkbox */}
                <div className="w-10 shrink-0 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTaskSelection(task.id, e.shiftKey || e.metaKey || e.ctrlKey);
                    }}
                    onChange={() => {}}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* WBS Column */}
                <div className="w-14 shrink-0 font-bold font-mono text-slate-800 pl-1 text-[12px]">
                  {task.wbs}
                </div>

                {/* Task / WBS Name */}
                <div className="flex-1 min-w-[300px] flex items-center gap-1.5 pr-2">
                  {/* Indentation spacing */}
                  <div style={{ width: `${indentPx}px` }} className="shrink-0" />

                  {/* Expand / Collapse Chevron */}
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(task.id);
                      }}
                      className="h-5 w-5 rounded flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 transition-colors shrink-0"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  ) : (
                    <div className="w-5 shrink-0" />
                  )}

                  {/* Type Icon */}
                  {isMilestone ? (
                    <Milestone className="h-4 w-4 text-purple-600 shrink-0" />
                  ) : isSummary ? (
                    <Folder className="h-4 w-4 text-blue-600 shrink-0" />
                  ) : (
                    <FileText className="h-4 w-4 text-slate-400 shrink-0" />
                  )}

                  {/* Title & Badges */}
                  <span
                    className={`truncate ${
                      isSummary ? "font-bold text-slate-900" : "font-medium text-slate-800"
                    }`}
                  >
                    {task.name}
                  </span>

                  {task.isCritical && (
                    <span
                      title="Critical Path Activity"
                      className="inline-flex items-center gap-0.5 rounded-full bg-red-50 border border-red-200 px-1.5 py-0.2 text-[10px] font-bold text-red-600 shrink-0"
                    >
                      <Flame className="h-2.5 w-2.5 fill-red-500 text-red-500" />
                      CP
                    </span>
                  )}
                  {isMilestone && (
                    <span className="rounded bg-purple-50 border border-purple-200 px-1.5 py-0.2 text-[10px] font-semibold text-purple-700 shrink-0">
                      Milestone
                    </span>
                  )}
                </div>

                {/* Status Column */}
                <div className="w-28 shrink-0">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold border ${statusConfig.bg}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${statusConfig.dot}`} />
                    <span>{statusConfig.label}</span>
                  </span>
                </div>

                {/* Start Date */}
                <div className="w-24 shrink-0 font-medium text-slate-600 text-[11.5px] font-mono">
                  {task.displayStart || task.startDate}
                </div>

                {/* Finish Date */}
                <div className="w-24 shrink-0 font-medium text-slate-600 text-[11.5px] font-mono">
                  {task.displayEnd || task.endDate}
                </div>

                {/* Duration */}
                <div className="w-20 shrink-0 font-medium text-slate-600 text-[11.5px]">
                  {isMilestone ? "0d" : `${task.duration}d`}
                </div>

                {/* Progress % */}
                <div className="w-28 shrink-0 flex items-center gap-2">
                  <div className="h-1.5 w-14 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        task.progress === 100
                          ? "bg-emerald-500"
                          : task.progress > 0
                          ? "bg-blue-600"
                          : "bg-slate-300"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="font-mono text-[11px] font-semibold text-slate-700">
                    {task.progress}%
                  </span>
                </div>

                {/* Trade Column */}
                <div className="w-28 shrink-0 truncate">
                  {task.trade ? (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200/60 truncate max-w-[100px]">
                      {task.trade}
                    </span>
                  ) : (
                    <span className="text-slate-400 text-xs">—</span>
                  )}
                </div>

                {/* Assignee Column */}
                <div className="w-36 shrink-0 flex items-center gap-2 truncate">
                  {task.assignee ? (
                    <>
                      <div
                        className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold ${avatarStyle.bg} ${avatarStyle.text} shrink-0`}
                      >
                        {initials}
                      </div>
                      <span className="truncate text-slate-700 text-xs font-medium">
                        {task.assignee}
                      </span>
                    </>
                  ) : (
                    <span className="text-slate-400 text-xs italic">Unassigned</span>
                  )}
                </div>

                {/* Quick Row Actions */}
                <div className="w-28 shrink-0 flex items-center justify-end gap-1 pr-1 opacity-80 hover:opacity-100">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      indentTask(task.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Indent task"
                  >
                    <ArrowRight className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      outdentTask(task.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Outdent task"
                  >
                    <ArrowLeft className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateTask(task.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Duplicate task"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteTask(task.id);
                    }}
                    className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                    title="Delete task"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
          {bottomSpacerHeight > 0 && (
            <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
          )}
        </>
      )}
      </div>

      {/* ─── 4. Floating Multi-Select Bulk Actions Bar ─────────────────── */}
      {selectedTaskIds.length > 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-2 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
              {selectedTaskIds.length}
            </span>
            <span className="text-[12.5px] font-medium text-slate-200">tasks selected</span>
          </div>

          <button
            type="button"
            onClick={openBulkEdit}
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-[12px] font-semibold text-white transition-colors"
          >
            <Sliders className="h-3.5 w-3.5" />
            <span>Bulk Edit Properties...</span>
          </button>

          <button
            type="button"
            onClick={() => deleteTasks(selectedTaskIds)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600/80 hover:bg-red-600 px-3 py-1 text-[12px] font-medium text-white transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Delete Selected</span>
          </button>

          <button
            type="button"
            onClick={clearTaskSelection}
            className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-white px-2 py-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Deselect</span>
          </button>
        </div>
      )}

      {/* ─── 5. Bottom Pagination Bar ───────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200/90 bg-white px-5 py-2.5 text-[12px] text-slate-600 z-10">
        <div className="font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-800">{visibleTasks.length}</span> of{" "}
          <span className="font-semibold text-slate-800">{liveTasks.length}</span> tasks
        </div>

        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-xs">
            {selectedTaskIds.length > 0 ? `${selectedTaskIds.length} selected` : "Click row to view & edit details"}
          </span>
        </div>
      </div>
    </div>
  );
}
