"use client";

import React, { useState, useCallback, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Box,
  Square,
  Navigation,
  Layers,
  Crosshair,
  Hand,
  Search,
  Maximize2,
  RotateCcw,
  Camera,
  LayoutDashboard,
  Upload,
  Calendar,
  GanttChartSquare,
  Network,
  List,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useProgramme } from "@/lib/programme-context";
import type { ViewMode } from "@/lib/programme-types";
import {
  MODEL_ELEMENTS,
  PROJECT_PRESETS,
  type ModelElement,
  type BuildingLevel,
  type ElementFilter,
  type ProjectModelPreset,
} from "@/components/programme/model3d/model-data";
import { ModelTimeline } from "@/components/programme/model3d/model-timeline";
import { UploadModelModal } from "@/components/programme/model3d/upload-modal";
import { TaskDrawer } from "@/components/programme/task-drawer";
import { AppSidebar } from "@/components/programme/app-sidebar";

// Dynamically import the Three.js 3D canvas (SSR disabled)
const BuildingCanvas = dynamic(
  () => import("@/components/programme/model3d/building-canvas").then((m) => m.BuildingCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center gap-3 bg-[#f1f5f9]">
        <div className="h-6 w-6 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span className="text-[12.5px] font-medium text-slate-500">Loading 3D construction model...</span>
      </div>
    ),
  }
);

export default function Model3DPage() {
  const { state, setActiveView, selectTask, openDrawer } = useProgramme();

  const [currentProject, setCurrentProject] = useState<ProjectModelPreset>(PROJECT_PRESETS[0]);
  const [selectedLevel, setSelectedLevel] = useState<BuildingLevel>("Level 2");

  // Default selected element: PRG-021 / task-columns (Level 2 - Columns)
  const defaultColElement = useMemo(
    () => MODEL_ELEMENTS.find((e) => e.id === "PRG-021") || MODEL_ELEMENTS[0],
    []
  );
  const [selectedElement, setSelectedElement] = useState<ModelElement | null>(defaultColElement);

  // View modes
  const [viewMode, setViewMode] = useState<"3d" | "2d" | "top">("3d");
  const [dragMode, setDragMode] = useState<"pan" | "orbit">("orbit");
  const [sectionMode, setSectionMode] = useState(false);
  const [elementFilter, setElementFilter] = useState<ElementFilter>("all");
  const [showCallouts, setShowCallouts] = useState(true);

  // Integrated Timeline & Upload Modal toggles
  const [showTimeline, setShowTimeline] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [dashboardMode, setDashboardMode] = useState(false);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Element ID to Real Programme Task ID mapping
  const elementToTaskIdMap: Record<string, string> = useMemo(
    () => ({
      "PRG-021": "task-columns",       // Level 2 - Columns (60% In Progress)
      "PRG-010": "task-level-1-slab",  // Level 1 - Slab (100% Complete)
      "PRG-022": "task-blocked-3",     // Level 2 - Core Wall (Blocked)
    }),
    []
  );

  // Handlers
  const handleLevelSelect = useCallback((level: BuildingLevel) => {
    setSelectedLevel(level);
    const levelEls = MODEL_ELEMENTS.filter((e) => e.level === level);
    if (levelEls.length > 0) {
      const matchCol = levelEls.find((e) => e.elementType === "columns");
      const chosen = matchCol || levelEls[0];
      setSelectedElement(chosen);
      const taskId = elementToTaskIdMap[chosen.id] || "task-columns";
      selectTask(taskId);
    }
  }, [elementToTaskIdMap, selectTask]);

  const handleElementClick = useCallback((el: ModelElement) => {
    setSelectedElement(el);
    setSelectedLevel(el.level);
    const taskId = elementToTaskIdMap[el.id] || "task-columns";
    selectTask(taskId);
    openDrawer(taskId);
  }, [elementToTaskIdMap, selectTask, openDrawer]);

  const handleFit = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0.3, 6.0, 0);
      controlsRef.current.object.position.set(27.5, 24.0, 27.5);
      controlsRef.current.update();
    }
  }, []);

  const handleReset = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.target.set(0.3, 6.0, 0);
      controlsRef.current.object.position.set(27.5, 24.0, 27.5);
      controlsRef.current.update();
    }
    setViewMode("3d");
    setDragMode("orbit");
    setSectionMode(false);
    setSelectedLevel("Level 2");
    setSelectedElement(defaultColElement);
  }, [defaultColElement]);

  const handleZoom = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.multiplyScalar(0.85);
      controlsRef.current.update();
    }
  }, []);

  const handleSnapshot = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `PlanD-X-3D-Programme-${selectedLevel}.png`;
      a.click();
    }
  }, [selectedLevel]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#f1f5f9] text-slate-900 font-sans antialiased select-none">
      {/* Optional Dashboard Sidebar */}
      {dashboardMode && <AppSidebar />}

      {/* Main 3D Viewport Column */}
      <div className="relative flex flex-1 flex-col h-full w-full overflow-hidden min-w-0">
        {/* ─── TOP APP HEADER & VIEW SWITCHER (NUR-180 Integration) ─── */}
        <header className="flex h-12 w-full shrink-0 items-center justify-between border-b border-slate-200/90 bg-white/95 px-4 backdrop-blur-md z-30 select-none">
          {/* Project Title & Preset Selector */}
          <div className="flex items-center gap-3">
            <Link
              href="/programme"
              className="flex items-center gap-2 rounded-lg py-1 px-1.5 hover:bg-slate-50 transition-colors"
            >
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-600 text-white font-bold text-[11px] shadow-2xs">
                P
              </div>
              <div className="flex flex-col">
                <span className="text-[12.5px] font-bold text-slate-900 leading-none">
                  {currentProject.name}
                </span>
                <span className="text-[10px] text-slate-500 font-medium leading-none mt-0.5">
                  {currentProject.building}
                </span>
              </div>
            </Link>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <Upload className="h-3.5 w-3.5 text-slate-500" />
              <span>Upload Model</span>
            </button>
          </div>

          {/* Central NUR-180 View Switcher Tabs: 3D / Gantt / Network / List / Calendar */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
            {[
              { id: "3d" as ViewMode, label: "3D", icon: Box },
              { id: "gantt" as ViewMode, label: "Gantt", icon: GanttChartSquare },
              { id: "network" as ViewMode, label: "Network", icon: Network },
              { id: "list" as ViewMode, label: "List", icon: List },
              { id: "calendar" as ViewMode, label: "Calendar", icon: Calendar },
            ].map((v) => {
              const Icon = v.icon;
              const isActive = state.activeView === v.id;
              return (
                <button
                  key={v.id}
                  onClick={() => setActiveView(v.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-all ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold shadow-xs"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right Action: Dashboard Mode Toggle & Timeline Toggle */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowTimeline((v) => !v)}
              className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors shadow-2xs ${
                showTimeline
                  ? "border-blue-400 bg-blue-50 text-blue-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>Timeline</span>
              {showTimeline ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>

            <button
              onClick={() => setDashboardMode((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors shadow-2xs ${
                dashboardMode
                  ? "border-blue-500 bg-blue-50 text-blue-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>{dashboardMode ? "Exit Dashboard" : "Dashboard Mode"}</span>
            </button>
          </div>
        </header>

        {/* ─── 3D MODEL WORKSPACE WITH FLOATING CONTROLS ─── */}
        <div className="relative flex flex-1 overflow-hidden min-h-0 bg-[#f1f5f9]">
          {/* Canvas Component */}
          <div className="relative flex-1 h-full w-full overflow-hidden">
            <BuildingCanvas
              selectedLevel={selectedLevel}
              selectedElementId={selectedElement?.id ?? null}
              elementFilter={elementFilter}
              viewMode={viewMode}
              dragMode={dragMode}
              sectionMode={sectionMode}
              showCallouts={showCallouts}
              onElementClick={handleElementClick}
              controlsRef={controlsRef}
            />

            {/* ─── RIGHT CONTROL: Vertical Floating Stack (Matching Reference) ─── */}
            <div className="absolute top-5 right-5 z-25 flex flex-col gap-1 rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-lg backdrop-blur-md w-[76px] select-none">
              <button
                onClick={() => {
                  setViewMode("3d");
                  setSectionMode(false);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-bold transition-all ${
                  viewMode === "3d" && !sectionMode
                    ? "bg-[#0066ff] text-white shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Box className="h-4 w-4" />
                <span>3D</span>
              </button>

              <button
                onClick={() => {
                  setViewMode("2d");
                  setSectionMode(false);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-medium transition-all ${
                  viewMode === "2d"
                    ? "bg-[#0066ff] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Square className="h-4 w-4" />
                <span>2D</span>
              </button>

              <button
                onClick={() => {
                  setViewMode("top");
                  setSectionMode(false);
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-medium transition-all ${
                  viewMode === "top"
                    ? "bg-[#0066ff] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Navigation className="h-4 w-4" />
                <span>Top</span>
              </button>

              <button
                onClick={() => setSectionMode((s) => !s)}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 px-2 text-[12px] font-medium transition-all ${
                  sectionMode
                    ? "bg-[#0066ff] text-white font-bold shadow-xs"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Layers className="h-4 w-4" />
                <span>Section</span>
              </button>

              <div className="h-px bg-slate-150 my-0.5 mx-1" />

              <button
                onClick={handleReset}
                title="Reset Perspective Orientation"
                className="flex items-center justify-center rounded-xl py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Box className="h-4 w-4 text-slate-700" />
              </button>
            </div>

            {/* ─── BOTTOM MODEL CONTROLS: Floating Horizontal Toolbar (Matching Reference) ─── */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 z-25 flex items-center gap-1.5 rounded-2xl border border-slate-200/90 bg-white/98 p-1.5 shadow-xl backdrop-blur-md select-none transition-all ${
                showTimeline ? "bottom-18" : "bottom-18"
              }`}
            >
              <button
                onClick={() => setDragMode("orbit")}
                className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold transition-all ${
                  dragMode === "orbit"
                    ? "bg-[#0066ff] text-white shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Crosshair className="h-4 w-4" />
                <span>Orbit</span>
              </button>

              <button
                onClick={() => setDragMode("pan")}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium transition-all ${
                  dragMode === "pan"
                    ? "bg-[#0066ff] text-white font-semibold shadow-xs"
                    : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                <Hand className="h-4 w-4" />
                <span>Pan</span>
              </button>

              <button
                onClick={handleZoom}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Search className="h-4 w-4" />
                <span>Zoom</span>
              </button>

              <button
                onClick={handleFit}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Maximize2 className="h-4 w-4" />
                <span>Fit</span>
              </button>

              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded-xl px-3 py-2 text-[12px] font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Reset</span>
              </button>

              <button
                onClick={handleSnapshot}
                title="Capture High-Res 3D Model Snapshot"
                className="flex items-center justify-center rounded-xl p-2 text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            {/* ─── BOTTOM LEGEND: Floating Semantic Indicator Pill (Matching Reference) ─── */}
            <div
              className={`absolute left-1/2 -translate-x-1/2 z-25 flex items-center gap-5 rounded-full border border-slate-200/90 bg-white/98 px-6 py-2 text-[12px] font-medium text-slate-700 shadow-md backdrop-blur-md select-none transition-all ${
                showTimeline ? "bottom-5" : "bottom-5"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#10b981]" />
                <span>Completed</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#0066ff]" />
                <span>In Progress</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" />
                <span>Blocked</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#94a3b8]" />
                <span>Not Started</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-[2px] rounded-full bg-[#ef4444]" />
                <span>Critical Path</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rotate-45 bg-[#f59e0b] rounded-xs shrink-0" />
                <span>Milestone</span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT TASK DRAWER (Connected to real Programme Data) ─── */}
          {state.drawerOpen && (
            <div className="relative z-30 shrink-0 border-l border-slate-200 bg-white shadow-xl animate-in slide-in-from-right-4 duration-200">
              <TaskDrawer />
            </div>
          )}
        </div>

        {/* ─── BOTTOM PROGRAMME TIMELINE (Work Packages & Today Line) ─── */}
        {showTimeline && (
          <div className="shrink-0 z-30 shadow-md">
            <ModelTimeline
              selectedElement={selectedElement}
              selectedLevel={selectedLevel}
              onSelectLevel={handleLevelSelect}
              onSelectElement={handleElementClick}
            />
          </div>
        )}
      </div>

      {/* Upload Model Modal */}
      {showUploadModal && (
        <UploadModelModal
          onClose={() => setShowUploadModal(false)}
          onUseModel={(project) => {
            if (project) {
              setCurrentProject(project);
            }
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}
