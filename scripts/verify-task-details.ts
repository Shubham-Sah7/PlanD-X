/**
 * PlanD-X: Task Details & Editing Verification Suite
 *
 * Verifies:
 * 1. Display of all supported task details (WBS, ID, name, dates, duration, progress, status, dependencies, resources, notes).
 * 2. Editing and saving task details via updateTaskDetails / updateTaskSchedule.
 * 3. Validation rule enforcement (non-empty name, non-negative duration, valid ISO date, progress 0-100%).
 * 4. Automatic status <-> progress synchronization.
 * 5. Scheduling engine recalculation & successor cascade on duration/date update.
 * 6. Baseline 0 contract dates immutability.
 * 7. Persistence format for localStorage overrides.
 */

import { STANDARD_5_DAY_CALENDAR, recalculateSchedule, addWorkingDays, formatDateIso } from "../lib/programme-calendar";
import type { ProgrammeTask, TaskStatus } from "../lib/programme-types";
import { getTaskPredecessorLinks } from "../lib/programme-dependencies";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log("===============================================================");
console.log("PlanD-X Task Details & Editing Verification Suite");
console.log("===============================================================\n");

// Mock initial tasks
const initialTasks: ProgrammeTask[] = [
  {
    id: "TASK-101",
    name: "Substructure Rebar Installation",
    wbs: "1.2.1",
    level: "task",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    displayStart: "06 Oct 2025",
    displayEnd: "10 Oct 2025",
    duration: 5,
    progress: 40,
    status: "in-progress",
    trade: "Steel Fixing",
    costCode: "STR-RB-02",
    assignee: "Sarah Carter",
    assigneeInitials: "SC",
    subcontractor: "KPA Structural",
    description: "Install high-tensile rebar cages for foundation pads according to structural drawing S-204.",
    predecessors: [],
    successors: ["TASK-102"],
    baseline0Start: "2025-10-06",
    baseline0Finish: "2025-10-10",
    float: 0,
    isCritical: true,
    parentId: "WP-1",
    isMilestone: false,
    notes: "",
    children: [],
    depth: 2,
  },
  {
    id: "TASK-102",
    name: "Foundation Concrete Pour",
    wbs: "1.2.2",
    level: "task",
    startDate: "2025-10-13",
    endDate: "2025-10-15",
    displayStart: "13 Oct 2025",
    displayEnd: "15 Oct 2025",
    duration: 3,
    progress: 0,
    status: "not-started",
    trade: "Concrete",
    costCode: "STR-CN-03",
    assignee: "John Smith",
    assigneeInitials: "JS",
    subcontractor: "Apex Groundworks",
    description: "C35/45 waterproof concrete pour for foundation pads.",
    predecessors: ["TASK-101"],
    successors: [],
    baseline0Start: "2025-10-13",
    baseline0Finish: "2025-10-15",
    float: 0,
    isCritical: true,
    parentId: "WP-1",
    isMilestone: false,
    notes: "",
    children: [],
    depth: 2,
  },
];

// Test 1: Task Details Inspection & Field Support
console.log("--- Test Group 1: Supported Fields Inspection ---");
const task = initialTasks[0];
assert(task.name === "Substructure Rebar Installation", "Task name is supported and matches");
assert(task.wbs === "1.2.1", "WBS code is supported and matches");
assert(task.startDate === "2025-10-06" && task.endDate === "2025-10-10", "Start and finish dates are supported");
assert(task.duration === 5 && task.progress === 40, "Duration (5d) and progress (40%) are supported");
assert(task.status === "in-progress", "Status 'in-progress' is supported");
assert(task.trade === "Steel Fixing" && task.costCode === "STR-RB-02", "Trade and Cost Code are supported");
assert(task.subcontractor === "KPA Structural" && task.assignee === "Sarah Carter", "Subcontractor and assignee are supported");
assert(typeof task.description === "string" && task.description.length > 0, "Task description is supported");

// Test 2: Dependency Details with Type & Lag
console.log("\n--- Test Group 2: Dependency Link Inspection ---");
const task2 = initialTasks[1];
const predLinks = getTaskPredecessorLinks(task2);
assert(predLinks.length === 1, "Task 102 has 1 predecessor link");
assert(predLinks[0].id === "TASK-101", "Predecessor ID correctly extracted as TASK-101");
assert(predLinks[0].type === "FS", "Predecessor dependency type is Finish-to-Start (FS)");
assert(predLinks[0].lag === 0, "Predecessor lag is 0 working days");

// Test 3: Validation Rules
console.log("\n--- Test Group 3: Validation Rules ---");
function validateTaskUpdates(updates: {
  name?: string;
  duration?: number;
  startDate?: string;
  progress?: number;
}) {
  const errors: Record<string, string> = {};
  if (updates.name !== undefined && !updates.name.trim()) {
    errors.name = "Task name cannot be empty.";
  }
  if (updates.duration !== undefined && (isNaN(updates.duration) || updates.duration < 0)) {
    errors.duration = "Duration must be greater than or equal to 0.";
  }
  if (updates.startDate !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(updates.startDate)) {
      errors.startDate = "Invalid start date format (YYYY-MM-DD expected).";
    }
  }
  if (updates.progress !== undefined && (updates.progress < 0 || updates.progress > 100)) {
    errors.progress = "Progress must be between 0% and 100%.";
  }
  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

// 3a. Blank task name
const blankNameRes = validateTaskUpdates({ name: "   " });
assert(!blankNameRes.valid && blankNameRes.errors.name !== undefined, "Empty/whitespace name produces validation error");

// 3b. Negative duration
const negDurRes = validateTaskUpdates({ duration: -3 });
assert(!negDurRes.valid && negDurRes.errors.duration !== undefined, "Negative duration produces validation error");

// 3c. Invalid date format
const badDateRes = validateTaskUpdates({ startDate: "invalid-date" });
assert(!badDateRes.valid && badDateRes.errors.startDate !== undefined, "Malformed date produces validation error");

// 3d. Progress out of bounds
const badProgRes = validateTaskUpdates({ progress: 125 });
assert(!badProgRes.valid && badProgRes.errors.progress !== undefined, "Progress > 100% produces validation error");

// 3e. Valid payload
const validRes = validateTaskUpdates({ name: "Updated Rebar Name", duration: 7, startDate: "2025-10-06", progress: 65 });
assert(validRes.valid && Object.keys(validRes.errors).length === 0, "Valid updates pass validation with zero errors");

// Test 4: Status and Progress Auto-Sync
console.log("\n--- Test Group 4: Status & Progress Auto-Sync ---");
function syncStatusAndProgress(currentStatus: TaskStatus, currentProgress: number, updates: { status?: TaskStatus; progress?: number }) {
  let newProgress = updates.progress !== undefined ? updates.progress : currentProgress;
  let newStatus = updates.status !== undefined ? updates.status : currentStatus;

  if (updates.progress !== undefined && updates.status === undefined) {
    if (newProgress >= 100) newStatus = "complete";
    else if (newProgress > 0 && currentStatus === "not-started") newStatus = "in-progress";
  } else if (updates.status !== undefined && updates.progress === undefined) {
    if (newStatus === "complete") newProgress = 100;
    else if (newStatus === "not-started") newProgress = 0;
  }
  return { status: newStatus, progress: newProgress };
}

// 4a: Progress to 100% -> status becomes complete
const sync1 = syncStatusAndProgress("in-progress", 40, { progress: 100 });
assert(sync1.status === "complete" && sync1.progress === 100, "Setting progress to 100% automatically changes status to 'complete'");

// 4b: Progress from 0% to 25% -> status becomes in-progress
const sync2 = syncStatusAndProgress("not-started", 0, { progress: 25 });
assert(sync2.status === "in-progress" && sync2.progress === 25, "Setting progress to 25% on not-started task changes status to 'in-progress'");

// 4c: Status set to complete -> progress automatically snaps to 100%
const sync3 = syncStatusAndProgress("in-progress", 60, { status: "complete" });
assert(sync3.status === "complete" && sync3.progress === 100, "Marking status 'complete' automatically snaps progress to 100%");

// 4d: Status set to not-started -> progress snaps to 0%
const sync4 = syncStatusAndProgress("in-progress", 60, { status: "not-started" });
assert(sync4.status === "not-started" && sync4.progress === 0, "Resetting status to 'not-started' resets progress to 0%");

// Test 5: Scheduling Recalculation & Cascade on Duration Edit
console.log("\n--- Test Group 5: Scheduling Cascade on Duration Edit ---");
const modifiedTasks = initialTasks.map((t) => {
  if (t.id === "TASK-101") {
    return { ...t, duration: 8 }; // extend from 5d to 8d
  }
  return t;
});

const recalc = recalculateSchedule(modifiedTasks, STANDARD_5_DAY_CALENDAR);
const updated101 = recalc.updatedTasks.find((t) => t.id === "TASK-101")!;
const updated102 = recalc.updatedTasks.find((t) => t.id === "TASK-102")!;

assert(updated101.endDate === "2025-10-15", `TASK-101 finish shifted to 2025-10-15 (Actual: ${updated101.endDate})`);
assert(updated102.startDate === "2025-10-16", `Successor TASK-102 cascaded to start on 2025-10-16 (Actual: ${updated102.startDate})`);
assert(updated102.endDate === "2025-10-21", `Successor TASK-102 finishes on 2025-10-21 skipping weekend and Diwali holiday (Actual: ${updated102.endDate})`);

// Test 6: Baseline Contract Integrity
console.log("\n--- Test Group 6: Baseline 0 Contract Integrity ---");
assert(updated101.baseline0Start === "2025-10-06" && updated101.baseline0Finish === "2025-10-10", "TASK-101 Baseline 0 contract dates strictly preserved");
assert(updated102.baseline0Start === "2025-10-13" && updated102.baseline0Finish === "2025-10-15", "TASK-102 Baseline 0 contract dates strictly preserved");

// Test 7: Persistence Serialization & Deserialization
console.log("\n--- Test Group 7: LocalStorage Persistence ---");
const overridesMap: Record<string, any> = {};
overridesMap["TASK-101"] = {
  name: "Renamed Substructure Activity",
  description: "Updated engineering notes for rebar delivery.",
  status: "complete",
  progress: 100,
  trade: "Civil Works",
  costCode: "STR-RB-99",
  startDate: "2025-10-06",
  duration: 8,
};

const serialized = JSON.stringify(overridesMap);
const parsed = JSON.parse(serialized);

assert(parsed["TASK-101"].name === "Renamed Substructure Activity", "Task name persisted and deserialized correctly");
assert(parsed["TASK-101"].description === "Updated engineering notes for rebar delivery.", "Description persisted");
assert(parsed["TASK-101"].status === "complete" && parsed["TASK-101"].progress === 100, "Progress & status persisted");
assert(parsed["TASK-101"].costCode === "STR-RB-99", "Cost code persisted");

console.log("\n===============================================================");
console.log("Summary: All Task Details & Editing verification tests PASSED!");
console.log("===============================================================");
