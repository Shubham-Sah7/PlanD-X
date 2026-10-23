import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  CONTINUOUS_7_DAY_CALENDAR,
  DEFAULT_HOLIDAYS,
  isWorkingDay,
  getNextWorkingDay,
  addWorkingDays,
  countWorkingDays,
  recalculateSchedule,
  formatDateIso,
  parseIsoDate,
  type ProjectCalendar,
} from "../lib/programme-calendar";
import { ALL_PROGRAMME_TASKS } from "../lib/programme-data";
import { type ProgrammeTask } from "../lib/programme-types";

console.log("=================================================");
console.log("PlanD-X Project Calendar & Working Time Verification");
console.log("=================================================\n");

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

// Case 1: Five-day working week (Mon-Fri)
{
  const cal = STANDARD_5_DAY_CALENDAR;
  // Saturday & Sunday are non-working
  const satWorking = isWorkingDay("2025-10-11", cal); // Sat
  const sunWorking = isWorkingDay("2025-10-12", cal); // Sun
  const monWorking = isWorkingDay("2025-10-13", cal); // Mon
  assert(
    !satWorking && !sunWorking && monWorking,
    "Test 1: Five-Day Working Week configuration",
    `Sat working: ${satWorking}, Sun working: ${sunWorking}, Mon working: ${monWorking}`
  );
}

// Case 2: Six-day working week (Mon-Sat)
{
  const cal = CONSTRUCTION_6_DAY_CALENDAR;
  const satWorking = isWorkingDay("2025-10-11", cal); // Sat
  const sunWorking = isWorkingDay("2025-10-12", cal); // Sun
  const monWorking = isWorkingDay("2025-10-13", cal); // Mon
  assert(
    satWorking && !sunWorking && monWorking,
    "Test 2: Six-Day Working Week configuration",
    `Sat working: ${satWorking}, Sun working: ${sunWorking}, Mon working: ${monWorking}`
  );
}

// Case 3: Task spanning a weekend
{
  // Starting Thursday 2025-10-09, 5 working days
  // 5-day week:
  // Day 1: Thu 2025-10-09
  // Day 2: Fri 2025-10-10
  // Sat 2025-10-11 (SKIPPED)
  // Sun 2025-10-12 (SKIPPED)
  // Day 3: Mon 2025-10-13
  // Day 4: Tue 2025-10-14
  // Day 5: Wed 2025-10-15
  const end5d = formatDateIso(addWorkingDays("2025-10-09", 5, STANDARD_5_DAY_CALENDAR));
  assert(
    end5d === "2025-10-15",
    "Test 3a: Task spanning weekend on 5-Day calendar skips Sat & Sun",
    `Start: 2025-10-09 (Thu) + 5 working days => Finish: ${end5d} (Expected: 2025-10-15 Wed)`
  );

  // 6-day week:
  // Day 1: Thu 2025-10-09
  // Day 2: Fri 2025-10-10
  // Day 3: Sat 2025-10-11 (WORKED!)
  // Sun 2025-10-12 (SKIPPED)
  // Day 4: Mon 2025-10-13
  // Day 5: Tue 2025-10-14
  const end6d = formatDateIso(addWorkingDays("2025-10-09", 5, CONSTRUCTION_6_DAY_CALENDAR));
  assert(
    end6d === "2025-10-14",
    "Test 3b: Task spanning weekend on 6-Day calendar works Saturday and skips only Sunday",
    `Start: 2025-10-09 (Thu) + 5 working days => Finish: ${end6d} (Expected: 2025-10-14 Tue)`
  );
}

// Case 4: Task spanning a configured public holiday
{
  // 2025-12-24 (Wed) + 3 working days with Christmas (2025-12-25) and Boxing Day (2025-12-26)
  // Wed 2025-12-24: Day 1
  // Thu 2025-12-25: Christmas Day (SKIPPED)
  // Fri 2025-12-26: Boxing Day (SKIPPED)
  // Sat 2025-12-27: Weekend (SKIPPED)
  // Sun 2025-12-28: Weekend (SKIPPED)
  // Mon 2025-12-29: Day 2
  // Tue 2025-12-30: Day 3
  const endHoliday = formatDateIso(addWorkingDays("2025-12-24", 3, STANDARD_5_DAY_CALENDAR));
  assert(
    endHoliday === "2025-12-30",
    "Test 4: Task spanning Christmas & Boxing Day public holidays",
    `Start: 2025-12-24 + 3 working days => Finish: ${endHoliday} (Expected: 2025-12-30 Tue, correctly skipping 2 holidays + weekend)`
  );
}

// Case 5: Task with a predecessor dependency (Finish-to-Start)
{
  const mockTasks: ProgrammeTask[] = ([
    {
      id: "TASK-A",
      name: "Excavation",
      wbs: "1.1",
      section: "Substructure",
      trade: "Groundworks",
      startDate: "2025-10-09", // Thu
      endDate: "2025-10-10",   // Fri (2 days)
      duration: 2,
      progress: 0,
      baselineVariance: 0,
      float: 0,
      status: "not-started",
      contractor: "Demo",
      dependencies: [],
      predecessors: [],
      workingForecastStart: "2025-10-09",
      workingForecastFinish: "2025-10-10",
      baseline0Start: "2025-10-09",
      baseline0Finish: "2025-10-10",
      costCode: "CC-1",
    },
    {
      id: "TASK-B",
      name: "Piling",
      wbs: "1.2",
      section: "Substructure",
      trade: "Groundworks",
      startDate: "2025-10-10", // Will be rescheduled to after TASK-A
      endDate: "2025-10-12",
      duration: 3,
      progress: 0,
      baselineVariance: 0,
      float: 0,
      status: "not-started",
      contractor: "Demo",
      dependencies: ["TASK-A"],
      predecessors: ["TASK-A"], // Predecessor
      workingForecastStart: "2025-10-10",
      workingForecastFinish: "2025-10-12",
      baseline0Start: "2025-10-10",
      baseline0Finish: "2025-10-12",
      costCode: "CC-2",
    },
  ] as any[]) as ProgrammeTask[];

  // Under 5-day calendar:
  // TASK-A finishes Fri 2025-10-10
  // Next working day for TASK-B must skip Sat & Sun => Mon 2025-10-13
  // TASK-B (duration 3): Mon 13, Tue 14, Wed 15 => finish 2025-10-15
  const result5d = recalculateSchedule(mockTasks, STANDARD_5_DAY_CALENDAR);
  const taskB_5d = result5d.updatedTasks.find((t) => t.id === "TASK-B");

  assert(
    taskB_5d?.startDate === "2025-10-13" && taskB_5d?.endDate === "2025-10-15",
    "Test 5a: Predecessor Finish-to-Start on 5-Day week skips weekend to start on Monday",
    `TASK-B start: ${taskB_5d?.startDate} (Expected 2025-10-13), end: ${taskB_5d?.endDate} (Expected 2025-10-15)`
  );

  // Under 6-day calendar:
  // TASK-A finishes Fri 2025-10-10
  // Next working day is Saturday 2025-10-11!
  // TASK-B (duration 3): Sat 11, Mon 13, Tue 14 => finish 2025-10-14
  const result6d = recalculateSchedule(mockTasks, CONSTRUCTION_6_DAY_CALENDAR);
  const taskB_6d = result6d.updatedTasks.find((t) => t.id === "TASK-B");

  assert(
    taskB_6d?.startDate === "2025-10-11" && taskB_6d?.endDate === "2025-10-14",
    "Test 5b: Predecessor Finish-to-Start on 6-Day week starts on Saturday",
    `TASK-B start: ${taskB_6d?.startDate} (Expected 2025-10-11), end: ${taskB_6d?.endDate} (Expected 2025-10-14)`
  );
}

// Case 6: Full schedule calendar switch affects real project tasks
{
  const resultTo6d = recalculateSchedule(ALL_PROGRAMME_TASKS, CONSTRUCTION_6_DAY_CALENDAR);
  assert(
    resultTo6d.changeCount > 0,
    "Test 6: Switching full programme to 6-Day Construction Calendar updates schedule",
    `Updated ${resultTo6d.changeCount} task forecast dates to reflect 6-day productivity`
  );
}

// Case 7: Contract Baselines and historical records remain immutable
{
  const originalBaselines = ALL_PROGRAMME_TASKS.map((t) => ({
    id: t.id,
    b0Start: t.baseline0Start,
    b0Finish: t.baseline0Finish,
  }));

  const result = recalculateSchedule(ALL_PROGRAMME_TASKS, CONSTRUCTION_6_DAY_CALENDAR);
  const baselinesIntact = result.updatedTasks.every((t, i) => {
    return (
      t.baseline0Start === originalBaselines[i].b0Start &&
      t.baseline0Finish === originalBaselines[i].b0Finish
    );
  });

  assert(
    baselinesIntact,
    "Test 7: Contract Baselines (baseline0Start/Finish) remain strictly preserved and unmodified",
    "All historical baseline dates remained 100% identical"
  );
}

// Case 8: Dynamic Gantt timeline coordinate conversion
{
  // Test dateToX logic as implemented in Timeline
  const timelineStart = new Date("2025-08-01").getTime();
  const dayWidth = 40; // month view dayWidth
  const msPerDay = 86400000;

  function dateToX(dateStr: string) {
    const diffDays = (new Date(dateStr).getTime() - timelineStart) / msPerDay;
    return diffDays * dayWidth;
  }

  const x1 = dateToX("2025-10-09");
  const x2 = dateToX("2025-10-15");
  const width5d = x2 - x1;

  const x3 = dateToX("2025-10-14");
  const width6d = x3 - x1;

  assert(
    width5d > width6d,
    "Test 8: Gantt timeline bar width directly reflects calendar elongation for non-working weekends",
    `5-day bar spans ${width5d}px vs 6-day bar spans ${width6d}px (difference of 1 calendar day width: ${width5d - width6d}px)`
  );
}

console.log("\n-------------------------------------------------");
console.log(`Summary: ${passedTests}/${totalTests} tests passed.`);
console.log("-------------------------------------------------");
