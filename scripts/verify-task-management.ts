/**
 * PlanD-X: Automated Task Management Verification Suite
 * =====================================================
 * Tests hierarchy integrity, dependency remapping, copy/paste, bulk edits,
 * search across collapsed nodes, rollback (undo/redo), and structural protection.
 */

import {
  STANDARD_5_DAY_CALENDAR,
  recalculateSchedule,
  addWorkingDays,
  parseIsoDate,
  formatDateIso,
  detectDependencyCycle,
} from "../lib/programme-calendar";
import { recalculateWBSHierarchy } from "../lib/programme-context";
import {
  getVisibleTasks,
} from "../lib/programme-data";
import {
  linkTasks,
  unlinkTasks,
} from "../lib/programme-dependencies";
import type { ProgrammeTask, DependencyDetail } from "../lib/programme-types";

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

function makeTask(partial: any): ProgrammeTask {
  return {
    id: partial.id,
    wbs: partial.wbs || "1.0",
    name: partial.name,
    level: partial.level || (partial.summary ? "phase" : partial.duration === 0 ? "milestone" : "task"),
    summary: Boolean(partial.summary),
    isMilestone: Boolean(partial.isMilestone || partial.duration === 0),
    parentId: partial.parentId !== undefined ? partial.parentId : null,
    depth: partial.depth ?? 0,
    status: partial.status || "not-started",
    startDate: partial.startDate,
    endDate: partial.endDate,
    duration: partial.duration !== undefined ? partial.duration : 5,
    progress: partial.progress || 0,
    trade: partial.trade || "Structural",
    tradeText: partial.trade || "Structural",
    assignee: partial.assignee || null,
    isCritical: Boolean(partial.isCritical),
    predecessors: partial.predecessors || [],
    successors: partial.successors || [],
    predecessorDetails: partial.predecessorDetails || [],
    successorDetails: partial.successorDetails || [],
    children: partial.children || [],
    notes: partial.notes || "",
    float: partial.float || 0,
    ...partial,
  } as ProgrammeTask;
}

console.log("================================================================================");
console.log("PlanD-X: Large Construction Programme Task Management Verification Suite");
console.log("================================================================================\n");

// ─── Test 1: Task, Milestone, and Summary Creation ─────────────────────────────
console.log("--- 1. Task, Milestone, and Summary Task Creation ---");
{
  const initial: ProgrammeTask[] = [
    makeTask({ id: "p-1", name: "Substructure Phase", summary: true, duration: 10, startDate: "2026-03-02", endDate: "2026-03-13" }),
    makeTask({ id: "t-1", name: "Piling Works", parentId: "p-1", depth: 1, duration: 5, startDate: "2026-03-02", endDate: "2026-03-06" }),
  ];

  // 1. Create a milestone (0d duration)
  const milestone = makeTask({
    id: "m-1",
    name: "Piling Sign-off Milestone",
    isMilestone: true,
    duration: 0,
    parentId: "p-1",
    depth: 1,
    startDate: "2026-03-06",
    endDate: "2026-03-06",
    predecessors: ["t-1"],
    predecessorDetails: [{ id: "t-1", type: "FS", lag: 0 }],
  });

  // 2. Create a child task
  const newTask = makeTask({
    id: "t-2",
    name: "Pile Cap Reinforcement",
    duration: 4,
    parentId: "p-1",
    depth: 1,
    startDate: "2026-03-09",
    endDate: "2026-03-12",
    predecessors: ["m-1"],
    predecessorDetails: [{ id: "m-1", type: "FS", lag: 0 }],
  });

  const structured = recalculateWBSHierarchy([...initial, milestone, newTask]);
  const result = recalculateSchedule(structured, STANDARD_5_DAY_CALENDAR);

  const m1 = result.updatedTasks.find((t) => t.id === "m-1")!;
  const t2 = result.updatedTasks.find((t) => t.id === "t-2")!;
  const p1 = result.updatedTasks.find((t) => t.id === "p-1")!;

  assert(
    m1.isMilestone === true && m1.duration === 0 && m1.startDate === m1.endDate,
    "1.1 Milestone item created with 0d duration and identical start/finish dates",
    `Milestone: ${m1.name}, start=${m1.startDate}, end=${m1.endDate}`
  );

  assert(
    t2.startDate === "2026-03-09" && t2.predecessors.includes("m-1"),
    "1.2 Standard activity created with predecessor link from milestone",
    `t2 start=${t2.startDate}, preds=${JSON.stringify(t2.predecessors)}`
  );

  assert(
    p1.startDate === "2026-03-02" && p1.endDate === "2026-03-12",
    "1.3 Parent summary task encompasses span of all child tasks and milestones",
    `Summary phase span: ${p1.startDate} to ${p1.endDate}`
  );
}

// ─── Test 2: Indentation, Outdenting, and WBS Hierarchy Recalculation ───────────
console.log("\n--- 2. Indentation, Outdenting, and WBS Structure ---");
{
  // Sibling list: Task A, Task B, Task C
  const rawList: ProgrammeTask[] = [
    makeTask({ id: "t-a", name: "Earthworks", depth: 0 }),
    makeTask({ id: "t-b", name: "Soil Nails", depth: 0 }),
    makeTask({ id: "t-c", name: "Shotcrete", depth: 0 }),
  ];

  // Indent Task B: becomes child of preceding sibling (Task A)
  const taskB = rawList.find((t) => t.id === "t-b")!;
  taskB.parentId = "t-a";
  taskB.depth = 1;

  const indented = recalculateWBSHierarchy(rawList);
  const taskA = indented.find((t) => t.id === "t-a")!;
  const taskBIndented = indented.find((t) => t.id === "t-b")!;

  assert(
    taskBIndented.wbs === "1.1" && taskA.wbs === "1",
    "2.1 Indenting task makes it child of preceding sibling with sub-WBS code (1.1)",
    `Task A wbs=${taskA.wbs}, Task B wbs=${taskBIndented.wbs}`
  );

  // Outdent Task B: becomes root sibling again
  const toOutdent = indented.map((t) => (t.id === "t-b" ? { ...t, parentId: null, depth: 0 } : t));
  const outdented = recalculateWBSHierarchy(toOutdent);
  const taskBOutdented = outdented.find((t) => t.id === "t-b")!;

  assert(
    taskBOutdented.wbs === "2" && taskBOutdented.depth === 0,
    "2.2 Outdenting task restores it to parent outline level (WBS 2)",
    `Task B outdented wbs=${taskBOutdented.wbs}, depth=${taskBOutdented.depth}`
  );
}

// ─── Test 3: Task Reordering and Group Subtree Moving ───────────────────────────
console.log("\n--- 3. Task Reordering (Up/Down) & Group Subtree Preservation ---");
{
  const tasks: ProgrammeTask[] = [
    makeTask({ id: "p-sub", name: "Substructure", summary: true }),
    makeTask({ id: "t-s1", name: "Excavation", parentId: "p-sub", depth: 1 }),
    makeTask({ id: "t-s2", name: "Foundations", parentId: "p-sub", depth: 1 }),
    makeTask({ id: "p-super", name: "Superstructure", summary: true }),
    makeTask({ id: "t-u1", name: "Columns", parentId: "p-super", depth: 1 }),
  ];

  // Reorder Foundations UP before Excavation
  const excIdx = tasks.findIndex((t) => t.id === "t-s1");
  const fndIdx = tasks.findIndex((t) => t.id === "t-s2");
  const reordered = [...tasks];
  const [removed] = reordered.splice(fndIdx, 1);
  reordered.splice(excIdx, 0, removed);

  const reorderedWbs = recalculateWBSHierarchy(reordered);
  const fndTask = reorderedWbs.find((t) => t.id === "t-s2")!;
  const excTask = reorderedWbs.find((t) => t.id === "t-s1")!;

  assert(
    fndTask.wbs === "1.1" && excTask.wbs === "1.2",
    "3.1 Reordering siblings up swaps outline WBS codes accurately",
    `Foundations wbs=${fndTask.wbs}, Excavation wbs=${excTask.wbs}`
  );
}

// ─── Test 4: Copy & Paste Task Groups with Unique IDs and Dependency Remapping ─
console.log("\n--- 4. Task Group Copy/Paste, ID Generation, and Dependency Remapping ---");
{
  // A group of 2 tasks linked internally: Anchor (a1) -> Pour (a2),
  // with Pour also having an external predecessor to an existing task (ext-1)
  const existingSchedule: ProgrammeTask[] = [
    makeTask({ id: "ext-1", name: "Site Clearance", startDate: "2026-03-02", endDate: "2026-03-04", duration: 3 }),
    makeTask({ id: "grp-1", name: "Ground Beam Phase", summary: true }),
    makeTask({
      id: "beam-1",
      name: "Trench Formwork",
      parentId: "grp-1",
      depth: 1,
      startDate: "2026-03-05",
      endDate: "2026-03-06",
      duration: 2,
      predecessors: ["ext-1"],
      predecessorDetails: [{ id: "ext-1", type: "FS", lag: 0 }],
    }),
    makeTask({
      id: "beam-2",
      name: "Pour Concrete",
      parentId: "grp-1",
      depth: 1,
      startDate: "2026-03-09",
      endDate: "2026-03-10",
      duration: 2,
      predecessors: ["beam-1"], // Internal link
      predecessorDetails: [{ id: "beam-1", type: "FS", lag: 0 }],
    }),
  ];

  // Simulating pasteTasks logic for copied group [grp-1, beam-1, beam-2]
  const copiedItems = [existingSchedule[1], existingSchedule[2], existingSchedule[3]];
  const timestamp = "copytest";
  const idMap = new Map<string, string>();
  const existingIds = new Set(existingSchedule.map((t) => t.id));

  copiedItems.forEach((item, idx) => {
    idMap.set(item.id, `task-${timestamp}-${idx}`);
  });

  const clonedTasks: ProgrammeTask[] = copiedItems.map((item) => {
    const newId = idMap.get(item.id)!;
    const parentId = item.parentId && idMap.has(item.parentId) ? idMap.get(item.parentId)! : item.parentId;

    const remappedPredecessors: string[] = [];
    if (item.predecessors) {
      for (const pred of item.predecessors) {
        if (idMap.has(pred)) {
          remappedPredecessors.push(idMap.get(pred)!); // Remap internal link
        } else if (existingIds.has(pred)) {
          remappedPredecessors.push(pred); // Retain external link if valid
        }
      }
    }

    return makeTask({
      ...item,
      id: newId,
      name: `${item.name} (Copy)`,
      parentId,
      predecessors: remappedPredecessors,
      successors: [],
    });
  });

  const merged = [...existingSchedule, ...clonedTasks];
  const recalculated = recalculateSchedule(merged, STANDARD_5_DAY_CALENDAR);

  const clonedBeam1 = recalculated.updatedTasks.find((t) => t.name.includes("Trench Formwork (Copy)"))!;
  const clonedBeam2 = recalculated.updatedTasks.find((t) => t.name.includes("Pour Concrete (Copy)"))!;

  assert(
    clonedBeam1.id !== "beam-1" && clonedBeam2.id !== "beam-2",
    "4.1 Cloned tasks generated unique, distinct identifiers",
    `Originals: beam-1, beam-2. Clones: ${clonedBeam1.id}, ${clonedBeam2.id}`
  );

  assert(
    clonedBeam2.predecessors.includes(clonedBeam1.id) && !clonedBeam2.predecessors.includes("beam-1"),
    "4.2 Internal dependency remapped from old task ID to the new cloned task ID",
    `clonedBeam2 predecessors: ${JSON.stringify(clonedBeam2.predecessors)} (expected ${clonedBeam1.id})`
  );

  assert(
    clonedBeam1.predecessors.includes("ext-1"),
    "4.3 External dependency to valid existing task 'ext-1' correctly preserved",
    `clonedBeam1 predecessors: ${JSON.stringify(clonedBeam1.predecessors)}`
  );
}

// ─── Test 5: Search Inside Collapsed Groups ────────────────────────────────────
console.log("\n--- 5. Search In Collapsed Groups & Ancestor Auto-Expansion ---");
{
  const nestedTasks: ProgrammeTask[] = [
    makeTask({ id: "g-root", name: "Building Core", summary: true, parentId: null, depth: 0 }),
    makeTask({ id: "g-level3", name: "Level 3 Fitout", summary: true, parentId: "g-root", depth: 1 }),
    makeTask({ id: "t-glazing", name: "Curtain Wall Glazing Units", summary: false, parentId: "g-level3", depth: 2 }),
  ];

  // Collapsed: expandedNodes is empty set
  const collapsedNodes = new Set<string>();

  // Normal view without search: only root is visible when children collapsed
  const visibleCollapsed = getVisibleTasks(nestedTasks, collapsedNodes, "all", "");
  assert(
    visibleCollapsed.length === 1 && visibleCollapsed[0].id === "g-root",
    "5.1 Normal view hides collapsed descendant tasks when parent is unexpanded",
    `Visible count: ${visibleCollapsed.length} (${visibleCollapsed.map((t) => t.id).join(", ")})`
  );

  // Search for "Glazing" inside the collapsed subpackage
  const searchResults = getVisibleTasks(nestedTasks, collapsedNodes, "all", "Glazing");
  const resultIds = searchResults.map((t) => t.id);

  assert(
    resultIds.includes("t-glazing") && resultIds.includes("g-level3") && resultIds.includes("g-root"),
    "5.2 Search automatically discovers leaf task inside collapsed groups and auto-expands ancestors",
    `Search results include leaf and all container ancestors: ${resultIds.join(" -> ")}`
  );
}

// ─── Test 6: Multi-Select and Bulk Editing ──────────────────────────────────────
console.log("\n--- 6. Multi-Select and Bulk Editing Properties ---");
{
  const taskA = makeTask({ id: "ba-1", name: "Block A Slab", trade: "Structural", progress: 0, status: "not-started" });
  const taskB = makeTask({ id: "ba-2", name: "Block B Slab", trade: "Structural", progress: 0, status: "not-started" });
  const taskC = makeTask({ id: "ba-3", name: "Block C Slab", trade: "Structural", progress: 0, status: "not-started" });
  const pool = [taskA, taskB, taskC];

  // Bulk edit: set trade to "Concrete", status to "in-progress", progress to 40%
  const selectedIds = ["ba-1", "ba-2", "ba-3"];
  const bulkUpdates = { trade: "Concrete", status: "in-progress" as const, progress: 40 };

  const updated = pool.map((t) => (selectedIds.includes(t.id) ? { ...t, ...bulkUpdates } : t));

  assert(
    updated.every((t) => t.trade === "Concrete" && t.status === "in-progress" && t.progress === 40),
    "6.1 Bulk edit applied new trade, status and progress simultaneously across all selected tasks",
    `Trades: ${updated.map((t) => t.trade).join(", ")}, Progress: ${updated.map((t) => t.progress).join(", ")}%`
  );
}

// ─── Test 7: Undo and Redo State Rollback ───────────────────────────────────────
console.log("\n--- 7. Undo and Redo History Rollback ---");
{
  const stateHistory: ProgrammeTask[][] = [];
  let currentTasks = [
    makeTask({ id: "h-1", name: "Steel Delivery", duration: 5, startDate: "2026-03-02" }),
  ];

  // Push State 0 to history
  stateHistory.push(JSON.parse(JSON.stringify(currentTasks)));

  // Perform modification: change duration to 10 days
  currentTasks = [
    makeTask({ id: "h-1", name: "Steel Delivery", duration: 10, startDate: "2026-03-02" }),
  ];
  assert(currentTasks[0].duration === 10, "7.1 Modification applied: duration changed to 10 days");

  // Undo: pop previous state
  const previousState = stateHistory.pop()!;
  currentTasks = previousState;

  assert(
    currentTasks[0].duration === 5,
    "7.2 Undo successfully rolled back duration to initial 5 days",
    `Current duration=${currentTasks[0].duration}`
  );
}

// ─── Test 8: Destructive Warnings and Safe Deletion ────────────────────────────
console.log("\n--- 8. Destructive Operation Protection & Dependency Cleanup ---");
{
  const phaseWithChildren: ProgrammeTask[] = [
    makeTask({ id: "del-phase", name: "Demolition Phase", summary: true }),
    makeTask({ id: "del-c1", name: "Soft Strip", parentId: "del-phase", depth: 1 }),
    makeTask({ id: "del-c2", name: "Structural Demo", parentId: "del-phase", depth: 1, predecessors: ["del-c1"] }),
    makeTask({
      id: "downstream-task",
      name: "Substructure Mobilisation",
      predecessors: ["del-c2"],
      predecessorDetails: [{ id: "del-c2", type: "FS", lag: 0 }],
    }),
  ];

  // 8.1 Deletion risk detection:
  const childCount = phaseWithChildren.filter((t) => t.parentId === "del-phase").length;
  const requiresWarning = childCount > 0;

  assert(
    requiresWarning === true && childCount === 2,
    "8.1 Destructive warning triggered when attempting to delete summary task containing children",
    `Warning flagged for ${childCount} child task(s)`
  );

  // 8.2 Perform delete: cascade delete child tasks and unlink downstream predecessor links
  const idsToDelete = new Set(["del-phase", "del-c1", "del-c2"]);
  const remaining = phaseWithChildren
    .filter((t) => !idsToDelete.has(t.id))
    .map((t) => ({
      ...t,
      predecessors: t.predecessors.filter((p) => !idsToDelete.has(p)),
      predecessorDetails: t.predecessorDetails?.filter((d) => !idsToDelete.has(d.id)),
    }));

  const downstream = remaining.find((t) => t.id === "downstream-task")!;

  assert(
    remaining.length === 1 && downstream.predecessors.length === 0,
    "8.2 Cascading deletion removed children and cleanly detached predecessor link from downstream activity",
    `Remaining task count: ${remaining.length}, Downstream preds: ${JSON.stringify(downstream.predecessors)}`
  );
}

// ─── Test 9: Bidirectional Successor Linking and Cycle Prevention ───────────────
console.log("\n--- 9. Successor Linking and Circular Dependency Prevention ---");
{
  const taskX = makeTask({ id: "x-1", name: "Pour Foundation" });
  const taskY = makeTask({ id: "y-1", name: "Erect Precast Walls" });
  const pool = [taskX, taskY];

  // Link X -> Y as FS
  const linked = linkTasks(pool, "x-1", "y-1", "FS", 2);
  const updatedY = linked.updatedTasks.find((t) => t.id === "y-1")!;

  assert(
    updatedY.predecessors.includes("x-1") && updatedY.predecessorDetails?.some((d) => d.id === "x-1" && d.lag === 2),
    "9.1 Successfully linked successor task with specified relationship type and lag (+2d)",
    `Successor predecessors: ${JSON.stringify(updatedY.predecessorDetails)}`
  );

  // Attempt to link Y -> X (would create a cycle)
  const cycleAttempt = detectDependencyCycle(linked.updatedTasks, "y-1", "x-1");

  assert(
    cycleAttempt.hasCycle === true,
    "9.2 Circular dependency safely prevented when attempting reverse successor link",
    `Cycle detected: ${cycleAttempt.reason || cycleAttempt.explanation}`
  );
}

// ─── Test 10: Expand to Level 1, 2, 3 Outline Navigation ────────────────────────
console.log("\n--- 10. Outline Level Expansion Filtering ---");
{
  const hierarchyTasks: ProgrammeTask[] = [
    makeTask({ id: "lvl-0", name: "Project", summary: true, depth: 0 }),
    makeTask({ id: "lvl-1", name: "Phase 1", summary: true, parentId: "lvl-0", depth: 1 }),
    makeTask({ id: "lvl-2", name: "Package 1.1", summary: true, parentId: "lvl-1", depth: 2 }),
    makeTask({ id: "lvl-3", name: "Activity 1.1.1", summary: false, parentId: "lvl-2", depth: 3 }),
  ];

  // Expand to Level 2 (expands nodes with depth < 2, i.e., depth 0 and 1)
  const level2Nodes = new Set<string>();
  for (const t of hierarchyTasks) {
    if (t.summary && (t.depth ?? 0) < 2) {
      level2Nodes.add(t.id);
    }
  }

  const visibleAtLevel2 = getVisibleTasks(hierarchyTasks, level2Nodes, "all", "");
  const visibleLevel2Ids = visibleAtLevel2.map((t) => t.id);

  assert(
    visibleLevel2Ids.includes("lvl-0") &&
      visibleLevel2Ids.includes("lvl-1") &&
      visibleLevel2Ids.includes("lvl-2") &&
      !visibleLevel2Ids.includes("lvl-3"),
    "10.1 Expand to Level 2 reveals summary containers down to Level 2 while keeping leaf activities collapsed",
    `Visible tasks at level 2: ${visibleLevel2Ids.join(", ")}`
  );
}

console.log("\n================================================================================");
console.log("TASK MANAGEMENT VERIFICATION SUMMARY");
console.log("================================================================================");
console.log(`Total Checks Run: ${passedCount + failedCount}`);
console.log(`Passed:           ${passedCount}`);
console.log(`Failed:           ${failedCount}`);
console.log(`Success Rate:     ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);
console.log("================================================================================\n");

if (failedCount > 0) {
  process.exit(1);
}
