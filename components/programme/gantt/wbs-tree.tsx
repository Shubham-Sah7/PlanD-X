"use client";

import React from "react";
import type { ProgrammeTask } from "@/lib/programme-types";
import { useProgramme } from "@/lib/programme-context";
import {
  ChevronRight,
  ChevronDown,
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
} from "lucide-react";

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
  // If already like "01 Sep 25"
  const parts = dateStr.trim().split(/\s+/);
  if (parts.length === 3) {
    const day = parts[0].padStart(2, "0");
    const mon = parts[1].slice(0, 3);
    const yr = parts[2].length === 4 ? parts[2].slice(2) : parts[2];
    return `${day} ${mon} ${yr}`;
  }
  return dateStr;
}

export function WBSTree({ tasks }: { tasks: ProgrammeTask[] }) {
  const { state, selectTask, toggleExpand, expandAll, collapseAll } = useProgramme();

  const allExpanded = tasks.some(
    (t) => t.children.length > 0 && state.expandedNodes.has(t.id),
  );

  return (
    <div className="flex flex-col border-r border-slate-200 bg-white select-none w-[516px] shrink-0">
      {/* Table Header with identical horizontal padding (px-3) to rows */}
      <div className="flex h-11 items-center border-b border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-500">
        {/* # Index Column */}
        <div className="w-9 shrink-0 text-left pl-0.5 font-mono text-[11px] text-slate-400 font-medium">
          #
        </div>

        {/* Task / WBS Column with Collapse/Expand All toggle */}
        <div className="flex-1 min-w-0 flex items-center justify-between pr-3">
          <span>WBS / Task</span>
          <button
            onClick={allExpanded ? collapseAll : expandAll}
            className="text-[11px] font-medium text-slate-400 hover:text-blue-600 transition-colors"
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </button>
        </div>

        {/* Start Date Column */}
        <div className="w-[74px] shrink-0 text-center font-mono text-[11px]">
          Start
        </div>

        {/* Finish Date Column */}
        <div className="w-[74px] shrink-0 text-center font-mono text-[11px]">
          Finish
        </div>

        {/* Progress Column */}
        <div className="w-[86px] shrink-0 text-right pr-1">
          Progress
        </div>
      </div>

      {/* Table Rows */}
      <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
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
              className={`group flex h-10 items-center px-3 text-[13px] transition-colors cursor-pointer ${
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
              <div
                className={`w-9 shrink-0 text-left pl-0.5 font-mono text-[12px] truncate ${
                  isPhase
                    ? "font-semibold text-slate-700"
                    : isWorkPackage
                    ? "font-medium text-slate-600"
                    : "text-slate-400 font-medium"
                }`}
              >
                {task.wbs}
              </div>

              {/* Task / WBS Column */}
              <div
                className="flex flex-1 items-center gap-1.5 min-w-0 pr-3"
                style={{ paddingLeft }}
              >
                {/* Expand / Collapse Chevron */}
                {hasChildren ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(task.id);
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : isLeafTask ? (
                  <span className="w-5 shrink-0 flex items-center justify-center">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusDotColor}`} />
                  </span>
                ) : (
                  <div className="w-5 shrink-0" />
                )}

                {/* Construction Icon */}
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${
                    isPhase
                      ? "text-slate-800"
                      : isWorkPackage
                      ? "text-slate-600"
                      : isSelected
                      ? "text-blue-600"
                      : "text-slate-400"
                  }`}
                >
                  <IconComponent className="h-4 w-4" />
                </div>

                {/* Task Name: 14px / 600 */}
                <span
                  className={`truncate ${
                    isPhase
                      ? "font-semibold text-slate-900 text-[14px] uppercase tracking-wide"
                      : isWorkPackage
                      ? "font-semibold text-slate-800 text-[14px]"
                      : isSelected
                      ? "font-semibold text-blue-900 text-[14px]"
                      : "font-normal text-slate-700 text-[14px]"
                  }`}
                >
                  {task.name}
                </span>

                {/* Task Count Badge */}
                {task.taskCount ? (
                  <span
                    className={`ml-auto mr-0.5 shrink-0 rounded px-1.5 py-0.2 text-[10px] font-medium transition-colors ${
                      isPhase
                        ? "bg-slate-200 text-slate-700"
                        : isSelected
                        ? "bg-blue-200/80 text-blue-800"
                        : "bg-slate-100 text-slate-400 group-hover:bg-slate-200/80"
                    }`}
                  >
                    {task.taskCount}
                  </span>
                ) : null}
              </div>

              {/* Start Date: 12px secondary */}
              <div className="w-[74px] shrink-0 text-center text-[12px] text-slate-400 font-mono">
                {formatDisplayDate(task.displayStart)}
              </div>

              {/* Finish Date: 12px secondary */}
              <div className="w-[74px] shrink-0 text-center text-[12px] text-slate-400 font-mono">
                {formatDisplayDate(task.displayEnd)}
              </div>

              {/* Progress Bar + % */}
              <div className="flex w-[86px] shrink-0 items-center justify-end gap-1.5 pr-0.5">
                <div className="h-1.5 w-7 rounded-full bg-slate-100 overflow-hidden shrink-0">
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
                <span className="w-7 text-right text-[10.5px] font-mono text-slate-600 shrink-0 font-medium">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
