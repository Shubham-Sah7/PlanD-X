"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Building,
  Calendar,
  ChevronDown,
  Camera,
  Check,
  Plus,
  Clock,
  Paperclip,
  FileText,
  Flame,
  AlertCircle,
  ArrowRight,
  Edit2,
  Trash2,
  Link2,
  GitCompare,
  Hash,
  Layers,
  Tag,
  AlertTriangle,
  CheckCircle2,
  Users,
  Lock,
  ShieldCheck,
  History,
  User,
  Sliders,
  AlertOctagon,
  Copy,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Flag,
  FolderTree,
  Receipt,
  HardHat,
  Briefcase,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus, DependencyType, TaskType, ConstraintType } from "@/lib/programme-types";
import {
  calculateScheduleVariance,
  formatVarianceDisplay,
  calculateTaskDelayImpact,
  addWorkingDays,
  formatDateIso,
  formatDisplayDate,
  getNextWorkingDay,
  parseIsoDate,
  shiftByWorkingDays,
} from "@/lib/programme-calendar";
import {
  getTaskPredecessorLinks,
  formatDependencyRelation,
} from "@/lib/programme-dependencies";
import { DependencyEditorModal } from "./dependencies/dependency-editor-modal";
import { ResourceAssignmentDropdown } from "./resources/resource-assignment-dropdown";
import { TaskResourceAttendanceSection } from "./resources/task-resource-attendance-section";

export function TaskDrawer() {
  const {
    state,
    closeDrawer,
    updateTaskProgress,
    updateTaskSchedule,
    updateTaskDetails,
    addTaskNote,
    selectTask,
    projectCalendar,
    openCalendarModal,
    removeDependency,
    addDependency,
    updateDependency,
    scheduleAuditLog,
    openRevisions,
    verifyPhysicalProgress,
    duplicateTask,
    deleteTask,
    indentTask,
    outdentTask,
    reorderTask,
    projectResources,
    assignResourceToTask,
    removeResourceFromTask,
    linkTaskSubcontractor,
    recordSiteAttendance,
    recordSubcontractorClaim,
    updateTaskIntegrations,
  } = useProgramme();
  const [activeTab, setActiveTab] = useState<"details" | "dependencies" | "updates" | "files" | "qa" | "integrations">("details");

  // Modals / dropdowns for interactive actions
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [newProgressValue, setNewProgressValue] = useState(60);
  const [newStatusValue, setNewStatusValue] = useState<TaskStatus>("in-progress");
  const [subcontractorClaimValue, setSubcontractorClaimValue] = useState<number>(0);
  const [subcontractorClaimNotes, setSubcontractorClaimNotes] = useState<string>("");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [photoAdded, setPhotoAdded] = useState(false);

  // Dependency Editor Modal State
  const [depModalOpen, setDepModalOpen] = useState(false);
  const [depModalEditing, setDepModalEditing] = useState(false);
  const [depModalPredId, setDepModalPredId] = useState<string | null>(null);
  const [depModalType, setDepModalType] = useState<DependencyType>("FS");
  const [depModalLag, setDepModalLag] = useState<number>(0);

  const handleOpenAddDependency = () => {
    setDepModalEditing(false);
    setDepModalPredId(null);
    setDepModalType("FS");
    setDepModalLag(0);
    setDepModalOpen(true);
  };

  const handleOpenEditDependency = (predId: string, type: DependencyType = "FS", lag: number = 0) => {
    setDepModalEditing(true);
    setDepModalPredId(predId);
    setDepModalType(type);
    setDepModalLag(lag);
    setDepModalOpen(true);
  };

  // Successor modal/inline link state
  const [isAddSuccessorOpen, setIsAddSuccessorOpen] = useState(false);
  const [selectedSuccessorId, setSelectedSuccessorId] = useState("");
  const [successorType, setSuccessorType] = useState<DependencyType>("FS");
  const [successorLag, setSuccessorLag] = useState<number>(0);
  const [successorError, setSuccessorError] = useState<string | null>(null);

  if (!state.drawerOpen || !state.selectedTaskId) {
    return null;
  }

  // Find currently selected task or fallback
  const currentTask =
    state.tasks.find((t) => t.id === state.selectedTaskId) ||
    state.tasks.find((t) => t.id === "PRG-021") ||
    state.tasks.find((t) => t.id === "task-columns");

  if (!currentTask) {
    return null;
  }

  // Dynamic extracted predecessor links
  const currentTaskPredLinks = useMemo(() => {
    return getTaskPredecessorLinks(currentTask);
  }, [currentTask]);

  // Dynamic extracted successor links
  const currentTaskSuccLinks = useMemo(() => {
    const list: Array<{ id: string; name?: string; type: DependencyType; lag: number }> = [];
    for (const t of state.tasks) {
      if (t.id === currentTask.id) continue;
      if (t.predecessors?.includes(currentTask.id)) {
        const detail = t.predecessorDetails?.find((d) => d.id === currentTask.id);
        list.push({
          id: t.id,
          name: t.name,
          type: detail?.type || "FS",
          lag: detail?.lag || 0,
        });
      }
    }
    return list;
  }, [state.tasks, currentTask]);

  const candidatePredecessors = useMemo(() => {
    const existingPredIds = new Set(currentTaskPredLinks.map((p) => p.id));
    return state.tasks.filter(
      (t) => t.id !== currentTask.id && !existingPredIds.has(t.id) && t.level !== "phase"
    );
  }, [state.tasks, currentTask.id, currentTaskPredLinks]);

  const candidateSuccessors = useMemo(() => {
    const existingSuccIds = new Set(currentTaskSuccLinks.map((s) => s.id));
    return state.tasks.filter(
      (t) => t.id !== currentTask.id && !existingSuccIds.has(t.id) && t.level !== "phase"
    );
  }, [state.tasks, currentTask.id, currentTaskSuccLinks]);

  // MS Project Interactive Table Grid State
  const [depViewMode, setDepViewMode] = useState<"grid" | "cards">("grid");
  const [newPredSelectId, setNewPredSelectId] = useState<string>("");
  const [newPredType, setNewPredType] = useState<DependencyType>("FS");
  const [newPredLag, setNewPredLag] = useState<number>(0);

  const [newSuccSelectId, setNewSuccSelectId] = useState<string>("");
  const [newSuccType, setNewSuccType] = useState<DependencyType>("FS");
  const [newSuccLag, setNewSuccLag] = useState<number>(0);

  const handleAddPredInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newPredSelectId) return;
    addDependency(newPredSelectId, currentTask.id, newPredType, newPredLag);
    setNewPredSelectId("");
    setNewPredLag(0);
  };

  const handleAddSuccInline = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSuccSelectId) return;
    addDependency(currentTask.id, newSuccSelectId, newSuccType, newSuccLag);
    setNewSuccSelectId("");
    setNewSuccLag(0);
  };

  const handleAddSuccessor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSuccessorId) {
      setSuccessorError("Please select a successor task");
      return;
    }
    const res = addDependency(currentTask.id, selectedSuccessorId, successorType, successorLag);
    if (!res.success) {
      setSuccessorError(res.error || "Failed to link successor");
      return;
    }
    setIsAddSuccessorOpen(false);
    setSelectedSuccessorId("");
    setSuccessorLag(0);
    setSuccessorError(null);
  };

  // Task-specific schedule change audit history
  const taskAuditEvents = useMemo(() => {
    return scheduleAuditLog.filter((ev) => ev.taskId === currentTask.id);
  }, [scheduleAuditLog, currentTask.id]);

  const handleSaveProgress = () => {
    updateTaskProgress(currentTask.id, newProgressValue, newStatusValue);
    if (
      subcontractorClaimValue !== (currentTask.subcontractorClaimedProgress ?? currentTask.progress) ||
      subcontractorClaimNotes !== (currentTask.subcontractorClaimNotes ?? "")
    ) {
      recordSubcontractorClaim(currentTask.id, subcontractorClaimValue, subcontractorClaimNotes);
    }
    setProgressModalOpen(false);
  };

  const handleSaveNote = () => {
    if (noteText.trim()) {
      addTaskNote(currentTask.id, noteText + (photoAdded ? " [Photo attached]" : ""));
      setNoteText("");
      setPhotoAdded(false);
      setNoteModalOpen(false);
    }
  };

  // Title Editing State
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState("");
  const [titleError, setTitleError] = useState<string | null>(null);

  const handleStartEditTitle = () => {
    setEditTitleValue(currentTask.name);
    setTitleError(null);
    setIsEditingTitle(true);
  };

  const handleSaveTitle = () => {
    const trimmed = editTitleValue.trim();
    if (!trimmed) {
      setTitleError("Task name cannot be empty");
      return;
    }
    const res = updateTaskDetails(currentTask.id, { name: trimmed });
    if (res.success) {
      setIsEditingTitle(false);
      setTitleError(null);
    } else {
      setTitleError(res.errors?.name || res.error || "Failed to update task name");
    }
  };

  // Description Editing State
  const [isEditingDesc, setIsEditingDesc] = useState(false);
  const [editDescValue, setEditDescValue] = useState("");

  const handleStartEditDesc = () => {
    setEditDescValue(currentTask.description || "");
    setIsEditingDesc(true);
  };

  const handleSaveDesc = () => {
    updateTaskDetails(currentTask.id, { description: editDescValue });
    setIsEditingDesc(false);
  };

  // Schedule Editing State
  const [isEditingSchedule, setIsEditingSchedule] = useState(false);
  const [editDuration, setEditDuration] = useState<number>(currentTask?.duration || 1);
  const [editStartDate, setEditStartDate] = useState<string>(currentTask?.startDate || "2025-10-01");
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const handleStartEditSchedule = () => {
    setEditDuration(currentTask.duration !== undefined ? currentTask.duration : 1);
    setEditStartDate(currentTask.startDate || "2025-10-01");
    setScheduleError(null);
    setIsEditingSchedule(true);
  };

  const handleSaveSchedule = () => {
    if (editDuration < 0) {
      setScheduleError("Duration cannot be negative");
      return;
    }
    if (!editStartDate) {
      setScheduleError("Start date is required");
      return;
    }
    const res = updateTaskSchedule(currentTask.id, {
      duration: editDuration,
      startDate: editStartDate,
    });
    if (!res.success) {
      setScheduleError(res.error || "Failed to update schedule");
      return;
    }
    setScheduleError(null);
    setIsEditingSchedule(false);
  };

  // MS Project Calculation, Workload & Constraints State
  const [isEditingMspCalc, setIsEditingMspCalc] = useState(false);
  const [editTaskType, setEditTaskType] = useState<TaskType>(currentTask?.taskType || "fixed-duration");
  const [editEffortDriven, setEditEffortDriven] = useState<boolean>(Boolean(currentTask?.effortDriven));
  const [editWorkHours, setEditWorkHours] = useState<number>(currentTask?.workHours ?? (currentTask?.duration || 1) * 8);
  const [editUnits, setEditUnits] = useState<number>(currentTask?.assignmentUnits ?? 1.0);
  const [editConstraintType, setEditConstraintType] = useState<ConstraintType>(currentTask?.constraintType || "ASAP");
  const [editConstraintDate, setEditConstraintDate] = useState<string>(currentTask?.constraintDate || "");
  const [editDeadline, setEditDeadline] = useState<string>(currentTask?.deadline || "");

  const handleStartEditMspCalc = () => {
    setEditTaskType(currentTask?.taskType || "fixed-duration");
    setEditEffortDriven(Boolean(currentTask?.effortDriven));
    setEditWorkHours(currentTask?.workHours ?? (currentTask?.duration || 1) * 8);
    setEditUnits(currentTask?.assignmentUnits ?? 1.0);
    setEditConstraintType(currentTask?.constraintType || "ASAP");
    setEditConstraintDate(currentTask?.constraintDate || "");
    setEditDeadline(currentTask?.deadline || "");
    setIsEditingMspCalc(true);
  };

  const handleSaveMspCalc = () => {
    updateTaskDetails(currentTask.id, {
      taskType: editTaskType,
      effortDriven: editEffortDriven,
      workHours: editWorkHours,
      assignmentUnits: editUnits,
      constraintType: editConstraintType,
      constraintDate: editConstraintDate || undefined,
      deadline: editDeadline || undefined,
    });
    setIsEditingMspCalc(false);
  };

  const predecessorConstraint = useMemo(() => {
    if (!currentTaskPredLinks.length) return null;
    let latestPredFinish: string | null = null;
    let latestPredName = "";
    for (const pred of currentTaskPredLinks) {
      const pTask = state.tasks.find((t) => t.id === pred.id);
      if (!pTask || !pTask.endDate) continue;
      const constraintDate =
        pred.type === "FS"
          ? formatDateIso(addWorkingDays(pTask.endDate, pred.lag || 0, projectCalendar))
          : pTask.startDate;
      if (!latestPredFinish || constraintDate > latestPredFinish) {
        latestPredFinish = constraintDate;
        latestPredName = pTask.name;
      }
    }
    return latestPredFinish ? { date: latestPredFinish, name: latestPredName } : null;
  }, [currentTaskPredLinks, state.tasks, projectCalendar]);

  const previewFinishDate = useMemo(() => {
    if (!editStartDate || editDuration === undefined) return null;
    try {
      const snappedStart = getNextWorkingDay(editStartDate, projectCalendar);
      return addWorkingDays(snappedStart, editDuration, projectCalendar);
    } catch {
      return null;
    }
  }, [editStartDate, editDuration, projectCalendar]);

  const isNetworkTask = currentTask.id.startsWith("PRG-");
  const depCount = currentTaskPredLinks.length + currentTaskSuccLinks.length;

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border border-slate-200 bg-white shadow-sm select-none overflow-hidden rounded-lg">
      {/* Drawer Header */}
      <div className="flex items-start justify-between border-b border-slate-200 p-4 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          {/* WBS and Task ID */}
          <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
            <span className="font-mono text-[11px] font-bold text-slate-700 bg-slate-100 border border-slate-200/90 px-1.5 py-0.5 rounded shadow-2xs">
              {currentTask.wbs || currentTask.id}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {currentTask.id}
            </span>
            {currentTask.level && (
              <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-500 bg-slate-50 border border-slate-200/70 px-1.5 py-0.5 rounded">
                {currentTask.level}
              </span>
            )}
          </div>

          {/* Task Name (Interactive inline edit) */}
          {isEditingTitle ? (
            <div className="space-y-1 mt-0.5">
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editTitleValue}
                  onChange={(e) => {
                    setEditTitleValue(e.target.value);
                    if (titleError) setTitleError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveTitle();
                    if (e.key === "Escape") setIsEditingTitle(false);
                  }}
                  autoFocus
                  className={`w-full px-2 py-1 text-[13.5px] font-semibold text-slate-900 rounded border ${
                    titleError ? "border-red-500 focus:ring-red-200" : "border-blue-400 focus:ring-blue-200"
                  } bg-white shadow-inner focus:outline-hidden focus:ring-2`}
                  placeholder="Task name..."
                />
                <button
                  type="button"
                  onClick={handleSaveTitle}
                  className="p-1.5 rounded bg-blue-600 hover:bg-blue-700 text-white shrink-0 transition-colors shadow-xs"
                  title="Save task name"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(false)}
                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 shrink-0 transition-colors"
                  title="Cancel"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {titleError && (
                <p className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{titleError}</span>
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-start justify-between gap-1.5">
              <h3
                onClick={handleStartEditTitle}
                className="text-[15px] font-semibold text-slate-900 leading-snug break-words hover:text-blue-600 cursor-pointer transition-colors"
                title="Click to rename task"
              >
                {currentTask.name}
              </h3>
              <button
                id="drawer-edit-title-btn"
                type="button"
                onClick={handleStartEditTitle}
                className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors shrink-0"
                title="Edit task name"
                aria-label="Edit task name"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Badges Row */}
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {currentTask.isCritical && (
              <div className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600">
                <Flame className="h-3 w-3 fill-red-500 text-red-500" />
                <span>Critical Path</span>
              </div>
            )}
            {(currentTask.isMilestone || currentTask.duration === 0) && (
              <div className="inline-flex items-center gap-1 rounded-full bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-700">
                <span className="rotate-45 block h-1.5 w-1.5 bg-purple-600" />
                <span>Milestone</span>
              </div>
            )}
          </div>

          {/* Quick Task Operations Bar */}
          <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 flex-wrap">
            <button
              id="drawer-duplicate-btn"
              type="button"
              onClick={() => duplicateTask(currentTask.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
              title="Duplicate task"
            >
              <Copy className="h-3 w-3 text-slate-500" />
              <span>Duplicate</span>
            </button>
            <button
              id="drawer-indent-btn"
              type="button"
              onClick={() => indentTask(currentTask.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
              title="Indent task into predecessor group"
            >
              <ArrowRight className="h-3 w-3 text-slate-500" />
              <span>Indent</span>
            </button>
            <button
              id="drawer-outdent-btn"
              type="button"
              onClick={() => outdentTask(currentTask.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded transition-colors"
              title="Outdent task to higher WBS level"
            >
              <ArrowLeft className="h-3 w-3 text-slate-500" />
              <span>Outdent</span>
            </button>
            <div className="inline-flex items-center border border-slate-200 rounded overflow-hidden">
              <button
                id="drawer-move-up-btn"
                type="button"
                onClick={() => reorderTask(currentTask.id, "up")}
                className="p-1 text-slate-600 bg-slate-50 hover:bg-slate-100 border-r border-slate-200 transition-colors"
                title="Move task up"
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                id="drawer-move-down-btn"
                type="button"
                onClick={() => reorderTask(currentTask.id, "down")}
                className="p-1 text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                title="Move task down"
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
            <button
              id="drawer-delete-btn"
              type="button"
              onClick={() => deleteTask(currentTask.id)}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors ml-auto"
              title="Delete task (with confirmation if child tasks or links exist)"
            >
              <Trash2 className="h-3 w-3 text-red-500" />
              <span>Delete</span>
            </button>
          </div>
        </div>

        {/* Close Button */}
        <button
          onClick={closeDrawer}
          className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors shrink-0"
          title="Close drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs Bar */}
      <div className="flex border-b border-slate-200 px-4 text-[13px] font-medium text-slate-500">
        <button
          onClick={() => setActiveTab("details")}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "details"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab("dependencies")}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "dependencies"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Dependencies {depCount > 0 ? `(${depCount})` : "(3)"}
        </button>
        <button
          onClick={() => setActiveTab("updates")}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "updates"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Updates (5)
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors ${
            activeTab === "files"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          Files (2)
        </button>
        <button
          onClick={() => setActiveTab("qa" as any)}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
            (activeTab as any) === "qa"
              ? "border-amber-500 text-amber-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span>3D QA</span>
        </button>
        <button
          onClick={() => setActiveTab("integrations")}
          className={`py-2.5 px-2.5 border-b-2 font-medium transition-colors flex items-center gap-1.5 ${
            activeTab === "integrations"
              ? "border-indigo-600 text-indigo-600 font-bold"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          <Layers className="h-3.5 w-3.5 text-indigo-500" />
          <span>Modules</span>
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-[13px]">
        {activeTab === "details" && (
          <div className="space-y-3">
            {/* Blocked Alert Banner if blocked */}
            {(currentTask.status === "blocked" || currentTask.isBlocked) && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-2.5 text-[12px] text-red-900 shadow-2xs">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>ACTIVITY BLOCKED</span>
                </div>
                <p className="mt-1 text-slate-700 leading-snug">
                  Blocked by:{" "}
                  <span className="font-semibold text-red-800">
                    {currentTask.blockedBy || "Preceding concrete pour inspection"}
                  </span>
                </p>
              </div>
            )}

            {/* Section 1: Status & Progress */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                  Status & Progress
                </span>

                {/* Status Dropdown */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium transition-colors border ${
                      currentTask.status === "blocked"
                        ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                        : currentTask.status === "complete"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                        : currentTask.status === "in-progress"
                        ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                        : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        currentTask.status === "blocked"
                          ? "bg-red-500"
                          : currentTask.status === "complete"
                          ? "bg-emerald-500"
                          : currentTask.status === "in-progress"
                          ? "bg-blue-500"
                          : "bg-slate-400"
                      }`}
                    />
                    <span className="capitalize">{currentTask.status.replace("-", " ")}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </button>

                  {statusDropdownOpen && (
                    <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50 animate-in fade-in zoom-in-95 duration-100">
                      {(["not-started", "in-progress", "complete", "blocked"] as TaskStatus[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            updateTaskProgress(currentTask.id, currentTask.progress, st);
                            setStatusDropdownOpen(false);
                          }}
                          className="flex w-full items-center justify-between px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 capitalize"
                        >
                          <span>{st.replace("-", " ")}</span>
                          {currentTask.status === st && <Check className="h-3 w-3 text-blue-600" />}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Progress Slider & Quick Chips */}
              <div className="space-y-1.5 pt-0.5">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="text-slate-500 font-medium">Completion</span>
                  <span className="font-mono font-bold text-slate-900">{currentTask.progress}%</span>
                </div>

                {/* Progress bar */}
                <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      currentTask.progress >= 100
                        ? "bg-emerald-500"
                        : currentTask.status === "blocked"
                        ? "bg-red-500"
                        : "bg-blue-600"
                    }`}
                    style={{ width: `${currentTask.progress}%` }}
                  />
                </div>

                {/* Interactive Slider */}
                <div className="pt-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={currentTask.progress}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      updateTaskProgress(currentTask.id, val);
                    }}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    title="Slide to update progress"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center justify-between pt-1 text-[10.5px]">
                  <span className="text-slate-400">Quick set:</span>
                  <div className="flex items-center gap-1">
                    {[0, 25, 50, 75, 100].map((pct) => (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => updateTaskProgress(currentTask.id, pct)}
                        className={`px-1.5 py-0.5 rounded font-mono font-medium transition-colors ${
                          currentTask.progress === pct
                            ? "bg-blue-600 text-white font-bold"
                            : "bg-slate-100 hover:bg-slate-200 text-slate-600"
                        }`}
                      >
                        {pct}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Physical Verification Governance (Requirement 4) */}
            <div className="rounded-lg border border-slate-200/90 bg-slate-50/80 p-2.5 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck
                    className={`h-4 w-4 ${
                      currentTask.verifiedPhysicalProgress ? "text-emerald-600" : "text-slate-400"
                    }`}
                  />
                  <span className="text-[12px] font-semibold text-slate-800">
                    Physical Progress Verification
                  </span>
                </div>
                {currentTask.verifiedPhysicalProgress ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Verified On-Site
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-medium bg-amber-100 text-amber-800 border border-amber-200">
                    <AlertTriangle className="h-3 w-3 text-amber-600" />
                    Self-Reported (Unverified)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 leading-snug">
                Construction governance rule: Percentage complete is never treated as verified completion without physical QA sign-off.
              </p>
              <div className="flex items-center justify-between pt-0.5">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(currentTask.verifiedPhysicalProgress)}
                    onChange={(e) =>
                      verifyPhysicalProgress(currentTask.id, e.target.checked, "Site QA Inspector")
                    }
                    className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Mark Progress as Physically Verified</span>
                </label>
                {currentTask.verifiedAt && (
                  <span className="text-[10.5px] text-slate-400 font-mono">
                    {formatDisplayDate(currentTask.verifiedAt.split("T")[0])}
                  </span>
                )}
              </div>
            </div>

            {/* Section 2: Schedule & Timing */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-blue-600" />
                  Schedule & Dates
                </span>
                {!isEditingSchedule && currentTask.level !== "phase" && (
                  <button
                    type="button"
                    onClick={handleStartEditSchedule}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit Schedule</span>
                  </button>
                )}
              </div>

              {isEditingSchedule ? (
                /* Schedule Edit Form */
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 space-y-2.5">
                  <div className="grid grid-cols-2 gap-2 text-[12px]">
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => {
                          setEditStartDate(e.target.value);
                          if (scheduleError) setScheduleError(null);
                        }}
                        className={`w-full px-2 py-1 rounded border ${
                          scheduleError && !editStartDate ? "border-red-500" : "border-slate-300"
                        } bg-white text-slate-800 font-mono text-[11.5px] focus:outline-hidden focus:ring-1 focus:ring-blue-500`}
                      />
                    </div>

                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Duration (days)
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditDuration((prev) => Math.max(0, prev - 1))}
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-600 text-[11px]"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={0}
                          max={365}
                          value={editDuration}
                          onChange={(e) => {
                            const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                            setEditDuration(val);
                            if (scheduleError) setScheduleError(null);
                          }}
                          className={`w-full text-center px-1 py-1 rounded border ${
                            scheduleError && editDuration < 0 ? "border-red-500" : "border-slate-300"
                          } bg-white text-slate-800 font-mono text-[11.5px] font-bold focus:outline-hidden focus:ring-1 focus:ring-blue-500`}
                        />
                        <button
                          type="button"
                          onClick={() => setEditDuration((prev) => prev + 1)}
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 font-bold text-slate-600 text-[11px]"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Predecessor earliest constraint advisory */}
                  {predecessorConstraint && editStartDate < predecessorConstraint.date && (
                    <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold">Notice:</span> Predecessor{" "}
                        <span className="font-semibold text-amber-900">"{predecessorConstraint.name}"</span>{" "}
                        earliest handoff is{" "}
                        <span className="font-mono font-bold text-amber-900">{predecessorConstraint.date}</span>.
                      </div>
                    </div>
                  )}

                  {/* Calculated Finish Preview */}
                  {previewFinishDate && (
                    <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200 flex items-center justify-between">
                      <span className="text-slate-500">Calculated Finish:</span>
                      <span className="font-semibold text-slate-800 font-mono">
                        {formatDateIso(previewFinishDate)} ({formatDisplayDate(previewFinishDate)})
                      </span>
                    </div>
                  )}

                  {/* Schedule Error Message if any */}
                  {scheduleError && (
                    <p className="text-[11px] font-medium text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{scheduleError}</span>
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-blue-100">
                    <span className="text-[10.5px] text-slate-400">
                      Using {projectCalendar.name.split(" ")[0]} ({projectCalendar.workingDays.length}d)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIsEditingSchedule(false);
                          setScheduleError(null);
                        }}
                        className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveSchedule}
                        className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                      >
                        Save & Recalculate
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* Read-Only Schedule Details */
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[12px]">Current Dates</span>
                    <div className="flex items-center gap-1.5 font-medium text-slate-800 text-[12px]">
                      <span>{currentTask.displayStart || "20 Dec 2025"}</span>
                      <span className="text-slate-400">→</span>
                      <span>{currentTask.displayEnd || "16 Jan 2026"}</span>
                      <span className="text-slate-300">·</span>
                      <span className="font-mono text-slate-700 font-semibold">
                        {currentTask.duration || 12}d
                      </span>
                    </div>
                  </div>

                  {/* Baseline 0 Reference */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-slate-500 text-[12px]">
                      <Lock className="h-3 w-3 text-slate-400" />
                      <span>Baseline 0 (Contract)</span>
                      <button
                        type="button"
                        onClick={openRevisions}
                        className="text-[10.5px] text-blue-600 hover:underline font-normal cursor-pointer ml-1"
                        title="View approved baseline revisions and change history"
                      >
                        (Revisions)
                      </button>
                    </div>
                    {currentTask.baseline0Start && currentTask.baseline0Finish ? (
                      <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-slate-600">
                        <span
                          className="h-2 w-3.5 rounded-xs border border-slate-500/80 inline-block shrink-0"
                          style={{
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 2px, rgba(100, 116, 139, 0.95) 2px, rgba(100, 116, 139, 0.95) 4px)",
                          }}
                        />
                        <span>{currentTask.baseline0Start}</span>
                        <span className="text-slate-400">→</span>
                        <span>{currentTask.baseline0Finish}</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No baseline saved</span>
                    )}
                  </div>

                  {/* Variance Badge */}
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 text-[12px]">Schedule Variance</span>
                    {currentTask.baseline0Start && currentTask.baseline0Finish ? (
                      (() => {
                        const variance = calculateScheduleVariance(currentTask, projectCalendar);
                        const disp = formatVarianceDisplay(variance.finishVariance);
                        return (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-bold border ${disp.badgeClass}`}
                            >
                              <GitCompare className="h-3 w-3" />
                              <span>{disp.label}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              ({variance.startVariance >= 0 ? `+${variance.startVariance}d` : `${variance.startVariance}d`} start slip)
                            </span>
                          </div>
                        );
                      })()
                    ) : (
                      <span className="text-[11px] text-slate-400">—</span>
                    )}
                  </div>

                  {/* CPM Float, Late Dates & Calendar */}
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100 text-[11.5px]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500">Criticality:</span>
                        {currentTask.isCritical || (currentTask.float !== undefined && currentTask.float <= 0) ? (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <Flame className="h-3 w-3 text-rose-600" />
                            Critical Path (0d float)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                            Non-Critical ({currentTask.float ?? 0}d float)
                          </span>
                        )}
                      </div>

                      <button
                        id="drawer-project-calendar-btn"
                        type="button"
                        onClick={openCalendarModal}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 hover:underline transition-colors text-[11px]"
                        title="Configure working week and holidays"
                      >
                        <Clock className="h-3 w-3" />
                        <span>{projectCalendar.name.split(" ")[0]} ({projectCalendar.workingDays.length}d)</span>
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-slate-500 font-mono text-[11px]">
                      <div>
                        <span>Total Float: </span>
                        <span className={`font-semibold ${
                          currentTask.isCritical || (currentTask.float !== undefined && currentTask.float <= 0)
                            ? "text-red-600 font-bold"
                            : "text-slate-800"
                        }`}>
                          {currentTask.float !== undefined ? `${currentTask.float}d` : "0d"}
                        </span>
                      </div>
                      <div>
                        <span>Free Float: </span>
                        <span className="font-semibold text-slate-800">
                          {currentTask.freeFloat !== undefined ? `${currentTask.freeFloat}d` : "0d"}
                        </span>
                      </div>
                      {currentTask.lateStart && currentTask.lateFinish && (
                        <div>
                          <span className="text-slate-400">Late: </span>
                          <span className="text-slate-600">
                            {currentTask.lateStart.slice(5)} → {currentTask.lateFinish.slice(5)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Section 2B: Delay & Critical Path Impact Analysis */}
            {(() => {
              const impact = calculateTaskDelayImpact(currentTask, state.tasks, projectCalendar);
              return (
                <div
                  className={`rounded-lg border p-3 space-y-2 shadow-2xs ${
                    impact.impactType === "critical-delay"
                      ? "border-red-200 bg-red-50/40"
                      : impact.impactType === "consuming-float"
                      ? "border-amber-200 bg-amber-50/30"
                      : "border-slate-200/90 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-slate-800 flex items-center gap-1.5">
                      {impact.impactType === "critical-delay" ? (
                        <Flame className="h-4 w-4 text-red-600" />
                      ) : impact.impactType === "consuming-float" ? (
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      )}
                      <span>Delay &amp; Float Impact</span>
                    </span>

                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold border ${
                        impact.impactType === "critical-delay"
                          ? "bg-red-100 text-red-800 border-red-300"
                          : impact.impactType === "consuming-float"
                          ? "bg-amber-100 text-amber-800 border-amber-300"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }`}
                    >
                      {impact.impactType === "critical-delay"
                        ? "Pushes Project Completion"
                        : impact.impactType === "consuming-float"
                        ? "Consumes Float (Safe)"
                        : "On Track / Zero Risk"}
                    </span>
                  </div>

                  {/* Impact Explanation */}
                  <p className="text-[11.5px] text-slate-700 leading-relaxed">
                    {impact.explanation}
                  </p>

                  {/* Metrics Grid */}
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200/60 text-center font-mono">
                    <div className="rounded bg-white/80 p-1.5 border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">Variance</div>
                      <div
                        className={`text-[12px] font-bold ${
                          impact.finishVariance > 0
                            ? "text-amber-700"
                            : impact.finishVariance < 0
                            ? "text-emerald-700"
                            : "text-slate-600"
                        }`}
                      >
                        {impact.finishVariance > 0
                          ? `+${impact.finishVariance}d`
                          : `${impact.finishVariance}d`}
                      </div>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">Total Float</div>
                      <div
                        className={`text-[12px] font-bold ${
                          impact.totalFloat <= 0 ? "text-red-600" : "text-slate-800"
                        }`}
                      >
                        {impact.totalFloat}d
                      </div>
                    </div>
                    <div className="rounded bg-white/80 p-1.5 border border-slate-200/60">
                      <div className="text-[10px] text-slate-400 font-sans uppercase">Proj. Slip</div>
                      <div
                        className={`text-[12px] font-bold ${
                          impact.netProjectDelayDays > 0 ? "text-red-600" : "text-emerald-600"
                        }`}
                      >
                        {impact.netProjectDelayDays > 0 ? `+${impact.netProjectDelayDays}d` : "0d"}
                      </div>
                    </div>
                  </div>

                  {/* Affected Successors List */}
                  {impact.affectedSuccessors.length > 0 && (
                    <div className="pt-2 border-t border-slate-200/60 space-y-1.5">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                        <span>Affected Downstream Activities:</span>
                        <span className="font-mono font-bold text-slate-700">
                          {impact.affectedSuccessors.length}
                        </span>
                      </div>
                      <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                        {impact.affectedSuccessors.map((succ) => (
                          <div
                            key={succ.id}
                            onClick={() => selectTask(succ.id)}
                            className="flex items-center justify-between px-2 py-1 rounded bg-white border border-slate-200/70 text-[11px] hover:border-blue-300 cursor-pointer transition-colors"
                            title={`Jump to ${succ.name}`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="font-mono text-slate-400 text-[10px]">{succ.wbs}</span>
                              <span className="truncate font-medium text-slate-800">{succ.name}</span>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {succ.isCritical && (
                                <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[9.5px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                                  <Flame className="h-2.5 w-2.5 text-rose-600" />
                                  Critical
                                </span>
                              )}
                              <span className="font-mono text-[10px] text-slate-500">
                                {succ.startDate}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* MS Project Work, Units & Task Type Settings (Requirements 1, 2, 3, 4) */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="h-3.5 w-3.5 text-blue-600" />
                  MSP Calculation &amp; Workload
                </span>
                {!isEditingMspCalc && currentTask.level !== "phase" && (
                  <button
                    type="button"
                    onClick={handleStartEditMspCalc}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Configure</span>
                  </button>
                )}
              </div>

              {isEditingMspCalc ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 space-y-2.5 text-[11.5px]">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Task Type
                      </label>
                      <select
                        value={editTaskType}
                        onChange={(e) => setEditTaskType(e.target.value as TaskType)}
                        className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 text-[11px] font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="fixed-duration">Fixed Duration</option>
                        <option value="fixed-work">Fixed Work</option>
                        <option value="fixed-units">Fixed Units</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Effort-Driven
                      </label>
                      <div className="pt-1.5 flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="effort-driven-check"
                          checked={editEffortDriven}
                          onChange={(e) => setEditEffortDriven(e.target.checked)}
                          className="rounded text-blue-600 h-4 w-4"
                        />
                        <label htmlFor="effort-driven-check" className="text-[11px] text-slate-700 font-medium">
                          Effort-Driven
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Total Work (Hours)
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={editWorkHours}
                        onChange={(e) => setEditWorkHours(Math.max(0, parseFloat(e.target.value) || 0))}
                        className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-slate-800 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Units (1.0 = 100%)
                      </label>
                      <input
                        type="number"
                        min={0.1}
                        step={0.1}
                        value={editUnits}
                        onChange={(e) => setEditUnits(Math.max(0.1, parseFloat(e.target.value) || 1.0))}
                        className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-slate-800 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Constraint Type
                      </label>
                      <select
                        value={String(editConstraintType)}
                        onChange={(e) => setEditConstraintType(e.target.value as ConstraintType)}
                        className="w-full px-2 py-1 rounded border border-slate-300 bg-white text-slate-800 text-[11px] font-medium focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      >
                        <option value="ASAP">ASAP (As Soon As Possible)</option>
                        <option value="ALAP">ALAP (As Late As Possible)</option>
                        <option value="MSO">MSO (Must Start On)</option>
                        <option value="MFO">MFO (Must Finish On)</option>
                        <option value="SNET">SNET (Start No Earlier Than)</option>
                        <option value="SNLT">SNLT (Start No Later Than)</option>
                        <option value="FNET">FNET (Finish No Earlier Than)</option>
                        <option value="FNLT">FNLT (Finish No Later Than)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 text-[11px] font-medium mb-1">
                        Constraint Date
                      </label>
                      <input
                        type="date"
                        value={editConstraintDate}
                        onChange={(e) => setEditConstraintDate(e.target.value)}
                        disabled={editConstraintType === "ASAP" || editConstraintType === "ALAP"}
                        className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-slate-800 text-[11px] disabled:bg-slate-100 disabled:text-slate-400 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-600 text-[11px] font-medium mb-1">
                      Milestone Deadline
                    </label>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="w-full px-2 py-1 rounded border border-slate-300 bg-white font-mono text-slate-800 text-[11px] focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-blue-100">
                    <button
                      type="button"
                      onClick={() => setIsEditingMspCalc(false)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveMspCalc}
                      className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                    >
                      Save &amp; Recalculate
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 text-[11.5px]">
                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">Task Type:</span>
                      <span className="font-semibold text-slate-800 capitalize">
                        {currentTask.taskType || "Fixed Duration"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">Effort-Driven:</span>
                      <span className="font-semibold text-slate-800">
                        {currentTask.effortDriven ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-slate-700">
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">Total Work:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {typeof currentTask.workHours === "number" ? `${currentTask.workHours}h` : `${(currentTask.duration || 1) * 8}h`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-100">
                      <span className="text-slate-500">Allocation:</span>
                      <span className="font-mono font-bold text-slate-800">
                        {Math.round((currentTask.assignmentUnits ?? 1.0) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Over-allocation warning banner */}
                  {currentTask.overallocated && (
                    <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 flex items-start gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Resource Over-allocated:</span> Peak workload is{" "}
                        <span className="font-mono font-bold">{currentTask.peakAllocationPercent}%</span>{" "}
                        (exceeds 100% daily availability).
                      </div>
                    </div>
                  )}

                  {/* Constraints & Deadlines Info */}
                  <div className="pt-2 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Constraint:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {String(currentTask.constraintType || "ASAP")}
                        {currentTask.constraintDate ? ` (${currentTask.constraintDate})` : ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Milestone Deadline:</span>
                      <span className="font-mono font-medium text-slate-800">
                        {currentTask.deadline || "None"}
                      </span>
                    </div>

                    {currentTask.deadlineViolated && (
                      <div className="rounded border border-red-200 bg-red-50 p-2 text-[11px] text-red-800 flex items-start gap-1.5">
                        <AlertOctagon className="h-3.5 w-3.5 text-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Deadline Violated:</span> Activity finish is{" "}
                          <span className="font-mono font-bold">+{currentTask.daysPastDeadline || 1}d</span> past contractual deadline!
                        </div>
                      </div>
                    )}

                    {currentTask.constraintConflict && (
                      <div className="rounded border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800 flex items-start gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold">Constraint Conflict:</span>{" "}
                          {currentTask.constraintConflictReason || "Predecessor pushes task past constraint limit."}
                        </div>
                      </div>
                    )}

                    {currentTask.forecastFinish && (
                      <div className="flex items-center justify-between bg-blue-50/60 p-1.5 rounded border border-blue-200/60">
                        <span className="text-blue-700 font-medium">Status Date Forecast Finish:</span>
                        <span className="font-mono font-bold text-blue-900">
                          {currentTask.forecastFinish}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Section 3: Responsibility & Trade */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-blue-600" />
                  Responsibility & Trade
                </span>
                <div className="flex items-center gap-1.5">
                  {currentTask.costCode && (
                    <span className="font-mono text-[10.5px] font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      {currentTask.costCode}
                    </span>
                  )}
                  {currentTask.trade && (
                    <span className="text-[10.5px] font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                      {String(currentTask.trade)}
                    </span>
                  )}
                </div>
              </div>

              {/* Strict 3-Way Distinction: Resource Assignment, Subcontractor, Attendance */}
              <div className="pt-2 border-t border-slate-100">
                <TaskResourceAttendanceSection
                  task={currentTask}
                  projectResources={projectResources}
                  onAssignResource={(asgn) => assignResourceToTask(currentTask.id, asgn)}
                  onRemoveResource={(asgnId) => removeResourceFromTask(currentTask.id, asgnId)}
                  onLinkSubcontractor={(vendorId, vendorName) =>
                    linkTaskSubcontractor(currentTask.id, vendorId, vendorName)
                  }
                  onRecordAttendance={(att) => recordSiteAttendance(currentTask.id, att)}
                />
              </div>
            </div>

            {/* Section 4: Sequencing & Dependencies */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-blue-600" />
                  Sequencing & Dependencies ({depCount})
                </span>
                <button
                  type="button"
                  onClick={handleOpenAddDependency}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Link</span>
                </button>
              </div>

              {/* Predecessors */}
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Predecessors ({currentTaskPredLinks.length})
                </span>
                {currentTaskPredLinks.length > 0 ? (
                  <div className="space-y-1">
                    {currentTaskPredLinks.map((pred) => {
                      const pTask = state.tasks.find((t) => t.id === pred.id);
                      return (
                        <div
                          key={pred.id}
                          onClick={() => selectTask(pred.id)}
                          className="group flex items-center justify-between p-2 rounded-lg border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                pTask?.status === "complete"
                                  ? "bg-emerald-500"
                                  : pTask?.status === "blocked"
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-[12px] text-slate-800 group-hover:text-blue-600 truncate block">
                                {pred.name || pTask?.name || pred.id}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {pred.id} {pTask?.displayEnd ? `· Finishes ${pTask.displayEnd}` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200/80 font-mono text-[10.5px] font-bold text-blue-700">
                              {pred.type}
                            </span>
                            {pred.lag !== 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                  pred.lag > 0
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                }`}
                              >
                                {pred.lag > 0 ? `+${pred.lag}d lag` : `${pred.lag}d lead`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-slate-400 italic">No direct predecessors</p>
                )}
              </div>

              {/* Successors */}
              <div className="space-y-1.5 pt-1 border-t border-slate-100">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  Successors ({currentTaskSuccLinks.length})
                </span>
                {currentTaskSuccLinks.length > 0 ? (
                  <div className="space-y-1">
                    {currentTaskSuccLinks.map((succ) => {
                      const sTask = state.tasks.find((t) => t.id === succ.id);
                      return (
                        <div
                          key={succ.id}
                          onClick={() => selectTask(succ.id)}
                          className="group flex items-center justify-between p-2 rounded-lg border border-slate-200/70 hover:border-blue-300 hover:bg-blue-50/40 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 pr-1">
                            <span
                              className={`h-2 w-2 rounded-full shrink-0 ${
                                sTask?.status === "complete"
                                  ? "bg-emerald-500"
                                  : sTask?.status === "blocked"
                                  ? "bg-red-500"
                                  : "bg-blue-500"
                              }`}
                            />
                            <div className="min-w-0">
                              <span className="font-medium text-[12px] text-slate-800 group-hover:text-blue-600 truncate block">
                                {succ.name || sTask?.name || succ.id}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                {succ.id} {sTask?.displayStart ? `· Starts ${sTask.displayStart}` : ""}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200/80 font-mono text-[10.5px] font-bold text-blue-700">
                              {succ.type}
                            </span>
                            {succ.lag !== 0 && (
                              <span
                                className={`px-1.5 py-0.5 rounded font-mono text-[10px] font-semibold ${
                                  succ.lag > 0
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-indigo-50 text-indigo-700 border border-indigo-200"
                                }`}
                              >
                                {succ.lag > 0 ? `+${succ.lag}d lag` : `${succ.lag}d lead`}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[11.5px] text-slate-400 italic">No direct successors</p>
                )}
              </div>

              {/* View Full Dependencies Tab Link */}
              <div className="pt-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveTab("dependencies")}
                  className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <span>Open full dependency editor</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            </div>

            {/* Section 5: Scope & Description */}
            <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold text-slate-700 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Scope & Activity Description
                </span>
                {!isEditingDesc && (
                  <button
                    type="button"
                    onClick={handleStartEditDesc}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-0.5 rounded transition-colors"
                  >
                    <Edit2 className="h-3 w-3" />
                    <span>Edit</span>
                  </button>
                )}
              </div>

              {isEditingDesc ? (
                <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-2.5 space-y-2">
                  <textarea
                    rows={3}
                    value={editDescValue}
                    onChange={(e) => setEditDescValue(e.target.value)}
                    placeholder="Enter activity scope, specifications, or handover notes..."
                    className="w-full rounded border border-slate-300 bg-white p-2 text-[12.5px] text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => setIsEditingDesc(false)}
                      className="px-2 py-1 text-[11px] text-slate-600 hover:text-slate-800 rounded border border-slate-200 bg-white hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveDesc}
                      className="px-2.5 py-1 text-[11px] font-medium text-white bg-blue-600 hover:bg-blue-700 rounded shadow-xs"
                    >
                      Save Scope
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-slate-600 leading-relaxed text-[12px] bg-slate-50/50 p-2 rounded border border-slate-100">
                  {currentTask.description ||
                    "Reinforced concrete columns to Level 2 as per structural drawings and specifications."}
                </p>
              )}

              {/* Site Photos Gallery */}
              <div className="pt-1.5 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Site Inspection Photos
                  </span>
                  <button
                    type="button"
                    onClick={() => setNoteModalOpen(true)}
                    className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Camera className="h-3 w-3" />
                    <span>Add Photo</span>
                  </button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                    <img
                      src="/bim-digital-twin.jpg"
                      alt="Photo 1"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">
                      Pour #4
                    </span>
                  </div>
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                    <img
                      src="/bim-hero-original.jpg"
                      alt="Photo 2"
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">
                      Rebar
                    </span>
                  </div>
                  <div
                    onClick={() => setNoteModalOpen(true)}
                    className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 group cursor-pointer hover:bg-slate-200/60 transition-colors"
                  >
                    <span className="text-[12px] font-bold text-slate-600">+3</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "dependencies" && (
          <div className="space-y-5">
            {/* Header Action Bar */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[12px] font-bold uppercase tracking-wider text-slate-800">
                  Task Dependencies
                </span>
                <p className="text-[11px] text-slate-400">
                  Manage predecessors, successors, and working day lag/lead.
                </p>
              </div>
              <button
                id="add-dependency-btn"
                type="button"
                onClick={handleOpenAddDependency}
                className="inline-flex items-center gap-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200/80 px-2.5 py-1 text-[11.5px] font-semibold transition-colors cursor-pointer"
                title="Add predecessor dependency"
              >
                <Plus className="h-3.5 w-3.5 text-blue-600" />
                <span>Link Dependency</span>
              </button>
            </div>

            {/* Predecessors Section: Microsoft Project Interactive Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    What Must Happen Before (Predecessors)
                  </h4>
                  <p className="text-[10.5px] text-slate-400">
                    Tasks that control when this activity can start or finish.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {currentTaskPredLinks.length} linked
                  </span>
                </div>
              </div>

              {/* Table or Empty State */}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2 px-3">Predecessor Task</th>
                      <th className="py-2 px-2.5 w-32">Type</th>
                      <th className="py-2 px-2.5 w-24">Lag</th>
                      <th className="py-2 px-2 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentTaskPredLinks.length > 0 ? (
                      currentTaskPredLinks.map((pred) => {
                        const predTask = state.tasks.find((t) => t.id === pred.id);
                        return (
                          <tr key={pred.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-2 px-3">
                              <div
                                onClick={() => selectTask(pred.id)}
                                className="font-medium text-slate-900 hover:text-blue-600 cursor-pointer transition-colors truncate max-w-[190px]"
                                title={predTask?.name || pred.id}
                              >
                                <span className="font-mono text-[11px] text-slate-400 mr-1.5 font-semibold">
                                  {predTask?.wbs || pred.id}
                                </span>
                                {predTask?.name || pred.id}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Finish: {predTask?.displayEnd || predTask?.endDate || "—"}
                              </div>
                            </td>
                            <td className="py-2 px-2.5">
                              <select
                                value={pred.type}
                                onChange={(e) =>
                                  updateDependency(pred.id, currentTask.id, e.target.value as DependencyType, pred.lag)
                                }
                                className="w-full text-[11.5px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:border-blue-500"
                              >
                                <option value="FS">FS (Finish-Start)</option>
                                <option value="SS">SS (Start-Start)</option>
                                <option value="FF">FF (Finish-Finish)</option>
                                <option value="SF">SF (Start-Finish)</option>
                              </select>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={pred.lag}
                                  onChange={(e) =>
                                    updateDependency(
                                      pred.id,
                                      currentTask.id,
                                      pred.type,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-14 text-[11.5px] font-mono text-center bg-white border border-slate-200 rounded px-1 py-1 text-slate-800 outline-none focus:border-blue-500"
                                  placeholder="0"
                                />
                                <span className="text-[11px] text-slate-400">d</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeDependency(pred.id, currentTask.id)}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Unlink predecessor"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[11.5px] text-slate-400 italic">
                          No predecessor activities linked to this task.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Inline Quick-Add Predecessor Row */}
                <form
                  onSubmit={handleAddPredInline}
                  className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2"
                >
                  <div className="flex-1 min-w-[150px]">
                    <select
                      id="inline-add-pred-select"
                      value={newPredSelectId}
                      onChange={(e) => setNewPredSelectId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    >
                      <option value="">+ Link Predecessor Activity...</option>
                      {candidatePredecessors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.wbs ? `[${t.wbs}] ` : ""}{t.name.slice(0, 38)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <select
                      value={newPredType}
                      onChange={(e) => setNewPredType(e.target.value as DependencyType)}
                      className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                      <option value="FF">FF</option>
                      <option value="SF">SF</option>
                    </select>
                  </div>
                  <div className="w-16 flex items-center gap-1">
                    <input
                      type="number"
                      value={newPredLag}
                      onChange={(e) => setNewPredLag(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-xs font-mono text-center bg-white border border-slate-200 rounded px-1.5 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    />
                    <span className="text-[11px] text-slate-400">d</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!newPredSelectId}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Link</span>
                  </button>
                </form>
              </div>
            </div>

            {/* Successors Section: Microsoft Project Interactive Table */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    What Happens After (Successors)
                  </h4>
                  <p className="text-[10.5px] text-slate-400">
                    Downstream tasks driven by completion or start of this activity.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">
                    {currentTaskSuccLinks.length} linked
                  </span>
                </div>
              </div>

              {/* Successor Table */}
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xs">
                <table className="w-full text-left text-[12px] border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                      <th className="py-2 px-3">Successor Task</th>
                      <th className="py-2 px-2.5 w-32">Type</th>
                      <th className="py-2 px-2.5 w-24">Lag</th>
                      <th className="py-2 px-2 w-10 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {currentTaskSuccLinks.length > 0 ? (
                      currentTaskSuccLinks.map((succ) => {
                        const succTask = state.tasks.find((t) => t.id === succ.id);
                        return (
                          <tr key={succ.id} className="hover:bg-slate-50/80 transition-colors group">
                            <td className="py-2 px-3">
                              <div
                                onClick={() => selectTask(succ.id)}
                                className="font-medium text-slate-900 hover:text-blue-600 cursor-pointer transition-colors truncate max-w-[190px]"
                                title={succTask?.name || succ.id}
                              >
                                <span className="font-mono text-[11px] text-slate-400 mr-1.5 font-semibold">
                                  {succTask?.wbs || succ.id}
                                </span>
                                {succTask?.name || succ.id}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Start: {succTask?.displayStart || succTask?.startDate || "—"}
                              </div>
                            </td>
                            <td className="py-2 px-2.5">
                              <select
                                value={succ.type}
                                onChange={(e) =>
                                  updateDependency(currentTask.id, succ.id, e.target.value as DependencyType, succ.lag)
                                }
                                className="w-full text-[11.5px] font-medium bg-white border border-slate-200 rounded px-1.5 py-1 text-slate-700 outline-none focus:border-blue-500"
                              >
                                <option value="FS">FS (Finish-Start)</option>
                                <option value="SS">SS (Start-Start)</option>
                                <option value="FF">FF (Finish-Finish)</option>
                                <option value="SF">SF (Start-Finish)</option>
                              </select>
                            </td>
                            <td className="py-2 px-2.5">
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  value={succ.lag}
                                  onChange={(e) =>
                                    updateDependency(
                                      currentTask.id,
                                      succ.id,
                                      succ.type,
                                      parseInt(e.target.value, 10) || 0
                                    )
                                  }
                                  className="w-14 text-[11.5px] font-mono text-center bg-white border border-slate-200 rounded px-1 py-1 text-slate-800 outline-none focus:border-blue-500"
                                  placeholder="0"
                                />
                                <span className="text-[11px] text-slate-400">d</span>
                              </div>
                            </td>
                            <td className="py-2 px-2 text-center">
                              <button
                                type="button"
                                onClick={() => removeDependency(currentTask.id, succ.id)}
                                className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                                title="Unlink successor"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-[11.5px] text-slate-400 italic">
                          No successor activities linked to this task.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* Inline Quick-Add Successor Row */}
                <form
                  onSubmit={handleAddSuccInline}
                  className="p-2.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2"
                >
                  <div className="flex-1 min-w-[150px]">
                    <select
                      id="drawer-link-successor-btn"
                      value={newSuccSelectId}
                      onChange={(e) => setNewSuccSelectId(e.target.value)}
                      className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    >
                      <option value="">+ Link Successor Activity...</option>
                      {candidateSuccessors.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.wbs ? `[${t.wbs}] ` : ""}{t.name.slice(0, 38)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <select
                      value={newSuccType}
                      onChange={(e) => setNewSuccType(e.target.value as DependencyType)}
                      className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    >
                      <option value="FS">FS</option>
                      <option value="SS">SS</option>
                      <option value="FF">FF</option>
                      <option value="SF">SF</option>
                    </select>
                  </div>
                  <div className="w-16 flex items-center gap-1">
                    <input
                      type="number"
                      value={newSuccLag}
                      onChange={(e) => setNewSuccLag(parseInt(e.target.value, 10) || 0)}
                      placeholder="0"
                      className="w-full text-xs font-mono text-center bg-white border border-slate-200 rounded px-1.5 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    />
                    <span className="text-[11px] text-slate-400">d</span>
                  </div>
                  <button
                    type="submit"
                    disabled={!newSuccSelectId}
                    className="inline-flex items-center gap-1 rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-2.5 py-1.5 text-xs font-semibold shadow-xs transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Link</span>
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="space-y-4">
            {/* Task Handover Notes */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <FileText className="h-3 w-3 text-blue-600" />
                  Site Handover Notes
                </span>
                <button
                  type="button"
                  onClick={() => setNoteModalOpen(true)}
                  className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" />
                  <span>Add Note</span>
                </button>
              </div>

              {currentTask.notes ? (
                <div className="rounded bg-slate-50 p-2.5 text-[12px] text-slate-700 whitespace-pre-line border border-slate-100">
                  {currentTask.notes}
                </div>
              ) : (
                <p className="text-[11.5px] text-slate-400 italic">No notes recorded for this task</p>
              )}
            </div>

            {/* Schedule Change Audit History for this task */}
            <div className="rounded-lg border border-slate-200 bg-white p-3 space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <History className="h-3.5 w-3.5 text-blue-600" />
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Schedule Change History
                  </span>
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-bold text-blue-700 font-mono">
                    {taskAuditEvents.length}
                  </span>
                </div>

                <button
                  id="drawer-open-revisions-btn"
                  type="button"
                  onClick={openRevisions}
                  className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Open project-wide baseline revisions and audit trail"
                >
                  <span>Project Audit Trail</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {taskAuditEvents.length > 0 ? (
                <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
                  {taskAuditEvents.map((ev) => {
                    const isCPM = ev.changeSource === "cpm-recalculation";
                    return (
                      <div
                        key={ev.id}
                        className="rounded-md border border-slate-100 bg-slate-50/70 p-2.5 text-xs space-y-1 hover:border-slate-200 transition-colors"
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-white text-slate-700 border border-slate-200">
                            {ev.fieldLabel}
                          </span>
                          <span className="text-slate-400 font-mono text-[10.5px]">
                            {ev.timestamp.replace("T", " ").slice(0, 16)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 font-mono text-[11.5px]">
                          <span className="text-slate-500">{ev.previousValue !== null ? String(ev.previousValue) : "—"}</span>
                          <ArrowRight className="h-3 w-3 text-slate-400 shrink-0" />
                          <span className="font-semibold text-blue-700">{ev.newValue !== null ? String(ev.newValue) : "—"}</span>
                        </div>

                        <div className="flex items-center justify-between text-[10.5px] text-slate-500 pt-0.5">
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            <strong>{ev.changedBy}</strong> {ev.userRole ? `(${ev.userRole})` : ""}
                          </span>
                          <span
                            className={`px-1 py-0.2 rounded font-semibold text-[9.5px] ${
                              isCPM ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                            }`}
                          >
                            {ev.changeSource}
                          </span>
                        </div>

                        {ev.reason && (
                          <p className="text-[10.5px] text-slate-500 italic mt-0.5 border-t border-slate-200/50 pt-1">
                            "{ev.reason}"
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-[11.5px] text-slate-400 italic">
                    No schedule changes recorded yet for this task.
                  </p>
                  <p className="text-[10.5px] text-slate-400 mt-1">
                    Edits to duration, dates, progress, or dependencies are tracked here automatically.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-[12.5px] font-medium text-slate-800">
                  STR-L2-COL-REV-C.pdf
                </span>
              </div>
              <span className="text-[11px] text-slate-400">2.4 MB</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 hover:bg-slate-50">
              <div className="flex items-center gap-2.5">
                <FileText className="h-4 w-4 text-emerald-600" />
                <span className="text-[12.5px] font-medium text-slate-800">
                  Concrete-Test-Batch-32MPa.pdf
                </span>
              </div>
              <span className="text-[11px] text-slate-400">840 KB</span>
            </div>
          </div>
        )}

        {(activeTab as any) === "qa" && (
          <div className="space-y-3.5 text-[12.5px]">
            {/* Header Inspection Card (Taste adoption from Image 1) */}
            <div className="rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">#17 Quality Inspection</span>
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                  Ready for Review
                </span>
              </div>
              <h4 className="text-[14px] font-bold text-slate-900 mt-1">
                Level 2 Concrete Column Verification
              </h4>
              <p className="text-[11.5px] text-slate-600 mt-0.5 leading-snug">
                Formwork verticality, rebar cover, and concrete mix slump verified against structural CAD model.
              </p>

              {/* Glowing Warm Amber CTA Button (from Image 1) */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => alert("Actions menu: Approve QA Signoff / Request Core Test / Flag Discrepancy")}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 px-3 py-2 text-[12px] font-bold text-white shadow-xs hover:from-amber-600 hover:to-orange-600 transition-all"
                >
                  <span>Actions</span>
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="rounded-lg border border-slate-200/70 bg-white px-2.5 py-1.5 text-center shadow-2xs">
                  <div className="text-[13px] font-bold text-slate-900 leading-none">0.5 bar</div>
                  <div className="text-[9.5px] text-slate-400 mt-0.5">Hydraulic</div>
                </div>
              </div>
            </div>

            {/* 2D Architectural Floor Plan Location Card (from Image 1 & 2) */}
            <div className="rounded-xl border border-slate-200/70 bg-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11.5px] font-bold text-slate-900">Location</span>
                <span className="text-[10.5px] font-medium text-slate-500">Level 2 / Zone B</span>
              </div>
              <p className="text-[11px] text-slate-500 mb-2">Workfront active on North Column Grid C-E</p>

              {/* 2D Architectural Schematic Floor Map */}
              <div className="relative h-24 w-full rounded-lg border border-slate-200 bg-slate-50/80 p-2 overflow-hidden flex items-center justify-center">
                <svg className="h-full w-full opacity-80" viewBox="0 0 240 80">
                  {/* Architectural grid rooms */}
                  <rect x="10" y="10" width="40" height="60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="55" y="10" width="50" height="35" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="55" y="50" width="50" height="20" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  <rect x="110" y="10" width="60" height="60" fill="none" stroke="#cbd5e1" strokeWidth="1" />
                  {/* Active Highlighted Orange Room from Image 1 & 2 */}
                  <rect x="175" y="15" width="55" height="50" fill="rgba(245, 158, 11, 0.2)" stroke="#f59e0b" strokeWidth="2" rx="4" />
                  <circle cx="202" cy="40" r="4" fill="#f59e0b" />
                  <circle cx="30" cy="40" r="1.5" fill="#94a3b8" />
                  <circle cx="80" cy="27" r="1.5" fill="#94a3b8" />
                  <circle cx="140" cy="40" r="1.5" fill="#94a3b8" />
                </svg>
                <span className="absolute bottom-1.5 right-2 rounded bg-amber-500/90 text-white font-bold text-[9px] px-1.5 py-0.2">
                  Grid C-E Active
                </span>
              </div>
            </div>

            {/* Due Date Bar Chart Widget (from Image 1) */}
            <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11.5px] font-bold text-slate-900">Due Date</span>
                  <p className="text-[11px] text-slate-500">Target Pour Signoff</p>
                </div>
                <span className="text-[18px] font-bold text-slate-900">Jan 9</span>
              </div>

              {/* Timeline mini-bar chart */}
              <div className="flex items-end justify-between gap-1.5 mt-2 h-8 pt-1">
                {["Jan 5", "Jan 7", "Jan 9", "Jan 11", "Jan 13"].map((d) => {
                  const isTarget = d === "Jan 9";
                  return (
                    <div key={d} className="flex-1 flex flex-col items-center gap-1">
                      <div
                        className={`w-1 rounded-full transition-all ${
                          isTarget ? "h-6 bg-amber-500" : "h-2 bg-slate-200"
                        }`}
                      />
                      <span className={`text-[9px] font-medium ${isTarget ? "text-amber-600 font-bold" : "text-slate-400"}`}>
                        {d}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Multi-Phase Stepped Progress Bar (from Image 1) */}
            <div className="rounded-xl border border-slate-200/70 bg-white p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11.5px] font-bold text-slate-900">Installation Progress</span>
                <span className="text-[12px] font-bold text-amber-600">60%</span>
              </div>
              <p className="text-[10.5px] text-slate-400 mb-2.5">Phase 2: Columns Casting & Curing</p>

              {/* Stepped line */}
              <div className="relative flex items-center justify-between">
                <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1 bg-slate-200 z-0">
                  <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-500 w-[60%]" />
                </div>
                {["Phase 1", "Phase 2", "Phase 3", "Done"].map((phase, idx) => {
                  const isDone = idx === 0;
                  const isCurrent = idx === 1;
                  return (
                    <div key={phase} className="relative z-10 flex flex-col items-center">
                      <div
                        className={`h-3 w-3 rounded-full border-2 ${
                          isDone
                            ? "bg-emerald-500 border-white"
                            : isCurrent
                            ? "bg-amber-500 border-white ring-2 ring-amber-200"
                            : "bg-white border-slate-300"
                        }`}
                      />
                      <span className="text-[9.5px] font-medium text-slate-500 mt-1">{phase}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === "integrations" && (
          <div className="space-y-4 text-[12.5px]">
            {/* Header / Subtitle */}
            <div className="rounded-xl border border-indigo-200/80 bg-gradient-to-br from-indigo-50/70 via-white to-indigo-50/30 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5 text-indigo-600" />
                  Construction Module Integrations
                </span>
                <span className="rounded-full bg-indigo-100 border border-indigo-200 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                  Live Sync
                </span>
              </div>
              <p className="text-[11.5px] text-slate-600 mt-1 leading-snug">
                Unified bridge linking this activity to BOQ measurement, vendor trade subcontracts, site diary shift logs, and technical drawings.
              </p>
            </div>

            {/* 1. Bill of Quantities (BOQ) & Cost Code */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Receipt className="h-3.5 w-3.5 text-blue-600" />
                  Bill of Quantities (BOQ) & Measurement
                </span>
                <span className="text-[11px] font-mono text-slate-500">
                  {currentTask.integrations?.boq?.code || currentTask.costCode || "BOQ-03-3100"}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-200 p-2.5 space-y-2">
                <div className="text-[12px] font-medium text-slate-800">
                  {currentTask.integrations?.boq?.description || `${currentTask.name} - Measured Works`}
                </div>
                <div className="grid grid-cols-3 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-400 block text-[10px]">Planned Qty</span>
                    <span className="font-semibold text-slate-800">
                      {currentTask.integrations?.boq?.quantity ?? 120} {currentTask.integrations?.boq?.unit || "m³"}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Unit Rate</span>
                    <span className="font-semibold text-slate-800">
                      £{currentTask.integrations?.boq?.rate ?? 340}/unit
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">Total Value</span>
                    <span className="font-semibold text-slate-800">
                      £{(currentTask.integrations?.boq?.totalValue ?? (currentTask.cost || 40800)).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Earned Value Progress Bar */}
                <div className="pt-1">
                  <div className="flex items-center justify-between text-[10.5px] mb-1">
                    <span className="text-slate-500">
                      Measured to Date: {currentTask.integrations?.boq?.measuredQuantityToDate ?? Math.round((currentTask.progress / 100) * 120)} m³
                    </span>
                    <span className="font-bold text-emerald-700">
                      Earned: £{Math.round(((currentTask.integrations?.boq?.totalValue || currentTask.cost || 40800) * currentTask.progress) / 100).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-emerald-500 h-full rounded-full transition-all"
                      style={{ width: `${Math.min(100, Math.max(0, currentTask.progress))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Vendor Trade Contract & Application for Payment (AFP) */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5 text-indigo-600" />
                  Vendor Trade Contract & AFP
                </span>
                <span className="text-[10.5px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {currentTask.integrations?.vendorContract?.valuationStatus || "certified"}
                </span>
              </div>

              <div className="rounded-lg bg-slate-50/80 border border-slate-200 p-2.5 space-y-2 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Contractor:</span>
                  <span className="font-semibold text-slate-900">
                    {currentTask.integrations?.vendorContract?.subcontractorName || currentTask.subcontractor || currentTask.assignee || "Specialist Contractor Ltd"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Package Ref:</span>
                  <span className="font-mono text-slate-700">
                    {currentTask.integrations?.vendorContract?.contractPackageId || `SC-${currentTask.trade?.toUpperCase() || "TRADE"}-01`}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Contract Sum:</span>
                  <span className="font-semibold text-slate-900">
                    £{(currentTask.integrations?.vendorContract?.contractSum ?? (currentTask.cost ? currentTask.cost * 1.1 : 52000)).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Retention Held (5%):</span>
                  <span className="font-semibold text-amber-700">
                    £{Math.round(((currentTask.integrations?.vendorContract?.contractSum ?? (currentTask.cost ? currentTask.cost * 1.1 : 52000)) * 0.05)).toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Claimed Progress:</span>
                  <span className="font-bold text-blue-700">
                    {currentTask.subcontractorClaimedProgress !== undefined ? `${currentTask.subcontractorClaimedProgress}%` : `${currentTask.progress}%`}
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Daily Site Diary Logs */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                  <HardHat className="h-3.5 w-3.5 text-amber-600" />
                  Site Diary Shift Logs ({currentTask.integrations?.siteDiary?.length || 2})
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const newEntry = {
                      id: "diary-" + Date.now(),
                      date: new Date().toISOString().split("T")[0],
                      shiftHours: 8.5,
                      weather: "Dry / Overcast",
                      temperatureC: 16,
                      operativesCount: 6,
                      notes: "Full team on site. Production matching programmed rate.",
                      plantOnSite: ["Mobile Crane 50t", "Compressor"],
                    };
                    const existing = currentTask.integrations?.siteDiary || [];
                    updateTaskIntegrations(currentTask.id, {
                      siteDiary: [newEntry, ...existing],
                    });
                  }}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800"
                >
                  <Plus className="h-3 w-3" />
                  <span>Log Shift</span>
                </button>
              </div>

              <div className="space-y-2">
                {(currentTask.integrations?.siteDiary || [
                  {
                    id: "diary-1",
                    date: "2025-10-15",
                    shiftHours: 8.5,
                    weather: "Clear",
                    temperatureC: 18,
                    operativesCount: 8,
                    notes: "Concrete pour sign-off complete. Shuttering struck safely.",
                    plantOnSite: ["Concrete Pump 36m", "Tower Crane 1"],
                  },
                  {
                    id: "diary-2",
                    date: "2025-10-14",
                    shiftHours: 8.0,
                    weather: "Light Rain",
                    temperatureC: 14,
                    operativesCount: 7,
                    notes: "Rebar fixing progressed on south bays. ITP pre-pour inspection passed.",
                    plantOnSite: ["Telehandler"],
                  },
                ]).map((entry: any) => (
                  <div key={entry.id} className="rounded-lg bg-slate-50 border border-slate-200 p-2.5 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between font-semibold text-slate-800">
                      <span>{entry.date} ({entry.shiftHours}h shift)</span>
                      <span className="flex items-center gap-2 text-slate-500 text-[10px]">
                        <span>{entry.operativesCount} operatives</span>
                        <span>•</span>
                        <span>{entry.temperatureC}°C {entry.weather}</span>
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11.5px] leading-snug">{entry.notes}</p>
                    {entry.plantOnSite && entry.plantOnSite.length > 0 && (
                      <div className="flex items-center gap-1 flex-wrap pt-0.5">
                        {entry.plantOnSite.map((p: string, idx: number) => (
                          <span key={idx} className="rounded bg-white border border-slate-200 px-1.5 py-0.2 text-[9.5px] text-slate-600">
                            {p}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 4. Technical Document Register & QA ITP */}
            <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-bold text-slate-900 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-600" />
                  Technical Documents & Drawing Register
                </span>
                <span className="text-[11px] text-slate-400">
                  {currentTask.integrations?.documents?.length || 2} documents
                </span>
              </div>

              <div className="space-y-1.5">
                {(currentTask.integrations?.documents || [
                  {
                    id: "doc-1",
                    docNumber: `DRG-${currentTask.wbs || "STR"}-001`,
                    title: `${currentTask.name} - General Arrangement & Details`,
                    revision: "Rev C",
                    type: "Drawing",
                    status: "Approved",
                  },
                  {
                    id: "doc-2",
                    docNumber: `ITP-${currentTask.trade?.toUpperCase() || "STR"}-102`,
                    title: `Inspection & Test Plan: ${currentTask.name}`,
                    revision: "Rev 2",
                    type: "ITP",
                    status: "Approved",
                  },
                ]).map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between rounded-lg bg-slate-50 border border-slate-200 p-2 text-[11px]">
                    <div>
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        <span className="font-mono text-blue-700">{doc.docNumber}</span>
                        <span className="rounded bg-slate-200 px-1 text-[9.5px] font-bold text-slate-700">{doc.revision}</span>
                      </div>
                      <div className="text-slate-500 text-[10.5px] truncate max-w-[220px]">{doc.title}</div>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700">
                      {doc.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Drawer Bottom Actions */}
      <div className="border-t border-slate-200 px-4 py-2.5 flex items-center gap-2 bg-slate-50/70 shrink-0">
        <button
          type="button"
          onClick={() => setNoteModalOpen(true)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2 text-[12px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <Camera className="h-3.5 w-3.5 text-slate-500" />
          <span>Site Note / Photo</span>
        </button>
        <button
          type="button"
          onClick={() => {
            setNewProgressValue(currentTask.progress);
            setNewStatusValue(currentTask.status);
            setSubcontractorClaimValue(currentTask.subcontractorClaimedProgress ?? currentTask.progress);
            setSubcontractorClaimNotes(currentTask.subcontractorClaimNotes ?? "");
            setProgressModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
          title="Open detailed progress dialog"
        >
          <span>Advanced</span>
        </button>
      </div>

      {/* Modal: Update Progress & Subcontractor Claim */}
      {progressModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-base">Progress & Valuation Review</h4>
                <p className="text-[11px] text-slate-400">
                  Certified progress vs subcontractor claim submissions
                </p>
              </div>
              <button
                onClick={() => setProgressModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Statutory Compliance Notice Banner */}
            <div className="rounded-lg bg-amber-50/90 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-relaxed">
              <span className="font-bold block text-amber-950 mb-0.5">
                Statutory & Contractual Compliance Notice
              </span>
              Subcontractor progress submissions must be distinguished from verified physical progress. Site attendance or photos do not automatically constitute certified completion or contractual payment entitlement.
            </div>

            <div className="space-y-4 text-[13px]">
              <div>
                <label className="text-slate-400 text-xs font-medium">Activity</label>
                <div className="font-semibold text-slate-900">
                  <span className="font-mono text-slate-400 mr-1.5">{currentTask.wbs || currentTask.id}</span>
                  {currentTask.name}
                </div>
              </div>

              {/* Section 1: Certified Physical Progress */}
              <div className="rounded-lg border border-blue-100 bg-blue-50/30 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                    Certified Physical Progress
                  </span>
                  <span className="font-bold text-blue-700 text-sm font-mono">{newProgressValue}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={newProgressValue}
                  onChange={(e) => setNewProgressValue(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />

                <div>
                  <label className="text-slate-600 text-xs font-medium block mb-1">Status</label>
                  <select
                    value={newStatusValue}
                    onChange={(e) => setNewStatusValue(e.target.value as TaskStatus)}
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                  >
                    <option value="not-started">Not Started</option>
                    <option value="in-progress">In Progress</option>
                    <option value="complete">Complete</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </div>

              {/* Section 2: Subcontractor Claim Submission */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Subcontractor Claim Submission
                  </span>
                  <span className="font-mono text-xs font-bold text-slate-700">
                    {subcontractorClaimValue}% Claimed
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={subcontractorClaimValue}
                    onChange={(e) => setSubcontractorClaimValue(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                    className="w-20 rounded-md border border-slate-300 bg-white p-1.5 text-xs text-center font-mono font-bold text-slate-800 outline-none focus:border-blue-500"
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={subcontractorClaimValue}
                    onChange={(e) => setSubcontractorClaimValue(Number(e.target.value))}
                    className="flex-1 accent-slate-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-slate-600 text-xs font-medium block mb-1">
                    Claim Notes / Subcontractor Reference
                  </label>
                  <input
                    type="text"
                    value={subcontractorClaimNotes}
                    onChange={(e) => setSubcontractorClaimNotes(e.target.value)}
                    placeholder="e.g. AFP #4 submitted by Trade Contractor; pending site measure"
                    className="w-full rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setProgressModalOpen(false)}
                className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProgress}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs transition-colors"
              >
                Save & Record Valuation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Note / Photo */}
      {noteModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">Add Note / Site Photo</h4>
              <button
                onClick={() => setNoteModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="text-slate-500 font-medium block mb-1">Site Observation Note</label>
                <textarea
                  rows={3}
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Record pour status, weather impact, inspection notes..."
                  className="w-full rounded-lg border border-slate-200 p-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border border-dashed border-slate-200 p-3 bg-slate-50">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-slate-500" />
                  <span className="text-[12px] text-slate-600">
                    {photoAdded ? "Column-Pour-Inspection.jpg" : "Attach inspection photo"}
                  </span>
                </div>
                <button
                  onClick={() => setPhotoAdded(!photoAdded)}
                  className="text-[12px] font-medium text-blue-600 hover:underline"
                >
                  {photoAdded ? "Remove" : "Attach"}
                </button>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setNoteModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNote}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dependency Editor Modal Dialog */}
      <DependencyEditorModal
        isOpen={depModalOpen}
        onClose={() => setDepModalOpen(false)}
        currentTask={currentTask}
        initialPredecessorId={depModalPredId}
        initialType={depModalType}
        initialLag={depModalLag}
        isEditing={depModalEditing}
      />
    </div>
  );
}
