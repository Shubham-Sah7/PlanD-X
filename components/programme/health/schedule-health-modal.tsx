"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  X,
  ExternalLink,
  Search,
  ArrowRight,
  GitBranch,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  analyzeScheduleHealth,
  type ScheduleHealthReport,
  type ScheduleHealthIssue,
  type HealthCategory,
  type HealthSeverity,
} from "@/lib/programme-schedule-health";

export function ScheduleHealthModal() {
  const {
    tasks,
    projectCalendar,
    isHealthModalOpen,
    closeHealthModal,
    selectTask,
    openDrawer,
  } = useProgramme();

  const [activeCategory, setActiveCategory] = useState<HealthCategory | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<"all" | HealthSeverity>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isHealthModalOpen) {
        closeHealthModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHealthModalOpen, closeHealthModal]);

  // Evaluate DCMA 14-point schedule health
  const health: ScheduleHealthReport = useMemo(() => {
    return analyzeScheduleHealth(tasks, projectCalendar);
  }, [tasks, projectCalendar]);

  // Filter issues based on category, severity, and search
  const filteredIssues = useMemo(() => {
    return health.issues.filter((issue: ScheduleHealthIssue) => {
      if (activeCategory !== "all" && issue.category !== activeCategory) {
        return false;
      }
      if (severityFilter !== "all" && issue.severity !== severityFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = issue.ruleName.toLowerCase().includes(q);
        const matchDesc = issue.description.toLowerCase().includes(q);
        const matchTask = issue.taskName?.toLowerCase().includes(q) || false;
        const matchWbs = issue.wbs?.toLowerCase().includes(q) || false;
        if (!matchTitle && !matchDesc && !matchTask && !matchWbs) return false;
      }
      return true;
    });
  }, [health.issues, activeCategory, severityFilter, searchQuery]);

  if (!isHealthModalOpen) return null;

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-emerald-700 bg-emerald-50 border-emerald-200";
    if (score >= 80) return "text-blue-700 bg-blue-50 border-blue-200";
    if (score >= 70) return "text-amber-700 bg-amber-50 border-amber-200";
    return "text-red-700 bg-red-50 border-red-200";
  };

  const getSeverityBadge = (severity: HealthSeverity) => {
    if (severity === "critical") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-red-100 px-2 py-0.5 text-[11px] font-semibold text-red-800">
          <AlertCircle className="h-3 w-3 text-red-600" />
          Critical
        </span>
      );
    }
    if (severity === "warning") {
      return (
        <span className="inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
          <AlertTriangle className="h-3 w-3 text-amber-600" />
          Warning
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
        <Info className="h-3 w-3 text-slate-500" />
        Info
      </span>
    );
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="schedule-health-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        className="flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h2 id="schedule-health-title" className="text-[17px] font-semibold text-slate-900">
                Schedule Quality &amp; DCMA 14-Point Risk Analysis
              </h2>
              <p className="text-[12px] text-slate-500">
                Real-time validation against construction industry scheduling standards &amp; logic integrity
              </p>
            </div>
          </div>
          <button
            onClick={closeHealthModal}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            title="Close dialog (Escape)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Health Score & Metric Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-5 bg-white border-b border-slate-100">
          {/* Health Score Gauge */}
          <div
            className={`flex flex-col items-center justify-center p-3 rounded-lg border ${getScoreColor(
              health.score
            )}`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-wider">Health Score</span>
            <div className="flex items-baseline gap-1 mt-0.5">
              <span className="text-3xl font-extrabold">{health.score}%</span>
              <span className="text-[13px] font-bold">Grade {health.grade}</span>
            </div>
          </div>

          {/* Metric 1: Critical Issues */}
          <div className="flex flex-col justify-between p-3 rounded-lg border border-red-200 bg-red-50/50 text-red-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase">Critical Issues</span>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </div>
            <span className="text-2xl font-bold">{health.summary.criticalIssues}</span>
            <span className="text-[11px] text-red-700">Loops, breaks &amp; clashes</span>
          </div>

          {/* Metric 2: Warnings */}
          <div className="flex flex-col justify-between p-3 rounded-lg border border-amber-200 bg-amber-50/50 text-amber-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase">Warnings</span>
              <AlertTriangle className="h-4 w-4 text-amber-600" />
            </div>
            <span className="text-2xl font-bold">{health.summary.warningIssues}</span>
            <span className="text-[11px] text-amber-700">Dangling, progress, constraints</span>
          </div>

          {/* Metric 3: Near-Critical Paths */}
          <div className="flex flex-col justify-between p-3 rounded-lg border border-purple-200 bg-purple-50/40 text-purple-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase">Near-Critical</span>
              <GitBranch className="h-4 w-4 text-purple-600" />
            </div>
            <span className="text-2xl font-bold">
              {tasks.filter((t) => t.isNearCritical || (t.float > 0 && t.float <= 5)).length}
            </span>
            <span className="text-[11px] text-purple-700">Float ≤ 5 working days</span>
          </div>

          {/* Metric 4: Passed Quality Rules */}
          <div className="flex flex-col justify-between p-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-900">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold uppercase">Quality Checks</span>
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold">
              {Object.values(health.categories).filter((c) => c.passed).length} / 15
            </span>
            <span className="text-[11px] text-emerald-700">Categories passed</span>
          </div>
        </div>

        {/* Methodology & Non-Destructive Guarantee Banner */}
        <div className="flex items-center justify-between gap-3 px-6 py-2 bg-slate-50 border-b border-slate-200 text-[11.5px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-blue-600 shrink-0" />
            <span>
              <strong>Scoring Formula:</strong> Base 100% minus 5 pts per Critical, 2 pts per Warning, 0.5 pts per Info item.
            </span>
          </div>
          <span className="font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
            Non-Destructive: Schedule dates &amp; dependencies are never modified automatically
          </span>
        </div>

        {/* Filtering & Category Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-6 py-2.5 bg-slate-50 text-[12px]">
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center gap-1">
            {[
              { id: "all", label: "All Checks" },
              { id: "logic", label: "Logic" },
              { id: "circular", label: "Loops" },
              { id: "conflicts", label: "Date Clashes" },
              { id: "constraints", label: "Constraints" },
              { id: "float-risk", label: "Float Risk" },
              { id: "progress", label: "Progress & Actuals" },
              { id: "calendars", label: "Calendars" },
              { id: "summaries", label: "Summaries" },
              { id: "milestones", label: "Milestones" },
              { id: "forecasts", label: "Forecasts" },
              { id: "resources", label: "Resources" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveCategory(tab.id as any)}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  activeCategory === tab.id
                    ? "bg-white text-blue-700 shadow-2xs border border-slate-200"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Severity & Search Controls */}
          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[12px] text-slate-700 focus:outline-hidden focus:border-blue-500"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="warning">Warnings Only</option>
              <option value="info">Info Only</option>
            </select>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search rule or task..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 w-44 rounded-md border border-slate-200 bg-white pl-8 pr-2 text-[12px] text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Issues List Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {filteredIssues.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-2" />
              <h3 className="text-[15px] font-semibold text-slate-900">
                No Schedule Health Issues Found
              </h3>
              <p className="text-[12.5px] text-slate-500 max-w-sm mt-1">
                Your schedule complies with standard DCMA 14-point criteria for this filter. No
                dangling logic, hard constraint conflicts, or excessive float anomalies detected.
              </p>
            </div>
          ) : (
            filteredIssues.map((issue: ScheduleHealthIssue) => (
              <div
                key={issue.id}
                className={`rounded-lg border p-4 transition-colors ${
                  issue.severity === "critical"
                    ? "border-red-200 bg-red-50/30"
                    : issue.severity === "warning"
                    ? "border-amber-200 bg-amber-50/20"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {getSeverityBadge(issue.severity)}
                      <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {issue.category} Check
                      </span>
                      {issue.wbs && (
                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 rounded px-1.5 py-0.2">
                          WBS {issue.wbs}
                        </span>
                      )}
                    </div>
                    <h4 className="text-[13.5px] font-semibold text-slate-900">{issue.ruleName}</h4>
                    <p className="text-[12.5px] text-slate-600 mt-1">{issue.description}</p>
                    {issue.recommendation && (
                      <div className="flex items-start gap-1.5 mt-2 rounded bg-white/80 border border-slate-200/80 p-2 text-[12px] text-slate-700">
                        <ArrowRight className="h-3.5 w-3.5 text-blue-600 shrink-0 mt-0.5" />
                        <span>
                          <strong className="text-slate-900">Recommendation:</strong>{" "}
                          {issue.recommendation}
                        </span>
                      </div>
                    )}
                  </div>

                  {issue.taskId && (
                    <button
                      type="button"
                      onClick={() => {
                        selectTask(issue.taskId!);
                        openDrawer(issue.taskId!);
                        closeHealthModal();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors shrink-0 shadow-2xs cursor-pointer"
                      title="Inspect affected activity in task drawer"
                    >
                      <span>Inspect Task</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 text-[12px] text-slate-500">
          <div className="flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span>
              PlanD-X does not automatically distort network dependencies to remove quality warnings.
            </span>
          </div>
          <button
            onClick={closeHealthModal}
            className="rounded-md border border-slate-200 bg-white px-4 py-1.5 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
