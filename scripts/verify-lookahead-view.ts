// PlanD-X: Comprehensive Lookahead Planning Verification Suite
// Verifies all Phase 5 requirements for 2-week and 4-week lookahead windows,
// calendar integration, readiness categorization, blocker detection, and data consistency.

import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  getLookaheadDateRange,
  getLookaheadTasks,
  getLookaheadSummaryStats,
  recalculateSchedule,
  parseIsoDate,
  formatDateIso,
} from "../lib/programme-calendar";
import type { ProgrammeTask } from "../lib/programme-types";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log("===============================================================");
console.log("PlanD-X Lookahead Planning Verification Suite");
console.log("===============================================================\n");

let passedCount = 0;

// ─── Test 1: 2-Week vs 4-Week Lookahead Window Calculation ───
console.log("--- Test 1: 2-Week vs 4-Week Lookahead Window Math ---");
{
  const anchor = "2025-10-15"; // Wednesday
  const range2W = getLookaheadDateRange(anchor, "2-weeks", STANDARD_5_DAY_CALENDAR);
  const range4W = getLookaheadDateRange(anchor, "4-weeks", STANDARD_5_DAY_CALENDAR);

  assert(range2W.calendarDays === 14, `Test 1a: 2-week window is 14 calendar days (Got: ${range2W.calendarDays})`);
  assert(range2W.startDate === "2025-10-15", "Test 1b: 2-week window starts at anchor 2025-10-15");
  assert(range2W.endDate === "2025-10-28", `Test 1c: 2-week window ends 14 days later at 2025-10-28 (Got: ${range2W.endDate})`);
  // Working days: 10 working days (minus Diwali public holiday on Mon Oct 20 = 9 working days)
  assert(range2W.workingDays === 9, `Test 1d: 2-week window correctly accounts for Diwali holiday (Got: ${range2W.workingDays} working days)`);

  assert(range4W.calendarDays === 28, `Test 1e: 4-week window is 28 calendar days (Got: ${range4W.calendarDays})`);
  assert(range4W.endDate === "2025-11-11", `Test 1f: 4-week window ends 28 days later at 2025-11-11 (Got: ${range4W.endDate})`);
  passedCount++;
}

// ─── Test 2: Inclusivity of Boundary-Crossing Activities ───────
console.log("\n--- Test 2: Boundary-Crossing Activity Inclusivity ---");
{
  // Window: 2025-10-15 to 2025-10-28
  const range = { startDate: "2025-10-15", endDate: "2025-10-28" };
  const tasks: ProgrammeTask[] = [
    {
      id: "T_SPANS",
      wbs: "1.1",
      name: "Long Slab Pour (Spanning Window)",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06", // Starts before window
      endDate: "2025-11-05",   // Finishes after window
      duration: 22,
      progress: 30,
      trade: "Structural",
      assignee: "John Smith",
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "T_STARTS_IN",
      wbs: "1.2",
      name: "Decking (Starts In Window, Finishes After)",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-22", // Starts in window
      endDate: "2025-11-03",   // Finishes after window
      duration: 8,
      progress: 0,
      trade: "Structural",
      assignee: "Paul Turner",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 5,
    },
    {
      id: "T_FINISHES_IN",
      wbs: "1.3",
      name: "Piling Signoff (Started Before, Finishes In Window)",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06", // Starts before window
      endDate: "2025-10-17",   // Finishes in window
      duration: 10,
      progress: 80,
      trade: "Civils",
      assignee: "Sarah Carter",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 2,
    },
    {
      id: "T_ENTIRELY_WITHIN",
      wbs: "1.4",
      name: "Rebar Fixing (Wholly Within Window)",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-16",
      endDate: "2025-10-22",
      duration: 4,
      progress: 0,
      trade: "Structural",
      assignee: "Mike Jones",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 4,
    },
    {
      id: "T_OUTSIDE_PAST",
      wbs: "1.5",
      name: "Site Setup (Complete in the Past)",
      level: "task",
      parentId: null,
      status: "complete",
      startDate: "2025-09-01",
      endDate: "2025-09-20",
      duration: 15,
      progress: 100,
      trade: "Management",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "T_OUTSIDE_FUTURE",
      wbs: "1.6",
      name: "Roof Trusses (Far Future)",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-12-01",
      endDate: "2025-12-15",
      duration: 10,
      progress: 0,
      trade: "Structural",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const lookaheadItems = getLookaheadTasks(tasks, range, STANDARD_5_DAY_CALENDAR, "2025-10-15");
  const ids = lookaheadItems.map((i) => i.task.id);

  assert(ids.includes("T_SPANS"), "Test 2a: Includes task spanning across window");
  assert(ids.includes("T_STARTS_IN"), "Test 2b: Includes task starting inside window");
  assert(ids.includes("T_FINISHES_IN"), "Test 2c: Includes task finishing inside window");
  assert(ids.includes("T_ENTIRELY_WITHIN"), "Test 2d: Includes task wholly within window");
  assert(!ids.includes("T_OUTSIDE_PAST"), "Test 2e: Excludes completed past task outside window");
  assert(!ids.includes("T_OUTSIDE_FUTURE"), "Test 2f: Excludes future task outside window");
  assert(lookaheadItems.length === 4, `Test 2g: Exactly 4 valid activities returned (Got: ${lookaheadItems.length})`);
  passedCount++;
}

// ─── Test 3: Calendar & Working Days Respect ──────────────────
console.log("\n--- Test 3: Calendar Rules in Lookahead Windows ---");
{
  const anchor = "2025-10-15";
  const range5D = getLookaheadDateRange(anchor, "2-weeks", STANDARD_5_DAY_CALENDAR);
  const range6D = getLookaheadDateRange(anchor, "2-weeks", CONSTRUCTION_6_DAY_CALENDAR);

  // In 14 calendar days, 6-day week works Saturdays (2 Saturdays = +2 working days)
  assert(range6D.workingDays > range5D.workingDays, `Test 3a: 6-day calendar provides more working days (${range6D.workingDays}d) than 5-day (${range5D.workingDays}d)`);
  assert(range6D.workingDays === 11, `Test 3b: 6-day calendar counts exactly 11 working days (14d minus 2 Sundays minus Diwali)`);
  passedCount++;
}

// ─── Test 4: Readiness & Blocker Identification ───────────────
console.log("\n--- Test 4: Readiness & Blocker Categorization ---");
{
  const range = { startDate: "2025-10-15", endDate: "2025-10-28" };
  const tasks: ProgrammeTask[] = [
    {
      id: "TASK_READY",
      wbs: "2.1",
      name: "Cleared Task",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-20",
      endDate: "2025-10-24",
      duration: 4,
      progress: 0,
      trade: "Civils",
      assignee: "Paul Turner",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 2,
    },
    {
      id: "TASK_BLOCKED",
      wbs: "2.2",
      name: "Core Wall Pour",
      level: "task",
      parentId: null,
      status: "blocked",
      isBlocked: true,
      blockedBy: "Waiting for structural engineering signoff on column transfer beam",
      startDate: "2025-10-16",
      endDate: "2025-10-22",
      duration: 4,
      progress: 20,
      trade: "Structural",
      assignee: "John Smith",
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "TASK_OVERDUE",
      wbs: "2.3",
      name: "Earthworks Compaction Testing",
      level: "task",
      parentId: null,
      status: "in-progress",
      isOverdue: true,
      startDate: "2025-10-06",
      endDate: "2025-10-10", // Finished 5 days before anchor (Oct 15), but only 40% progress
      duration: 5,
      progress: 40,
      trade: "Civils",
      assignee: "Sarah Carter",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "PRED_INCOMPLETE",
      wbs: "2.4",
      name: "Formwork Assembly",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-11-01",
      endDate: "2025-11-08",
      duration: 5,
      progress: 30,
      trade: "Structural",
      assignee: "John Smith",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["TASK_DEP_RISK"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "TASK_DEP_RISK",
      wbs: "2.5",
      name: "Rebar Installation (Depends on Formwork)",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-21", // Scheduled before formwork finishes!
      endDate: "2025-10-25",
      duration: 4,
      progress: 0,
      trade: "Structural",
      assignee: "Mike Jones",
      isCritical: false,
      isMilestone: false,
      predecessors: ["PRED_INCOMPLETE"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "TASK_UNASSIGNED",
      wbs: "2.6",
      name: "Temporary Power Commissioning",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-17",
      endDate: "2025-10-21",
      duration: 2,
      progress: 0,
      trade: "M&E",
      assignee: null,
      subcontractor: null, // Unassigned!
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 3,
    },
  ];

  const items = getLookaheadTasks(tasks, range, STANDARD_5_DAY_CALENDAR, "2025-10-15");
  const readyItem = items.find((i) => i.task.id === "TASK_READY")!;
  const blockedItem = items.find((i) => i.task.id === "TASK_BLOCKED")!;
  const overdueItem = items.find((i) => i.task.id === "TASK_OVERDUE")!;
  const depRiskItem = items.find((i) => i.task.id === "TASK_DEP_RISK")!;
  const unassignedItem = items.find((i) => i.task.id === "TASK_UNASSIGNED")!;

  assert(readyItem.readiness === "ready", "Test 4a: TASK_READY categorized as 'ready'");
  assert(blockedItem.readiness === "blocked", "Test 4b: TASK_BLOCKED categorized as 'blocked'");
  assert(Boolean(blockedItem.readinessReason?.includes("transfer beam")), "Test 4c: Blocked reason extracted correctly");
  assert(overdueItem.readiness === "overdue", "Test 4d: TASK_OVERDUE categorized as 'overdue'");
  assert(depRiskItem.readiness === "dependency-risk", "Test 4e: TASK_DEP_RISK categorized as 'dependency-risk'");
  assert(depRiskItem.unresolvedPredecessors.length === 1, "Test 4f: Unresolved predecessor identified");
  assert(unassignedItem.readiness === "unassigned", "Test 4g: TASK_UNASSIGNED categorized as 'unassigned'");

  const stats = getLookaheadSummaryStats(items);
  assert(stats.readyCount === 1, "Test 4h: Exactly 1 ready task in stats");
  assert(stats.blockedCount === 1, "Test 4i: Exactly 1 blocked task in stats");
  assert(stats.overdueCount === 1, "Test 4j: Exactly 1 overdue task in stats");
  assert(stats.dependencyRiskCount === 1, "Test 4k: Exactly 1 dep risk task in stats");
  assert(stats.unassignedCount === 1, "Test 4l: Exactly 1 unassigned task in stats");
  passedCount++;
}

// ─── Test 5: Resource & Subcontractor Assignment Consistency ─
console.log("\n--- Test 5: Resource & Subcontractor Assignments ---");
{
  const range = { startDate: "2025-10-15", endDate: "2025-10-28" };
  const tasks: ProgrammeTask[] = [
    {
      id: "RES_TASK_1",
      wbs: "3.1",
      name: "Glazing Package",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-16",
      endDate: "2025-10-23",
      duration: 5,
      progress: 0,
      trade: "Façade",
      assignee: "David Wilson",
      subcontractor: "Apex Glazing Ltd",
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 1,
    },
  ];

  const items = getLookaheadTasks(tasks, range, STANDARD_5_DAY_CALENDAR, "2025-10-15");
  const t = items[0].task;
  assert(t.subcontractor === "Apex Glazing Ltd", "Test 5a: Subcontractor preserved in lookahead item");
  assert(t.assignee === "David Wilson", "Test 5b: Assignee preserved in lookahead item");
  assert(t.trade === "Façade", "Test 5c: Trade preserved in lookahead item");
  passedCount++;
}

// ─── Test 6: Dynamic Recalculation Continuity Across Programme ─
console.log("\n--- Test 6: Dynamic Recalculation Continuity ---");
{
  const range = { startDate: "2025-10-15", endDate: "2025-10-28" };
  const tasks: ProgrammeTask[] = [
    {
      id: "REC_A",
      wbs: "4.1",
      name: "Core Rebar",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 0,
      trade: "Structural",
      assignee: "John Smith",
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: ["REC_B"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "REC_B",
      wbs: "4.2",
      name: "Core Concreting",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-13",
      endDate: "2025-10-17",
      duration: 5,
      progress: 0,
      trade: "Structural",
      assignee: "John Smith",
      isCritical: true,
      isMilestone: false,
      predecessors: ["REC_A"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  // Duration of REC_A is extended from 5d to 8d
  const editedTasks = tasks.map((t) => (t.id === "REC_A" ? { ...t, duration: 8 } : t));
  const recalcResult = recalculateSchedule(editedTasks, STANDARD_5_DAY_CALENDAR);

  // Re-run Lookahead filter on recalculated tasks
  const items = getLookaheadTasks(recalcResult.updatedTasks, range, STANDARD_5_DAY_CALENDAR, "2025-10-15");
  const recB = items.find((i) => i.task.id === "REC_B")!;

  assert(recB !== undefined, "Test 6a: Shifted successor still included in lookahead window");
  assert(recB.task.startDate === "2025-10-16", `Test 6b: Successor start cascaded cleanly to 2025-10-16 (Got: ${recB.task.startDate})`);
  passedCount++;
}

// ─── Test 7: Empty State & Zero Result Handling ───────────────
console.log("\n--- Test 7: Empty State & Zero Result Handling ---");
{
  const futureRange = { startDate: "2027-01-01", endDate: "2027-01-14" };
  const tasks: ProgrammeTask[] = [
    {
      id: "TASK_2025",
      wbs: "5.1",
      name: "Past Task",
      level: "task",
      parentId: null,
      status: "complete",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 100,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const items = getLookaheadTasks(tasks, futureRange, STANDARD_5_DAY_CALENDAR, "2027-01-01");
  const stats = getLookaheadSummaryStats(items);

  assert(items.length === 0, "Test 7a: Correctly returns empty list when no tasks in window");
  assert(stats.totalCount === 0, "Test 7b: Total count is 0 in stats");
  assert(stats.readyCount === 0, "Test 7c: Ready count is 0 in stats");
  passedCount++;
}

// ─── Test 8: Integration with Real Programme Tasks ───────────
console.log("\n--- Test 8: Integration with Real Programme Dataset ---");
{
  const range2W = getLookaheadDateRange("2025-10-15", "2-weeks", STANDARD_5_DAY_CALENDAR);
  const range4W = getLookaheadDateRange("2025-10-15", "4-weeks", STANDARD_5_DAY_CALENDAR);

  // Use full real tasks
  const scheduledTasks = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR).updatedTasks;

  const items2W = getLookaheadTasks(scheduledTasks, range2W, STANDARD_5_DAY_CALENDAR, "2025-10-15");
  const items4W = getLookaheadTasks(scheduledTasks, range4W, STANDARD_5_DAY_CALENDAR, "2025-10-15");

  assert(items2W.length > 0, `Test 8a: 2-week lookahead extracts active tasks from real dataset (Count: ${items2W.length})`);
  assert(items4W.length >= items2W.length, `Test 8b: 4-week lookahead (${items4W.length}) contains at least as many tasks as 2-week (${items2W.length})`);

  const stats2W = getLookaheadSummaryStats(items2W);
  assert(stats2W.totalCount === items2W.length, "Test 8c: Real summary stats match filtered count");
  console.log(`   Real Programme 2-Week Window stats: ${stats2W.totalCount} tasks (${stats2W.readyCount} ready, ${stats2W.blockedCount} blocked, ${stats2W.criticalCount} critical)`);
  passedCount++;
}

console.log("\n---------------------------------------------------------------");
console.log(`Summary: ${passedCount}/8 verification test suites passed completely.`);
console.log("---------------------------------------------------------------");
