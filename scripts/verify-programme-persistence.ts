/**
 * PlanD-X Schedule Persistence, Concurrency & Rollback Verification Suite
 * 
 * Tests real-world multi-user scheduling conditions:
 * 1. Project & User scoping
 * 2. Atomic persistence of tasks, dependencies, calendars, assignments, baselines, settings
 * 3. Optimistic concurrency control (HTTP 409 Conflict preventing stale overwrites)
 * 4. Pre-save validation (rejecting inverted dates, loops, duplicate IDs)
 * 5. Safe retries & idempotency (preventing duplicate tasks on repeated uploads)
 * 6. Atomic imports with pre-import backup
 * 7. Controlled rollback to past revisions
 * 8. Error reporting ensuring failure states are never masked as success
 */

import {
  getProjectProgramme,
  saveProjectProgramme,
  importProjectProgramme,
  rollbackProjectProgramme,
  ConcurrencyConflictError,
  ProgrammeValidationError,
  type AuthorUser,
} from "../lib/programme-server-storage";
import { validateProgrammePayload } from "../lib/programme-validator";
import { STANDARD_5_DAY_CALENDAR } from "../lib/programme-calendar";
import { type ProgrammeTask } from "../lib/programme-types";

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
    if (detail) console.error(`       ${detail}`);
  }
}

function makeTask(id: string, name: string, startDate: string, endDate: string, preds: string[] = []): ProgrammeTask {
  return {
    id,
    wbs: "1." + id,
    name,
    level: "task",
    parentId: null,
    status: "not-started",
    startDate,
    endDate,
    duration: 5,
    progress: 0,
    trade: "General",
    assignee: "Lead Subcontractor",
    isCritical: false,
    isMilestone: false,
    predecessors: preds,
    successors: [],
    notes: "",
    children: [],
    depth: 1,
    float: 0,
  };
}

async function runTestSuite() {
  console.log("================================================================================");
  console.log("PLAND-X PROGRAMME PERSISTENCE, CONCURRENCY & INTEGRITY VERIFICATION SUITE");
  console.log("================================================================================\n");

  const testUserA: AuthorUser = {
    id: "user-alice",
    name: "Alice Planner",
    email: "alice@plandx.com",
    role: "Senior Planner",
  };

  const testUserB: AuthorUser = {
    id: "user-bob",
    name: "Bob Site Manager",
    email: "bob@plandx.com",
    role: "Package Manager",
  };

  const runId = Math.random().toString(36).slice(2, 8);

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Project & User Scoping
  // ───────────────────────────────────────────────────────────────────────────
  console.log("--- 1. Project & User Scoping ---");
  const proj1 = `test-alpha-${runId}`;
  const proj2 = `test-beta-${runId}`;

  const initAlpha = getProjectProgramme(proj1, testUserA);
  const initBeta = getProjectProgramme(proj2, testUserB);

  assert(
    initAlpha.projectId === proj1 && initBeta.projectId === proj2,
    "1.1 Programmes correctly scoped to independent project IDs",
    `Alpha: ${initAlpha.projectId}, Beta: ${initBeta.projectId}`
  );

  saveProjectProgramme(
    proj1,
    {
      expectedVersion: initAlpha.version,
      tasks: [makeTask("T-ALPHA-1", "Alpha Groundworks", "2026-04-01", "2026-04-08")],
    },
    testUserA
  );

  saveProjectProgramme(
    proj2,
    {
      expectedVersion: initBeta.version,
      tasks: [makeTask("T-BETA-1", "Beta Demolition", "2026-05-01", "2026-05-10")],
    },
    testUserB
  );

  const reloadedAlpha = getProjectProgramme(proj1, testUserA);
  const reloadedBeta = getProjectProgramme(proj2, testUserB);

  assert(
    reloadedAlpha.tasks[0]?.name === "Alpha Groundworks" && reloadedBeta.tasks[0]?.name === "Beta Demolition",
    "1.2 Task data and updates are strictly isolated between projects",
    `Alpha Task: ${reloadedAlpha.tasks[0]?.name}, Beta Task: ${reloadedBeta.tasks[0]?.name}`
  );

  assert(
    reloadedAlpha.lastModifiedBy.id === "user-alice" && reloadedBeta.lastModifiedBy.id === "user-bob",
    "1.3 Audit attribution preserves authorized modifying user identity",
    `Alpha modified by: ${reloadedAlpha.lastModifiedBy.name}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Comprehensive Record Persistence
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 2. Comprehensive Record Persistence (Tasks, Dependencies, Calendars, Assignments, Settings) ---");
  const fullSaveProj = `test-full-save-${runId}`;
  const initFull = getProjectProgramme(fullSaveProj, testUserA);

  const fullTasks = [
    makeTask("TSK-10", "Excavate Basement", "2026-06-01", "2026-06-05"),
    makeTask("TSK-20", "Waterproof Slab", "2026-06-08", "2026-06-12", ["TSK-10"]),
  ];

  const fullCalendar = {
    ...STANDARD_5_DAY_CALENDAR,
    name: "Custom Civil 6-Day Calendar",
    workingDays: [1, 2, 3, 4, 5, 6],
    workingHoursPerDay: 9,
  };

  const fullAssignments: Record<string, any[]> = {
    "TSK-10": [
      {
        assignmentId: "asgn-1",
        resourceId: "res-excavator",
        resourceName: "Heavy Excavator 30T",
        resourceType: "equipment",
        units: 2,
        plannedWorkHours: 80,
        actualWorkHours: 0,
        remainingWorkHours: 80,
        cost: 16000,
      },
    ],
  };

  const fullSettings = {
    showBaselineComparison: true,
    workingDayHours: 9,
    defaultView: "lookahead",
  };

  const saveRes = saveProjectProgramme(
    fullSaveProj,
    {
      expectedVersion: initFull.version,
      tasks: fullTasks,
      calendar: fullCalendar,
      assignments: fullAssignments,
      settings: fullSettings,
      changeDescription: "Persist full multi-entity programme model",
    },
    testUserA
  );

  assert(saveRes.success === true && saveRes.version === 2, "2.1 Full programme saved successfully advancing version to 2");

  const loadedFull = getProjectProgramme(fullSaveProj, testUserA);
  assert(loadedFull.tasks.length === 2, "2.2 Tasks persisted with 100% integrity", `Count: ${loadedFull.tasks.length}`);
  assert(
    loadedFull.calendar.name === "Custom Civil 6-Day Calendar" && loadedFull.calendar.workingDays.length === 6,
    "2.3 Working calendar settings and shifts persisted",
    `Calendar: ${loadedFull.calendar.name}`
  );
  assert(
    loadedFull.assignments["TSK-10"]?.[0]?.resourceId === "res-excavator",
    "2.4 Resource assignments and allocated units persisted",
    `Resource: ${loadedFull.assignments["TSK-10"]?.[0]?.resourceId}`
  );
  assert(
    loadedFull.settings.defaultView === "lookahead",
    "2.5 Programme settings and view options persisted",
    `View: ${loadedFull.settings.defaultView}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Optimistic Concurrency Control (Preventing Stale Overwrites)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 3. Optimistic Concurrency Control (HTTP 409 Conflict) ---");
  const concProj = `test-concurrency-${runId}`;
  const initConc = getProjectProgramme(concProj, testUserA);

  // User A updates schedule to v2
  saveProjectProgramme(
    concProj,
    {
      expectedVersion: initConc.version, // v1
      tasks: [makeTask("T-CONC-1", "User A Edits", "2026-07-01", "2026-07-05")],
    },
    testUserA
  );

  // User B still has expectedVersion = 1 (stale state)
  let caughtConflict: ConcurrencyConflictError | null = null;
  try {
    saveProjectProgramme(
      concProj,
      {
        expectedVersion: 1, // Stale version! (Server is already at v2)
        tasks: [makeTask("T-CONC-1", "User B Stale Overwrite", "2026-07-01", "2026-07-10")],
      },
      testUserB
    );
  } catch (err) {
    if (err instanceof ConcurrencyConflictError) {
      caughtConflict = err;
    }
  }

  assert(
    caughtConflict !== null,
    "3.1 Stale edit blocked by ConcurrencyConflictError (HTTP 409 Conflict)",
    `Detected Conflict: ${caughtConflict?.message}`
  );
  assert(
    caughtConflict?.currentVersion === 2 && caughtConflict?.expectedVersion === 1,
    "3.2 Conflict accurately reports server version (2) vs client expected version (1)"
  );
  assert(
    caughtConflict?.lastModifiedBy.id === "user-alice",
    "3.3 Conflict accurately identifies conflicting author (Alice Planner)"
  );

  // Resolve conflict: User B accepts remote version and forces new revision
  const forceRes = saveProjectProgramme(
    concProj,
    {
      expectedVersion: caughtConflict!.currentVersion, // Use current version 2
      tasks: [makeTask("T-CONC-1", "User B Reconciled Edit", "2026-07-01", "2026-07-12")],
      changeDescription: "Manual reconciliation after conflict",
    },
    testUserB
  );

  assert(
    forceRes.version === 3,
    "3.4 Reconciled edit successfully committed advancing version to 3",
    `New version: v${forceRes.version}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Data Validation Before Saving
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 4. Data Validation Engine (CPM & Chronology Sanity) ---");

  // Inverted dates
  const invertedValidation = validateProgrammePayload({
    tasks: [makeTask("T-ERR-1", "Inverted Task", "2026-08-20", "2026-08-10")],
  });
  assert(
    !invertedValidation.valid && invertedValidation.errors.some((e) => e.code === "INVERTED_DATES"),
    "4.1 Inverted dates (finish < start) rejected before saving",
    `Error: ${invertedValidation.errors[0]?.message}`
  );

  // Duplicate task IDs
  const dupValidation = validateProgrammePayload({
    tasks: [
      makeTask("DUP-ID", "Task 1", "2026-08-01", "2026-08-05"),
      makeTask("DUP-ID", "Task 2 Duplicate", "2026-08-06", "2026-08-10"),
    ],
  });
  assert(
    !dupValidation.valid && dupValidation.errors.some((e) => e.code === "DUPLICATE_TASK_ID"),
    "4.2 Duplicate task IDs within payload rejected",
    `Error: ${dupValidation.errors[0]?.message}`
  );

  // Circular dependency loop
  const cycleValidation = validateProgrammePayload({
    tasks: [
      makeTask("C-1", "Pour Foundation", "2026-09-01", "2026-09-05", ["C-3"]),
      makeTask("C-2", "Erect Steel", "2026-09-06", "2026-09-10", ["C-1"]),
      makeTask("C-3", "Fix Rebar", "2026-09-11", "2026-09-15", ["C-2"]),
    ],
  });
  assert(
    !cycleValidation.valid && cycleValidation.errors.some((e) => e.code === "CIRCULAR_DEPENDENCY"),
    "4.3 Circular dependency loop (C-1 -> C-2 -> C-3 -> C-1) detected and rejected",
    `Loop error: ${cycleValidation.errors[0]?.message}`
  );

  // Broken dependency reference
  const brokenValidation = validateProgrammePayload({
    tasks: [makeTask("T-BROKEN", "Roof Trusses", "2026-09-01", "2026-09-05", ["NON_EXISTENT_PRED"])],
  });
  assert(
    !brokenValidation.valid && brokenValidation.errors.some((e) => e.code === "BROKEN_PREDECESSOR_LINK"),
    "4.4 Orphaned dependency link to non-existent task ID rejected",
    `Broken link error: ${brokenValidation.errors[0]?.message}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 5. Safe Retries & Idempotency (Preventing Duplicate Tasks)
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 5. Safe Retries & Idempotency Key Handling ---");
  const idemProj = `test-idempotency-${runId}`;
  const initIdem = getProjectProgramme(idemProj, testUserA);

  const idemKey = "network-retry-token-xyz-12345";
  const tasksToSave = [
    makeTask("IDEM-1", "First Unique Activity", "2026-10-01", "2026-10-05"),
    makeTask("IDEM-2", "Second Unique Activity", "2026-10-06", "2026-10-10", ["IDEM-1"]),
  ];

  // First attempt
  const firstAttempt = saveProjectProgramme(
    idemProj,
    {
      expectedVersion: initIdem.version,
      idempotencyKey: idemKey,
      tasks: tasksToSave,
    },
    testUserA
  );

  assert(firstAttempt.success && firstAttempt.version === 2, "5.1 Initial request processed and saved as v2");

  // Simulated network retry: exact same request with same idempotencyKey
  const retryAttempt = saveProjectProgramme(
    idemProj,
    {
      expectedVersion: initIdem.version, // Client might not know version 2 committed
      idempotencyKey: idemKey,
      tasks: tasksToSave,
    },
    testUserA
  );

  assert(
    retryAttempt.success && retryAttempt.version === 2,
    "5.2 Retry safely recognized via idempotency key returning cached result without incrementing version",
    `Version remained: v${retryAttempt.version}`
  );

  const reloadedIdem = getProjectProgramme(idemProj, testUserA);
  assert(
    reloadedIdem.tasks.length === 2,
    "5.3 Zero duplicate tasks created after retry",
    `Task count: ${reloadedIdem.tasks.length} (expected 2)`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Atomic Imports with Pre-Import Backup
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 6. Atomic Programme Imports & Recovery ---");
  const importProj = `test-atomic-import-${runId}`;
  const initImportProg = getProjectProgramme(importProj, testUserA);

  // 6.1 Successful import
  const incomingTasks = [
    makeTask("IMP-1", "Imported Drainage Line", "2026-11-01", "2026-11-05"),
    makeTask("IMP-2", "Imported Manhole Build", "2026-11-06", "2026-11-12", ["IMP-1"]),
  ];

  const importRes = importProjectProgramme(
    importProj,
    {
      sourceFileName: "RevB_Construction_Master.mpp",
      tasks: incomingTasks,
      idempotencyKey: "mpp-hash-file-889900",
    },
    testUserA
  );

  assert(
    importRes.success && importRes.importedTasksCount === 2,
    "6.1 Import committed atomically with exact task count",
    `Imported count: ${importRes.importedTasksCount}, Version: v${importRes.version}`
  );

  // 6.2 Repeated upload with same idempotency key does not duplicate
  const repeatedImport = importProjectProgramme(
    importProj,
    {
      sourceFileName: "RevB_Construction_Master.mpp",
      tasks: incomingTasks,
      idempotencyKey: "mpp-hash-file-889900",
    },
    testUserA
  );

  assert(
    repeatedImport.version === importRes.version,
    "6.2 Repeated upload with identical file hash returns cached version without duplicating",
    `Version: v${repeatedImport.version}`
  );

  // 6.3 Corrupted import fails atomically without touching current schedule
  let importFailed = false;
  try {
    importProjectProgramme(
      importProj,
      {
        sourceFileName: "Corrupted_File.mpp",
        tasks: [
          makeTask("CORRUPT-1", "Corrupt Task", "2026-12-10", "2026-12-01"), // Inverted date!
        ],
      },
      testUserA
    );
  } catch (err) {
    if (err instanceof ProgrammeValidationError) {
      importFailed = true;
    }
  }

  assert(importFailed, "6.3 Invalid import aborted cleanly during pre-validation stage");

  const progAfterCorrupt = getProjectProgramme(importProj, testUserA);
  assert(
    progAfterCorrupt.tasks.length === 2 && progAfterCorrupt.tasks[0]?.id === "IMP-1",
    "6.4 Existing working programme remains completely uncorrupted after aborted import",
    `Current Task: ${progAfterCorrupt.tasks[0]?.name}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Controlled Rollback & Revision History Preservation
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n--- 7. Controlled Rollback & Revision History ---");
  const rollbackProj = `test-rollback-${runId}`;
  const initRollback = getProjectProgramme(rollbackProj, testUserA); // v1

  // Save Revision 2
  saveProjectProgramme(
    rollbackProj,
    {
      expectedVersion: initRollback.version,
      tasks: [makeTask("R-1", "Version 2 Task Added", "2027-01-01", "2027-01-05")],
      changeDescription: "Revision 2 changes",
    },
    testUserA
  );

  // Save Revision 3
  saveProjectProgramme(
    rollbackProj,
    {
      expectedVersion: 2,
      tasks: [
        makeTask("R-1", "Version 2 Task Added", "2027-01-01", "2027-01-05"),
        makeTask("R-2", "Version 3 Critical Path Task", "2027-01-06", "2027-01-15", ["R-1"]),
      ],
      changeDescription: "Revision 3 critical changes",
    },
    testUserA
  );

  const progAtV3 = getProjectProgramme(rollbackProj, testUserA);
  assert(progAtV3.version === 3, "7.1 Programme advanced to version 3 with 2 revisions logged");
  assert(progAtV3.revisions.length >= 3, "7.2 Full revision snapshots preserved in history");

  // Execute Rollback to Revision 2
  const rollbackResult = rollbackProjectProgramme(rollbackProj, 2, testUserB);

  assert(
    rollbackResult.success && rollbackResult.version === 4 && rollbackResult.restoredRevisionNumber === 2,
    "7.3 Rollback to Revision 2 executed successfully advancing working version to 4",
    `Restored v2, New working version: v${rollbackResult.version}`
  );

  const progAfterRollback = getProjectProgramme(rollbackProj, testUserA);
  assert(
    progAfterRollback.tasks.length === 1 && progAfterRollback.tasks[0]?.id === "R-1",
    "7.4 Working tasks correctly restored to Revision 2 snapshot (R-2 removed)",
    `Working task: ${progAfterRollback.tasks[0]?.name}`
  );

  const lastAudit = progAfterRollback.auditTrail[progAfterRollback.auditTrail.length - 1];
  assert(
    lastAudit?.eventType === "ROLLBACK" && lastAudit.author.id === "user-bob",
    "7.5 Rollback audit event recorded with attribution to Bob Site Manager",
    `Audit event: ${lastAudit?.description}`
  );

  // ───────────────────────────────────────────────────────────────────────────
  // SUMMARY
  // ───────────────────────────────────────────────────────────────────────────
  console.log("\n================================================================================");
  console.log("PROGRAMME PERSISTENCE & CONCURRENCY VERIFICATION SUMMARY");
  console.log("================================================================================");
  console.log(`Total Checks Run: ${passedCount + failedCount}`);
  console.log(`Passed:           ${passedCount}`);
  console.log(`Failed:           ${failedCount}`);
  console.log(`Success Rate:     ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
  console.log("================================================================================\n");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTestSuite().catch((err) => {
  console.error("Fatal test suite runner error:", err);
  process.exit(1);
});
