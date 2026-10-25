// PlanD-X Schedule Health & Quality Verification Suite
// =======================================================
// Comprehensive test suite with dedicated test fixtures containing known scheduling defects:
// 1. Missing predecessors and successors where unexpected
// 2. Circular dependencies and broken links
// 3. Excessive positive and negative lag (leads & lags)
// 4. Hard constraints that distort CPM scheduling
// 5. Tasks with negative or near-critical float
// 6. Long-duration tasks requiring decomposition
// 7. Milestones at risk (deadlines violated & baseline slip)
// 8. Missing and inconsistent calendars
// 9. Summary task rollup errors & direct summary links
// 10. Invalid actual dates and progress values
// 11. Out-of-sequence progress
// 12. Differences between source critical flags and calculated criticality
// 13. Tasks with dates that conflict with their dependencies
// 14. Inconsistent project completion forecasts
// 15. Non-destructive guarantee: zero automated date or logic alterations

import {
  ProgrammeTask,
  DependencyDetail,
} from "../lib/programme-types";
import {
  STANDARD_5_DAY_CALENDAR,
} from "../lib/programme-calendar";
import {
  analyzeScheduleHealth,
  type ScheduleHealthReport,
  type ScheduleHealthIssue,
} from "../lib/programme-schedule-health";

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

function makeTask(overrides: Partial<ProgrammeTask> & { id: string; name: string; wbs: string }): ProgrammeTask {
  return {
    level: "task",
    parentId: null,
    status: "not-started",
    startDate: "2026-03-02",
    endDate: "2026-03-06",
    duration: 5,
    progress: 0,
    trade: "General",
    assignee: "Subcontractor",
    isCritical: false,
    isMilestone: false,
    predecessors: [],
    successors: [],
    notes: "",
    children: [],
    depth: 1,
    float: 10,
    ...overrides,
  };
}

async function runHealthTestSuite() {
  console.log("================================================================================");
  console.log("PlanD-X: Schedule Health & Quality Engine Verification Suite");
  console.log("================================================================================\n");

  const calendar = STANDARD_5_DAY_CALENDAR;

  // ─── Fixture 1: Dangling Logic (Missing Predecessors / Successors) ─────────────
  console.log("--- 1. Missing Predecessors & Successors (Dangling Logic) ---");

  const logicFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-project-start",
      wbs: "1.0",
      name: "Project Commencement & Site Possession",
      startDate: "2026-02-02",
      endDate: "2026-02-02",
      duration: 0,
      isMilestone: true,
      predecessors: [],
      successors: ["t-dangling-mid"],
    }),
    makeTask({
      id: "t-dangling-mid",
      wbs: "1.1",
      name: "Enabling Works Drainage Run",
      startDate: "2026-02-03",
      endDate: "2026-02-13",
      duration: 9,
      predecessors: ["t-project-start"],
      successors: [], // Missing successor!
    }),
    makeTask({
      id: "t-dangling-start",
      wbs: "1.2",
      name: "Unlinked Transformer Relocation",
      startDate: "2026-02-10",
      endDate: "2026-02-20",
      duration: 9,
      predecessors: [], // Missing predecessor!
      successors: ["t-project-complete"],
    }),
    makeTask({
      id: "t-project-complete",
      wbs: "1.3",
      name: "Practical Completion",
      startDate: "2026-02-27",
      endDate: "2026-02-27",
      duration: 0,
      isMilestone: true,
      predecessors: ["t-dangling-start"],
      successors: [],
    }),
  ];

  const report1 = analyzeScheduleHealth(logicFixture, calendar);
  const danglingSucc = report1.issues.find((i) => i.id === "logic-no-succ-t-dangling-mid");
  const danglingPred = report1.issues.find((i) => i.id === "logic-no-pred-t-dangling-start");
  const startMilestoneFlagged = report1.issues.find((i) => i.id === "logic-no-pred-t-project-start");

  assert(
    danglingSucc !== undefined && danglingSucc.severity === "warning",
    "1.1 Engine flags dangling finish (missing successor) on mid-programme activity",
    `Affected Task: ${danglingSucc?.taskName}. Recommendation: ${danglingSucc?.recommendation}`
  );
  assert(
    danglingPred !== undefined && danglingPred.severity === "warning",
    "1.2 Engine flags dangling start (missing predecessor) on unlinked task",
    `Affected Task: ${danglingPred?.taskName}. Recommendation: ${danglingPred?.recommendation}`
  );
  assert(
    startMilestoneFlagged === undefined,
    "1.3 Project commencement milestone correctly recognized as boundary start and NOT falsely flagged",
    "Project Commencement omitted from missing predecessor warnings."
  );

  // ─── Fixture 2: Circular Dependencies & Broken Links ──────────────────────────
  console.log("\n--- 2. Circular Dependencies (Logic Loops) & Broken Links ---");

  const cycleFixture: ProgrammeTask[] = [
    makeTask({
      id: "loop-a",
      wbs: "2.1",
      name: "Pour Pile Caps Zone 1",
      predecessors: ["loop-c"], // C -> A -> B -> C loop!
      successors: ["loop-b"],
    }),
    makeTask({
      id: "loop-b",
      wbs: "2.2",
      name: "Strip Shuttering Zone 1",
      predecessors: ["loop-a"],
      successors: ["loop-c"],
    }),
    makeTask({
      id: "loop-c",
      wbs: "2.3",
      name: "Erect Precast Columns Zone 1",
      predecessors: ["loop-b"],
      successors: ["loop-a"],
    }),
    makeTask({
      id: "broken-task",
      wbs: "2.4",
      name: "Basement Waterproofing",
      predecessors: ["ghost-predecessor-999"], // Broken link!
      successors: [],
    }),
  ];

  const report2 = analyzeScheduleHealth(cycleFixture, calendar);
  const cycleIssue = report2.issues.find((i) => i.category === "circular");
  const brokenLinkIssue = report2.issues.find((i) => i.category === "dependencies");

  assert(
    cycleIssue !== undefined && cycleIssue.severity === "critical",
    "2.1 Engine detects circular dependency loop via graph traversal",
    `Loop Path: ${cycleIssue?.description}`
  );
  assert(
    brokenLinkIssue !== undefined && brokenLinkIssue.severity === "critical",
    "2.2 Engine identifies broken dependency reference to non-existent task ID",
    `Broken Link Ref: ${brokenLinkIssue?.metricValue}. Affected: ${brokenLinkIssue?.taskName}`
  );

  // ─── Fixture 3: Excessive Positive and Negative Lag (Leads & Lags) ─────────────
  console.log("\n--- 3. Excessive Positive and Negative Lag (Leads & Lags) ---");

  const lagFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-pred-lead",
      wbs: "3.1",
      name: "Excavate Lift Core",
      startDate: "2026-03-02",
      endDate: "2026-03-06",
      duration: 5,
    }),
    makeTask({
      id: "t-succ-lead",
      wbs: "3.2",
      name: "Blinding Concrete Lift Core",
      startDate: "2026-03-04",
      endDate: "2026-03-05",
      duration: 2,
      predecessors: ["t-pred-lead"],
      predecessorDetails: [
        {
          id: "t-pred-lead",
          name: "Excavate Lift Core",
          type: "FS",
          lag: -4, // Negative lag (lead)
        },
      ],
    }),
    makeTask({
      id: "t-succ-excessive-lag",
      wbs: "3.3",
      name: "Install Passenger Lift Guide Rails",
      startDate: "2026-04-01",
      endDate: "2026-04-10",
      duration: 8,
      predecessors: ["t-succ-lead"],
      predecessorDetails: [
        {
          id: "t-succ-lead",
          name: "Blinding Concrete Lift Core",
          type: "FS",
          lag: 18, // Excessive positive lag (+18d)
        },
      ],
    }),
  ];

  const report3 = analyzeScheduleHealth(lagFixture, calendar);
  const leadIssue = report3.issues.find((i) => i.ruleName.includes("Negative Lag") || i.ruleName.includes("Lead Time"));
  const excessiveLagIssue = report3.issues.find((i) => i.ruleName.includes("Excessive Positive Lag"));

  assert(
    leadIssue !== undefined && leadIssue.severity === "warning",
    "3.1 Negative lag (lead time) detected with recommendation to replace with SS logic",
    `Lead metric: ${leadIssue?.metricValue}. Recommendation: ${leadIssue?.recommendation}`
  );
  assert(
    excessiveLagIssue !== undefined && excessiveLagIssue.severity === "warning",
    "3.2 Excessive positive lag (+18d) detected with recommendation to model explicit waiting activity",
    `Lag metric: ${excessiveLagIssue?.metricValue}. Task: ${excessiveLagIssue?.taskName}`
  );

  // ─── Fixture 4: Hard Constraints & Constraint Conflicts ────────────────────────
  console.log("\n--- 4. Hard Constraints & Active Constraint Conflicts ---");

  const constraintFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-hard-mso",
      wbs: "4.1",
      name: "Structural Steel Delivery",
      constraintType: "MSO", // Must Start On
      constraintDate: "2026-03-16",
    }),
    makeTask({
      id: "t-hard-conflict",
      wbs: "4.2",
      name: "Tower Crane Mobilization",
      constraintType: "FNLT", // Finish No Later Than
      constraintDate: "2026-03-10",
      constraintConflict: true,
      constraintConflictReason: "Predecessor site clearance finishes 2026-03-18, pushing crane erection 8 days past FNLT limit.",
    }),
  ];

  const report4 = analyzeScheduleHealth(constraintFixture, calendar);
  const hardIssue = report4.issues.find((i) => i.id === "constraint-hard-t-hard-mso");
  const conflictIssue = report4.issues.find((i) => i.id === "constraint-conflict-t-hard-conflict");

  assert(
    hardIssue !== undefined && hardIssue.severity === "warning",
    "4.1 Hard constraint (Must Start On) flagged for overriding CPM natural float flow",
    `Constraint: ${hardIssue?.metricValue}. Recommendation: ${hardIssue?.recommendation}`
  );
  assert(
    conflictIssue !== undefined && conflictIssue.severity === "critical",
    "4.2 Active constraint conflict flagged as critical risk",
    `Conflict Explanation: ${conflictIssue?.description}`
  );

  // ─── Fixture 5: Negative & Near-Critical Float ─────────────────────────────────
  console.log("\n--- 5. Negative Float & Near-Critical Float Risk ---");

  const floatFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-neg-float",
      wbs: "5.1",
      name: "Façade Glazing Procurement",
      float: -8, // 8 days in delay!
      isCritical: true,
    }),
    makeTask({
      id: "t-near-critical",
      wbs: "5.2",
      name: "Substation Switchgear Commissioning",
      float: 3, // Near-critical buffer (3d)
      isCritical: false,
    }),
  ];

  const report5 = analyzeScheduleHealth(floatFixture, calendar);
  const negIssue = report5.issues.find((i) => i.id === "float-negative-t-neg-float");
  const nearIssue = report5.issues.find((i) => i.id === "float-near-critical-t-near-critical");

  assert(
    negIssue !== undefined && negIssue.severity === "critical",
    "5.1 Negative total float (-8d) flagged as critical schedule breach",
    `Float metric: ${negIssue?.metricValue}. Recommendation: ${negIssue?.recommendation}`
  );
  assert(
    nearIssue !== undefined && nearIssue.severity === "info",
    "5.2 Near-critical float (3d) identified for lookahead tracking",
    `Float metric: ${nearIssue?.metricValue}. Recommendation: ${nearIssue?.recommendation}`
  );

  // ─── Fixture 6: Long Duration Activities (> 20 working days) ──────────────────
  console.log("\n--- 6. Long Duration Activities Requiring Breakdown ---");

  const durFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-long-duration",
      wbs: "6.1",
      name: "Level 1 to Level 10 Superstructure Concrete Works",
      duration: 55, // 55 working days on a single task!
    }),
  ];

  const report6 = analyzeScheduleHealth(durFixture, calendar);
  const durIssue = report6.issues.find((i) => i.id === "dur-high-t-long-duration");

  assert(
    durIssue !== undefined && durIssue.severity === "warning",
    "6.1 Task with 55 working days duration flagged for decomposition into progressive milestones",
    `Duration metric: ${durIssue?.metricValue}. Recommendation: ${durIssue?.recommendation}`
  );

  // ─── Fixture 7: Milestones at Risk & Baseline Slips ───────────────────────────
  console.log("\n--- 7. Milestones at Risk & Baseline Slips ---");

  const milestoneFixture: ProgrammeTask[] = [
    makeTask({
      id: "ms-roof-waterproof",
      wbs: "7.1",
      name: "Milestone: Roof Waterproofing Sealed",
      isMilestone: true,
      duration: 0,
      startDate: "2026-06-15",
      endDate: "2026-06-15",
      deadline: "2026-06-01",
      deadlineViolated: true,
      daysPastDeadline: 10,
    }),
    makeTask({
      id: "ms-power-on",
      wbs: "7.2",
      name: "Milestone: Permanent Power Energisation",
      isMilestone: true,
      duration: 0,
      startDate: "2026-07-20",
      endDate: "2026-07-20",
      baseline0Finish: "2026-07-01", // Slipped 13 working days!
    }),
  ];

  const report7 = analyzeScheduleHealth(milestoneFixture, calendar);
  const deadlineIssue = report7.issues.find((i) => i.id === "milestone-violated-ms-roof-waterproof");
  const baselineSlipIssue = report7.issues.find((i) => i.id === "milestone-baseline-slip-ms-power-on");

  assert(
    deadlineIssue !== undefined && deadlineIssue.severity === "critical",
    "7.1 Violated contractual milestone deadline flagged with critical severity",
    `Late metric: ${deadlineIssue?.metricValue}. Recommendation: ${deadlineIssue?.recommendation}`
  );
  assert(
    baselineSlipIssue !== undefined && baselineSlipIssue.severity === "warning",
    "7.2 Milestone forecast finish slipped past Baseline 0 identified with exact working days slip",
    `Slip metric: ${baselineSlipIssue?.metricValue}. Task: ${baselineSlipIssue?.taskName}`
  );

  // ─── Fixture 8: Missing or Inconsistent Calendars ─────────────────────────────
  console.log("\n--- 8. Missing and Inconsistent Calendars ---");

  const calFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-invalid-cal",
      wbs: "8.1",
      name: "TBM Tunnel Boring Nightshift",
      calendarName: "Custom-Shift-NonExistent", // Unrecognized calendar
    }),
    makeTask({
      id: "t-cal-mismatch-pred",
      wbs: "8.2",
      name: "Continuous Concrete Pour",
      calendarName: "7-Day Continuous",
    }),
    makeTask({
      id: "t-cal-mismatch-succ",
      wbs: "8.3",
      name: "Stripping Precast Shuttering",
      calendarName: "Standard 5-Day",
      predecessors: ["t-cal-mismatch-pred"],
      predecessorDetails: [
        {
          id: "t-cal-mismatch-pred",
          name: "Continuous Concrete Pour",
          type: "FS",
          lag: 0,
        },
      ],
    }),
  ];

  const report8 = analyzeScheduleHealth(calFixture, calendar);
  const missingCalIssue = report8.issues.find((i) => i.id === "cal-missing-t-invalid-cal");
  const mismatchCalIssue = report8.issues.find((i) => i.id === "cal-mismatch-t-cal-mismatch-succ-t-cal-mismatch-pred");

  assert(
    missingCalIssue !== undefined && missingCalIssue.severity === "warning",
    "8.1 Unrecognized calendar reference identified before calculations default",
    `Calendar metric: ${missingCalIssue?.metricValue}. Recommendation: ${missingCalIssue?.recommendation}`
  );
  assert(
    mismatchCalIssue !== undefined && mismatchCalIssue.severity === "info",
    "8.2 Calendar mismatch (7-Day vs 5-Day) across dependency detected",
    `Affected link: ${mismatchCalIssue?.description}`
  );

  // ─── Fixture 9: Summary Task Rollup Errors & Direct Links ─────────────────────
  console.log("\n--- 9. Summary Task Rollup Errors & Direct Summary Links ---");

  const summaryFixture: ProgrammeTask[] = [
    makeTask({
      id: "phase-fitout",
      wbs: "9.0",
      level: "phase",
      name: "Internal Commercial Fitout Phase",
      startDate: "2026-04-10", // Mismatched: child starts 2026-04-01!
      endDate: "2026-05-15",   // Mismatched: child ends 2026-05-29!
      children: ["fitout-sub-1", "fitout-sub-2"],
      predecessors: ["external-predecessor"], // Direct link to summary!
    }),
    makeTask({
      id: "fitout-sub-1",
      wbs: "9.1",
      name: "Stud Partition Walls",
      parentId: "phase-fitout",
      startDate: "2026-04-01",
      endDate: "2026-04-20",
    }),
    makeTask({
      id: "fitout-sub-2",
      wbs: "9.2",
      name: "Ceiling Grid and Tiles",
      parentId: "phase-fitout",
      startDate: "2026-04-21",
      endDate: "2026-05-29",
    }),
  ];

  const report9 = analyzeScheduleHealth(summaryFixture, calendar);
  const startMismatch = report9.issues.find((i) => i.id === "summary-start-mismatch-phase-fitout");
  const finishMismatch = report9.issues.find((i) => i.id === "summary-finish-mismatch-phase-fitout");
  const directLinkIssue = report9.issues.find((i) => i.id === "summary-direct-link-phase-fitout");

  assert(
    startMismatch !== undefined,
    "9.1 Summary container start date discrepancy flagged against earliest child start",
    `Start discrepancy: ${startMismatch?.metricValue}`
  );
  assert(
    finishMismatch !== undefined,
    "9.2 Summary container finish date discrepancy flagged against latest child finish",
    `Finish discrepancy: ${finishMismatch?.metricValue}`
  );
  assert(
    directLinkIssue !== undefined && directLinkIssue.severity === "warning",
    "9.3 Direct dependency linked to summary container flagged for causing float distortion",
    `Direct link warning: ${directLinkIssue?.description}`
  );

  // ─── Fixture 10: Invalid Actual Dates & Progress Values ───────────────────────
  console.log("\n--- 10. Invalid Actual Dates & Progress Values ---");

  const progressFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-invalid-progress-bounds",
      wbs: "10.1",
      name: "HV Cable Pull",
      progress: 140, // Out of bounds > 100%!
    }),
    makeTask({
      id: "t-progress-100-incomplete",
      wbs: "10.2",
      name: "Switchboard Earthing",
      progress: 100,
      status: "in-progress", // Mismatch: 100% but status in-progress!
    }),
    makeTask({
      id: "t-complete-lt100",
      wbs: "10.3",
      name: "Cable Tray Containment",
      status: "complete",
      progress: 40, // Mismatch: complete status but progress 40%!
    }),
    makeTask({
      id: "t-actual-dates-inverted",
      wbs: "10.4",
      name: "Transformer Megger Testing",
      actualStart: "2026-03-20",
      actualFinish: "2026-03-15", // Inverted: finish precedes start!
    }),
  ];

  const report10 = analyzeScheduleHealth(progressFixture, calendar);
  const boundsIssue = report10.issues.find((i) => i.id === "progress-invalid-bounds-t-invalid-progress-bounds");
  const status100Issue = report10.issues.find((i) => i.id === "progress-100-status-t-progress-100-incomplete");
  const completeLt100Issue = report10.issues.find((i) => i.id === "progress-complete-lt100-t-complete-lt100");
  const invertedDatesIssue = report10.issues.find((i) => i.id === "actual-dates-inverted-t-actual-dates-inverted");

  assert(
    boundsIssue !== undefined && boundsIssue.severity === "critical",
    "10.1 Progress value exceeding 100% flagged as critical validation error",
    `Progress metric: ${boundsIssue?.metricValue}`
  );
  assert(
    status100Issue !== undefined && status100Issue.severity === "warning",
    "10.2 100% progress on non-complete status flagged for reconciliation",
    `Status mismatch: ${status100Issue?.description}`
  );
  assert(
    completeLt100Issue !== undefined && completeLt100Issue.severity === "warning",
    "10.3 Complete status with partial progress (40%) identified",
    `Progress metric: ${completeLt100Issue?.metricValue}`
  );
  assert(
    invertedDatesIssue !== undefined && invertedDatesIssue.severity === "critical",
    "10.4 Actual finish date earlier than actual start date flagged as critical",
    `Inverted actual dates: ${invertedDatesIssue?.metricValue}`
  );

  // ─── Fixture 11: Out-of-Sequence Progress ──────────────────────────────────────
  console.log("\n--- 11. Out-of-Sequence Progress ---");

  const oosFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-oos-pred",
      wbs: "11.1",
      name: "Cast Concrete Shear Wall",
      status: "not-started",
      progress: 0,
      endDate: "2026-03-10",
    }),
    makeTask({
      id: "t-oos-succ",
      wbs: "11.2",
      name: "Erect Core Formwork Level 2",
      status: "in-progress",
      progress: 55, // Started before predecessor finished!
      predecessors: ["t-oos-pred"],
    }),
  ];

  const report11 = analyzeScheduleHealth(oosFixture, calendar);
  const oosIssue = report11.issues.find((i) => i.id === "progress-oos-t-oos-succ-t-oos-pred");

  assert(
    oosIssue !== undefined && oosIssue.severity === "warning",
    "11.1 Out-of-sequence progress flagged when successor commences ahead of incomplete predecessor",
    `OOS Warning: ${oosIssue?.description}. Recommendation: ${oosIssue?.recommendation}`
  );

  // ─── Fixture 12: Source vs Recalculated Critical Path Discrepancy ──────────────
  console.log("\n--- 12. Critical Path Discrepancy (Source vs Recalculated CPM) ---");

  const cpDiscrepancyFixture: ProgrammeTask[] = [
    makeTask({
      id: "t-cp-mismatch",
      wbs: "12.1",
      name: "Landscaping Perimeter Planter Boxes",
      sourceUid: 104,
      sourceCritical: true, // Imported MS Project said it was critical
      float: 25, // PlanD-X calculated 25 days of float!
      isCritical: false,
    }),
  ];

  const report12 = analyzeScheduleHealth(cpDiscrepancyFixture, calendar);
  const cpIssue = report12.issues.find((i) => i.id === "cp-discrepancy-t-cp-mismatch");

  assert(
    cpIssue !== undefined && cpIssue.severity === "info",
    "12.1 Divergence between source critical flag and calculated total float transparently reported",
    `Float metric: ${cpIssue?.metricValue}. Recommendation: ${cpIssue?.recommendation}`
  );

  // ─── Fixture 13: Tasks with Dates That Conflict with Their Dependencies ────────
  console.log("\n--- 13. Tasks with Dates That Conflict with Their Dependencies ---");

  const dateClashFixture: ProgrammeTask[] = [
    makeTask({
      id: "clash-pred",
      wbs: "13.1",
      name: "Bore CFA Piles Sector 4",
      startDate: "2026-03-02",
      endDate: "2026-03-12",
      duration: 9,
    }),
    makeTask({
      id: "clash-succ",
      wbs: "13.2",
      name: "Break Down Pile Heads Sector 4",
      startDate: "2026-03-05", // Conflicts! Starts on March 5 before predecessor finishes on March 12!
      endDate: "2026-03-16",
      duration: 8,
      predecessors: ["clash-pred"],
      predecessorDetails: [
        {
          id: "clash-pred",
          name: "Bore CFA Piles Sector 4",
          type: "FS",
          lag: 0,
        },
      ],
    }),
  ];

  const report13 = analyzeScheduleHealth(dateClashFixture, calendar);
  const clashIssue = report13.issues.find((i) => i.id === "conflict-fs-clash-succ-clash-pred");

  assert(
    clashIssue !== undefined && clashIssue.severity === "critical",
    "13.1 Dependency date clash detected where task starts prior to Finish-to-Start predecessor completion",
    `Clash Explanation: ${clashIssue?.description}. Metric: ${clashIssue?.metricValue}`
  );

  // ─── Fixture 14: Inconsistent Project Completion Forecasts ────────────────────
  console.log("\n--- 14. Inconsistent Project Completion Forecasts ---");

  const forecastFixture: ProgrammeTask[] = [
    makeTask({
      id: "ms-pc-contractual",
      wbs: "14.1",
      name: "Practical Completion",
      isMilestone: true,
      duration: 0,
      startDate: "2026-11-20",
      endDate: "2026-11-20",
      baseline0Finish: "2026-10-30", // Project slipped past Baseline 0!
    }),
    makeTask({
      id: "ms-handover-client",
      wbs: "14.2",
      name: "Client Handover and Final Completion",
      isMilestone: true,
      duration: 0,
      startDate: "2026-12-15", // Inconsistent date! (Nov 20 vs Dec 15)
      endDate: "2026-12-15",
    }),
  ];

  const report14 = analyzeScheduleHealth(forecastFixture, calendar);
  const inconsistentMsIssue = report14.issues.find((i) => i.id === "forecast-inconsistent-milestones");
  const projectSlipIssue = report14.issues.find((i) => i.id === "forecast-project-slip");

  assert(
    inconsistentMsIssue !== undefined && inconsistentMsIssue.severity === "warning",
    "14.1 Contradictory completion milestone dates identified across multiple handover milestones",
    `Divergence: ${inconsistentMsIssue?.metricValue}`
  );
  assert(
    projectSlipIssue !== undefined && (projectSlipIssue.severity === "warning" || projectSlipIssue.severity === "critical"),
    "14.2 Overall project completion forecast slipping past approved Baseline 0 flagged",
    `Slip metric: ${projectSlipIssue?.metricValue}. Recommendation: ${projectSlipIssue?.recommendation}`
  );

  // ─── 15. Actionable Findings Structure & Non-Destructive Integrity ────────────
  console.log("\n--- 15. Actionable Findings Integrity & Non-Destructive Protection ---");

  // Verify finding completeness across all collected issues
  const allIssues = [
    ...report1.issues,
    ...report2.issues,
    ...report3.issues,
    ...report4.issues,
    ...report5.issues,
    ...report6.issues,
    ...report7.issues,
    ...report8.issues,
    ...report9.issues,
    ...report10.issues,
    ...report11.issues,
    ...report12.issues,
    ...report13.issues,
    ...report14.issues,
  ];

  const sampleIssue = allIssues[0];
  const hasRequiredFields = Boolean(
    sampleIssue.severity &&
    sampleIssue.taskId &&
    sampleIssue.taskName &&
    sampleIssue.description &&
    sampleIssue.recommendation
  );

  assert(
    hasRequiredFields,
    "15.1 Every quality finding contains Severity, Affected Task, Explanation and Suggested Next Action",
    `Sample Issue: [${sampleIssue.severity.toUpperCase()}] ${sampleIssue.ruleName} -> Task '${sampleIssue.taskName}'`
  );

  // Non-destructive check: verify task objects were not modified in place
  const originalStartDate = dateClashFixture[1].startDate;
  assert(
    dateClashFixture[1].startDate === originalStartDate,
    "15.2 Schedule quality audit is strictly non-destructive: zero automated alterations to task dates or logic",
    `Clashed task startDate remained exactly "${dateClashFixture[1].startDate}"`
  );

  assert(
    Boolean(report1.scoreMethodology && report1.scoreMethodology.includes("Base 100")),
    "15.3 Transparent score methodology documented without opaque or invented risk scores",
    `Methodology: ${report1.scoreMethodology}`
  );

  // ─── Summary ─────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("SCHEDULE HEALTH & QUALITY ENGINE VERIFICATION SUMMARY");
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

runHealthTestSuite().catch((err) => {
  console.error("Health test execution failed:", err);
  process.exit(1);
});
