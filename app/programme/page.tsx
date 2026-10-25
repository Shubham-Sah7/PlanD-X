"use client";

import { useProgramme } from "@/lib/programme-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { AppSidebar } from "@/components/programme/app-sidebar";
import { TopHeader } from "@/components/programme/top-header";
import { ProgrammeHeader } from "@/components/programme/programme-header";
import { SummaryCards } from "@/components/programme/summary-cards";
import { ProgrammeToolbar } from "@/components/programme/programme-toolbar";
import { GanttView } from "@/components/programme/gantt/gantt-view";
import { LookaheadView } from "@/components/programme/lookahead/lookahead-view";
import { CalendarView } from "@/components/programme/calendar/calendar-view";
import { ListView } from "@/components/programme/list/list-view";
import { NetworkView } from "@/components/programme/network/network-view";
import { TaskDrawer } from "@/components/programme/task-drawer";
import { MobileProgramme } from "@/components/programme/mobile/mobile-programme";
import { ProjectCalendarModal } from "@/components/programme/calendar/project-calendar-modal";
import { ProgrammeReportView } from "@/components/programme/reporting/programme-report-view";
import { ExportModal } from "@/components/programme/reporting/export-modal";
import { MspImportModal } from "@/components/programme/msp-import-modal";
import { BaselineRevisionsModal } from "@/components/programme/baseline/baseline-revisions-modal";
import { ScheduleHealthModal } from "@/components/programme/health/schedule-health-modal";
import { ResourceLevelingModal } from "@/components/programme/resources/resource-leveling-modal";
import { ConfirmationModal } from "@/components/programme/confirmation-modal";
import { AddTaskModal } from "@/components/programme/add-task-modal";
import { BulkEditModal } from "@/components/programme/bulk-edit-modal";
import { RevisionComparisonModal } from "@/components/programme/reconciliation/revision-comparison-modal";
import { ConcurrencyConflictModal } from "@/components/programme/persistence/concurrency-conflict-modal";
import { RollbackModal } from "@/components/programme/persistence/rollback-modal";
import { ProjectManagementModal } from "@/components/programme/project/project-management-modal";
import { ScenarioSandboxBanner } from "@/components/programme/scenarios/scenario-sandbox-banner";
import { CreateScenarioModal } from "@/components/programme/scenarios/create-scenario-modal";
import { WBSLibraryModal } from "@/components/programme/templates/wbs-library-modal";
import { MobileSiteCompanionModal } from "@/components/programme/mobile/mobile-site-companion-modal";
import { ProgrammePublishingModal } from "@/components/programme/publishing/programme-publishing-modal";
import { PortfolioView } from "@/components/programme/portfolio/portfolio-view";
import Model3DPage from "./3d/page";

export default function ProgrammePage() {
  const {
    state,
    isConflictModalOpen,
    conflictDetails,
    closeConflictModal,
    resolveConflict,
    isRollbackModalOpen,
    closeRollbackModal,
    programmeVersion,
    onRollbackSuccess,
  } = useProgramme();
  const isMobile = useIsMobile();

  // Mobile experience
  if (isMobile) {
    return <MobileProgramme />;
  }

  // 3D Model View (PlanD-X Programme 3D interface matching reference screenshot)
  if (state.activeView === "3d") {
    return (
      <>
        <Model3DPage />
        <BaselineRevisionsModal />
      </>
    );
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
          {/* What-If Alternative Schedule Scenario Sandbox Banner */}
          <ScenarioSandboxBanner />

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
                {state.activeView === "lookahead" && <LookaheadView />}
                {state.activeView === "calendar" && <CalendarView />}
                {state.activeView === "list" && <ListView />}
                {state.activeView === "network" && <NetworkView />}
                {state.activeView === "reports" && <ProgrammeReportView />}
                {state.activeView === "portfolio" && <PortfolioView />}
              </div>

              {/* Right Task Detail Drawer (Matching Image 4) */}
              <TaskDrawer />
            </div>
          </div>
        </main>
      </div>

      {/* Project Working Calendar & Shift Configuration Modal */}
      <ProjectCalendarModal />

      {/* Programme Export & Report Dialog */}
      <ExportModal />

      {/* Microsoft Project Schedule Import Dialog */}
      <MspImportModal />

      {/* Baseline Integrity, Revisions & Change History Dialog */}
      <BaselineRevisionsModal />

      {/* DCMA 14-Point Schedule Quality & Risk Analysis Dialog */}
      <ScheduleHealthModal />

      {/* Resource Allocation & Non-Destructive Levelling Dialog */}
      <ResourceLevelingModal />

      {/* Task Creation & Structural Modification Modals */}
      <AddTaskModal />
      <BulkEditModal />
      <ConfirmationModal />

      {/* Programme Revision Comparison & Reconciliation Modal */}
      <RevisionComparisonModal />

      {/* Concurrency Conflict Resolution Modal */}
      <ConcurrencyConflictModal
        isOpen={isConflictModalOpen}
        conflictDetails={conflictDetails}
        onClose={closeConflictModal}
        onReload={() => resolveConflict("reload")}
        onForceOverwrite={() => resolveConflict("overwrite")}
      />

      {/* Programme Revision History & Rollback Modal */}
      <RollbackModal
        isOpen={isRollbackModalOpen}
        onClose={closeRollbackModal}
        currentVersion={programmeVersion}
        onRollbackSuccess={onRollbackSuccess}
      />

      {/* Multi-Project & Programme Workspace Modal */}
      <ProjectManagementModal />

      {/* WBS Work Package Snippet Library Modal */}
      <WBSLibraryModal />

      {/* What-If Schedule Scenario Creation Modal */}
      <CreateScenarioModal />

      {/* Mobile Site Companion & Offline Sync Modal */}
      <MobileSiteCompanionModal />

      {/* Controlled Programme Publishing & Transmittal Modal */}
      <ProgrammePublishingModal />
    </div>
  );
}
