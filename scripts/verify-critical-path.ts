// PlanD-X: Comprehensive Critical Path & Delay Impact Verification Suite
// Tests 10 realistic construction scheduling scenarios according to Phase 6 requirements

import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  recalculateSchedule,
  calculateScheduleVariance,
  calculateTaskDelayImpact,
  getDownstreamAffectedTasks,
  getCriticalPathActivities,
  parseIsoDate,
  formatDateIso,
} from "../lib/programme-calendar";
import type { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${message}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${message}`);
}

console.log("===============================================================");
console.log("PlanD-X Critical Path & Delay Impact Verification Suite");
console.log("===============================================================\n");

let passedCount = 0;

// ─── Scenario 1: Simple Chain of Dependent Activities (A -> B -> C) ─────
console.log("--- Scenario 1: Simple Chain of Dependent Activities ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "T1",
      wbs: "1.1",
      name: "Site Prep",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06", // Monday
      endDate: "2025-10-10",   // Friday (5 working days)
      duration: 5,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["T2"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "T2",
      wbs: "1.2",
      name: "Excavation",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-13", // Monday
      endDate: "2025-10-17",   // Friday (5 working days)
      duration: 5,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["T1"],
      successors: ["T3"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "T3",
      wbs: "1.3",
      name: "Foundations",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-21", // Tuesday (skipping Monday Diwali 2025-10-20)
      endDate: "2025-10-27",   // 5 working days
      duration: 5,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["T2"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const t1 = result.updatedTasks.find((t) => t.id === "T1")!;
  const t2 = result.updatedTasks.find((t) => t.id === "T2")!;
  const t3 = result.updatedTasks.find((t) => t.id === "T3")!;

  assert(t1.float === 0 && t1.isCritical === true, "Scenario 1: T1 has 0 float and is critical");
  assert(t2.float === 0 && t2.isCritical === true, "Scenario 1: T2 has 0 float and is critical");
  assert(t3.float === 0 && t3.isCritical === true, "Scenario 1: T3 has 0 float and is critical");
  assert(result.criticalTaskCount === 3, "Scenario 1: All 3 tasks form the driving critical path");
  assert(result.projectEndDate === t3.endDate, "Scenario 1: Project completion date matches T3 finish");
  passedCount++;
}

// ─── Scenario 2: Multiple Parallel Paths with Different Durations ───────
console.log("\n--- Scenario 2: Parallel Paths with Float Divergence ---");
{
  // Path 1 (Critical): P1_A (10d) -> P1_B (10d) = 20d
  // Path 2 (Non-Critical): P2_A (4d) -> P2_B (4d) = 8d
  const tasks: ProgrammeTask[] = [
    {
      id: "P1_A",
      wbs: "2.1",
      name: "Long Path Start",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-17",
      duration: 10,
      progress: 0,
      trade: "Structural",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["P1_B"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "P1_B",
      wbs: "2.2",
      name: "Long Path Finish",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-21",
      endDate: "2025-11-03",
      duration: 10,
      progress: 0,
      trade: "Structural",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["P1_A"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "P2_A",
      wbs: "2.3",
      name: "Short Path Start",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-09",
      duration: 4,
      progress: 0,
      trade: "M&E",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["P2_B"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "P2_B",
      wbs: "2.4",
      name: "Short Path Finish",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-10",
      endDate: "2025-10-15",
      duration: 4,
      progress: 0,
      trade: "M&E",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["P2_A"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const p1A = result.updatedTasks.find((t) => t.id === "P1_A")!;
  const p1B = result.updatedTasks.find((t) => t.id === "P1_B")!;
  const p2A = result.updatedTasks.find((t) => t.id === "P2_A")!;
  const p2B = result.updatedTasks.find((t) => t.id === "P2_B")!;

  assert(p1A.float === 0 && p1A.isCritical === true, "Scenario 2: Long path task P1_A is critical (0 float)");
  assert(p1B.float === 0 && p1B.isCritical === true, "Scenario 2: Long path task P1_B is critical (0 float)");
  assert(p2A.float > 0 && p2A.isCritical === false, `Scenario 2: Short path P2_A has float (${p2A.float}d) and is non-critical`);
  assert(p2B.float > 0 && p2B.isCritical === false, `Scenario 2: Short path P2_B has float (${p2B.float}d) and is non-critical`);
  assert(p2A.float === p2B.float, "Scenario 2: P2 chain shares equal total float to project end");
  passedCount++;
}

// ─── Scenario 3: Different Dependency Types (SS, FF, SF, FS with Lag) ───
console.log("\n--- Scenario 3: Non-FS Dependency Types with Lag/Lead ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "ANCHOR",
      wbs: "3.1",
      name: "Predecessor Activity",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-10", // 5 days
      duration: 5,
      progress: 0,
      trade: "Structural",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["SUCC_SS", "SUCC_FF"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "SUCC_SS",
      wbs: "3.2",
      name: "SS Successor +2d Lag",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 0,
      trade: "M&E",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["ANCHOR"],
      predecessorDetails: [{ id: "ANCHOR", name: "Predecessor Activity", relation: "SS", type: "SS", lag: 2 }],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "SUCC_FF",
      wbs: "3.3",
      name: "FF Successor +0d Lag",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 3,
      progress: 0,
      trade: "Envelope",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["ANCHOR"],
      predecessorDetails: [{ id: "ANCHOR", name: "Predecessor Activity", relation: "FF", type: "FF", lag: 0 }],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const ssTask = result.updatedTasks.find((t) => t.id === "SUCC_SS")!;
  const ffTask = result.updatedTasks.find((t) => t.id === "SUCC_FF")!;

  assert(ssTask.startDate === "2025-10-08", `Scenario 3: SS +2d lag starts Oct 8 (Got: ${ssTask.startDate})`);
  assert(ffTask.endDate === "2025-10-10", `Scenario 3: FF +0d aligns finish date to Oct 10 (Got: ${ffTask.endDate})`);
  assert(typeof ssTask.float === "number", "Scenario 3: Float is reliably calculated for SS dependencies");
  passedCount++;
}

// ─── Scenario 4: Working Days, Non-Working Days & Calendar Exceptions ───
console.log("\n--- Scenario 4: Working Days & Calendar Exceptions ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "CAL_1",
      wbs: "4.1",
      name: "Piling over Diwali Exception",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-17", // Friday before Diwali (Diwali = Mon Oct 20)
      endDate: "2025-10-21",
      duration: 3, // Fri Oct 17 (d1), skips Sat/Sun, skips Mon Oct 20 Diwali, Tue Oct 21 (d2), Wed Oct 22 (d3)
      progress: 0,
      trade: "Substructure",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["CAL_2"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "CAL_2",
      wbs: "4.2",
      name: "Cap Beams",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-22",
      endDate: "2025-10-23",
      duration: 2,
      progress: 0,
      trade: "Substructure",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["CAL_1"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const result5Day = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const t1_5d = result5Day.updatedTasks.find((t) => t.id === "CAL_1")!;
  const t2_5d = result5Day.updatedTasks.find((t) => t.id === "CAL_2")!;

  assert(t1_5d.endDate === "2025-10-22", `Scenario 4 (5-Day): Correctly accounts for weekend and Diwali holiday (Got: ${t1_5d.endDate})`);
  assert(t2_5d.startDate === "2025-10-23", `Scenario 4 (5-Day): Successor starts cleanly on next working day Oct 23 (Got: ${t2_5d.startDate})`);

  // Repeat under 6-Day Construction Calendar (Saturday is working)
  const result6Day = recalculateSchedule(tasks, CONSTRUCTION_6_DAY_CALENDAR);
  const t1_6d = result6Day.updatedTasks.find((t) => t.id === "CAL_1")!;
  assert(t1_6d.endDate === "2025-10-21", `Scenario 4 (6-Day): Sat Oct 18 is working day; finishes Tue Oct 21 (Got: ${t1_6d.endDate})`);
  passedCount++;
}

// ─── Scenario 5: Task Delay Consuming Float Without Pushing Project End ─
console.log("\n--- Scenario 5: Delay Consumes Float (No Project Slip) ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "CRIT_MAIN",
      wbs: "5.1",
      name: "Main Core Structure",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-24", // 14 working days
      duration: 14,
      progress: 50,
      trade: "Structural",
      assignee: null,
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
      id: "FLOAT_TASK",
      wbs: "5.2",
      name: "Secondary Risers",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-10", // 5 working days
      duration: 5,
      progress: 20,
      trade: "M&E",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 9,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-08", // Slipped by +2 working days against baseline finish
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const floatTask = result.updatedTasks.find((t) => t.id === "FLOAT_TASK")!;
  const impact = calculateTaskDelayImpact(floatTask, result.updatedTasks, STANDARD_5_DAY_CALENDAR);

  assert(impact.impactType === "consuming-float", `Scenario 5: Impact correctly categorized as 'consuming-float' (Got: ${impact.impactType})`);
  assert(impact.netProjectDelayDays === 0, `Scenario 5: Net project delay is 0 days (Got: ${impact.netProjectDelayDays})`);
  assert(impact.remainingFloat > 0, `Scenario 5: Activity retains remaining float buffer of ${impact.remainingFloat}d`);
  assert(result.projectEndDate === "2025-10-24", `Scenario 5: Project end date remains intact at 2025-10-24`);
  passedCount++;
}

// ─── Scenario 6: Delay Pushing Projected Completion Date ───────────────
console.log("\n--- Scenario 6: Delay Pushes Project Completion Date ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "CRIT_SLIPPED",
      wbs: "6.1",
      name: "Critical Slab Pour",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-17",
      duration: 10,
      progress: 30,
      trade: "Structural",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: ["CRIT_NEXT"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-13", // Delayed by 4 working days
    },
    {
      id: "CRIT_NEXT",
      wbs: "6.2",
      name: "Post-Tensioning",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-21",
      endDate: "2025-10-27",
      duration: 5,
      progress: 0,
      trade: "Structural",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: ["CRIT_SLIPPED"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-14",
      baseline0Finish: "2025-10-21",
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const critTask = result.updatedTasks.find((t) => t.id === "CRIT_SLIPPED")!;
  const impact = calculateTaskDelayImpact(critTask, result.updatedTasks, STANDARD_5_DAY_CALENDAR);

  assert(impact.impactType === "critical-delay", `Scenario 6: Categorized as 'critical-delay' (Got: ${impact.impactType})`);
  assert(impact.netProjectDelayDays === 4, `Scenario 6: Net project delay is exactly 4 working days (Got: ${impact.netProjectDelayDays})`);
  assert(impact.affectedSuccessors.length === 1, `Scenario 6: Pinpoints affected downstream successor (Got: ${impact.affectedSuccessors.length})`);
  assert(impact.affectedSuccessors[0].id === "CRIT_NEXT", "Scenario 6: CRIT_NEXT identified as affected successor");
  passedCount++;
}

// ─── Scenario 7: Dynamic Recalculation Upon Duration Change ────────────
console.log("\n--- Scenario 7: Dynamic Recalculation on Duration Change ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "DUR_1",
      wbs: "7.1",
      name: "Drywall Partitions",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5, // Initially 5 days
      progress: 20,
      trade: "Finishes",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["DUR_2"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "DUR_2",
      wbs: "7.2",
      name: "Taping & Jointing",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-13",
      endDate: "2025-10-17",
      duration: 5,
      progress: 0,
      trade: "Finishes",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["DUR_1"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const res1 = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  assert(res1.projectEndDate === "2025-10-17", "Scenario 7: Initial project finish Oct 17");

  // Project manager extends DUR_1 duration from 5d to 9d
  const updatedTasks = tasks.map((t) => (t.id === "DUR_1" ? { ...t, duration: 9 } : t));
  const res2 = recalculateSchedule(updatedTasks, STANDARD_5_DAY_CALENDAR);
  const dur1 = res2.updatedTasks.find((t) => t.id === "DUR_1")!;
  const dur2 = res2.updatedTasks.find((t) => t.id === "DUR_2")!;

  // 9 working days from Mon Oct 6 ends Thu Oct 16
  assert(dur1.endDate === "2025-10-16", `Scenario 7: Extended duration finishes Thu Oct 16 (Got: ${dur1.endDate})`);
  // DUR_2 starts Fri Oct 17, 5 working days skips weekend and Diwali (Mon Oct 20) -> finishes Fri Oct 24
  assert(dur2.startDate === "2025-10-17", `Scenario 7: Successor pushes to Fri Oct 17 (Got: ${dur2.startDate})`);
  assert(dur2.endDate === "2025-10-24", `Scenario 7: Successor finishes Fri Oct 24 (Got: ${dur2.endDate})`);
  assert(res2.projectEndDate === "2025-10-24", "Scenario 7: Recalculates new project finish cleanly");
  passedCount++;
}

// ─── Scenario 8: Milestones and Multiple Predecessors ──────────────────
console.log("\n--- Scenario 8: Milestones & Multiple Predecessors ---");
{
  // A finishes Oct 10, B finishes Oct 15. Milestone M depends on BOTH A and B.
  const tasks: ProgrammeTask[] = [
    {
      id: "FEEDER_A",
      wbs: "8.1",
      name: "Substructure Signoff",
      level: "task",
      parentId: null,
      status: "complete",
      startDate: "2025-10-06",
      endDate: "2025-10-10",
      duration: 5,
      progress: 100,
      trade: "Substructure",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["MILESTONE_GATE"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "FEEDER_B",
      wbs: "8.2",
      name: "Steel Delivery",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-06",
      endDate: "2025-10-15", // finishes later
      duration: 8,
      progress: 50,
      trade: "Structural",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: [],
      successors: ["MILESTONE_GATE"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "MILESTONE_GATE",
      wbs: "8.3",
      name: "Superstructure Commencement Gate",
      level: "milestone",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-06",
      duration: 0,
      progress: 0,
      trade: "Management",
      assignee: null,
      isCritical: false,
      isMilestone: true,
      predecessors: ["FEEDER_A", "FEEDER_B"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const m = result.updatedTasks.find((t) => t.id === "MILESTONE_GATE")!;
  const feederA = result.updatedTasks.find((t) => t.id === "FEEDER_A")!;
  const feederB = result.updatedTasks.find((t) => t.id === "FEEDER_B")!;

  // Milestone start must be constrained by the LATEST predecessor (FEEDER_B finish on Oct 15 -> Oct 16)
  assert(m.startDate === "2025-10-16", `Scenario 8: Milestone bounded by driving predecessor Oct 16 (Got: ${m.startDate})`);
  assert(m.endDate === m.startDate, "Scenario 8: Milestone finish date matches start date (0d duration)");
  assert(feederB.float === 0 && feederB.isCritical === true, "Scenario 8: FEEDER_B is the driving critical predecessor");
  assert(feederA.float > 0 && feederA.isCritical === false, `Scenario 8: FEEDER_A has ${feederA.float}d float and is non-critical`);
  passedCount++;
}

// ─── Scenario 9: Safe Handling of Cyclic / Circular Dependencies ───────
console.log("\n--- Scenario 9: Safe Handling of Circular Dependencies ---");
{
  const cyclicTasks: ProgrammeTask[] = [
    {
      id: "CYCLE_A",
      wbs: "9.1",
      name: "Task A",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-06",
      endDate: "2025-10-08",
      duration: 3,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["CYCLE_C"], // Cycle: A -> B -> C -> A
      successors: ["CYCLE_B"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "CYCLE_B",
      wbs: "9.2",
      name: "Task B",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-09",
      endDate: "2025-10-13",
      duration: 3,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["CYCLE_A"],
      successors: ["CYCLE_C"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
    {
      id: "CYCLE_C",
      wbs: "9.3",
      name: "Task C",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-14",
      endDate: "2025-10-16",
      duration: 3,
      progress: 0,
      trade: "Civils",
      assignee: null,
      isCritical: false,
      isMilestone: false,
      predecessors: ["CYCLE_B"],
      successors: ["CYCLE_A"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
    },
  ];

  // Engine must execute gracefully without infinite loops or memory explosions
  const result = recalculateSchedule(cyclicTasks, STANDARD_5_DAY_CALENDAR);
  assert(result.updatedTasks.length === 3, "Scenario 9: Engine executes safely and returns all tasks under circular link");
  assert(typeof result.criticalTaskCount === "number", "Scenario 9: Critical task count returns safely without throwing");
  passedCount++;
}

// ─── Scenario 10: Baseline Comparison & Downstream Impact Propagation ──
console.log("\n--- Scenario 10: Saved Baseline Comparison & Downstream Impact ---");
{
  const tasks: ProgrammeTask[] = [
    {
      id: "BASE_1",
      wbs: "10.1",
      name: "Piling Works",
      level: "task",
      parentId: null,
      status: "in-progress",
      startDate: "2025-10-08", // Slipped 2 days from baseline 2025-10-06
      endDate: "2025-10-16",
      duration: 7,
      progress: 60,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: ["BASE_2"],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-06",
      baseline0Finish: "2025-10-14",
    },
    {
      id: "BASE_2",
      wbs: "10.2",
      name: "Basement Slab",
      level: "task",
      parentId: null,
      status: "not-started",
      startDate: "2025-10-17",
      endDate: "2025-10-24",
      duration: 5,
      progress: 0,
      trade: "Substructure",
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: ["BASE_1"],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: "2025-10-15",
      baseline0Finish: "2025-10-22",
    },
  ];

  const result = recalculateSchedule(tasks, STANDARD_5_DAY_CALENDAR);
  const base1 = result.updatedTasks.find((t) => t.id === "BASE_1")!;
  const variance = calculateScheduleVariance(base1, STANDARD_5_DAY_CALENDAR);
  const impact = calculateTaskDelayImpact(base1, result.updatedTasks, STANDARD_5_DAY_CALENDAR);

  assert(variance.hasBaseline === true, "Scenario 10: Recognizes saved baseline data");
  assert(variance.finishVariance === 2, `Scenario 10: Computes +2d finish variance (Got: ${variance.finishVariance}d)`);
  assert(impact.impactType === "critical-delay", "Scenario 10: Correctly identifies critical path slippage");
  assert(impact.netProjectDelayDays === 2, "Scenario 10: Directly propagates +2d delay to project finish");
  assert(impact.affectedSuccessorCount === 1, "Scenario 10: Identifies BASE_2 as affected downstream task");
  passedCount++;
}

console.log("\n---------------------------------------------------------------");
console.log(`Summary: ${passedCount}/10 verification scenarios passed completely.`);
console.log("---------------------------------------------------------------");
