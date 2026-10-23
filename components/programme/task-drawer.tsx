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
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus, DependencyType } from "@/lib/programme-types";
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
    scheduleAuditLog,
    openRevisions,
  } = useProgramme();
  const [activeTab, setActiveTab] = useState<"details" | "dependencies" | "updates" | "files">("details");

  // Modals / dropdowns for interactive actions
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [newProgressValue, setNewProgressValue] = useState(60);
  const [newStatusValue, setNewStatusValue] = useState<TaskStatus>("in-progress");

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

  if (!state.drawerOpen || !state.selectedTaskId) {
    return null;
  }

  // Find currently selected task or fallback
  const currentTask =
    state.tasks.find((t) => t.id === state.selectedTaskId) ||
    state.tasks.find((t) => t.id === "PRG-021") ||
    state.tasks.find((t) => t.id === "task-columns")!;

  // Dynamic extracted predecessor links
  const currentTaskPredLinks = useMemo(() => {
    return getTaskPredecessorLinks(currentTask);
  }, [currentTask]);

  // Dynamic extracted successor links
  const currentTaskSuccLinks = useMemo(() => {
    const list: { id: string; name?: string; type: DependencyType; lag: number }[] = [];
    const seen = new Set<string>();

    for (const task of state.tasks) {
      const preds = getTaskPredecessorLinks(task);
      const match = preds.find((p) => p.id === currentTask.id);
      if (match && !seen.has(task.id)) {
        seen.add(task.id);
        list.push({
          id: task.id,
          name: task.name,
          type: match.type,
          lag: match.lag,
        });
      }
    }

    if (currentTask.successors) {
      for (const succId of currentTask.successors) {
        if (!seen.has(succId)) {
          seen.add(succId);
          const succTask = state.tasks.find((t) => t.id === succId);
          list.push({
            id: succId,
            name: succTask?.name || succId,
            type: "FS",
            lag: 0,
          });
        }
      }
    }

    return list;
  }, [state.tasks, currentTask]);

  // Task-specific schedule change audit history
  const taskAuditEvents = useMemo(() => {
    return scheduleAuditLog.filter((ev) => ev.taskId === currentTask.id);
  }, [scheduleAuditLog, currentTask.id]);

  const handleSaveProgress = () => {
    updateTaskProgress(currentTask.id, newProgressValue, newStatusValue);
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

              {/* Subcontractor / Assignee Dropdown */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-slate-500 text-[11.5px] font-medium">Assigned Subcontractor / Resource</span>
                </div>
                <ResourceAssignmentDropdown
                  taskId={currentTask.id}
                  taskName={currentTask.name}
                  currentAssignee={currentTask.assignee}
                  currentInitials={currentTask.assigneeInitials}
                  currentSubcontractor={currentTask.subcontractor}
                  compact={false}
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

            {/* Predecessors Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  What Must Happen Before (Predecessors)
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentTaskPredLinks.length} linked
                </span>
              </div>

              <div className="space-y-2">
                {currentTaskPredLinks.length > 0 ? (
                  currentTaskPredLinks.map((pred) => {
                    const predTask = state.tasks.find((t) => t.id === pred.id);
                    const typeColor =
                      pred.type === "SS"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : pred.type === "FF"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : pred.type === "SF"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200";

                    return (
                      <div
                        key={pred.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-500">
                              {pred.id}
                            </span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeColor}`}
                            >
                              {pred.type}
                            </span>
                            {pred.lag !== 0 && (
                              <span className="font-mono text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                                {pred.lag > 0 ? `+${pred.lag}d lag` : `${pred.lag}d lead`}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDependency(pred.id, pred.type, pred.lag)}
                              className="rounded p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                              title="Edit relationship type and lag/lead"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeDependency(pred.id, currentTask.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Unlink predecessor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div
                          onClick={() => selectTask(pred.id)}
                          className="font-semibold text-[13px] text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {predTask?.name || pred.name || pred.id}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100">
                          <span>{formatDependencyRelation(pred.type, pred.lag, true)}</span>
                          <span className="font-mono text-slate-400">
                            {predTask?.displayEnd || predTask?.endDate || "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-[12px] text-slate-400 italic mb-2">No preceding tasks linked</p>
                    <button
                      type="button"
                      onClick={handleOpenAddDependency}
                      className="inline-flex items-center gap-1 text-[11.5px] font-medium text-blue-600 hover:underline"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Link Predecessor</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Successors Section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  What Happens After (Successors)
                </h4>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentTaskSuccLinks.length} linked
                </span>
              </div>

              <div className="space-y-2">
                {currentTaskSuccLinks.length > 0 ? (
                  currentTaskSuccLinks.map((succ) => {
                    const succTask = state.tasks.find((t) => t.id === succ.id);
                    const typeColor =
                      succ.type === "SS"
                        ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                        : succ.type === "FF"
                        ? "bg-purple-50 text-purple-700 border-purple-200"
                        : succ.type === "SF"
                        ? "bg-amber-50 text-amber-700 border-amber-200"
                        : "bg-blue-50 text-blue-700 border-blue-200";

                    return (
                      <div
                        key={succ.id}
                        className="rounded-lg border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors shadow-2xs group"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px] font-semibold text-slate-500">
                              {succ.id}
                            </span>
                            <span
                              className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded border ${typeColor}`}
                            >
                              {succ.type}
                            </span>
                            {succ.lag !== 0 && (
                              <span className="font-mono text-[10.5px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200/60">
                                {succ.lag > 0 ? `+${succ.lag}d lag` : `${succ.lag}d lead`}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => removeDependency(currentTask.id, succ.id)}
                              className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              title="Unlink successor"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div
                          onClick={() => selectTask(succ.id)}
                          className="font-semibold text-[13px] text-slate-900 hover:text-blue-600 cursor-pointer transition-colors"
                        >
                          {succTask?.name || succ.name || succ.id}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 pt-1.5 border-t border-slate-100">
                          <span>{formatDependencyRelation(succ.type, succ.lag, false)}</span>
                          <span className="font-mono text-slate-400">
                            {succTask?.displayStart || succTask?.startDate || "—"}
                          </span>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-[12px] text-slate-400 italic">No successor tasks linked</p>
                  </div>
                )}
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
            setProgressModalOpen(true);
          }}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-600 shadow-2xs hover:bg-slate-50 transition-colors"
          title="Open detailed progress dialog"
        >
          <span>Advanced</span>
        </button>
      </div>

      {/* Modal: Update Progress */}
      {progressModalOpen && (
        <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-base">Update Progress</h4>
              <button
                onClick={() => setProgressModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px]">
              <div>
                <label className="text-slate-500 font-medium">Task</label>
                <div className="font-semibold text-slate-800">{currentTask.name}</div>
              </div>

              <div>
                <div className="flex justify-between text-slate-600 mb-1">
                  <span>Progress Percentage</span>
                  <span className="font-bold text-blue-600">{newProgressValue}%</span>
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
              </div>

              <div>
                <label className="text-slate-500 font-medium block mb-1">Status</label>
                <select
                  value={newStatusValue}
                  onChange={(e) => setNewStatusValue(e.target.value as TaskStatus)}
                  className="w-full rounded-lg border border-slate-200 p-2 text-[13px] text-slate-800"
                >
                  <option value="not-started">Not Started</option>
                  <option value="in-progress">In Progress</option>
                  <option value="complete">Complete</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setProgressModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-[13px] text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProgress}
                className="px-4 py-1.5 rounded-lg bg-blue-600 text-[13px] font-semibold text-white hover:bg-blue-700"
              >
                Save Progress
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
