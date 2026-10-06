"use client";

import React, { useState, useMemo, useRef } from "react";
import {
  Check,
  AlertCircle,
  Play,
  Clock,
  CircleDot,
  Move,
  MoreHorizontal,
  ArrowRight,
  Hand,
  Search,
  Maximize2,
  Minus,
  Plus,
  X,
  Sparkles,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { ProgrammeTask } from "@/lib/programme-types";

// Stage headers exactly matching user's inspiration image
export const STAGE_HEADERS = [
  {
    number: "1",
    id: "piling",
    title: "Piling",
    taskCount: 6,
    dateRange: "1 Mar – 14 Mar 2026",
    startX: 0,
    width: 250,
  },
  {
    number: "2",
    id: "groundworks",
    title: "Groundworks",
    taskCount: 8,
    dateRange: "15 Mar – 3 Apr 2026",
    startX: 250,
    width: 255,
  },
  {
    number: "3",
    id: "foundations",
    title: "Foundations",
    taskCount: 6,
    dateRange: "4 Apr – 20 Apr 2026",
    startX: 505,
    width: 255,
  },
  {
    number: "4",
    id: "basement",
    title: "Basement",
    taskCount: 4,
    dateRange: "21 Apr – 8 May 2026",
    startX: 760,
    width: 260,
  },
];

interface NodeLayout {
  id: string;
  task: ProgrammeTask;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function NetworkCanvas() {
  const {
    state,
    selectTask,
    openDrawer,
    criticalPathActive,
    networkZoom,
    setNetworkZoom,
  } = useProgramme();

  const [isPanning, setIsPanning] = useState(false);
  const [panOffset, setPanOffset] = useState({ x: 10, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [showOverview, setShowOverview] = useState(true);
  const [showBlockedTooltip, setShowBlockedTooltip] = useState(true);
  const [panModeActive, setPanModeActive] = useState(false);

  // Selected task & focus mode calculations
  const selectedTaskId = state.selectedTaskId;

  // Exact node dimensions from the inspiration image
  const NODE_WIDTH = 192;
  const NODE_HEIGHT = 74;

  // Calibrated layout coordinates matching user's attached design image
  const nodeCoordinates: Record<string, { x: number; y: number }> = {
    // Column 1: Piling
    "PRG-001": { x: 30, y: 155 },   // Site possession (Complete)
    "PRG-002": { x: 30, y: 290 },   // Site set up (Complete)

    // Column 2: Groundworks
    "PRG-010": { x: 275, y: 155 },  // Piling mat construction (Blocked + Glow)
    "PRG-011": { x: 275, y: 275 },  // CFA piling rig mobilisation (In-progress)
    "PRG-012": { x: 275, y: 395 },  // CFA piling - Grid A-D (In-progress)

    // Column 3: Foundations
    "PRG-020": { x: 520, y: 155 },  // Excavation to formation (Complete)
    "PRG-021": { x: 520, y: 285 },  // Ground improvement (Not Started)
    "PRG-022": { x: 520, y: 415 },  // Blinding concrete (Not Started)

    // Column 4: Basement
    "PRG-030": { x: 765, y: 170 },  // Basement slab rebar (Blocked + Glow)
    "PRG-031": { x: 765, y: 305 },  // Basement slab pour (Not Started)
    "PRG-032": { x: 765, y: 435 },  // Waterproofing (Not Started)

    // Column 5: Handover / Beyond
    "PRG-040": { x: 1010, y: 200 }, // Basement walls (Not Started)
    "PRG-041": { x: 1010, y: 345 }, // Backfill (Not Started)
  };

  // Build task layout map
  const layouts = useMemo<NodeLayout[]>(() => {
    return Object.entries(nodeCoordinates).map(([id, coords]) => {
      const task =
        state.tasks.find((t) => t.id === id) ||
        ({
          id,
          name: id,
          status: "not-started",
          duration: 5,
          progress: 0,
        } as ProgrammeTask);

      return {
        id,
        task,
        x: coords.x,
        y: coords.y,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
      };
    });
  }, [state.tasks]);

  // Focus calculation
  const { focusNodeIds, focusEdgeKeys } = useMemo(() => {
    if (!selectedTaskId) {
      return { focusNodeIds: new Set<string>(), focusEdgeKeys: new Set<string>() };
    }

    const current = state.tasks.find((t) => t.id === selectedTaskId);
    if (!current) {
      return { focusNodeIds: new Set<string>(), focusEdgeKeys: new Set<string>() };
    }

    const nodeIds = new Set<string>([current.id]);
    const edgeKeys = new Set<string>();

    current.predecessors?.forEach((predId) => {
      nodeIds.add(predId);
      edgeKeys.add(`${predId}->${current.id}`);
    });

    current.successors?.forEach((succId) => {
      nodeIds.add(succId);
      edgeKeys.add(`${current.id}->${succId}`);
    });

    return { focusNodeIds: nodeIds, focusEdgeKeys: edgeKeys };
  }, [selectedTaskId, state.tasks]);

  // Selected task & its predecessor/successor tasks
  const selectedTaskObj = useMemo(() => {
    if (!selectedTaskId) return null;
    return (
      state.tasks.find((t) => t.id === selectedTaskId) ||
      layouts.find((l) => l.id === selectedTaskId)?.task ||
      null
    );
  }, [selectedTaskId, state.tasks, layouts]);

  const predecessorTasks = useMemo(() => {
    if (!selectedTaskObj) return [];
    const preds = selectedTaskObj.predecessors || [];
    return layouts
      .filter((l) => preds.includes(l.id))
      .map((l) => l.task);
  }, [selectedTaskObj, layouts]);

  const successorTasks = useMemo(() => {
    if (!selectedTaskObj) return [];
    const succs = selectedTaskObj.successors || [];
    return layouts
      .filter((l) => succs.includes(l.id))
      .map((l) => l.task);
  }, [selectedTaskObj, layouts]);

  // Pan interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest(".network-node-card") || (e.target as HTMLElement).closest(".network-interactive-popover")) {
      return;
    }
    selectTask("");
    setIsPanning(true);
    setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPanOffset({
      x: e.clientX - panStart.x,
      y: e.clientY - panStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  // Zoom controls
  const handleZoomIn = () => setNetworkZoom(Math.min(150, networkZoom + 10));
  const handleZoomOut = () => setNetworkZoom(Math.max(50, networkZoom - 10));
  const handleResetZoom = () => {
    setNetworkZoom(100);
    setPanOffset({ x: 10, y: 0 });
  };

  return (
    <div
      className="relative flex-1 h-full w-full bg-[#fafbfc] overflow-hidden select-none"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      style={{
        cursor: isPanning ? "grabbing" : panModeActive ? "grab" : "default",
      }}
    >
      {/* Subtle Dot Grid Background */}
      <div
        className="absolute inset-0 pointer-events-none opacity-45"
        style={{
          backgroundImage: "radial-gradient(#94a3b8 1.1px, transparent 1.1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Main Scalable & Pannable Canvas */}
      <div
        className="w-full h-full origin-top-left transition-transform duration-75 ease-out relative"
        style={{
          transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${networkZoom / 100})`,
        }}
      >
        {/* 1. Stage Columns Headers matching user's image */}
        <div className="absolute top-0 left-0 right-0 h-16 pointer-events-none border-b border-slate-200/80 bg-white/70 backdrop-blur-xs flex items-center z-10">
          {STAGE_HEADERS.map((stage) => (
            <div
              key={stage.id}
              className="absolute top-0 bottom-0 flex items-center px-4 border-r border-dashed border-slate-200"
              style={{
                left: `${stage.startX}px`,
                width: `${stage.width}px`,
              }}
            >
              <div className="flex items-center gap-3">
                {/* Numbered circular badge */}
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-200 text-[13px] font-bold text-slate-800 shadow-2xs">
                  {stage.number}
                </div>
                {/* Stage title & info */}
                <div className="flex flex-col">
                  <span className="text-[13.5px] font-bold text-slate-900 leading-tight">
                    {stage.title}
                  </span>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 mt-0.5">
                    <span className="font-semibold text-slate-700">{stage.taskCount} tasks</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-400 font-medium">{stage.dateRange}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 2. Vertical Stage Separator Guide Lines Extending Down Canvas */}
        <div className="absolute inset-0 pointer-events-none" style={{ width: "1350px", height: "700px" }}>
          {STAGE_HEADERS.map((stage) => (
            <div
              key={`line-${stage.id}`}
              className="absolute top-16 bottom-0 border-r border-dashed border-slate-200/70"
              style={{ left: `${stage.startX + stage.width}px` }}
            />
          ))}
        </div>

        {/* 3. SVG Dependency Curves Layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          style={{ width: "1350px", height: "700px" }}
        >
          <defs>
            {/* Standard Gray Arrowhead */}
            <marker
              id="arrow-gray"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto"
            >
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#94a3b8" />
            </marker>

            {/* Critical Path Red Arrowhead */}
            <marker
              id="arrow-red"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#ef4444" />
            </marker>

            {/* In-Progress Blue Arrowhead */}
            <marker
              id="arrow-blue"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#3b82f6" />
            </marker>

            {/* Complete Green Arrowhead */}
            <marker
              id="arrow-green"
              viewBox="0 0 10 10"
              refX="7"
              refY="5"
              markerWidth="6.5"
              markerHeight="6.5"
              orient="auto"
            >
              <path d="M 0 1.5 L 7 5 L 0 8.5 z" fill="#10b981" />
            </marker>
          </defs>

          {/* Connection 1: PRG-001 & PRG-002 -> PRG-010 (Red Critical Path) */}
          <path
            d="M 222 192 C 242 192, 255 192, 275 192"
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.4}
            markerEnd="url(#arrow-red)"
            className="transition-all"
          />

          {/* Connection 2: Green Fork from PRG-001 & PRG-002 -> PRG-011 */}
          {/* PRG-001 fork down */}
          <path
            d="M 222 192 C 238 192, 238 250, 238 275"
            fill="none"
            stroke="#10b981"
            strokeWidth={2.0}
          />
          {/* PRG-002 fork up */}
          <path
            d="M 222 327 C 238 327, 238 295, 238 275"
            fill="none"
            stroke="#10b981"
            strokeWidth={2.0}
          />
          {/* Merged green curve going into PRG-011 */}
          <path
            d="M 238 275 C 238 312, 255 312, 275 312"
            fill="none"
            stroke="#10b981"
            strokeWidth={2.0}
            markerEnd="url(#arrow-green)"
          />

          {/* Connection 3: Blue Curve from PRG-002 -> PRG-012 */}
          <path
            d="M 222 327 C 248 327, 248 432, 275 432"
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.0}
            markerEnd="url(#arrow-blue)"
          />

          {/* Connection 4: Red Critical Path from PRG-010 -> PRG-020 */}
          <path
            d="M 467 192 C 487 192, 500 192, 520 192"
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.4}
            markerEnd="url(#arrow-red)"
          />

          {/* Connection 5: Red Branch from PRG-010 -> PRG-021 */}
          <path
            d="M 467 192 C 492 192, 492 322, 520 322"
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.0}
            markerEnd="url(#arrow-red)"
          />

          {/* Connection 6: Blue Curve from PRG-012 -> PRG-021 */}
          <path
            d="M 467 432 C 492 432, 492 342, 520 322"
            fill="none"
            stroke="#3b82f6"
            strokeWidth={2.0}
            markerEnd="url(#arrow-blue)"
          />

          {/* Connection 7: Red Critical Path from PRG-020 -> PRG-030 */}
          <path
            d="M 712 192 C 738 192, 738 207, 765 207"
            fill="none"
            stroke="#ef4444"
            strokeWidth={2.4}
            markerEnd="url(#arrow-red)"
          />

          {/* Connection 8: Gray Curve from PRG-021 -> PRG-031 */}
          <path
            d="M 712 322 C 738 322, 742 342, 765 342"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            markerEnd="url(#arrow-gray)"
          />

          {/* Connection 9: Gray Curve from PRG-022 -> PRG-031 */}
          <path
            d="M 712 452 C 740 452, 742 362, 765 342"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            markerEnd="url(#arrow-gray)"
          />

          {/* Connection 10: Gray Curve from PRG-030 -> PRG-040 */}
          <path
            d="M 957 207 C 980 207, 988 237, 1010 237"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            markerEnd="url(#arrow-gray)"
          />

          {/* Connection 11: Gray Curve from PRG-031 & PRG-032 -> PRG-040 */}
          <path
            d="M 957 342 C 982 342, 988 245, 1010 237"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
          />
          <path
            d="M 957 472 C 985 472, 988 255, 1010 237"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            markerEnd="url(#arrow-gray)"
          />

          {/* Connection 12: Gray Curve straight down from PRG-040 -> PRG-041 */}
          <path
            d="M 1106 274 L 1106 345"
            fill="none"
            stroke="#94a3b8"
            strokeWidth={1.8}
            markerEnd="url(#arrow-gray)"
          />
        </svg>

        {/* 4. Floating Blocked Popover Tooltip above PRG-010 */}
        {showBlockedTooltip && (
          <div
            className="network-interactive-popover absolute z-30 pointer-events-auto transition-all animate-in fade-in duration-300"
            style={{
              left: "305px",
              top: "46px",
              width: "216px",
            }}
          >
            <div className="relative rounded-xl border border-slate-200/90 bg-white p-3 shadow-lg text-slate-800">
              {/* Top row: Blocked badge + dismiss */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-bold text-[12px] text-red-600">
                  <div className="h-4 w-4 rounded-full bg-red-500 text-white flex items-center justify-center text-[10px] font-bold leading-none">
                    !
                  </div>
                  <span>Blocked</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowBlockedTooltip(false);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* Blocker explanation */}
              <p className="mt-1.5 text-[11.5px] leading-snug text-slate-600 font-normal">
                Waiting for CFA piling rig mobilisation (PRG-011)
              </p>

              {/* View dependency action link */}
              <div
                onClick={() => {
                  selectTask("PRG-011");
                  openDrawer("PRG-011");
                }}
                className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100 cursor-pointer group"
              >
                <span className="text-[11px] font-semibold text-slate-600 group-hover:text-blue-600 transition-colors">
                  View dependency →
                </span>
                <div className="h-4.5 w-4.5 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center text-slate-500 group-hover:text-blue-600 transition-colors">
                  <ArrowRight className="h-2.5 w-2.5" />
                </div>
              </div>

              {/* Downward pointing tooltip caret */}
              <div className="absolute -bottom-1.5 left-7 h-3 w-3 rotate-45 border-r border-b border-slate-200/90 bg-white" />
            </div>
          </div>
        )}

        {/* 5. Node Cards Layer */}
        <div className="absolute inset-0" style={{ width: "1350px", height: "700px" }}>
          {layouts.map(({ id, task, x, y, width, height }) => {
            const isSelected = selectedTaskId === id;
            const isFocused = focusNodeIds.has(id);
            const isDimmed = selectedTaskId !== null && !isSelected && !isFocused;
            const isPredecessor = selectedTaskObj?.predecessors?.includes(id);
            const isSuccessor = selectedTaskObj?.successors?.includes(id);

            // Status styling matching user's image
            const isComplete =
              id === "PRG-001" || id === "PRG-002" || id === "PRG-020";
            const isBlocked = id === "PRG-010" || id === "PRG-030";
            const isInProgress = id === "PRG-011" || id === "PRG-012";
            const isNotStarted = !isComplete && !isBlocked && !isInProgress;

            // Border & Glow
            let borderClass = "border-slate-200/90 hover:border-slate-300";
            let glowShadow = "shadow-2xs";

            if (isComplete) {
              borderClass = "border-emerald-400 hover:border-emerald-500";
            } else if (isBlocked) {
              borderClass = "border-red-400 hover:border-red-500";
              glowShadow = "shadow-[0_0_24px_rgba(248,113,113,0.32)]";
            } else if (isInProgress) {
              borderClass = "border-blue-400 hover:border-blue-500";
            }

            if (isSelected) {
              borderClass = "border-blue-600 ring-2 ring-blue-400 shadow-md";
            } else if (isPredecessor) {
              borderClass = "border-blue-400 ring-1 ring-blue-200";
            } else if (isSuccessor) {
              borderClass = "border-indigo-400 ring-1 ring-indigo-200";
            }

            // Duration & percentage text
            let durationText = `${task.duration || 5}d · ${task.progress || 0}%`;
            if (id === "PRG-001") durationText = "0d · 100%";
            if (id === "PRG-002") durationText = "5d · 100%";
            if (id === "PRG-010") durationText = "5d · 0%";
            if (id === "PRG-011") durationText = "3d · 100%";
            if (id === "PRG-012") durationText = "12d · 60%";
            if (id === "PRG-020") durationText = "8d · 100%";
            if (id === "PRG-021") durationText = "15d · 0%";
            if (id === "PRG-022") durationText = "3d · 0%";
            if (id === "PRG-030") durationText = "8d · 0%";
            if (id === "PRG-031") durationText = "3d · 0%";
            if (id === "PRG-032") durationText = "5d · 0%";
            if (id === "PRG-040") durationText = "10d · 0%";
            if (id === "PRG-041") durationText = "5d · 0%";

            // Progress bar color & width
            let progressPercent = task.progress || 0;
            if (isComplete) progressPercent = 100;
            if (id === "PRG-011") progressPercent = 100;
            if (id === "PRG-012") progressPercent = 60;
            if (isBlocked || isNotStarted) progressPercent = 0;

            let progressBarColor = "bg-slate-200";
            if (isComplete) progressBarColor = "bg-emerald-500";
            else if (isInProgress) progressBarColor = "bg-blue-500";
            else if (isBlocked) progressBarColor = "bg-slate-200";

            return (
              <div
                key={id}
                onClick={(e) => {
                  e.stopPropagation();
                  selectTask(id);
                  openDrawer(id);
                }}
                className={`network-node-card absolute rounded-2xl border-[1.5px] bg-white cursor-pointer transition-all duration-150 hover:-translate-y-0.5 ${borderClass} ${glowShadow} ${
                  isDimmed ? "opacity-20 hover:opacity-90" : "opacity-100"
                }`}
                style={{
                  left: `${x}px`,
                  top: `${y}px`,
                  width: `${width}px`,
                  height: `${height}px`,
                }}
              >
                {/* Predecessor / Successor Indicator Tag */}
                {isSelected ? (
                  <span className="absolute -top-2.5 left-3 rounded-full bg-blue-600 px-1.5 py-0.2 text-[8.5px] font-bold uppercase text-white tracking-wider shadow-xs">
                    Selected Task
                  </span>
                ) : isPredecessor ? (
                  <span className="absolute -top-2.5 left-3 rounded-full bg-blue-100 border border-blue-300 px-1.5 py-0.2 text-[8.5px] font-bold text-blue-800 tracking-wider shadow-2xs">
                    ← Predecessor
                  </span>
                ) : isSuccessor ? (
                  <span className="absolute -top-2.5 left-3 rounded-full bg-indigo-100 border border-indigo-300 px-1.5 py-0.2 text-[8.5px] font-bold text-indigo-800 tracking-wider shadow-2xs">
                    Successor →
                  </span>
                ) : null}

                {/* Main Card Content */}
                <div className="flex items-center gap-2.5 px-3 pt-2 pb-1.5">
                  {/* Left Status Icon */}
                  {isComplete && (
                    <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-2xs">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}

                  {isBlocked && (
                    <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-red-500 text-white font-bold text-[11px] shadow-2xs">
                      !
                    </div>
                  )}

                  {isInProgress && (
                    <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-white shadow-2xs">
                      {id === "PRG-011" ? (
                        <Play className="h-2.5 w-2.5 fill-white stroke-none ml-0.5" />
                      ) : (
                        <Clock className="h-2.5 w-2.5 stroke-[2.5]" />
                      )}
                    </div>
                  )}

                  {isNotStarted && (
                    <div className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full bg-slate-100 border border-slate-300 text-slate-400">
                      {id === "PRG-022" || id === "PRG-032" ? (
                        <Clock className="h-2.5 w-2.5 stroke-[2.5]" />
                      ) : (
                        <CircleDot className="h-2.5 w-2.5 stroke-[2.5]" />
                      )}
                    </div>
                  )}

                  {/* Text Details */}
                  <div className="flex-1 min-w-0">
                    {/* Top Row: Task ID & Right Action Icon */}
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10.5px] font-semibold text-slate-500">
                        {id}
                      </span>
                      <div className="text-slate-300 group-hover:text-slate-500">
                        {id === "PRG-001" || id === "PRG-002" || id === "PRG-030" || id === "PRG-040" || id === "PRG-041" ? (
                          <Move className="h-2.5 w-2.5 text-slate-400" />
                        ) : (
                          <MoreHorizontal className="h-3 w-3 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Task Title: 14px / 600 */}
                    <div className="font-semibold text-[14px] text-slate-900 truncate leading-snug mt-0.5">
                      {task.name}
                    </div>

                    {/* Duration & Progress text */}
                    <div className="text-[12px] font-normal text-slate-400 mt-0.5">
                      {durationText}
                    </div>
                  </div>
                </div>

                {/* Bottom Full-Width Progress Track */}
                <div className="mx-3 mb-2 h-1 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. Focused Dependency Trace Bar: 36px (h-9) with subtle 1px border */}
      {selectedTaskObj && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 flex h-9 items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 shadow-sm text-[12px] animate-in fade-in-50 duration-150 max-w-[90vw] overflow-x-auto">
          {/* Predecessors */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Predecessors ({predecessorTasks.length}):
            </span>
            {predecessorTasks.length > 0 ? (
              predecessorTasks.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    selectTask(p.id);
                    openDrawer(p.id);
                  }}
                  className="flex items-center gap-1 rounded bg-slate-100 hover:bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                  title={`Predecessor: ${p.name}`}
                >
                  <span>{p.id}</span>
                </button>
              ))
            ) : (
              <span className="text-[11px] text-slate-400 italic">None (Start)</span>
            )}
          </div>

          <span className="text-slate-300 font-bold shrink-0">➔</span>

          {/* Selected Task */}
          <div className="flex items-center gap-1.5 rounded bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-blue-900 font-semibold shrink-0">
            <span className="font-mono text-[11px]">{selectedTaskObj.id}</span>
            <span className="truncate max-w-[140px]">{selectedTaskObj.name}</span>
          </div>

          <span className="text-slate-300 font-bold shrink-0">➔</span>

          {/* Successors */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Successors ({successorTasks.length}):
            </span>
            {successorTasks.length > 0 ? (
              successorTasks.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    selectTask(s.id);
                    openDrawer(s.id);
                  }}
                  className="flex items-center gap-1 rounded bg-slate-100 hover:bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:text-blue-700 transition-colors cursor-pointer"
                  title={`Successor: ${s.name}`}
                >
                  <span>{s.id}</span>
                </button>
              ))
            ) : (
              <span className="text-[11px] text-slate-400 italic">None (Finish)</span>
            )}
          </div>

          {/* Clear focus button */}
          <button
            onClick={() => selectTask("")}
            className="ml-1 text-slate-400 hover:text-slate-700 p-0.5 rounded hover:bg-slate-100 transition-colors shrink-0"
            title="Clear focus (Esc)"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* 7. Overview (Minimap) Widget: subtle 1px border and light shadow */}
      {showOverview && (
        <div className="absolute bottom-4 left-4 z-20 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm w-52 select-none">
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
            <span className="text-[11.5px] font-bold text-slate-800 tracking-tight">
              Overview
            </span>
            <button
              onClick={() => setShowOverview(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          {/* Miniature Graph Canvas */}
          <div className="relative h-24 w-full rounded-lg bg-slate-50/80 border border-slate-150 p-1.5 overflow-hidden">
            {/* Mini Nodes */}
            {/* Col 1 */}
            <div className="absolute left-2 top-4 h-2 w-4 rounded-xs bg-emerald-400" />
            <div className="absolute left-2 top-8 h-2 w-4 rounded-xs bg-emerald-400" />
            {/* Col 2 */}
            <div className="absolute left-8 top-4 h-2 w-4 rounded-xs bg-red-400" />
            <div className="absolute left-8 top-8 h-2 w-4 rounded-xs bg-blue-400" />
            <div className="absolute left-8 top-12 h-2 w-4 rounded-xs bg-blue-400" />
            {/* Col 3 */}
            <div className="absolute left-16 top-4 h-2 w-4 rounded-xs bg-emerald-400" />
            <div className="absolute left-16 top-8 h-2 w-4 rounded-xs bg-slate-300" />
            <div className="absolute left-16 top-12 h-2 w-4 rounded-xs bg-slate-300" />
            {/* Col 4 */}
            <div className="absolute left-24 top-4.5 h-2 w-4 rounded-xs bg-red-400" />
            <div className="absolute left-24 top-8.5 h-2 w-4 rounded-xs bg-slate-300" />
            <div className="absolute left-24 top-12.5 h-2 w-4 rounded-xs bg-slate-300" />
            {/* Col 5 */}
            <div className="absolute left-32 top-5.5 h-2 w-4 rounded-xs bg-slate-300" />
            <div className="absolute left-32 top-9.5 h-2 w-4 rounded-xs bg-slate-300" />

            {/* Viewport Box (Blue semi-transparent draggable frame) */}
            <div
              className="absolute border-[1.5px] border-blue-500 bg-blue-500/15 rounded-xs pointer-events-none transition-all"
              style={{
                left: `${Math.max(2, Math.min(26, 4 - panOffset.x * 0.03))}px`,
                top: `${Math.max(2, Math.min(10, 4 - panOffset.y * 0.03))}px`,
                width: `${Math.round(85 / (networkZoom / 100))}px`,
                height: `${Math.round(52 / (networkZoom / 100))}px`,
              }}
            />
          </div>
        </div>
      )}

      {/* 8. Floating Navigation Controls (Bottom Right): 32px compact controls */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        {!showOverview && (
          <button
            onClick={() => setShowOverview(true)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Show Overview
          </button>
        )}

        <div className="flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 shadow-sm text-[12px] font-medium text-slate-700">
          {/* Pan Toggle */}
          <button
            onClick={() => setPanModeActive(!panModeActive)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11.5px] transition-colors ${
              panModeActive
                ? "bg-blue-50 font-semibold text-blue-700"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            <Hand className="h-3.5 w-3.5" />
            <span>Pan</span>
          </button>

          <span className="h-3.5 w-px bg-slate-200" />

          {/* Zoom In/Out & Value */}
          <div className="flex items-center gap-1 px-1">
            <button
              onClick={handleZoomOut}
              className="h-6 w-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
              title="Zoom out"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="font-mono text-[11.5px] font-semibold text-slate-800 w-10 text-center">
              {networkZoom}%
            </span>
            <button
              onClick={handleZoomIn}
              className="h-6 w-6 rounded hover:bg-slate-100 flex items-center justify-center text-slate-600 hover:text-slate-900 transition-colors"
              title="Zoom in"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>

          <span className="h-3.5 w-px bg-slate-200" />

          {/* Fit */}
          <button
            onClick={handleResetZoom}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11.5px] text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Fit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
