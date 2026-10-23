"use client";

import React, { useState, useMemo } from "react";
import type { ProgrammeTask } from "@/lib/programme-types";
import { useProgramme } from "@/lib/programme-context";
import { getTaskPredecessorLinks } from "@/lib/programme-dependencies";
import {
  AlertCircle,
  Compass,
  Maximize2,
  ZoomIn,
  ZoomOut,
  X,
  GitCompare,
  Flame,
} from "lucide-react";
import { calculateScheduleVariance, formatVarianceDisplay } from "@/lib/programme-calendar";

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

export function Timeline({
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
    criticalPathActive,
    showBaselineComparison,
    selectedBaselineVersion,
    projectCalendar,
  } = useProgramme();
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
    // Dynamic calculation based on task dates, reflecting calendar and working days
    const startX = Math.round(dateToX(task.startDate, monthWidth));
    const endX = Math.round(dateToX(task.endDate, monthWidth));
    let baseLeft = Math.round(startX / scale);
    let baseWidth = Math.max(Math.round((endX - startX) / scale), task.isMilestone ? 18 : 24);
    let type = "task-blue";
    let label = `${task.name} ${task.progress}%`;
    let hasMilestone = false;

    if (task.id === "task-columns") {
      baseLeft += (rescheduledTaskId === "task-columns" ? rescheduleDelta : 0);
      type = "selected-columns";
      label = "Level 2 - Columns";
      hasMilestone = true;
    } else if (task.level === "phase" || task.id === "task-superstructure") {
      type = "summary-bracket";
      label = `${task.name} ${task.progress}%`;
      hasMilestone = true;
    } else if (task.isMilestone || task.duration === 0 || task.id === "task-completion") {
      type = "milestone-diamond";
      label = task.name + (task.progress >= 100 ? " 100%" : " ◆");
    } else if (task.progress >= 100) {
      type = "complete-green";
      label = `${task.name} 100%`;
    } else if (task.progress === 0) {
      type = "task-gray";
      label = `${task.name} 0%`;
    }

    return {
      left: Math.round(baseLeft * scale),
      width: Math.round(baseWidth * scale),
      type,
      label,
      hasMilestone,
    };
  };

  // Baseline 0 Bar coordinates & variance calculation
  const getBaselineBarCoords = (
    task: ProgrammeTask,
  ): {
    left: number;
    width: number;
    hasBaseline: boolean;
    isMilestone?: boolean;
    varianceDays: number;
    isDelayed: boolean;
    isAhead: boolean;
  } | null => {
    if (!task.baseline0Start || !task.baseline0Finish) {
      return null;
    }

    const startX = Math.round(dateToX(task.baseline0Start, monthWidth));
    const endX = Math.round(dateToX(task.baseline0Finish, monthWidth));
    const baseLeft = Math.round(startX / scale);
    const baseWidth = Math.max(Math.round((endX - startX) / scale), task.isMilestone ? 14 : 18);
    const variance = calculateScheduleVariance(task, projectCalendar);

    return {
      left: Math.round(baseLeft * scale),
      width: Math.round(baseWidth * scale),
      hasBaseline: true,
      isMilestone: task.isMilestone || task.duration === 0 || task.id === "task-completion",
      varianceDays: variance.finishVariance,
      isDelayed: variance.isDelayed,
      isAhead: variance.isAhead,
    };
  };

  // Planned & dynamic dependency link connections
  const dependencyLinks = useMemo(() => {
    const links: { pred: string; succ: string; type: "FS" | "SS" | "FF" | "SF"; lag: number }[] = [];
    const seen = new Set<string>();

    for (const task of tasks) {
      const preds = getTaskPredecessorLinks(task);
      for (const p of preds) {
        const key = `${p.id}->${task.id}`;
        if (!seen.has(key)) {
          seen.add(key);
          links.push({
            pred: p.id,
            succ: task.id,
            type: p.type || "FS",
            lag: p.lag || 0,
          });
        }
      }
    }

    if (links.length === 0) {
      return [
        { pred: "task-site-est", succ: "task-earthworks", type: "FS" as const, lag: 0 },
        { pred: "task-earthworks", succ: "task-superstructure", type: "FS" as const, lag: 0 },
        { pred: "task-level-1", succ: "task-level-2", type: "FS" as const, lag: 0 },
        { pred: "task-columns", succ: "task-blockwork", type: "FS" as const, lag: 0 },
        { pred: "task-blockwork", succ: "task-slab", type: "FS" as const, lag: 0 },
        { pred: "task-slab", succ: "task-level-3", type: "FS" as const, lag: 0 },
        { pred: "task-level-3", succ: "task-level-4", type: "FS" as const, lag: 0 },
        { pred: "task-level-4", succ: "task-facade", type: "FS" as const, lag: 0 },
        { pred: "task-facade", succ: "task-fitout", type: "FS" as const, lag: 0 },
        { pred: "task-fitout", succ: "task-completion", type: "FS" as const, lag: 0 },
      ];
    }

    return links;
  }, [tasks]);

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
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-x-auto overflow-y-auto relative"
      >
        <div style={{ width: `${totalWidth}px` }} className="relative min-h-full">
          {/* Timeline Header */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white">
            {/* Row 1: Years */}
            <div className="flex h-5 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              <div style={{ width: `${monthWidth * 4}px` }} className="pl-3 flex items-center">
                2025
              </div>
              <div style={{ width: `${monthWidth * 12}px` }} className="pl-3 flex items-center">
                2026
              </div>
            </div>

            {/* Row 2: Months + Today Badge */}
            <div className="flex h-6 items-center text-[11px] font-semibold text-slate-600 relative">
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

              let x1: number;
              let x2: number;
              if (link.type === "SS") {
                x1 = pCoords.left;
                x2 = sCoords.left;
              } else if (link.type === "FF") {
                x1 = pCoords.left + pCoords.width;
                x2 = sCoords.left + sCoords.width;
              } else if (link.type === "SF") {
                x1 = pCoords.left;
                x2 = sCoords.left + sCoords.width;
              } else {
                x1 = pCoords.left + pCoords.width;
                x2 = sCoords.left;
              }
              const y1 = pIndex * 40 + 20;
              const y2 = sIndex * 40 + 20;

              const isDirectlyConnected =
                state.selectedTaskId &&
                (link.pred === state.selectedTaskId || link.succ === state.selectedTaskId);
              const isCriticalLink = criticalPathActive && (pTask.isCritical || link.pred === "task-columns") && (sTask.isCritical || link.succ === "task-columns");
              const isDimmed = (state.selectedTaskId && !isDirectlyConnected) || (criticalPathActive && !isCriticalLink);

              // Smooth curved connection according to relationship geometry
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
                <g key={`dep-g-${idx}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isCriticalLink ? 2.5 : isDirectlyConnected ? 2.5 : 1.5}
                    opacity={isDimmed ? 0.3 : 1}
                    markerEnd={markerEnd}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />
                  {link.type !== "FS" && !isDimmed && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                      <rect
                        x="-10"
                        y="-7"
                        width="20"
                        height="14"
                        rx="3"
                        fill="#ffffff"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill={strokeColor}
                        fontFamily="monospace"
                      >
                        {link.type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Task Gantt Bars Rows */}
          <div className="divide-y divide-slate-100">
            {tasks.map((task) => {
              const coords = getTaskBarCoords(task);
              const isSelected = state.selectedTaskId === task.id;
              const isCritical = Boolean(task.isCritical || (typeof task.float === "number" && task.float <= 0));
              const isDimmed = criticalPathActive && !isCritical;

              const isDualTrack = Boolean(showBaselineComparison);
              const baselineCoords = isDualTrack ? getBaselineBarCoords(task) : null;

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
                      className={`absolute rounded-xs bg-emerald-500 transition-all flex items-center px-2 group z-15 ${
                        isCritical ? "border-t-2 border-rose-500 shadow-xs" : ""
                      } ${isDualTrack ? "top-1 h-3.5" : "h-5"}`}
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      <span className="relative z-10 text-[9.5px] font-semibold text-white tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                        {isCritical && <Flame className="h-2.5 w-2.5 text-white/90 shrink-0" />}
                        <span>{coords.label}</span>
                      </span>
                    </div>
                  )}

                  {/* Summary Bracket Bar */}
                  {coords.type === "summary-bracket" && (
                    <div
                      className={`absolute rounded-xs bg-blue-600 flex items-center z-15 ${
                        isCritical ? "border-t-2 border-rose-500" : ""
                      } ${isDualTrack ? "top-1 h-3" : "h-3.5"}`}
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
                      className={`absolute rounded-xs border-2 border-blue-600 bg-blue-100/95 flex items-center justify-between px-2 text-blue-950 font-bold text-[10px] tracking-tight transition-all relative overflow-visible z-20 ${
                        isCritical ? "border-t-4 border-t-rose-600" : ""
                      } ${isDualTrack ? "top-0.5 h-4.5" : "h-6"}`}
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      {/* Reschedule Handle */}
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
                        className="absolute -left-2 top-1/2 -translate-y-1/2 flex h-3.5 w-3.5 items-center justify-center rounded-xs bg-white border border-blue-600 text-blue-700 hover:bg-blue-50 text-[7.5px] font-mono font-bold z-30 cursor-pointer"
                      >
                        {rescheduleDelta > 0 ? "+3" : "⋮⋮"}
                      </button>

                      {/* Inner Progress Fill */}
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-blue-300/60 rounded-l-xs pointer-events-none"
                        style={{ width: `${task.progress}%` }}
                      />

                      {/* Text Label inside bar */}
                      <span className="relative z-10 whitespace-nowrap pr-1 pl-1 truncate font-bold text-blue-950 flex items-center gap-1">
                        {isCritical && <Flame className="h-3 w-3 text-rose-600 shrink-0" />}
                        <span>{coords.label}</span>
                      </span>

                      {/* Milestone Diamond at finish edge */}
                      {coords.hasMilestone && (
                        <div className="absolute -right-2 h-3 w-3 rotate-45 bg-slate-800 z-20" />
                      )}
                    </div>
                  )}

                  {/* In-Progress Blue Task Bar */}
                  {coords.type === "task-blue" && (
                    <div
                      className={`absolute rounded-xs bg-blue-500 transition-all hover:bg-blue-600 flex items-center px-2 relative group overflow-visible z-15 ${
                        isCritical ? "border-t-2 border-rose-500 shadow-xs" : ""
                      } ${isDualTrack ? "top-1 h-3.5" : "h-5"}`}
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
                      <span className="relative z-10 text-[9.5px] font-semibold text-white tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                        {isCritical && <Flame className="h-2.5 w-2.5 text-white/90 shrink-0" />}
                        <span>{coords.label}</span>
                      </span>
                    </div>
                  )}

                  {/* Not Started / Future Gray Task Bar */}
                  {coords.type === "task-gray" && (
                    <div
                      className={`absolute rounded-xs border border-slate-300 bg-slate-200/80 flex items-center px-2 relative group overflow-visible z-15 ${
                        isCritical ? "border-t-2 border-rose-500 shadow-xs" : ""
                      } ${isDualTrack ? "top-1 h-3.5" : "h-5"}`}
                      style={{
                        left: `${coords.left}px`,
                        width: `${coords.width}px`,
                      }}
                    >
                      <span className="relative z-10 text-[9.5px] font-semibold text-slate-700 tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                        {isCritical && <Flame className="h-2.5 w-2.5 text-rose-600 shrink-0" />}
                        <span>{coords.label}</span>
                      </span>
                    </div>
                  )}

                  {/* Milestone Diamond Bar */}
                  {coords.type === "milestone-diamond" && (
                    <div
                      className={`absolute flex items-center z-20 ${isDualTrack ? "top-1" : ""}`}
                      style={{ left: `${coords.left}px` }}
                    >
                      <div className={`h-3.5 w-3.5 rotate-45 bg-amber-500 ring-2 ${isCritical ? "ring-rose-500" : "ring-white"}`} />
                      <span className="ml-2.5 whitespace-nowrap text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                        {isCritical && <Flame className="h-3 w-3 text-rose-600 shrink-0" />}
                        <span>{coords.label}</span>
                      </span>
                    </div>
                  )}

                  {/* Dual-Track Baseline Reference Bar */}
                  {isDualTrack && baselineCoords && (
                    <>
                      {/* Translucent Delay Band connecting baseline finish to current finish */}
                      {baselineCoords.varianceDays > 0 && (
                        <div
                          className="absolute top-1 bottom-1.5 rounded-xs bg-amber-500/15 border-t border-b border-dashed border-amber-500/60 pointer-events-none z-8"
                          style={{
                            left: `${Math.min(baselineCoords.left + baselineCoords.width, coords.left + coords.width)}px`,
                            width: `${Math.max(4, Math.abs((coords.left + coords.width) - (baselineCoords.left + baselineCoords.width)))}px`,
                          }}
                        />
                      )}

                      {/* Baseline Solid/Hatched Bar */}
                      {baselineCoords.isMilestone ? (
                        <div
                          className="absolute bottom-1 h-3 w-3 rotate-45 border-2 border-slate-600 bg-slate-400 z-12"
                          style={{ left: `${baselineCoords.left}px` }}
                          title={`Baseline 0 Milestone: ${task.baseline0Start}`}
                        />
                      ) : (
                        <div
                          className="absolute bottom-1.5 h-2.5 rounded-xs border border-slate-500/80 z-10 overflow-visible"
                          style={{
                            left: `${baselineCoords.left}px`,
                            width: `${baselineCoords.width}px`,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 3px, rgba(100, 116, 139, 0.95) 3px, rgba(100, 116, 139, 0.95) 6px)",
                          }}
                          title={`Baseline 0: ${task.baseline0Start} → ${task.baseline0Finish}`}
                        >
                          {/* Left and right bracket caps */}
                          <span className="absolute -top-1 left-0 h-4 w-0.5 bg-slate-600 rounded-full" />
                          <span className="absolute -top-1 right-0 h-4 w-0.5 bg-slate-600 rounded-full" />
                        </div>
                      )}

                      {/* Variance Indicator Badge at finish edge */}
                      <span
                        className={`absolute inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold whitespace-nowrap z-25 border shadow-2xs ${
                          baselineCoords.varianceDays > 0
                            ? baselineCoords.varianceDays >= 5
                              ? "bg-red-50 text-red-700 border-red-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                            : baselineCoords.varianceDays < 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                        style={{
                          left: `${Math.max(coords.left + coords.width, baselineCoords.left + baselineCoords.width) + 6}px`,
                          top: "2px",
                        }}
                      >
                        {baselineCoords.varianceDays > 0
                          ? `+${baselineCoords.varianceDays}d`
                          : baselineCoords.varianceDays < 0
                          ? `${baselineCoords.varianceDays}d`
                          : "0d"}
                      </span>
                    </>
                  )}

                  {/* Task with No Baseline Indicator */}
                  {isDualTrack && !baselineCoords && (
                    <span
                      className="absolute text-[9px] text-slate-300 font-mono italic whitespace-nowrap pointer-events-none"
                      style={{
                        left: `${coords.left + coords.width + 8}px`,
                        top: "12px",
                      }}
                    >
                      No baseline
                    </span>
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
          className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-full rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-white shadow-xl max-w-xs select-none"
          style={{ left: `${hoveredTask.x}px`, top: `${hoveredTask.y}px` }}
        >
          <div className="text-[12px] font-semibold text-white truncate">{hoveredTask.task.name}</div>
          <div className="mt-1 space-y-1 text-[10.5px] font-mono">
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <span className="text-slate-400">Current:</span>
              <span className="font-medium text-white">
                {hoveredTask.task.displayStart || hoveredTask.task.startDate} → {hoveredTask.task.displayEnd || hoveredTask.task.endDate} ({hoveredTask.task.duration}d)
              </span>
            </div>
            {hoveredTask.task.baseline0Start && hoveredTask.task.baseline0Finish ? (
              <>
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="text-slate-400">Baseline 0:</span>
                  <span className="font-medium text-slate-200">
                    {hoveredTask.task.baseline0Start} → {hoveredTask.task.baseline0Finish}
                  </span>
                </div>
                {(() => {
                  const v = calculateScheduleVariance(hoveredTask.task, projectCalendar);
                  const disp = formatVarianceDisplay(v.finishVariance);
                  return (
                    <div className="flex items-center justify-between gap-3 pt-1 mt-1 border-t border-slate-700/80">
                      <span className="text-slate-400">Variance:</span>
                      <span
                        className={`font-semibold px-1 py-0.2 rounded text-[10px] ${
                          v.finishVariance > 0
                            ? "bg-amber-950/80 text-amber-300"
                            : v.finishVariance < 0
                            ? "bg-emerald-950/80 text-emerald-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {disp.label}
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-[10px] text-slate-400 italic pt-0.5">No baseline reference saved</div>
            )}
            <div className="flex items-center justify-between gap-3 text-slate-300 pt-1 mt-1 border-t border-slate-700/80">
              <span className="text-slate-400">Total / Free Float:</span>
              <span className="font-medium text-white">
                {hoveredTask.task.float ?? 0}d / {hoveredTask.task.freeFloat ?? hoveredTask.task.float ?? 0}d
              </span>
            </div>
            {hoveredTask.task.isCritical && (
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold pt-0.5 text-[10.5px]">
                <Flame className="h-3 w-3 text-rose-500" />
                <span>Critical Path Activity</span>
              </div>
            )}
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

          {showBaselineComparison && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-4 rounded-xs border border-slate-500/80"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 2px, rgba(100, 116, 139, 0.95) 2px, rgba(100, 116, 139, 0.95) 4px)",
                  }}
                />
                <span className="font-semibold text-slate-700">Baseline 0</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-amber-500" />
                <span className="font-semibold text-amber-700">Schedule Slip</span>
              </div>
            </div>
          )}
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
