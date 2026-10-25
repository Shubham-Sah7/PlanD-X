"use client";

import React from "react";
import type { ScheduleImpactAnalysis } from "@/lib/programme-impact-analyzer";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  X,
  ShieldAlert,
  Coins,
  Flag,
} from "lucide-react";

interface ChangeImpactModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  impact: ScheduleImpactAnalysis | null;
}

export function ChangeImpactModal({
  isOpen,
  onClose,
  onConfirm,
  impact,
}: ChangeImpactModalProps) {
  if (!isOpen || !impact) return null;

  const isCritical = impact.riskSeverity === "critical";
  const isModerate = impact.riskSeverity === "moderate";

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div
              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                isCritical
                  ? "bg-red-100 text-red-700"
                  : isModerate
                  ? "bg-amber-100 text-amber-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isCritical ? (
                <ShieldAlert className="h-4 w-4" />
              ) : isModerate ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 text-sm">
                  Schedule Change Impact Preview
                </h3>
                <span
                  className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                    isCritical
                      ? "bg-red-100 text-red-800 border border-red-200"
                      : isModerate
                      ? "bg-amber-100 text-amber-800 border border-amber-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {impact.riskSeverity} Risk
                </span>
              </div>
              <p className="text-[11.5px] text-slate-500 font-mono">
                Activity: [{impact.wbs}] {impact.taskName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* Summary Banner */}
          <div
            className={`p-3 rounded-lg border text-xs leading-relaxed ${
              isCritical
                ? "bg-red-50/80 border-red-200 text-red-900"
                : isModerate
                ? "bg-amber-50/80 border-amber-200 text-amber-900"
                : "bg-emerald-50/80 border-emerald-200 text-emerald-900"
            }`}
          >
            <span className="font-bold block mb-0.5">Critical Path & Delivery Assessment:</span>
            {impact.summaryMessage}
          </div>

          {/* KPI Comparison Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-medium text-slate-500 block">Net Project Delay</span>
              <div
                className={`text-base font-bold font-mono mt-0.5 ${
                  impact.netProjectDelayDays > 0 ? "text-red-600" : "text-emerald-600"
                }`}
              >
                {impact.netProjectDelayDays > 0 ? `+${impact.netProjectDelayDays}d delay` : "0d (On Time)"}
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-medium text-slate-500 block">Projected Finish</span>
              <div className="text-xs font-bold font-mono text-slate-800 mt-1">
                {impact.projectedProjectFinish}
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-medium text-slate-500 block">Affected Activities</span>
              <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
                {impact.affectedTasksCount} tasks
              </div>
            </div>

            <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60">
              <span className="text-[10.5px] font-medium text-slate-500 block">Est. Cost Variance</span>
              <div
                className={`text-base font-bold font-mono mt-0.5 ${
                  impact.estimatedCostDelta > 0
                    ? "text-red-600"
                    : impact.estimatedCostDelta < 0
                    ? "text-emerald-600"
                    : "text-slate-700"
                }`}
              >
                {impact.estimatedCostDelta >= 0 ? `+£${impact.estimatedCostDelta.toLocaleString()}` : `-£${Math.abs(impact.estimatedCostDelta).toLocaleString()}`}
              </div>
            </div>
          </div>

          {/* Downstream Ripple Effect Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Downstream Activities Ripple Impact
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {impact.impactedTasks.length} affected
              </span>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-left text-[12px] border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider">
                    <th className="py-2 px-3">Downstream Task</th>
                    <th className="py-2 px-2.5">Current Finish</th>
                    <th className="py-2 px-2.5">Projected Finish</th>
                    <th className="py-2 px-2.5 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-[11.5px]">
                  {impact.impactedTasks.length > 0 ? (
                    impact.impactedTasks.map((t) => (
                      <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2 px-3 font-sans">
                          <div className="font-medium text-slate-900 truncate max-w-[220px]">
                            <span className="font-mono text-slate-400 mr-1.5">{t.wbs}</span>
                            {t.name}
                          </div>
                          {t.isMilestone && (
                            <span className="text-[9.5px] text-amber-700 bg-amber-50 px-1 py-0.2 rounded font-sans font-semibold">
                              Milestone
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-2.5 text-slate-500">{t.currentFinish}</td>
                        <td className="py-2 px-2.5 text-slate-900 font-semibold">{t.projectedFinish}</td>
                        <td
                          className={`py-2 px-2.5 text-right font-bold ${
                            t.varianceDays > 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {t.varianceDays > 0 ? `+${t.varianceDays}d` : `${t.varianceDays}d`}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-slate-400 font-sans italic text-xs">
                        Zero downstream activities are affected by this change.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-slate-200 flex items-center justify-between bg-slate-50/80">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-100 font-medium transition-colors"
          >
            Cancel Change
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className={`inline-flex items-center gap-1.5 rounded-lg text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors ${
                isCritical ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
              }`}
            >
              <span>Confirm & Apply Change</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
