"use client";

import React from "react";
import { AlertTriangle, RefreshCw, UploadCloud, X, User, Calendar, Clock } from "lucide-react";
import { type ConcurrencyConflictDetails } from "@/lib/programme-persistence";

interface ConcurrencyConflictModalProps {
  isOpen: boolean;
  conflictDetails: ConcurrencyConflictDetails | null;
  onClose: () => void;
  onReload: () => void;
  onForceOverwrite: () => void;
}

export function ConcurrencyConflictModal({
  isOpen,
  conflictDetails,
  onClose,
  onReload,
  onForceOverwrite,
}: ConcurrencyConflictModalProps) {
  if (!isOpen || !conflictDetails) return null;

  const formattedDate = new Date(conflictDetails.updatedAt).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-lg rounded-xl border border-amber-300 bg-white p-6 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-600 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900">
                Concurrent Schedule Modification Detected
              </h2>
              <p className="text-xs text-slate-500">
                Optimistic Locking (HTTP 409 Conflict)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors p-1"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conflict Explanation & Metadata */}
        <div className="my-4 space-y-3.5">
          <div className="rounded-lg bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed">
            <span className="font-semibold text-amber-950">Notice:</span> Another planner has committed changes to the working programme while you were editing. PlanD-X has protected your changes and prevented an uncoordinated overwrite.
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-2 text-xs">
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <User className="h-3.5 w-3.5 text-slate-400" /> Modified By:
              </span>
              <span className="font-semibold text-slate-900">
                {conflictDetails.lastModifiedBy.name} ({conflictDetails.lastModifiedBy.email || "Planner"})
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Committed At:
              </span>
              <span className="text-slate-700">{formattedDate}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600">
              <span className="flex items-center gap-1.5 font-medium">
                <Calendar className="h-3.5 w-3.5 text-slate-400" /> Version Discrepancy:
              </span>
              <span>
                Server: <span className="font-bold text-amber-700">v{conflictDetails.currentVersion}</span> vs Local expected: <span className="font-mono text-slate-700">v{conflictDetails.expectedVersion}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={onReload}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Load Remote (v{conflictDetails.currentVersion})</span>
          </button>

          <button
            type="button"
            onClick={onForceOverwrite}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-xs font-semibold text-amber-900 shadow-2xs hover:bg-amber-50 transition-colors"
            title="Saves your working changes as the latest revision, logging a conflict override in the audit trail."
          >
            <UploadCloud className="h-3.5 w-3.5 text-amber-600" />
            <span>Save as New Revision (v{conflictDetails.currentVersion + 1})</span>
          </button>
        </div>

        <div className="mt-3 text-center">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-500 hover:text-slate-800 underline transition-colors"
          >
            Dismiss and review local changes
          </button>
        </div>
      </div>
    </div>
  );
}
