// Microsoft Project (MPP) & MSPDI XML Compatibility Module for PlanD-X
// =====================================================================
// Handles Microsoft Project XML (MSPDI), Schedule CSV, and proprietary
// MPP binary detection with clear user guidance and schedule integrity preservation.

import * as XLSX from "xlsx";
import type {
  ProgrammeTask,
  DependencyType,
  DependencyDetail,
  TaskStatus,
  WBSLevel,
} from "./programme-types";
import {
  ProjectCalendar,
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  parseIsoDate,
  formatDateIso,
  countWorkingDays,
} from "./programme-calendar";

export type ScheduleFileFormat = "mpp" | "mspdi-xml" | "schedule-csv" | "excel-xlsx" | "unknown";

export interface UnsupportedFieldInfo {
  field: string;
  count: number;
  description: string;
  treatment: string;
}

export interface ScheduleParseResult {
  valid: boolean;
  format: ScheduleFileFormat;
  fileName: string;
  fileSizeBytes: number;
  projectName: string;
  calendarName?: string;
  calendarWorkingDays?: number[];
  tasks: ProgrammeTask[];
  resources: { id: string; name: string }[];
  dependenciesCount: number;
  milestonesCount: number;
  baselinedTasksCount: number;
  warnings: string[];
  errors: string[];
  unsupportedFields: UnsupportedFieldInfo[];
  mppExplanation?: {
    reason: string;
    howToConvert: string[];
  };
}

// ─── 1. Format Detection & Magic Byte Inspection ──────────────────────────────

/**
 * Detects whether a file is a binary Microsoft Project (.mpp) file,
 * an MSPDI XML (.xml) file, or a Schedule CSV (.csv).
 */
export function detectScheduleFileFormat(
  content: string | Uint8Array,
  fileName: string
): ScheduleFileFormat {
  const ext = fileName.toLowerCase().split(".").pop();

  // Check magic bytes for Microsoft Compound File Binary (OLE CFBF)
  // Hex: D0 CF 11 E0 A1 B1 1A E1
  if (content instanceof Uint8Array && content.length >= 8) {
    if (
      content[0] === 0xd0 &&
      content[1] === 0xcf &&
      content[2] === 0x11 &&
      content[3] === 0xe0 &&
      content[4] === 0xa1 &&
      content[5] === 0xb1 &&
      content[6] === 0x1a &&
      content[7] === 0xe1
    ) {
      return "mpp";
    }
  }

  if (ext === "mpp") {
    return "mpp";
  }

  // Check for Excel (.xlsx, .xls)
  if (ext === "xlsx" || ext === "xls" || ext === "xlsm") {
    return "excel-xlsx";
  }

  if (content instanceof Uint8Array && content.length >= 4) {
    // ZIP magic bytes PK\x03\x04
    if (content[0] === 0x50 && content[1] === 0x4b && content[2] === 0x03 && content[3] === 0x04) {
      if (ext === "xlsx" || ext === "xlsm" || ext === "xltx") {
        return "excel-xlsx";
      }
    }
  }

  const text = typeof content === "string" ? content : new TextDecoder().decode(content.slice(0, 16384));

  // Check for Microsoft Project XML (MSPDI)
  if (
    ext === "xml" ||
    (text.includes("<Project") &&
      (text.includes("schemas.microsoft.com/project") ||
        text.includes("<Tasks>") ||
        text.includes("<SaveVersion>")))
  ) {
    return "mspdi-xml";
  }

  // Check for Schedule CSV
  if (
    ext === "csv" ||
    text.toLowerCase().includes("wbs") ||
    text.toLowerCase().includes("task name") ||
    text.toLowerCase().includes("start date")
  ) {
    return "schedule-csv";
  }

  return "unknown";
}

function unescapeXml(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function extractTagValue(xml: string, tagName: string): string | null {
  const match = xml.match(new RegExp(`<${tagName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  return match ? unescapeXml(match[1].trim()) : null;
}

function extractAllBlocks(xml: string, blockName: string): string[] {
  const results: string[] = [];
  const regex = new RegExp(`<${blockName}(?:\\s+[^>]*)?>([\\s\\S]*?)<\\/${blockName}>`, "gi");
  let m: RegExpExecArray | null;
  while ((m = regex.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/**
 * Parses MS Project duration string: e.g. "PT96H0M0S", "PT8H", or "PT12D".
 * Returns duration in working days (assuming standard 8 hours = 1 day).
 */
export function parseMspDurationToDays(durationStr: string | null): number {
  if (!durationStr) return 1;
  const str = durationStr.trim();

  // If already a number
  const num = Number(str);
  if (!isNaN(num)) return Math.max(0, Math.round(num));

  // ISO 8601 duration: PT96H0M0S or PT12D
  const daysMatch = str.match(/P(\d+)D/i);
  if (daysMatch) return Math.max(0, parseInt(daysMatch[1], 10));

  const hoursMatch = str.match(/PT(\d+(?:\.\d+)?)H/i);
  const minutesMatch = str.match(/(\d+)M/i);
  let totalHours = 0;
  if (hoursMatch) totalHours += parseFloat(hoursMatch[1]);
  if (minutesMatch) totalHours += parseInt(minutesMatch[1], 10) / 60;

  if (totalHours > 0) {
    return Math.max(0, Math.round(totalHours / 8));
  }

  return 1;
}

/**
 * Parses MS Project LinkLag (in tenths of a minute or minutes) to working days.
 * In MSPDI XML, lag is typically represented in tenths of a minute (4800 = 1 day).
 */
export function parseMspLinkLagToDays(lagStr: string | null, lagFormatStr?: string | null): number {
  if (!lagStr) return 0;
  const raw = parseFloat(lagStr);
  if (isNaN(raw) || raw === 0) return 0;

  const lagFormat = lagFormatStr ? parseInt(lagFormatStr, 10) : 7;
  // Format 7 = days, Format 8 = hours
  if (lagFormat === 7) {
    // If integer <= 60, it's already in days
    if (Math.abs(raw) <= 100) return Math.round(raw);
    // Otherwise it's tenths of a minute (4800 tenths = 8 hours = 1 day)
    return Math.round(raw / 4800);
  }
  if (lagFormat === 8) {
    // Hours
    return Math.round(raw / 8);
  }

  // Fallback heuristic: values > 1000 are tenths of minutes
  if (Math.abs(raw) >= 1000) {
    return Math.round(raw / 4800);
  }
  return Math.round(raw);
}

/**
 * Normalizes ISO date string: extracts YYYY-MM-DD.
 */
export function normalizeIsoDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  // Try parsing date string
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return formatDateIso(d);
  }
  return "";
}

// ─── 3. Microsoft Project XML (MSPDI) Parser ──────────────────────────────────

export function parseMspdiXml(
  xmlContent: string,
  fileName = "schedule.xml",
  fileSizeBytes = 0
): ScheduleParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const unsupportedFields: UnsupportedFieldInfo[] = [];

  const projectName =
    extractTagValue(xmlContent, "Title") ||
    extractTagValue(xmlContent, "Name") ||
    fileName.replace(/\.xml$/i, "");

  // 1. Inspect unsupported MS Project enterprise features
  const recurringCount = (xmlContent.match(/<Recurring>\s*1\s*<\/Recurring>/gi) || []).length;
  if (recurringCount > 0) {
    unsupportedFields.push({
      field: "Recurring Task Patterns",
      count: recurringCount,
      description: "MS Project recurring task scheduling rules.",
      treatment: "Expanded into discrete individual tasks with preserved dates.",
    });
  }

  const costRatesCount = (xmlContent.match(/<CostRateTable>/gi) || []).length;
  if (costRatesCount > 0) {
    unsupportedFields.push({
      field: "Cost Rate Tables & Overtime Rates",
      count: costRatesCount,
      description: "Tiered resource hourly billing and overtime rate tables.",
      treatment: "PlanD-X manages schedule and progress; financial rate tables excluded.",
    });
  }

  const workContourCount = (xmlContent.match(/<WorkContour|<TimephasedData/gi) || []).length;
  if (workContourCount > 0) {
    unsupportedFields.push({
      field: "Timephased Work Distribution & Contours",
      count: workContourCount,
      description: "Non-linear work distribution curves (Bell, Back-loaded, Early-peak, Timephased segments).",
      treatment: "Treated as uniform working progress over the activity duration.",
    });
  }

  const splitPartsCount = (xmlContent.match(/<SplitParts>/gi) || []).length;
  if (splitPartsCount > 0) {
    unsupportedFields.push({
      field: "Split Task Segments",
      count: splitPartsCount,
      description: "Interrupted activities split across disconnected time intervals.",
      treatment: "Represented by total elapsed working span between start and finish.",
    });
  }

  const exceptionCount = (xmlContent.match(/<Exception(?:s|\b)/gi) || []).length;
  if (exceptionCount > 0) {
    unsupportedFields.push({
      field: "Custom Calendar Exceptions & Holidays",
      count: exceptionCount,
      description: "MS Project individual calendar holiday and exception schedules.",
      treatment: "Working week pattern retained; custom holidays can be configured in PlanD-X Calendar settings.",
    });
  }

  // 2. Parse Working Calendar
  let calendarName = "Standard 5-Day Week (Mon–Fri)";
  const calendarWorkingDays: number[] = [1, 2, 3, 4, 5];
  const calendarBlock = extractTagValue(xmlContent, "Calendars");
  if (calendarBlock) {
    const calName = extractTagValue(calendarBlock, "Name");
    if (calName) calendarName = calName;

    // Check Saturday working (DayType 7)
    const satBlockMatch = calendarBlock.match(/<DayType>\s*7\s*<\/DayType>[\s\S]*?<DayWorking>\s*1\s*<\/DayWorking>/i);
    if (satBlockMatch && !calendarWorkingDays.includes(6)) {
      calendarWorkingDays.push(6);
    }
  }

  // 3. Parse Resources and Assignments
  const resourceMap = new Map<string, string>(); // UID -> Name
  const resourceBlocks = extractAllBlocks(xmlContent, "Resource");
  for (const rb of resourceBlocks) {
    const uid = extractTagValue(rb, "UID");
    const name = extractTagValue(rb, "Name");
    if (uid && name) {
      resourceMap.set(uid, name);
    }
  }

  const assignmentMap = new Map<string, string[]>(); // TaskUID -> Resource Names
  const assignmentBlocks = extractAllBlocks(xmlContent, "Assignment");
  for (const ab of assignmentBlocks) {
    const taskUid = extractTagValue(ab, "TaskUID");
    const resUid = extractTagValue(ab, "ResourceUID");
    if (taskUid && resUid && resourceMap.has(resUid)) {
      const resName = resourceMap.get(resUid)!;
      const current = assignmentMap.get(taskUid) || [];
      if (!current.includes(resName)) current.push(resName);
      assignmentMap.set(taskUid, current);
    }
  }

  // 4. Parse Tasks
  const taskBlocks = extractAllBlocks(xmlContent, "Task");
  const tasks: ProgrammeTask[] = [];
  const uidToIdMap = new Map<string, string>();
  let dependenciesCount = 0;
  let milestonesCount = 0;
  let baselinedTasksCount = 0;

  // Track parent stack for WBS outline hierarchy
  const hierarchyStack: { level: number; id: string }[] = [];

  for (let idx = 0; idx < taskBlocks.length; idx++) {
    const tb = taskBlocks[idx];
    const uid = extractTagValue(tb, "UID");
    const name = extractTagValue(tb, "Name");

    // Skip root dummy project task if name is empty or UID is 0
    if (!name || uid === "0") continue;

    const wbs =
      extractTagValue(tb, "WBS") ||
      extractTagValue(tb, "OutlineNumber") ||
      String(idx + 1);

    const outlineLevel = parseInt(extractTagValue(tb, "OutlineLevel") || "1", 10);
    const isMilestone = extractTagValue(tb, "Milestone") === "1";
    const isSummary = extractTagValue(tb, "Summary") === "1";
    const isCritical = extractTagValue(tb, "Critical") === "1";
    const percentComplete = parseInt(extractTagValue(tb, "PercentComplete") || "0", 10);

    const rawStart = extractTagValue(tb, "Start");
    const rawFinish = extractTagValue(tb, "Finish");
    const startDate = normalizeIsoDate(rawStart) || "2025-10-15";
    const endDate = normalizeIsoDate(rawFinish) || startDate;

    const durationDays = isMilestone ? 0 : parseMspDurationToDays(extractTagValue(tb, "Duration"));

    // Status calculation
    const status: TaskStatus =
      percentComplete >= 100
        ? "complete"
        : percentComplete > 0
        ? "in-progress"
        : "not-started";

    const taskId = uid ? String(uid) : `task-${idx + 1}`;
    uidToIdMap.set(uid!, taskId);

    // Baseline calculation
    let baseline0Start: string | undefined;
    let baseline0Finish: string | undefined;
    const baselineBlock = extractTagValue(tb, "Baseline");
    if (baselineBlock) {
      baseline0Start = normalizeIsoDate(extractTagValue(baselineBlock, "Start")) || undefined;
      baseline0Finish = normalizeIsoDate(extractTagValue(baselineBlock, "Finish")) || undefined;
      if (baseline0Start && baseline0Finish) {
        baselinedTasksCount++;
      }
    }

    // Determine parent from outlineLevel stack
    while (hierarchyStack.length > 0 && hierarchyStack[hierarchyStack.length - 1].level >= outlineLevel) {
      hierarchyStack.pop();
    }
    const parentId = hierarchyStack.length > 0 ? hierarchyStack[hierarchyStack.length - 1].id : null;
    hierarchyStack.push({ level: outlineLevel, id: taskId });

    // Determine WBSLevel
    const level: WBSLevel = isMilestone
      ? "milestone"
      : isSummary
      ? outlineLevel <= 1
        ? "phase"
        : "work-package"
      : "task";

    if (isMilestone) milestonesCount++;

    // Predecessors will be resolved in a second pass once all UIDs are indexed
    const assignedResources = assignmentMap.get(uid!) || [];
    const subcontractor = assignedResources.length > 0 ? assignedResources.join(", ") : null;

    tasks.push({
      id: taskId,
      wbs,
      name,
      level,
      parentId,
      status,
      startDate,
      endDate,
      duration: durationDays,
      progress: percentComplete,
      trade: "Structural",
      assignee: assignedResources[0] || null,
      subcontractor,
      isCritical,
      isMilestone,
      predecessors: [],
      successors: [],
      predecessorDetails: [],
      successorDetails: [],
      notes: extractTagValue(tb, "Notes") || "",
      children: [],
      depth: outlineLevel - 1,
      float: 0,
      baseline0Start,
      baseline0Finish,
    });
  }

  // Second pass: Parse PredecessorLinks and wire parent-child relationships
  for (let idx = 0; idx < taskBlocks.length; idx++) {
    const tb = taskBlocks[idx];
    const uid = extractTagValue(tb, "UID");
    if (!uid || uid === "0") continue;
    const taskId = uidToIdMap.get(uid);
    const task = tasks.find((t) => t.id === taskId);
    if (!task) continue;

    const predLinks = extractAllBlocks(tb, "PredecessorLink");
    for (const pl of predLinks) {
      const predUid = extractTagValue(pl, "PredecessorUID");
      if (!predUid) continue;
      const predTaskId = uidToIdMap.get(predUid);
      if (!predTaskId) {
        warnings.push(`Task "${task.name}" references non-existent predecessor UID ${predUid}.`);
        continue;
      }

      // Predecessor Link Type: 0=FF, 1=FS, 2=SF, 3=SS
      const typeCode = extractTagValue(pl, "Type") || "1";
      const depType: DependencyType =
        typeCode === "0" ? "FF" : typeCode === "2" ? "SF" : typeCode === "3" ? "SS" : "FS";

      const lagDays = parseMspLinkLagToDays(
        extractTagValue(pl, "LinkLag"),
        extractTagValue(pl, "LagFormat")
      );

      const predTask = tasks.find((t) => t.id === predTaskId);
      const relationText =
        depType === "FS"
          ? "Finishes before this starts (FS)"
          : depType === "SS"
          ? "Starts with this task (SS)"
          : depType === "FF"
          ? "Finishes with this task (FF)"
          : "Starts before this finishes (SF)";

      const detail: DependencyDetail = {
        id: predTaskId,
        name: predTask?.name || predTaskId,
        relation: relationText,
        type: depType,
        lag: lagDays,
      };

      if (!task.predecessors.includes(predTaskId)) {
        task.predecessors.push(predTaskId);
        task.predecessorDetails = task.predecessorDetails || [];
        task.predecessorDetails.push(detail);
        dependenciesCount++;
      }

      // Link successor
      if (predTask) {
        if (!predTask.successors.includes(task.id)) {
          predTask.successors.push(task.id);
          predTask.successorDetails = predTask.successorDetails || [];
          predTask.successorDetails.push({
            id: task.id,
            name: task.name,
            relation: relationText,
            type: depType,
            lag: lagDays,
          });
        }
      }
    }
  }

  // Populate children arrays
  for (const t of tasks) {
    if (t.parentId) {
      const parent = tasks.find((p) => p.id === t.parentId);
      if (parent && !parent.children.includes(t.id)) {
        parent.children.push(t.id);
      }
    }
  }

  if (tasks.length === 0) {
    errors.push("No valid construction tasks were found in the Microsoft Project XML document.");
  }

  return {
    valid: errors.length === 0,
    format: "mspdi-xml",
    fileName,
    fileSizeBytes,
    projectName,
    calendarName,
    calendarWorkingDays,
    tasks,
    resources: Array.from(resourceMap.entries()).map(([id, name]) => ({ id, name })),
    dependenciesCount,
    milestonesCount,
    baselinedTasksCount,
    warnings,
    errors,
    unsupportedFields,
  };
}

// ─── 4. Schedule CSV Parser (Excel & PlanD-X Format) ──────────────────────────

export function parseScheduleCsv(
  csvContent: string,
  fileName = "schedule.csv",
  fileSizeBytes = 0
): ScheduleParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const unsupportedFields: UnsupportedFieldInfo[] = [];

  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return {
      valid: false,
      format: "schedule-csv",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.csv$/i, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings,
      errors: ["The CSV file does not contain a header and task rows."],
      unsupportedFields,
    };
  }

  // Helper to split CSV row handling quotes
  const splitRow = (row: string): string[] => {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '"') {
        if (inQuotes && row[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (c === "," && !inQuotes) {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    cells.push(cur.trim());
    return cells;
  };

  const headerRow = splitRow(lines[0]).map((h) => h.toLowerCase());
  const wbsIdx = headerRow.findIndex((h) => h.includes("wbs") || h === "id" || h.includes("code"));
  const nameIdx = headerRow.findIndex(
    (h) => (h.includes("name") || h === "task" || h === "activity") && !h.includes("id")
  );
  const durationIdx = headerRow.findIndex((h) => h.includes("duration"));
  const startIdx = headerRow.findIndex((h) => h.includes("start"));
  const finishIdx = headerRow.findIndex((h) => h.includes("finish") || h.includes("end"));
  const progressIdx = headerRow.findIndex((h) => h.includes("progress") || h.includes("%"));
  const predIdx = headerRow.findIndex((h) => h.includes("pred"));
  const subIdx = headerRow.findIndex((h) => h.includes("subcontractor") || h.includes("resource") || h.includes("assignee"));
  const baseStartIdx = headerRow.findIndex((h) => h.includes("base") && h.includes("start"));
  const baseFinishIdx = headerRow.findIndex((h) => h.includes("base") && (h.includes("finish") || h.includes("end")));
  const tradeIdx = headerRow.findIndex((h) => h.includes("trade") || h.includes("discipline"));

  if (nameIdx === -1) {
    return {
      valid: false,
      format: "schedule-csv",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.csv$/i, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings,
      errors: ["CSV is missing required 'Task Name' or 'Activity' column."],
      unsupportedFields,
    };
  }

  const tasks: ProgrammeTask[] = [];
  const wbsMap = new Map<string, string>(); // WBS -> TaskID
  let dependenciesCount = 0;
  let milestonesCount = 0;
  let baselinedTasksCount = 0;

  for (let r = 1; r < lines.length; r++) {
    const cells = splitRow(lines[r]);
    const name = cells[nameIdx];
    if (!name) {
      if (cells.some((c) => c.length > 0)) {
        warnings.push(`Row ${r + 1}: Skipped row due to missing task name.`);
      }
      continue;
    }

    const wbs = wbsIdx !== -1 && cells[wbsIdx] ? cells[wbsIdx] : String(r);

    let startDate = startIdx !== -1 && cells[startIdx] ? normalizeIsoDate(cells[startIdx]) : null;
    if (startIdx !== -1 && cells[startIdx] && !startDate) {
      warnings.push(`Row ${r + 1} ("${name}"): Unrecognized start date "${cells[startIdx]}", defaulted to 2025-10-15.`);
      startDate = "2025-10-15";
    }
    if (!startDate) startDate = "2025-10-15";

    let endDate = finishIdx !== -1 && cells[finishIdx] ? normalizeIsoDate(cells[finishIdx]) : null;
    if (finishIdx !== -1 && cells[finishIdx] && !endDate) {
      warnings.push(`Row ${r + 1} ("${name}"): Unrecognized finish date "${cells[finishIdx]}", defaulted to start date.`);
      endDate = startDate;
    }
    if (!endDate) endDate = startDate;

    let duration = 5;
    if (durationIdx !== -1 && cells[durationIdx] !== undefined && cells[durationIdx] !== "") {
      const parsedDur = parseInt(cells[durationIdx], 10);
      if (isNaN(parsedDur) || parsedDur < 0) {
        warnings.push(`Row ${r + 1} ("${name}"): Invalid duration "${cells[durationIdx]}", defaulted to 5 days.`);
        duration = 5;
      } else {
        duration = parsedDur;
      }
    } else if (name.toLowerCase().includes("milestone")) {
      duration = 0;
    }

    let progress = 0;
    if (progressIdx !== -1 && cells[progressIdx] !== undefined && cells[progressIdx] !== "") {
      const parsedProg = parseInt(cells[progressIdx].replace(/%/g, "").trim(), 10);
      if (isNaN(parsedProg)) {
        warnings.push(`Row ${r + 1} ("${name}"): Invalid progress "${cells[progressIdx]}", defaulted to 0%.`);
      } else {
        progress = Math.min(100, Math.max(0, parsedProg));
      }
    }

    const isMilestone = duration === 0 || name.toLowerCase().includes("milestone");

    const baseline0Start = baseStartIdx !== -1 && cells[baseStartIdx] ? normalizeIsoDate(cells[baseStartIdx]) || undefined : undefined;
    const baseline0Finish = baseFinishIdx !== -1 && cells[baseFinishIdx] ? normalizeIsoDate(cells[baseFinishIdx]) || undefined : undefined;
    if (baseline0Start && baseline0Finish) baselinedTasksCount++;
    if (isMilestone) milestonesCount++;

    const taskId = `task-csv-${r}`;
    wbsMap.set(wbs, taskId);

    // Compute outline depth from WBS dots
    const depth = (wbs.match(/\./g) || []).length;
    const level: WBSLevel = isMilestone
      ? "milestone"
      : depth === 0
      ? "programme"
      : depth === 1
      ? "phase"
      : depth === 2
      ? "work-package"
      : "task";

    const status: TaskStatus = progress >= 100 ? "complete" : progress > 0 ? "in-progress" : "not-started";
    const subcontractor = subIdx !== -1 && cells[subIdx] ? cells[subIdx] : null;
    const trade = tradeIdx !== -1 && cells[tradeIdx] ? (cells[tradeIdx] || null) : null;

    tasks.push({
      id: taskId,
      wbs,
      name,
      level,
      parentId: null, // Will resolve from WBS prefix
      status,
      startDate,
      endDate,
      duration,
      progress,
      trade,
      assignee: subcontractor,
      subcontractor,
      isCritical: false,
      isMilestone,
      predecessors: [],
      successors: [],
      predecessorDetails: [],
      successorDetails: [],
      notes: "",
      children: [],
      depth,
      float: 0,
      baseline0Start,
      baseline0Finish,
    });
  }

  // Resolve parentIds from WBS hierarchy: e.g. "3.2.1" has parent "3.2"
  for (const t of tasks) {
    if (t.wbs.includes(".")) {
      const parentWbs = t.wbs.substring(0, t.wbs.lastIndexOf("."));
      const parentId = wbsMap.get(parentWbs);
      if (parentId) {
        t.parentId = parentId;
        const parent = tasks.find((p) => p.id === parentId);
        if (parent && !parent.children.includes(t.id)) parent.children.push(t.id);
      }
    }
  }

  // Parse Predecessors column: e.g. "1.1:FS+2d, 1.2"
  if (predIdx !== -1) {
    for (let r = 1; r < lines.length; r++) {
      const cells = splitRow(lines[r]);
      const predRaw = cells[predIdx];
      if (!predRaw) continue;
      const task = tasks[r - 1];
      if (!task) continue;

      const items = predRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        // Match e.g. "3.2(FS+2d)" or "3.2FS+2d" or "3.2"
        const depMatch = item.match(/^([A-Za-z0-9._-]+)(?:[:(]?([A-Z]{2})?(?:([+-]\d+)[dD]?)?\)?)/);
        if (!depMatch) continue;
        const predWbs = depMatch[1];
        const predId = wbsMap.get(predWbs) || (tasks.find((t) => t.id === predWbs || t.wbs === predWbs)?.id);
        if (!predId) {
          warnings.push(`Task "${task.name}" references unresolved predecessor "${predWbs}".`);
          continue;
        }

        const depType = (depMatch[2] as DependencyType) || "FS";
        const lag = depMatch[3] ? parseInt(depMatch[3], 10) : 0;
        const predTask = tasks.find((t) => t.id === predId);

        if (!task.predecessors.includes(predId)) {
          task.predecessors.push(predId);
          task.predecessorDetails = task.predecessorDetails || [];
          task.predecessorDetails.push({
            id: predId,
            name: predTask?.name || predId,
            relation: `${depType} dependency`,
            type: depType,
            lag,
          });
          dependenciesCount++;
        }
      }
    }
  }

  return {
    valid: tasks.length > 0,
    format: "schedule-csv",
    fileName,
    fileSizeBytes,
    projectName: fileName.replace(/\.csv$/i, ""),
    tasks,
    resources: [],
    dependenciesCount,
    milestonesCount,
    baselinedTasksCount,
    warnings,
    errors,
    unsupportedFields,
  };
}

// ─── 4b. Excel (.xlsx / .xls) Importer ────────────────────────────────────────

export function parseScheduleXlsx(
  buffer: ArrayBuffer | Uint8Array | ArrayBufferLike,
  fileName: string,
  fileSizeBytes: number
): ScheduleParseResult {
  const warnings: string[] = [];
  const errors: string[] = [];
  const unsupportedFields: UnsupportedFieldInfo[] = [];

  let workbook: XLSX.WorkBook;
  try {
    workbook = XLSX.read(buffer, { type: "array" });
  } catch (err: any) {
    return {
      valid: false,
      format: "excel-xlsx",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.[^/.]+$/, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings: [],
      errors: [`Failed to parse Excel workbook: ${err?.message || "Corrupt file"}`],
      unsupportedFields: [],
    };
  }

  // Find best sheet: preferred "Schedule", "Tasks", "Programme", or first sheet
  const sheetName =
    workbook.SheetNames.find((s) => {
      const lower = s.toLowerCase();
      return (
        lower.includes("schedule") ||
        lower.includes("task") ||
        lower.includes("programme") ||
        lower.includes("plan")
      );
    }) || workbook.SheetNames[0];

  if (!sheetName || !workbook.Sheets[sheetName]) {
    return {
      valid: false,
      format: "excel-xlsx",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.[^/.]+$/, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings: [],
      errors: ["The Excel workbook does not contain any readable sheets."],
      unsupportedFields: [],
    };
  }

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<any[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
  });

  if (!rawRows || rawRows.length < 2) {
    return {
      valid: false,
      format: "excel-xlsx",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.[^/.]+$/, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings: [],
      errors: [`Sheet "${sheetName}" does not contain a header and task rows.`],
      unsupportedFields: [],
    };
  }

  // Scan first 10 rows for header row containing task name or activity
  let headerRowIdx = -1;
  let nameIdx = -1;
  let wbsIdx = -1;
  let durationIdx = -1;
  let startIdx = -1;
  let finishIdx = -1;
  let progressIdx = -1;
  let predIdx = -1;
  let subIdx = -1;
  let baseStartIdx = -1;
  let baseFinishIdx = -1;
  let tradeIdx = -1;

  for (let r = 0; r < Math.min(10, rawRows.length); r++) {
    const row = (rawRows[r] || []).map((c) => String(c || "").trim().toLowerCase());
    const nIdx = row.findIndex(
      (h) => (h.includes("name") || h === "task" || h === "activity") && !h.includes("id")
    );
    if (nIdx !== -1) {
      headerRowIdx = r;
      nameIdx = nIdx;
      wbsIdx = row.findIndex((h) => h.includes("wbs") || h === "id" || h.includes("code"));
      durationIdx = row.findIndex((h) => h.includes("duration"));
      startIdx = row.findIndex((h) => h.includes("start"));
      finishIdx = row.findIndex((h) => h.includes("finish") || h.includes("end"));
      progressIdx = row.findIndex((h) => h.includes("progress") || h.includes("%"));
      predIdx = row.findIndex((h) => h.includes("pred"));
      subIdx = row.findIndex(
        (h) =>
          h.includes("subcontractor") ||
          h.includes("resource") ||
          h.includes("assignee")
      );
      baseStartIdx = row.findIndex((h) => h.includes("base") && h.includes("start"));
      baseFinishIdx = row.findIndex(
        (h) => h.includes("base") && (h.includes("finish") || h.includes("end"))
      );
      tradeIdx = row.findIndex(
        (h) => h.includes("trade") || h.includes("discipline")
      );
      break;
    }
  }

  if (headerRowIdx === -1 || nameIdx === -1) {
    return {
      valid: false,
      format: "excel-xlsx",
      fileName,
      fileSizeBytes,
      projectName: fileName.replace(/\.[^/.]+$/, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings,
      errors: [
        "Excel sheet is missing required 'Task Name' or 'Activity' column.",
      ],
      unsupportedFields,
    };
  }

  const tasks: ProgrammeTask[] = [];
  const wbsMap = new Map<string, string>();
  let dependenciesCount = 0;
  let milestonesCount = 0;
  let baselinedTasksCount = 0;

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r] || [];
    const name = String(row[nameIdx] || "").trim();
    if (!name) {
      if (row.some((cell: any) => String(cell || "").trim().length > 0)) {
        warnings.push(`Row ${r + 1}: Skipped row due to missing task name.`);
      }
      continue;
    }

    const wbs =
      wbsIdx !== -1 && row[wbsIdx]
        ? String(row[wbsIdx]).trim()
        : String(tasks.length + 1);

    const rawStart = startIdx !== -1 ? String(row[startIdx] || "").trim() : "";
    let startDate = rawStart ? normalizeIsoDate(rawStart) : null;
    if (rawStart && !startDate) {
      warnings.push(
        `Row ${r + 1} ("${name}"): Unrecognized start date "${rawStart}", defaulted to 2025-10-15.`
      );
      startDate = "2025-10-15";
    }
    if (!startDate) startDate = "2025-10-15";

    const rawFinish = finishIdx !== -1 ? String(row[finishIdx] || "").trim() : "";
    let endDate = rawFinish ? normalizeIsoDate(rawFinish) : null;
    if (rawFinish && !endDate) {
      warnings.push(
        `Row ${r + 1} ("${name}"): Unrecognized finish date "${rawFinish}", defaulted to start date.`
      );
      endDate = startDate;
    }
    if (!endDate) endDate = startDate;

    let duration = 5;
    if (durationIdx !== -1 && row[durationIdx] !== undefined && row[durationIdx] !== "") {
      const parsedDur = parseInt(String(row[durationIdx]), 10);
      if (isNaN(parsedDur) || parsedDur < 0) {
        warnings.push(
          `Row ${r + 1} ("${name}"): Invalid duration "${row[durationIdx]}", defaulted to 5 days.`
        );
        duration = 5;
      } else {
        duration = parsedDur;
      }
    } else if (name.toLowerCase().includes("milestone")) {
      duration = 0;
    }

    let progress = 0;
    if (progressIdx !== -1 && row[progressIdx] !== undefined && row[progressIdx] !== "") {
      const parsedProg = parseInt(
        String(row[progressIdx]).replace(/%/g, "").trim(),
        10
      );
      if (isNaN(parsedProg)) {
        warnings.push(
          `Row ${r + 1} ("${name}"): Invalid progress "${row[progressIdx]}", defaulted to 0%.`
        );
      } else {
        progress = Math.min(100, Math.max(0, parsedProg));
      }
    }

    const isMilestone = duration === 0 || name.toLowerCase().includes("milestone");

    const rawBaseStart =
      baseStartIdx !== -1 ? String(row[baseStartIdx] || "").trim() : "";
    const rawBaseFinish =
      baseFinishIdx !== -1 ? String(row[baseFinishIdx] || "").trim() : "";

    const baseline0Start = rawBaseStart ? normalizeIsoDate(rawBaseStart) || undefined : undefined;
    const baseline0Finish = rawBaseFinish ? normalizeIsoDate(rawBaseFinish) || undefined : undefined;

    if (baseline0Start && baseline0Finish) baselinedTasksCount++;
    if (isMilestone) milestonesCount++;

    const taskId = `task-xlsx-${tasks.length + 1}`;
    wbsMap.set(wbs, taskId);

    const depth = (wbs.match(/\./g) || []).length;
    const level: WBSLevel = isMilestone
      ? "milestone"
      : depth === 0
      ? "programme"
      : depth === 1
      ? "phase"
      : depth === 2
      ? "work-package"
      : "task";

    const status: TaskStatus =
      progress >= 100
        ? "complete"
        : progress > 0
        ? "in-progress"
        : "not-started";

    const subcontractor =
      subIdx !== -1 && row[subIdx] ? String(row[subIdx]).trim() : null;
    const trade =
      tradeIdx !== -1 && row[tradeIdx]
        ? String(row[tradeIdx]).trim() || null
        : null;

    tasks.push({
      id: taskId,
      wbs,
      name,
      level,
      parentId: null,
      status,
      startDate,
      endDate,
      duration,
      progress,
      trade: trade || null,
      assignee: subcontractor,
      subcontractor,
      isCritical: false,
      isMilestone,
      predecessors: [],
      successors: [],
      predecessorDetails: [],
      successorDetails: [],
      notes: "",
      children: [],
      depth,
      float: 0,
      baseline0Start,
      baseline0Finish,
    });
  }

  // Resolve parentIds from WBS hierarchy
  for (const t of tasks) {
    if (t.wbs.includes(".")) {
      const parentWbs = t.wbs.substring(0, t.wbs.lastIndexOf("."));
      const parentId = wbsMap.get(parentWbs);
      if (parentId) {
        t.parentId = parentId;
        const parent = tasks.find((p) => p.id === parentId);
        if (parent && !parent.children.includes(t.id)) parent.children.push(t.id);
      }
    }
  }

  // Parse Predecessors column if present
  if (predIdx !== -1) {
    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r] || [];
      const predRaw = String(row[predIdx] || "").trim();
      if (!predRaw) continue;
      const wbs = wbsIdx !== -1 && row[wbsIdx] ? String(row[wbsIdx]).trim() : "";
      const task = tasks.find((t) => t.wbs === wbs) || tasks[r - headerRowIdx - 1];
      if (!task) continue;

      const items = predRaw.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      for (const item of items) {
        const depMatch = item.match(
          /^([A-Za-z0-9._-]+)(?:[:(]?([A-Z]{2})?(?:([+-]\d+)[dD]?)?\)?)/
        );
        if (!depMatch) continue;
        const predWbs = depMatch[1];
        const predId =
          wbsMap.get(predWbs) ||
          tasks.find((t) => t.id === predWbs || t.wbs === predWbs)?.id;
        if (!predId) {
          warnings.push(
            `Task "${task.name}" references unresolved predecessor "${predWbs}".`
          );
          continue;
        }

        const depType = (depMatch[2] as DependencyType) || "FS";
        const lag = depMatch[3] ? parseInt(depMatch[3], 10) : 0;
        const predTask = tasks.find((t) => t.id === predId);

        if (!task.predecessors.includes(predId)) {
          task.predecessors.push(predId);
          task.predecessorDetails = task.predecessorDetails || [];
          task.predecessorDetails.push({
            id: predId,
            name: predTask?.name || predId,
            relation: `${depType} dependency`,
            type: depType,
            lag,
          });
          dependenciesCount++;
        }
      }
    }
  }

  return {
    valid: tasks.length > 0,
    format: "excel-xlsx",
    fileName,
    fileSizeBytes,
    projectName: fileName.replace(/\.[^/.]+$/, ""),
    tasks,
    resources: [],
    dependenciesCount,
    milestonesCount,
    baselinedTasksCount,
    warnings,
    errors,
    unsupportedFields,
  };
}

// ─── 5. General Schedule Importer with Binary MPP Trap ────────────────────────

export async function parseScheduleFile(
  fileOrContent: File | { name: string; content: string | ArrayBuffer | Uint8Array | ArrayBufferLike }
): Promise<ScheduleParseResult> {
  let fileName = "";
  let sizeBytes = 0;
  let text = "";
  let rawBytes: Uint8Array | null = null;

  if (typeof window !== "undefined" && fileOrContent instanceof File) {
    fileName = fileOrContent.name;
    sizeBytes = fileOrContent.size;
    const buffer = await fileOrContent.arrayBuffer();
    rawBytes = new Uint8Array(buffer);
    text = new TextDecoder().decode(rawBytes);
  } else {
    const f = fileOrContent as { name: string; content: string | ArrayBuffer | Uint8Array | ArrayBufferLike };
    fileName = f.name;
    if (typeof f.content === "string") {
      text = f.content;
      sizeBytes = f.content.length;
      rawBytes = new TextEncoder().encode(f.content);
    } else if (f.content instanceof Uint8Array) {
      rawBytes = f.content;
      sizeBytes = f.content.byteLength;
      text = new TextDecoder().decode(rawBytes);
    } else {
      rawBytes = new Uint8Array(f.content as ArrayBuffer);
      sizeBytes = f.content.byteLength;
      text = new TextDecoder().decode(rawBytes);
    }
  }

  const format = detectScheduleFileFormat(rawBytes || text, fileName);

  // MPP Binary Trap: Provide clear, non-technical guidance
  if (format === "mpp") {
    return {
      valid: false,
      format: "mpp",
      fileName,
      fileSizeBytes: sizeBytes,
      projectName: fileName.replace(/\.mpp$/i, ""),
      tasks: [],
      resources: [],
      dependenciesCount: 0,
      milestonesCount: 0,
      baselinedTasksCount: 0,
      warnings: [],
      errors: [
        "Native Microsoft Project (.mpp) binary file detected. MPP is a closed proprietary Microsoft container.",
      ],
      unsupportedFields: [
        {
          field: "Native Binary Container (.mpp)",
          count: 1,
          description: "Closed binary OLE storage format used by Microsoft desktop client.",
          treatment: "Requires export to standard open MSPDI XML, Excel, or CSV.",
        },
      ],
      mppExplanation: {
        reason:
          "Microsoft Project .mpp files use a proprietary desktop binary format that cannot be reliably decoded in browser environments without loss of structure.",
        howToConvert: [
          "Open your project file in Microsoft Project desktop.",
          "Click File → Save As → Browse...",
          "In the 'Save as type' dropdown, select 'XML Format (*.xml)'.",
          "Save the file and upload the resulting .xml file to PlanD-X for lossless transfer of hierarchy, dependencies, baselines, and calendars.",
        ],
      },
    };
  }

  if (format === "mspdi-xml") {
    return parseMspdiXml(text, fileName, sizeBytes);
  }

  if (format === "schedule-csv") {
    return parseScheduleCsv(text, fileName, sizeBytes);
  }

  if (format === "excel-xlsx") {
    const buf = rawBytes ? rawBytes.buffer : new ArrayBuffer(0);
    return parseScheduleXlsx(buf, fileName, sizeBytes);
  }

  return {
    valid: false,
    format: "unknown",
    fileName,
    fileSizeBytes: sizeBytes,
    projectName: fileName,
    tasks: [],
    resources: [],
    dependenciesCount: 0,
    milestonesCount: 0,
    baselinedTasksCount: 0,
    warnings: [],
    errors: [
      `Unsupported schedule format for file "${fileName}". PlanD-X supports Microsoft Project XML (.xml), Excel (.xlsx), and Schedule CSV (.csv).`,
    ],
    unsupportedFields: [],
  };
}

// ─── 6. Microsoft Project XML (MSPDI) Exporter ────────────────────────────────

export function exportToMspdiXml(
  tasks: ProgrammeTask[],
  calendarOrName: ProjectCalendar | string = STANDARD_5_DAY_CALENDAR,
  projectNameOrCalendar?: string | ProjectCalendar
): string {
  let calendar: ProjectCalendar = STANDARD_5_DAY_CALENDAR;
  let projectName = "PlanD-X Construction Programme";

  if (typeof calendarOrName === "string") {
    projectName = calendarOrName;
    if (projectNameOrCalendar && typeof projectNameOrCalendar === "object" && "workingDays" in projectNameOrCalendar) {
      calendar = projectNameOrCalendar as ProjectCalendar;
    }
  } else if (calendarOrName && typeof calendarOrName === "object") {
    calendar = calendarOrName;
    if (typeof projectNameOrCalendar === "string") {
      projectName = projectNameOrCalendar;
    }
  }

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`);
  lines.push(`<Project xmlns="http://schemas.microsoft.com/project">`);
  lines.push(`  <SaveVersion>14</SaveVersion>`);
  lines.push(`  <Name>${escapeXml(projectName)}</Name>`);
  lines.push(`  <Title>${escapeXml(projectName)}</Title>`);
  lines.push(`  <CreationDate>${new Date().toISOString()}</CreationDate>`);
  lines.push(`  <LastSaved>${new Date().toISOString()}</LastSaved>`);
  lines.push(`  <ScheduleFromStart>1</ScheduleFromStart>`);
  lines.push(`  <CalendarUID>1</CalendarUID>`);
  lines.push(`  <DefaultStartTime>08:00:00</DefaultStartTime>`);
  lines.push(`  <DefaultFinishTime>17:00:00</DefaultFinishTime>`);
  lines.push(`  <MinutesPerDay>480</MinutesPerDay>`);
  lines.push(`  <MinutesPerWeek>${calendar.workingDays.length * 480}</MinutesPerWeek>`);
  lines.push(`  <DaysPerMonth>20</DaysPerMonth>`);

  // Calendars
  lines.push(`  <Calendars>`);
  lines.push(`    <Calendar>`);
  lines.push(`      <UID>1</UID>`);
  lines.push(`      <Name>${escapeXml(calendar.name)}</Name>`);
  lines.push(`      <IsBaseCalendar>1</IsBaseCalendar>`);
  lines.push(`      <WeekDays>`);
  // DayType: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
  for (let day = 0; day <= 6; day++) {
    const isWorking = calendar.workingDays.includes(day);
    const dayType = day === 0 ? 1 : day + 1;
    lines.push(`        <WeekDay>`);
    lines.push(`          <DayType>${dayType}</DayType>`);
    lines.push(`          <DayWorking>${isWorking ? 1 : 0}</DayWorking>`);
    if (isWorking) {
      lines.push(`          <WorkingTimes>`);
      lines.push(`            <WorkingTime>`);
      lines.push(`              <FromTime>08:00:00</FromTime>`);
      lines.push(`              <ToTime>12:00:00</ToTime>`);
      lines.push(`            </WorkingTime>`);
      lines.push(`            <WorkingTime>`);
      lines.push(`              <FromTime>13:00:00</FromTime>`);
      lines.push(`              <ToTime>17:00:00</ToTime>`);
      lines.push(`            </WorkingTime>`);
      lines.push(`          </WorkingTimes>`);
    }
    lines.push(`        </WeekDay>`);
  }
  lines.push(`      </WeekDays>`);
  lines.push(`    </Calendar>`);
  lines.push(`  </Calendars>`);

  // Map Task IDs to numeric UIDs (preserve existing numeric IDs/UIDs where available)
  const idToUidMap = new Map<string, number>();
  const usedUids = new Set<number>();

  tasks.forEach((t) => {
    const match = t.id.match(/\d+/);
    if (match) {
      const num = parseInt(match[0], 10);
      if (num > 0 && !usedUids.has(num)) {
        idToUidMap.set(t.id, num);
        usedUids.add(num);
      }
    }
  });

  let nextUid = 1;
  tasks.forEach((t) => {
    if (!idToUidMap.has(t.id)) {
      while (usedUids.has(nextUid)) nextUid++;
      idToUidMap.set(t.id, nextUid);
      usedUids.add(nextUid);
    }
  });

  // Resources
  const resourceNames = Array.from(
    new Set(tasks.map((t) => t.subcontractor || t.assignee).filter((r): r is string => Boolean(r)))
  );
  const resourceToUidMap = new Map<string, number>();
  lines.push(`  <Resources>`);
  resourceNames.forEach((name, i) => {
    const rUid = i + 1;
    resourceToUidMap.set(name, rUid);
    lines.push(`    <Resource>`);
    lines.push(`      <UID>${rUid}</UID>`);
    lines.push(`      <ID>${rUid}</ID>`);
    lines.push(`      <Name>${escapeXml(name)}</Name>`);
    lines.push(`      <Type>1</Type>`); // Work resource
    lines.push(`    </Resource>`);
  });
  lines.push(`  </Resources>`);

  // Tasks
  lines.push(`  <Tasks>`);
  tasks.forEach((t) => {
    const uid = idToUidMap.get(t.id) || 1;
    const durationHours = t.duration * 8;
    const isSummary = (t.children && t.children.length > 0) || t.level === "phase" || t.level === "programme";
    const outlineLevel = Math.max(1, (t.depth ?? 0) + 1);

    lines.push(`    <Task>`);
    lines.push(`      <UID>${uid}</UID>`);
    lines.push(`      <ID>${uid}</ID>`);
    lines.push(`      <Name>${escapeXml(t.name)}</Name>`);
    lines.push(`      <WBS>${escapeXml(t.wbs)}</WBS>`);
    lines.push(`      <OutlineNumber>${escapeXml(t.wbs)}</OutlineNumber>`);
    lines.push(`      <OutlineLevel>${outlineLevel}</OutlineLevel>`);
    lines.push(`      <Start>${t.startDate}T08:00:00</Start>`);
    lines.push(`      <Finish>${t.endDate}T17:00:00</Finish>`);
    lines.push(`      <Duration>PT${durationHours}H0M0S</Duration>`);
    lines.push(`      <PercentComplete>${t.progress || 0}</PercentComplete>`);
    lines.push(`      <Milestone>${t.isMilestone ? 1 : 0}</Milestone>`);
    lines.push(`      <Summary>${isSummary ? 1 : 0}</Summary>`);
    lines.push(`      <Critical>${t.isCritical ? 1 : 0}</Critical>`);

    // Predecessor Links
    if (t.predecessors && t.predecessors.length > 0) {
      t.predecessors.forEach((pId) => {
        const pUid = idToUidMap.get(pId);
        if (!pUid) return;

        const detail = t.predecessorDetails?.find((d) => d.id === pId);
        const depType = detail?.type || "FS";
        // MS Project Type: 0=FF, 1=FS, 2=SF, 3=SS
        const typeCode = depType === "FF" ? 0 : depType === "SF" ? 2 : depType === "SS" ? 3 : 1;
        const lagDays = detail?.lag || 0;
        const linkLagTenths = lagDays * 4800; // Tenths of minutes

        lines.push(`      <PredecessorLink>`);
        lines.push(`        <PredecessorUID>${pUid}</PredecessorUID>`);
        lines.push(`        <Type>${typeCode}</Type>`);
        lines.push(`        <LinkLag>${linkLagTenths}</LinkLag>`);
        lines.push(`        <LagFormat>7</LagFormat>`);
        lines.push(`      </PredecessorLink>`);
      });
    }

    // Baseline 0
    if (t.baseline0Start && t.baseline0Finish) {
      lines.push(`      <Baseline>`);
      lines.push(`        <Number>0</Number>`);
      lines.push(`        <Start>${t.baseline0Start}T08:00:00</Start>`);
      lines.push(`        <Finish>${t.baseline0Finish}T17:00:00</Finish>`);
      lines.push(`        <Duration>PT${durationHours}H0M0S</Duration>`);
      lines.push(`      </Baseline>`);
    }

    lines.push(`    </Task>`);
  });
  lines.push(`  </Tasks>`);

  // Assignments
  lines.push(`  <Assignments>`);
  let assignUid = 1;
  tasks.forEach((t) => {
    const tUid = idToUidMap.get(t.id);
    const rName = t.subcontractor || t.assignee;
    if (tUid && rName && resourceToUidMap.has(rName)) {
      const rUid = resourceToUidMap.get(rName);
      lines.push(`    <Assignment>`);
      lines.push(`      <UID>${assignUid++}</UID>`);
      lines.push(`      <TaskUID>${tUid}</TaskUID>`);
      lines.push(`      <ResourceUID>${rUid}</ResourceUID>`);
      lines.push(`      <Units>1.0</Units>`);
      lines.push(`    </Assignment>`);
    }
  });
  lines.push(`  </Assignments>`);

  lines.push(`</Project>`);
  return lines.join("\n");
}

function escapeXml(str: any): string {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ─── 7. Schedule CSV Exporter ─────────────────────────────────────────────────

export function exportToScheduleCsv(tasks: ProgrammeTask[]): string {
  const lines: string[] = [];
  lines.push(
    `WBS,Task Name,Duration (Days),Start Date,Finish Date,Progress (%),Status,Predecessors,Baseline 0 Start,Baseline 0 Finish,Subcontractor,Trade,Critical,Milestone`
  );

  for (const t of tasks) {
    const preds = (t.predecessorDetails || [])
      .map((d) => {
        const predTask = tasks.find((item) => item.id === d.id);
        const ref = predTask?.wbs || d.id;
        const type = d.type || "FS";
        const lag = d.lag ? (d.lag > 0 ? `+${d.lag}d` : `${d.lag}d`) : "";
        return `${ref}:${type}${lag}`;
      })
      .join("; ");

    const cells = [
      escapeCsv(t.wbs),
      escapeCsv(t.name),
      String(t.duration),
      t.startDate,
      t.endDate,
      String(t.progress || 0),
      t.status,
      escapeCsv(preds),
      t.baseline0Start || "",
      t.baseline0Finish || "",
      escapeCsv(t.subcontractor || ""),
      escapeCsv(t.trade || ""),
      t.isCritical ? "Yes" : "No",
      t.isMilestone ? "Yes" : "No",
    ];
    lines.push(cells.join(","));
  }

  return lines.join("\n");
}

function escapeCsv(val: any): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// ─── 8. Schedule Excel (.xlsx) Exporter ───────────────────────────────────────

export function exportToScheduleXlsx(
  tasks: ProgrammeTask[],
  projectName = "PlanD-X Schedule"
): Uint8Array {
  const wb = XLSX.utils.book_new();

  const headers = [
    "WBS",
    "Task Name",
    "Duration (Days)",
    "Start Date",
    "Finish Date",
    "Progress (%)",
    "Status",
    "Predecessors",
    "Baseline 0 Start",
    "Baseline 0 Finish",
    "Subcontractor",
    "Trade",
    "Critical",
    "Milestone",
  ];

  const rows = tasks.map((t) => {
    const preds = (t.predecessorDetails || [])
      .map((d) => {
        const predTask = tasks.find((item) => item.id === d.id);
        const ref = predTask?.wbs || d.id;
        const type = d.type || "FS";
        const lag = d.lag ? (d.lag > 0 ? `+${d.lag}d` : `${d.lag}d`) : "";
        return `${ref}:${type}${lag}`;
      })
      .join("; ");

    return [
      t.wbs,
      t.name,
      t.duration,
      t.startDate,
      t.endDate,
      t.progress || 0,
      t.status,
      preds,
      t.baseline0Start || "",
      t.baseline0Finish || "",
      t.subcontractor || "",
      t.trade || "",
      t.isCritical ? "Yes" : "No",
      t.isMilestone ? "Yes" : "No",
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, "Schedule Tasks");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  return new Uint8Array(buf);
}
