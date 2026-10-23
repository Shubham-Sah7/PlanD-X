// Project Working Calendar & Scheduling Engine for PlanD-X
// ==============================================================

import type {
  ProgrammeTask,
  TaskStatus,
  LookaheadPeriod,
  LookaheadReadiness,
  LookaheadTaskItem,
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

  // Check public holiday / custom non-working exception
  if (isHoliday(isoStr, calendar)) {
    return false;
  }

  // Check day of week (0 = Sun, 1 = Mon, ..., 6 = Sat)
  const dayOfWeek = date.getDay();
  return calendar.workingDays.includes(dayOfWeek);
}

export function getNextWorkingDay(dateOrStr: Date | string, calendar: ProjectCalendar): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());
  let maxLoop = 365;
  while (!isWorkingDay(curr, calendar) && maxLoop > 0) {
    curr.setDate(curr.getDate() + 1);
    maxLoop--;
  }
  return curr;
}

export function getPrevWorkingDay(dateOrStr: Date | string, calendar: ProjectCalendar): Date {
  let curr = typeof dateOrStr === "string" ? parseIsoDate(dateOrStr) : new Date(dateOrStr.getTime());
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
  calendar: ProjectCalendar
): Date {
  if (workingDays <= 0) {
    return typeof startDateOrStr === "string" ? parseIsoDate(startDateOrStr) : new Date(startDateOrStr.getTime());
  }

  // Ensure start date is on a valid working day
  let curr = getNextWorkingDay(startDateOrStr, calendar);
  let daysRemaining = workingDays - 1;
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
  calendar: ProjectCalendar
): ScheduleRecalculationResult {
  const taskMap = new Map<string, ProgrammeTask>();
  for (const t of tasks) {
    taskMap.set(t.id, { ...t });
  }

  let changeCount = 0;

  // Helper to determine if a task is a summary container
  const allTasksList = Array.from(taskMap.values());
  const isSummaryContainer = (t: ProgrammeTask): boolean => {
    if (t.level === "phase" || t.level === "programme") return true;
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

  // Include any remaining leaf tasks in case of cycles so no task is omitted
  for (const t of leafTasks) {
    if (!evalOrder.includes(t.id)) {
      evalOrder.push(t.id);
    }
  }

  // 2. CPM Forward Pass: Process leaf tasks in topological order
  for (const taskId of evalOrder) {
    const task = taskMap.get(taskId);
    if (!task) continue;

    const origStart = task.startDate;
    const origEnd = task.endDate;

    const preds = extractTaskPredecessors(task);
    if (preds.length > 0) {
      let earliestConstraint: Date | null = null;

      for (const p of preds) {
        const pred = taskMap.get(p.id);
        if (pred && pred.startDate && pred.endDate) {
          const predStart = parseIsoDate(pred.startDate);
          const predFinish = parseIsoDate(pred.endDate);
          let requiredStart: Date;

          if (p.type === "SS") {
            // Start-to-Start: Successor starts in relation to Predecessor's start + lag
            requiredStart = shiftByWorkingDays(predStart, p.lag, calendar);
          } else if (p.type === "FF") {
            // Finish-to-Finish: Successor finishes in relation to Predecessor's finish + lag
            const requiredFinish = shiftByWorkingDays(predFinish, p.lag, calendar);
            const durOffset = task.duration > 1 ? -(task.duration - 1) : 0;
            requiredStart = shiftByWorkingDays(requiredFinish, durOffset, calendar);
          } else if (p.type === "SF") {
            // Start-to-Finish: Successor finishes in relation to Predecessor's start + lag
            const requiredFinish = shiftByWorkingDays(predStart, p.lag, calendar);
            const durOffset = task.duration > 1 ? -(task.duration - 1) : 0;
            requiredStart = shiftByWorkingDays(requiredFinish, durOffset, calendar);
          } else {
            // Finish-to-Start (FS, Default): Successor starts after Predecessor finishes + lag
            requiredStart = shiftByWorkingDays(predFinish, 1 + p.lag, calendar);
          }

          if (!earliestConstraint || requiredStart.getTime() > earliestConstraint.getTime()) {
            earliestConstraint = requiredStart;
          }
        }
      }

      if (earliestConstraint) {
        if (task.manualStartDate) {
          const manualDate = getNextWorkingDay(task.manualStartDate, calendar);
          const effectiveDate =
            manualDate.getTime() > earliestConstraint.getTime() ? manualDate : earliestConstraint;
          task.startDate = formatDateIso(effectiveDate);
          task.displayStart = formatDisplayDate(effectiveDate);
        } else {
          task.startDate = formatDateIso(earliestConstraint);
          task.displayStart = formatDisplayDate(earliestConstraint);
        }
      } else {
        const candidate = task.manualStartDate || task.startDate;
        const snappedStart = getNextWorkingDay(candidate, calendar);
        task.startDate = formatDateIso(snappedStart);
        task.displayStart = formatDisplayDate(snappedStart);
      }
    } else {
      // Standalone tasks: snap to next working day according to calendar
      const candidate = task.manualStartDate || task.startDate;
      const snappedStart = getNextWorkingDay(candidate, calendar);
      task.startDate = formatDateIso(snappedStart);
      task.displayStart = formatDisplayDate(snappedStart);
    }

    // Calculate endDate from startDate + duration in working days
    if (task.isMilestone || task.duration === 0) {
      task.endDate = task.startDate;
      task.displayEnd = task.displayStart;
    } else {
      const computedEnd = addWorkingDays(task.startDate, task.duration, calendar);
      task.endDate = formatDateIso(computedEnd);
      task.displayEnd = formatDisplayDate(computedEnd);
    }

    if (task.startDate !== origStart || task.endDate !== origEnd) {
      changeCount++;
    }
  }

  // 3. CPM Backward Pass (Late Dates, Total Float, Free Float, Critical Path)
  // Identify the project completion date from the latest finish among all leaf tasks
  let latestProjectFinishDate: Date = new Date("2025-09-01");
  for (const t of leafTasks) {
    if (t.endDate) {
      const d = parseIsoDate(t.endDate);
      if (d.getTime() > latestProjectFinishDate.getTime()) {
        latestProjectFinishDate = d;
      }
    }
  }

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

    const successors = leafSuccessorMap.get(taskId) || [];
    let lateFinishDate: Date;

    if (successors.length === 0) {
      // Terminal activity with no successors: Late Finish is bounded by project completion
      lateFinishDate = new Date(latestProjectFinishDate.getTime());
    } else {
      let earliestLateFinishConstraint: Date | null = null;

      for (const succLink of successors) {
        const succ = taskMap.get(succLink.succId);
        if (!succ || !succ.lateStart || !succ.lateFinish) continue;

        const succLS = parseIsoDate(succ.lateStart);
        const succLF = parseIsoDate(succ.lateFinish);
        let maxAllowedFinish: Date;

        if (succLink.type === "SS") {
          // Successor Late Start constrains Predecessor Late Start
          const maxAllowedStart = shiftByWorkingDays(succLS, -succLink.lag, calendar);
          maxAllowedFinish =
            task.duration > 1
              ? addWorkingDays(maxAllowedStart, task.duration, calendar)
              : maxAllowedStart;
        } else if (succLink.type === "FF") {
          // Successor Late Finish constrains Predecessor Late Finish
          maxAllowedFinish = shiftByWorkingDays(succLF, -succLink.lag, calendar);
        } else if (succLink.type === "SF") {
          // Successor Late Finish constrains Predecessor Late Start
          const maxAllowedStart = shiftByWorkingDays(succLF, -succLink.lag, calendar);
          maxAllowedFinish =
            task.duration > 1
              ? addWorkingDays(maxAllowedStart, task.duration, calendar)
              : maxAllowedStart;
        } else {
          // Finish-to-Start (FS, Default): Predecessor finishes before Successor Late Start - lag - 1 working day
          maxAllowedFinish = shiftByWorkingDays(succLS, -(1 + succLink.lag), calendar);
        }

        if (!earliestLateFinishConstraint || maxAllowedFinish.getTime() < earliestLateFinishConstraint.getTime()) {
          earliestLateFinishConstraint = maxAllowedFinish;
        }
      }

      lateFinishDate = earliestLateFinishConstraint
        ? (earliestLateFinishConstraint.getTime() > latestProjectFinishDate.getTime()
            ? new Date(latestProjectFinishDate.getTime())
            : earliestLateFinishConstraint)
        : new Date(latestProjectFinishDate.getTime());
    }

    // Ensure late finish falls on a working day
    if (!isWorkingDay(lateFinishDate, calendar)) {
      lateFinishDate = getPrevWorkingDay(lateFinishDate, calendar);
    }

    // Calculate Late Start from Late Finish and duration
    let lateStartDate: Date;
    if (task.isMilestone || task.duration <= 1) {
      lateStartDate = new Date(lateFinishDate.getTime());
    } else {
      lateStartDate = shiftByWorkingDays(lateFinishDate, -(task.duration - 1), calendar);
    }

    task.lateStart = formatDateIso(lateStartDate);
    task.lateFinish = formatDateIso(lateFinishDate);

    // Calculate Total Float (working days between Early Start and Late Start)
    const totalFloat = calculateDateVarianceWorkingDays(task.startDate, task.lateStart, calendar);
    task.float = Math.max(0, totalFloat);
    task.isCritical = totalFloat <= 0;

    // Calculate Free Float (slack before delaying ANY successor's early start)
    if (successors.length === 0) {
      task.freeFloat = task.float;
    } else {
      let minSlack = Infinity;

      for (const succLink of successors) {
        const succ = taskMap.get(succLink.succId);
        if (!succ) continue;

        let slack = 0;
        if (succLink.type === "SS") {
          const maxEarlyStart = shiftByWorkingDays(succ.startDate, -succLink.lag, calendar);
          slack = calculateDateVarianceWorkingDays(task.startDate, formatDateIso(maxEarlyStart), calendar);
        } else if (succLink.type === "FF") {
          const maxEarlyFinish = shiftByWorkingDays(succ.endDate, -succLink.lag, calendar);
          slack = calculateDateVarianceWorkingDays(task.endDate, formatDateIso(maxEarlyFinish), calendar);
        } else if (succLink.type === "SF") {
          const maxEarlyStart = shiftByWorkingDays(succ.endDate, -succLink.lag, calendar);
          slack = calculateDateVarianceWorkingDays(task.startDate, formatDateIso(maxEarlyStart), calendar);
        } else {
          // FS
          const maxEarlyFinish = shiftByWorkingDays(succ.startDate, -(1 + succLink.lag), calendar);
          slack = calculateDateVarianceWorkingDays(task.endDate, formatDateIso(maxEarlyFinish), calendar);
        }

        if (slack < minSlack) {
          minSlack = slack;
        }
      }

      task.freeFloat = minSlack === Infinity ? task.float : Math.max(0, Math.min(minSlack, task.float));
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
      let minLateStart: Date | null = null;
      let maxLateFinish: Date | null = null;
      let hasAnyCriticalChild = false;
      let minFloat = Infinity;
      let minFreeFloat = Infinity;

      for (const c of childTasks) {
        if (c.startDate && c.endDate) {
          const cStart = parseIsoDate(c.startDate);
          const cEnd = parseIsoDate(c.endDate);
          if (!minStart || cStart.getTime() < minStart.getTime()) minStart = cStart;
          if (!maxEnd || cEnd.getTime() > maxEnd.getTime()) maxEnd = cEnd;
        }
        if (c.lateStart && c.lateFinish) {
          const cLS = parseIsoDate(c.lateStart);
          const cLF = parseIsoDate(c.lateFinish);
          if (!minLateStart || cLS.getTime() < minLateStart.getTime()) minLateStart = cLS;
          if (!maxLateFinish || cLF.getTime() > maxLateFinish.getTime()) maxLateFinish = cLF;
        }
        if (c.isCritical) hasAnyCriticalChild = true;
        if (typeof c.float === "number" && c.float < minFloat) minFloat = c.float;
        if (typeof c.freeFloat === "number" && c.freeFloat < minFreeFloat) minFreeFloat = c.freeFloat;
      }

      if (minStart && maxEnd) {
        const newStartIso = formatDateIso(minStart);
        const newEndIso = formatDateIso(maxEnd);
        const newDur = countWorkingDays(minStart, maxEnd, calendar);

        if (
          summary.startDate !== newStartIso ||
          summary.endDate !== newEndIso ||
          summary.duration !== newDur ||
          summary.isCritical !== hasAnyCriticalChild ||
          summary.float !== (minFloat === Infinity ? 0 : minFloat)
        ) {
          summary.startDate = newStartIso;
          summary.endDate = newEndIso;
          summary.displayStart = formatDisplayDate(minStart);
          summary.displayEnd = formatDisplayDate(maxEnd);
          summary.duration = newDur;
          summary.isCritical = hasAnyCriticalChild;
          summary.float = minFloat === Infinity ? 0 : minFloat;
          summary.freeFloat = minFreeFloat === Infinity ? 0 : minFreeFloat;
          if (minLateStart) summary.lateStart = formatDateIso(minLateStart);
          if (maxLateFinish) summary.lateFinish = formatDateIso(maxLateFinish);
          changeCount++;
        }
      }
    }
  }

  const allUpdated = Array.from(taskMap.values());

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
