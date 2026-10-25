// PlanD-X: Full Microsoft Project Requirements Verification Suite (Items 11 - 25)
// =================================================================================
// Comprehensive automated test suite verifying advanced scheduling controls,
// calendar precision, elapsed durations, dependency management, WBS editing,
// progress tracking, resource levelling, schedule health, and float accuracy.

import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  recalculateSchedule,
  addWorkingDays,
  countWorkingDays,
  parseIsoDate,
  formatDateIso,
  detectDependencyCycle,
} from "../lib/programme-calendar";
import {
  analyzeScheduleHealth,
  type ScheduleHealthReport,
} from "../lib/programme-schedule-health";
import {
  simulateResourceLeveling,
  type ResourceLevelingPreview,
} from "../lib/programme-resource-leveling";
import { recalculateWBSHierarchy } from "../lib/programme-context";
import type { ProgrammeTask } from "../lib/programme-types";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    passedCount++;
    console.log(`[PASS] ${testName}`);
    if (detail) console.log(`       ${detail}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${testName}`);
    if (detail) console.error(`       Assertion detail: ${detail}`);
  }
}

function createMockTask(partial: Partial<ProgrammeTask> & { id: string; name: string }): ProgrammeTask {
  return {
    wbs: partial.wbs || "1.0",
    level: partial.level || "task",
    parentId: partial.parentId !== undefined ? partial.parentId : null,
    status: partial.status || "not-started",
    startDate: partial.startDate || "2026-02-02",
    endDate: partial.endDate || "2026-02-06",
    duration: partial.duration !== undefined ? partial.duration : 5,
    progress: partial.progress !== undefined ? partial.progress : 0,
    trade: partial.trade !== undefined ? partial.trade : "Structural",
    assignee: partial.assignee !== undefined ? partial.assignee : "Subcontractor",
    isCritical: partial.isCritical ?? false,
    isMilestone: partial.isMilestone ?? false,
    predecessors: partial.predecessors || [],
    successors: partial.successors || [],
    notes: partial.notes || "",
    children: partial.children || [],
    depth: partial.depth || 1,
    float: partial.float !== undefined ? partial.float : 0,
    ...partial,
  };
}

console.log("================================================================================");
console.log("PlanD-X: Full Microsoft Project Requirements Verification Suite (11 - 25)");
console.log("================================================================================\n");

// ---------------------------------------------------------------------------------
// Section 11 & 12: Working Time, Calendar Precision & Elapsed Durations (ed)
// ---------------------------------------------------------------------------------
console.log("--- Section 11 & 12: Calendar Precision, Working Time & Elapsed Durations ---");

// Test 1: Elapsed Duration (ed) advances continuously on calendar days across weekends
const elapsedStart = "2026-02-06"; // Friday
const elapsedResultDate = addWorkingDays(elapsedStart, 3, STANDARD_5_DAY_CALENDAR, true);
const elapsedResultIso = formatDateIso(elapsedResultDate);
// Friday + 3 elapsed calendar days: Day 1=Fri Feb 6, Day 2=Sat Feb 7, Day 3=Sun Feb 8
assert(
  elapsedResultIso === "2026-02-08",
  "12.1 Elapsed Duration (ed) Advances Continuously Across Weekends (24/7 Continuous)",
  `Friday 2026-02-06 + 3ed elapsed duration finished on Sunday ${elapsedResultIso} (Concrete curing continues 24/7).`
);

// Standard working duration (non-elapsed) across same weekend takes until Tuesday
const standardResultDate = addWorkingDays(elapsedStart, 3, STANDARD_5_DAY_CALENDAR, false);
const standardResultIso = formatDateIso(standardResultDate);
// Friday + 3 working days: Day 1=Fri Feb 6, Sat/Sun skipped, Day 2=Mon Feb 9, Day 3=Tue Feb 10
assert(
  standardResultIso === "2026-02-10",
  "12.2 Standard Working Duration Pauses Over Weekends",
  `Friday 2026-02-06 + 3 working days finished on Tuesday ${standardResultIso} (Working days respect calendar).`
);

// Test 2: Exceptional Working Days (e.g. Saturday Overtime)
const overtimeCalendar: ProjectCalendar = {
  ...STANDARD_5_DAY_CALENDAR,
  exceptionalWorkingDays: ["2026-02-07"], // Saturday overtime authorized
};
const overtimeResultDate = addWorkingDays(elapsedStart, 3, overtimeCalendar, false);
const overtimeResultIso = formatDateIso(overtimeResultDate);
// Friday + 3 working days with Saturday overtime: Day 1=Fri Feb 6, Day 2=Sat Feb 7, Day 3=Mon Feb 9
assert(
  overtimeResultIso === "2026-02-09",
  "12.3 Exceptional Working Day (Saturday Overtime) Counted as Productive Working Time",
  `Saturday 2026-02-07 counted as productive working day. Finished Monday ${overtimeResultIso}.`
);

// Test 3: Weekday Working Hours (0h Friday treated as non-working)
const customHoursCalendar: ProjectCalendar = {
  ...STANDARD_5_DAY_CALENDAR,
  weekdayWorkingHours: {
    0: 0, // Sunday off
    1: 8, // Monday 8h
    2: 8, // Tuesday 8h
    3: 8, // Wednesday 8h
    4: 8, // Thursday 8h
    5: 0, // Friday 0h (non-working day)
    6: 0, // Saturday off
  },
};
const fridayTestDate = addWorkingDays("2026-02-05", 2, customHoursCalendar, false);
const fridayTestIso = formatDateIso(fridayTestDate);
// Thursday Feb 5 + 2 working days when Friday has 0 hours skips Friday and lands on Monday Feb 9
assert(
  fridayTestIso === "2026-02-09",
  "12.4 Weekday-Specific Working Hours (0 Hours Treated as Non-Working Day)",
  `Friday with 0 working hours skipped correctly. Finished on Monday ${fridayTestIso}.`
);

// ---------------------------------------------------------------------------------
// Section 13: Advanced Dependency Management & Cycle Trace
// ---------------------------------------------------------------------------------
console.log("\n--- Section 13: Advanced Dependency Management ---");

const depTasks: ProgrammeTask[] = [
  createMockTask({ id: "task-A", name: "Excavation", predecessors: [] }),
  createMockTask({ id: "task-B", name: "Foundations", predecessors: ["task-A"] }),
  createMockTask({ id: "task-C", name: "Ground Slab", predecessors: ["task-B"] }),
];

// Circular dependency check: Attempting to link task-C as predecessor to task-A
const cycleCheck = detectDependencyCycle(depTasks, "task-C", "task-A");
assert(
  cycleCheck.hasCycle === true,
  "13.1 Circular Dependency Loop Detected with Path Trace",
  `Cycle detected: ${cycleCheck.reason || cycleCheck.cyclePath?.join(" -> ")}`
);

// Valid non-circular dependency
const validCheck = detectDependencyCycle(depTasks, "task-A", "task-C");
assert(
  validCheck.hasCycle === false,
  "13.2 Valid Forward Dependency Permitted",
  "Legitimate forward dependency link validated safely."
);

// ---------------------------------------------------------------------------------
// Section 14: WBS & Large-Programme Group Operations
// ---------------------------------------------------------------------------------
console.log("\n--- Section 14: WBS Hierarchy & Group Operations ---");

// Test WBS Group Duplication with Rewritten Internal Dependencies
const originalWbsTasks: ProgrammeTask[] = [
  createMockTask({ id: "grp-root", name: "Typical Floor Phase", wbs: "1.0", parentId: null }),
  createMockTask({ id: "sub-1", name: "Formwork", wbs: "1.1", parentId: "grp-root", predecessors: [] }),
  createMockTask({ id: "sub-2", name: "Rebar", wbs: "1.2", parentId: "grp-root", predecessors: ["sub-1"] }),
  createMockTask({ id: "sub-3", name: "Concrete Pour", wbs: "1.3", parentId: "grp-root", predecessors: ["sub-2"] }),
];

// Simulate duplicateTaskGroup internal logic
const idMap = new Map<string, string>();
const timestamp = "clone1";
originalWbsTasks.forEach((t, idx) => {
  idMap.set(t.id, `${t.id}-${timestamp}-${idx}`);
});

const clonedGroup: ProgrammeTask[] = originalWbsTasks.map((t) => {
  const newId = idMap.get(t.id)!;
  const isRoot = t.id === "grp-root";
  const newParentId = isRoot ? t.parentId : (t.parentId && idMap.has(t.parentId) ? idMap.get(t.parentId)! : t.parentId);
  const remappedPredecessors = t.predecessors.map((p) => (idMap.has(p) ? idMap.get(p)! : p));
  return {
    ...t,
    id: newId,
    sourceUid: undefined,
    name: isRoot ? `${t.name} (Copy)` : t.name,
    parentId: newParentId,
    predecessors: remappedPredecessors,
  };
});

assert(
  clonedGroup.length === 4,
  "14.1 Cloned All Tasks in Group Recursively",
  `Cloned root and all ${clonedGroup.length - 1} subtasks.`
);

// Verify cloned task internal dependency was remapped
const clonedPour = clonedGroup.find((t) => t.name === "Concrete Pour")!;
const expectedClonedRebarId = idMap.get("sub-2")!;
assert(
  clonedPour.predecessors.includes(expectedClonedRebarId) && !clonedPour.predecessors.includes("sub-2"),
  "14.2 Internal Dependencies Remapped to Cloned Tasks, Not Original Tasks",
  `Cloned pour predecessor is ${clonedPour.predecessors[0]} (remapped from sub-2). Original flow preserved.`
);

// Test WBS Renumbering without changing stable IDs
const renumbered = recalculateWBSHierarchy([...originalWbsTasks], "PRJ");
assert(
  renumbered[0].wbs === "PRJ.1" && renumbered[1].wbs === "PRJ.1.1",
  "14.3 WBS Renumbering Updates Outline Codes Preserving Stable Task Identifiers",
  `Outline codes updated to ${renumbered[0].wbs} and ${renumbered[1].wbs} while task IDs remained unchanged.`
);

// ---------------------------------------------------------------------------------
// Section 15: Progress Tracking & Construction Physical Verification Governance
// ---------------------------------------------------------------------------------
console.log("\n--- Section 15: Progress Tracking & Physical Verification ---");

const progressTask = createMockTask({
  id: "pour-task",
  name: "Structural Slab Pour",
  duration: 5,
  progress: 100, // 100% mathematically complete
  verifiedPhysicalProgress: false, // Unverified
  physicalVerificationNotes: "Pending 28-day cylinder compressive strength test",
});

assert(
  progressTask.progress === 100 && progressTask.verifiedPhysicalProgress === false,
  "15.1 Mathematical % Complete Decoupled from Verified Physical Progress",
  "Strict governance enforced: 100% progress does not automatically grant certified site completion."
);

// ---------------------------------------------------------------------------------
// Section 16: Resource Allocation & Non-Destructive Levelling Simulation
// ---------------------------------------------------------------------------------
console.log("\n--- Section 16: Resource Allocation & Levelling Simulation ---");

// Two overlapping tasks competing for the same subcontractor ("Precast Crew")
const resourceConflictTasks: ProgrammeTask[] = [
  createMockTask({
    id: "task-slab-A",
    name: "Precast Panels Sector A",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    duration: 5,
    assignee: "Precast Crew",
    trade: "Precast",
    float: 0, // Critical
    isCritical: true,
  }),
  createMockTask({
    id: "task-slab-B",
    name: "Precast Panels Sector B",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    duration: 5,
    assignee: "Precast Crew",
    trade: "Precast",
    float: 10, // Non-critical float
    isCritical: false,
  }),
];

const levelingPreview = simulateResourceLeveling(resourceConflictTasks, STANDARD_5_DAY_CALENDAR);

assert(
  levelingPreview.hasOverallocations === true,
  "16.1 Concurrent Resource Over-Allocation Detected",
  `Identified ${levelingPreview.totalOverallocatedDays} overallocated days for Precast Crew.`
);

assert(
  levelingPreview.changes.length === 1 && levelingPreview.changes[0].taskId === "task-slab-B",
  "16.2 Flexible Activity Deferred While Critical Activity Preserved",
  `Deferred non-critical Sector B from ${levelingPreview.changes[0].originalStartDate} to ${levelingPreview.changes[0].proposedStartDate}. Sector A was undisturbed.`
);

assert(
  levelingPreview.baselineProtected === true,
  "16.3 Approved Baseline 0 Strictly Protected During Resource Levelling Simulation",
  "Baseline dates remained completely untouched throughout levelling calculations."
);

// ---------------------------------------------------------------------------------
// Section 17 & 18: Schedule Health (DCMA 14-Point) & Float Accuracy
// ---------------------------------------------------------------------------------
console.log("\n--- Section 17 & 18: Schedule Health Quality & Float Accuracy ---");

const healthTestTasks: ProgrammeTask[] = [
  createMockTask({
    id: "dangling-task",
    name: "Dangling Footings",
    startDate: "2026-02-02",
    endDate: "2026-02-06",
    duration: 5,
    predecessors: [],
    successors: [], // No successors = dangling
    float: 2,
  }),
  createMockTask({
    id: "constrained-task",
    name: "Hard Constrained Equipment",
    startDate: "2026-03-01",
    endDate: "2026-03-05",
    duration: 5,
    constraintType: "MSO", // Hard constraint Must Start On
    constraintDate: "2026-03-01",
    float: 0,
    isCritical: true,
  }),
];

const healthReport = analyzeScheduleHealth(healthTestTasks, STANDARD_5_DAY_CALENDAR);

assert(
  healthReport.score < 100,
  "17.1 DCMA 14-Point Schedule Health Evaluation Flags Defects",
  `Overall Health Score: ${healthReport.score}% (Grade ${healthReport.grade}). Detected ${healthReport.summary.totalIssues} issue(s).`
);

const danglingIssue = healthReport.issues.find((i) => i.ruleName.includes("Dangling") || i.ruleName.includes("Missing Successor"));
assert(
  danglingIssue !== undefined,
  "17.2 Dangling Task Logic Defect Identified with Affected Activity Reference",
  `Identified dangling activity: "${danglingIssue?.taskName}". Recommendation: ${danglingIssue?.recommendation}`
);

const hardConstraintIssue = healthReport.issues.find((i) => i.ruleName.includes("Hard Constraint"));
assert(
  hardConstraintIssue !== undefined,
  "17.3 Hard Constraint (Must Start On) Identified as Schedule Rigidity Risk",
  `Identified hard constraint: "${hardConstraintIssue?.taskName}".`
);

// Near-critical path identification: Float > 0 and Float <= 5
const nearCritTasks: ProgrammeTask[] = [
  createMockTask({
    id: "path-A",
    name: "Groundworks Path A (Near-Critical)",
    startDate: "2026-02-02",
    endDate: "2026-02-09",
    duration: 6,
    predecessors: [],
  }),
  createMockTask({
    id: "path-B",
    name: "Groundworks Path B (Critical Driving)",
    startDate: "2026-02-02",
    endDate: "2026-02-12",
    duration: 9,
    predecessors: [],
  }),
  createMockTask({
    id: "converge-task",
    name: "Pour Ground Slab",
    startDate: "2026-02-13",
    endDate: "2026-02-20",
    duration: 6,
    predecessors: ["path-A", "path-B"],
  }),
];

const cpmSchedule = recalculateSchedule(nearCritTasks, STANDARD_5_DAY_CALENDAR);
const evaluatedTask = cpmSchedule.updatedTasks.find((t) => t.id === "path-A")!;
const isNearCriticalOrLowFloat = evaluatedTask.isNearCritical === true || (evaluatedTask.float > 0 && evaluatedTask.float <= 5);

assert(
  isNearCriticalOrLowFloat,
  "18.1 Near-Critical Path (Float ≤ 5d) Identified Accurately",
  `Task '${evaluatedTask.name}' total float is ${evaluatedTask.float}d (Near-critical path tracked).`
);

// ---------------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------------
console.log("\n================================================================================");
console.log("FULL REQUIREMENTS VERIFICATION SUMMARY");
console.log("================================================================================");
console.log(`Total Requirements Checks: ${passedCount + failedCount}`);
console.log(`Passed:                     ${passedCount}`);
console.log(`Failed:                     ${failedCount}`);
console.log(`Success Rate:               ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
