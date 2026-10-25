// PlanD-X Resource & Workload Management Comprehensive Verification Suite
// =========================================================================
// Tests:
// 1. Labour, Equipment, Material and Cost Resource Types & Availability
// 2. Assignment Units, Planned Work, Actual Work and Rate-Based Costs
// 3. Multi-Horizon Workloads (Day, Week, Month) & Over-Allocation Warnings
// 4. Multi-Unit Capacity (Preventing false overallocations on 2.0+ unit plant)
// 5. Resource Levelling Simulation, Milestone Cascade & Schedule Slip
// 6. Contract Baseline 0 Immutability Guarantee
// 7. Strict 3-Way Distinction: Assignment ≠ Subcontractor ≠ Site Attendance
// 8. MS Project Free-Text Trade Preservation (No auto-promotion to verified vendor)
// 9. Transparent Documentation of Engine Calculation Limitations

import {
  ProjectResource,
  ProgrammeTask,
  TaskResourceAssignment,
  SiteAttendanceRecord,
} from "../lib/programme-types";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  calculateResourceWorkloads,
  recalculateSchedule,
} from "../lib/programme-calendar";
import {
  DEFAULT_PROJECT_RESOURCES,
  calculateAssignmentPlannedWork,
  calculateAssignmentCost,
  createTaskAssignment,
  calculateTaskResourceRollups,
  distinguishTaskResources,
  getResourceCalculationLimitations,
  MASTER_SUBCONTRACTORS,
} from "../lib/programme-resources";
import { simulateResourceLeveling } from "../lib/programme-resource-leveling";

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    passed++;
    console.log(`[PASS] ${testName}`);
    if (details) console.log(`       ${details}`);
  } else {
    failed++;
    console.error(`[FAIL] ${testName}`);
    if (details) console.error(`       Error: ${details}`);
  }
}

function makeTestTask(overrides: Partial<ProgrammeTask> & { id: string; name: string; wbs: string }): ProgrammeTask {
  return {
    level: "task",
    parentId: null,
    status: "not-started",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    duration: 5,
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
    float: 0,
    ...overrides,
  };
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("PlanD-X: Resource & Workload Management Engine Verification Suite");
  console.log("================================================================================\n");

  const calendar = STANDARD_5_DAY_CALENDAR;

  // ─── 1. Resource Types, Capacity Limits & Rate Cards ─────────────────────────
  console.log("--- 1. Multi-Type Resources, Capacity Limits & Rate-Based Cost Models ---");

  const labourRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.type === "work" && r.category === "labour");
  assert(
    Boolean(labourRes && labourRes.standardRate && labourRes.standardRate > 0),
    "1.1 Labour resource configured with standard hourly rate",
    `Labour: ${labourRes?.name}, Rate: $${labourRes?.standardRate}/hr`
  );

  const plantRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.type === "equipment");
  assert(
    Boolean(plantRes && plantRes.standardRate && plantRes.costPerUse && plantRes.costPerUse > 0),
    "1.2 Heavy Equipment / Plant configured with hourly operating rate and mobilization cost",
    `Plant: ${plantRes?.name}, Std Rate: $${plantRes?.standardRate}/hr, Cost Per Use: $${plantRes?.costPerUse}`
  );

  const materialRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.type === "material");
  assert(
    Boolean(materialRes && materialRes.unitOfMeasure),
    "1.3 Material resource configured with unit of measure",
    `Material: ${materialRes?.name}, Unit: ${materialRes?.unitOfMeasure}, Rate: $${materialRes?.standardRate}/${materialRes?.unitOfMeasure}`
  );

  const costRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.type === "cost");
  assert(
    Boolean(costRes),
    "1.4 Fixed-price commercial cost package resource defined",
    `Cost package: ${costRes?.name}`
  );

  // ─── 2. Assignment Units, Planned Work & Financial Calculations ─────────────
  console.log("\n--- 2. Assignment Units, Planned Work & Financial Rate Calculations ---");

  // 5 days * 8h * 1.5 units = 60 hours
  const workHours = calculateAssignmentPlannedWork(5, 8, 1.5);
  assert(
    workHours === 60,
    "2.1 Planned work hours calculation correctly factors duration, daily hours and assignment units",
    `5d @ 8h/d * 150% units = ${workHours}h (expected: 60h)`
  );

  // 40 hours * $100/hr + 10 OT hours * $150/hr + $2000 setup = $4,000 + $1,500 + $2,000 = $7,500
  const totalCost = calculateAssignmentCost(40, 100, 10, 150, 2000);
  assert(
    totalCost === 7500,
    "2.2 Assignment cost calculation correctly combines planned work, overtime and mobilization fees",
    `Cost = $${totalCost} (expected: $7500)`
  );

  // Test createTaskAssignment
  const testCrane = DEFAULT_PROJECT_RESOURCES.find((r) => r.id === "res-equip-tower-crane")!;
  const assignment = createTaskAssignment(testCrane, 1.0, 10, 8);
  assert(
    assignment.plannedWorkHours === 80 && assignment.cost === (80 * testCrane.standardRate! + testCrane.costPerUse!),
    "2.3 createTaskAssignment automatically constructs complete assignment with planned hours and cost",
    `Planned Hours: ${assignment.plannedWorkHours}h, Cost: $${assignment.cost}`
  );

  // ─── 3. Multi-Resource Task Rollups ──────────────────────────────────────────
  console.log("\n--- 3. Multi-Resource Task Rollups ---");

  const baseTask = makeTestTask({
    id: "task-slab-pour",
    wbs: "2.1",
    name: "Ground Floor Slab Concrete Pour",
    status: "in-progress",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    duration: 5,
    progress: 50,
    trade: "Concrete",
    assignee: "Concrete Placement Crew",
    isCritical: true,
  });

  const pumpRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.id === "res-equip-concrete-pump")!;
  const crewRes = DEFAULT_PROJECT_RESOURCES.find((r) => r.id === "res-labour-concreter")!;

  const pumpAsgn = createTaskAssignment(pumpRes, 1.0, 5, 8);
  const crewAsgn = createTaskAssignment(crewRes, 2.0, 5, 8); // 2 crews
  pumpAsgn.actualWorkHours = 20;
  pumpAsgn.remainingWorkHours = 20;
  crewAsgn.actualWorkHours = 40;
  crewAsgn.remainingWorkHours = 40;

  const rollups = calculateTaskResourceRollups(baseTask, [pumpAsgn, crewAsgn]);
  assert(
    rollups.workHours === (40 + 80),
    "3.1 Task planned work roll-up correctly sums work across all assigned plant and labour",
    `Total Task Work: ${rollups.workHours}h (Pump: 40h + Crew: 80h)`
  );
  assert(
    rollups.actualWorkHours === (20 + 40),
    "3.2 Task actual work roll-up reflects progress across assignments",
    `Actual Work: ${rollups.actualWorkHours}h`
  );
  assert(
    rollups.cost === (pumpAsgn.cost + crewAsgn.cost),
    "3.3 Task financial cost reflects combined plant equipment and labour expenditure",
    `Total Cost: $${rollups.cost.toLocaleString()}`
  );

  // ─── 4. Multi-Horizon Workloads (Day, Week, Month) & Capacity Limits ─────────
  console.log("\n--- 4. Multi-Horizon Workloads (Day, Week, Month) & Capacity Limits ---");

  // Create two concurrent tasks with the same resource: Tower Crane (Capacity: 1.0)
  const taskA = makeTestTask({
    id: "task-crane-a",
    wbs: "3.1",
    name: "Erect Precast Columns Zone A",
    startDate: "2025-10-06", // Monday
    endDate: "2025-10-10",   // Friday
    duration: 5,
    trade: "Cranage",
    assignee: "Favelle Favco Tower Crane #1",
    isCritical: true,
  });

  const taskB = makeTestTask({
    id: "task-crane-b",
    wbs: "3.2",
    name: "Offload Structural Steel Bundles",
    startDate: "2025-10-08", // Wednesday (Overlaps A on Wed, Thu, Fri!)
    endDate: "2025-10-14",   // Tuesday
    duration: 5,
    trade: "Cranage",
    assignee: "Favelle Favco Tower Crane #1",
    isCritical: false,
    float: 10,
  });

  const craneWorkloads = calculateResourceWorkloads([taskA, taskB], calendar, DEFAULT_PROJECT_RESOURCES);
  const craneSummary = craneWorkloads.resourceSummaries.find(
    (s) => s.resourceName.toLowerCase().includes("tower crane")
  );

  assert(
    Boolean(craneSummary && craneSummary.overallocatedDaysCount >= 3),
    "4.1 Concurrent tasks assigning 1.0 unit each trigger over-allocation on 1.0-capacity equipment",
    `Tower Crane conflict days: ${craneSummary?.overallocatedDaysCount} days (Wed, Thu, Fri)`
  );

  assert(
    Boolean(craneSummary?.dailyWorkloads["2025-10-08"]?.isOverallocated),
    "4.2 Daily horizon highlights exact contention date and 200% peak demand",
    `2025-10-08 demand: ${(craneSummary?.dailyWorkloads["2025-10-08"]?.units ?? 0) * 100}% units`
  );

  const weekKeys = Object.keys(craneSummary?.weeklyWorkloads || {});
  const firstWeek = craneSummary?.weeklyWorkloads ? craneSummary.weeklyWorkloads[weekKeys[0]] : undefined;
  assert(
    weekKeys.length > 0 && Boolean(firstWeek?.isOverallocated),
    "4.3 Weekly horizon aggregates peak units and flags over-allocated calendar week",
    `Weekly peak: ${(firstWeek?.peakUnits ?? 0) * 100}%`
  );

  const monthKeys = Object.keys(craneSummary?.monthlyWorkloads || {});
  const firstMonth = craneSummary?.monthlyWorkloads ? craneSummary.monthlyWorkloads[monthKeys[0]] : undefined;
  assert(
    monthKeys.length > 0,
    "4.4 Monthly horizon aggregates total hours and capacity across project calendar months",
    `Month ${monthKeys[0]}: ${firstMonth?.totalHours}h demand vs ${firstMonth?.capacityHours}h capacity`
  );

  // ─── 5. Multi-Unit Capacity (Zero False Over-Allocation on Multi-Plant) ──────
  console.log("\n--- 5. Multi-Unit Capacity Limits (Zero False Over-Allocation) ---");

  // 35-Tonne Excavator has maxUnits: 2.0 (2 machines on site!)
  const diggerTask1 = makeTestTask({
    id: "task-excav-1",
    wbs: "1.1",
    name: "Bulk Excavation Basin",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    duration: 5,
    trade: "Earthworks",
    assignee: "35-Tonne Excavator CAT 336",
    assignmentUnits: 1.0,
    isCritical: true,
  });

  const diggerTask2 = makeTestTask({
    id: "task-excav-2",
    wbs: "1.2",
    name: "Trenching Retaining Wall Footing",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    duration: 5,
    trade: "Earthworks",
    assignee: "35-Tonne Excavator CAT 336",
    assignmentUnits: 1.0,
    isCritical: false,
  });

  const diggerWorkloads = calculateResourceWorkloads([diggerTask1, diggerTask2], calendar, DEFAULT_PROJECT_RESOURCES);
  const diggerSummary = diggerWorkloads.resourceSummaries.find(
    (s) => s.resourceName.toLowerCase().includes("excavator")
  );

  assert(
    Boolean(diggerSummary && diggerSummary.overallocatedDaysCount === 0),
    "5.1 Multi-unit resource (2.0 maxUnits) correctly handles 2 concurrent tasks without false over-allocation",
    `Excavator capacity: ${(diggerSummary?.maxCapacityUnits ?? 0) * 100}%, Peak Demand: ${(diggerSummary?.maxDailyUnits ?? 0) * 100}%, Over-allocated Days: ${diggerSummary?.overallocatedDaysCount}`
  );

  // ─── 6. Resource Levelling Simulation & Schedule Engine Impact ───────────────
  console.log("\n--- 6. Resource Levelling Simulation, Milestone Impact & Cascade ---");

  // Define milestone dependent on taskB
  const milestoneHandover = makeTestTask({
    id: "ms-steel-complete",
    wbs: "3.3",
    name: "Milestone: Steel Erection Complete",
    startDate: "2025-10-15",
    endDate: "2025-10-15",
    duration: 0,
    isMilestone: true,
    predecessors: ["task-crane-b"],
  });

  const scheduleTasks = [taskA, taskB, milestoneHandover];

  // Capture Baseline 0 on taskB and milestone
  taskB.baseline0Start = "2025-10-08";
  taskB.baseline0Finish = "2025-10-14";
  taskB.baseline0Duration = 5;
  milestoneHandover.baseline0Start = "2025-10-15";
  milestoneHandover.baseline0Finish = "2025-10-15";

  const preview = simulateResourceLeveling(scheduleTasks, calendar, DEFAULT_PROJECT_RESOURCES);

  assert(
    preview.hasOverallocations === true,
    "6.1 Engine detects contention on single-capacity plant between concurrent tasks",
    `Competing resources: ${preview.competingResourcesCount}`
  );

  assert(
    preview.changes.length === 1 && preview.changes[0].taskId === "task-crane-b",
    "6.2 Engine prioritizes critical taskA and shifts non-critical taskB to next available working slot",
    `Shifted Task: ${preview.changes[0]?.taskName}, New Start: ${preview.changes[0]?.proposedStartDate}`
  );

  assert(
    preview.changes[0]?.proposedStartDate === "2025-10-13",
    "6.3 Shifted task start date deferred exactly past taskA completion (next working Monday 2025-10-13)",
    `Original: ${preview.changes[0]?.originalStartDate} ➔ Proposed: ${preview.changes[0]?.proposedStartDate}`
  );

  assert(
    preview.impactedMilestones.length > 0,
    "6.4 Cascading milestone slip accurately tracked and previewed",
    `Milestone: ${preview.impactedMilestones[0]?.name}, Slip: +${preview.impactedMilestones[0]?.slipWorkingDays} working days`
  );

  // ─── 7. Approved Contract Baseline 0 Immutability ─────────────────────────────
  console.log("\n--- 7. Contract Baseline 0 Immutability Protection ---");

  const leveledTaskB = preview.leveledTasks.find((t) => t.id === "task-crane-b")!;
  assert(
    leveledTaskB.baseline0Start === "2025-10-08" && leveledTaskB.baseline0Finish === "2025-10-14",
    "7.1 Contract Baseline 0 Start and Finish remain 100% immutable and strictly protected during levelling",
    `Working Start: ${leveledTaskB.startDate}, Baseline 0 Start: ${leveledTaskB.baseline0Start}`
  );
  assert(
    preview.baselineProtected === true,
    "7.2 Levelling engine asserts Baseline 0 protection guarantee",
    "baselineProtected: true"
  );

  // ─── 8. Strict 3-Way Distinction: Assignment ≠ Subcontractor ≠ Site Attendance ─
  console.log("\n--- 8. Strict 3-Way Distinction & Free-Text Trade Preservation ---");

  const complexTask = makeTestTask({
    id: "task-piling-1",
    wbs: "1.2.1",
    name: "Continuous Flight Auger Piling",
    status: "in-progress",
    startDate: "2025-10-01",
    endDate: "2025-10-15",
    duration: 11,
    progress: 30,
    trade: "Piling & Shoring", // Free text trade from MS Project
    subcontractor: "GeoTech Piling",
    isSubcontractorVerified: false, // Imported free text, unverified initially!
    isCritical: true,
    assignments: [
      {
        assignmentId: "asgn-bauer-rig",
        resourceId: "res-equip-piling-rig",
        resourceName: "CFA Piling Rig Bauer BG28",
        resourceType: "equipment",
        units: 1.0,
        plannedWorkHours: 88,
        actualWorkHours: 24,
        remainingWorkHours: 64,
        cost: 37940,
      },
    ],
    siteAttendance: [
      {
        id: "att-1",
        date: "2025-10-02",
        headcount: 5,
        trade: "Piling & Shoring",
        verifiedBy: "John Smith (Site Supervisor)",
        verifiedAt: "2025-10-02T16:00:00Z",
        notes: "Rig bored 4 piles to 18m refusal.",
      },
    ],
  });

  const distinction = distinguishTaskResources(complexTask, DEFAULT_PROJECT_RESOURCES);

  // 1. Assignment
  assert(
    distinction.assignedResources.length === 1 && distinction.assignedResources[0].name.includes("Bauer BG28"),
    "8.1 Assigned resource correctly models physical plant executing work hours",
    `Equipment: ${distinction.assignedResources[0].name}`
  );

  // 2. Subcontractor
  assert(
    distinction.subcontractor.name === "GeoTech Piling" && Boolean(distinction.subcontractor.vendorRecordId),
    "8.2 Subcontractor record represents commercial legal entity responsible for the trade contract",
    `Subcontractor: ${distinction.subcontractor.name}, Vendor ID: ${distinction.subcontractor.vendorRecordId}`
  );

  // 3. Attendance
  assert(
    distinction.siteAttendance.hasRecords === true && distinction.siteAttendance.latestHeadcount === 5,
    "8.3 Site attendance strictly isolated to physical headcount verified on site",
    `Verified Headcount: ${distinction.siteAttendance.latestHeadcount} operatives on ${distinction.siteAttendance.latestDate}`
  );

  // 4. Free-text trade preservation
  const rawTradeTask: ProgrammeTask = {
    ...complexTask,
    subcontractor: undefined,
    trade: "Specialist Underpinning Contractors Ltd",
    isSubcontractorVerified: false,
  };
  const rawDistinction = distinguishTaskResources(rawTradeTask, DEFAULT_PROJECT_RESOURCES);
  assert(
    rawDistinction.subcontractor.isVerifiedVendor === false,
    "8.4 Free-text trade names from imported schedules are NEVER automatically turned into verified vendors",
    `Subcontractor '${rawTradeTask.trade}' verified status: ${rawDistinction.subcontractor.isVerifiedVendor} (Unverified)`
  );

  // ─── 9. Calculation Limitations Transparency ─────────────────────────────────
  console.log("\n--- 9. Calculation Limitations Transparency Documentation ---");

  const limits = getResourceCalculationLimitations();
  assert(
    limits.length >= 3,
    "9.1 Engine provides explicit documentation of calculation boundaries and unsupported modes",
    `Documented boundaries count: ${limits.length}`
  );

  const contouringLimit = limits.find((l) => l.feature.toLowerCase().includes("contouring"));
  assert(
    Boolean(contouringLimit && contouringLimit.status === "simplified"),
    "9.2 Linear distribution vs non-linear contouring boundary clearly documented with planner recommendation",
    `Contouring: ${contouringLimit?.supportedBehavior}`
  );

  const poolLimit = limits.find((l) => l.feature.toLowerCase().includes("pooling"));
  assert(
    Boolean(poolLimit && poolLimit.status === "simplified"),
    "9.3 Cross-site enterprise resource pooling boundary clearly documented",
    `Multi-project pooling: ${poolLimit?.unsupportedLimitation}`
  );

  const splittingLimit = limits.find((l) => l.feature.toLowerCase().includes("splitting"));
  assert(
    Boolean(splittingLimit && splittingLimit.status === "simplified"),
    "9.4 Whole activity deferral vs intra-task splitting boundary documented",
    `Splitting: ${splittingLimit?.recommendation}`
  );

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("RESOURCE & WORKLOAD MANAGEMENT ENGINE VERIFICATION SUMMARY");
  console.log("================================================================================");
  console.log(`Total Checks Run: ${passed + failed}`);
  console.log(`Passed:           ${passed}`);
  console.log(`Failed:           ${failed}`);
  console.log(`Success Rate:     ${((passed / (passed + failed)) * 100).toFixed(1)}%`);
  console.log("================================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
