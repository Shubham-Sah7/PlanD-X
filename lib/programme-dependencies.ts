import {
  type DependencyType,
  type DependencyDetail,
  type ProgrammeTask,
} from "./programme-types";

export type { DependencyType };
import {
  type ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  recalculateSchedule,
  formatDisplayDate,
  parseIsoDate,
  formatDateIso,
} from "./programme-calendar";

// ─── Dependency Type Metadata ─────────────────────────────────

export interface DependencyTypeOption {
  type: DependencyType;
  name: string;
  badge: string;
  explanation: string;
  formula: string;
}

export const DEPENDENCY_TYPE_OPTIONS: DependencyTypeOption[] = [
  {
    type: "FS",
    name: "Finish-to-Start (FS)",
    badge: "FS",
    explanation: "Successor starts after predecessor finishes (Standard construction handover)",
    formula: "Successor Start = Predecessor Finish + Lag",
  },
  {
    type: "SS",
    name: "Start-to-Start (SS)",
    badge: "SS",
    explanation: "Successor starts in relation to predecessor start (Parallel activities)",
    formula: "Successor Start = Predecessor Start + Lag",
  },
  {
    type: "FF",
    name: "Finish-to-Finish (FF)",
    badge: "FF",
    explanation: "Successor finishes in relation to predecessor finish (Simultaneous completion)",
    formula: "Successor Finish = Predecessor Finish + Lag",
  },
  {
    type: "SF",
    name: "Start-to-Finish (SF)",
    badge: "SF",
    explanation: "Successor finishes in relation to predecessor start (Just-in-time handoff)",
    formula: "Successor Finish = Predecessor Start + Lag",
  },
];

export function getDependencyTypeOption(type: DependencyType): DependencyTypeOption {
  return (
    DEPENDENCY_TYPE_OPTIONS.find((opt) => opt.type === type) ||
    DEPENDENCY_TYPE_OPTIONS[0]
  );
}

export function formatDependencyRelation(
  type: DependencyType = "FS",
  lag: number = 0,
  isPredecessor: boolean = true
): string {
  const typeOption = getDependencyTypeOption(type);
  let lagText = "0 working days lag";
  if (lag > 0) {
    lagText = `+${lag} ${lag === 1 ? "working day" : "working days"} lag`;
  } else if (lag < 0) {
    lagText = `${lag} ${lag === -1 ? "working day" : "working days"} lead`;
  }

  const direction = isPredecessor ? "Predecessor" : "Successor";
  return `${typeOption.name} · ${lagText}`;
}

// ─── Dependency Extraction ────────────────────────────────────

export interface ExtractedDependency {
  id: string; // Predecessor ID
  name?: string;
  type: DependencyType;
  lag: number; // working days
}

export function getTaskPredecessorLinks(task: ProgrammeTask): ExtractedDependency[] {
  const result: ExtractedDependency[] = [];
  const seen = new Set<string>();

  if (task.predecessorDetails && task.predecessorDetails.length > 0) {
    for (const d of task.predecessorDetails) {
      if (d.id && !seen.has(d.id)) {
        seen.add(d.id);
        result.push({
          id: d.id,
          name: d.name,
          type: d.type || "FS",
          lag: typeof d.lag === "number" ? d.lag : 0,
        });
      }
    }
  }

  if (task.predecessors && task.predecessors.length > 0) {
    for (const predId of task.predecessors) {
      if (predId && !seen.has(predId)) {
        seen.add(predId);
        result.push({
          id: predId,
          type: "FS",
          lag: 0,
        });
      }
    }
  }

  return result;
}

// ─── Circular Dependency & Validation ─────────────────────────

export function wouldCreateCircularDependency(
  tasks: ProgrammeTask[],
  predId: string, // predecessor
  succId: string  // successor
): boolean {
  if (predId === succId) return true;

  // Build graph of existing successor dependencies
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, []);
  }

  for (const t of tasks) {
    const preds = getTaskPredecessorLinks(t);
    for (const p of preds) {
      if (adj.has(p.id)) {
        adj.get(p.id)!.push(t.id);
      }
    }
  }

  // BFS search starting from succId to see if predId is reachable
  const visited = new Set<string>();
  const queue = [succId];
  visited.add(succId);

  while (queue.length > 0) {
    const curr = queue.shift()!;
    if (curr === predId) {
      return true; // Cycle detected: succId leads back to predId!
    }
    for (const neighbor of adj.get(curr) || []) {
      if (!visited.has(neighbor)) {
        visited.add(neighbor);
        queue.push(neighbor);
      }
    }
  }

  return false;
}

export function validateDependency(
  tasks: ProgrammeTask[],
  predId: string,
  succId: string,
  type: DependencyType,
  lag: number
): { valid: boolean; error?: string } {
  if (!predId || !succId) {
    return { valid: false, error: "Both predecessor and successor tasks must be selected." };
  }

  if (predId === succId) {
    return { valid: false, error: "A task cannot depend on itself." };
  }

  const predTask = tasks.find((t) => t.id === predId);
  const succTask = tasks.find((t) => t.id === succId);

  if (!predTask) {
    return { valid: false, error: `Predecessor task '${predId}' not found.` };
  }

  if (!succTask) {
    return { valid: false, error: `Successor task '${succId}' not found.` };
  }

  if (isNaN(lag)) {
    return { valid: false, error: "Lag / lead must be a valid number of working days." };
  }

  if (wouldCreateCircularDependency(tasks, predId, succId)) {
    return {
      valid: false,
      error: `Circular dependency detected: Linking '${predTask.name}' → '${succTask.name}' creates an infinite scheduling loop.`,
    };
  }

  return { valid: true };
}

// ─── Dependency State Operations ──────────────────────────────

export function linkTasks(
  tasks: ProgrammeTask[],
  predId: string,
  succId: string,
  type: DependencyType = "FS",
  lag: number = 0,
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): { updatedTasks: ProgrammeTask[]; changeCount: number } {
  const predTask = tasks.find((t) => t.id === predId);
  const succTask = tasks.find((t) => t.id === succId);

  if (!predTask || !succTask) {
    return { updatedTasks: tasks, changeCount: 0 };
  }

  // Update tasks array
  const updatedTasks = tasks.map((task) => {
    // 1. Update Successor task's predecessor lists
    if (task.id === succId) {
      const existingPreds = [...task.predecessors];
      if (!existingPreds.includes(predId)) {
        existingPreds.push(predId);
      }

      const existingDetails = [...(task.predecessorDetails || [])];
      const detailIdx = existingDetails.findIndex((d) => d.id === predId);
      const newDetail: DependencyDetail = {
        id: predId,
        name: predTask.name,
        relation: formatDependencyRelation(type, lag, true),
        statusColor: predTask.status === "complete" ? "emerald" : "gray",
        type,
        lag,
      };

      if (detailIdx >= 0) {
        existingDetails[detailIdx] = newDetail;
      } else {
        existingDetails.push(newDetail);
      }

      return {
        ...task,
        predecessors: existingPreds,
        predecessorDetails: existingDetails,
      };
    }

    // 2. Update Predecessor task's successor lists
    if (task.id === predId) {
      const existingSuccs = [...task.successors];
      if (!existingSuccs.includes(succId)) {
        existingSuccs.push(succId);
      }

      const existingDetails = [...(task.successorDetails || [])];
      const detailIdx = existingDetails.findIndex((d) => d.id === succId);
      const newDetail: DependencyDetail = {
        id: succId,
        name: succTask.name,
        relation: formatDependencyRelation(type, lag, false),
        statusColor: succTask.status === "complete" ? "emerald" : "gray",
        type,
        lag,
      };

      if (detailIdx >= 0) {
        existingDetails[detailIdx] = newDetail;
      } else {
        existingDetails.push(newDetail);
      }

      return {
        ...task,
        successors: existingSuccs,
        successorDetails: existingDetails,
      };
    }

    return task;
  });

  // Re-run scheduling engine with updated dependencies and calendar
  const result = recalculateSchedule(updatedTasks, calendar);
  return {
    updatedTasks: result.updatedTasks,
    changeCount: result.changeCount,
  };
}

export function unlinkTasks(
  tasks: ProgrammeTask[],
  predId: string,
  succId: string,
  calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR
): { updatedTasks: ProgrammeTask[]; changeCount: number } {
  const updatedTasks = tasks.map((task) => {
    if (task.id === succId) {
      return {
        ...task,
        predecessors: task.predecessors.filter((p) => p !== predId),
        predecessorDetails: (task.predecessorDetails || []).filter((p) => p.id !== predId),
      };
    }

    if (task.id === predId) {
      return {
        ...task,
        successors: task.successors.filter((s) => s !== succId),
        successorDetails: (task.successorDetails || []).filter((s) => s.id !== succId),
      };
    }

    return task;
  });

  const result = recalculateSchedule(updatedTasks, calendar);
  return {
    updatedTasks: result.updatedTasks,
    changeCount: result.changeCount,
  };
}
