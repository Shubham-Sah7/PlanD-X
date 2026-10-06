"use client";

import React, { useState } from "react";
import {
  X, CheckCircle2, Clock, AlertCircle, CircleDashed,
  Calendar, Layers, User, Link2, FileText, Camera,
  Activity, RefreshCw, AlertTriangle, ChevronRight,
  ExternalLink, ChevronDown, Check, ShieldCheck, Box,
} from "lucide-react";
import type { ModelElement, TaskStatus } from "./model-data";
import { STATUS_CONFIG, MODEL_ELEMENTS } from "./model-data";

type PanelTab = "details" | "dependencies" | "updates" | "files" | "qa";

interface ModelTaskPanelProps {
  element: ModelElement | null;
  onClose: () => void;
  onUpdateProgress?: (elementId: string, progress: number, status: TaskStatus) => void;
}

export function ModelTaskPanel({
  element,
  onClose,
  onUpdateProgress,
}: ModelTaskPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>("details");
  const [showProgressMenu, setShowProgressMenu] = useState(false);
  const [showNoteModal, setShowNoteModal] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [updatesList, setUpdatesList] = useState([
    { author: "SK", name: "S. Kumar", time: "Yesterday, 14:30", text: "Columns 1–6 stripped and inspected. Forms being erected for 7–10." },
    { author: "RT", name: "Rachel Taylor", time: "2 days ago", text: "Rebar tie-ins checked against Drawing ST-102. 40mm cover verified." },
    { author: "JS", name: "James Smith", time: "4 days ago", text: "Ready-mix batch design approved for 40MPa slump test." },
    { author: "QA", name: "QA Team", time: "10 Jan 2026", text: "Pre-pour inspection checklist initiated." },
    { author: "SM", name: "Site Manager", time: "05 Jan 2026", text: "Activity started on schedule following Level 1 sign-off." },
  ]);

  if (!element) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6 bg-white">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <p className="text-[13px] font-semibold text-slate-700">No element selected</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[200px]">
            Click any building element in the 3D model to inspect linked programme tasks
          </p>
        </div>
        <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
          BUILDING → LEVEL → ELEMENT → TASK
        </div>
      </div>
    );
  }

  const isComplete = element.status === "complete";
  const isInProgress = element.status === "in-progress";
  const isBlocked = element.status === "blocked";

  const predecessors = element.predecessors
    .map((id) => MODEL_ELEMENTS.find((e) => e.id === id))
    .filter(Boolean) as ModelElement[];

  const successors = MODEL_ELEMENTS.filter((e) => e.predecessors.includes(element.id));

  const handleAddNote = () => {
    if (!noteText.trim()) return;
    setUpdatesList([
      { author: "DU", name: "Demo User", time: "Just now", text: noteText.trim() },
      ...updatesList,
    ]);
    setNoteText("");
    setShowNoteModal(false);
    setActiveTab("updates");
  };

  return (
    <div className="flex h-full flex-col bg-white select-none">
      {/* Top Header */}
      <div className="border-b border-slate-200 px-5 pt-4 pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-bold text-slate-400 tracking-wider">
              {element.id}
            </span>
            <h2 className="text-[16px] font-bold text-slate-900 leading-snug mt-0.5">
              {element.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 mt-2.5">
          {isInProgress && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
              In Progress
            </span>
          )}
          {isComplete && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Complete
            </span>
          )}
          {isBlocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-700 border border-red-200">
              <span className="h-1.5 w-1.5 rounded-full bg-red-600" />
              Blocked
            </span>
          )}
          {!isComplete && !isInProgress && !isBlocked && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-600 border border-slate-200">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              Not Started
            </span>
          )}

          {element.isCritical && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-semibold text-red-600 border border-red-200">
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              Critical Path
            </span>
          )}
        </div>
      </div>

      {/* Progress Section */}
      <div className="border-b border-slate-200 px-5 py-3 bg-slate-50/50">
        <div className="flex items-center justify-between text-[11.5px] font-semibold mb-1.5">
          <span className="text-slate-600 flex items-center gap-1">
            Progress <span className="text-[10px] text-slate-400">↗</span>
          </span>
          <span className="text-slate-900 font-bold">{element.progress}%</span>
        </div>
        <div className="relative h-2 w-full rounded-full bg-slate-200 overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${element.progress}%`,
              background: element.progress === 100 ? "#10b981" : "#0d9488",
            }}
          />
        </div>
      </div>

      {/* Meta Grid (2 columns matching screenshot) */}
      <div className="border-b border-slate-200 px-4 py-2.5 text-[11px]">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {/* Start */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Start</span>
            <div className="flex items-center gap-1 font-medium text-slate-700">
              <span>{element.displayStart}</span>
              <Calendar className="h-3 w-3 text-slate-400" />
            </div>
          </div>

          {/* Finish */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Finish</span>
            <div className="flex items-center gap-1 font-medium text-slate-700">
              <span>{element.displayEnd}</span>
              <Calendar className="h-3 w-3 text-slate-400" />
            </div>
          </div>

          {/* Duration */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Duration</span>
            <span className="font-medium text-slate-700">{element.duration} days</span>
          </div>

          {/* Location */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Location</span>
            <span className="font-medium text-slate-700">{element.level}</span>
          </div>

          {/* Trade */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Trade</span>
            <span className="font-medium text-slate-700">{element.trade}</span>
          </div>

          {/* Assignee */}
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Assignee</span>
            <div className="flex items-center gap-1">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-purple-100 text-[8.5px] font-bold text-purple-700">
                {element.assigneeInitials}
              </span>
              <span className="font-medium text-slate-800 truncate">{element.assignee}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-5 overflow-x-auto scrollbar-none">
        {[
          { id: "details", label: "Details" },
          { id: "dependencies", label: `Dependencies (${predecessors.length})` },
          { id: "updates", label: `Updates (${updatesList.length})` },
          { id: "files", label: "Files (2)" },
          { id: "qa", label: "3D / QA" },
        ].map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as PanelTab)}
              className={`mr-4 -mb-px whitespace-nowrap py-2.5 text-[11.5px] font-medium border-b-2 transition-colors ${
                active
                  ? "border-blue-600 text-blue-600 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Body */}
      <div className="flex-1 overflow-y-auto px-4 py-2.5 space-y-2.5 text-[11.5px]">
        {activeTab === "details" && (
          <div className="space-y-2.5">
            {/* Work Description */}
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-900 mb-1">Work Description</h4>
              <p className="text-[11px] leading-relaxed text-slate-600 bg-slate-50/70 rounded-lg p-2 border border-slate-100">
                {element.description}
              </p>
            </div>

            {/* Related Drawings */}
            <div>
              <h4 className="text-[11.5px] font-bold text-slate-900 mb-1">Related Drawings</h4>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-2 hover:border-blue-400 hover:shadow-xs transition-all cursor-pointer group">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-slate-500 border border-slate-200 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <line x1="3" y1="9" x2="21" y2="9" />
                      <line x1="9" y1="21" x2="9" y2="9" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-[11.5px] font-bold text-slate-800">
                      {element.drawing?.code || "ST-102"}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {element.drawing?.name || "Structural Plan - Level 2"}
                    </div>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
            </div>

            {/* Blocked Alert if applicable */}
            {element.isBlocked && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[11.5px] font-bold text-red-800">Programme Hold Point</p>
                    <p className="text-[11px] text-red-600 mt-0.5 leading-relaxed">
                      {element.blockedBy || "Awaiting pour approval from structural engineer."}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "dependencies" && (
          <div className="space-y-3.5">
            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Predecessors ({predecessors.length})
              </p>
              {predecessors.length === 0 ? (
                <p className="text-[11.5px] text-slate-400 italic">No preceding tasks</p>
              ) : (
                <div className="space-y-1.5">
                  {predecessors.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
                      <div>
                        <p className="font-semibold text-slate-800">{p.name}</p>
                        <p className="text-[10px] text-slate-400">{p.id} · {p.level}</p>
                      </div>
                      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-bold text-emerald-700 border border-emerald-200">
                        {p.progress}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="h-px bg-slate-100" />

            <div>
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                Successors ({successors.length})
              </p>
              {successors.length === 0 ? (
                <p className="text-[11.5px] text-slate-400 italic">No successors linked</p>
              ) : (
                <div className="space-y-1.5">
                  {successors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px]">
                      <div>
                        <p className="font-semibold text-slate-800">{s.name}</p>
                        <p className="text-[10px] text-slate-400">{s.id} · {s.level}</p>
                      </div>
                      <span className="text-[10px] text-slate-500">{s.duration}d</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Activity Log</span>
              <span className="text-[10px] text-slate-400">{updatesList.length} updates</span>
            </div>
            <div className="space-y-3">
              {updatesList.map((u, i) => (
                <div key={i} className="flex items-start gap-2.5 text-[11.5px]">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                    {u.author}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="font-bold text-slate-800">{u.name}</span>
                      <span className="text-[10px] text-slate-400">{u.time}</span>
                    </div>
                    <p className="text-slate-600 mt-0.5 leading-relaxed">{u.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "files" && (
          <div className="space-y-2">
            {[
              { name: "ST-102 Structural Plan - Level 2.dwg", size: "14.2 MB", date: "12 Dec 2025" },
              { name: "ITP-L2-COL-001 Column Pour Inspection.pdf", size: "2.1 MB", date: "18 Dec 2025" },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/60 p-2.5 hover:bg-white transition-colors cursor-pointer">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <div>
                    <p className="font-semibold text-slate-800 text-[11.5px] truncate max-w-[190px]">{f.name}</p>
                    <p className="text-[10px] text-slate-400">{f.size} · {f.date}</p>
                  </div>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
              </div>
            ))}
          </div>
        )}

        {activeTab === "qa" && (
          <div className="space-y-3 text-[11.5px]">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">BIM Element GUID</span>
                <span className="font-mono text-[10.5px] text-slate-700">3aB$002fL2_COL</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Concrete Class</span>
                <span className="font-semibold text-slate-800">C35/45 N20</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Rebar Cover</span>
                <span className="font-semibold text-slate-800">40 mm</span>
              </div>
            </div>

            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-emerald-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              <div>
                <p className="font-bold text-[11px]">QA Check Passed</p>
                <p className="text-[10px] text-emerald-700">Vertical alignment verified within ±3mm tolerance</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons at Bottom */}
      <div className="border-t border-slate-200 p-3 space-y-1.5 bg-white relative shrink-0">
        {/* Progress dropdown menu */}
        {showProgressMenu && (
          <div className="absolute bottom-[105px] left-4 right-4 rounded-xl border border-slate-200 bg-white p-2 shadow-xl z-30 space-y-1">
            <p className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Set Progress & Status
            </p>
            {[
              { p: 100, s: "complete" as TaskStatus, label: "100% — Complete" },
              { p: 75,  s: "in-progress" as TaskStatus, label: "75% — In Progress" },
              { p: 60,  s: "in-progress" as TaskStatus, label: "60% — Current Progress" },
              { p: 25,  s: "in-progress" as TaskStatus, label: "25% — Initial Pour" },
              { p: element.progress, s: "blocked" as TaskStatus, label: "Mark Blocked" },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => {
                  onUpdateProgress?.(element.id, item.p, item.s);
                  setShowProgressMenu(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-[11.5px] hover:bg-slate-50 transition-colors text-slate-700 font-medium"
              >
                <span>{item.label}</span>
                {item.p === element.progress && <Check className="h-3.5 w-3.5 text-blue-600" />}
              </button>
            ))}
          </div>
        )}

        {/* Update Progress Button */}
        <button
          onClick={() => setShowProgressMenu((v) => !v)}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs active:scale-[0.99]"
        >
          <span>Update Progress</span>
          <ChevronDown className="h-4 w-4" />
        </button>

        {/* Add Note / Photo Button */}
        <button
          onClick={() => setShowNoteModal(true)}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white py-2 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors"
        >
          <Camera className="h-4 w-4 text-slate-500" />
          <span>Add Note / Photo</span>
        </button>
      </div>

      {/* Note modal dialog */}
      {showNoteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/30 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-bold text-slate-900">Add Site Note or Evidence</h3>
              <button onClick={() => setShowNoteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <textarea
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Record inspection observations, site conditions, or milestone sign-offs..."
              className="w-full rounded-lg border border-slate-200 p-2.5 text-[12px] placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowNoteModal(false)}
                className="rounded-lg px-3 py-1.5 text-[11.5px] font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAddNote}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-[11.5px] font-semibold text-white hover:bg-blue-700"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
