// Project Working Calendar & Scheduling Engine for PlanD-X
// ==============================================================

import type {
  ProgrammeTask,
  TaskStatus,
  LookaheadPeriod,
  LookaheadReadiness,
  LookaheadTaskItem,
  SchedulingWarning,
  ResourceWorkloadSummary,
  ResourceDailyWorkload,
  BaselineSlot,
  TaskType,
  ProjectResource,
  WeeklyWorkloadRecord,
  MonthlyWorkloadRecord,
  ResourceType,
} from "./programme-types";

export type WorkingWeekPreset = "5-day" | "6-day" | "7-day" | "custom";

export interface ProjectHoliday {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD
  type: "public-holiday" | "site-closure" | "weather" | "custom";
}

export interface ProjectCalendar {
  id: string;
  name: string;
  workingWeekPreset: WorkingWeekPreset;
  workingDays: number[]; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  workingHoursPerDay: number; // default 8
  holidays: ProjectHoliday[];
  weekdayWorkingHours?: Record<number, number>; // e.g. { 1: 8, 2: 8, 3: 8, 4: 8, 5: 6 }
  exceptionalWorkingDays?: Array<{ date: string; hours?: number; name?: string } | string>;
  timezone?: string; // e.g. "Australia/Brisbane"
}

export const DEFAULT_HOLIDAYS: ProjectHoliday[] = [
  { id: "hol-1", name: "Autumn Holiday", date: "2025-10-02", type: "public-holiday" },
  { id: "hol-2", name: "Diwali", date: "2025-10-20", type: "public-holiday" },
  { id: "hol-3", name: "Christmas Day", date: "2025-12-25", type: "public-holiday" },
  { id: "hol-4", name: "Boxing Day", date: "2025-12-26", type: "public-holiday" },
  { id: "hol-5", name: "New Year's Day", date: "2026-01-01", type: "public-holiday" },
  { id: "hol-6", name: "Republic Day", date: "2026-01-26", type: "public-holiday" },
  { id: "hol-7", name: "Good Friday", date: "2026-03-27", type: "public-holiday" },
  { id: "hol-8", name: "Easter Monday", date: "2026-04-06", type: "public-holiday" },
  { id: "hol-9", name: "Labour Day", date: "2026-05-01", type: "public-holiday" },
  { id: "hol-10", name: "Independence Day", date: "2026-08-15", type: "public-holiday" },
  { id: "hol-11", name: "Gandhi Jayanti", date: "2026-10-02", type: "public-holiday" },
];

export const STANDARD_5_DAY_CALENDAR: ProjectCalendar = {
  id: "cal-5day",
  name: "Standard 5-Day Week (Mon–Fri)",
  workingWeekPreset: "5-day",
  workingDays: [1, 2, 3, 4, 5], // Monday - Friday
  workingHoursPerDay: 8,
  holidays: [...DEFAULT_HOLIDAYS],
};

export const CONSTRUCTION_6_DAY_CALENDAR: ProjectCalendar = {
  id: "cal-6day",
  name: "Construction 6-Day Week (Mon–Sat)",
  workingWeekPreset: "6-day",
  workingDays: [1, 2, 3, 4, 5, 6], // Monday - Saturday
  workingHoursPerDay: 8,
  holidays: [...DEFAULT_HOLIDAYS],
};

export const CONTINUOUS_7_DAY_CALENDAR: ProjectCalendar = {
  id: "cal-7day",
  name: "Continuous 7-Day Operations",
  workingWeekPreset: "7-day",
  workingDays: [0, 1, 2, 3, 4, 5, 6],
  workingHoursPerDay: 8,
  holidays: [],
};

// ─── Date Parsing & Formatting Helpers ───────────────────────

export function parseIsoDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Noon prevents DST timezone shifts
}

export function formatDateIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDisplayDate(dateStrOrObj: string | Date): string {
  const date = typeof dateStrOrObj === "string" ? parseIsoDate(dateStrOrObj) : dateStrOrObj;
  if (isNaN(date.getTime())) return "—";
  const day = String(date.getDate()).padStart(2, "0");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const mon = months[date.getMonth()];
  const yr = String(date.getFullYear()).slice(-2);
  return `${day} ${mon} ${yr}`;
}

// ─── Calendar Rule Functions ─────────────────────────────────

export function isHoliday(dateStr: string, calendar: ProjectCalendar): boolean {
  return calendar.holidays.some((h) => h.date === dateStr);
}

export function isWorkingDay(dateOrStr: Date | string, calendar: ProjectCalendar): boolean {
  const date = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : dateOrStr;
  const isoStr = formatDateIso(date);

  // Check exceptional working days (e.g. approved Saturday overtime)
  if (
    calendar.exceptionalWorkingDays?.some((e) =>
      typeof e === "string" ? e === isoStr : e.date === isoStr
    )
  ) {
    return true;
  }

  // Check public holiday / custom non-working exception
  if (isHoliday(isoStr, calendar)) {
    return false;
  }

  // Check day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const dayOfWeek = date.getDay();

  // If weekdayWorkingHours specified for this day and set to 0, it's non-working
  if (calendar.weekdayWorkingHours && calendar.weekdayWorkingHours[dayOfWeek] === 0) {
    return false;
  }

  return calendar.workingDays.includes(dayOfWeek);
}

export function getNextWorkingDay(dateOrStr: Date | string, calendar: ProjectCalendar): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());
  if (isNaN(curr.getTime())) {
    curr = new Date("2026-01-05T00:00:00Z");
  }
  let maxLoop = 365;
  while (!isWorkingDay(curr, calendar) && maxLoop > 0) {
    curr.setDate(curr.getDate() + 1);
    maxLoop--;
  }
  return curr;
}

export function getPrevWorkingDay(dateOrStr: Date | string, calendar: ProjectCalendar): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());
  if (isNaN(curr.getTime())) {
    curr = new Date("2026-01-05T00:00:00Z");
  }
  let maxLoop = 365;
  while (!isWorkingDay(curr, calendar) && maxLoop > 0) {
    curr.setDate(curr.getDate() - 1);
    maxLoop--;
  }
  return curr;
}

/**
 * Adds working days to a start date, skipping configured non-working days and holidays.
 * Duration:
 *  - 0 working days: Milestone; finish date = start date.
 *  - 1 working day: Finishes on the start date itself (if start date is a working day).
 *  - N working days: Day 1 is start date, then advances by N - 1 working days.
 */
export function addWorkingDays(
  startDateOrStr: Date | string,
  workingDays: number,
  calendar: ProjectCalendar,
  isElapsed?: boolean
): Date {
  if (workingDays <= 0) {
    return typeof startDateOrStr === "string" ? parseIsoDate(startDateOrStr) : new Date(startDateOrStr.getTime());
  }

  // Elapsed duration: 24-hour calendar days (e.g. concrete cure time, maritime transit)
  if (isElapsed) {
    const base = typeof startDateOrStr === "string" ? parseIsoDate(startDateOrStr) : new Date(startDateOrStr.getTime());
    const res = new Date(base.getTime());
    res.setDate(res.getDate() + Math.max(0, Math.ceil(workingDays) - 1));
    return res;
  }

  // Ensure start date is on a valid working day
  let curr = getNextWorkingDay(startDateOrStr, calendar);
  let daysRemaining = Math.max(1, Math.ceil(workingDays)) - 1;
  let guard = 5000;

  while (daysRemaining > 0 && guard > 0) {
    curr.setDate(curr.getDate() + 1);
    guard--;
    if (isWorkingDay(curr, calendar)) {
      daysRemaining--;
    }
  }

  return curr;
}

/**
 * Counts total working days between two dates inclusive, skipping non-working days and holidays.
 */
export function countWorkingDays(
  startDateOrStr: Date | string,
  endDateOrStr: Date | string,
  calendar: ProjectCalendar
): number {
  const start = typeof startDateOrStr === "string" ? parseIsoDate(startDateOrStr) : startDateOrStr;
  const end = typeof endDateOrStr === "string" ? parseIsoDate(endDateOrStr) : endDateOrStr;

  if (start.getTime() > end.getTime()) {
    return 0;
  }

  let curr = new Date(start.getTime());
  let count = 0;
  let guard = 5000;

  while (curr.getTime() <= end.getTime() && guard > 0) {
    if (isWorkingDay(curr, calendar)) {
      count++;
    }
    curr.setDate(curr.getDate() + 1);
    guard--;
  }

  return count;
}

/**
 * Shifts a date by a given number of working days according to the project calendar.
 * Positive offset: moves forward into the future by N working days.
 * Negative offset: moves backward into the past by |N| working days (lead time).
 * Zero offset: ensures the date falls on a valid working day.
 */
export function shiftByWorkingDays(
  dateOrStr: Date | string,
  offsetDays: number,
  calendar: ProjectCalendar
): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());

  if (offsetDays === 0) {
    return getNextWorkingDay(curr, calendar);
  }

  let daysRemaining = Math.abs(offsetDays);
  const step = offsetDays > 0 ? 1 : -1;
  let guard = 5000;

  while (daysRemaining > 0 && guard > 0) {
    curr.setDate(curr.getDate() + step);
    guard--;
    if (isWorkingDay(curr, calendar)) {
      daysRemaining--;
    }
  }

  return curr;
}

// ─── Scheduling Engine ───────────────────────────────────────

export interface ScheduleRecalculationResult {
  updatedTasks: ProgrammeTask[];
  changeCount: number;
  projectStartDate: string;
  projectEndDate: string;
  criticalTaskCount: number;
  criticalPathTaskIds: string[];
  warnings?: SchedulingWarning[];
  resourceSummaries?: ResourceWorkloadSummary[];
  hasCircularDependency?: boolean;
  cycleDetails?: string;
  hasImpossibleConditions?: boolean;
}

export interface RecalculateScheduleOptions {
  scheduleFromStart?: boolean;
  statusDate?: string | null;
  checkResourceWorkloads?: boolean;
  taskCalendars?: Map<string, ProjectCalendar> | Record<string, ProjectCalendar>;
  targetFinishDate?: string | null;
  nearCriticalThresholdDays?: number;
}

export interface DependencyCycleCheck {
  hasCycle: boolean;
  cyclePath?: string[];
  reason?: string;
  explanation?: string;
}

/**
 * Detects whether adding or editing a dependency edge (predId -> succId) creates a circular dependency loop.
 * Explains clearly why a task cannot be scheduled as expected with the exact cycle path.
 */
export function detectDependencyCycle(
  tasks: ProgrammeTask[],
  proposedPredId: string,
  proposedSuccId: string
): DependencyCycleCheck {
  if (proposedPredId === proposedSuccId) {
    const task = tasks.find((t) => t.id === proposedPredId);
    const name = task?.name || proposedPredId;
    return {
      hasCycle: true,
      cyclePath: [proposedPredId, proposedPredId],
      reason: `Task '${name}' cannot depend on itself (circular reference).`,
    };
  }

  const taskMap = new Map<string, ProgrammeTask>();
  const successorMap = new Map<string, string[]>();

  for (const t of tasks) {
    taskMap.set(t.id, t);
    successorMap.set(t.id, []);
  }

  for (const t of tasks) {
    const preds = extractTaskPredecessors(t);
    for (const p of preds) {
      if (successorMap.has(p.id)) {
        successorMap.get(p.id)!.push(t.id);
      }
    }
  }

  // BFS check: can we reach proposedPredId from proposedSuccId?
  const queue: string[] = [proposedSuccId];
  const visited = new Set<string>([proposedSuccId]);
  const parentMap = new Map<string, string>();

  let found = false;
  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === proposedPredId) {
      found = true;
      break;
    }
    for (const next of successorMap.get(curr) || []) {
      if (!visited.has(next)) {
        visited.add(next);
        parentMap.set(next, curr);
        queue.push(next);
      }
    }
  }

  if (found) {
    // Reconstruct cycle path
    const path: string[] = [proposedPredId];
    let step = proposedPredId;
    while (step !== proposedSuccId && parentMap.has(step)) {
      step = parentMap.get(step)!;
      path.unshift(step);
    }
    path.unshift(proposedPredId);

    const pathNames = path.map((id) => `'${taskMap.get(id)?.name || id}'`).join(" ➔ ");
    const msg = `Circular dependency detected: ${pathNames}. Adding this predecessor would create an impossible schedule loop.`;
    return {
      hasCycle: true,
      cyclePath: path,
      reason: msg,
      explanation: msg,
    };
  }

  return { hasCycle: false };
}

/**
 * Task type behavior and effort-driven scheduling calculation:
 * Formula: Work = Duration * Assignment Units * Working Hours Per Day
 * - fixed-duration: Duration constant; changing units alters work; changing work alters units.
 * - fixed-work: Work constant; changing duration alters units; changing units alters duration.
 * - fixed-units: Units constant; changing duration alters work; changing work alters duration.
 * - effort-driven: When assignments change, work is preserved and duration adjusts.
 */
export function calculateTaskWorkUnits(
  task: ProgrammeTask,
  changedField: "duration" | "workHours" | "assignmentUnits",
  newValue: number,
  calendar: ProjectCalendar
): { duration: number; workHours: number; assignmentUnits: number } {
  const hoursPerDay = calendar.workingHoursPerDay || 8;
  const taskType: TaskType = task.taskType || "fixed-duration";
  const effortDriven = Boolean(task.effortDriven);

  let duration = task.duration || 1;
  let assignmentUnits = typeof task.assignmentUnits === "number" ? task.assignmentUnits : 1.0;
  let workHours = typeof task.workHours === "number" ? task.workHours : duration * assignmentUnits * hoursPerDay;

  if (changedField === "duration") {
    duration = Math.max(0, newValue);
    if (taskType === "fixed-duration") {
      workHours = Math.round(duration * assignmentUnits * hoursPerDay);
    } else if (taskType === "fixed-work") {
      if (duration > 0) {
        assignmentUnits = Math.round((workHours / (duration * hoursPerDay)) * 100) / 100;
      }
    } else if (taskType === "fixed-units") {
      workHours = Math.round(duration * assignmentUnits * hoursPerDay);
    }
  } else if (changedField === "workHours") {
    workHours = Math.max(0, newValue);
    if (taskType === "fixed-duration") {
      if (duration > 0) {
        assignmentUnits = Math.round((workHours / (duration * hoursPerDay)) * 100) / 100;
      }
    } else if (taskType === "fixed-work") {
      if (assignmentUnits > 0) {
        duration = Math.max(1, Math.round(workHours / (assignmentUnits * hoursPerDay)));
      }
    } else if (taskType === "fixed-units") {
      if (assignmentUnits > 0) {
        duration = Math.max(1, Math.round(workHours / (assignmentUnits * hoursPerDay)));
      }
    }
  } else if (changedField === "assignmentUnits") {
    assignmentUnits = Math.max(0.1, Math.round(newValue * 100) / 100);
    if (effortDriven || taskType === "fixed-work") {
      if (assignmentUnits > 0) {
        duration = Math.max(1, Math.round(workHours / (assignmentUnits * hoursPerDay)));
      }
    } else if (taskType === "fixed-duration") {
      workHours = Math.round(duration * assignmentUnits * hoursPerDay);
    } else if (taskType === "fixed-units") {
      workHours = Math.round(duration * assignmentUnits * hoursPerDay);
    }
  }

  return { duration, workHours, assignmentUnits };
}

/**
 * Progress and status-date management:
 * - Calculates remaining duration and remaining work
 * - Detects delayed incomplete work on/before status date
 * - Forecasts finish date by scheduling remaining work forward from status date
 */
export function evaluateStatusDateAndProgress(
  task: ProgrammeTask,
  statusDate: string,
  calendar: ProjectCalendar
): {
  remainingDuration: number;
  remainingWorkHours: number;
  isDelayed: boolean;
  forecastFinish?: string;
} {
  const progress = Math.min(100, Math.max(0, task.progress || 0));
  const totalDuration = task.duration || 1;
  const totalWork = typeof task.workHours === "number" ? task.workHours : totalDuration * (calendar.workingHoursPerDay || 8);

  const remainingDuration = progress >= 100 ? 0 : Math.max(1, Math.round(totalDuration * (1 - progress / 100)));
  const remainingWorkHours = progress >= 100 ? 0 : Math.round(totalWork * (1 - progress / 100));

  let isDelayed = false;
  let forecastFinish: string | undefined = undefined;

  if (progress < 100 && task.endDate) {
    const endT = parseIsoDate(task.endDate).getTime();
    const statusT = parseIsoDate(statusDate).getTime();

    // If task was scheduled to complete on or before status date but is incomplete
    if (endT <= statusT) {
      isDelayed = true;
      const forecastEnd = addWorkingDays(statusDate, remainingDuration, calendar);
      forecastFinish = formatDateIso(forecastEnd);
    }
  }

  return {
    remainingDuration,
    remainingWorkHours,
    isDelayed,
    forecastFinish,
  };
}

/**
 * Helper to compute ISO week number and start/end dates for a given date.
 */
function getIsoWeekInfo(date: Date): { weekNumber: number; weekLabel: string; startDate: string; endDate: string } {
  const d = new Date(date.getTime());
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);

  // Find Monday of this week
  const mon = new Date(date.getTime());
  const day = mon.getDay() || 7;
  mon.setDate(mon.getDate() - day + 1);

  // Find Sunday of this week
  const sun = new Date(mon.getTime());
  sun.setDate(sun.getDate() + 6);

  const startIso = formatDateIso(mon);
  const endIso = formatDateIso(sun);

  return {
    weekNumber,
    weekLabel: `W${weekNumber} (${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short" })})`,
    startDate: startIso,
    endDate: endIso,
  };
}

/**
 * Resource and workload management:
 * Evaluates resource availability, assignment units, daily/weekly/monthly demand,
 * rate-based costs, and over-allocation warnings across Labour and Equipment.
 */
export function calculateResourceWorkloads(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar,
  projectResources?: ProjectResource[]
): {
  resourceSummaries: ResourceWorkloadSummary[];
  overallocatedTaskIds: Set<string>;
  peakAllocationByTask: Map<string, number>;
} {
  const resourceDefMap = new Map<string, ProjectResource>();
  if (projectResources) {
    projectResources.forEach((r) => {
      resourceDefMap.set(r.id, r);
      resourceDefMap.set(r.name.toLowerCase().trim(), r);
    });
  }

  const resourceMap = new Map<
    string,
    {
      id?: string;
      name: string;
      initials: string;
      trade?: string;
      resourceType: ResourceType;
      maxCapacityUnits: number;
      standardRate?: number;
      isVerifiedVendor: boolean;
      vendorRecordId?: string;
      assignedTaskIds: Set<string>;
      dailyUnits: Map<string, { units: number; hours: number; taskIds: string[] }>;
    }
  >();

  const leafTasks = tasks.filter(
    (t) => t.level !== "phase" && t.level !== "programme" && (!t.children || t.children.length === 0)
  );

  for (const t of leafTasks) {
    if (!t.startDate || !t.endDate) continue;

    // Check if task has structured multi-resource assignments
    const assignments = t.assignments && t.assignments.length > 0
      ? t.assignments
      : null;

    if (assignments) {
      for (const asgn of assignments) {
        const resName = asgn.resourceName;
        if (!resName) continue;

        if (!resourceMap.has(resName)) {
          const matchedDef =
            resourceDefMap.get(asgn.resourceId) ||
            resourceDefMap.get(resName.toLowerCase().trim());

          const initials =
            matchedDef?.initials ||
            resName
              .split(" ")
              .map((w: string) => w[0])
              .join("")
              .slice(0, 3)
              .toUpperCase();

          resourceMap.set(resName, {
            id: asgn.resourceId || matchedDef?.id,
            name: resName,
            initials,
            trade: matchedDef?.trade,
            resourceType: asgn.resourceType || matchedDef?.type || "work",
            maxCapacityUnits: matchedDef?.maxUnits || 1.0,
            standardRate: asgn.standardRate ?? matchedDef?.standardRate,
            isVerifiedVendor: Boolean(matchedDef?.isVerifiedVendor),
            vendorRecordId: matchedDef?.vendorRecordId,
            assignedTaskIds: new Set(),
            dailyUnits: new Map(),
          });
        }

        const resEntry = resourceMap.get(resName)!;
        resEntry.assignedTaskIds.add(t.id);

        const taskUnits = typeof asgn.units === "number" ? asgn.units : 1.0;
        const hoursPerDay = (calendar.workingHoursPerDay || 8) * taskUnits;

        let curr = parseIsoDate(t.startDate);
        const end = parseIsoDate(t.endDate);

        let guard = 500;
        while (curr.getTime() <= end.getTime() && guard > 0) {
          guard--;
          if (isWorkingDay(curr, calendar)) {
            const dStr = formatDateIso(curr);
            const dayRecord = resEntry.dailyUnits.get(dStr) || { units: 0, hours: 0, taskIds: [] };
            dayRecord.units += taskUnits;
            dayRecord.hours += hoursPerDay;
            if (!dayRecord.taskIds.includes(t.id)) dayRecord.taskIds.push(t.id);
            resEntry.dailyUnits.set(dStr, dayRecord);
          }
          curr.setDate(curr.getDate() + 1);
        }
      }
    } else {
      // Fallback: Use single assignee, byWhom, or trade
      const assigneeObj = t.assignee as { name?: string } | null;
      const resName =
        (typeof t.assignee === "string" ? t.assignee : assigneeObj?.name) ||
        t.byWhom ||
        (typeof t.trade === "string" ? t.trade : t.tradeText);

      if (!resName) continue;

      if (!resourceMap.has(resName)) {
        const matchedDef = resourceDefMap.get(resName.toLowerCase().trim());
        const initials =
          t.assigneeInitials ||
          matchedDef?.initials ||
          resName
            .split(" ")
            .map((w: string) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase();

        resourceMap.set(resName, {
          id: matchedDef?.id,
          name: resName,
          initials,
          trade: (typeof t.trade === "string" ? t.trade : t.tradeText) || matchedDef?.trade || undefined,
          resourceType: matchedDef?.type || "work",
          maxCapacityUnits: matchedDef?.maxUnits || 1.0,
          standardRate: matchedDef?.standardRate,
          isVerifiedVendor: Boolean(matchedDef?.isVerifiedVendor),
          vendorRecordId: matchedDef?.vendorRecordId,
          assignedTaskIds: new Set(),
          dailyUnits: new Map(),
        });
      }

      const resEntry = resourceMap.get(resName)!;
      resEntry.assignedTaskIds.add(t.id);

      const taskUnits = typeof t.assignmentUnits === "number" ? t.assignmentUnits : 1.0;
      const hoursPerDay = (calendar.workingHoursPerDay || 8) * taskUnits;

      let curr = parseIsoDate(t.startDate);
      const end = parseIsoDate(t.endDate);

      let guard = 500;
      while (curr.getTime() <= end.getTime() && guard > 0) {
        guard--;
        if (isWorkingDay(curr, calendar)) {
          const dStr = formatDateIso(curr);
          const dayRecord = resEntry.dailyUnits.get(dStr) || { units: 0, hours: 0, taskIds: [] };
          dayRecord.units += taskUnits;
          dayRecord.hours += hoursPerDay;
          if (!dayRecord.taskIds.includes(t.id)) dayRecord.taskIds.push(t.id);
          resEntry.dailyUnits.set(dStr, dayRecord);
        }
        curr.setDate(curr.getDate() + 1);
      }
    }
  }

  const overallocatedTaskIds = new Set<string>();
  const peakAllocationByTask = new Map<string, number>();
  const summaries: ResourceWorkloadSummary[] = [];

  for (const [resName, data] of resourceMap.entries()) {
    let maxDailyUnits = 0;
    let overallocatedDaysCount = 0;
    let totalPlannedHours = 0;

    const dailyWorkloads: Record<string, ResourceDailyWorkload> = {};
    const weeklyMap = new Map<string, { weekInfo: any; hours: number; peakUnits: number; taskIds: Set<string>; isOver: boolean }>();
    const monthlyMap = new Map<string, { monthStr: string; monthLabel: string; hours: number; peakUnits: number; taskIds: Set<string>; isOver: boolean }>();

    const capacityLimit = data.maxCapacityUnits || 1.0;

    for (const [dStr, dayData] of data.dailyUnits.entries()) {
      const isOver = dayData.units > (capacityLimit + 0.001); // Exceeds individual resource capacity!
      if (dayData.units > maxDailyUnits) {
        maxDailyUnits = dayData.units;
      }
      totalPlannedHours += dayData.hours;

      if (isOver) {
        overallocatedDaysCount++;
        for (const tid of dayData.taskIds) {
          overallocatedTaskIds.add(tid);
          const currentPeak = peakAllocationByTask.get(tid) || 0;
          if (dayData.units > currentPeak) {
            peakAllocationByTask.set(tid, dayData.units);
          }
        }
      }

      dailyWorkloads[dStr] = {
        date: dStr,
        units: Math.round(dayData.units * 100) / 100,
        hours: Math.round(dayData.hours * 10) / 10,
        taskIds: dayData.taskIds,
        isOverallocated: isOver,
      };

      // ── Weekly Aggregation ──
      const curDate = parseIsoDate(dStr);
      const weekInfo = getIsoWeekInfo(curDate);
      const weekKey = `${weekInfo.weekNumber}-${weekInfo.startDate}`;
      const existingWeek = weeklyMap.get(weekKey) || {
        weekInfo,
        hours: 0,
        peakUnits: 0,
        taskIds: new Set<string>(),
        isOver: false,
      };
      existingWeek.hours += dayData.hours;
      if (dayData.units > existingWeek.peakUnits) existingWeek.peakUnits = dayData.units;
      if (isOver) existingWeek.isOver = true;
      dayData.taskIds.forEach((id) => existingWeek.taskIds.add(id));
      weeklyMap.set(weekKey, existingWeek);

      // ── Monthly Aggregation ──
      const monthStr = dStr.slice(0, 7); // YYYY-MM
      const monthLabel = curDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
      const existingMonth = monthlyMap.get(monthStr) || {
        monthStr,
        monthLabel,
        hours: 0,
        peakUnits: 0,
        taskIds: new Set<string>(),
        isOver: false,
      };
      existingMonth.hours += dayData.hours;
      if (dayData.units > existingMonth.peakUnits) existingMonth.peakUnits = dayData.units;
      if (isOver) existingMonth.isOver = true;
      dayData.taskIds.forEach((id) => existingMonth.taskIds.add(id));
      monthlyMap.set(monthStr, existingMonth);
    }

    // Convert Weekly Map
    const weeklyWorkloads: Record<string, WeeklyWorkloadRecord> = {};
    for (const [key, wData] of weeklyMap.entries()) {
      const weeklyWorkingDays = 5; // standard 5 days * 8h = 40h per unit
      const capacityHours = Math.round(weeklyWorkingDays * (calendar.workingHoursPerDay || 8) * capacityLimit);
      weeklyWorkloads[key] = {
        weekNumber: wData.weekInfo.weekNumber,
        weekLabel: wData.weekInfo.weekLabel,
        startDate: wData.weekInfo.startDate,
        endDate: wData.weekInfo.endDate,
        totalHours: Math.round(wData.hours * 10) / 10,
        capacityHours,
        peakUnits: Math.round(wData.peakUnits * 100) / 100,
        isOverallocated: wData.isOver,
        taskIds: Array.from(wData.taskIds),
      };
    }

    // Convert Monthly Map
    const monthlyWorkloads: Record<string, MonthlyWorkloadRecord> = {};
    for (const [key, mData] of monthlyMap.entries()) {
      const monthlyWorkingDays = 21.67; // average working days in month
      const capacityHours = Math.round(monthlyWorkingDays * (calendar.workingHoursPerDay || 8) * capacityLimit);
      monthlyWorkloads[key] = {
        monthStr: mData.monthStr,
        monthLabel: mData.monthLabel,
        totalHours: Math.round(mData.hours * 10) / 10,
        capacityHours,
        peakUnits: Math.round(mData.peakUnits * 100) / 100,
        isOverallocated: mData.isOver,
        taskIds: Array.from(mData.taskIds),
      };
    }

    const rate = data.standardRate || 0;
    const totalCost = Math.round(totalPlannedHours * rate * 100) / 100;

    summaries.push({
      resourceId: data.id,
      resourceName: resName,
      resourceInitials: data.initials,
      resourceType: data.resourceType,
      trade: data.trade,
      maxDailyUnits: Math.round(maxDailyUnits * 100) / 100,
      maxCapacityUnits: capacityLimit,
      overallocatedDaysCount,
      totalPlannedHours: Math.round(totalPlannedHours * 10) / 10,
      totalActualHours: 0,
      totalRemainingHours: Math.round(totalPlannedHours * 10) / 10,
      totalCost,
      assignedTaskCount: data.assignedTaskIds.size,
      assignedTaskIds: Array.from(data.assignedTaskIds),
      isVerifiedVendor: data.isVerifiedVendor,
      vendorRecordId: data.vendorRecordId,
      standardRate: rate,
      dailyWorkloads,
      weeklyWorkloads,
      monthlyWorkloads,
    });
  }

  return {
    resourceSummaries: summaries,
    overallocatedTaskIds,
    peakAllocationByTask,
  };
}

/**
 * Extracts all predecessor relationships from a task, including dependency type and lag/lead.
 */
function extractTaskPredecessors(task: ProgrammeTask): { id: string; type: string; lag: number }[] {
  const list: { id: string; type: string; lag: number }[] = [];
  const seen = new Set<string>();

  if (task.predecessorDetails && task.predecessorDetails.length > 0) {
    for (const d of task.predecessorDetails) {
      if (d.id && !seen.has(d.id)) {
        seen.add(d.id);
        list.push({
          id: d.id,
          type: d.type || "FS",
          lag: typeof d.lag === "number" ? d.lag : 0,
        });
      }
    }
  }

  if (task.predecessors && task.predecessors.length > 0) {
    for (const pid of task.predecessors) {
      if (pid && !seen.has(pid)) {
        seen.add(pid);
        list.push({
          id: pid,
          type: "FS",
          lag: 0,
        });
      }
    }
  }

  // Also support linear parity dependencies
  const genericDeps = (task as any).dependencies;
  if (Array.isArray(genericDeps)) {
    for (const did of genericDeps) {
      if (typeof did === "string" && !seen.has(did)) {
        seen.add(did);
        list.push({
          id: did,
          type: "FS",
          lag: 0,
        });
      }
    }
  }

  return list;
}

/**
 * Recalculates task schedule dates based on the active Project Calendar,
 * dependency types (FS, SS, FF, SF), and lag/lead time.
 * Executes both:
 * 1. CPM Forward Pass (Early Start, Early Finish)
 * 2. CPM Backward Pass (Late Start, Late Finish, Total Float, Free Float, Critical Path)
 * Preserves baseline records and historical snapshot data without overwrite.
 */
export function recalculateSchedule(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar,
  options?: RecalculateScheduleOptions
): ScheduleRecalculationResult {
  const taskMap = new Map<string, ProgrammeTask>();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t });
  }

  let changeCount = 0;
  const warnings: SchedulingWarning[] = [];

  // Helper to resolve task-specific calendar or continuous 7-day elapsed calendar
  const getTaskCalendar = (t: ProgrammeTask): ProjectCalendar => {
    if (t.isElapsedDuration) {
      return CONTINUOUS_7_DAY_CALENDAR;
    }
    const calId = t.calendarId || t.calendarUid;
    if (calId && options?.taskCalendars) {
      if (options.taskCalendars instanceof Map) {
        const match = options.taskCalendars.get(calId);
        if (match) return match;
      } else if (typeof options.taskCalendars === "object") {
        const match = (options.taskCalendars as Record<string, ProjectCalendar>)[calId];
        if (match) return match;
      }
    }
    if (calId === "cal-7day" || calId === "continuous-7day") return CONTINUOUS_7_DAY_CALENDAR;
    if (calId === "cal-6day" || calId === "construction-6day") return CONSTRUCTION_6_DAY_CALENDAR;
    if (calId === "cal-5day" || calId === "standard-5day") return STANDARD_5_DAY_CALENDAR;
    return calendar;
  };

  // Helper to determine if a task is a summary container
  const allTasksList = Array.from(taskMap.values());
  const isSummaryContainer = (t: ProgrammeTask): boolean => {
    if (t.level === "phase" || t.level === "programme" || t.summary === true) return true;
    if (t.children && t.children.length > 0) return true;
    return allTasksList.some((child) => child.parentId === t.id);
  };

  // 1. Build topological evaluation order for leaf tasks to ensure dependencies cascade properly
  const leafTasks = allTasksList.filter((t) => !isSummaryContainer(t));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();
  const leafIds = new Set(leafTasks.map((t) => t.id));

  for (const t of leafTasks) {
    inDegree.set(t.id, 0);
    adj.set(t.id, []);
  }

  for (const t of leafTasks) {
    const preds = extractTaskPredecessors(t);
    for (const p of preds) {
      if (leafIds.has(p.id)) {
        adj.get(p.id)!.push(t.id);
        inDegree.set(t.id, (inDegree.get(t.id) || 0) + 1);
      }
    }
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) queue.push(id);
  }

  const evalOrder: string[] = [];
  while (queue.length > 0) {
    const currId = queue.shift()!;
    evalOrder.push(currId);
    for (const succId of adj.get(currId) || []) {
      const nextDeg = (inDegree.get(succId) || 1) - 1;
      inDegree.set(succId, nextDeg);
      if (nextDeg === 0) {
        queue.push(succId);
      }
    }
  }

  let hasCircularDependency = false;
  let cycleDetails: string | undefined = undefined;

  // If some leaf tasks were not resolved by topological sort, a circular dependency exists
  if (evalOrder.length < leafTasks.length) {
    hasCircularDependency = true;
    const unresolved = leafTasks.filter((t) => !evalOrder.includes(t.id));
    cycleDetails = `Circular dependency detected involving task(s): ${unresolved.map((u) => `'${u.name || u.id}'`).join(", ")}.`;
    warnings.push({
      taskId: unresolved[0]?.id || "cycle-detected",
      taskName: unresolved[0]?.name || "Schedule Loop",
      type: "cycle",
      severity: "critical",
      message: cycleDetails,
    });
    // Include remaining tasks in best-effort order so they can still be scheduled
    for (const t of unresolved) {
      evalOrder.push(t.id);
    }
  }

  // 2. CPM Forward Pass: Process leaf tasks in topological order
  for (const taskId of evalOrder) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const taskCal = getTaskCalendar(task);

    if (typeof task.duration !== "number" || task.duration < 0 || isNaN(task.duration)) {
      task.duration = Math.max(0, task.duration || 0);
    }

    const origStart = task.startDate;
    const origEnd = task.endDate;

    const preds = extractTaskPredecessors(task);
    let earliestConstraint: Date | null = null;
    task.drivingPredecessorId = undefined;

    if (preds.length > 0) {
      for (const p of preds) {
        const pred = taskMap.get(p.id);
        if (pred && pred.startDate && pred.endDate) {
          const predStart = parseIsoDate(pred.startDate);
          const predFinish = parseIsoDate(pred.endDate);
          const predCal = getTaskCalendar(pred);
          let requiredStart: Date;

          if (p.type === "SS") {
            // Start-to-Start: Successor starts in relation to Predecessor's start + lag
            requiredStart = shiftByWorkingDays(predStart, p.lag, predCal);
          } else if (p.type === "FF") {
            // Finish-to-Finish: Successor finishes in relation to Predecessor's finish + lag
            const requiredFinish = shiftByWorkingDays(predFinish, p.lag, predCal);
            const durOffset = task.duration > 1 ? -(task.duration - 1) : 0;
            requiredStart = shiftByWorkingDays(requiredFinish, durOffset, taskCal);
          } else if (p.type === "SF") {
            // Start-to-Finish: Successor finishes in relation to Predecessor's start + lag
            const requiredFinish = shiftByWorkingDays(predStart, p.lag, predCal);
            const durOffset = task.duration > 1 ? -(task.duration - 1) : 0;
            requiredStart = shiftByWorkingDays(requiredFinish, durOffset, taskCal);
          } else {
            // Finish-to-Start (FS, Default):
            // In MS Project, if predecessor is a milestone (duration 0), successor with 0 lag starts on the same day
            if (pred.isMilestone || pred.duration === 0) {
              requiredStart = shiftByWorkingDays(predFinish, p.lag, taskCal);
            } else {
              // Advances to the next calendar day after predFinish, then finds the first working day on successor's calendar
              const nextCalDay = new Date(predFinish.getTime());
              nextCalDay.setDate(nextCalDay.getDate() + 1);
              const firstWorking = getNextWorkingDay(nextCalDay, taskCal);
              requiredStart = p.lag === 0 ? firstWorking : shiftByWorkingDays(firstWorking, p.lag, taskCal);
            }
          }

          // Ensure requiredStart is on a valid working day for this task's calendar
          if (!isWorkingDay(requiredStart, taskCal)) {
            requiredStart = getNextWorkingDay(requiredStart, taskCal);
          }

          if (!earliestConstraint || requiredStart.getTime() > earliestConstraint.getTime()) {
            earliestConstraint = requiredStart;
            task.drivingPredecessorId = p.id;
          }
        }
      }
    }

    // Determine Early Start (CPM unconstrained earliest start date)
    let earlyStartDate: Date;
    if (earliestConstraint) {
      earlyStartDate = earliestConstraint;
    } else {
      const candidate = task.manualStartDate || task.startDate || "2026-01-05";
      earlyStartDate = getNextWorkingDay(candidate, taskCal);
    }

    task.earlyStart = formatDateIso(earlyStartDate);
    if (task.isMilestone || task.duration === 0) {
      task.earlyFinish = task.earlyStart;
    } else {
      const earlyEnd = addWorkingDays(earlyStartDate, task.duration, taskCal, Boolean(task.isElapsedDuration));
      task.earlyFinish = formatDateIso(earlyEnd);
    }

    // Apply Actual Dates or Scheduling Mode (Manual vs Auto)
    if (task.actualStart) {
      task.startDate = task.actualStart;
      task.displayStart = formatDisplayDate(task.actualStart);
    } else if (task.schedulingMode === "manual") {
      // Manual scheduling mode: preserves user-entered startDate and endDate
      const manualStart = task.manualStartDate || task.startDate;
      if (manualStart) {
        task.startDate = manualStart;
        task.displayStart = formatDisplayDate(manualStart);
      }
      // Flag dependency conflict if predecessors force start later than manual start
      if (earliestConstraint && parseIsoDate(task.startDate).getTime() < earliestConstraint.getTime()) {
        task.constraintConflict = true;
        task.constraintConflictReason = `Manually scheduled task starts on ${task.startDate}, earlier than predecessor completion date ${task.earlyStart}.`;
        warnings.push({
          taskId: task.id,
          taskName: task.name,
          type: "dependency-conflict",
          severity: "warning",
          message: `Manual task '${task.name}' is scheduled to start on ${task.startDate}, but predecessors require start on or after ${task.earlyStart}.`,
        });
      }
    } else {
      // Auto scheduling mode: starts on CPM early start unless pinned by constraint
      task.startDate = task.earlyStart;
      task.displayStart = formatDisplayDate(earlyStartDate);
    }

    // Constraint evaluation
    const cType = typeof task.constraintType === "string" ? task.constraintType.toUpperCase() : task.constraintType;
    const cDateStr = task.constraintDate;
    if (!task.constraintConflict) {
      task.constraintConflict = false;
      task.constraintConflictReason = undefined;
    }

    if (cDateStr && task.schedulingMode !== "manual") {
      const cDate = parseIsoDate(cDateStr);
      // 2: MSO (Must Start On)
      if (cType === 2 || cType === "MSO") {
        if (earliestConstraint && earliestConstraint.getTime() > cDate.getTime()) {
          task.constraintConflict = true;
          task.constraintConflictReason = `Predecessors require start on or after ${formatDateIso(earliestConstraint)}, conflicting with Must Start On ${cDateStr}.`;
          warnings.push({
            taskId: task.id,
            taskName: task.name,
            type: "constraint-conflict",
            severity: "warning",
            message: task.constraintConflictReason,
          });
        }
        task.startDate = cDateStr;
        task.displayStart = formatDisplayDate(cDate);
      }
      // 4: SNET (Start No Earlier Than)
      else if (cType === 4 || cType === "SNET") {
        const effectiveEarliest =
          earliestConstraint && earliestConstraint.getTime() > cDate.getTime() ? earliestConstraint : cDate;
        task.startDate = formatDateIso(effectiveEarliest);
        task.displayStart = formatDisplayDate(effectiveEarliest);
      }
      // 5: SNLT (Start No Later Than)
      else if (cType === 5 || cType === "SNLT") {
        if (earliestConstraint && earliestConstraint.getTime() > cDate.getTime()) {
          task.constraintConflict = true;
          task.constraintConflictReason = `Predecessors force start to ${formatDateIso(earliestConstraint)}, violating Start No Later Than constraint of ${cDateStr}.`;
          warnings.push({
            taskId: task.id,
            taskName: task.name,
            type: "constraint-conflict",
            severity: "warning",
            message: task.constraintConflictReason,
          });
        }
      }
    }

    // Calculate endDate
    if (task.actualFinish) {
      task.endDate = task.actualFinish;
      task.displayEnd = formatDisplayDate(task.actualFinish);
      task.progress = 100;
      task.remainingDuration = 0;
      task.remainingWorkHours = 0;
    } else if (task.schedulingMode === "manual" && (task.manualEndDate || task.endDate)) {
      task.endDate = task.manualEndDate || task.endDate;
      task.displayEnd = formatDisplayDate(task.endDate);
    } else {
      if (task.isMilestone || task.duration === 0) {
        task.endDate = task.startDate;
        task.displayEnd = task.displayStart;
      } else {
        const computedEnd = addWorkingDays(task.startDate, task.duration, taskCal, Boolean(task.isElapsedDuration));
        task.endDate = formatDateIso(computedEnd);
        task.displayEnd = formatDisplayDate(computedEnd);
      }
    }

    // Finish constraints (MFO, FNET, FNLT) for auto-scheduled tasks
    if (cDateStr && task.schedulingMode !== "manual") {
      const cDate = parseIsoDate(cDateStr);
      // 3: MFO (Must Finish On)
      if (cType === 3 || cType === "MFO") {
        task.endDate = cDateStr;
        task.displayEnd = formatDisplayDate(cDate);
        if (task.duration > 1) {
          const adjustedStart = shiftByWorkingDays(cDate, -(task.duration - 1), taskCal);
          task.startDate = formatDateIso(adjustedStart);
          task.displayStart = formatDisplayDate(adjustedStart);
        } else {
          task.startDate = task.endDate;
          task.displayStart = task.displayEnd;
        }
      }
      // 6: FNET (Finish No Earlier Than)
      else if (cType === 6 || cType === "FNET") {
        const computedEnd = parseIsoDate(task.endDate);
        if (computedEnd.getTime() < cDate.getTime()) {
          task.endDate = cDateStr;
          task.displayEnd = formatDisplayDate(cDate);
          if (task.duration > 1) {
            const adjustedStart = shiftByWorkingDays(cDate, -(task.duration - 1), taskCal);
            task.startDate = formatDateIso(adjustedStart);
            task.displayStart = formatDisplayDate(adjustedStart);
          }
        }
      }
      // 7: FNLT (Finish No Later Than)
      else if (cType === 7 || cType === "FNLT") {
        const computedEnd = parseIsoDate(task.endDate);
        if (computedEnd.getTime() > cDate.getTime()) {
          task.constraintConflict = true;
          task.constraintConflictReason = `Calculated finish date ${task.endDate} violates Finish No Later Than constraint of ${cDateStr}.`;
          warnings.push({
            taskId: task.id,
            taskName: task.name,
            type: "constraint-conflict",
            severity: "warning",
            message: task.constraintConflictReason,
          });
        }
      }
    }

    // Deadlines
    if (task.deadline && task.endDate) {
      const endT = parseIsoDate(task.endDate).getTime();
      const deadT = parseIsoDate(task.deadline).getTime();
      if (endT > deadT) {
        task.deadlineViolated = true;
        task.daysPastDeadline = calculateDateVarianceWorkingDays(task.deadline, task.endDate, taskCal);
        warnings.push({
          taskId: task.id,
          taskName: task.name,
          type: "deadline-violated",
          severity: "warning",
          message: `Task '${task.name}' finishes on ${task.endDate}, ${task.daysPastDeadline} working days past deadline ${task.deadline}.`,
        });
      } else {
        task.deadlineViolated = false;
        task.daysPastDeadline = 0;
      }
    }

    // Status Date evaluation
    if (options?.statusDate) {
      const evalProgress = evaluateStatusDateAndProgress(task, options.statusDate, taskCal);
      task.remainingDuration = evalProgress.remainingDuration;
      task.remainingWorkHours = evalProgress.remainingWorkHours;
      if (evalProgress.forecastFinish) {
        task.forecastFinish = evalProgress.forecastFinish;
      }
      if (evalProgress.isDelayed) {
        task.isOverdue = true;
      }
    }

    if (task.startDate !== origStart || task.endDate !== origEnd) {
      changeCount++;
    }
  }

  // 3. CPM Backward Pass (Late Dates, Total Float, Free Float, Critical Path)
  let latestProjectFinishDate: Date = new Date("2025-09-01");
  for (const t of leafTasks) {
    if (t.endDate) {
      const d = parseIsoDate(t.endDate);
      if (d.getTime() > latestProjectFinishDate.getTime()) {
        latestProjectFinishDate = d;
      }
    }
  }

  // Target Finish Date or Project Finish
  const projectTargetFinish: Date = options?.targetFinishDate
    ? parseIsoDate(options.targetFinishDate)
    : latestProjectFinishDate;

  // Build leaf successor map for backward pass
  interface SuccessorLink {
    succId: string;
    type: string;
    lag: number;
  }
  const leafSuccessorMap = new Map<string, SuccessorLink[]>();
  for (const t of leafTasks) {
    leafSuccessorMap.set(t.id, []);
  }
  for (const t of leafTasks) {
    const preds = extractTaskPredecessors(t);
    for (const p of preds) {
      if (leafSuccessorMap.has(p.id)) {
        leafSuccessorMap.get(p.id)!.push({
          succId: t.id,
          type: p.type || "FS",
          lag: p.lag || 0,
        });
      }
    }
  }

  // Process leaf tasks in reverse topological order
  const reverseEvalOrder = [...evalOrder].reverse();

  for (const taskId of reverseEvalOrder) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const taskCal = getTaskCalendar(task);
    const successors = leafSuccessorMap.get(taskId) || [];
    let lateFinishDate: Date;

    if (successors.length === 0) {
      lateFinishDate = new Date(projectTargetFinish.getTime());
    } else {
      let earliestLateFinishConstraint: Date | null = null;

      for (const succLink of successors) {
        const succ = taskMap.get(succLink.succId);
        if (!succ || !succ.lateStart || !succ.lateFinish) continue;

        const succLS = parseIsoDate(succ.lateStart);
        const succLF = parseIsoDate(succ.lateFinish);
        const succCal = getTaskCalendar(succ);
        let maxAllowedFinish: Date;

        if (succLink.type === "SS") {
          const maxAllowedStart = shiftByWorkingDays(succLS, -succLink.lag, succCal);
          maxAllowedFinish =
            task.duration > 1
              ? addWorkingDays(maxAllowedStart, task.duration, taskCal, Boolean(task.isElapsedDuration))
              : maxAllowedStart;
        } else if (succLink.type === "FF") {
          maxAllowedFinish = shiftByWorkingDays(succLF, -succLink.lag, succCal);
        } else if (succLink.type === "SF") {
          const maxAllowedStart = shiftByWorkingDays(succLF, -succLink.lag, succCal);
          maxAllowedFinish =
            task.duration > 1
              ? addWorkingDays(maxAllowedStart, task.duration, taskCal, Boolean(task.isElapsedDuration))
              : maxAllowedStart;
        } else {
          // FS
          if (task.isMilestone || task.duration === 0) {
            maxAllowedFinish = shiftByWorkingDays(succLS, -succLink.lag, taskCal);
          } else {
            const prevCalDay = new Date(succLS.getTime());
            prevCalDay.setDate(prevCalDay.getDate() - 1);
            const firstPrevWorking = getPrevWorkingDay(prevCalDay, taskCal);
            maxAllowedFinish = succLink.lag === 0 ? firstPrevWorking : shiftByWorkingDays(firstPrevWorking, -succLink.lag, taskCal);
          }
        }

        if (!earliestLateFinishConstraint || maxAllowedFinish.getTime() < earliestLateFinishConstraint.getTime()) {
          earliestLateFinishConstraint = maxAllowedFinish;
        }
      }

      lateFinishDate = earliestLateFinishConstraint
        ? earliestLateFinishConstraint
        : new Date(projectTargetFinish.getTime());
    }

    // In MS Project, deadlines and FNLT / MFO constraints cap the late finish
    if (task.deadline) {
      const dDate = parseIsoDate(task.deadline);
      if (dDate.getTime() < lateFinishDate.getTime()) {
        lateFinishDate = dDate;
      }
    }
    const cType = typeof task.constraintType === "string" ? task.constraintType.toUpperCase() : task.constraintType;
    if (task.constraintDate) {
      if (cType === 7 || cType === "FNLT") {
        const fnltDate = parseIsoDate(task.constraintDate);
        if (fnltDate.getTime() < lateFinishDate.getTime()) {
          lateFinishDate = fnltDate;
        }
      } else if (cType === 3 || cType === "MFO") {
        lateFinishDate = parseIsoDate(task.constraintDate);
      }
    }

    if (!isWorkingDay(lateFinishDate, taskCal)) {
      lateFinishDate = getPrevWorkingDay(lateFinishDate, taskCal);
    }

    let lateStartDate: Date;
    if (task.isMilestone || task.duration === 0) {
      lateStartDate = new Date(lateFinishDate.getTime());
    } else if (task.duration === 1) {
      lateStartDate = new Date(lateFinishDate.getTime());
    } else {
      lateStartDate = shiftByWorkingDays(lateFinishDate, -(task.duration - 1), taskCal);
    }

    // SNLT or MSO constraint pulls lateStart
    if (task.constraintDate) {
      if (cType === 5 || cType === "SNLT") {
        const snltDate = parseIsoDate(task.constraintDate);
        if (snltDate.getTime() < lateStartDate.getTime()) {
          lateStartDate = snltDate;
          lateFinishDate =
            task.duration > 1
              ? addWorkingDays(lateStartDate, task.duration, taskCal, Boolean(task.isElapsedDuration))
              : lateStartDate;
        }
      } else if (cType === 2 || cType === "MSO") {
        lateStartDate = parseIsoDate(task.constraintDate);
        lateFinishDate =
          task.duration > 1
            ? addWorkingDays(lateStartDate, task.duration, taskCal, Boolean(task.isElapsedDuration))
            : lateStartDate;
      }
    }

    task.lateStart = formatDateIso(lateStartDate);
    task.lateFinish = formatDateIso(lateFinishDate);

    // If project is scheduled from finish or ALAP constraint is set, align dates to late pass
    if (options?.scheduleFromStart === false || task.constraintType === 1 || task.constraintType === "ALAP") {
      task.startDate = task.lateStart;
      task.endDate = task.lateFinish;
      task.displayStart = formatDisplayDate(lateStartDate);
      task.displayEnd = formatDisplayDate(lateFinishDate);
    }

    // Calculate Total Float (working days between Early Start and Late Start)
    const effectiveEarlyStart = task.earlyStart || task.startDate;
    const totalFloat = calculateDateVarianceWorkingDays(effectiveEarlyStart, task.lateStart, taskCal);
    task.float = totalFloat; // Preserve exact float, including negative float
    task.hasNegativeFloat = totalFloat < 0;
    task.isCritical = totalFloat <= 0;
    task.isCalculatedCritical = totalFloat <= 0;
    const nearCritThreshold = options?.nearCriticalThresholdDays ?? 5;
    task.isNearCritical = totalFloat > 0 && totalFloat <= nearCritThreshold;

    if (task.hasNegativeFloat) {
      task.criticalityReason = `Negative total float (${totalFloat} days): task violates deadline or finish constraint on ${task.lateFinish}.`;
    } else if (task.isCritical) {
      task.criticalityReason = `Zero total float driving project completion date on ${task.lateFinish}.`;
    } else if (task.isNearCritical) {
      task.criticalityReason = `Near-critical path: only ${task.float} days of float before pushing downstream schedule.`;
    } else {
      task.criticalityReason = `Flexible: ${task.float} days of total float.`;
    }

    // Calculate Free Float
    if (successors.length === 0) {
      task.freeFloat = task.float;
    } else {
      let minSlack = Infinity;

      for (const succLink of successors) {
        const succ = taskMap.get(succLink.succId);
        if (!succ) continue;
        const succCal = getTaskCalendar(succ);

        let slack = 0;
        const succES = succ.earlyStart || succ.startDate;
        const succEF = succ.earlyFinish || succ.endDate;
        const effTaskStart = task.earlyStart || task.startDate;
        const effTaskEnd = task.earlyFinish || task.endDate;

        if (succLink.type === "SS") {
          const maxEarlyStart = shiftByWorkingDays(succES, -succLink.lag, succCal);
          slack = calculateDateVarianceWorkingDays(effTaskStart, formatDateIso(maxEarlyStart), succCal);
        } else if (succLink.type === "FF") {
          const maxEarlyFinish = shiftByWorkingDays(succEF, -succLink.lag, succCal);
          slack = calculateDateVarianceWorkingDays(effTaskEnd, formatDateIso(maxEarlyFinish), succCal);
        } else if (succLink.type === "SF") {
          const maxEarlyStart = shiftByWorkingDays(succEF, -succLink.lag, succCal);
          slack = calculateDateVarianceWorkingDays(effTaskStart, formatDateIso(maxEarlyStart), succCal);
        } else {
          // FS
          let maxEarlyFinish: Date;
          if (task.isMilestone || task.duration === 0) {
            maxEarlyFinish = shiftByWorkingDays(succES, -succLink.lag, taskCal);
          } else {
            const prevCalDay = new Date(parseIsoDate(succES).getTime());
            prevCalDay.setDate(prevCalDay.getDate() - 1);
            const firstPrevWorking = getPrevWorkingDay(prevCalDay, taskCal);
            maxEarlyFinish = succLink.lag === 0 ? firstPrevWorking : shiftByWorkingDays(firstPrevWorking, -succLink.lag, taskCal);
          }
          slack = calculateDateVarianceWorkingDays(effTaskEnd, formatDateIso(maxEarlyFinish), taskCal);
        }

        if (slack < minSlack) {
          minSlack = slack;
        }
      }

      task.freeFloat = minSlack === Infinity ? task.float : Math.min(minSlack, task.float);
    }
  }

  // 4. Roll up parent / summary containers bottom-up (sorted by depth descending)
  const summaryTasks = allTasksList.filter((t) => isSummaryContainer(t));
  summaryTasks.sort((a, b) => (b.depth ?? 0) - (a.depth ?? 0));

  for (const summary of summaryTasks) {
    const childTasks = allTasksList.filter((t) => t.parentId === summary.id);
    if (childTasks.length > 0) {
      let minStart: Date | null = null;
      let maxEnd: Date | null = null;
      let minEarlyStart: Date | null = null;
      let maxEarlyFinish: Date | null = null;
      let minLateStart: Date | null = null;
      let maxLateFinish: Date | null = null;
      let hasAnyCriticalChild = false;
      let hasAnyNearCriticalChild = false;
      let hasAnyNegativeFloatChild = false;
      let minFloat = Infinity;
      let minFreeFloat = Infinity;

      let sumWork = 0;
      let sumActualWork = 0;
      let sumRemainingWork = 0;
      let sumCost = 0;
      let sumProgress = 0;
      let childCount = 0;
      let totalChildDuration = 0;

      for (const c of childTasks) {
        if (c.startDate && c.endDate) {
          const cStart = parseIsoDate(c.startDate);
          const cEnd = parseIsoDate(c.endDate);
          if (!minStart || cStart.getTime() < minStart.getTime()) minStart = cStart;
          if (!maxEnd || cEnd.getTime() > maxEnd.getTime()) maxEnd = cEnd;
        }
        if (c.earlyStart && c.earlyFinish) {
          const cES = parseIsoDate(c.earlyStart);
          const cEF = parseIsoDate(c.earlyFinish);
          if (!minEarlyStart || cES.getTime() < minEarlyStart.getTime()) minEarlyStart = cES;
          if (!maxEarlyFinish || cEF.getTime() > maxEarlyFinish.getTime()) maxEarlyFinish = cEF;
        }
        if (c.lateStart && c.lateFinish) {
          const cLS = parseIsoDate(c.lateStart);
          const cLF = parseIsoDate(c.lateFinish);
          if (!minLateStart || cLS.getTime() < minLateStart.getTime()) minLateStart = cLS;
          if (!maxLateFinish || cLF.getTime() > maxLateFinish.getTime()) maxLateFinish = cLF;
        }
        if (c.isCritical) hasAnyCriticalChild = true;
        if (c.isNearCritical) hasAnyNearCriticalChild = true;
        if (c.hasNegativeFloat) hasAnyNegativeFloatChild = true;
        if (typeof c.float === "number" && c.float < minFloat) minFloat = c.float;
        if (typeof c.freeFloat === "number" && c.freeFloat < minFreeFloat) minFreeFloat = c.freeFloat;

        if (typeof c.duration === "number") totalChildDuration += c.duration;
        if (typeof c.workHours === "number") sumWork += c.workHours;
        if (typeof c.actualWorkHours === "number") sumActualWork += c.actualWorkHours;
        if (typeof c.remainingWorkHours === "number") sumRemainingWork += c.remainingWorkHours;
        if (typeof c.cost === "number") sumCost += c.cost;
        if (typeof c.progress === "number") {
          sumProgress += c.progress;
          childCount++;
        }
      }

      if (minStart && maxEnd) {
        const newStartIso = formatDateIso(minStart);
        const newEndIso = formatDateIso(maxEnd);
        const newDur = countWorkingDays(minStart, maxEnd, calendar);
        const effFloat = minFloat === Infinity ? 0 : minFloat;
        const isCrit = hasAnyCriticalChild || effFloat <= 0;

        summary.startDate = newStartIso;
        summary.endDate = newEndIso;
        summary.displayStart = formatDisplayDate(minStart);
        summary.displayEnd = formatDisplayDate(maxEnd);
        summary.duration = newDur;
        summary.float = effFloat;
        summary.freeFloat = minFreeFloat === Infinity ? 0 : minFreeFloat;
        summary.hasNegativeFloat = effFloat < 0 || hasAnyNegativeFloatChild;
        summary.isCritical = isCrit;
        summary.isCalculatedCritical = isCrit;
        summary.isNearCritical =
          !isCrit &&
          (hasAnyNearCriticalChild || (effFloat > 0 && effFloat <= (options?.nearCriticalThresholdDays ?? 5)));

        if (minEarlyStart) summary.earlyStart = formatDateIso(minEarlyStart);
        if (maxEarlyFinish) summary.earlyFinish = formatDateIso(maxEarlyFinish);
        if (minLateStart) summary.lateStart = formatDateIso(minLateStart);
        if (maxLateFinish) summary.lateFinish = formatDateIso(maxLateFinish);
        changeCount++;
      }

      if (sumWork > 0) summary.workHours = sumWork;
      if (sumActualWork > 0) summary.actualWorkHours = sumActualWork;
      if (sumRemainingWork > 0) summary.remainingWorkHours = sumRemainingWork;
      if (sumCost > 0) summary.cost = sumCost;

      // Microsoft Project work-weighted progress rollup
      if (sumWork > 0) {
        const weightedWork = childTasks.reduce(
          (acc, c) => acc + (c.workHours || 0) * (c.progress || 0),
          0
        );
        summary.progress = Math.round(weightedWork / sumWork);
      } else if (totalChildDuration > 0) {
        const weightedDur = childTasks.reduce(
          (acc, c) => acc + (c.duration || 0) * (c.progress || 0),
          0
        );
        summary.progress = Math.round(weightedDur / totalChildDuration);
      } else if (childCount > 0) {
        summary.progress = Math.round(sumProgress / childCount);
      }
    }
  }

  const allUpdated = Array.from(taskMap.values());

  // 5. Resource Workload Evaluation
  let resourceSummaries: ResourceWorkloadSummary[] | undefined = undefined;
  if (options?.checkResourceWorkloads !== false) {
    const resResult = calculateResourceWorkloads(allUpdated, calendar);
    resourceSummaries = resResult.resourceSummaries;
    for (const t of allUpdated) {
      if (resResult.overallocatedTaskIds.has(t.id)) {
        t.overallocated = true;
        const peak = resResult.peakAllocationByTask.get(t.id) || 1.0;
        t.peakAllocationPercent = Math.round(peak * 100);
        warnings.push({
          taskId: t.id,
          taskName: t.name,
          type: "overallocated",
          severity: "warning",
          message: `Resource '${t.assignee || t.byWhom}' is overallocated on this task (${t.peakAllocationPercent}% peak allocation).`,
        });
      } else {
        t.overallocated = false;
        t.peakAllocationPercent = 100;
      }
    }
  }

  // Determine overall project dates
  let pStart = "2025-09-01";
  let pEnd = "2026-11-15";
  if (allUpdated.length > 0) {
    const dates = allUpdated.map((t) => parseIsoDate(t.startDate).getTime());
    const endDates = allUpdated.map((t) => parseIsoDate(t.endDate).getTime());
    pStart = formatDateIso(new Date(Math.min(...dates)));
    pEnd = formatDateIso(new Date(Math.max(...endDates)));
  }

  const criticalTasks = allUpdated.filter((t) => t.isCritical);

  return {
    updatedTasks: allUpdated,
    changeCount,
    projectStartDate: pStart,
    projectEndDate: pEnd,
    criticalTaskCount: criticalTasks.length,
    criticalPathTaskIds: criticalTasks.map((t) => t.id),
    warnings,
    resourceSummaries,
    hasCircularDependency,
    cycleDetails,
    hasImpossibleConditions: warnings.some((w) => w.severity === "critical" || w.type === "constraint-conflict"),
  };
}


/**
 * Interface representing schedule variance between Baseline 0 and current working forecast.
 * All variances are expressed in working days according to the active project calendar.
 */
export interface ScheduleVariance {
  startVariance: number; // working days (+ = current is later than baseline, - = earlier)
  finishVariance: number; // working days (+ = delay / slipped finish, - = ahead of schedule)
  durationVariance: number; // working days (+ = duration extended, - = compressed)
  isDelayed: boolean;
  isAhead: boolean;
  isOnTrack: boolean;
  hasBaseline: boolean;
  baselineDuration?: number;
}

/**
 * Calculates variance between two ISO dates in working days using the project calendar.
 * Returns:
 *   +N: currentDate is N working days later than baselineDate (delay / slip)
 *   -N: currentDate is N working days earlier than baselineDate (ahead)
 *    0: identical or 0 working days difference
 */
export function calculateDateVarianceWorkingDays(
  baselineDateStr: string | undefined,
  currentDateStr: string | undefined,
  calendar: ProjectCalendar
): number {
  if (!baselineDateStr || !currentDateStr) return 0;
  if (baselineDateStr === currentDateStr) return 0;

  const baseDate = parseIsoDate(baselineDateStr);
  const currDate = parseIsoDate(currentDateStr);

  if (currDate.getTime() === baseDate.getTime()) return 0;

  if (currDate.getTime() > baseDate.getTime()) {
    // Current is later than baseline => positive delay
    // Count working days strictly after baseline up to and including current
    const testDate = new Date(baseDate.getTime());
    testDate.setDate(testDate.getDate() + 1);
    return countWorkingDays(testDate, currDate, calendar);
  } else {
    // Current is earlier than baseline => negative ahead
    // Count working days strictly after current up to and including baseline
    const testDate = new Date(currDate.getTime());
    testDate.setDate(testDate.getDate() + 1);
    return -countWorkingDays(testDate, baseDate, calendar);
  }
}

/**
 * Computes full schedule variance for a task against its saved baseline.
 * Protects baseline integrity: returns hasBaseline=false if baseline dates are missing.
 */
export function calculateScheduleVariance(
  task: ProgrammeTask,
  calendar: ProjectCalendar
): ScheduleVariance {
  const hasBaseline = Boolean(task.baseline0Start && task.baseline0Finish);
  if (!hasBaseline || !task.baseline0Start || !task.baseline0Finish) {
    return {
      startVariance: 0,
      finishVariance: 0,
      durationVariance: 0,
      isDelayed: false,
      isAhead: false,
      isOnTrack: false,
      hasBaseline: false,
    };
  }

  const startVariance = calculateDateVarianceWorkingDays(task.baseline0Start, task.startDate, calendar);
  const finishVariance = calculateDateVarianceWorkingDays(task.baseline0Finish, task.endDate, calendar);

  const baselineDuration = countWorkingDays(task.baseline0Start, task.baseline0Finish, calendar);
  const currentDuration = task.duration || countWorkingDays(task.startDate, task.endDate, calendar);
  const durationVariance = currentDuration - baselineDuration;

  return {
    startVariance,
    finishVariance,
    durationVariance,
    isDelayed: finishVariance > 0,
    isAhead: finishVariance < 0,
    isOnTrack: finishVariance === 0 && startVariance === 0,
    hasBaseline: true,
    baselineDuration,
  };
}

/**
 * Calculates schedule variance against any designated baseline slot (0 to 10).
 * Preserves immutable baseline values during recalculations.
 */
export function calculateMultiBaselineVariance(
  task: ProgrammeTask,
  slotNumber: number,
  calendar: ProjectCalendar
): ScheduleVariance & {
  startVarianceDays: number;
  finishVarianceDays: number;
  durationVarianceDays: number;
  workVarianceHours?: number;
  costVariance?: number;
} {
  const slot = task.baselineSlots?.[slotNumber];
  const bStart = slotNumber === 0 ? (task.baseline0Start || slot?.start || slot?.startDate) : (slot?.start || slot?.startDate);
  const bFinish = slotNumber === 0 ? (task.baseline0Finish || slot?.finish || slot?.finishDate) : (slot?.finish || slot?.finishDate);

  if (!bStart || !bFinish) {
    return {
      startVariance: 0,
      finishVariance: 0,
      durationVariance: 0,
      startVarianceDays: 0,
      finishVarianceDays: 0,
      durationVarianceDays: 0,
      isDelayed: false,
      isAhead: false,
      isOnTrack: false,
      hasBaseline: false,
    };
  }

  const startVariance = calculateDateVarianceWorkingDays(bStart, task.startDate, calendar);
  const finishVariance = calculateDateVarianceWorkingDays(bFinish, task.endDate, calendar);
  const baselineDuration = countWorkingDays(bStart, bFinish, calendar);
  const currentDuration = task.duration || countWorkingDays(task.startDate, task.endDate, calendar);
  const durationVariance = currentDuration - baselineDuration;

  const baselineWork = slot?.workHours ?? (slotNumber === 0 ? task.baseline0Work : undefined);
  const currentWork = task.workHours;
  const workVarianceHours = typeof baselineWork === "number" && typeof currentWork === "number" ? currentWork - baselineWork : undefined;

  const baselineCost = slot?.cost ?? (slotNumber === 0 ? task.baseline0Cost : undefined);
  const currentCost = task.cost;
  const costVariance = typeof baselineCost === "number" && typeof currentCost === "number" ? currentCost - baselineCost : undefined;

  return {
    startVariance,
    finishVariance,
    durationVariance,
    startVarianceDays: startVariance,
    finishVarianceDays: finishVariance,
    durationVarianceDays: durationVariance,
    workVarianceHours,
    costVariance,
    isDelayed: finishVariance > 0,
    isAhead: finishVariance < 0,
    isOnTrack: finishVariance === 0 && startVariance === 0,
    hasBaseline: true,
    baselineDuration,
  };
}

/**
 * Returns user-facing label and styling for schedule variance.
 */
export function formatVarianceDisplay(varianceDays: number): {
  label: string;
  shortLabel: string;
  badgeClass: string;
  textClass: string;
} {
  if (varianceDays > 0) {
    return {
      label: `+${varianceDays}d delay`,
      shortLabel: `+${varianceDays}d`,
      badgeClass:
        varianceDays >= 5
          ? "bg-red-50 text-red-700 border-red-200"
          : "bg-amber-50 text-amber-800 border-amber-200",
      textClass: varianceDays >= 5 ? "text-red-600" : "text-amber-600",
    };
  }
  if (varianceDays < 0) {
    return {
      label: `${varianceDays}d ahead`,
      shortLabel: `${varianceDays}d`,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      textClass: "text-emerald-600",
    };
  }
  return {
    label: "0d on track",
    shortLabel: "0d",
    badgeClass: "bg-slate-100 text-slate-600 border-slate-200",
    textClass: "text-slate-500",
  };
}

// ─── Delay Impact & Downstream Propagation Analysis ──────────

export interface AffectedSuccessor {
  id: string;
  wbs: string;
  name: string;
  isCritical: boolean;
  startDate: string;
  endDate: string;
}

export interface TaskDelayImpact {
  taskId: string;
  taskName: string;
  hasBaseline: boolean;
  finishVariance: number; // working days against baseline (+ = delay, - = ahead, 0 = on track)
  totalFloat: number; // working days
  freeFloat: number; // working days
  isCritical: boolean;
  impactType: "on-track" | "consuming-float" | "critical-delay" | "no-baseline";
  netProjectDelayDays: number; // working days this task pushes project completion
  remainingFloat: number; // remaining buffer after consuming delay
  affectedSuccessors: AffectedSuccessor[];
  affectedSuccessorCount: number;
  explanation: string;
}

/**
 * Traverses downstream dependency network (BFS) to identify all successor activities
 * that depend on the given task.
 */
export function getDownstreamAffectedTasks(
  taskId: string,
  allTasks: ProgrammeTask[]
): AffectedSuccessor[] {
  const taskMap = new Map<string, ProgrammeTask>();
  for (const t of allTasks) {
    taskMap.set(t.id, t);
  }

  // Build successor map
  const succMap = new Map<string, string[]>();
  for (const t of allTasks) {
    succMap.set(t.id, []);
  }

  for (const t of allTasks) {
    const preds = extractTaskPredecessors(t);
    for (const p of preds) {
      if (succMap.has(p.id)) {
        succMap.get(p.id)!.push(t.id);
      }
    }
  }

  const queue: string[] = [taskId];
  const visited = new Set<string>([taskId]);
  const results: AffectedSuccessor[] = [];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const successors = succMap.get(currId) || [];
    for (const sId of successors) {
      if (!visited.has(sId)) {
        visited.add(sId);
        queue.push(sId);
        const sTask = taskMap.get(sId);
        if (sTask) {
          results.push({
            id: sTask.id,
            wbs: sTask.wbs || "",
            name: sTask.name,
            isCritical: Boolean(sTask.isCritical),
            startDate: sTask.startDate,
            endDate: sTask.endDate,
          });
        }
      }
    }
  }

  // Sort downstream affected tasks chronologically by start date
  results.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return results;
}

/**
 * Rigorously evaluates delay impact for a construction task:
 * 1. Checks baseline variance in working days using the active project calendar.
 * 2. Compares delay against Total Float.
 * 3. Categorizes whether delay safely consumes float or directly pushes project completion.
 * 4. Identifies all downstream affected successors.
 */
export function calculateTaskDelayImpact(
  task: ProgrammeTask,
  allTasks: ProgrammeTask[],
  calendar: ProjectCalendar
): TaskDelayImpact {
  const affectedSuccessors = getDownstreamAffectedTasks(task.id, allTasks);
  const totalFloat = typeof task.float === "number" ? task.float : 0;
  const freeFloat = typeof task.freeFloat === "number" ? task.freeFloat : totalFloat;
  const isCritical = Boolean(task.isCritical || totalFloat <= 0);

  const hasBaseline = Boolean(task.baseline0Start && task.baseline0Finish);

  if (!hasBaseline) {
    return {
      taskId: task.id,
      taskName: task.name,
      hasBaseline: false,
      finishVariance: 0,
      totalFloat,
      freeFloat,
      isCritical,
      impactType: isCritical ? "critical-delay" : "consuming-float",
      netProjectDelayDays: 0,
      remainingFloat: totalFloat,
      affectedSuccessors,
      affectedSuccessorCount: affectedSuccessors.length,
      explanation: isCritical
        ? "Critical path activity with zero float. Any extension will directly delay the project completion date."
        : `Non-critical activity with ${totalFloat}d float. Can absorb up to ${totalFloat} working days of delay without affecting project finish.`,
    };
  }

  const variance = calculateScheduleVariance(task, calendar);
  const finishVariance = variance.finishVariance;

  if (finishVariance <= 0) {
    return {
      taskId: task.id,
      taskName: task.name,
      hasBaseline: true,
      finishVariance,
      totalFloat,
      freeFloat,
      isCritical,
      impactType: "on-track",
      netProjectDelayDays: 0,
      remainingFloat: totalFloat,
      affectedSuccessors,
      affectedSuccessorCount: affectedSuccessors.length,
      explanation:
        finishVariance < 0
          ? `Activity is running ${Math.abs(finishVariance)} working days ahead of baseline schedule.`
          : "Activity is on track with baseline schedule. No schedule risk.",
    };
  }

  // Activity has a positive delay (finishVariance > 0)
  if (isCritical) {
    return {
      taskId: task.id,
      taskName: task.name,
      hasBaseline: true,
      finishVariance,
      totalFloat,
      freeFloat,
      isCritical: true,
      impactType: "critical-delay",
      netProjectDelayDays: finishVariance,
      remainingFloat: 0,
      affectedSuccessors,
      affectedSuccessorCount: affectedSuccessors.length,
      explanation: `Critical path activity is delayed by ${finishVariance} working days. Because available float is 0d, this delay directly pushes project completion by ${finishVariance} working days.`,
    };
  }

  if (finishVariance <= totalFloat) {
    const remainingFloat = totalFloat - finishVariance;
    return {
      taskId: task.id,
      taskName: task.name,
      hasBaseline: true,
      finishVariance,
      totalFloat,
      freeFloat,
      isCritical: false,
      impactType: "consuming-float",
      netProjectDelayDays: 0,
      remainingFloat,
      affectedSuccessors,
      affectedSuccessorCount: affectedSuccessors.length,
      explanation: `Activity is delayed by ${finishVariance} working days, but safely absorbs available float (${totalFloat}d available, ${remainingFloat}d buffer remaining). It does NOT push the project completion date.`,
    };
  }

  // Delay exceeds available float!
  const netProjectDelay = finishVariance - totalFloat;
  return {
    taskId: task.id,
    taskName: task.name,
    hasBaseline: true,
    finishVariance,
    totalFloat,
    freeFloat,
    isCritical: true,
    impactType: "critical-delay",
    netProjectDelayDays: netProjectDelay,
    remainingFloat: 0,
    affectedSuccessors,
    affectedSuccessorCount: affectedSuccessors.length,
    explanation: `Activity delay of ${finishVariance} working days exceeds total float (${totalFloat}d) and pushes the projected project completion date by ${netProjectDelay} working days.`,
  };
}

/**
 * Returns all activities currently on the critical path (float <= 0).
 */
export function getCriticalPathActivities(tasks: ProgrammeTask[]): ProgrammeTask[] {
  return tasks.filter((t) => t.isCritical || (typeof t.float === "number" && t.float <= 0));
}

// ─── Lookahead Planning Functions ────────────────────────────

export interface LookaheadDateRange {
  startDate: string; // ISO date
  endDate: string; // ISO date
  period: LookaheadPeriod;
  calendarDays: number;
  workingDays: number;
  displayRange: string;
}

export interface LookaheadSummaryStats {
  totalCount: number;
  readyCount: number;
  dependencyRiskCount: number;
  blockedCount: number;
  overdueCount: number;
  unassignedCount: number;
  criticalCount: number;
}

/**
 * Calculates start and end dates for a Lookahead period (1, 2, 4, or 6 weeks)
 * anchored at a reference date, counting working days under the active calendar.
 */
export function getLookaheadDateRange(
  anchorDateStr: string,
  period: LookaheadPeriod = "2-weeks",
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): LookaheadDateRange {
  const start = parseIsoDate(anchorDateStr);
  const calendarDays =
    period === "1-week" ? 7 : period === "2-weeks" ? 14 : period === "4-weeks" ? 28 : 42;

  const end = new Date(start.getTime());
  end.setDate(end.getDate() + (calendarDays - 1));

  const startIso = formatDateIso(start);
  const endIso = formatDateIso(end);
  const workingDays = countWorkingDays(start, end, calendar);

  return {
    startDate: startIso,
    endDate: endIso,
    period,
    calendarDays,
    workingDays,
    displayRange: `${formatDisplayDate(startIso)} – ${formatDisplayDate(endIso)}`,
  };
}

/**
 * Filters and analyzes construction activities that are active within the specified lookahead period.
 * Categorizes readiness: ready, dependency-risk, blocked, overdue, or unassigned.
 */
export function getLookaheadTasks(
  allTasks: ProgrammeTask[],
  range: { startDate: string; endDate: string },
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR,
  referenceDateStr?: string
): LookaheadTaskItem[] {
  const refDate = referenceDateStr || range.startDate;
  const taskMap = new Map<string, ProgrammeTask>();
  for (const t of allTasks) {
    taskMap.set(t.id, t);
  }

  // Lookahead criteria:
  // 1. Scheduled to start, continue or finish within selected period (start <= windowEnd && finish >= windowStart)
  // 2. OR uncompleted overdue activities carrying over into the current period (finish < refDate && incomplete)
  // Focus on actionable tasks, work packages and milestones (skip high-level phase/programme containers)
  const isWindowCurrent = range.startDate <= refDate && range.endDate >= refDate;
  const candidateTasks = allTasks.filter((t) => {
    if (t.level === "programme" || t.level === "phase") return false;
    if (!t.startDate || !t.endDate) return false;
    const inWindow = t.startDate <= range.endDate && t.endDate >= range.startDate;
    if (inWindow) return true;
    const isOverdueCarryover =
      isWindowCurrent &&
      (t.isOverdue || t.endDate < refDate) &&
      t.status !== "complete" &&
      t.progress < 100 &&
      t.startDate <= range.endDate;
    return isOverdueCarryover;
  });

  const lookaheadItems: LookaheadTaskItem[] = candidateTasks.map((task) => {
    // 1. Timing in window
    let timingInWindow: "starts-in-window" | "finishes-in-window" | "spans-window" | "within-window";
    if (task.startDate >= range.startDate && task.endDate <= range.endDate) {
      timingInWindow = "within-window";
    } else if (task.startDate >= range.startDate) {
      timingInWindow = "starts-in-window";
    } else if (task.endDate <= range.endDate) {
      timingInWindow = "finishes-in-window";
    } else {
      timingInWindow = "spans-window";
    }

    // 2. Day offsets relative to anchor reference date
    const daysUntilStart = calculateDateVarianceWorkingDays(refDate, task.startDate, calendar);
    const daysUntilFinish = calculateDateVarianceWorkingDays(refDate, task.endDate, calendar);

    // 3. Inspect Predecessors for Dependency Readiness
    const unresolvedPredecessors: {
      id: string;
      name: string;
      status: TaskStatus;
      progress: number;
      endDate: string;
    }[] = [];

    const preds = extractTaskPredecessors(task);
    for (const p of preds) {
      const predTask = taskMap.get(p.id);
      if (predTask && predTask.status !== "complete" && predTask.progress < 100) {
        unresolvedPredecessors.push({
          id: predTask.id,
          name: predTask.name,
          status: predTask.status,
          progress: predTask.progress,
          endDate: predTask.endDate,
        });
      }
    }

    // 4. Determine Readiness Status & Reason
    let readiness: LookaheadReadiness;
    let readinessReason = "";

    const isOverdue =
      task.isOverdue ||
      (task.endDate < refDate && task.status !== "complete" && task.progress < 100);

    const isBlocked =
      task.status === "blocked" || Boolean(task.isBlocked) || Boolean(task.blockedBy);

    if (isOverdue) {
      readiness = "overdue";
      const slipDays = Math.abs(daysUntilFinish);
      readinessReason = `Overdue by ${slipDays} working days (Planned finish was ${task.endDate}).`;
    } else if (isBlocked) {
      readiness = "blocked";
      readinessReason = task.blockedBy || "Recorded constraint / site blocker prevents progress.";
    } else if (unresolvedPredecessors.length > 0) {
      readiness = "dependency-risk";
      const p = unresolvedPredecessors[0];
      readinessReason = `Predecessor '${p.name}' is incomplete (${p.progress}%, finishes ${p.endDate}).`;
    } else if (!task.assignee && !task.subcontractor) {
      readiness = "unassigned";
      readinessReason = "No subcontractor or trade resource assigned.";
    } else {
      readiness = "ready";
      readinessReason = "All prerequisites satisfied. Clear to proceed on schedule.";
    }

    return {
      task,
      readiness,
      readinessReason,
      timingInWindow,
      daysUntilStart,
      daysUntilFinish,
      unresolvedPredecessors,
    };
  });

  // Sort: Overdue & Blocked first, then chronologically by start date, then critical tasks
  lookaheadItems.sort((a, b) => {
    const priorityOrder: Record<LookaheadReadiness, number> = {
      overdue: 1,
      blocked: 2,
      "dependency-risk": 3,
      unassigned: 4,
      ready: 5,
    };
    if (priorityOrder[a.readiness] !== priorityOrder[b.readiness]) {
      return priorityOrder[a.readiness] - priorityOrder[b.readiness];
    }
    if (a.task.startDate !== b.task.startDate) {
      return a.task.startDate.localeCompare(b.task.startDate);
    }
    return (b.task.isCritical ? 1 : 0) - (a.task.isCritical ? 1 : 0);
  });

  return lookaheadItems;
}

/**
 * Computes high-level KPI counts for the Lookahead view.
 */
export function getLookaheadSummaryStats(items: LookaheadTaskItem[]): LookaheadSummaryStats {
  return {
    totalCount: items.length,
    readyCount: items.filter((i) => i.readiness === "ready").length,
    dependencyRiskCount: items.filter((i) => i.readiness === "dependency-risk").length,
    blockedCount: items.filter((i) => i.readiness === "blocked").length,
    overdueCount: items.filter((i) => i.readiness === "overdue").length,
    unassignedCount: items.filter((i) => i.readiness === "unassigned").length,
    criticalCount: items.filter((i) => i.task.isCritical).length,
  };
}
