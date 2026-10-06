"use client";

import React, { useState } from "react";
import type { ProgrammeTask } from "@/lib/programme-types";
import { useProgramme } from "@/lib/programme-context";
import {
  AlertCircle,
  Compass,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
} from "lucide-react";

interface MonthDef {
  key: string;
  name: string;
  year: number;
  width: number;
}

// 16 Months spanning Sep 2025 through Dec 2026 for full project lifecycle
const MONTHS: MonthDef[] = [
  { key: "sep-25", name: "Sep", year: 2025, width: 76 },
  { key: "oct-25", name: "Oct", year: 2025, width: 76 },
  { key: "nov-25", name: "Nov", year: 2025, width: 76 },
  { key: "dec-25", name: "Dec", year: 2025, width: 76 },
  { key: "jan-26", name: "Jan", year: 2026, width: 76 },
  { key: "feb-26", name: "Feb", year: 2026, width: 76 },
  { key: "mar-26", name: "Mar", year: 2026, width: 76 },
  { key: "apr-26", name: "Apr", year: 2026, width: 76 },
  { key: "may-26", name: "May", year: 2026, width: 76 },
  { key: "jun-26", name: "Jun", year: 2026, width: 76 },
  { key: "jul-26", name: "Jul", year: 2026, width: 76 },
  { key: "aug-26", name: "Aug", year: 2026, width: 76 },
  { key: "sep-26", name: "Sep", year: 2026, width: 76 },
  { key: "oct-26", name: "Oct", year: 2026, width: 76 },
  { key: "nov-26", name: "Nov", year: 2026, width: 76 },
  { key: "dec-26", name: "Dec", year: 2026, width: 76 },
];

function dateToX(dateStr?: string, monthWidth = 76): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const yearDiff = d.getFullYear() - 2025;
  const monthDiff = yearDiff * 12 + d.getMonth() - 8; // 8 = Sep (0-indexed)
  const dayOfMonth = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, monthDiff * monthWidth + (dayOfMonth / daysInMonth) * monthWidth);
}

export function Timeline({ tasks }: { tasks: ProgrammeTask[] }) {
  const { state, selectTask, criticalPathActive } = useProgramme();
  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [hoveredTask, setHoveredTask] = useState<{
    task: ProgrammeTask;
    x: number;
    y: number;
  } | null>(null);

  const [rescheduleDelta, setRescheduleDelta] = useState<number>(0);
  const [rescheduledTaskId, setRescheduledTaskId] = useState<string | null>(null);
  const [showOverlapWarning, setShowOverlapWarning] = useState<boolean>(false);

  const zoomFactor =
    state.zoomLevel === "day"
      ? 180
      : state.zoomLevel === "week"
      ? 120
      : state.zoomLevel === "quarter"
      ? 48
      : 76;
  const monthWidth = zoomFactor;
  const scale = monthWidth / 76;
  const totalWidth = MONTHS.length * monthWidth;

  // Today marker X position in Oct 2025 (Sep = 76px, Oct 15th ~ 76 + 37 = 113px) scaled by zoom factor
  const todayX = Math.round((76 + 37) * scale);

  // Calibrated bar coordinates & labels matching the primary design reference (Image 4)
  const getTaskBarCoords = (
    task: ProgrammeTask,
  ): {
    left: number;
    width: number;
    type: string;
    label: string;
    hasMilestone?: boolean;
  } => {
    let baseLeft = 0;
    let baseWidth = 40;
    let type = "task-blue";
    let label = `${task.name} ${task.progress}%`;
    let hasMilestone = false;

    switch (task.id) {
      case "task-site-est":
        baseLeft = 4;
        baseWidth = 44;
        type = "complete-green";
        label = "Site Establishment 100%";
        break;
      case "task-earthworks":
        baseLeft = 48;
        baseWidth = 72;
        type = "complete-green";
        label = "Earthworks 82%";
        break;
      case "task-superstructure":
        baseLeft = 116;
        baseWidth = 386;
        type = "summary-bracket";
        label = "Superstructure 68%";
        hasMilestone = true;
        break;
      case "task-level-1":
        baseLeft = 116;
        baseWidth = 154;
        type = "task-blue";
        label = "Level 1 100%";
        break;
      case "task-level-2":
        baseLeft = 270;
        baseWidth = 172;
        type = "task-blue";
        label = "Level 2 46%";
        break;
      case "task-columns":
        baseLeft = 270 + (rescheduledTaskId === "task-columns" ? rescheduleDelta : 0);
        baseWidth = 92;
        type = "selected-columns";
        label = "Level 2 - Columns";
        hasMilestone = true;
        break;
      case "task-blockwork":
        baseLeft = 362;
        baseWidth = 56;
        type = "task-blue";
        label = "25%";
        break;
      case "task-slab":
        baseLeft = 422;
        baseWidth = 46;
        type = "task-gray";
        label = "0%";
        break;
      case "task-level-3":
        baseLeft = 472;
        baseWidth = 178;
        type = "task-gray";
        label = "Level 3 0%";
        break;
      case "task-level-4":
        baseLeft = 654;
        baseWidth = 84;
        type = "task-gray";
        label = "Level 4 0%";
        break;
      case "task-facade":
        baseLeft = 520;
        baseWidth = 236;
        type = "task-blue";
        label = "Façade 34%";
        break;
      case "task-fitout":
        baseLeft = 556;
        baseWidth = 398;
        type = "task-gray";
        label = "Fitout 0%";
        break;
      case "task-external-works":
        baseLeft = 958;
        baseWidth = 104;
        type = "task-gray";
        label = "External Works 0%";
        break;
      case "task-completion":
        baseLeft = 1066;
        baseWidth = 20;
        type = "milestone-diamond";
        label = "Completion ◆";
        break;
      default: {
        // Dynamic calculation based on task dates
        const startX = Math.round(dateToX(task.startDate, monthWidth));
        const endX = Math.round(dateToX(task.endDate, monthWidth));
        baseLeft = Math.round(startX / scale);
        baseWidth = Math.max(Math.round((endX - startX) / scale), task.isMilestone ? 18 : 36);

        if (task.level === "phase") type = "summary-bracket";
        else if (task.isMilestone || task.duration === 0) type = "milestone-diamond";
        else if (task.progress >= 100) type = "complete-green";
        else if (task.progress === 0) type = "task-gray";
        break;
      }
    }

    return {
      left: Math.round(baseLeft * scale),
      width: Math.round(baseWidth * scale),
      type,
      label,
      hasMilestone,
    };
  };

  // Planned dependency link connections between predecessor finish and successor start
  const dependencyLinks = [
    { pred: "task-site-est", succ: "task-earthworks" },
    { pred: "task-earthworks", succ: "task-superstructure" },
    { pred: "task-level-1", succ: "task-level-2" },
    { pred: "task-columns", succ: "task-blockwork" },
    { pred: "task-blockwork", succ: "task-slab" },
    { pred: "task-slab", succ: "task-level-3" },
    { pred: "task-level-3", succ: "task-level-4" },
    { pred: "task-level-4", succ: "task-facade" },
    { pred: "task-facade", succ: "task-fitout" },
    { pred: "task-fitout", succ: "task-completion" },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-white select-none min-w-0 relative">
      {/* Reschedule Overlap Warning Banner (Linear NUR-180) */}
      {showOverlapWarning && (
        <div className="flex items-center justify-between bg-amber-50 border-b border-amber-200 px-4 py-2 text-[12px] text-amber-900 z-30">
          <div className="flex items-center gap-2">
            <span className="font-bold flex items-center gap-1 text-amber-800">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Reschedule Overlap (+3 days):</span>
            </span>
            <span>
              Level 2 - Columns finish pushes into successor &ldquo;Blockwork&rdquo; by 2 working days.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                alert("Auto-shifted successor tasks on critical path by +2 working days.");
                setShowOverlapWarning(false);
              }}
              className="rounded-sm bg-amber-600 hover:bg-amber-700 text-white font-medium px-2.5 py-1 text-[11px] transition-colors cursor-pointer"
            >
              Auto-shift Successors
            </button>
            <button
              onClick={() => {
                setRescheduleDelta(0);
                setRescheduledTaskId(null);
                setShowOverlapWarning(false);
              }}
              className="rounded-sm border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 px-2 py-1 text-[11px] transition-colors cursor-pointer"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Scrollable Timeline Area */}
      <div className="flex-1 overflow-x-auto overflow-y-auto relative">
        <div style={{ width: `${totalWidth}px` }} className="relative min-h-full">
          {/* Timeline Header */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            {/* Row 1: Years */}
            <div className="flex h-5 border-b border-slate-100 text-[10.5px] font-semibold text-slate-400">
              <div style={{ width: `${monthWidth * 4}px` }} className="pl-3 flex items-center">
                2025
              </div>
              <div style={{ width: `${monthWidth * 12}px` }} className="pl-3 flex items-center">
                2026
              </div>
            </div>

            {/* Row 2: Months + Today Badge */}
            <div className="flex h-6 items-center text-[11px] font-medium text-slate-500 relative">
              {MONTHS.map((m) => (
                <div
                  key={m.key}
                  style={{ width: `${m.width}px` }}
                  className="text-center shrink-0 border-r border-slate-100/90"
                >
                  {m.name}
                </div>
              ))}

              {/* Blue "Today" Badge */}
              <div
                className="absolute -bottom-1 z-30 -translate-x-1/2 rounded-xs bg-blue-600 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white pointer-events-none"
                style={{ left: `${todayX}px` }}
              >
                Today
              </div>
            </div>
          </div>

          {/* Dotted Vertical "Today" Line extending down */}
          <div
            className="absolute top-11 bottom-0 w-px border-l-2 border-dotted border-blue-400/80 z-10 pointer-events-none"
            style={{ left: `${todayX}px` }}
          />

          {/* Month Vertical Grid Lines */}
          <div className="absolute inset-0 top-11 pointer-events-none flex">
            {MONTHS.map((m) => (
              <div
                key={m.key}
                style={{ width: `${m.width}px` }}
                className="h-full border-r border-slate-100/80 shrink-0"
              />
            ))}
          </div>

          {/* Dynamic SVG Bezier Dependency Lines Overlay */}
          <svg className="absolute inset-0 top-11 w-full h-full pointer-events-none z-10">
            <defs>
              <marker
                id="arrowhead-default"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#2563eb" />
              </marker>
              <marker
                id="arrowhead-critical"
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>
            {dependencyLinks.map((link, idx) => {
              const pIndex = tasks.findIndex((t) => t.id === link.pred);
              const sIndex = tasks.findIndex((t) => t.id === link.succ);
              if (pIndex === -1 || sIndex === -1) return null;

              const pTask = tasks[pIndex];
              const sTask = tasks[sIndex];
              const pCoords = getTaskBarCoords(pTask);
              const sCoords = getTaskBarCoords(sTask);

              const x1 = pCoords.left + pCoords.width;
              const y1 = pIndex * 40 + 20;
              const x2 = sCoords.left;
              const y2 = sIndex * 40 + 20;

              const isDirectlyConnected =
                state.selectedTaskId &&
                (link.pred === state.selectedTaskId || link.succ === state.selectedTaskId);
              const isCriticalLink = criticalPathActive && (pTask.isCritical || link.pred === "task-columns") && (sTask.isCritical || link.succ === "task-columns");
              const isDimmed = (state.selectedTaskId && !isDirectlyConnected) || (criticalPathActive && !isCriticalLink);

              // Smooth curved connection from predecessor finish to successor start
              const d =
                x2 >= x1
                  ? `M ${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} H ${x1 + 12} V ${y2} H ${x2}`;

              const strokeColor = isCriticalLink
                ? "#ef4444"
                : isDirectlyConnected
                ? "#2563eb"
                : isDimmed
                ? "#e2e8f0"
                : "#94a3b8";

              const markerEnd = isCriticalLink
                ? "url(#arrowhead-critical)"
                : isDirectlyConnected
                ? "url(#arrowhead-active)"
                : "url(#arrowhead-default)";

              return (
                <path
                  key={`dep-${idx}`}
                  d={d}
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth={isCriticalLink ? 2.5 : isDirectlyConnected ? 2.5 : 1.5}
                  opacity={isDimmed ? 0.3 : 1}
                  markerEnd={markerEnd}
                  strokeLinecap="round"
                  className="transition-all duration-200"
                />
              );
            })}
          </svg>

          {/* Task Gantt Bars Rows */}
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const coords = getTaskBarCoords(task);
              const isSelected = state.selectedTaskId === task.id;
              const isCritical = task.isCritical || task.id === "task-columns";
              const isDimmed = criticalPathActive && !isCritical;

              return (
                <div
                  key={task.id}
                  onClick={() => selectTask(task.id)}
                  onMouseEnter={(e) => {
                    setHoveredTask({
                      task,
                      x: e.clientX,
                      y: e.clientY - 12,
                    });
                  }}
                  onMouseLeave={() => setHoveredTask(null)}
                  className={`relative flex h-10 items-center cursor-pointer transition-all ${
                    isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/40"
                  } ${isDimmed ? "opacity-35" : "opacity-100"}`}
                >
                  {/* Complete Green Bar */}
                  {coords.type === "complete-green" && (
                    <div
                      className="absolute h-5 rounded-xs bg-emerald-500 transition-all flex items-center px-2 group"
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Technical Label Beside Bar */}
                      <span className="absolute left-full ml-2 inline-flex items-center rounded-xs bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200 whitespace-nowrap pointer-events-none z-20">
                        {coords.label}
                      </span>
                    </div>
                  )}

                  {/* Summary Bracket Bar */}
                  {coords.type === "summary-bracket" && (
                    <div
                      className="absolute h-3.5 rounded-xs bg-blue-600 flex items-center"
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Left and right downward bracket hooks */}
                      <span className="absolute -bottom-1.5 left-0 h-2 w-1.5 bg-blue-600 rounded-bl-xs" />
                      <span className="absolute -bottom-1.5 right-0 h-2 w-1.5 bg-blue-600 rounded-br-xs" />

                      {/* Diamond Milestone at end if applicable */}
                      {coords.hasMilestone && (
                        <div className="absolute -right-2.5 h-3 w-3 rotate-45 bg-slate-800" />
                      )}
                    </div>
                  )}

                  {/* Selected Task Bar (Level 2 - Columns) */}
                  {coords.type === "selected-columns" && (
                    <div
                      className="absolute h-6 rounded-xs border-2 border-blue-600 bg-blue-100/95 flex items-center justify-between px-2 text-blue-900 font-semibold text-[10px] tracking-tight transition-all relative overflow-visible z-20"
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Reschedule Handle (Drag simulation from Linear NUR-180) */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (rescheduleDelta === 0) {
                            setRescheduledTaskId("task-columns");
                            setRescheduleDelta(24);
                            setShowOverlapWarning(true);
                          } else {
                            setRescheduleDelta(0);
                            setRescheduledTaskId(null);
                            setShowOverlapWarning(false);
                          }
                        }}
                        title={rescheduleDelta > 0 ? "Reset reschedule" : "Simulate reschedule delay (+3d)"}
                        className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-4 w-4 items-center justify-center rounded-xs bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 text-[8px] font-mono font-bold z-30 cursor-pointer"
                      >
                        {rescheduleDelta > 0 ? "+3" : "⋮⋮"}
                      </button>

                      {/* Inner Progress Fill */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-300/60 rounded-l-xs pointer-events-none"
                        style={{ width: `${task.progress}%` }}
                      />

                      {/* Text Label inside bar - fits cleanly without truncation */}
                      <span className="relative z-10 whitespace-nowrap pr-1 pl-1">
                        {coords.label}
                      </span>

                      {/* Milestone Diamond at finish edge */}
                      {coords.hasMilestone && (
                        <div className="absolute -right-2 h-3.5 w-3.5 rotate-45 bg-slate-800 z-20" />
                      )}
                    </div>
                  )}

                  {/* In-Progress Blue Task Bar */}
                  {coords.type === "task-blue" && (
                    <div
                      className="absolute h-5 rounded-xs bg-blue-500 transition-all hover:bg-blue-600 flex items-center px-2 relative group overflow-visible z-15"
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Inner progress tint */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-700/30 rounded-l-xs pointer-events-none"
                        style={{ width: `${task.progress}%` }}
                      />

                      {/* Text label cleanly centered inside bar */}
                      <span className="relative z-10 text-[10px] font-medium text-white truncate w-full text-center">
                        {coords.label}
                      </span>
                    </div>
                  )}

                  {/* Not Started / Future Gray Task Bar */}
                  {coords.type === "task-gray" && (
                    <div
                      className="absolute h-5 rounded-xs border border-slate-300 bg-slate-200/80 flex items-center px-2 relative group overflow-visible z-15"
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Label cleanly inside bar */}
                      <span className="relative z-10 text-[10px] font-medium text-slate-600 truncate w-full text-center">
                        {coords.label}
                      </span>
                    </div>
                  )}

                  {/* Milestone Diamond Bar */}
                  {coords.type === "milestone-diamond" && (
                    <div
                      className="absolute flex items-center z-20"
                      style={{ left: `${coords.left}px` }}
                    >
                      <div className="h-4 w-4 rotate-45 bg-amber-500 ring-2 ring-white" />
                      <span className="ml-3 whitespace-nowrap text-[11px] font-semibold text-slate-800">
                        {coords.label}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Gantt Mini-Map / Navigator Overlay (Toggled from bottom bar) */}
      {showNavigator && (
        <div className="absolute bottom-13 left-4 z-30 flex flex-col rounded-sm border border-slate-200 bg-white p-2.5 shadow-md w-52 select-none pointer-events-auto">
          <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
            <span className="flex items-center gap-1 text-slate-800 font-bold">
              <Compass className="h-3 w-3 text-blue-600" />
              Timeline Navigator
            </span>
            <button
              onClick={() => setShowNavigator(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-xs"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Micro Bird's Eye Overview */}
          <div className="relative h-11 w-full rounded-xs bg-slate-50 border border-slate-100 overflow-hidden px-1 py-1 flex flex-col justify-between">
            <div className="flex items-center gap-1 w-full">
              <div className="h-1 rounded-xs bg-emerald-500 w-4" />
              <div className="h-1 rounded-xs bg-emerald-500 w-6" />
            </div>
            <div className="h-1 rounded-xs bg-blue-600 w-22 ml-4" />
            <div className="flex items-center gap-1 w-full ml-11">
              <div className="h-1 rounded-xs bg-blue-500 w-6" />
              <div className="h-1 rounded-xs bg-blue-600 w-8" />
              <div className="h-1 rounded-xs bg-slate-300 w-5" />
            </div>
            <div className="flex items-center gap-1 w-full ml-24">
              <div className="h-1 rounded-xs bg-cyan-500 w-10" />
              <div className="h-1 rounded-xs bg-slate-300 w-8" />
              <div className="h-1.5 w-1.5 rotate-45 bg-amber-500 ml-1" />
            </div>

            {/* Viewport Highlight Rectangle */}
            <div
              className="absolute inset-y-0.5 border border-blue-600 bg-blue-600/15 rounded-xs pointer-events-none"
              style={{ left: "4px", width: "64px" }}
            />
          </div>
        </div>
      )}

      {/* Hover Floating Tooltip */}
      {hoveredTask && (
        <div
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full rounded-xs border border-slate-700 bg-slate-900 px-2.5 py-1 text-white shadow-md"
          style={{ left: `${hoveredTask.x}px`, top: `${hoveredTask.y}px` }}
        >
          <div className="text-[11px] font-semibold">{hoveredTask.task.name}</div>
          <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-300 font-mono">
            <span>{hoveredTask.task.displayStart}</span>
            <span>→</span>
            <span>{hoveredTask.task.displayEnd}</span>
            <span>·</span>
            <span className="font-semibold text-emerald-400">
              {hoveredTask.task.progress}% done
            </span>
          </div>
        </div>
      )}

      {/* Bottom Status / Critical Path / Zoom Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 text-[12px] text-slate-600 select-none">
        {/* Left: Status Dot Legend */}
        <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-emerald-500" />
            <span>On track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-amber-500" />
            <span>At risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-red-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-slate-300" />
            <span>Not started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rotate-45 bg-slate-800" />
            <span>Milestone</span>
          </div>
        </div>

        {/* Center / Right: Navigator Toggle + Zoom Controls + Task Count */}
        <div className="flex items-center gap-3 text-[12px]">
          {/* Navigator Toggle Button */}
          <button
            onClick={() => setShowNavigator(!showNavigator)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-colors ${
              showNavigator
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Toggle Gantt Mini-Map Navigator"
          >
            <Compass className="h-3.5 w-3.5 text-blue-600" />
            <span>Navigator</span>
          </button>

          {/* Zoom In / Out Controls */}
          <div className="flex items-center gap-1 rounded-sm border border-slate-200 p-0.5 text-slate-600">
            <button
              title="Zoom out"
              className="flex h-6 w-6 items-center justify-center rounded-xs hover:bg-slate-100 text-slate-600"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="px-1.5 font-mono text-[11px] font-medium text-slate-700">
              100%
            </span>
            <button
              title="Zoom in"
              className="flex h-6 w-6 items-center justify-center rounded-xs hover:bg-slate-100 text-slate-600"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>

          {/* Auto-Fit / Maximize Button */}
          <button
            title="Fit to timeline"
            className="flex h-7 w-7 items-center justify-center rounded-sm border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>

          {/* Tasks Shown Counter + View All */}
          <div className="flex items-center gap-1.5 text-[11.5px] pl-1 font-mono">
            <span className="text-slate-500">144 / 817 tasks</span>
            <span className="text-slate-300">·</span>
            <button className="font-sans font-medium text-blue-600 hover:underline">
              View all
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
