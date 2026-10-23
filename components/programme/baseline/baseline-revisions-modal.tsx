"use client";

import React, { useState, useMemo } from "react";
import {
  X,
  ShieldCheck,
  History,
  Lock,
  GitBranch,
  RotateCcw,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Download,
  Search,
  Filter,
  ArrowRight,
  Clock,
  User,
  Sparkles,
  Layers,
  Calendar,
  FileCheck,
  Flame,
  ChevronRight,
  RefreshCw,
  GitCompare,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  ScheduleChangeEvent,
  ScheduleChangeField,
  ScheduleChangeSource,
  formatChangeSummary,
} from "@/lib/programme-change-tracker";
import { BaselineSnapshot } from "@/lib/programme-baseline";
import { formatDisplayDate } from "@/lib/programme-calendar";

export function BaselineRevisionsModal() {
  const {
    isRevisionsOpen,
    closeRevisions,
    baselineSnapshots,
    baselineIntegrity,
    takeBaselineSnapshot,
    replaceActiveBaseline,
    restoreScheduleToBaseline,
    scheduleAuditLog,
    clearAuditHistory,
    showToast,
  } = useProgramme();

  const [activeTab, setActiveTab] = useState<"baselines" | "audit">("baselines");

  // Snapshot modal dialog state
  const [isSnapshotDialogOpen, setIsSnapshotDialogOpen] = useState(false);
  const [snapshotName, setSnapshotName] = useState("");
  const [snapshotDesc, setSnapshotDesc] = useState("");

  // Replace baseline confirmation dialog state
  const [isReplaceConfirmOpen, setIsReplaceConfirmOpen] = useState(false);
  const [replaceReason, setReplaceReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  // Restore confirmation dialog state
  const [isRestoreConfirmOpen, setIsRestoreConfirmOpen] = useState(false);

  // Audit filter state
  const [auditSearch, setAuditSearch] = useState("");
  const [fieldFilter, setFieldFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<string>("all");

  // Filtered audit log
  const filteredAuditLog = useMemo(() => {
    return scheduleAuditLog.filter((item) => {
      if (auditSearch.trim()) {
        const q = auditSearch.toLowerCase();
        const matchTask = item.taskName.toLowerCase().includes(q);
        const matchWbs = item.wbs?.toLowerCase().includes(q) ?? false;
        const matchUser = item.changedBy.toLowerCase().includes(q);
        const matchReason = item.reason?.toLowerCase().includes(q) ?? false;
        if (!matchTask && !matchWbs && !matchUser && !matchReason) return false;
      }
      if (fieldFilter !== "all" && item.field !== fieldFilter) {
        return false;
      }
      if (sourceFilter !== "all" && item.changeSource !== sourceFilter) {
        return false;
      }
      return true;
    });
  }, [scheduleAuditLog, auditSearch, fieldFilter, sourceFilter]);

  if (!isRevisionsOpen) return null;

  const handleCreateSnapshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!snapshotName.trim()) return;
    takeBaselineSnapshot({
      name: snapshotName.trim(),
      description: snapshotDesc.trim() || "Manual revision snapshot taken before schedule changes.",
      type: "approved-revision",
    });
    setSnapshotName("");
    setSnapshotDesc("");
    setIsSnapshotDialogOpen(false);
  };

  const handleConfirmReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmText !== "REPLACE") return;
    replaceActiveBaseline(
      `Approved Revision ${baselineSnapshots.length}`,
      replaceReason.trim() || "Authorised employer change order re-baseline."
    );
    setIsReplaceConfirmOpen(false);
    setConfirmText("");
    setReplaceReason("");
  };

  const handleConfirmRestore = () => {
    restoreScheduleToBaseline();
    setIsRestoreConfirmOpen(false);
  };

  const handleExportAuditCSV = () => {
    const headers = ["Timestamp", "Task ID", "WBS", "Task Name", "Field", "Previous Value", "New Value", "Changed By", "Role", "Source", "Reason"];
    const rows = filteredAuditLog.map((ev) => [
      `"${ev.timestamp}"`,
      `"${ev.taskId}"`,
      `"${ev.wbs || ""}"`,
      `"${ev.taskName.replace(/"/g, '""')}"`,
      `"${ev.fieldLabel}"`,
      `"${ev.previousValue ?? ""}"`,
      `"${ev.newValue ?? ""}"`,
      `"${ev.changedBy}"`,
      `"${ev.userRole || ""}"`,
      `"${ev.changeSource}"`,
      `"${(ev.reason || "").replace(/"/g, '""')}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `plandx_schedule_audit_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Exported schedule change history to CSV.");
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="baseline-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
    >
      <div className="relative flex flex-col h-[90vh] max-h-[860px] w-full max-w-5xl rounded-xl bg-white shadow-2xl border border-slate-200 overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 id="baseline-modal-title" className="text-lg font-bold text-slate-900">
                  Baseline Integrity &amp; Schedule History
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <Lock className="h-3 w-3" />
                  Contract Baseline 0 Protected
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Official contract benchmark tracking, revision snapshots, and field-level schedule change audit trail.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={closeRevisions}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 bg-white">
          <div className="flex items-center gap-1 -mb-px">
            <button
              onClick={() => setActiveTab("baselines")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "baselines"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <GitBranch className="h-4 w-4" />
              <span>Approved Baselines &amp; Integrity</span>
              <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-mono">
                {baselineSnapshots.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
                activeTab === "audit"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <History className="h-4 w-4" />
              <span>Schedule Change Audit Trail</span>
              <span className="ml-1 rounded-full bg-blue-100 px-2 py-0.5 text-[10px] text-blue-700 font-mono font-bold">
                {scheduleAuditLog.length}
              </span>
            </button>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2 py-2">
            {activeTab === "baselines" && (
              <>
                <button
                  type="button"
                  onClick={() => setIsRestoreConfirmOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
                  title="Revert working forecast schedule dates to approved baseline"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-slate-500" />
                  <span>Restore Forecast to Baseline</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSnapshotName(`Approved Revision ${baselineSnapshots.length}`);
                    setSnapshotDesc("");
                    setIsSnapshotDialogOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs cursor-pointer"
                >
                  <Camera className="h-3.5 w-3.5" />
                  <span>Snapshot New Baseline</span>
                </button>
              </>
            )}

            {activeTab === "audit" && (
              <button
                type="button"
                onClick={handleExportAuditCSV}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-slate-500" />
                <span>Export Audit CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50">
          {activeTab === "baselines" && (
            <div className="space-y-6">
              {/* Baseline 0 Status Banner */}
              <div className="rounded-xl border border-blue-200 bg-linear-to-r from-blue-50/90 to-indigo-50/90 p-4 shadow-2xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
                      <Lock className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">Baseline 0 (Contract Baseline)</span>
                        <span className="rounded-sm bg-blue-600 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
                          Contract Benchmark
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">
                        Approved by <span className="font-semibold text-slate-800">Sarah Jenkins</span> (Employer's Agent / Contract Admin) on 20 Aug 2025.
                        Routine updates and scheduling recalculations never modify this benchmark.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setIsReplaceConfirmOpen(true)}
                      className="px-3 py-1.5 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      <span>Re-baseline Active Schedule</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Integrity & Health Metrics Grid */}
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                  <FileCheck className="h-3.5 w-3.5 text-blue-600" />
                  <span>Baseline Coverage &amp; Schedule Variance Metrics</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Total Programme Tasks</span>
                    <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                      {baselineIntegrity.totalTasks}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">100% indexed in WBS</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Baseline Coverage</span>
                    <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
                      {baselineIntegrity.tasksWithBaseline}/{baselineIntegrity.totalTasks}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-medium mt-0.5 block">
                      {Math.round((baselineIntegrity.tasksWithBaseline / Math.max(1, baselineIntegrity.totalTasks)) * 100)}% benchmarked
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Tasks On Track</span>
                    <span className="text-xl font-bold font-mono text-slate-700 mt-1 block">
                      {baselineIntegrity.tasksOnTrack}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5 block">0d finish variance</span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Delayed Tasks</span>
                    <span className="text-xl font-bold font-mono text-rose-600 mt-1 block">
                      {baselineIntegrity.tasksDelayedVsBaseline}
                    </span>
                    <span className="text-[10px] text-rose-600 font-semibold mt-0.5 block">
                      Max: +{baselineIntegrity.maxDelayDays}d slip
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Ahead Tasks</span>
                    <span className="text-xl font-bold font-mono text-indigo-600 mt-1 block">
                      {baselineIntegrity.tasksAheadOfBaseline}
                    </span>
                    <span className="text-[10px] text-indigo-600 font-medium mt-0.5 block">
                      Max: -{baselineIntegrity.maxAheadDays}d early
                    </span>
                  </div>

                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-2xs">
                    <span className="text-[11px] font-medium text-slate-500 block">Critical Path Delay</span>
                    <span className="text-xl font-bold font-mono text-amber-600 mt-1 block flex items-center gap-1">
                      <Flame className="h-4 w-4 text-amber-500 shrink-0" />
                      {baselineIntegrity.criticalTasksDelayed}
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold mt-0.5 block">
                      Overall: {baselineIntegrity.varianceDays > 0 ? `+${baselineIntegrity.varianceDays}d` : `${baselineIntegrity.varianceDays}d`}
                    </span>
                  </div>
                </div>
              </div>

              {/* Baseline Revisions List */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <GitBranch className="h-3.5 w-3.5 text-blue-600" />
                    <span>Saved Baseline Revisions ({baselineSnapshots.length})</span>
                  </h3>
                  <span className="text-xs text-slate-400">
                    Active Benchmark: <strong className="text-slate-700">Baseline 0 (Contract)</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  {baselineSnapshots.map((snap, idx) => (
                    <div
                      key={snap.id}
                      className="rounded-lg border border-slate-200 bg-white p-4 shadow-2xs hover:border-slate-300 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md font-mono text-xs font-bold ${
                              idx === 0
                                ? "bg-blue-100 text-blue-700 border border-blue-200"
                                : "bg-purple-100 text-purple-700 border border-purple-200"
                            }`}
                          >
                            REV{snap.versionNumber}
                          </div>

                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-sm font-semibold text-slate-900">{snap.name}</h4>
                              {idx === 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-xs bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                                  <Lock className="h-2.5 w-2.5" />
                                  Active Benchmark
                                </span>
                              ) : (
                                <span className="rounded-xs bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 border border-purple-200">
                                  Approved Snapshot
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{snap.description}</p>
                            <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-slate-400">
                              <span className="flex items-center gap-1 text-slate-600">
                                <User className="h-3 w-3 text-slate-400" />
                                <span>{snap.approvedBy} ({snap.approvedByRole})</span>
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 text-slate-600 font-mono">
                                <Clock className="h-3 w-3 text-slate-400" />
                                <span>{snap.createdAt.slice(0, 10)}</span>
                              </span>
                              <span>·</span>
                              <span className="font-mono text-slate-600">{snap.taskCount} tasks</span>
                              <span>·</span>
                              <span className="font-mono text-slate-600">
                                {snap.projectStartDate} → {snap.projectFinishDate}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                          <span
                            className="h-3 w-5 rounded-xs border border-slate-400 inline-block shrink-0"
                            style={{
                              backgroundImage:
                                "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 2px, rgba(100, 116, 139, 0.95) 2px, rgba(100, 116, 139, 0.95) 4px)",
                            }}
                            title="Gantt baseline reference pattern"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-4">
              {/* Audit Controls & Filters */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                  {/* Search */}
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter by task, WBS, user, or reason..."
                      value={auditSearch}
                      onChange={(e) => setAuditSearch(e.target.value)}
                      className="w-full rounded-md border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                  </div>

                  {/* Field Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Field:</span>
                    <select
                      value={fieldFilter}
                      onChange={(e) => setFieldFilter(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Fields</option>
                      <option value="duration">Duration</option>
                      <option value="startDate">Start Date</option>
                      <option value="endDate">Finish Date</option>
                      <option value="progress">Progress</option>
                      <option value="status">Status</option>
                      <option value="predecessors">Dependencies</option>
                      <option value="resource">Subcontractor</option>
                      <option value="baseline">Baseline Events</option>
                    </select>
                  </div>

                  {/* Source Filter */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-500 font-medium">Source:</span>
                    <select
                      value={sourceFilter}
                      onChange={(e) => setSourceFilter(e.target.value)}
                      className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="all">All Sources</option>
                      <option value="user-edit">Manual User Edits</option>
                      <option value="cpm-recalculation">CPM Recalculations</option>
                      <option value="baseline-snapshot">Baseline Snapshots</option>
                      <option value="schedule-import">Schedule Imports</option>
                      <option value="restored-baseline">Restored Baseline</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500 font-mono">
                    Showing <strong>{filteredAuditLog.length}</strong> of {scheduleAuditLog.length} events
                  </span>
                  {scheduleAuditLog.length > 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Reset audit trail to initial baseline state?")) {
                          clearAuditHistory();
                        }
                      }}
                      className="text-xs text-slate-400 hover:text-red-600 transition-colors px-2 py-1"
                    >
                      Reset
                    </button>
                  )}
                </div>
              </div>

              {/* Audit Log Table / Timeline */}
              <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-2xs">
                {filteredAuditLog.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <th className="py-2.5 px-3">Timestamp</th>
                          <th className="py-2.5 px-3">Task / Activity</th>
                          <th className="py-2.5 px-3">Field Changed</th>
                          <th className="py-2.5 px-3">Previous Value</th>
                          <th className="py-2.5 px-3">New Value</th>
                          <th className="py-2.5 px-3">Changed By</th>
                          <th className="py-2.5 px-3">Source &amp; Reason</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-normal">
                        {filteredAuditLog.map((event) => {
                          const isCPM = event.changeSource === "cpm-recalculation";
                          const isBaseline = event.changeSource === "baseline-snapshot" || event.changeSource === "restored-baseline";

                          return (
                            <tr key={event.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                                {event.timestamp.replace("T", " ").slice(0, 16)}
                              </td>

                              <td className="py-2.5 px-3 font-medium text-slate-900 max-w-[200px]">
                                <div className="truncate font-semibold text-slate-800" title={event.taskName}>
                                  {event.taskName}
                                </div>
                                {event.wbs && (
                                  <div className="font-mono text-[10px] text-slate-400">
                                    WBS {event.wbs} · {event.taskId}
                                  </div>
                                )}
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10.5px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {event.fieldLabel}
                                </span>
                              </td>

                              <td className="py-2.5 px-3 font-mono text-[11.5px] text-slate-500 whitespace-nowrap">
                                {event.previousValue !== null ? String(event.previousValue) : <span className="italic text-slate-300">—</span>}
                              </td>

                              <td className="py-2.5 px-3 font-mono text-[11.5px] font-semibold text-blue-700 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <ArrowRight className="h-3 w-3 text-slate-400" />
                                  <span>{event.newValue !== null ? String(event.newValue) : <span className="italic text-slate-300">—</span>}</span>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 whitespace-nowrap">
                                <div className="flex items-center gap-1.5">
                                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700">
                                    {event.changedBy.slice(0, 1)}
                                  </div>
                                  <div>
                                    <div className="text-[11.5px] font-medium text-slate-800">{event.changedBy}</div>
                                    {event.userRole && <div className="text-[10px] text-slate-400">{event.userRole}</div>}
                                  </div>
                                </div>
                              </td>

                              <td className="py-2.5 px-3 max-w-[240px]">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${
                                      isCPM
                                        ? "bg-purple-50 text-purple-700 border border-purple-200"
                                        : isBaseline
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                        : "bg-blue-50 text-blue-700 border border-blue-200"
                                    }`}
                                  >
                                    {event.changeSource}
                                  </span>
                                </div>
                                {event.reason && (
                                  <p className="text-[11px] text-slate-500 truncate" title={event.reason}>
                                    {event.reason}
                                  </p>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    No schedule changes match the specified filter criteria.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Snapshot Modal Dialog */}
        {isSnapshotDialogOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-blue-600" />
                  <h3 className="text-sm font-bold text-slate-900">Snapshot New Approved Baseline</h3>
                </div>
                <button
                  onClick={() => setIsSnapshotDialogOpen(false)}
                  className="rounded p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleCreateSnapshot} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Revision Name
                  </label>
                  <input
                    type="text"
                    required
                    value={snapshotName}
                    onChange={(e) => setSnapshotName(e.target.value)}
                    placeholder="e.g. Approved Revision 1 - Q1 Resequence"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Approval Reason &amp; Change Order Reference
                  </label>
                  <textarea
                    rows={3}
                    value={snapshotDesc}
                    onChange={(e) => setSnapshotDesc(e.target.value)}
                    placeholder="e.g. Approved change order CO-012 for structural formwork resequencing."
                    className="w-full rounded-md border border-slate-300 p-2.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div className="rounded-lg bg-blue-50 p-2.5 text-[11px] text-blue-800 flex items-start gap-2 border border-blue-200/60">
                  <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    Captures all {baselineIntegrity.totalTasks} task forecast dates, durations, and milestones into an immutable revision snapshot attributed to <strong>Demo Builder</strong>.
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsSnapshotDialogOpen(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs"
                  >
                    Create Snapshot
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Replace Baseline Confirmation Dialog */}
        {isReplaceConfirmOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-2xl border border-amber-300 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 border border-amber-200">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Replace Active Approved Baseline?
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    Warning: Replacing the active baseline overwrites the contract benchmark dates (<span className="font-mono text-slate-800 font-bold">baseline0Start</span> &amp; <span className="font-mono text-slate-800 font-bold">baseline0Finish</span>) with current forecast dates for all tasks.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-900 border border-amber-200 space-y-1.5">
                <p className="font-semibold">Formal Authorization Required</p>
                <p className="text-[11.5px] text-amber-800">
                  This action recalculates all project variances back to 0 days against the new baseline. Baseline replacements are logged in the immutable audit trail.
                </p>
              </div>

              <form onSubmit={handleConfirmReplace} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Change Order Reason / Authorisation Notice
                  </label>
                  <input
                    type="text"
                    required
                    value={replaceReason}
                    onChange={(e) => setReplaceReason(e.target.value)}
                    placeholder="e.g. Authorised by Employer's Agent per Clause 8.4 Extension of Time"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Type <span className="font-mono font-bold text-rose-600">REPLACE</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    placeholder="REPLACE"
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs font-mono text-slate-800 focus:outline-hidden focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsReplaceConfirmOpen(false);
                      setConfirmText("");
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={confirmText !== "REPLACE"}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white shadow-xs transition-colors ${
                      confirmText === "REPLACE"
                        ? "bg-amber-600 hover:bg-amber-700 cursor-pointer"
                        : "bg-slate-300 cursor-not-allowed"
                    }`}
                  >
                    Authorize Re-baseline
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Restore Schedule Confirmation Dialog */}
        {isRestoreConfirmOpen && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl border border-slate-200 space-y-4 animate-in fade-in zoom-in-95">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Restore Forecast Schedule from Baseline?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This will revert all current forecast task start dates and durations back to their original Baseline 0 contract values and run full CPM topological recalculation.
                  </p>
                </div>
              </div>

              <div className="rounded-lg bg-blue-50 p-3 text-[11.5px] text-blue-900 border border-blue-200">
                Any temporary manual overrides will be cleared. This action is recorded in the change audit history.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsRestoreConfirmOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-3.5 py-1.5 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700 shadow-xs cursor-pointer"
                >
                  Yes, Restore to Baseline
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
