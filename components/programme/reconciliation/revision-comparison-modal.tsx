"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  X,
  GitCompare,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Clock,
  Layers,
  Calendar,
  Search,
  Filter,
  Check,
  ChevronDown,
  ChevronRight,
  User,
  FileText,
  AlertCircle,
  HelpCircle,
  ArrowUpRight,
  FolderGit2,
  Trash2,
  ExternalLink,
  Plus,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  computeProgrammeReconciliation,
  applyProgrammeReconciliation,
} from "@/lib/programme-reconciliation";
import type {
  ProgrammeTask,
  TaskReconciliationItem,
  ReconciliationAction,
  SavedProgrammeRevision,
} from "@/lib/programme-types";
import { formatDisplayDate } from "@/lib/programme-calendar";

export function RevisionComparisonModal() {
  const {
    tasks,
    isRevisionComparisonOpen,
    closeRevisionComparison,
    incomingRevisionData,
    applyRevisionImport,
    rollbackRevision,
    savedRevisions,
    projectCalendar,
    showToast,
  } = useProgramme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    | "all"
    | "uncertain"
    | "added"
    | "removed"
    | "modified"
    | "moved"
    | "logic"
    | "history"
  >("all");

  // Search filter
  const [searchQuery, setSearchQuery] = useState("");

  // Reconciled items with mutable actions
  const [items, setItems] = useState<TaskReconciliationItem[]>([]);

  // Confirmation Drawer State
  const [isCommitModalOpen, setIsCommitModalOpen] = useState(false);
  const [revisionName, setRevisionName] = useState("");
  const [appliedBy, setAppliedBy] = useState("Lead Planning Engineer");
  const [revisionReason, setRevisionReason] = useState("");

  // Rollback Modal State
  const [rollbackTarget, setRollbackTarget] = useState<SavedProgrammeRevision | null>(null);
  const [rolledBackBy, setRolledBackBy] = useState("Lead Planning Engineer");
  const [rollbackReason, setRollbackReason] = useState("");

  // Expanded items for detailed inspection
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());

  // Compute reconciliation summary whenever incomingRevisionData or tasks change
  const initialSummary = useMemo(() => {
    if (!incomingRevisionData || !incomingRevisionData.tasks || incomingRevisionData.tasks.length === 0) {
      return null;
    }
    return computeProgrammeReconciliation(tasks, incomingRevisionData.tasks);
  }, [incomingRevisionData, tasks]);

  // Synchronize items state with initial reconciliation
  useEffect(() => {
    if (initialSummary && initialSummary.items) {
      setItems(initialSummary.items.map((i) => ({ ...i })));
      // Auto-populate revision name
      const incomingName =
        incomingRevisionData?.projectName ||
        incomingRevisionData?.fileName?.replace(/\.[^/.]+$/, "") ||
        "Programme Revision";
      setRevisionName(`${incomingName} - Reconciled`);
      setRevisionReason("Imported revised schedule. Baseline 0 protected.");
    } else {
      setItems([]);
    }
  }, [initialSummary, incomingRevisionData]);

  if (!isRevisionComparisonOpen) return null;

  // Toggle item expansion
  const toggleExpand = (itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  // Toggle single item action
  const setItemAction = (itemId: string, action: ReconciliationAction) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId || item.taskId === itemId) {
          return { ...item, action };
        }
        return item;
      })
    );
  };

  // Bulk action helpers
  const handleBulkSetAction = (action: ReconciliationAction, filterType?: "confident" | "all") => {
    setItems((prev) =>
      prev.map((item) => {
        if (filterType === "confident" && item.isUncertain) {
          return item; // do not bulk modify uncertain items
        }
        return { ...item, action };
      })
    );
  };

  // Resolve uncertain match as separate activity
  const handleTreatAsSeparate = (itemId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId || item.taskId === itemId) {
          return {
            ...item,
            changeType: "added",
            isUncertain: false,
            action: "accept",
            task: {
              ...item.task,
              id: `task-sep-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            },
          };
        }
        return item;
      })
    );
    showToast("Configured incoming task as a distinct new activity.");
  };

  // Filter items based on active tab and search
  const filteredItems = items.filter((item) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.taskName.toLowerCase().includes(q);
      const matchWbs = (item.wbs || "").toLowerCase().includes(q);
      const matchIncomingWbs = (item.incomingWbs || "").toLowerCase().includes(q);
      if (!matchName && !matchWbs && !matchIncomingWbs) return false;
    }

    if (activeTab === "all") return true;
    if (activeTab === "uncertain") return item.isUncertain;
    if (activeTab === "added") return item.changeType === "added";
    if (activeTab === "removed") return item.changeType === "removed";
    if (activeTab === "modified") return item.changeType === "modified";
    if (activeTab === "moved") return item.isMoved || item.isRenamed || item.changeType === "renamed" || item.changeType === "moved";
    if (activeTab === "logic") {
      return item.changes.some((c) => c.category === "logic");
    }
    return true;
  });

  // Action count statistics
  const acceptedCount = items.filter((i) => i.action === "accept").length;
  const keptCount = items.filter((i) => i.action === "keep" || i.action === "skip").length;
  const uncertainCount = items.filter((i) => i.isUncertain).length;
  const addedCount = items.filter((i) => i.changeType === "added").length;
  const removedCount = items.filter((i) => i.changeType === "removed").length;
  const modifiedCount = items.filter((i) => i.changeType === "modified").length;
  const movedCount = items.filter((i) => i.isMoved || itemHasMoved(i)).length;

  function itemHasMoved(i: TaskReconciliationItem) {
    return i.isMoved || i.changes.some((c) => c.category === "wbs" && c.field !== "name");
  }

  // Handle Commit Submit
  const handleCommitRevision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionName.trim() || !appliedBy.trim()) return;

    applyRevisionImport({
      revisionName: revisionName.trim(),
      appliedBy: appliedBy.trim(),
      reason: revisionReason.trim() || "Applied reconciled programme revision.",
      items,
      incomingCalendar: incomingRevisionData?.calendar,
      sourceFileName: incomingRevisionData?.fileName,
      sourceFingerprint: incomingRevisionData?.fileHash,
    });
    setIsCommitModalOpen(false);
  };

  // Handle Rollback Submit
  const handleConfirmRollback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rollbackTarget) return;

    const res = rollbackRevision(rollbackTarget.revisionId, rolledBackBy, rollbackReason);
    if (res.success) {
      setRollbackTarget(null);
    }
  };

  return (
    <div
      id="revision-comparison-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 sm:p-6 select-none"
    >
      <div
        id="revision-comparison-container"
        className="relative w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <GitCompare className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                  Programme Revision Comparison &amp; Reconciliation
                </h2>
                <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700 border border-indigo-200/60">
                  Dual-Schedule Diff Engine
                </span>
                {uncertainCount > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-300 animate-pulse">
                    <AlertTriangle className="h-3 w-3" />
                    {uncertainCount} Uncertain {uncertainCount === 1 ? "Match" : "Matches"}
                  </span>
                )}
              </div>
              <p className="text-[12.5px] text-slate-500">
                {incomingRevisionData?.fileName ? (
                  <>
                    Comparing working schedule against{" "}
                    <span className="font-semibold text-slate-700">
                      {incomingRevisionData.fileName}
                    </span>{" "}
                    ({initialSummary?.incomingTaskCount || 0} revised tasks).
                  </>
                ) : (
                  "Compare working schedule against imported revisions, inspect field changes, and commit safely."
                )}
              </p>
            </div>
          </div>
          <button
            id="revision-comparison-close-btn"
            onClick={closeRevisionComparison}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Top Executive Summary KPI Bar */}
        {initialSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2 px-6 py-3 border-b border-slate-200 bg-slate-50/40 text-left shrink-0">
            <div className="rounded-lg border border-slate-200 bg-white p-2">
              <div className="text-[10px] font-semibold text-slate-500 uppercase">Total Tasks</div>
              <div className="text-[15px] font-bold text-slate-900">
                {tasks.length} &rarr; {incomingRevisionData?.tasks?.length || 0}
              </div>
            </div>

            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2">
              <div className="text-[10px] font-semibold text-emerald-700 uppercase">Additions</div>
              <div className="text-[15px] font-bold text-emerald-950">+{addedCount}</div>
            </div>

            <div className="rounded-lg border border-red-200 bg-red-50/50 p-2">
              <div className="text-[10px] font-semibold text-red-700 uppercase">Removals</div>
              <div className="text-[15px] font-bold text-red-950">-{removedCount}</div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-2">
              <div className="text-[10px] font-semibold text-amber-700 uppercase">Modifications</div>
              <div className="text-[15px] font-bold text-amber-950">{modifiedCount}</div>
            </div>

            <div className="rounded-lg border border-purple-200 bg-purple-50/50 p-2">
              <div className="text-[10px] font-semibold text-purple-700 uppercase">Renamed</div>
              <div className="text-[15px] font-bold text-purple-950">{initialSummary.renamedCount || 0}</div>
            </div>

            <div className="rounded-lg border border-indigo-200 bg-indigo-50/50 p-2">
              <div className="text-[10px] font-semibold text-indigo-700 uppercase">Moved in WBS</div>
              <div className="text-[15px] font-bold text-indigo-950">{movedCount}</div>
            </div>

            <div
              className={`rounded-lg border p-2 ${
                uncertainCount > 0
                  ? "border-amber-300 bg-amber-50/80 text-amber-900"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              <div className="text-[10px] font-semibold uppercase">Uncertain</div>
              <div className="text-[15px] font-bold">
                {uncertainCount > 0 ? `⚠️ ${uncertainCount}` : "0"}
              </div>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-2">
              <div className="text-[10px] font-semibold text-blue-700 uppercase">Project Finish</div>
              <div className="text-[12.5px] font-bold text-blue-950 truncate">
                {initialSummary.dateShiftSummary.projectFinishSlipDays !== undefined &&
                initialSummary.dateShiftSummary.projectFinishSlipDays !== 0
                  ? initialSummary.dateShiftSummary.projectFinishSlipDays > 0
                    ? `+${initialSummary.dateShiftSummary.projectFinishSlipDays}d slip`
                    : `${initialSummary.dateShiftSummary.projectFinishSlipDays}d early`
                  : "On schedule"}
              </div>
            </div>
          </div>
        )}

        {/* Milestone Impact Alert Banner */}
        {initialSummary?.milestoneImpacts && initialSummary.milestoneImpacts.length > 0 && (
          <div className="flex items-center gap-2 bg-amber-50/90 border-b border-amber-200 px-6 py-2 text-[12px] text-amber-900 shrink-0 overflow-x-auto">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span className="font-semibold shrink-0">Milestone Date Shifts Detected:</span>
            <div className="flex items-center gap-2 truncate">
              {initialSummary.milestoneImpacts.map((m, idx) => (
                <span
                  key={idx}
                  className="rounded bg-white/80 border border-amber-300 px-2 py-0.5 font-medium text-[11px] shrink-0"
                >
                  {m.name}:{" "}
                  <span className="font-mono text-amber-800">
                    {m.workingDate} &rarr; {m.incomingDate} ({m.slipDays > 0 ? `+${m.slipDays}d` : `${m.slipDays}d`})
                  </span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Filter Navigation & Bulk Actions Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-6 py-2.5 bg-white shrink-0">
          {/* Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto text-[12.5px]">
            <button
              id="tab-recon-all"
              onClick={() => setActiveTab("all")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "all"
                  ? "bg-slate-900 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              All Items ({items.length})
            </button>

            {uncertainCount > 0 && (
              <button
                id="tab-recon-uncertain"
                onClick={() => setActiveTab("uncertain")}
                className={`rounded-lg px-2.5 py-1 font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                  activeTab === "uncertain"
                    ? "bg-amber-600 text-white"
                    : "text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200"
                }`}
              >
                <AlertTriangle className="h-3 w-3" />
                <span>Review Uncertain ({uncertainCount})</span>
              </button>
            )}

            <button
              id="tab-recon-added"
              onClick={() => setActiveTab("added")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "added"
                  ? "bg-emerald-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Added (+{addedCount})
            </button>

            <button
              id="tab-recon-removed"
              onClick={() => setActiveTab("removed")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "removed"
                  ? "bg-red-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Removed (-{removedCount})
            </button>

            <button
              id="tab-recon-modified"
              onClick={() => setActiveTab("modified")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "modified"
                  ? "bg-amber-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Modified ({modifiedCount})
            </button>

            <button
              id="tab-recon-moved"
              onClick={() => setActiveTab("moved")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "moved"
                  ? "bg-indigo-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Moved / Renamed ({movedCount})
            </button>

            <button
              id="tab-recon-logic"
              onClick={() => setActiveTab("logic")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors shrink-0 ${
                activeTab === "logic"
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Logic &amp; Predecessors
            </button>

            <button
              id="tab-recon-history"
              onClick={() => setActiveTab("history")}
              className={`rounded-lg px-2.5 py-1 font-semibold transition-colors flex items-center gap-1 shrink-0 ${
                activeTab === "history"
                  ? "bg-slate-800 text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              <RotateCcw className="h-3 w-3" />
              <span>Past Revisions ({savedRevisions.length})</span>
            </button>
          </div>

          {/* Search & Bulk Action Buttons */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <input
                id="recon-search-input"
                type="text"
                placeholder="Search task or WBS..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-44 sm:w-52 rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-1 text-[12px] text-slate-800 placeholder-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {activeTab !== "history" && (
              <div className="flex items-center gap-1.5">
                <button
                  id="recon-bulk-accept-confident-btn"
                  onClick={() => handleBulkSetAction("accept", "confident")}
                  title="Accept all confident changes, leaving uncertain items for manual decision"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Accept Confident
                </button>
                <button
                  id="recon-bulk-keep-all-btn"
                  onClick={() => handleBulkSetAction("keep", "all")}
                  title="Keep all current working schedule properties"
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11.5px] font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Keep All
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === "history" ? (
            /* History & Rollback View */
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-[15px] font-bold text-slate-900">
                      Archived Programme Revisions &amp; Non-Destructive Rollback
                    </h3>
                    <p className="text-[12.5px] text-slate-500 mt-0.5">
                      Every committed programme import is saved as an immutable revision snapshot.
                      Rolling back restores the previous working state without rewriting Contract Baseline 0
                      or clearing audit history.
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] font-bold text-slate-700">
                    {savedRevisions.length} {savedRevisions.length === 1 ? "Revision" : "Revisions"}
                  </span>
                </div>

                {savedRevisions.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <div className="font-semibold text-[14px]">No Programme Revisions Committed Yet</div>
                    <div className="text-[12px]">
                      When you reconcile and commit schedule imports, they will be archived here.
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                    {savedRevisions.map((rev) => (
                      <div
                        key={rev.revisionId}
                        className={`p-4 transition-colors ${
                          rev.isRolledBack ? "bg-slate-50/70 opacity-75" : "bg-white hover:bg-slate-50/50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[12px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/50">
                                {rev.revisionCode}
                              </span>
                              <h4 className="text-[14px] font-bold text-slate-900">{rev.name}</h4>
                              {rev.isRolledBack ? (
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                  Rolled Back
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                  Active History
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-slate-600">{rev.reason}</p>
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-500 pt-1">
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {rev.appliedBy}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDisplayDate(rev.appliedAt)}
                              </span>
                              <span>•</span>
                              <span>Tasks: {rev.summary.totalTasks}</span>
                              <span>•</span>
                              <span className="text-emerald-700 font-semibold">
                                +{rev.summary.addedCount} new
                              </span>
                              <span className="text-amber-700 font-semibold">
                                {rev.summary.modifiedCount} modified
                              </span>
                            </div>

                            {rev.isRolledBack && rev.rollbackReason && (
                              <div className="mt-2 rounded-lg bg-amber-50/80 border border-amber-200 p-2 text-[11px] text-amber-800">
                                <strong>Rollback Note:</strong> {rev.rollbackReason} (by {rev.rolledBackBy || "Planner"} on {formatDisplayDate(rev.rolledBackAt || "")})
                              </div>
                            )}
                          </div>

                          {!rev.isRolledBack && (
                            <button
                              id={`rollback-btn-${rev.revisionId}`}
                              onClick={() => {
                                setRollbackTarget(rev);
                                setRollbackReason(`Rollback ${rev.revisionCode} due to revision changes.`);
                              }}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-700 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors flex items-center gap-1.5 shrink-0"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              <span>Rollback</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Differences & Reconciliation Grid */
            <div className="space-y-4">
              {/* Uncertainty Guidance Banner */}
              {activeTab === "uncertain" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-[13px]">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <span>Uncertain Task Match Policy (Zero Guesswork)</span>
                  </div>
                  <p className="text-[12px] text-amber-800 leading-relaxed">
                    PlanD-X enforces strict identity preservation. Tasks matched solely on similar names
                    across differing WBS positions are marked uncertain. Never assume two similarly named
                    tasks are the same activity. Inspect the candidates below and choose whether to confirm
                    as the same activity or treat as a new distinct scope item.
                  </p>
                </div>
              )}

              {filteredItems.length === 0 ? (
                <div className="text-center py-16 text-slate-400 bg-white rounded-xl border border-slate-200">
                  <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-emerald-500 opacity-80" />
                  <div className="font-semibold text-[14px] text-slate-700">No Items In This View</div>
                  <div className="text-[12px]">All matching criteria satisfied or filtered out.</div>
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl bg-white overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-[12px] border-collapse">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3 w-10"></th>
                          <th className="py-2.5 px-3 w-28">WBS / Code</th>
                          <th className="py-2.5 px-3">Task Identity</th>
                          <th className="py-2.5 px-3 w-32">Status / Match</th>
                          <th className="py-2.5 px-3">Field Differences &amp; Scheduling Variances</th>
                          <th className="py-2.5 px-3 w-48 text-right">Reconciliation Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredItems.map((item) => {
                          const isExpanded = expandedItemIds.has(item.id || item.taskId);
                          return (
                            <React.Fragment key={item.id || item.taskId}>
                              <tr
                                id={`recon-row-${item.taskId}`}
                                className={`hover:bg-slate-50/70 transition-colors ${
                                  item.isUncertain
                                    ? "bg-amber-50/40"
                                    : item.changeType === "added"
                                    ? "bg-emerald-50/20"
                                    : item.changeType === "removed"
                                    ? "bg-red-50/20"
                                    : ""
                                }`}
                              >
                                {/* Expand Details Button */}
                                <td className="py-2.5 px-3 text-center">
                                  {item.changes.length > 0 && (
                                    <button
                                      onClick={() => toggleExpand(item.id || item.taskId)}
                                      className="rounded p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-3.5 w-3.5" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  )}
                                </td>

                                {/* WBS Code */}
                                <td className="py-2.5 px-3 font-mono text-[11.5px] font-semibold text-slate-700">
                                  {item.workingWbs && item.incomingWbs && item.workingWbs !== item.incomingWbs ? (
                                    <div className="space-y-0.5">
                                      <div className="line-through text-slate-400">{item.workingWbs}</div>
                                      <div className="text-indigo-600 font-bold">{item.incomingWbs}</div>
                                    </div>
                                  ) : (
                                    item.wbs || item.incomingWbs || "—"
                                  )}
                                </td>

                                {/* Task Identity & Name */}
                                <td className="py-2.5 px-3">
                                  <div
                                    style={{
                                      paddingLeft: `${Math.max(0, (item.depth || 0) * 10)}px`,
                                    }}
                                  >
                                    {item.isRenamed && item.workingTaskName ? (
                                      <div className="space-y-0.5">
                                        <span className="line-through text-slate-400 block text-[11px]">
                                          {item.workingTaskName}
                                        </span>
                                        <span className="font-bold text-slate-900 block">
                                          {item.taskName}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="font-semibold text-slate-900">{item.taskName}</span>
                                    )}

                                    {item.sourceUid !== undefined && (
                                      <span className="text-[10px] font-mono text-slate-400 ml-1">
                                        [UID: {item.sourceUid}]
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Change Type & Match Confidence Badge */}
                                <td className="py-2.5 px-3 space-y-1">
                                  <div>
                                    {item.changeType === "added" && (
                                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                        Added
                                      </span>
                                    )}
                                    {item.changeType === "removed" && (
                                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">
                                        Removed
                                      </span>
                                    )}
                                    {item.changeType === "modified" && (
                                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                                        Modified
                                      </span>
                                    )}
                                    {item.changeType === "renamed" && (
                                      <span className="rounded-full bg-purple-100 px-2 py-0.5 text-[10px] font-bold uppercase text-purple-800">
                                        Renamed
                                      </span>
                                    )}
                                    {item.changeType === "moved" && (
                                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase text-indigo-800">
                                        Moved WBS
                                      </span>
                                    )}
                                    {item.changeType === "unchanged" && (
                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                        Unchanged
                                      </span>
                                    )}
                                  </div>

                                  {/* Confidence Badge */}
                                  <div>
                                    {item.isUncertain ? (
                                      <span
                                        title={item.uncertainReason}
                                        className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 px-1.5 py-0.2 text-[9.5px] font-bold cursor-help"
                                      >
                                        <AlertTriangle className="h-2.5 w-2.5" />
                                        Manual Review
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-slate-400 font-mono">
                                        {item.matchConfidence === "exact-uid"
                                          ? "UID Verified"
                                          : item.matchConfidence === "exact-id"
                                          ? "ID Verified"
                                          : item.matchConfidence === "exact-wbs-name"
                                          ? "WBS+Name Match"
                                          : "New Scope"}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Field Differences Summary */}
                                <td className="py-2.5 px-3">
                                  {item.changes.length === 0 ? (
                                    <span className="text-slate-400 italic">No schedule discrepancies</span>
                                  ) : (
                                    <div className="space-y-1">
                                      {item.changes.slice(0, 2).map((c, ci) => (
                                        <div key={ci} className="text-[11px] leading-tight">
                                          <span className="font-semibold text-slate-600">
                                            {c.fieldLabel}:
                                          </span>{" "}
                                          <span className="line-through text-red-600 font-mono">
                                            {String(c.from ?? "none")}
                                          </span>{" "}
                                          <ArrowRight className="inline h-2.5 w-2.5 text-slate-400" />{" "}
                                          <span className="text-emerald-700 font-semibold font-mono">
                                            {String(c.to)}
                                          </span>
                                        </div>
                                      ))}
                                      {item.changes.length > 2 && (
                                        <button
                                          onClick={() => toggleExpand(item.id || item.taskId)}
                                          className="text-[10.5px] text-indigo-600 hover:underline font-semibold"
                                        >
                                          +{item.changes.length - 2} more differences...
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </td>

                                {/* Reconciliation Action Toggle */}
                                <td className="py-2.5 px-3 text-right">
                                  <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs">
                                    <button
                                      id={`action-accept-${item.taskId}`}
                                      onClick={() => setItemAction(item.id || item.taskId, "accept")}
                                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        item.action === "accept"
                                          ? "bg-emerald-600 text-white shadow-2xs"
                                          : "text-slate-600 hover:bg-slate-100"
                                      }`}
                                    >
                                      <Check className="h-3 w-3" />
                                      <span>Accept</span>
                                    </button>
                                    <button
                                      id={`action-keep-${item.taskId}`}
                                      onClick={() => setItemAction(item.id || item.taskId, "keep")}
                                      className={`rounded-md px-2.5 py-1 text-[11px] font-semibold transition-all flex items-center gap-1 ${
                                        item.action === "keep" || item.action === "skip"
                                          ? "bg-slate-800 text-white shadow-2xs"
                                          : "text-slate-600 hover:bg-slate-100"
                                      }`}
                                    >
                                      <ShieldCheck className="h-3 w-3" />
                                      <span>Keep Current</span>
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Expanded Row for Full Detail Inspection */}
                              {isExpanded && (
                                <tr className="bg-slate-100/60 border-y border-slate-200/80">
                                  <td colSpan={6} className="p-4 space-y-3">
                                    {item.isUncertain && item.uncertainReason && (
                                      <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-[12px] text-amber-900 space-y-2">
                                        <div className="font-bold flex items-center gap-1.5">
                                          <AlertTriangle className="h-4 w-4 text-amber-600" />
                                          <span>Uncertain Match Notice</span>
                                        </div>
                                        <p>{item.uncertainReason}</p>
                                        <div className="flex items-center gap-2 pt-1">
                                          <button
                                            id={`btn-confirm-same-${item.taskId}`}
                                            onClick={() => {
                                              setItems((prev) =>
                                                prev.map((i) =>
                                                  i.id === item.id ? { ...i, isUncertain: false, action: "accept" } : i
                                                )
                                              );
                                              showToast("Confirmed match as the same activity.");
                                            }}
                                            className="rounded bg-amber-700 text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-800"
                                          >
                                            Confirm As Same Activity
                                          </button>
                                          <button
                                            id={`btn-treat-separate-${item.taskId}`}
                                            onClick={() => handleTreatAsSeparate(item.id || item.taskId)}
                                            className="rounded bg-white border border-amber-300 text-amber-900 px-2.5 py-1 text-[11px] font-semibold hover:bg-amber-50"
                                          >
                                            Treat As Separate New Task
                                          </button>
                                        </div>
                                      </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11.5px]">
                                      <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-1.5">
                                        <div className="font-bold text-slate-800 uppercase text-[10px]">
                                          Working Programme (Current)
                                        </div>
                                        <div>
                                          <strong>Task Name:</strong> {item.workingTaskName || item.taskName}
                                        </div>
                                        <div>
                                          <strong>WBS:</strong> {item.workingWbs || item.wbs || "None"}
                                        </div>
                                        <div>
                                          <strong>Dates:</strong> {item.workingTask?.startDate || "—"} to{" "}
                                          {item.workingTask?.endDate || "—"} ({item.workingTask?.duration || 0}d)
                                        </div>
                                        <div>
                                          <strong>Baseline 0:</strong>{" "}
                                          {item.workingTask?.baseline0Start
                                            ? `${item.workingTask.baseline0Start} to ${item.workingTask.baseline0Finish} (${item.workingTask.baseline0Duration}d)`
                                            : "No Baseline 0 set"}
                                        </div>
                                        <div>
                                          <strong>Predecessors:</strong>{" "}
                                          {item.workingTask?.predecessors?.length
                                            ? item.workingTask.predecessors.join(", ")
                                            : "None"}
                                        </div>
                                      </div>

                                      <div className="rounded-lg bg-white p-3 border border-slate-200 space-y-1.5">
                                        <div className="font-bold text-indigo-700 uppercase text-[10px]">
                                          Incoming Revised Schedule
                                        </div>
                                        <div>
                                          <strong>Task Name:</strong> {item.incomingTaskName || item.taskName}
                                        </div>
                                        <div>
                                          <strong>WBS:</strong> {item.incomingWbs || item.wbs || "None"}
                                        </div>
                                        <div>
                                          <strong>Dates:</strong> {item.task.startDate} to {item.task.endDate} (
                                          {item.task.duration}d)
                                        </div>
                                        <div>
                                          <strong>Progress:</strong> {item.task.progress}% complete
                                        </div>
                                        <div>
                                          <strong>Predecessors:</strong>{" "}
                                          {item.task.predecessors?.length ? item.task.predecessors.join(", ") : "None"}
                                        </div>
                                      </div>
                                    </div>

                                    {/* All Changes Table */}
                                    <div className="rounded-lg bg-white p-3 border border-slate-200">
                                      <div className="font-bold text-slate-700 text-[11px] mb-2">
                                        All Detected Field Differences ({item.changes.length})
                                      </div>
                                      <div className="space-y-1">
                                        {item.changes.map((c, ci) => (
                                          <div
                                            key={ci}
                                            className="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-b-0"
                                          >
                                            <span className="font-medium text-slate-700">{c.fieldLabel}</span>
                                            <div className="flex items-center gap-2 font-mono">
                                              <span className="line-through text-red-600">
                                                {String(c.from ?? "none")}
                                              </span>
                                              <ArrowRight className="h-3 w-3 text-slate-400" />
                                              <span className="text-emerald-700 font-semibold">
                                                {String(c.to)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 bg-slate-50/90 shrink-0">
          <div className="text-[12px] text-slate-600">
            {activeTab !== "history" && (
              <span className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">
                  {acceptedCount} of {items.length} items accepted
                </span>
                <span>•</span>
                <span className="text-slate-500">{keptCount} kept current</span>
                {uncertainCount > 0 && (
                  <>
                    <span>•</span>
                    <span className="text-amber-700 font-semibold">
                      ⚠️ {uncertainCount} pending manual review
                    </span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="recon-cancel-btn"
              onClick={closeRevisionComparison}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel &amp; Close
            </button>

            {activeTab !== "history" && items.length > 0 && (
              <button
                id="recon-commit-btn"
                onClick={() => setIsCommitModalOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs"
              >
                <span>Confirm &amp; Apply Programme Revision</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation & Audit Commitment Dialog */}
      {isCommitModalOpen && (
        <div
          id="commit-revision-dialog-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
        >
          <div
            id="commit-revision-dialog-container"
            className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">
                  Commit Programme Revision
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Record revision governance details. Your current schedule will be safely archived for rollback.
                </p>
              </div>
              <button
                id="commit-dialog-close-btn"
                onClick={() => setIsCommitModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCommitRevision} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Revision / Version Name *
                </label>
                <input
                  id="commit-revision-name-input"
                  type="text"
                  required
                  value={revisionName}
                  onChange={(e) => setRevisionName(e.target.value)}
                  placeholder="e.g. Revision C - Subcontractor EOT & Groundworks Slip"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Applied By (Planner / Authority) *
                </label>
                <input
                  id="commit-applied-by-input"
                  type="text"
                  required
                  value={appliedBy}
                  onChange={(e) => setAppliedBy(e.target.value)}
                  placeholder="e.g. Lead Planning Engineer / Site Manager"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Revision Reason &amp; Commercial Justification *
                </label>
                <textarea
                  id="commit-revision-reason-input"
                  required
                  rows={3}
                  value={revisionReason}
                  onChange={(e) => setRevisionReason(e.target.value)}
                  placeholder="State the contractual or site reasons for this programme revision..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* Baseline 0 Protection Alert */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11.5px] text-blue-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <ShieldCheck className="h-4 w-4 text-blue-600" />
                  <span>Contract Baseline 0 Protection</span>
                </div>
                <p>
                  Baseline 0 (Contract Baseline) remains strictly immutable and will not be rewritten.
                  A complete snapshot of the current working programme is preserved for rollback.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="commit-dialog-cancel-btn"
                  onClick={() => setIsCommitModalOpen(false)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="commit-dialog-submit-btn"
                  className="rounded-lg bg-indigo-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-indigo-700 shadow-2xs"
                >
                  Commit &amp; Apply
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rollback Confirmation Dialog */}
      {rollbackTarget && (
        <div
          id="rollback-dialog-backdrop"
          className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 p-4"
        >
          <div
            id="rollback-dialog-container"
            className="w-full max-w-md rounded-2xl bg-white border border-slate-200 p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[16px] font-bold text-slate-900">
                  Rollback to Previous Programme Version
                </h3>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  Restores working schedule state before{" "}
                  <span className="font-semibold text-slate-700">
                    {rollbackTarget.revisionCode} ({rollbackTarget.name})
                  </span>
                  .
                </p>
              </div>
              <button
                id="rollback-dialog-close-btn"
                onClick={() => setRollbackTarget(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmRollback} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Rolled Back By *
                </label>
                <input
                  id="rollback-user-input"
                  type="text"
                  required
                  value={rolledBackBy}
                  onChange={(e) => setRolledBackBy(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[12px] font-semibold text-slate-700 mb-1">
                  Rollback Reason *
                </label>
                <textarea
                  id="rollback-reason-input"
                  required
                  rows={2}
                  value={rollbackReason}
                  onChange={(e) => setRollbackReason(e.target.value)}
                  placeholder="State the reason for reverting this programme revision..."
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-[11.5px] text-amber-900 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <RotateCcw className="h-4 w-4 text-amber-600" />
                  <span>Non-Destructive Rollback Guarantee</span>
                </div>
                <p>
                  Contract Baseline 0 will remain completely intact. Historical audit logs will NOT be deleted;
                  a rollback governance entry will be recorded in the permanent audit trail.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  id="rollback-dialog-cancel-btn"
                  onClick={() => setRollbackTarget(null)}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-[12.5px] font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  id="rollback-dialog-confirm-btn"
                  className="rounded-lg bg-red-600 px-4 py-1.5 text-[12.5px] font-semibold text-white hover:bg-red-700 shadow-2xs"
                >
                  Confirm Rollback
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
