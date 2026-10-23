import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  CONTINUOUS_7_DAY_CALENDAR,
  formatDateIso,
  parseIsoDate,
  formatDisplayDate,
  addWorkingDays,
  countWorkingDays,
  getNextWorkingDay,
  shiftByWorkingDays,
  recalculateSchedule,
  type ProjectCalendar,
} from "../lib/programme-calendar";
import {
  linkTasks,
  unlinkTasks,
  validateDependency,
  wouldCreateCircularDependency,
} from "../lib/programme-dependencies";
import { type ProgrammeTask } from "../lib/programme-types";

console.log("===============================================================");
console.log("PlanD-X Programme Scheduling Engine Verification Suite");
console.log("===============================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  totalTests++;
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    if (details) console.log(`   ${details}`);
    passedTests++;
  } else {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   ${details}`);
    process.exitCode = 1;
  }
}

function createTestHarness(): ProgrammeTask[] {
  return [
    {
      id: "PHASE-1",
      name: "Substructure Phase",
      wbs: "1.0",
      level: "phase",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-24",
      duration: 15,
      progress: 40,
      trade: null,
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: ["WP-1", "TASK-UNRELATED"],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-24",
    },
    {
      id: "WP-1",
      name: "Groundworks Package",
      wbs: "1.1",
      level: "work-package",
      parentId: "PHASE-1",
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-17",
      duration: 10,
      progress: 50,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: ["TASK-A", "TASK-B", "TASK-C"],
      depth: 1,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-17",
    },
    // TASK-A: Mon Oct 06 to Fri Oct 10 (5 working days)
    {
      id: "TASK-A",
      name: "Excavation",
      wbs: "1.1.1",
      level: "task",
      parentId: "WP-1",
      status: "complete",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 100,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: ["TASK-B"],
      notes: "",
      children: [],
      depth: 2,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-10",
    },
    // TASK-B: Successor to TASK-A (FS 0 lag)
    {
      id: "TASK-B",
      name: "Piling Mat",
      wbs: "1.1.2",
      level: "task",
      parentId: "WP-1",
      status: "not-started",
      startDate: "2025-10-13",
      endDate: "2025-10-15",
      duration: 3,
      progress: 0,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: ["TASK-A"],
      successors: ["TASK-C"],
      notes: "",
      children: [],
      depth: 2,
      float: 0,
      baseline0Start: "2025-10-13",
      baseline0Finish: "2025-10-15",
    },
    // TASK-C: Successor to TASK-B (FS 0 lag)
    {
      id: "TASK-C",
      name: "Pile Cropping",
      wbs: "1.1.3",
      level: "task",
      parentId: "WP-1",
      status: "not-started",
      startDate: "2025-10-16",
      endDate: "2025-10-17",
      duration: 2,
      progress: 0,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: ["TASK-B"],
      successors: [],
      notes: "",
      children: [],
      depth: 2,
      float: 0,
      baseline0Start: "2025-10-16",
      baseline0Finish: "2025-10-17",
    },
    // TASK-UNRELATED: Parallel independent activity with no dependency link to A, B, or C
    {
      id: "TASK-UNRELATED",
      name: "Boundary Hoarding Maintenance",
      wbs: "1.2",
      level: "task",
      parentId: "PHASE-1",
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-09",
      duration: 4,
      progress: 0,
      trade: "Management",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 1,
      float: 10,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-09",
    },
  ];
}

// -----------------------------------------------------------------
// Test 1: Duration update recalculates finish date correctly
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  // Change TASK-A duration from 5d to 8d
  const target = tasks.find((t) => t.id === "TASK-A")!;
  target.duration = 8;

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const updatedA = result.updatedTasks.find((t) => t.id === "TASK-A")!;

  // Mon Oct 06 + 8 working days:
  // Mon 6 (1), Tue 7 (2), Wed 8 (3), Thu 9 (4), Fri 10 (5),
  // Sat/Sun skipped, Mon 13 (6), Tue 14 (7), Wed 15 (8)
  assert(
    updatedA.endDate === "2025-10-15",
    "Test 1: Updating duration (5d -> 8d) recalculates finish date correctly skipping weekend",
    `TASK-A finish date: ${updatedA.endDate} (Expected: 2025-10-15)`
  );
}

// -----------------------------------------------------------------
// Test 2: Start date change respects calendar and snaps non-working days
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  const target = tasks.find((t) => t.id === "TASK-UNRELATED")!;
  // Set start date to Saturday 2025-10-18 (Weekend)
  target.manualStartDate = "2025-10-18";
  target.startDate = "2025-10-18";

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const updatedUnrelated = result.updatedTasks.find((t) => t.id === "TASK-UNRELATED")!;

  // Oct 18 (Sat) -> Oct 19 (Sun) -> Oct 20 (Diwali Public Holiday) -> Oct 21 (Tue)
  assert(
    updatedUnrelated.startDate === "2025-10-21",
    "Test 2: Setting start date on Saturday snaps across weekend and Diwali holiday to Tuesday",
    `TASK-UNRELATED start date: ${updatedUnrelated.startDate} (Expected: 2025-10-21)`
  );
}

// -----------------------------------------------------------------
// Test 3: FS dependency propagation cascades to successor chain
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  const targetA = tasks.find((t) => t.id === "TASK-A")!;
  // Extend TASK-A to 8 days (finishes Wed Oct 15)
  targetA.duration = 8;

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const updatedB = result.updatedTasks.find((t) => t.id === "TASK-B")!;
  const updatedC = result.updatedTasks.find((t) => t.id === "TASK-C")!;

  // TASK-B depends on TASK-A (FS 0 lag):
  // Starts Thu Oct 16. Duration 3 working days:
  // Thu 16 (1), Fri 17 (2), Sat/Sun skip, Mon 20 Diwali holiday skip, Tue 21 (3)
  assert(
    updatedB.startDate === "2025-10-16" && updatedB.endDate === "2025-10-21",
    "Test 3a: Successor TASK-B automatically shifts to start day after predecessor finish",
    `TASK-B: ${updatedB.startDate} to ${updatedB.endDate} (Expected: 2025-10-16 to 2025-10-21)`
  );

  // TASK-C depends on TASK-B (FS 0 lag):
  // Starts Wed Oct 22. Duration 2 working days:
  // Wed 22 (1), Thu 23 (2)
  assert(
    updatedC.startDate === "2025-10-22" && updatedC.endDate === "2025-10-23",
    "Test 3b: Second successor TASK-C ripples forward correctly",
    `TASK-C: ${updatedC.startDate} to ${updatedC.endDate} (Expected: 2025-10-22 to 2025-10-23)`
  );
}

// -----------------------------------------------------------------
// Test 4: Unrelated tasks remain completely unaffected by schedule updates
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  const origUnrelated = { ...tasks.find((t) => t.id === "TASK-UNRELATED")! };

  // Update TASK-A
  const targetA = tasks.find((t) => t.id === "TASK-A")!;
  targetA.duration = 10;

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const updatedUnrelated = result.updatedTasks.find((t) => t.id === "TASK-UNRELATED")!;

  assert(
    updatedUnrelated.startDate === origUnrelated.startDate &&
      updatedUnrelated.endDate === origUnrelated.endDate &&
      updatedUnrelated.duration === origUnrelated.duration,
    "Test 4: Unrelated task dates remain 100% unchanged during dependency propagation",
    `TASK-UNRELATED stayed: ${updatedUnrelated.startDate} to ${updatedUnrelated.endDate}`
  );
}

// -----------------------------------------------------------------
// Test 5: Contract baseline dates remain strictly immutable
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  const baselineA = tasks.find((t) => t.id === "TASK-A")!.baseline0Start;
  const baselineB = tasks.find((t) => t.id === "TASK-B")!.baseline0Finish;

  // Massive duration disruption
  tasks.find((t) => t.id === "TASK-A")!.duration = 25;
  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);

  const updatedA = result.updatedTasks.find((t) => t.id === "TASK-A")!;
  const updatedB = result.updatedTasks.find((t) => t.id === "TASK-B")!;

  assert(
    updatedA.baseline0Start === baselineA && updatedB.baseline0Finish === baselineB,
    "Test 5: Baseline 0 contract dates are protected and unchanged during recalculation",
    `A baseline: ${updatedA.baseline0Start}, B baseline: ${updatedB.baseline0Finish}`
  );
}

// -----------------------------------------------------------------
// Test 6: Bottom-Up Summary Rollups (Work Packages & Phases)
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  // Extend TASK-A duration to 8 days (finishes Wed Oct 15)
  // TASK-B becomes Oct 16 - Oct 21
  // TASK-C becomes Oct 22 - Oct 23
  tasks.find((t) => t.id === "TASK-A")!.duration = 8;

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const wp = result.updatedTasks.find((t) => t.id === "WP-1")!;
  const phase = result.updatedTasks.find((t) => t.id === "PHASE-1")!;

  // WP-1 encompasses TASK-A, B, C (from 2025-10-06 to 2025-10-23)
  assert(
    wp.startDate === "2025-10-06" && wp.endDate === "2025-10-23",
    "Test 6a: Work Package rolls up earliest start and latest finish of all child tasks",
    `WP-1: ${wp.startDate} to ${wp.endDate} (${wp.duration} working days)`
  );

  // PHASE-1 encompasses WP-1 (Oct 06-23) and TASK-UNRELATED (Oct 06-09)
  assert(
    phase.startDate === "2025-10-06" && phase.endDate === "2025-10-23",
    "Test 6b: Parent Phase rolls up earliest start and latest finish of all children",
    `PHASE-1: ${phase.startDate} to ${phase.endDate} (${phase.duration} working days)`
  );
}

// -----------------------------------------------------------------
// Test 7: Dependency Types SS, FF, SF with lag and lead
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  // 7a: Start-to-Start with +2 working days lag
  const linkResSS = linkTasks(tasks, "TASK-A", "TASK-B", "SS", 2, STANDARD_5_DAY_CALENDAR);
  const taskB_SS = linkResSS.updatedTasks.find((t) => t.id === "TASK-B")!;

  // TASK-A starts Mon Oct 06. +2 working days:
  // Mon 6 (0), Tue 7 (1), Wed 8 (2) => Starts Wed Oct 08
  assert(
    taskB_SS.startDate === "2025-10-08",
    "Test 7a: Start-to-Start (SS) with +2 working days lag starts 2 working days after pred start",
    `TASK-B SS start: ${taskB_SS.startDate} (Expected: 2025-10-08)`
  );

  // 7b: Finish-to-Finish with 0 lag
  const linkResFF = linkTasks(tasks, "TASK-A", "TASK-B", "FF", 0, STANDARD_5_DAY_CALENDAR);
  const taskB_FF = linkResFF.updatedTasks.find((t) => t.id === "TASK-B")!;

  // TASK-A finishes Fri Oct 10. TASK-B (duration 3) finishes Fri Oct 10.
  // Finishes Fri 10 (day 3), Thu 09 (day 2), Wed 08 (day 1) => Starts Wed Oct 08
  assert(
    taskB_FF.endDate === "2025-10-10" && taskB_FF.startDate === "2025-10-08",
    "Test 7b: Finish-to-Finish (FF) aligns successor finish with predecessor finish",
    `TASK-B FF: ${taskB_FF.startDate} to ${taskB_FF.endDate} (Expected: 2025-10-08 to 2025-10-10)`
  );

  // 7c: Negative Lead (-2 days lead on FS)
  const linkResLead = linkTasks(tasks, "TASK-A", "TASK-B", "FS", -2, STANDARD_5_DAY_CALENDAR);
  const taskB_Lead = linkResLead.updatedTasks.find((t) => t.id === "TASK-B")!;

  // TASK-A finishes Fri Oct 10. Normal FS starts Mon Oct 13.
  // -2 lead shifts 2 working days earlier: Fri Oct 10 (-1), Thu Oct 09 (-2)
  assert(
    taskB_Lead.startDate === "2025-10-09",
    "Test 7c: Finish-to-Start (FS) with -2 working days lead allows early fast-track start",
    `TASK-B Lead start: ${taskB_Lead.startDate} (Expected: 2025-10-09)`
  );
}

// -----------------------------------------------------------------
// Test 8: Circular Dependency Safety and Cycle Prevention
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  // Attempt to link C -> A (which would create cycle A -> B -> C -> A)
  const validation = validateDependency(tasks, "TASK-C", "TASK-A", "FS", 0);

  assert(
    Boolean(!validation.valid && validation.error?.includes("Circular dependency detected")),
    "Test 8a: Circular dependency detection prevents cycle C -> A",
    `Rejected with message: "${validation.error}"`
  );

  // Self dependency validation
  const selfVal = validateDependency(tasks, "TASK-A", "TASK-A", "FS", 0);
  assert(
    Boolean(!selfVal.valid && selfVal.error?.includes("cannot depend on itself")),
    "Test 8b: Self-dependency validation prevents task depending on itself",
    `Rejected with message: "${selfVal.error}"`
  );
}

// -----------------------------------------------------------------
// Test 9: Six-Day Construction Calendar enables Saturday working
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  // In 6-day week, TASK-A (Oct 06 to Oct 10) finishes on Friday.
  // Next working day is Saturday Oct 11!
  const result = recalculateSchedule(tasks, CONSTRUCTION_6_DAY_CALENDAR);
  const taskB_6day = result.updatedTasks.find((t) => t.id === "TASK-B")!;

  // TASK-B starts Saturday Oct 11. Duration 3 working days:
  // Sat 11 (1), Sun 12 skipped, Mon 13 (2), Tue 14 (3)
  assert(
    taskB_6day.startDate === "2025-10-11" && taskB_6day.endDate === "2025-10-14",
    "Test 9: 6-Day Construction Calendar treats Saturday as active working day",
    `TASK-B 6-day: ${taskB_6day.startDate} (Sat) to ${taskB_6day.endDate} (Tue)`
  );
}

// -----------------------------------------------------------------
// Test 10: Milestones (0-day duration) have equal start and finish
// -----------------------------------------------------------------
{
  const tasks = createTestHarness();
  const milestone: ProgrammeTask = {
    id: "MILESTONE-1",
    name: "Foundation Signoff",
    wbs: "1.1.4",
    level: "milestone",
    parentId: "WP-1",
    status: "not-started",
    startDate: "2025-10-17",
    endDate: "2025-10-17",
    duration: 0,
    progress: 0,
    trade: "Management",
    assignee: null,
    isCritical: true,
    isMilestone: true,
    predecessors: ["TASK-C"],
    successors: [],
    notes: "",
    children: [],
    depth: 2,
    float: 0,
  };
  tasks.push(milestone);

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const updatedM = result.updatedTasks.find((t) => t.id === "MILESTONE-1")!;

  // TASK-C finishes Oct 17 (Fri). Next working day is Mon Oct 20 (Diwali holiday), so Tue Oct 21!
  assert(
    updatedM.startDate === "2025-10-21" && updatedM.endDate === "2025-10-21" && updatedM.duration === 0,
    "Test 10: Milestones maintain 0 duration and finish on same day as start",
    `Milestone: start ${updatedM.startDate}, finish ${updatedM.endDate}, duration ${updatedM.duration}d`
  );
}

console.log("\n---------------------------------------------------------------");
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log("---------------------------------------------------------------");
