// PlanD-X Resource Allocation & Schedule Levelling Engine
// ==========================================================
// Identifies trade/resource contention, performs non-destructive levelling simulation,
// previews schedule impact, and preserves approved contractual baselines.

import type { ProgrammeTask, ProjectResource } from "./programme-types";
import {
  ProjectCalendar,
  recalculateSchedule,
  addWorkingDays,
  getNextWorkingDay,
  formatDateIso,
  parseIsoDate,
  calculateResourceWorkloads,
  countWorkingDays,
} from "./programme-calendar";

export interface ResourceLevelingChange {
  taskId: string;
  taskName: string;
  wbs: string;
  resourceName: string;
  originalStartDate: string;
  originalEndDate: string;
  proposedStartDate: string;
  proposedEndDate: string;
  shiftWorkingDays: number;
  totalFloatBefore: number;
  totalFloatAfter: number;
  wasCritical: boolean;
}

export interface ResourceLevelingPreview {
  hasOverallocations: boolean;
  totalOverallocatedDays: number;
  competingResourcesCount: number;
  affectedTasksCount: number;
  projectCompletionBefore: string;
  projectCompletionAfter: string;
  projectSlipWorkingDays: number;
  changes: ResourceLevelingChange[];
  impactedMilestones: Array<{
    id: string;
    name: string;
    originalDate: string;
    proposedDate: string;
    slipWorkingDays: number;
  }>;
  leveledTasks: ProgrammeTask[];
  baselineProtected: boolean;
  generatedAt: string;
}

/**
 * Simulates resource levelling across the programme:
 * Prioritizes critical path and low-float tasks; defers flexible non-critical tasks
 * to resolve resource allocation conflicts without corrupting contractual baselines.
 */
export function simulateResourceLeveling(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar,
  projectResources?: ProjectResource[]
): ResourceLevelingPreview {
  // First evaluate current workloads
  const workloadData = calculateResourceWorkloads(tasks, calendar, projectResources);
  const overallocatedTaskIds = workloadData.overallocatedTaskIds;

  let projectCompletionBefore = "0000-01-01";
  for (const t of tasks) {
    if (t.endDate && t.endDate > projectCompletionBefore) {
      projectCompletionBefore = t.endDate;
    }
  }

  if (overallocatedTaskIds.size === 0) {
    return {
      hasOverallocations: false,
      totalOverallocatedDays: 0,
      competingResourcesCount: 0,
      affectedTasksCount: 0,
      projectCompletionBefore,
      projectCompletionAfter: projectCompletionBefore,
      projectSlipWorkingDays: 0,
      changes: [],
      impactedMilestones: [],
      leveledTasks: tasks.map((t) => ({ ...t })),
      baselineProtected: true,
      generatedAt: new Date().toISOString(),
    };
  }

  // Deep clone tasks for simulation
  const workingTasks: ProgrammeTask[] = tasks.map((t) => ({
    ...t,
    // Preserve baseline fields strictly
    baseline0Start: t.baseline0Start,
    baseline0Finish: t.baseline0Finish,
    baseline0Duration: t.baseline0Duration,
    baseline0Cost: t.baseline0Cost,
    baseline0Work: t.baseline0Work,
    baselineSlots: t.baselineSlots ? JSON.parse(JSON.stringify(t.baselineSlots)) : undefined,
  }));

  const changes: ResourceLevelingChange[] = [];

  // Group leaf tasks by assigned resource
  const resourceGroups = new Map<string, ProgrammeTask[]>();
  for (const t of workingTasks) {
    if (t.level === "phase" || t.level === "programme" || (t.children && t.children.length > 0)) {
      continue;
    }

    if (t.assignments && t.assignments.length > 0) {
      for (const a of t.assignments) {
        const key = a.resourceName || a.resourceId;
        if (key && t.startDate && t.endDate) {
          const list = resourceGroups.get(key) || [];
          if (!list.some((existing) => existing.id === t.id)) {
            list.push(t);
          }
          resourceGroups.set(key, list);
        }
      }
    } else {
      const resName =
        (typeof t.assignee === "string" ? t.assignee : (t.assignee as any)?.name) ||
        t.byWhom ||
        (typeof t.trade === "string" ? t.trade : t.tradeText);

      if (resName && t.startDate && t.endDate) {
        const list = resourceGroups.get(resName) || [];
        list.push(t);
        resourceGroups.set(resName, list);
      }
    }
  }

  let conflictsResolved = 0;

  for (const [resName, groupTasks] of resourceGroups.entries()) {
    if (groupTasks.length < 2) continue;

    // Check capacity for this resource if available
    const matchedRes = projectResources?.find(
      (r) =>
        r.id === resName ||
        r.name.toLowerCase() === resName.toLowerCase() ||
        r.initials.toLowerCase() === resName.toLowerCase()
    );
    const capacityUnits = matchedRes?.maxUnits ?? 1.0;

    // Sort tasks by scheduling priority:
    // 1. Critical tasks first (float <= 0)
    // 2. Lower total float first
    // 3. Earlier start date
    groupTasks.sort((a, b) => {
      const aCrit = a.isCritical || (typeof a.float === "number" && a.float <= 0);
      const bCrit = b.isCritical || (typeof b.float === "number" && b.float <= 0);
      if (aCrit && !bCrit) return -1;
      if (!aCrit && bCrit) return 1;

      const aFloat = typeof a.float === "number" ? a.float : 999;
      const bFloat = typeof b.float === "number" ? b.float : 999;
      if (aFloat !== bFloat) return aFloat - bFloat;

      return (a.startDate || "").localeCompare(b.startDate || "");
    });

    // Check overlaps between sequential tasks assigned to same resource
    for (let i = 0; i < groupTasks.length - 1; i++) {
      const primary = groupTasks[i];
      const secondary = groupTasks[i + 1];

      // If neither is in overallocatedTaskIds and capacity > 1.0, they can co-exist
      if (capacityUnits > 1.0 && !overallocatedTaskIds.has(primary.id) && !overallocatedTaskIds.has(secondary.id)) {
        continue;
      }

      // Check if primary and secondary overlap
      if (secondary.startDate <= primary.endDate) {
        // Shift secondary task start date to the next working day after primary.endDate
        const nextDay = getNextWorkingDay(
          new Date(parseIsoDate(primary.endDate).getTime() + 24 * 60 * 60 * 1000),
          calendar
        );
        const newStartDate = formatDateIso(nextDay);

        if (newStartDate > secondary.startDate) {
          const shiftDays = countWorkingDays(secondary.startDate, newStartDate, calendar) - 1;
          const origStart = secondary.startDate;
          const origEnd = secondary.endDate;

          secondary.startDate = newStartDate;
          secondary.manualStartDate = newStartDate;

          // Recompute secondary finish date
          const newEnd = addWorkingDays(newStartDate, secondary.duration || 1, calendar);
          secondary.endDate = formatDateIso(newEnd);

          changes.push({
            taskId: secondary.id,
            taskName: secondary.name,
            wbs: secondary.wbs,
            resourceName: resName,
            originalStartDate: origStart,
            originalEndDate: origEnd,
            proposedStartDate: newStartDate,
            proposedEndDate: secondary.endDate,
            shiftWorkingDays: Math.max(1, shiftDays),
            totalFloatBefore: secondary.float ?? 0,
            totalFloatAfter: Math.max(0, (secondary.float ?? 0) - shiftDays),
            wasCritical: secondary.isCritical ?? false,
          });

          conflictsResolved++;
        }
      }
    }
  }

  // Recalculate schedule cascade for all downstream successors
  const recalcResult = recalculateSchedule(workingTasks, calendar);
  const leveledTasks = recalcResult.updatedTasks;

  let projectCompletionAfter = "0000-01-01";
  for (const t of leveledTasks) {
    if (t.endDate && t.endDate > projectCompletionAfter) {
      projectCompletionAfter = t.endDate;
    }
  }

  const projectSlipWorkingDays =
    projectCompletionAfter > projectCompletionBefore
      ? countWorkingDays(projectCompletionBefore, projectCompletionAfter, calendar) - 1
      : 0;

  // Track impacted milestones
  const impactedMilestones: Array<{
    id: string;
    name: string;
    originalDate: string;
    proposedDate: string;
    slipWorkingDays: number;
  }> = [];

  const originalTaskMap = new Map(tasks.map((t) => [t.id, t]));
  for (const lt of leveledTasks) {
    if (lt.isMilestone || lt.duration === 0) {
      const orig = originalTaskMap.get(lt.id);
      if (orig && lt.endDate && orig.endDate && lt.endDate !== orig.endDate) {
        const slip =
          lt.endDate > orig.endDate
            ? countWorkingDays(orig.endDate, lt.endDate, calendar) - 1
            : -(countWorkingDays(lt.endDate, orig.endDate, calendar) - 1);
        impactedMilestones.push({
          id: lt.id,
          name: lt.name,
          originalDate: orig.endDate,
          proposedDate: lt.endDate,
          slipWorkingDays: slip,
        });
      }
    }
  }

  return {
    hasOverallocations: true,
    totalOverallocatedDays: workloadData.resourceSummaries.reduce(
      (sum, r) => sum + r.overallocatedDaysCount,
      0
    ),
    competingResourcesCount: resourceGroups.size,
    affectedTasksCount: changes.length,
    projectCompletionBefore,
    projectCompletionAfter,
    projectSlipWorkingDays: Math.max(0, projectSlipWorkingDays),
    changes,
    impactedMilestones,
    leveledTasks,
    baselineProtected: true, // Baseline 0 is strictly untouched
    generatedAt: new Date().toISOString(),
  };
}
