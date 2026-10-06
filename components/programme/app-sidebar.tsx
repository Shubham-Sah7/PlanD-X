"use client";

import React from "react";
import {
  LayoutDashboard,
  BarChart2,
  Calendar,
  CheckSquare,
  Flag,
  Clock,
  AlertCircle,
  Layers,
  FileText,
  ExternalLink,
  ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useProgramme } from "@/lib/programme-context";

interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  viewTarget?: "gantt" | "calendar" | "list";
}

const PRIMARY_NAV: NavItem[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "programme", label: "Programme", icon: BarChart2, viewTarget: "gantt" },
  { id: "calendar", label: "Calendar", icon: Calendar, viewTarget: "calendar" },
  { id: "tasks", label: "Tasks", icon: CheckSquare, viewTarget: "list" },
];

const PLANNING_NAV: NavItem[] = [
  { id: "milestones", label: "Milestones", icon: Flag },
];

const CONTROL_NAV: NavItem[] = [
  { id: "updates", label: "Updates", icon: Clock },
  { id: "issues", label: "Issues", icon: AlertCircle },
  { id: "rfi", label: "RFI", icon: FileText },
  { id: "variations", label: "Variations", icon: Layers },
  { id: "versions", label: "Versions", icon: Layers },
];

const REPORTING_NAV: NavItem[] = [
  { id: "reports", label: "Reports", icon: FileText },
  { id: "client-view", label: "Client View", icon: ExternalLink },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setActiveView } = useProgramme();

  const handleNavClick = (item: NavItem) => {
    if (item.id === "programme") {
      if (pathname === "/programme/3d") {
        router.push("/programme");
      } else {
        if (item.viewTarget) setActiveView(item.viewTarget);
      }
    } else if (item.viewTarget) {
      if (pathname.startsWith("/programme/3d")) {
        router.push("/programme");
      }
      setActiveView(item.viewTarget);
    }
  };

  return (
    <aside className="flex h-screen w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white select-none">
      {/* Brand Header */}
      <div className="flex h-14 items-center gap-3 px-5 border-b border-slate-200/80">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs">
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1.5" />
            <rect x="14" y="3" width="7" height="7" rx="1.5" />
            <rect x="3" y="14" width="7" height="7" rx="1.5" />
            <path d="M14 17.5h7" />
          </svg>
        </div>
        <span className="text-[16px] font-bold tracking-tight text-slate-900">
          PlanD-X
        </span>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* PRIMARY */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            PRIMARY
          </div>
          <nav className="space-y-0.5">
            {PRIMARY_NAV.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === "programme" && pathname.startsWith("/programme");
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item)}
                  className={`group relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all ${
                    isActive
                      ? "bg-blue-50 text-blue-600 font-semibold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-blue-600" />
                  )}
                  <Icon
                    className={`h-[17px] w-[17px] shrink-0 transition-colors ${
                      isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600"
                    }`}
                  />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* PLANNING */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            PLANNING
          </div>
          <nav className="space-y-0.5">
            {PLANNING_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Icon className="h-[17px] w-[17px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* CONTROL */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            CONTROL
          </div>
          <nav className="space-y-0.5">
            {CONTROL_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Icon className="h-[17px] w-[17px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* REPORTING */}
        <div>
          <div className="px-3 mb-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            REPORTING
          </div>
          <nav className="space-y-0.5">
            {REPORTING_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
                >
                  <Icon className="h-[17px] w-[17px] shrink-0 text-slate-400 group-hover:text-slate-600" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="border-t border-slate-200 p-2.5">
        <div className="flex items-center justify-between rounded-lg p-1.5 hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
              N
            </div>
            <div className="text-left">
              <div className="text-[12px] font-semibold leading-tight text-slate-800">
                Demo User
              </div>
              <div className="text-[10px] text-slate-400 leading-tight">
                demo@pland-x.com
              </div>
            </div>
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </div>
    </aside>
  );
}
