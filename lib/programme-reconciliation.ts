// PlanD-X Schedule Reconciliation & Difference Engine
// ======================================================
// Performs stable matching, semantic difference analysis, uncertain match detection,
// and selective reconciliation between working programmes and revised schedules.

import type {
  ProgrammeTask,
  TaskFieldChange,
  TaskReconciliationItem,
  ProgrammeReconciliationSummary,
  ReconciliationAction,
  TaskMatchConfidence,
  ReconciliationCategory,
  DependencyDetail,
} from "./programme-types";
import { parseIsoDate, type ProjectCalendar } from "./programme-calendar";

/**
 * Computes SHA-256 fingerprint of file bytes or text string.
 * Uses Web Crypto API when available with fallback to Node.js crypto.
 */
export async function computeSha256Fingerprint(
  data: Uint8Array | ArrayBuffer | string
): Promise<string> {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
      ? data
      : new Uint8Array(data);

  if (typeof crypto !== "undefined" && crypto.subtle) {
    const hashBuffer = await crypto.subtle.digest("SHA-256", bytes.buffer as ArrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  // Node.js fallback
  try {
    const nodeCrypto = await import("crypto");
    const hash = nodeCrypto.createHash("sha256");
    hash.update(bytes);
    return hash.digest("hex");
  } catch {
    // Simple checksum fallback if crypto is completely unavailable
    let hash = 0;
    for (let i = 0; i < bytes.length; i++) {
      hash = (hash << 5) - hash + bytes[i];
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16)}`;
  }
}

/**
 * Normalizes string for name comparisons (trims, collapses whitespace, lowercase).
 */
function normalizeName(name: string): string {
  return (name || "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Formats MS Project constraint type code into human-readable label.
 */
export function formatConstraintLabel(constraintType?: number | string): string {
  const code = Number(constraintType);
  switch (code) {
    case 0:
      return "As Soon As Possible (ASAP)";
    case 1:
      return "As Late As Possible (ALAP)";
    case 2:
      return "Must Start On (MSO)";
    case 3:
      return "Must Finish On (MFO)";
    case 4:
      return "Start No Earlier Than (SNET)";
    case 5:
      return "Start No Later Than (SNLT)";
    case 6:
      return "Finish No Earlier Than (FNET)";
    case 7:
      return "Finish No Later Than (FNLT)";
    default:
      return constraintType !== undefined && constraintType !== null
        ? String(constraintType)
        : "As Soon As Possible (ASAP)";
  }
}

/**
 * Reconciles incoming revised schedule tasks against current working tasks.
 *
 * Implements strict multi-tier identity preservation:
 * Tier 1: sourceUid (MS Project stable unique ID across outline edits)
 * Tier 2: task id (PlanD-X internal task identifier)
 * Tier 3: WBS hierarchy code (exact outline position)
 * Tier 4: Task Name matching — FLAGGED AS UNCERTAIN MANUAL REVIEW if IDs or WBS differ.
 *
 * Never assumes two similarly named tasks are the same activity without stable identifiers.
 */
export function computeProgrammeReconciliation(
  previousTasks: ProgrammeTask[],
  incomingTasks: ProgrammeTask[]
): ProgrammeReconciliationSummary {
  const prevByUid = new Map<string, ProgrammeTask>();
  const prevById = new Map<string, ProgrammeTask>();
  const prevByWbs = new Map<string, ProgrammeTask>();
  const prevByNameList = new Map<string, ProgrammeTask[]>();

  previousTasks.forEach((t) => {
    if (t.sourceUid !== undefined && t.sourceUid !== null && String(t.sourceUid).trim() !== "") {
      prevByUid.set(String(t.sourceUid), t);
    }
    if (t.id) {
      prevById.set(t.id, t);
    }
    if (t.wbs && t.wbs.trim() !== "") {
      prevByWbs.set(t.wbs.trim(), t);
    }
    const norm = normalizeName(t.name);
    if (norm) {
      const list = prevByNameList.get(norm) || [];
      list.push(t);
      prevByNameList.set(norm, list);
    }
  });

  const matchedPrevIds = new Set<string>();
  const allItems: TaskReconciliationItem[] = [];

  const addedTasks: ProgrammeTask[] = [];
  const modifiedTasks: TaskReconciliationItem[] = [];
  const unchangedTasks: ProgrammeTask[] = [];

  let earlierCount = 0;
  let laterCount = 0;
  let maxSlipDays = 0;
  let renamedCount = 0;
  let movedCount = 0;
  let uncertainCount = 0;
  let logicChangesCount = 0;
  let constraintChangesCount = 0;

  const milestoneImpacts: Array<{
    id: string;
    name: string;
    workingDate: string;
    incomingDate: string;
    slipDays: number;
  }> = [];

  // Match each incoming task
  for (let idx = 0; idx < incomingTasks.length; idx++) {
    const incoming = incomingTasks[idx];
    let matchedPrev: ProgrammeTask | undefined;
    let matchConfidence: TaskMatchConfidence = "unmatched";
    let isUncertain = false;
    let uncertainReason: string | undefined;

    // Tier 1: sourceUid
    if (incoming.sourceUid !== undefined && incoming.sourceUid !== null && String(incoming.sourceUid).trim() !== "") {
      const candidate = prevByUid.get(String(incoming.sourceUid));
      if (candidate && !matchedPrevIds.has(candidate.id)) {
        matchedPrev = candidate;
        matchConfidence = "exact-uid";
      }
    }

    // Tier 2: task id
    if (!matchedPrev && incoming.id && prevById.has(incoming.id)) {
      const candidate = prevById.get(incoming.id);
      if (candidate && !matchedPrevIds.has(candidate.id)) {
        matchedPrev = candidate;
        matchConfidence = "exact-id";
      }
    }

    // Tier 3: WBS code
    if (!matchedPrev && incoming.wbs && prevByWbs.has(incoming.wbs.trim())) {
      const candidate = prevByWbs.get(incoming.wbs.trim());
      if (candidate && !matchedPrevIds.has(candidate.id)) {
        const normIncoming = normalizeName(incoming.name);
        const normPrev = normalizeName(candidate.name);

        if (normIncoming === normPrev) {
          matchedPrev = candidate;
          matchConfidence = "exact-wbs-name";
        } else {
          // Same WBS code, but task name differs!
          // Could be a rename OR a completely replaced activity at this outline slot.
          matchedPrev = candidate;
          matchConfidence = "uncertain-wbs-only";
          isUncertain = true;
          uncertainReason = `WBS code matches (${incoming.wbs}), but task name changed from "${candidate.name}" to "${incoming.name}". Review whether this is a renamed activity or a new scope item.`;
          uncertainCount++;
        }
      }
    }

    // Tier 4: Matching solely on task name (Never assume two similarly named tasks are the same activity)
    if (!matchedPrev) {
      const normIncoming = normalizeName(incoming.name);
      if (normIncoming && prevByNameList.has(normIncoming)) {
        const candidates = prevByNameList.get(normIncoming)!;
        const availableCandidate = candidates.find((c) => !matchedPrevIds.has(c.id));
        if (availableCandidate) {
          matchedPrev = availableCandidate;
          matchConfidence = "uncertain-name-only";
          isUncertain = true;
          uncertainReason = `Matched solely on task name "${incoming.name}" across differing WBS positions (Current: ${availableCandidate.wbs || "none"}, Incoming: ${incoming.wbs || "none"}). Manual confirmation required to verify if this is a relocated activity or a distinct new task.`;
          uncertainCount++;
        }
      }
    }

    // If completely unmatched -> Added Task
    if (!matchedPrev) {
      addedTasks.push(incoming);
      allItems.push({
        id: `recon-add-${idx}-${incoming.id}`,
        taskId: incoming.id,
        incomingTaskId: incoming.id,
        taskName: incoming.name,
        incomingTaskName: incoming.name,
        changeType: "added",
        isRenamed: false,
        isMoved: false,
        isUncertain: false,
        matchConfidence: "unmatched",
        action: "accept",
        sourceUid: incoming.sourceUid,
        wbs: incoming.wbs || "",
        incomingWbs: incoming.wbs,
        depth: incoming.depth,
        changes: [
          {
            field: "task",
            fieldLabel: "Task Status",
            from: "Non-existent in current schedule",
            to: `New scope (${incoming.duration}d, ${incoming.startDate} to ${incoming.endDate})`,
            category: "schedule",
          },
        ],
        task: incoming,
        incomingTask: incoming,
      });
      continue;
    }

    matchedPrevIds.add(matchedPrev.id);

    // Compute field-by-field differences
    const changes: TaskFieldChange[] = [];

    // 1. Task Name (Rename detection)
    const isRenamed = incoming.name.trim() !== matchedPrev.name.trim();
    if (isRenamed) {
      renamedCount++;
      changes.push({
        field: "name",
        fieldLabel: "Task Name",
        from: matchedPrev.name,
        to: incoming.name,
        category: "wbs",
      });
    }

    // 2. WBS & Hierarchy Changes (Move detection)
    const isWbsChanged = (incoming.wbs || "").trim() !== (matchedPrev.wbs || "").trim();
    const isParentChanged = incoming.parentId !== matchedPrev.parentId;
    const isDepthChanged = incoming.depth !== matchedPrev.depth;
    const isMoved = isWbsChanged || isParentChanged || isDepthChanged;
    if (isMoved) {
      movedCount++;
      if (isWbsChanged) {
        changes.push({
          field: "wbs",
          fieldLabel: "WBS Outline",
          from: matchedPrev.wbs || "None",
          to: incoming.wbs || "None",
          category: "wbs",
        });
      }
      if (isParentChanged) {
        changes.push({
          field: "parentId",
          fieldLabel: "Parent Group",
          from: matchedPrev.parentId || "Root",
          to: incoming.parentId || "Root",
          category: "wbs",
        });
      }
      if (isDepthChanged) {
        changes.push({
          field: "depth",
          fieldLabel: "Hierarchy Depth",
          from: `Level ${matchedPrev.depth || 0}`,
          to: `Level ${incoming.depth || 0}`,
          category: "wbs",
        });
      }
    }

    // 3. Start Date & Day Shift
    if (incoming.startDate !== matchedPrev.startDate) {
      const prevD = parseIsoDate(matchedPrev.startDate).getTime();
      const inD = parseIsoDate(incoming.startDate).getTime();
      const diffDays = Math.round((inD - prevD) / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        laterCount++;
        if (diffDays > maxSlipDays) maxSlipDays = diffDays;
      } else if (diffDays < 0) {
        earlierCount++;
      }

      changes.push({
        field: "startDate",
        fieldLabel: "Start Date",
        from: matchedPrev.startDate,
        to: incoming.startDate,
        category: "schedule",
        varianceDays: diffDays,
      });
    }

    // 4. Finish Date & Day Shift
    if (incoming.endDate !== matchedPrev.endDate) {
      const prevD = parseIsoDate(matchedPrev.endDate).getTime();
      const inD = parseIsoDate(incoming.endDate).getTime();
      const diffDays = Math.round((inD - prevD) / (1000 * 60 * 60 * 24));

      if (diffDays > 0) {
        laterCount++;
        if (diffDays > maxSlipDays) maxSlipDays = diffDays;
      } else if (diffDays < 0) {
        earlierCount++;
      }

      changes.push({
        field: "endDate",
        fieldLabel: "Finish Date",
        from: matchedPrev.endDate,
        to: incoming.endDate,
        category: "schedule",
        varianceDays: diffDays,
      });

      // Track Milestone Impact
      if (matchedPrev.isMilestone || matchedPrev.level === "milestone" || matchedPrev.duration === 0) {
        milestoneImpacts.push({
          id: matchedPrev.id,
          name: matchedPrev.name,
          workingDate: matchedPrev.endDate,
          incomingDate: incoming.endDate,
          slipDays: diffDays,
        });
      }
    }

    // 5. Duration
    if (incoming.duration !== matchedPrev.duration) {
      changes.push({
        field: "duration",
        fieldLabel: "Duration",
        from: `${matchedPrev.duration}d`,
        to: `${incoming.duration}d (${incoming.duration - matchedPrev.duration >= 0 ? `+${incoming.duration - matchedPrev.duration}` : incoming.duration - matchedPrev.duration}d)`,
        category: "schedule",
      });
    }

    // 6. Dependencies & Logic (Links, Types, Lag)
    const prevPreds = (matchedPrev.predecessors || []).slice().sort().join(",");
    const inPreds = (incoming.predecessors || []).slice().sort().join(",");
    const prevDetails = formatDependencyDetails(matchedPrev.predecessorDetails, matchedPrev.predecessors);
    const inDetails = formatDependencyDetails(incoming.predecessorDetails, incoming.predecessors);

    if (prevPreds !== inPreds || prevDetails !== inDetails) {
      logicChangesCount++;
      changes.push({
        field: "predecessors",
        fieldLabel: "Predecessors & Logic",
        from: prevDetails || "None",
        to: inDetails || "None",
        category: "logic",
      });
    }

    // 7. Calendars, Constraints & Deadlines
    if (
      incoming.constraintType !== matchedPrev.constraintType ||
      incoming.constraintDate !== matchedPrev.constraintDate
    ) {
      constraintChangesCount++;
      const prevC = matchedPrev.constraintType !== undefined
        ? `${formatConstraintLabel(matchedPrev.constraintType)}${matchedPrev.constraintDate ? ` on ${matchedPrev.constraintDate}` : ""}`
        : "As Soon As Possible (ASAP)";
      const inC = incoming.constraintType !== undefined
        ? `${formatConstraintLabel(incoming.constraintType)}${incoming.constraintDate ? ` on ${incoming.constraintDate}` : ""}`
        : "As Soon As Possible (ASAP)";
      changes.push({
        field: "constraint",
        fieldLabel: "Constraint",
        from: prevC,
        to: inC,
        category: "calendar_constraints",
      });
    }

    if (incoming.deadline !== matchedPrev.deadline) {
      constraintChangesCount++;
      changes.push({
        field: "deadline",
        fieldLabel: "Deadline",
        from: matchedPrev.deadline || "None",
        to: incoming.deadline || "None",
        category: "calendar_constraints",
      });
    }

    if (incoming.calendarName !== matchedPrev.calendarName && (incoming.calendarName || matchedPrev.calendarName)) {
      changes.push({
        field: "calendar",
        fieldLabel: "Task Calendar",
        from: matchedPrev.calendarName || "Standard Project Base",
        to: incoming.calendarName || "Standard Project Base",
        category: "calendar_constraints",
      });
    }

    if (incoming.schedulingMode !== matchedPrev.schedulingMode && (incoming.schedulingMode || matchedPrev.schedulingMode)) {
      changes.push({
        field: "schedulingMode",
        fieldLabel: "Scheduling Mode",
        from: matchedPrev.schedulingMode || "auto",
        to: incoming.schedulingMode || "auto",
        category: "calendar_constraints",
      });
    }

    if (incoming.taskType !== matchedPrev.taskType && (incoming.taskType || matchedPrev.taskType)) {
      changes.push({
        field: "taskType",
        fieldLabel: "Task Type",
        from: matchedPrev.taskType || "fixed-units",
        to: incoming.taskType || "fixed-units",
        category: "calendar_constraints",
      });
    }

    // 8. Actual Progress & Remaining Duration
    if (incoming.progress !== matchedPrev.progress) {
      changes.push({
        field: "progress",
        fieldLabel: "Progress Complete",
        from: `${matchedPrev.progress}%`,
        to: `${incoming.progress}%`,
        category: "progress",
      });
    }

    if (
      incoming.remainingDuration !== undefined &&
      matchedPrev.remainingDuration !== undefined &&
      incoming.remainingDuration !== matchedPrev.remainingDuration
    ) {
      changes.push({
        field: "remainingDuration",
        fieldLabel: "Remaining Duration",
        from: `${matchedPrev.remainingDuration}d`,
        to: `${incoming.remainingDuration}d`,
        category: "progress",
      });
    }

    if (incoming.actualStart !== matchedPrev.actualStart && (incoming.actualStart || matchedPrev.actualStart)) {
      changes.push({
        field: "actualStart",
        fieldLabel: "Actual Start",
        from: matchedPrev.actualStart || "Not started",
        to: incoming.actualStart || "Not started",
        category: "progress",
      });
    }

    if (incoming.actualFinish !== matchedPrev.actualFinish && (incoming.actualFinish || matchedPrev.actualFinish)) {
      changes.push({
        field: "actualFinish",
        fieldLabel: "Actual Finish",
        from: matchedPrev.actualFinish || "Not finished",
        to: incoming.actualFinish || "Not finished",
        category: "progress",
      });
    }

    // 9. Resource Assignments, Costs & Custom Fields
    const inTrade = incoming.tradeText || incoming.trade || "";
    const prevTrade = matchedPrev.tradeText || matchedPrev.trade || "";
    if (inTrade !== prevTrade && (inTrade || prevTrade)) {
      changes.push({
        field: "trade",
        fieldLabel: "Trade / Subcontractor",
        from: prevTrade || "None",
        to: inTrade || "None",
        category: "resources_costs",
      });
    }

    if (incoming.costCode !== matchedPrev.costCode && (incoming.costCode || matchedPrev.costCode)) {
      changes.push({
        field: "costCode",
        fieldLabel: "Cost Code",
        from: matchedPrev.costCode || "None",
        to: incoming.costCode || "None",
        category: "resources_costs",
      });
    }

    if (incoming.cost !== undefined && matchedPrev.cost !== undefined && incoming.cost !== matchedPrev.cost) {
      changes.push({
        field: "cost",
        fieldLabel: "Estimated Cost",
        from: `$${matchedPrev.cost.toLocaleString()}`,
        to: `$${incoming.cost.toLocaleString()}`,
        category: "resources_costs",
      });
    }

    if (
      incoming.workHours !== undefined &&
      matchedPrev.workHours !== undefined &&
      incoming.workHours !== matchedPrev.workHours
    ) {
      changes.push({
        field: "workHours",
        fieldLabel: "Work Hours",
        from: `${matchedPrev.workHours}h`,
        to: `${incoming.workHours}h`,
        category: "resources_costs",
      });
    }

    // 10. Baseline Information Differences
    if (
      incoming.baseline0Start &&
      matchedPrev.baseline0Start &&
      incoming.baseline0Start !== matchedPrev.baseline0Start
    ) {
      changes.push({
        field: "baseline0Start",
        fieldLabel: "Baseline 0 Start",
        from: matchedPrev.baseline0Start,
        to: incoming.baseline0Start,
        category: "baseline",
      });
    }

    if (
      incoming.baseline0Finish &&
      matchedPrev.baseline0Finish &&
      incoming.baseline0Finish !== matchedPrev.baseline0Finish
    ) {
      changes.push({
        field: "baseline0Finish",
        fieldLabel: "Baseline 0 Finish",
        from: matchedPrev.baseline0Finish,
        to: incoming.baseline0Finish,
        category: "baseline",
      });
    }

    // Determine changeType
    let primaryChangeType: "added" | "removed" | "modified" | "unchanged" | "renamed" | "moved" = "unchanged";
    if (changes.length > 0) {
      if (isRenamed && !isMoved && changes.length === 1) {
        primaryChangeType = "renamed";
      } else if (isMoved && !isRenamed && changes.every((c) => c.category === "wbs")) {
        primaryChangeType = "moved";
      } else {
        primaryChangeType = "modified";
      }
    }

    const defaultAction: ReconciliationAction = isUncertain ? "keep" : "accept";

    const reconItem: TaskReconciliationItem = {
      id: `recon-${matchedPrev.id}`,
      taskId: matchedPrev.id,
      workingTaskId: matchedPrev.id,
      incomingTaskId: incoming.id,
      taskName: incoming.name,
      workingTaskName: matchedPrev.name,
      incomingTaskName: incoming.name,
      changeType: primaryChangeType,
      isRenamed,
      isMoved,
      isUncertain,
      uncertainReason,
      matchConfidence,
      action: defaultAction,
      sourceUid: incoming.sourceUid ?? matchedPrev.sourceUid,
      wbs: incoming.wbs || matchedPrev.wbs,
      workingWbs: matchedPrev.wbs,
      incomingWbs: incoming.wbs,
      depth: incoming.depth ?? matchedPrev.depth,
      changes,
      task: incoming,
      workingTask: matchedPrev,
      incomingTask: incoming,
    };

    allItems.push(reconItem);

    if (changes.length > 0) {
      modifiedTasks.push(reconItem);
    } else {
      unchangedTasks.push(incoming);
    }
  }

  // Determine removed tasks (in previous but not matched in incoming)
  const removedTasks = previousTasks.filter((t) => !matchedPrevIds.has(t.id));
  removedTasks.forEach((removed) => {
    allItems.push({
      id: `recon-rem-${removed.id}`,
      taskId: removed.id,
      workingTaskId: removed.id,
      taskName: removed.name,
      workingTaskName: removed.name,
      changeType: "removed",
      isRenamed: false,
      isMoved: false,
      isUncertain: false,
      matchConfidence: "unmatched",
      action: "keep", // Default to keep removed tasks safely unless user confirms deletion
      sourceUid: removed.sourceUid,
      wbs: removed.wbs || "",
      workingWbs: removed.wbs,
      depth: removed.depth,
      changes: [
        {
          field: "task",
          fieldLabel: "Task Status",
          from: `Existing in schedule (${removed.duration}d, ${removed.startDate} to ${removed.endDate})`,
          to: "Omitted in revised schedule",
          category: "schedule",
        },
      ],
      task: removed,
      workingTask: removed,
    });
  });

  // Calculate project completion slip
  const { currentFinishDate, incomingFinishDate, projectFinishSlipDays } = calculateProjectFinishSlip(
    previousTasks,
    incomingTasks
  );

  return {
    previousTaskCount: previousTasks.length,
    incomingTaskCount: incomingTasks.length,
    addedCount: addedTasks.length,
    removedCount: removedTasks.length,
    modifiedCount: modifiedTasks.length,
    renamedCount,
    movedCount,
    uncertainCount,
    unchangedCount: unchangedTasks.length,
    items: allItems,
    addedTasks,
    removedTasks,
    modifiedTasks,
    unchangedTasks,
    dateShiftSummary: {
      earlierCount,
      laterCount,
      maxSlipDays,
      projectFinishSlipDays,
      currentFinishDate,
      incomingFinishDate,
    },
    milestoneImpacts,
    logicChangesCount,
    constraintChangesCount,
  };
}

/**
 * Formats dependency details (IDs, relation types, and lag) for comparison.
 */
function formatDependencyDetails(
  details?: DependencyDetail[],
  predecessors?: string[]
): string {
  if (details && details.length > 0) {
    return details
      .map((d) => {
        const type = d.type || "FS";
        const lag = d.lag ? (d.lag > 0 ? `+${d.lag}d` : `${d.lag}d`) : "";
        return `${d.id} (${type}${lag ? ` ${lag}` : ""})`;
      })
      .sort()
      .join(", ");
  }
  if (predecessors && predecessors.length > 0) {
    return predecessors.slice().sort().join(", ");
  }
  return "";
}

/**
 * Computes overall project finish dates and slip in calendar days.
 */
function calculateProjectFinishSlip(
  previousTasks: ProgrammeTask[],
  incomingTasks: ProgrammeTask[]
): {
  currentFinishDate: string;
  incomingFinishDate: string;
  projectFinishSlipDays: number;
} {
  const getLatestFinish = (tasks: ProgrammeTask[]): string => {
    let latest = "";
    for (const t of tasks) {
      if (t.endDate && (!latest || t.endDate > latest)) {
        latest = t.endDate;
      }
    }
    return latest;
  };

  const currentFinishDate = getLatestFinish(previousTasks);
  const incomingFinishDate = getLatestFinish(incomingTasks);

  let projectFinishSlipDays = 0;
  if (currentFinishDate && incomingFinishDate) {
    const curTime = parseIsoDate(currentFinishDate).getTime();
    const inTime = parseIsoDate(incomingFinishDate).getTime();
    projectFinishSlipDays = Math.round((inTime - curTime) / (1000 * 60 * 60 * 24));
  }

  return {
    currentFinishDate,
    incomingFinishDate,
    projectFinishSlipDays,
  };
}

export interface ReconciliationApplyOptions {
  preserveBaseline0?: boolean; // Default true: strictly protects contract baseline
}

/**
 * Applies the user's reconciliation decisions to the working tasks.
 *
 * Supported Actions:
 * - "accept":
 *   - Added task -> inserted into programme
 *   - Removed task -> deleted from programme
 *   - Modified/Renamed/Moved -> updated with revised properties
 *     (Baseline 0 fields are protected unless preserveBaseline0 is explicitly false)
 * - "keep":
 *   - Working version retained as-is
 * - "skip":
 *   - Kept as-is, not imported
 */
export function applyProgrammeReconciliation(
  previousTasks: ProgrammeTask[],
  items: TaskReconciliationItem[],
  options: ReconciliationApplyOptions = { preserveBaseline0: true }
): ProgrammeTask[] {
  const itemByWorkingId = new Map<string, TaskReconciliationItem>();
  const addedItems: TaskReconciliationItem[] = [];

  for (const item of items) {
    if (item.changeType === "added") {
      addedItems.push(item);
    } else if (item.workingTaskId) {
      itemByWorkingId.set(item.workingTaskId, item);
    } else if (item.taskId) {
      itemByWorkingId.set(item.taskId, item);
    }
  }

  const resultTasks: ProgrammeTask[] = [];

  // Process existing tasks
  for (const prev of previousTasks) {
    const item = itemByWorkingId.get(prev.id);

    if (!item) {
      // Unmentioned task -> preserve unchanged
      resultTasks.push({ ...prev });
      continue;
    }

    if (item.action === "keep" || item.action === "skip") {
      // User chose to keep current working task
      resultTasks.push({ ...prev });
      continue;
    }

    if (item.action === "accept") {
      if (item.changeType === "removed") {
        // User accepted removal -> task is omitted
        continue;
      }

      // User accepted modification / rename / move
      const inc = item.incomingTask || item.task;
      const merged: ProgrammeTask = {
        ...prev,
        ...inc,
        id: prev.id, // preserve stable PlanD-X internal ID
        sourceUid: inc.sourceUid ?? prev.sourceUid,
      };

      // Strict contract Baseline 0 preservation rule
      if (options.preserveBaseline0) {
        if (prev.baseline0Start) merged.baseline0Start = prev.baseline0Start;
        if (prev.baseline0Finish) merged.baseline0Finish = prev.baseline0Finish;
        if (prev.baseline0Duration !== undefined) merged.baseline0Duration = prev.baseline0Duration;
        if (prev.baseline0Cost !== undefined) merged.baseline0Cost = prev.baseline0Cost;
        if (prev.baseline0Work !== undefined) merged.baseline0Work = prev.baseline0Work;
      }

      resultTasks.push(merged);
    }
  }

  // Process added tasks
  for (const item of addedItems) {
    if (item.action === "accept") {
      const inc = item.incomingTask || item.task;
      resultTasks.push({
        ...inc,
        id: inc.id || `task-rev-add-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      });
    }
  }

  return resultTasks;
}
