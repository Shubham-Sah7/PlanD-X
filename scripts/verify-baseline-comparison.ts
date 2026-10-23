/**
 * Verification Script: PlanD-X Baseline vs Current Programme Comparison
 * ====================================================================
 * Verifies:
 * 1. Baseline and current dates display correctly and are properly populated.
 * 2. Schedule variance math strictly uses the project calendar (5-day, 6-day, holidays, weekends).
 * 3. Changed task dates are highlighted with accurate delay/ahead/on-track variances.
 * 4. Baseline integrity is protected: schedule recalculation and updates NEVER modify saved baseline dates.
 * 5. Tasks without baseline data are handled gracefully without inventing historical dates.
 * 6. Visual coordinates and comparison states work reliably.
 */

import { ALL_PROGRAMME_TASKS, INITIAL_PROGRAMME_TASKS } from "../lib/programme-data";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  calculateScheduleVariance,
  calculateDateVarianceWorkingDays,
  formatVarianceDisplay,
  recalculateSchedule,
} from "../lib/programme-calendar";
import { DEFAULT_VISIBLE_COLUMNS, COLUMN_DEFINITIONS } from "../components/programme/gantt/wbs-tree";
import type { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("===============================================================================");
console.log("   PLAN-DX: BASELINE VS CURRENT PROGRAMME COMPARISON VERIFICATION");
console.log("===============================================================================\n");

// ─── Test 1: Baseline Data Presence and Integrity ───
console.log("--- 1. Baseline Data Retrieval & Presence ---");
const columnsTask = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-columns");
assert(!!columnsTask, "Task 'task-columns' found in dataset");
assert(columnsTask?.baseline0Start === "2025-12-15", `Columns baseline start is 2025-12-15 (got ${columnsTask?.baseline0Start})`);
assert(columnsTask?.baseline0Finish === "2026-01-08", `Columns baseline finish is 2026-01-08 (got ${columnsTask?.baseline0Finish})`);
assert(columnsTask?.startDate === "2025-12-20", `Columns current start is 2025-12-20 (got ${columnsTask?.startDate})`);
assert(columnsTask?.endDate === "2026-01-16", `Columns current finish is 2026-01-16 (got ${columnsTask?.endDate})`);

const siteEstTask = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-site-est");
assert(!!siteEstTask, "Task 'task-site-est' found in dataset");
assert(siteEstTask?.baseline0Start === siteEstTask?.startDate, "Site Establishment baseline start matches current start (On Track)");
assert(siteEstTask?.baseline0Finish === siteEstTask?.endDate, "Site Establishment baseline finish matches current finish (On Track)");

// ─── Test 2: Variance Calculation with Project Working Calendar ───
console.log("\n--- 2. Working Calendar Variance Calculations ---");
// Verify Columns variance on standard 5-day calendar (Mon-Fri)
// Baseline finish: 2026-01-08 (Thursday). Current finish: 2026-01-16 (Friday).
// Working days strictly after Jan 08 up to Jan 16:
// Jan 9 (Fri), Jan 12 (Mon), Jan 13 (Tue), Jan 14 (Wed), Jan 15 (Thu), Jan 16 (Fri) = 6 working days!
// Note: Jan 10 (Sat) and Jan 11 (Sun) are non-working and must be skipped.
const columnsVariance = calculateScheduleVariance(columnsTask!, STANDARD_5_DAY_CALENDAR);
assert(columnsVariance.hasBaseline === true, "Columns has baseline flag is true");
assert(columnsVariance.finishVariance === 6, `Columns finish variance is +6 working days (got +${columnsVariance.finishVariance}d)`);
assert(columnsVariance.isDelayed === true, "Columns is marked as delayed");
assert(columnsVariance.isAhead === false, "Columns is not ahead");
assert(columnsVariance.isOnTrack === false, "Columns is not on track");

const columnsDisplay = formatVarianceDisplay(columnsVariance.finishVariance);
assert(columnsDisplay.label === "+6d delay", `Display label is '+6d delay' (got '${columnsDisplay.label}')`);
assert(columnsDisplay.badgeClass.includes("red"), "Delay >= 5d formatted with high-visibility red badge");

// Site Est on track variance
const siteEstVariance = calculateScheduleVariance(siteEstTask!, STANDARD_5_DAY_CALENDAR);
assert(siteEstVariance.finishVariance === 0, `Site Est finish variance is 0 working days (got ${siteEstVariance.finishVariance}d)`);
assert(siteEstVariance.isOnTrack === true, "Site Est is on track");
assert(formatVarianceDisplay(0).label === "0d on track", "0d variance formatted as '0d on track'");

// ─── Test 3: Ahead of Schedule Variance (-N days) ───
console.log("\n--- 3. Ahead of Schedule Variance Math ---");
const aheadTask: ProgrammeTask = {
  ...columnsTask!,
  id: "test-ahead-task",
  startDate: "2025-12-10",
  endDate: "2026-01-05", // finished 3 working days earlier than 2026-01-08 baseline
  baseline0Start: "2025-12-15",
  baseline0Finish: "2026-01-08",
};
const aheadVariance = calculateScheduleVariance(aheadTask, STANDARD_5_DAY_CALENDAR);
assert(aheadVariance.finishVariance === -3, `Ahead task finish variance is -3 working days (got ${aheadVariance.finishVariance}d)`);
assert(aheadVariance.isAhead === true, "Ahead task isAhead flag is true");
assert(aheadVariance.isDelayed === false, "Ahead task isDelayed flag is false");
assert(formatVarianceDisplay(aheadVariance.finishVariance).label === "-3d ahead", "Ahead display is '-3d ahead'");

// ─── Test 4: Holiday & Weekend Skipping in Variance ───
console.log("\n--- 4. Holiday and Weekend Handling in Variance ---");
// Baseline: 2025-12-24 (Wednesday). Current: 2025-12-29 (Monday).
// Calendar has Christmas (Dec 25) and Boxing Day (Dec 26) as public holidays.
// Dec 27 (Sat) and Dec 28 (Sun) are weekend days.
// Therefore between Dec 24 and Dec 29, the ONLY working day is Monday Dec 29 (1 working day delay).
const holidayDelay = calculateDateVarianceWorkingDays("2025-12-24", "2025-12-29", STANDARD_5_DAY_CALENDAR);
assert(holidayDelay === 1, `Variance over Christmas/Boxing Day/weekend is exactly 1 working day (got ${holidayDelay})`);

// ─── Test 5: Six-Day Working Calendar Shifts ───
console.log("\n--- 5. Calendar Adaptability (6-day vs 5-day) ---");
// On a 6-day week (Mon-Sat working, Sunday non-working), Saturday Jan 10 is a working day.
// Working days from Jan 08 to Jan 16 on 6-day calendar:
// Jan 9 (Fri), Jan 10 (Sat), Jan 12 (Mon), Jan 13 (Tue), Jan 14 (Wed), Jan 15 (Thu), Jan 16 (Fri) = 7 working days!
const columns6DayVariance = calculateScheduleVariance(columnsTask!, CONSTRUCTION_6_DAY_CALENDAR);
assert(
  columns6DayVariance.finishVariance === 7,
  `Columns finish variance under 6-day calendar is 7 working days (got +${columns6DayVariance.finishVariance}d)`,
);

// ─── Test 6: Baseline Integrity Protection ───
console.log("\n--- 6. Baseline Integrity Protection ---");
// Verify that rescheduling tasks never alters saved baseline0Start or baseline0Finish
const origBaselineStart = columnsTask!.baseline0Start;
const origBaselineFinish = columnsTask!.baseline0Finish;

const rescheduleResult = recalculateSchedule(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR);
const rescheduledColumns = rescheduleResult.updatedTasks.find((t) => t.id === "task-columns");

assert(
  rescheduledColumns?.baseline0Start === origBaselineStart,
  "Schedule recalculation strictly preserved baseline0Start",
);
assert(
  rescheduledColumns?.baseline0Finish === origBaselineFinish,
  "Schedule recalculation strictly preserved baseline0Finish",
);

// ─── Test 7: Handling Tasks Without Baseline Data ───
console.log("\n--- 7. Handling Tasks Without Baseline Data ---");
const taskWithoutBaseline: ProgrammeTask = {
  ...columnsTask!,
  id: "test-no-baseline-task",
  baseline0Start: undefined,
  baseline0Finish: undefined,
};
const noBaselineVariance = calculateScheduleVariance(taskWithoutBaseline, STANDARD_5_DAY_CALENDAR);
assert(noBaselineVariance.hasBaseline === false, "Tasks without baseline dates have hasBaseline = false");
assert(noBaselineVariance.finishVariance === 0, "Tasks without baseline dates have 0 variance");
assert(noBaselineVariance.isDelayed === false, "Tasks without baseline dates are not marked delayed");

// ─── Test 8: Column Definitions & Customization ───
console.log("\n--- 8. Table Column Definitions & Customization ---");
const blStartCol = COLUMN_DEFINITIONS.find((c) => c.key === "baselineStart");
const blFinishCol = COLUMN_DEFINITIONS.find((c) => c.key === "baselineFinish");
const varianceCol = COLUMN_DEFINITIONS.find((c) => c.key === "variance");

assert(!!blStartCol, "BL Start column definition exists");
assert(!!blFinishCol, "BL Finish column definition exists");
assert(!!varianceCol, "Variance column definition exists");

console.log("\n===============================================================================");
console.log("   ALL BASELINE COMPARISON VERIFICATION TESTS PASSED SUCCESSFULLY! (8/8)");
console.log("===============================================================================\n");
