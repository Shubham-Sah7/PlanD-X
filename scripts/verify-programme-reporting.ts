// PlanD-X: Comprehensive Programme Reporting Verification Suite
// Verifies all Phase 5 requirements for Report generation, calculations,
// baseline comparisons, reporting periods, CSV formatting, and non-destructive data access.

import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  recalculateSchedule,
} from "../lib/programme-calendar";
import {
  generateProgrammeReportData,
  exportProgrammeToCsv,
} from "../lib/programme-reporting";
import type { ProgrammeTask } from "../lib/programme-types";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

let passedCount = 0;

console.log("===============================================================");
console.log("PlanD-X Programme Reporting Verification Suite");
console.log("===============================================================");

// ─── Test 1: Report Values Match Programme Module ────────────
console.log("\n--- Test 1: Report Values Match Active Programme Dataset ---");
{
  const scheduledTasks = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR).updatedTasks;
  const report = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    reportingDate: "2025-10-15",
  });

  const leafTasks = scheduledTasks.filter(
    (t) => t.level !== "programme" && Boolean(t.startDate) && Boolean(t.endDate)
  );

  assert(report.totalTasks === leafTasks.length, `Test 1a: Total tasks matches active leaf count (${report.totalTasks})`);
  assert(report.criticalTasksCount === leafTasks.filter((t) => t.isCritical).length, `Test 1b: Critical tasks count matches active critical count (${report.criticalTasksCount})`);
  assert(report.blockedTasks === leafTasks.filter((t) => t.status === "blocked" || t.isBlocked).length, `Test 1c: Blocked tasks matches active blocked count (${report.blockedTasks})`);
  assert(report.plannedStartDate.startsWith("2025-"), `Test 1d: Planned start date is valid (${report.plannedStartDate})`);
  assert(report.projectedCompletionDate.startsWith("2026-"), `Test 1e: Projected completion date is valid (${report.projectedCompletionDate})`);
  passedCount++;
}

// ─── Test 2: Progress & Delay Calculation Accuracy ───────────
console.log("\n--- Test 2: Progress & Delay Calculation Accuracy ---");
{
  const testTasks: ProgrammeTask[] = [
    {
      id: "T1",
      wbs: "1.1",
      name: "Excavation",
      level: "task",
      parentId: null,
      status: "complete",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 100, // 5 * 100% = 5 days done
      trade: "Civils",
      assignee: "John",
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: ["T2"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-10",
    },
    {
      id: "T2",
      wbs: "1.2",
      name: "Piling",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-13",
      endDate: "2025-10-17",
      duration: 5,
      progress: 40, // 5 * 40% = 2 days done
      trade: "Civils",
      assignee: "Mike",
      isCritical: true,
      isMilestone: false,
      predecessors: ["T1"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-13",
      baseline0Finish: "2025-10-15", // Delayed by 2 working days
    },
  ];

  // Total working days = 10d. Completed work days = 5d + 2d = 7d. Progress = 7/10 = 70%
  const report = generateProgrammeReportData(testTasks, STANDARD_5_DAY_CALENDAR, {
    reportingDate: "2025-10-15",
  });

  assert(report.overallProgress === 70, `Test 2a: Duration-weighted progress calculates accurately (Got: ${report.overallProgress}%, Expected: 70%)`);
  assert(report.tasksDelayed === 1, `Test 2b: Accurately identifies 1 delayed task`);
  assert(report.topDelayedTasks[0].finishVariance === 2, `Test 2c: Finish variance is exactly 2 working days (Got: ${report.topDelayedTasks[0].finishVariance})`);
  passedCount++;
}

// ─── Test 3: Baseline Comparison Integrity ───────────────────
console.log("\n--- Test 3: Baseline Comparison Uses Valid Baseline Data ---");
{
  const tasksWithAndWithoutBaseline: ProgrammeTask[] = [
    {
      id: "BASE_TASK",
      wbs: "2.1",
      name: "Core Pour",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-16",
      endDate: "2025-10-22",
      duration: 4,
      progress: 50,
      trade: "Structural",
      assignee: "Sarah",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 2,
      baseline0Start: "2025-10-14",
      baseline0Finish: "2025-10-20",
    },
    {
      id: "NEW_SCOPE_TASK",
      wbs: "2.2",
      name: "Additional Tenant Handover Works",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-23",
      endDate: "2025-10-28",
      duration: 4,
      progress: 0,
      trade: "Finishes",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 5,
      // No baseline fields!
    },
  ];

  const report = generateProgrammeReportData(tasksWithAndWithoutBaseline, STANDARD_5_DAY_CALENDAR);

  assert(report.hasBaselineData === true, "Test 3a: Identifies presence of baseline data");
  assert(report.tasksWithBaseline === 1, "Test 3b: Exactly 1 task has baseline data");
  assert(report.tasksWithoutBaseline === 1, "Test 3c: Exactly 1 task without baseline correctly segregated");
  assert(report.topDelayedTasks.length === 1, "Test 3d: Only baselined tasks evaluated for delay");
  assert(report.topDelayedTasks[0].task.id === "BASE_TASK", "Test 3e: Correct delayed task identified");
  passedCount++;
}

// ─── Test 4: Reporting Period Selection ──────────────────────
console.log("\n--- Test 4: Reporting Period Application ---");
{
  const scheduledTasks = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR).updatedTasks;

  const repLifecycle = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    period: "lifecycle",
    reportingDate: "2025-10-15",
  });
  const repMonth = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    period: "month",
    reportingDate: "2025-10-15",
  });
  const rep2W = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    period: "2-weeks",
    reportingDate: "2025-10-15",
  });
  const rep4W = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    period: "4-weeks",
    reportingDate: "2025-10-15",
  });

  assert(repLifecycle.reportingPeriod === "lifecycle", "Test 4a: Lifecycle period set correctly");
  assert(repMonth.reportingPeriod === "month", "Test 4b: Month period set correctly");
  assert(repMonth.periodStartDate === "2025-10-01", "Test 4c: Month period start is first day of October");
  assert(rep2W.reportingPeriod === "2-weeks", "Test 4d: 2-week period set correctly");
  assert(rep2W.lookaheadActivities.length > 0, "Test 4e: 2-week lookahead populated with active activities");
  assert(rep4W.lookaheadRange.calendarDays === 28, "Test 4f: 4-week lookahead range is 28 calendar days");
  passedCount++;
}

// ─── Test 5: Missing Data & Edge Case Handling ───────────────
console.log("\n--- Test 5: Missing Data Handled Clearly ---");
{
  const unbaselinedTasks: ProgrammeTask[] = [
    {
      id: "NO_BASE_1",
      wbs: "3.1",
      name: "Preliminary Works",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-10",
      endDate: "2025-10-15",
      duration: 4,
      progress: 0,
      trade: null, // No trade
      assignee: null, // No assignee
      subcontractor: null, // No subcontractor
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 10,
    },
  ];

  const report = generateProgrammeReportData(unbaselinedTasks, STANDARD_5_DAY_CALENDAR);

  assert(report.hasBaselineData === false, "Test 5a: Gracefully handles project without baseline");
  assert(report.baselineCompletionDate === null, "Test 5b: Baseline completion date is null when no baseline exists");
  assert(report.projectVarianceWorkingDays === 0, "Test 5c: Variance is 0 when baseline is absent");
  assert(report.topDelayedTasks.length === 0, "Test 5d: Top delayed list is empty without throwing");
  assert(report.tradeBreakdown[0].trade === "General Works", "Test 5e: Missing trade defaults safely to General Works");
  passedCount++;
}

// ─── Test 6: RFC-4180 CSV Export Generation ───────────────────
console.log("\n--- Test 6: RFC-4180 CSV Export Generation ---");
{
  const scheduledTasks = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR).updatedTasks;
  const report = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR, {
    reportingDate: "2025-10-15",
  });
  const csv = exportProgrammeToCsv(report);

  assert(typeof csv === "string" && csv.length > 500, `Test 6a: CSV generated with non-trivial length (${csv.length} chars)`);
  assert(csv.includes("PlanD-X Programme Performance Report"), "Test 6b: CSV includes report title");
  assert(csv.includes("1. EXECUTIVE SCHEDULE PERFORMANCE"), "Test 6c: CSV includes Executive Summary section");
  assert(csv.includes("2. BASELINE 0 VARIANCE PERFORMANCE"), "Test 6d: CSV includes Baseline 0 section");
  assert(csv.includes("3. TRADE & DISCIPLINE BREAKDOWN"), "Test 6e: CSV includes Trade breakdown section");
  assert(csv.includes("4. UPCOMING LOOKAHEAD WORK PLAN"), "Test 6f: CSV includes Lookahead work plan section");
  assert(csv.includes("5. ACTIVE BLOCKERS & OVERDUE ACTION REGISTER"), "Test 6g: CSV includes Blockers & Action items");
  passedCount++;
}

// ─── Test 7: Non-Destructive Operations & Data Integrity ──────
console.log("\n--- Test 7: Non-Destructive Data Access ---");
{
  const originalTaskCount = ALL_PROGRAMME_TASKS.length;
  const originalTask0 = JSON.parse(JSON.stringify(ALL_PROGRAMME_TASKS[0]));

  const report = generateProgrammeReportData(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR);

  assert(ALL_PROGRAMME_TASKS.length === originalTaskCount, "Test 7a: Task array length strictly preserved");
  assert(ALL_PROGRAMME_TASKS[0].startDate === originalTask0.startDate, "Test 7b: Task 0 startDate unmutated");
  assert(ALL_PROGRAMME_TASKS[0].duration === originalTask0.duration, "Test 7c: Task 0 duration unmutated");
  assert(ALL_PROGRAMME_TASKS[0].baseline0Start === originalTask0.baseline0Start, "Test 7d: Baseline 0 start strictly unmutated");
  passedCount++;
}

// ─── Test 8: Calendar Respect in Reporting ───────────────────
console.log("\n--- Test 8: Calendar Working Days Respected in Reporting ---");
{
  const scheduledTasks = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR).updatedTasks;

  const rep5D = generateProgrammeReportData(scheduledTasks, STANDARD_5_DAY_CALENDAR);
  const rep6D = generateProgrammeReportData(scheduledTasks, CONSTRUCTION_6_DAY_CALENDAR);

  assert(rep5D.calendarWorkingDaysPerWeek === 5, "Test 8a: 5-day calendar reports 5 working days/wk");
  assert(rep6D.calendarWorkingDaysPerWeek === 6, "Test 8b: 6-day calendar reports 6 working days/wk");
  assert(rep6D.calendarName.includes("6-Day"), "Test 8c: Calendar name correctly reflected in report");
  passedCount++;
}

console.log("\n---------------------------------------------------------------");
console.log(`Summary: ${passedCount}/8 verification test suites passed completely.`);
console.log("---------------------------------------------------------------");
