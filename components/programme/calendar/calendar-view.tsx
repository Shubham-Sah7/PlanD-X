"use client";

import React, { useState, useMemo } from "react";
import { useProgramme } from "@/lib/programme-context";
import {
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  Plus,
  MoreVertical,
  Check,
  MessageSquare,
  Paperclip,
  SlidersHorizontal,
  Search,
  X,
  Layers,
  Sparkles,
  ChevronLeft,
  Flag,
  Flame,
} from "lucide-react";
import { CalendarPopover } from "./calendar-popover";

export type CalendarSubView = "board" | "month" | "week";

interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

interface TagItem {
  label: string;
  bgClass: string;
  textClass: string;
}

interface AssigneeItem {
  name: string;
  initials: string;
  avatarBg: string;
}

export type ScheduleColumnId = "overdue" | "blocked" | "today" | "due-soon" | "upcoming";

interface KanbanTask {
  id: string;
  columnId: ScheduleColumnId;
  title: string;
  tags: TagItem[];
  bgClass: string;
  borderClass: string;
  dotActiveColor: string;
  checklist?: ChecklistItem[];
  note?: string;
  imagePreview?: string;
  progress: number;
  assignees: AssigneeItem[];
  commentsCount: number;
  attachmentsCount: number;
  dueDate?: string;
}

const INITIAL_BOARD_TASKS: KanbanTask[] = [
  // COLUMN 1: Overdue
  {
    id: "task-overdue-1",
    columnId: "overdue",
    title: "Level 1 - Core Wall Concrete 28-day Cube Testing Signoff",
    tags: [
      { label: "structural", bgClass: "bg-red-100", textClass: "text-red-800" },
      { label: "5d overdue", bgClass: "bg-red-200/90 font-bold", textClass: "text-red-900" },
    ],
    bgClass: "bg-[#fff1f2]",
    borderClass: "border-red-200",
    dotActiveColor: "bg-red-600",
    note: "Waiting for certified lab break results from testing authority",
    progress: 80,
    assignees: [
      { name: "John Smith", initials: "JS", avatarBg: "bg-blue-600" },
      { name: "David Wilson", initials: "DW", avatarBg: "bg-amber-600" },
    ],
    commentsCount: 9,
    attachmentsCount: 4,
    dueDate: "28 Feb 2026",
  },
  {
    id: "task-overdue-2",
    columnId: "overdue",
    title: "Basement dual-layer bituthene waterproofing inspection",
    tags: [
      { label: "waterproofing", bgClass: "bg-red-100", textClass: "text-red-800" },
      { label: "2d overdue", bgClass: "bg-red-200/90 font-bold", textClass: "text-red-900" },
    ],
    bgClass: "bg-[#fff1f2]",
    borderClass: "border-red-200",
    dotActiveColor: "bg-red-600",
    checklist: [
      { id: "c1", text: "Substrate priming & perimeter toe fillet", done: true },
      { id: "c2", text: "Hydrostatic flood test inspection", done: false },
    ],
    note: "Specialist warranty inspector delayed on transit",
    progress: 60,
    assignees: [
      { name: "Sarah Chen", initials: "SC", avatarBg: "bg-purple-600" },
    ],
    commentsCount: 6,
    attachmentsCount: 2,
    dueDate: "03 Mar 2026",
  },

  // COLUMN 2: Blocked
  {
    id: "task-blocked-1",
    columnId: "blocked",
    title: "Piling mat construction - North Grid A-D",
    tags: [
      { label: "groundworks", bgClass: "bg-amber-100", textClass: "text-amber-800" },
      { label: "blocked: rig", bgClass: "bg-red-100 font-bold", textClass: "text-red-800" },
    ],
    bgClass: "bg-[#fffbeb]",
    borderClass: "border-amber-200",
    dotActiveColor: "bg-amber-600",
    note: "Holding on CFA piling rig mobilisation (PRG-011)",
    progress: 0,
    assignees: [
      { name: "Tom Harris", initials: "TH", avatarBg: "bg-emerald-600" },
      { name: "John Smith", initials: "JS", avatarBg: "bg-blue-600" },
    ],
    commentsCount: 14,
    attachmentsCount: 3,
    dueDate: "08 Mar 2026",
  },
  {
    id: "task-blocked-2",
    columnId: "blocked",
    title: "Level 2 Core Wall Reinforcement Fixing",
    tags: [
      { label: "structural", bgClass: "bg-amber-100", textClass: "text-amber-800" },
      { label: "rfi #104", bgClass: "bg-purple-100", textClass: "text-purple-800" },
    ],
    bgClass: "bg-[#fffbeb]",
    borderClass: "border-amber-200",
    dotActiveColor: "bg-amber-600",
    note: "Structural engineer rebar congestion clarification pending",
    progress: 25,
    assignees: [
      { name: "Sarah Chen", initials: "SC", avatarBg: "bg-purple-600" },
      { name: "Ryan Wilson", initials: "RW", avatarBg: "bg-rose-600" },
    ],
    commentsCount: 8,
    attachmentsCount: 5,
    dueDate: "12 Mar 2026",
  },

  // COLUMN 3: Today & This Week
  {
    id: "task-columns",
    columnId: "today",
    title: "Level 2 - Columns Formwork & Pour #4",
    tags: [
      { label: "structural", bgClass: "bg-blue-100", textClass: "text-blue-800" },
      { label: "pour: 14:00", bgClass: "bg-emerald-100 font-bold", textClass: "text-emerald-800" },
    ],
    bgClass: "bg-[#eff6ff]",
    borderClass: "border-blue-200",
    dotActiveColor: "bg-blue-600",
    imagePreview: "/bim-hero-clean.jpg",
    note: "Ready mix concrete batching approved. Pour scheduled today.",
    progress: 90,
    assignees: [
      { name: "John Smith", initials: "JS", avatarBg: "bg-blue-600" },
      { name: "Tom Harris", initials: "TH", avatarBg: "bg-emerald-600" },
      { name: "David Wilson", initials: "DW", avatarBg: "bg-amber-600" },
    ],
    commentsCount: 16,
    attachmentsCount: 6,
    dueDate: "Today",
  },
  {
    id: "task-today-2",
    columnId: "today",
    title: "Tower crane #1 monthly proof test & load calibration",
    tags: [
      { label: "logistics", bgClass: "bg-emerald-100", textClass: "text-emerald-800" },
      { label: "safety", bgClass: "bg-blue-100", textClass: "text-blue-800" },
    ],
    bgClass: "bg-[#f0fdf4]",
    borderClass: "border-emerald-200",
    dotActiveColor: "bg-emerald-600",
    checklist: [
      { id: "p1", text: "Outrigger spreader pads checked", done: true },
      { id: "p2", text: "15-tonne proof test lift with appointed person", done: true },
    ],
    note: "Appointed lifting supervisor onsite",
    progress: 75,
    assignees: [
      { name: "Tom Harris", initials: "TH", avatarBg: "bg-emerald-600" },
      { name: "Mike Johnson", initials: "MJ", avatarBg: "bg-rose-600" },
    ],
    commentsCount: 5,
    attachmentsCount: 3,
    dueDate: "This Week",
  },

  // COLUMN 4: Due Soon (14d)
  {
    id: "task-due-1",
    columnId: "due-soon",
    title: "Level 2 Post-Tensioned Slab Decking & Conduits",
    tags: [
      { label: "structural", bgClass: "bg-indigo-100", textClass: "text-indigo-800" },
      { label: "m&e 1st fix", bgClass: "bg-cyan-100", textClass: "text-cyan-800" },
    ],
    bgClass: "bg-[#f5f3ff]",
    borderClass: "border-indigo-200",
    dotActiveColor: "bg-indigo-600",
    note: "Pre-pour inspection scheduled for 18 Mar",
    progress: 35,
    assignees: [
      { name: "Mike Johnson", initials: "MJ", avatarBg: "bg-rose-600" },
      { name: "Ryan Wilson", initials: "RW", avatarBg: "bg-rose-600" },
    ],
    commentsCount: 4,
    attachmentsCount: 1,
    dueDate: "18 Mar 2026",
  },
  {
    id: "task-due-2",
    columnId: "due-soon",
    title: "Unitised curtain wall bracket survey & 3D coordinate check",
    tags: [
      { label: "façade", bgClass: "bg-sky-100", textClass: "text-sky-800" },
      { label: "survey", bgClass: "bg-purple-100", textClass: "text-purple-800" },
    ],
    bgClass: "bg-[#f0f9ff]",
    borderClass: "border-sky-200",
    dotActiveColor: "bg-sky-600",
    note: "Total station benchmark recalibrated against BIM grid",
    progress: 20,
    assignees: [
      { name: "Sarah Chen", initials: "SC", avatarBg: "bg-purple-600" },
    ],
    commentsCount: 3,
    attachmentsCount: 2,
    dueDate: "21 Mar 2026",
  },

  // COLUMN 5: Upcoming
  {
    id: "task-up-1",
    columnId: "upcoming",
    title: "Superstructure Level 3 Handover Milestone",
    tags: [
      { label: "milestone", bgClass: "bg-amber-100 font-bold", textClass: "text-amber-800" },
      { label: "critical path", bgClass: "bg-red-100 font-bold", textClass: "text-red-800" },
    ],
    bgClass: "bg-white",
    borderClass: "border-slate-200",
    dotActiveColor: "bg-amber-600",
    note: "Major contract milestone diamond #4. Planned handover 16 Apr.",
    progress: 0,
    assignees: [
      { name: "John Smith", initials: "JS", avatarBg: "bg-blue-600" },
      { name: "Sarah Chen", initials: "SC", avatarBg: "bg-purple-600" },
    ],
    commentsCount: 12,
    attachmentsCount: 8,
    dueDate: "16 Apr 2026",
  },
  {
    id: "task-up-2",
    columnId: "upcoming",
    title: "Façade Unitised Panel Installation Commences",
    tags: [
      { label: "envelope", bgClass: "bg-slate-100", textClass: "text-slate-800" },
      { label: "logistics", bgClass: "bg-slate-100", textClass: "text-slate-800" },
    ],
    bgClass: "bg-white",
    borderClass: "border-slate-200",
    dotActiveColor: "bg-slate-400",
    note: "Panel delivery shipment from port scheduled 01 May",
    progress: 0,
    assignees: [
      { name: "Tom Harris", initials: "TH", avatarBg: "bg-emerald-600" },
    ],
    commentsCount: 2,
    attachmentsCount: 1,
    dueDate: "01 May 2026",
  },
];

const COLUMNS: {
  id: ScheduleColumnId;
  title: string;
  subtitle: string;
  badgeClass: string;
}[] = [
  { id: "overdue", title: "Overdue", subtitle: "Action Required", badgeClass: "bg-red-100 text-red-700 border-red-200" },
  { id: "blocked", title: "Blocked", subtitle: "Trade/RFI Holds", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "today", title: "Today & This Week", subtitle: "Active Execution", badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "due-soon", title: "Due Soon (14d)", subtitle: "Lookahead Window", badgeClass: "bg-indigo-100 text-indigo-800 border-indigo-200" },
  { id: "upcoming", title: "Upcoming", subtitle: "Scheduled Next", badgeClass: "bg-slate-100 text-slate-700 border-slate-200" },
];

const TEAM_MEMBERS = [
  { name: "John Smith", initials: "JS", role: "Project Manager", bg: "bg-blue-600" },
  { name: "Tom Harris", initials: "TH", role: "Site Supervisor", bg: "bg-emerald-600" },
  { name: "Sarah Chen", initials: "SC", role: "Structural Engineer", bg: "bg-purple-600" },
  { name: "David Wilson", initials: "DW", role: "HSE Manager", bg: "bg-amber-600" },
  { name: "Mike Johnson", initials: "MJ", role: "M&E Coordinator", bg: "bg-rose-600" },
];

// Reusable Dotted Progress Bar (10 round dots + percentage) matching the reference image
function DottedProgressBar({
  progress,
  activeClass,
  inactiveClass = "bg-black/10",
}: {
  progress: number;
  activeClass: string;
  inactiveClass?: string;
}) {
  const filledCount = Math.min(10, Math.max(0, Math.round(progress / 10)));
  return (
    <div className="flex items-center justify-between select-none pt-0.5">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full transition-colors ${
              i < filledCount ? activeClass : inactiveClass
            }`}
          />
        ))}
      </div>
      <span className="font-bold text-[12px] text-slate-700 font-mono">
        {progress}%
      </span>
    </div>
  );
}

export function CalendarView() {
  const { openDrawer, selectTask } = useProgramme();

  // View mode: "board" (Kanban daily tasks matching reference) or "month" (monthly grid)
  const [subView, setSubView] = useState<CalendarSubView>("board");
  const [tasks, setTasks] = useState<KanbanTask[]>(INITIAL_BOARD_TASKS);
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [viewDropdownOpen, setViewDropdownOpen] = useState<boolean>(false);
  const [filterPanelOpen, setFilterPanelOpen] = useState<boolean>(false);
  const [createModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [newTaskColumn, setNewTaskColumn] = useState<KanbanTask["columnId"]>("today");
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");

  // Toggle checklist item
  const toggleChecklist = (taskId: string, itemId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId || !t.checklist) return t;
        const updated = t.checklist.map((item) =>
          item.id === itemId ? { ...item, done: !item.done } : item
        );
        const doneCount = updated.filter((item) => item.done).length;
        const newProgress = Math.round((doneCount / updated.length) * 100);
        return {
          ...t,
          checklist: updated,
          progress: newProgress,
        };
      })
    );
  };

  // Filter tasks
  const filteredTasks = useMemo(() => {
    if (!selectedAssignee) return tasks;
    return tasks.filter((t) =>
      t.assignees.some((a) => a.initials === selectedAssignee)
    );
  }, [tasks, selectedAssignee]);

  // Create new task
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    const newTask: KanbanTask = {
      id: `task-custom-${Date.now()}`,
      columnId: newTaskColumn,
      title: newTaskTitle.trim(),
      tags: [
        { label: "site-task", bgClass: "bg-blue-100/90", textClass: "text-blue-800" },
      ],
      bgClass: "bg-[#edf5ff]",
      borderClass: "border-blue-200/70",
      dotActiveColor: "bg-blue-600",
      progress: 0,
      assignees: [{ name: "John Smith", initials: "JS", avatarBg: "bg-blue-600" }],
      commentsCount: 0,
      attachmentsCount: 0,
    };

    setTasks((prev) => [newTask, ...prev]);
    setNewTaskTitle("");
    setCreateModalOpen(false);
  };

  return (
    <div className="flex flex-col flex-1 h-full w-full rounded-2xl border border-slate-200/70 bg-gradient-to-tr from-[#f8fafc] via-[#faf5ff]/20 to-[#fff1f2]/20 p-5 shadow-2xs overflow-hidden select-none">
      {/* 1. Sub-Header: Month/Date, Board-Daily Tasks dropdown, Avatars, Filters, + Create task */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200/60 shrink-0">
        {/* Left: Month title & date */}
        <div className="flex flex-col">
          <h2 className="text-[22px] font-bold tracking-tight text-slate-900 leading-tight">
            May
          </h2>
          <span className="text-[12px] font-medium text-slate-500 mt-0.5">
            Today is Saturday, Jul 9th, 2023 · Building 2 & Unit 80
          </span>
        </div>

        {/* Center: View Dropdown / Segment Pill (Board - Daily Tasks ▾) */}
        <div className="relative">
          <button
            onClick={() => setViewDropdownOpen(!viewDropdownOpen)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/95 px-3.5 py-1.5 text-[13px] font-semibold text-slate-700 shadow-2xs backdrop-blur-md hover:bg-white transition-colors"
          >
            <span>
              {subView === "board"
                ? "Board — Daily Tasks"
                : subView === "month"
                ? "Monthly Calendar Grid"
                : "Weekly Schedule Planner"}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {viewDropdownOpen && (
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1.5 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg z-50">
              <button
                onClick={() => {
                  setSubView("board");
                  setViewDropdownOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  subView === "board"
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Board — Daily Tasks</span>
                {subView === "board" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => {
                  setSubView("month");
                  setViewDropdownOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  subView === "month"
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Monthly Calendar Grid</span>
                {subView === "month" && <Check className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => {
                  setSubView("week");
                  setViewDropdownOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[12.5px] transition-colors ${
                  subView === "week"
                    ? "bg-blue-50 font-semibold text-blue-700"
                    : "text-slate-700 hover:bg-slate-50"
                }`}
              >
                <span>Weekly Schedule Planner</span>
                {subView === "week" && <Check className="h-3.5 w-3.5" />}
              </button>
            </div>
          )}
        </div>

        {/* Right: Team Avatars, Filters, + Create task */}
        <div className="flex items-center gap-3">
          {/* 5 Overlapping Team Avatars */}
          <div className="flex items-center -space-x-2">
            {TEAM_MEMBERS.map((m) => {
              const isSelected = selectedAssignee === m.initials;
              return (
                <button
                  key={m.initials}
                  onClick={() =>
                    setSelectedAssignee(isSelected ? null : m.initials)
                  }
                  title={`${m.name} (${m.role})`}
                  className={`relative h-7 w-7 rounded-full ring-2 ring-white flex items-center justify-center text-[10px] font-bold text-white shadow-2xs transition-transform hover:scale-110 hover:z-20 ${
                    m.bg
                  } ${isSelected ? "ring-blue-600 scale-110 z-20" : ""}`}
                >
                  {m.initials}
                </button>
              );
            })}
          </div>

          {/* Filters Button */}
          <button
            onClick={() => setFilterPanelOpen(!filterPanelOpen)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[12.5px] font-semibold shadow-2xs transition-colors ${
              filterPanelOpen
                ? "border-blue-400 bg-blue-50 text-blue-700"
                : "border-slate-200/80 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
            <span>Filters</span>
          </button>

          {/* + Create task Button */}
          <button
            onClick={() => {
              setNewTaskColumn("today");
              setCreateModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-xs hover:bg-black transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Create task</span>
          </button>
        </div>
      </div>

      {/* 2. Board View (Construction-focused Schedule Categories: Overdue, Blocked, Today, Due Soon, Upcoming) */}
      {subView === "board" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mt-4 flex-1 items-start overflow-y-auto pr-1">
          {COLUMNS.map((col) => {
            const colTasks = filteredTasks.filter((t) => t.columnId === col.id);

            return (
              <div
                key={col.id}
                className="flex flex-col rounded-2xl bg-slate-100/50 border border-slate-200/50 p-2.5 min-w-0"
              >
                {/* Column Header */}
                <div className="flex flex-col gap-0.5 px-1 mb-2.5 text-slate-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-bold text-[13px] truncate">
                      <span>{col.title}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-xs border font-semibold ${col.badgeClass}`}>
                        {colTasks.length}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-400 shrink-0">
                      <button
                        onClick={() => {
                          setNewTaskColumn(col.id);
                          setCreateModalOpen(true);
                        }}
                        className="h-5 w-5 rounded hover:bg-slate-200/60 hover:text-slate-700 flex items-center justify-center transition-colors"
                        title="Add task to this schedule bucket"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {col.subtitle}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-3.5">
                  {colTasks.map((task) => (
                    <div
                      key={task.id}
                      onClick={() => {
                        selectTask(task.id);
                        openDrawer(task.id);
                      }}
                      className={`group rounded-2xl border p-4 shadow-2xs hover:shadow-sm hover:-translate-y-0.5 transition-all cursor-pointer ${task.bgClass} ${task.borderClass}`}
                    >
                      {/* Top Row: Tag Pills + Action Menu */}
                      <div className="flex items-center justify-between gap-1.5 mb-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {task.tags.map((tag) => (
                            <span
                              key={tag.label}
                              className={`rounded-full px-2 py-0.5 text-[10px] font-bold tracking-tight ${tag.bgClass} ${tag.textClass}`}
                            >
                              #{tag.label}
                            </span>
                          ))}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Task Title */}
                      <h4 className="font-bold text-[13.5px] leading-snug text-slate-900 mb-2">
                        {task.title}
                      </h4>

                      {/* Optional Thumbnail Image Preview (Matching Image) */}
                      {task.imagePreview && (
                        <div className="my-2.5 rounded-xl overflow-hidden border border-slate-200/60 shadow-2xs">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={task.imagePreview}
                            alt="Construction preview"
                            className="w-full h-28 object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              // Fallback graceful graphic if path not resolved
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                      )}

                      {/* Optional Checklist Items with Round Checkmarks */}
                      {task.checklist && task.checklist.length > 0 && (
                        <div className="my-2 space-y-1.5">
                          {task.checklist.map((item) => (
                            <div
                              key={item.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleChecklist(task.id, item.id);
                              }}
                              className="flex items-start gap-2 text-[11.5px] text-slate-700 cursor-pointer"
                            >
                              {item.done ? (
                                <div className="h-3.5 w-3.5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[8.5px] font-bold shrink-0 mt-0.5">
                                  ✓
                                </div>
                              ) : (
                                <div className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0 mt-0.5" />
                              )}
                              <span
                                className={
                                  item.done
                                    ? "line-through text-slate-400"
                                    : "font-medium"
                                }
                              >
                                {item.text}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Optional Note Field */}
                      {task.note && (
                        <div className="text-[11px] font-medium text-slate-500 italic mt-2 mb-2.5">
                          {task.note.startsWith("Note:") || task.note.startsWith("Have")
                            ? task.note
                            : `Note: ${task.note}`}
                        </div>
                      )}

                      {/* Dotted Progress Bar */}
                      <div className="mt-2.5 pt-1 border-t border-black/5">
                        <DottedProgressBar
                          progress={task.progress}
                          activeClass={task.dotActiveColor}
                        />
                      </div>

                      {/* Footer: Overlapping Avatars + Counts */}
                      <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/5">
                        {/* Overlapping Avatars */}
                        <div className="flex items-center -space-x-1.5">
                          {task.assignees.map((a) => (
                            <div
                              key={a.name}
                              className={`h-5.5 w-5.5 rounded-full ring-2 ring-white flex items-center justify-center text-[8.5px] font-bold text-white ${a.avatarBg}`}
                              title={a.name}
                            >
                              {a.initials}
                            </div>
                          ))}
                        </div>

                        {/* Counts (Comments & Attachments) */}
                        <div className="flex items-center gap-2.5 text-[11px] font-medium text-slate-500">
                          <span className="flex items-center gap-1">
                            <MessageSquare className="h-3 w-3 text-slate-400" />
                            <span>{task.commentsCount}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <Paperclip className="h-3 w-3 text-slate-400" />
                            <span>{task.attachmentsCount}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Monthly Calendar Grid (Accessible via Dropdown) */}
      {subView === "month" && (
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs mt-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-[16px] text-slate-900">
              August 2025 Schedule
            </h3>
            <span className="text-[12px] text-slate-500 font-medium">
              31 Days Planned
            </span>
          </div>
          <div className="grid grid-cols-7 gap-2 mt-3">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="py-1 text-center font-bold text-[12px] text-slate-400"
              >
                {d}
              </div>
            ))}
            {Array.from({ length: 31 }).map((_, i) => (
              <div
                key={i}
                className="h-24 p-2 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-blue-50/40 hover:border-blue-200 transition-all cursor-pointer flex flex-col justify-between"
              >
                <span className="text-[12px] font-bold text-slate-700">
                  {i + 1}
                </span>
                {i === 11 && (
                  <div className="rounded-md bg-blue-100 border border-blue-200 p-1 text-[10px] font-semibold text-blue-900 truncate">
                    Level 2 Columns Pour
                  </div>
                )}
                {i === 15 && (
                  <div className="rounded-md bg-emerald-100 border border-emerald-200 p-1 text-[10px] font-semibold text-emerald-900 truncate">
                    Crane Load Test
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4. Weekly Schedule Planner (Accessible via Dropdown) */}
      {subView === "week" && (
        <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs mt-4 overflow-y-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-[16px] text-slate-900">
              Week 42 (13 Oct – 19 Oct 2025)
            </h3>
            <span className="text-[12px] text-slate-500 font-medium">
              Daily Shift Handover
            </span>
          </div>
          <div className="grid grid-cols-5 gap-3 mt-3">
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day, idx) => (
              <div
                key={day}
                className="rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 min-h-[300px]"
              >
                <div className="font-bold text-[13px] text-slate-800 pb-2 border-b border-slate-200">
                  {day} <span className="text-slate-400 font-normal">Oct {13 + idx}</span>
                </div>
                <div className="space-y-2.5 mt-2.5">
                  <div className="rounded-lg bg-blue-50 border border-blue-200 p-2 text-[11.5px] text-blue-950 font-medium shadow-2xs">
                    08:00 Concrete boom pump positioning
                  </div>
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-[11.5px] text-amber-950 font-medium shadow-2xs">
                    13:30 HSE scaffold safety audit
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create Task */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl w-full max-w-md p-5 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-[16px] text-slate-900">
                Create Daily Schedule Task
              </h3>
              <button
                onClick={() => setCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Task Title
                </label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g. Core wall lift #3 concrete placement"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Target Column
                </label>
                <select
                  value={newTaskColumn}
                  onChange={(e) => setNewTaskColumn(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="todo">Todo list</option>
                  <option value="in-progress">In Progress</option>
                  <option value="in-review">In Review</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-[12.5px] font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-[12.5px] font-semibold shadow-xs"
                >
                  Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
