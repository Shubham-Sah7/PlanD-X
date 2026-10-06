"use client";

import { useProgramme } from "@/lib/programme-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/programme/app-sidebar";
import { TopHeader } from "@/components/programme/top-header";
import { ProgrammeHeader } from "@/components/programme/programme-header";
import { SummaryCards } from "@/components/programme/summary-cards";
import { ProgrammeToolbar } from "@/components/programme/programme-toolbar";
import { GanttView } from "@/components/programme/gantt/gantt-view";
import { CalendarView } from "@/components/programme/calendar/calendar-view";
import { ListView } from "@/components/programme/list/list-view";
import { NetworkView } from "@/components/programme/network/network-view";
import { TaskDrawer } from "@/components/programme/task-drawer";
import { MobileProgramme } from "@/components/programme/mobile/mobile-programme";
import Model3DPage from "./3d/page";

export default function ProgrammePage() {
  const { state } = useProgramme();
  const isMobile = useIsMobile();

  // Mobile experience
  if (isMobile) {
    return <MobileProgramme />;
  }

  // 3D Model View (PlanD-X Programme 3D interface matching reference screenshot)
  if (state.activeView === "3d") {
    return <Model3DPage />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#f8fafc] text-slate-900 font-sans antialiased">
      {/* 1. Left Sidebar */}
      <AppSidebar />

      {/* 2. Main Content Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        {/* Top Header */}
        <TopHeader />

        {/* Main Programme Area */}
        <main className="flex flex-1 flex-col overflow-y-auto px-5 py-3 min-w-0">
          {/* Top Section: Programme Header (Hero with 3D BIM model) */}
          <ProgrammeHeader />

          {/* Summary KPI Cards (for Network, List, Calendar, or filter indicators) */}
          <SummaryCards />

          {/* Workspace Area: Toolbar + (Active View & Task Drawer side-by-side) */}
          <div className="flex flex-1 flex-col min-h-0 mt-1">
            {/* View Switcher & Timeline Toolbar */}
            <ProgrammeToolbar />

            {/* Active Programme View + Task Drawer */}
            <div className="flex flex-1 gap-4 items-stretch min-h-[520px] pb-3">
              <div className="flex-1 min-w-0 overflow-hidden">
                {state.activeView === "gantt" && <GanttView />}
                {state.activeView === "calendar" && <CalendarView />}
                {state.activeView === "list" && <ListView />}
                {state.activeView === "network" && <NetworkView />}
              </div>

              {/* Right Task Detail Drawer (Matching Image 4) */}
              <TaskDrawer />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
