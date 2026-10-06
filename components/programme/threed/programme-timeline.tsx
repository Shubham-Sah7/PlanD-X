"use client";

import React from "react";
import type { BuildingTask } from "./threed-data";
import { STATUS_COLORS, TIMELINE_PHASES } from "./threed-data";

interface ProgrammeTimelineProps {
  selectedTask: BuildingTask | null;
}

const MONTHS = [
  { label: "Sep 2025", short: "Sep" },
  { label: "Oct 2025", short: "Oct" },
  { label: "Nov 2025", short: "Nov" },
  { label: "Dec 2025", short: "Dec" },
  { label: "Jan 2026", short: "Jan" },
  { label: "Feb 2026", short: "Feb" },
  { label: "Mar 2026", short: "Mar" },
  { label: "Apr 2026", short: "Apr" },
];

// Phase definitions with column positions (1-indexed, out of 8 months)
const PHASES = [
  { id: "site-est", label: "Site Establishment", colStart: 1, colSpan: 1, status: "complete" as const },
  { id: "earthworks", label: "Earthworks", colStart: 1, colSpan: 2, status: "complete" as const },
  { id: "superstructure", label: "Superstructure", colStart: 2, colSpan: 2, status: "complete" as const },
  { id: "level-1", label: "Level 1", colStart: 3, colSpan: 2, status: "complete" as const },
  { id: "level-2", label: "Level 2", colStart: 4, colSpan: 2, status: "in-progress" as const },
  { id: "level-3", label: "Level 3", colStart: 5, colSpan: 2, status: "not-started" as const },
  { id: "level-4", label: "Level 4", colStart: 6, colSpan: 2, status: "not-started" as const },
  { id: "facade", label: "Façade", colStart: 4, colSpan: 4, status: "blocked" as const },
];

// Map task phase to phase id
const PHASE_MAP: Record<string, string> = {
  "Superstructure": "superstructure",
  "Level 1": "level-1",
  "Level 2": "level-2",
  "Level 3": "level-3",
  "Level 4": "level-4",
  "Façade": "facade",
};

export function ProgrammeTimeline({ selectedTask }: ProgrammeTimelineProps) {
  const highlightPhaseId = selectedTask ? PHASE_MAP[selectedTask.phase] : null;

  return (
    <div className="border-t border-slate-200 bg-white px-5 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Programme Timeline</span>
        <span className="text-[10px] text-slate-400">Sep 2025 → Apr 2026</span>
      </div>

      <div className="relative">
        {/* Month headers */}
        <div className="grid mb-1" style={{ gridTemplateColumns: `repeat(${MONTHS.length}, 1fr)` }}>
          {MONTHS.map((m) => (
            <div key={m.label} className="text-center">
              <span className="text-[10px] text-slate-400 font-medium">{m.short}</span>
            </div>
          ))}
        </div>

        {/* Today marker */}
        {/* Dec 2025 = col 4, approx 70% through */}
        <div
          className="absolute top-0 bottom-0 w-px bg-blue-500 z-10"
          style={{ left: `calc(${(3 + 0.7) / MONTHS.length * 100}%)` }}
        >
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap">
            Today
          </div>
        </div>

        {/* Phase rows */}
        <div className="space-y-1">
          {PHASES.map((phase) => {
            const colors = STATUS_COLORS[phase.status];
            const isHighlighted = highlightPhaseId === phase.id;
            const colWidth = 100 / MONTHS.length;
            const left = (phase.colStart - 1) * colWidth;
            const width = phase.colSpan * colWidth;

            return (
              <div key={phase.id} className="relative" style={{ height: "22px" }}>
                <div
                  className="absolute inset-y-0 flex items-center px-2 rounded transition-all"
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    background: isHighlighted ? colors.fill : colors.light,
                    border: `1px solid ${isHighlighted ? colors.stroke : colors.fill}`,
                    opacity: isHighlighted ? 1 : 0.7,
                    transform: isHighlighted ? "scaleY(1.05)" : "scaleY(1)",
                    boxShadow: isHighlighted ? `0 1px 4px ${colors.fill}40` : "none",
                  }}
                >
                  <span
                    className="text-[10px] font-medium truncate"
                    style={{ color: isHighlighted ? "white" : colors.text }}
                  >
                    {phase.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Grid lines */}
        <div className="absolute inset-0 grid pointer-events-none" style={{ gridTemplateColumns: `repeat(${MONTHS.length}, 1fr)` }}>
          {MONTHS.map((m, i) => (
            <div key={m.label} className={`border-l ${i === 0 ? "border-transparent" : "border-slate-100"}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
