"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  X,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  BarChart2,
  Calendar,
  Layers,
  Flag,
  CheckCircle2,
  Clock,
  Link2,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

interface MilestoneItem {
  id: string;
  taskId: string;
  name: string;
  date: string;
  status: "complete" | "upcoming" | "delayed" | "target";
  isCritical: boolean;
}

const PROGRAMME_MILESTONES: MilestoneItem[] = [
  { id: "m1", taskId: "PRG-001", name: "Site Possession", date: "14 Oct '25", status: "complete", isCritical: true },
  { id: "m2", taskId: "PRG-010", name: "Substructure Handover", date: "18 Dec '25", status: "complete", isCritical: true },
  { id: "m3", taskId: "task-columns", name: "Level 2 Structure", date: "20 Jan '26", status: "delayed", isCritical: true },
  { id: "m4", taskId: "task-superstructure", name: "Superstructure L3", date: "16 Apr '26", status: "upcoming", isCritical: true },
  { id: "m5", taskId: "task-facade", name: "Building Enclosure", date: "15 Jul '26", status: "upcoming", isCritical: false },
  { id: "m6", taskId: "PRG-050", name: "Practical Completion", date: "15 Oct '26", status: "target", isCritical: true },
];

const LEVEL_PROGRESS_DATA = [
  { id: "level-1" as const, name: "Level 1", progress: 100, status: "Complete", tasks: "32/32 Done", color: "bg-emerald-500" },
  { id: "level-2" as const, name: "Level 2", progress: 60, status: "In Progress", tasks: "18/30 Done · Core Blocked", color: "bg-blue-600" },
  { id: "level-3" as const, name: "Level 3", progress: 15, status: "Upcoming", tasks: "Decking & Rebar", color: "bg-slate-400" },
  { id: "level-4" as const, name: "Level 4", progress: 0, status: "Scheduled", tasks: "Starts 20 Jan '26", color: "bg-slate-300" },
  { id: "roof" as const, name: "Roof Deck", progress: 0, status: "Scheduled", tasks: "Starts 24 Feb '26", color: "bg-slate-300" },
];

export function SummaryCards() {
  const {
    state,
    attentionFilter,
    setAttentionFilter,
    clearFilters,
    criticalPathActive,
    toggleCriticalPath,
    selectTask,
    openDrawer,
  } = useProgramme();

  const [analyticsExpanded, setAnalyticsExpanded] = useState<boolean>(false);
  const [hoveredMonth, setHoveredMonth] = useState<{
    month: string;
    planned: number;
    actual?: number;
    variance?: string;
  } | null>(null);

  const hasFilter = attentionFilter !== "all" || Boolean(state.filters.search?.trim());

  // Filter label resolver
  const getFilterDescription = () => {
    switch (attentionFilter) {
      case "overdue":
        return "5 Overdue Tasks (Action Required)";
      case "blocked":
        return "28 Blocked Tasks (3 on Critical Path)";
      case "due-this-week":
        return "12 Tasks Due This Week";
      case "critical":
        return "236 Critical Path Tasks";
      case "in-progress":
        return "14 Active In-Progress Tasks";
      case "complete":
        return "60 Completed Tasks";
      case "milestones":
        return "58 Programme Milestones";
      case "level-1":
        return "Level 1 Tasks (100% Complete)";
      case "level-2":
        return "Level 2 Tasks (60% Complete)";
      case "level-3":
        return "Level 3 Tasks (15% Upcoming)";
      case "level-4":
        return "Level 4 Tasks (Scheduled)";
      default:
        return null;
    }
  };

  return (
    <div className="space-y-2 mb-3 select-none">
      {/* ─── 1. Active Filter Notification Banner ─── */}
      {hasFilter && (
        <div className="flex items-center justify-between rounded-sm bg-blue-50/80 border border-blue-200 px-3 py-1.5 text-[12px] text-blue-900 shadow-xs">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-slate-700 shrink-0">Active Filter:</span>
            {attentionFilter !== "all" && (
              <span className="rounded-xs bg-white px-2 py-0.5 font-medium border border-blue-200 text-blue-700 truncate">
                {getFilterDescription()}
              </span>
            )}
            {state.filters.search?.trim() && (
              <span className="rounded-xs bg-white px-2 py-0.5 font-medium border border-blue-200 text-blue-700 truncate">
                Search: &ldquo;{state.filters.search}&rdquo;
              </span>
            )}
          </div>
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-xs px-2 py-0.5 text-[11.5px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors shrink-0 ml-2 cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            Clear Filter
          </button>
        </div>
      )}

      {/* ─── 2. Persistent Construction Programme Analytics Strip ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 rounded-sm border border-slate-200 bg-white p-2 px-3 shadow-xs">
        {/* Left: Status Distribution (Section 5: Restrained Horizontal Segmented Bar) */}
        <div className="flex-1 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11.5px] font-semibold text-slate-800">Status Distribution:</span>
            <span className="text-[10.5px] font-mono text-slate-400">817 Total</span>
          </div>

          {/* Segmented Horizontal Progress Bar (Clickable segments) */}
          <div className="flex-1 flex flex-col gap-1 min-w-[200px]">
            <div className="h-2 w-full flex rounded-xs overflow-hidden bg-slate-100 border border-slate-200/70">
              {/* Completed: 60 (7.3%) */}
              <div
                onClick={() => setAttentionFilter(attentionFilter === "complete" ? "all" : "complete")}
                style={{ width: "7.3%" }}
                className="h-full bg-emerald-500 hover:brightness-110 cursor-pointer transition-all"
                title="60 Completed Tasks (7.3%) — Click to filter"
              />
              {/* In Progress: 14 (1.7%) */}
              <div
                onClick={() => setAttentionFilter(attentionFilter === "in-progress" ? "all" : "in-progress")}
                style={{ width: "1.7%" }}
                className="h-full bg-blue-600 hover:brightness-110 cursor-pointer transition-all"
                title="14 Active Tasks (1.7%) — Click to filter"
              />
              {/* Blocked: 28 (3.4%) */}
              <div
                onClick={() => setAttentionFilter(attentionFilter === "blocked" ? "all" : "blocked")}
                style={{ width: "3.4%" }}
                className="h-full bg-red-500 hover:brightness-110 cursor-pointer transition-all"
                title="28 Blocked Tasks (3.4%) — Click to filter"
              />
              {/* Not Started: 715 (87.5%) */}
              <div
                style={{ width: "87.5%" }}
                className="h-full bg-slate-200/90"
                title="715 Not Started Tasks (87.5%)"
              />
            </div>

            {/* Micro Segment Legend Chips */}
            <div className="flex items-center gap-3 text-[10.5px]">
              <button
                onClick={() => setAttentionFilter(attentionFilter === "complete" ? "all" : "complete")}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${
                  attentionFilter === "complete" ? "font-bold text-emerald-700" : "text-slate-600"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-[1px] bg-emerald-500" />
                <span>60 Complete</span>
              </button>
              <button
                onClick={() => setAttentionFilter(attentionFilter === "in-progress" ? "all" : "in-progress")}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${
                  attentionFilter === "in-progress" ? "font-bold text-blue-700" : "text-slate-600"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-[1px] bg-blue-600" />
                <span>14 Active</span>
              </button>
              <button
                onClick={() => setAttentionFilter(attentionFilter === "blocked" ? "all" : "blocked")}
                className={`flex items-center gap-1 hover:underline cursor-pointer ${
                  attentionFilter === "blocked" ? "font-bold text-red-700" : "text-slate-600"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-[1px] bg-red-500" />
                <span>28 Blocked</span>
              </button>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500 font-mono text-[10px]">715 Remaining</span>
            </div>
          </div>
        </div>

        {/* Right: Quick Context Controls & Deep Analytics Drawer Toggle */}
        <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-2 md:pt-0 border-slate-100">
          <button
            onClick={toggleCriticalPath}
            className={`inline-flex items-center gap-1.5 rounded-xs px-2 py-1 text-[11px] font-medium border transition-colors cursor-pointer ${
              criticalPathActive
                ? "bg-red-50 text-red-700 border-red-300 font-semibold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
            title="Toggle Critical Path Schedule Highlight"
          >
            <Link2 className="h-3 w-3 -rotate-45 text-red-600" />
            <span>Critical Path (236)</span>
          </button>

          <button
            onClick={() => setAnalyticsExpanded(!analyticsExpanded)}
            className={`inline-flex items-center gap-1.5 rounded-xs px-2.5 py-1 text-[11.5px] font-medium border transition-colors cursor-pointer ${
              analyticsExpanded
                ? "bg-blue-50 text-blue-700 border-blue-300 font-semibold"
                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <BarChart2 className="h-3.5 w-3.5 text-blue-600" />
            <span>S-Curve &amp; Level Analytics</span>
            {analyticsExpanded ? (
              <ChevronUp className="h-3 w-3 text-slate-500" />
            ) : (
              <ChevronDown className="h-3 w-3 text-slate-500" />
            )}
          </button>
        </div>
      </div>

      {/* ─── 3. Expandable Construction Analytics Tray (S-Curve, Levels, Milestones) ─── */}
      {analyticsExpanded && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-2.5 rounded-sm border border-slate-200 bg-white p-3 shadow-xs animate-in fade-in-50 duration-150">
          {/* Panel A: S-Curve / Progress Over Time (5 cols) */}
          <div className="lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-bold text-slate-900">S-Curve: Progress Over Time</span>
                <span className="rounded-xs bg-amber-50 px-1.5 py-0.2 text-[9.5px] font-semibold text-amber-800 border border-amber-200/60 font-mono">
                  Slippage: -34 pts (-45d)
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">Today: Mar &apos;26</span>
            </div>

            {/* Clean Construction SVG Line Chart */}
            <div className="relative h-32 w-full bg-slate-50/50 rounded-xs border border-slate-200/80 p-2">
              <svg className="h-full w-full overflow-visible" viewBox="0 0 320 90" preserveAspectRatio="none">
                <defs>
                  {/* Subtle slippage area fill between planned and actual */}
                  <linearGradient id="slippageFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity="0.08" />
                  </linearGradient>
                </defs>

                {/* Horizontal Grid lines */}
                <line x1="0" y1="10" x2="320" y2="10" stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth="0.8" />
                <line x1="0" y1="35" x2="320" y2="35" stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth="0.8" />
                <line x1="0" y1="60" x2="320" y2="60" stroke="#e2e8f0" strokeDasharray="2 2" strokeWidth="0.8" />
                <line x1="0" y1="85" x2="320" y2="85" stroke="#cbd5e1" strokeWidth="1" />

                {/* Vertical "Today" Marker at x=135 (Mar 2026) */}
                <line x1="135" y1="5" x2="135" y2="85" stroke="#0066ff" strokeDasharray="2 2" strokeWidth="1" />
                <text x="137" y="14" fill="#0066ff" fontSize="7" fontWeight="bold" fontFamily="monospace">
                  Today
                </text>

                {/* Slippage Area between Planned (82% at y=23) and Actual (48% at y=50) at x=135 */}
                <polygon
                  points="90,62 135,23 135,50 90,62"
                  fill="url(#slippageFill)"
                />

                {/* 1. Planned Baseline Curve (0% at x=10 -> 100% at x=280 [Oct 2026]) */}
                {/* SVG path: (10,85) -> (55,75) -> (90,55) -> (135,23) -> (210,12) -> (280,10) */}
                <path
                  d="M 10 85 C 60 80, 90 55, 135 23 C 180 -5, 230 10, 280 10"
                  fill="none"
                  stroke="#475569"
                  strokeWidth="1.8"
                  strokeDasharray="3 2"
                />

                {/* 2. Actual Progress Curve (0% at x=10 -> 48% at x=135 [Mar 2026]) */}
                <path
                  d="M 10 85 C 50 82, 85 70, 135 50"
                  fill="none"
                  stroke="#0066ff"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                />

                {/* 3. Forecast Trend Curve from Today to 29 Nov (x=310, y=10) */}
                <path
                  d="M 135 50 C 190 35, 250 18, 310 10"
                  fill="none"
                  stroke="#0066ff"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                />

                {/* Points */}
                {/* Today Planned Point (82%) */}
                <circle cx="135" cy="23" r="2.5" fill="#475569" />
                {/* Today Actual Point (48%) */}
                <circle cx="135" cy="50" r="3" fill="#0066ff" stroke="#ffffff" strokeWidth="1.5" />
              </svg>

              {/* Month Axis Labels */}
              <div className="flex justify-between text-[8px] font-mono text-slate-400 mt-0.5 px-1">
                <span>Sep &apos;25</span>
                <span>Dec &apos;25</span>
                <span className="font-bold text-blue-700">Mar &apos;26</span>
                <span>Jun &apos;26</span>
                <span>Sep &apos;26</span>
                <span>Nov &apos;26</span>
              </div>
            </div>

            {/* S-Curve Legend */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-2 text-[10px] text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="w-3 border-b-2 border-dashed border-slate-600" />
                <span>Planned Baseline (15 Oct Target · 82%)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-blue-600" />
                <span className="font-semibold text-blue-700">Actual: 48%</span>
              </div>
              <div className="flex items-center gap-1.5 text-amber-700">
                <span className="w-3 border-b border-dashed border-blue-600" />
                <span>Forecast: 29 Nov (+45d)</span>
              </div>
            </div>
          </div>

          {/* Panel B: Level & Work Package Comparison Bars (4 cols - Section 7) */}
          <div className="lg:col-span-4 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-100 pb-3 lg:pb-0 lg:pr-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-slate-900">Level &amp; Work Package Progress</span>
              <span className="text-[10px] text-blue-600 font-medium">Click to filter</span>
            </div>

            {/* Horizontal comparison bars */}
            <div className="space-y-1.5 flex-1 justify-center flex flex-col">
              {LEVEL_PROGRESS_DATA.map((lvl) => {
                const isFiltered = attentionFilter === lvl.id;
                return (
                  <div
                    key={lvl.id}
                    onClick={() => setAttentionFilter(isFiltered ? "all" : lvl.id)}
                    className={`p-1.5 rounded-xs transition-colors cursor-pointer border ${
                      isFiltered
                        ? "bg-blue-50/80 border-blue-300"
                        : "hover:bg-slate-50 border-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${isFiltered ? "text-blue-800" : "text-slate-800"}`}>
                          {lvl.name}
                        </span>
                        <span className="text-[9.5px] text-slate-400">· {lvl.tasks}</span>
                      </div>
                      <span className="font-mono text-[10.5px] font-bold text-slate-700">
                        {lvl.progress}%
                      </span>
                    </div>

                    {/* Progress track */}
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${lvl.color}`}
                        style={{ width: `${lvl.progress}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Panel C: Construction Milestone Runway (3 cols - Section 8) */}
          <div className="lg:col-span-3 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-bold text-slate-900">Milestone Runway</span>
              <span className="text-[10px] font-mono text-amber-700 font-medium">Next: 16 Apr</span>
            </div>

            {/* Chronological Milestone Diamonds */}
            <div className="space-y-1.5 flex-1 flex flex-col justify-between">
              {PROGRAMME_MILESTONES.map((m) => {
                const isDone = m.status === "complete";
                const isDelayed = m.status === "delayed";
                const isTarget = m.status === "target";

                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      selectTask(m.taskId);
                      openDrawer(m.taskId);
                    }}
                    className="flex items-center justify-between p-1 px-1.5 rounded-xs hover:bg-slate-50 cursor-pointer transition-colors group"
                    title={`Click to inspect ${m.name} in task drawer`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Diamond Marker */}
                      <div
                        className={`h-2.5 w-2.5 rotate-45 shrink-0 ${
                          isDone
                            ? "bg-emerald-500"
                            : isDelayed
                            ? "bg-red-500 ring-2 ring-red-100"
                            : isTarget
                            ? "bg-blue-600 ring-2 ring-blue-100"
                            : "bg-amber-500"
                        }`}
                      />
                      <span className="text-[11px] font-medium text-slate-700 truncate group-hover:text-blue-700">
                        {m.name}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono font-medium text-slate-500 shrink-0 ml-1">
                      {m.date}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
