"use client";

import React, { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Building2,
  ShieldCheck,
  HardHat,
  Wifi,
  WifiOff,
  AlertTriangle,
  RotateCcw,
} from "lucide-react";
import { useProgramme, ROLE_PERMISSIONS_MAP } from "@/lib/programme-context";
import type { ConstructionRole } from "@/lib/programme-types";

export function TopHeader() {
  const {
    state,
    setSearch,
    currentProject,
    openProjectModal,
    currentUserRole,
    setCurrentUserRole,
    userPermissions,
    openMobileCompanion,
    offlineQueueCount,
    hasRecoverySnapshot,
    restoreRecoverySnapshot,
  } = useProgramme();

  const [searchValue, setSearchValue] = useState(state.filters.search || "");
  const [currentDateLabel, setCurrentDateLabel] = useState("Aug 2025");
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setSearch(e.target.value);
  };

  const roles: { role: ConstructionRole; label: string; tag: string }[] = [
    { role: "planner", label: "Senior Project Planner", tag: "Full Logic & Schedule" },
    { role: "project-manager", label: "Project Manager", tag: "Governance & Baselines" },
    { role: "site-engineer", label: "Site Engineer", tag: "Daily Shift & Progress" },
    { role: "subcontractor", label: "Trade Subcontractor", tag: "Claim Submission Only" },
    { role: "client", label: "Client / Employer's Agent", tag: "Audited Read-Only" },
  ];

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5 z-20">
      {/* Left: Project Selector */}
      <div className="flex items-center gap-3">
        <button
          onClick={openProjectModal}
          id="project-selector-btn"
          className="flex items-center gap-2.5 rounded-lg py-1 px-2 hover:bg-slate-50 transition-colors text-left group cursor-pointer"
          title="Switch active construction project or create new"
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-50 border border-blue-200 text-blue-700">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-slate-900 leading-tight flex items-center gap-1.5">
              <span>{currentProject.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
            </div>
            <div className="text-[11px] text-slate-400 font-mono leading-tight">
              {currentProject.code} • {currentProject.location || "London, UK"}
            </div>
          </div>
        </button>
      </div>

      {/* Center: Global Search */}
      <div className="relative w-full max-w-sm mx-4">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search tasks, WBS, or subcontractors..."
          className="w-full h-8.5 rounded-lg border border-slate-200 bg-slate-50/80 pl-9 pr-12 text-[12.5px] text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2">
          <kbd className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right Controls: Role Switcher + Recovery + Site Companion + Profile */}
      <div className="flex items-center gap-2.5">
        {/* Recovery Snapshot Pill */}
        {hasRecoverySnapshot && (
          <button
            onClick={restoreRecoverySnapshot}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-[11px] font-bold shadow-2xs hover:bg-amber-100 transition-colors cursor-pointer animate-pulse"
            title="Emergency recovery snapshot detected from previous session"
          >
            <RotateCcw className="h-3 w-3 text-amber-700" />
            <span>Recover Session</span>
          </button>
        )}

        {/* Mobile Site Companion Trigger */}
        <button
          onClick={openMobileCompanion}
          id="open-site-companion-btn"
          className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
          title="Open touch-friendly mobile site companion with offline queuing"
        >
          <HardHat className="h-3.5 w-3.5 text-amber-600" />
          <span className="hidden sm:inline">Site Companion</span>
          {offlineQueueCount > 0 && (
            <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white font-bold text-[9px] flex items-center justify-center">
              {offlineQueueCount}
            </span>
          )}
        </button>

        {/* Role-Based Access Control (RBAC) Selector */}
        <div className="relative">
          <button
            onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
            id="role-switcher-btn"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-semibold text-slate-700 transition-colors cursor-pointer shadow-2xs"
            title="Switch Active User Role & Simulated Permissions"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span className="hidden sm:inline">{userPermissions.label}</span>
            <ChevronDown className="h-3 w-3 text-slate-400" />
          </button>

          {roleDropdownOpen && (
            <div className="absolute right-0 top-full mt-1 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 animate-in fade-in zoom-in-95">
              <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Simulate Role Permissions
              </div>
              {roles.map((r) => {
                const isSelected = currentUserRole === r.role;
                return (
                  <button
                    key={r.role}
                    onClick={() => {
                      setCurrentUserRole(r.role);
                      setRoleDropdownOpen(false);
                    }}
                    className={`w-full text-left p-2 rounded-lg text-[12px] transition-colors flex flex-col cursor-pointer ${
                      isSelected ? "bg-blue-50 text-blue-900 font-bold" : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{r.label}</span>
                      {isSelected && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    </div>
                    <span className="text-[10px] text-slate-400 font-normal">{r.tag}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Date / Month Filter */}
        <div className="hidden lg:flex h-8 items-center gap-1 text-[12px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <span className="px-2 text-[11.5px] font-semibold text-slate-700">{currentDateLabel}</span>
          <button
            onClick={() => setCurrentDateLabel("Jul 2025")}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronLeft className="h-3 w-3" />
          </button>
          <button
            onClick={() => setCurrentDateLabel("Aug 2025")}
            className="px-1.5 py-0.5 text-[11px] font-medium rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDateLabel("Sep 2025")}
            className="flex h-6 w-6 items-center justify-center rounded hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-[12px] font-bold text-white cursor-pointer hover:opacity-90">
          DX
        </div>
      </div>
    </header>
  );
}
