"use client";

import React, { useState } from "react";
import { useProgramme } from "@/lib/programme-context";
import {
  WBS_WORK_PACKAGES,
  STANDARD_TASK_CATALOG,
  type WBSWorkPackage,
  type StandardTaskTemplate,
} from "@/lib/wbs-package-library";
import {
  Layers,
  Sparkles,
  Building2,
  Hammer,
  Plus,
  X,
  Check,
  ChevronRight,
  Clock,
  Coins,
  CheckCircle2,
} from "lucide-react";

interface WBSLibraryModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  targetParentId?: string | null;
}

export function WBSLibraryModal({ isOpen, onClose, targetParentId }: WBSLibraryModalProps = {}) {
  const {
    isWBSLibraryOpen,
    closeWBSLibrary,
    wbsLibraryTargetParentId,
    tasks,
    insertWBSPackage,
    createTask,
    statusDate,
    showToast,
    currentUserRole,
  } = useProgramme();

  const showModal = isOpen !== undefined ? isOpen : isWBSLibraryOpen;
  const handleClose = onClose || closeWBSLibrary;
  const effectiveParentId = targetParentId !== undefined ? targetParentId : wbsLibraryTargetParentId;

  const [activeTab, setActiveTab] = useState<"packages" | "tasks">("packages");
  const [selectedPackage, setSelectedPackage] = useState<WBSWorkPackage>(WBS_WORK_PACKAGES[0]);
  const [selectedTask, setSelectedTask] = useState<StandardTaskTemplate>(STANDARD_TASK_CATALOG[0]);
  const [insertDate, setInsertDate] = useState<string>(
    statusDate || new Date().toISOString().slice(0, 10)
  );

  if (!showModal) return null;

  const parentTask = effectiveParentId ? tasks.find((t) => t.id === effectiveParentId) : null;

  const handleInsert = () => {
    if (currentUserRole === "subcontractor" || currentUserRole === "client") {
      showToast("Your current role has read-only schedule permissions.");
      return;
    }

    if (activeTab === "packages") {
      insertWBSPackage(selectedPackage.id, effectiveParentId);
      handleClose();
    } else {
      createTask({
        name: selectedTask.name,
        duration: selectedTask.typicalDuration,
        startDate: insertDate,
        targetParentId: effectiveParentId,
        trade: selectedTask.trade,
        notes: `${selectedTask.description}\nQA Checklist:\n${selectedTask.standardChecklist.map((c) => `- [ ] ${c}`).join("\n")}`,
      });
      showToast(`Inserted standard task '${selectedTask.name}'.`);
      handleClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-700">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-sm">
                Construction WBS & Task Library
              </h3>
              <p className="text-[11.5px] text-slate-500">
                Insert pre-engineered construction work packages and standard activities
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 px-5 pt-3 border-b border-slate-100 bg-white">
          <button
            onClick={() => setActiveTab("packages")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "packages"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Building2 className="h-3.5 w-3.5" />
            <span>WBS Work Packages ({WBS_WORK_PACKAGES.length})</span>
          </button>
          <button
            onClick={() => setActiveTab("tasks")}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === "tasks"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Standard Activity Catalog ({STANDARD_TASK_CATALOG.length})</span>
          </button>
        </div>

        {/* Content Body: Split View */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left Column: List of items */}
          <div className="md:col-span-5 overflow-y-auto p-3 space-y-1.5 bg-slate-50/50">
            {activeTab === "packages"
              ? WBS_WORK_PACKAGES.map((pkg) => {
                  const isSelected = selectedPackage.id === pkg.id;
                  return (
                    <div
                      key={pkg.id}
                      onClick={() => setSelectedPackage(pkg)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-300 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-900">
                          {pkg.name}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {pkg.typicalDurationWorkingDays}d
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{pkg.trade}</span>
                        <span>·</span>
                        <span>{pkg.tasks.length} tasks</span>
                      </div>
                    </div>
                  );
                })
              : STANDARD_TASK_CATALOG.map((item) => {
                  const isSelected = selectedTask.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedTask(item)}
                      className={`p-2.5 rounded-lg border text-left cursor-pointer transition-all ${
                        isSelected
                          ? "bg-blue-50/80 border-blue-300 shadow-xs"
                          : "bg-white border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-900">
                          {item.name}
                        </span>
                        <span className="text-[10px] font-mono font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                          {item.typicalDuration}d
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-500">
                        <span>{item.trade}</span>
                        <span>·</span>
                        <span className="font-mono">£{item.estimatedCost.toLocaleString()}</span>
                      </div>
                    </div>
                  );
                })}
          </div>

          {/* Right Column: Preview & Insertion Settings */}
          <div className="md:col-span-7 overflow-y-auto p-4 flex flex-col justify-between space-y-4 bg-white">
            {activeTab === "packages" ? (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">
                      {selectedPackage.category}
                    </span>
                    <span className="text-xs text-slate-500">{selectedPackage.trade}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {selectedPackage.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {selectedPackage.description}
                  </p>
                </div>

                {/* Sub-tasks Sequence Preview */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                    <span>Package Task Sequence</span>
                    <span>{selectedPackage.tasks.length} items</span>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedPackage.tasks.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2 rounded bg-white border border-slate-200 text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] text-slate-400 font-bold shrink-0">
                            #{idx + 1}
                          </span>
                          <span className={`font-medium truncate ${t.isMilestone ? "text-amber-800 font-semibold" : "text-slate-800"}`}>
                            {t.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500 shrink-0">
                          <span>+{t.offsetDays}d</span>
                          <span className="font-semibold text-slate-700">{t.duration}d</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Insertion Target & Date */}
                <div className="grid grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Target Parent Level
                    </label>
                    <div className="text-xs font-mono px-2 py-1.5 bg-slate-100 rounded border border-slate-200 text-slate-700 truncate">
                      {parentTask ? `[${parentTask.wbs}] ${parentTask.name}` : "Project Root Level"}
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={insertDate}
                      onChange={(e) => setInsertDate(e.target.value)}
                      className="w-full text-xs font-mono bg-white border border-slate-300 rounded px-2 py-1.5 outline-none focus:border-blue-500 text-slate-800"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {selectedTask.category}
                    </span>
                    <span className="text-xs text-slate-500">{selectedTask.trade}</span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-base">
                    {selectedTask.name}
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {selectedTask.description}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[10.5px] text-slate-500">Duration</div>
                    <div className="font-bold text-slate-800 text-sm font-mono mt-0.5">{selectedTask.typicalDuration} days</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[10.5px] text-slate-500">Labour Work</div>
                    <div className="font-bold text-slate-800 text-sm font-mono mt-0.5">{selectedTask.workHours} hrs</div>
                  </div>
                  <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50">
                    <div className="text-[10.5px] text-slate-500">Est. Cost</div>
                    <div className="font-bold text-blue-700 text-sm font-mono mt-0.5">£{selectedTask.estimatedCost.toLocaleString()}</div>
                  </div>
                </div>

                {/* Pre-configured QA Checklist */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Standard QA & Inspection Checklist
                  </div>
                  <ul className="space-y-1 text-xs text-slate-700">
                    {selectedTask.standardChecklist.map((c, i) => (
                      <li key={i} className="flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleInsert}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 text-xs font-semibold shadow-xs transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>
                  {activeTab === "packages" ? "Insert Work Package Sequence" : "Insert Standard Activity"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
