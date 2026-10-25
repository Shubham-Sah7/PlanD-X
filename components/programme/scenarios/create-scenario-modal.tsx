"use client";

import React, { useState } from "react";
import { useProgramme } from "@/lib/programme-context";
import { GitBranch, X, Plus, Sparkles, AlertCircle } from "lucide-react";

interface CreateScenarioModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function CreateScenarioModal({ isOpen, onClose }: CreateScenarioModalProps = {}) {
  const { isCreateScenarioOpen, closeCreateScenario, createScenario, showToast, currentUserRole } = useProgramme();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const showModal = isOpen !== undefined ? isOpen : isCreateScenarioOpen;
  const handleClose = onClose || closeCreateScenario;

  if (!showModal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (currentUserRole === "subcontractor" || currentUserRole === "client") {
      showToast("Only Planners and Project Managers can create What-If scenarios.");
      return;
    }

    createScenario(name.trim(), description.trim());
    showToast(`Created and switched to What-If scenario: '${name.trim()}'.`);
    setName("");
    setDescription("");
    handleClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl p-5 space-y-4 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
              <GitBranch className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Create What-If Schedule Scenario
              </h3>
              <p className="text-[11px] text-slate-500">
                Sandbox alternative sequencing without modifying live schedule
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div className="rounded-lg bg-amber-50/80 border border-amber-200/80 p-2.5 text-[11px] text-amber-900 leading-relaxed">
            <span className="font-bold block mb-0.5">Live Programme Isolation Protection:</span>
            All modifications made within this scenario sandbox remain isolated. Your live contractual programme will NOT be altered until formally approved and merged.
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Scenario Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Accelerated Superstructure Double-Shift"
              className="w-full text-xs bg-white border border-slate-300 rounded-md px-3 py-2 outline-none focus:border-amber-500 text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Hypothesis / Planning Objective
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the trade sequencing, calendar adjustment or acceleration being evaluated..."
              className="w-full text-xs bg-white border border-slate-300 rounded-md p-2.5 outline-none focus:border-amber-500 text-slate-900"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={handleClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex items-center gap-1.5 rounded-md bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Sandbox Scenario</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
