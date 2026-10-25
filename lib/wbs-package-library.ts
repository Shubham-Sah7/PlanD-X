/**
 * PlanD-X WBS Work Package Snippet Library & Standard Task Catalog
 * ===============================================================
 * Production library of reusable construction work package templates
 * and standardized activity patterns that can be inserted into any
 * active schedule at any WBS level with automated dependency linking
 * and outline code re-indexing.
 */

import type { ProgrammeTask, Trade, TaskStatus, DependencyType } from "./programme-types";
import { type ProjectCalendar, addWorkingDays, formatDateIso, parseIsoDate, STANDARD_5_DAY_CALENDAR } from "./programme-calendar";

export interface PackageTaskBlueprint {
  offsetDays: number; // working days from package start
  duration: number; // working days
  name: string;
  isMilestone?: boolean;
  trade?: Trade | string;
  relativePredecessorIndex?: number; // 0-indexed reference within this package
  dependencyType?: DependencyType;
  lag?: number;
  cost?: number;
  workHours?: number;
  checklist?: Array<{ id: string; text: string; done: boolean }>;
  notes?: string;
  level?: "task" | "milestone";
}

export interface WBSWorkPackage {
  id: string;
  name: string;
  category: "Substructure" | "Superstructure" | "Envelope" | "MEP" | "Fitout" | "Commissioning";
  trade: string;
  typicalDurationWorkingDays: number;
  description: string;
  tasks: PackageTaskBlueprint[];
}

export interface StandardTaskTemplate {
  id: string;
  name: string;
  category: string;
  trade: Trade | string;
  typicalDuration: number;
  estimatedCost: number;
  workHours: number;
  description: string;
  standardChecklist: string[];
}

export const WBS_WORK_PACKAGES: WBSWorkPackage[] = [
  {
    id: "pkg-substructure",
    name: "Substructure & Deep Piling Package",
    category: "Substructure",
    trade: "Piling & Groundworks",
    typicalDurationWorkingDays: 25,
    description: "CFA continuous flight auger piling, pile head cropping, ground beam excavation, reinforcement and blinding.",
    tasks: [
      {
        offsetDays: 0,
        duration: 8,
        name: "CFA Continuous Flight Auger Piling (600mm dia)",
        trade: "Piling Contractor",
        cost: 65000,
        workHours: 320,
        checklist: [
          { id: "c1", text: "Piling rig inspection & certification verified", done: false },
          { id: "c2", text: "Borehole log depth confirmation", done: false },
          { id: "c3", text: "Concrete cube samples taken per 10 piles", done: false },
        ],
      },
      {
        offsetDays: 8,
        duration: 4,
        name: "Pile Head Cropping & Debonding Foam Removal",
        trade: "Piling Contractor",
        relativePredecessorIndex: 0,
        dependencyType: "FS",
        lag: 0,
        cost: 14000,
        workHours: 120,
      },
      {
        offsetDays: 12,
        duration: 5,
        name: "Excavate & Blind Ground Beams & Pile Caps",
        trade: "Groundworks",
        relativePredecessorIndex: 1,
        dependencyType: "FS",
        lag: 0,
        cost: 22000,
        workHours: 160,
      },
      {
        offsetDays: 17,
        duration: 5,
        name: "Fix Steel Reinforcement & Cast In-Situ Caps",
        trade: "Steel Fixing",
        relativePredecessorIndex: 2,
        dependencyType: "FS",
        lag: 0,
        cost: 38000,
        workHours: 240,
      },
      {
        offsetDays: 22,
        duration: 3,
        name: "Sub-Slab Waterproof Gas Membrane & Perimeter Lap",
        trade: "Waterproofing",
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
        cost: 16000,
        workHours: 80,
      },
      {
        offsetDays: 25,
        duration: 0,
        name: "Substructure Sign-Off & Inspection Complete (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 4,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
  {
    id: "pkg-concrete-core",
    name: "Reinforced Concrete Core & Slab Cycle",
    category: "Superstructure",
    trade: "RC Frame Contractor",
    typicalDurationWorkingDays: 16,
    description: "Self-climbing core shuttering, rebar fixing, post-tensioned deck casting, and test cube crushing.",
    tasks: [
      {
        offsetDays: 0,
        duration: 4,
        name: "Climb Core Wall Formwork & Lift Rig",
        trade: "Formwork",
        cost: 28000,
        workHours: 160,
      },
      {
        offsetDays: 4,
        duration: 3,
        name: "Core Reinforcement Fixing & Cast-in Embeds",
        trade: "Steel Fixing",
        relativePredecessorIndex: 0,
        dependencyType: "FS",
        lag: 0,
        cost: 32000,
        workHours: 180,
      },
      {
        offsetDays: 7,
        duration: 1,
        name: "Core Walls Concrete Pour & Curing",
        trade: "Concrete",
        relativePredecessorIndex: 1,
        dependencyType: "FS",
        lag: 0,
        cost: 18000,
        workHours: 80,
      },
      {
        offsetDays: 8,
        duration: 4,
        name: "Erect Slab Falsework & Plywood Decking",
        trade: "Formwork",
        relativePredecessorIndex: 2,
        dependencyType: "FS",
        lag: 0,
        cost: 35000,
        workHours: 200,
      },
      {
        offsetDays: 12,
        duration: 3,
        name: "Install Top/Bottom Rebar & Post-Tensioned Tendons",
        trade: "Steel Fixing",
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
        cost: 42000,
        workHours: 220,
      },
      {
        offsetDays: 15,
        duration: 1,
        name: "Floor Slab Concrete Pour & Power Float Finish",
        trade: "Concrete",
        relativePredecessorIndex: 4,
        dependencyType: "FS",
        lag: 0,
        cost: 26000,
        workHours: 100,
      },
      {
        offsetDays: 16,
        duration: 0,
        name: "Floor Level Handover to MEP 1st Fix (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 5,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
  {
    id: "pkg-mep-roughin",
    name: "MEP 1st Fix & Services Rough-In",
    category: "MEP",
    trade: "MEP Services",
    typicalDurationWorkingDays: 20,
    description: "Overhead cable trays, primary drainage stacks, domestic water risers, and acoustic ductwork.",
    tasks: [
      {
        offsetDays: 0,
        duration: 6,
        name: "Install Overhead Unistrut & Cable Tray Containment",
        trade: "Electrical",
        cost: 22000,
        workHours: 180,
      },
      {
        offsetDays: 4,
        duration: 7,
        name: "Install Acoustic Soil & Waste Drainage Stacks",
        trade: "Plumbing",
        cost: 26000,
        workHours: 200,
      },
      {
        offsetDays: 8,
        duration: 6,
        name: "Install Primary Supply & Extract Galvanised Ductwork",
        trade: "HVAC",
        relativePredecessorIndex: 0,
        dependencyType: "SS",
        lag: 4,
        cost: 34000,
        workHours: 240,
      },
      {
        offsetDays: 13,
        duration: 5,
        name: "Chilled Water & Heating Pipework Runs",
        trade: "Mechanical",
        relativePredecessorIndex: 2,
        dependencyType: "FS",
        lag: -1,
        cost: 29000,
        workHours: 200,
      },
      {
        offsetDays: 18,
        duration: 2,
        name: "Hydraulic Pressure Testing (10 Bar) & Sign-Off",
        trade: "Plumbing",
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
        cost: 8000,
        workHours: 60,
      },
      {
        offsetDays: 20,
        duration: 0,
        name: "MEP 1st Fix Approved for Ceiling Closure (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 4,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
  {
    id: "pkg-facade-envelope",
    name: "External Envelope & Unitised Curtain Wall",
    category: "Envelope",
    trade: "Façade Specialist",
    typicalDurationWorkingDays: 22,
    description: "Floor cast-in bracket setting, unitised glazed panels crane lifting, firestopping and EPDM weather seal.",
    tasks: [
      {
        offsetDays: 0,
        duration: 5,
        name: "Survey & Fix Cast-in Serrated Edge Brackets",
        trade: "Façade",
        cost: 18000,
        workHours: 120,
      },
      {
        offsetDays: 5,
        duration: 10,
        name: "Floor Floor Crane Hoist Unitised Glazed Panels",
        trade: "Façade",
        relativePredecessorIndex: 0,
        dependencyType: "FS",
        lag: 0,
        cost: 85000,
        workHours: 360,
      },
      {
        offsetDays: 12,
        duration: 6,
        name: "Install Cavity Fire Barriers & Slab Edge Firestop",
        trade: "Fire Protection",
        relativePredecessorIndex: 1,
        dependencyType: "SS",
        lag: 7,
        cost: 24000,
        workHours: 140,
      },
      {
        offsetDays: 17,
        duration: 5,
        name: "Apply External EPDM Vapor Seals & Silicone Mastic",
        trade: "Sealants",
        relativePredecessorIndex: 1,
        dependencyType: "FS",
        lag: 0,
        cost: 14000,
        workHours: 100,
      },
      {
        offsetDays: 22,
        duration: 0,
        name: "Weathertight Envelope Enclosed (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
  {
    id: "pkg-drylining-fitout",
    name: "Internal Drylining & Second Fix Finishes",
    category: "Fitout",
    trade: "Drylining & Finishes",
    typicalDurationWorkingDays: 18,
    description: "Stud partitions, acoustic insulation, double plasterboard, tape and jointing, mist coat.",
    tasks: [
      {
        offsetDays: 0,
        duration: 5,
        name: "Erect 70mm Metal Stud Track & Head Deflection Channels",
        trade: "Drylining",
        cost: 19000,
        workHours: 160,
      },
      {
        offsetDays: 5,
        duration: 4,
        name: "Insert Acoustic Quilt & Single Board Face 1",
        trade: "Drylining",
        relativePredecessorIndex: 0,
        dependencyType: "FS",
        lag: 0,
        cost: 16000,
        workHours: 140,
      },
      {
        offsetDays: 9,
        duration: 4,
        name: "Close Face 2 Plasterboard after In-Wall Inspections",
        trade: "Drylining",
        relativePredecessorIndex: 1,
        dependencyType: "FS",
        lag: 0,
        cost: 18000,
        workHours: 150,
      },
      {
        offsetDays: 13,
        duration: 4,
        name: "Joint Tape, Skim Coat & Mist Coat Priming",
        trade: "Finishes",
        relativePredecessorIndex: 2,
        dependencyType: "FS",
        lag: 0,
        cost: 15000,
        workHours: 130,
      },
      {
        offsetDays: 17,
        duration: 1,
        name: "Snag Inspection for Final Paint & Joinery",
        trade: "Finishes",
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
        cost: 4000,
        workHours: 40,
      },
      {
        offsetDays: 18,
        duration: 0,
        name: "Internal Partitions Ready for Final Trim (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 4,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
  {
    id: "pkg-commissioning",
    name: "Integrated Testing & Commissioning (T&C)",
    category: "Commissioning",
    trade: "Commissioning Authority",
    typicalDurationWorkingDays: 15,
    description: "Building Management System (BMS) point-to-point, ductwork air balancing, cause & effect fire tests.",
    tasks: [
      {
        offsetDays: 0,
        duration: 5,
        name: "BMS Panel Point-to-Point IO Verification",
        trade: "Controls",
        cost: 25000,
        workHours: 120,
      },
      {
        offsetDays: 5,
        duration: 5,
        name: "HVAC Air Balancing & Water Flow Commissioning",
        trade: "Commissioning",
        relativePredecessorIndex: 0,
        dependencyType: "FS",
        lag: 0,
        cost: 28000,
        workHours: 140,
      },
      {
        offsetDays: 10,
        duration: 3,
        name: "Integrated Cause & Effect Black Building Fire Test",
        trade: "Fire & Safety",
        relativePredecessorIndex: 1,
        dependencyType: "FS",
        lag: 0,
        cost: 19000,
        workHours: 90,
      },
      {
        offsetDays: 13,
        duration: 2,
        name: "Building Control & Authority Sign-Off Inspection",
        trade: "Compliance",
        relativePredecessorIndex: 2,
        dependencyType: "FS",
        lag: 0,
        cost: 12000,
        workHours: 50,
      },
      {
        offsetDays: 15,
        duration: 0,
        name: "Practical Completion & Certificate of Occupancy (Milestone)",
        isMilestone: true,
        relativePredecessorIndex: 3,
        dependencyType: "FS",
        lag: 0,
      },
    ],
  },
];

export const STANDARD_TASK_CATALOG: StandardTaskTemplate[] = [
  {
    id: "std-piling-rig",
    name: "Mobilise & Rig CFA Piling Machine",
    category: "Substructure",
    trade: "Piling Contractor",
    typicalDuration: 3,
    estimatedCost: 15000,
    workHours: 72,
    description: "Delivery of plant, piling platform QA load testing, and vertical mast alignment.",
    standardChecklist: ["Working platform certification (BRE 470)", "Underground services permit to dig", "Spill kit in place"],
  },
  {
    id: "std-tower-crane",
    name: "Erect & Commission Tower Crane TC-1",
    category: "Plant & Logistics",
    trade: "Crane Specialist",
    typicalDuration: 4,
    estimatedCost: 45000,
    workHours: 120,
    description: "Mobile assist crane road closure, tower section assembly, tie-in collar, and LOLER proof load test.",
    standardChecklist: ["Road closure permit approved", "Foundation bolt torque certification", "Aviation light operational", "LOLER test certificate issued"],
  },
  {
    id: "std-pre-pour-qa",
    name: "Concrete Pre-Pour Structural QA Inspection",
    category: "Quality Assurance",
    trade: "Resident Engineer",
    typicalDuration: 1,
    estimatedCost: 3500,
    workHours: 16,
    description: "Inspection of rebar laps, cover spacers, cast-in penetrations, stop-ends, and debris clean-out.",
    standardChecklist: ["Cover spacer block density checked", "Cast-in box-outs securely fixed", "Waterstop joint preparation verified", "Debris blown out"],
  },
  {
    id: "std-switchgear-energise",
    name: "HV/LV Main Switchgear Energisation",
    category: "Electrical",
    trade: "Electrical",
    typicalDuration: 2,
    estimatedCost: 18000,
    workHours: 48,
    description: "Utility DNO meter connection, primary breaker insulation test, phase rotation check, and initial live load.",
    standardChecklist: ["DNO connection signoff", "Permit to work (Live Electrical) active", "Arc flash PPE available", "Phase rotation verified L1-L2-L3"],
  },
  {
    id: "std-air-tightness",
    name: "Building Envelope Air Tightness Pressure Test",
    category: "Commissioning",
    trade: "Environmental",
    typicalDuration: 2,
    estimatedCost: 7500,
    workHours: 32,
    description: "Fan pressurisation and depressurisation to verify Part L compliance (<3 m3/(h.m2) at 50 Pa).",
    standardChecklist: ["All external doors and windows sealed", "HVAC dampers closed & taped", "Calibration certificates verified", "Thermal imaging check"],
  },
];

/**
 * Inserts an entire standardized construction work package into a programme
 * under the specified parent phase or work package.
 */
export function insertWBSPackageIntoProgramme(
  currentTasks: ProgrammeTask[],
  packageOrId: WBSWorkPackage | string,
  targetParentId: string | null = null,
  startIsoDateOrCal?: string | ProjectCalendar,
  calendarOpt?: ProjectCalendar
): { updatedTasks: ProgrammeTask[]; createdTasksCount: number; insertedTaskIds: string[] } {
  const pkg: WBSWorkPackage | undefined =
    typeof packageOrId === "string"
      ? WBS_WORK_PACKAGES.find((p) => p.id === packageOrId)
      : packageOrId;

  if (!pkg) {
    return { updatedTasks: currentTasks, createdTasksCount: 0, insertedTaskIds: [] };
  }

  let startIsoDate: string;
  let calendar: ProjectCalendar;

  if (typeof startIsoDateOrCal === "string") {
    startIsoDate = startIsoDateOrCal;
    calendar = calendarOpt || STANDARD_5_DAY_CALENDAR;
  } else if (startIsoDateOrCal && typeof startIsoDateOrCal === "object" && "days" in startIsoDateOrCal) {
    calendar = startIsoDateOrCal as ProjectCalendar;
    startIsoDate = formatDateIso(new Date());
  } else {
    calendar = calendarOpt || STANDARD_5_DAY_CALENDAR;
    startIsoDate = formatDateIso(new Date());
  }

  const timestamp = Date.now();
  const parent = targetParentId ? currentTasks.find((t) => t.id === targetParentId) : null;
  const parentDepth = parent ? parent.depth : 0;
  const parentWbs = parent ? parent.wbs : "";

  // 1. Create Summary Phase/Package Task
  const summaryId = `pkg-${pkg.id}-${timestamp}`;
  const totalDuration = pkg.typicalDurationWorkingDays;
  const summaryEnd = formatDateIso(addWorkingDays(startIsoDate, totalDuration, calendar));

  // 2. Generate tasks with unique generated IDs
  const taskIds: string[] = pkg.tasks.map((_, idx) => `tsk-${pkg.id}-${timestamp}-${idx + 1}`);

  const childTasks: ProgrammeTask[] = pkg.tasks.map((tpl, idx) => {
    const taskId = taskIds[idx];
    const taskStart = formatDateIso(addWorkingDays(startIsoDate, tpl.offsetDays, calendar));
    const taskEnd = tpl.duration === 0 ? taskStart : formatDateIso(addWorkingDays(taskStart, tpl.duration, calendar));

    // Resolve relative predecessor
    const predecessors: string[] = [];
    const predecessorDetails: any[] = [];

    if (tpl.relativePredecessorIndex !== undefined && tpl.relativePredecessorIndex < idx) {
      const predId = taskIds[tpl.relativePredecessorIndex];
      predecessors.push(predId);
      predecessorDetails.push({
        id: predId,
        type: tpl.dependencyType || "FS",
        lag: tpl.lag || 0,
      });
    }

    return {
      id: taskId,
      wbs: `${parentWbs ? parentWbs + "." : ""}${idx + 1}`,
      name: tpl.name,
      level: tpl.isMilestone ? "milestone" : "task",
      parentId: summaryId,
      status: "not-started" as TaskStatus,
      startDate: taskStart,
      endDate: taskEnd,
      displayStart: taskStart,
      displayEnd: taskEnd,
      duration: tpl.duration,
      progress: 0,
      trade: (tpl.trade as Trade) || null,
      assignee: null,
      isCritical: false,
      isMilestone: !!tpl.isMilestone,
      predecessors,
      successors: [],
      predecessorDetails,
      notes: tpl.notes || "",
      children: [],
      depth: parentDepth + 2,
      float: 0,
      cost: tpl.cost || 0,
      workHours: tpl.workHours || (tpl.duration * 8),
      checklist: tpl.checklist || [],
    } as ProgrammeTask;
  });

  const summaryTask: ProgrammeTask = {
    id: summaryId,
    wbs: parentWbs ? `${parentWbs}.${currentTasks.filter((t) => t.parentId === targetParentId).length + 1}` : `${currentTasks.filter((t) => !t.parentId).length + 1}`,
    name: pkg.name,
    level: "work-package",
    parentId: targetParentId,
    status: "not-started",
    startDate: startIsoDate,
    endDate: summaryEnd,
    displayStart: startIsoDate,
    displayEnd: summaryEnd,
    duration: totalDuration,
    progress: 0,
    trade: null,
    assignee: null,
    isCritical: false,
    isMilestone: false,
    summary: true,
    isSummary: true,
    predecessors: [],
    successors: [],
    notes: pkg.description,
    children: taskIds,
    depth: parentDepth + 1,
    float: 0,
  } as ProgrammeTask;

  // Append new tasks and update parent children
  const updated = currentTasks.map((t) => {
    if (t.id === targetParentId) {
      return {
        ...t,
        children: [...(t.children || []), summaryId],
      };
    }
    return t;
  });

  updated.push(summaryTask, ...childTasks);

  return {
    updatedTasks: updated,
    createdTasksCount: childTasks.length + 1,
    insertedTaskIds: [summaryId, ...taskIds],
  };
}

export const WBS_PACKAGE_TEMPLATES = WBS_WORK_PACKAGES;

