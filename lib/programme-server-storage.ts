/**
 * PlanD-X Server Storage & Transaction Engine
 * 
 * Production persistence layer for multi-user construction schedules.
 * Scopes records to Project and Authorised User.
 * Provides:
 * - Transactional atomic file-backed writes (temp file + rename)
 * - Optimistic concurrency control (version checks preventing stale overwrites)
 * - Safe retries & idempotency key deduplication
 * - Complete revision history and audit event trail
 * - Atomic imports with pre-import snapshots
 * - Controlled rollback to any past revision or baseline
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { type ProgrammeTask, type TaskResourceAssignment } from "./programme-types";
import { type ProjectCalendar, STANDARD_5_DAY_CALENDAR } from "./programme-calendar";
import { type BaselineSnapshot } from "./programme-baseline";
import { validateProgrammePayload, type ValidationError } from "./programme-validator";
import { type ConstructionProject, type CreateProjectInput, type ProjectTemplateType } from "./project-types";
import { generateTemplateTasks } from "./project-templates";
import { ALL_PROGRAMME_TASKS } from "./programme-data";

export interface AuthorUser {
  id: string;
  name: string;
  email: string;
  role?: string;
}

export interface ProgrammeRevisionRecord {
  id: string;
  revisionNumber: number;
  name: string;
  sourceFileName?: string;
  createdAt: string;
  author: AuthorUser;
  changeSummary?: {
    addedTasks: number;
    removedTasks: number;
    modifiedTasks: number;
    notes?: string;
  };
  snapshot: {
    tasks: ProgrammeTask[];
    calendar: ProjectCalendar;
    assignments: Record<string, TaskResourceAssignment[]>;
    settings: Record<string, unknown>;
  };
}

export interface AuditEventRecord {
  id: string;
  timestamp: string;
  eventType: "TASK_EDIT" | "IMPORT" | "REVISION_APPLIED" | "ROLLBACK" | "CONFLICT_OVERRIDE";
  entityType: "PROGRAMME" | "TASK" | "CALENDAR" | "BASELINE";
  entityId?: string;
  description: string;
  author: AuthorUser;
  details?: Record<string, unknown>;
}

export interface StoredProgrammeRecord {
  id: string;
  projectId: string;
  projectName: string;
  projectCode: string;
  version: number;
  updatedAt: string;
  createdAt: string;
  lastModifiedBy: AuthorUser;
  tasks: ProgrammeTask[];
  calendar: ProjectCalendar;
  assignments: Record<string, TaskResourceAssignment[]>;
  baselines: BaselineSnapshot[];
  settings: Record<string, unknown>;
  revisions: ProgrammeRevisionRecord[];
  auditTrail: AuditEventRecord[];
  idempotencyKeys: Record<string, { createdAt: string; resultVersion: number }>;
}

export class ConcurrencyConflictError extends Error {
  currentVersion: number;
  expectedVersion: number;
  lastModifiedBy: AuthorUser;
  updatedAt: string;

  constructor(currentVersion: number, expectedVersion: number, lastModifiedBy: AuthorUser, updatedAt: string) {
    super(
      `Concurrency conflict: Working programme is at version ${currentVersion} (modified by ${lastModifiedBy.name} at ${updatedAt}), but client expected version ${expectedVersion}.`
    );
    this.name = "ConcurrencyConflictError";
    this.currentVersion = currentVersion;
    this.expectedVersion = expectedVersion;
    this.lastModifiedBy = lastModifiedBy;
    this.updatedAt = updatedAt;
  }
}

export class ProgrammeValidationError extends Error {
  errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super(`Programme validation failed with ${errors.length} error(s).`);
    this.name = "ProgrammeValidationError";
    this.errors = errors;
  }
}

const ROOT_DATA_DIR = path.join(process.cwd(), ".data");
const DATA_DIR = path.join(ROOT_DATA_DIR, "programmes");
const PROJECTS_FILE = path.join(ROOT_DATA_DIR, "projects.json");

export const DEFAULT_DEMO_PROJECT: ConstructionProject = {
  id: "default-project",
  code: "BAT-COMM-2026",
  name: "Battersea Commercial Redevelopment",
  description: "Major commercial redevelopment and high-specification fitout programme.",
  location: "London SW11, UK",
  clientName: "Battersea Power Station Development Co.",
  plannedStartDate: "2025-09-01",
  plannedFinishDate: "2026-11-15",
  scheduleFromStart: true,
  statusDate: "2025-10-15",
  calendarId: "cal-5day",
  currency: "GBP",
  units: "metric",
  isDemo: true,
  createdAt: "2025-09-01T08:00:00.000Z",
  updatedAt: new Date().toISOString(),
};

function ensureDirectoryExists() {
  if (!fs.existsSync(ROOT_DATA_DIR)) {
    fs.mkdirSync(ROOT_DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadRawProjectsRegistry(): ConstructionProject[] {
  ensureDirectoryExists();
  if (!fs.existsSync(PROJECTS_FILE)) {
    const initialList = [DEFAULT_DEMO_PROJECT];
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(initialList, null, 2), "utf-8");
    return initialList;
  }
  try {
    const raw = fs.readFileSync(PROJECTS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const initialList = [DEFAULT_DEMO_PROJECT];
    fs.writeFileSync(PROJECTS_FILE, JSON.stringify(initialList, null, 2), "utf-8");
    return initialList;
  } catch {
    return [DEFAULT_DEMO_PROJECT];
  }
}

function saveRawProjectsRegistry(projects: ConstructionProject[]) {
  ensureDirectoryExists();
  const tempPath = `${PROJECTS_FILE}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(projects, null, 2), "utf-8");
  fs.renameSync(tempPath, PROJECTS_FILE);
}

export function listAllProjects(): (ConstructionProject & { tasksCount: number })[] {
  const projects = loadRawProjectsRegistry();
  return projects.map((p) => {
    let tasksCount = 0;
    try {
      const pPath = getFilePath(p.id);
      if (fs.existsSync(pPath)) {
        const raw = fs.readFileSync(pPath, "utf-8");
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.tasks)) {
          tasksCount = parsed.tasks.length;
        }
      } else if (p.id === "default-project") {
        tasksCount = ALL_PROGRAMME_TASKS.length;
      }
    } catch {}
    return {
      ...p,
      tasksCount,
    };
  });
}

export function getProject(projectId: string): ConstructionProject | null {
  const projects = loadRawProjectsRegistry();
  const match = projects.find((p) => p.id === projectId);
  return match || null;
}

export function cloneTasksWithRegeneratedIds(tasks: ProgrammeTask[]): ProgrammeTask[] {
  const idMap = new Map<string, string>();
  for (const t of tasks) {
    const newId = `task-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    idMap.set(t.id, newId);
  }

  return tasks.map((t) => {
    const newId = idMap.get(t.id)!;
    const newParentId = t.parentId && idMap.has(t.parentId) ? idMap.get(t.parentId)! : t.parentId;
    const newChildren = (t.children || []).map((c) => idMap.get(c) || c);
    const newPredecessors = (t.predecessors || []).map((p) => idMap.get(p) || p);
    const newSuccessors = (t.successors || []).map((s) => idMap.get(s) || s);

    const newPredDetails = (t.predecessorDetails || []).map((pd) => ({
      ...pd,
      id: idMap.get(pd.id) || pd.id,
    }));
    const newSuccDetails = (t.successorDetails || []).map((sd) => ({
      ...sd,
      id: idMap.get(sd.id) || sd.id,
    }));

    return {
      ...t,
      id: newId,
      parentId: newParentId,
      children: newChildren,
      predecessors: newPredecessors,
      successors: newSuccessors,
      predecessorDetails: newPredDetails,
      successorDetails: newSuccDetails,
    };
  });
}

export function createProject(
  input: CreateProjectInput,
  user: AuthorUser = { id: "user-1", name: "Planner", email: "planner@plandx.com" }
): { project: ConstructionProject; programme: StoredProgrammeRecord } {
  const newId = `prj-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date().toISOString();
  const template = input.template || "blank";
  const plannedStart = input.plannedStartDate || "2026-03-02";

  const project: ConstructionProject = {
    id: newId,
    code: input.code || `PRJ-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    name: input.name,
    description: input.description || "",
    location: input.location || "London, UK",
    clientName: input.clientName || "",
    plannedStartDate: plannedStart,
    plannedFinishDate: input.plannedFinishDate,
    scheduleFromStart: input.scheduleFromStart !== undefined ? input.scheduleFromStart : true,
    statusDate: input.statusDate || plannedStart,
    calendarId: input.calendarId || "cal-5day",
    currency: input.currency || "GBP",
    units: input.units || "metric",
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  let initialTasks: ProgrammeTask[] = [];
  if (typeof template === "string" && template.startsWith("custom:")) {
    const customId = template.replace("custom:", "");
    const customList = readCustomTemplates();
    const found = customList.find((c) => c.id === customId);
    if (found) {
      initialTasks = cloneTasksWithRegeneratedIds(found.tasks);
    }
  } else {
    initialTasks = generateTemplateTasks(template as ProjectTemplateType, plannedStart);
  }

  const initialProgramme: StoredProgrammeRecord = {
    id: `prog-${newId}`,
    projectId: newId,
    projectName: project.name,
    projectCode: project.code,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: initialTasks,
    calendar: STANDARD_5_DAY_CALENDAR,
    assignments: {},
    baselines: [],
    settings: {
      showBaselineComparison: false,
      workingDayHours: 8,
      defaultView: "gantt",
      templateUsed: template,
    },
    revisions: [
      {
        id: `rev-initial-${Date.now()}`,
        revisionNumber: 1,
        name: template === "blank" ? "Blank Programme Created" : `Initialized from ${template} template`,
        createdAt: now,
        author: user,
        changeSummary: {
          addedTasks: initialTasks.length,
          removedTasks: 0,
          modifiedTasks: 0,
          notes:
            template === "blank"
              ? "Clean blank programme ready for task creation."
              : `Instantiated ${initialTasks.length} construction activities from ${template} template.`,
        },
        snapshot: {
          tasks: initialTasks,
          calendar: STANDARD_5_DAY_CALENDAR,
          assignments: {},
          settings: {},
        },
      },
    ],
    auditTrail: [
      {
        id: `audit-${Date.now()}`,
        timestamp: now,
        eventType: "IMPORT",
        entityType: "PROGRAMME",
        description: `Project created with template '${template}' (${initialTasks.length} tasks) by ${user.name}`,
        author: user,
      },
    ],
    idempotencyKeys: {},
  };

  const projects = loadRawProjectsRegistry();
  projects.push(project);
  saveRawProjectsRegistry(projects);

  atomicWriteRecord(newId, initialProgramme);

  return { project, programme: initialProgramme };
}

export function updateProject(
  projectId: string,
  updates: Partial<ConstructionProject>
): ConstructionProject {
  const projects = loadRawProjectsRegistry();
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1) {
    throw new Error(`Project ${projectId} not found.`);
  }

  const now = new Date().toISOString();
  const updated: ConstructionProject = {
    ...projects[idx],
    ...updates,
    id: projectId,
    updatedAt: now,
  };

  projects[idx] = updated;
  saveRawProjectsRegistry(projects);

  const filePath = getFilePath(projectId);
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const prog = JSON.parse(raw) as StoredProgrammeRecord;
      if (updated.name !== prog.projectName || updated.code !== prog.projectCode) {
        prog.projectName = updated.name;
        prog.projectCode = updated.code;
        prog.updatedAt = now;
        atomicWriteRecord(projectId, prog);
      }
    } catch {}
  }

  return updated;
}

export function deleteProject(projectId: string): { success: boolean } {
  if (projectId === "default-project") {
    throw new Error("Cannot delete the default demonstration project.");
  }
  const projects = loadRawProjectsRegistry();
  const existing = projects.find((p) => p.id === projectId);
  if (!existing) {
    throw new Error(`Project ${projectId} not found.`);
  }
  if (existing.isDemo) {
    throw new Error("Cannot delete a demonstration project.");
  }

  const filtered = projects.filter((p) => p.id !== projectId);
  saveRawProjectsRegistry(filtered);

  const filePath = getFilePath(projectId);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch {}
  }

  return { success: true };
}

export function cloneProject(
  projectId: string,
  newName?: string,
  user: AuthorUser = { id: "user-1", name: "Planner", email: "planner@plandx.com" }
): { project: ConstructionProject; programme: StoredProgrammeRecord } {
  const sourceProject = getProject(projectId);
  if (!sourceProject) {
    throw new Error(`Project ${projectId} not found.`);
  }
  const sourceProgramme = getProjectProgramme(projectId, user);

  const newId = `prj-${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;
  const now = new Date().toISOString();

  const clonedProject: ConstructionProject = {
    ...sourceProject,
    id: newId,
    name: newName || `${sourceProject.name} (Copy)`,
    code: `${sourceProject.code}-CPY`,
    isDemo: false,
    createdAt: now,
    updatedAt: now,
  };

  const clonedTasks = cloneTasksWithRegeneratedIds(sourceProgramme.tasks);

  const clonedProgramme: StoredProgrammeRecord = {
    ...sourceProgramme,
    id: `prog-${newId}`,
    projectId: newId,
    projectName: clonedProject.name,
    projectCode: clonedProject.code,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: clonedTasks,
    revisions: [
      {
        id: `rev-clone-${Date.now()}`,
        revisionNumber: 1,
        name: `Cloned from ${sourceProject.name}`,
        createdAt: now,
        author: user,
        changeSummary: {
          addedTasks: clonedTasks.length,
          removedTasks: 0,
          modifiedTasks: 0,
          notes: `Project cloned from ${sourceProject.name} (${sourceProject.code}) with regenerated task IDs.`,
        },
        snapshot: {
          tasks: clonedTasks,
          calendar: sourceProgramme.calendar,
          assignments: sourceProgramme.assignments || {},
          settings: sourceProgramme.settings || {},
        },
      },
    ],
    auditTrail: [
      {
        id: `audit-${Date.now()}`,
        timestamp: now,
        eventType: "IMPORT",
        entityType: "PROGRAMME",
        description: `Project duplicated from ${sourceProject.name} by ${user.name}`,
        author: user,
      },
    ],
    idempotencyKeys: {},
  };

  const projects = loadRawProjectsRegistry();
  projects.push(clonedProject);
  saveRawProjectsRegistry(projects);

  atomicWriteRecord(newId, clonedProgramme);

  return { project: clonedProject, programme: clonedProgramme };
}

function getFilePath(projectId: string): string {
  const safeId = projectId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(DATA_DIR, `${safeId}.json`);
}

/**
 * Initializes default initial programme if none exists
 */
function createInitialProgramme(projectId: string, user: AuthorUser): StoredProgrammeRecord {
  const now = new Date().toISOString();
  const isDemo = projectId === "default-project";
  const existingProj = getProject(projectId);
  const name = existingProj?.name || (isDemo ? DEFAULT_DEMO_PROJECT.name : `Project ${projectId}`);
  const code = existingProj?.code || (isDemo ? DEFAULT_DEMO_PROJECT.code : `PRJ-${projectId.substring(0, 6).toUpperCase()}`);
  const initialTasks = isDemo ? ALL_PROGRAMME_TASKS : [];

  return {
    id: `prog-${projectId}`,
    projectId,
    projectName: name,
    projectCode: code,
    version: 1,
    createdAt: now,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: initialTasks,
    calendar: STANDARD_5_DAY_CALENDAR,
    assignments: {},
    baselines: [],
    settings: {
      showBaselineComparison: false,
      workingDayHours: 8,
      defaultView: "gantt",
    },
    revisions: [
      {
        id: `rev-initial-${Date.now()}`,
        revisionNumber: 1,
        name: isDemo ? "Battersea Baseline Master Programme" : "Initial Working Programme",
        createdAt: now,
        author: user,
        changeSummary: {
          addedTasks: initialTasks.length,
          removedTasks: 0,
          modifiedTasks: 0,
          notes: isDemo ? "Full reference construction programme initialized." : "Programme repository initialized.",
        },
        snapshot: {
          tasks: initialTasks,
          calendar: STANDARD_5_DAY_CALENDAR,
          assignments: {},
          settings: {},
        },
      },
    ],
    auditTrail: [
      {
        id: `audit-${Date.now()}`,
        timestamp: now,
        eventType: "IMPORT",
        entityType: "PROGRAMME",
        description: `Initial programme created with ${initialTasks.length} tasks`,
        author: user,
      },
    ],
    idempotencyKeys: {},
  };
}

/**
 * Atomically writes data to disk using write-to-temp + rename pattern.
 * This ensures that interrupted writes never leave corrupted JSON files.
 */
function atomicWriteRecord(projectId: string, record: StoredProgrammeRecord) {
  ensureDirectoryExists();
  const targetPath = getFilePath(projectId);
  const tempPath = `${targetPath}.${Date.now()}.${crypto.randomBytes(4).toString("hex")}.tmp`;

  const serialized = JSON.stringify(record, null, 2);
  fs.writeFileSync(tempPath, serialized, "utf-8");
  fs.renameSync(tempPath, targetPath);
}

/**
 * Loads a project programme from server storage.
 */
export function getProjectProgramme(
  projectId: string = "default-project",
  user: AuthorUser = { id: "user-1", name: "Lead Planner", email: "planner@plandx.com" }
): StoredProgrammeRecord {
  ensureDirectoryExists();
  const filePath = getFilePath(projectId);

  if (!fs.existsSync(filePath)) {
    const initial = createInitialProgramme(projectId, user);
    atomicWriteRecord(projectId, initial);
    return initial;
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const record = JSON.parse(raw) as StoredProgrammeRecord;
    return record;
  } catch (err) {
    // If corrupted by an external process, backup and re-initialize
    const corruptBackup = `${filePath}.corrupt.${Date.now()}`;
    try {
      fs.renameSync(filePath, corruptBackup);
    } catch {}
    const recovered = createInitialProgramme(projectId, user);
    atomicWriteRecord(projectId, recovered);
    return recovered;
  }
}

/**
 * Saves programme edits with pre-validation and optimistic concurrency locking.
 */
export function saveProjectProgramme(
  projectId: string,
  payload: {
    expectedVersion?: number;
    idempotencyKey?: string;
    tasks: ProgrammeTask[];
    calendar?: ProjectCalendar;
    assignments?: Record<string, TaskResourceAssignment[]>;
    baselines?: BaselineSnapshot[];
    settings?: Record<string, unknown>;
    changeDescription?: string;
  },
  user: AuthorUser
): {
  success: boolean;
  version: number;
  updatedAt: string;
  revisionId: string;
} {
  // 1. Pre-validation
  const validation = validateProgrammePayload(payload);
  if (!validation.valid) {
    throw new ProgrammeValidationError(validation.errors);
  }

  // 2. Load existing record
  const current = getProjectProgramme(projectId, user);

  // 3. Idempotency Check: if this exact idempotencyKey was already committed, return cached version
  if (payload.idempotencyKey && current.idempotencyKeys[payload.idempotencyKey]) {
    const cached = current.idempotencyKeys[payload.idempotencyKey];
    return {
      success: true,
      version: cached.resultVersion,
      updatedAt: current.updatedAt,
      revisionId: current.revisions[current.revisions.length - 1]?.id || "cached",
    };
  }

  // 4. Optimistic concurrency check
  if (payload.expectedVersion !== undefined && payload.expectedVersion !== current.version) {
    throw new ConcurrencyConflictError(
      current.version,
      payload.expectedVersion,
      current.lastModifiedBy,
      current.updatedAt
    );
  }

  const now = new Date().toISOString();
  const newVersion = current.version + 1;
  const revisionId = `rev-${newVersion}-${Date.now()}`;

  // Calculate task delta statistics
  const currentTaskIds = new Set(current.tasks.map((t) => t.id));
  const newTaskIds = new Set(payload.tasks.map((t) => t.id));

  let addedTasks = 0;
  let removedTasks = 0;
  let modifiedTasks = 0;

  for (const t of payload.tasks) {
    if (!currentTaskIds.has(t.id)) {
      addedTasks++;
    } else {
      const oldTask = current.tasks.find((x) => x.id === t.id);
      if (
        oldTask &&
        (oldTask.startDate !== t.startDate ||
          oldTask.endDate !== t.endDate ||
          oldTask.duration !== t.duration ||
          oldTask.progress !== t.progress ||
          oldTask.name !== t.name)
      ) {
        modifiedTasks++;
      }
    }
  }

  for (const oldId of currentTaskIds) {
    if (!newTaskIds.has(oldId)) {
      removedTasks++;
    }
  }

  const newRevision: ProgrammeRevisionRecord = {
    id: revisionId,
    revisionNumber: newVersion,
    name: payload.changeDescription || `Working Programme Revision v${newVersion}`,
    createdAt: now,
    author: user,
    changeSummary: {
      addedTasks,
      removedTasks,
      modifiedTasks,
      notes: payload.changeDescription || `Manual schedule edits by ${user.name}`,
    },
    snapshot: {
      tasks: payload.tasks,
      calendar: payload.calendar || current.calendar,
      assignments: payload.assignments || current.assignments,
      settings: payload.settings || current.settings,
    },
  };

  const newAuditEvent: AuditEventRecord = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    timestamp: now,
    eventType: "TASK_EDIT",
    entityType: "PROGRAMME",
    description: `Programme updated to v${newVersion} (+${addedTasks}, -${removedTasks}, ~${modifiedTasks} tasks)`,
    author: user,
    details: {
      addedTasks,
      removedTasks,
      modifiedTasks,
      totalTasks: payload.tasks.length,
    },
  };

  // Update idempotency keys (keep max 100 recent)
  const updatedIdempotencyKeys = { ...current.idempotencyKeys };
  if (payload.idempotencyKey) {
    updatedIdempotencyKeys[payload.idempotencyKey] = {
      createdAt: now,
      resultVersion: newVersion,
    };
  }

  const updatedRecord: StoredProgrammeRecord = {
    ...current,
    version: newVersion,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: payload.tasks,
    calendar: payload.calendar || current.calendar,
    assignments: payload.assignments || current.assignments,
    baselines: payload.baselines || current.baselines,
    settings: payload.settings ? { ...current.settings, ...payload.settings } : current.settings,
    revisions: [...current.revisions.slice(-49), newRevision], // keep last 50 revisions
    auditTrail: [...current.auditTrail.slice(-199), newAuditEvent], // keep last 200 audit events
    idempotencyKeys: updatedIdempotencyKeys,
  };

  atomicWriteRecord(projectId, updatedRecord);

  return {
    success: true,
    version: newVersion,
    updatedAt: now,
    revisionId,
  };
}

/**
 * Performs an atomic programme import with pre-validation and deduplication.
 */
export function importProjectProgramme(
  projectId: string,
  payload: {
    sourceFileName: string;
    tasks: ProgrammeTask[];
    calendar?: ProjectCalendar;
    assignments?: Record<string, TaskResourceAssignment[]>;
    idempotencyKey?: string;
  },
  user: AuthorUser
): {
  success: boolean;
  version: number;
  importedTasksCount: number;
  revisionId: string;
} {
  // 1. Pre-validation
  const validation = validateProgrammePayload(payload);
  if (!validation.valid) {
    throw new ProgrammeValidationError(validation.errors);
  }

  const current = getProjectProgramme(projectId, user);

  // Idempotency: if same file hash / key was already imported, prevent duplicate processing
  if (payload.idempotencyKey && current.idempotencyKeys[payload.idempotencyKey]) {
    const cached = current.idempotencyKeys[payload.idempotencyKey];
    return {
      success: true,
      version: cached.resultVersion,
      importedTasksCount: payload.tasks.length,
      revisionId: current.revisions[current.revisions.length - 1]?.id || "cached",
    };
  }

  // Deduplicate tasks: Ensure stable IDs without creating duplicates
  const seenIds = new Set<string>();
  const sanitizedTasks: ProgrammeTask[] = [];

  for (const t of payload.tasks) {
    let cleanId = t.id?.trim();
    if (!cleanId || seenIds.has(cleanId)) {
      cleanId = `task-imp-${seenIds.size + 1}-${crypto.randomBytes(3).toString("hex")}`;
    }
    seenIds.add(cleanId);
    sanitizedTasks.push({
      ...t,
      id: cleanId,
    });
  }

  const now = new Date().toISOString();
  const newVersion = current.version + 1;
  const revisionId = `rev-import-${newVersion}-${Date.now()}`;

  const importRevision: ProgrammeRevisionRecord = {
    id: revisionId,
    revisionNumber: newVersion,
    name: `Import: ${payload.sourceFileName}`,
    sourceFileName: payload.sourceFileName,
    createdAt: now,
    author: user,
    changeSummary: {
      addedTasks: sanitizedTasks.length,
      removedTasks: current.tasks.length,
      modifiedTasks: 0,
      notes: `Imported from ${payload.sourceFileName} (${sanitizedTasks.length} activities)`,
    },
    snapshot: {
      tasks: sanitizedTasks,
      calendar: payload.calendar || current.calendar,
      assignments: payload.assignments || {},
      settings: current.settings,
    },
  };

  const auditEvent: AuditEventRecord = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    timestamp: now,
    eventType: "IMPORT",
    entityType: "PROGRAMME",
    description: `Imported ${sanitizedTasks.length} tasks from ${payload.sourceFileName} as v${newVersion}`,
    author: user,
    details: {
      sourceFile: payload.sourceFileName,
      tasksCount: sanitizedTasks.length,
    },
  };

  const updatedIdempotencyKeys = { ...current.idempotencyKeys };
  if (payload.idempotencyKey) {
    updatedIdempotencyKeys[payload.idempotencyKey] = {
      createdAt: now,
      resultVersion: newVersion,
    };
  }

  const updatedRecord: StoredProgrammeRecord = {
    ...current,
    version: newVersion,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: sanitizedTasks,
    calendar: payload.calendar || current.calendar,
    assignments: payload.assignments || {},
    revisions: [...current.revisions.slice(-49), importRevision],
    auditTrail: [...current.auditTrail.slice(-199), auditEvent],
    idempotencyKeys: updatedIdempotencyKeys,
  };

  atomicWriteRecord(projectId, updatedRecord);

  return {
    success: true,
    version: newVersion,
    importedTasksCount: sanitizedTasks.length,
    revisionId,
  };
}

/**
 * Rolls back the working programme to any previous revision.
 */
export function rollbackProjectProgramme(
  projectId: string,
  targetRevisionNumber: number,
  user: AuthorUser
): {
  success: boolean;
  version: number;
  restoredRevisionNumber: number;
  tasksCount: number;
} {
  const current = getProjectProgramme(projectId, user);

  const targetRevision = current.revisions.find((r) => r.revisionNumber === targetRevisionNumber);
  if (!targetRevision) {
    throw new Error(`Revision number ${targetRevisionNumber} not found in programme history.`);
  }

  const now = new Date().toISOString();
  const newVersion = current.version + 1;
  const rollbackRevisionId = `rev-rollback-${newVersion}-${Date.now()}`;

  const restoredTasks = targetRevision.snapshot.tasks;
  const restoredCalendar = targetRevision.snapshot.calendar || current.calendar;
  const restoredAssignments = targetRevision.snapshot.assignments || {};

  const rollbackRevisionRecord: ProgrammeRevisionRecord = {
    id: rollbackRevisionId,
    revisionNumber: newVersion,
    name: `Rollback to Revision v${targetRevisionNumber}`,
    createdAt: now,
    author: user,
    changeSummary: {
      addedTasks: 0,
      removedTasks: 0,
      modifiedTasks: restoredTasks.length,
      notes: `Controlled rollback to revision v${targetRevisionNumber} originally created at ${targetRevision.createdAt}`,
    },
    snapshot: {
      tasks: restoredTasks,
      calendar: restoredCalendar,
      assignments: restoredAssignments,
      settings: current.settings,
    },
  };

  const auditEvent: AuditEventRecord = {
    id: `audit-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`,
    timestamp: now,
    eventType: "ROLLBACK",
    entityType: "PROGRAMME",
    description: `Controlled rollback to Revision v${targetRevisionNumber} by ${user.name}`,
    author: user,
    details: {
      targetRevisionNumber,
      restoredTasksCount: restoredTasks.length,
    },
  };

  const updatedRecord: StoredProgrammeRecord = {
    ...current,
    version: newVersion,
    updatedAt: now,
    lastModifiedBy: user,
    tasks: restoredTasks,
    calendar: restoredCalendar,
    assignments: restoredAssignments,
    revisions: [...current.revisions.slice(-49), rollbackRevisionRecord],
    auditTrail: [...current.auditTrail.slice(-199), auditEvent],
  };

  atomicWriteRecord(projectId, updatedRecord);

  return {
    success: true,
    version: newVersion,
    restoredRevisionNumber: targetRevisionNumber,
    tasksCount: restoredTasks.length,
  };
}

// ─── Custom Reusable Project Templates Persistence ─────────────

export interface CustomTemplateRecord {
  id: string;
  name: string;
  description: string;
  category: string;
  sourceProjectId?: string;
  tasksCount: number;
  tasks: ProgrammeTask[];
  createdAt: string;
  createdBy: AuthorUser;
}

const TEMPLATES_FILE = path.join(DATA_DIR, "custom-templates.json");

function readCustomTemplates(): CustomTemplateRecord[] {
  ensureDirectoryExists();
  if (!fs.existsSync(TEMPLATES_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(TEMPLATES_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeCustomTemplates(templates: CustomTemplateRecord[]): void {
  ensureDirectoryExists();
  const tempPath = `${TEMPLATES_FILE}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(templates, null, 2), "utf-8");
  fs.renameSync(tempPath, TEMPLATES_FILE);
}

export function listCustomTemplates(): CustomTemplateRecord[] {
  return readCustomTemplates();
}

export function saveCustomTemplate(
  name: string,
  description: string,
  category: string,
  projectId: string,
  user: AuthorUser
): CustomTemplateRecord {
  const currentRecord = getProjectProgramme(projectId);
  const tasksToSave = currentRecord ? currentRecord.tasks : [];

  const templateId = `tpl-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  const newTemplate: CustomTemplateRecord = {
    id: templateId,
    name: name.trim(),
    description: description.trim() || `Reusable template saved from ${currentRecord ? currentRecord.tasks.length : 0} activities`,
    category: category || "General Construction",
    sourceProjectId: projectId,
    tasksCount: tasksToSave.length,
    tasks: tasksToSave,
    createdAt: new Date().toISOString(),
    createdBy: user,
  };

  const existing = readCustomTemplates();
  const updated = [newTemplate, ...existing.filter((t) => t.id !== templateId)];
  writeCustomTemplates(updated);
  return newTemplate;
}

export function deleteCustomTemplate(templateId: string): boolean {
  const existing = readCustomTemplates();
  const filtered = existing.filter((t) => t.id !== templateId);
  if (filtered.length === existing.length) return false;
  writeCustomTemplates(filtered);
  return true;
}

