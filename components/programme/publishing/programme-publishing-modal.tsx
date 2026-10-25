"use client";

import React, { useState } from "react";
import {
  X,
  Send,
  FileCheck,
  CheckCircle2,
  Calendar,
  Lock,
  Download,
  Building,
  User,
  Clock,
  Layers,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

export function ProgrammePublishingModal() {
  const {
    isPublishModalOpen,
    closePublishModal,
    currentProject,
    programmeVersion,
    tasks,
    recordScheduleChange,
    showToast,
    userPermissions,
  } = useProgramme();

  const [revisionCode, setRevisionCode] = useState<string>("Rev B");
  const [issuePurpose, setIssuePurpose] = useState<
    "client-acceptance" | "for-construction" | "for-information" | "for-tender"
  >("client-acceptance");
  const [transmittalNotes, setTransmittalNotes] = useState<string>(
    "Contractual monthly programme update reflecting progress to status date and updated procurement lead times."
  );
  const [recipients, setRecipients] = useState<string>(
    "Employer's Agent (Arup), Structural Consultant, Main Contractor Board"
  );
  const [isFreezeBaselineChecked, setIsFreezeBaselineChecked] = useState<boolean>(true);
  const [isPublishedSuccess, setIsPublishedSuccess] = useState<boolean>(false);

  // Historical published transmittals
  const [history, setHistory] = useState([
    {
      id: "pub-01",
      revision: "Rev A",
      purpose: "Contract Baseline 0 Agreement",
      date: "2025-09-01",
      author: "Lead Planning Engineer",
      status: "Approved by Employer",
      taskCount: 78,
    },
    {
      id: "pub-02",
      revision: "Rev 01",
      purpose: "Procurement Tender Issue",
      date: "2025-08-15",
      author: "Senior Commercial Manager",
      status: "Archived",
      taskCount: 72,
    },
  ]);

  if (!isPublishModalOpen) return null;

  const handlePublish = () => {
    const newRecord = {
      id: "pub-" + Date.now(),
      revision: revisionCode,
      purpose:
        issuePurpose === "client-acceptance"
          ? "For Client Acceptance / Contractual Baseline"
          : issuePurpose === "for-construction"
          ? "Approved For Construction (AFC)"
          : issuePurpose === "for-tender"
          ? "For Trade Tender Issue"
          : "For Information",
      date: new Date().toISOString().split("T")[0],
      author: userPermissions.label,
      status: "Issued for Review",
      taskCount: tasks.length,
    };

    setHistory([newRecord, ...history]);
    recordScheduleChange({
      taskId: "programme-root",
      taskName: "Programme Schedule",
      field: "programmePublish",
      fieldLabel: "Programme Release & Transmittal",
      previousValue: "Unpublished Working Forecast",
      newValue: `${revisionCode} (${newRecord.purpose})`,
      changedBy: userPermissions.label,
      changeSource: "programme-publish",
      reason: transmittalNotes,
    });

    setIsPublishedSuccess(true);
    showToast(`Programme successfully published as ${revisionCode}! Transmittal logged.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-[16px] text-white">Controlled Programme Publishing</h3>
              <p className="text-[11.5px] text-slate-400">
                Formal issue transmittal generation, contractual baseline freezing & transmittal distribution
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setIsPublishedSuccess(false);
              closePublishModal();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {isPublishedSuccess ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-5 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-[16px] font-bold text-emerald-950">Programme Published Successfully</h4>
                <p className="text-[12.5px] text-emerald-800 mt-1 max-w-md mx-auto">
                  Transmittal reference <strong>{currentProject.code}-{revisionCode}</strong> has been logged to the permanent audit trail with {tasks.length} activities locked.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPublishedSuccess(false)}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-[12px] shadow-2xs transition-colors"
                >
                  Publish Another Issue
                </button>
                <button
                  type="button"
                  onClick={closePublishModal}
                  className="px-4 py-2 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-50 text-emerald-900 font-semibold text-[12px] transition-colors"
                >
                  Close Transmittal
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Programme Scope Box */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 flex items-center justify-between text-[12px]">
                <div className="flex items-center gap-3">
                  <Building className="h-5 w-5 text-slate-500" />
                  <div>
                    <span className="font-bold text-slate-900 block">{currentProject.name}</span>
                    <span className="text-[11px] text-slate-500 font-mono">Code: {currentProject.code} • Working Ver: v{programmeVersion}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="font-bold text-slate-900 block">{tasks.length} Activities</span>
                  <span className="text-[11px] text-emerald-600 font-medium">Ready for Release</span>
                </div>
              </div>

              {/* Form Controls */}
              <div className="grid grid-cols-2 gap-4 text-[12.5px]">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">Target Revision Code</label>
                  <input
                    type="text"
                    value={revisionCode}
                    onChange={(e) => setRevisionCode(e.target.value)}
                    placeholder="e.g. Rev B, Rev 02, AFC-01"
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Purpose of Release</label>
                  <select
                    value={issuePurpose}
                    onChange={(e) => setIssuePurpose(e.target.value as any)}
                    className="w-full h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="client-acceptance">For Client Acceptance / Contractual Baseline</option>
                    <option value="for-construction">Approved For Construction (AFC)</option>
                    <option value="for-tender">For Subcontractor Tender Issue</option>
                    <option value="for-information">For Information / Progress Briefing</option>
                  </select>
                </div>
              </div>

              {/* Transmittal Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[12.5px]">Transmittal Executive Summary</label>
                <textarea
                  value={transmittalNotes}
                  onChange={(e) => setTransmittalNotes(e.target.value)}
                  rows={2}
                  className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-[12px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Distribution List */}
              <div>
                <label className="font-bold text-slate-700 block mb-1 text-[12.5px]">Distribution & Transmittal Recipients</label>
                <input
                  type="text"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  className="w-full h-9 rounded-lg border border-slate-200 bg-white px-3 text-[12px] focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Baseline Option Checkbox */}
              <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="freeze-baseline-check"
                  checked={isFreezeBaselineChecked}
                  onChange={(e) => setIsFreezeBaselineChecked(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="freeze-baseline-check" className="text-[12px] text-blue-900 cursor-pointer leading-snug">
                  <strong>Create Immutable Baseline Snapshot:</strong> Lock this schedule release as an approved revision snapshot ({revisionCode}) for future earned value variance analysis.
                </label>
              </div>
            </>
          )}

          {/* Historical Issue Transmittals */}
          <div>
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Issue History & Transmittal Register ({history.length})
            </span>
            <div className="space-y-2">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 flex items-center justify-between text-[11.5px]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-blue-700">{item.revision}</span>
                      <span className="font-semibold text-slate-900">{item.purpose}</span>
                    </div>
                    <div className="text-[10.5px] text-slate-500">
                      Released by {item.author} on {item.date} • {item.taskCount} tasks
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 font-bold text-[10px]">
                      {item.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => alert(`Downloading signed PDF Transmittal for ${item.revision}`)}
                      className="p-1 rounded hover:bg-slate-200 text-slate-600 transition-colors"
                      title="Download Client Transmittal Certificate"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        {!isPublishedSuccess && (
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-[11px] text-slate-500">
              Controlled under ISO 9001 construction planning governance.
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closePublishModal}
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 text-[12px] hover:bg-slate-50 transition-colors shadow-2xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePublish}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[12px] shadow-xs transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>Publish Programme</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
