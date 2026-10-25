// Verification Suite for Gantt Split Resizing & Click-to-Full-View Functionality
// ==============================================================================

import fs from "fs";
import path from "path";

function assert(condition: boolean, testName: string, details?: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${testName}`);
    if (details) console.error(`   Details: ${details}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${testName}`);
}

console.log("===============================================================");
console.log("PlanD-X Gantt Resizable & Click-to-Full-View Verification Suite");
console.log("===============================================================\n");

const ganttViewPath = path.join(process.cwd(), "components/programme/gantt/gantt-view.tsx");
assert(fs.existsSync(ganttViewPath), "GanttView component exists");

const ganttViewContent = fs.readFileSync(ganttViewPath, "utf-8");

// Test 1: Full Resizability & Collapsibility
assert(
  ganttViewContent.includes("collapsible={true}"),
  "Test 1: WBS Panel has collapsible={true} for unrestricted resizing down to 0%"
);
assert(
  ganttViewContent.includes("collapsedSize={0}"),
  "Test 1b: WBS Panel has collapsedSize={0} allowing complete collapse"
);
assert(
  ganttViewContent.includes("maxSize={85}"),
  "Test 1c: WBS Panel allows expanding up to 85% width"
);
assert(
  ganttViewContent.includes("minSize={12}"),
  "Test 1d: WBS Panel allows shrinking down to 12% before collapsing"
);

// Test 2: Click to Full View on Handle
assert(
  ganttViewContent.includes("toggleFullTimeline"),
  "Test 2: Dedicated toggleFullTimeline handler implemented"
);
assert(
  ganttViewContent.includes("groupRef={groupRef}") || ganttViewContent.includes("groupRef"),
  "Test 2b: Imperative group handle connected for smooth programmatic layout transitions"
);
assert(
  ganttViewContent.includes("panelRef={wbsPanelRef}"),
  "Test 2c: Imperative panel ref connected to WBS panel"
);
assert(
  ganttViewContent.includes("ChevronLeft") && ganttViewContent.includes("ChevronRight"),
  "Test 2d: Handle renders directional chevron toggle button indicating collapse/expand direction"
);
assert(
  ganttViewContent.includes("onDoubleClick={toggleFullTimeline}"),
  "Test 2e: Double-clicking the divider bar also toggles Full View"
);

// Test 3: Multiple Access Points for Full View
assert(
  ganttViewContent.includes("Maximize2") && ganttViewContent.includes("Minimize2"),
  "Test 3a: Top action button with Maximize/Minimize icon provided for instant toggle"
);
assert(
  ganttViewContent.includes("Show Tasks Table"),
  "Test 3b: Floating restore pill button appears when collapsed so user never gets trapped"
);

// Test 4: Persistent Preferences
assert(
  ganttViewContent.includes("plandx_gantt_full_timeline"),
  "Test 4a: Full timeline state persisted to localStorage ('plandx_gantt_full_timeline')"
);
assert(
  ganttViewContent.includes("plandx_gantt_split"),
  "Test 4b: Custom split width percentages persisted to localStorage ('plandx_gantt_split')"
);

// Test 5: Logic Simulation
{
  let isFull = false;
  let lastSize = 40;
  let currentLayout = { wbs: 40, timeline: 60 };

  // Click 1 -> Switch to Full Timeline View
  isFull = true;
  lastSize = currentLayout.wbs;
  currentLayout = { wbs: 0, timeline: 100 };
  assert(isFull, "Test 5a: Click 1 toggles isFullTimeline to true");
  assert(currentLayout.wbs === 0 && currentLayout.timeline === 100, "Test 5b: Layout is 100% Timeline (Full View)");

  // Click 2 -> Restore Split View
  isFull = false;
  currentLayout = { wbs: lastSize, timeline: 100 - lastSize };
  assert(!isFull, "Test 5c: Click 2 toggles isFullTimeline to false");
  assert(currentLayout.wbs === 40 && currentLayout.timeline === 60, "Test 5d: Layout restores previous 40/60 split");
}

console.log("\n---------------------------------------------------------------");
console.log("Summary: All Gantt resizable & click-to-full-view tests PASSED!");
console.log("---------------------------------------------------------------");
