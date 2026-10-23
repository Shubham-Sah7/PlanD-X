"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import {
  Check,
  ChevronDown,
  Search,
  UserX,
  Building2,
  Users,
  HardHat,
  X,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  AssignableResource,
  getSubcontractors,
  getTeamMembers,
  getAllAssignableResources,
  findResourceByName,
  getResourceColor,
} from "@/lib/programme-resources";

interface ResourceAssignmentDropdownProps {
  taskId: string;
  taskName?: string;
  currentAssignee?: string | null;
  currentInitials?: string | null;
  currentSubcontractor?: string | null;
  compact?: boolean;
  disabled?: boolean;
  className?: string;
}

export function ResourceAssignmentDropdown({
  taskId,
  taskName,
  currentAssignee,
  currentInitials,
  currentSubcontractor,
  compact = false,
  disabled = false,
  className = "",
}: ResourceAssignmentDropdownProps) {
  const { assignTaskResource } = useProgramme();
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"all" | "vendors" | "team">("all");
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Active resource details
  const activeResourceName = currentSubcontractor || currentAssignee;
  const matchedResource = useMemo(
    () => findResourceByName(activeResourceName),
    [activeResourceName],
  );

  const displayInitials =
    currentInitials ||
    matchedResource?.initials ||
    (activeResourceName
      ? activeResourceName
          .split(" ")
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase()
      : "—");

  const avatarColor = matchedResource?.color || getResourceColor(displayInitials);

  // Close dropdown on outside click or escape
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setSearchQuery("");
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Focus search input on open
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const subcontractors = useMemo(() => getSubcontractors(), []);
  const teamMembers = useMemo(() => getTeamMembers(), []);

  // Filtered lists based on search and active tab
  const filteredSubcontractors = useMemo(() => {
    if (activeTab === "team") return [];
    if (!searchQuery.trim()) return subcontractors;
    const q = searchQuery.toLowerCase();
    return subcontractors.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.initials.toLowerCase().includes(q) ||
        (s.trades && s.trades.toLowerCase().includes(q)),
    );
  }, [subcontractors, searchQuery, activeTab]);

  const filteredTeamMembers = useMemo(() => {
    if (activeTab === "vendors") return [];
    if (!searchQuery.trim()) return teamMembers;
    const q = searchQuery.toLowerCase();
    return teamMembers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.initials.toLowerCase().includes(q) ||
        (m.trades && m.trades.toLowerCase().includes(q)),
    );
  }, [teamMembers, searchQuery, activeTab]);

  const totalResults =
    filteredSubcontractors.length + filteredTeamMembers.length;

  const handleSelect = (resource: AssignableResource | null) => {
    assignTaskResource(taskId, resource);
    setIsOpen(false);
    setSearchQuery("");
  };

  return (
    <div
      ref={dropdownRef}
      className={`relative inline-block text-left ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Trigger Button */}
      {compact ? (
        /* Compact trigger inside Gantt and List Table rows */
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          className={`group flex h-7 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium transition-all max-w-[140px] truncate ${
            activeResourceName
              ? "bg-slate-50/80 hover:bg-slate-100/90 text-slate-800 border border-slate-200/80"
              : "border border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/40"
          }`}
          title={
            activeResourceName
              ? `Assigned: ${activeResourceName}${
                  matchedResource?.trades ? ` (${matchedResource.trades})` : ""
                } — Click to reassign`
              : "Click to assign Subcontractor or Resource"
          }
        >
          {activeResourceName ? (
            <>
              <div
                style={{ backgroundColor: avatarColor }}
                className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-xs"
              >
                {displayInitials}
              </div>
              <span className="truncate text-left font-medium text-[11px] text-slate-700">
                {activeResourceName}
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-400 opacity-60 group-hover:opacity-100 ml-auto" />
            </>
          ) : (
            <>
              <HardHat className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-blue-500" />
              <span className="truncate text-left text-[11px] italic">
                + Assign
              </span>
              <ChevronDown className="h-3 w-3 shrink-0 text-slate-300 group-hover:text-blue-400 ml-auto" />
            </>
          )}
        </button>
      ) : (
        /* Standard full-width trigger for Task Drawer and Modals */
        <button
          type="button"
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (!disabled) setIsOpen((prev) => !prev);
          }}
          className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all shadow-2xs ${
            isOpen
              ? "border-blue-500 ring-2 ring-blue-500/10 bg-white"
              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            {activeResourceName ? (
              <>
                <div
                  style={{ backgroundColor: avatarColor }}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white shadow-xs"
                >
                  {displayInitials}
                </div>
                <div className="flex flex-col text-left truncate">
                  <span className="font-semibold text-slate-800 text-[12px] truncate">
                    {activeResourceName}
                  </span>
                  {matchedResource?.trades && (
                    <span className="text-[10px] text-slate-400 truncate">
                      {matchedResource.trades}
                    </span>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-slate-400 italic">
                <div className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-[11px]">
                  <UserX className="h-3 w-3 text-slate-400" />
                </div>
                <span className="text-[12px]">Unassigned (Click to assign)</span>
              </div>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
              isOpen ? "rotate-180 text-blue-600" : ""
            }`}
          />
        </button>
      )}

      {/* Dropdown Menu Popover */}
      {isOpen && (
        <div
          className={`absolute z-50 mt-1.5 w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 duration-100 ${
            compact ? "left-0" : "right-0"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header & Quick Search */}
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search subcontractor, trade or team..."
              className="w-full rounded-md border border-slate-200 bg-slate-50/70 pl-8 pr-7 py-1.5 text-[11.5px] placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 mb-2 border-b border-slate-100 pb-1.5 px-0.5">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={`rounded px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                activeTab === "all"
                  ? "bg-slate-200 text-slate-800 font-semibold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              All ({subcontractors.length + teamMembers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("vendors")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                activeTab === "vendors"
                  ? "bg-amber-100 text-amber-900 font-semibold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Building2 className="h-3 w-3" />
              <span>Subcontractors ({subcontractors.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("team")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10.5px] font-medium transition-colors ${
                activeTab === "team"
                  ? "bg-blue-100 text-blue-900 font-semibold"
                  : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
              }`}
            >
              <Users className="h-3 w-3" />
              <span>Team ({teamMembers.length})</span>
            </button>
          </div>

          {/* Scrollable Items Container */}
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1 [scrollbar-width:thin]">
            {/* Option to Clear / Unassign */}
            {activeResourceName && (
              <button
                type="button"
                onClick={() => handleSelect(null)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <UserX className="h-3 w-3" />
                </div>
                <span className="font-medium">Unassign (Clear)</span>
              </button>
            )}

            {/* Subcontractors Section */}
            {filteredSubcontractors.length > 0 && (
              <div>
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Building2 className="h-3 w-3 text-amber-600" />
                  <span>Subcontractors & Trades</span>
                </div>
                <div className="space-y-0.5">
                  {filteredSubcontractors.map((sub) => {
                    const isSelected =
                      activeResourceName?.toLowerCase() ===
                        sub.name.toLowerCase() ||
                      activeResourceName?.toLowerCase() ===
                        sub.initials.toLowerCase();

                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelect(sub)}
                        className={`group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-900 font-semibold"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            style={{ backgroundColor: sub.color }}
                            className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-2xs"
                          >
                            {sub.initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-[12px] leading-tight text-slate-900">
                              {sub.name}
                            </span>
                            {sub.trades && (
                              <span className="truncate text-[10px] text-slate-400 leading-tight">
                                {sub.trades}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Project Team Section */}
            {filteredTeamMembers.length > 0 && (
              <div>
                <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <Users className="h-3 w-3 text-blue-600" />
                  <span>Project & Site Team</span>
                </div>
                <div className="space-y-0.5">
                  {filteredTeamMembers.map((member) => {
                    const isSelected =
                      activeResourceName?.toLowerCase() ===
                        member.name.toLowerCase() ||
                      activeResourceName?.toLowerCase() ===
                        member.initials.toLowerCase();

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelect(member)}
                        className={`group flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[11.5px] transition-colors ${
                          isSelected
                            ? "bg-blue-50 text-blue-900 font-semibold"
                            : "hover:bg-slate-50 text-slate-800"
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div
                            style={{ backgroundColor: member.color }}
                            className="flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white shadow-2xs"
                          >
                            {member.initials}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="truncate font-medium text-[12px] leading-tight text-slate-900">
                              {member.name}
                            </span>
                            {member.trades && (
                              <span className="truncate text-[10px] text-slate-400 leading-tight">
                                {member.trades}
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-blue-600 ml-2" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {totalResults === 0 && (
              <div className="py-6 text-center text-slate-400">
                <Search className="mx-auto h-5 w-5 opacity-40 mb-1" />
                <p className="text-[11.5px]">No subcontractors or team match</p>
                <p className="text-[10px] text-slate-400">
                  Try searching another name or trade
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
