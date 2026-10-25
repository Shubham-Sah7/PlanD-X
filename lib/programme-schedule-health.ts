// PlanD-X Schedule Health & Quality Analysis Engine (DCMA 14-Point & Construction Best Practice)
// =====================================================================================================
// Comprehensive audit module identifying schedule defects, logic gaps, circular loops,
// constraint risks, float anomalies, out-of-sequence progress, and forecast discrepancies.
// Does NOT modify dates or dependencies automatically.

import type { ProgrammeTask } from "./programme-types";
import {
  ProjectCalendar,
  countWorkingDays,
  parseIsoDate,
  formatDateIso,
  isWorkingDay,
} from "./programme-calendar";

export type HealthSeverity = "critical" | "warning" | "info";

export type HealthCategory =
  | "logic"
  | "circular"
  | "dependencies"
  | "leads-lags"
  | "constraints"
  | "float-risk"
  | "duration"
  | "milestones"
  | "calendars"
  | "summaries"
  | "progress"
  | "critical-path"
  | "conflicts"
  | "forecasts"
  | "resources";

export interface ScheduleHealthIssue {
  id: string;
  category: HealthCategory;
  severity: HealthSeverity;
  ruleName: string;
  taskId: string;
  taskName: string;
  wbs: string;
  description: string;
  recommendation: string;
  metricValue?: string | number;
}

export interface ScheduleHealthCategorySummary {
  category: HealthCategory;
  title: string;
  issueCount: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  passed: boolean;
}

export interface ScheduleHealthReport {
  score: number; // 0 - 100 overall schedule health score
  grade: "A" | "B" | "C" | "D" | "F";
  summary: {
    totalTasksAudited: number;
    totalLeafTasks: number;
    totalMilestones: number;
    totalIssues: number;
    criticalIssues: number;
    warningIssues: number;
    infoIssues: number;
  };
  scoreMethodology: string;
  categories: Record<HealthCategory, ScheduleHealthCategorySummary>;
  issues: ScheduleHealthIssue[];
  auditedAt: string;
}

/**
 * Runs a comprehensive schedule quality and health audit across all tasks in the programme.
 * Evaluates 14 industry quality areas without mutating task dates or dependency networks.
 */
export function analyzeScheduleHealth(
  tasks: ProgrammeTask[],
  calendar: ProjectCalendar,
  options?: {
    statusDate?: string;
    recognizedCalendars?: string[];
  }
): ScheduleHealthReport {
  const issues: ScheduleHealthIssue[] = [];
  const taskMap = new Map<string, ProgrammeTask>();
  const parentMap = new Map<string, ProgrammeTask[]>();

  for (const t of tasks) {
    taskMap.set(t.id, t);
    if (t.parentId) {
      const list = parentMap.get(t.parentId) || [];
      list.push(t);
      parentMap.set(t.parentId, list);
    }
  }

  const isSummary = (t: ProgrammeTask): boolean => {
    if (t.level === "phase" || t.level === "programme") return true;
    if (t.children && t.children.length > 0) return true;
    return parentMap.has(t.id);
  };

  const leafTasks = tasks.filter((t) => !isSummary(t));
  const summaryTasks = tasks.filter((t) => isSummary(t));
  const milestoneTasks = tasks.filter((t) => t.isMilestone || t.duration === 0);

  // Determine project boundary dates
  let projectStartDate = "9999-12-31";
  let projectFinishDate = "0000-01-01";
  let baseline0ProjectFinish = "0000-01-01";

  for (const t of leafTasks) {
    if (t.startDate && t.startDate < projectStartDate) projectStartDate = t.startDate;
    if (t.endDate && t.endDate > projectFinishDate) projectFinishDate = t.endDate;
    if (t.baseline0Finish && t.baseline0Finish > baseline0ProjectFinish) {
      baseline0ProjectFinish = t.baseline0Finish;
    }
  }

  const statusDate = options?.statusDate || new Date().toISOString().split("T")[0];

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Logic: Missing Predecessors & Successors (Dangling Starts & Finishes)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const hasPredecessors =
      (t.predecessors && t.predecessors.length > 0) ||
      (t.predecessorDetails && t.predecessorDetails.length > 0);
    const hasSuccessors =
      (t.successors && t.successors.length > 0) ||
      (t.successorDetails && t.successorDetails.length > 0);

    const isStartBoundary =
      t.startDate === projectStartDate ||
      /site possession|project start|contract award|commencement|notice to proceed/i.test(t.name);

    const isFinishBoundary =
      t.endDate === projectFinishDate ||
      /practical completion|client handover|final completion|contract completion|commissioning/i.test(
        t.name
      );

    // Missing Predecessor (Dangling Start)
    if (!hasPredecessors && !isStartBoundary) {
      issues.push({
        id: `logic-no-pred-${t.id}`,
        category: "logic",
        severity: "warning",
        ruleName: "Missing Predecessor Logic",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity has no predecessor logic links, creating a dangling start that will not dynamically adjust if preceding works are delayed.`,
        recommendation: `Link this activity to preceding groundwork, design approval, or site handover activities.`,
      });
    }

    // Missing Successor (Dangling Finish)
    if (!hasSuccessors && !isFinishBoundary) {
      issues.push({
        id: `logic-no-succ-${t.id}`,
        category: "logic",
        severity: "warning",
        ruleName: "Missing Successor Logic",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity has no successor logic links, so changes to its duration will not dynamically drive downstream work or contract completion.`,
        recommendation: `Link this activity to subsequent trade handoffs, quality inspections, or milestone sign-offs.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Circular Dependencies (Logic Loops)
  // ─────────────────────────────────────────────────────────────────────────────
  const adj = new Map<string, string[]>();
  for (const t of tasks) {
    adj.set(t.id, []);
  }
  for (const t of tasks) {
    const pids = t.predecessors || [];
    for (const pid of pids) {
      if (adj.has(pid)) {
        adj.get(pid)!.push(t.id);
      }
    }
  }

  const visitedState = new Map<string, number>(); // 0=unvisited, 1=visiting, 2=visited
  const detectedCycles: Array<{ taskId: string; cyclePath: string[] }> = [];
  const processedCycleNodes = new Set<string>();

  function dfsDetectCycle(u: string, path: string[]) {
    visitedState.set(u, 1);
    path.push(u);

    const neighbors = adj.get(u) || [];
    for (const v of neighbors) {
      if (visitedState.get(v) === 1) {
        const cycleStartIndex = path.indexOf(v);
        if (cycleStartIndex !== -1) {
          const cycleNodes = path.slice(cycleStartIndex);
          cycleNodes.push(v);
          const cycleNames = cycleNodes.map((id) => taskMap.get(id)?.name || id);
          if (!processedCycleNodes.has(u)) {
            detectedCycles.push({ taskId: u, cyclePath: cycleNames });
            cycleNodes.forEach((n) => processedCycleNodes.add(n));
          }
        }
      } else if (!visitedState.has(v) || visitedState.get(v) === 0) {
        dfsDetectCycle(v, path);
      }
    }

    path.pop();
    visitedState.set(u, 2);
  }

  for (const t of tasks) {
    if (!visitedState.has(t.id) || visitedState.get(t.id) === 0) {
      dfsDetectCycle(t.id, []);
    }
  }

  for (const cyc of detectedCycles) {
    const t = taskMap.get(cyc.taskId);
    if (!t) continue;
    issues.push({
      id: `cycle-${cyc.taskId}`,
      category: "circular",
      severity: "critical",
      ruleName: "Circular Dependency Detected",
      taskId: cyc.taskId,
      taskName: t.name,
      wbs: t.wbs,
      description: `Activity forms part of a circular dependency loop: ${cyc.cyclePath.join(
        " ➔ "
      )}. Circular logic paralyzes forward/backward CPM calculation.`,
      recommendation: `Inspect the relationship chain and delete or invert one of the dependency links to break the cycle.`,
      metricValue: "Loop",
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Broken Dependency Links
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of tasks) {
    const predIds = t.predecessors || [];
    for (const pid of predIds) {
      if (!taskMap.has(pid)) {
        issues.push({
          id: `dep-broken-${t.id}-${pid}`,
          category: "dependencies",
          severity: "critical",
          ruleName: "Broken Dependency Reference",
          taskId: t.id,
          taskName: t.name,
          wbs: t.wbs,
          description: `Activity references a non-existent predecessor ID '${pid}' (likely a deleted or corrupted task link).`,
          recommendation: `Remove the orphaned predecessor ID or re-link to an active activity.`,
          metricValue: pid,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Excessive Positive or Negative Lag (Leads and Lags)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const details = t.predecessorDetails || [];
    for (const link of details) {
      const lag = link.lag || 0;
      if (lag < 0) {
        issues.push({
          id: `lead-negative-${t.id}-${link.id}`,
          category: "leads-lags",
          severity: "warning",
          ruleName: "Negative Lag / Lead Time",
          taskId: t.id,
          taskName: t.name,
          wbs: t.wbs,
          description: `Dependency on '${link.name || link.id}' specifies a negative lag of ${lag} working days, pulling successor start before predecessor completion.`,
          recommendation: `Replace negative lag with a Start-to-Start (SS) relationship with positive lag, or model overlapping work as distinct concurrent sub-packages.`,
          metricValue: `${lag}d`,
        });
      } else if (lag > 10) {
        issues.push({
          id: `lag-excessive-${t.id}-${link.id}`,
          category: "leads-lags",
          severity: "warning",
          ruleName: "Excessive Positive Lag (> 10 Days)",
          taskId: t.id,
          taskName: t.name,
          wbs: t.wbs,
          description: `Dependency on '${link.name || link.id}' includes an extensive buffer lag of +${lag} working days.`,
          recommendation: `Model substantial delays as explicit waiting tasks (e.g. Concrete Curing, Council Permit Review, Shipping Transit).`,
          metricValue: `+${lag}d`,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Hard Constraints That May Distort Scheduling
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const cType =
      typeof t.constraintType === "string"
        ? t.constraintType.toUpperCase()
        : t.constraintType;

    const isHardConstraint =
      cType === "MSO" || cType === 2 || cType === "MFO" || cType === 3 || cType === "SNLT" || cType === 5 || cType === "FNLT" || cType === 7;

    if (isHardConstraint) {
      issues.push({
        id: `constraint-hard-${t.id}`,
        category: "constraints",
        severity: "warning",
        ruleName: "Hard Constraint Overriding CPM Flow",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Task has a rigid hard constraint (${cType} on ${t.constraintDate || t.startDate}), overriding network logic and distorting total float calculations.`,
        recommendation: `Switch to soft constraints (e.g. Start No Earlier Than) and apply milestone deadlines instead of hard date locks.`,
        metricValue: String(cType),
      });
    }

    if (t.constraintConflict) {
      issues.push({
        id: `constraint-conflict-${t.id}`,
        category: "constraints",
        severity: "critical",
        ruleName: "Active Constraint Conflict",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description:
          t.constraintConflictReason ||
          `Predecessor driving logic physically pushes activity past its constraint boundary.`,
        recommendation: `Adjust predecessor durations, remove the constraint, or negotiate revised contractual milestone dates.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Tasks with Negative or Unusually Low Float
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const float = typeof t.float === "number" ? t.float : 0;
    if (float < 0) {
      issues.push({
        id: `float-negative-${t.id}`,
        category: "float-risk",
        severity: "critical",
        ruleName: "Negative Total Float (Schedule Delay)",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity has negative total float (${float} working days), indicating scheduled completion breaches contractual deadlines.`,
        recommendation: `Accelerate driving critical path predecessors, crash durations via additional gangs/plant, or request an Extension of Time (EOT).`,
        metricValue: `${float}d`,
      });
    } else if (float >= 0 && float <= 5 && !t.isCritical) {
      issues.push({
        id: `float-near-critical-${t.id}`,
        category: "float-risk",
        severity: "info",
        ruleName: "Near-Critical Path (Low Float)",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity has low total float (${float} working days) and will become critical if delayed by even a few days.`,
        recommendation: `Monitor weekly lookahead performance closely to protect remaining buffer.`,
        metricValue: `${float}d`,
      });
    } else if (float > 44 && !t.isMilestone && t.startDate < "2027-01-01") {
      issues.push({
        id: `float-hyper-${t.id}`,
        category: "float-risk",
        severity: "info",
        ruleName: "Unusually High Total Float (> 44 Days)",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity has unusually high float (${float} working days), which typically signifies missing downstream logic links.`,
        recommendation: `Verify whether this activity has unlinked handover or commissioning successors.`,
        metricValue: `${float}d`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Long-Duration Tasks That May Need Breakdown
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    if (!t.isMilestone && t.duration > 20) {
      issues.push({
        id: `dur-high-${t.id}`,
        category: "duration",
        severity: t.duration > 40 ? "warning" : "info",
        ruleName: "Long-Duration Activity Requiring Decomposition",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity duration is ${t.duration} working days. Tasks exceeding 20 working days conceal incremental delays and impede objective weekly site tracking.`,
        recommendation: `Decompose into zone-by-zone, floor-by-floor, or progressive inspection sub-tasks of 5 to 15 days.`,
        metricValue: `${t.duration}d`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Milestones at Risk
  // ─────────────────────────────────────────────────────────────────────────────
  for (const m of milestoneTasks) {
    if (m.deadlineViolated || (m.deadline && m.endDate && m.endDate > m.deadline)) {
      const daysPast = m.daysPastDeadline || 1;
      issues.push({
        id: `milestone-violated-${m.id}`,
        category: "milestones",
        severity: "critical",
        ruleName: "Contractual Milestone Deadline Violated",
        taskId: m.id,
        taskName: m.name,
        wbs: m.wbs,
        description: `Milestone forecast completion (${m.endDate}) breaches contractual deadline (${m.deadline}) by ${daysPast} working days.`,
        recommendation: `Crash driving critical path activities immediately to recover milestone delivery.`,
        metricValue: `+${daysPast}d late`,
      });
    }

    if (m.baseline0Finish && m.endDate && m.endDate > m.baseline0Finish) {
      const slip = countWorkingDays(m.baseline0Finish, m.endDate, calendar) - 1;
      if (slip > 0) {
        issues.push({
          id: `milestone-baseline-slip-${m.id}`,
          category: "milestones",
          severity: "warning",
          ruleName: "Milestone Slipped Past Baseline 0",
          taskId: m.id,
          taskName: m.name,
          wbs: m.wbs,
          description: `Milestone finish (${m.endDate}) has slipped ${slip} working days past approved Baseline 0 date (${m.baseline0Finish}).`,
          recommendation: `Review root-cause driving predecessor delays and prepare schedule variance documentation.`,
          metricValue: `+${slip}d slip`,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Missing or Inconsistent Calendars
  // ─────────────────────────────────────────────────────────────────────────────
  const knownCalendars = new Set([
    "Standard 5-Day",
    "6-Day Construction",
    "7-Day Continuous",
    "Civils Calendar",
    "5-day",
    "6-day",
    "7-day",
    ...(options?.recognizedCalendars || []),
  ]);

  for (const t of tasks) {
    if (t.calendarName && !knownCalendars.has(t.calendarName)) {
      issues.push({
        id: `cal-missing-${t.id}`,
        category: "calendars",
        severity: "warning",
        ruleName: "Unrecognized / Missing Calendar Reference",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity references calendar '${t.calendarName}', which is not configured in the project calendar dictionary. Engine defaulted to standard working hours.`,
        recommendation: `Create calendar in Project Calendars or reassign task to an active working calendar.`,
        metricValue: t.calendarName,
      });
    }
  }

  // Check calendar mismatches across dependencies
  for (const t of leafTasks) {
    if (!t.predecessorDetails) continue;
    for (const link of t.predecessorDetails) {
      const pred = taskMap.get(link.id);
      if (pred && pred.calendarName && t.calendarName && pred.calendarName !== t.calendarName) {
        issues.push({
          id: `cal-mismatch-${t.id}-${pred.id}`,
          category: "calendars",
          severity: "info",
          ruleName: "Calendar Inconsistency Across Dependency",
          taskId: t.id,
          taskName: t.name,
          wbs: t.wbs,
          description: `Activity is on '${t.calendarName}' while linked predecessor '${pred.name}' is on '${pred.calendarName}', creating non-uniform weekend and holiday shifts.`,
          recommendation: `Verify whether trade handoff accounts for differing rest days between subcontractors.`,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 10. Summary Task Rollup Errors
  // ─────────────────────────────────────────────────────────────────────────────
  for (const s of summaryTasks) {
    const children = tasks.filter((c) => c.parentId === s.id);
    if (children.length > 0) {
      let minChildStart = children[0].startDate;
      let maxChildEnd = children[0].endDate;
      for (const c of children) {
        if (c.startDate && c.startDate < minChildStart) minChildStart = c.startDate;
        if (c.endDate && c.endDate > maxChildEnd) maxChildEnd = c.endDate;
      }

      if (s.startDate && minChildStart && s.startDate !== minChildStart) {
        issues.push({
          id: `summary-start-mismatch-${s.id}`,
          category: "summaries",
          severity: "warning",
          ruleName: "Summary Container Start Date Discrepancy",
          taskId: s.id,
          taskName: s.name,
          wbs: s.wbs,
          description: `Summary task start date (${s.startDate}) does not match earliest child activity start (${minChildStart}).`,
          recommendation: `Run schedule recalculation to synchronize summary rollup boundaries.`,
          metricValue: `${s.startDate} ≠ ${minChildStart}`,
        });
      }

      if (s.endDate && maxChildEnd && s.endDate !== maxChildEnd) {
        issues.push({
          id: `summary-finish-mismatch-${s.id}`,
          category: "summaries",
          severity: "warning",
          ruleName: "Summary Container Finish Date Discrepancy",
          taskId: s.id,
          taskName: s.name,
          wbs: s.wbs,
          description: `Summary task finish date (${s.endDate}) does not match latest child activity finish (${maxChildEnd}).`,
          recommendation: `Run schedule recalculation to synchronize summary rollup boundaries.`,
          metricValue: `${s.endDate} ≠ ${maxChildEnd}`,
        });
      }
    }

    // Direct dependency links on summary containers
    const hasDirectPreds = s.predecessors && s.predecessors.length > 0;
    const hasDirectSuccs = s.successors && s.successors.length > 0;
    if (hasDirectPreds || hasDirectSuccs) {
      issues.push({
        id: `summary-direct-link-${s.id}`,
        category: "summaries",
        severity: "warning",
        ruleName: "Direct Dependency Linked to Summary Container",
        taskId: s.id,
        taskName: s.name,
        wbs: s.wbs,
        description: `Summary container has direct dependency links (${s.predecessors?.length || 0} preds, ${s.successors?.length || 0} succs). In standard CPM practice, links to summary containers distort float rollups and cause circular logic.`,
        recommendation: `Transfer logic links directly to specific start and finish leaf activities inside the summary.`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 11. Invalid Actual Dates and Progress Values
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const progress = t.progress;

    // Progress out of bounds
    if (typeof progress === "number" && (progress < 0 || progress > 100)) {
      issues.push({
        id: `progress-invalid-bounds-${t.id}`,
        category: "progress",
        severity: "critical",
        ruleName: "Invalid Progress Value (< 0% or > 100%)",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity progress is recorded as ${progress}%, which is outside the valid 0% to 100% range.`,
        recommendation: `Correct the progress value to a valid percentage between 0% and 100%.`,
        metricValue: `${progress}%`,
      });
    }

    // Progress 100% with incomplete status
    if (progress === 100 && t.status !== "complete") {
      issues.push({
        id: `progress-100-status-${t.id}`,
        category: "progress",
        severity: "warning",
        ruleName: "Progress 100% Incomplete Status Mismatch",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity progress is recorded as 100%, but task status is '${t.status}'.`,
        recommendation: `Update task status to 'complete' and ensure certified actual finish date is captured.`,
      });
    }

    // Complete status with progress < 100%
    if (t.status === "complete" && typeof progress === "number" && progress < 100) {
      issues.push({
        id: `progress-complete-lt100-${t.id}`,
        category: "progress",
        severity: "warning",
        ruleName: "Complete Status With Incomplete Progress",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Task status is marked 'complete', but recorded progress is only ${progress}%.`,
        recommendation: `Update progress to 100% or adjust status to 'in-progress'.`,
        metricValue: `${progress}%`,
      });
    }

    // Progress > 0% but status is not-started
    if (typeof progress === "number" && progress > 0 && t.status === "not-started") {
      issues.push({
        id: `progress-not-started-gt0-${t.id}`,
        category: "progress",
        severity: "warning",
        ruleName: "Not Started Status With Recorded Progress",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity is marked 'not-started', yet has ${progress}% recorded progress.`,
        recommendation: `Update task status to 'in-progress' and record the actual start date.`,
        metricValue: `${progress}%`,
      });
    }

    // Actual finish date precedes actual start date
    const actualStart = t.actualStart || (t as any).actualStartDate;
    const actualFinish = t.actualFinish || (t as any).actualFinishDate;
    if (actualStart && actualFinish && actualFinish < actualStart) {
      issues.push({
        id: `actual-dates-inverted-${t.id}`,
        category: "progress",
        severity: "critical",
        ruleName: "Actual Finish Precedes Actual Start Date",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Recorded actual finish date (${actualFinish}) occurs before actual start date (${actualStart}).`,
        recommendation: `Correct actual site progress dates to match chronological site execution.`,
        metricValue: `${actualFinish} < ${actualStart}`,
      });
    }

    // Future actual start date
    if (actualStart && actualStart > statusDate) {
      issues.push({
        id: `actual-future-start-${t.id}`,
        category: "progress",
        severity: "warning",
        ruleName: "Future Actual Start Date",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Activity records an actual start date in the future (${actualStart}) relative to status date (${statusDate}).`,
        recommendation: `Adjust actual start date to when work physically commenced on site.`,
        metricValue: actualStart,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 12. Out-of-Sequence Progress
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    const isStarted =
      (t.progress && t.progress > 0) ||
      t.status === "in-progress" ||
      t.status === "complete";

    if (isStarted && t.predecessors && t.predecessors.length > 0) {
      for (const pid of t.predecessors) {
        const pred = taskMap.get(pid);
        if (pred && (pred.progress || 0) < 100 && pred.status !== "complete") {
          issues.push({
            id: `progress-oos-${t.id}-${pred.id}`,
            category: "progress",
            severity: "warning",
            ruleName: "Out-of-Sequence Progress",
            taskId: t.id,
            taskName: t.name,
            wbs: t.wbs,
            description: `Activity has progressed (${t.progress}%) while Finish-to-Start predecessor '${pred.name}' is only ${pred.progress || 0}% complete.`,
            recommendation: `Review site sequence: convert dependency relationship to Start-to-Start (SS) with lead/lag or confirm whether predecessor work was completed on site.`,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 13. Differences Between Source Critical Flags and Calculated Criticality
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    if (t.sourceUid !== undefined) {
      const isCalculatedCritical =
        t.isCritical || (typeof t.float === "number" && t.float <= 0);
      const isSourceMarkedCritical =
        t.sourceCritical === true || (t as any).sourceCritical === true;

      if (isSourceMarkedCritical && !isCalculatedCritical && (t.float || 0) > 5) {
        issues.push({
          id: `cp-discrepancy-${t.id}`,
          category: "critical-path",
          severity: "info",
          ruleName: "Critical Path Discrepancy (Source vs PlanD-X)",
          taskId: t.id,
          taskName: t.name,
          wbs: t.wbs,
          description: `Imported schedule marked task as critical, but PlanD-X CPM calculation calculated ${t.float} days of float.`,
          recommendation: `Inspect calendar exceptions, constraint dates, and driving logic in source file to reconcile float difference.`,
          metricValue: `${t.float}d float`,
        });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 14. Tasks with Dates That Conflict with Their Dependencies
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    if (!t.startDate) continue;

    // Evaluate detailed links first
    if (t.predecessorDetails && t.predecessorDetails.length > 0) {
      for (const link of t.predecessorDetails) {
        const pred = taskMap.get(link.id);
        if (!pred || !pred.endDate) continue;

        const linkType = link.type || "FS";
        const lag = link.lag || 0;

        if (linkType === "FS" && lag >= 0 && t.startDate < pred.endDate) {
          issues.push({
            id: `conflict-fs-${t.id}-${pred.id}`,
            category: "conflicts",
            severity: "critical",
            ruleName: "Dependency Date Conflict (Finish-to-Start)",
            taskId: t.id,
            taskName: t.name,
            wbs: t.wbs,
            description: `Activity starts on ${t.startDate}, prior to Finish-to-Start predecessor '${pred.name}' finishing on ${pred.endDate}.`,
            recommendation: `Shift task start date or run schedule recalculation to resolve logic clash.`,
            metricValue: `${t.startDate} < ${pred.endDate}`,
          });
        }
      }
    } else if (t.predecessors && t.predecessors.length > 0) {
      // Fallback for string predecessors (default FS lag 0)
      for (const pid of t.predecessors) {
        const pred = taskMap.get(pid);
        if (pred && pred.endDate && t.startDate < pred.endDate) {
          issues.push({
            id: `conflict-fs-${t.id}-${pid}`,
            category: "conflicts",
            severity: "critical",
            ruleName: "Dependency Date Conflict (Finish-to-Start)",
            taskId: t.id,
            taskName: t.name,
            wbs: t.wbs,
            description: `Activity starts on ${t.startDate}, prior to Finish-to-Start predecessor '${pred.name}' finishing on ${pred.endDate}.`,
            recommendation: `Shift task start date or run schedule recalculation to resolve logic clash.`,
            metricValue: `${t.startDate} < ${pred.endDate}`,
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 15. Inconsistent Project Completion Forecasts
  // ─────────────────────────────────────────────────────────────────────────────
  // Check multiple contradictory project completion milestones
  const completionMilestones = milestoneTasks.filter((m) =>
    /practical completion|contract completion|client handover|final completion/i.test(m.name)
  );

  if (completionMilestones.length >= 2) {
    const dates = Array.from(new Set(completionMilestones.map((m) => m.endDate).filter(Boolean)));
    if (dates.length >= 2) {
      const primary = completionMilestones[0];
      issues.push({
        id: `forecast-inconsistent-milestones`,
        category: "forecasts",
        severity: "warning",
        ruleName: "Inconsistent Project Completion Milestones",
        taskId: primary.id,
        taskName: primary.name,
        wbs: primary.wbs,
        description: `Multiple completion milestones report conflicting completion dates: ${completionMilestones
          .map((m) => `'${m.name}' (${m.endDate})`)
          .join(" vs ")}.`,
        recommendation: `Designate a single contractual milestone as the driving project completion date.`,
        metricValue: `${dates.join(" vs ")}`,
      });
    }
  }

  // Check working project completion slipped past Baseline 0
  if (baseline0ProjectFinish !== "0000-01-01" && projectFinishDate > baseline0ProjectFinish) {
    const projectSlip = countWorkingDays(baseline0ProjectFinish, projectFinishDate, calendar) - 1;
    if (projectSlip > 0) {
      issues.push({
        id: `forecast-project-slip`,
        category: "forecasts",
        severity: projectSlip > 10 ? "critical" : "warning",
        ruleName: "Project Completion Forecast Slipped Past Baseline 0",
        taskId: "project",
        taskName: "Project Master Programme",
        wbs: "1.0",
        description: `Working schedule completion (${projectFinishDate}) slips ${projectSlip} working days past approved Contract Baseline 0 (${baseline0ProjectFinish}).`,
        recommendation: `Accelerate driving critical path activities or submit formal Extension of Time (EOT) claim.`,
        metricValue: `+${projectSlip}d project slip`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 16. Resource Over-Allocations (Summary)
  // ─────────────────────────────────────────────────────────────────────────────
  for (const t of leafTasks) {
    if (t.overallocated) {
      issues.push({
        id: `res-overallocated-${t.id}`,
        category: "resources",
        severity: "warning",
        ruleName: "Resource Capacity Exceeded",
        taskId: t.id,
        taskName: t.name,
        wbs: t.wbs,
        description: `Assigned trade '${t.trade || t.byWhom || "Resource"}' daily demand is ${t.peakAllocationPercent}%, exceeding capacity.`,
        recommendation: `Perform resource levelling, stagger concurrent work packages, or increase trade crew size.`,
        metricValue: `${t.peakAllocationPercent}%`,
      });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Category Summaries & Quality Scoring
  // ─────────────────────────────────────────────────────────────────────────────
  const categoryNames: HealthCategory[] = [
    "logic",
    "circular",
    "dependencies",
    "leads-lags",
    "constraints",
    "float-risk",
    "duration",
    "milestones",
    "calendars",
    "summaries",
    "progress",
    "critical-path",
    "conflicts",
    "forecasts",
    "resources",
  ];

  const categoryTitles: Record<HealthCategory, string> = {
    logic: "Open Logic (Dangling Starts/Finishes)",
    circular: "Circular Dependencies (Logic Loops)",
    dependencies: "Broken Dependency Links",
    "leads-lags": "Lead & Lag Discipline",
    constraints: "Constraints & Conflicts",
    "float-risk": "Float & Schedule Delay Risk",
    duration: "Activity Duration Breakdown",
    milestones: "Milestones & Contract Deadlines",
    calendars: "Calendar Consistency & Alignment",
    summaries: "Summary Task Rollups",
    progress: "Actual Dates & Out-of-Sequence Progress",
    "critical-path": "Critical Path Alignment",
    conflicts: "Dependency Date Conflicts",
    forecasts: "Project Completion Forecasts",
    resources: "Resource Over-Allocations",
  };

  const categories: Record<HealthCategory, ScheduleHealthCategorySummary> = {} as any;

  for (const cat of categoryNames) {
    const catIssues = issues.filter((i) => i.category === cat);
    const criticalCount = catIssues.filter((i) => i.severity === "critical").length;
    const warningCount = catIssues.filter((i) => i.severity === "warning").length;
    const infoCount = catIssues.filter((i) => i.severity === "info").length;

    categories[cat] = {
      category: cat,
      title: categoryTitles[cat],
      issueCount: catIssues.length,
      criticalCount,
      warningCount,
      infoCount,
      passed: criticalCount === 0 && warningCount <= 2,
    };
  }

  // Scoring Methodology:
  // Base 100 points.
  // Each critical issue deducts 5 points.
  // Each warning issue deducts 2 points.
  // Each info issue deducts 0.5 points.
  // Min score: 0. Max score: 100.
  const criticalIssues = issues.filter((i) => i.severity === "critical").length;
  const warningIssues = issues.filter((i) => i.severity === "warning").length;
  const infoIssues = issues.filter((i) => i.severity === "info").length;

  const penalty = criticalIssues * 5 + warningIssues * 2 + infoIssues * 0.5;
  const score = Math.max(0, Math.min(100, Math.round(100 - penalty)));

  let grade: "A" | "B" | "C" | "D" | "F" = "F";
  if (score >= 90) grade = "A";
  else if (score >= 80) grade = "B";
  else if (score >= 70) grade = "C";
  else if (score >= 60) grade = "D";

  return {
    score,
    grade,
    summary: {
      totalTasksAudited: tasks.length,
      totalLeafTasks: leafTasks.length,
      totalMilestones: milestoneTasks.length,
      totalIssues: issues.length,
      criticalIssues,
      warningIssues,
      infoIssues,
    },
    scoreMethodology:
      "Health Score is evaluated on a 100-point scale: Base 100 minus 5 pts per Critical defect, 2 pts per Warning, and 0.5 pts per Info item. No risk predictions are generated without explicit task data, and PlanD-X never automatically changes schedule dates or logic links.",
    categories,
    issues,
    auditedAt: new Date().toISOString(),
  };
}
