import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  formatDateIso,
  recalculateSchedule,
  shiftByWorkingDays,
  type ProjectCalendar,
} from "../lib/programme-calendar";
import {
  linkTasks,
  unlinkTasks,
  validateDependency,
  wouldCreateCircularDependency,
  formatDependencyRelation,
  getTaskPredecessorLinks,
} from "../lib/programme-dependencies";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";
import { type ProgrammeTask, type DependencyType } from "../lib/programme-types";

console.log("===============================================================");
console.log("PlanD-X Task Dependencies & Lag/Lead Verification Suite");
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

// Base mock tasks for isolated scheduling tests
// TASK-A: 5 working days Mon Oct 06 to Fri Oct 10
// TASK-B: 3 working days duration
function createMockTasks(): ProgrammeTask[] {
  return [
    {
      id: "TASK-A",
      name: "Substructure Excavation",
      wbs: "1.1",
      level: "task",
      parentId: null,
      status: "complete",
      startDate: "2025-10-06", // Mon
      endDate: "2025-10-10",   // Fri (5 working days)
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
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-10",
    },
    {
      id: "TASK-B",
      name: "Piling Works",
      wbs: "1.2",
      level: "task",
      parentId: null,
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
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-13",
      baseline0Finish: "2025-10-15",
    },
  ];
}

// -----------------------------------------------------------------
// Test 1: Supported Dependency Types (FS, SS, FF, SF)
// -----------------------------------------------------------------
{
  // 1a: Finish-to-Start (FS, 0 lag)
  // Task A ends Fri Oct 10 -> Task B starts Mon Oct 13, finishes Wed Oct 15
  const tasksFS = createMockTasks();
  const linkedFS = linkTasks(tasksFS, "TASK-A", "TASK-B", "FS", 0, STANDARD_5_DAY_CALENDAR);
  const taskB_FS = linkedFS.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_FS?.startDate === "2025-10-13" && taskB_FS?.endDate === "2025-10-15",
    "Test 1a: Finish-to-Start (FS) with 0 lag schedules successor to next working day",
    `TASK-B start: ${taskB_FS?.startDate} (Expected 2025-10-13), finish: ${taskB_FS?.endDate} (Expected 2025-10-15)`
  );

  // 1b: Start-to-Start (SS, 0 lag)
  // Task A starts Mon Oct 06 -> Task B starts Mon Oct 06, finishes Wed Oct 08
  const tasksSS = createMockTasks();
  const linkedSS = linkTasks(tasksSS, "TASK-A", "TASK-B", "SS", 0, STANDARD_5_DAY_CALENDAR);
  const taskB_SS = linkedSS.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_SS?.startDate === "2025-10-06" && taskB_SS?.endDate === "2025-10-08",
    "Test 1b: Start-to-Start (SS) with 0 lag schedules successor concurrently with predecessor start",
    `TASK-B start: ${taskB_SS?.startDate} (Expected 2025-10-06), finish: ${taskB_SS?.endDate} (Expected 2025-10-08)`
  );

  // 1c: Finish-to-Finish (FF, 0 lag)
  // Task A finishes Fri Oct 10 -> Task B (duration 3) finishes Fri Oct 10, starts Wed Oct 08
  const tasksFF = createMockTasks();
  const linkedFF = linkTasks(tasksFF, "TASK-A", "TASK-B", "FF", 0, STANDARD_5_DAY_CALENDAR);
  const taskB_FF = linkedFF.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_FF?.startDate === "2025-10-08" && taskB_FF?.endDate === "2025-10-10",
    "Test 1c: Finish-to-Finish (FF) with 0 lag aligns successor finish with predecessor finish",
    `TASK-B start: ${taskB_FF?.startDate} (Expected 2025-10-08), finish: ${taskB_FF?.endDate} (Expected 2025-10-10)`
  );

  // 1d: Start-to-Finish (SF, 0 lag)
  // Task A starts Mon Oct 06 -> Task B (duration 3) finishes Mon Oct 06.
  // Working days backwards: Mon Oct 06 (1), Fri Oct 03 (2), Thu Oct 02 is Autumn Holiday (skipped!), Wed Oct 01 (3).
  // Successor starts Wed Oct 01.
  const tasksSF = createMockTasks();
  const linkedSF = linkTasks(tasksSF, "TASK-A", "TASK-B", "SF", 0, STANDARD_5_DAY_CALENDAR);
  const taskB_SF = linkedSF.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_SF?.startDate === "2025-10-01" && taskB_SF?.endDate === "2025-10-06",
    "Test 1d: Start-to-Finish (SF) with 0 lag completes successor when predecessor starts (skipping 2025-10-02 holiday)",
    `TASK-B start: ${taskB_SF?.startDate} (Expected 2025-10-01 Wed), finish: ${taskB_SF?.endDate} (Expected 2025-10-06 Mon)`
  );
}

// -----------------------------------------------------------------
// Test 2: Positive Lag and Negative Lead
// -----------------------------------------------------------------
{
  // 2a: FS with +2 working days lag (e.g., concrete curing buffer)
  // Predecessor finishes Fri Oct 10.
  // Lag Day 1: Mon Oct 13.
  // Lag Day 2: Tue Oct 14.
  // Successor starts Wed Oct 15, finishes Fri Oct 17.
  const tasksLag = createMockTasks();
  const linkedLag = linkTasks(tasksLag, "TASK-A", "TASK-B", "FS", 2, STANDARD_5_DAY_CALENDAR);
  const taskB_Lag = linkedLag.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_Lag?.startDate === "2025-10-15" && taskB_Lag?.endDate === "2025-10-17",
    "Test 2a: Positive lag (+2 working days) delays successor start across non-working weekend",
    `TASK-B start: ${taskB_Lag?.startDate} (Expected 2025-10-15 Wed), finish: ${taskB_Lag?.endDate} (Expected 2025-10-17 Fri)`
  );

  // 2b: FS with -2 working days lead (fast-track overlap)
  // Predecessor finishes Fri Oct 10.
  // Successor starts 2 working days before standard FS start (Mon Oct 13) -> Thu Oct 09!
  // Successor duration 3 days (Thu 9, Fri 10, Mon 13) -> finishes Mon Oct 13.
  const tasksLead = createMockTasks();
  const linkedLead = linkTasks(tasksLead, "TASK-A", "TASK-B", "FS", -2, STANDARD_5_DAY_CALENDAR);
  const taskB_Lead = linkedLead.updatedTasks.find((t) => t.id === "TASK-B");
  assert(
    taskB_Lead?.startDate === "2025-10-09" && taskB_Lead?.endDate === "2025-10-13",
    "Test 2b: Negative lead (-2 working days) allows early start and fast-track overlap",
    `TASK-B start: ${taskB_Lead?.startDate} (Expected 2025-10-09 Thu), finish: ${taskB_Lead?.endDate} (Expected 2025-10-13 Mon)`
  );
}

// -----------------------------------------------------------------
// Test 3: Multiple Dependencies and Cascading Chains
// -----------------------------------------------------------------
{
  // Chain: TASK-A -> TASK-B (+2d lag) -> TASK-C (FS, 0 lag)
  const chainTasks: ProgrammeTask[] = [
    ...createMockTasks(),
    {
      id: "TASK-C",
      name: "Ground Floor Slab",
      wbs: "1.3",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-16",
      endDate: "2025-10-20",
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
      depth: 0,
      float: 0,
    },
  ];

  // Link A -> B (+2d lag)
  const step1 = linkTasks(chainTasks, "TASK-A", "TASK-B", "FS", 2, STANDARD_5_DAY_CALENDAR);
  // Link B -> C (FS, 0 lag)
  const step2 = linkTasks(step1.updatedTasks, "TASK-B", "TASK-C", "FS", 0, STANDARD_5_DAY_CALENDAR);

  const taskB = step2.updatedTasks.find((t) => t.id === "TASK-B");
  const taskC = step2.updatedTasks.find((t) => t.id === "TASK-C");

  // Task B finishes Fri Oct 17.
  // Next working day after Fri Oct 17: Sat 18 (weekend), Sun 19 (weekend), Mon 20 is Diwali (holiday!).
  // So Task C starts Tue Oct 21 and finishes Wed Oct 22 (2 working days)!
  assert(
    taskB?.endDate === "2025-10-17" &&
    taskC?.startDate === "2025-10-21" &&
    taskC?.endDate === "2025-10-22",
    "Test 3: Dependency cascade properly ripples through chain A -> B (+2d lag) -> C (skipping Diwali holiday)",
    `TASK-B finish: ${taskB?.endDate}, TASK-C: ${taskC?.startDate} to ${taskC?.endDate} (Expected Oct 21-22)`
  );
}

// -----------------------------------------------------------------
// Test 4: Circular Dependency Detection & Validation
// -----------------------------------------------------------------
{
  const tasks = createMockTasks();
  // Existing: TASK-A -> TASK-B
  linkTasks(tasks, "TASK-A", "TASK-B", "FS", 0, STANDARD_5_DAY_CALENDAR);

  // Attempting to add TASK-B -> TASK-A must be detected as circular
  const isCircular = wouldCreateCircularDependency(tasks, "TASK-B", "TASK-A");
  const validation = validateDependency(tasks, "TASK-B", "TASK-A", "FS", 0);

  assert(
    isCircular === true && validation.valid === false,
    "Test 4a: Circular dependency detection identifies infinite loop B -> A",
    `Validation error: "${validation.error}"`
  );

  // Self-dependency check
  const selfValidation = validateDependency(tasks, "TASK-A", "TASK-A", "FS", 0);
  assert(
    selfValidation.valid === false,
    "Test 4b: Self-dependency validation prevents task from depending on itself",
    `Validation error: "${selfValidation.error}"`
  );
}

// -----------------------------------------------------------------
// Test 5: Six-Day Construction Calendar Interaction
// -----------------------------------------------------------------
{
  // Under 6-day calendar (Mon-Sat):
  // Predecessor finishes Fri Oct 10.
  // Next working day is Saturday Oct 11!
  // Task B (duration 3): Sat 11, Mon 13, Tue 14 -> finishes Tue Oct 14.
  const tasks6d = createMockTasks();
  const linked6d = linkTasks(tasks6d, "TASK-A", "TASK-B", "FS", 0, CONSTRUCTION_6_DAY_CALENDAR);
  const taskB_6d = linked6d.updatedTasks.find((t) => t.id === "TASK-B");

  assert(
    taskB_6d?.startDate === "2025-10-11" && taskB_6d?.endDate === "2025-10-14",
    "Test 5: 6-Day Construction Calendar correctly treats Saturday as working day for dependency handoff",
    `TASK-B start: ${taskB_6d?.startDate} (Expected Sat 2025-10-11), finish: ${taskB_6d?.endDate} (Expected Tue 2025-10-14)`
  );
}

// -----------------------------------------------------------------
// Test 6: Unlinking / Dependency Removal
// -----------------------------------------------------------------
{
  const tasks = createMockTasks();
  linkTasks(tasks, "TASK-A", "TASK-B", "FS", 0, STANDARD_5_DAY_CALENDAR);

  // Unlink TASK-A -> TASK-B
  const unlinked = unlinkTasks(tasks, "TASK-A", "TASK-B", STANDARD_5_DAY_CALENDAR);
  const taskB = unlinked.updatedTasks.find((t) => t.id === "TASK-B");
  const taskA = unlinked.updatedTasks.find((t) => t.id === "TASK-A");

  assert(
    !taskB?.predecessors.includes("TASK-A") && !taskA?.successors.includes("TASK-B"),
    "Test 6: Unlinking dependency cleanly removes relationship references from both tasks",
    `TASK-B predecessors: [${taskB?.predecessors.join(", ")}], TASK-A successors: [${taskA?.successors.join(", ")}]`
  );
}

// -----------------------------------------------------------------
// Test 7: Contract Baselines Preservation
// -----------------------------------------------------------------
{
  const mockTasks = createMockTasks();
  const b0Start = mockTasks[1].baseline0Start;
  const b0Finish = mockTasks[1].baseline0Finish;

  const linked = linkTasks(mockTasks, "TASK-A", "TASK-B", "FS", 5, STANDARD_5_DAY_CALENDAR);
  const taskB = linked.updatedTasks.find((t) => t.id === "TASK-B");

  assert(
    taskB?.baseline0Start === b0Start && taskB?.baseline0Finish === b0Finish,
    "Test 7: Historical Contract Baseline dates remain immutable after dependency and lag modification",
    `Baseline0 remains intact: ${taskB?.baseline0Start} to ${taskB?.baseline0Finish}`
  );
}

// -----------------------------------------------------------------
// Test 8: Compatibility with Existing Programme Tasks
// -----------------------------------------------------------------
{
  const links = ALL_PROGRAMME_TASKS.flatMap((t) => getTaskPredecessorLinks(t));
  assert(
    links.length > 0,
    "Test 8: Real programme tasks successfully parse through structured dependency extractor",
    `Extracted ${links.length} active dependency relationships from standard programme data`
  );
}

console.log("\n---------------------------------------------------------------");
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log("---------------------------------------------------------------");
