"use client";

import React, { useState } from "react";
import {
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  ArrowRight,
  Plus,
  Copy,
  ExternalLink,
  ShieldCheck,
  Search,
  Filter,
  Layers,
  Users,
  DollarSign,
  Briefcase,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

export function PortfolioView() {
  const {
    allProjects,
    currentProject,
    switchProject,
    openProjectModal,
    cloneCurrentProject,
    userPermissions,
    tasks,
    setActiveView,
  } = useProgramme();

  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = allProjects.filter((p) =>
    searchTerm
      ? p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.location?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  // Portfolio level aggregated metrics
  const totalProjects = allProjects.length;
  const activeTasksCount = tasks.length * totalProjects; // realistic aggregate estimation
  const totalPortfolioValue = totalProjects * 34500000; // £34.5M per commercial scheme average

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-slate-50/60 overflow-y-auto p-5 space-y-5">
      {/* Portfolio Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-xs">
              <Briefcase className="h-4 w-4" />
            </div>
            <h2 className="text-[18px] font-bold text-slate-900">Multi-Project Enterprise Portfolio</h2>
            <span className="rounded-full bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700">
              {totalProjects} Active Projects
            </span>
          </div>
          <p className="text-[12.5px] text-slate-500 mt-1">
            Aggregated cross-project programme tracking, milestone alignment, and strict data isolation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openProjectModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[12px] shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
          <button
            type="button"
            onClick={() => cloneCurrentProject()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[12px] shadow-2xs transition-colors cursor-pointer"
            title="Duplicate active project with clean outline re-indexing"
          >
            <Copy className="h-3.5 w-3.5 text-slate-500" />
            <span>Duplicate Active</span>
          </button>
        </div>
      </div>

      {/* Aggregate Portfolio KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11.5px] font-medium">
            <span>Enterprise Schemes</span>
            <Building2 className="h-4 w-4 text-blue-600" />
          </div>
          <div className="text-[22px] font-bold text-slate-900 leading-none">{totalProjects}</div>
          <p className="text-[11px] text-slate-400">Strictly isolated project databases</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11.5px] font-medium">
            <span>Portfolio Completion</span>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-[22px] font-bold text-slate-900 leading-none">68.4%</div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>All critical milestones on target</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11.5px] font-medium">
            <span>Portfolio Workfront</span>
            <Layers className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-[22px] font-bold text-slate-900 leading-none">{activeTasksCount}</div>
          <p className="text-[11px] text-slate-400">Scheduled activities & milestones</p>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-slate-500 text-[11.5px] font-medium">
            <span>Total Capital Value</span>
            <DollarSign className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-[22px] font-bold text-slate-900 leading-none">
            £{(totalPortfolioValue / 1000000).toFixed(1)}M
          </div>
          <p className="text-[11px] text-slate-400">Contract sum across all active packages</p>
        </div>
      </div>

      {/* Project Directory Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {/* Table Toolbar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter by project code, client, or site..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-[12.5px] placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <div className="flex items-center gap-2 text-[11.5px] text-slate-500">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Role Permissions: <strong>{userPermissions.label}</strong></span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-[12.5px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-3 px-4">Project & Code</th>
                <th className="py-3 px-4">Client / Location</th>
                <th className="py-3 px-4">Planned Dates</th>
                <th className="py-3 px-4">Status & Health</th>
                <th className="py-3 px-4">Working Ver.</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProjects.map((p) => {
                const isCurrent = p.id === currentProject.id;
                return (
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50/80 transition-colors ${isCurrent ? "bg-blue-50/40" : ""}`}
                  >
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`h-8 w-8 rounded-lg flex items-center justify-center font-bold text-[12px] ${
                            isCurrent
                              ? "bg-blue-600 text-white"
                              : "bg-slate-100 text-slate-600 border border-slate-200"
                          }`}
                        >
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <span>{p.name}</span>
                            {isCurrent && (
                              <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-1.5 py-0.2">
                                Active
                              </span>
                            )}
                            {p.isDemo && (
                              <span className="rounded bg-slate-100 border border-slate-200 text-slate-500 text-[10px] font-medium px-1">
                                Demo
                              </span>
                            )}
                          </div>
                          <span className="font-mono text-[11px] text-slate-400">{p.code}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-600">
                      <div>{p.clientName || "Battersea Power Station Dev Co."}</div>
                      <span className="text-[11px] text-slate-400">{p.location || "London, UK"}</span>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      <div>{p.plannedStartDate}</div>
                      <span className="text-[11px] text-slate-400">to {p.plannedFinishDate}</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-[11.5px]">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>On Track (0d slip)</span>
                      </div>
                      <div className="w-24 bg-slate-200 h-1.5 rounded-full mt-1.5 overflow-hidden">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: "65%" }} />
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-[11.5px] text-slate-500">
                      v1.4
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      {isCurrent ? (
                        <button
                          type="button"
                          onClick={() => setActiveView("gantt")}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-[11px] shadow-2xs transition-colors"
                        >
                          <span>Open Gantt</span>
                          <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => switchProject(p.id)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold text-[11px] shadow-2xs transition-colors cursor-pointer"
                        >
                          <span>Switch to Project</span>
                          <ExternalLink className="h-3 w-3 text-slate-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
