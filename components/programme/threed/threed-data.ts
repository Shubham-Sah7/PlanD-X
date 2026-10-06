// 3D Programme Data
// Mock programme data mapped to building elements
// =================================================

export type BuildingLevel = "Ground" | "Level 1" | "Level 2" | "Level 3" | "Level 4" | "Roof";
export type ElementStatus = "complete" | "in-progress" | "blocked" | "not-started";
export type ElementType = "columns" | "slab" | "core" | "walls" | "facade" | "stairs" | "plant";

export interface BuildingTask {
  id: string;
  wbs: string;
  name: string;
  level: BuildingLevel;
  elementType: ElementType;
  status: ElementStatus;
  progress: number;
  startDate: string;
  endDate: string;
  duration: number;
  trade: string;
  isCritical: boolean;
  isBlocked?: boolean;
  isOverdue?: boolean;
  isDueThisWeek?: boolean;
  blockedBy?: string;
  predecessors: string[];
  assignee: string;
  notes: string;
  phase: string;
}

export const BUILDING_TASKS: BuildingTask[] = [
  { id: "PRG-001", wbs: "3.1.1", name: "Ground Floor Slab Pour", level: "Ground", elementType: "slab", status: "complete", progress: 100, startDate: "2025-10-01", endDate: "2025-10-14", duration: 10, trade: "Structural", isCritical: true, predecessors: [], assignee: "J. Smith", notes: "Slab completed and signed off.", phase: "Superstructure" },
  { id: "PRG-002", wbs: "3.1.2", name: "Ground Floor Columns", level: "Ground", elementType: "columns", status: "complete", progress: 100, startDate: "2025-10-15", endDate: "2025-10-25", duration: 8, trade: "Structural", isCritical: true, predecessors: ["PRG-001"], assignee: "J. Smith", notes: "All ground floor columns cast and stripped.", phase: "Superstructure" },
  { id: "PRG-003", wbs: "3.1.3", name: "Ground Floor Core Walls", level: "Ground", elementType: "core", status: "complete", progress: 100, startDate: "2025-10-20", endDate: "2025-11-01", duration: 9, trade: "Structural", isCritical: true, predecessors: ["PRG-001"], assignee: "R. Taylor", notes: "Core walls complete. Jump form removed.", phase: "Superstructure" },
  { id: "PRG-010", wbs: "3.2.1", name: "Level 1 Slab Pour", level: "Level 1", elementType: "slab", status: "complete", progress: 100, startDate: "2025-11-01", endDate: "2025-11-15", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-002", "PRG-003"], assignee: "J. Smith", notes: "Level 1 slab poured and achieving strength.", phase: "Level 1" },
  { id: "PRG-011", wbs: "3.2.2", name: "Level 1 Columns", level: "Level 1", elementType: "columns", status: "complete", progress: 100, startDate: "2025-11-16", endDate: "2025-11-28", duration: 9, trade: "Structural", isCritical: true, predecessors: ["PRG-010"], assignee: "J. Smith", notes: "Level 1 columns complete.", phase: "Level 1" },
  { id: "PRG-012", wbs: "3.2.3", name: "Level 1 Core Walls", level: "Level 1", elementType: "core", status: "complete", progress: 100, startDate: "2025-11-10", endDate: "2025-11-25", duration: 11, trade: "Structural", isCritical: true, predecessors: ["PRG-010"], assignee: "R. Taylor", notes: "Core walls poured.", phase: "Level 1" },
  { id: "PRG-013", wbs: "3.2.4", name: "Level 1 Facade Framing", level: "Level 1", elementType: "facade", status: "complete", progress: 100, startDate: "2025-12-01", endDate: "2025-12-15", duration: 10, trade: "Façade", isCritical: false, predecessors: ["PRG-011"], assignee: "P. Brown", notes: "Facade framing and cladding complete.", phase: "Façade" },
  { id: "PRG-020", wbs: "3.3.1", name: "Level 2 Slab", level: "Level 2", elementType: "slab", status: "complete", progress: 100, startDate: "2025-11-28", endDate: "2025-12-12", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-011"], assignee: "J. Smith", notes: "Level 2 slab poured and at strength.", phase: "Level 2" },
  { id: "PRG-021", wbs: "3.3.2", name: "Columns", level: "Level 2", elementType: "columns", status: "in-progress", progress: 60, startDate: "2025-12-20", endDate: "2026-01-16", duration: 12, trade: "Structural", isCritical: true, predecessors: ["PRG-020"], assignee: "J. Smith", notes: "6 of 10 columns cast. Remaining 4 columns being formed this week.", phase: "Level 2" },
  { id: "PRG-022", wbs: "3.3.3", name: "Core Walls — Level 2", level: "Level 2", elementType: "core", status: "in-progress", progress: 45, startDate: "2025-12-15", endDate: "2026-01-20", duration: 14, trade: "Structural", isCritical: true, predecessors: ["PRG-020"], assignee: "R. Taylor", notes: "Jump form in position. North and West walls poured. East and South walls next.", phase: "Level 2" },
  { id: "PRG-023", wbs: "3.3.4", name: "Level 2 Facade Framing", level: "Level 2", elementType: "facade", status: "blocked", progress: 0, startDate: "2026-01-10", endDate: "2026-01-30", duration: 14, trade: "Façade", isCritical: false, isBlocked: true, predecessors: ["PRG-021"], assignee: "P. Brown", notes: "Awaiting columns to be complete.", blockedBy: "PRG-021 — Columns must reach minimum strength before facade clips can be fixed.", phase: "Façade" },
  { id: "PRG-024", wbs: "3.3.5", name: "Level 2 Staircase", level: "Level 2", elementType: "stairs", status: "not-started", progress: 0, startDate: "2026-01-20", endDate: "2026-02-05", duration: 12, trade: "Structural", isCritical: false, predecessors: ["PRG-022"], assignee: "J. Smith", notes: "Stair precast delivery scheduled 18 Jan.", phase: "Level 2" },
  { id: "PRG-030", wbs: "3.4.1", name: "Level 3 Slab", level: "Level 3", elementType: "slab", status: "not-started", progress: 0, startDate: "2026-01-20", endDate: "2026-02-03", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-021", "PRG-022"], assignee: "J. Smith", notes: "Pour dependent on Level 2 columns and core walls.", phase: "Level 3" },
  { id: "PRG-031", wbs: "3.4.2", name: "Level 3 Columns", level: "Level 3", elementType: "columns", status: "not-started", progress: 0, startDate: "2026-02-04", endDate: "2026-02-18", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-030"], assignee: "J. Smith", notes: "Formwork and reinforcement to be ordered.", phase: "Level 3" },
  { id: "PRG-032", wbs: "3.4.3", name: "Level 3 Core Walls", level: "Level 3", elementType: "core", status: "not-started", progress: 0, startDate: "2026-02-01", endDate: "2026-02-15", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-030"], assignee: "R. Taylor", notes: "Jump form to be jumped from Level 2.", phase: "Level 3" },
  { id: "PRG-040", wbs: "3.5.1", name: "Level 4 Slab", level: "Level 4", elementType: "slab", status: "not-started", progress: 0, startDate: "2026-02-20", endDate: "2026-03-06", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-031", "PRG-032"], assignee: "J. Smith", notes: "Critical path item — must not slip.", phase: "Level 4" },
  { id: "PRG-041", wbs: "3.5.2", name: "Level 4 Columns", level: "Level 4", elementType: "columns", status: "not-started", progress: 0, startDate: "2026-03-07", endDate: "2026-03-20", duration: 10, trade: "Structural", isCritical: true, predecessors: ["PRG-040"], assignee: "J. Smith", notes: "", phase: "Level 4" },
  { id: "PRG-050", wbs: "3.6.1", name: "Roof Slab", level: "Roof", elementType: "slab", status: "not-started", progress: 0, startDate: "2026-03-25", endDate: "2026-04-10", duration: 12, trade: "Structural", isCritical: true, predecessors: ["PRG-041"], assignee: "J. Smith", notes: "", phase: "Level 4" },
  { id: "PRG-051", wbs: "3.6.2", name: "Roof Plant & Services", level: "Roof", elementType: "plant", status: "not-started", progress: 0, startDate: "2026-04-12", endDate: "2026-05-01", duration: 14, trade: "M&E", isCritical: false, predecessors: ["PRG-050"], assignee: "T. Jones", notes: "", phase: "Façade" },
];

export const STATUS_COLORS = {
  "complete": { fill: "#10b981", stroke: "#059669", light: "#ecfdf5", text: "#065f46", label: "Complete" },
  "in-progress": { fill: "#2563eb", stroke: "#1d4ed8", light: "#eff6ff", text: "#1e40af", label: "In Progress" },
  "blocked": { fill: "#ef4444", stroke: "#dc2626", light: "#fef2f2", text: "#991b1b", label: "Blocked" },
  "not-started": { fill: "#94a3b8", stroke: "#64748b", light: "#f1f5f9", text: "#475569", label: "Not Started" },
} as const;

export const PROGRAMME_SUMMARY = {
  totalTasks: 817,
  completedPercent: 48,
  overdueTasks: 5,
  blockedTasks: 3,
  dueThisWeek: 12,
  criticalTasks: 12,
};

export const TIMELINE_PHASES = [
  { id: "site-est", label: "Site Establishment", colStart: 1, colSpan: 1, status: "complete" as ElementStatus },
  { id: "earthworks", label: "Earthworks", colStart: 1, colSpan: 2, status: "complete" as ElementStatus },
  { id: "superstructure", label: "Superstructure", colStart: 2, colSpan: 2, status: "complete" as ElementStatus },
  { id: "level-1", label: "Level 1", colStart: 3, colSpan: 2, status: "complete" as ElementStatus },
  { id: "level-2", label: "Level 2", colStart: 4, colSpan: 2, status: "in-progress" as ElementStatus },
  { id: "level-3", label: "Level 3", colStart: 5, colSpan: 2, status: "not-started" as ElementStatus },
  { id: "level-4", label: "Level 4", colStart: 6, colSpan: 2, status: "not-started" as ElementStatus },
  { id: "facade", label: "Façade", colStart: 4, colSpan: 4, status: "blocked" as ElementStatus },
];

export const BUILDING_LEVELS = ["Roof", "Level 4", "Level 3", "Level 2", "Level 1", "Ground"] as const;

export function getTasksForLevel(level: string): BuildingTask[] {
  return BUILDING_TASKS.filter((t) => t.level === level);
}

export function getLevelStatus(level: string): ElementStatus {
  const tasks = getTasksForLevel(level);
  if (tasks.length === 0) return "not-started";
  if (tasks.every((t) => t.status === "complete")) return "complete";
  if (tasks.some((t) => t.status === "blocked")) return "blocked";
  if (tasks.some((t) => t.status === "in-progress")) return "in-progress";
  return "not-started";
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "2-digit" });
}
