// Programme Reporting Engine & Export Utilities
// ===============================================

import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import pptxgen from "pptxgenjs";
import type {
  ProgrammeTask,
  ReportPeriod,
  LookaheadPeriod,
  LookaheadTaskItem,
} from "./programme-types";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  parseIsoDate,
  formatDateIso,
  countWorkingDays,
  calculateScheduleVariance,
  calculateTaskDelayImpact,
  calculateDateVarianceWorkingDays,
  getCriticalPathActivities,
  getLookaheadDateRange,
  getLookaheadTasks,
  getLookaheadSummaryStats,
  type LookaheadDateRange,
  type LookaheadSummaryStats,
} from "./programme-calendar";

export interface TradeSummary {
  trade: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  avgProgress: number;
}

export interface DelayedTaskSummary {
  task: ProgrammeTask;
  baselineFinish: string;
  currentFinish: string;
  finishVariance: number; // working days
  isCritical: boolean;
  impactType: "on-track" | "consuming-float" | "critical-delay" | "no-baseline";
}

export interface ProgrammeReportData {
  // 1. Metadata
  projectName: string;
  projectLocation: string;
  reportingDate: string;
  reportingPeriod: ReportPeriod;
  periodLabel: string;
  periodStartDate: string;
  periodEndDate: string;
  calendarName: string;
  calendarWorkingDaysPerWeek: number;

  // 2. Schedule & Progress Performance
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  notStartedTasks: number;
  blockedTasks: number;
  overdueTasks: number;
  criticalTasksCount: number;
  overallProgress: number; // Duration-weighted %

  plannedStartDate: string;
  projectedCompletionDate: string;
  baselineCompletionDate: string | null;
  projectVarianceWorkingDays: number; // Working days against baseline

  // 3. Baseline Variance Health
  hasBaselineData: boolean;
  tasksWithBaseline: number;
  tasksWithoutBaseline: number;
  tasksDelayed: number;
  tasksAhead: number;
  tasksOnTrack: number;
  topDelayedTasks: DelayedTaskSummary[];

  // 4. Critical Path Health
  criticalPathSpanWorkingDays: number;
  criticalTasks: ProgrammeTask[];

  // 5. Lookahead Horizon (2-week or 4-week upcoming activities)
  lookaheadPeriod: LookaheadPeriod;
  lookaheadRange: LookaheadDateRange;
  lookaheadStats: LookaheadSummaryStats;
  lookaheadActivities: LookaheadTaskItem[];

  // 6. Blocked & Overdue Action Items
  actionItems: {
    task: ProgrammeTask;
    issueType: "blocked" | "overdue" | "both";
    reason: string;
    plannedFinish: string;
    daysOverdue: number;
  }[];

  // 7. Trade Breakdown
  tradeBreakdown: TradeSummary[];
}

export interface GenerateReportOptions {
  projectName?: string;
  projectLocation?: string;
  reportingDate?: string; // Default: anchor date 2025-10-15 or today
  period?: ReportPeriod; // Default: 'lifecycle'
  lookaheadHorizon?: LookaheadPeriod; // Default: '2-weeks'
}

/**
 * Compiles a comprehensive, single-source Programme Report from active programme tasks and calendar.
 */
export function generateProgrammeReportData(
  allTasks: ProgrammeTask[],
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR,
  options: GenerateReportOptions = {}
): ProgrammeReportData {
  const projectName = options.projectName || "Ormiston Rise — Building 2 & Unit 80";
  const projectLocation = options.projectLocation || "Siliguri, WB";
  const reportingDate = options.reportingDate || "2025-10-15";
  const reportingPeriod = options.period || "lifecycle";
  const lookaheadHorizon =
    options.lookaheadHorizon ||
    (options.period === "4-weeks" ? "4-weeks" : "2-weeks");

  // Actionable leaf activities (exclude high-level programme container)
  const actionableTasks = allTasks.filter(
    (t) => t.level !== "programme" && Boolean(t.startDate) && Boolean(t.endDate)
  );

  // 1. Overall Schedule Boundary Dates
  let plannedStartDate = "2025-09-01";
  let projectedCompletionDate = "2026-11-15";

  if (actionableTasks.length > 0) {
    const startTimestamps = actionableTasks.map((t) => parseIsoDate(t.startDate).getTime());
    const endTimestamps = actionableTasks.map((t) => parseIsoDate(t.endDate).getTime());
    plannedStartDate = formatDateIso(new Date(Math.min(...startTimestamps)));
    projectedCompletionDate = formatDateIso(new Date(Math.max(...endTimestamps)));
  }

  // 2. Baseline Completion Date & Net Project Slip
  let baselineCompletionDate: string | null = null;
  const tasksWithBaselineList = actionableTasks.filter(
    (t) => Boolean(t.baseline0Start) && Boolean(t.baseline0Finish)
  );

  if (tasksWithBaselineList.length > 0) {
    const baselineEndTimestamps = tasksWithBaselineList.map((t) =>
      parseIsoDate(t.baseline0Finish!).getTime()
    );
    baselineCompletionDate = formatDateIso(new Date(Math.max(...baselineEndTimestamps)));
  }

  let projectVarianceWorkingDays = 0;
  if (baselineCompletionDate) {
    projectVarianceWorkingDays = calculateDateVarianceWorkingDays(
      baselineCompletionDate,
      projectedCompletionDate,
      calendar
    );
  }

  // 3. Counts & Duration-Weighted Overall Progress
  let completedCount = 0;
  let inProgressCount = 0;
  let notStartedCount = 0;
  let blockedCount = 0;
  let overdueCount = 0;
  let totalWorkDays = 0;
  let completedWorkDays = 0;

  for (const t of actionableTasks) {
    const duration = Math.max(1, t.duration || 1);
    totalWorkDays += duration;
    completedWorkDays += duration * (Math.min(100, Math.max(0, t.progress || 0)) / 100);

    if (t.status === "complete" || t.progress >= 100) {
      completedCount++;
    } else if (t.status === "blocked" || t.isBlocked) {
      blockedCount++;
    } else if (t.status === "in-progress" || (t.progress > 0 && t.progress < 100)) {
      inProgressCount++;
    } else {
      notStartedCount++;
    }

    const isTaskOverdue =
      t.isOverdue ||
      (t.endDate < reportingDate && t.status !== "complete" && t.progress < 100);
    if (isTaskOverdue) {
      overdueCount++;
    }
  }

  const overallProgress =
    totalWorkDays > 0 ? Math.round((completedWorkDays / totalWorkDays) * 100) : 0;

  // 4. Baseline Variance Analysis
  let tasksDelayed = 0;
  let tasksAhead = 0;
  let tasksOnTrack = 0;
  const delayedSummaries: DelayedTaskSummary[] = [];

  for (const t of actionableTasks) {
    const variance = calculateScheduleVariance(t, calendar);
    if (!variance.hasBaseline) continue;

    if (variance.finishVariance > 0) {
      tasksDelayed++;
      const impact = calculateTaskDelayImpact(t, allTasks, calendar);
      delayedSummaries.push({
        task: t,
        baselineFinish: t.baseline0Finish!,
        currentFinish: t.endDate,
        finishVariance: variance.finishVariance,
        isCritical: t.isCritical || (typeof t.float === "number" && t.float <= 0),
        impactType: impact.impactType,
      });
    } else if (variance.finishVariance < 0) {
      tasksAhead++;
    } else {
      tasksOnTrack++;
    }
  }

  // Sort top delayed tasks by finish variance descending, critical tasks first
  delayedSummaries.sort((a, b) => {
    if (a.isCritical !== b.isCritical) return a.isCritical ? -1 : 1;
    return b.finishVariance - a.finishVariance;
  });

  // 5. Critical Path
  const criticalTasks = getCriticalPathActivities(actionableTasks);
  const criticalPathSpanWorkingDays = countWorkingDays(
    plannedStartDate,
    projectedCompletionDate,
    calendar
  );

  // 6. Lookahead Horizon
  const lookaheadRange = getLookaheadDateRange(reportingDate, lookaheadHorizon, calendar);
  const lookaheadActivities = getLookaheadTasks(allTasks, lookaheadRange, calendar, reportingDate);
  const lookaheadStats = getLookaheadSummaryStats(lookaheadActivities);

  // 7. Action Items (Blocked & Overdue)
  const actionItems: ProgrammeReportData["actionItems"] = [];
  for (const t of actionableTasks) {
    const isTaskBlocked = t.status === "blocked" || Boolean(t.isBlocked) || Boolean(t.blockedBy);
    const isTaskOverdue =
      t.isOverdue ||
      (t.endDate < reportingDate && t.status !== "complete" && t.progress < 100);

    if (isTaskBlocked || isTaskOverdue) {
      const daysOverdue = isTaskOverdue
        ? Math.abs(calculateDateVarianceWorkingDays(reportingDate, t.endDate, calendar))
        : 0;

      let issueType: "blocked" | "overdue" | "both" = "blocked";
      if (isTaskBlocked && isTaskOverdue) issueType = "both";
      else if (isTaskOverdue) issueType = "overdue";

      let reason = t.blockedBy || "";
      if (!reason && isTaskOverdue) {
        reason = `Scheduled to finish on ${t.endDate} but remains at ${t.progress}% progress.`;
      }

      actionItems.push({
        task: t,
        issueType,
        reason: reason || "Constraint or slip identified.",
        plannedFinish: t.endDate,
        daysOverdue,
      });
    }
  }

  // 8. Trade Breakdown
  const tradeMap = new Map<string, TradeSummary>();
  for (const t of actionableTasks) {
    const tradeName = t.trade || "General Works";
    let summary = tradeMap.get(tradeName);
    if (!summary) {
      summary = {
        trade: tradeName,
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        blockedTasks: 0,
        overdueTasks: 0,
        avgProgress: 0,
      };
      tradeMap.set(tradeName, summary);
    }

    summary.totalTasks++;
    if (t.status === "complete" || t.progress >= 100) summary.completedTasks++;
    else if (t.status === "blocked" || t.isBlocked) summary.blockedTasks++;
    else if (t.status === "in-progress" || t.progress > 0) summary.inProgressTasks++;

    if (t.isOverdue || (t.endDate < reportingDate && t.status !== "complete" && t.progress < 100)) {
      summary.overdueTasks++;
    }
  }

  const tradeBreakdown = Array.from(tradeMap.values()).map((s) => {
    const tradeTasks = actionableTasks.filter((t) => (t.trade || "General Works") === s.trade);
    const totDur = tradeTasks.reduce((sum, t) => sum + Math.max(1, t.duration || 1), 0);
    const compDur = tradeTasks.reduce(
      (sum, t) => sum + Math.max(1, t.duration || 1) * ((t.progress || 0) / 100),
      0
    );
    s.avgProgress = totDur > 0 ? Math.round((compDur / totDur) * 100) : 0;
    return s;
  });
  tradeBreakdown.sort((a, b) => b.totalTasks - a.totalTasks);

  // Period label resolution
  let periodLabel = "Entire Project Lifecycle";
  let periodStartDate = plannedStartDate;
  let periodEndDate = projectedCompletionDate;

  if (reportingPeriod === "month") {
    periodLabel = "Current Operational Month (October 2025)";
    periodStartDate = "2025-10-01";
    periodEndDate = "2025-10-31";
  } else if (reportingPeriod === "2-weeks") {
    periodLabel = `2-Week Horizon (${lookaheadRange.displayRange})`;
    periodStartDate = lookaheadRange.startDate;
    periodEndDate = lookaheadRange.endDate;
  } else if (reportingPeriod === "4-weeks") {
    const range4W = getLookaheadDateRange(reportingDate, "4-weeks", calendar);
    periodLabel = `4-Week Horizon (${range4W.displayRange})`;
    periodStartDate = range4W.startDate;
    periodEndDate = range4W.endDate;
  }

  return {
    projectName,
    projectLocation,
    reportingDate,
    reportingPeriod,
    periodLabel,
    periodStartDate,
    periodEndDate,
    calendarName: calendar.name,
    calendarWorkingDaysPerWeek: calendar.workingDays.length,

    totalTasks: actionableTasks.length,
    completedTasks: completedCount,
    inProgressTasks: inProgressCount,
    notStartedTasks: notStartedCount,
    blockedTasks: blockedCount,
    overdueTasks: overdueCount,
    criticalTasksCount: criticalTasks.length,
    overallProgress,

    plannedStartDate,
    projectedCompletionDate,
    baselineCompletionDate,
    projectVarianceWorkingDays,

    hasBaselineData: tasksWithBaselineList.length > 0,
    tasksWithBaseline: tasksWithBaselineList.length,
    tasksWithoutBaseline: actionableTasks.length - tasksWithBaselineList.length,
    tasksDelayed,
    tasksAhead,
    tasksOnTrack,
    topDelayedTasks: delayedSummaries.slice(0, 10),

    criticalPathSpanWorkingDays,
    criticalTasks,

    lookaheadPeriod: lookaheadHorizon,
    lookaheadRange,
    lookaheadStats,
    lookaheadActivities,

    actionItems,
    tradeBreakdown,
  };
}

/**
 * Escapes fields for standard RFC-4180 CSV export.
 */
function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Converts Programme Report Data into a clean, human-readable CSV document.
 */
export function exportProgrammeToCsv(report: ProgrammeReportData): string {
  const lines: string[] = [];

  // Header metadata block
  lines.push(`PlanD-X Programme Performance Report`);
  lines.push(`Project,${escapeCsv(report.projectName)}`);
  lines.push(`Location,${escapeCsv(report.projectLocation)}`);
  lines.push(`Reporting Date,${escapeCsv(report.reportingDate)}`);
  lines.push(`Reporting Period,${escapeCsv(report.periodLabel)} (${report.periodStartDate} to ${report.periodEndDate})`);
  lines.push(`Working Calendar,${escapeCsv(report.calendarName)} (${report.calendarWorkingDaysPerWeek}d/week)`);
  lines.push("");

  // Executive KPI summary
  lines.push(`1. EXECUTIVE SCHEDULE PERFORMANCE`);
  lines.push(`Metric,Value,Benchmark / Context`);
  lines.push(`Overall Progress,${report.overallProgress}%,Duration-weighted`);
  lines.push(`Total Activities,${report.totalTasks},Actionable WBS items`);
  lines.push(`Completed Activities,${report.completedTasks},${Math.round((report.completedTasks / report.totalTasks) * 100)}% of total`);
  lines.push(`In Progress Activities,${report.inProgressTasks},Active on site`);
  lines.push(`Not Started Activities,${report.notStartedTasks},Upcoming scheduled`);
  lines.push(`Blocked Activities,${report.blockedTasks},Active site constraints`);
  lines.push(`Overdue Activities,${report.overdueTasks},Action required`);
  lines.push(`Critical Path Activities,${report.criticalTasksCount},${Math.round((report.criticalTasksCount / report.totalTasks) * 100)}% of schedule`);
  lines.push(`Project Start Date,${report.plannedStartDate},Earliest activity start`);
  lines.push(`Projected Completion Date,${report.projectedCompletionDate},Latest working forecast finish`);
  lines.push(
    `Baseline 0 Contract Finish,${report.baselineCompletionDate || "N/A (No baseline saved)"},Original target completion`
  );
  lines.push(
    `Net Project Variance,${
      report.projectVarianceWorkingDays === 0
        ? "0 days (On Track)"
        : report.projectVarianceWorkingDays > 0
        ? `+${report.projectVarianceWorkingDays} working days (Delayed)`
        : `${report.projectVarianceWorkingDays} working days (Ahead)`
    },Working days against Baseline 0`
  );
  lines.push("");

  // Baseline Variance Breakdown
  lines.push(`2. BASELINE 0 VARIANCE PERFORMANCE`);
  lines.push(`Category,Count,Percentage`);
  lines.push(`Activities with Saved Baseline,${report.tasksWithBaseline},${Math.round((report.tasksWithBaseline / report.totalTasks) * 100)}%`);
  lines.push(`Activities On Track,${report.tasksOnTrack},${Math.round((report.tasksOnTrack / (report.tasksWithBaseline || 1)) * 100)}% of baselined`);
  lines.push(`Activities Delayed,${report.tasksDelayed},${Math.round((report.tasksDelayed / (report.tasksWithBaseline || 1)) * 100)}% of baselined`);
  lines.push(`Activities Ahead,${report.tasksAhead},${Math.round((report.tasksAhead / (report.tasksWithBaseline || 1)) * 100)}% of baselined`);
  lines.push(`Activities Without Baseline,${report.tasksWithoutBaseline},Scope changes / post-baseline additions`);
  lines.push("");

  if (report.topDelayedTasks.length > 0) {
    lines.push(`TOP SCHEDULE SLIPPAGES (AFFECTING SCHEDULE)`);
    lines.push(`WBS,Task Name,Trade,Baseline Finish,Forecast Finish,Variance (Days),Critical?,Impact`);
    for (const d of report.topDelayedTasks) {
      lines.push(
        [
          escapeCsv(d.task.wbs),
          escapeCsv(d.task.name),
          escapeCsv(d.task.trade || "General"),
          escapeCsv(d.baselineFinish),
          escapeCsv(d.currentFinish),
          escapeCsv(`+${d.finishVariance}d`),
          escapeCsv(d.isCritical ? "YES" : "No"),
          escapeCsv(d.impactType),
        ].join(",")
      );
    }
    lines.push("");
  }

  // Trade Performance Breakdown
  lines.push(`3. TRADE & DISCIPLINE BREAKDOWN`);
  lines.push(`Trade,Total Tasks,Complete,In Progress,Blocked,Overdue,Progress %`);
  for (const tr of report.tradeBreakdown) {
    lines.push(
      [
        escapeCsv(tr.trade),
        escapeCsv(tr.totalTasks),
        escapeCsv(tr.completedTasks),
        escapeCsv(tr.inProgressTasks),
        escapeCsv(tr.blockedTasks),
        escapeCsv(tr.overdueTasks),
        escapeCsv(`${tr.avgProgress}%`),
      ].join(",")
    );
  }
  lines.push("");

  // Lookahead Work Plan
  lines.push(`4. UPCOMING LOOKAHEAD WORK PLAN (${report.lookaheadPeriod.toUpperCase()}: ${report.lookaheadRange.displayRange})`);
  lines.push(`Total in Window: ${report.lookaheadStats.totalCount} | Ready: ${report.lookaheadStats.readyCount} | Dep Risk: ${report.lookaheadStats.dependencyRiskCount} | Blocked: ${report.lookaheadStats.blockedCount} | Overdue: ${report.lookaheadStats.overdueCount}`);
  lines.push(`WBS,Task Name,Readiness,Readiness Diagnostic,Start Date,Finish Date,Duration (d),Progress,Trade,Subcontractor`);
  for (const item of report.lookaheadActivities) {
    lines.push(
      [
        escapeCsv(item.task.wbs),
        escapeCsv(item.task.name),
        escapeCsv(item.readiness.toUpperCase()),
        escapeCsv(item.readinessReason || "Clear to proceed"),
        escapeCsv(item.task.startDate),
        escapeCsv(item.task.endDate),
        escapeCsv(item.task.duration),
        escapeCsv(`${item.task.progress}%`),
        escapeCsv(item.task.trade || "General"),
        escapeCsv(item.task.subcontractor || item.task.assignee || "Unassigned"),
      ].join(",")
    );
  }
  lines.push("");

  // Blockers & Constraints
  lines.push(`5. ACTIVE BLOCKERS & OVERDUE ACTION REGISTER`);
  lines.push(`WBS,Task Name,Type,Slip (Days),Blocker / Cause,Subcontractor / Assignee`);
  for (const act of report.actionItems) {
    lines.push(
      [
        escapeCsv(act.task.wbs),
        escapeCsv(act.task.name),
        escapeCsv(act.issueType.toUpperCase()),
        escapeCsv(act.daysOverdue > 0 ? `${act.daysOverdue}d overdue` : "0d"),
        escapeCsv(act.reason),
        escapeCsv(act.task.subcontractor || act.task.assignee || "Unassigned"),
      ].join(",")
    );
  }

  return lines.join("\r\n");
}

/**
 * Triggers client-side browser download for generated report files.
 */
export function downloadReportFile(
  content: string,
  filename: string,
  mimeType: string = "text/csv;charset=utf-8;"
): void {
  if (typeof window === "undefined") return;
  // Add UTF-8 BOM so Excel opens CSV without character corruption
  const blob = new Blob(["\uFEFF", content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Exports complete Programme Report Data into a multi-sheet Microsoft Excel (.xlsx) workbook.
 */
export function exportProgrammeToXlsx(
  report: ProgrammeReportData,
  tasks: ProgrammeTask[] = []
): Uint8Array {
  const wb = XLSX.utils.book_new();

  // 1. Executive Summary Sheet
  const summaryAoa = [
    ["PlanD-X Programme Performance Report"],
    ["Project Name", report.projectName],
    ["Location", report.projectLocation],
    ["Reporting Date", report.reportingDate],
    ["Reporting Period", `${report.periodLabel} (${report.periodStartDate} to ${report.periodEndDate})`],
    ["Working Calendar", `${report.calendarName} (${report.calendarWorkingDaysPerWeek} days/week)`],
    [],
    ["1. EXECUTIVE SCHEDULE PERFORMANCE"],
    ["Metric", "Value", "Benchmark / Context"],
    ["Overall Progress", `${report.overallProgress}%`, "Duration-weighted"],
    ["Total Activities", report.totalTasks, "Actionable WBS items"],
    ["Completed Activities", report.completedTasks, `${Math.round((report.completedTasks / (report.totalTasks || 1)) * 100)}% of total`],
    ["In Progress Activities", report.inProgressTasks, "Active on site"],
    ["Not Started Activities", report.notStartedTasks, "Upcoming scheduled"],
    ["Blocked Activities", report.blockedTasks, "Active site constraints"],
    ["Overdue Activities", report.overdueTasks, "Action required"],
    ["Critical Path Activities", report.criticalTasksCount, `${Math.round((report.criticalTasksCount / (report.totalTasks || 1)) * 100)}% of schedule`],
    ["Project Start Date", report.plannedStartDate, "Earliest activity start"],
    ["Projected Completion Date", report.projectedCompletionDate, "Latest working forecast finish"],
    ["Baseline 0 Contract Finish", report.baselineCompletionDate || "N/A (No baseline saved)", "Original approved completion"],
    [
      "Net Project Variance",
      report.projectVarianceWorkingDays === 0
        ? "0 days (On Track)"
        : report.projectVarianceWorkingDays > 0
        ? `+${report.projectVarianceWorkingDays} working days (Delayed)`
        : `${report.projectVarianceWorkingDays} working days (Ahead)`,
      "Working days against Baseline 0",
    ],
    [],
    ["2. BASELINE 0 VARIANCE PERFORMANCE"],
    ["Category", "Count", "Percentage"],
    ["Activities with Saved Baseline", report.tasksWithBaseline, `${Math.round((report.tasksWithBaseline / (report.totalTasks || 1)) * 100)}%`],
    ["Activities On Track", report.tasksOnTrack, `${Math.round((report.tasksOnTrack / (report.tasksWithBaseline || 1)) * 100)}% of baselined`],
    ["Activities Delayed", report.tasksDelayed, `${Math.round((report.tasksDelayed / (report.tasksWithBaseline || 1)) * 100)}% of baselined`],
    ["Activities Ahead", report.tasksAhead, `${Math.round((report.tasksAhead / (report.tasksWithBaseline || 1)) * 100)}% of baselined`],
    ["Activities Without Baseline", report.tasksWithoutBaseline, "Scope changes / post-baseline additions"],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, summaryWs, "Executive Summary");

  // 2. Schedule Tasks Sheet (if tasks provided)
  const taskList = tasks.length > 0 ? tasks : report.criticalTasks;
  if (taskList.length > 0) {
    const taskHeaders = [
      "WBS",
      "Task Name",
      "Level",
      "Duration (Days)",
      "Start Date",
      "Finish Date",
      "Progress (%)",
      "Status",
      "Baseline 0 Start",
      "Baseline 0 Finish",
      "Subcontractor",
      "Trade",
      "Critical",
      "Milestone",
    ];
    const taskRows = taskList.map((t) => [
      t.wbs,
      t.name,
      t.level,
      t.duration,
      t.startDate,
      t.endDate,
      t.progress || 0,
      t.status,
      t.baseline0Start || "",
      t.baseline0Finish || "",
      t.subcontractor || t.assignee || "",
      t.trade || "",
      t.isCritical ? "Yes" : "No",
      t.isMilestone ? "Yes" : "No",
    ]);
    const tasksWs = XLSX.utils.aoa_to_sheet([taskHeaders, ...taskRows]);
    XLSX.utils.book_append_sheet(wb, tasksWs, "Schedule Tasks");
  }

  // 3. Top Delayed Tasks Sheet
  if (report.topDelayedTasks.length > 0) {
    const delayHeaders = [
      "WBS",
      "Activity Name",
      "Trade",
      "Baseline Finish",
      "Forecast Finish",
      "Variance (Days)",
      "Critical?",
      "Impact",
    ];
    const delayRows = report.topDelayedTasks.map((d) => [
      d.task.wbs,
      d.task.name,
      d.task.trade || "General",
      d.baselineFinish,
      d.currentFinish,
      `+${d.finishVariance}d`,
      d.isCritical ? "YES" : "No",
      d.impactType,
    ]);
    const delayWs = XLSX.utils.aoa_to_sheet([delayHeaders, ...delayRows]);
    XLSX.utils.book_append_sheet(wb, delayWs, "Delayed Tasks");
  }

  // 4. Lookahead Work Plan Sheet
  if (report.lookaheadActivities.length > 0) {
    const lookaheadHeaders = [
      "WBS",
      "Activity Name",
      "Readiness",
      "Readiness Diagnostic",
      "Start Date",
      "Finish Date",
      "Duration (d)",
      "Progress (%)",
      "Trade",
      "Subcontractor / Assignee",
    ];
    const lookaheadRows = report.lookaheadActivities.map((item) => [
      item.task.wbs,
      item.task.name,
      item.readiness.toUpperCase(),
      item.readinessReason || "Clear to proceed",
      item.task.startDate,
      item.task.endDate,
      item.task.duration,
      `${item.task.progress || 0}%`,
      item.task.trade || "General",
      item.task.subcontractor || item.task.assignee || "Unassigned",
    ]);
    const lookaheadWs = XLSX.utils.aoa_to_sheet([lookaheadHeaders, ...lookaheadRows]);
    XLSX.utils.book_append_sheet(wb, lookaheadWs, "Lookahead Work Plan");
  }

  // 5. Trade Performance Sheet
  if (report.tradeBreakdown.length > 0) {
    const tradeHeaders = [
      "Trade Discipline",
      "Total Tasks",
      "Completed",
      "In Progress",
      "Blocked",
      "Overdue",
      "Average Progress (%)",
    ];
    const tradeRows = report.tradeBreakdown.map((tr) => [
      tr.trade,
      tr.totalTasks,
      tr.completedTasks,
      tr.inProgressTasks,
      tr.blockedTasks,
      tr.overdueTasks,
      `${tr.avgProgress}%`,
    ]);
    const tradeWs = XLSX.utils.aoa_to_sheet([tradeHeaders, ...tradeRows]);
    XLSX.utils.book_append_sheet(wb, tradeWs, "Trade Performance");
  }

  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}

/**
 * Generates a clean, multi-page PDF performance report using jsPDF and autoTable.
 */
export async function exportProgrammeToPdf(report: ProgrammeReportData): Promise<Uint8Array> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // Helper for page header
  const renderHeader = (title: string, subtitle?: string) => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(0, 0, pageWidth, 26, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("PlanD-X Programme Intelligence", 14, 11);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text(`${report.projectName} · ${report.projectLocation} · Reporting Date: ${report.reportingDate}`, 14, 19);

    if (title) {
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 34);
      if (subtitle) {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, 14, 39);
      }
    }
  };

  // ─── Page 1: Executive Summary & Performance ─────────────────────────
  renderHeader("1. Executive Schedule Performance & Milestone Summary");

  // Summary Metrics Table
  autoTable(doc, {
    startY: 44,
    head: [["Schedule Metric", "Project Value", "Context / Contract Baseline"]],
    body: [
      ["Overall Progress", `${report.overallProgress}%`, "Duration-weighted completion"],
      ["Total Actionable Activities", String(report.totalTasks), "WBS work packages and tasks"],
      ["Completed Activities", `${report.completedTasks} (${Math.round((report.completedTasks / (report.totalTasks || 1)) * 100)}%)`, "100% completed on site"],
      ["In Progress Activities", String(report.inProgressTasks), "Active concurrent work fronts"],
      ["Blocked Activities", String(report.blockedTasks), "Active site constraints requiring resolution"],
      ["Overdue Activities", String(report.overdueTasks), "Work past scheduled finish date"],
      ["Critical Path Activities", `${report.criticalTasksCount} (${Math.round((report.criticalTasksCount / (report.totalTasks || 1)) * 100)}%)`, "Zero total float activities"],
      ["Project Start Date", report.plannedStartDate, "Earliest scheduled activity start"],
      ["Projected Completion Date", report.projectedCompletionDate, "Latest working forecast finish"],
      ["Baseline 0 Contract Finish", report.baselineCompletionDate || "N/A", "Original approved target completion"],
      [
        "Net Working Day Variance",
        report.projectVarianceWorkingDays === 0
          ? "0 days (On Track)"
          : report.projectVarianceWorkingDays > 0
          ? `+${report.projectVarianceWorkingDays} working days (Delay)`
          : `${report.projectVarianceWorkingDays} working days (Ahead)`,
        report.projectVarianceWorkingDays > 0 ? "Exceeds approved Baseline 0 finish" : "Complies with approved Baseline 0",
      ],
      ["Working Calendar", report.calendarName, `${report.calendarWorkingDaysPerWeek} working days / week`],
    ],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9 },
    bodyStyles: { fontSize: 8.5, textColor: [30, 41, 59] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // Baseline Variance Breakdown Table
  const finalY1 = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 130;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("2. Baseline 0 Variance Breakdown", 14, finalY1);

  autoTable(doc, {
    startY: finalY1 + 4,
    head: [["Category", "Task Count", "Percentage of Baselined Scope"]],
    body: [
      ["Tasks With Saved Baseline 0", String(report.tasksWithBaseline), `${Math.round((report.tasksWithBaseline / (report.totalTasks || 1)) * 100)}% of total schedule`],
      ["Tasks On Track (Variance = 0d)", String(report.tasksOnTrack), `${Math.round((report.tasksOnTrack / (report.tasksWithBaseline || 1)) * 100)}%`],
      ["Tasks Delayed (Finish Slip > 0d)", String(report.tasksDelayed), `${Math.round((report.tasksDelayed / (report.tasksWithBaseline || 1)) * 100)}%`],
      ["Tasks Ahead (Finish Early < 0d)", String(report.tasksAhead), `${Math.round((report.tasksAhead / (report.tasksWithBaseline || 1)) * 100)}%`],
      ["Tasks Without Baseline", String(report.tasksWithoutBaseline), "Post-baseline additions / scope change"],
    ],
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // ─── Page 2: Top Delayed Tasks ───────────────────────────────────────
  doc.addPage();
  renderHeader(
    "3. Top Schedule Slippages Against Baseline 0",
    "Activities exceeding approved baseline dates ranked by working day delay and critical path impact."
  );

  const delayRows = report.topDelayedTasks.map((d) => [
    d.task.wbs,
    d.task.name,
    d.task.trade || "General",
    d.baselineFinish,
    d.currentFinish,
    `+${d.finishVariance}d`,
    d.isCritical ? "CRITICAL" : "Float Available",
    d.impactType === "critical-delay" ? "Critical Path Slip" : "Consuming Float",
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["WBS", "Activity Name", "Trade", "Baseline", "Forecast", "Variance", "Critical?", "Impact"]],
    body: delayRows.length > 0 ? delayRows : [["-", "All benchmarked activities are currently on or ahead of schedule.", "-", "-", "-", "0d", "No", "On Track"]],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 46 },
      2: { cellWidth: 22 },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 16, fontStyle: "bold" },
      6: { cellWidth: 18 },
      7: { cellWidth: 26 },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // ─── Page 3: Upcoming Lookahead Work Plan ────────────────────────────
  doc.addPage();
  renderHeader(
    `4. Upcoming Lookahead Work Plan (${report.lookaheadPeriod.toUpperCase()})`,
    `Window: ${report.lookaheadRange.displayRange} · Total: ${report.lookaheadStats.totalCount} · Ready: ${report.lookaheadStats.readyCount} · Risk: ${report.lookaheadStats.dependencyRiskCount} · Blocked: ${report.lookaheadStats.blockedCount}`
  );

  const lookaheadRows = report.lookaheadActivities.map((item) => [
    item.task.wbs,
    item.task.name,
    item.readiness.toUpperCase(),
    item.task.startDate,
    item.task.endDate,
    `${item.task.duration}d`,
    `${item.task.progress || 0}%`,
    item.task.subcontractor || item.task.assignee || "Unassigned",
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["WBS", "Activity Name", "Readiness", "Start", "Finish", "Dur", "Prog", "Subcontractor / Assignee"]],
    body: lookaheadRows.length > 0 ? lookaheadRows : [["-", "No activities scheduled within lookahead horizon.", "-", "-", "-", "-", "-", "-"]],
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 50 },
      2: { cellWidth: 20, fontStyle: "bold" },
      3: { cellWidth: 20 },
      4: { cellWidth: 20 },
      5: { cellWidth: 14 },
      6: { cellWidth: 14 },
      7: { cellWidth: 30 },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // ─── Page 4: Trade Breakdown & Action Register ───────────────────────
  doc.addPage();
  renderHeader(
    "5. Trade Performance Breakdown & Site Blocker Register",
    "Trade discipline progress metrics and outstanding blockers impacting site velocity."
  );

  const tradeRows = report.tradeBreakdown.map((tr) => [
    tr.trade,
    String(tr.totalTasks),
    String(tr.completedTasks),
    String(tr.inProgressTasks),
    String(tr.blockedTasks),
    String(tr.overdueTasks),
    `${tr.avgProgress}%`,
  ]);

  autoTable(doc, {
    startY: 44,
    head: [["Trade Discipline", "Total", "Complete", "In Progress", "Blocked", "Overdue", "Avg Progress"]],
    body: tradeRows,
    headStyles: { fillColor: [15, 23, 42], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  const finalY4 = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 8 : 130;
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("6. Active Site Blockers & Overdue Items", 14, finalY4);

  const actionRows = report.actionItems.map((act) => [
    act.task.wbs,
    act.task.name,
    act.issueType.toUpperCase(),
    act.daysOverdue > 0 ? `${act.daysOverdue}d slip` : "-",
    act.reason,
    act.task.subcontractor || act.task.assignee || "Unassigned",
  ]);

  autoTable(doc, {
    startY: finalY4 + 4,
    head: [["WBS", "Activity Name", "Issue Type", "Slip", "Blocker / Cause", "Subcontractor"]],
    body: actionRows.length > 0 ? actionRows : [["-", "No active site blockers or overdue tasks recorded.", "-", "-", "Clear to proceed.", "-"]],
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold", fontSize: 8.5 },
    bodyStyles: { fontSize: 8, textColor: [51, 65, 85] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { cellWidth: 14 },
      1: { cellWidth: 44 },
      2: { cellWidth: 20 },
      3: { cellWidth: 16 },
      4: { cellWidth: 56 },
      5: { cellWidth: 32 },
    },
    theme: "grid",
    margin: { left: 14, right: 14 },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`PlanD-X Programme Intelligence · Project: ${report.projectName}`, 14, pageHeight - 8);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - 14, pageHeight - 8, { align: "right" });
  }

  const arrayBuffer = doc.output("arraybuffer");
  return new Uint8Array(arrayBuffer);
}

/**
 * Generates an executive 16:9 Microsoft PowerPoint presentation deck using pptxgenjs.
 */
export async function exportProgrammeToPptx(report: ProgrammeReportData): Promise<Blob | Uint8Array> {
  const pptx = new pptxgen();
  pptx.layout = "LAYOUT_16x9";
  pptx.title = `PlanD-X Programme Review - ${report.projectName}`;
  pptx.author = "PlanD-X Construction Intelligence";
  pptx.company = "PlanD-X";

  // Slide 1: Cover Slide
  const slide1 = pptx.addSlide();
  slide1.background = { color: "0F172A" }; // Slate 900

  slide1.addText("PlanD-X", {
    x: 0.8,
    y: 1.2,
    fontSize: 22,
    bold: true,
    color: "3B82F6",
  });
  slide1.addText("Programme Performance & Executive Review", {
    x: 0.8,
    y: 1.8,
    fontSize: 32,
    bold: true,
    color: "FFFFFF",
  });
  slide1.addText(`Project: ${report.projectName}`, {
    x: 0.8,
    y: 2.8,
    fontSize: 18,
    color: "E2E8F0",
  });
  slide1.addText(`Location: ${report.projectLocation}  |  Calendar: ${report.calendarName}`, {
    x: 0.8,
    y: 3.3,
    fontSize: 13,
    color: "94A3B8",
  });
  slide1.addText(`Reporting Date: ${report.reportingDate}  |  Period: ${report.periodLabel}`, {
    x: 0.8,
    y: 3.7,
    fontSize: 13,
    color: "94A3B8",
  });
  slide1.addText(`Overall Schedule Progress: ${report.overallProgress}% Complete`, {
    x: 0.8,
    y: 4.5,
    fontSize: 20,
    bold: true,
    color: "10B981",
  });

  // Slide 2: Executive Dashboard
  const slide2 = pptx.addSlide();
  slide2.addText("Executive Schedule Dashboard", {
    x: 0.8,
    y: 0.5,
    fontSize: 22,
    bold: true,
    color: "0F172A",
  });

  const metrics = [
    { label: "Overall Progress", val: `${report.overallProgress}%`, color: "10B981" },
    { label: "Total Activities", val: String(report.totalTasks), color: "2563EB" },
    { label: "Critical Path Tasks", val: String(report.criticalTasksCount), color: "EF4444" },
    {
      label: "Baseline 0 Variance",
      val:
        report.projectVarianceWorkingDays === 0
          ? "0d (On Track)"
          : report.projectVarianceWorkingDays > 0
          ? `+${report.projectVarianceWorkingDays}d (Delay)`
          : `${report.projectVarianceWorkingDays}d (Ahead)`,
      color: report.projectVarianceWorkingDays > 0 ? "EF4444" : "10B981",
    },
  ];

  metrics.forEach((m, idx) => {
    const x = 0.8 + idx * 3.1;
    slide2.addShape(pptx.ShapeType.roundRect, {
      x,
      y: 1.2,
      w: 2.8,
      h: 1.4,
      fill: { color: "F8FAFC" },
      line: { color: "CBD5E1", width: 1 },
    });
    slide2.addText(m.val, {
      x,
      y: 1.35,
      w: 2.8,
      h: 0.6,
      align: "center",
      fontSize: 24,
      bold: true,
      color: m.color,
    });
    slide2.addText(m.label, {
      x,
      y: 1.95,
      w: 2.8,
      h: 0.4,
      align: "center",
      fontSize: 12,
      color: "64748B",
    });
  });

  const scheduleRows: any[] = [
    [
      { text: "Milestone Metric", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Scheduled Date", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Benchmark / Variance", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
    ],
    [{ text: "Planned Project Start" }, { text: report.plannedStartDate }, { text: "Earliest leaf task start" }],
    [{ text: "Projected Completion" }, { text: report.projectedCompletionDate }, { text: "Latest forecast finish" }],
    [{ text: "Baseline 0 Contract Finish" }, { text: report.baselineCompletionDate || "N/A" }, { text: "Original approved target date" }],
    [{ text: "Net Working Day Slip" }, { text: `${report.projectVarianceWorkingDays > 0 ? "+" : ""}${report.projectVarianceWorkingDays} working days` }, { text: report.projectVarianceWorkingDays > 0 ? "Contract Milestone Slip" : "On Schedule" }],
    [{ text: "Working Calendar" }, { text: report.calendarName }, { text: `${report.calendarWorkingDaysPerWeek} working days / week` }],
  ];
  slide2.addTable(scheduleRows as any, { x: 0.8, y: 3.0, w: 11.7, colW: [3.5, 3.5, 4.7], fontSize: 12 });

  // Slide 3: Delay & Baseline Variance Analysis
  const slide3 = pptx.addSlide();
  slide3.addText("Schedule Delay & Baseline 0 Variance Analysis", {
    x: 0.8,
    y: 0.5,
    fontSize: 22,
    bold: true,
    color: "0F172A",
  });

  const delayRows: any[] = [
    [
      { text: "WBS", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Activity Name", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Trade", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Baseline Finish", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Forecast Finish", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Variance", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Critical?", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
    ],
  ];

  const topDelays = report.topDelayedTasks.slice(0, 6);
  if (topDelays.length === 0) {
    delayRows.push([
      { text: "All benchmarked activities are currently on or ahead of schedule." },
      { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }, { text: "" }
    ]);
  } else {
    for (const d of topDelays) {
      delayRows.push([
        { text: d.task.wbs },
        { text: d.task.name },
        { text: d.task.trade || "General" },
        { text: d.baselineFinish },
        { text: d.currentFinish },
        { text: `+${d.finishVariance}d`, options: { color: "EF4444", bold: true } },
        { text: d.isCritical ? "CRITICAL" : "No", options: { color: d.isCritical ? "EF4444" : "64748B", bold: d.isCritical } },
      ]);
    }
  }
  slide3.addTable(delayRows as any, { x: 0.8, y: 1.4, w: 11.7, colW: [1.2, 4.0, 1.8, 1.5, 1.5, 1.0, 1.0], fontSize: 11 });

  // Slide 4: Lookahead Work Plan
  const slide4 = pptx.addSlide();
  slide4.addText(`Lookahead Work Plan (${report.lookaheadPeriod.toUpperCase()}: ${report.lookaheadRange.displayRange})`, {
    x: 0.8,
    y: 0.5,
    fontSize: 22,
    bold: true,
    color: "0F172A",
  });

  const lookaheadRows: any[] = [
    [
      { text: "WBS", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Activity Name", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Readiness", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Start Date", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Finish Date", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Progress", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Subcontractor / Assignee", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
    ],
  ];

  const upcoming = report.lookaheadActivities.slice(0, 7);
  for (const item of upcoming) {
    lookaheadRows.push([
      { text: item.task.wbs },
      { text: item.task.name },
      { text: item.readiness.toUpperCase(), options: { bold: true, color: item.readiness === "ready" ? "10B981" : item.readiness === "blocked" ? "EF4444" : "F59E0B" } },
      { text: item.task.startDate },
      { text: item.task.endDate },
      { text: `${item.task.progress || 0}%` },
      { text: item.task.subcontractor || item.task.assignee || "Unassigned" },
    ]);
  }
  slide4.addTable(lookaheadRows as any, { x: 0.8, y: 1.4, w: 11.7, colW: [1.2, 4.0, 1.6, 1.4, 1.4, 1.0, 1.8], fontSize: 11 });

  // Slide 5: Trade Discipline Breakdown & Site Blockers
  const slide5 = pptx.addSlide();
  slide5.addText("Trade Discipline Performance & Blocker Register", {
    x: 0.8,
    y: 0.5,
    fontSize: 22,
    bold: true,
    color: "0F172A",
  });

  const tradeRows: any[] = [
    [
      { text: "Trade Discipline", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Total Tasks", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Complete", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "In Progress", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
      { text: "Blocked", options: { bold: true, fill: "0F172A", color: "FFFFFF" } },
      { text: "Average Progress", options: { bold: true, fill: { color: "0F172A" }, color: "FFFFFF" } },
    ],
  ];
  for (const tr of report.tradeBreakdown.slice(0, 5)) {
    tradeRows.push([
      { text: tr.trade },
      { text: String(tr.totalTasks) },
      { text: String(tr.completedTasks) },
      { text: String(tr.inProgressTasks) },
      { text: String(tr.blockedTasks) },
      { text: `${tr.avgProgress}%`, options: { bold: true } },
    ]);
  }
  slide5.addTable(tradeRows as any, { x: 0.8, y: 1.4, w: 11.7, colW: [3.2, 1.7, 1.7, 1.7, 1.7, 1.7], fontSize: 11 });

  if (typeof window !== "undefined") {
    return (await pptx.write({ outputType: "blob" })) as Blob;
  } else {
    return (await pptx.write({ outputType: "nodebuffer" })) as Uint8Array;
  }
}

/**
 * Downloads binary content (Uint8Array or Blob) as a file in the browser.
 */
export function downloadBinaryFile(
  data: Uint8Array | ArrayBuffer | Blob,
  filename: string,
  mimeType: string = "application/octet-stream"
): void {
  if (typeof window === "undefined") return;
  const blob = data instanceof Blob ? data : new Blob([data as any], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
