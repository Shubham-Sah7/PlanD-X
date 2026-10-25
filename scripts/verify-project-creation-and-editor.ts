/**
 * PlanD-X Automated Verification: Project Creation, Blank Programmes, Templates & Multi-Project Isolation
 * =======================================================================================================
 * Validates:
 * 1. Default demo project separation & explicit labelling (BAT-COMM-2026, isDemo: true)
 * 2. Creating a blank project with 0 tasks (no unwanted demo data preloading)
 * 3. Adding first phases, work packages, tasks & milestones into blank projects with auto-WBS numbering
 * 4. Construction templates generation (Commercial Fitout, Multi-Storey Residential, Civil Infrastructure)
 * 5. Project cloning with complete task & dependency ID regeneration (zero cross-project collisions)
 * 6. Multi-project persistence isolation (edits in Project A do not touch Project B)
 * 7. Project settings modification and safe deletion protection (demo project cannot be deleted)
 */

import {
  listAllProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  cloneProject,
  getProjectProgramme,
  saveProjectProgramme,
  DEFAULT_DEMO_PROJECT,
} from "../lib/programme-server-storage";
import { generateTemplateTasks } from "../lib/project-templates";
import { recalculateWBSHierarchy } from "../lib/programme-context";
import { recalculateSchedule, STANDARD_5_DAY_CALENDAR } from "../lib/programme-calendar";
import type { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    process.exit(1);
  }
  console.log(`  ✓ ${message}`);
}

async function runVerification() {
  console.log("\n========================================================");
  console.log("PlanD-X: Project Creation & Programme Editor Verification");
  console.log("========================================================\n");

  const author = {
    id: "test-planner",
    name: "Verification Engineer",
    email: "test@plandx.com",
    role: "Lead Quality Auditor",
  };

  // ─── TEST 1: Default Demo Project Isolation & Registry Initialization ─────
  console.log("Test 1: Default Demo Project Isolation & Explicit Labelling");
  const projects = listAllProjects();
  assert(projects.length >= 1, "Projects registry contains at least one project");
  const demo = projects.find((p) => p.id === "default-project");
  assert(!!demo, "Default demo project exists in registry");
  assert(demo?.isDemo === true, "Default demo project is explicitly labelled with isDemo: true");
  assert(demo?.code === "BAT-COMM-2026", "Default demo project has code BAT-COMM-2026");
  assert(
    demo?.name === "Battersea Commercial Redevelopment",
    "Default demo project is Battersea Commercial Redevelopment"
  );

  // ─── TEST 2: Create a Complete Blank Project from Scratch ────────────────
  console.log("\nTest 2: Create a Blank Project from Scratch (0 Tasks)");
  const blankInput = {
    name: "Apex Tower Blank Build",
    code: "PRJ-BLANK-001",
    description: "Brand new high-rise programme started from clean slate",
    location: "Manchester, UK",
    clientName: "Apex Properties Ltd",
    plannedStartDate: "2026-04-06",
    scheduleFromStart: true,
    calendarId: "cal-5day",
    currency: "GBP",
    units: "metric" as const,
    template: "blank" as const,
  };

  const { project: blankProject, programme: blankProg } = createProject(blankInput, author);
  assert(!!blankProject.id, "Blank project created with generated ID");
  assert(blankProject.isDemo === false, "Blank project is NOT marked as demo");
  assert(blankProject.code === "PRJ-BLANK-001", "Blank project code persisted correctly");
  assert(blankProg.tasks.length === 0, "Blank project has exactly 0 tasks (no preloaded demo data)");
  assert(blankProg.revisions.length >= 1, "Blank project has initial revision record");
  assert(
    blankProg.revisions[0].changeSummary?.notes?.includes("Clean blank programme") || false,
    "Initial revision documents blank state"
  );

  // ─── TEST 3: Add Tasks to Blank Project & Verify WBS Auto-Numbering ──────
  console.log("\nTest 3: Add Tasks & Milestones to Blank Project with WBS Auto-Numbering");
  // 3a. Add Phase 1
  const phase1Id = `task-phase1-${Date.now()}`;
  const phase1: ProgrammeTask = {
    id: phase1Id,
    wbs: "1",
    name: "Phase 1: Substructure & Earthworks",
    level: "phase",
    summary: true,
    parentId: null,
    status: "not-started",
    startDate: "2026-04-06",
    endDate: "2026-04-24",
    duration: 15,
    progress: 0,
    trade: "Civil",
    assignee: null,
    notes: "",
    children: [],
    predecessors: [],
    successors: [],
    depth: 0,
    float: 0,
    isCritical: false,
    isMilestone: false,
  };

  // 3b. Add Task 1.1 under Phase 1
  const task1Id = `task-act1-${Date.now()}`;
  const task1: ProgrammeTask = {
    id: task1Id,
    wbs: "1.1",
    name: "Piling & Foundation excavation",
    level: "task",
    summary: false,
    parentId: phase1Id,
    status: "not-started",
    startDate: "2026-04-06",
    endDate: "2026-04-17",
    duration: 10,
    progress: 0,
    trade: "Piling",
    assignee: "Keller Foundations",
    notes: "Site borehole reports verified.",
    children: [],
    predecessors: [],
    successors: [],
    depth: 1,
    float: 0,
    isCritical: false,
    isMilestone: false,
  };

  // 3c. Add Milestone 1.2 under Phase 1
  const m1Id = `task-m1-${Date.now()}`;
  const milestone1: ProgrammeTask = {
    id: m1Id,
    wbs: "1.2",
    name: "Substructure Complete Milestone",
    level: "milestone",
    summary: false,
    parentId: phase1Id,
    status: "not-started",
    startDate: "2026-04-17",
    endDate: "2026-04-17",
    duration: 0,
    progress: 0,
    trade: "Civil",
    assignee: null,
    notes: "",
    children: [],
    predecessors: [task1Id],
    successors: [],
    depth: 1,
    float: 0,
    isCritical: true,
    isMilestone: true,
  };

  phase1.children = [task1Id, m1Id];
  task1.successors = [m1Id];

  const structuredTasks = recalculateWBSHierarchy([phase1, task1, milestone1]);
  assert(structuredTasks[0].wbs === "1", "Phase 1 receives WBS '1'");
  assert(structuredTasks[1].wbs === "1.1", "Task 1 receives WBS '1.1'");
  assert(structuredTasks[2].wbs === "1.2", "Milestone 1 receives WBS '1.2'");

  const cpm = recalculateSchedule(structuredTasks, STANDARD_5_DAY_CALENDAR);
  assert(cpm.updatedTasks.length === 3, "CPM calculated dates for 3 tasks");
  assert(cpm.criticalPathTaskIds.length >= 1, "CPM identified critical path");

  // Save to blank project
  const saveRes = saveProjectProgramme(
    blankProject.id,
    {
      expectedVersion: 1,
      tasks: cpm.updatedTasks,
      changeDescription: "Added Phase 1 with activity and milestone",
    },
    author
  );
  assert(saveRes.success === true, "Saved tasks to blank project successfully");
  assert(saveRes.version === 2, "Programme version incremented to v2");

  // Verify reload
  const reloaded = getProjectProgramme(blankProject.id, author);
  assert(reloaded.tasks.length === 3, "Reloaded programme retains 3 created tasks");
  assert(reloaded.version === 2, "Reloaded programme is at version 2");

  // ─── TEST 4: Construction Templates Creation ─────────────────────────────
  console.log("\nTest 4: Construction Project Templates Generation");
  // 4a. Commercial Fitout Template
  const { project: fitoutProj, programme: fitoutProg } = createProject(
    {
      name: "City Square Commercial Fitout",
      code: "PRJ-FITOUT-2026",
      template: "commercial-fitout",
      plannedStartDate: "2026-05-04",
    },
    author
  );
  assert(fitoutProg.tasks.length === 16, "Commercial fitout template contains 16 activities (4 phases + 10 tasks + 2 milestones)");
  const fitoutPhases = fitoutProg.tasks.filter((t) => t.level === "phase");
  assert(fitoutPhases.length === 4, "Commercial fitout template contains 4 distinct phases");
  const fitoutMilestones = fitoutProg.tasks.filter((t) => t.isMilestone);
  assert(fitoutMilestones.length === 2, "Commercial fitout contains Strip-out & PC milestones");

  // 4b. Multi-Storey Residential Template
  const { project: resProj, programme: resProg } = createProject(
    {
      name: "Harbour View Residential Tower",
      code: "PRJ-RES-2026",
      template: "multi-storey-residential",
      plannedStartDate: "2026-06-01",
    },
    author
  );
  assert(resProg.tasks.length === 15, "Multi-storey residential template contains 15 activities");
  const resTopOut = resProg.tasks.find((t) => t.name.includes("Topping Out"));
  assert(!!resTopOut && resTopOut.isMilestone, "Residential template includes Topping Out milestone");

  // 4c. Civil Infrastructure Template
  const { project: civilProj, programme: civilProg } = createProject(
    {
      name: "A4 Highway Bypass & Civil Works",
      code: "PRJ-CIVIL-2026",
      template: "civil-infrastructure",
      plannedStartDate: "2026-07-06",
    },
    author
  );
  assert(civilProg.tasks.length === 11, "Civil infrastructure template contains 11 activities");
  const civilPhases = civilProg.tasks.filter((t) => t.level === "phase");
  assert(civilPhases.length === 3, "Civil template contains Earthworks, Utilities, Pavement phases");

  // ─── TEST 5: Duplicate / Clone Project with Complete ID Regeneration ─────
  console.log("\nTest 5: Project Duplication with Full Identifier Regeneration");
  const { project: clonedProj, programme: clonedProg } = cloneProject(
    fitoutProj.id,
    "City Square Fitout Phase 2 (Duplicate)",
    author
  );
  assert(clonedProj.id !== fitoutProj.id, "Cloned project has a distinct project ID");
  assert(clonedProj.code === `${fitoutProj.code}-CPY`, "Cloned project code has -CPY suffix");
  assert(clonedProg.tasks.length === fitoutProg.tasks.length, "Cloned project has identical task count");

  // Check every task has a new ID and zero collisions with original tasks
  const originalIds = new Set(fitoutProg.tasks.map((t) => t.id));
  const clonedIds = new Set(clonedProg.tasks.map((t) => t.id));
  let collisionCount = 0;
  for (const cid of clonedIds) {
    if (originalIds.has(cid)) collisionCount++;
  }
  assert(collisionCount === 0, "Zero task ID collisions between original and cloned projects");

  // Verify parent references point to the new IDs
  const clonedTaskWithParent = clonedProg.tasks.find((t) => t.parentId !== null);
  assert(!!clonedTaskWithParent, "Found cloned task with parent");
  assert(clonedIds.has(clonedTaskWithParent!.parentId!), "Cloned task parentId points to a new cloned task ID");
  assert(!originalIds.has(clonedTaskWithParent!.parentId!), "Cloned task parentId does NOT point to original task");

  // ─── TEST 6: Multi-Project Persistence Isolation ─────────────────────────
  console.log("\nTest 6: Multi-Project Persistence Isolation");
  // Edit a task in fitoutProj
  const modifiedTasks = fitoutProg.tasks.map((t) =>
    t.id === fitoutProg.tasks[0].id ? { ...t, name: "MODIFIED PHASE 1 NAME" } : t
  );
  saveProjectProgramme(
    fitoutProj.id,
    {
      expectedVersion: 1,
      tasks: modifiedTasks,
      changeDescription: "Rename Phase 1",
    },
    author
  );

  const reloadedFitout = getProjectProgramme(fitoutProj.id, author);
  const reloadedCloned = getProjectProgramme(clonedProj.id, author);
  assert(
    reloadedFitout.tasks[0].name === "MODIFIED PHASE 1 NAME",
    "Fitout project saved modified task name"
  );
  assert(
    reloadedCloned.tasks[0].name !== "MODIFIED PHASE 1 NAME",
    "Cloned project task name remains unchanged (Strict Isolation)"
  );

  // ─── TEST 7: Project Settings Updates ────────────────────────────────────
  console.log("\nTest 7: Project Settings Updates");
  const updatedProj = updateProject(blankProject.id, {
    name: "Apex Tower Central Phase 1",
    location: "Manchester City Centre",
    currency: "EUR",
  });
  assert(updatedProj.name === "Apex Tower Central Phase 1", "Project name updated");
  assert(updatedProj.location === "Manchester City Centre", "Project location updated");
  assert(updatedProj.currency === "EUR", "Project currency updated");

  // ─── TEST 8: Safe Deletion & Demo Project Protection ─────────────────────
  console.log("\nTest 8: Safe Deletion & Demo Project Protection");
  // Try deleting default demo project
  let demoDeleteBlocked = false;
  try {
    deleteProject("default-project");
  } catch (err: any) {
    demoDeleteBlocked = true;
    assert(
      err?.message?.includes("demonstration") || false,
      "Demonstration project deletion prevented with descriptive error"
    );
  }
  assert(demoDeleteBlocked, "Demo project cannot be deleted");

  // Delete temporary test projects
  const del1 = deleteProject(blankProject.id);
  assert(del1.success === true, "User blank project deleted successfully");
  const del2 = deleteProject(fitoutProj.id);
  assert(del2.success === true, "User fitout project deleted successfully");
  const del3 = deleteProject(resProj.id);
  assert(del3.success === true, "User residential project deleted successfully");
  const del4 = deleteProject(civilProj.id);
  assert(del4.success === true, "User civil project deleted successfully");
  const del5 = deleteProject(clonedProj.id);
  assert(del5.success === true, "User cloned project deleted successfully");

  const finalProjects = listAllProjects();
  assert(
    !finalProjects.some((p) => p.id === blankProject.id),
    "Deleted project is removed from projects registry"
  );
  assert(
    finalProjects.some((p) => p.id === "default-project"),
    "Default demo project remains intact"
  );

  console.log("\n🎉 ALL 8 PROJECT CREATION & PROGRAMME EDITOR TESTS PASSED!\n");
}

runVerification().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
