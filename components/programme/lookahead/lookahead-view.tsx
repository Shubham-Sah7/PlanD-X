"use client";

import React, { useState, useMemo } from "react";
import { useProgramme } from "@/lib/programme-context";
import type {
  ProgrammeTask,
  LookaheadPeriod,
  LookaheadReadiness,
  LookaheadTaskItem,
  TaskStatus,
  Trade,
} from "@/lib/programme-types";
import {
  getLookaheadDateRange,
  getLookaheadTasks,
  getLookaheadSummaryStats,
  parseIsoDate,
  formatDateIso,
  formatDisplayDate,
  calculateDateVarianceWorkingDays,
  countWorkingDays,
  isWorkingDay,
} from "@/lib/programme-calendar";
import { ResourceAssignmentDropdown } from "@/components/programme/resources/resource-assignment-dropdown";
import { EmptyProjectState } from "../empty-project-state";
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  AlertCircle,
  Flame,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  Users,
  Search,
  SlidersHorizontal,
  ChevronDown,
  UserX,
  ExternalLink,
  Milestone as MilestoneIcon,
  RotateCcw,
  Tag,
  Link2,
} from "lucide-react";

export function LookaheadView() {
  const {
    state,
    selectTask,
    openDrawer,
    updateTaskProgress,
    projectCalendar,
    lookaheadPeriod,
    setLookaheadPeriod,
  } = useProgramme();

  // Anchor Date: defaults to project status date (2025-10-15)
  const [anchorDate, setAnchorDate] = useState<string>("2025-10-15");
  const [readinessFilter, setReadinessFilter] = useState<LookaheadReadiness | "all" | "critical">("all");
  const [tradeFilter, setTradeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"week" | "readiness" | "trade" | "none">("week");
  const [showTimelinePreview, setShowTimelinePreview] = useState<boolean>(true);

  if (state.tasks.length === 0) {
    return <EmptyProjectState />;
  }

  // 1. Compute Lookahead Date Window using Project Calendar
  const dateRange = useMemo(() => {
    return getLookaheadDateRange(anchorDate, lookaheadPeriod, projectCalendar);
  }, [anchorDate, lookaheadPeriod, projectCalendar]);

  // 2. Extract and analyze tasks within the Lookahead Window
  const allLookaheadItems = useMemo(() => {
    return getLookaheadTasks(state.tasks, dateRange, projectCalendar, anchorDate);
  }, [state.tasks, dateRange, projectCalendar, anchorDate]);

  // 3. Compute KPI Summary Stats
  const summaryStats = useMemo(() => {
    return getLookaheadSummaryStats(allLookaheadItems);
  }, [allLookaheadItems]);

  // 4. Apply User Filters (Readiness, Trade, Search)
  const filteredItems = useMemo(() => {
    return allLookaheadItems.filter((item) => {
      // Readiness / Critical filter
      if (readinessFilter === "critical") {
        if (!item.task.isCritical) return false;
      } else if (readinessFilter !== "all" && item.readiness !== readinessFilter) {
        return false;
      }

      // Trade filter
      if (tradeFilter !== "all" && item.task.trade !== tradeFilter) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = item.task.name.toLowerCase().includes(q);
        const matchWbs = item.task.wbs.toLowerCase().includes(q);
        const matchAssignee = Boolean(item.task.assignee?.toLowerCase().includes(q));
        const matchSubcon = Boolean(item.task.subcontractor?.toLowerCase().includes(q));
        if (!matchName && !matchWbs && !matchAssignee && !matchSubcon) return false;
      }

      return true;
    });
  }, [allLookaheadItems, readinessFilter, tradeFilter, searchQuery]);

  // 5. Navigation: Shift anchor date by 1 week or period
  const handleShiftAnchor = (weeks: number) => {
    const cur = parseIsoDate(anchorDate);
    cur.setDate(cur.getDate() + weeks * 7);
    setAnchorDate(formatDateIso(cur));
  };

  const handleResetAnchor = () => {
    setAnchorDate("2025-10-15");
  };

  // Distinct trade list for filter
  const availableTrades = useMemo(() => {
    const set = new Set<string>();
    for (const item of allLookaheadItems) {
      if (item.task.trade) set.add(String(item.task.trade));
    }
    return Array.from(set).sort();
  }, [allLookaheadItems]);

  // Group items by selected grouping mode
  const groupedItems = useMemo(() => {
    if (groupBy === "none") {
      return [{ groupKey: "all", label: "All Lookahead Activities", items: filteredItems }];
    }

    if (groupBy === "week") {
      // Divide the lookahead date window into 7-day week chunks
      const start = parseIsoDate(dateRange.startDate);
      const weeksCount = lookaheadPeriod === "1-week" ? 1 : lookaheadPeriod === "2-weeks" ? 2 : lookaheadPeriod === "4-weeks" ? 4 : 6;
      const groups: { groupKey: string; label: string; dateSub: string; items: LookaheadTaskItem[] }[] = [];

      for (let w = 0; w < weeksCount; w++) {
        const wStart = new Date(start.getTime());
        wStart.setDate(wStart.getDate() + w * 7);
        const wEnd = new Date(wStart.getTime());
        wEnd.setDate(wEnd.getDate() + 6);

        const wStartIso = formatDateIso(wStart);
        const wEndIso = formatDateIso(wEnd);

        const weekItems = filteredItems.filter((i) => {
          return i.task.startDate <= wEndIso && i.task.endDate >= wStartIso;
        });

        groups.push({
          groupKey: `week-${w + 1}`,
          label: `Week ${w + 1}`,
          dateSub: `${formatDisplayDate(wStartIso)} – ${formatDisplayDate(wEndIso)}`,
          items: weekItems,
        });
      }

      return groups;
    }

    if (groupBy === "readiness") {
      const order: { key: LookaheadReadiness; label: string }[] = [
        { key: "overdue", label: "Overdue Activities" },
        { key: "blocked", label: "Blocked Activities" },
        { key: "dependency-risk", label: "Dependency Risk (Incomplete Predecessors)" },
        { key: "unassigned", label: "Unassigned Resources" },
        { key: "ready", label: "Ready to Execute" },
      ];

      return order
        .map((o) => ({
          groupKey: o.key,
          label: o.label,
          items: filteredItems.filter((i) => i.readiness === o.key),
        }))
        .filter((g) => g.items.length > 0);
    }

    if (groupBy === "trade") {
      const trades = availableTrades.length > 0 ? availableTrades : ["General"];
      return trades
        .map((tr) => ({
          groupKey: tr,
          label: `${tr} Trade`,
          items: filteredItems.filter((i) => (i.task.trade ? String(i.task.trade) === tr : tr === "General")),
        }))
        .filter((g) => g.items.length > 0);
    }

    return [{ groupKey: "all", label: "All Lookahead Activities", items: filteredItems }];
  }, [filteredItems, groupBy, dateRange, lookaheadPeriod, availableTrades]);

  // Timeline day columns for mini-gantt preview
  const timelineDays = useMemo(() => {
    const list: { iso: string; dayOfMonth: number; dayName: string; isWeekend: boolean; isToday: boolean }[] = [];
    const start = parseIsoDate(dateRange.startDate);
    const end = parseIsoDate(dateRange.endDate);

    const curr = new Date(start.getTime());
    while (curr.getTime() <= end.getTime()) {
      const iso = formatDateIso(curr);
      const isWk = !isWorkingDay(curr, projectCalendar);
      const isToday = iso === anchorDate;
      const days = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

      list.push({
        iso,
        dayOfMonth: curr.getDate(),
        dayName: days[curr.getDay()],
        isWeekend: isWk,
        isToday,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return list;
  }, [dateRange, projectCalendar, anchorDate]);

  return (
    <div className="flex flex-col h-full bg-white rounded-lg border border-slate-200 shadow-2xs overflow-hidden select-none">
      {/* ─── 1. Lookahead Header & Period Controls ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border-b border-slate-200 bg-slate-50/70">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[15px] font-bold text-slate-900 tracking-tight">Lookahead Planning</h2>
              <span className="rounded-xs bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700 border border-blue-200/80 font-mono">
                {dateRange.period.toUpperCase()}
              </span>
            </div>
            <div className="text-[11.5px] text-slate-500 font-medium flex items-center gap-1.5 mt-0.5">
              <span>Window:</span>
              <span className="font-mono font-semibold text-slate-700">{dateRange.displayRange}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-600">{dateRange.workingDays} working days</span>
              <span className="text-slate-400">({projectCalendar.name.split(" ")[0]})</span>
            </div>
          </div>
        </div>

        {/* Lookahead Period Switcher & Window Navigation */}
        <div className="flex items-center gap-2">
          {/* 1W / 2W / 4W / 6W Switcher */}
          <div className="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
            {(["1-week", "2-weeks", "4-weeks", "6-weeks"] as LookaheadPeriod[]).map((p) => {
              const isActive = lookaheadPeriod === p;
              const labels: Record<LookaheadPeriod, string> = {
                "1-week": "1 Week",
                "2-weeks": "2 Weeks",
                "4-weeks": "4 Weeks",
                "6-weeks": "6 Weeks",
              };
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setLookaheadPeriod(p)}
                  className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-2xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {labels[p]}
                </button>
              );
            })}
          </div>

          {/* Window Navigation (<, >, Reset) */}
          <div className="flex items-center border border-slate-200 rounded-md bg-white shadow-2xs overflow-hidden h-8">
            <button
              type="button"
              onClick={() => handleShiftAnchor(lookaheadPeriod === "4-weeks" ? -4 : -2)}
              className="px-2 h-full hover:bg-slate-50 text-slate-600 hover:text-slate-900 border-r border-slate-200 transition-colors"
              title="Shift window earlier"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleResetAnchor}
              className="px-2.5 h-full text-[11px] font-medium text-slate-700 hover:bg-slate-50 border-r border-slate-200 flex items-center gap-1 transition-colors"
              title="Reset anchor date to today (15 Oct 2025)"
            >
              <RotateCcw className="h-3 w-3 text-slate-400" />
              <span>Today</span>
            </button>
            <button
              type="button"
              onClick={() => handleShiftAnchor(lookaheadPeriod === "4-weeks" ? 4 : 2)}
              className="px-2 h-full hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
              title="Shift window forward"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* ─── 2. Readiness KPI Filter Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 p-3 border-b border-slate-200 bg-white">
        {/* All Activities */}
        <button
          type="button"
          onClick={() => setReadinessFilter("all")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "all"
              ? "border-blue-500 bg-blue-50/60 ring-1 ring-blue-500"
              : "border-slate-200/80 hover:border-slate-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-slate-500">
            <span>In Window</span>
            <Layers className="h-3 w-3 text-slate-400" />
          </div>
          <div className="text-[17px] font-bold font-mono text-slate-900 mt-0.5">
            {summaryStats.totalCount}
          </div>
          <div className="text-[10px] text-slate-400 font-sans truncate">Active scheduled</div>
        </button>

        {/* Ready to Work */}
        <button
          type="button"
          onClick={() => setReadinessFilter(readinessFilter === "ready" ? "all" : "ready")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "ready"
              ? "border-emerald-500 bg-emerald-50/70 ring-1 ring-emerald-500"
              : "border-slate-200/80 hover:border-emerald-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-emerald-700">
            <span>Ready</span>
            <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          </div>
          <div className="text-[17px] font-bold font-mono text-emerald-700 mt-0.5">
            {summaryStats.readyCount}
          </div>
          <div className="text-[10px] text-emerald-600/90 font-sans truncate">Prerequisites clear</div>
        </button>

        {/* Dependency Risk */}
        <button
          type="button"
          onClick={() => setReadinessFilter(readinessFilter === "dependency-risk" ? "all" : "dependency-risk")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "dependency-risk"
              ? "border-amber-500 bg-amber-50/70 ring-1 ring-amber-500"
              : "border-slate-200/80 hover:border-amber-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-amber-800">
            <span>Dep Risk</span>
            <AlertTriangle className="h-3 w-3 text-amber-600" />
          </div>
          <div className="text-[17px] font-bold font-mono text-amber-800 mt-0.5">
            {summaryStats.dependencyRiskCount}
          </div>
          <div className="text-[10px] text-amber-700/80 font-sans truncate">Predecessor pending</div>
        </button>

        {/* Blocked */}
        <button
          type="button"
          onClick={() => setReadinessFilter(readinessFilter === "blocked" ? "all" : "blocked")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "blocked"
              ? "border-red-500 bg-red-50/70 ring-1 ring-red-500"
              : "border-slate-200/80 hover:border-red-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-red-700">
            <span>Blocked</span>
            <XCircle className="h-3 w-3 text-red-600" />
          </div>
          <div className="text-[17px] font-bold font-mono text-red-700 mt-0.5">
            {summaryStats.blockedCount}
          </div>
          <div className="text-[10px] text-red-600/90 font-sans truncate">Recorded constraint</div>
        </button>

        {/* Overdue */}
        <button
          type="button"
          onClick={() => setReadinessFilter(readinessFilter === "overdue" ? "all" : "overdue")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "overdue"
              ? "border-rose-500 bg-rose-50/70 ring-1 ring-rose-500"
              : "border-slate-200/80 hover:border-rose-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-rose-700">
            <span>Overdue</span>
            <Clock className="h-3 w-3 text-rose-600" />
          </div>
          <div className="text-[17px] font-bold font-mono text-rose-700 mt-0.5">
            {summaryStats.overdueCount}
          </div>
          <div className="text-[10px] text-rose-600/90 font-sans truncate">Past finish date</div>
        </button>

        {/* Critical Path in Window */}
        <button
          type="button"
          onClick={() => setReadinessFilter(readinessFilter === "critical" ? "all" : "critical")}
          className={`flex flex-col p-2 rounded-md border text-left transition-all ${
            readinessFilter === "critical"
              ? "border-red-500 bg-red-50/70 ring-1 ring-red-500 font-semibold"
              : "border-slate-200/80 hover:border-red-300 bg-slate-50/40"
          }`}
        >
          <div className="flex items-center justify-between text-[10.5px] font-medium text-red-700">
            <span>Critical Path</span>
            <Flame className="h-3 w-3 text-red-600" />
          </div>
          <div className="text-[17px] font-bold font-mono text-red-700 mt-0.5">
            {summaryStats.criticalCount}
          </div>
          <div className="text-[10px] text-red-600/90 font-sans truncate">0d float in window</div>
        </button>
      </div>

      {/* ─── 3. Filter & Grouping Toolbar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 border-b border-slate-200 bg-slate-50/40 text-[12px]">
        {/* Left: Search & Trade filter */}
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search lookahead activities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1 text-[11.5px] rounded-md border border-slate-200 bg-white focus:outline-hidden focus:border-blue-500 placeholder:text-slate-400 shadow-2xs"
            />
          </div>

          {availableTrades.length > 0 && (
            <select
              value={tradeFilter}
              onChange={(e) => setTradeFilter(e.target.value)}
              className="text-[11.5px] border border-slate-200 bg-white rounded-md px-2 py-1 text-slate-700 focus:outline-hidden focus:border-blue-500 shadow-2xs"
            >
              <option value="all">All Trades ({allLookaheadItems.length})</option>
              {availableTrades.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          {readinessFilter !== "all" && (
            <button
              type="button"
              onClick={() => setReadinessFilter("all")}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200"
            >
              <span>Filter: {readinessFilter}</span>
              <span className="text-blue-400 hover:text-blue-700">×</span>
            </button>
          )}
        </div>

        {/* Right: Grouping toggle & Timeline preview toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1 text-[11.5px] text-slate-500">
            <SlidersHorizontal className="h-3 w-3 text-slate-400" />
            <span>Group by:</span>
            <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
              {(["week", "readiness", "trade", "none"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setGroupBy(mode)}
                  className={`px-2 py-0.5 text-[10.5px] font-medium rounded capitalize ${
                    groupBy === mode
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTimelinePreview(!showTimelinePreview)}
            className={`text-[11px] font-medium px-2 py-1 rounded border transition-colors ${
              showTimelinePreview
                ? "bg-blue-50 text-blue-700 border-blue-200 font-semibold"
                : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
            }`}
          >
            {showTimelinePreview ? "Hide Timeline" : "Show Timeline"}
          </button>
        </div>
      </div>

      {/* ─── 4. Main Activity Area (Table & Optional Timeline) ─── */}
      <div className="flex-1 overflow-y-auto">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
              <Calendar className="h-6 w-6" />
            </div>
            <h3 className="text-[14px] font-bold text-slate-800">No activities match your lookahead criteria</h3>
            <p className="text-[12px] text-slate-500 max-w-sm mt-1">
              There are no tasks scheduled in the selected window ({dateRange.displayRange}) matching your filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setReadinessFilter("all");
                setTradeFilter("all");
                setSearchQuery("");
                setLookaheadPeriod("4-weeks");
              }}
              className="mt-4 px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12px] font-medium hover:bg-blue-700 transition-colors shadow-xs"
            >
              Expand to 4-Week Lookahead
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {groupedItems.map((group) => (
              <div key={group.groupKey} className="bg-white">
                {/* Group Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between px-3.5 py-1.5 bg-slate-100/90 backdrop-blur-xs border-y border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-bold text-slate-900">{group.label}</span>
                    {"dateSub" in group && (
                      <span className="text-[10.5px] font-mono text-slate-500 font-medium">
                        ({(group as any).dateSub})
                      </span>
                    )}
                  </div>
                  <span className="text-[10.5px] font-mono font-semibold text-slate-500 bg-white px-2 py-0.2 rounded border border-slate-200">
                    {group.items.length} {group.items.length === 1 ? "task" : "tasks"}
                  </span>
                </div>

                {/* Task Rows */}
                <div className="divide-y divide-slate-100">
                  {group.items.map((item) => {
                    const task = item.task;
                    const isSelected = state.selectedTaskId === task.id;

                    return (
                      <div
                        key={`${group.groupKey}-${task.id}`}
                        onClick={() => selectTask(task.id)}
                        className={`flex items-center justify-between p-2.5 hover:bg-slate-50/80 transition-colors cursor-pointer ${
                          isSelected ? "bg-blue-50/50 ring-1 ring-blue-500/30" : ""
                        }`}
                      >
                        {/* Column A: WBS, Name, Critical Badge, Timing in Window */}
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-3">
                          <span className="font-mono text-[11px] font-semibold text-slate-400 shrink-0 w-12 truncate">
                            {task.wbs}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[13px] font-semibold text-slate-900 truncate">
                                {task.name}
                              </span>

                              {task.isMilestone && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 font-mono">
                                  <MilestoneIcon className="h-2.5 w-2.5" />
                                  Milestone
                                </span>
                              )}

                              {task.isCritical && (
                                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                  <Flame className="h-2.5 w-2.5 text-rose-600" />
                                  CP
                                </span>
                              )}

                              {/* Timing Badge */}
                              <span
                                className={`text-[10px] font-medium px-1.5 py-0.2 rounded font-mono ${
                                  item.timingInWindow === "starts-in-window"
                                    ? "bg-blue-50 text-blue-700 border border-blue-200/70"
                                    : item.timingInWindow === "finishes-in-window"
                                    ? "bg-purple-50 text-purple-700 border border-purple-200/70"
                                    : item.timingInWindow === "within-window"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                                    : "bg-slate-100 text-slate-600 border border-slate-200/70"
                                }`}
                              >
                                {item.timingInWindow === "starts-in-window"
                                  ? `Starts in ${item.daysUntilStart >= 0 ? `+${item.daysUntilStart}d` : `${item.daysUntilStart}d`}`
                                  : item.timingInWindow === "finishes-in-window"
                                  ? `Finishes in ${item.daysUntilFinish >= 0 ? `+${item.daysUntilFinish}d` : `${item.daysUntilFinish}d`}`
                                  : item.timingInWindow === "within-window"
                                  ? "Starts & Ends in window"
                                  : "Spans entire window"}
                              </span>
                            </div>

                            {/* Readiness Explanation Subtext */}
                            <div className="text-[11px] text-slate-500 mt-0.5 truncate flex items-center gap-1.5">
                              <span
                                className={`font-semibold ${
                                  item.readiness === "ready"
                                    ? "text-emerald-700"
                                    : item.readiness === "blocked"
                                    ? "text-red-700"
                                    : item.readiness === "overdue"
                                    ? "text-rose-700"
                                    : item.readiness === "dependency-risk"
                                    ? "text-amber-700"
                                    : "text-slate-600"
                                }`}
                              >
                                {item.readinessReason}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Column B: Readiness Status Badge */}
                        <div className="shrink-0 w-32 px-2 text-center">
                          {item.readiness === "ready" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              Ready
                            </span>
                          )}
                          {item.readiness === "dependency-risk" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                              <AlertTriangle className="h-3 w-3 text-amber-600" />
                              Dep Risk
                            </span>
                          )}
                          {item.readiness === "blocked" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-red-50 text-red-700 border border-red-200">
                              <XCircle className="h-3 w-3 text-red-600" />
                              Blocked
                            </span>
                          )}
                          {item.readiness === "overdue" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                              <Clock className="h-3 w-3 text-rose-600" />
                              Overdue
                            </span>
                          )}
                          {item.readiness === "unassigned" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                              <UserX className="h-3 w-3 text-slate-500" />
                              Unassigned
                            </span>
                          )}
                        </div>

                        {/* Column C: Dates & Duration */}
                        <div className="shrink-0 w-44 font-mono text-[11px] text-right text-slate-600 pr-3">
                          <div className="font-medium text-slate-900">
                            {task.displayStart || task.startDate} → {task.displayEnd || task.endDate}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {task.duration}d duration · {task.float !== undefined ? `${task.float}d float` : "0d"}
                          </div>
                        </div>

                        {/* Column D: Subcontractor / Assignee Pill */}
                        <div className="shrink-0 w-36 px-2 truncate">
                          {task.subcontractor || task.assignee ? (
                            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] font-medium text-slate-800 truncate max-w-full">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 shrink-0" />
                              <span className="truncate">{task.subcontractor || task.assignee}</span>
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium italic flex items-center gap-1">
                              <UserX className="h-3 w-3" />
                              No trade set
                            </span>
                          )}
                        </div>

                        {/* Column E: Progress Bar */}
                        <div className="shrink-0 w-24 pl-2 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-800">
                              {task.progress}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden mt-1">
                            <div
                              className={`h-full rounded-full transition-all ${
                                task.progress >= 100
                                  ? "bg-emerald-500"
                                  : item.readiness === "blocked"
                                  ? "bg-red-500"
                                  : "bg-blue-600"
                              }`}
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── 5. Bottom Lookahead Timeline Strip (Mini-Gantt Visualizer) ─── */}
      {showTimelinePreview && filteredItems.length > 0 && (
        <div className="border-t border-slate-200 bg-slate-50/70 p-3 select-none">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              Lookahead Timeline Visualizer ({timelineDays.length} Calendar Days)
            </span>
            <div className="flex items-center gap-3 text-[10.5px]">
              <span className="flex items-center gap-1 text-slate-500">
                <span className="h-2 w-2 rounded-xs bg-slate-200" />
                Weekend / Non-working
              </span>
              <span className="flex items-center gap-1 text-blue-700 font-semibold">
                <span className="h-2 w-2 rounded-xs bg-blue-600" />
                Today ({anchorDate})
              </span>
            </div>
          </div>

          {/* Day Columns Header */}
          <div className="grid grid-flow-col auto-cols-fr gap-1 border border-slate-200 rounded bg-white p-1.5 overflow-x-auto text-center font-mono">
            {timelineDays.map((d) => (
              <div
                key={d.iso}
                className={`flex flex-col items-center py-1 rounded text-[10px] min-w-[28px] ${
                  d.isToday
                    ? "bg-blue-600 text-white font-bold"
                    : d.isWeekend
                    ? "bg-slate-100 text-slate-400"
                    : "text-slate-700"
                }`}
                title={`${d.iso} (${d.dayName})`}
              >
                <span className="text-[9px] uppercase">{d.dayName}</span>
                <span className="text-[11px] font-bold mt-0.5">{d.dayOfMonth}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
