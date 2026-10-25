// PlanD-X Subcontractor & Resource Directory
// ===========================================
// Supports Labour (Work), Equipment (Plant), Material, and Cost resources,
// capacity and availability limits, rate-based cost calculations, and strict
// distinction between Resource Assignment, Subcontractor Responsibility, and Site Attendance.

import { INITIAL_VENDORS_AND_TEAM } from "@/data/mock-programme";
import type {
  ProgrammeTask,
  ProjectResource,
  ResourceType,
  TaskResourceAssignment,
  SiteAttendanceRecord,
} from "./programme-types";

export interface AssignableResource {
  id: string;
  type: "vendor" | "user";
  name: string;
  initials: string;
  color: string;
  trades?: string;
  phone?: string;
  email?: string;
  badgeLabel?: string;
}

// Master catalogue of available Subcontractors and Project Resources
export const MASTER_SUBCONTRACTORS: AssignableResource[] = [
  {
    id: "vendor-furzer",
    type: "vendor",
    name: "Furzer Electrical",
    initials: "FE",
    color: "#b45309",
    trades: "Electrical & Data",
    phone: "0413 555 666",
    email: "frank@furzerelec.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-geotech",
    type: "vendor",
    name: "GeoTech Piling",
    initials: "GP",
    color: "#c2410c",
    trades: "Civil, Piling & Shoring",
    phone: "0413 111 222",
    email: "george@geotechpiling.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-kpa",
    type: "vendor",
    name: "KPA Structural",
    initials: "KS",
    color: "#ca8a04",
    trades: "Structural Steel & Concrete",
    phone: "0413 333 444",
    email: "karen@kpastructural.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-jk-mohr",
    type: "vendor",
    name: "JK MOHR PTY LTD",
    initials: "JM",
    color: "#d97706",
    trades: "Masonry & Blockwork",
    phone: "0413 888 777",
    email: "admin@jkmohr.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-ironbark",
    type: "vendor",
    name: "Ironbark",
    initials: "IB",
    color: "#9a3412",
    trades: "Landscaping & Civil Works",
    phone: "0413 999 000",
    email: "ops@ironbark.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-apex",
    type: "vendor",
    name: "Apex Groundworks",
    initials: "AG",
    color: "#059669",
    trades: "Groundworks & Bulk Excavation",
    phone: "0412 123 456",
    email: "contracts@apexgroundworks.com.au",
    badgeLabel: "Subcontractor",
  },
  {
    id: "vendor-main",
    type: "vendor",
    name: "Main Contractor",
    initials: "MC",
    color: "#2563eb",
    trades: "Principal Contractor",
    phone: "0412 888 999",
    email: "site@maincontractor.com.au",
    badgeLabel: "Main Contractor",
  },
];

export const MASTER_TEAM_MEMBERS: AssignableResource[] = [
  {
    id: "user-demo",
    type: "user",
    name: "Demo Builder",
    initials: "DB",
    color: "#3b82f6",
    trades: "Construction Management",
    phone: "0412 888 999",
    email: "builder@ormistonrise.com.au",
    badgeLabel: "Project Team",
  },
  {
    id: "user-rachit",
    type: "user",
    name: "Rachit Agarwal",
    initials: "RA",
    color: "#8b5cf6",
    trades: "Project Director",
    phone: "0412 777 666",
    email: "rachit@nurpam.com",
    badgeLabel: "Project Team",
  },
  {
    id: "user-sarah-j",
    type: "user",
    name: "Sarah Jenkins",
    initials: "SJ",
    color: "#ec4899",
    trades: "Contract Administration",
    phone: "0412 333 222",
    email: "sarah.j@ormistonrise.com.au",
    badgeLabel: "Project Team",
  },
  {
    id: "user-john-s",
    type: "user",
    name: "John Smith",
    initials: "JS",
    color: "#2563eb",
    trades: "Site Supervision",
    badgeLabel: "Site Team",
  },
  {
    id: "user-paul-t",
    type: "user",
    name: "Paul Turner",
    initials: "PT",
    color: "#7c3aed",
    trades: "Structural Engineering",
    badgeLabel: "Engineering",
  },
  {
    id: "user-sarah-c",
    type: "user",
    name: "Sarah Carter",
    initials: "SC",
    color: "#db2777",
    trades: "M&E Coordination",
    badgeLabel: "Engineering",
  },
  {
    id: "user-mike-j",
    type: "user",
    name: "Mike Johnson",
    initials: "MJ",
    color: "#4f46e5",
    trades: "Groundworks Supervision",
    badgeLabel: "Site Team",
  },
  {
    id: "user-ryan-w",
    type: "user",
    name: "Ryan Wilson",
    initials: "RW",
    color: "#e11d48",
    trades: "Foundations Specialist",
    badgeLabel: "Site Team",
  },
  {
    id: "user-emma-c",
    type: "user",
    name: "Emma Collins",
    initials: "EC",
    color: "#d97706",
    trades: "Project Engineering",
    badgeLabel: "Engineering",
  },
  {
    id: "user-david-w",
    type: "user",
    name: "David Wilson",
    initials: "DW",
    color: "#0d9488",
    trades: "Superstructure Lead",
    badgeLabel: "Site Team",
  },
  {
    id: "user-tom-h",
    type: "user",
    name: "Tom Harris",
    initials: "TH",
    color: "#059669",
    trades: "Enabling Works Lead",
    badgeLabel: "Site Team",
  },
];

export const ALL_ASSIGNABLE_RESOURCES: AssignableResource[] = [
  ...MASTER_SUBCONTRACTORS,
  ...MASTER_TEAM_MEMBERS,
];

// ─── 1. First-Class Multi-Type Project Resources ──────────────────────────────
// Supports Labour (Work), Equipment (Plant), Material, and Cost

export const DEFAULT_PROJECT_RESOURCES: ProjectResource[] = [
  // ── Labour / Crews (Work) ──
  {
    id: "res-labour-carpenter",
    name: "Formwork & Carpentry Gang",
    type: "work",
    category: "labour",
    initials: "FC",
    color: "#ca8a04",
    trade: "Carpentry & Formwork",
    maxUnits: 2.0, // 200% capacity (2 gangs available)
    standardRate: 85, // $85/hr
    overtimeRate: 125,
    isVerifiedVendor: false,
    notes: "Site carpentry and shuttering team.",
  },
  {
    id: "res-labour-steelfixer",
    name: "Steelfixing Operatives",
    type: "work",
    category: "labour",
    initials: "SF",
    color: "#b45309",
    trade: "Steel Reinforcement",
    maxUnits: 2.0, // 200% capacity
    standardRate: 90,
    overtimeRate: 135,
    isVerifiedVendor: false,
    notes: "Rebar fabrication and tying gang.",
  },
  {
    id: "res-labour-concreter",
    name: "Concrete Placement Crew",
    type: "work",
    category: "labour",
    initials: "CP",
    color: "#0d9488",
    trade: "Concrete",
    maxUnits: 3.0, // 300% capacity
    standardRate: 80,
    overtimeRate: 120,
    isVerifiedVendor: false,
    notes: "Pour, screed, vibration, and power floating.",
  },
  {
    id: "res-labour-electrician",
    name: "Furzer Electrical Team",
    type: "work",
    category: "labour",
    initials: "FE",
    color: "#b45309",
    trade: "Electrical",
    maxUnits: 1.0, // 100% capacity
    standardRate: 95,
    overtimeRate: 140,
    isVerifiedVendor: true,
    vendorRecordId: "vendor-furzer",
    email: "frank@furzerelec.com.au",
    phone: "0413 555 666",
    notes: "First fix, second fix, containment and risers.",
  },
  {
    id: "res-labour-piling-crew",
    name: "GeoTech Piling Specialists",
    type: "work",
    category: "labour",
    initials: "GP",
    color: "#c2410c",
    trade: "Piling",
    maxUnits: 1.0,
    standardRate: 110,
    overtimeRate: 160,
    isVerifiedVendor: true,
    vendorRecordId: "vendor-geotech",
    email: "george@geotechpiling.com.au",
    phone: "0413 111 222",
    notes: "CFA piling rig operators and banksmen.",
  },
  {
    id: "res-labour-kpa-structural",
    name: "KPA Structural Erector Crew",
    type: "work",
    category: "labour",
    initials: "KS",
    color: "#ca8a04",
    trade: "Structural Steel",
    maxUnits: 1.0,
    standardRate: 105,
    overtimeRate: 155,
    isVerifiedVendor: true,
    vendorRecordId: "vendor-kpa",
    email: "karen@kpastructural.com.au",
    phone: "0413 333 444",
    notes: "Structural steel erection, bolt-up and rigging.",
  },
  {
    id: "res-labour-site-engineer",
    name: "Site Setting-Out Engineer",
    type: "work",
    category: "labour",
    initials: "SE",
    color: "#2563eb",
    trade: "Engineering",
    maxUnits: 1.0,
    standardRate: 120,
    overtimeRate: 170,
    isVerifiedVendor: false,
    notes: "Total station survey, GPS datums, gridlines.",
  },

  // ── Equipment / Plant (Heavy Machinery) ──
  {
    id: "res-equip-piling-rig",
    name: "CFA Piling Rig Bauer BG28",
    type: "equipment",
    category: "equipment",
    initials: "BG",
    color: "#ea580c",
    trade: "Piling & Groundworks",
    maxUnits: 1.0, // only 1 rig on site
    standardRate: 380, // $380/hr operating rate
    costPerUse: 4500, // $4,500 mobilization / demob fee
    isVerifiedVendor: false,
    notes: "Continuous Flight Auger rig with 28m drilling depth.",
  },
  {
    id: "res-equip-tower-crane",
    name: "Favelle Favco Tower Crane #1",
    type: "equipment",
    category: "equipment",
    initials: "TC",
    color: "#4f46e5",
    trade: "Cranage & Lifting",
    maxUnits: 1.0, // 1 tower crane serving Building 2
    standardRate: 260, // $260/hr
    costPerUse: 8500, // $8,500 base erection fee
    isVerifiedVendor: false,
    notes: "Max jib radius 55m, 12-tonne capacity at 20m.",
  },
  {
    id: "res-equip-excavator-35t",
    name: "35-Tonne Excavator CAT 336",
    type: "equipment",
    category: "equipment",
    initials: "EX",
    color: "#16a34a",
    trade: "Earthworks",
    maxUnits: 2.0, // 2 machines on site
    standardRate: 185,
    costPerUse: 1200,
    isVerifiedVendor: false,
    notes: "Bulk excavation, loading 8-wheeler tippers.",
  },
  {
    id: "res-equip-concrete-pump",
    name: "Schwing Concrete Boom Pump 42m",
    type: "equipment",
    category: "equipment",
    initials: "CP",
    color: "#0891b2",
    trade: "Concrete Placement",
    maxUnits: 1.0,
    standardRate: 220,
    costPerUse: 1500,
    isVerifiedVendor: false,
    notes: "Roll-and-fold boom for slab and column pours.",
  },
  {
    id: "res-equip-mobile-crane",
    name: "Liebherr 100t Mobile Crane",
    type: "equipment",
    category: "equipment",
    initials: "MC",
    color: "#9333ea",
    trade: "Heavy Lifting",
    maxUnits: 1.0,
    standardRate: 295,
    costPerUse: 2500,
    isVerifiedVendor: false,
    notes: "On-demand mobile crane for precast element offloading.",
  },

  // ── Material Resources ──
  {
    id: "res-mat-concrete-32mpa",
    name: "Ready-Mix Concrete 32MPa",
    type: "material",
    category: "material",
    initials: "RM",
    color: "#64748b",
    trade: "Materials",
    maxUnits: 1.0,
    standardRate: 195, // $195 per m3
    unitOfMeasure: "m3",
    isVerifiedVendor: false,
    notes: "Certified structural mix design N32.",
  },
  {
    id: "res-mat-rebar-500n",
    name: "Deformed Reinforcing Steel 500N",
    type: "material",
    category: "material",
    initials: "RB",
    color: "#475569",
    trade: "Materials",
    maxUnits: 1.0,
    standardRate: 1650, // $1,650 per tonne
    unitOfMeasure: "tonnes",
    isVerifiedVendor: false,
    notes: "Cut and bent rebar bundles.",
  },

  // ── Cost Resources ──
  {
    id: "res-cost-subcontract",
    name: "Specialist Subcontract Lump-Sum Packages",
    type: "cost",
    category: "cost",
    initials: "SC",
    color: "#0284c7",
    trade: "Commercial Packages",
    maxUnits: 1.0,
    standardRate: 1,
    isVerifiedVendor: false,
    notes: "Contractual fixed-price commercial packages.",
  },
];

export function getSubcontractors(): AssignableResource[] {
  return MASTER_SUBCONTRACTORS;
}

export function getTeamMembers(): AssignableResource[] {
  return MASTER_TEAM_MEMBERS;
}

export function getAllAssignableResources(): AssignableResource[] {
  return ALL_ASSIGNABLE_RESOURCES;
}

export function getProjectResources(): ProjectResource[] {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("plandx_project_resources");
      if (stored) return JSON.parse(stored);
    } catch {}
  }
  return DEFAULT_PROJECT_RESOURCES;
}

export function saveProjectResources(resources: ProjectResource[]): void {
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("plandx_project_resources", JSON.stringify(resources));
    } catch {}
  }
}

export function findProjectResourceById(
  id: string,
  resources: ProjectResource[] = DEFAULT_PROJECT_RESOURCES
): ProjectResource | undefined {
  return resources.find((r) => r.id === id);
}

export function findProjectResourceByName(
  name: string | null | undefined,
  resources: ProjectResource[] = DEFAULT_PROJECT_RESOURCES
): ProjectResource | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return resources.find(
    (r) => r.name.toLowerCase() === clean || r.initials.toLowerCase() === clean
  );
}

export function findResourceByName(
  name: string | null | undefined,
): AssignableResource | undefined {
  if (!name) return undefined;
  const clean = name.trim().toLowerCase();
  return ALL_ASSIGNABLE_RESOURCES.find(
    (r) => r.name.toLowerCase() === clean || r.initials.toLowerCase() === clean,
  );
}

export function getResourceInitials(name: string): string {
  const resource = findResourceByName(name);
  if (resource) return resource.initials;
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function getResourceColor(nameOrInitials: string): string {
  const resource = findResourceByName(nameOrInitials);
  if (resource) return resource.color;
  const colors = [
    "#2563eb",
    "#7c3aed",
    "#db2777",
    "#c2410c",
    "#059669",
    "#d97706",
    "#4f46e5",
    "#0d9488",
  ];
  let hash = 0;
  for (let i = 0; i < nameOrInitials.length; i++) {
    hash = nameOrInitials.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

// ─── 2. Rate-Based Calculations & Work Hours ──────────────────────────────────

/**
 * Calculates planned work hours for an assignment based on task duration,
 * working hours per day (default: 8h), and assignment units (1.0 = 100%).
 */
export function calculateAssignmentPlannedWork(
  durationDays: number,
  workingHoursPerDay: number = 8,
  units: number = 1.0
): number {
  return Math.round(durationDays * workingHoursPerDay * units * 10) / 10;
}

/**
 * Calculates rate-based financial cost for an assignment:
 * Cost = (Planned Work Hours * Standard Rate) + (Overtime Hours * Overtime Rate) + Cost Per Use
 */
export function calculateAssignmentCost(
  plannedWorkHours: number,
  standardRate: number = 0,
  overtimeHours: number = 0,
  overtimeRate: number = 0,
  costPerUse: number = 0
): number {
  const baseCost = plannedWorkHours * standardRate;
  const otCost = overtimeHours * overtimeRate;
  return Math.round((baseCost + otCost + costPerUse) * 100) / 100;
}

/**
 * Creates a valid TaskResourceAssignment record.
 */
export function createTaskAssignment(
  resource: ProjectResource,
  units: number = 1.0,
  durationDays: number = 5,
  workingHoursPerDay: number = 8
): TaskResourceAssignment {
  const plannedWorkHours = calculateAssignmentPlannedWork(durationDays, workingHoursPerDay, units);
  const cost = calculateAssignmentCost(
    plannedWorkHours,
    resource.standardRate || 0,
    0,
    resource.overtimeRate || 0,
    resource.costPerUse || 0
  );

  return {
    assignmentId: `asgn-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    resourceId: resource.id,
    resourceName: resource.name,
    resourceType: resource.type,
    units,
    plannedWorkHours,
    actualWorkHours: 0,
    remainingWorkHours: plannedWorkHours,
    standardRate: resource.standardRate,
    cost,
  };
}

/**
 * Computes rolled-up task work hours and financial cost across all assignments.
 */
export function calculateTaskResourceRollups(
  task: ProgrammeTask,
  assignments?: TaskResourceAssignment[]
): {
  workHours: number;
  actualWorkHours: number;
  remainingWorkHours: number;
  cost: number;
} {
  const asgns = assignments || task.assignments || [];
  if (asgns.length === 0) {
    const defaultHours = Math.round((task.duration || 1) * 8 * 10) / 10;
    const progress = Math.max(0, Math.min(100, task.progress || 0));
    const actualHours = Math.round(defaultHours * (progress / 100) * 10) / 10;
    return {
      workHours: task.workHours ?? defaultHours,
      actualWorkHours: task.actualWorkHours ?? actualHours,
      remainingWorkHours: task.remainingWorkHours ?? Math.round((defaultHours - actualHours) * 10) / 10,
      cost: task.cost ?? 0,
    };
  }

  let totalPlannedWork = 0;
  let totalActualWork = 0;
  let totalRemainingWork = 0;
  let totalCost = 0;

  for (const a of asgns) {
    totalPlannedWork += a.plannedWorkHours;
    totalActualWork += a.actualWorkHours;
    totalRemainingWork += a.remainingWorkHours;
    totalCost += a.cost;
  }

  return {
    workHours: Math.round(totalPlannedWork * 10) / 10,
    actualWorkHours: Math.round(totalActualWork * 10) / 10,
    remainingWorkHours: Math.round(totalRemainingWork * 10) / 10,
    cost: Math.round(totalCost * 100) / 100,
  };
}

// ─── 3. Strict Distinction: Assignment vs Subcontractor vs Site Attendance ────
// In real commercial construction:
// - Resource Assignment: Specific labour gangs & plant equipment executing hours (e.g. CFA Rig #1, Carpenter Gang)
// - Subcontractor Responsibility: Commercial legal vendor under subcontract (e.g. GeoTech Piling Pty Ltd)
// - Site Attendance: Physical site verification of headcount on a specific day

export interface TaskResourceDistinction {
  taskId: string;
  taskName: string;
  // 1. Resource Assignments
  assignedResources: Array<{
    id: string;
    name: string;
    type: ResourceType;
    units: number;
    hours: number;
  }>;
  // 2. Subcontractor Responsibility
  subcontractor: {
    name: string | null;
    isVerifiedVendor: boolean;
    vendorRecordId?: string;
    trade: string | null;
  };
  // 3. Actual Site Attendance
  siteAttendance: {
    hasRecords: boolean;
    latestDate?: string;
    latestHeadcount?: number;
    verifiedBy?: string;
    recordsCount: number;
  };
}

export function distinguishTaskResources(
  task: ProgrammeTask,
  allResources: ProjectResource[] = DEFAULT_PROJECT_RESOURCES
): TaskResourceDistinction {
  // 1. Assigned Resources
  const assignedResources = (task.assignments || []).map((a) => ({
    id: a.resourceId,
    name: a.resourceName,
    type: a.resourceType,
    units: a.units,
    hours: a.plannedWorkHours,
  }));

  // Fallback if no explicit assignments array, but assignee or assignedResources string exists
  if (assignedResources.length === 0) {
    const rawName = task.assignee || task.subcontractor || (task.assignedResources && task.assignedResources[0]);
    if (rawName) {
      const matched = findProjectResourceByName(rawName, allResources);
      assignedResources.push({
        id: matched?.id || `res-raw-${rawName}`,
        name: rawName,
        type: matched?.type || "work",
        units: task.assignmentUnits || 1.0,
        hours: task.workHours || (task.duration || 1) * 8,
      });
    }
  }

  // 2. Subcontractor Responsibility
  const subName = task.subcontractor || (typeof task.trade === "string" ? null : null);
  const matchedVendor = MASTER_SUBCONTRACTORS.find(
    (v) => v.name.toLowerCase() === (subName || "").toLowerCase()
  );

  const isVerified = Boolean(task.isSubcontractorVerified || matchedVendor);

  // 3. Site Attendance
  const attendanceList = task.siteAttendance || [];
  const latestAttendance = attendanceList[attendanceList.length - 1];

  return {
    taskId: task.id,
    taskName: task.name,
    assignedResources,
    subcontractor: {
      name: subName,
      isVerifiedVendor: isVerified,
      vendorRecordId: task.subcontractorRecordId || matchedVendor?.id,
      trade: (typeof task.trade === "string" ? task.trade : task.tradeText) || null,
    },
    siteAttendance: {
      hasRecords: attendanceList.length > 0,
      latestDate: latestAttendance?.date,
      latestHeadcount: latestAttendance?.headcount,
      verifiedBy: latestAttendance?.verifiedBy,
      recordsCount: attendanceList.length,
    },
  };
}

// ─── 4. Calculation Limitations Transparency Documentation ───────────────────
// PlanD-X clearly communicates calculation capabilities and boundaries:

export interface CalculationLimitationInfo {
  feature: string;
  status: "supported" | "simplified" | "unsupported";
  supportedBehavior: string;
  unsupportedLimitation: string;
  recommendation: string;
}

export function getResourceCalculationLimitations(): CalculationLimitationInfo[] {
  return [
    {
      feature: "Resource Work Contouring (Bell, Early/Late Peak, Turtle Curves)",
      status: "simplified",
      supportedBehavior:
        "Uniform linear distribution of planned work hours evenly across active calendar working days.",
      unsupportedLimitation:
        "Non-linear curved contour profiles (e.g. S-curve, Bell contour, Front-Loaded) are not evaluated natively.",
      recommendation:
        "For complex variable-load tasks, split into distinct phases (Preparation, Peak Pour, Curing) with individual duration and staffing.",
    },
    {
      feature: "Multi-Project Cross-Site Resource Pooling",
      status: "simplified",
      supportedBehavior:
        "Workload aggregation and over-allocation analysis within the active project programme.",
      unsupportedLimitation:
        "Cross-project leveling between separate construction sites requires portfolio multi-tenancy integration.",
      recommendation:
        "Manage shared corporate plant (e.g. Tower Cranes, Concrete Pumps) within the primary building master schedule.",
    },
    {
      feature: "Mid-Task Splitting & Segmented Resumption",
      status: "simplified",
      supportedBehavior:
        "Schedule leveling shifts whole activities forward to the next available working period to avoid contention.",
      unsupportedLimitation:
        "Splitting a single activity into discontinuous segments (pause on Monday, resume on Thursday) is not performed.",
      recommendation:
        "Model planned work stoppages as explicit milestone handovers or separate consecutive tasks.",
    },
  ];
}
