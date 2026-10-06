"use client";

import React, { useState } from "react";
import { ChevronDown, Maximize2 } from "lucide-react";
import type { ModelElement, BuildingLevel } from "./model-data";
import { TIMELINE_PHASES, MODEL_ELEMENTS } from "./model-data";

interface ModelTimelineProps {
  selectedElement: ModelElement | null;
  selectedLevel: BuildingLevel | null;
  onSelectLevel: (lvl: BuildingLevel) => void;
  onSelectElement?: (el: ModelElement) => void;
  scrubMonthIndex?: number;
  onScrubMonth?: (index: number) => void;
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
  scrubMonthIndex = 5.3,
  onScrubMonth,
}: ModelTimelineProps) {
  const [timelineTab, setTimelineTab] = useState<"phases" | "milestones">("phases");
  const [isPlaying, setIsPlaying] = useState(false);
  const totalMonths = TIMELINE_MONTHS.length;

  // Active scrubber index (defaults to today index 5.3 = Feb/Mar 2026)
  const currentScrub = scrubMonthIndex;
  const scrubPercent = (Math.max(0, Math.min(totalMonths - 1, currentScrub)) / (totalMonths - 1)) * 100;

  // Playback timer
  React.useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      onScrubMonth?.(
        currentScrub >= totalMonths - 1 ? 0 : Number((currentScrub + 0.2).toFixed(1))
      );
    }, 400);
    return () => clearInterval(interval);
  }, [isPlaying, currentScrub, totalMonths, onScrubMonth]);

  const activeMonthData = TIMELINE_MONTHS[Math.min(totalMonths - 1, Math.floor(currentScrub))];

  return (
    <div className="border-t border-slate-200 bg-white select-none shrink-0">
      {/* Header bar */}
      <div className="flex h-8 items-center justify-between border-b border-slate-200 px-4">
        <div className="flex items-center gap-3">
          <span className="text-[12px] font-semibold text-slate-800 tracking-tight">
            Programme Timeline
          </span>

          <div className="flex items-center border border-slate-200 rounded-xs overflow-hidden">
            <button
              onClick={() => setTimelineTab("phases")}
              className={`px-2.5 py-1 text-[10.5px] font-medium transition-all border-r border-slate-200 ${
                timelineTab === "phases"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Phases
            </button>
            <button
              onClick={() => setTimelineTab("milestones")}
              className={`px-2.5 py-1 text-[10.5px] font-medium transition-all ${
                timelineTab === "milestones"
                  ? "bg-blue-600 text-white font-semibold"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
              }`}
            >
              Milestones
            </button>
          </div>

          {/* 4D Timeline Simulation Scrubber Controls */}
          <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-slate-200">
            <button
              onClick={() => setIsPlaying((p) => !p)}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-xs text-[10px] font-medium border transition-colors ${
                isPlaying
                  ? "bg-amber-500 text-white border-amber-600"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
              title={isPlaying ? "Pause 4D simulation" : "Play 4D schedule simulation"}
            >
              <span>{isPlaying ? "❚❚ Pause" : "▶ Play 4D"}</span>
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                onScrubMonth?.(5.3);
              }}
              className="text-[10px] text-slate-500 hover:text-slate-800 px-1.5 py-0.5 rounded-xs hover:bg-slate-100 transition-colors"
              title="Reset to today"
            >
              Today
            </button>

            <div className="flex items-center gap-1 text-[10.5px] font-mono text-slate-600 bg-slate-50 px-2 py-0.5 rounded-xs border border-slate-200">
              <span className="text-slate-400">Date:</span>
              <span className="font-semibold text-slate-800">
                {activeMonthData.month} {activeMonthData.year}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button className="flex items-center gap-1 border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xs">
            <span>Month</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>
          <button className="flex items-center gap-1 border border-slate-200 bg-white px-2 py-0.5 text-[10.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xs">
            <Maximize2 className="h-2.5 w-2.5 text-slate-400" />
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
                const isCurrentMonth = Math.floor(currentScrub) === idx;
                return (
                  <div
                    key={`${m.year}-${m.month}-${idx}`}
                    onClick={() => onScrubMonth?.(idx)}
                    className={`flex-1 border-r border-slate-200/80 px-1 py-0.5 text-center truncate last:border-r-0 cursor-pointer transition-colors ${
                      isCurrentMonth ? "bg-amber-50 font-bold" : "hover:bg-slate-100"
                    }`}
                    title={`Scrub to ${m.month} ${m.year}`}
                  >
                    {isNewYear && (
                      <span className="block text-[8px] font-bold text-slate-400 uppercase tracking-wider">
                        {m.year}
                      </span>
                    )}
                    <span className={`text-[9.5px] ${isCurrentMonth ? "text-amber-700 font-bold" : "text-slate-600 font-medium"}`}>
                      {m.month}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Rows */}
          <div className="relative divide-y divide-slate-100">
            {/* Vertical Simulated Date Scrubber Line spanning all rows */}
            <div
              className="absolute top-0 bottom-0 z-30 pointer-events-none transition-all duration-150"
              style={{ left: `calc(13.5rem + (100% - 13.5rem) * ${scrubPercent / 100})` }}
            >
              <div className="relative h-full flex flex-col items-center">
                <span className="absolute -top-5 rounded-xs bg-amber-500 px-1.5 py-0.5 text-[8.5px] font-bold text-white shadow-xs font-mono">
                  {activeMonthData.month} &apos;{activeMonthData.year.slice(2)}
                </span>
                <div className="w-0 h-full border-l-2 border-solid border-amber-500/90 shadow-xs" />
              </div>
            </div>

            {TIMELINE_PHASES.map((phase) => {
              const isSelectedLevelRow =
                (phase.level && phase.level === selectedLevel) ||
                (selectedElement && phase.elementIds.includes(selectedElement.id)) ||
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
                    // Select first relevant model element for this phase
                    const primaryEl =
                      MODEL_ELEMENTS.find((e) => phase.elementIds.includes(e.id)) ||
                      (phase.level ? MODEL_ELEMENTS.find((e) => e.level === phase.level) : null);
                    if (primaryEl && onSelectElement) {
                      onSelectElement(primaryEl);
                    }
                  }}
                  className={`flex items-center text-[11px] transition-colors cursor-pointer ${
                    isSelectedLevelRow
                      ? "bg-blue-50/90 font-semibold text-blue-900"
                      : "hover:bg-slate-50 text-slate-700"
                  }`}
                  style={{ height: 20 }}
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
                      className="absolute h-3.5 rounded-xs transition-all duration-200 hover:brightness-105"
                      style={{
                        left: `${leftPercent}%`,
                        width: `${Math.max(2.5, widthPercent)}%`,
                        background: barColor,
                        boxShadow: isSelectedLevelRow
                          ? `0 0 0 1px white, 0 0 0 2px ${barColor}`
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
