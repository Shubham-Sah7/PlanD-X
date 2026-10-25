"use client";

import React, { useState } from "react";
import {
  X,
  Building2,
  Plus,
  Copy,
  Trash2,
  Calendar,
  MapPin,
  Clock,
  Layers,
  Sparkles,
  Check,
  ChevronRight,
  FolderPlus,
  Upload,
  AlertTriangle,
  Compass,
  DollarSign,
  Briefcase,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import type { ConstructionProject, ProjectTemplateType, CreateProjectInput } from "@/lib/project-types";

type ModalTab = "list" | "create" | "settings";

const CURRENCIES = [
  { code: "GBP", symbol: "£", label: "British Pound (£)" },
  { code: "USD", symbol: "$", label: "US Dollar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" },
  { code: "AUD", symbol: "A$", label: "Australian Dollar (A$)" },
  { code: "INR", symbol: "₹", label: "Indian Rupee (₹)" },
];

export function ProjectManagementModal() {
  const {
    isProjectModalOpen,
    closeProjectModal,
    allProjects,
    currentProject,
    switchProject,
    createNewProject,
    cloneCurrentProject,
    deleteCurrentProject,
    updateCurrentProject,
    openImport,
  } = useProgramme();

  const [activeTab, setActiveTab] = useState<ModalTab>("list");

  // Create Project Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("London, UK");
  const [clientName, setClientName] = useState("");
  const [plannedStartDate, setPlannedStartDate] = useState("2026-03-02");
  const [plannedFinishDate, setPlannedFinishDate] = useState("");
  const [scheduleFromStart, setScheduleFromStart] = useState(true);
  const [calendarPreset, setCalendarPreset] = useState("cal-5day");
  const [currency, setCurrency] = useState("GBP");
  const [units, setUnits] = useState<"metric" | "imperial">("metric");
  const [template, setTemplate] = useState<ProjectTemplateType>("blank");

  // Project Settings Form State
  const [settingsName, setSettingsName] = useState(currentProject?.name || "");
  const [settingsCode, setSettingsCode] = useState(currentProject?.code || "");
  const [settingsLocation, setSettingsLocation] = useState(currentProject?.location || "");
  const [settingsClient, setSettingsClient] = useState(currentProject?.clientName || "");
  const [settingsCurrency, setSettingsCurrency] = useState(currentProject?.currency || "GBP");
  const [settingsUnits, setSettingsUnits] = useState<"metric" | "imperial">(currentProject?.units || "metric");

  // Action status
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isProjectModalOpen) return null;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a project name.");
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const input: CreateProjectInput = {
        name: name.trim(),
        code: code.trim() || `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
        description: description.trim() || undefined,
        location: location.trim() || undefined,
        clientName: clientName.trim() || undefined,
        plannedStartDate: plannedStartDate || undefined,
        plannedFinishDate: plannedFinishDate || undefined,
        scheduleFromStart,
        calendarId: calendarPreset,
        currency,
        units,
        template,
      };

      await createNewProject(input);

      // Reset form
      setName("");
      setCode("");
      setDescription("");
      closeProjectModal();
    } catch (err: any) {
      setError(err?.message || "Failed to create project.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProject) return;
    setSubmitting(true);
    setError(null);

    try {
      await updateCurrentProject({
        name: settingsName.trim() || currentProject.name,
        code: settingsCode.trim() || currentProject.code,
        location: settingsLocation.trim() || currentProject.location,
        clientName: settingsClient.trim() || undefined,
        currency: settingsCurrency,
        units: settingsUnits,
      });
      closeProjectModal();
    } catch (err: any) {
      setError(err?.message || "Failed to save project settings.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClone = async (projectId: string) => {
    setSubmitting(true);
    setError(null);
    try {
      await cloneCurrentProject();
      setActiveTab("list");
    } catch (err: any) {
      setError(err?.message || "Failed to clone project.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (projectId: string) => {
    const proj = allProjects.find((p) => p.id === projectId);
    if (proj?.isDemo) {
      alert("Demonstration projects cannot be deleted.");
      return;
    }
    if (!confirm(`Are you sure you want to permanently delete project '${proj?.name}'? This cannot be undone.`)) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await deleteCurrentProject(projectId);
    } catch (err: any) {
      setError(err?.message || "Failed to delete project.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeProjectModal}
    >
      <div
        className="w-full max-w-3xl rounded-xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm shadow-blue-500/20">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h2 id="project-modal-title" className="text-[17px] font-semibold text-slate-900 leading-tight">
                Project &amp; Programme Workspace
              </h2>
              <p className="text-[12.5px] text-slate-500">
                Switch programmes, start from scratch, or configure project settings.
              </p>
            </div>
          </div>
          <button
            onClick={closeProjectModal}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-6">
          <button
            id="project-tab-list"
            onClick={() => setActiveTab("list")}
            className={`py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "list"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Active Projects ({allProjects.length})</span>
          </button>
          <button
            id="project-tab-create"
            onClick={() => {
              setActiveTab("create");
              setError(null);
            }}
            className={`py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "create"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Plus className="w-4 h-4" />
            <span>Create New Project</span>
          </button>
          <button
            id="project-tab-settings"
            onClick={() => {
              setActiveTab("settings");
              setSettingsName(currentProject?.name || "");
              setSettingsCode(currentProject?.code || "");
              setSettingsLocation(currentProject?.location || "");
              setSettingsClient(currentProject?.clientName || "");
              setSettingsCurrency(currentProject?.currency || "GBP");
              setSettingsUnits(currentProject?.units || "metric");
              setError(null);
            }}
            className={`py-3 text-[13px] font-medium border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
              activeTab === "settings"
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Project Settings</span>
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-[13px] text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* TAB 1: LIST / SWITCH */}
          {activeTab === "list" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-1">
                <span className="text-[12.5px] text-slate-500">
                  Select a project to switch workspace, or duplicate to create a working revision.
                </span>
                <button
                  onClick={() => setActiveTab("create")}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 text-white text-[12.5px] font-medium hover:bg-blue-700 shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Project</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3">
                {allProjects.map((p) => {
                  const isActive = p.id === currentProject?.id;
                  const tasksCount = (p as any).tasksCount ?? 0;

                  return (
                    <div
                      key={p.id}
                      className={`relative flex items-center justify-between p-4 rounded-xl border transition-all ${
                        isActive
                          ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div className="flex items-start gap-3.5 min-w-0 pr-4">
                        <div
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border ${
                            isActive
                              ? "bg-blue-600 text-white border-blue-600"
                              : "bg-slate-100 text-slate-600 border-slate-200"
                          }`}
                        >
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              {p.code}
                            </span>
                            <span className="text-[14.5px] font-semibold text-slate-900 truncate">
                              {p.name}
                            </span>
                            {p.isDemo && (
                              <span className="rounded bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase tracking-wide">
                                Demo Project
                              </span>
                            )}
                            {isActive && (
                              <span className="rounded bg-emerald-100 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase tracking-wide">
                                Active Workspace
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-[12px] text-slate-500 flex-wrap">
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{p.location || "Unspecified"}</span>
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Start: {p.plannedStartDate}</span>
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                              <Layers className="w-3.5 h-3.5 text-slate-400" />
                              <span>{tasksCount} tasks</span>
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!isActive ? (
                          <button
                            onClick={() => switchProject(p.id)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 text-slate-700 text-[12.5px] font-medium transition-colors cursor-pointer"
                          >
                            <span>Open Project</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-[12px] font-semibold">
                            <Check className="w-3.5 h-3.5" />
                            <span>Current</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleClone(p.id)}
                          title="Duplicate project with regenerated IDs"
                          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        >
                          <Copy className="w-4 h-4" />
                        </button>

                        {!p.isDemo && allProjects.length > 1 && (
                          <button
                            onClick={() => handleDelete(p.id)}
                            title="Delete project"
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 2: CREATE PROJECT */}
          {activeTab === "create" && (
            <form onSubmit={handleCreateSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Project Name */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Project Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="create-project-name-input"
                    type="text"
                    required
                    placeholder="e.g. Manchester Tower 2 or Apex Commercial Fitout"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Project Code */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Project Number / Code
                  </label>
                  <input
                    id="create-project-code-input"
                    type="text"
                    placeholder="e.g. PRJ-2026-002"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] font-mono focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Site Location */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Site Location
                  </label>
                  <input
                    id="create-project-location-input"
                    type="text"
                    placeholder="e.g. London, UK or Siliguri, WB"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Client Name */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Client Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. British Land or Apex Commercial Holdings"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Planned Start Date */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Planned Start Date
                  </label>
                  <input
                    type="date"
                    value={plannedStartDate}
                    onChange={(e) => setPlannedStartDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Scheduling Direction */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Scheduling Direction
                  </label>
                  <select
                    value={scheduleFromStart ? "start" : "finish"}
                    onChange={(e) => setScheduleFromStart(e.target.value === "start")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] bg-white focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="start">Forward from Planned Start (Standard CPM)</option>
                    <option value="finish">Backward from Planned Finish Date</option>
                  </select>
                </div>

                {/* Working Calendar */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Working Calendar
                  </label>
                  <select
                    value={calendarPreset}
                    onChange={(e) => setCalendarPreset(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] bg-white focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="cal-5day">Standard 5-Day Week (Mon–Fri 8h)</option>
                    <option value="cal-6day">6-Day Construction (Mon–Sat 8h)</option>
                    <option value="cal-7day">7-Day 24/7 Continuous Operations</option>
                  </select>
                </div>

                {/* Currency */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Project Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] bg-white focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Measurement Units */}
                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">
                    Measurement Units
                  </label>
                  <select
                    value={units}
                    onChange={(e) => setUnits(e.target.value as "metric" | "imperial")}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] bg-white focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="metric">Metric (metres, tonnes, m²)</option>
                    <option value="imperial">Imperial (feet, yards, sqft)</option>
                  </select>
                </div>
              </div>

              {/* Template Blueprint Selector */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="text-[13px] font-semibold text-slate-900 block">
                  Select Starting Blueprint
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {/* Blank */}
                  <div
                    onClick={() => setTemplate("blank")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      template === "blank"
                        ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <FolderPlus className="w-4 h-4 text-blue-600" />
                      <span className="text-[13px] font-semibold text-slate-900">
                        Blank Project (0 tasks)
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500">
                      Clean slate without demo data. Best for authoring custom programmes from scratch.
                    </p>
                  </div>

                  {/* Commercial Fitout */}
                  <div
                    onClick={() => setTemplate("commercial-fitout")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      template === "commercial-fitout"
                        ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Briefcase className="w-4 h-4 text-indigo-600" />
                      <span className="text-[13px] font-semibold text-slate-900">
                        Commercial Office Fitout
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500">
                      12 tasks: Strip-out, MEP 1st fix, drywall partitions, acoustic ceilings, PC.
                    </p>
                  </div>

                  {/* Multi-Storey Residential */}
                  <div
                    onClick={() => setTemplate("multi-storey-residential")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      template === "multi-storey-residential"
                        ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-emerald-600" />
                      <span className="text-[13px] font-semibold text-slate-900">
                        Multi-Storey Residential Tower
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500">
                      12 tasks: Piling, RC superstructure, curtain wall facade, apartment fitouts.
                    </p>
                  </div>

                  {/* Civil Infrastructure */}
                  <div
                    onClick={() => setTemplate("civil-infrastructure")}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      template === "civil-infrastructure"
                        ? "border-blue-600 bg-blue-50/40 ring-2 ring-blue-600/20"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-600" />
                      <span className="text-[13px] font-semibold text-slate-900">
                        Civil Infrastructure &amp; Earthworks
                      </span>
                    </div>
                    <p className="mt-1 text-[11.5px] text-slate-500">
                      10 tasks: Silt fencing, bulk earthworks, stormwater drainage, road pavement.
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => openImport()}
                  className="inline-flex items-center gap-1.5 text-[12.5px] text-slate-600 hover:text-blue-600 font-medium transition-colors cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Or import existing MPP / XML file</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={closeProjectModal}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="create-project-submit-btn"
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 shadow-sm transition-all shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{submitting ? "Creating Project..." : "Create Project"}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* TAB 3: PROJECT SETTINGS */}
          {activeTab === "settings" && currentProject && (
            <form onSubmit={handleSettingsSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[12.5px] font-medium text-slate-700">Project Name</label>
                  <input
                    type="text"
                    required
                    value={settingsName}
                    onChange={(e) => setSettingsName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">Project Number / Code</label>
                  <input
                    type="text"
                    required
                    value={settingsCode}
                    onChange={(e) => setSettingsCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] font-mono focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">Site Location</label>
                  <input
                    type="text"
                    value={settingsLocation}
                    onChange={(e) => setSettingsLocation(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">Client Name</label>
                  <input
                    type="text"
                    value={settingsClient}
                    onChange={(e) => setSettingsClient(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] focus:border-blue-500 focus:outline-hidden"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12.5px] font-medium text-slate-700">Currency</label>
                  <select
                    value={settingsCurrency}
                    onChange={(e) => setSettingsCurrency(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-[13.5px] bg-white focus:border-blue-500 focus:outline-hidden"
                  >
                    {CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={closeProjectModal}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-[13px] font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 text-white text-[13px] font-medium hover:bg-blue-700 shadow-sm transition-all disabled:opacity-50"
                >
                  <Check className="w-4 h-4" />
                  <span>{submitting ? "Saving..." : "Save Settings"}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
