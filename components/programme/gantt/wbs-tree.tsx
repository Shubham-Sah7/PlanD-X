"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import type { ProgrammeTask } from "@/lib/programme-types";
import { useProgramme } from "@/lib/programme-context";
import {
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  Building,
  Hammer,
  Building2,
  Layers,
  Columns as ColumnsIcon,
  Grid,
  Square,
  Sparkles,
  CheckCircle2,
  MoreHorizontal,
  SlidersHorizontal,
  Lock,
  RotateCcw,
  Flame,
} from "lucide-react";
import { ResourceAssignmentDropdown } from "@/components/programme/resources/resource-assignment-dropdown";
import { calculateScheduleVariance, formatVarianceDisplay } from "@/lib/programme-calendar";

function getTaskIcon(task: ProgrammeTask) {
  if (task.iconType === "establishment") return Building;
  if (task.iconType === "earthworks") return Hammer;
  if (task.iconType === "building") return Building2;
  if (task.iconType === "floor") return Layers;
  if (task.iconType === "columns") return ColumnsIcon;
  if (task.iconType === "blockwork") return Grid;
  if (task.iconType === "slab") return Square;
  if (task.iconType === "facade") return Building;
  if (task.iconType === "fitout") return Sparkles;
  if (task.iconType === "completion") return CheckCircle2;
  if (task.level === "phase") return Building2;
  if (task.level === "work-package") return Layers;
  return ColumnsIcon;
}

// Clean date formatting to guarantee exactly 9 characters (DD MMM YY) with zero overflow
function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mon = parts[1].slice(0, 3);
    const yr = parts[2].length === 4 ? parts[2].slice(2) : parts[2];
    return `${day} ${mon} ${yr}`;
  }
  return dateStr;
}

export interface ColumnVisibility {
  wbs: boolean;
  status: boolean;
  subcontractor: boolean;
  start: boolean;
  finish: boolean;
  duration: boolean;
  progress: boolean;
  baselineStart: boolean;
  baselineFinish: boolean;
  variance: boolean;
  trade: boolean;
  costCode: boolean;
  float: boolean;
}

export interface ColumnWidths {
  wbs: number;
  status: number;
  subcontractor: number;
  start: number;
  finish: number;
  duration: number;
  progress: number;
  baselineStart: number;
  baselineFinish: number;
  variance: number;
  trade: number;
  costCode: number;
  float: number;
}

export const DEFAULT_VISIBLE_COLUMNS: ColumnVisibility = {
  wbs: true,
  status: true,
  subcontractor: true,
  start: true,
  finish: true,
  duration: true,
  progress: true,
  baselineStart: false,
  baselineFinish: false,
  variance: false,
  trade: false,
  costCode: false,
  float: false,
};

export const DEFAULT_COLUMN_WIDTHS: ColumnWidths = {
  wbs: 38,
  status: 92,
  subcontractor: 138,
  start: 74,
  finish: 74,
  duration: 62,
  progress: 86,
  baselineStart: 74,
  baselineFinish: 74,
  variance: 74,
  trade: 94,
  costCode: 84,
  float: 58,
};

export const COLUMN_DEFINITIONS: { key: keyof ColumnVisibility; label: string; description: string }[] = [
  { key: "wbs", label: "# Index / WBS", description: "Hierarchical breakdown index" },
  { key: "status", label: "Status", description: "Complete, in progress, blocked, not started" },
  { key: "subcontractor", label: "Subcontractor / Resource", description: "Assigned trade or specialist" },
  { key: "start", label: "Start Date", description: "Scheduled start date" },
  { key: "finish", label: "Finish Date", description: "Scheduled finish date" },
  { key: "duration", label: "Duration", description: "Working days" },
  { key: "progress", label: "Progress", description: "Completion percentage" },
  { key: "baselineStart", label: "BL Start", description: "Baseline 0 contract start date" },
  { key: "baselineFinish", label: "BL Finish", description: "Baseline 0 contract finish date" },
  { key: "variance", label: "Variance", description: "Working day delay or advance" },
  { key: "trade", label: "Trade", description: "Construction discipline" },
  { key: "costCode", label: "Cost Code", description: "Budget & accounting package code" },
  { key: "float", label: "Total Float", description: "Schedule float in days" },
];

export function WBSTree({
  tasks,
  scrollRef,
  onScroll,
}: {
  tasks: ProgrammeTask[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
}) {
  const {
    state,
    selectTask,
    toggleExpand,
    expandAll,
    collapseAll,
    showBaselineComparison,
    projectCalendar,
  } = useProgramme();

  // Column visibility controls (persisted in localStorage)
  const [visibleColumns, setVisibleColumns] = useState<ColumnVisibility>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("plandx_gantt_visible_columns");
        if (saved) return { ...DEFAULT_VISIBLE_COLUMNS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_VISIBLE_COLUMNS;
  });

  // Column widths state (persisted in localStorage)
  const [colWidths, setColWidths] = useState<ColumnWidths>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("plandx_gantt_column_widths");
        if (saved) return { ...DEFAULT_COLUMN_WIDTHS, ...JSON.parse(saved) };
      } catch {}
    }
    return DEFAULT_COLUMN_WIDTHS;
  });

  const [columnsMenuOpen, setColumnsMenuOpen] = useState(false);
  const columnsMenuRef = useRef<HTMLDivElement | null>(null);

  // Close columns dropdown on outside click
  useEffect(() => {
    if (!columnsMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(e.target as Node)) {
        setColumnsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [columnsMenuOpen]);

  const toggleColumn = (col: keyof ColumnVisibility) => {
    setVisibleColumns((prev) => {
      const updated = { ...prev, [col]: !prev[col] };
      try {
        localStorage.setItem("plandx_gantt_visible_columns", JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // Draggable column resizing on column headers
  const handleColumnResizeStart = (
    col: keyof ColumnWidths,
    e: React.MouseEvent
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[col];

    const minWidth = col === "wbs" ? 28 : col === "progress" ? 64 : 56;
    const maxWidth = col === "wbs" ? 90 : col === "progress" ? 140 : 130;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth + deltaX));
      setColWidths((prev) => ({ ...prev, [col]: newWidth }));
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      setColWidths((latest) => {
        try {
          localStorage.setItem("plandx_gantt_column_widths", JSON.stringify(latest));
        } catch {}
        return latest;
      });
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  };

  const handleResetColWidth = (col: keyof ColumnWidths) => {
    setColWidths((prev) => {
      const next = { ...prev, [col]: DEFAULT_COLUMN_WIDTHS[col] };
      try {
        localStorage.setItem("plandx_gantt_column_widths", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const allExpanded = tasks.some(
    (t) => t.children.length > 0 && state.expandedNodes.has(t.id),
  );

  // Automatically show Variance and BL Finish when baseline comparison is active
  const activeVisibleColumns = useMemo<ColumnVisibility>(() => {
    if (showBaselineComparison) {
      return {
        ...visibleColumns,
        variance: true,
        baselineFinish: true,
      };
    }
    return visibleColumns;
  }, [visibleColumns, showBaselineComparison]);

  // Compute total minimum width required for all visible columns so they never crunch or overlap
  const totalTableMinWidth = useMemo(() => {
    let width = 240; // comfortable readable width for task name
    if (activeVisibleColumns.wbs) width += colWidths.wbs;
    if (activeVisibleColumns.status) width += colWidths.status;
    if (activeVisibleColumns.subcontractor) width += colWidths.subcontractor;
    if (activeVisibleColumns.start) width += colWidths.start;
    if (activeVisibleColumns.finish) width += colWidths.finish;
    if (activeVisibleColumns.duration) width += colWidths.duration;
    if (activeVisibleColumns.progress) width += colWidths.progress;
    if (activeVisibleColumns.baselineStart) width += colWidths.baselineStart;
    if (activeVisibleColumns.baselineFinish) width += colWidths.baselineFinish;
    if (activeVisibleColumns.variance) width += colWidths.variance;
    if (activeVisibleColumns.trade) width += colWidths.trade;
    if (activeVisibleColumns.costCode) width += colWidths.costCode;
    if (activeVisibleColumns.float) width += colWidths.float;
    return width;
  }, [activeVisibleColumns, colWidths]);

  return (
    <div className="flex flex-col h-full w-full bg-white select-none min-w-0 overflow-x-auto">
      {/* Table Header with sticky top position */}
      <div
        style={{ minWidth: `${totalTableMinWidth}px` }}
        className="flex h-11 items-center border-b border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 sticky top-0 z-20"
      >
        {/* # Index Column */}
        {activeVisibleColumns.wbs && (
          <div
            style={{ width: `${colWidths.wbs}px` }}
            className="relative shrink-0 text-left pl-0.5 font-mono text-[11px] text-slate-400 font-semibold select-none flex items-center justify-between"
          >
            <span>#</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("wbs", e)}
              onDoubleClick={() => handleResetColWidth("wbs")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Task / WBS Column with compact controls for Expand/Collapse and Columns dropdown */}
        <div className="flex-1 min-w-[240px] flex items-center justify-between px-2 pr-3">
          <span className="font-semibold text-slate-600 tracking-wider uppercase text-[11px] truncate mr-2">
            Task Name
          </span>

          <div className="flex items-center gap-1 shrink-0">
            {/* Expand / Collapse All Toggle Icon Button */}
            <button
              onClick={allExpanded ? collapseAll : expandAll}
              className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              title={allExpanded ? "Collapse All Groups" : "Expand All Groups"}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </button>

            {/* Column Customisation Button with clear label */}
            <div className="relative" ref={columnsMenuRef}>
              <button
                id="gantt-columns-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setColumnsMenuOpen((prev) => !prev);
                }}
                className={`flex h-6.5 items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-all ${
                  columnsMenuOpen
                    ? "bg-blue-50 border-blue-300 text-blue-700 shadow-xs"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
                title="Customize Table Columns (Show/Hide & Resize)"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <span className="font-sans normal-case tracking-normal">Columns</span>
              </button>

              {columnsMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-2xl z-50 text-[12px] animate-in fade-in zoom-in-95 duration-100"
                >
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                    <div>
                      <span className="font-semibold text-slate-800 text-[12px]">
                        Table Columns
                      </span>
                      <span className="ml-1.5 text-[10.5px] text-slate-400 font-normal">
                        ({Object.values(visibleColumns).filter(Boolean).length} visible)
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS);
                        setColWidths(DEFAULT_COLUMN_WIDTHS);
                        try {
                          localStorage.removeItem("plandx_gantt_visible_columns");
                          localStorage.removeItem("plandx_gantt_column_widths");
                        } catch {}
                      }}
                      className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
                    >
                      <RotateCcw className="h-3 w-3" />
                      <span>Reset</span>
                    </button>
                  </div>

                  {/* Essential Task Name (Locked) */}
                  <div className="mb-2 pb-2 border-b border-slate-100/80">
                    <div className="flex items-center justify-between py-1 px-1.5 rounded bg-slate-50 text-slate-700 text-[11.5px]">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={true}
                          disabled={true}
                          className="rounded text-blue-600 focus:ring-0 h-3.5 w-3.5 cursor-not-allowed opacity-80"
                        />
                        <span className="font-medium text-slate-800">Task Name</span>
                      </div>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                        <Lock className="h-2.5 w-2.5" />
                        <span>Required</span>
                      </span>
                    </div>
                  </div>

                  {/* Configurable Columns */}
                  <div className="space-y-0.5 max-h-64 overflow-y-auto pr-0.5 [scrollbar-width:thin]">
                    {COLUMN_DEFINITIONS.map((col) => {
                      const isChecked = visibleColumns[col.key];
                      return (
                        <label
                          key={col.key}
                          className="flex items-center justify-between py-1 px-1.5 rounded hover:bg-slate-50 cursor-pointer text-slate-700 group transition-colors"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleColumn(col.key)}
                              className="rounded text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                            />
                            <span className={`text-[11.5px] ${isChecked ? "font-medium text-slate-900" : "text-slate-600"}`}>
                              {col.label}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {colWidths[col.key]}px
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  <div className="mt-2 pt-2 border-t border-slate-100 text-[10.5px] text-slate-400 flex items-center justify-between">
                    <span>Drag header divider to resize</span>
                    <span>Double-click to reset width</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Status Column */}
        {visibleColumns.status && (
          <div
            style={{ width: `${colWidths.status}px` }}
            className="relative shrink-0 text-left pl-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wider select-none flex items-center"
          >
            <span>Status</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("status", e)}
              onDoubleClick={() => handleResetColWidth("status")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Subcontractor Column */}
        {visibleColumns.subcontractor && (
          <div
            style={{ width: `${colWidths.subcontractor}px` }}
            className="relative shrink-0 text-left pl-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wider select-none flex items-center"
          >
            <span>Subcontractor</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("subcontractor", e)}
              onDoubleClick={() => handleResetColWidth("subcontractor")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Start Date Column */}
        {visibleColumns.start && (
          <div
            style={{ width: `${colWidths.start}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>Start</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("start", e)}
              onDoubleClick={() => handleResetColWidth("start")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Finish Date Column */}
        {activeVisibleColumns.finish && (
          <div
            style={{ width: `${colWidths.finish}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>Finish</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("finish", e)}
              onDoubleClick={() => handleResetColWidth("finish")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Baseline Start Date Column */}
        {activeVisibleColumns.baselineStart && (
          <div
            style={{ width: `${colWidths.baselineStart}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>BL Start</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("baselineStart", e)}
              onDoubleClick={() => handleResetColWidth("baselineStart")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Baseline Finish Date Column */}
        {activeVisibleColumns.baselineFinish && (
          <div
            style={{ width: `${colWidths.baselineFinish}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>BL Finish</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("baselineFinish", e)}
              onDoubleClick={() => handleResetColWidth("baselineFinish")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Variance Column */}
        {activeVisibleColumns.variance && (
          <div
            style={{ width: `${colWidths.variance}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>Variance</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("variance", e)}
              onDoubleClick={() => handleResetColWidth("variance")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Duration Column */}
        {activeVisibleColumns.duration && (
          <div
            style={{ width: `${colWidths.duration}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>Dur</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("duration", e)}
              onDoubleClick={() => handleResetColWidth("duration")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Progress Column */}
        {activeVisibleColumns.progress && (
          <div
            style={{ width: `${colWidths.progress}px` }}
            className="relative shrink-0 text-right pr-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wider select-none flex items-center justify-end"
          >
            <span>Progress</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("progress", e)}
              onDoubleClick={() => handleResetColWidth("progress")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Trade Column */}
        {visibleColumns.trade && (
          <div
            style={{ width: `${colWidths.trade}px` }}
            className="relative shrink-0 text-left pl-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wider select-none flex items-center"
          >
            <span>Trade</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("trade", e)}
              onDoubleClick={() => handleResetColWidth("trade")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Cost Code Column */}
        {visibleColumns.costCode && (
          <div
            style={{ width: `${colWidths.costCode}px` }}
            className="relative shrink-0 text-left pl-2 font-semibold text-slate-500 text-[11px] uppercase tracking-wider select-none flex items-center"
          >
            <span>Cost Code</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("costCode", e)}
              onDoubleClick={() => handleResetColWidth("costCode")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}

        {/* Float Column */}
        {visibleColumns.float && (
          <div
            style={{ width: `${colWidths.float}px` }}
            className="relative shrink-0 text-center font-mono text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none flex items-center justify-center"
          >
            <span>Float</span>
            <div
              onMouseDown={(e) => handleColumnResizeStart("float", e)}
              onDoubleClick={() => handleResetColWidth("float")}
              className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-400/30 transition-colors z-10 flex items-center justify-end"
              title="Drag to resize column (double-click to reset)"
            >
              <div className="h-3 w-px bg-slate-200" />
            </div>
          </div>
        )}
      </div>

      {/* Table Rows with synchronized vertical scrolling */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        style={{ minWidth: `${totalTableMinWidth}px` }}
        className="flex-1 divide-y divide-slate-100 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {tasks.map((task) => {
          const isSelected = state.selectedTaskId === task.id;
          const isExpanded = state.expandedNodes.has(task.id);
          const hasChildren = task.children.length > 0;
          const IconComponent = getTaskIcon(task);
          const isPhase = task.level === "phase";
          const isWorkPackage = task.level === "work-package";
          const isLeafTask = !isPhase && !isWorkPackage;

          const paddingLeft = `${task.depth * 14 + 2}px`;

          // Status indicator color for leaf tasks
          const statusDotColor =
            task.progress >= 100
              ? "bg-emerald-500"
              : task.status === "blocked"
              ? "bg-red-500"
              : task.progress > 0
              ? "bg-blue-600"
              : "bg-slate-300";

          return (
            <div
              key={task.id}
              onClick={() => selectTask(task.id)}
              style={{ minWidth: `${totalTableMinWidth}px` }}
              className={`group flex h-10 items-center px-3 text-[13px] transition-colors cursor-pointer shrink-0 ${
                isPhase
                  ? "bg-slate-50/90 hover:bg-slate-100/90 text-slate-900 border-l-2 border-transparent"
                  : isWorkPackage
                  ? "bg-white hover:bg-slate-50 text-slate-800 border-l-2 border-transparent"
                  : isSelected
                  ? "bg-blue-50/80 font-medium text-blue-950 border-l-2 border-blue-600"
                  : "bg-white hover:bg-slate-50 text-slate-700 border-l-2 border-transparent"
              }`}
            >
              {/* # Index column */}
              {visibleColumns.wbs && (
                <div
                  style={{ width: `${colWidths.wbs}px` }}
                  className={`shrink-0 text-left pl-0.5 font-mono text-[11.5px] tabular-nums truncate ${
                    isPhase
                      ? "font-bold text-slate-800"
                      : isWorkPackage
                      ? "font-semibold text-slate-700"
                      : "text-slate-400 font-medium"
                  }`}
                >
                  {task.wbs}
                </div>
              )}

              {/* Task / WBS Column */}
              <div
                className="flex flex-1 items-center gap-1.5 min-w-[240px] px-2 pr-3 truncate"
                style={{ paddingLeft }}
              >
                {/* Expand / Collapse Chevron */}
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(task.id);
                    }}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  <div className="w-4 shrink-0" />
                )}

                {/* Construction Icon */}
                <div
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded ${
                    isPhase
                      ? "text-slate-800"
                      : isWorkPackage
                      ? "text-slate-600"
                      : isSelected
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  <IconComponent className="h-3.5 w-3.5" />
                </div>

                {/* Task Name */}
                <span
                  className={`truncate ${
                    isPhase
                      ? "font-bold text-slate-900 text-[13px]"
                      : isWorkPackage
                      ? "font-semibold text-slate-800 text-[13px]"
                      : isSelected
                      ? "font-semibold text-blue-900 text-[13px]"
                      : "font-normal text-slate-700 text-[13px]"
                  }`}
                  title={task.name}
                >
                  {task.name}
                </span>

                {/* Critical Path Badge */}
                {task.isCritical && (
                  <span
                    className="ml-1.5 shrink-0 inline-flex items-center gap-0.5 rounded px-1 py-0.2 text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"
                    title="Critical Path Activity (Total Float <= 0d)"
                  >
                    <Flame className="h-2.5 w-2.5 text-rose-600" />
                    <span>CP</span>
                  </span>
                )}

                {/* Task Count Badge */}
                {task.taskCount ? (
                  <span
                    className={`ml-1.5 shrink-0 rounded px-1.5 py-0.2 text-[10px] font-medium transition-colors ${
                      isPhase
                        ? "bg-slate-200/80 text-slate-700"
                        : isSelected
                        ? "bg-blue-100 text-blue-800"
                        : "bg-slate-100 text-slate-500 group-hover:bg-slate-200/80"
                    }`}
                  >
                    {task.taskCount}
                  </span>
                ) : null}
              </div>

              {/* Status */}
              {visibleColumns.status && (
                <div
                  style={{ width: `${colWidths.status}px` }}
                  className="shrink-0 flex items-center px-1"
                >
                  {isLeafTask ? (
                    <span
                      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10.5px] font-medium leading-none ${
                        task.status === "complete"
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60"
                          : task.status === "blocked"
                          ? "bg-rose-50 text-rose-700 border border-rose-200/60"
                          : task.status === "in-progress"
                          ? "bg-blue-50 text-blue-700 border border-blue-200/60"
                          : "bg-slate-100 text-slate-600 border border-slate-200/60"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          task.status === "complete"
                            ? "bg-emerald-500"
                            : task.status === "blocked"
                            ? "bg-rose-500"
                            : task.status === "in-progress"
                            ? "bg-blue-600"
                            : "bg-slate-400"
                        }`}
                      />
                      <span className="capitalize truncate">
                        {task.status === "in-progress"
                          ? "In Progress"
                          : task.status === "not-started"
                          ? "Not Started"
                          : task.status}
                      </span>
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-300 font-normal pl-2">—</span>
                  )}
                </div>
              )}

              {/* Subcontractor Assignment */}
              {visibleColumns.subcontractor && (
                <div
                  style={{ width: `${colWidths.subcontractor}px` }}
                  onClick={(e) => e.stopPropagation()}
                  className="shrink-0 flex items-center px-1 truncate"
                >
                  {isLeafTask ? (
                    <ResourceAssignmentDropdown
                      taskId={task.id}
                      taskName={task.name}
                      currentAssignee={task.assignee}
                      currentInitials={task.assigneeInitials}
                      currentSubcontractor={task.subcontractor}
                      compact={true}
                    />
                  ) : (
                    <span className="text-[11px] text-slate-300 font-normal pl-2">—</span>
                  )}
                </div>
              )}

              {/* Start Date */}
              {visibleColumns.start && (
                <div
                  style={{ width: `${colWidths.start}px` }}
                  className="shrink-0 text-center text-[11.5px] font-mono tabular-nums text-slate-600 font-medium truncate"
                >
                  {formatDisplayDate(task.displayStart)}
                </div>
              )}

              {/* Finish Date */}
              {activeVisibleColumns.finish && (
                <div
                  style={{ width: `${colWidths.finish}px` }}
                  className="shrink-0 text-center text-[11.5px] font-mono tabular-nums text-slate-600 font-medium truncate"
                >
                  {formatDisplayDate(task.displayEnd)}
                </div>
              )}

              {/* Baseline Start Date */}
              {activeVisibleColumns.baselineStart && (
                <div
                  style={{ width: `${colWidths.baselineStart}px` }}
                  className="shrink-0 text-center text-[11.5px] font-mono tabular-nums text-slate-500 font-medium truncate"
                >
                  {task.baseline0Start ? formatDisplayDate(task.baseline0Start) : "—"}
                </div>
              )}

              {/* Baseline Finish Date */}
              {activeVisibleColumns.baselineFinish && (
                <div
                  style={{ width: `${colWidths.baselineFinish}px` }}
                  className="shrink-0 text-center text-[11.5px] font-mono tabular-nums text-slate-500 font-medium truncate"
                >
                  {task.baseline0Finish ? formatDisplayDate(task.baseline0Finish) : "—"}
                </div>
              )}

              {/* Variance Badge */}
              {activeVisibleColumns.variance && (
                <div
                  style={{ width: `${colWidths.variance}px` }}
                  className="shrink-0 text-center flex items-center justify-center px-1"
                >
                  {task.baseline0Start && task.baseline0Finish ? (
                    (() => {
                      const v = calculateScheduleVariance(task, projectCalendar);
                      const disp = formatVarianceDisplay(v.finishVariance);
                      return (
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono tabular-nums font-semibold border ${disp.badgeClass}`}
                          title={`Schedule variance: ${disp.label} (${v.finishVariance > 0 ? "delayed" : v.finishVariance < 0 ? "ahead" : "on track"})`}
                        >
                          {disp.shortLabel}
                        </span>
                      );
                    })()
                  ) : (
                    <span className="text-[11px] text-slate-300 font-mono" title="No baseline reference saved">—</span>
                  )}
                </div>
              )}

              {/* Duration */}
              {activeVisibleColumns.duration && (
                <div
                  style={{ width: `${colWidths.duration}px` }}
                  className="shrink-0 text-center font-mono tabular-nums text-[11.5px] text-slate-600 font-medium truncate"
                >
                  {task.duration !== undefined ? `${task.duration}d` : "—"}
                </div>
              )}

              {/* Progress Bar + % */}
              {visibleColumns.progress && (
                <div
                  style={{ width: `${colWidths.progress}px` }}
                  className="flex shrink-0 items-center justify-end gap-1.5 pr-1"
                >
                  <div className="h-1.5 w-7 rounded-full bg-slate-100 border border-slate-200/50 overflow-hidden shrink-0">
                    <div
                      className={`h-full rounded-full transition-all ${
                        task.progress >= 100
                          ? "bg-emerald-500"
                          : task.progress > 0
                          ? "bg-blue-600"
                          : "bg-slate-200"
                      }`}
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                  <span className="w-7 text-right text-[11px] font-mono tabular-nums text-slate-700 shrink-0 font-medium">
                    {task.progress}%
                  </span>

                  {/* Row Context Menu for Selected Row */}
                  {isSelected ? (
                    <button className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-blue-600 hover:bg-blue-100 ml-0.5">
                      <MoreHorizontal className="h-3 w-3" />
                    </button>
                  ) : (
                    <div className="w-4 shrink-0" />
                  )}
                </div>
              )}

              {/* Trade */}
              {visibleColumns.trade && (
                <div
                  style={{ width: `${colWidths.trade}px` }}
                  className="shrink-0 flex items-center px-1 truncate"
                >
                  {task.trade ? (
                    <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600">
                      {String(task.trade)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-300 pl-2">—</span>
                  )}
                </div>
              )}

              {/* Cost Code */}
              {visibleColumns.costCode && (
                <div
                  style={{ width: `${colWidths.costCode}px` }}
                  className="shrink-0 flex items-center px-1 font-mono text-[11px] text-slate-500 truncate"
                >
                  {task.costCode ? (
                    <span className="truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.2">
                      {task.costCode}
                    </span>
                  ) : (
                    <span className="text-[11px] text-slate-300 pl-2">—</span>
                  )}
                </div>
              )}

              {/* Float */}
              {visibleColumns.float && (
                <div
                  style={{ width: `${colWidths.float}px` }}
                  className="shrink-0 text-center font-mono tabular-nums text-[11.5px] font-medium truncate flex items-center justify-center px-1"
                >
                  {task.float !== undefined ? (
                    task.isCritical || task.float <= 0 ? (
                      <span
                        className="inline-flex px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200"
                        title="Critical activity: 0 working days total float"
                      >
                        0d
                      </span>
                    ) : (
                      <span className="text-slate-600 font-medium" title={`Total float: ${task.float} working days`}>
                        {task.float}d
                      </span>
                    )
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
