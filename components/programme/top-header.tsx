"use client";

import React, { useState } from "react";
import {
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Building2,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";

export function TopHeader() {
  const { state, setSearch } = useProgramme();
  const [searchValue, setSearchValue] = useState(state.filters.search || "");
  const [currentDateLabel, setCurrentDateLabel] = useState("Aug 2025");

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    setSearch(e.target.value);
  };

  return (
    <header className="flex h-14 w-full shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      {/* Left: Project Selector */}
      <div className="flex items-center gap-3">
        <button className="flex items-center gap-2.5 rounded-lg py-1 px-1.5 hover:bg-slate-50 transition-colors text-left group">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 border border-slate-200 overflow-hidden text-slate-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-[13.5px] font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
              Ormiston Rise
              <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600" />
            </div>
            <div className="text-[11px] text-slate-400 leading-tight">
              Building 2 & Unit 80
            </div>
          </div>
        </button>
      </div>

      {/* Center: Global Search */}
      <div className="relative w-full max-w-md mx-6">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
          <Search className="h-4 w-4 text-slate-400" />
        </div>
        <input
          type="text"
          value={searchValue}
          onChange={handleSearchChange}
          placeholder="Search tasks, WBS, or people..."
          className="w-full h-9 rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-14 text-[13px] text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2.5">
          <kbd className="inline-flex items-center rounded border border-slate-200 bg-white px-1.5 text-[10px] font-medium text-slate-400">
            ⌘ K
          </kbd>
        </div>
      </div>

      {/* Right: Date Navigation + Notifications + Avatar */}
      <div className="flex items-center gap-3">
        {/* Date Selector */}
        <div className="flex h-9 items-center gap-1 text-[13px] font-medium text-slate-700 bg-slate-50 border border-slate-200 rounded-lg p-0.5">
          <span className="px-2.5 text-[12.5px] font-semibold text-slate-700">
            {currentDateLabel}
          </span>
          <button
            onClick={() => setCurrentDateLabel("Jul 2025")}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
            title="Previous period"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setCurrentDateLabel("Aug 2025")}
            className="px-2 py-1 text-[12px] font-medium rounded hover:bg-white text-slate-600 hover:text-slate-900 transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setCurrentDateLabel("Sep 2025")}
            className="flex h-7 w-7 items-center justify-center rounded hover:bg-white text-slate-500 hover:text-slate-800 transition-colors"
            title="Next period"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Notifications */}
        <button className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
        </button>

        {/* Avatar */}
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-[13px] font-semibold text-blue-700 cursor-pointer hover:opacity-90">
          D
        </div>
      </div>
    </header>
  );
}
