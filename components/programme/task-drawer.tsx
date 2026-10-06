"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus } from "@/lib/programme-types";

export function TaskDrawer() {
  const { state, closeDrawer, updateTaskProgress, addTaskNote, selectTask } = useProgramme();
  const [activeTab, setActiveTab] = useState<"details" | "dependencies" | "updates" | "files">("details");

  // Modals / dropdowns for interactive actions
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [progressModalOpen, setProgressModalOpen] = useState(false);
  const [newProgressValue, setNewProgressValue] = useState(60);
  const [newStatusValue, setNewStatusValue] = useState<TaskStatus>("in-progress");

  const [noteModalOpen, setNoteModalOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [photoAdded, setPhotoAdded] = useState(false);

  if (!state.drawerOpen || !state.selectedTaskId) {
    return null;
  }

  // Find currently selected task or fallback
  const currentTask =
    state.tasks.find((t) => t.id === state.selectedTaskId) ||
    state.tasks.find((t) => t.id === "PRG-021") ||
    state.tasks.find((t) => t.id === "task-columns")!;

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

  const isNetworkTask = currentTask.id.startsWith("PRG-");
  const depCount =
    (currentTask.predecessorDetails?.length || currentTask.predecessors?.length || 0) +
    (currentTask.successorDetails?.length || currentTask.successors?.length || 0);

  return (
    <div className="flex h-full w-[380px] shrink-0 flex-col border border-slate-200 bg-white shadow-sm select-none overflow-hidden rounded-lg">
      {/* Drawer Header */}
      <div className="flex items-start justify-between border-b border-slate-200 p-4 pb-3">
        <div className="flex-1 min-w-0 pr-2">
          {/* Task ID */}
          <div className="font-mono text-[12px] font-medium text-slate-400 mb-0.5">
            {currentTask.id}
          </div>

          {/* Task Name */}
          <h3 className="text-[15px] font-semibold text-slate-900 leading-snug">
            {currentTask.name}
          </h3>

          {/* Critical Path Badge */}
          {currentTask.isCritical && (
            <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[11px] font-semibold text-red-600">
              <Flame className="h-3 w-3 fill-red-500 text-red-500" />
              <span>Critical Path</span>
            </div>
          )}
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
          <>
            {/* Blocked Alert Banner if blocked */}
            {(currentTask.status === "blocked" || currentTask.isBlocked) && (
              <div className="rounded-lg bg-red-50/90 border border-red-200 p-2.5 text-[12px] text-red-900">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>BLOCKED</span>
                </div>
                <p className="mt-1 text-slate-700 leading-snug">
                  Blocked by:{" "}
                  <span className="font-semibold text-red-800">
                    {currentTask.blockedBy || "Ground improvement - vibro stone columns"}
                  </span>
                </p>
              </div>
            )}

            {/* Field: Status */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Status</span>
              <div className="relative">
                <button
                  onClick={() => setStatusDropdownOpen(!statusDropdownOpen)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition-colors ${
                    currentTask.status === "blocked"
                      ? "bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                      : currentTask.status === "complete"
                      ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "bg-blue-50 text-blue-700 hover:bg-blue-100"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${
                      currentTask.status === "blocked"
                        ? "bg-red-500"
                        : currentTask.status === "complete"
                        ? "bg-emerald-500"
                        : "bg-blue-500"
                    }`}
                  />
                  <span className="capitalize">{currentTask.status.replace("-", " ")}</span>
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>

                {statusDropdownOpen && (
                  <div className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-slate-200 bg-white py-1 shadow-lg z-50">
                    {(["not-started", "in-progress", "complete", "blocked"] as TaskStatus[]).map((st) => (
                      <button
                        key={st}
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

            {/* Field: Progress */}
            <div className="space-y-1 py-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Progress</span>
                <span className="font-semibold text-slate-900">{currentTask.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${currentTask.progress}%` }}
                />
              </div>
            </div>

            {/* Field: Schedule (Unified Start → Finish · Duration) */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Schedule</span>
              <div className="flex items-center gap-1.5 font-medium text-slate-800 text-[12.5px]">
                <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span>{currentTask.displayStart || "20 Dec 2025"}</span>
                <span className="text-slate-400">→</span>
                <span>{currentTask.displayEnd || "16 Jan 2026"}</span>
                <span className="text-slate-300">·</span>
                <span className="font-mono text-slate-500 text-[11.5px]">{currentTask.duration || 12}d</span>
              </div>
            </div>

            {/* Field: Cost Code */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Cost Code</span>
              <span className="font-mono text-slate-800 font-medium">{currentTask.costCode || "STR-CL-01"}</span>
            </div>

            {/* Field: Trade */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Trade</span>
              <span className="font-medium text-slate-800">{String(currentTask.trade || "Groundworks")}</span>
            </div>

            {/* Field: Assignee */}
            <div className="flex items-center justify-between py-1">
              <span className="text-slate-500">Assignee</span>
              <div className="flex items-center gap-2">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 text-[11px] font-semibold text-purple-700">
                  {currentTask.assigneeInitials || "JS"}
                </div>
                <span className="font-medium text-slate-800">{currentTask.assignee || "John Smith"}</span>
              </div>
            </div>

            {/* Description */}
            <div className="border-t border-slate-100 pt-3">
              <h4 className="text-[12px] font-semibold text-slate-900 mb-1">Description</h4>
              <p className="text-slate-600 leading-relaxed text-[12.5px]">
                {currentTask.description ||
                  "Reinforced concrete columns to Level 2 as per structural drawings and specifications."}
              </p>
            </div>

            {/* Site Photos (matching Image 4) */}
            <div className="border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-[12px] font-semibold text-slate-900">Site Inspection Photos</h4>
                <span className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer">View all (3)</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img src="/bim-digital-twin.jpg" alt="Photo 1" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">Pour #4</span>
                </div>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 group">
                  <img src="/bim-hero-original.jpg" alt="Photo 2" className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                  <span className="absolute bottom-1 right-1 rounded bg-black/60 px-1 py-0.2 text-[9px] font-bold text-white">Rebar</span>
                </div>
                <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center text-slate-400 group cursor-pointer hover:bg-slate-200/60 transition-colors">
                  <span className="text-[12px] font-bold text-slate-600">+3</span>
                </div>
              </div>
            </div>

            {/* Predecessors List (Clickable) */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <h4 className="text-[12px] font-semibold text-slate-900 uppercase tracking-wider text-slate-500">
                Predecessors
              </h4>

              {currentTask.predecessorDetails && currentTask.predecessorDetails.length > 0 ? (
                currentTask.predecessorDetails.map((pred) => (
                  <div
                    key={pred.id}
                    onClick={() => selectTask(pred.id)}
                    className="group rounded-lg border border-slate-200/80 p-2.5 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          pred.statusColor === "emerald"
                            ? "bg-emerald-500"
                            : pred.statusColor === "red"
                            ? "bg-red-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {pred.name}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate-400 pl-4 mt-0.5">
                      {pred.relation || "Finishes before this starts (FS)"}
                    </div>
                  </div>
                ))
              ) : currentTask.predecessors.length > 0 ? (
                currentTask.predecessors.map((predId) => {
                  const pTask = state.tasks.find((t) => t.id === predId);
                  return (
                    <div
                      key={predId}
                      onClick={() => selectTask(predId)}
                      className="group rounded-lg border border-slate-200/80 p-2.5 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {pTask ? `${pTask.id} ${pTask.name}` : predId}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 pl-4 mt-0.5">
                        Finishes before this starts (FS)
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-[12px] text-slate-400 italic">No direct predecessors</div>
              )}
            </div>

            {/* Successors List (Clickable) */}
            <div className="border-t border-slate-100 pt-3 space-y-2">
              <h4 className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                Successors
              </h4>

              {currentTask.successorDetails && currentTask.successorDetails.length > 0 ? (
                currentTask.successorDetails.map((succ) => (
                  <div
                    key={succ.id}
                    onClick={() => selectTask(succ.id)}
                    className="group rounded-lg border border-slate-200/80 p-2.5 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          succ.statusColor === "emerald"
                            ? "bg-emerald-500"
                            : succ.statusColor === "red"
                            ? "bg-red-500"
                            : "bg-slate-400"
                        }`}
                      />
                      <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {succ.name}
                      </span>
                    </div>
                    <div className="text-[11.5px] text-slate-400 pl-4 mt-0.5">
                      {succ.relation || "Starts after this finishes (FS)"}
                    </div>
                  </div>
                ))
              ) : currentTask.successors.length > 0 ? (
                currentTask.successors.map((succId) => {
                  const sTask = state.tasks.find((t) => t.id === succId);
                  return (
                    <div
                      key={succId}
                      onClick={() => selectTask(succId)}
                      className="group rounded-lg border border-slate-200/80 p-2.5 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-slate-400" />
                        <span className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                          {sTask ? `${sTask.id} ${sTask.name}` : succId}
                        </span>
                      </div>
                      <div className="text-[11.5px] text-slate-400 pl-4 mt-0.5">
                        Starts after this finishes (FS)
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-[12px] text-slate-400 italic">No direct successors</div>
              )}
            </div>
          </>
        )}

        {activeTab === "dependencies" && (
          <div className="space-y-4">
            <div>
              <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                What Must Happen Before (Predecessors)
              </h4>
              <div className="space-y-2">
                {currentTask.predecessors.length > 0 ? (
                  currentTask.predecessors.map((predId) => {
                    const predTask = state.tasks.find((t) => t.id === predId);
                    return (
                      <div
                        key={predId}
                        onClick={() => selectTask(predId)}
                        className="rounded-lg border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-semibold text-slate-500">
                            {predId}
                          </span>
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-emerald-600">
                            {predTask?.status || "Complete"}
                          </span>
                        </div>
                        <div className="font-bold text-[13px] text-slate-900">
                          {predTask?.name || predId}
                        </div>
                        <div className="text-[11.5px] text-slate-500 mt-1">
                          Finish-to-Start (FS) · 0 days lag
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[12.5px] text-slate-400 italic py-2">
                    No preceding tasks
                  </div>
                )}
              </div>
            </div>

            <div>
              <h4 className="text-[11.5px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                What Happens After (Successors)
              </h4>
              <div className="space-y-2">
                {currentTask.successors.length > 0 ? (
                  currentTask.successors.map((succId) => {
                    const succTask = state.tasks.find((t) => t.id === succId);
                    return (
                      <div
                        key={succId}
                        onClick={() => selectTask(succId)}
                        className="rounded-lg border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 cursor-pointer transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-semibold text-slate-500">
                            {succId}
                          </span>
                          <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
                            {succTask?.status || "Not Started"}
                          </span>
                        </div>
                        <div className="font-bold text-[13px] text-slate-900">
                          {succTask?.name || succId}
                        </div>
                        <div className="text-[11.5px] text-slate-500 mt-1">
                          Finish-to-Start (FS) · Starts after completion
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[12.5px] text-slate-400 italic py-2">
                    No successor tasks
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 p-3 bg-slate-50">
              <div className="flex items-center justify-between text-[11.5px] text-slate-400 mb-1">
                <span>John Smith</span>
                <span>Yesterday 16:30</span>
              </div>
              <p className="text-[12.5px] text-slate-700">
                {currentTask.notes || "Pours 1-4 completed. Inspection passed."}
              </p>
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
      <div className="border-t border-slate-200 p-4 space-y-2 bg-white">
        {/* Primary: Update Progress */}
        <button
          onClick={() => setProgressModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[13.5px] font-semibold text-white shadow-2xs hover:bg-blue-700 transition-colors"
        >
          <span>Update Progress</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Secondary: Add Note / Photo */}
        <button
          onClick={() => setNoteModalOpen(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2.5 text-[13.5px] font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <Camera className="h-4 w-4 text-slate-500" />
          <span>Add Note / Photo</span>
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
    </div>
  );
}
