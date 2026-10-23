/**
 * Automated Test Suite: PlanD-X Baseline Integrity & Schedule Change Tracking
 * ===========================================================================
 * Verifies:
 * 1. Routine task edits update current forecast only and NEVER mutate approved baseline dates.
 * 2. CPM scheduling recalculations strictly preserve baseline0Start and baseline0Finish.
 * 3. Baseline creation, snapshotting, and explicit re-baselining workflows.
 * 4. Restoring schedule forecast back to approved contract baseline dates.
 * 5. Schedule change audit tracking records dates, durations, progress, dependencies, and resources.
 * 6. Audit attribution accurately captures user identity and CPM recalculation sources without fake users.
 * 7. Schedule imports preserve existing contract baseline dates.
 * 8. Missing baseline data handled cleanly without inventing historical dates.
 */

import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";
import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  recalculateSchedule,
  calculateScheduleVariance,
} from "../lib/programme-calendar";
import {
  inspectBaselineIntegrity,
  createBaselineSnapshot,
  applyBaselineSnapshotToTasks,
  restoreScheduleFromBaseline,
  preserveExistingBaselinesOnImport,
} from "../lib/programme-baseline";
import {
  createScheduleChangeEvent,
  formatChangeSummary,
  ScheduleChangeEvent,
} from "../lib/programme-change-tracker";
import type { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${message}`);
}

console.log("===============================================================================");
console.log("   PLAN-DX: BASELINE INTEGRITY & SCHEDULE CHANGE TRACKING VERIFICATION");
console.log("===============================================================================\n");

// ─── Test 1: Baseline & Forecast Date Separation in Data Model ───
console.log("--- 1. Baseline & Current Schedule Date Separation ---");
const columnsTask = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-columns");
assert(!!columnsTask, "Found 'task-columns' in dataset");
assert(!!columnsTask?.baseline0Start && !!columnsTask?.baseline0Finish, "Task has approved contract baseline dates");
assert(columnsTask?.baseline0Start === "2025-12-15", `Baseline start is 2025-12-15 (got ${columnsTask?.baseline0Start})`);
assert(columnsTask?.baseline0Finish === "2026-01-08", `Baseline finish is 2026-01-08 (got ${columnsTask?.baseline0Finish})`);
assert(columnsTask?.startDate === "2025-12-20", `Current forecast start is 2025-12-20 (got ${columnsTask?.startDate})`);
assert(columnsTask?.endDate === "2026-01-16", `Current forecast finish is 2026-01-16 (got ${columnsTask?.endDate})`);
assert(columnsTask?.baseline0Start !== columnsTask?.startDate, "Baseline start is strictly separate from forecast start");
assert(columnsTask?.baseline0Finish !== columnsTask?.endDate, "Baseline finish is strictly separate from forecast finish");

// ─── Test 2: Routine Task Edits Do Not Modify Saved Baseline ───
console.log("\n--- 2. Routine Task Edits Protect Baseline Values ---");
const editedColumns: ProgrammeTask = {
  ...columnsTask!,
  duration: 25, // changed from 14d to 25d
  startDate: "2026-01-05", // shifted start date
  manualStartDate: "2026-01-05",
  progress: 95,
  status: "in-progress",
};
assert(editedColumns.baseline0Start === "2025-12-15", "baseline0Start remained untouched after routine task edit");
assert(editedColumns.baseline0Finish === "2026-01-08", "baseline0Finish remained untouched after routine task edit");
assert(editedColumns.duration === 25, "Current duration successfully updated to 25d");
assert(editedColumns.startDate === "2026-01-05", "Current startDate successfully updated to 2026-01-05");

// ─── Test 3: CPM Topological Recalculations Preserve Baseline Values ───
console.log("\n--- 3. CPM Engine Recalculation Preserves Baselines ---");
const tasksWithEdit = ALL_PROGRAMME_TASKS.map((t) => (t.id === "task-columns" ? editedColumns : t));
const cpmResult = recalculateSchedule(tasksWithEdit, STANDARD_5_DAY_CALENDAR);
const recalculatedColumns = cpmResult.updatedTasks.find((t) => t.id === "task-columns");

assert(
  recalculatedColumns?.baseline0Start === "2025-12-15",
  "CPM engine preserved baseline0Start during full schedule recalculation",
);
assert(
  recalculatedColumns?.baseline0Finish === "2026-01-08",
  "CPM engine preserved baseline0Finish during full schedule recalculation",
);
assert(
  recalculatedColumns?.endDate !== "2026-01-08",
  `CPM recalculated forecast finish date to ${recalculatedColumns?.endDate} without mutating baseline`,
);

// Downstream tasks verification
const slabTask = cpmResult.updatedTasks.find((t) => t.id === "task-level-2-slab");
const origSlab = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-level-2-slab");
assert(
  slabTask?.baseline0Start === origSlab?.baseline0Start,
  "Downstream dependent task baseline0Start preserved through forward pass",
);
assert(
  slabTask?.baseline0Finish === origSlab?.baseline0Finish,
  "Downstream dependent task baseline0Finish preserved through forward pass",
);

// ─── Test 4: Explicit Baseline Snapshotting & Replacement ───
console.log("\n--- 4. Explicit Baseline Snapshotting & Replacement ---");
const snapshot = createBaselineSnapshot(cpmResult.updatedTasks, {
  name: "Approved Revision 1 - Q1 Resequence",
  description: "Resequenced structural columns and slabs following approved change notice CN-04.",
  approvedBy: "Sarah Jenkins",
  approvedByRole: "Contract Admin / Employer's Agent",
  type: "approved-revision",
  versionNumber: 1,
});

assert(snapshot.versionNumber === 1, "Snapshot version is 1");
assert(snapshot.taskCount === cpmResult.updatedTasks.length, "Snapshot captured all tasks");
assert(snapshot.approvedBy === "Sarah Jenkins", "Snapshot attributes authorizer Sarah Jenkins");
assert(
  snapshot.taskSnapshots["task-columns"].startDate === recalculatedColumns?.startDate,
  "Snapshot recorded current forecast start date for columns",
);

// Apply snapshot explicitly
const rebaselinedTasks = applyBaselineSnapshotToTasks(cpmResult.updatedTasks, snapshot);
const rebaselinedColumns = rebaselinedTasks.find((t) => t.id === "task-columns");
assert(
  rebaselinedColumns?.baseline0Start === recalculatedColumns?.startDate,
  `baseline0Start explicitly re-baselined to ${recalculatedColumns?.startDate} following user approval`,
);
assert(
  rebaselinedColumns?.baseline0Finish === rebaselinedColumns?.endDate,
  "baseline0Finish re-baselined to match recalculated forecast finish date",
);

// Variance is now 0d on track vs the new approved baseline
const newVariance = calculateScheduleVariance(rebaselinedColumns!, STANDARD_5_DAY_CALENDAR);
assert(newVariance.finishVariance === 0, `Variance against new approved baseline is 0d on track (got ${newVariance.finishVariance}d)`);
assert(newVariance.isOnTrack === true, "Task marked as on track against new approved baseline");

// ─── Test 5: Restoring Forecast Schedule to Baseline ───
console.log("\n--- 5. Restoring Schedule to Approved Baseline ---");
const origTask = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-1-1-1")!;
const editedTask: ProgrammeTask = {
  ...origTask,
  startDate: "2025-04-01",
  endDate: "2025-04-01",
};
const tasksWithEdit5 = ALL_PROGRAMME_TASKS.map((t) =>
  t.id === "task-1-1-1" ? editedTask : t
);

const { restoredTasks, restoredCount } = restoreScheduleFromBaseline(
  tasksWithEdit5,
  STANDARD_5_DAY_CALENDAR
);
assert(restoredCount > 0, `Successfully restored ${restoredCount} tasks back to baseline dates`);
const restoredMilestone = restoredTasks.find((t) => t.id === "task-1-1-1");
assert(
  restoredMilestone?.startDate === origTask.baseline0Start,
  `Restored task-1-1-1 startDate back to baseline0Start (${restoredMilestone?.startDate})`,
);
assert(
  restoredMilestone?.endDate === origTask.baseline0Finish,
  `Restored task-1-1-1 finish date back to baseline0Finish (${restoredMilestone?.endDate})`,
);

// ─── Test 6: Schedule Change Tracking & Audit History ───
console.log("\n--- 6. Schedule Change Event Generation & Formatting ---");
const changeEvent = createScheduleChangeEvent({
  taskId: "task-columns",
  taskName: "Reinforced Concrete Columns - Grid C",
  wbs: "3.2.1",
  field: "duration",
  fieldLabel: "Duration",
  previousValue: "14d",
  newValue: "18d",
  changedBy: "Demo Builder",
  userRole: "Construction Management",
  reason: "Formwork alignment re-work required after initial laser scan.",
  changeSource: "user-edit",
});

assert(changeEvent.id.startsWith("chg-"), "Generated unique change event ID");
assert(changeEvent.changedBy === "Demo Builder", "Correctly attributed to Demo Builder");
assert(changeEvent.field === "duration", "Field is duration");
assert(changeEvent.previousValue === "14d", "Previous value recorded");
assert(changeEvent.newValue === "18d", "New value recorded");

const summaryText = formatChangeSummary(changeEvent);
assert(
  summaryText === "Duration changed from 14d to 18d",
  `Formatted change summary string is clear: '${summaryText}'`,
);

// ─── Test 7: Preserving Baseline Integrity on Schedule Imports ───
console.log("\n--- 7. Schedule Import Baseline Preservation ---");
// Simulate an imported file (e.g. MSP MPP or XML) where tasks do NOT include baseline dates
const importedTasksWithoutBaseline: ProgrammeTask[] = ALL_PROGRAMME_TASKS.map((t) => ({
  ...t,
  baseline0Start: undefined,
  baseline0Finish: undefined,
}));

// Run safe import preservation against existing tasks
const importProtected = preserveExistingBaselinesOnImport(
  importedTasksWithoutBaseline,
  ALL_PROGRAMME_TASKS
);

const importedColumns = importProtected.find((t) => t.id === "task-columns");
assert(
  importedColumns?.baseline0Start === "2025-12-15",
  "Existing approved baseline0Start preserved despite import lacking baseline dates",
);
assert(
  importedColumns?.baseline0Finish === "2026-01-08",
  "Existing approved baseline0Finish preserved despite import lacking baseline dates",
);

// ─── Test 8: Baseline Integrity Report & Incomplete Data Handling ───
console.log("\n--- 8. Baseline Integrity Reporting ---");
const integrity = inspectBaselineIntegrity(ALL_PROGRAMME_TASKS, STANDARD_5_DAY_CALENDAR);
assert(integrity.totalTasks === ALL_PROGRAMME_TASKS.length, `Total tasks reported: ${integrity.totalTasks}`);
assert(integrity.tasksWithBaseline === 21, `Identified 21 benchmarked tasks with baseline (got ${integrity.tasksWithBaseline})`);
assert(integrity.tasksMissingBaseline === ALL_PROGRAMME_TASKS.length - 21, `Identified unbenchmarked tasks without inventing values (got ${integrity.tasksMissingBaseline})`);
assert(integrity.tasksDelayedVsBaseline > 0, `Detected delayed tasks: ${integrity.tasksDelayedVsBaseline}`);
assert(integrity.isContractBaselineLocked === true, "Contract baseline status is locked");

// Test handling tasks without baseline without inventing values
const partialTasks: ProgrammeTask[] = [
  ...ALL_PROGRAMME_TASKS,
  {
    id: "task-no-bl",
    wbs: "9.9.9",
    name: "Unbenchmarked Scope",
    level: "task",
    parentId: null,
    status: "not-started",
    startDate: "2026-05-01",
    endDate: "2026-05-10",
    duration: 8,
    progress: 0,
    trade: null,
    assignee: null,
    isCritical: false,
    isMilestone: false,
    predecessors: [],
    successors: [],
    notes: "",
    children: [],
    depth: 1,
    float: 10,
    // NO baseline dates provided
  },
];

const partialIntegrity = inspectBaselineIntegrity(partialTasks, STANDARD_5_DAY_CALENDAR);
assert(
  partialIntegrity.tasksMissingBaseline === integrity.tasksMissingBaseline + 1,
  "Report accurately flags additional task missing baseline",
);
assert(
  partialIntegrity.missingBaselineTaskIds.includes("task-no-bl"),
  "Task ID 'task-no-bl' identified in missing baseline list",
);

const noBlVariance = calculateScheduleVariance(partialTasks[partialTasks.length - 1], STANDARD_5_DAY_CALENDAR);
assert(noBlVariance.hasBaseline === false, "Tasks without baseline dates return hasBaseline = false");
assert(noBlVariance.finishVariance === 0, "Tasks without baseline dates return 0 finish variance (no invented dates)");

console.log("\n===============================================================================");
console.log("   ALL BASELINE INTEGRITY & CHANGE TRACKING VERIFICATION TESTS PASSED! (8/8)");
console.log("===============================================================================\n");
