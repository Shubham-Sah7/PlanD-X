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
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { ViewMode, ZoomLevel } from "@/lib/programme-types";

const VIEWS: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "gantt", label: "Gantt", icon: GanttChartSquare },
  { id: "network", label: "Network", icon: Network },
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: Calendar },
];

const ZOOM_LEVELS: { id: ZoomLevel; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "week", label: "Week" },
  { id: "month", label: "Month" },
  { id: "quarter", label: "Quarter" },
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
  } = useProgramme();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
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
      {/* Left: View Switcher (Strict 36px height) */}
      <div className="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white p-0.5">
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
