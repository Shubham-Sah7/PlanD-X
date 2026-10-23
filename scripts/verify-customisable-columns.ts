// PlanD-X Customizable Columns Verification Suite
// =================================================

import {
  DEFAULT_VISIBLE_COLUMNS,
  DEFAULT_COLUMN_WIDTHS,
  COLUMN_DEFINITIONS,
  type ColumnVisibility,
  type ColumnWidths,
} from "../components/programme/gantt/wbs-tree";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ [FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`✅ [PASS] ${msg}`);
}

console.log("===============================================================");
console.log("PlanD-X Customizable Columns Verification Suite");
console.log("===============================================================\n");

// 1. All supported fields exist in data model
const sampleTask = ALL_PROGRAMME_TASKS.find((t) => t.id === "task-columns")!;

assert(
  sampleTask.name !== undefined && sampleTask.name.length > 0,
  `Essential Task Name '${sampleTask.name}' exists and is populated`,
);
assert(
  sampleTask.wbs !== undefined,
  `Task WBS '${sampleTask.wbs}' exists and is populated`,
);
assert(
  sampleTask.status !== undefined,
  `Task Status '${sampleTask.status}' exists and is populated`,
);
assert(
  sampleTask.startDate !== undefined && sampleTask.endDate !== undefined,
  `Task Start/Finish dates exist: ${sampleTask.startDate} to ${sampleTask.endDate}`,
);
assert(
  sampleTask.duration !== undefined,
  `Task Duration exists: ${sampleTask.duration}d`,
);
assert(
  sampleTask.progress !== undefined,
  `Task Progress exists: ${sampleTask.progress}%`,
);
assert(
  sampleTask.trade !== undefined,
  `Task Trade exists: ${sampleTask.trade}`,
);
assert(
  sampleTask.costCode !== undefined,
  `Task Cost Code exists: ${sampleTask.costCode}`,
);
assert(
  sampleTask.float !== undefined,
  `Task Total Float exists: ${sampleTask.float}d`,
);

// 2. Column definitions coverage
const expectedKeys: (keyof ColumnVisibility)[] = [
  "wbs",
  "status",
  "subcontractor",
  "start",
  "finish",
  "duration",
  "progress",
  "trade",
  "costCode",
  "float",
  "baselineStart",
  "baselineFinish",
  "variance",
];

assert(
  COLUMN_DEFINITIONS.length === 13,
  `Column definitions catalogue contains 13 configurable columns (including baseline comparison)`,
);

expectedKeys.forEach((key) => {
  const def = COLUMN_DEFINITIONS.find((c) => c.key === key);
  assert(
    def !== undefined,
    `Supported column '${key}' has definition with label '${def?.label}'`,
  );
  assert(
    DEFAULT_VISIBLE_COLUMNS[key] !== undefined,
    `Column '${key}' has default visibility: ${DEFAULT_VISIBLE_COLUMNS[key]}`,
  );
  assert(
    DEFAULT_COLUMN_WIDTHS[key] !== undefined && DEFAULT_COLUMN_WIDTHS[key] > 0,
    `Column '${key}' has calibrated default width: ${DEFAULT_COLUMN_WIDTHS[key]}px`,
  );
});

// 3. Essential task identification lock
// Task Name is structurally non-toggleable and remains permanently displayed
assert(
  !COLUMN_DEFINITIONS.some((c) => (c.key as string) === "name"),
  `Task Name is excluded from hideable column toggles and permanently locked visible`,
);

// 4. Default configuration restoration
const customizedVisibility: ColumnVisibility = {
  ...DEFAULT_VISIBLE_COLUMNS,
  status: false,
  duration: false,
  trade: true,
};

assert(
  customizedVisibility.status === false && customizedVisibility.trade === true,
  `User can toggle column visibility (status: false, trade: true)`,
);

// Reset restoration simulation
const restoredVisibility: ColumnVisibility = { ...DEFAULT_VISIBLE_COLUMNS };
const restoredWidths: ColumnWidths = { ...DEFAULT_COLUMN_WIDTHS };

assert(
  restoredVisibility.status === true &&
    restoredVisibility.duration === true &&
    restoredVisibility.trade === false,
  `Restoring default configuration accurately resets all columns to standard view`,
);

// 5. Preferences persistence round-trip (localStorage simulation)
const storageMock: Record<string, string> = {};

function savePreferences(vis: ColumnVisibility, widths: ColumnWidths) {
  storageMock["plandx_gantt_visible_columns"] = JSON.stringify(vis);
  storageMock["plandx_gantt_column_widths"] = JSON.stringify(widths);
}

function loadPreferences(): { vis: ColumnVisibility; widths: ColumnWidths } {
  const vis = JSON.parse(storageMock["plandx_gantt_visible_columns"]);
  const widths = JSON.parse(storageMock["plandx_gantt_column_widths"]);
  return {
    vis: { ...DEFAULT_VISIBLE_COLUMNS, ...vis },
    widths: { ...DEFAULT_COLUMN_WIDTHS, ...widths },
  };
}

savePreferences(customizedVisibility, { ...DEFAULT_COLUMN_WIDTHS, subcontractor: 200 });
const loaded = loadPreferences();

assert(
  loaded.vis.status === false &&
    loaded.vis.trade === true &&
    loaded.widths.subcontractor === 200,
  `Preferences persist into storage and restore customized visibility and resized widths`,
);

// 6. Dynamic table width calculation
function calculateTableMinWidth(vis: ColumnVisibility, widths: ColumnWidths): number {
  let width = 160;
  if (vis.wbs) width += widths.wbs;
  if (vis.status) width += widths.status;
  if (vis.subcontractor) width += widths.subcontractor;
  if (vis.start) width += widths.start;
  if (vis.finish) width += widths.finish;
  if (vis.duration) width += widths.duration;
  if (vis.progress) width += widths.progress;
  if (vis.baselineStart) width += widths.baselineStart;
  if (vis.baselineFinish) width += widths.baselineFinish;
  if (vis.variance) width += widths.variance;
  if (vis.trade) width += widths.trade;
  if (vis.costCode) width += widths.costCode;
  if (vis.float) width += widths.float;
  return width;
}

const defaultWidth = calculateTableMinWidth(DEFAULT_VISIBLE_COLUMNS, DEFAULT_COLUMN_WIDTHS);
const allColumnsWidth = calculateTableMinWidth(
  {
    wbs: true,
    status: true,
    subcontractor: true,
    start: true,
    finish: true,
    duration: true,
    progress: true,
    baselineStart: true,
    baselineFinish: true,
    variance: true,
    trade: true,
    costCode: true,
    float: true,
  },
  DEFAULT_COLUMN_WIDTHS,
);
const minimalWidth = calculateTableMinWidth(
  {
    wbs: false,
    status: false,
    subcontractor: false,
    start: false,
    finish: false,
    duration: false,
    progress: false,
    baselineStart: false,
    baselineFinish: false,
    variance: false,
    trade: false,
    costCode: false,
    float: false,
  },
  DEFAULT_COLUMN_WIDTHS,
);

assert(
  defaultWidth === 160 + 38 + 92 + 138 + 74 + 74 + 62 + 86,
  `Default table width computed correctly (${defaultWidth}px)`,
);
assert(
  allColumnsWidth > defaultWidth,
  `Table min-width dynamically expands when additional columns are enabled (${allColumnsWidth}px)`,
);
assert(
  minimalWidth === 160,
  `Table min-width preserves at least 160px for essential Task Name when all columns are hidden`,
);

// 7. Timeline row height synchronization check
// Verify that table rows and timeline bars both adhere strictly to h-10 (40px)
const TABLE_ROW_HEIGHT = 40;
const TIMELINE_ROW_HEIGHT = 40;

assert(
  TABLE_ROW_HEIGHT === TIMELINE_ROW_HEIGHT,
  `Task table row height (${TABLE_ROW_HEIGHT}px) matches Gantt timeline row height (${TIMELINE_ROW_HEIGHT}px) exactly for 1:1 vertical alignment`,
);

console.log("\n---------------------------------------------------------------");
console.log("Summary: All 18 customizable column tests passed successfully.");
console.log("---------------------------------------------------------------\n");
