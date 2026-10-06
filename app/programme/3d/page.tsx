"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Box,
  Square,
  Navigation,
  Layers,
  Crosshair,
  Hand,
  ZoomIn,
  ZoomOut,
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
  ArrowLeft,
  X,
  Search,
  Check,
  Eye,
  EyeOff,
  Building2,
  GitBranch,
  ShieldAlert,
  Flame,
  ArrowRight,
  Filter,
  CheckSquare,
} from "lucide-react";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useProgramme } from "@/lib/programme-context";
import type { ViewMode } from "@/lib/programme-types";
import {
  MODEL_ELEMENTS,
  PROJECT_PRESETS,
  SAVED_PROGRAMME_VIEWS,
  type ModelElement,
  type BuildingLevel,
  type ElementFilter,
  type ProjectModelPreset,
  type VisualizationMode,
  type DisciplineType,
  type SavedProgrammeView,
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
      <div className="flex h-full w-full items-center justify-center gap-2 bg-[#f8fafc]">
        <div className="h-4 w-4 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
        <span className="text-[12px] font-medium text-slate-500">Loading 3D BIM model…</span>
      </div>
    ),
  }
);

const STATUS_DOT: Record<string, string> = {
  "complete":    "bg-emerald-500",
  "in-progress": "bg-blue-500",
  "blocked":     "bg-red-500",
  "not-started": "bg-slate-300",
};

export default function Model3DPage() {
  const router = useRouter();
  const { state, setActiveView, selectTask, openDrawer } = useProgramme();

  // Dynamic Project selection
  const [currentProject, setCurrentProject] = useState<ProjectModelPreset>(PROJECT_PRESETS[0]);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  // Level selections
  const [selectedLevel, setSelectedLevel] = useState<BuildingLevel>("Level 2");
  const [selectedLevels, setSelectedLevels] = useState<string[]>(["Level 2"]);

  // Spatial & Discipline filtering
  const [selectedZone, setSelectedZone] = useState<string>("all");
  const [selectedDiscipline, setSelectedDiscipline] = useState<DisciplineType>("all");
  const [visMode, setVisMode] = useState<VisualizationMode>("status");
  const [showVisDropdown, setShowVisDropdown] = useState(false);
  const [showSavedViewsDropdown, setShowSavedViewsDropdown] = useState(false);

  // Left sidebar tab: "levels" vs "hierarchy"
  const [leftTab, setLeftTab] = useState<"levels" | "hierarchy">("levels");

  // Search input
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearchResults, setShowSearchResults] = useState(false);

  // 4D timeline scrubber index
  const [scrubMonthIndex, setScrubMonthIndex] = useState(5.3);

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
  const [showLegend, setShowLegend] = useState(true);

  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  // Ensure active view tab in header highlights 3D
  useEffect(() => {
    if (state.activeView !== "3d") {
      setActiveView("3d");
    }
  }, [state.activeView, setActiveView]);

  // Synchronize when project changes
  const handleSelectProject = (project: ProjectModelPreset) => {
    setCurrentProject(project);
    setShowProjectDropdown(false);
    if (project.floors && project.floors.length > 0) {
      const activeFloor = project.floors.find((f) => f.status === "in-progress") || project.floors[0];
      setSelectedLevel(activeFloor.id);
      setSelectedLevels([activeFloor.id]);
    }
    setSelectedZone("all");
    setSelectedDiscipline("all");
  };

  // Comprehensive Element ID to Real Programme Task ID mapping
  const elementToTaskIdMap: Record<string, string> = useMemo(
    () => ({
      "PRG-021": "task-columns",       // Level 2 - Columns (60% In Progress)
      "PRG-010": "task-level-1-slab",  // Level 1 - Slab (100% Complete)
      "PRG-022": "task-blocked-3",     // Level 2 - Core Wall (Blocked)
      "PRG-001": "task-earthworks",    // Ground Slab
      "PRG-002": "task-superstructure",// Ground Columns
      "PRG-011": "task-level-1",       // Level 1 Columns
      "PRG-020": "task-slab",          // Level 2 Slab
      "PRG-025": "task-columns",       // Level 2 Beams
      "PRG-026": "task-blockwork",     // Level 2 Walls
      "PRG-023": "task-facade",        // Level 2 Facade
      "PRG-030": "task-level-3",       // Level 3 Slab
      "PRG-040": "task-level-4",       // Level 4 Slab
      "PRG-050": "task-level-4",       // Roof Slab
    }),
    []
  );

  // ESC to clear selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedElement(null);
        setShowSearchResults(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Bidirectional sync: When a task is selected in timeline or drawer, highlight the 3D element
  useEffect(() => {
    if (!state.selectedTaskId) return;
    const matchingEntry = Object.entries(elementToTaskIdMap).find(
      ([, tId]) => tId === state.selectedTaskId
    );
    if (matchingEntry) {
      const elId = matchingEntry[0];
      if (selectedElement?.id !== elId) {
        const found = MODEL_ELEMENTS.find((e) => e.id === elId);
        if (found) {
          setSelectedElement(found);
          setSelectedLevel(found.level);
          setSelectedLevels((prev) => (prev.includes(found.level) ? prev : [...prev, found.level]));
        }
      }
    }
  }, [state.selectedTaskId, elementToTaskIdMap, selectedElement?.id]);

  // Handlers
  const handleLevelSelect = useCallback(
    (level: BuildingLevel) => {
      setSelectedLevel(level);
      setSelectedLevels([level]);
      const levelEls = MODEL_ELEMENTS.filter((e) => e.level === level);
      if (levelEls.length > 0) {
        const matchCol = levelEls.find((e) => e.elementType === "columns");
        const chosen = matchCol || levelEls[0];
        setSelectedElement(chosen);
        const taskId = elementToTaskIdMap[chosen.id] || "task-columns";
        selectTask(taskId);
      }
    },
    [elementToTaskIdMap, selectTask]
  );

  const toggleLevelMultiSelect = useCallback((level: string) => {
    setSelectedLevels((prev) => {
      if (prev.includes(level)) {
        if (prev.length === 1) return prev; // Keep at least one
        return prev.filter((l) => l !== level);
      } else {
        return [...prev, level];
      }
    });
    setSelectedLevel(level);
  }, []);

  const handleSelectAllLevels = useCallback(() => {
    if (currentProject.floors) {
      setSelectedLevels(currentProject.floors.map((f) => f.id));
    }
  }, [currentProject]);

  const handleElementClick = useCallback(
    (el: ModelElement) => {
      setSelectedElement(el);
      setSelectedLevel(el.level);
      if (!selectedLevels.includes(el.level)) {
        setSelectedLevels((prev) => [...prev, el.level]);
      }
      const taskId = elementToTaskIdMap[el.id] || "task-columns";
      selectTask(taskId);
      openDrawer(taskId);
    },
    [elementToTaskIdMap, selectTask, openDrawer, selectedLevels]
  );

  const handleFit = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const targetX = state.drawerOpen ? -1.0 : 0.3;
      controlsRef.current.target.set(targetX, 6.0, 0);
      controlsRef.current.object.position.set(27.0 + targetX, 23.5, 27.0);
      controlsRef.current.update();
    }
  }, [state.drawerOpen]);

  const handleReset = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.reset();
      const targetX = state.drawerOpen ? -1.0 : 0.3;
      controlsRef.current.target.set(targetX, 6.0, 0);
      controlsRef.current.object.position.set(27.0 + targetX, 23.5, 27.0);
      controlsRef.current.update();
    }
    setViewMode("3d");
    setDragMode("orbit");
    setSectionMode(false);
    setSelectedLevel("Level 2");
    setSelectedLevels(["Level 2"]);
    setSelectedZone("all");
    setSelectedDiscipline("all");
    setVisMode("status");
    setSelectedElement(defaultColElement);
  }, [defaultColElement, state.drawerOpen]);

  const handleZoomIn = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.multiplyScalar(0.85);
      controlsRef.current.update();
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      controlsRef.current.object.position.multiplyScalar(1.18);
      controlsRef.current.update();
    }
  }, []);

  const handleSnapshot = useCallback(() => {
    const canvas = document.querySelector("canvas");
    if (canvas) {
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `PlanD-X-3D-${selectedLevel}.png`;
      a.click();
    }
  }, [selectedLevel]);

  // Apply Saved Programme View
  const handleApplySavedView = (sv: SavedProgrammeView) => {
    setSelectedLevel(sv.level);
    setSelectedLevels([sv.level]);
    setVisMode(sv.visMode);
    if (sv.zone) setSelectedZone(sv.zone);
    if (sv.discipline) setSelectedDiscipline(sv.discipline);
    if (sv.sectionMode !== undefined) setSectionMode(sv.sectionMode);
    setShowSavedViewsDropdown(false);
  };

  // Search Results Filter
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return MODEL_ELEMENTS.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.wbs.toLowerCase().includes(q) ||
        e.level.toLowerCase().includes(q) ||
        e.trade.toLowerCase().includes(q) ||
        (e.zone && e.zone.toLowerCase().includes(q))
    ).slice(0, 8);
  }, [searchQuery]);

  const handleSelectSearchResult = (el: ModelElement) => {
    handleElementClick(el);
    setSearchQuery("");
    setShowSearchResults(false);
  };

  // Predecessor and Successor for Dependency Navigation (Requirement 13)
  const dependencyPredecessor = useMemo(() => {
    if (!selectedElement) return null;
    if (selectedElement.predecessors && selectedElement.predecessors.length > 0) {
      return MODEL_ELEMENTS.find((e) => e.id === selectedElement.predecessors[0]);
    }
    // Fallback: previous level slab
    if (selectedElement.level === "Level 2") {
      return MODEL_ELEMENTS.find((e) => e.id === "PRG-010"); // Level 1 Slab
    }
    return null;
  }, [selectedElement]);

  const dependencySuccessor = useMemo(() => {
    if (!selectedElement) return null;
    // Next activity in chain
    if (selectedElement.id === "PRG-021") {
      return MODEL_ELEMENTS.find((e) => e.id === "PRG-020"); // Level 2 Slab
    }
    if (selectedElement.id === "PRG-020") {
      return MODEL_ELEMENTS.find((e) => e.id === "PRG-030"); // Level 3 Slab
    }
    return null;
  }, [selectedElement]);

  // Selected floor config from dynamic project
  const selectedFloorConfig = useMemo(() => {
    return currentProject.floors?.find((f) => f.id === selectedLevel) || currentProject.floors?.[0];
  }, [currentProject, selectedLevel]);

  return (
    <div className="relative flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans antialiased select-none">
      {/* Optional Dashboard Sidebar */}
      {dashboardMode && <AppSidebar />}

      {/* Main 3D Viewport Column */}
      <div className="relative flex flex-1 flex-col h-full w-full overflow-hidden min-w-0">

        {/* ─── TOP HEADER ─── */}
        <header className="flex h-11 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 z-30">
          {/* Left: Back + Project Switcher Dropdown */}
          <div className="flex items-center gap-3">
            <Link
              href="/programme"
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition-colors text-[12px] font-medium"
            >
              <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
              <div className="relative h-5 w-5 rounded-md overflow-hidden shrink-0 shadow-xs">
                <Image
                  src="/logo.png"
                  alt="PlanD-X"
                  width={20}
                  height={20}
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="font-semibold text-slate-800">PlanD-X</span>
              <span className="text-slate-300 font-normal">/</span>
              <span className="text-slate-500">Programme</span>
            </Link>
            <span className="text-slate-300">/</span>

            {/* Dynamic Project Selector Dropdown (Requirement 2 & 28) */}
            <div className="relative">
              <button
                onClick={() => setShowProjectDropdown((v) => !v)}
                className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-xs border border-transparent hover:border-slate-200 transition-colors"
              >
                <div className="flex h-5 w-5 items-center justify-center rounded-xs bg-blue-600 text-white font-mono font-bold text-[10px]">
                  P
                </div>
                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[13px] font-semibold text-slate-800">{currentProject.name}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-xs bg-slate-100 text-slate-600 border border-slate-200">
                      {currentProject.category}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </div>
                </div>
              </button>

              {showProjectDropdown && (
                <div className="absolute top-full left-0 mt-1 w-72 rounded-sm border border-slate-200 bg-white shadow-lg py-1 z-50">
                  <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Select Construction Project
                  </div>
                  {PROJECT_PRESETS.map((proj) => (
                    <button
                      key={proj.id}
                      onClick={() => handleSelectProject(proj)}
                      className={`flex flex-col w-full px-3 py-2 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0 ${
                        proj.id === currentProject.id ? "bg-blue-50/70" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold text-slate-900">{proj.name}</span>
                        <span className="text-[10px] text-slate-500 font-mono">{proj.floors.length} Floors</span>
                      </div>
                      <div className="text-[10.5px] text-slate-500 truncate mt-0.5">{proj.building}</div>
                      <div className="flex items-center gap-2 mt-1 text-[9.5px] text-slate-400">
                        <span>{proj.totalTasks} Tasks</span>
                        <span>·</span>
                        <span>{proj.completePercent}% Done</span>
                        {!proj.modelAvailable && (
                          <span className="text-amber-600 font-medium">No 3D Model</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1 border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors rounded-xs"
            >
              <Upload className="h-3 w-3" />
              <span>Upload</span>
            </button>
          </div>

          {/* Centre: View switcher tabs */}
          <div className="flex items-center border border-slate-200 rounded-sm overflow-hidden bg-slate-50">
            {[
              { id: "3d" as ViewMode, label: "3D", icon: Box },
              { id: "gantt" as ViewMode, label: "Gantt", icon: GanttChartSquare },
              { id: "network" as ViewMode, label: "Network", icon: Network },
              { id: "list" as ViewMode, label: "List", icon: List },
              { id: "calendar" as ViewMode, label: "Calendar", icon: Calendar },
            ].map((v) => {
              const Icon = v.icon;
              const isActive = v.id === "3d";
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setActiveView(v.id);
                    if (v.id !== "3d") {
                      router.push("/programme");
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium transition-all border-r border-slate-200 last:border-r-0 cursor-pointer ${
                    isActive
                      ? "bg-blue-600 text-white font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-white"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{v.label}</span>
                </button>
              );
            })}
          </div>

          {/* Right: Saved Views & Timeline toggle */}
          <div className="flex items-center gap-2">
            {/* Saved Views Dropdown (Requirement 27) */}
            <div className="relative">
              <button
                onClick={() => setShowSavedViewsDropdown((v) => !v)}
                className="flex items-center gap-1 border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors rounded-xs shadow-2xs"
              >
                <span>Saved Views</span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showSavedViewsDropdown && (
                <div className="absolute right-0 top-full mt-1 w-64 rounded-sm border border-slate-200 bg-white shadow-lg py-1 z-50">
                  <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Programme View Presets
                  </div>
                  {SAVED_PROGRAMME_VIEWS.map((sv) => (
                    <button
                      key={sv.id}
                      onClick={() => handleApplySavedView(sv)}
                      className="flex flex-col w-full px-3 py-1.5 text-left hover:bg-slate-50 transition-colors"
                    >
                      <span className="text-[11.5px] font-semibold text-slate-800">{sv.name}</span>
                      <span className="text-[10px] text-slate-500 leading-tight">{sv.description}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowTimeline((v) => !v)}
              className={`flex items-center gap-1 border px-2.5 py-1 text-[11px] font-medium transition-colors rounded-xs ${
                showTimeline
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span>Timeline</span>
              {showTimeline ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
            </button>

            <button
              onClick={() => setDashboardMode((v) => !v)}
              className={`flex items-center gap-1.5 border px-2.5 py-1 text-[11px] font-medium transition-colors rounded-xs ${
                dashboardMode
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>{dashboardMode ? "Exit" : "Dashboard"}</span>
            </button>
          </div>
        </header>

        {/* ─── PROGRAMME FILTER & SEARCH STRIP ─── */}
        <div className="flex h-9 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 text-[11px] z-25 gap-3">
          {/* Left: Zone & Discipline chips */}
          <div className="flex items-center gap-2 overflow-x-auto min-w-0">
            {/* Zones */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Zone:</span>
              <button
                onClick={() => setSelectedZone("all")}
                className={`px-2 py-0.5 rounded-xs font-medium text-[11px] transition-colors border ${
                  selectedZone === "all"
                    ? "bg-blue-600 text-white border-blue-600"
                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                }`}
              >
                All
              </button>
              {currentProject.zones?.map((zn) => (
                <button
                  key={zn}
                  onClick={() => setSelectedZone(zn)}
                  className={`px-2 py-0.5 rounded-xs font-medium text-[11px] transition-colors border whitespace-nowrap ${
                    selectedZone === zn
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {zn}
                </button>
              ))}
            </div>

            <div className="h-3 w-[1px] bg-slate-200 mx-1 shrink-0" />

            {/* Disciplines (Requirement 24) */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Trade:</span>
              {(["all", "Structure", "Architecture", "MEP", "Finishes"] as DisciplineType[]).map((disc) => (
                <button
                  key={disc}
                  onClick={() => setSelectedDiscipline(disc)}
                  className={`px-2 py-0.5 rounded-xs font-medium text-[11px] transition-colors border ${
                    selectedDiscipline === disc
                      ? "bg-slate-800 text-white border-slate-800"
                      : "bg-white text-slate-600 border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {disc === "all" ? "All" : disc}
                </button>
              ))}
            </div>
          </div>

          {/* Right: Visualization Mode & Programme Search */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Visualization Mode Selector (Requirement 9 & 10) */}
            <div className="relative">
              <button
                onClick={() => setShowVisDropdown((v) => !v)}
                className="flex items-center gap-1.5 border border-slate-200 bg-white px-2 py-0.5 rounded-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
              >
                <span className="text-[10px] text-slate-400 font-bold uppercase">Mode:</span>
                <span className="font-semibold text-blue-700 capitalize">
                  {visMode.replace("-", " ")}
                </span>
                <ChevronDown className="h-3 w-3 text-slate-400" />
              </button>

              {showVisDropdown && (
                <div className="absolute right-0 top-full mt-1 w-56 rounded-sm border border-slate-200 bg-white shadow-lg py-1 z-50">
                  <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Visualization Mode
                  </div>
                  {[
                    { id: "status" as VisualizationMode, label: "Programme Status", desc: "Green/Blue/Red/Slate status" },
                    { id: "schedule" as VisualizationMode, label: "Schedule Variance", desc: "Delayed / At Risk / On Time" },
                    { id: "progress" as VisualizationMode, label: "Progress Heatmap", desc: "Gradient by % complete" },
                    { id: "critical-path" as VisualizationMode, label: "Critical Path", desc: "Isolate driving activities" },
                    { id: "upcoming" as VisualizationMode, label: "Upcoming 7 Days", desc: "Immediate lookahead work" },
                    { id: "baseline" as VisualizationMode, label: "Planned vs Actual", desc: "Baseline schedule comparison" },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => {
                        setVisMode(m.id);
                        setShowVisDropdown(false);
                      }}
                      className={`flex flex-col w-full px-3 py-1.5 text-left hover:bg-slate-50 transition-colors ${
                        visMode === m.id ? "bg-blue-50/80 font-semibold" : ""
                      }`}
                    >
                      <span className="text-[11.5px] text-slate-900">{m.label}</span>
                      <span className="text-[10px] text-slate-500">{m.desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Programme Search Input (Requirement 20) */}
            <div className="relative">
              <div className="flex items-center border border-slate-200 bg-white rounded-xs px-2 py-0.5 w-60 shadow-2xs">
                <Search className="h-3 w-3 text-slate-400 mr-1.5 shrink-0" />
                <input
                  type="text"
                  placeholder="Search task, level, WBS…"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowSearchResults(true);
                  }}
                  onFocus={() => setShowSearchResults(true)}
                  className="w-full bg-transparent text-[11px] text-slate-800 placeholder-slate-400 outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-slate-400 hover:text-slate-600">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>

              {/* Search dropdown results */}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute right-0 top-full mt-1 w-72 rounded-sm border border-slate-200 bg-white shadow-lg py-1 z-50">
                  <div className="px-3 py-1 border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Programme Results ({searchResults.length})
                  </div>
                  {searchResults.map((el) => (
                    <button
                      key={el.id}
                      onClick={() => handleSelectSearchResult(el)}
                      className="flex items-center justify-between w-full px-3 py-1.5 text-left hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-b-0"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="text-[11.5px] font-semibold text-slate-800 truncate">{el.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">
                          {el.wbs} · {el.level} {el.zone ? `· ${el.zone}` : ""}
                        </div>
                      </div>
                      <span className={`text-[9.5px] font-mono px-1 py-0.2 rounded-xs uppercase ${
                        el.status === "complete" ? "bg-emerald-50 text-emerald-700" :
                        el.status === "in-progress" ? "bg-blue-50 text-blue-700" :
                        el.status === "blocked" ? "bg-red-50 text-red-700" : "bg-slate-50 text-slate-600"
                      }`}>
                        {el.progress}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── 3D MODEL WORKSPACE ─── */}
        <div className="relative flex flex-1 overflow-hidden min-h-0">

          {/* LEFT: Level Navigator & Hierarchy Panel (Requirement 3, 4, 18, 25) */}
          <div className="flex flex-col shrink-0 w-[148px] border-r border-slate-200 bg-white z-20 select-none">
            {/* Panel Tabs: Levels vs Hierarchy */}
            <div className="flex border-b border-slate-200 bg-slate-50/50">
              <button
                onClick={() => setLeftTab("levels")}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                  leftTab === "levels"
                    ? "border-blue-600 text-blue-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Levels ({currentProject.floors?.length || 0})
              </button>
              <button
                onClick={() => setLeftTab("hierarchy")}
                className={`flex-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                  leftTab === "hierarchy"
                    ? "border-blue-600 text-blue-700 bg-white"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                Hierarchy
              </button>
            </div>

            {leftTab === "levels" ? (
              <>
                {/* Multi-select helper buttons */}
                <div className="flex items-center justify-between px-2.5 py-1 border-b border-slate-100 bg-slate-50/40 text-[9.5px]">
                  <button
                    onClick={handleSelectAllLevels}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Select All
                  </button>
                  <button
                    onClick={() => setSelectedLevels([selectedLevel])}
                    className="text-slate-500 hover:underline"
                  >
                    Isolate
                  </button>
                </div>

                {/* Levels list with multi-select checkboxes */}
                <div className="flex flex-col flex-1 py-1 overflow-y-auto">
                  {currentProject.floors?.map((lv) => {
                    const isFocus = selectedLevel === lv.id;
                    const isChecked = selectedLevels.includes(lv.id);
                    return (
                      <div
                        key={lv.id}
                        onClick={() => handleLevelSelect(lv.id)}
                        className={`flex items-start gap-1.5 px-2.5 py-1.5 text-left transition-colors border-l-2 cursor-pointer ${
                          isFocus
                            ? "bg-blue-50/90 border-blue-600 text-blue-900"
                            : "border-transparent hover:bg-slate-50 text-slate-600"
                        }`}
                      >
                        {/* Multi-select checkbox */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            e.stopPropagation();
                            toggleLevelMultiSelect(lv.id);
                          }}
                          className="h-3.5 w-3.5 mt-0.5 rounded border-slate-300 text-blue-600 cursor-pointer"
                        />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] truncate leading-tight ${isFocus ? "font-semibold text-blue-800" : "font-medium"}`}>
                              {lv.name}
                            </span>
                            <span className="text-[9.5px] font-mono text-slate-500 font-medium ml-1">
                              {lv.progress}%
                            </span>
                          </div>

                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className={`w-1.5 h-1.5 rounded-[1.5px] shrink-0 ${STATUS_DOT[lv.status] || "bg-slate-300"}`}
                            />
                            <span className="text-[9px] text-slate-400 capitalize">
                              {lv.status === "in-progress" ? "Active" : lv.status}
                            </span>
                            {lv.delayedCount > 0 && (
                              <span className="text-[8.5px] font-bold text-red-600 bg-red-50 px-1 py-0.2 rounded-xs ml-auto">
                                ⚠ {lv.delayedCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Level status summary card (Requirement 25) */}
                {selectedFloorConfig && (
                  <div className="border-t border-slate-100 p-2.5 bg-slate-50/70">
                    <div className="text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">Floor Summary</div>
                    <div className="text-[11.5px] font-semibold text-slate-800 leading-tight">
                      {selectedFloorConfig.name}
                    </div>
                    <div className="text-[10px] text-blue-600 font-mono font-medium mt-0.5">
                      {selectedFloorConfig.progress}% Progress
                    </div>

                    {/* Breakdown by Trade */}
                    {selectedFloorConfig.tradeBreakdown && (
                      <div className="mt-1.5 space-y-0.5 border-t border-slate-200/60 pt-1 text-[9px] text-slate-600">
                        <div className="flex justify-between">
                          <span>Structure:</span>
                          <span className="font-mono font-medium">{selectedFloorConfig.tradeBreakdown.structure}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Architecture:</span>
                          <span className="font-mono font-medium">{selectedFloorConfig.tradeBreakdown.architecture}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>MEP:</span>
                          <span className="font-mono font-medium">{selectedFloorConfig.tradeBreakdown.mep}%</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-1.5 pt-1 border-t border-slate-200/60 flex items-center justify-between text-[9px] text-slate-500 font-mono">
                      <span>{selectedFloorConfig.tasksCount} Tasks</span>
                      <span className="text-red-600 font-semibold">{selectedFloorConfig.criticalCount} Critical</span>
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* WBS Programme Hierarchy Tree (Requirement 3) */
              <div className="flex flex-col flex-1 p-2 overflow-y-auto text-[10.5px]">
                <div className="font-semibold text-slate-900 flex items-center gap-1 mb-1">
                  <Building2 className="h-3 w-3 text-blue-600" />
                  <span className="truncate">{currentProject.name}</span>
                </div>
                <div className="pl-2 border-l border-slate-200 space-y-1 mt-1 text-slate-600">
                  <div className="text-[10px] font-medium text-slate-500">
                    {currentProject.building}
                  </div>
                  {currentProject.floors?.map((fl) => (
                    <div key={fl.id} className="pl-2 border-l border-slate-100 py-0.5">
                      <button
                        onClick={() => handleLevelSelect(fl.id)}
                        className={`text-left truncate hover:text-blue-600 transition-colors w-full ${
                          selectedLevel === fl.id ? "font-bold text-blue-700" : ""
                        }`}
                      >
                        {fl.name}
                      </button>
                      {selectedLevel === fl.id && (
                        <div className="pl-2 mt-0.5 space-y-0.5 text-[9.5px] text-slate-400">
                          {fl.zones.map((zn) => (
                            <button
                              key={zn}
                              onClick={() => setSelectedZone(zn)}
                              className={`block hover:text-slate-800 ${selectedZone === zn ? "text-blue-600 font-medium" : ""}`}
                            >
                              ↳ {zn}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3D Canvas Area */}
          <div className="relative flex-1 h-full w-full overflow-hidden bg-[#f8fafc]">
            <BuildingCanvas
              currentProject={currentProject}
              selectedLevel={selectedLevel}
              selectedLevels={selectedLevels}
              selectedZone={selectedZone}
              selectedDiscipline={selectedDiscipline}
              visMode={visMode}
              scrubDate={scrubMonthIndex}
              selectedElementId={selectedElement?.id ?? null}
              elementFilter={elementFilter}
              viewMode={viewMode}
              dragMode={dragMode}
              sectionMode={sectionMode}
              showCallouts={showCallouts}
              isDrawerOpen={state.drawerOpen}
              onElementClick={handleElementClick}
              controlsRef={controlsRef}
            />

            {/* ─── TOP-LEFT: Consolidated BIM Programme HUD ─── */}
            <div className="absolute top-3 left-3 z-20 pointer-events-none">
              {selectedElement ? (
                <div className="flex flex-col border border-slate-200/90 bg-white/95 backdrop-blur-md px-3 py-2 rounded-sm shadow-sm max-w-[340px] pointer-events-auto">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={`w-2 h-2 rounded-[2px] shrink-0 ${
                        selectedElement.status === "complete" ? "bg-emerald-500" :
                        selectedElement.status === "in-progress" ? "bg-blue-600" :
                        selectedElement.status === "blocked" ? "bg-red-500" : "bg-slate-300"
                      }`} />
                      <span className="text-[12px] font-semibold text-slate-900 truncate">
                        {selectedElement.name}
                      </span>
                      {selectedElement.isCritical && (
                        <span className="text-[9px] font-semibold text-red-600 bg-red-50 border border-red-200/60 px-1 py-0.2 rounded-xs uppercase tracking-wider shrink-0">
                          Critical
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setSelectedElement(null)}
                      className="text-slate-400 hover:text-slate-700 shrink-0 p-0.5 rounded-xs hover:bg-slate-100 transition-colors"
                      title="Clear selection (Esc)"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Progress & Duration Context */}
                  <div className="flex items-center justify-between gap-2 mt-1.5 text-[10.5px]">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="font-mono font-medium text-blue-600">{selectedElement.progress ?? 0}% Complete</span>
                      <span className="text-slate-300">·</span>
                      <span className="text-slate-500">20 Dec 2025 → 16 Jan 2026</span>
                    </div>
                    {!state.drawerOpen && (
                      <button
                        onClick={() => {
                          const taskId = elementToTaskIdMap[selectedElement.id] || "task-columns";
                          selectTask(taskId);
                          openDrawer(taskId);
                        }}
                        className="text-[10px] font-medium text-blue-600 hover:underline shrink-0"
                      >
                        Inspect →
                      </button>
                    )}
                  </div>

                  {/* Connected Workflow Dependencies (Requirement 5) */}
                  <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[10px]">
                    <span className="text-slate-400 font-semibold uppercase text-[8.5px] tracking-wider shrink-0">Flow:</span>
                    {dependencyPredecessor ? (
                      <button
                        onClick={() => handleElementClick(dependencyPredecessor)}
                        className="text-slate-600 hover:text-blue-600 truncate max-w-[85px] font-medium"
                        title={`Predecessor: ${dependencyPredecessor.name}`}
                      >
                        {dependencyPredecessor.name}
                      </button>
                    ) : (
                      <span className="text-slate-400 italic">Start</span>
                    )}
                    <span className="text-slate-300">→</span>
                    <span className="text-blue-700 font-semibold truncate max-w-[95px]">{selectedElement.name}</span>
                    <span className="text-slate-300">→</span>
                    {dependencySuccessor ? (
                      <button
                        onClick={() => handleElementClick(dependencySuccessor)}
                        className="text-slate-600 hover:text-blue-600 truncate max-w-[85px] font-medium"
                        title={`Successor: ${dependencySuccessor.name}`}
                      >
                        {dependencySuccessor.name}
                      </button>
                    ) : (
                      <span className="text-slate-400 italic">End</span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 border border-slate-200/90 bg-white/95 backdrop-blur-md px-2.5 py-1.5 rounded-sm shadow-xs pointer-events-auto text-[11px] font-medium text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-[1.5px] bg-blue-600 shrink-0" />
                  <span className="font-semibold text-slate-900">{selectedLevel}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{selectedFloorConfig?.status} ({selectedFloorConfig?.progress}%)</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{selectedFloorConfig?.tasksCount} Tasks</span>
                </div>
              )}
            </div>

            {/* ─── TOP-RIGHT: View Mode Controls (3D / 2D / Top / Section) ─── */}
            <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
              <div className="flex flex-col border border-slate-200 rounded-sm bg-white shadow-sm overflow-hidden">
                {[
                  { id: "3d" as const, label: "3D", icon: Box, onClick: () => { setViewMode("3d"); setSectionMode(false); }, active: viewMode === "3d" && !sectionMode },
                  { id: "2d" as const, label: "2D", icon: Square, onClick: () => { setViewMode("2d"); setSectionMode(false); }, active: viewMode === "2d" },
                  { id: "top" as const, label: "Top", icon: Navigation, onClick: () => { setViewMode("top"); setSectionMode(false); }, active: viewMode === "top" },
                  { id: "sec" as const, label: "Sec.", icon: Layers, onClick: () => setSectionMode((s) => !s), active: sectionMode },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={btn.onClick}
                    title={btn.label}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium transition-colors border-b border-slate-100 last:border-b-0 ${
                      btn.active
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                    <span>{btn.label}</span>
                  </button>
                ))}
              </div>

              {sectionMode && (
                <div className="rounded-xs border border-blue-200 bg-blue-50 px-2 py-0.5 text-[9.5px] font-semibold text-blue-700 font-mono shadow-xs">
                  Section Cut: {selectedLevel}
                </div>
              )}
            </div>

            {/* ─── BOTTOM-CENTRE: Integrated Camera / Navigation Toolbar ─── */}
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 pointer-events-none">
              <div className="flex items-center border border-slate-200 bg-white rounded-sm shadow-sm overflow-hidden pointer-events-auto">
                {[
                  { label: "Orbit", icon: Crosshair, active: dragMode === "orbit", onClick: () => setDragMode("orbit"), title: "Orbit (Left drag)" },
                  { label: "Pan", icon: Hand, active: dragMode === "pan", onClick: () => setDragMode("pan"), title: "Pan (Left drag)" },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    title={btn.title}
                    className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium transition-colors border-r border-slate-100 ${
                      btn.active
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                    <span>{btn.label}</span>
                  </button>
                ))}

                <button
                  onClick={handleZoomIn}
                  title="Zoom In"
                  className="flex items-center justify-center px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out"
                  className="flex items-center justify-center px-2 py-1 text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleFit}
                  title="Fit Building to View"
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Fit</span>
                </button>
                <button
                  onClick={handleReset}
                  title="Reset Camera View"
                  className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 border-r border-slate-100 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={handleSnapshot}
                  title="Capture 3D Snapshot"
                  className="flex items-center justify-center px-2 py-1 text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Minimal Keyboard / Interaction Helper */}
              <div className="text-[9.5px] text-slate-400 font-mono">
                Esc to deselect · Double-click element to focus
              </div>
            </div>

            {/* ─── BOTTOM-LEFT: Minimal Collapsible Legend ─── */}
            {showLegend ? (
              <div className="absolute bottom-3 left-3 z-20 border border-slate-200 bg-white/95 px-2.5 py-1.5 rounded-xs shadow-xs">
                <div className="flex items-center justify-between gap-3 mb-1">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                    {visMode === "schedule" ? "Schedule" : visMode === "progress" ? "Progress" : "Status"}
                  </span>
                  <button
                    onClick={() => setShowLegend(false)}
                    className="text-[9px] text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    hide
                  </button>
                </div>
                <div className="space-y-0.5">
                  {visMode === "schedule" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-emerald-500 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">On Time</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-amber-500 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">At Risk (-1 to -2d)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-red-500 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">Delayed ({">"}2d)</span>
                      </div>
                    </>
                  ) : visMode === "progress" ? (
                    <>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-emerald-500 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">100% Complete</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-blue-600 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">50% - 99%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-blue-400 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">1% - 49%</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-[1px] bg-slate-300 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">0% Not Started</span>
                      </div>
                    </>
                  ) : (
                    <>
                      {[
                        { color: "bg-emerald-500", label: "Completed" },
                        { color: "bg-blue-500",    label: "In Progress" },
                        { color: "bg-red-500",     label: "Blocked" },
                        { color: "bg-slate-300",   label: "Not Started" },
                        { color: "bg-amber-500",   label: "Milestone" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-[1px] shrink-0 ${item.color}`} />
                          <span className="text-[9.5px] text-slate-600 font-medium">{item.label}</span>
                        </div>
                      ))}
                      <div className="flex items-center gap-1.5 pt-0.5 border-t border-slate-100">
                        <span className="w-2.5 h-0.5 bg-red-500 shrink-0" />
                        <span className="text-[9.5px] text-slate-600 font-medium">Critical Path</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowLegend(true)}
                className="absolute bottom-3 left-3 z-20 border border-slate-200 bg-white px-2 py-0.5 text-[9.5px] font-medium text-slate-500 hover:text-slate-800 rounded-xs shadow-xs transition-colors"
              >
                Legend
              </button>
            )}
          </div>

          {/* ─── RIGHT TASK DRAWER ─── */}
          {state.drawerOpen && (
            <div className="relative z-30 shrink-0 border-l border-slate-200 bg-white shadow-lg animate-in slide-in-from-right-2 duration-200">
              <TaskDrawer />
            </div>
          )}
        </div>

        {/* ─── BOTTOM PROGRAMME TIMELINE ─── */}
        {showTimeline && (
          <div className="shrink-0 z-30 border-t border-slate-200 shadow-xs">
            <ModelTimeline
              selectedElement={selectedElement}
              selectedLevel={selectedLevel}
              onSelectLevel={handleLevelSelect}
              onSelectElement={handleElementClick}
              scrubMonthIndex={scrubMonthIndex}
              onScrubMonth={setScrubMonthIndex}
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
              handleSelectProject(project);
            }
            setShowUploadModal(false);
          }}
        />
      )}
    </div>
  );
}
