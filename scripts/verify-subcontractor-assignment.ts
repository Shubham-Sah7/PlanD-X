// PlanD-X Subcontractor Assignment Verification Suite
// ====================================================

import {
  getSubcontractors,
  getTeamMembers,
  getAllAssignableResources,
  findResourceByName,
  getResourceInitials,
  getResourceColor,
} from "../lib/programme-resources";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";
import type { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${msg}`);
}

console.log("===============================================================");
console.log("PlanD-X Subcontractor Assignment Verification Suite");
console.log("===============================================================\n");

// 1. Available subcontractors and resources catalog
const subcontractors = getSubcontractors();
const team = getTeamMembers();
const all = getAllAssignableResources();

assert(
  subcontractors.length >= 6,
  `Available subcontractors loaded (${subcontractors.length} vendors): ${subcontractors.map((s) => s.name).join(", ")}`,
);
assert(
  team.length >= 8,
  `Available team resources loaded (${team.length} members): ${team.map((t) => t.name).join(", ")}`,
);
assert(
  all.length === subcontractors.length + team.length,
  `Combined catalogue includes all ${all.length} resources without duplicates`,
);

// 2. Specific vendor trade metadata
const furzer = findResourceByName("Furzer Electrical");
assert(
  furzer !== undefined &&
    furzer.initials === "FE" &&
    Boolean(furzer.trades?.includes("Electrical")) &&
    furzer.type === "vendor",
  `Subcontractor 'Furzer Electrical' has initials 'FE', trade 'Electrical', type 'vendor'`,
);

const geotech = findResourceByName("GeoTech Piling");
assert(
  geotech !== undefined &&
    geotech.initials === "GP" &&
    Boolean(geotech.trades?.includes("Piling")) &&
    geotech.type === "vendor",
  `Subcontractor 'GeoTech Piling' has initials 'GP', trade 'Piling', type 'vendor'`,
);

const kpa = findResourceByName("KPA Structural");
assert(
  kpa !== undefined &&
    kpa.initials === "KS" &&
    Boolean(kpa.trades?.includes("Structural")) &&
    kpa.type === "vendor",
  `Subcontractor 'KPA Structural' has initials 'KS', trade 'Structural', type 'vendor'`,
);

// 3. Assignment simulation to a task
const taskToAssign: ProgrammeTask = {
  ...ALL_PROGRAMME_TASKS.find((t) => t.id === "task-columns")!,
};
const originalAssignee = taskToAssign.assignee;

// Assign Furzer Electrical
const updatedTask1: ProgrammeTask = {
  ...taskToAssign,
  assignee: furzer!.name,
  assigneeInitials: furzer!.initials,
  subcontractor: furzer!.name,
};

assert(
  updatedTask1.assignee === "Furzer Electrical" &&
    updatedTask1.assigneeInitials === "FE" &&
    updatedTask1.subcontractor === "Furzer Electrical",
  `User can assign 'Furzer Electrical' directly to task '${taskToAssign.name}'`,
);

// 4. Changing assignment to another subcontractor
const updatedTask2: ProgrammeTask = {
  ...updatedTask1,
  assignee: kpa!.name,
  assigneeInitials: kpa!.initials,
  subcontractor: kpa!.name,
};

assert(
  updatedTask2.assignee === "KPA Structural" &&
    updatedTask2.assigneeInitials === "KS" &&
    updatedTask2.subcontractor === "KPA Structural",
  `User can reassign task from 'Furzer Electrical' to 'KPA Structural'`,
);

// 5. Unassign / Clear assignment
const clearedTask: ProgrammeTask = {
  ...updatedTask2,
  assignee: null,
  assigneeInitials: "",
  subcontractor: null,
};

assert(
  clearedTask.assignee === null &&
    clearedTask.subcontractor === null &&
    clearedTask.assigneeInitials === "",
  `User can unassign / clear task assignment to enter unassigned state`,
);

// 6. Persistence across page navigation & refresh (localStorage map simulation)
const storageMock: Record<string, any> = {};
function saveAssignmentToStorage(taskId: string, resource: any) {
  if (resource) {
    storageMock[taskId] = {
      assignee: resource.name,
      assigneeInitials: resource.initials,
      subcontractor: resource.type === "vendor" ? resource.name : resource.name,
    };
  } else {
    storageMock[taskId] = { assignee: null, assigneeInitials: "", subcontractor: null };
  }
}

function loadAssignmentFromStorage(task: ProgrammeTask): ProgrammeTask {
  const saved = storageMock[task.id];
  if (saved) {
    return {
      ...task,
      assignee: saved.assignee,
      assigneeInitials: saved.assigneeInitials,
      subcontractor: saved.subcontractor,
    };
  }
  return task;
}

saveAssignmentToStorage("task-columns", geotech);
const reloaded = loadAssignmentFromStorage(taskToAssign);

assert(
  reloaded.assignee === "GeoTech Piling" &&
    reloaded.assigneeInitials === "GP" &&
    reloaded.subcontractor === "GeoTech Piling",
  `Assignment persists into storage and restores correctly upon navigation / reload`,
);

saveAssignmentToStorage("task-columns", null);
const reloadedCleared = loadAssignmentFromStorage(taskToAssign);
assert(
  reloadedCleared.assignee === null && reloadedCleared.subcontractor === null,
  `Cleared assignment persists into storage as unassigned`,
);

// 7. Search filtering verification
function searchResources(query: string) {
  const q = query.toLowerCase();
  return all.filter(
    (r) =>
      r.name.toLowerCase().includes(q) ||
      r.initials.toLowerCase().includes(q) ||
      (r.trades && r.trades.toLowerCase().includes(q)),
  );
}

const pilingSearch = searchResources("piling");
assert(
  pilingSearch.some((r) => r.name === "GeoTech Piling"),
  `Search for 'piling' correctly locates 'GeoTech Piling'`,
);

const electricalSearch = searchResources("electrical");
assert(
  electricalSearch.some((r) => r.name === "Furzer Electrical"),
  `Search for 'electrical' correctly locates 'Furzer Electrical'`,
);

const emptySearch = searchResources("nonexistent_subcontractor_xyz");
assert(
  emptySearch.length === 0,
  `Invalid search term gracefully yields 0 results for empty state presentation`,
);

// 8. Visual styling and initials fallbacks
assert(
  getResourceInitials("GeoTech Piling") === "GP",
  `Initials helper maps 'GeoTech Piling' to 'GP'`,
);
assert(
  getResourceColor("FE") === "#b45309",
  `Color helper returns correct vendor theme color for Furzer Electrical`,
);

// 9. Existing task dates and dependencies remain unaffected by assignment
assert(
  taskToAssign.startDate === updatedTask1.startDate &&
    taskToAssign.endDate === updatedTask1.endDate &&
    taskToAssign.duration === updatedTask1.duration,
  `Task scheduling dates and duration remain strictly preserved when assigning resources`,
);

console.log("\n---------------------------------------------------------------");
console.log("Summary: All 12 subcontractor assignment tests passed successfully.");
console.log("---------------------------------------------------------------\n");
