"use client";

import React, { useState, useMemo } from "react";
import { useProgramme } from "@/lib/programme-context";
import {
  GitBranch,
  CheckCircle2,
  Trash2,
  ChevronDown,
  Plus,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

interface ScenarioSandboxBannerProps {
  onOpenCreateScenario?: () => void;
}

export function ScenarioSandboxBanner({ onOpenCreateScenario }: ScenarioSandboxBannerProps = {}) {
  const {
    activeScenario,
    allScenarios,
    switchScenario,
    approveAndMergeScenario,
    discardScenario,
    openCreateScenario,
    state,
    projectCalendar,
    currentUserRole,
    showToast,
  } = useProgramme();

  const [scenarioMenuOpen, setScenarioMenuOpen] = useState(false);
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");

  // Calculate live delta between scenario and live forecast
  const deltaMetrics = useMemo(() => {
    if (!activeScenario) return null;

    // Project completion dates
    const scenarioFinish = state.tasks.reduce(
      (max, t) => (t.endDate > max ? t.endDate : max),
      "2020-01-01"
    );
    const liveFinish = activeScenario.projectFinishDate || scenarioFinish;

    const diffDays = Math.round(
      (new Date(scenarioFinish).getTime() - new Date(liveFinish).getTime()) /
        (1000 * 60 * 60 * 24)
    );

    const scenarioCritical = state.tasks.filter((t) => t.isCritical).length;
    const scenarioCost = state.tasks.reduce((sum, t) => sum + (t.cost || 0), 0);

    return {
      scenarioFinish,
      liveFinish,
      diffDays,
      scenarioCritical,
      scenarioCost,
    };
  }, [activeScenario, state.tasks]);

  if (!activeScenario) {
    return null;
  }

  const handleApprove = () => {
    if (currentUserRole !== "planner" && currentUserRole !== "project-manager") {
      showToast("Only Planners and Project Managers have permission to approve scenarios.");
      return;
    }
    approveAndMergeScenario(activeScenario.id, approvalNotes);
    setApprovalModalOpen(false);
  };

  const handleDiscard = () => {
    if (window.confirm(`Are you sure you want to discard scenario '${activeScenario.name}'? This will revert your view back to the live working schedule.`)) {
      discardScenario(activeScenario.id);
    }
  };

  return (
    <>
      <div className="mb-3 rounded-lg border border-amber-300 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 px-3.5 py-2 text-slate-900 shadow-xs flex flex-wrap items-center justify-between gap-3 select-none">
        {/* Left: Indicator & Description */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-7 w-7 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0">
            <GitBranch className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 border border-amber-300">
                What-If Sandbox Active
              </span>
              <span className="font-bold text-xs text-slate-900 truncate">
                {activeScenario.name}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/80 truncate">
              {activeScenario.description || "Live Programme protected. Modifications do not affect baseline or working forecast."}
            </p>
          </div>
        </div>

        {/* Center: Live Variance Metrics */}
        {deltaMetrics && (
          <div className="hidden lg:flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans text-[11px]">Finish Delta:</span>
              <span
                className={`font-bold px-1.5 py-0.5 rounded text-[11px] ${
                  deltaMetrics.diffDays < 0
                    ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                    : deltaMetrics.diffDays > 0
                    ? "bg-red-100 text-red-800 border border-red-200"
                    : "bg-slate-100 text-slate-700"
                }`}
              >
                {deltaMetrics.diffDays < 0
                  ? `${Math.abs(deltaMetrics.diffDays)}d Earlier`
                  : deltaMetrics.diffDays > 0
                  ? `+${deltaMetrics.diffDays}d Delay`
                  : "0d (Exact Parity)"}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 font-sans text-[11px]">Critical Activities:</span>
              <span className="font-bold text-slate-800">{deltaMetrics.scenarioCritical}</span>
            </div>
          </div>
        )}

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          {/* Switch Scenario Dropdown */}
          <div className="relative">
            <button
              onClick={() => setScenarioMenuOpen(!scenarioMenuOpen)}
              className="inline-flex h-7 items-center gap-1 text-[11.5px] font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded px-2.5 shadow-2xs transition-colors"
            >
              <span>Scenarios ({allScenarios.length})</span>
              <ChevronDown className="h-3 w-3 text-slate-400" />
            </button>

            {scenarioMenuOpen && (
              <div className="absolute right-0 top-full mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-xl z-50 animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1.5 mb-1.5 border-b border-slate-100 px-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Available Scenarios
                  </span>
                  <button
                    onClick={() => {
                      switchScenario(null);
                      setScenarioMenuOpen(false);
                    }}
                    className="text-[11px] text-blue-600 hover:underline font-medium"
                  >
                    Back to Live
                  </button>
                </div>

                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {allScenarios.map((sc) => (
                    <button
                      key={sc.id}
                      onClick={() => {
                        switchScenario(sc.id);
                        setScenarioMenuOpen(false);
                      }}
                      className={`w-full text-left p-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                        sc.id === activeScenario.id
                          ? "bg-amber-100 text-amber-900 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <span className="truncate">{sc.name}</span>
                      {sc.id === activeScenario.id && (
                        <span className="text-[9.5px] bg-amber-500 text-white px-1 rounded font-bold">
                          ACTIVE
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                <div className="pt-2 mt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setScenarioMenuOpen(false);
                      (onOpenCreateScenario || openCreateScenario)();
                    }}
                    className="w-full inline-flex items-center justify-center gap-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs py-1.5 font-medium transition-colors"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Create New Scenario</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleDiscard}
            className="inline-flex h-7 items-center gap-1 text-[11.5px] font-medium text-red-700 bg-white hover:bg-red-50 border border-red-200 rounded px-2.5 transition-colors"
            title="Discard this scenario sandbox and return to live programme"
          >
            <Trash2 className="h-3 w-3" />
            <span>Discard</span>
          </button>

          <button
            type="button"
            onClick={() => setApprovalModalOpen(true)}
            className="inline-flex h-7 items-center gap-1.5 text-[11.5px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded px-3 shadow-xs transition-colors"
            title="Approve and merge scenario changes into the live programme"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Approve & Merge</span>
          </button>
        </div>
      </div>

      {/* Approve & Merge Confirmation Dialog */}
      {approvalModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Approve & Merge What-If Scenario
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Formal merger into live working programme
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-slate-700">
              <p>
                You are about to merge <span className="font-semibold text-slate-900">'{activeScenario.name}'</span> into the live programme.
              </p>
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-2.5 text-[11px] text-blue-900">
                A new immutable programme revision will be automatically recorded in the audit trail, and baseline comparison will highlight the changes.
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Approval Notes / Change Justification
                </label>
                <textarea
                  rows={2}
                  value={approvalNotes}
                  onChange={(e) => setApprovalNotes(e.target.value)}
                  placeholder="e.g. Approved PM instruction to adopt double-shift acceleration sequence."
                  className="w-full rounded border border-slate-300 p-2 text-xs outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModalOpen(false)}
                className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApprove}
                className="px-4 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded shadow-xs"
              >
                Confirm Approval & Merge
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
