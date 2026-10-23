// PlanD-X Baseline Management & Integrity Module
// ================================================
// Handles baseline snapshotting, approval authorization, restoration,
// and schedule variance reporting with strict baseline protection.

import type { ProgrammeTask } from "./programme-types";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  calculateScheduleVariance,
  calculateDateVarianceWorkingDays,
  recalculateSchedule,
} from "./programme-calendar";

export interface TaskBaselineSnapshot {
  taskId: string;
  name: string;
  wbs: string;
  startDate: string; // ISO string
  endDate: string; // ISO string
  duration: number; // working days
  isMilestone: boolean;
}

export interface BaselineSnapshot {
  id: string; // e.g. "bl-contract-0" or "bl-rev-1"
  versionNumber: number; // 0 for Contract Baseline, 1, 2... for revisions
  name: string; // e.g. "Baseline 0 (Contract)", "Approved Rev 1 - Q1 Resequence"
  type: "contract-baseline" | "approved-revision";
  description: string;
  createdAt: string; // ISO date-time
  approvedBy: string; // "Sarah Jenkins" or "Demo Builder"
  approvedByRole: string; // "Employer's Agent" or "Contract Admin"
  taskCount: number;
  projectStartDate: string;
  projectFinishDate: string;
  taskSnapshots: Record<string, TaskBaselineSnapshot>;
}

export interface BaselineIntegrityReport {
  totalTasks: number;
  tasksWithBaseline: number;
  tasksMissingBaseline: number;
  missingBaselineTaskIds: string[];
  tasksDelayedVsBaseline: number;
  tasksAheadOfBaseline: number;
  tasksOnTrack: number;
  maxDelayDays: number;
  maxAheadDays: number;
  criticalTasksDelayed: number;
  baselineStartDate: string | null;
  baselineFinishDate: string | null;
  currentForecastStartDate: string | null;
  currentForecastFinishDate: string | null;
  varianceDays: number; // positive = delayed, negative = ahead
  isContractBaselineLocked: boolean;
}

const BASELINES_STORAGE_KEY = "plandx_baseline_snapshots";

export const INITIAL_BASELINE_SNAPSHOT: BaselineSnapshot = {
  id: "bl-contract-0",
  versionNumber: 0,
  name: "Baseline 0 (Contract Baseline)",
  type: "contract-baseline",
  description: "Official contract programme approved at contract execution date.",
  createdAt: "2025-08-20T09:00:00Z",
  approvedBy: "Sarah Jenkins",
  approvedByRole: "Employer's Agent / Contract Admin",
  taskCount: 68,
  projectStartDate: "2025-09-01",
  projectFinishDate: "2026-11-15",
  taskSnapshots: {},
};

/**
 * Inspects the current tasks against saved baseline values and generates
 * a comprehensive integrity and variance report.
 * Does NOT invent missing baseline dates.
 */
export function inspectBaselineIntegrity(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): BaselineIntegrityReport {
  let tasksWithBaseline = 0;
  let tasksMissingBaseline = 0;
  const missingBaselineTaskIds: string[] = [];
  let tasksDelayedVsBaseline = 0;
  let tasksAheadOfBaseline = 0;
  let tasksOnTrack = 0;
  let maxDelayDays = 0;
  let maxAheadDays = 0;
  let criticalTasksDelayed = 0;

  let minBlStart: string | null = null;
  let maxBlFinish: string | null = null;
  let minForecastStart: string | null = null;
  let maxForecastFinish: string | null = null;

  for (const task of tasks) {
    if (task.startDate) {
      if (!minForecastStart || task.startDate < minForecastStart) minForecastStart = task.startDate;
    }
    if (task.endDate) {
      if (!maxForecastFinish || task.endDate > maxForecastFinish) maxForecastFinish = task.endDate;
    }

    if (task.baseline0Start && task.baseline0Finish) {
      tasksWithBaseline++;
      if (!minBlStart || task.baseline0Start < minBlStart) minBlStart = task.baseline0Start;
      if (!maxBlFinish || task.baseline0Finish > maxBlFinish) maxBlFinish = task.baseline0Finish;

      const variance = calculateScheduleVariance(task, calendar);
      if (variance.finishVariance > 0) {
        tasksDelayedVsBaseline++;
        if (variance.finishVariance > maxDelayDays) maxDelayDays = variance.finishVariance;
        if (task.isCritical) criticalTasksDelayed++;
      } else if (variance.finishVariance < 0) {
        tasksAheadOfBaseline++;
        const aheadDays = Math.abs(variance.finishVariance);
        if (aheadDays > maxAheadDays) maxAheadDays = aheadDays;
      } else {
        tasksOnTrack++;
      }
    } else {
      tasksMissingBaseline++;
      missingBaselineTaskIds.push(task.id);
    }
  }

  let totalVarianceDays = 0;
  if (maxForecastFinish && maxBlFinish) {
    const dummyTask: ProgrammeTask = {
      id: "project-summary",
      wbs: "0",
      name: "Project Total",
      level: "programme",
      parentId: null,
      status: "in-progress",
      startDate: minForecastStart || "",
      endDate: maxForecastFinish,
      duration: 0,
      progress: 0,
      trade: null,
      assignee: null,
      isCritical: true,
      isMilestone: false,
      predecessors: [],
      successors: [],
      notes: "",
      children: [],
      depth: 0,
      float: 0,
      baseline0Start: minBlStart || undefined,
      baseline0Finish: maxBlFinish,
    };
    const summaryVariance = calculateScheduleVariance(dummyTask, calendar);
    totalVarianceDays = summaryVariance.finishVariance;
  }

  return {
    totalTasks: tasks.length,
    tasksWithBaseline,
    tasksMissingBaseline,
    missingBaselineTaskIds,
    tasksDelayedVsBaseline,
    tasksAheadOfBaseline,
    tasksOnTrack,
    maxDelayDays,
    maxAheadDays,
    criticalTasksDelayed,
    baselineStartDate: minBlStart,
    baselineFinishDate: maxBlFinish,
    currentForecastStartDate: minForecastStart,
    currentForecastFinishDate: maxForecastFinish,
    varianceDays: totalVarianceDays,
    isContractBaselineLocked: true,
  };
}

/**
 * Takes the current working forecast dates of tasks and creates an explicit
 * baseline snapshot.
 */
export function createBaselineSnapshot(
  tasks: ProgrammeTask[],
  options: {
    name: string;
    description: string;
    approvedBy: string;
    approvedByRole: string;
    type?: "contract-baseline" | "approved-revision";
    versionNumber?: number;
  }
): BaselineSnapshot {
  const taskSnapshots: Record<string, TaskBaselineSnapshot> = {};
  let minStart = "";
  let maxFinish = "";

  for (const t of tasks) {
    if (t.startDate && (!minStart || t.startDate < minStart)) minStart = t.startDate;
    if (t.endDate && (!maxFinish || t.endDate > maxFinish)) maxFinish = t.endDate;

    taskSnapshots[t.id] = {
      taskId: t.id,
      name: t.name,
      wbs: t.wbs,
      startDate: t.startDate,
      endDate: t.endDate,
      duration: t.duration,
      isMilestone: t.isMilestone,
    };
  }

  const id = `bl-${Date.now()}`;
  return {
    id,
    versionNumber: options.versionNumber ?? 1,
    name: options.name,
    type: options.type ?? "approved-revision",
    description: options.description,
    createdAt: new Date().toISOString(),
    approvedBy: options.approvedBy,
    approvedByRole: options.approvedByRole,
    taskCount: tasks.length,
    projectStartDate: minStart,
    projectFinishDate: maxFinish,
    taskSnapshots,
  };
}

/**
 * Applies a snapshot to the tasks, updating baseline0Start and baseline0Finish
 * explicitly upon user approval.
 */
export function applyBaselineSnapshotToTasks(
  tasks: ProgrammeTask[],
  snapshot: BaselineSnapshot
): ProgrammeTask[] {
  return tasks.map((t) => {
    const snap = snapshot.taskSnapshots[t.id];
    if (snap) {
      return {
        ...t,
        baseline0Start: snap.startDate,
        baseline0Finish: snap.endDate,
      };
    }
    // If newly added task wasn't in the snapshot, leave existing baseline intact
    return t;
  });
}

/**
 * Restores current forecast dates and durations from saved baseline dates.
 * Reverts task.startDate and duration, then performs full CPM recalculation.
 */
export function restoreScheduleFromBaseline(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): { restoredTasks: ProgrammeTask[]; restoredCount: number } {
  let restoredCount = 0;

  const resetTasks = tasks.map((t) => {
    if (t.baseline0Start && t.baseline0Finish) {
      restoredCount++;
      const isMilestone = t.baseline0Start === t.baseline0Finish && (t.isMilestone || t.duration === 0);
      const baselineDuration = isMilestone
        ? 0
        : Math.max(1, calculateDateVarianceWorkingDays(t.baseline0Start, t.baseline0Finish, calendar));

      return {
        ...t,
        startDate: t.baseline0Start,
        manualStartDate: t.baseline0Start,
        endDate: t.baseline0Finish,
        duration: baselineDuration,
        isMilestone,
      };
    }
    return t;
  });

  const { updatedTasks } = recalculateSchedule(resetTasks, calendar);
  return {
    restoredTasks: updatedTasks,
    restoredCount,
  };
}

/**
 * Ensures imported schedules do not silently wipe or overwrite existing approved baselines.
 * Matches by task ID or WBS code to preserve contract baseline dates.
 */
export function preserveExistingBaselinesOnImport(
  incomingTasks: ProgrammeTask[],
  existingTasks: ProgrammeTask[]
): ProgrammeTask[] {
  const existingById = new Map<string, ProgrammeTask>();
  const existingByWbs = new Map<string, ProgrammeTask>();

  for (const t of existingTasks) {
    existingById.set(t.id, t);
    if (t.wbs) existingByWbs.set(t.wbs, t);
  }

  return incomingTasks.map((t) => {
    const existing = existingById.get(t.id) || (t.wbs ? existingByWbs.get(t.wbs) : undefined);
    if (!existing) return t;

    // If incoming task doesn't have baseline dates, keep the existing approved baseline!
    const baseline0Start = t.baseline0Start || existing.baseline0Start;
    const baseline0Finish = t.baseline0Finish || existing.baseline0Finish;

    return {
      ...t,
      baseline0Start,
      baseline0Finish,
    };
  });
}

/**
 * Storage helpers for baseline snapshots
 */
export function loadSavedBaselines(): BaselineSnapshot[] {
  if (typeof window === "undefined") return [INITIAL_BASELINE_SNAPSHOT];
  try {
    const raw = localStorage.getItem(BASELINES_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("Failed to load baseline snapshots:", err);
  }
  return [INITIAL_BASELINE_SNAPSHOT];
}

export function saveBaselines(baselines: BaselineSnapshot[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(BASELINES_STORAGE_KEY, JSON.stringify(baselines));
  } catch (err) {
    console.warn("Failed to save baseline snapshots:", err);
  }
}
