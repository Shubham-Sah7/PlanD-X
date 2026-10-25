/**
 * PlanD-X Programme Validation Engine
 * 
 * Validates schedule data before saving or committing imports.
 * Enforces CPM integrity, prevents duplicate IDs, validates dates and dependencies,
 * and ensures data consistency before persisting to the database.
 */

import { type ProgrammeTask, type TaskResourceAssignment } from "./programme-types";
import { type ProjectCalendar } from "./programme-calendar";
import { type BaselineSnapshot } from "./programme-baseline";

export interface ValidationError {
  field: string;
  code: string;
  message: string;
  taskId?: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: {
    totalTasks: number;
    totalDependencies: number;
    totalAssignments: number;
  };
}

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates an entire programme payload before persisting to disk/database.
 */
export function validateProgrammePayload(payload: {
  tasks: unknown;
  calendar?: unknown;
  assignments?: unknown;
  baselines?: unknown;
  settings?: unknown;
  expectedVersion?: unknown;
}): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // 1. Tasks array validation
  if (!Array.isArray(payload.tasks)) {
    errors.push({
      field: "tasks",
      code: "INVALID_TASKS_TYPE",
      message: "Payload tasks must be an array.",
      severity: "error",
    });
    return {
      valid: false,
      errors,
      warnings,
      stats: { totalTasks: 0, totalDependencies: 0, totalAssignments: 0 },
    };
  }

  const tasks = payload.tasks as ProgrammeTask[];
  const taskMap = new Map<string, ProgrammeTask>();
  const duplicateIds = new Set<string>();
  let totalDependencies = 0;

  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const prefix = `tasks[${i}]`;

    // Task ID
    if (!task.id || typeof task.id !== "string" || task.id.trim() === "") {
      errors.push({
        field: `${prefix}.id`,
        code: "EMPTY_TASK_ID",
        message: `Task at index ${i} has an empty or invalid ID.`,
        severity: "error",
      });
      continue;
    }

    if (taskMap.has(task.id)) {
      duplicateIds.add(task.id);
      errors.push({
        field: `${prefix}.id`,
        code: "DUPLICATE_TASK_ID",
        message: `Duplicate task ID detected: '${task.id}'. Task IDs must be globally unique within a programme.`,
        taskId: task.id,
        severity: "error",
      });
    } else {
      taskMap.set(task.id, task);
    }

    // Task Name
    if (!task.name || typeof task.name !== "string" || task.name.trim() === "") {
      errors.push({
        field: `${prefix}.name`,
        code: "EMPTY_TASK_NAME",
        message: `Task '${task.id}' has an empty or blank name.`,
        taskId: task.id,
        severity: "error",
      });
    }

    // Start Date
    if (!task.startDate || !ISO_DATE_REGEX.test(task.startDate)) {
      errors.push({
        field: `${prefix}.startDate`,
        code: "INVALID_START_DATE",
        message: `Task '${task.id}' has an invalid start date format '${task.startDate}'. Expected YYYY-MM-DD.`,
        taskId: task.id,
        severity: "error",
      });
    }

    // Finish Date
    const finishDate = (task as any).endDate || (task as any).finishDate;
    if (!finishDate || !ISO_DATE_REGEX.test(finishDate)) {
      errors.push({
        field: `${prefix}.endDate`,
        code: "INVALID_FINISH_DATE",
        message: `Task '${task.id}' has an invalid finish date format '${finishDate}'. Expected YYYY-MM-DD.`,
        taskId: task.id,
        severity: "error",
      });
    }

    // Date chronology
    if (
      task.startDate &&
      finishDate &&
      ISO_DATE_REGEX.test(task.startDate) &&
      ISO_DATE_REGEX.test(finishDate)
    ) {
      if (finishDate < task.startDate) {
        errors.push({
          field: `${prefix}.dates`,
          code: "INVERTED_DATES",
          message: `Task '${task.id}' finish date (${finishDate}) cannot precede start date (${task.startDate}).`,
          taskId: task.id,
          severity: "error",
        });
      }
    }

    // Duration
    if (typeof task.duration !== "number" || isNaN(task.duration) || task.duration < 0) {
      errors.push({
        field: `${prefix}.duration`,
        code: "INVALID_DURATION",
        message: `Task '${task.id}' duration must be a non-negative number. Got '${task.duration}'.`,
        taskId: task.id,
        severity: "error",
      });
    }

    // Progress
    if (typeof task.progress === "number") {
      if (task.progress < 0 || task.progress > 100) {
        errors.push({
          field: `${prefix}.progress`,
          code: "PROGRESS_OUT_OF_RANGE",
          message: `Task '${task.id}' progress must be between 0 and 100%. Got ${task.progress}%.`,
          taskId: task.id,
          severity: "error",
        });
      }
    }

    // Count predecessors
    if (Array.isArray(task.predecessors)) {
      totalDependencies += task.predecessors.length;
    }
  }

  // 2. Predecessor reference and cycle checks
  const adj = new Map<string, string[]>();
  for (const task of tasks) {
    if (!task.id) continue;
    adj.set(task.id, []);

    if (Array.isArray(task.predecessors)) {
      for (const pred of task.predecessors) {
        const predId = typeof pred === "string" ? pred : (pred as any)?.id;
        if (!predId) continue;

        if (!taskMap.has(predId)) {
          errors.push({
            field: `tasks[${task.id}].predecessors`,
            code: "BROKEN_PREDECESSOR_LINK",
            message: `Task '${task.name}' references non-existent predecessor ID '${predId}'.`,
            taskId: task.id,
            severity: "error",
          });
        } else {
          adj.get(task.id)!.push(predId);
        }
      }
    }
  }

  // Check for circular dependency loops
  const visited = new Map<string, 0 | 1 | 2>(); // 0: unvisited, 1: visiting, 2: visited
  function hasCycle(nodeId: string, path: string[]): boolean {
    visited.set(nodeId, 1);
    path.push(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      const state = visited.get(neighbor) || 0;
      if (state === 1) {
        const loopStartIndex = path.indexOf(neighbor);
        const cyclePath = path.slice(loopStartIndex).concat(neighbor);
        const cycleNames = cyclePath.map((id) => taskMap.get(id)?.name || id).join(" ➔ ");
        errors.push({
          field: "dependencies",
          code: "CIRCULAR_DEPENDENCY",
          message: `Circular dependency detected: ${cycleNames}. Cyclic schedules cannot be resolved.`,
          taskId: nodeId,
          severity: "error",
        });
        return true;
      }
      if (state === 0 && hasCycle(neighbor, path)) {
        return true;
      }
    }

    path.pop();
    visited.set(nodeId, 2);
    return false;
  }

  for (const task of tasks) {
    if ((visited.get(task.id) || 0) === 0) {
      hasCycle(task.id, []);
    }
  }

  // 3. Calendar validation
  if (payload.calendar && typeof payload.calendar === "object") {
    const cal = payload.calendar as Partial<ProjectCalendar>;
    if (cal.workingDays && (!Array.isArray(cal.workingDays) || cal.workingDays.length === 0)) {
      warnings.push({
        field: "calendar.workingDays",
        code: "EMPTY_WORKING_DAYS",
        message: "Project calendar has no active working days configured.",
        severity: "warning",
      });
    }
    if (typeof cal.workingHoursPerDay === "number" && (cal.workingHoursPerDay <= 0 || cal.workingHoursPerDay > 24)) {
      errors.push({
        field: "calendar.workingHoursPerDay",
        code: "INVALID_CALENDAR_HOURS",
        message: `Calendar working hours per day must be between 1 and 24. Got ${cal.workingHoursPerDay}.`,
        severity: "error",
      });
    }
  }

  // 4. Assignments validation
  let totalAssignments = 0;
  if (payload.assignments && typeof payload.assignments === "object") {
    const assignmentsMap = payload.assignments as Record<string, TaskResourceAssignment[]>;
    for (const [taskId, list] of Object.entries(assignmentsMap)) {
      if (!taskMap.has(taskId)) {
        warnings.push({
          field: `assignments[${taskId}]`,
          code: "ORPHANED_ASSIGNMENT",
          message: `Resource assignments reference unknown task ID '${taskId}'.`,
          taskId,
          severity: "warning",
        });
      }
      if (Array.isArray(list)) {
        totalAssignments += list.length;
        for (const assign of list) {
          if (!assign.resourceId) {
            errors.push({
              field: `assignments[${taskId}].resourceId`,
              code: "MISSING_RESOURCE_ID",
              message: `Assignment on task '${taskId}' is missing a resourceId.`,
              taskId,
              severity: "error",
            });
          }
          if (typeof assign.units === "number" && assign.units <= 0) {
            errors.push({
              field: `assignments[${taskId}].units`,
              code: "INVALID_ASSIGNMENT_UNITS",
              message: `Assignment units must be greater than zero. Got ${assign.units}.`,
              taskId,
              severity: "error",
            });
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    stats: {
      totalTasks: tasks.length,
      totalDependencies,
      totalAssignments,
    },
  };
}
