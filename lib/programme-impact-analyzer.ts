/**
 * PlanD-X Proactive Schedule Change Impact Simulator
 * ==================================================
 * Simulates downstream ripples, float consumption, project finish shift,
 * and cost impacts of proposed schedule modifications before committing.
 */

import type { ProgrammeTask, DependencyType } from "./programme-types";
import {
  type ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  recalculateSchedule,
  formatDateIso,
  parseIsoDate,
  addWorkingDays,
} from "./programme-calendar";

export interface ProposedTaskChange {
  taskId: string;
  newDuration?: number;
  newStartDate?: string;
  newLag?: number;
  addedPredecessorId?: string;
  predecessorType?: DependencyType;
  newCalendarId?: string;
}

export interface DownstreamImpactedTask {
  id: string;
  wbs: string;
  name: string;
  currentFinish: string;
  projectedFinish: string;
  varianceDays: number;
  isMilestone: boolean;
  wasCritical: boolean;
  isNowCritical: boolean;
}

export interface ScheduleImpactAnalysis {
  taskId: string;
  taskName: string;
  wbs: string;
  currentProjectFinish: string;
  projectedProjectFinish: string;
  netProjectDelayDays: number;
  isFloatConsumedWithoutSlip: boolean;
  consumedFloatDays: number;
  affectedTasksCount: number;
  impactedTasks: DownstreamImpactedTask[];
  criticalPathChanged: boolean;
  estimatedCostDelta: number;
  riskSeverity: "negligible" | "moderate" | "critical";
  summaryMessage: string;
}

export function simulateScheduleChangeImpact(
  tasks: ProgrammeTask[],
  change: ProposedTaskChange,
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): ScheduleImpactAnalysis {
  const target = tasks.find((t) => t.id === change.taskId);
  if (!target) {
    throw new Error(`Task with id '${change.taskId}' not found`);
  }

  // 1. Current baseline metrics
  const originalResult = recalculateSchedule(tasks, calendar);
  const currentProjectFinish = originalResult.projectEndDate || target.endDate;

  // 2. Clone tasks and apply proposed change
  const simulatedTasks: ProgrammeTask[] = tasks.map((t) => {
    if (t.id === change.taskId) {
      const cloned = { ...t };
      if (change.newDuration !== undefined) {
        cloned.duration = Math.max(0, change.newDuration);
        cloned.endDate = cloned.duration === 0 ? cloned.startDate : formatDateIso(addWorkingDays(cloned.startDate, cloned.duration, calendar));
      }
      if (change.newStartDate) {
        cloned.startDate = change.newStartDate;
        cloned.endDate = cloned.duration === 0 ? cloned.startDate : formatDateIso(addWorkingDays(cloned.startDate, cloned.duration, calendar));
      }
      if (change.addedPredecessorId) {
        cloned.predecessors = Array.from(new Set([...(cloned.predecessors || []), change.addedPredecessorId]));
        cloned.predecessorDetails = [
          ...(cloned.predecessorDetails || []).filter((d) => d.id !== change.addedPredecessorId),
          {
            id: change.addedPredecessorId,
            type: change.predecessorType || "FS",
            lag: change.newLag || 0,
          },
        ];
      }
      return cloned;
    }
    return { ...t };
  });

  // 3. Recalculate simulated schedule
  const simulatedResult = recalculateSchedule(simulatedTasks, calendar);
  const projectedProjectFinish = simulatedResult.projectEndDate || currentProjectFinish;

  // 4. Compute date difference
  const origFinishMs = new Date(currentProjectFinish).getTime();
  const projFinishMs = new Date(projectedProjectFinish).getTime();
  const msPerDay = 1000 * 60 * 60 * 24;
  const netProjectDelayDays = Math.round((projFinishMs - origFinishMs) / msPerDay);

  // 5. Identify impacted downstream activities
  const impactedTasks: DownstreamImpactedTask[] = [];
  const origMap = new Map<string, ProgrammeTask>();
  for (const t of originalResult.updatedTasks) {
    origMap.set(t.id, t);
  }

  for (const simTask of simulatedResult.updatedTasks) {
    if (simTask.id === change.taskId) continue;
    const orig = origMap.get(simTask.id);
    if (!orig) continue;

    if (simTask.endDate !== orig.endDate || simTask.startDate !== orig.startDate) {
      const pushMs = new Date(simTask.endDate).getTime() - new Date(orig.endDate).getTime();
      const pushDays = Math.round(pushMs / msPerDay);

      impactedTasks.push({
        id: simTask.id,
        wbs: simTask.wbs,
        name: simTask.name,
        currentFinish: orig.endDate,
        projectedFinish: simTask.endDate,
        varianceDays: pushDays,
        isMilestone: simTask.isMilestone,
        wasCritical: orig.isCritical,
        isNowCritical: simTask.isCritical,
      });
    }
  }

  const initialFloat = target.float || 0;
  const isFloatConsumedWithoutSlip = netProjectDelayDays === 0 && (change.newDuration || 0) > target.duration;
  const consumedFloatDays = Math.min(initialFloat, Math.max(0, (change.newDuration || target.duration) - target.duration));

  // Cost variance estimation (assume avg daily contractor burn rate based on task cost)
  const durationDelta = (change.newDuration !== undefined) ? change.newDuration - target.duration : 0;
  const dailyRate = target.duration > 0 && target.cost ? Math.round(target.cost / target.duration) : 750;
  const estimatedCostDelta = durationDelta * dailyRate;

  // Risk categorization
  let riskSeverity: "negligible" | "moderate" | "critical" = "negligible";
  if (netProjectDelayDays > 0 || impactedTasks.some((t) => t.isMilestone && t.varianceDays > 0)) {
    riskSeverity = "critical";
  } else if (impactedTasks.length > 0 || consumedFloatDays > 3) {
    riskSeverity = "moderate";
  }

  let summaryMessage = "Proposed modification is within total float buffer with zero delay to project completion.";
  if (netProjectDelayDays > 0) {
    summaryMessage = `Critical Delay: Proposed change delays project completion by ${netProjectDelayDays} working day(s).`;
  } else if (impactedTasks.length > 0) {
    summaryMessage = `Absorbed: Consumes ${consumedFloatDays}d of float and shifts ${impactedTasks.length} downstream activity dates without slipping project completion.`;
  }

  return {
    taskId: target.id,
    taskName: target.name,
    wbs: target.wbs,
    currentProjectFinish,
    projectedProjectFinish,
    netProjectDelayDays,
    isFloatConsumedWithoutSlip,
    consumedFloatDays,
    affectedTasksCount: impactedTasks.length,
    impactedTasks,
    criticalPathChanged: simulatedResult.criticalTaskCount !== originalResult.criticalTaskCount,
    estimatedCostDelta,
    riskSeverity,
    summaryMessage,
  };
}
