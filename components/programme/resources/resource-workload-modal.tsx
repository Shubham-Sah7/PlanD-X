"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  Users,
  HardHat,
  Truck,
  DollarSign,
  Package,
  Calendar,
  Clock,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Plus,
  ArrowRight,
  TrendingUp,
  FileText,
  Info,
  X,
  Sparkles,
  Link2,
  ExternalLink,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type {
  ProjectResource,
  ResourceType,
  ResourceWorkloadSummary,
} from "@/lib/programme-types";
import {
  calculateResourceWorkloads,
  formatDateIso,
} from "@/lib/programme-calendar";
import {
  simulateResourceLeveling,
  type ResourceLevelingPreview,
} from "@/lib/programme-resource-leveling";
import {
  getResourceCalculationLimitations,
  MASTER_SUBCONTRACTORS,
} from "@/lib/programme-resources";

type TabId = "workload" | "directory" | "leveling" | "transparency";
type HorizonType = "day" | "week" | "month";

export function ResourceWorkloadModal() {
  const {
    tasks,
    projectCalendar,
    projectResources,
    addProjectResource,
    isResourceWorkloadModalOpen,
    closeResourceWorkloadModal,
    applyResourceLeveling,
  } = useProgramme();

  const [activeTab, setActiveTab] = useState<TabId>("workload");
  const [horizon, setHorizon] = useState<HorizonType>("day");
  const [resourceTypeFilter, setResourceTypeFilter] = useState<string>("all");
  const [expandedResourceId, setExpandedResourceId] = useState<string | null>(null);

  // New Resource Form state
  const [isAddingResource, setIsAddingResource] = useState(false);
  const [newResName, setNewResName] = useState("");
  const [newResType, setNewResType] = useState<ResourceType>("work");
  const [newResTrade, setNewResTrade] = useState("");
  const [newResMaxUnits, setNewResMaxUnits] = useState<number>(1.0);
  const [newResStdRate, setNewResStdRate] = useState<number>(95);
  const [newResCostPerUse, setNewResCostPerUse] = useState<number>(0);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isResourceWorkloadModalOpen) {
        closeResourceWorkloadModal();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isResourceWorkloadModalOpen, closeResourceWorkloadModal]);

  // Compute live workloads across tasks and calendar
  const workloadData = useMemo(() => {
    return calculateResourceWorkloads(tasks, projectCalendar, projectResources);
  }, [tasks, projectCalendar, projectResources]);

  // Compute leveling simulation preview
  const levelingPreview: ResourceLevelingPreview = useMemo(() => {
    return simulateResourceLeveling(tasks, projectCalendar, projectResources);
  }, [tasks, projectCalendar, projectResources]);

  // Limitations documentation
  const limitations = useMemo(() => getResourceCalculationLimitations(), []);

  // Filtered summaries for workload tab
  const filteredSummaries = useMemo(() => {
    return workloadData.resourceSummaries.filter((summary) => {
      if (resourceTypeFilter === "all") return true;
      return summary.resourceType === resourceTypeFilter;
    });
  }, [workloadData, resourceTypeFilter]);

  // Overallocation and peak metrics
  const overallocatedCount = useMemo(() => {
    return workloadData.resourceSummaries.filter((s) => s.overallocatedDaysCount > 0).length;
  }, [workloadData]);

  const peakOverallocation = useMemo(() => {
    if (workloadData.resourceSummaries.length === 0) return 0;
    return Math.max(...workloadData.resourceSummaries.map((s) => s.maxDailyUnits));
  }, [workloadData]);

  // Handle adding new resource
  const handleCreateResource = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newResName.trim()) return;

    addProjectResource({
      name: newResName.trim(),
      type: newResType,
      category: newResType === "equipment" ? "equipment" : "labour",
      initials: newResName
        .split(" ")
        .map((w) => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase(),
      color: "#4f46e5",
      trade: newResTrade.trim() || undefined,
      maxUnits: newResMaxUnits,
      standardRate: newResStdRate,
      costPerUse: newResCostPerUse > 0 ? newResCostPerUse : undefined,
      isVerifiedVendor: false,
    });

    setNewResName("");
    setNewResTrade("");
    setIsAddingResource(false);
  };

  const getResourceTypeIcon = (type: ResourceType) => {
    switch (type) {
      case "equipment":
        return <Truck className="h-4 w-4 text-amber-600" />;
      case "work":
      case "labour":
        return <HardHat className="h-4 w-4 text-blue-600" />;
      case "material":
        return <Package className="h-4 w-4 text-emerald-600" />;
      case "cost":
        return <DollarSign className="h-4 w-4 text-indigo-600" />;
      default:
        return <Users className="h-4 w-4 text-slate-500" />;
    }
  };

  if (!isResourceWorkloadModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="resource-workload-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
    >
      <div
        className="flex flex-col w-full max-w-5xl max-h-[92vh] bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h2 id="resource-workload-title" className="text-[17px] font-semibold text-slate-900">
                Resource &amp; Workload Management
              </h2>
              <p className="text-[12px] text-slate-500">
                Labour gangs, equipment plant, multi-horizon workload &amp; non-destructive levelling
              </p>
            </div>
          </div>
          <button
            onClick={closeResourceWorkloadModal}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
            title="Close dialog (Escape)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 bg-white">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("workload")}
              className={`px-3.5 py-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "workload"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Calendar className="h-4 w-4" />
              <span>Workload Analysis</span>
              {overallocatedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {overallocatedCount} Alert
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("directory")}
              className={`px-3.5 py-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "directory"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <HardHat className="h-4 w-4" />
              <span>Resources &amp; Rate Cards</span>
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                {projectResources.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab("leveling")}
              className={`px-3.5 py-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "leveling"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span>Levelling Simulation</span>
              {levelingPreview.changes.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">
                  {levelingPreview.changes.length} Shiftable
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("transparency")}
              className={`px-3.5 py-3 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "transparency"
                  ? "border-indigo-600 text-indigo-600 font-semibold"
                  : "border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300"
              }`}
            >
              <Info className="h-4 w-4" />
              <span>Engine Transparency</span>
            </button>
          </div>
        </div>

        {/* Tab 1: Workload Analysis */}
        {activeTab === "workload" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Filter Bar & Horizon Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
              {/* Time Horizon */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-md border border-slate-200 shadow-2xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 px-2">
                  Horizon:
                </span>
                <button
                  type="button"
                  onClick={() => setHorizon("day")}
                  className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors ${
                    horizon === "day"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Daily
                </button>
                <button
                  type="button"
                  onClick={() => setHorizon("week")}
                  className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors ${
                    horizon === "week"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Weekly
                </button>
                <button
                  type="button"
                  onClick={() => setHorizon("month")}
                  className={`px-2.5 py-1 text-[11.5px] font-medium rounded transition-colors ${
                    horizon === "month"
                      ? "bg-indigo-600 text-white shadow-2xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Monthly
                </button>
              </div>

              {/* Resource Type Filter */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11.5px] text-slate-500 font-medium">Type:</span>
                <select
                  value={resourceTypeFilter}
                  onChange={(e) => setResourceTypeFilter(e.target.value)}
                  className="text-[12px] rounded border border-slate-200 bg-white px-2 py-1 text-slate-800 font-medium"
                >
                  <option value="all">All Types</option>
                  <option value="work">Labour (Crews)</option>
                  <option value="equipment">Equipment (Plant)</option>
                  <option value="material">Materials</option>
                  <option value="cost">Cost Packages</option>
                </select>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Peak Allocation
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {(peakOverallocation * 100).toFixed(0)}%
                </div>
                <span className="text-[11px] text-slate-500">
                  {peakOverallocation > 1.0 ? "Over maximum capacity" : "Within capacity"}
                </span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Over-allocated
                </span>
                <div className="text-2xl font-bold text-amber-600 mt-0.5">
                  {overallocatedCount} Resources
                </div>
                <span className="text-[11px] text-slate-500">Demand exceeds capacity</span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Total Planned Work
                </span>
                <div className="text-2xl font-bold text-indigo-600 mt-0.5">
                  {workloadData.resourceSummaries
                    .reduce((sum, r) => sum + (r.totalPlannedHours || 0), 0)
                    .toLocaleString()}h
                </div>
                <span className="text-[11px] text-slate-500">Across assigned activities</span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-white shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Total Resource Cost
                </span>
                <div className="text-2xl font-bold text-emerald-600 mt-0.5">
                  ${workloadData.resourceSummaries
                    .reduce((sum, r) => sum + (r.totalCost || 0), 0)
                    .toLocaleString()}
                </div>
                <span className="text-[11px] text-slate-500">Rate-based cost total</span>
              </div>
            </div>

            {/* Workload Resource Breakdown */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Resource Workload Breakdown ({filteredSummaries.length})
                </h3>
                <span className="text-[11.5px] text-slate-500">
                  Showing demand aggregated by {horizon}
                </span>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredSummaries.length > 0 ? (
                  filteredSummaries.map((summary) => {
                    const isExpanded = expandedResourceId === summary.resourceName;
                    const isOver = summary.overallocatedDaysCount > 0;
                    const capacityUnits = summary.maxCapacityUnits || 1.0;
                    const assignedTasks = tasks.filter((t) => summary.assignedTaskIds?.includes(t.id));

                    return (
                      <div key={summary.resourceName} className="p-3.5 hover:bg-slate-50/70 transition-colors">
                        <div
                          className="flex items-center justify-between cursor-pointer"
                          onClick={() => setExpandedResourceId(isExpanded ? null : summary.resourceName)}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <button
                              type="button"
                              className="text-slate-400 hover:text-slate-600"
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </button>
                            <div className="p-1.5 rounded-md bg-slate-100 border border-slate-200">
                              {getResourceTypeIcon(summary.resourceType || "work")}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-semibold text-slate-900 truncate">
                                  {summary.resourceName}
                                </span>
                                <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  {summary.resourceType}
                                </span>
                                {summary.trade && (
                                  <span className="text-[10.5px] text-slate-500">
                                    ({summary.trade})
                                  </span>
                                )}
                              </div>
                              <div className="text-[11.5px] text-slate-500 mt-0.5">
                                Capacity: {(capacityUnits * 100).toFixed(0)}% ·{" "}
                                {summary.assignedTaskCount || 0} activities assigned ·{" "}
                                {summary.totalPlannedHours?.toLocaleString()}h planned
                                {summary.totalCost && summary.totalCost > 0 && (
                                  <span> · ${summary.totalCost.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0">
                            {isOver ? (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-red-50 border border-red-200 text-red-700 text-[11.5px] font-semibold">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                <span>
                                  Over-allocated ({summary.overallocatedDaysCount} {horizon}s)
                                </span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11.5px] font-medium">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span>Balanced</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Collapsible Sub-tasks & Peak Details */}
                        {isExpanded && (
                          <div className="mt-3.5 pt-3.5 border-t border-slate-100 pl-8 space-y-3 animate-in fade-in">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block">
                              Assigned Activities ({assignedTasks.length})
                            </span>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {assignedTasks.map((t) => (
                                <div
                                  key={t.id}
                                  className="p-2.5 rounded border border-slate-200 bg-white text-[12px] flex items-center justify-between"
                                >
                                  <div className="min-w-0 pr-2">
                                    <div className="font-medium text-slate-900 truncate">
                                      {t.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      WBS: {t.wbs} · {t.startDate} to {t.endDate} ({t.duration}d)
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <span className="text-[11px] font-bold text-indigo-700">
                                      {t.workHours || (t.duration || 1) * 8}h
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Horizon-Specific Over-allocation Details */}
                            {isOver && (
                              <div className="p-2.5 bg-amber-50 rounded border border-amber-200 text-[11.5px] text-amber-800 space-y-1">
                                <div className="font-semibold flex items-center gap-1">
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                                  <span>Contention Details ({horizon.toUpperCase()})</span>
                                </div>
                                <p>
                                  Concurrent tasks assign demand exceeding {(capacityUnits * 100).toFixed(0)}% available capacity.
                                  Use the <strong>Levelling Simulation</strong> tab to resolve overlaps automatically without modifying Contract Baseline 0.
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="p-8 text-center text-slate-500 text-[13px]">
                    No resources matched the selected criteria.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Directory & Rate Cards */}
        {activeTab === "directory" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-slate-900">
                  Project Resource Directory ({projectResources.length})
                </h3>
                <p className="text-[12px] text-slate-500">
                  Labour trades, heavy plant, standard &amp; overtime rates, and verified subcontractor links
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddingResource(!isAddingResource)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white font-medium text-[12px] hover:bg-indigo-700 shadow-2xs"
              >
                <Plus className="h-4 w-4" />
                <span>Add Resource</span>
              </button>
            </div>

            {/* Add Resource Form */}
            {isAddingResource && (
              <form
                onSubmit={handleCreateResource}
                className="p-4 rounded-lg border border-indigo-200 bg-indigo-50/40 space-y-3 animate-in fade-in"
              >
                <div className="font-semibold text-[13px] text-indigo-950">
                  Register New Project Resource
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Resource Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Scaffolding Gang #2"
                      value={newResName}
                      onChange={(e) => setNewResName(e.target.value)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Resource Type
                    </label>
                    <select
                      value={newResType}
                      onChange={(e) => setNewResType(e.target.value as ResourceType)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    >
                      <option value="work">Labour (Work)</option>
                      <option value="equipment">Equipment (Plant)</option>
                      <option value="material">Material</option>
                      <option value="cost">Cost Package</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Trade / Specialty
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Access & Scaffolding"
                      value={newResTrade}
                      onChange={(e) => setNewResTrade(e.target.value)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Max Capacity Units (1.0 = 100%)
                    </label>
                    <input
                      type="number"
                      min="0.1"
                      max="10.0"
                      step="0.1"
                      value={newResMaxUnits}
                      onChange={(e) => setNewResMaxUnits(parseFloat(e.target.value) || 1.0)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Standard Rate ($/hr)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newResStdRate}
                      onChange={(e) => setNewResStdRate(parseFloat(e.target.value) || 0)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-slate-600 block mb-1">
                      Cost Per Use / Mobilization ($)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={newResCostPerUse}
                      onChange={(e) => setNewResCostPerUse(parseFloat(e.target.value) || 0)}
                      className="w-full text-[12px] p-1.5 rounded border border-slate-300 bg-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsAddingResource(false)}
                    className="text-[12px] px-3 py-1 rounded text-slate-600 hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="text-[12px] px-3 py-1 bg-indigo-600 text-white rounded font-medium hover:bg-indigo-700"
                  >
                    Save to Directory
                  </button>
                </div>
              </form>
            )}

            {/* Resources Table */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="p-3">Resource</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Trade</th>
                    <th className="p-3">Capacity</th>
                    <th className="p-3">Std Rate</th>
                    <th className="p-3">Cost / Use</th>
                    <th className="p-3">Subcontractor Record</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {projectResources.map((res) => (
                    <tr key={res.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-medium text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded bg-slate-100 border border-slate-200">
                            {getResourceTypeIcon(res.type)}
                          </div>
                          <span>{res.name}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                          {res.type}
                        </span>
                      </td>
                      <td className="p-3 text-slate-600">{res.trade || "—"}</td>
                      <td className="p-3 font-semibold text-slate-800">
                        {((res.maxUnits || 1.0) * 100).toFixed(0)}%
                      </td>
                      <td className="p-3 font-semibold text-slate-900">
                        ${res.standardRate || 0}/hr
                      </td>
                      <td className="p-3 text-slate-600">
                        {res.costPerUse ? `$${res.costPerUse.toLocaleString()}` : "—"}
                      </td>
                      <td className="p-3">
                        {res.isVerifiedVendor ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Verified Vendor
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Unverified Trade
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: Levelling Simulation & Schedule Impact */}
        {activeTab === "leveling" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Baseline 0 Immutability Guarantee Notice */}
            <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-[12.5px] text-emerald-900">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <strong>Approved Baseline 0 Protection Guarantee:</strong> Contract dates, approved
                deadlines, and Baseline 0 snapshots remain 100% immutable. Levelling adjustments
                shift working forecast schedules only.
              </div>
            </div>

            {/* Impact Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Contended Resources
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {levelingPreview.competingResourcesCount}
                </div>
                <span className="text-[11px] text-slate-500">Exceeding capacity limit</span>
              </div>

              <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/60 shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-slate-500">
                  Conflict Days
                </span>
                <div className="text-2xl font-bold text-slate-900 mt-0.5">
                  {levelingPreview.totalOverallocatedDays}d
                </div>
                <span className="text-[11px] text-slate-500">Total crew days in conflict</span>
              </div>

              <div className="p-3.5 rounded-lg border border-indigo-200 bg-indigo-50/40 shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-indigo-700">
                  Tasks Shifted
                </span>
                <div className="text-2xl font-bold text-indigo-900 mt-0.5">
                  {levelingPreview.changes.length}
                </div>
                <span className="text-[11px] text-indigo-600">Postponed to open slots</span>
              </div>

              <div className="p-3.5 rounded-lg border border-amber-200 bg-amber-50/40 shadow-2xs">
                <span className="text-[11px] font-semibold uppercase text-amber-700">
                  Project Finish Impact
                </span>
                <div className="text-2xl font-bold text-amber-900 mt-0.5">
                  {levelingPreview.projectSlipWorkingDays === 0
                    ? "0 days"
                    : `+${levelingPreview.projectSlipWorkingDays}d`}
                </div>
                <span className="text-[11px] text-amber-600">
                  {levelingPreview.projectSlipWorkingDays === 0
                    ? "Float absorbed safely"
                    : "Completion extended"}
                </span>
              </div>
            </div>

            {/* Impacted Milestones Section */}
            {levelingPreview.impactedMilestones && levelingPreview.impactedMilestones.length > 0 && (
              <div className="border border-amber-200 bg-amber-50/30 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-900">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <span>Impacted Contract Milestones ({levelingPreview.impactedMilestones.length})</span>
                </div>
                <p className="text-[11.5px] text-amber-800">
                  Resource shifts cascade through the schedule engine and impact the following completion milestones:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  {levelingPreview.impactedMilestones.map((m) => (
                    <div
                      key={m.id}
                      className="p-2.5 bg-white rounded border border-amber-200 flex items-center justify-between text-[12px]"
                    >
                      <div>
                        <span className="font-semibold text-slate-900">{m.name}</span>
                        <div className="text-[11px] text-slate-500">
                          {m.originalDate} ➔ <strong className="text-amber-800">{m.proposedDate}</strong>
                        </div>
                      </div>
                      <span className="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                        +{m.slipWorkingDays}d slip
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Proposed Adjustments List */}
            <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-slate-900">
                  Proposed Levelling Adjustments ({levelingPreview.changes.length})
                </h3>
                <span className="text-[11.5px] text-slate-500">
                  Prioritizes critical path &amp; minimum float
                </span>
              </div>

              {levelingPreview.changes.length > 0 ? (
                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                  {levelingPreview.changes.map((c) => (
                    <div
                      key={c.taskId}
                      className="p-3 flex items-center justify-between text-[12px] hover:bg-slate-50/70"
                    >
                      <div className="min-w-0 pr-3">
                        <div className="font-semibold text-slate-900 truncate">
                          {c.taskName} <span className="font-normal text-slate-500">({c.wbs})</span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span>Resource: <strong>{c.resourceName}</strong></span>
                          <span>·</span>
                          <span>Float: {c.totalFloatBefore}d ➔ {c.totalFloatAfter}d</span>
                          {c.wasCritical && (
                            <span className="text-red-600 font-semibold">Critical Activity</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-right shrink-0">
                        <div className="text-[11.5px]">
                          <span className="text-slate-500">{c.originalStartDate}</span>
                          <span className="mx-1 text-slate-400">➔</span>
                          <strong className="text-indigo-700">{c.proposedStartDate}</strong>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold text-[11px]">
                          +{c.shiftWorkingDays}d
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-slate-500 text-[13px]">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                  No resource over-allocations detected. The schedule is currently balanced.
                </div>
              )}
            </div>

            {/* Apply Action Bar */}
            {levelingPreview.changes.length > 0 && (
              <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[12px] text-slate-600">
                  Clicking apply updates the schedule engine, shifts affected successors, and logs a full audit event.
                </div>
                <button
                  type="button"
                  onClick={applyResourceLeveling}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-[12.5px] rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Apply Resource Levelling ({levelingPreview.changes.length} tasks)</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Tab 4: Transparency & Limitations */}
        {activeTab === "transparency" && (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-[12.5px] text-blue-900 leading-relaxed">
              <div className="flex items-center gap-1.5 font-bold mb-1">
                <Info className="h-4 w-4 text-blue-600" />
                <span>Engine Calculation Transparency Principle</span>
              </div>
              <p>
                To avoid misleading construction managers with false assumptions, PlanD-X adheres to strict
                engineering transparency: where an advanced calculation is unsupported, we clearly document
                its boundary rather than displaying inaccurate or synthetic results.
              </p>
            </div>

            <div className="space-y-4">
              {limitations.map((item, idx) => (
                <div
                  key={idx}
                  className="p-4 rounded-lg border border-slate-200 bg-white space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <h4 className="text-[13.5px] font-semibold text-slate-900">
                      {item.feature}
                    </h4>
                    <span className="text-[10.5px] font-bold uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {item.status}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-[12px]">
                    <div>
                      <strong className="text-slate-800">Supported Behavior: </strong>
                      <span className="text-slate-600">{item.supportedBehavior}</span>
                    </div>
                    <div>
                      <strong className="text-amber-800">Unsupported Limitation: </strong>
                      <span className="text-amber-700">{item.unsupportedLimitation}</span>
                    </div>
                    <div className="p-2 bg-slate-50 rounded border border-slate-200 text-slate-700 text-[11.5px]">
                      <strong>Planner Workaround: </strong>
                      <span>{item.recommendation}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50">
          <div className="text-[11.5px] text-slate-500">
            PlanD-X Programme Engine · Microsoft Project Compatible Resource Hierarchy
          </div>
          <button
            onClick={closeResourceWorkloadModal}
            className="px-4 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-medium text-[12px] hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
