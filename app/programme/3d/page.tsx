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
  ELEMENT_TO_TASK_MAP,
  TASK_TO_ELEMENT_MAP,
  LEVEL_TO_TASK_MAP,
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
import { BaselineRevisionsModal } from "@/components/programme/baseline/baseline-revisions-modal";

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

const COMPACT_LEVELS: { id: BuildingLevel; name: string; status: "complete" | "in-progress" | "not-started" | "blocked"; progress: number }[] = [
  { id: "Roof", name: "Roof", status: "not-started", progress: 0 },
  { id: "Level 4", name: "Level 4", status: "not-started", progress: 0 },
  { id: "Level 3", name: "Level 3", status: "not-started", progress: 0 },
  { id: "Level 2", name: "Level 2", status: "in-progress", progress: 60 },
  { id: "Level 1", name: "Level 1", status: "complete", progress: 100 },
  { id: "Ground", name: "Ground", status: "complete", progress: 100 },
];

const COMPACT_ELEMENT_FILTERS: { id: ElementFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "structure", label: "Structure" },
  { id: "columns", label: "Columns" },
  { id: "slabs", label: "Slabs" },
  { id: "walls", label: "Walls" },
  { id: "beams", label: "Beams" },
  { id: "core", label: "Core" },
];

export default function Model3DPage() {
  const router = useRouter();
  const {
    state,
    setActiveView,
    selectTask,
    openDrawer,
    importedModel,
    setImportedModel,
    activeProjectPreset,
    setActiveProjectPreset,
  } = useProgramme();

  // Dynamic Project selection
  const currentProject = activeProjectPreset || PROJECT_PRESETS[0];
  const setCurrentProject = setActiveProjectPreset;
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

  // View modes: 3D Perspective, 2D Front Elevation, Top-down Plan, and Section Cut
  const [viewMode, setViewMode] = useState<"3d" | "2d" | "top" | "section">("3d");
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

  // Shared Element ID to Real Programme Task ID mapping
  const elementToTaskIdMap = ELEMENT_TO_TASK_MAP;

  // View mode setter with section plane synchronization
  const handleSetViewMode = useCallback((mode: "3d" | "2d" | "top" | "section") => {
    setViewMode(mode);
    setSectionMode(mode === "section");
  }, []);

  // Handlers for Camera Navigation
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
      const controls = controlsRef.current;
      const camera = controls.object;
      const target = controls.target;
      const offset = camera.position.clone().sub(target);
      const minDistance = controls.minDistance || 10;
      if (offset.length() > minDistance * 1.1) {
        offset.multiplyScalar(0.82);
        camera.position.copy(target).add(offset);
        controls.update();
      }
    }
  }, []);

  const handleZoomOut = useCallback(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object;
      const target = controls.target;
      const offset = camera.position.clone().sub(target);
      const maxDistance = controls.maxDistance || 70;
      if (offset.length() < maxDistance * 0.9) {
        offset.multiplyScalar(1.22);
        camera.position.copy(target).add(offset);
        controls.update();
      }
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

  // Keyboard Navigation Shortcuts (1/3=3D, 2=2D, T=Top, S=Section, O=Orbit, P=Pan, F=Fit, R=Reset, +/-=Zoom, Esc=Deselect)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") return;

      if (e.key === "Escape") {
        setSelectedElement(null);
        setShowSearchResults(false);
      } else if (e.key === "1" || e.key === "3") {
        handleSetViewMode("3d");
      } else if (e.key === "2") {
        handleSetViewMode("2d");
      } else if (e.key === "t" || e.key === "T") {
        handleSetViewMode("top");
      } else if (e.key === "s" || e.key === "S") {
        handleSetViewMode(viewMode === "section" ? "3d" : "section");
      } else if (e.key === "o" || e.key === "O") {
        setDragMode("orbit");
      } else if (e.key === "p" || e.key === "P") {
        setDragMode("pan");
      } else if (e.key === "f" || e.key === "F") {
        handleFit();
      } else if (e.key === "r" || e.key === "R") {
        handleReset();
      } else if (e.key === "+" || e.key === "=") {
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        handleZoomOut();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleFit, handleReset, handleZoomIn, handleZoomOut, handleSetViewMode, viewMode]);

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

  // Handlers for Level & Element Selection
  const handleLevelSelect = useCallback(
    (level: BuildingLevel) => {
      setSelectedLevel(level);
      setSelectedLevels([level]);
      const targetType =
        elementFilter === "all" || elementFilter === "structure" ? "columns" : elementFilter;
      const match = MODEL_ELEMENTS.find((e) => e.level === level && e.elementType === targetType);
      const chosen = match || MODEL_ELEMENTS.find((e) => e.level === level) || null;
      if (chosen) {
        setSelectedElement(chosen);
        const taskId = elementToTaskIdMap[chosen.id];
        if (taskId) {
          selectTask(taskId);
          if (elementFilter !== "all") {
            openDrawer(taskId);
          }
        }
      } else {
        setSelectedElement(null);
        const levelTaskId = LEVEL_TO_TASK_MAP[level];
        if (levelTaskId) {
          selectTask(levelTaskId);
        }
      }
    },
    [elementFilter, elementToTaskIdMap, selectTask, openDrawer]
  );

  const handleElementFilterSelect = useCallback(
    (filter: ElementFilter) => {
      setElementFilter(filter);
      if (filter === "all") return;

      const targetType = filter === "structure" ? "columns" : filter;
      const levelMatch = MODEL_ELEMENTS.find(
        (e) => e.level === selectedLevel && e.elementType === targetType
      );
      const chosen = levelMatch || MODEL_ELEMENTS.find((e) => e.elementType === targetType);
      if (chosen) {
        setSelectedElement(chosen);
        setSelectedLevel(chosen.level);
        if (!selectedLevels.includes(chosen.level)) {
          setSelectedLevels((prev) => [...prev, chosen.level]);
        }
        const taskId = elementToTaskIdMap[chosen.id];
        if (taskId) {
          selectTask(taskId);
          openDrawer(taskId);
        }
      }
    },
    [selectedLevel, selectedLevels, elementToTaskIdMap, selectTask, openDrawer]
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
      const taskId = elementToTaskIdMap[el.id];
      if (taskId) {
        selectTask(taskId);
        openDrawer(taskId);
      }
    },
    [elementToTaskIdMap, selectTask, openDrawer, selectedLevels]
  );

  // Apply Saved Programme View
  const handleApplySavedView = (sv: SavedProgrammeView) => {
    setSelectedLevel(sv.level);
    setSelectedLevels([sv.level]);
    setVisMode(sv.visMode);
    if (sv.zone) setSelectedZone(sv.zone);
    if (sv.discipline) setSelectedDiscipline(sv.discipline);
    if (sv.sectionMode !== undefined) {
      setSectionMode(sv.sectionMode);
      if (sv.sectionMode) setViewMode("section");
    }
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

  // Real Mapped Task lookup from state.tasks (Requirement: Do not invent mappings)
  const mappedTaskId = useMemo(() => {
    if (!selectedElement) return null;
    return elementToTaskIdMap[selectedElement.id] || null;
  }, [selectedElement, elementToTaskIdMap]);

  const mappedTask = useMemo(() => {
    if (!mappedTaskId) return null;
    return state.tasks.find((t) => t.id === mappedTaskId) || null;
  }, [mappedTaskId, state.tasks]);

  // Predecessor and Successor tasks resolved from real schedule data
  const predecessorTask = useMemo(() => {
    if (!mappedTask || !mappedTask.predecessors?.length) return null;
    const pId = mappedTask.predecessors[0];
    return state.tasks.find((t) => t.id === pId) || null;
  }, [mappedTask, state.tasks]);

  const successorTask = useMemo(() => {
    if (!mappedTask || !mappedTask.successors?.length) return null;
    const sId = mappedTask.successors[0];
    return state.tasks.find((t) => t.id === sId) || null;
  }, [mappedTask, state.tasks]);

  const handleNavigatePredecessor = useCallback(() => {
    if (!predecessorTask) return;
    const mappedElId = TASK_TO_ELEMENT_MAP[predecessorTask.id];
    if (mappedElId) {
      const el = MODEL_ELEMENTS.find((e) => e.id === mappedElId);
      if (el) {
        handleElementClick(el);
        return;
      }
    }
    selectTask(predecessorTask.id);
    openDrawer(predecessorTask.id);
  }, [predecessorTask, handleElementClick, selectTask, openDrawer]);

  const handleNavigateSuccessor = useCallback(() => {
    if (!successorTask) return;
    const mappedElId = TASK_TO_ELEMENT_MAP[successorTask.id];
    if (mappedElId) {
      const el = MODEL_ELEMENTS.find((e) => e.id === mappedElId);
      if (el) {
        handleElementClick(el);
        return;
      }
    }
    selectTask(successorTask.id);
    openDrawer(successorTask.id);
  }, [successorTask, handleElementClick, selectTask, openDrawer]);

  // Selected floor config from dynamic project
  const selectedFloorConfig = useMemo(() => {
    return currentProject.floors?.find((f) => f.id === selectedLevel) || currentProject.floors?.[0];
  }, [currentProject, selectedLevel]);

  // Real Rollup for Selected Level from state.tasks
  const selectedLevelRollup = useMemo(() => {
    const lvlKey = selectedLevel.toLowerCase();
    const levelTasks = state.tasks.filter((t) => {
      const nameMatch = t.name.toLowerCase().includes(lvlKey);
      const parentMatch = t.parentId ? t.parentId.toLowerCase().includes(lvlKey.replace(" ", "-")) : false;
      const stageMatch = t.stage ? t.stage.toLowerCase().includes(lvlKey) : false;
      const mapMatch = LEVEL_TO_TASK_MAP[selectedLevel] === t.id;
      return nameMatch || parentMatch || stageMatch || mapMatch;
    });

    const total = levelTasks.length > 0 ? levelTasks.length : (selectedFloorConfig?.tasksCount ?? 0);
    const completed = levelTasks.filter((t) => t.status === "complete").length;
    const inProgress = levelTasks.filter((t) => t.status === "in-progress").length;
    const blocked = levelTasks.filter((t) => t.status === "blocked").length;
    const critical = levelTasks.filter((t) => t.isCritical).length;

    const avgProgress = levelTasks.length > 0
      ? Math.round(levelTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / levelTasks.length)
      : (selectedFloorConfig?.progress ?? 0);

    const levelStatus: "complete" | "in-progress" | "blocked" | "not-started" =
      avgProgress >= 100 ? "complete" :
      blocked > 0 ? "blocked" :
      avgProgress > 0 ? "in-progress" : "not-started";

    const levelTaskId = LEVEL_TO_TASK_MAP[selectedLevel] || (levelTasks[0]?.id ?? null);

    return {
      name: selectedLevel,
      totalTasks: total,
      completedCount: completed,
      inProgressCount: inProgress,
      blockedCount: blocked,
      criticalCount: critical > 0 ? critical : (selectedFloorConfig?.criticalCount ?? 0),
      avgProgress,
      status: levelStatus,
      mappedTaskId: levelTaskId,
    };
  }, [selectedLevel, state.tasks, selectedFloorConfig]);

  // Dynamic Level progress from state.tasks for sidebar list
  const dynamicLevels = useMemo(() => {
    return COMPACT_LEVELS.map((lv) => {
      const lvlKey = lv.id.toLowerCase();
      const levelTasks = state.tasks.filter((t) => {
        const nameMatch = t.name.toLowerCase().includes(lvlKey);
        const parentMatch = t.parentId ? t.parentId.toLowerCase().includes(lvlKey.replace(" ", "-")) : false;
        const stageMatch = t.stage ? t.stage.toLowerCase().includes(lvlKey) : false;
        const mapMatch = LEVEL_TO_TASK_MAP[lv.id] === t.id;
        return nameMatch || parentMatch || stageMatch || mapMatch;
      });

      if (levelTasks.length === 0) return lv;

      const avgProgress = Math.round(
        levelTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / levelTasks.length
      );
      const hasBlocked = levelTasks.some((t) => t.status === "blocked");
      const status: "complete" | "in-progress" | "blocked" | "not-started" =
        avgProgress >= 100 ? "complete" : hasBlocked ? "blocked" : avgProgress > 0 ? "in-progress" : "not-started";

      return {
        ...lv,
        progress: avgProgress,
        status,
      };
    });
  }, [state.tasks]);

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
              {showProjectDropdown && (
                <div
                  className="fixed inset-0 z-30"
                  onClick={() => setShowProjectDropdown(false)}
                />
              )}
              <button
                onClick={() => setShowProjectDropdown((v) => !v)}
                className="flex items-center gap-2 hover:bg-slate-50 px-2 py-1 rounded-xs border border-transparent hover:border-slate-200 transition-colors relative z-40"
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
              onClick={() => {
                setShowUploadModal(true);
                setShowProjectDropdown(false);
              }}
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

          {/* LEFT: Compact Levels Panel + Element Filters (Requirement 8) */}
          <div className="flex flex-col shrink-0 w-[160px] border-r border-slate-200 bg-white z-20 select-none overflow-y-auto">
            {/* 1. COMPACT LEVELS SECTION */}
            <div className="px-3 pt-2.5 pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Levels
              </span>
              <button
                onClick={() => setSelectedLevels(COMPACT_LEVELS.map((l) => l.id))}
                className="text-[9.5px] text-blue-600 hover:underline font-medium"
              >
                All
              </button>
            </div>

            <div className="flex flex-col py-1 border-b border-slate-100">
              {dynamicLevels.map((lv) => {
                const isSelected = selectedLevel === lv.id;
                return (
                  <button
                    key={lv.id}
                    onClick={() => handleLevelSelect(lv.id)}
                    className={`flex items-center justify-between px-3 py-1.5 text-left transition-colors border-l-2 cursor-pointer ${
                      isSelected
                        ? "bg-blue-50/90 border-blue-600 text-blue-900 font-semibold"
                        : "border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[lv.status] || "bg-slate-300"}`}
                      />
                      <span className="text-[11.5px] truncate">{lv.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400 font-medium">
                      {lv.progress}%
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 2. ELEMENT FILTERS SECTION */}
            <div className="px-3 pt-2.5 pb-1 border-b border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Elements
              </span>
              {elementFilter !== "all" && (
                <button
                  onClick={() => setElementFilter("all")}
                  className="text-[9.5px] text-slate-400 hover:text-slate-600 font-medium"
                >
                  Reset
                </button>
              )}
            </div>

            <div className="flex flex-col py-1">
              {COMPACT_ELEMENT_FILTERS.map((filter) => {
                const isActive = elementFilter === filter.id;
                return (
                  <button
                    key={filter.id}
                    onClick={() => handleElementFilterSelect(filter.id)}
                    className={`flex items-center justify-between px-3 py-1.5 text-left transition-colors border-l-2 cursor-pointer ${
                      isActive
                        ? "bg-blue-50/90 border-blue-600 text-blue-900 font-semibold"
                        : "border-transparent text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span className="text-[11.5px]">{filter.label}</span>
                    {filter.id === "columns" && selectedLevel === "Level 2" && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded-xs bg-blue-100/70 text-blue-700 font-medium">
                        60%
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Level Summary Card */}
            <div className="mt-auto border-t border-slate-200 p-2.5 bg-slate-50/80">
              <div className="flex items-center justify-between text-[9px] text-slate-400 uppercase tracking-wider mb-0.5">
                <span>Floor Summary</span>
                <span className="font-mono text-slate-500 font-medium">Elev: {selectedFloorConfig?.elevation ?? 0}m</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-[12px] font-semibold text-slate-900 leading-tight">
                  {selectedLevelRollup.name}
                </div>
                <span className={`text-[9.5px] font-bold px-1.5 py-0.2 rounded-xs font-mono ${
                  selectedLevelRollup.status === "complete" ? "bg-emerald-50 text-emerald-700" :
                  selectedLevelRollup.status === "in-progress" ? "bg-blue-50 text-blue-700" :
                  selectedLevelRollup.status === "blocked" ? "bg-red-50 text-red-600" : "bg-slate-100 text-slate-600"
                }`}>
                  {selectedLevelRollup.avgProgress}%
                </span>
              </div>
              <div className="text-[10px] text-slate-600 font-medium mt-1 flex items-center gap-1.5">
                <span>{selectedLevelRollup.totalTasks} Programme Tasks</span>
                {selectedLevelRollup.blockedCount > 0 && (
                  <span className="text-red-600 font-semibold">· {selectedLevelRollup.blockedCount} Blocked</span>
                )}
              </div>
              {selectedLevelRollup.criticalCount > 0 && (
                <div className="mt-1 text-[9.5px] text-red-600 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span>{selectedLevelRollup.criticalCount} Critical on Path</span>
                </div>
              )}
              {selectedLevelRollup.mappedTaskId && (
                <button
                  onClick={() => {
                    selectTask(selectedLevelRollup.mappedTaskId!);
                    openDrawer(selectedLevelRollup.mappedTaskId!);
                  }}
                  className="mt-2 w-full py-1 text-center text-[10px] font-semibold text-blue-600 hover:text-blue-700 bg-white border border-slate-200 rounded hover:border-blue-400 transition-colors"
                >
                  Open {selectedLevel} Activities →
                </button>
              )}
            </div>
          </div>

          {/* 3D Canvas Area */}
          <div className="relative flex-1 h-full w-full overflow-hidden bg-[#f8fafc]">
            <BuildingCanvas
              currentProject={currentProject}
              importedModel={importedModel}
              onResetToProjectModel={() => setImportedModel(null)}
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
                mappedTask ? (
                  /* 1. Mapped Element: Display real schedule task details */
                  <div className="flex flex-col border border-slate-200/90 bg-white/95 backdrop-blur-md px-3 py-2.5 rounded-md shadow-md max-w-[360px] pointer-events-auto">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`w-2 h-2 rounded-[2px] shrink-0 ${
                          mappedTask.status === "complete" ? "bg-emerald-500" :
                          mappedTask.status === "in-progress" ? "bg-blue-600" :
                          mappedTask.status === "blocked" ? "bg-red-500" : "bg-slate-300"
                        }`} />
                        <span className="text-[12px] font-semibold text-slate-900 truncate">
                          {mappedTask.name}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500 bg-slate-100 px-1 py-0.5 rounded-xs shrink-0">
                          {mappedTask.wbs}
                        </span>
                        {mappedTask.isCritical && (
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

                    {/* Progress, Status & Real Schedule Dates */}
                    <div className="flex items-center justify-between gap-2 mt-1.5 text-[10.5px]">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <span className="font-mono font-medium text-blue-600">{mappedTask.progress}% Complete</span>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-600 font-mono text-[10px]">
                          {mappedTask.displayStart || mappedTask.startDate} → {mappedTask.displayEnd || mappedTask.endDate}
                        </span>
                      </div>
                      <button
                        onClick={() => {
                          selectTask(mappedTask.id);
                          openDrawer(mappedTask.id);
                        }}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline shrink-0"
                        title="Open task in drawer to view full details"
                      >
                        <span>Inspect</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>

                    {/* Trade & Subcontractor */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                      <span>Trade: {mappedTask.trade || selectedElement.trade || "Structural"}</span>
                      {mappedTask.subcontractor && (
                        <span className="font-medium text-slate-700">{mappedTask.subcontractor}</span>
                      )}
                    </div>

                    {/* Blocked Alert */}
                    {mappedTask.status === "blocked" && (
                      <div className="mt-1.5 rounded bg-red-50 border border-red-200 px-2 py-1 text-[10px] text-red-700 flex items-center gap-1.5">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-red-500" />
                        <span className="truncate">{mappedTask.blockedBy || "Blocked awaiting inspection approval"}</span>
                      </div>
                    )}

                    {/* Connected Workflow Dependencies */}
                    <div className="flex items-center gap-1.5 mt-2 pt-1.5 border-t border-slate-100 text-[10px]">
                      <span className="text-slate-400 font-semibold uppercase text-[8.5px] tracking-wider shrink-0">Flow:</span>
                      {predecessorTask ? (
                        <button
                          onClick={handleNavigatePredecessor}
                          className="text-slate-600 hover:text-blue-600 truncate max-w-[85px] font-medium"
                          title={`Predecessor: ${predecessorTask.name} (${predecessorTask.wbs})`}
                        >
                          {predecessorTask.name}
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">Start</span>
                      )}
                      <span className="text-slate-300">→</span>
                      <span className="text-blue-700 font-semibold truncate max-w-[95px]">{mappedTask.name}</span>
                      <span className="text-slate-300">→</span>
                      {successorTask ? (
                        <button
                          onClick={handleNavigateSuccessor}
                          className="text-slate-600 hover:text-blue-600 truncate max-w-[85px] font-medium"
                          title={`Successor: ${successorTask.name} (${successorTask.wbs})`}
                        >
                          {successorTask.name}
                        </button>
                      ) : (
                        <span className="text-slate-400 italic">End</span>
                      )}
                    </div>
                  </div>
                ) : (
                  /* 2. Unmapped Element: Explicitly inform user that mapping is required (Constraint: Do not invent mappings) */
                  <div className="flex flex-col border border-amber-200 bg-amber-50/95 backdrop-blur-md px-3 py-2.5 rounded-md shadow-sm max-w-[340px] pointer-events-auto text-amber-900">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-[2px] bg-amber-500 shrink-0" />
                        <span className="text-[12px] font-semibold truncate">{selectedElement.name}</span>
                      </div>
                      <button
                        onClick={() => setSelectedElement(null)}
                        className="text-amber-600 hover:text-amber-800 shrink-0 p-0.5 rounded-xs hover:bg-amber-100"
                        title="Clear selection (Esc)"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="mt-1 text-[11px] font-medium text-amber-800">
                      Unmapped 3D Element
                    </div>
                    <div className="mt-0.5 text-[10px] text-amber-700/80 leading-relaxed">
                      No programme activity is mapped to element <code className="font-mono font-semibold">{selectedElement.id}</code>. Link via BIM GUID or WBS code in Schedule.
                    </div>
                    <div className="mt-1.5 flex items-center justify-between pt-1 border-t border-amber-200/60 text-[9.5px] text-amber-700">
                      <span>Level: {selectedElement.level}</span>
                      <span>Discipline: {selectedElement.discipline || "Structural"}</span>
                    </div>
                  </div>
                )
              ) : (
                /* 3. Level Selected (No single element): Display Floor Summary HUD */
                <div className="flex items-center gap-2.5 border border-slate-200/90 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-md shadow-xs pointer-events-auto text-[11px] font-medium text-slate-700">
                  <span className={`w-2 h-2 rounded-[2px] shrink-0 ${
                    selectedLevelRollup.status === "complete" ? "bg-emerald-500" :
                    selectedLevelRollup.status === "in-progress" ? "bg-blue-600" :
                    selectedLevelRollup.status === "blocked" ? "bg-red-500" : "bg-slate-300"
                  }`} />
                  <span className="font-semibold text-slate-900">{selectedLevel}</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-blue-600 font-mono font-semibold">{selectedLevelRollup.avgProgress}% Complete</span>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-500">{selectedLevelRollup.totalTasks} Tasks</span>
                  {selectedLevelRollup.criticalCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                        <span>{selectedLevelRollup.criticalCount} Critical</span>
                      </span>
                    </>
                  )}
                  {selectedLevelRollup.mappedTaskId && (
                    <button
                      onClick={() => {
                        selectTask(selectedLevelRollup.mappedTaskId!);
                        openDrawer(selectedLevelRollup.mappedTaskId!);
                      }}
                      className="ml-1 text-[10.5px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                      title={`Inspect ${selectedLevel} tasks in drawer`}
                    >
                      Inspect Floor →
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* ─── TOP-CENTRE: UNIFIED 3D CONTROL SYSTEM (View modes · Camera Navigation · Status legend) ─── */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center h-8 border border-slate-200 bg-white/95 backdrop-blur-md rounded-md shadow-xs px-2 text-[11.5px] select-none max-w-full">
              {/* 1. View Mode Controls */}
              <div className="flex items-center gap-0.5">
                {[
                  { id: "3d", label: "3D", icon: Box, onClick: () => handleSetViewMode("3d"), active: viewMode === "3d" && !sectionMode, title: "Perspective 3D View (Shortcut: 1)" },
                  { id: "2d", label: "2D", icon: Square, onClick: () => handleSetViewMode("2d"), active: viewMode === "2d", title: "Elevation / 2D View (Shortcut: 2)" },
                  { id: "top", label: "Top", icon: Navigation, onClick: () => handleSetViewMode("top"), active: viewMode === "top", title: "Top-down Plan View (Shortcut: T)" },
                  { id: "section", label: "Section", icon: Layers, onClick: () => handleSetViewMode(viewMode === "section" ? "3d" : "section"), active: viewMode === "section" || sectionMode, title: "Section Cut View (Shortcut: S)" },
                ].map((btn) => (
                  <button
                    key={btn.id}
                    onClick={btn.onClick}
                    title={btn.title}
                    className={`flex items-center gap-1 px-2 h-6 rounded font-medium transition-colors ${
                      btn.active
                        ? "bg-blue-600 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                    <span>{btn.label}</span>
                  </button>
                ))}
              </div>

              {/* Divider */}
              <div className="h-4 w-[1px] bg-slate-200 mx-2 shrink-0" />

              {/* 2. Navigation Mode Controls */}
              <div className="flex items-center gap-0.5">
                {[
                  { label: "Orbit", icon: Crosshair, active: dragMode === "orbit", onClick: () => setDragMode("orbit"), title: "Orbit Mode (Left Drag · Shortcut: O)" },
                  { label: "Pan", icon: Hand, active: dragMode === "pan", onClick: () => setDragMode("pan"), title: "Pan Mode (Left Drag · Shortcut: P)" },
                ].map((btn) => (
                  <button
                    key={btn.label}
                    onClick={btn.onClick}
                    title={btn.title}
                    className={`flex items-center gap-1 px-2 h-6 rounded font-medium transition-colors ${
                      btn.active
                        ? "bg-slate-800 text-white font-semibold shadow-xs"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <btn.icon className="h-3.5 w-3.5" />
                    <span>{btn.label}</span>
                  </button>
                ))}

                <button
                  onClick={handleZoomIn}
                  title="Zoom In (Shortcut: +)"
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleZoomOut}
                  title="Zoom Out (Shortcut: -)"
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={handleFit}
                  title="Fit to Model (Shortcut: F)"
                  className="flex items-center gap-1 px-2 h-6 rounded font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Maximize2 className="h-3 w-3" />
                  <span>Fit</span>
                </button>
                <button
                  onClick={handleReset}
                  title="Reset Camera View (Shortcut: R)"
                  className="flex items-center gap-1 px-2 h-6 rounded font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset</span>
                </button>
                <button
                  onClick={handleSnapshot}
                  title="Capture 3D Snapshot"
                  className="flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Divider */}
              <div className="h-4 w-[1px] bg-slate-200 mx-2 shrink-0" />

              {/* 3. Status Legend */}
              <div className="hidden xl:flex items-center gap-2.5 px-1 text-[11px] font-medium text-slate-600">
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span>Complete</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span>In Progress</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span>Blocked</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span>Not Started</span>
                </div>
              </div>
            </div>

            {sectionMode && (
              <div className="absolute top-12 left-1/2 -translate-x-1/2 z-20 rounded-md border border-blue-200 bg-blue-50/95 backdrop-blur-md px-2.5 py-0.5 text-[10px] font-medium text-blue-700 font-mono shadow-xs">
                Section Cut: {selectedLevel}
              </div>
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
          currentPreset={currentProject}
          activeImportedModel={importedModel}
          onUseModel={(project, customModel) => {
            if (project) {
              handleSelectProject(project);
            }
            if (customModel !== undefined) {
              setImportedModel(customModel);
            }
            setShowUploadModal(false);
          }}
        />
      )}

      {/* Baseline Integrity, Revisions & Change History Dialog */}
      <BaselineRevisionsModal />
    </div>
  );
}
