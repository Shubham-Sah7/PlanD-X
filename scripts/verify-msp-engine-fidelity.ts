/**
 * PlanD-X Scheduling Engine MS Project Fidelity Verification Suite
 * =================================================================
 * Validates forward and backward pass calculations, early/late dates,
 * total and free float, critical and near-critical paths, all 4 dependency types
 * with lag/lead, working calendars and task-specific calendars, constraints,
 * deadlines, negative float, summary rollups, manual vs auto scheduling,
 * actuals, circular dependency detection, and cascade reactivity.
 */

import {
  recalculateSchedule,
  detectDependencyCycle,
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  CONTINUOUS_7_DAY_CALENDAR,
  addWorkingDays,
  countWorkingDays,
  shiftByWorkingDays,
  formatDateIso,
  ProjectCalendar,
} from "../lib/programme-calendar";
type ProgrammeTask = any;

let passedCount = 0;
let failedCount = 0;

function assert(condition: any, title: string, detail?: string) {
  if (Boolean(condition)) {
    passedCount++;
    console.log(`[PASS] ${title}`);
    if (detail) console.log(`       ${detail}`);
  } else {
    failedCount++;
    console.error(`[FAIL] ${title}`);
    if (detail) console.error(`       Detail: ${detail}`);
  }
}

function makeTestTask(t: any): ProgrammeTask {
  return {
    wbs: "1.0",
    level: "task",
    parentId: null,
    status: "not-started",
    trade: "Structural",
    assignee: null,
    isCritical: false,
    isMilestone: t.duration === 0 || !!t.isMilestone,
    predecessors: [],
    successors: [],
    notes: "",
    children: [],
    depth: 0,
    float: 0,
    progress: 0,
    ...t,
  } as ProgrammeTask;
}

console.log("================================================================================");
console.log("PlanD-X: Microsoft Project Equivalent Scheduling Engine Fidelity Suite");
console.log("================================================================================\n");

// ─── Test 1: Forward and Backward Pass (Early/Late Dates & Critical Path) ─────
console.log("--- 1. Forward and Backward Pass (Early Start, Early Finish, Late Start, Late Finish) ---");
{
  // Sequential chain: Task A (3d) -> Task B (2d) -> Task C (4d)
  // Mon 2026-03-02:
  // Task A: 3d (Mon 2026-03-02 to Wed 2026-03-04)
  // Task B: 2d (Thu 2026-03-05 to Fri 2026-03-06)
  // Task C: 4d (Mon 2026-03-09 to Thu 2026-03-12)
  const tasks: ProgrammeTask[] = [
    {
      id: "t-1",
      name: "Excavation",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      duration: 3,
      progress: 0,
      predecessors: [],
    },
    {
      id: "t-2",
      name: "Reinforcement",
      startDate: "2026-03-02",
      endDate: "2026-03-03",
      duration: 2,
      progress: 0,
      predecessors: ["t-1"],
      predecessorDetails: [{ id: "t-1", type: "FS", lag: 0 }],
    },
    {
      id: "t-3",
      name: "Concrete Pour",
      startDate: "2026-03-02",
      endDate: "2026-03-05",
      duration: 4,
      progress: 0,
      predecessors: ["t-2"],
      predecessorDetails: [{ id: "t-2", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const t1 = result.updatedTasks.find((t) => t.id === "t-1")!;
  const t2 = result.updatedTasks.find((t) => t.id === "t-2")!;
  const t3 = result.updatedTasks.find((t) => t.id === "t-3")!;

  assert(
    t1.earlyStart === "2026-03-02" &&
      t1.earlyFinish === "2026-03-04" &&
      t1.lateStart === "2026-03-02" &&
      t1.lateFinish === "2026-03-04",
    "1.1 Early & Late dates for root critical task (Task A)",
    `ES=${t1.earlyStart}, EF=${t1.earlyFinish}, LS=${t1.lateStart}, LF=${t1.lateFinish}`
  );

  assert(
    t2.earlyStart === "2026-03-05" &&
      t2.earlyFinish === "2026-03-06" &&
      t2.lateStart === "2026-03-05" &&
      t2.lateFinish === "2026-03-06",
    "1.2 Early & Late dates for intermediate critical task (Task B)",
    `ES=${t2.earlyStart}, EF=${t2.earlyFinish}, LS=${t2.lateStart}, LF=${t2.lateFinish}`
  );

  assert(
    t3.earlyStart === "2026-03-09" &&
      t3.earlyFinish === "2026-03-12" &&
      t3.lateStart === "2026-03-09" &&
      t3.lateFinish === "2026-03-12",
    "1.3 Early & Late dates for final critical task (Task C)",
    `ES=${t3.earlyStart}, EF=${t3.earlyFinish}, LS=${t3.lateStart}, LF=${t3.lateFinish}`
  );

  assert(
    t1.float === 0 && t2.float === 0 && t3.float === 0 && result.criticalTaskCount === 3,
    "1.4 Zero total float on linear critical chain",
    `All tasks float=0, criticalTaskCount=${result.criticalTaskCount}`
  );
}

// ─── Test 2: Free Float vs Total Float on Diverging Network ───────────────────
console.log("\n--- 2. Total Float and Free Float Differentiation ---");
{
  // Task 1: 5d (Mon 2026-03-02 to Fri 2026-03-06)
  // Branch A: Task 2 (2d, Mon 2026-03-09 to Tue 2026-03-10) -> Task 3 (3d, Wed 2026-03-11 to Fri 2026-03-13)
  // Branch B: Task 4 (1d, Mon 2026-03-09 to Mon 2026-03-09) -> Task 3 (Wed 2026-03-11)
  // Notice Task 4 finishes Mon Mar 9, but Task 3 doesn't start until Wed Mar 11 (because Task 2 finishes Tue Mar 10).
  // So Task 4 has:
  // - Total Float: 4 days (can delay until Fri Mar 13 without delaying project finish)
  // - Free Float: 1 day (can delay Tue Mar 10 without delaying Task 3's Early Start of Wed Mar 11!)
  const tasks: ProgrammeTask[] = [
    {
      id: "t1",
      name: "Demolition",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      progress: 0,
      predecessors: [],
    },
    {
      id: "t2",
      name: "Long Wall Forming",
      startDate: "2026-03-09",
      endDate: "2026-03-10",
      duration: 2,
      progress: 0,
      predecessors: ["t1"],
      predecessorDetails: [{ id: "t1", type: "FS", lag: 0 }],
    },
    {
      id: "t4",
      name: "Short Pier Forming",
      startDate: "2026-03-09",
      endDate: "2026-03-09",
      duration: 1,
      progress: 0,
      predecessors: ["t1"],
      predecessorDetails: [{ id: "t1", type: "FS", lag: 0 }],
    },
    {
      id: "t3",
      name: "Joint Inspection & Pour",
      startDate: "2026-03-11",
      endDate: "2026-03-13",
      duration: 3,
      progress: 0,
      predecessors: ["t2", "t4"],
      predecessorDetails: [
        { id: "t2", type: "FS", lag: 0 },
        { id: "t4", type: "FS", lag: 0 },
      ],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const t4 = result.updatedTasks.find((t) => t.id === "t4")!;
  const t2 = result.updatedTasks.find((t) => t.id === "t2")!;

  assert(
    t4.freeFloat === 1,
    "2.1 Free Float accurately distinguishes successor buffer",
    `Task 4 freeFloat=${t4.freeFloat}d (Successor t3 earlyStart is 2026-03-11; t4 ends 2026-03-09; slack = 1 working day)`
  );

  assert(
    t4.float === 1,
    "2.2 Total Float reflects late start variance",
    `Task 4 totalFloat=${t4.float}d, freeFloat=${t4.freeFloat}d`
  );

  assert(
    t2.float === 0 && t2.freeFloat === 0 && t2.isCritical === true,
    "2.3 Driving predecessor on critical path has zero float and zero free float",
    `Task 2 isCritical=${t2.isCritical}, float=${t2.float}, freeFloat=${t2.freeFloat}`
  );
}

// ─── Test 3: Multiple Critical Paths ──────────────────────────────────────────
console.log("\n--- 3. Multiple Parallel Critical Paths ---");
{
  // Start task S (2d) -> splits into Path A (4d) and Path B (4d) -> Merge at Milestone M (0d)
  // Both Path A and Path B have duration 4d, so both paths have Total Float = 0 and are critical!
  const tasks: ProgrammeTask[] = [
    {
      id: "p-start",
      name: "Project Inception",
      startDate: "2026-03-02",
      endDate: "2026-03-03",
      duration: 2,
      progress: 0,
      predecessors: [],
    },
    {
      id: "path-a",
      name: "Substructure Path A",
      startDate: "2026-03-04",
      endDate: "2026-03-09",
      duration: 4,
      progress: 0,
      predecessors: ["p-start"],
      predecessorDetails: [{ id: "p-start", type: "FS", lag: 0 }],
    },
    {
      id: "path-b",
      name: "Procurement Path B",
      startDate: "2026-03-04",
      endDate: "2026-03-09",
      duration: 4,
      progress: 0,
      predecessors: ["p-start"],
      predecessorDetails: [{ id: "p-start", type: "FS", lag: 0 }],
    },
    {
      id: "m-finish",
      name: "Foundation Handover Milestone",
      startDate: "2026-03-10",
      endDate: "2026-03-10",
      duration: 0,
      isMilestone: true,
      progress: 0,
      predecessors: ["path-a", "path-b"],
      predecessorDetails: [
        { id: "path-a", type: "FS", lag: 0 },
        { id: "path-b", type: "FS", lag: 0 },
      ],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const pathA = result.updatedTasks.find((t) => t.id === "path-a")!;
  const pathB = result.updatedTasks.find((t) => t.id === "path-b")!;
  const mFinish = result.updatedTasks.find((t) => t.id === "m-finish")!;

  assert(
    pathA.isCritical === true && pathB.isCritical === true && mFinish.isCritical === true,
    "3.1 Both parallel paths identified as critical",
    `Path A isCritical=${pathA.isCritical} (float=${pathA.float}), Path B isCritical=${pathB.isCritical} (float=${pathB.float})`
  );

  assert(
    result.criticalPathTaskIds.includes("path-a") && result.criticalPathTaskIds.includes("path-b"),
    "3.2 criticalPathTaskIds includes all activities across multiple critical paths",
    `Critical IDs: ${result.criticalPathTaskIds.join(", ")}`
  );
}

// ─── Test 4: Near-Critical Path Identification ────────────────────────────────
console.log("\n--- 4. Near-Critical Path Identification ---");
{
  // Main path: 10d
  // Parallel branch: 8d (float = 2d, within default near-critical threshold of 5d)
  const tasks: ProgrammeTask[] = [
    {
      id: "crit-1",
      name: "Main Critical Works",
      startDate: "2026-03-02",
      endDate: "2026-03-13",
      duration: 10,
      progress: 0,
      predecessors: [],
    },
    {
      id: "near-1",
      name: "Parallel Near-Critical Works",
      startDate: "2026-03-02",
      endDate: "2026-03-11",
      duration: 8,
      progress: 0,
      predecessors: [],
    },
    {
      id: "crit-end",
      name: "Joint Handover",
      startDate: "2026-03-16",
      endDate: "2026-03-16",
      duration: 0,
      isMilestone: true,
      progress: 0,
      predecessors: ["crit-1", "near-1"],
      predecessorDetails: [
        { id: "crit-1", type: "FS", lag: 0 },
        { id: "near-1", type: "FS", lag: 0 },
      ],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR, { nearCriticalThresholdDays: 5 });
  const nearTask = result.updatedTasks.find((t) => t.id === "near-1")!;

  assert(
    nearTask.float === 2 && nearTask.isNearCritical === true && nearTask.isCritical === false,
    "4.1 Near-critical activity identified with float <= 5d",
    `Task '${nearTask.name}' float=${nearTask.float}d, isNearCritical=${nearTask.isNearCritical}, reason: ${nearTask.criticalityReason}`
  );
}

// ─── Test 5: All 4 Dependency Types with Positive and Negative Lag ───────────
console.log("\n--- 5. All Four Dependency Types (FS, SS, FF, SF) and Positive/Negative Lag ---");
{
  // Base task starts Mon 2026-03-02, duration 5d (finishes Fri 2026-03-06)
  const baseTask: ProgrammeTask = {
    id: "base",
    name: "Base Structure",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    duration: 5,
    progress: 0,
    predecessors: [],
  };

  // SS with +2d lag: starts 2 working days after Mon Mar 2 => Wed Mar 4
  const ssTask: ProgrammeTask = {
    id: "ss-task",
    name: "SS +2d Successor",
    startDate: "2026-03-02",
    endDate: "2026-03-04",
    duration: 3,
    progress: 0,
    predecessors: ["base"],
    predecessorDetails: [{ id: "base", type: "SS", lag: 2 }],
  };

  // FF with +1d lag: finishes 1 working day after Fri Mar 6 => Mon Mar 9
  // Duration 3d: Mon Mar 9 - 2wd = Thu Mar 5
  const ffTask: ProgrammeTask = {
    id: "ff-task",
    name: "FF +1d Successor",
    startDate: "2026-03-02",
    endDate: "2026-03-04",
    duration: 3,
    progress: 0,
    predecessors: ["base"],
    predecessorDetails: [{ id: "base", type: "FF", lag: 1 }],
  };

  // FS with -2d lead (negative lag): Base finishes Fri Mar 6. FS + 1 = Mon Mar 9. -2d = Thu Mar 5
  const fsLeadTask: ProgrammeTask = {
    id: "fs-lead",
    name: "FS -2d Lead Successor",
    startDate: "2026-03-02",
    endDate: "2026-03-04",
    duration: 2,
    progress: 0,
    predecessors: ["base"],
    predecessorDetails: [{ id: "base", type: "FS", lag: -2 }],
  };

  // SF with 0d lag: finishes when Base starts (Mon Mar 2).
  const sfTask: ProgrammeTask = {
    id: "sf-task",
    name: "SF 0d Successor",
    startDate: "2026-03-02",
    endDate: "2026-03-04",
    duration: 2,
    progress: 0,
    predecessors: ["base"],
    predecessorDetails: [{ id: "base", type: "SF", lag: 0 }],
  };

  const result = recalculateSchedule(
    [baseTask, ssTask, ffTask, fsLeadTask, sfTask],
    STANDARD_5_DAY_CALENDAR
  );

  const resSS = result.updatedTasks.find((t) => t.id === "ss-task")!;
  const resFF = result.updatedTasks.find((t) => t.id === "ff-task")!;
  const resFSLead = result.updatedTasks.find((t) => t.id === "fs-lead")!;
  const resSF = result.updatedTasks.find((t) => t.id === "sf-task")!;

  assert(
    resSS.startDate === "2026-03-04",
    "5.1 SS +2d lag: starts 2 working days after predecessor start",
    `Base starts 2026-03-02, SS+2d starts ${resSS.startDate}`
  );

  assert(
    resFF.endDate === "2026-03-09",
    "5.2 FF +1d lag: finishes 1 working day after predecessor finish",
    `Base finishes 2026-03-06 (Fri), FF+1d finishes ${resFF.endDate} (Mon)`
  );

  assert(
    resFSLead.startDate === "2026-03-05",
    "5.3 FS -2d negative lag (lead time): starts 2 working days before standard FS boundary",
    `Base finishes Fri 2026-03-06, successor starts Thu ${resFSLead.startDate}`
  );

  assert(
    resSF.endDate === "2026-03-02",
    "5.4 SF 0d link: finishes when predecessor starts",
    `Base starts 2026-03-02, SF successor finishes ${resSF.endDate}`
  );
}

// ─── Test 6: Milestone Calculations (0-Duration FS Link Semantics) ────────────
console.log("\n--- 6. Milestone Calculations & MS Project Semantics ---");
{
  // In MS Project:
  // Milestone M (0d) on Mon 2026-03-02.
  // Successor Task S (3d) with FS lag 0 starts on Mon 2026-03-02 (SAME DAY) because milestone consumes 0 working hours!
  const tasks: ProgrammeTask[] = [
    {
      id: "m-start",
      name: "Site Access Milestone",
      startDate: "2026-03-02",
      endDate: "2026-03-02",
      duration: 0,
      isMilestone: true,
      progress: 0,
      predecessors: [],
    },
    {
      id: "t-succ",
      name: "Site Fencing",
      startDate: "2026-03-05",
      endDate: "2026-03-07",
      duration: 3,
      progress: 0,
      predecessors: ["m-start"],
      predecessorDetails: [{ id: "m-start", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const succ = result.updatedTasks.find((t) => t.id === "t-succ")!;
  const mile = result.updatedTasks.find((t) => t.id === "m-start")!;

  assert(
    mile.startDate === mile.endDate && mile.earlyStart === mile.earlyFinish,
    "6.1 Milestone start equals finish and earlyStart equals earlyFinish",
    `Milestone ES=${mile.earlyStart}, EF=${mile.earlyFinish}`
  );

  assert(
    succ.startDate === "2026-03-02",
    "6.2 FS lag 0 from milestone starts on the same day in accordance with MS Project",
    `Milestone date: ${mile.endDate}, Successor start: ${succ.startDate}`
  );
}

// ─── Test 7: Task-Specific Calendar Override (e.g. 7-Day Concrete Curing) ────
console.log("\n--- 7. Working Calendars and Task-Specific Calendars ---");
{
  // Task 1: 5-day calendar, finishes Fri 2026-03-06
  // Task 2: Concrete Curing, calendarId="cal-7day", duration 3 days (continuous 7 days)
  // Starts Sat 2026-03-07, finishes Mon 2026-03-09 (Sat, Sun, Mon = 3 days)
  // Task 3: Strip formwork, 5-day calendar, starts Tue 2026-03-10
  const tasks: ProgrammeTask[] = [
    {
      id: "pour",
      name: "Slab Pour (5-day)",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      progress: 0,
      calendarId: "cal-5day",
      predecessors: [],
    },
    {
      id: "cure",
      name: "Concrete Curing (7-day Continuous)",
      startDate: "2026-03-07",
      endDate: "2026-03-09",
      duration: 3,
      progress: 0,
      calendarId: "cal-7day",
      predecessors: ["pour"],
      predecessorDetails: [{ id: "pour", type: "FS", lag: 0 }],
    },
    {
      id: "strip",
      name: "Formwork Stripping (5-day)",
      startDate: "2026-03-10",
      endDate: "2026-03-11",
      duration: 2,
      progress: 0,
      calendarId: "cal-5day",
      predecessors: ["cure"],
      predecessorDetails: [{ id: "cure", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR, {
    taskCalendars: {
      "cal-7day": CONTINUOUS_7_DAY_CALENDAR,
      "cal-5day": STANDARD_5_DAY_CALENDAR,
    },
  });

  const cure = result.updatedTasks.find((t) => t.id === "cure")!;
  const strip = result.updatedTasks.find((t) => t.id === "strip")!;

  assert(
    cure.startDate === "2026-03-07" && cure.endDate === "2026-03-09",
    "7.1 7-day task schedules across Saturday and Sunday continuously",
    `Cure: start=${cure.startDate} (Sat), end=${cure.endDate} (Mon)`
  );

  assert(
    strip.startDate === "2026-03-10",
    "7.2 5-day successor resumes on next working day after 7-day predecessor completes",
    `Strip start=${strip.startDate} (Tue)`
  );
}

// ─── Test 8: Constraints, Deadlines and Negative Float ────────────────────────
console.log("\n--- 8. Constraints, Deadlines, and Negative Float Preservation ---");
{
  // Project root: Mon 2026-03-02
  // Task 1: 5d (finishes Fri 2026-03-06)
  // Task 2: 5d (starts Mon 2026-03-09, finishes Fri 2026-03-13)
  // Deadline on Task 2: Wed 2026-03-11 (2 working days BEFORE completion!)
  // In MS Project, Late Finish = Wed 2026-03-11.
  // Late Start = Thu 2026-03-05.
  // Early Start = Mon 2026-03-09.
  // Total Float = Late Start - Early Start = -2 working days (NEGATIVE FLOAT).
  const tasks: ProgrammeTask[] = [
    {
      id: "c-1",
      name: "Excavation",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      progress: 0,
      predecessors: [],
    },
    {
      id: "c-2",
      name: "Foundation Slab",
      startDate: "2026-03-09",
      endDate: "2026-03-13",
      duration: 5,
      progress: 0,
      deadline: "2026-03-11", // Breach by 2 days
      predecessors: ["c-1"],
      predecessorDetails: [{ id: "c-1", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const t2 = result.updatedTasks.find((t) => t.id === "c-2")!;
  const t1 = result.updatedTasks.find((t) => t.id === "c-1")!;

  assert(
    t2.deadlineViolated === true && t2.daysPastDeadline === 2,
    "8.1 Deadline violation detected with exact working days past deadline",
    `deadlineViolated=${t2.deadlineViolated}, daysPastDeadline=${t2.daysPastDeadline}`
  );

  assert(
    t2.float === -2 && t2.hasNegativeFloat === true && t2.isCritical === true,
    "8.2 Negative Float is preserved and marks activity critical",
    `Task 2 float=${t2.float}d, hasNegativeFloat=${t2.hasNegativeFloat}, isCritical=${t2.isCritical}`
  );

  assert(
    t1.float === -2 && t1.hasNegativeFloat === true,
    "8.3 Negative float propagates upstream along driving predecessor chain",
    `Task 1 float=${t1.float}d, hasNegativeFloat=${t1.hasNegativeFloat}`
  );
}

// ─── Test 9: Manual Scheduling Mode (Preserving Manual Dates & Conflict Flag) ─
console.log("\n--- 9. Manual vs Automatic Scheduling Behavior ---");
{
  // Task 1: Auto, 5d (Mon 2026-03-02 to Fri 2026-03-06)
  // Task 2: Manual, pinned by user to start Wed 2026-03-04 (earlier than Task 1 finish!)
  // In MS Project, manual task retains its start/finish dates, while Early Start computes as Mon 2026-03-09
  // and a dependency conflict warning is flagged.
  const tasks: ProgrammeTask[] = [
    {
      id: "auto-1",
      name: "Procure Structural Steel",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      schedulingMode: "auto",
      progress: 0,
      predecessors: [],
    },
    {
      id: "manual-2",
      name: "Erect Steel Frame (Manual)",
      startDate: "2026-03-04",
      endDate: "2026-03-06",
      duration: 3,
      schedulingMode: "manual",
      manualStartDate: "2026-03-04",
      progress: 0,
      predecessors: ["auto-1"],
      predecessorDetails: [{ id: "auto-1", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const manualTask = result.updatedTasks.find((t) => t.id === "manual-2")!;

  assert(
    manualTask.startDate === "2026-03-04",
    "9.1 Manual task preserves user-entered start date without auto-shifting",
    `Manual task startDate=${manualTask.startDate}`
  );

  assert(
    manualTask.earlyStart === "2026-03-09",
    "9.2 CPM forward pass calculates true network earlyStart for manual task",
    `manualTask.earlyStart=${manualTask.earlyStart}`
  );

  assert(
    manualTask.constraintConflict === true &&
      result.warnings?.some((w) => w.taskId === "manual-2" && w.type === "dependency-conflict"),
    "9.3 Dependency conflict warning generated when predecessor pushes past manual start",
    `constraintConflict=${manualTask.constraintConflict}, reason: ${manualTask.constraintConflictReason}`
  );
}

// ─── Test 10: Summary Task Rollups (Work-Weighted Progress & Float) ───────────
console.log("\n--- 10. Summary Task Rollups and Work-Weighted Progress ---");
{
  // Summary Task P (id: "phase-1", level: "phase")
  // Child A: 40h work, progress 100%, duration 5d (2026-03-02 to 2026-03-06)
  // Child B: 80h work, progress 25%, duration 10d (2026-03-09 to 2026-03-20)
  // In MS Project, Summary Progress = (40 * 100% + 80 * 25%) / (40 + 80) = (40 + 20) / 120 = 50%
  const tasks: ProgrammeTask[] = [
    {
      id: "phase-1",
      name: "Phase 1 - Groundworks",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      level: "phase",
      summary: true,
      progress: 0,
      predecessors: [],
    },
    {
      id: "c-a",
      name: "Bulk Excavation",
      parentId: "phase-1",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
      workHours: 40,
      progress: 100,
      predecessors: [],
    },
    {
      id: "c-b",
      name: "Basement Shoring",
      parentId: "phase-1",
      startDate: "2026-03-09",
      endDate: "2026-03-20",
      duration: 10,
      workHours: 80,
      progress: 25,
      predecessors: ["c-a"],
      predecessorDetails: [{ id: "c-a", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const summary = result.updatedTasks.find((t) => t.id === "phase-1")!;

  assert(
    summary.startDate === "2026-03-02" && summary.endDate === "2026-03-20",
    "10.1 Summary task boundaries encompass earliest child start to latest child finish",
    `Summary: start=${summary.startDate}, end=${summary.endDate}`
  );

  assert(
    summary.progress === 50,
    "10.2 Summary progress is work-weighted (50%), matching Microsoft Project",
    `Calculated summary.progress = ${summary.progress}% (Expected: 50% for 40h@100% + 80h@25% of 120h total work)`
  );

  assert(
    summary.workHours === 120,
    "10.3 Summary total work rolled up from children (120h)",
    `Summary workHours=${summary.workHours}h`
  );
}

// ─── Test 11: Actual Progress, Remaining Duration and Forecast Finish ─────────
console.log("\n--- 11. Actual Dates, Remaining Duration, and Status Date Forecast ---");
{
  // Completed Task: has actualStart and actualFinish
  const completedTask: ProgrammeTask = {
    id: "act-done",
    name: "Completed Site Survey",
    startDate: "2026-03-02",
    endDate: "2026-03-04",
    duration: 3,
    actualStart: "2026-03-02",
    actualFinish: "2026-03-04",
    progress: 80, // input had 80, engine must set 100% upon actualFinish!
    predecessors: [],
  };

  // Delayed In-Progress Task evaluated on Status Date 2026-03-10:
  // Scheduled finish was Fri 2026-03-06, but on status date it is only 50% done (remaining 2d).
  // Forecast finish pushes 2 working days forward from status date => Thu 2026-03-12.
  const delayedTask: ProgrammeTask = {
    id: "act-delayed",
    name: "Shoring Piles",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    duration: 4,
    actualStart: "2026-03-02",
    progress: 50,
    predecessors: [],
  };

  const result = recalculateSchedule([completedTask, delayedTask], STANDARD_5_DAY_CALENDAR, {
    statusDate: "2026-03-10",
  });

  const done = result.updatedTasks.find((t) => t.id === "act-done")!;
  const delayed = result.updatedTasks.find((t) => t.id === "act-delayed")!;

  assert(
    done.progress === 100 && done.remainingDuration === 0,
    "11.1 Actual finish enforces 100% completion and 0 remaining duration",
    `Completed task progress=${done.progress}%, remainingDuration=${done.remainingDuration}`
  );

  assert(
    delayed.remainingDuration === 2 && delayed.forecastFinish === "2026-03-11" && delayed.isOverdue === true,
    "11.2 Incomplete work evaluated against status date forecasts completion forward",
    `Remaining duration=${delayed.remainingDuration}d, forecastFinish=${delayed.forecastFinish}, isOverdue=${delayed.isOverdue}`
  );
}

// ─── Test 12: Circular Dependency & Impossible Condition Detection ────────────
console.log("\n--- 12. Circular Dependencies and Impossible Scheduling Conditions ---");
{
  // A -> B -> C -> A cycle in task definitions
  const cyclicTasks: ProgrammeTask[] = [
    {
      id: "loop-1",
      name: "Task Alpha",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      duration: 3,
      progress: 0,
      predecessors: ["loop-3"],
      predecessorDetails: [{ id: "loop-3", type: "FS", lag: 0 }],
    },
    {
      id: "loop-2",
      name: "Task Beta",
      startDate: "2026-03-05",
      endDate: "2026-03-07",
      duration: 3,
      progress: 0,
      predecessors: ["loop-1"],
      predecessorDetails: [{ id: "loop-1", type: "FS", lag: 0 }],
    },
    {
      id: "loop-3",
      name: "Task Gamma",
      startDate: "2026-03-08",
      endDate: "2026-03-10",
      duration: 3,
      progress: 0,
      predecessors: ["loop-2"],
      predecessorDetails: [{ id: "loop-2", type: "FS", lag: 0 }],
    },
  ];

  const result = recalculateSchedule(cyclicTasks, STANDARD_5_DAY_CALENDAR);

  assert(
    result.hasCircularDependency === true,
    "12.1 Circular dependency cycle detected safely without process freeze",
    `hasCircularDependency=${result.hasCircularDependency}, details: ${result.cycleDetails}`
  );

  assert(
    result.warnings?.some((w) => w.type === "cycle" && w.severity === "critical"),
    "12.2 Critical warning added to schedule result for dependency loop",
    `Warnings count=${result.warnings?.length}`
  );

  // Impossible constraint condition: Must Start On earlier than predecessor finish
  const impossibleTasks: ProgrammeTask[] = [
    {
      id: "root-imp",
      name: "Initial Earthworks",
      startDate: "2026-03-02",
      endDate: "2026-03-13",
      duration: 10,
      progress: 0,
      predecessors: [],
    },
    {
      id: "succ-imp",
      name: "Impossible Concrete Pour",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      duration: 3,
      constraintType: "MSO",
      constraintDate: "2026-03-05", // Conflicts with predecessor ending 2026-03-13!
      progress: 0,
      predecessors: ["root-imp"],
      predecessorDetails: [{ id: "root-imp", type: "FS", lag: 0 }],
    },
  ];

  const resultImp = recalculateSchedule(impossibleTasks, STANDARD_5_DAY_CALENDAR);
  const succImp = resultImp.updatedTasks.find((t) => t.id === "succ-imp")!;

  assert(
    succImp.constraintConflict === true && resultImp.hasImpossibleConditions === true,
    "12.3 Impossible scheduling condition detected (predecessor violates MSO constraint)",
    `constraintConflict=${succImp.constraintConflict}, reason: ${succImp.constraintConflictReason}`
  );
}

// ─── Test 13: Cascade Reactivity ──────────────────────────────────────────────
console.log("\n--- 13. Cascade Reactivity: Upstream Changes Propagate Downstream ---");
{
  // Task 1 (Root, 3d) -> Task 2 (Mid, 4d) -> Summary Task (Container) -> Milestone (0d)
  const initialTasks: ProgrammeTask[] = [
    {
      id: "p1",
      name: "Phase Root",
      startDate: "2026-03-02",
      endDate: "2026-03-04",
      duration: 3,
      progress: 0,
      predecessors: [],
    },
    {
      id: "p2",
      name: "Phase Secondary",
      startDate: "2026-03-05",
      endDate: "2026-03-10",
      duration: 4,
      progress: 0,
      predecessors: ["p1"],
      predecessorDetails: [{ id: "p1", type: "FS", lag: 0 }],
    },
    {
      id: "p-milestone",
      name: "Phase Complete Milestone",
      startDate: "2026-03-11",
      endDate: "2026-03-11",
      duration: 0,
      isMilestone: true,
      progress: 0,
      predecessors: ["p2"],
      predecessorDetails: [{ id: "p2", type: "FS", lag: 0 }],
    },
  ];

  const initialRes = recalculateSchedule(initialTasks, STANDARD_5_DAY_CALENDAR);
  const initMile = initialRes.updatedTasks.find((t) => t.id === "p-milestone")!;

  assert(
    initMile.startDate === "2026-03-11",
    "13.1 Initial project finish baseline established at 2026-03-11",
    `Initial milestone date: ${initMile.startDate}`
  );

  // Extend p1 duration from 3 days to 8 days (+5 days)
  const modifiedTasks = initialTasks.map((t) =>
    t.id === "p1" ? { ...t, duration: 8 } : { ...t }
  );

  const updatedRes = recalculateSchedule(modifiedTasks, STANDARD_5_DAY_CALENDAR);
  const updatedP1 = updatedRes.updatedTasks.find((t) => t.id === "p1")!;
  const updatedP2 = updatedRes.updatedTasks.find((t) => t.id === "p2")!;
  const updatedMile = updatedRes.updatedTasks.find((t) => t.id === "p-milestone")!;

  assert(
    updatedP1.endDate === "2026-03-11",
    "13.2 Upstream task duration change recalculated end date to 2026-03-11",
    `p1 new end: ${updatedP1.endDate}`
  );

  assert(
    updatedP2.startDate === "2026-03-12" && updatedP2.endDate === "2026-03-17",
    "13.3 Immediate successor automatically shifted to 2026-03-12..2026-03-17",
    `p2 new start: ${updatedP2.startDate}, end: ${updatedP2.endDate}`
  );

  assert(
    updatedMile.startDate === "2026-03-18" && updatedRes.projectEndDate === "2026-03-18",
    "13.4 Project completion milestone and overall project finish date recalculated to 2026-03-18",
    `Milestone: ${updatedMile.startDate}, projectEndDate: ${updatedRes.projectEndDate}`
  );
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log("\n================================================================================");
console.log("MICROSOFT PROJECT EQUIVALENCE VERIFICATION SUMMARY");
console.log("================================================================================");
console.log(`Total Checks Run: ${passedCount + failedCount}`);
console.log(`Passed:           ${passedCount}`);
console.log(`Failed:           ${failedCount}`);
console.log(`Success Rate:     ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
