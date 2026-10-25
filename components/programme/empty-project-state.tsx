"use client";

import React from "react";
import {
  FolderPlus,
  Plus,
  Upload,
  Calendar,
  Layers,
  Flag,
  ArrowRight,
  Sparkles,
  Clock,
  ShieldCheck,
  CheckCircle2,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

interface EmptyProjectStateProps {
  onAddPhase?: () => void;
  onAddTask?: () => void;
  onAddMilestone?: () => void;
}

export function EmptyProjectState({
  onAddPhase,
  onAddTask,
  onAddMilestone,
}: EmptyProjectStateProps) {
  const {
    currentProject,
    projectCalendar,
    openAddTask,
    openImport,
    openProjectModal,
    openCalendarModal,
  } = useProgramme();

  return (
    <div className="flex flex-col items-center justify-center min-h-[460px] p-8 text-center bg-gradient-to-b from-slate-50/70 to-white border border-dashed border-slate-300 rounded-xl m-4 select-none">
      {/* Icon Badge */}
      <div className="relative mb-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-blue-600 shadow-sm shadow-blue-100/50">
          <FolderPlus className="w-8 h-8" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-white flex items-center justify-center text-white">
          <Sparkles className="w-3.5 h-3.5" />
        </div>
      </div>

      {/* Title & Description */}
      <h3 className="text-[19px] font-semibold text-slate-900 tracking-tight">
        {currentProject?.name || "Blank Construction Programme"}
      </h3>
      <p className="mt-1.5 max-w-lg text-[13.5px] text-slate-500 leading-relaxed">
        This programme is ready for scheduling. Create your first phase, work package, task, or milestone, or start from a pre-engineered construction template.
      </p>

      {/* Project Metadata Ribbon */}
      <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[12px] text-slate-600">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 font-mono text-[11px] font-medium text-slate-700">
          <span>{currentProject?.code || "PRJ-001"}</span>
        </span>
        <span className="text-slate-300">·</span>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 font-medium">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>Planned Start: {currentProject?.plannedStartDate || "Today"}</span>
        </span>
        <span className="text-slate-300">·</span>
        <button
          onClick={openCalendarModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 transition-colors cursor-pointer"
          title="Click to view or edit working calendar"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{projectCalendar?.name || "Standard 5-Day"}</span>
        </button>
      </div>

      {/* Primary Action Buttons */}
      <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
        <button
          id="empty-state-add-phase-btn"
          onClick={() => {
            if (onAddPhase) onAddPhase();
            else openAddTask("summary");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 shadow-sm transition-all shadow-blue-500/20 active:scale-[0.98] cursor-pointer"
        >
          <Layers className="w-4 h-4" />
          <span>+ Add First Phase</span>
        </button>

        <button
          id="empty-state-add-task-btn"
          onClick={() => {
            if (onAddTask) onAddTask();
            else openAddTask("task");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-[13px] font-medium hover:bg-slate-50 hover:border-slate-400 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-slate-500" />
          <span>+ Add Activity</span>
        </button>

        <button
          id="empty-state-add-milestone-btn"
          onClick={() => {
            if (onAddMilestone) onAddMilestone();
            else openAddTask("milestone");
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 text-[13px] font-medium hover:bg-slate-50 hover:border-slate-400 shadow-xs transition-all active:scale-[0.98] cursor-pointer"
        >
          <Flag className="w-4 h-4 text-amber-500" />
          <span>+ Add Milestone</span>
        </button>
      </div>

      {/* Alternative Options */}
      <div className="flex items-center justify-center gap-4 mt-6 pt-5 border-t border-slate-200/80 w-full max-w-md text-[12.5px]">
        <button
          onClick={openImport}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-slate-400" />
          <span>Import MS Project (MPP/XML)</span>
        </button>
        <span className="text-slate-300">|</span>
        <button
          onClick={openProjectModal}
          className="inline-flex items-center gap-1.5 text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Load Template / Switch Project</span>
        </button>
      </div>

      {/* Capabilities Guarantee Footer */}
      <div className="flex items-center gap-4 mt-6 text-[11px] text-slate-400 font-normal">
        <span className="inline-flex items-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Automatic CPM Scheduling</span>
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />
          <span>Multi-Predecessor Dependencies</span>
        </span>
        <span>•</span>
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500" />
          <span>Baseline &amp; Variance Tracking</span>
        </span>
      </div>
    </div>
  );
}
