"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  Check,
  Layers,
  Calendar,
  Briefcase,
  User,
  Percent,
  Trash2,
  Clock,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import { TaskStatus, Trade } from "@/lib/programme-types";

export function BulkEditModal() {
  const {
    isBulkEditOpen,
    closeBulkEdit,
    selectedTaskIds,
    tasks,
    bulkUpdateTasks,
    bulkShiftTasks,
    deleteTasks,
    showToast,
  } = useProgramme();

  const [trade, setTrade] = useState<string>("keep");
  const [status, setStatus] = useState<string>("keep");
  const [progress, setProgress] = useState<string>("");
  const [assignee, setAssignee] = useState<string>("");
  const [applyAssignee, setApplyAssignee] = useState(false);
  const [shiftDays, setShiftDays] = useState<string>("0");
  const [error, setError] = useState<string | null>(null);

  // Selected tasks summary
  const selectedTasks = useMemo(() => {
    const idSet = new Set(selectedTaskIds);
    return tasks.filter((t) => idSet.has(t.id));
  }, [tasks, selectedTaskIds]);

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

  if (!isBulkEditOpen) return null;

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTaskIds.length === 0) {
      setError("No tasks selected.");
      return;
    }

    const updates: Record<string, any> = {};
    if (trade !== "keep") {
      updates.trade = trade;
      updates.tradeText = trade;
    }
    if (status !== "keep") {
      updates.status = status as TaskStatus;
      if (status === "complete") updates.progress = 100;
      else if (status === "not-started") updates.progress = 0;
    }
    if (progress.trim() !== "") {
      const pVal = Math.min(100, Math.max(0, parseInt(progress, 10) || 0));
      updates.progress = pVal;
      if (pVal === 100) updates.status = "complete";
      else if (pVal > 0 && (!updates.status || updates.status === "not-started")) {
        updates.status = "in-progress";
      }
    }
    if (applyAssignee) {
      updates.assignee = assignee.trim() || null;
    }

    // Apply bulk updates
    if (Object.keys(updates).length > 0) {
      bulkUpdateTasks(selectedTaskIds, updates);
    }

    // Apply schedule shift if specified
    const shift = parseInt(shiftDays, 10) || 0;
    if (shift !== 0) {
      bulkShiftTasks(selectedTaskIds, shift);
    }

    showToast(`Bulk updated ${selectedTaskIds.length} tasks.`);
    closeBulkEdit();
  };

  const handleDeleteSelected = () => {
    closeBulkEdit();
    deleteTasks(selectedTaskIds);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bulk-edit-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeBulkEdit}
    >
      <div
        className="w-full max-w-lg bg-stone-900 border border-stone-800 rounded-xl shadow-2xl overflow-hidden transition-all text-stone-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-800 bg-stone-950/40">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 id="bulk-edit-title" className="text-base font-semibold text-stone-100">
                Bulk Edit ({selectedTaskIds.length} Tasks)
              </h2>
              <p className="text-xs text-stone-400">
                Update properties simultaneously across all selected tasks
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeBulkEdit}
            className="text-stone-400 hover:text-stone-200 p-1 rounded-md transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selected preview chips */}
        <div className="px-6 py-3 bg-stone-950/60 border-b border-stone-800/80 max-h-24 overflow-y-auto">
          <div className="text-[11px] font-medium text-stone-400 mb-1.5 uppercase tracking-wider">
            Selected Items:
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTasks.slice(0, 8).map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] bg-stone-800 text-stone-300 border border-stone-700/60"
              >
                {t.wbs ? `[${t.wbs}] ` : ""}
                {t.name.slice(0, 20)}
              </span>
            ))}
            {selectedTasks.length > 8 && (
              <span className="text-[11px] text-stone-500 self-center">
                +{selectedTasks.length - 8} more
              </span>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleApply} className="flex-1 overflow-y-auto p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Trade / Package */}
          <div>
            <label htmlFor="bulk-trade-select" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-stone-400" />
              Trade / Package
            </label>
            <select
              id="bulk-trade-select"
              value={trade}
              onChange={(e) => setTrade(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
            >
              <option value="keep">(Keep existing values)</option>
              {trades.map((tr) => (
                <option key={tr} value={tr}>
                  {tr}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label htmlFor="bulk-status-select" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-stone-400" />
              Execution Status
            </label>
            <select
              id="bulk-status-select"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-stone-100 outline-none transition-colors"
            >
              <option value="keep">(Keep existing values)</option>
              <option value="not-started">Not Started</option>
              <option value="in-progress">In Progress</option>
              <option value="complete">Complete (100%)</option>
              <option value="on-hold">On Hold</option>
            </select>
          </div>

          {/* Progress % */}
          <div>
            <label htmlFor="bulk-progress-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
              <Percent className="w-3.5 h-3.5 text-stone-400" />
              Physical Progress %
            </label>
            <input
              id="bulk-progress-input"
              type="number"
              min="0"
              max="100"
              placeholder="Leave blank to keep existing"
              value={progress}
              onChange={(e) => setProgress(e.target.value)}
              className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors"
            />
          </div>

          {/* Subcontractor / Assignee */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="bulk-assignee-input" className="block text-xs font-medium text-stone-300 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-stone-400" />
                Subcontractor / Assignee
              </label>
              <label className="flex items-center gap-1.5 text-xs text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyAssignee}
                  onChange={(e) => setApplyAssignee(e.target.checked)}
                  className="rounded border-stone-700 bg-stone-950 text-indigo-600 focus:ring-indigo-500"
                />
                Apply to selection
              </label>
            </div>
            <input
              id="bulk-assignee-input"
              type="text"
              disabled={!applyAssignee}
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="e.g. Precision Steel Co."
              className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-stone-100 disabled:opacity-40 placeholder-stone-600 outline-none transition-colors"
            />
          </div>

          {/* Shift Schedule by working days */}
          <div>
            <label htmlFor="bulk-shift-input" className="block text-xs font-medium text-stone-300 mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-stone-400" />
              Shift Schedule (Working Days +/-)
            </label>
            <input
              id="bulk-shift-input"
              type="number"
              value={shiftDays}
              onChange={(e) => setShiftDays(e.target.value)}
              placeholder="0 (no shift)"
              className="w-full bg-stone-950 border border-stone-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 outline-none transition-colors"
            />
            <p className="mt-1 text-[11px] text-stone-500">
              Positive values push tasks forward; negative values pull tasks earlier.
            </p>
          </div>

          {/* Danger Zone: Bulk Delete */}
          <div className="pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete {selectedTaskIds.length} Selected Tasks...
            </button>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-stone-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={closeBulkEdit}
              className="px-4 py-2 text-xs font-medium text-stone-300 hover:text-stone-100 hover:bg-stone-800 rounded-lg border border-stone-700/60 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex items-center gap-2 px-4 py-2 text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors shadow-sm"
            >
              <Check className="w-4 h-4" />
              Apply Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
