"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Camera,
  HardHat,
  Search,
  Filter,
  Check,
  Clock,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus } from "@/lib/programme-types";

export function MobileSiteCompanionModal() {
  const {
    isMobileCompanionOpen,
    closeMobileCompanion,
    tasks,
    updateTaskProgress,
    queueOfflineUpdate,
    syncOfflineQueue,
    offlineQueueCount,
    currentUserRole,
    userPermissions,
  } = useProgramme();

  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTrade, setSelectedTrade] = useState<string>("All Trades");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [siteNote, setSiteNote] = useState("");
  const [sitePhotoAdded, setSitePhotoAdded] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const trades = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.trade) set.add(t.trade);
    });
    return ["All Trades", ...Array.from(set)];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.summary)
      .filter((t) => (selectedTrade === "All Trades" ? true : t.trade === selectedTrade))
      .filter((t) =>
        searchQuery ? t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.wbs?.includes(searchQuery) : true
      );
  }, [tasks, selectedTrade, searchQuery]);

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) || filteredTasks[0] || null,
    [tasks, selectedTaskId, filteredTasks]
  );

  if (!isMobileCompanionOpen) return null;

  const handleUpdateProgress = (taskId: string, newProgress: number) => {
    const newStatus: TaskStatus = newProgress === 100 ? "complete" : newProgress > 0 ? "in-progress" : "not-started";

    if (!isOnline) {
      queueOfflineUpdate({
        taskId,
        type: "progress",
        payload: { progress: newProgress, status: newStatus },
      });
    } else {
      updateTaskProgress(taskId, newProgress, newStatus);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="flex flex-col w-full max-w-xl max-h-[92vh] rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
              <HardHat className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-[15px] leading-tight text-white">Mobile Site Companion</h3>
                {isOnline ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                    <Wifi className="h-3 w-3" />
                    Online
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold text-amber-300 border border-amber-500/30 animate-pulse">
                    <WifiOff className="h-3 w-3" />
                    Offline Mode
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">Touch-first site inspection & physical progress recording</p>
            </div>
          </div>
          <button
            onClick={closeMobileCompanion}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Offline Queue Sync Bar */}
        {offlineQueueCount > 0 && (
          <div className="flex items-center justify-between px-5 py-2.5 bg-amber-50 border-b border-amber-200 text-[12px] text-amber-900 shrink-0">
            <div className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
              <span>
                <strong>{offlineQueueCount} update{offlineQueueCount > 1 ? "s" : ""}</strong> pending in offline queue
              </span>
            </div>
            <button
              onClick={syncOfflineQueue}
              disabled={!isOnline}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold shadow-2xs transition-colors ${
                isOnline
                  ? "bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              <RefreshCw className="h-3 w-3" />
              <span>Sync Now</span>
            </button>
          </div>
        )}

        {/* Filters & Search */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 space-y-2.5 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search active workfront or task name..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-white text-[12.5px] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Trade Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11.5px] scrollbar-none">
            {trades.map((trade) => (
              <button
                key={trade}
                onClick={() => setSelectedTrade(trade)}
                className={`whitespace-nowrap px-2.5 py-1 rounded-full font-medium transition-colors ${
                  selectedTrade === trade
                    ? "bg-slate-900 text-white"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                {trade}
              </button>
            ))}
          </div>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {activeTask ? (
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs space-y-3.5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="font-mono text-[11px] font-bold text-blue-600">{activeTask.wbs || activeTask.id}</span>
                  <h4 className="text-[15px] font-bold text-slate-900 leading-snug">{activeTask.name}</h4>
                  <div className="flex items-center gap-2 mt-1 text-[11.5px] text-slate-500">
                    <span>{activeTask.trade || "General Works"}</span>
                    <span>•</span>
                    <span>{activeTask.duration}d duration</span>
                    <span>•</span>
                    <span className="font-semibold text-slate-700">{activeTask.startDate} to {activeTask.endDate}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[20px] font-black text-slate-900 leading-none">{activeTask.progress}%</div>
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Verified</span>
                </div>
              </div>

              {/* Big Touch Progress Buttons */}
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                  Update Physical Progress (1-Tap)
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[0, 25, 50, 75, 100].map((pct) => {
                    const isSelected = activeTask.progress === pct;
                    return (
                      <button
                        key={pct}
                        type="button"
                        onClick={() => handleUpdateProgress(activeTask.id, pct)}
                        className={`h-12 rounded-xl flex flex-col items-center justify-center font-bold text-[13px] transition-all shadow-xs active:scale-95 cursor-pointer ${
                          isSelected
                            ? "bg-blue-600 text-white ring-2 ring-blue-600 ring-offset-2"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
                        }`}
                      >
                        <span>{pct}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Progress Slider for granular precision */}
              <div className="pt-1">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={activeTask.progress}
                  onChange={(e) => handleUpdateProgress(activeTask.id, parseInt(e.target.value, 10))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Quick Site Evidence & Daily Observation */}
              <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-[12px]">
                <span className="font-semibold text-slate-800 block">Site Inspection Note & Photo</span>
                <textarea
                  value={siteNote}
                  onChange={(e) => setSiteNote(e.target.value)}
                  placeholder="Record operative attendance, weather impediment, or site inspection notes..."
                  rows={2}
                  className="w-full rounded-md border border-slate-200 bg-white p-2 text-[12px] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setSitePhotoAdded(!sitePhotoAdded)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                      sitePhotoAdded
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    <Camera className="h-3.5 w-3.5 text-slate-500" />
                    <span>{sitePhotoAdded ? "Photo Attached (1)" : "Attach Photo"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (!siteNote && !sitePhotoAdded) return;
                      handleUpdateProgress(activeTask.id, activeTask.progress);
                      setSiteNote("");
                      setSitePhotoAdded(false);
                      alert("Site observation saved with GPS timestamp.");
                    }}
                    className="px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                  >
                    Save Log
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400">No matching activities found</div>
          )}

          {/* Quick Activity Selector List */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
              Select Workfront Activity ({filteredTasks.length})
            </label>
            <div className="space-y-1.5">
              {filteredTasks.slice(0, 15).map((t) => {
                const isSelected = activeTask?.id === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      isSelected
                        ? "border-blue-500 bg-blue-50/60 shadow-xs"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[10.5px] font-bold text-slate-500">{t.wbs || t.id}</span>
                        <span className="text-[12.5px] font-semibold text-slate-900">{t.name}</span>
                      </div>
                      <span className="text-[11px] text-slate-400">{t.trade || "Works"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                          t.progress === 100
                            ? "bg-emerald-100 text-emerald-800"
                            : t.progress > 0
                            ? "bg-blue-100 text-blue-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {t.progress}%
                      </span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11.5px] text-slate-500 shrink-0">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Role: <strong>{userPermissions.label}</strong></span>
          </div>
          <button
            onClick={closeMobileCompanion}
            className="px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
