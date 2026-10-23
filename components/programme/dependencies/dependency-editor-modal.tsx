"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Link2,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Info,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import {
  type DependencyType,
  type ProgrammeTask,
} from "@/lib/programme-types";
import {
  DEPENDENCY_TYPE_OPTIONS,
  formatDependencyRelation,
  wouldCreateCircularDependency,
} from "@/lib/programme-dependencies";
import { useProgramme } from "@/lib/programme-context";

interface DependencyEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTask: ProgrammeTask;
  initialPredecessorId?: string | null;
  initialType?: DependencyType;
  initialLag?: number;
  isEditing?: boolean;
}

export function DependencyEditorModal({
  isOpen,
  onClose,
  currentTask,
  initialPredecessorId = null,
  initialType = "FS",
  initialLag = 0,
  isEditing = false,
}: DependencyEditorModalProps) {
  const { state, addDependency, updateDependency, removeDependency } = useProgramme();

  // Find other available tasks (excluding current task)
  const candidateTasks = useMemo(() => {
    return state.tasks.filter((t) => t.id !== currentTask.id && t.level !== "phase");
  }, [state.tasks, currentTask.id]);

  const [selectedPredId, setSelectedPredId] = useState<string>(
    initialPredecessorId || candidateTasks[0]?.id || ""
  );
  const [selectedType, setSelectedType] = useState<DependencyType>(initialType);
  const [lagDays, setLagDays] = useState<number>(initialLag);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      const predId = initialPredecessorId || candidateTasks[0]?.id || "";
      setSelectedPredId(predId);
      setSelectedType(initialType);
      setLagDays(initialLag);
      setErrorMsg(null);
    }
  }, [isOpen, initialPredecessorId, initialType, initialLag, candidateTasks]);

  // Real-time circular dependency detection
  const isCircular = useMemo(() => {
    if (!selectedPredId || !currentTask.id) return false;
    // Check if adding/updating selectedPredId -> currentTask.id creates a loop
    return wouldCreateCircularDependency(state.tasks, selectedPredId, currentTask.id);
  }, [state.tasks, selectedPredId, currentTask.id]);

  if (!isOpen) return null;

  const predTask = state.tasks.find((t) => t.id === selectedPredId);

  const handleSave = () => {
    setErrorMsg(null);

    if (!selectedPredId) {
      setErrorMsg("Please select a predecessor task.");
      return;
    }

    if (isCircular) {
      setErrorMsg("Cannot save: Circular dependency detected.");
      return;
    }

    const res = isEditing
      ? updateDependency(selectedPredId, currentTask.id, selectedType, lagDays)
      : addDependency(selectedPredId, currentTask.id, selectedType, lagDays);

    if (res.success) {
      onClose();
    } else {
      setErrorMsg(res.error || "Failed to save dependency.");
    }
  };

  const handleDelete = () => {
    if (selectedPredId) {
      removeDependency(selectedPredId, currentTask.id);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-[16px] font-semibold text-slate-900 leading-tight">
                {isEditing ? "Edit Task Dependency" : "Link Predecessor Dependency"}
              </h3>
              <p className="text-[12px] text-slate-500 mt-0.5">
                Configure relationship type and working day lag/lead time.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Target Successor Task Summary */}
          <div className="rounded-lg border border-slate-200/80 bg-slate-50/50 p-3 flex items-center justify-between text-[12.5px]">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-500 uppercase tracking-wider text-[11px]">
                Successor:
              </span>
              <span className="font-mono font-medium text-slate-700">{currentTask.id}</span>
              <span className="font-semibold text-slate-900 truncate max-w-[220px]">
                {currentTask.name}
              </span>
            </div>
            <span className="font-mono text-slate-600 text-[11.5px] font-medium bg-white px-2 py-0.5 rounded border border-slate-200">
              {currentTask.duration}d duration
            </span>
          </div>

          {/* 1. Predecessor Selector */}
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-800 mb-1.5">
              What must happen first? (Predecessor)
            </label>
            <select
              id="dependency-predecessor-select"
              value={selectedPredId}
              disabled={isEditing}
              onChange={(e) => setSelectedPredId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] text-slate-800 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500"
            >
              {candidateTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.wbs ? `${t.wbs} ` : ""}{t.name} ({t.id})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Dependency Type Selection (FS, SS, FF, SF) */}
          <div>
            <label className="block text-[12.5px] font-semibold text-slate-800 mb-2">
              Dependency Relationship Type
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DEPENDENCY_TYPE_OPTIONS.map((opt) => {
                const isSelected = selectedType === opt.type;
                return (
                  <div
                    key={opt.type}
                    onClick={() => setSelectedType(opt.type)}
                    className={`relative rounded-lg border p-3 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/40 ring-1 ring-blue-500"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`font-mono text-[11px] font-bold px-1.5 py-0.5 rounded ${
                            isSelected
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {opt.badge}
                        </span>
                        <span className="font-semibold text-[12.5px] text-slate-900">
                          {opt.name.split(" ")[0]}
                        </span>
                      </div>
                      {isSelected && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                    </div>
                    <p className="text-[11px] text-slate-500 leading-tight">
                      {opt.explanation}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Lag or Lead Time (Working Days) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[12.5px] font-semibold text-slate-800">
                Lag (+) or Lead (-) Time
              </label>
              <span className="text-[11.5px] text-slate-500 font-mono">Unit: Working Days</span>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <input
                  id="dependency-lag-input"
                  type="number"
                  step="1"
                  value={lagDays}
                  onChange={(e) => setLagDays(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13.5px] font-mono text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-2 focus:ring-blue-100"
                  placeholder="0"
                />
              </div>

              {/* Quick Presets */}
              <div className="flex items-center gap-1">
                {[-2, -1, 0, 1, 2, 3].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setLagDays(val)}
                    className={`rounded px-2 py-1 text-[11px] font-mono font-medium transition-colors ${
                      lagDays === val
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                    }`}
                  >
                    {val > 0 ? `+${val}d` : `${val}d`}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-[11.5px] text-slate-500 mt-1.5">
              {lagDays > 0 && (
                <span className="text-blue-700 font-medium">
                  • Positive Lag (+{lagDays}d): Adds a {lagDays}-working-day buffer or concrete curing window before successor start.
                </span>
              )}
              {lagDays < 0 && (
                <span className="text-amber-700 font-medium">
                  • Negative Lead ({lagDays}d): Allows successor to fast-track and start {Math.abs(lagDays)} working days before predecessor finish.
                </span>
              )}
              {lagDays === 0 && (
                <span>• Zero Lag (0d): Standard handover with no buffer or overlap.</span>
              )}
            </p>
          </div>

          {/* Real-time Circular Dependency Warning */}
          {isCircular && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2.5 text-[12px] text-red-800">
              <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Circular Dependency Detected:</span> Linking{" "}
                <span className="font-semibold">{predTask?.name}</span> as a predecessor to{" "}
                <span className="font-semibold">{currentTask.name}</span> would create an infinite scheduling loop because {predTask?.name} already depends on {currentTask.name}.
              </div>
            </div>
          )}

          {/* Validation Error Message */}
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] text-red-700">
              {errorMsg}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-3.5 bg-slate-50/70">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[12px] font-medium text-red-600 hover:bg-red-50 transition-colors"
                title="Remove this dependency link"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Unlink</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              id="save-dependency-btn"
              type="button"
              disabled={isCircular}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <span>{isEditing ? "Update & Recalculate" : "Link & Recalculate"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
