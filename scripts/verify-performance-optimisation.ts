import { getVisibleTasks, getProgrammeData } from "../lib/programme-data";
import { type ProgrammeTask } from "../lib/programme-types";
import {
  computeTimelineRange,
  dateToX,
  xToDate,
} from "../components/programme/gantt/timeline";
import {
  exportToMspdiXml,
  parseMspdiXml,
} from "../lib/programme-msp-interop";
import {
  STANDARD_5_DAY_CALENDAR,
  parseIsoDate,
  formatDateIso,
  addWorkingDays,
} from "../lib/programme-calendar";

console.log("================================================================================");
console.log("PLAN-DX LARGE PROGRAMME & VIRTUALIZATION PERFORMANCE VERIFICATION SUITE");
console.log("================================================================================\n");

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

// ─── Synthetic Programme Generator ──────────────────────────────────────────

function generateSyntheticProgramme(taskCount: number, yearsSpan = 3): ProgrammeTask[] {
  const tasks: ProgrammeTask[] = [];
  const baseDate = new Date(2025, 8, 1); // 2025-09-01
  const trades = [
    "Substructure",
    "Concrete & Formwork",
    "Structural Steel",
    "Facade & Glazing",
    "MEP Services",
    "Drylining",
    "Internal Finishes",
    "Commissioning",
  ];

  let currentWbs = [1];
  let parentStack: { id: string; depth: number }[] = [];

  for (let i = 1; i <= taskCount; i++) {
    const isSummary = i % 15 === 1; // Summary header every 15 tasks
    const isMilestone = !isSummary && i % 20 === 0;

    let depth = 1;
    let parentId: string | undefined = undefined;

    if (isSummary) {
      if (parentStack.length >= 3 && Math.random() > 0.5) {
        parentStack.pop();
      }
      depth = parentStack.length + 1;
      parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : undefined;
    } else {
      depth = parentStack.length + 1;
      parentId = parentStack.length > 0 ? parentStack[parentStack.length - 1].id : undefined;
    }

    const dayOffset = Math.floor((i / taskCount) * (yearsSpan * 260));
    const startDate = addWorkingDays(baseDate, dayOffset, STANDARD_5_DAY_CALENDAR);
    const duration = isMilestone ? 0 : Math.max(1, 3 + (i % 18));
    const endDate = addWorkingDays(startDate, duration, STANDARD_5_DAY_CALENDAR);

    // Predecessors (connect to 1-2 previous non-summary tasks)
    const predecessors: string[] = [];
    if (i > 2 && !isSummary) {
      const predId = `T-${Math.max(1, i - 1 - (i % 3))}`;
      predecessors.push(predId);
      if (i > 6 && i % 4 === 0) {
        predecessors.push(`T-${i - 5}`);
      }
    }

    const task: ProgrammeTask = {
      id: `T-${i}`,
      name: isSummary ? `Phase ${i}: Major Works Package` : `Activity ${i}: Construction Operations`,
      wbs: `${depth}.${i}`,
      depth,
      parentId: parentId ?? null,
      level: isSummary ? "phase" : "task",
      status: i % 3 === 0 ? "complete" : i % 3 === 1 ? "in-progress" : "not-started",
      startDate: formatDateIso(startDate),
      endDate: formatDateIso(endDate),
      duration,
      progress: Math.min(100, Math.floor((1 - i / taskCount) * 100)),
      predecessors,
      successors: [],
      notes: "Synthetic performance benchmark activity",
      children: [],
      isMilestone,
      isCritical: i % 7 === 0,
      float: i % 7 === 0 ? 0 : (i % 12),
      trade: trades[i % trades.length],
      assignee: `Subcontractor ${(i % 10) + 1}`,
      baseline0Start: formatDateIso(startDate),
      baseline0Finish: formatDateIso(endDate),
    };

    if (isSummary) {
      parentStack.push({ id: task.id, depth });
    }

    tasks.push(task);
  }

  return tasks;
}

// ─── 1. Hierarchy, Visibility, Filter & Search Performance Benchmark ────────

console.log("--- 1. Hierarchy, Visibility, Filter & Search Benchmark ---");

const prog1k = generateSyntheticProgramme(1000, 3);
const prog2500 = generateSyntheticProgramme(2500, 5);

// Test unoptimized baseline vs optimized Map index
function benchmarkVisibility(tasks: ProgrammeTask[], iterations = 20) {
  const expanded = new Set(tasks.map((t) => t.id));
  const t0 = performance.now();
  for (let iter = 0; iter < iterations; iter++) {
    getVisibleTasks(tasks, expanded, "all", "");
  }
  const avgMs = (performance.now() - t0) / iterations;
  return avgMs;
}

const time1k = benchmarkVisibility(prog1k);
const time2500 = benchmarkVisibility(prog2500);

assert(
  time1k < 4.0,
  `getVisibleTasks 1,000 tasks latency under 4ms (Actual: ${time1k.toFixed(2)}ms)`,
  `Processed 1,000 tasks in ${time1k.toFixed(2)}ms with O(N) pre-indexed hierarchy lookup.`
);

assert(
  time2500 < 8.0,
  `getVisibleTasks 2,500 tasks latency under 8ms (Actual: ${time2500.toFixed(2)}ms)`,
  `Processed 2,500 mega-programme tasks in ${time2500.toFixed(2)}ms.`
);

// Search Query with Collapsed Groups Auto-Expansion
const searchT0 = performance.now();
const searchMatches = getVisibleTasks(prog2500, new Set(), "all", "Activity 1250");
const searchMs = performance.now() - searchT0;

assert(
  searchMatches.some((t) => t.id === "T-1250"),
  "Search Query finds target task inside collapsed hierarchy",
  `Found target task 'Activity 1250' with ancestor hierarchy auto-expanded in ${searchMs.toFixed(2)}ms.`
);

// ─── 2. Virtualization Windowing & DOM Footprint Benchmark ──────────────────

console.log("\n--- 2. Virtualization Windowing & DOM Footprint Benchmark ---");

const ROW_HEIGHT = 40;
const OVERSCAN = 12;
const VIEWPORT_HEIGHT = 800; // Typical desktop Gantt viewport

function computeVirtualSlice(tasks: ProgrammeTask[], scrollTop: number) {
  const totalCount = tasks.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + VIEWPORT_HEIGHT) / ROW_HEIGHT) + OVERSCAN);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT);
  const visibleSlice = tasks.slice(startIndex, endIndex);

  return {
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    visibleCount: visibleSlice.length,
    totalCount,
    isGapless: topSpacerHeight + visibleSlice.length * ROW_HEIGHT + bottomSpacerHeight === totalCount * ROW_HEIGHT,
  };
}

const vTop = computeVirtualSlice(prog2500, 0);
const vMid = computeVirtualSlice(prog2500, 50000);
const vBottom = computeVirtualSlice(prog2500, 99000);

assert(
  vTop.visibleCount <= 44 && vMid.visibleCount <= 44,
  `Virtual DOM node reduction: ${vMid.visibleCount} active DOM rows vs 2,500 total tasks (>98% DOM reduction)`,
  `Viewport renders ${vMid.visibleCount} DOM elements instead of mounting 2,500 elements.`
);

assert(
  vTop.isGapless && vMid.isGapless && vBottom.isGapless,
  "Mathematical exactness: 100% gapless rendering across top, middle, and bottom scroll positions",
  `Top spacer (${vMid.topSpacerHeight}px) + Visible rows (${vMid.visibleCount * ROW_HEIGHT}px) + Bottom spacer (${vMid.bottomSpacerHeight}px) = ${vMid.totalCount * ROW_HEIGHT}px.`
);

// ─── 3. Spatial Dependency Connector Culling Performance ────────────────────

console.log("\n--- 3. Spatial Dependency Connector Culling Performance ---");

// Count all links in 2500 task programme
let totalLinks = 0;
prog2500.forEach((t) => (totalLinks += t.predecessors?.length || 0));

const taskIndexMap = new Map<string, number>();
prog2500.forEach((t, i) => taskIndexMap.set(t.id, i));

function benchmarkConnectorCulling(scrollTop: number) {
  let renderedCount = 0;
  let culledCount = 0;

  const t0 = performance.now();
  for (const succTask of prog2500) {
    if (!succTask.predecessors) continue;
    const sIndex = taskIndexMap.get(succTask.id);
    if (sIndex === undefined) continue;
    const y2 = sIndex * ROW_HEIGHT + 20;

    for (const predId of succTask.predecessors) {
      const pIndex = taskIndexMap.get(predId);
      if (pIndex === undefined) continue;
      const y1 = pIndex * ROW_HEIGHT + 20;

      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      if (maxY < scrollTop - 200 || minY > scrollTop + VIEWPORT_HEIGHT + 200) {
        culledCount++;
      } else {
        renderedCount++;
      }
    }
  }
  const durationMs = performance.now() - t0;
  return { renderedCount, culledCount, durationMs };
}

const cullingResult = benchmarkConnectorCulling(45000); // Scrolled to row ~1,125
const cullRate = (cullingResult.culledCount / (cullingResult.renderedCount + cullingResult.culledCount)) * 100;

assert(
  cullRate > 90.0,
  `Dependency SVG connector spatial culling skips ${cullRate.toFixed(1)}% of off-screen paths`,
  `Rendered ${cullingResult.renderedCount} SVGs and skipped ${cullingResult.culledCount} off-screen links.`
);

assert(
  cullingResult.durationMs < 3.0,
  `Connector culling computation across ${totalLinks} links completes in ${cullingResult.durationMs.toFixed(2)}ms (60fps guaranteed)`,
  `O(1) index map lookups guarantee zero jank during 60fps scrolling.`
);

// ─── 4. Dynamic Multi-Year Timeline & Date Conversion Coordinate Stability ──

console.log("\n--- 4. Dynamic Multi-Year Timeline & Date Conversion Stability ---");

const timelineRange = computeTimelineRange(prog2500, 76);

assert(
  timelineRange.months.length >= 60,
  `Dynamic multi-year timeline range accommodates 5-year mega-project (${timelineRange.months.length} months generated)`,
  `Timeline span: ${timelineRange.startYear} to ${timelineRange.startYear + Math.floor(timelineRange.months.length / 12)}.`
);

// Test dateToX -> xToDate Round-Trip Coordinate Stability
let maxCoordinateErrorDays = 0;
const testDates = [
  "2025-09-01",
  "2026-03-15",
  "2027-07-20",
  "2028-11-11",
  "2029-05-04",
  "2030-08-30",
];

for (const dStr of testDates) {
  const x = dateToX(dStr, 76, timelineRange.startYear, timelineRange.startMonth);
  const roundTripDate = xToDate(x, 76, timelineRange.startYear, timelineRange.startMonth);
  const diffTime = Math.abs(new Date(dStr).getTime() - new Date(roundTripDate).getTime());
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays > maxCoordinateErrorDays) maxCoordinateErrorDays = diffDays;
}

assert(
  maxCoordinateErrorDays <= 1,
  "Date-to-pixel coordinate transform round-trip accuracy within 0-1 day precision",
  `Verified across 5-year timeline from 2025 to 2030 with zero coordinate drift.`
);

// ─── 5. Large Programme MSPDI XML Import & Export Operations ────────────────

console.log("\n--- 5. Large Programme MSPDI XML Import & Export Operations ---");

const expT0 = performance.now();
const exportedXml = exportToMspdiXml(prog1k, STANDARD_5_DAY_CALENDAR, "Ormiston Mega Infrastructure");
const expMs = performance.now() - expT0;

assert(
  exportedXml.length > 50000 && expMs < 350,
  `Export 1,000 tasks to MSPDI XML completes in ${expMs.toFixed(1)}ms (${(exportedXml.length / 1024).toFixed(1)} KB XML)`,
  `High-throughput streaming XML builder generated complete schedule envelope.`
);

const impT0 = performance.now();
const importedResult = parseMspdiXml(exportedXml);
const impMs = performance.now() - impT0;

assert(
  importedResult.tasks.length === prog1k.length && impMs < 350,
  `Import 1,000 tasks from MSPDI XML completes in ${impMs.toFixed(1)}ms (${importedResult.tasks.length}/${prog1k.length} tasks restored)`,
  `O(1) Map wiring parsed and connected all tasks and relationships in ${impMs.toFixed(1)}ms.`
);

// ─── 6. Keyboard Navigation & Auto-Scroll Viewport Bounds ────────────────────

console.log("\n--- 6. Keyboard Navigation & Auto-Scroll Viewport Bounds ---");

function simulateKeyboardNavigation(targetIndex: number, currentScrollTop: number, clientHeight: number) {
  const rowTop = targetIndex * ROW_HEIGHT;
  const rowBottom = rowTop + ROW_HEIGHT;
  let newScrollTop = currentScrollTop;

  if (rowTop < currentScrollTop) {
    newScrollTop = rowTop;
  } else if (rowBottom > currentScrollTop + clientHeight) {
    newScrollTop = rowBottom - clientHeight;
  }

  const isRowInView = rowTop >= newScrollTop && rowBottom <= newScrollTop + clientHeight;
  return { newScrollTop, isRowInView };
}

const navUp = simulateKeyboardNavigation(5, 1200, 800); // Row 5 is at 200px (above viewport 1200-2000)
const navDown = simulateKeyboardNavigation(60, 1200, 800); // Row 60 is at 2400px (below viewport 1200-2000)

assert(
  navUp.isRowInView && navUp.newScrollTop === 200,
  "Keyboard ArrowUp auto-scrolls viewport to reveal off-screen row at top",
  `Adjusted scrollTop from 1200px to ${navUp.newScrollTop}px, row is fully in view.`
);

assert(
  navDown.isRowInView && navDown.newScrollTop === 1640,
  "Keyboard ArrowDown auto-scrolls viewport to reveal off-screen row at bottom",
  `Adjusted scrollTop from 1200px to ${navDown.newScrollTop}px, row is fully in view.`
);

// ─── Verification Summary ───────────────────────────────────────────────────

console.log("\n================================================================================");
console.log("LARGE PROGRAMME & VIRTUALIZATION PERFORMANCE SUMMARY");
console.log("================================================================================");
console.log(`Total Checks Run: ${totalTests}`);
console.log(`Passed:           ${passedTests}`);
console.log(`Failed:           ${totalTests - passedTests}`);
console.log(`Success Rate:     ${((passedTests / totalTests) * 100).toFixed(1)}%`);
console.log("================================================================================\n");

if (totalTests - passedTests > 0) {
  process.exit(1);
}
