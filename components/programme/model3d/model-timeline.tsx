"use client";

import React, { useState } from "react";
import { ChevronDown, Maximize2, Flag, BarChart2 } from "lucide-react";
import type { ModelElement, BuildingLevel, TaskStatus } from "./model-data";
import { STATUS_CONFIG, TIMELINE_PHASES } from "./model-data";

interface ModelTimelineProps {
  selectedElement: ModelElement | null;
  selectedLevel: BuildingLevel;
  onSelectLevel: (lvl: BuildingLevel) => void;
  onSelectElement?: (el: ModelElement) => void;
}

const TIMELINE_MONTHS = [
  { year: "2025", month: "Sep" },
  { year: "2025", month: "Oct" },
  { year: "2025", month: "Nov" },
  { year: "2025", month: "Dec" },
  { year: "2026", month: "Jan" },
  { year: "2026", month: "Feb" },
  { year: "2026", month: "Mar" }, // TODAY
  { year: "2026", month: "Apr" },
  { year: "2026", month: "May" },
  { year: "2026", month: "Jun" },
  { year: "2026", month: "Jul" },
  { year: "2026", month: "Aug" },
  { year: "2026", month: "Sep" },
  { year: "2026", month: "Oct" },
  { year: "2026", month: "Nov" },
];

export function ModelTimeline({
  selectedElement,
  selectedLevel,
  onSelectLevel,
  onSelectElement,
}: ModelTimelineProps) {
  const [timelineTab, setTimelineTab] = useState<"phases" | "milestones">("phases");
  const totalMonths = TIMELINE_MONTHS.length;

  // Today marker index is at Feb 2026 (index 5.3) matching the reference screenshot
  const todayMonthIndex = 5.3;
  const todayPercent = (todayMonthIndex / totalMonths) * 100;

  return (
    <div className="border-t border-slate-200 bg-white select-none shrink-0">
      {/* Header bar */}
      <div className="flex h-9 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-3">
          <span className="text-[12.5px] font-bold text-slate-900 tracking-tight">
            Programme Timeline
          </span>

          <div className="flex items-center gap-1 rounded-md bg-slate-100 p-0.5 border border-slate-200/80">
            <button
              onClick={() => setTimelineTab("phases")}
              className={`rounded px-2.5 py-0.5 text-[10.5px] font-semibold transition-all ${
                timelineTab === "phases"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Major Phases
            </button>
            <button
              onClick={() => setTimelineTab("milestones")}
              className={`rounded px-2 py-0.5 text-[10.5px] font-semibold transition-all ${
                timelineTab === "milestones"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Key Milestones
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <span>Month</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
          <button className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">
            <Maximize2 className="h-3 w-3 text-slate-400" />
            <span>Fit</span>
          </button>
        </div>
      </div>

      {/* Main Gantt Table Area */}
      <div className="overflow-x-auto overflow-y-hidden">
        <div className="min-w-[960px]">
          {/* Months Header row */}
          <div className="flex border-b border-slate-200 bg-slate-50/70 text-[9.5px] font-semibold text-slate-500">
            <div className="w-10 px-2 py-1 border-r border-slate-200 text-center shrink-0">#</div>
            <div className="w-44 px-3 py-1 border-r border-slate-200 shrink-0">Work Package</div>
            <div className="flex-1 flex relative">
              {TIMELINE_MONTHS.map((m, idx) => {
                const isNewYear = idx === 0 || m.year !== TIMELINE_MONTHS[idx - 1].year;
                return (
                  <div
                    key={`${m.year}-${m.month}-${idx}`}
                    className="flex-1 border-r border-slate-200/80 px-1 py-0.5 text-center truncate last:border-r-0"
                  >
                    {isNewYear && (
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                        {m.year}
                      </span>
                    )}
                    <span className="text-[9.5px] text-slate-600 font-medium">{m.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="relative divide-y divide-slate-100">
            {/* Vertical "Today" Marker Line spanning all rows */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none"
              style={{ left: `calc(13.5rem + (100% - 13.5rem) * ${todayPercent / 100})` }}
            >
              <div className="relative h-full flex flex-col items-center">
                <span className="absolute -top-5 rounded-md bg-blue-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                  Today
                </span>
                <div className="w-0 h-full border-l-2 border-dotted border-blue-500/90" />
              </div>
            </div>

            {TIMELINE_PHASES.map((phase) => {
              const isSelectedLevelRow =
                (phase.level && phase.level === selectedLevel) ||
                (selectedElement?.phase && selectedElement.phase === phase.id);

              const leftPercent = (phase.startMonth / totalMonths) * 100;
              const widthPercent = (phase.durationMonths / totalMonths) * 100;

              // Color of bar matching status
              const barColor =
                isSelectedLevelRow || phase.id === "level-2"
                  ? "#2563eb"
                  : phase.status === "complete"
                  ? "#10b981"
                  : phase.status === "in-progress"
                  ? "#2563eb"
                  : phase.status === "blocked"
                  ? "#ef4444"
                  : "#94a3b8";

              return (
                <div
                  key={phase.id}
                  onClick={() => {
                    if (phase.level) {
                      onSelectLevel(phase.level);
                    }
                  }}
                  className={`flex items-center text-[11px] transition-colors cursor-pointer ${
                    isSelectedLevelRow
                      ? "bg-blue-50/90 font-semibold text-blue-900"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                  style={{ height: 23 }}
                >
                  {/* Row index */}
                  <div className="w-10 px-2 text-center text-slate-400 font-mono text-[10.5px] border-r border-slate-100 shrink-0">
                    {phase.index}
                  </div>

                  {/* Phase Label */}
                  <div className="w-44 px-3 truncate border-r border-slate-100 shrink-0 font-medium flex items-center gap-1">
                    {isSelectedLevelRow && <span className="text-blue-600 font-bold">›</span>}
                    <span className={isSelectedLevelRow ? "text-blue-900 font-semibold" : ""}>
                      {phase.label}
                    </span>
                  </div>

                  {/* Gantt Bar Chart Track */}
                  <div className="flex-1 relative h-full flex items-center px-1">
                    {/* Background grid vertical lines */}
                    <div className="absolute inset-0 flex pointer-events-none">
                      {TIMELINE_MONTHS.map((_, i) => (
                        <div
                          key={i}
                          className="flex-1 border-r border-slate-100/80 last:border-r-0"
                        />
                      ))}
                    </div>

                    {/* Phase Bar */}
                    <div
                      className="absolute h-3.5 rounded-sm transition-all duration-300 shadow-2xs hover:brightness-105"
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(2.5, widthPercent)}%`,
                        background: barColor,
                        boxShadow: isSelectedLevelRow
                          ? `0 0 0 1.5px white, 0 0 0 3px ${barColor}`
                          : "none",
                      }}
                      title={`${phase.label} · ${phase.status}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
