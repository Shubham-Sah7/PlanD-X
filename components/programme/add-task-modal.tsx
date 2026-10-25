"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  Plus,
  CheckCircle2,
  Calendar,
  Clock,
  Layers,
  FolderTree,
  Flag,
  Briefcase,
  User,
  Hash,
  FileText,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import { formatDateIso } from "@/lib/programme-calendar";

export function AddTaskModal() {
  const {
    isAddTaskOpen,
    closeAddTask,
    createTask,
    addDependency,
    tasks,
    addTaskInitialKind,
    addTaskTargetParentId,
  } = useProgramme();

  const [taskKind, setTaskKind] = useState<"task" | "milestone" | "summary">("task");
  const [name, setName] = useState("");
  const [duration, setDuration] = useState<number>(5);
  const [startDate, setStartDate] = useState<string>(() => formatDateIso(new Date()));
  const [parentId, setParentId] = useState<string>("");
  const [trade, setTrade] = useState<string>("Structural");
  const [assignee, setAssignee] = useState<string>("");
  const [costCode, setCostCode] = useState<string>("");
  const [predecessorId, setPredecessorId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Sync initial kind and parent from context when modal opens
  useEffect(() => {
    if (isAddTaskOpen) {
      if (addTaskInitialKind) {
        setTaskKind(addTaskInitialKind);
        if (addTaskInitialKind === "milestone") setDuration(0);
      }
      if (addTaskTargetParentId !== undefined) {
        setParentId(addTaskTargetParentId || "");
      }
    }
  }, [isAddTaskOpen, addTaskInitialKind, addTaskTargetParentId]);

  // Available summary tasks for parent group selection
  const summaryTasks = useMemo(() => {
    return tasks.filter((t) => t.summary || t.level === "phase" || (t.children && t.children.length > 0));
  }, [tasks]);

  // Unique trades from existing tasks
  const trades = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.trade) set.add(t.trade);
    });
    if (!set.has("Structural")) set.add("Structural");
    if (!set.has("Concrete")) set.add("Concrete");
    if (!set.has("MEP")) set.add("MEP");
    if (!set.has("Finishes")) set.add("Finishes");
    if (!set.has("Substructure")) set.add("Substructure");
    return Array.from(set);
  }, [tasks]);

  if (!isAddTaskOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a task name.");
      return;
    }
    setError(null);

    const isMilestone = taskKind === "milestone";
    const isSummary = taskKind === "summary";
    const taskDuration = isMilestone ? 0 : duration;

    const newTask = createTask({
      name: name.trim(),
      isMilestone,
      isSummary,
      duration: taskDuration,
      startDate: startDate || undefined,
      targetParentId: parentId || null,
      trade: trade || undefined,
      assignee: assignee.trim() || null,
      costCode: costCode.trim() || undefined,
      notes: notes.trim() || undefined,
    });

    if (predecessorId && newTask?.id) {
      addDependency(predecessorId, newTask.id, "FS", 0);
    }

    // Reset and close
    setName("");
    setNotes("");
    setAssignee("");
    setPredecessorId("");
    closeAddTask();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-task-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeAddTask}
    >
      <div
        className="w-full max-w-xl bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden transition-all text-stone-100 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <Plus className="w-5 h-5" />
            </div>
            <div>
              <h2 id="add-task-title" className="text-base font-semibold text-stone-100">
                Create Schedule Item
              </h2>
              <p className="text-xs text-stone-400">
                Add standard tasks, milestones or summary groups to the WBS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAddTask}
            className="text-stone-400 hover:text-stone-200 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Task Kind Selector */}
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-2">Item Type</label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setTaskKind("task")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  taskKind === "task"
                    ? "bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-sm"
                    : "bg-stone-800/40 border-stone-700/60 text-stone-400 hover:border-stone-600 hover:text-stone-200"
                }`}
              >
                <Layers className="w-4 h-4" />
                Standard Task
              </button>
              <button
                type="button"
                onClick={() => setTaskKind("milestone")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  taskKind === "milestone"
                    ? "bg-purple-600/20 border-purple-500 text-purple-300 shadow-sm"
                    : "bg-stone-800/40 border-stone-700/60 text-stone-400 hover:border-stone-600 hover:text-stone-200"
                }`}
              >
                <Flag className="w-4 h-4" />
                Milestone (0d)
              </button>
              <button
                type="button"
                onClick={() => setTaskKind("summary")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  taskKind === "summary"
                    ? "bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm"
                    : "bg-stone-800/40 border-stone-700/60 text-stone-400 hover:border-stone-600 hover:text-stone-200"
                }`}
              >
                <FolderTree className="w-4 h-4" />
                Summary Task
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label htmlFor="task-name-input" className="block text-xs font-medium text-stone-300 mb-1">
              Task Name <span className="text-red-400">*</span>
            </label>
            <input
              id="task-name-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={
                taskKind === "milestone"
                  ? "e.g. Practical Completion Achieved"
                  : taskKind === "summary"
                  ? "e.g. Substructure & Foundation Works"
                  : "e.g. Pour Ground Floor Slab"
              }
              className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors"
              autoFocus
            />
          </div>

          {/* Parent WBS Group */}
          <div>
            <label htmlFor="task-parent-select" className="block text-xs font-medium text-stone-300 mb-1">
              Parent WBS Group
            </label>
            <select
              id="task-parent-select"
              value={parentId}
              onChange={(e) => setParentId(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
            >
              <option value="">(Root Level - No Parent)</option>
              {summaryTasks.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.wbs ? `[${st.wbs}] ` : ""}{st.name}
                </option>
              ))}
            </select>
          </div>

          {/* Duration & Start Date */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-duration-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-stone-400" />
                Duration (Working Days)
              </label>
              <input
                id="task-duration-input"
                type="number"
                min="0"
                value={taskKind === "milestone" ? 0 : duration}
                disabled={taskKind === "milestone"}
                onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 disabled:opacity-50 outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="task-start-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-stone-400" />
                Start Date
              </label>
              <input
                id="task-start-input"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Trade & Predecessor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-trade-select" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5 text-stone-400" />
                Trade / Package
              </label>
              <select
                id="task-trade-select"
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
              >
                {trades.map((tr) => (
                  <option key={tr} value={tr}>
                    {tr}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="task-pred-select" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-stone-400" />
                Predecessor Link (FS)
              </label>
              <select
                id="task-pred-select"
                value={predecessorId}
                onChange={(e) => setPredecessorId(e.target.value)}
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
              >
                <option value="">None (Independent)</option>
                {tasks.slice(0, 50).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.wbs ? `[${t.wbs}] ` : ""}{t.name.slice(0, 36)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assignee & Cost Code */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="task-assignee-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-400" />
                Subcontractor / Assignee
              </label>
              <input
                id="task-assignee-input"
                type="text"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="e.g. Apex Formwork Ltd"
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors"
              />
            </div>
            <div>
              <label htmlFor="task-costcode-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-stone-400" />
                Cost Code
              </label>
              <input
                id="task-costcode-input"
                type="text"
                value={costCode}
                onChange={(e) => setCostCode(e.target.value)}
                placeholder="e.g. 03-3000"
                className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="task-notes-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-stone-400" />
              Notes / Method Statement Reference
            </label>
            <textarea
              id="task-notes-input"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add scope details, access prerequisites, or delivery notes..."
              className="w-full bg-stone-950 border border-stone-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors resize-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeAddTask}
              className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-lg border border-stone-700/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors shadow-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              Create Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
