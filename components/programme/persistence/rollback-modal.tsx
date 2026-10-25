"use client";

import React, { useEffect, useState } from "react";
import { History, RotateCcw, X, Check, AlertTriangle, User, Calendar, FileText, Loader2 } from "lucide-react";

interface RevisionSummary {
  id: string;
  revisionNumber: number;
  name: string;
  sourceFileName?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    email: string;
  };
  changeSummary?: {
    addedTasks: number;
    removedTasks: number;
    modifiedTasks: number;
    notes?: string;
  };
  tasksCount: number;
}

interface RollbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentVersion: number;
  onRollbackSuccess: (restoredVersion: number) => void;
}

export function RollbackModal({
  isOpen,
  onClose,
  currentVersion,
  onRollbackSuccess,
}: RollbackModalProps) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedRevision, setSelectedRevision] = useState<number | null>(null);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmPrompt, setConfirmPrompt] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    setIsLoading(true);
    setErrorMsg(null);
    setConfirmPrompt(false);

    fetch("/api/programme/rollback")
      .then((res) => res.json())
      .then((data) => {
        if (data?.success && Array.isArray(data.revisions)) {
          // Sort reverse chronologically
          setRevisions(data.revisions.sort((a: any, b: any) => b.revisionNumber - a.revisionNumber));
        } else {
          setErrorMsg(data?.message || "Failed to load revisions.");
        }
      })
      .catch((err) => {
        setErrorMsg("Network error connecting to revision history.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleExecuteRollback = async () => {
    if (!selectedRevision) return;

    setIsRollingBack(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/programme/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          targetRevisionNumber: selectedRevision,
        }),
      });

      const data = await response.json();
      if (response.ok && data?.success) {
        onRollbackSuccess(data.version);
        onClose();
      } else {
        setErrorMsg(data?.message || "Rollback failed.");
      }
    } catch {
      setErrorMsg("Network error attempting rollback.");
    } finally {
      setIsRollingBack(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex h-[600px] w-full max-w-2xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Programme Revisions & Controlled Rollback
              </h2>
              <p className="text-xs text-slate-500">
                Working Schedule Current Version: <span className="font-bold text-blue-600">v{currentVersion}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {errorMsg && (
            <div className="mb-4 flex items-center gap-2 rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-2 text-xs text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
              <span>Loading revision history...</span>
            </div>
          ) : revisions.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-center">
              <FileText className="h-8 w-8 text-slate-300" />
              <p className="text-xs text-slate-500">No previous revisions recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {revisions.map((rev) => {
                const isSelected = selectedRevision === rev.revisionNumber;
                const isCurrent = rev.revisionNumber === currentVersion;
                const dateStr = new Date(rev.createdAt).toLocaleString([], {
                  dateStyle: "medium",
                  timeStyle: "short",
                });

                return (
                  <div
                    key={rev.id}
                    onClick={() => !isCurrent && setSelectedRevision(rev.revisionNumber)}
                    className={`group relative rounded-lg border p-4 transition-all ${
                      isCurrent
                        ? "border-emerald-200 bg-emerald-50/40"
                        : isSelected
                        ? "border-blue-500 bg-blue-50/50 shadow-xs cursor-pointer"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 cursor-pointer"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-bold font-mono ${
                              isCurrent
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            v{rev.revisionNumber}
                          </span>
                          <span className="text-xs font-semibold text-slate-900">
                            {rev.name}
                          </span>
                          {isCurrent && (
                            <span className="rounded-full bg-emerald-600 px-2 py-0.2 text-[10px] font-semibold text-white">
                              Active Working Version
                            </span>
                          )}
                        </div>

                        {rev.changeSummary?.notes && (
                          <p className="text-xs text-slate-600 italic">
                            "{rev.changeSummary.notes}"
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 text-slate-400" />
                            {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 text-slate-400" />
                            {rev.author?.name || "Planner"}
                          </span>
                          <span>{rev.tasksCount} activities</span>
                        </div>
                      </div>

                      {!isCurrent && (
                        <div className="flex items-center">
                          <input
                            type="radio"
                            name="revisionSelection"
                            checked={isSelected}
                            onChange={() => setSelectedRevision(rev.revisionNumber)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3.5 rounded-b-xl">
          <div className="text-xs text-slate-500">
            {selectedRevision ? (
              <span>
                Selected: <strong className="text-slate-800">v{selectedRevision}</strong> for restoration
              </span>
            ) : (
              <span>Select an earlier revision above to roll back</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>

            {confirmPrompt ? (
              <button
                type="button"
                disabled={isRollingBack}
                onClick={handleExecuteRollback}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
              >
                {isRollingBack ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5" />
                )}
                <span>Confirm Restore v{selectedRevision}</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={!selectedRevision || selectedRevision === currentVersion || isRollingBack}
                onClick={() => setConfirmPrompt(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Rollback to Selected</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
