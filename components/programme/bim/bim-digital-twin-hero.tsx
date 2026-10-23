"use client";

import React, { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import {
  Layers,
  Box,
  ChevronDown,
  Check,
  Activity,
  Maximize2,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  MODEL_ELEMENTS,
  PROJECT_PRESETS,
  ELEMENT_TO_TASK_MAP,
  TASK_TO_ELEMENT_MAP,
  LEVEL_TO_TASK_MAP,
  type ModelElement,
} from "@/components/programme/model3d/model-data";

// Dynamically import the real Three.js 3D canvas (SSR disabled)
const BuildingCanvas = dynamic(
  () => import("@/components/programme/model3d/building-canvas").then((m) => m.BuildingCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center gap-2 bg-[#f8fafc]">
        <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span className="text-[12px] font-medium text-slate-500">Loading 3D BIM model…</span>
      </div>
    ),
  }
);

export type BimLevel = "Roof" | "Level 4" | "Level 3" | "Level 2" | "Level 1" | "Ground";

interface LevelConfig {
  id: BimLevel;
  label: string;
  taskName: string;
  status: string;
  daysLeft: string;
  dateRange: string;
  progress: number;
  inspectionStatus: string;
  concreteStrength: string;
  slumpTest: string;
}

const LEVEL_CONFIGS: Record<BimLevel, LevelConfig> = {
  Roof: {
    id: "Roof",
    label: "Roof",
    taskName: "Roof Plant Room & Waterproofing",
    status: "Not Started",
    daysLeft: "Starts 24 Feb 2026",
    dateRange: "24 Feb 2026 – 30 Mar 2026",
    progress: 0,
    inspectionStatus: "Design Complete",
    concreteStrength: "Pending Pour",
    slumpTest: "Spec 120mm",
  },
  "Level 4": {
    id: "Level 4",
    label: "Level 4",
    taskName: "Level 4 - Slabs & Columns",
    status: "Scheduled",
    daysLeft: "Starts 20 Jan 2026",
    dateRange: "20 Jan 2026 – 20 Feb 2026",
    progress: 0,
    inspectionStatus: "Rebar Inspection Scheduled",
    concreteStrength: "Design 40 MPa",
    slumpTest: "Spec 110mm",
  },
  "Level 3": {
    id: "Level 3",
    label: "Level 3",
    taskName: "Level 3 - Decking & Formwork",
    status: "Upcoming",
    daysLeft: "Starts 01 Jan 2026",
    dateRange: "01 Jan 2026 – 20 Jan 2026",
    progress: 15,
    inspectionStatus: "Formwork Check Passed",
    concreteStrength: "C35/45 Ready",
    slumpTest: "Spec 110mm",
  },
  "Level 2": {
    id: "Level 2",
    label: "Level 2",
    taskName: "Level 2 - Columns",
    status: "In Progress",
    daysLeft: "12 days left",
    dateRange: "20 Dec 2025 – 16 Jan 2026",
    progress: 60,
    inspectionStatus: "#17 Slump Check Approved",
    concreteStrength: "38.5 MPa (Target 40)",
    slumpTest: "115mm (Normal)",
  },
  "Level 1": {
    id: "Level 1",
    label: "Level 1",
    taskName: "Level 1 - Slab Complete",
    status: "Complete",
    daysLeft: "Completed 18 Dec",
    dateRange: "11 Oct 2025 – 18 Dec 2025",
    progress: 100,
    inspectionStatus: "QA Signoff Complete",
    concreteStrength: "42.1 MPa (Exceeded)",
    slumpTest: "Passed",
  },
  Ground: {
    id: "Ground",
    label: "Ground",
    taskName: "Ground Slab & Foundations",
    status: "Complete",
    daysLeft: "Completed 10 Oct",
    dateRange: "01 Sep 2025 – 10 Oct 2025",
    progress: 100,
    inspectionStatus: "Foundation Certified",
    concreteStrength: "45.0 MPa",
    slumpTest: "Passed",
  },
};

const LEVELS_ORDER: BimLevel[] = [
  "Roof",
  "Level 4",
  "Level 3",
  "Level 2",
  "Level 1",
  "Ground",
];

export function BimDigitalTwinHero() {
  const { state, selectTask, openDrawer, locateIn3D, importedModel, activeProjectPreset } = useProgramme();

  const [activeLevel, setActiveLevel] = useState<BimLevel>("Level 2");
  const [activeElementId, setActiveElementId] = useState<string | null>("PRG-021");
  const [wireframeMode, setWireframeMode] = useState<boolean>(false);
  const [forecastDropdownOpen, setForecastDropdownOpen] = useState(false);
  const [currentForecast, setCurrentForecast] = useState("Working Forecast");
  const [showTelemetryDetails, setShowTelemetryDetails] = useState(false);

  // Synchronize when a task is selected elsewhere in the Gantt view (timeline, WBS tree, drawer)
  useEffect(() => {
    if (!state.selectedTaskId) return;
    const mappedElId = TASK_TO_ELEMENT_MAP[state.selectedTaskId];
    if (mappedElId) {
      const el = MODEL_ELEMENTS.find((e) => e.id === mappedElId);
      if (el) {
        if (LEVELS_ORDER.includes(el.level as BimLevel)) {
          setActiveLevel(el.level as BimLevel);
        }
        setActiveElementId(mappedElId);
      }
    }
  }, [state.selectedTaskId]);

  const levelInfo = LEVEL_CONFIGS[activeLevel] || LEVEL_CONFIGS["Level 2"];

  // Look up active 3D model element if selected
  const activeElement = useMemo(
    () => (activeElementId ? MODEL_ELEMENTS.find((e) => e.id === activeElementId) : null),
    [activeElementId]
  );

  // Synchronize with real programme task if reliably associated
  const mappedTaskId = (activeElementId && ELEMENT_TO_TASK_MAP[activeElementId]) || LEVEL_TO_TASK_MAP[activeLevel] || null;
  const mappedTask = useMemo(() => {
    if (!mappedTaskId) return null;
    return state.tasks.find((t) => t.id === mappedTaskId) || null;
  }, [mappedTaskId, state.tasks]);

  const displayTaskName = mappedTask ? mappedTask.name : (activeElement ? activeElement.name : levelInfo.taskName);
  const displayStatus = mappedTask
    ? mappedTask.status === "in-progress"
      ? "In Progress"
      : mappedTask.status === "complete"
      ? "Complete"
      : mappedTask.status === "blocked"
      ? "Blocked"
      : "Not Started"
    : activeElement
    ? activeElement.status === "in-progress"
      ? "In Progress"
      : activeElement.status === "complete"
      ? "Complete"
      : activeElement.status === "blocked"
      ? "Blocked"
      : "Not Started"
    : levelInfo.status;
  const displayProgress = mappedTask ? mappedTask.progress : (activeElement ? activeElement.progress : levelInfo.progress);
  const displayDateRange = mappedTask
    ? `${mappedTask.displayStart || mappedTask.startDate} – ${mappedTask.displayEnd || mappedTask.endDate}`
    : activeElement
    ? `${activeElement.displayStart} – ${activeElement.displayEnd}`
    : levelInfo.dateRange;

  const handleSelectLevel = (lvl: BimLevel) => {
    setActiveLevel(lvl);
    const mappedTask = LEVEL_TO_TASK_MAP[lvl];
    if (mappedTask) {
      const elId = TASK_TO_ELEMENT_MAP[mappedTask];
      setActiveElementId(elId || null);
      selectTask(mappedTask);
    }
  };

  const handleElementClick = (el: ModelElement) => {
    if (LEVELS_ORDER.includes(el.level as BimLevel)) {
      setActiveLevel(el.level as BimLevel);
    }
    setActiveElementId(el.id);
    const mappedTaskId = ELEMENT_TO_TASK_MAP[el.id];
    if (mappedTaskId) {
      selectTask(mappedTaskId);
    }
  };

  const handleCalloutClick = () => {
    const targetTaskId =
      (activeElementId && ELEMENT_TO_TASK_MAP[activeElementId]) ||
      LEVEL_TO_TASK_MAP[activeLevel];
    if (targetTaskId) {
      selectTask(targetTaskId);
      openDrawer(targetTaskId);
    }
  };

  const handleOpenFull3D = () => {
    const targetTaskId =
      (activeElementId && ELEMENT_TO_TASK_MAP[activeElementId]) ||
      LEVEL_TO_TASK_MAP[activeLevel] ||
      "task-columns";
    locateIn3D(targetTaskId);
  };

  return (
    <div className="relative h-[225px] w-full overflow-hidden rounded-2xl border border-slate-200/70 bg-gradient-to-br from-slate-100/70 via-white to-slate-50 shadow-2xs group select-none">
      {/* 1. Real 3D BIM Model (Interactive Three.js Canvas matching 3D Programme View) */}
      <div
        className="absolute inset-0 overflow-hidden cursor-grab active:cursor-grabbing"
        onDoubleClick={handleOpenFull3D}
        title="Interactive 3D building model · Drag to rotate · Double-click to open full 3D view"
      >
        <BuildingCanvas
          currentProject={activeProjectPreset || PROJECT_PRESETS[0]}
          importedModel={importedModel}
          selectedLevel={activeLevel}
          selectedElementId={activeElementId}
          compactPreview={true}
          enableZoom={false}
          wireframe={wireframeMode}
          showCallouts={false}
          onElementClick={handleElementClick}
        />
        {/* Soft edge gradients blending canvas into card boundaries */}
        <div className="absolute inset-0 bg-gradient-to-r from-white/80 via-transparent to-white/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent pointer-events-none" />
      </div>

      {/* 2. Floating Interactive BIM Callout Tooltip (Cleanly positioned on top-left) */}
      <div
        onClick={handleCalloutClick}
        className="absolute left-3 top-3 z-20 cursor-pointer transition-all duration-300 hover:scale-[1.02] max-w-[210px]"
        title={`Click to view task details in drawer (${displayTaskName})`}
      >
        <div className="flex items-start gap-2 rounded-xl border border-slate-200/70 bg-white/95 p-2 px-2.5 shadow-md backdrop-blur-md hover:border-blue-300 transition-colors">
          {/* Pulsing Status Dot */}
          <span className="relative flex h-2.5 w-2.5 mt-1 shrink-0">
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                displayStatus === "Blocked"
                  ? "bg-red-400"
                  : wireframeMode
                  ? "bg-amber-400"
                  : displayStatus === "Complete"
                  ? "bg-emerald-400"
                  : "bg-blue-400"
              }`}
            />
            <span
              className={`relative inline-flex rounded-full h-2.5 w-2.5 ${
                displayStatus === "Blocked"
                  ? "bg-red-600"
                  : wireframeMode
                  ? "bg-amber-500"
                  : displayStatus === "Complete"
                  ? "bg-emerald-500"
                  : "bg-blue-600"
              }`}
            />
          </span>

          {/* Callout Content */}
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-[13px] font-bold text-slate-900 leading-tight truncate">
                {importedModel ? importedModel.name : displayTaskName}
              </span>
              <span className={`rounded px-1.5 py-0.2 text-[9px] font-bold shrink-0 ${
                importedModel
                  ? "bg-blue-100 text-blue-800"
                  : wireframeMode
                  ? "bg-amber-100 text-amber-800"
                  : "bg-slate-100 text-slate-700"
              }`}>
                {importedModel ? importedModel.fileType.toUpperCase() : wireframeMode ? "CAD" : "BIM"}
              </span>
            </div>
            <div className="text-[11px] font-medium text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>{importedModel ? `${importedModel.meshCount} meshes` : displayStatus}</span>
              <span>·</span>
              <span className="text-blue-600 font-semibold">
                {importedModel ? `${importedModel.vertexCount.toLocaleString()} verts` : levelInfo.daysLeft}
              </span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium truncate">
              {importedModel ? importedModel.fileName : displayDateRange}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Floating Level Selector on Top Right */}
      <div className="absolute right-3 top-2.5 z-20 flex flex-col gap-1 rounded-xl border border-slate-200/70 bg-white/95 p-1 shadow-md backdrop-blur-md">
        {LEVELS_ORDER.map((lvl) => {
          const isCurrent = activeLevel === lvl;
          return (
            <button
              key={lvl}
              onClick={() => handleSelectLevel(lvl)}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isCurrent
                  ? "bg-blue-600 text-white shadow-2xs scale-[1.02]"
                  : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900"
              }`}
            >
              <Layers className={`h-3 w-3 shrink-0 ${isCurrent ? "text-white" : "text-slate-400"}`} />
              <span>{lvl}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Floating Bottom Controls: Working Forecast + Wireframe CAD Toggle + Full 3D View Button */}
      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-2">
        {/* Working Forecast Pill */}
        <div className="relative">
          <button
            onClick={() => setForecastDropdownOpen(!forecastDropdownOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/70 bg-white/95 px-2.5 py-1.5 text-[11.5px] font-semibold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-white transition-colors"
          >
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100" />
            <span>{currentForecast}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {forecastDropdownOpen && (
            <div className="absolute bottom-full right-0 mb-1.5 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-lg z-50">
              {["Working Forecast", "Baseline 0 (Contract)", "Approved Baseline 1.1"].map((f) => (
                <button
                  key={f}
                  onClick={() => {
                    setCurrentForecast(f);
                    setForecastDropdownOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-[11.5px] ${
                    currentForecast === f
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span>{f}</span>
                  {currentForecast === f && <Check className="h-3 w-3 text-blue-600" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 3D View / Wireframe CAD Toggle */}
        <button
          onClick={() => setWireframeMode(!wireframeMode)}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11.5px] font-bold shadow-2xs backdrop-blur-md transition-all ${
            wireframeMode
              ? "border-amber-400 bg-amber-500 text-white shadow-amber-200"
              : "border-slate-200/90 bg-white/95 text-slate-700 hover:bg-white hover:border-blue-300"
          }`}
          title="Toggle 3D Wireframe CAD Inspection Mode"
        >
          <Box className={`h-3.5 w-3.5 ${wireframeMode ? "animate-pulse" : ""}`} />
          <span>{wireframeMode ? "CAD Mode" : "3D View"}</span>
        </button>

        {/* Open Full 3D Model View Button */}
        <button
          onClick={handleOpenFull3D}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/90 bg-white/95 px-2.5 py-1.5 text-[11.5px] font-bold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 transition-all"
          title="Open full interactive 3D Programme view with this level and task selected"
        >
          <Maximize2 className="h-3.5 w-3.5 text-blue-600" />
          <span>Full 3D</span>
        </button>
      </div>

      {/* 5. Floating Telemetry HUD (Bottom Left) */}
      <div className="absolute bottom-2.5 left-3 z-20 flex items-center gap-2">
        <button
          onClick={() => setShowTelemetryDetails(!showTelemetryDetails)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white/90 px-2 py-1 text-[10.5px] font-semibold text-slate-600 shadow-2xs backdrop-blur-md hover:bg-white transition-colors"
        >
          <Activity className="h-3 w-3 text-blue-500" />
          <span>Grid C-E</span>
          <span className="text-slate-300">|</span>
          <span>FL: {activeLevel}</span>
          <span className="text-slate-300">|</span>
          <span className="text-emerald-600">{displayProgress}%</span>
        </button>

        {/* Mini Inspection Badge */}
        {wireframeMode && (
          <div className="flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/95 px-2 py-1 text-[10.5px] font-semibold text-amber-800 shadow-2xs">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
            <span>{levelInfo.concreteStrength}</span>
          </div>
        )}
      </div>
    </div>
  );
}
