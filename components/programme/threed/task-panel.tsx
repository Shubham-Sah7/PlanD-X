"use client";

import React from "react";
import {
  X,
  AlertCircle,
  CheckCircle2,
  Clock,
  CircleDashed,
  ChevronRight,
  User,
  Calendar,
  Layers,
  AlertTriangle,
  FileText,
  Camera,
  Link2,
  Activity,
  RefreshCw,
} from "lucide-react";
import type { BuildingTask } from "./threed-data";
import { STATUS_COLORS, formatDate, getTasksForLevel, BUILDING_TASKS } from "./threed-data";

interface TaskPanelProps {
  task: BuildingTask | null;
  onClose: () => void;
}

function StatusIcon({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle2 className="h-3.5 w-3.5" style={{ color: STATUS_COLORS["complete"].fill }} />;
  if (status === "in-progress") return <Clock className="h-3.5 w-3.5" style={{ color: STATUS_COLORS["in-progress"].fill }} />;
  if (status === "blocked") return <AlertCircle className="h-3.5 w-3.5" style={{ color: STATUS_COLORS["blocked"].fill }} />;
  return <CircleDashed className="h-3.5 w-3.5" style={{ color: STATUS_COLORS["not-started"].fill }} />;
}

function ProgressBar({ value, status }: { value: number; status: string }) {
  const color = STATUS_COLORS[status as keyof typeof STATUS_COLORS]?.fill ?? "#94a3b8";
  return (
    <div className="relative h-2 w-full rounded-full bg-slate-100 overflow-hidden">
      <div
        className="absolute inset-y-0 left-0 rounded-full transition-all"
        style={{ width: `${value}%`, background: color }}
      />
    </div>
  );
}

type PanelTab = "details" | "dependencies" | "updates" | "files";

export function TaskPanel({ task, onClose }: TaskPanelProps) {
  const [activeTab, setActiveTab] = React.useState<PanelTab>("details");

  if (!task) {
    // Empty state
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-center px-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100">
          <Layers className="h-5 w-5 text-slate-400" />
        </div>
        <div>
          <p className="text-[13px] font-medium text-slate-700">No element selected</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Click a hotspot on the building or select a level</p>
        </div>
      </div>
    );
  }

  const colors = STATUS_COLORS[task.status];
  const predecessorTasks = task.predecessors
    .map((id) => BUILDING_TASKS.find((t) => t.id === id))
    .filter(Boolean) as BuildingTask[];

  const tabs: { id: PanelTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: "details", label: "Details", icon: FileText },
    { id: "dependencies", label: "Dependencies", icon: Link2 },
    { id: "updates", label: "Updates", icon: Activity },
    { id: "files", label: "3D / QA", icon: Camera },
  ];

  return (
    <div className="flex h-full flex-col bg-white">
      {/* Panel Header */}
      <div className="flex items-start justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-[10px] font-semibold tracking-wider text-slate-400 uppercase font-mono">{task.id}</span>
            {task.isCritical && (
              <span className="rounded px-1.5 py-0.5 bg-red-50 text-[9px] font-semibold text-red-600 uppercase tracking-wider border border-red-100">
                Critical Path
              </span>
            )}
          </div>
          <h2 className="text-[14px] font-semibold text-slate-900 leading-snug truncate">{task.name}</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">{task.level} · {task.trade}</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors ml-2 mt-0.5"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Status Badge */}
      <div className="px-4 py-2.5 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon status={task.status} />
            <span className="text-[12px] font-semibold" style={{ color: colors.text }}>
              {colors.label}
            </span>
          </div>
          <span className="text-[12px] font-bold text-slate-700">{task.progress}%</span>
        </div>
        <div className="mt-2">
          <ProgressBar value={task.progress} status={task.status} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 px-4">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2 py-2.5 text-[11px] font-medium border-b-2 transition-colors mr-1 -mb-px ${
                isActive
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-400 hover:text-slate-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "details" && (
          <div className="px-4 py-3 space-y-4">
            {/* Date + Duration */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Start</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[12px] font-medium text-slate-700">{formatDate(task.startDate)}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Finish</p>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span className="text-[12px] font-medium text-slate-700">{formatDate(task.endDate)}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Duration</p>
                <span className="text-[12px] font-medium text-slate-700">{task.duration} days</span>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">WBS</p>
                <span className="text-[12px] font-medium font-mono text-slate-600">{task.wbs}</span>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Trade / Location / Critical */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Trade</span>
                <span className="text-[11px] font-medium text-slate-700">{task.trade}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Location</span>
                <span className="text-[11px] font-medium text-slate-700">{task.level}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Element</span>
                <span className="text-[11px] font-medium text-slate-700 capitalize">{task.elementType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Critical Path</span>
                <span className={`text-[11px] font-semibold ${task.isCritical ? "text-red-600" : "text-slate-500"}`}>
                  {task.isCritical ? "Yes" : "No"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Assigned to</span>
                <div className="flex items-center gap-1.5">
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-[9px] font-semibold text-blue-700">
                    {task.assignee.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <span className="text-[11px] font-medium text-slate-700">{task.assignee}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Phase</span>
                <span className="text-[11px] font-medium text-slate-700">{task.phase}</span>
              </div>
            </div>

            {/* Blocked reason */}
            {task.isBlocked && task.blockedBy && (
              <>
                <div className="h-px bg-slate-100" />
                <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-[11px] font-semibold text-red-700 mb-0.5">Blocked</p>
                      <p className="text-[11px] text-red-600">{task.blockedBy}</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Notes */}
            {task.notes && (
              <>
                <div className="h-px bg-slate-100" />
                <div>
                  <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Notes</p>
                  <p className="text-[11px] text-slate-600 leading-relaxed">{task.notes}</p>
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === "dependencies" && (
          <div className="px-4 py-3 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Predecessors ({predecessorTasks.length})</p>
            {predecessorTasks.length === 0 ? (
              <p className="text-[11px] text-slate-400">No predecessors</p>
            ) : (
              <div className="space-y-2">
                {predecessorTasks.map((pred) => {
                  const pColors = STATUS_COLORS[pred.status];
                  return (
                    <div key={pred.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={pred.status} />
                        <div>
                          <p className="text-[11px] font-medium text-slate-800">{pred.name}</p>
                          <p className="text-[10px] text-slate-400">{pred.id} · {pred.level}</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: pColors.light, color: pColors.text }}>
                        {pColors.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mt-4">Relation Type</p>
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[11px] text-slate-600">Finish-to-Start (FS) — This task starts after predecessors finish.</p>
            </div>
          </div>
        )}

        {activeTab === "updates" && (
          <div className="px-4 py-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Recent Updates</p>
              <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
            </div>
            {[
              { author: "J. Smith", time: "2 days ago", text: "6 of 10 columns cast. Formwork being reset for remaining columns.", progress: 60 },
              { author: "J. Smith", time: "1 week ago", text: "First pour completed — columns 1–3. Concrete strength achieved.", progress: 30 },
              { author: "Site Manager", time: "2 weeks ago", text: "Formwork inspection passed. Ready for pour.", progress: 0 },
            ].map((update, i) => (
              <div key={i} className="border-l-2 border-slate-200 pl-3 py-0.5">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[11px] font-semibold text-slate-700">{update.author}</span>
                  <span className="text-[10px] text-slate-400">{update.time}</span>
                </div>
                <p className="text-[11px] text-slate-600">{update.text}</p>
                {update.progress > 0 && (
                  <div className="mt-1.5">
                    <span className="text-[10px] text-slate-400">Reported: {update.progress}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === "files" && (
          <div className="px-4 py-3 space-y-3">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Documents & Photos</p>
            {[
              { name: "Columns ITP — Level 2.pdf", type: "ITP", date: "15 Jan" },
              { name: "Reinforcement Layout L2.pdf", type: "Drawing", date: "12 Jan" },
              { name: "Pour Record 01.jpg", type: "Photo", date: "10 Jan" },
              { name: "Pour Record 02.jpg", type: "Photo", date: "13 Jan" },
            ].map((file, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <div>
                    <p className="text-[11px] font-medium text-slate-800">{file.name}</p>
                    <p className="text-[10px] text-slate-400">{file.type} · {file.date}</p>
                  </div>
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Primary Actions */}
      <div className="border-t border-slate-200 px-4 py-3 space-y-2">
        <button className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-[12px] font-semibold text-white hover:bg-blue-700 transition-colors">
          <RefreshCw className="h-3.5 w-3.5" />
          Update Progress
        </button>
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <FileText className="h-3 w-3" />
            Add Note
          </button>
          <button className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            <Camera className="h-3 w-3" />
            Add Photo
          </button>
        </div>
      </div>
    </div>
  );
}
