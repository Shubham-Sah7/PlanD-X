"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  GanttChartSquare,
  List,
  Network,
  Calendar,
  Box,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  Maximize2,
  Check,
  RotateCcw,
  Plus,
  GitCompare,
  Clock,
  FileText,
  Undo2,
  Redo2,
  Indent,
  Outdent,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ShieldAlert,
  Users,
  Copy,
  Hash,
  AlertCircle,
  History,
  Lock,
  Briefcase,
  Library,
  Send,
  GitBranch,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { ViewMode, ZoomLevel } from "@/lib/programme-types";

const VIEWS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "gantt", label: "Gantt", icon: GanttChartSquare },
  { id: "lookahead", label: "Lookahead", icon: Clock },
  { id: "network", label: "Network", icon: Network },
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
];

const ZOOM_LEVELS: { id: ZoomLevel; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
  { id: "year", label: "Year" },
];

export function ProgrammeToolbar() {
  const {
    state,
    setActiveView,
    setZoomLevel,
    setSearch,
    criticalPathActive,
    toggleCriticalPath,
    networkZoom,
    setNetworkZoom,
    autoLayoutMode,
    setAutoLayoutMode,
    setAttentionFilter,
    showBaselineComparison,
    toggleBaselineComparison,
    setShowBaselineComparison,
    selectedBaselineVersion,
    setSelectedBaselineVersion,
    undo,
    redo,
    canUndo,
    canRedo,
    indentTask,
    outdentTask,
    saveStatus,
    programmeVersion,
    saveError,
    retrySave,
    conflictDetails,
    openRollbackModal,
    schedulingWarnings,
    selectedTaskIds,
    clearTaskSelection,
    bulkShiftTasks,
    openHealthModal,
    openResourceLevelingModal,
    openAddTask,
    openBulkEdit,
    duplicateTaskGroup,
    renumberWBS,
    setBaseline0,
    openWBSLibrary,
    openCreateScenario,
    openPublishModal,
    activeScenario,
  } = useProgramme();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [baselineMenuOpen, setBaselineMenuOpen] = useState(false);
  const [autoLayoutOpen, setAutoLayoutOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [dateRangeIndex, setDateRangeIndex] = useState(0);

  const dateRanges = [
    "Sep 2025 – Jun 2026",
    "Jun 2025 – Mar 2026",
    "Oct 2025 – Jul 2026",
  ];

  const isNetwork = state.activeView === "network";
  const isList = state.activeView === "list";
  const isCalendar = state.activeView === "calendar";

  const [calendarTrade, setCalendarTrade] = useState("All Trades");
  const [calendarStatus, setCalendarStatus] = useState("All Statuses");
  const [calendarAssignee, setCalendarAssignee] = useState("All Assignees");
  const [tradeDropdownOpen, setTradeDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [assigneeDropdownOpen, setAssigneeDropdownOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5 select-none">
      {/* Left: View Switcher, History, Hierarchy & Save State (Strict 36px height) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
          {VIEWS.map((v) => {
            const Icon = v.icon;
            const isActive = state.activeView === v.id;
            return (
              <button
                key={v.id}
                onClick={() => setActiveView(v.id)}
                className={`flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{v.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setActiveView("3d")}
            className={`flex h-8 items-center gap-1.5 rounded px-3 text-[13px] font-medium transition-colors ${
              state.activeView === "3d"
                ? "bg-blue-600 text-white font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Box className="h-4 w-4" />
            <span>3D Model</span>
          </button>
        </div>

        {/* Undo / Redo */}
        <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={undo}
            disabled={!canUndo}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Undo schedule change (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={redo}
            disabled={!canRedo}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Redo schedule change (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {/* Indent / Outdent */}
        <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => state.selectedTaskId && outdentTask(state.selectedTaskId)}
            disabled={!state.selectedTaskId}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Outdent task hierarchy (Shift+Tab)"
          >
            <Outdent className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => state.selectedTaskId && indentTask(state.selectedTaskId)}
            disabled={!state.selectedTaskId}
            className="flex h-8 w-8 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Indent task hierarchy (Tab)"
          >
            <Indent className="h-4 w-4" />
          </button>
        </div>

        {/* WBS Group Clone & Renumbering */}
        <div className="hidden xl:inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5 shadow-2xs">
          <button
            type="button"
            onClick={() => state.selectedTaskId && duplicateTaskGroup(state.selectedTaskId)}
            disabled={!state.selectedTaskId}
            className="flex h-8 px-2 items-center gap-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 disabled:pointer-events-none transition-colors text-[11.5px] font-medium"
            title="Duplicate selected task group with remapped internal dependencies"
          >
            <Copy className="h-3.5 w-3.5" />
            <span>Clone</span>
          </button>
          <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
          <button
            type="button"
            onClick={() => renumberWBS()}
            className="flex h-8 px-2 items-center gap-1 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors text-[11.5px] font-medium"
            title="Renumber WBS outline codes preserving stable task IDs"
          >
            <Hash className="h-3.5 w-3.5" />
            <span>Renumber</span>
          </button>
        </div>

        {/* Multi-State Save & Concurrency Indicator */}
        <div className="hidden lg:inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium shadow-2xs transition-colors">
          {saveStatus === "saving" ? (
            <div className="flex items-center gap-1.5 text-blue-700">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
              <span>Saving...</span>
            </div>
          ) : saveStatus === "failed" ? (
            <div className="flex items-center gap-1.5 text-rose-700">
              <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
              <span>Save Failed</span>
              <button
                type="button"
                onClick={retrySave}
                className="ml-1 underline font-bold text-rose-800 hover:text-rose-950 cursor-pointer"
                title={saveError?.message || "Click to retry saving schedule"}
              >
                Retry
              </button>
            </div>
          ) : saveStatus === "conflict" ? (
            <div className="flex items-center gap-1.5 text-amber-800">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
              <span>Conflict (v{conflictDetails?.currentVersion || "?"})</span>
            </div>
          ) : saveStatus === "unsaved" ? (
            <div className="flex items-center gap-1.5 text-slate-500">
              <Clock className="h-3.5 w-3.5 text-slate-400" />
              <span>Unsaved</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-slate-700">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              <span>Saved (v{programmeVersion})</span>
            </div>
          )}
        </div>

        {/* History & Rollback Button */}
        <button
          type="button"
          onClick={openRollbackModal}
          className="inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors cursor-pointer"
          title="Inspect schedule revision history or execute controlled rollback"
        >
          <History className="h-3.5 w-3.5 text-slate-500" />
          <span>v{programmeVersion}</span>
        </button>

        {/* Schedule Health & Quality (DCMA 14-Point) */}
        <button
          type="button"
          onClick={openHealthModal}
          className={`inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border text-[12px] font-medium shadow-2xs transition-colors cursor-pointer ${
            schedulingWarnings && schedulingWarnings.length > 0
              ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          title="Inspect Schedule Quality, DCMA 14-Point Risk Analysis & Logic Health"
        >
          {schedulingWarnings && schedulingWarnings.length > 0 ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
              <span>{schedulingWarnings.length} alert{schedulingWarnings.length > 1 ? "s" : ""}</span>
            </>
          ) : (
            <>
              <ShieldAlert className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>Health</span>
            </>
          )}
        </button>

        {/* Resource Workload & Leveling */}
        <button
          type="button"
          onClick={openResourceLevelingModal}
          className="inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          title="Resource workload by day/week/month, rate cards & non-destructive levelling simulation"
        >
          <Users className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
          <span className="hidden sm:inline">Resources</span>
        </button>

        {/* Multi-selection pill */}
        {selectedTaskIds && selectedTaskIds.length > 0 && (
          <div className="inline-flex h-9 items-center gap-2 px-2.5 rounded-md border border-blue-200 bg-blue-50 text-[12px] font-medium text-blue-800 shadow-2xs animate-in fade-in">
            <span className="font-semibold">{selectedTaskIds.length} selected</span>
            <div className="h-3 w-px bg-blue-200" />
            <button
              type="button"
              onClick={openBulkEdit}
              className="px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] shadow-2xs transition-colors"
              title="Bulk edit properties of all selected tasks"
            >
              Bulk Edit...
            </button>
            <button
              type="button"
              onClick={() => bulkShiftTasks(selectedTaskIds, 1)}
              className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-[11px]"
              title="Shift selected tasks forward by 1 working day"
            >
              +1d
            </button>
            <button
              type="button"
              onClick={() => bulkShiftTasks(selectedTaskIds, -1)}
              className="px-1.5 py-0.5 rounded bg-white border border-blue-200 text-blue-700 hover:bg-blue-100 text-[11px]"
              title="Shift selected tasks earlier by 1 working day"
            >
              -1d
            </button>
            <button
              type="button"
              onClick={clearTaskSelection}
              className="text-blue-600 hover:text-blue-900 underline text-[11px] ml-1"
            >
              Clear
            </button>
          </div>
        )}

        {/* WBS Work Package Snippet Library */}
        <button
          type="button"
          id="wbs-library-btn"
          onClick={() => openWBSLibrary()}
          className="inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          title="Browse & insert standardized construction WBS work packages"
        >
          <Library className="h-3.5 w-3.5 text-blue-600" />
          <span className="hidden sm:inline">WBS Library</span>
        </button>

        {/* What-If Scenarios Sandbox */}
        <button
          type="button"
          id="scenarios-btn"
          onClick={openCreateScenario}
          className={`inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border text-[12px] font-medium transition-colors shadow-2xs cursor-pointer ${
            activeScenario
              ? "border-amber-400 bg-amber-50 text-amber-900 font-bold"
              : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
          }`}
          title="Create or test alternative What-If schedule branch without affecting live programme"
        >
          <GitBranch className="h-3.5 w-3.5 text-purple-600" />
          <span className="hidden sm:inline">{activeScenario ? "In Scenario" : "What-If"}</span>
        </button>

        {/* Controlled Programme Publishing */}
        <button
          type="button"
          id="publish-btn"
          onClick={openPublishModal}
          className="inline-flex h-9 items-center gap-1.5 px-2.5 rounded-md border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          title="Generate controlled programme issue transmittal & freeze client revision"
        >
          <Send className="h-3.5 w-3.5 text-indigo-600" />
          <span className="hidden sm:inline">Publish</span>
        </button>

        {/* Global Add Item Button */}
        <button
          type="button"
          onClick={() => openAddTask()}
          className="inline-flex h-9 items-center gap-1.5 px-3 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[12px] font-semibold shadow-2xs transition-colors cursor-pointer"
          title="Create standard task, milestone or summary group"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Item</span>
        </button>
      </div>

      {/* Right: Controls (Dynamic per view - All strict 36px height) */}
      {isCalendar ? (
        <div className="flex items-center gap-2">
          {/* All Trades ▾ */}
          <div className="relative">
            <button
              onClick={() => {
                setTradeDropdownOpen(!tradeDropdownOpen);
                setStatusDropdownOpen(false);
                setAssigneeDropdownOpen(false);
                setFilterPanelOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>{calendarTrade}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {tradeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-md z-50">
                {["All Trades", "Superstructure", "Substructure", "Groundworks", "M&E", "Quality Control", "Finishes", "External Works"].map((t) => (
                  <button
                    key={t}
                    onClick={() => {
                      setCalendarTrade(t);
                      setTradeDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[12.5px] ${
                      calendarTrade === t ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{t}</span>
                    {calendarTrade === t && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* All Statuses ▾ */}
          <div className="relative">
            <button
              onClick={() => {
                setStatusDropdownOpen(!statusDropdownOpen);
                setTradeDropdownOpen(false);
                setAssigneeDropdownOpen(false);
                setFilterPanelOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>{calendarStatus}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {statusDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-md z-50">
                {["All Statuses", "Complete", "In Progress", "Blocked", "Not Started"].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setCalendarStatus(s);
                      setStatusDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[12.5px] ${
                      calendarStatus === s ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{s}</span>
                    {calendarStatus === s && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* All Assignees ▾ */}
          <div className="relative">
            <button
              onClick={() => {
                setAssigneeDropdownOpen(!assigneeDropdownOpen);
                setTradeDropdownOpen(false);
                setStatusDropdownOpen(false);
                setFilterPanelOpen(false);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <span>{calendarAssignee}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {assigneeDropdownOpen && (
              <div className="absolute right-0 top-full mt-1 w-48 rounded-md border border-slate-200 bg-white p-1 shadow-md z-50">
                {["All Assignees", "EC (Emma Campbell)", "PT (Peter Taylor)", "Main Contractor", "Apex Groundworks"].map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setCalendarAssignee(a);
                      setAssigneeDropdownOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded px-2.5 py-1.5 text-[12.5px] ${
                      calendarAssignee === a ? "bg-blue-50 text-blue-700 font-medium" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{a}</span>
                    {calendarAssignee === a && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Filters Button */}
          <div className="relative">
            <button
              onClick={() => {
                setFilterPanelOpen(!filterPanelOpen);
                setTradeDropdownOpen(false);
                setStatusDropdownOpen(false);
                setAssigneeDropdownOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[12.5px] font-medium transition-colors ${
                filterPanelOpen
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Filters</span>
            </button>

            {filterPanelOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-lg z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[12px] font-semibold text-slate-800 uppercase tracking-wider">
                    Calendar Filters
                  </span>
                  <button
                    onClick={() => setFilterPanelOpen(false)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Done
                  </button>
                </div>
                <div className="py-2 space-y-2 text-[12.5px] text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criticalPathActive}
                      onChange={toggleCriticalPath}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Critical Tasks Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.attentionFilter === "blocked"}
                      onChange={() =>
                        setAttentionFilter(
                          state.attentionFilter === "blocked" ? "all" : "blocked"
                        )
                      }
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Blocked Tasks Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show Handover Milestone</span>
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : isList ? (
        <div className="flex items-center gap-3">
          {/* Quick list view controls: Critical Path Toggle + Info Badge */}
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              role="switch"
              aria-checked={criticalPathActive}
              onClick={toggleCriticalPath}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                criticalPathActive ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  criticalPathActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-[12.5px] font-medium text-slate-700 whitespace-nowrap">
              Critical Path Highlight
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-100/80 px-2.5 py-1 text-[11.5px] font-medium text-slate-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            <span>324 Tasks total</span>
            <span className="text-slate-300">•</span>
            <span>5 Major Phases</span>
          </div>

          {/* Fullscreen Expand */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : isNetwork ? (
        <div className="flex items-center gap-2.5">
          {/* Search network */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search network..."
              value={state.filters.search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-[12.5px] text-slate-800 placeholder:text-slate-400 shadow-2xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Filters Button */}
          <div className="relative">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-medium shadow-2xs transition-colors ${
                filterPanelOpen
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Filters</span>
            </button>

            {filterPanelOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-lg z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[12px] font-semibold text-slate-800 uppercase tracking-wider">
                    Network Filters
                  </span>
                  <button
                    onClick={() => setFilterPanelOpen(false)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Done
                  </button>
                </div>
                <div className="py-2 space-y-2 text-[12.5px] text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={criticalPathActive}
                      onChange={toggleCriticalPath}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Highlight Critical Path</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={state.attentionFilter === "blocked"}
                      onChange={() => setAttentionFilter(state.attentionFilter === "blocked" ? "all" : "blocked")}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Blocked Tasks Only</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      defaultChecked
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span>Show Milestones</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Critical Path Toggle Switch */}
          <div className="flex items-center gap-2 px-1">
            <button
              type="button"
              role="switch"
              aria-checked={criticalPathActive}
              onClick={toggleCriticalPath}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${
                criticalPathActive ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${
                  criticalPathActive ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </button>
            <span className="text-[12.5px] font-medium text-slate-700 whitespace-nowrap">
              Critical Path
            </span>
          </div>

          {/* Auto Layout Dropdown */}
          <div className="relative">
            <button
              onClick={() => setAutoLayoutOpen(!autoLayoutOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[12.5px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <span>Auto Layout</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>

            {autoLayoutOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg z-50">
                <button
                  onClick={() => {
                    setAutoLayoutMode("lr");
                    setAutoLayoutOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] ${
                    autoLayoutMode === "lr"
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>Left → Right (Flow)</span>
                  {autoLayoutMode === "lr" && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
                <button
                  onClick={() => {
                    setAutoLayoutMode("tb");
                    setAutoLayoutOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12.5px] ${
                    autoLayoutMode === "tb"
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>Top → Bottom (Vertical)</span>
                  {autoLayoutMode === "tb" && <Check className="h-3.5 w-3.5 text-blue-600" />}
                </button>
              </div>
            )}
          </div>

          {/* Zoom Controls: − 100% + */}
          <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white shadow-2xs text-[12.5px] font-medium text-slate-700">
            <button
              onClick={() => setNetworkZoom((prev) => Math.max(50, prev - 10))}
              className="flex h-8 w-7 items-center justify-center rounded-l-lg hover:bg-slate-50 text-slate-600 transition-colors"
              title="Zoom out"
            >
              −
            </button>
            <span className="px-2 text-[12px] font-medium text-slate-700 min-w-[42px] text-center">
              {networkZoom}%
            </span>
            <button
              onClick={() => setNetworkZoom((prev) => Math.min(150, prev + 10))}
              className="flex h-8 w-7 items-center justify-center rounded-r-lg hover:bg-slate-50 text-slate-600 transition-colors"
              title="Zoom in"
            >
              +
            </button>
          </div>

          {/* Fit to Screen */}
          <button
            onClick={() => setNetworkZoom(100)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
            title="Fit to Screen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          {/* Zoom Level Toggle (Strict 36px height) */}
          <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5">
            {ZOOM_LEVELS.map((z) => {
              const isActive = state.zoomLevel === z.id;
              return (
                <button
                  key={z.id}
                  onClick={() => setZoomLevel(z.id)}
                  className={`h-8 rounded px-2.5 text-[12.5px] font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {z.label}
                </button>
              );
            })}
          </div>

          {/* Baseline vs Current Programme Comparison Button (Strict 36px height) */}
          <div className="relative">
            <div
              className={`inline-flex h-9 items-center rounded-md border transition-colors shadow-2xs ${
                showBaselineComparison
                  ? "border-blue-400 bg-blue-50/70"
                  : "border-slate-200 bg-white"
              }`}
            >
              <button
                id="toolbar-compare-baseline-btn"
                type="button"
                onClick={toggleBaselineComparison}
                className={`inline-flex h-8 items-center gap-1.5 rounded-l-md px-2.5 text-[12.5px] font-medium transition-colors ${
                  showBaselineComparison
                    ? "bg-blue-600 text-white font-semibold"
                    : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                }`}
                title="Toggle Baseline vs Current comparison"
              >
                <GitCompare className="h-3.5 w-3.5" />
                <span>Compare Baseline</span>
                {showBaselineComparison && (
                  <span className="ml-0.5 rounded-xs bg-blue-700/80 px-1 py-0.2 text-[9.5px] font-mono text-white">
                    ON
                  </span>
                )}
              </button>
              <button
                id="toolbar-baseline-menu-btn"
                type="button"
                onClick={() => setBaselineMenuOpen(!baselineMenuOpen)}
                className={`flex h-8 w-6 items-center justify-center rounded-r-md transition-colors border-l ${
                  showBaselineComparison
                    ? "border-blue-500 bg-blue-600 text-blue-100 hover:bg-blue-700"
                    : "border-slate-100 text-slate-400 hover:text-slate-700 hover:bg-slate-50"
                }`}
                title="Select baseline reference schedule"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>

            {baselineMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-slate-200 bg-white p-2.5 shadow-xl z-50 animate-in fade-in-50 zoom-in-95">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                  <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    Reference Baseline
                  </span>
                  <button
                    onClick={() => setBaselineMenuOpen(false)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Close
                  </button>
                </div>

                <div className="space-y-1">
                  {[
                    {
                      id: "ver-b0",
                      name: "Baseline 0 (Contract)",
                      state: "Locked",
                      count: `${state.tasks.filter((t) => t.baseline0Start).length || state.tasks.length} tasks`,
                    },
                    {
                      id: "ver-ab",
                      name: "Approved Baseline 1.1",
                      state: "Approved",
                      count: `${state.tasks.length} tasks`,
                    },
                  ].map((base) => (
                    <button
                      key={base.id}
                      onClick={() => {
                        setSelectedBaselineVersion(base.id);
                        setShowBaselineComparison(true);
                        setBaselineMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-[12px] transition-colors ${
                        selectedBaselineVersion === base.id
                          ? "bg-blue-50 text-blue-800 font-medium"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-slate-800">{base.name}</div>
                        <div className="text-[10.5px] text-slate-400">{base.state} · {base.count}</div>
                      </div>
                      {selectedBaselineVersion === base.id && (
                        <Check className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-1.5">
                  <button
                    id="freeze-baseline-0-btn"
                    type="button"
                    onClick={() => {
                      setBaseline0("Contractual Baseline 0 established", "Project Planner");
                      setSelectedBaselineVersion("ver-b0");
                      setShowBaselineComparison(true);
                      setBaselineMenuOpen(false);
                    }}
                    className="flex w-full items-center justify-center gap-1.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors cursor-pointer"
                    title="Freeze current schedule as immutable Baseline 0 (Contract)"
                  >
                    <Lock className="h-3.5 w-3.5 text-amber-700" />
                    <span>Freeze Contract Baseline 0</span>
                  </button>

                  <button
                    onClick={() => {
                      toggleBaselineComparison();
                      setBaselineMenuOpen(false);
                    }}
                    className={`flex w-full items-center justify-center rounded px-2.5 py-1.5 text-[12px] font-medium transition-colors ${
                      showBaselineComparison
                        ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {showBaselineComparison ? "Turn Off Comparison" : "Turn On Comparison"}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Date Range Navigation (Strict 36px height) */}
          <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white text-[12.5px] font-medium text-slate-700">
            <button
              onClick={() =>
                setDateRangeIndex((prev) => Math.max(0, prev - 1))
              }
              className="flex h-9 w-8 items-center justify-center rounded-l-md hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 font-medium text-slate-700 whitespace-nowrap">
              {dateRanges[dateRangeIndex]}
            </span>
            <button
              onClick={() =>
                setDateRangeIndex((prev) =>
                  Math.min(dateRanges.length - 1, prev + 1),
                )
              }
              className="flex h-9 w-8 items-center justify-center rounded-r-md hover:bg-slate-50 text-slate-500 hover:text-slate-800 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Filters Button (Strict 36px height) */}
          <div className="relative">
            <button
              onClick={() => setFilterPanelOpen(!filterPanelOpen)}
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium transition-colors ${
                filterPanelOpen
                  ? "border-blue-400 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <Filter className="h-3.5 w-3.5 text-slate-500" />
              <span>Filters</span>
            </button>

            {/* Filter Dropdown */}
            {filterPanelOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg z-50">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-[12px] font-semibold text-slate-800 uppercase tracking-wider">
                    Quick Filters
                  </span>
                  <button
                    onClick={() => setFilterPanelOpen(false)}
                    className="text-[11px] text-blue-600 hover:underline"
                  >
                    Done
                  </button>
                </div>
                <div className="py-2 space-y-1 text-[13px] text-slate-700">
                  <label className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600" />
                    <span>Critical Path Only</span>
                  </label>
                  <label className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600" />
                    <span>Milestones Only</span>
                  </label>
                  <label className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600" />
                    <span>In Progress Tasks</span>
                  </label>
                  <label className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50 cursor-pointer">
                    <input type="checkbox" className="rounded text-blue-600" />
                    <span>Concrete Trade</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Quick Search Toggle (Strict 36px height) */}
          <button
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex h-9 w-9 items-center justify-center rounded-md border transition-colors ${
              searchOpen
                ? "border-blue-400 bg-blue-50 text-blue-600"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Search programme"
          >
            <Search className="h-4 w-4" />
          </button>

          {/* Fullscreen Expand (Strict 36px height) */}
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(() => {});
              } else {
                document.exitFullscreen().catch(() => {});
              }
            }}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
