"use client";

import React, { useState, useMemo } from "react";
import {
  FileText,
  Download,
  Printer,
  Calendar,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Layers,
  ChevronRight,
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Info,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  generateProgrammeReportData,
  exportProgrammeToCsv,
  downloadReportFile,
  ProgrammeReportData,
} from "@/lib/programme-reporting";
import type { ReportPeriod, LookaheadPeriod } from "@/lib/programme-types";

export function ProgrammeReportView() {
  const { state, projectCalendar, selectTask, openDrawer } = useProgramme();

  const [selectedPeriod, setSelectedPeriod] = useState<ReportPeriod>("lifecycle");
  const [selectedLookaheadHorizon, setSelectedLookaheadHorizon] = useState<LookaheadPeriod>("2-weeks");

  // Compile single-source report data
  const report = useMemo<ProgrammeReportData>(() => {
    return generateProgrammeReportData(state.tasks, projectCalendar, {
      projectName: "Ormiston Rise — Building 2 & Unit 80",
      projectLocation: "Siliguri, WB",
      reportingDate: "2025-10-15",
      period: selectedPeriod,
      lookaheadHorizon: selectedLookaheadHorizon,
    });
  }, [state.tasks, projectCalendar, selectedPeriod, selectedLookaheadHorizon]);

  // CSV export handler
  const handleExportCsv = () => {
    const csvContent = exportProgrammeToCsv(report);
    const dateStr = report.reportingDate.replace(/-/g, "");
    downloadReportFile(csvContent, `PlanD-X_Programme_Report_${dateStr}.csv`);
  };

  // JSON export handler
  const handleExportJson = () => {
    const jsonContent = JSON.stringify(report, null, 2);
    const dateStr = report.reportingDate.replace(/-/g, "");
    downloadReportFile(
      jsonContent,
      `PlanD-X_Programme_Report_${dateStr}.json`,
      "application/json;charset=utf-8;"
    );
  };

  // Print / Save as PDF handler
  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const netVariance = report.projectVarianceWorkingDays;
  const isDelayed = netVariance > 0;
  const isAhead = netVariance < 0;

  return (
    <div className="flex flex-col h-full w-full bg-white rounded-xl border border-slate-200 overflow-y-auto select-none print:border-none print:m-0 print:p-0">
      {/* ─── Top Action Bar & Report Controls (Hidden in Print) ─── */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-6 py-3.5 backdrop-blur-xs print:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-bold text-slate-900 tracking-tight">
                Programme Performance Report
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                Official
              </span>
            </div>
            <p className="text-[12px] text-slate-500">
              Verified single-source schedule analytics, baseline variance, and upcoming work plan.
            </p>
          </div>
        </div>

        {/* Action Buttons: Period Selector, Print, CSV Export */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Period Filter Dropdown */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50/70 p-0.5 text-[12px]">
            <button
              onClick={() => setSelectedPeriod("lifecycle")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedPeriod === "lifecycle"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Full Lifecycle
            </button>
            <button
              onClick={() => setSelectedPeriod("month")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedPeriod === "month"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Current Month
            </button>
            <button
              onClick={() => setSelectedPeriod("2-weeks")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedPeriod === "2-weeks"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              2-Week Lookahead
            </button>
            <button
              onClick={() => setSelectedPeriod("4-weeks")}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedPeriod === "4-weeks"
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/80"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              4-Week Lookahead
            </button>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 mx-1 hidden sm:block" />

          {/* Print / Save as PDF */}
          <button
            id="report-print-btn"
            onClick={handlePrint}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Print or Save as PDF"
          >
            <Printer className="h-3.5 w-3.5 text-slate-500" />
            <span>Print / PDF</span>
          </button>

          {/* Export CSV */}
          <button
            id="report-export-csv-btn"
            onClick={handleExportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-xs"
            title="Download full schedule report as RFC-4180 CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          {/* Export JSON */}
          <button
            onClick={handleExportJson}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-xs"
            title="Download JSON report payload"
          >
            <span>JSON</span>
          </button>
        </div>
      </div>

      {/* ─── Printable Report Document Canvas ─── */}
      <div className="p-8 max-w-6xl mx-auto w-full space-y-8 font-sans print:p-0 print:max-w-none">
        {/* Document Header & Metadata Banner */}
        <div className="border-b border-slate-200 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold tracking-widest text-blue-600 uppercase">
                  PlanD-X Programme Intelligence
                </span>
                <span className="text-slate-300">·</span>
                <span className="text-[12px] font-medium text-slate-500">
                  {report.projectLocation}
                </span>
              </div>
              <h1 className="text-[26px] font-bold text-slate-900 tracking-tight mt-0.5">
                {report.projectName}
              </h1>
              <p className="text-[13px] text-slate-500 mt-1">
                Executive Schedule Performance, Baseline Variance &amp; Operational Readiness Report
              </p>
            </div>

            {/* Document Stamp */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 text-right font-mono text-[11.5px] space-y-1 shrink-0">
              <div className="text-slate-500">
                Reporting Date: <strong className="text-slate-800">{report.reportingDate}</strong>
              </div>
              <div className="text-slate-500">
                Period: <span className="text-slate-800 font-sans font-medium">{report.periodLabel}</span>
              </div>
              <div className="text-slate-500 flex items-center justify-end gap-1 font-sans">
                <Clock className="h-3 w-3 text-slate-400" />
                <span>{report.calendarName} ({report.calendarWorkingDaysPerWeek}d/wk)</span>
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 1: Executive KPI Performance Dashboard ─── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 font-bold">
                1
              </span>
              Executive Schedule Performance
            </h3>
            <span className="text-[12px] text-slate-400 font-mono">
              {report.totalTasks} actionable activities analyzed
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Overall Progress */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="text-[12px] font-medium text-slate-500 mb-1">Overall Programme Progress</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold font-mono text-slate-900">
                  {report.overallProgress}%
                </span>
                <span className="text-[11px] text-slate-400">weighted</span>
              </div>
              <div className="w-full bg-slate-200 h-2 rounded-full mt-2.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${report.overallProgress}%` }}
                />
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                {report.completedTasks} completed · {report.inProgressTasks} active
              </div>
            </div>

            {/* Projected Completion Date */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="text-[12px] font-medium text-slate-500 mb-1">Projected Completion</div>
              <div className="text-[20px] font-bold font-mono text-slate-900 mt-1">
                {report.projectedCompletionDate}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-[12px]">
                {report.baselineCompletionDate ? (
                  isDelayed ? (
                    <span className="inline-flex items-center gap-1 text-red-600 font-medium">
                      <TrendingDown className="h-3.5 w-3.5" />
                      +{netVariance} working days slip
                    </span>
                  ) : isAhead ? (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <TrendingUp className="h-3.5 w-3.5" />
                      {Math.abs(netVariance)} working days ahead
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      On target with baseline
                    </span>
                  )
                ) : (
                  <span className="text-slate-400">Baseline not recorded</span>
                )}
              </div>
              <div className="text-[11px] text-slate-400 mt-1">
                Contract Target: {report.baselineCompletionDate || "Unset"}
              </div>
            </div>

            {/* Critical Path Health */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="text-[12px] font-medium text-slate-500 mb-1">Critical Path Exposure</div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-bold font-mono text-slate-900">
                  {report.criticalTasksCount}
                </span>
                <span className="text-[11px] text-slate-400">activities</span>
              </div>
              <div className="text-[12px] text-amber-700 font-medium mt-1">
                {Math.round((report.criticalTasksCount / (report.totalTasks || 1)) * 100)}% of schedule has 0 float
              </div>
              <div className="text-[11px] text-slate-400 mt-2 font-mono">
                Total span: {report.criticalPathSpanWorkingDays} working days
              </div>
            </div>

            {/* Blockers & Overdue Count */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-4">
              <div className="text-[12px] font-medium text-slate-500 mb-1">Action Items Required</div>
              <div className="flex items-baseline gap-3">
                <div>
                  <span className="text-[28px] font-bold font-mono text-red-600">
                    {report.blockedTasks}
                  </span>
                  <span className="text-[11px] text-red-600 ml-1">blocked</span>
                </div>
                <div>
                  <span className="text-[28px] font-bold font-mono text-amber-600">
                    {report.overdueTasks}
                  </span>
                  <span className="text-[11px] text-amber-600 ml-1">overdue</span>
                </div>
              </div>
              <div className="text-[11px] text-slate-500 mt-2">
                Requires trade intervention or RFI sign-off
              </div>
            </div>
          </div>
        </div>

        {/* ─── Section 2: Baseline vs Current Schedule Variance ─── */}
        <div className="break-inside-avoid">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 font-bold">
                2
              </span>
              Baseline 0 vs. Current Working Forecast
            </h3>
            {report.hasBaselineData ? (
              <span className="text-[12px] text-slate-500">
                {report.tasksWithBaseline} activities with approved contract baseline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                <Info className="h-3 w-3" />
                No contract baseline recorded
              </span>
            )}
          </div>

          {/* Variance Summary Bar */}
          {report.hasBaselineData && (
            <div className="grid grid-cols-4 gap-2 mb-3">
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-center">
                <div className="text-[11px] text-slate-500">On Track</div>
                <div className="text-[18px] font-bold font-mono text-emerald-600">{report.tasksOnTrack}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Delayed</div>
                <div className="text-[18px] font-bold font-mono text-red-600">{report.tasksDelayed}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Ahead</div>
                <div className="text-[18px] font-bold font-mono text-blue-600">{report.tasksAhead}</div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 text-center">
                <div className="text-[11px] text-slate-500">Without Baseline</div>
                <div className="text-[18px] font-bold font-mono text-slate-400">{report.tasksWithoutBaseline}</div>
              </div>
            </div>
          )}

          {/* Top Schedule Slippages Table */}
          {report.topDelayedTasks.length > 0 ? (
            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-left text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-20">WBS</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3 w-28">Trade</th>
                    <th className="py-2.5 px-3 w-28 font-mono">Baseline Finish</th>
                    <th className="py-2.5 px-3 w-28 font-mono">Forecast Finish</th>
                    <th className="py-2.5 px-3 w-24 text-right">Variance</th>
                    <th className="py-2.5 px-3 w-28">Schedule Risk</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                  {report.topDelayedTasks.map((d) => (
                    <tr
                      key={d.task.id}
                      onClick={() => {
                        selectTask(d.task.id);
                        openDrawer(d.task.id);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Click to inspect activity in Task Drawer"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-600 text-[11.5px]">
                        {d.task.wbs}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{d.task.name}</span>
                          {d.isCritical && (
                            <span className="rounded-xs bg-red-100 px-1 py-0.2 text-[9.5px] font-semibold text-red-800">
                              Critical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">{d.task.trade || "General"}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[11.5px]">{d.baselineFinish}</td>
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-800 text-[11.5px]">{d.currentFinish}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-red-600 text-[12px]">
                        +{d.finishVariance}d
                      </td>
                      <td className="py-2.5 px-3">
                        {d.impactType === "critical-delay" ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            Pushes Finish
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 font-medium">
                            Consumes Float
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6 text-center text-slate-500 text-[13px]">
              <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1.5" />
              All scheduled activities are currently tracking on or ahead of contract baseline dates.
            </div>
          )}
        </div>

        {/* ─── Section 3: Upcoming Lookahead Operational Work Plan ─── */}
        <div className="break-inside-avoid">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 font-bold">
                3
              </span>
              Upcoming Operational Lookahead Plan
            </h3>
            <div className="flex items-center gap-2 text-[12px] text-slate-600">
              <span className="font-medium text-slate-800">{report.lookaheadRange.displayRange}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-slate-500">{report.lookaheadRange.workingDays} working days</span>
            </div>
          </div>

          {/* Lookahead KPI Tally */}
          <div className="grid grid-cols-5 gap-2 mb-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">In Horizon</div>
              <div className="text-[16px] font-bold font-mono text-slate-800">{report.lookaheadStats.totalCount}</div>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-2 text-center">
              <div className="text-[10px] text-emerald-700 font-semibold uppercase">Ready</div>
              <div className="text-[16px] font-bold font-mono text-emerald-700">{report.lookaheadStats.readyCount}</div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-2 text-center">
              <div className="text-[10px] text-amber-700 font-semibold uppercase">Dep Risk</div>
              <div className="text-[16px] font-bold font-mono text-amber-700">{report.lookaheadStats.dependencyRiskCount}</div>
            </div>
            <div className="rounded-lg border border-red-200 bg-red-50/40 p-2 text-center">
              <div className="text-[10px] text-red-700 font-semibold uppercase">Blocked</div>
              <div className="text-[16px] font-bold font-mono text-red-700">{report.lookaheadStats.blockedCount}</div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-2 text-center">
              <div className="text-[10px] text-slate-500 font-semibold uppercase">Critical</div>
              <div className="text-[16px] font-bold font-mono text-slate-800">{report.lookaheadStats.criticalCount}</div>
            </div>
          </div>

          {/* Upcoming Activities Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-[12.5px] border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3 w-16">WBS</th>
                  <th className="py-2.5 px-3">Activity Name</th>
                  <th className="py-2.5 px-3 w-28">Readiness</th>
                  <th className="py-2.5 px-3 w-28 font-mono">Start</th>
                  <th className="py-2.5 px-3 w-28 font-mono">Finish</th>
                  <th className="py-2.5 px-3 w-20 text-center font-mono">Dur</th>
                  <th className="py-2.5 px-3 w-36">Subcontractor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal text-slate-700">
                {report.lookaheadActivities.slice(0, 12).map((item) => {
                  const t = item.task;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => {
                        selectTask(t.id);
                        openDrawer(t.id);
                      }}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                      title="Click to view details in Task Drawer"
                    >
                      <td className="py-2 px-3 font-mono font-medium text-slate-600 text-[11.5px]">{t.wbs}</td>
                      <td className="py-2 px-3 font-medium text-slate-900 group-hover:text-blue-600 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <span>{t.name}</span>
                          {t.isCritical && (
                            <span className="rounded-xs bg-red-100 px-1 py-0.2 text-[9px] font-semibold text-red-800">
                              Critical
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${
                            item.readiness === "ready"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              : item.readiness === "blocked"
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : item.readiness === "overdue"
                              ? "bg-amber-50 text-amber-800 border border-amber-200"
                              : item.readiness === "dependency-risk"
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-slate-100 text-slate-700 border border-slate-200"
                          }`}
                        >
                          {item.readiness === "dependency-risk" ? "Dep Risk" : item.readiness}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono text-[11.5px] text-slate-600">{t.startDate}</td>
                      <td className="py-2 px-3 font-mono text-[11.5px] text-slate-600">{t.endDate}</td>
                      <td className="py-2 px-3 text-center font-mono text-[11.5px] text-slate-500">{t.duration}d</td>
                      <td className="py-2 px-3 text-slate-600 text-[12px] truncate">
                        {t.subcontractor || t.assignee || <span className="text-slate-400 italic">Unassigned</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── Section 4: Active Blockers & Overdue Action Register ─── */}
        {report.actionItems.length > 0 && (
          <div className="break-inside-avoid">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 font-bold">
                  4
                </span>
                Active Site Blockers &amp; Overdue Items
              </h3>
              <span className="text-[12px] text-red-600 font-medium">
                {report.actionItems.length} action items requiring resolution
              </span>
            </div>

            <div className="rounded-xl border border-red-200/80 bg-red-50/20 overflow-hidden">
              <table className="w-full text-left text-[12.5px] border-collapse">
                <thead>
                  <tr className="bg-red-50/80 border-b border-red-200 text-red-900 text-[11px] font-semibold uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-16">WBS</th>
                    <th className="py-2.5 px-3">Activity</th>
                    <th className="py-2.5 px-3 w-24">Type</th>
                    <th className="py-2.5 px-3">Recorded Blocker / Cause</th>
                    <th className="py-2.5 px-3 w-36">Accountable</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-red-100 font-normal text-slate-800">
                  {report.actionItems.map((act) => (
                    <tr
                      key={act.task.id}
                      onClick={() => {
                        selectTask(act.task.id);
                        openDrawer(act.task.id);
                      }}
                      className="hover:bg-red-50/50 transition-colors cursor-pointer group"
                      title="Click to resolve in Task Drawer"
                    >
                      <td className="py-2.5 px-3 font-mono font-medium text-slate-700 text-[11.5px]">
                        {act.task.wbs}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-900 group-hover:text-blue-600">
                        {act.task.name}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10.5px] font-semibold uppercase ${
                            act.issueType === "blocked"
                              ? "bg-red-100 text-red-800"
                              : act.issueType === "overdue"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-red-200 text-red-900"
                          }`}
                        >
                          {act.issueType}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-700 text-[12px]">
                        {act.reason}
                        {act.daysOverdue > 0 && (
                          <span className="text-red-600 font-mono ml-2 font-medium">
                            ({act.daysOverdue}d slipped)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[12px]">
                        {act.task.subcontractor || act.task.assignee || "Unassigned"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── Section 5: Trade Discipline Breakdown ─── */}
        <div className="break-inside-avoid">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[11px] text-slate-700 font-bold">
                5
              </span>
              Trade &amp; Subcontractor Performance Breakdown
            </h3>
            <span className="text-[12px] text-slate-400">
              {report.tradeBreakdown.length} active trade packages
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {report.tradeBreakdown.map((tr) => (
              <div
                key={tr.trade}
                className="rounded-xl border border-slate-200 bg-white p-3.5 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13.5px] font-bold text-slate-900">{tr.trade}</span>
                    <span className="font-mono text-[13px] font-semibold text-slate-800">
                      {tr.avgProgress}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-blue-600 h-full rounded-full transition-all"
                      style={{ width: `${tr.avgProgress}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11.5px] text-slate-500 mt-3 pt-2 border-t border-slate-100 font-mono">
                  <span>{tr.totalTasks} total</span>
                  <span className="text-emerald-600 font-medium">{tr.completedTasks} done</span>
                  <span className="text-blue-600 font-medium">{tr.inProgressTasks} active</span>
                  {tr.blockedTasks > 0 ? (
                    <span className="text-red-600 font-bold">{tr.blockedTasks} blocked</span>
                  ) : (
                    <span className="text-slate-400">0 blocked</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Document Footer Sign-off (for official construction distribution) */}
        <div className="border-t border-slate-200 pt-6 mt-10 text-[11px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:text-slate-600">
          <div>
            Generated by PlanD-X Construction Intelligence · Report ID: PRG-REP-{report.reportingDate.replace(/-/g, "")}
            <br />
            Data Source: Verified Critical Path Engine &amp; Baseline 0 Contract Register.
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="font-semibold text-slate-700">Project Director Sign-Off:</div>
              <div className="h-6 w-36 border-b border-slate-300 mt-1" />
            </div>
            <div className="text-right">
              <div className="font-semibold text-slate-700">Date:</div>
              <div className="h-6 w-24 border-b border-slate-300 mt-1" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
