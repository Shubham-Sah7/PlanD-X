"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  Upload,
  Download,
  MoreHorizontal,
  Check,
  ChevronRight,
  Building2,
  MapPin,
  Calendar as CalendarIcon,
  LayoutGrid,
  AlertTriangle,
  Plus,
  GitBranch,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import { BimDigitalTwinHero } from "./bim/bim-digital-twin-hero";

const FORECAST_OPTIONS = [
  { id: "wf", label: "Working Forecast", state: "Live", isCurrent: true },
  { id: "b0", label: "Baseline 0 (Contract)", state: "Locked", isCurrent: false },
  { id: "ab1", label: "Approved Baseline 1.1", state: "Approved", isCurrent: false },
];

export function ProgrammeHeader() {
  const {
    state,
    attentionFilter,
    setAttentionFilter,
    criticalPathActive,
    toggleCriticalPath,
    selectTask,
    openDrawer,
    openAddTask,
    openImport,
    openExport,
    openRevisions,
  } = useProgramme();
  const [selectedForecast, setSelectedForecast] = useState("Working Forecast");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const isNetwork = state.activeView === "network";
  const isGantt = state.activeView === "gantt";

  // 1. Gantt / Homepage View: Split Layout with 3D BIM Digital Twin Hero (Image 4)
  if (isGantt) {
    return (
      <div className="flex flex-col xl:flex-row gap-5 items-start xl:items-center justify-between pb-3 pt-0.5 select-none w-full">
        {/* Left Side: Title, Subtitle, Location Badges & 5 KPI Cards */}
        <div className="flex-1 min-w-0 pr-0 xl:pr-3">
          {/* Header Title & Subtitle + Action Buttons */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[23px] font-bold tracking-tight text-slate-900 leading-tight">
                Programme Management
              </h1>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Plan, track and deliver your construction programme.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={openAddTask}
                className="inline-flex items-center gap-1.5 rounded-sm bg-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Task</span>
              </button>
              <button
                onClick={openImport}
                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Upload className="h-3.5 w-3.5 text-slate-500" />
                <span>Import</span>
              </button>
              <button
                onClick={openExport}
                className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Location & Programme Metadata (Clean Typography Hierarchy) */}
          <div className="flex flex-wrap items-center gap-2 mt-2 text-[12px] text-slate-500 font-normal">
            <span className="inline-flex items-center gap-1.5 text-slate-800 font-medium">
              <Building2 className="h-3.5 w-3.5 text-slate-400" />
              <span>Building 2 &amp; Unit 80</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600">
              <MapPin className="h-3.5 w-3.5 text-slate-400" />
              <span>Siliguri, WB</span>
            </span>
            <span className="text-slate-300">·</span>
            <span className="inline-flex items-center gap-1 text-slate-600 font-mono text-[11.5px]">
              <CalendarIcon className="h-3.5 w-3.5 text-slate-400" />
              <span>01 Sep 2025 – 15 Nov 2026</span>
            </span>
          </div>

          {/* Next Milestone Dedicated Attention Banner */}
          <div
            onClick={() => {
              selectTask("task-columns");
              openDrawer("task-columns");
            }}
            className="flex items-center justify-between rounded-sm border border-amber-200 bg-amber-50/70 px-3 py-1.5 hover:border-amber-400 hover:bg-amber-50 transition-colors text-left cursor-pointer mt-2.5"
            title="Next milestone attention item · Click to inspect in task drawer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 rotate-45 bg-amber-500 shrink-0" />
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider shrink-0">
                Next Milestone:
              </span>
              <span className="text-[12.5px] font-bold text-slate-900 truncate">
                Superstructure L3 Handover
              </span>
              <span className="rounded-xs bg-amber-100 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-800 border border-amber-300/80 shrink-0">
                Critical Path
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
              <span className="text-slate-600 hidden sm:inline">Target: 16 Apr 2026</span>
              <span className="rounded-xs bg-blue-600 px-1.5 py-0.2 text-[10.5px] font-bold text-white">
                28d left
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-amber-600" />
            </div>
          </div>

          {/* 4 Core Construction KPI Metric Cards */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 mt-2">
            {/* KPI 1: Total Tasks */}
            <div
              onClick={() => setAttentionFilter("all")}
              className={`flex flex-col justify-between rounded-sm border p-2.5 px-3 transition-colors text-left cursor-pointer ${
                attentionFilter === "all"
                  ? "border-slate-300 bg-white hover:border-slate-400"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              title="Click to reset filter and view all tasks"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">Total Tasks</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">817 scope</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-bold text-slate-900 leading-none font-mono">817</span>
                <span className="text-[10.5px] font-mono text-emerald-600 font-medium">60 done</span>
              </div>
              <span className="text-[9.5px] text-slate-500 mt-1.5 truncate">715 remaining tasks</span>
            </div>

            {/* KPI 2: Overall Progress */}
            <div
              onClick={() => setAttentionFilter(attentionFilter === "in-progress" ? "all" : "in-progress")}
              className={`flex flex-col justify-between rounded-sm border p-2.5 px-3 transition-colors text-left cursor-pointer ${
                attentionFilter === "in-progress"
                  ? "border-blue-400 bg-blue-50/60 ring-1 ring-blue-300"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
              title="Click to filter active in-progress tasks"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-700">Overall Progress</span>
                <span className="text-[10px] font-mono font-medium text-slate-400">82% target</span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-bold text-slate-900 leading-none font-mono">48%</span>
                <span className="text-[10px] font-mono text-red-600 font-medium">-34 pts</span>
              </div>
              <div className="relative mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full bg-blue-600 transition-all duration-300" style={{ width: "48%" }} />
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                  style={{ left: "82%" }}
                  title="Planned Target: 82%"
                />
              </div>
              <span className="text-[9.5px] text-slate-500 mt-1.5 truncate">Behind scheduled pace</span>
            </div>

            {/* KPI 3: Blocked Tasks */}
            <button
              onClick={() => setAttentionFilter(attentionFilter === "blocked" ? "all" : "blocked")}
              className={`flex flex-col justify-between rounded-sm border p-2.5 px-3 transition-colors text-left cursor-pointer ${
                attentionFilter === "blocked"
                  ? "border-red-500 bg-red-50/80 ring-1 ring-red-300"
                  : "border-slate-200 bg-white hover:border-red-300"
              }`}
              title="Click to filter blocked tasks"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-semibold text-red-700">Blocked</span>
                <span className="text-[9.5px] font-mono font-bold text-red-600 bg-red-100 px-1 py-0.2 rounded-xs">
                  Action Req.
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-bold text-red-600 leading-none font-mono">28</span>
                <span className="text-[10.5px] text-red-600 font-mono">tasks</span>
              </div>
              <span className="text-[9.5px] text-red-600 font-medium mt-1.5 truncate">3 on critical path</span>
            </button>

            {/* KPI 4: Critical Tasks */}
            <button
              onClick={toggleCriticalPath}
              className={`flex flex-col justify-between rounded-sm border p-2.5 px-3 transition-colors text-left cursor-pointer ${
                criticalPathActive
                  ? "border-red-400 bg-red-50/60 ring-1 ring-red-300"
                  : "border-slate-200 bg-white hover:border-red-300"
              }`}
              title="Click to toggle Critical Path highlight"
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-semibold text-slate-700">Critical Tasks</span>
                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
              </div>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="text-[18px] font-bold text-slate-900 leading-none font-mono">236</span>
                <span className="text-[10.5px] font-mono text-red-600 font-medium">tasks</span>
              </div>
              <span className="text-[9.5px] text-slate-500 mt-1.5 truncate">Driving completion date</span>
            </button>
          </div>
        </div>

        {/* Right Side: 3D BIM Digital Twin Hero (Matching Image 4) */}
        <div className="w-full xl:w-[480px] 2xl:w-[540px] shrink-0">
          <BimDigitalTwinHero />
        </div>
      </div>
    );
  }

  // 2. Standard Header for Network, List, Calendar views
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-1 pb-4 select-none">
      {/* Title & Subtitle */}
      <div>
        {isNetwork && (
          <div className="flex items-center gap-1 text-[12px] font-medium text-slate-400 mb-1">
            <span>Programme</span>
            <ChevronRight className="h-3 w-3 text-slate-400" />
            <span className="text-slate-700 font-semibold">Network</span>
          </div>
        )}
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">
          {isNetwork ? "Network View" : "Programme Management"}
        </h1>
        <p className="text-[13px] text-slate-500 mt-0.5">
          {isNetwork
            ? "Visualise task relationships, dependencies and the critical path."
            : "Plan, track and deliver your construction programme."}
        </p>
      </div>

      {/* Right Actions */}
      <div className="flex items-center gap-2 relative">
        {/* Working Forecast Selector */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="inline-flex items-center gap-2 rounded-sm border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <span className="h-2 w-2 rounded-xs bg-emerald-500" />
            <span>{selectedForecast}</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-60 rounded-sm border border-slate-200 bg-white p-1 shadow-md z-50">
              <div className="px-2 py-1 text-[10.5px] font-bold text-slate-400 uppercase tracking-wider">
                Programme Baselines
              </div>
              {FORECAST_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSelectedForecast(opt.label);
                    setDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-xs px-2.5 py-1.5 text-[12.5px] text-slate-700 hover:bg-slate-50 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-xs ${
                        opt.isCurrent ? "bg-emerald-500" : "bg-slate-300"
                      }`}
                    />
                    <span>{opt.label}</span>
                  </div>
                  {opt.label === selectedForecast && (
                    <Check className="h-3.5 w-3.5 text-blue-600" />
                  )}
                </button>
              ))}

              <div className="border-t border-slate-100 mt-1 pt-1">
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    openRevisions();
                  }}
                  className="flex w-full items-center gap-2 rounded-xs px-2.5 py-1.5 text-[12px] text-blue-600 hover:bg-blue-50 text-left font-medium"
                >
                  <GitBranch className="h-3.5 w-3.5 text-blue-600" />
                  <span>Manage Revisions...</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add Task Button */}
        <button
          onClick={openAddTask}
          className="inline-flex items-center gap-1.5 rounded-sm bg-blue-600 px-3 py-1.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Task</span>
        </button>

        {/* Import Button */}
        <button
          onClick={openImport}
          className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Upload className="h-3.5 w-3.5 text-slate-500" />
          <span>Import</span>
        </button>

        {/* Export Button */}
        <button
          onClick={openExport}
          className="inline-flex items-center gap-1.5 rounded-sm border border-slate-200 bg-white px-2.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <Download className="h-3.5 w-3.5 text-slate-500" />
          <span>Export</span>
        </button>

        {/* Revisions Button */}
        <button
          onClick={openRevisions}
          title="Programme Revisions & History"
          className="flex h-7.5 w-7.5 items-center justify-center rounded-sm border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
