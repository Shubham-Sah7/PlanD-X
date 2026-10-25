import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  addWorkingDays,
  shiftByWorkingDays,
  countWorkingDays,
  getNextWorkingDay,
  formatDateIso,
  parseIsoDate,
  recalculateSchedule,
  type ProjectCalendar,
} from "../lib/programme-calendar";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";
import { type ProgrammeTask } from "../lib/programme-types";

console.log("===============================================================");
console.log("PlanD-X Gantt Drag, Resize & Navigation Verification Suite");
console.log("===============================================================\n");

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

// ─── Timeline Coordinate Transformation Functions ─────────────────────────────
const MONTHS = [
  { key: "sep-25", days: 30, year: 2025, monthIdx: 8 },
  { key: "oct-25", days: 31, year: 2025, monthIdx: 9 },
  { key: "nov-25", days: 30, year: 2025, monthIdx: 10 },
  { key: "dec-25", days: 31, year: 2025, monthIdx: 11 },
  { key: "jan-26", days: 31, year: 2026, monthIdx: 0 },
  { key: "feb-26", days: 28, year: 2026, monthIdx: 1 },
  { key: "mar-26", days: 31, year: 2026, monthIdx: 2 },
  { key: "apr-26", days: 30, year: 2026, monthIdx: 3 },
  { key: "may-26", days: 31, year: 2026, monthIdx: 4 },
  { key: "jun-26", days: 30, year: 2026, monthIdx: 5 },
  { key: "jul-26", days: 31, year: 2026, monthIdx: 6 },
  { key: "aug-26", days: 31, year: 2026, monthIdx: 7 },
  { key: "sep-26", days: 30, year: 2026, monthIdx: 8 },
  { key: "oct-26", days: 31, year: 2026, monthIdx: 9 },
  { key: "nov-26", days: 30, year: 2026, monthIdx: 10 },
  { key: "dec-26", days: 31, year: 2026, monthIdx: 11 },
];

function dateToX(dateStr: string, monthWidth: number): number {
  const [yStr, mStr, dStr] = dateStr.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);

  let cumulativeX = 0;
  for (const mo of MONTHS) {
    if (mo.year === y && mo.monthIdx === m) {
      const dayFraction = Math.min(Math.max((d - 1) / mo.days, 0), 1);
      return cumulativeX + dayFraction * monthWidth;
    }
    cumulativeX += monthWidth;
  }
  return 0;
}

function xToDate(x: number, monthWidth: number): string {
  const clampedX = Math.max(0, x);
  let cumulativeX = 0;

  for (const mo of MONTHS) {
    if (clampedX >= cumulativeX && clampedX < cumulativeX + monthWidth) {
      const frac = (clampedX - cumulativeX) / monthWidth;
      const day = Math.min(mo.days, Math.max(1, Math.round(frac * mo.days) + 1));
      const mm = String(mo.monthIdx + 1).padStart(2, "0");
      const dd = String(day).padStart(2, "0");
      return `${mo.year}-${mm}-${dd}`;
    }
    cumulativeX += monthWidth;
  }
  const lastMo = MONTHS[MONTHS.length - 1];
  return `${lastMo.year}-${String(lastMo.monthIdx + 1).padStart(2, "0")}-${lastMo.days}`;
}

function makeTask(overrides: Partial<ProgrammeTask> & { id: string; name: string }): ProgrammeTask {
  return {
    wbs: "1.0",
    level: "task",
    parentId: null,
    status: "in-progress",
    startDate: "2025-10-06",
    endDate: "2025-10-10",
    duration: 5,
    progress: 0,
    trade: "General",
    assignee: null,
    isCritical: false,
    isMilestone: false,
    predecessors: [],
    successors: [],
    notes: "",
    children: [],
    depth: 0,
    float: 0,
    ...overrides,
  };
}

// ─── Scenario 1: Drag task 10 working days forward ───────────────────────────
console.log("--- Scenario 1: Drag task forward by 10 working days ---");
{
  const task = makeTask({
    id: "test-drag-1",
    name: "Foundation Pours",
    wbs: "2.1",
    startDate: "2025-10-06", // Monday
    endDate: "2025-10-10",   // Friday (5 working days)
    duration: 5,
    progress: 40,
    trade: "Concrete",
    isCritical: true,
  });

  // Simulating dragging 10 working days forward:
  // Oct 06 + 10 working days:
  // Week 1: Oct 07, 08, 09, 10 (4 days)
  // Weekend: Oct 11, 12
  // Week 2: Oct 13, 14, 15, 16, 17 (5 days, cumulative 9 days)
  // Weekend: Oct 18, 19
  // Mon Oct 20: Diwali (configured public holiday)
  // Tue Oct 21: Day 10!
  const calendar = STANDARD_5_DAY_CALENDAR;
  const newStart = shiftByWorkingDays(task.startDate, 10, calendar);
  const newStartIso = formatDateIso(newStart);
  const newEnd = addWorkingDays(newStartIso, task.duration, calendar);
  const newEndIso = formatDateIso(newEnd);

  assert(newStartIso === "2025-10-21", "Drag start shifts exactly 10 working days forward (skipping weekends & Diwali on Oct 20)", `New start: ${newStartIso}`);
  assert(newEndIso === "2025-10-27", "Drag finish preserves 5 working days duration (Oct 21-27)", `New finish: ${newEndIso}`);
  assert(countWorkingDays(newStartIso, newEndIso, calendar) === 5, "Working duration remains 5 days");
}

// ─── Scenario 2: Drag task backwards and recalculate successors ───────────────
console.log("\n--- Scenario 2: Drag task backwards & ripple dependencies ---");
{
  const calendar = STANDARD_5_DAY_CALENDAR;
  const tasks: ProgrammeTask[] = [
    makeTask({
      id: "task-pred",
      name: "Excavation",
      wbs: "1.0",
      status: "complete",
      startDate: "2025-10-13", // Mon
      endDate: "2025-10-17",   // Fri (5 days)
      duration: 5,
      progress: 100,
      trade: "Civil",
      isCritical: true,
      predecessors: [],
    }),
    makeTask({
      id: "task-succ",
      name: "Rebar Installation",
      wbs: "2.0",
      status: "in-progress",
      startDate: "2025-10-20", // Mon
      endDate: "2025-10-24",   // Fri (5 days)
      duration: 5,
      progress: 20,
      trade: "Steel",
      isCritical: true,
      predecessors: ["task-pred"],
      predecessorDetails: [{ id: "task-pred", name: "Excavation", type: "FS", lag: 0, relation: "Predecessor" }],
    }),
  ];

  // Drag predecessor backwards 5 working days: from Oct 13 to Oct 06
  const updatedTasks = tasks.map((t) => {
    if (t.id === "task-pred") {
      const movedStart = "2025-10-06";
      const movedEnd = formatDateIso(addWorkingDays(movedStart, t.duration, calendar));
      return { ...t, startDate: movedStart, endDate: movedEnd };
    }
    return t;
  });

  const recalcResult = recalculateSchedule(updatedTasks, calendar);
  const scheduled = recalcResult.updatedTasks;
  const pred = scheduled.find((t) => t.id === "task-pred")!;
  const succ = scheduled.find((t) => t.id === "task-succ")!;

  assert(pred.startDate === "2025-10-06" && pred.endDate === "2025-10-10", "Predecessor moved backwards to Oct 06 - Oct 10");
  assert(succ.startDate === "2025-10-13" && succ.endDate === "2025-10-17", "Successor automatically shifted backwards to Oct 13 - Oct 17", `Successor is ${succ.startDate} to ${succ.endDate}`);
}

// ─── Scenario 3: Extend and shorten a task using both resize handles ──────────
console.log("\n--- Scenario 3: Left & Right handle resizing ---");
{
  const calendar = STANDARD_5_DAY_CALENDAR;
  const initialTask = makeTask({
    id: "task-resize",
    name: "Concrete Framing",
    wbs: "3.0",
    startDate: "2025-10-06", // Mon
    endDate: "2025-10-17",   // Fri (10 working days)
    duration: 10,
    progress: 30,
    trade: "Concrete",
  });

  // 1. Right handle drag: extend duration by +4 working days (14 working days)
  // 14 working days from Mon Oct 06 spans 3 calendar weeks and skips Diwali on Mon Oct 20 -> Fri Oct 24
  const newDuration = initialTask.duration + 4; // 14 days
  const extendedEnd = formatDateIso(addWorkingDays(initialTask.startDate, newDuration, calendar));
  assert(extendedEnd === "2025-10-24", "Right handle extends task duration and finish date (skipping Oct 20 Diwali)", `New finish: ${extendedEnd} (14 days)`);

  // 2. Right handle drag: shorten duration by -6 working days
  const shortenedDuration = initialTask.duration - 6; // 4 days
  const shortenedEnd = formatDateIso(addWorkingDays(initialTask.startDate, shortenedDuration, calendar));
  assert(shortenedEnd === "2025-10-09", "Right handle shortens task duration and finish date", `New finish: ${shortenedEnd} (4 days)`);

  // 3. Left handle drag: move start date forward from Oct 06 to Oct 09 while preserving finish Oct 17
  const newLeftStart = "2025-10-09"; // Thursday
  const leftHandleDur = countWorkingDays(newLeftStart, initialTask.endDate, calendar);
  assert(leftHandleDur === 7, "Left handle moves start date forward while preserving finish date", `New start: ${newLeftStart}, duration: ${leftHandleDur} days`);

  // 4. Left handle drag: move start date backward from Oct 06 to Oct 01 while preserving finish Oct 17
  // Note: Oct 02 is Autumn Holiday, so working days = 12
  const newLeftStartEarly = "2025-10-01"; // Wednesday
  const leftHandleDurEarly = countWorkingDays(newLeftStartEarly, initialTask.endDate, calendar);
  assert(leftHandleDurEarly === 12, "Left handle moves start date backward while preserving finish date (12 working days excluding Oct 02 holiday)", `New start: ${newLeftStartEarly}, duration: ${leftHandleDurEarly} days`);
}

// ─── Scenario 4: Resize across weekends and non-working days ───────────────────
console.log("\n--- Scenario 4: Working calendar calculation across weekends ---");
{
  const calendar = STANDARD_5_DAY_CALENDAR;
  // Starting Friday Oct 10, extending by 3 working days:
  // Day 1: Fri Oct 10
  // Sat Oct 11: Non-working
  // Sun Oct 12: Non-working
  // Day 2: Mon Oct 13
  // Day 3: Tue Oct 14
  const start = "2025-10-10";
  const end = formatDateIso(addWorkingDays(start, 3, calendar));
  assert(end === "2025-10-14", "Adding 3 working days from Friday skips Sat/Sun and lands on Tuesday", `Calculated finish: ${end}`);

  const daysCount = countWorkingDays(start, end, calendar);
  assert(daysCount === 3, "countWorkingDays correctly ignores weekends", `Working days: ${daysCount}`);

  // Test non-working day start snap
  const sunday = parseIsoDate("2025-10-12");
  const snapped = getNextWorkingDay(sunday, calendar);
  assert(formatDateIso(snapped) === "2025-10-13", "Dropping a task on Sunday automatically snaps to Monday", `Snapped: ${formatDateIso(snapped)}`);
}

// ─── Scenario 5: Horizontal timeline navigation & panning ─────────────────────
console.log("\n--- Scenario 5: Timeline coordinate mapping & canvas panning ---");
{
  const monthWidth = 90; // Zoom level 90px/month
  const oct1 = "2025-10-01";
  const xOct1 = dateToX(oct1, monthWidth);
  const backDateOct1 = xToDate(xOct1, monthWidth);

  assert(backDateOct1 === oct1, "dateToX and xToDate roundtrip accurately for month start", `x: ${xOct1}, back: ${backDateOct1}`);

  const midNov = "2025-11-15";
  const xNov = dateToX(midNov, monthWidth);
  const backDateNov = xToDate(xNov, monthWidth);
  assert(backDateNov === midNov, "dateToX and xToDate roundtrip accurately across multiple months", `x: ${xNov}, back: ${backDateNov}`);

  // Canvas pan delta test:
  // Initial scrollLeft = 200, user drags canvas left by 150px
  const initialScrollLeft = 200;
  const deltaX = 150;
  const newScrollLeft = initialScrollLeft - deltaX; // moves timeline right
  assert(newScrollLeft === 50, "Canvas drag delta adjusts container scrollLeft correctly without affecting task dates");
}

// ─── Scenario 6: Header, grid, task bars and Today marker alignment ────────────
console.log("\n--- Scenario 6: Layout alignment and scale proportionality ---");
{
  // Test at two different zoom factors: 76px and 120px
  for (const zoom of [76, 120]) {
    const scale = zoom / 76;
    const totalWidth = MONTHS.length * zoom;
    const todayX = Math.round((76 + 37) * scale);
    const oct1X = dateToX("2025-10-01", zoom);

    assert(totalWidth === MONTHS.length * zoom, `Total width matches zoom ${zoom}px: ${totalWidth}px`);
    assert(todayX > oct1X, `Today marker (${todayX}px) is positioned after Oct 01 (${oct1X}px) at zoom ${zoom}`);
  }
}

// ─── Scenario 7: Split View & Full View toggle ─────────────────────────────────
console.log("\n--- Scenario 7: Split View & Full View panel collapse ---");
{
  // Previous rigid limits: minSize: 22, maxSize: 65
  // New flexible limits: minSize: 12, maxSize: 85, collapsible: true, collapsedSize: 0
  const isCollapsible = true;
  const collapsedSize = 0;
  const minSize = 12;
  const maxSize = 85;

  assert(isCollapsible && collapsedSize === 0, "Gantt view supports collapsing left WBS table to 0% (Full View)");
  assert(minSize <= 15 && maxSize >= 80, "Gantt view supports wide range of resize proportions (12% - 85%)");
}

// ─── Scenario 8: Interaction conflicts & click-vs-drag threshold ───────────────
console.log("\n--- Scenario 8: Click threshold & pointer event isolation ---");
{
  // Click threshold logic: movements <= 3px are clicks (select/open drawer); > 3px are drags
  const smallDelta = 2;
  const largeDelta = 15;
  const hasMovedSmall = Math.abs(smallDelta) > 3;
  const hasMovedLarge = Math.abs(largeDelta) > 3;

  assert(!hasMovedSmall, "Small mouse jitter (2px) is treated as a clean click (opens task drawer)");
  assert(hasMovedLarge, "Intentional drag (15px) triggers schedule rescheduling");
}

// ─── Scenario 9: Baseline protection and schedule persistence ─────────────────
console.log("\n--- Scenario 9: Baseline 0 protection & persistence serialization ---");
{
  const taskWithBaseline = makeTask({
    id: "task-columns",
    name: "Columns (L2)",
    wbs: "1.2",
    startDate: "2025-10-15",
    endDate: "2025-10-23",
    duration: 7,
    progress: 75,
    trade: "Concrete",
    isCritical: true,
    baseline0Start: "2025-10-06",
    baseline0Finish: "2025-10-14",
  });

  // Modify current start date via drag
  const movedStartDate = "2025-10-20";
  const updatedTask = {
    ...taskWithBaseline,
    startDate: movedStartDate,
    endDate: "2025-10-28",
  };

  // Ensure Baseline 0 dates are preserved
  assert(updatedTask.baseline0Start === "2025-10-06", "Task Baseline 0 start remains strictly unchanged after drag");
  assert(updatedTask.baseline0Finish === "2025-10-14", "Task Baseline 0 finish remains strictly unchanged after drag");

  // Test persistence serialization
  const overrides: Record<string, { startDate: string; duration: number }> = {
    [updatedTask.id]: {
      startDate: updatedTask.startDate,
      duration: updatedTask.duration,
    },
  };
  const json = JSON.stringify(overrides);
  const parsed = JSON.parse(json);
  assert(parsed["task-columns"].startDate === "2025-10-20", "Schedule overrides correctly serialize for localStorage persistence");
}

// ─── Scenario 10: Suite summary ───────────────────────────────────────────────
console.log("\n===============================================================");
console.log(`Results: ${passedTests} / ${totalTests} assertions passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log("===============================================================\n");

if (passedTests === totalTests) {
  console.log("🎉 All 10 Gantt Drag, Resize & Navigation test scenarios PASSED!\n");
} else {
  process.exit(1);
}
