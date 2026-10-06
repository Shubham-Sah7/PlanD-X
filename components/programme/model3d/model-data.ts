// ─── Model 3D Programme Data ──────────────────────────────────────────────────
// Spatial programme management connecting building elements directly to tasks

export type TaskStatus = "complete" | "in-progress" | "blocked" | "not-started";
export type ElementType = "slab" | "columns" | "core" | "walls" | "beams" | "stairs" | "facade" | "plant" | "ground";
export type BuildingLevel = string; // Supports dynamic levels (Basement, Ground, Level 1..N, Mezzanine, Roof)
export type TradeType = "Structural" | "M&E" | "Façade" | "Finishes" | "Civils" | "Management" | "Substructure" | "Design";
export type ViewMode3D = "3d" | "2d" | "top";
export type ElementFilter = "all" | "columns" | "slabs" | "walls" | "beams" | "core" | "stairs";
export type NavMode = "levels" | "disciplines" | "work-packages";
export type AttentionType = "blocked" | "overdue" | "critical" | "due-this-week";

export type VisualizationMode =
  | "status"        // Programme task status (Green = complete, Blue = in progress, Red = blocked, Slate = not started)
  | "schedule"      // Schedule variance (Green = on-time, Amber = at-risk, Red = delayed)
  | "progress"      // Progress % gradient (100% Emerald, 50-99% Royal Blue, 1-49% Light Blue, 0% Muted)
  | "critical-path" // Isolate and highlight critical path, ghost non-critical work
  | "upcoming"      // Upcoming 7/14 days site activities
  | "baseline";     // Planned baseline vs current actual variance

export type DisciplineType = "all" | "Structure" | "Architecture" | "MEP" | "Finishes";

export interface DrawingRef {
  code: string;
  name: string;
}

export interface ModelElement {
  id: string;
  wbs: string;
  name: string;
  shortName: string;
  level: BuildingLevel;
  elementType: ElementType;
  status: TaskStatus;
  progress: number;
  startDate: string;
  endDate: string;
  displayStart: string;
  displayEnd: string;
  duration: number;
  trade: TradeType;
  assignee: string;
  assigneeInitials: string;
  isCritical: boolean;
  isBlocked?: boolean;
  isOverdue?: boolean;
  isDueThisWeek?: boolean;
  blockedBy?: string;
  float: number;
  predecessors: string[];
  description: string;
  notes: string;
  phase: string;
  drawing?: DrawingRef;
  // Spatial Programme Metadata
  building?: string;
  zone?: string;
  discipline?: "Structure" | "Architecture" | "MEP" | "Finishes";
  varianceDays?: number; // negative = delay, 0 = on-time, positive = ahead
  isUpcoming?: boolean;
  isMilestone?: boolean;
  milestoneLabel?: string;
  has3D?: boolean;
  noTaskMapped?: boolean; // edge case: 3D geometry exists but no schedule task mapped
}

export interface TimelinePhase {
  id: string;
  index: number;
  label: string;
  startMonth: number; // 0 = Sep 2025
  durationMonths: number;
  status: TaskStatus;
  elementIds: string[];
  level?: BuildingLevel;
}

export interface FloorConfig {
  id: string;
  name: string;
  shortName: string;
  elevation: number;
  height: number;
  isBasement?: boolean;
  isRoof?: boolean;
  isMezzanine?: boolean;
  width?: number;
  depth?: number;
  zones: string[];
  status: TaskStatus;
  progress: number;
  tasksCount: number;
  delayedCount: number;
  criticalCount: number;
  tradeBreakdown?: {
    structure: number;
    architecture: number;
    mep: number;
    finishes: number;
  };
}

export interface ProjectModelPreset {
  id: string;
  name: string;
  building: string;
  category: "Residential" | "Commercial" | "Industrial" | "Healthcare" | "Villa";
  description: string;
  levels: string[];
  floors: FloorConfig[];
  zones: string[];
  disciplines: string[];
  buildings: string[];
  totalTasks: number;
  completePercent: number;
  overdueTasks: number;
  blockedTasks: number;
  dueThisWeek: number;
  forecast: string;
  modelAvailable: boolean;
  hasCrane?: boolean;
}

export interface SavedProgrammeView {
  id: string;
  name: string;
  description: string;
  level: string;
  zone?: string;
  discipline?: DisciplineType;
  visMode: VisualizationMode;
  sectionMode?: boolean;
}

export const SAVED_PROGRAMME_VIEWS: SavedProgrammeView[] = [
  {
    id: "view-default",
    name: "Level 2 Active Superstructure",
    description: "Active columns pour and core wall inspection on Level 2",
    level: "Level 2",
    visMode: "status",
  },
  {
    id: "view-critical",
    name: "Critical Path Inspection",
    description: "Highlight only driving activities on the critical schedule path",
    level: "Level 2",
    visMode: "critical-path",
  },
  {
    id: "view-delayed",
    name: "Delayed & At-Risk Work",
    description: "Identifies delayed areas (core wall pour sign-off hold point)",
    level: "Level 2",
    visMode: "schedule",
  },
  {
    id: "view-lookahead",
    name: "Upcoming 7 Days Lookahead",
    description: "Site activities starting or due in the immediate 7-day lookahead window",
    level: "Level 2",
    visMode: "upcoming",
  },
  {
    id: "view-progress",
    name: "Overall Progress Heatmap",
    description: "Gradient visualization from completed ground floor to future roof deck",
    level: "Level 2",
    visMode: "progress",
  },
  {
    id: "view-structure",
    name: "Structure Trade Programme",
    description: "Isolates reinforced concrete columns, slabs, and core shear walls",
    level: "Level 2",
    discipline: "Structure",
    visMode: "status",
  },
];

export const PROJECT_PRESETS: ProjectModelPreset[] = [
  {
    id: "ormiston-rise",
    name: "Ormiston Rise",
    building: "Building 2 & Unit 80",
    category: "Residential",
    description: "Multi-storey residential apartment building with reinforced concrete structural frame and perimeter columns.",
    levels: ["Roof", "Level 4", "Level 3", "Level 2", "Level 1", "Ground", "Basement 1"],
    floors: [
      {
        id: "Roof",
        name: "Roof Deck",
        shortName: "RF",
        elevation: 16.0,
        height: 3.4,
        isRoof: true,
        zones: ["Roof Deck", "Plant Room", "Lift Overrun"],
        status: "not-started",
        progress: 0,
        tasksCount: 24,
        delayedCount: 0,
        criticalCount: 1,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 4",
        name: "Level 4",
        shortName: "L4",
        elevation: 12.8,
        height: 3.2,
        zones: ["East Wing", "West Wing", "Central Core"],
        status: "not-started",
        progress: 0,
        tasksCount: 38,
        delayedCount: 0,
        criticalCount: 2,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 3",
        name: "Level 3",
        shortName: "L3",
        elevation: 9.6,
        height: 3.2,
        zones: ["East Wing", "West Wing", "Central Core"],
        status: "not-started",
        progress: 0,
        tasksCount: 46,
        delayedCount: 0,
        criticalCount: 3,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 2",
        name: "Level 2",
        shortName: "L2",
        elevation: 6.4,
        height: 3.2,
        zones: ["East Wing", "West Wing", "Central Core"],
        status: "in-progress",
        progress: 60,
        tasksCount: 52,
        delayedCount: 2,
        criticalCount: 4,
        tradeBreakdown: { structure: 60, architecture: 15, mep: 10, finishes: 0 },
      },
      {
        id: "Level 1",
        name: "Level 1",
        shortName: "L1",
        elevation: 3.2,
        height: 3.2,
        zones: ["East Wing", "West Wing", "Central Core"],
        status: "complete",
        progress: 100,
        tasksCount: 48,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 85, mep: 75, finishes: 40 },
      },
      {
        id: "Ground",
        name: "Ground Floor",
        shortName: "G",
        elevation: 0,
        height: 3.2,
        zones: ["East Wing", "West Wing", "Central Core"],
        status: "complete",
        progress: 100,
        tasksCount: 42,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 95, mep: 90, finishes: 80 },
      },
      {
        id: "Basement 1",
        name: "Basement 1",
        shortName: "B1",
        elevation: -3.2,
        height: 3.2,
        isBasement: true,
        zones: ["Parking Bay A", "Plant Enclosure", "Substructure Core"],
        status: "complete",
        progress: 100,
        tasksCount: 18,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 100, mep: 100, finishes: 100 },
      },
    ],
    zones: ["East Wing", "West Wing", "Central Core"],
    disciplines: ["Structure", "Architecture", "MEP", "Finishes"],
    buildings: ["Building 2 & Unit 80"],
    totalTasks: 817,
    completePercent: 48,
    overdueTasks: 5,
    blockedTasks: 3,
    dueThisWeek: 12,
    forecast: "01 Sep 2025 – 15 Nov 2026",
    modelAvailable: true,
    hasCrane: true,
  },
  {
    id: "metro-tower",
    name: "Metro Commercial Tower",
    building: "Tower A & Podium",
    category: "Commercial",
    description: "Central commercial office tower with perimeter structural columns and jump-formed core.",
    levels: ["Roof", "Level 4", "Level 3", "Level 2", "Level 1", "Ground", "Basement 1"],
    floors: [
      {
        id: "Roof",
        name: "Plant Penthouse",
        shortName: "RF",
        elevation: 16.0,
        height: 3.5,
        isRoof: true,
        zones: ["Rooftop Plant", "BMS Chiller Deck"],
        status: "not-started",
        progress: 0,
        tasksCount: 30,
        delayedCount: 0,
        criticalCount: 1,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 4",
        name: "Level 4 Office",
        shortName: "L4",
        elevation: 12.8,
        height: 3.2,
        zones: ["Tower Core", "Floorplate North", "Floorplate South"],
        status: "not-started",
        progress: 0,
        tasksCount: 50,
        delayedCount: 0,
        criticalCount: 2,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 3",
        name: "Level 3 Office",
        shortName: "L3",
        elevation: 9.6,
        height: 3.2,
        zones: ["Tower Core", "Floorplate North", "Floorplate South"],
        status: "not-started",
        progress: 0,
        tasksCount: 55,
        delayedCount: 0,
        criticalCount: 2,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 2",
        name: "Level 2 Office",
        shortName: "L2",
        elevation: 6.4,
        height: 3.2,
        zones: ["Tower Core", "Floorplate North", "Floorplate South"],
        status: "in-progress",
        progress: 35,
        tasksCount: 65,
        delayedCount: 3,
        criticalCount: 4,
        tradeBreakdown: { structure: 50, architecture: 10, mep: 15, finishes: 0 },
      },
      {
        id: "Level 1",
        name: "Level 1 Podium",
        shortName: "L1",
        elevation: 3.2,
        height: 3.2,
        zones: ["Podium Retail", "Tower Core", "Terrace"],
        status: "complete",
        progress: 100,
        tasksCount: 70,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 80, mep: 70, finishes: 50 },
      },
      {
        id: "Ground",
        name: "Ground Lobby",
        shortName: "G",
        elevation: 0,
        height: 3.2,
        zones: ["Main Lobby", "Podium Retail", "Loading Bay"],
        status: "complete",
        progress: 100,
        tasksCount: 80,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 90, mep: 85, finishes: 60 },
      },
      {
        id: "Basement 1",
        name: "Basement Parking",
        shortName: "B1",
        elevation: -3.2,
        height: 3.2,
        isBasement: true,
        zones: ["Car Park", "End of Trip", "Electrical Substation"],
        status: "complete",
        progress: 100,
        tasksCount: 35,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 100, mep: 95, finishes: 90 },
      },
    ],
    zones: ["Tower Core", "Floorplate North", "Floorplate South", "Podium Retail"],
    disciplines: ["Structure", "Architecture", "MEP", "Finishes"],
    buildings: ["Tower A", "Podium"],
    totalTasks: 1240,
    completePercent: 32,
    overdueTasks: 8,
    blockedTasks: 4,
    dueThisWeek: 19,
    forecast: "15 Oct 2025 – 28 Feb 2027",
    modelAvailable: true,
    hasCrane: true,
  },
  {
    id: "apex-logistics",
    name: "Apex Logistics Hub",
    building: "Distribution Centre 1",
    category: "Industrial",
    description: "High-bay industrial logistics warehouse with heavy reinforced slab, portal frames, and office mezzanine.",
    levels: ["Roof", "Level 1", "Ground"],
    floors: [
      {
        id: "Roof",
        name: "High-Bay Roof Deck",
        shortName: "RF",
        elevation: 10.5,
        height: 2.8,
        isRoof: true,
        zones: ["Solar Array Deck", "Smoke Vents"],
        status: "not-started",
        progress: 0,
        tasksCount: 16,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 1",
        name: "Admin Mezzanine",
        shortName: "L1",
        elevation: 5.5,
        height: 5.0,
        isMezzanine: true,
        zones: ["Office Mezzanine", "Control Centre"],
        status: "in-progress",
        progress: 55,
        tasksCount: 28,
        delayedCount: 1,
        criticalCount: 2,
        tradeBreakdown: { structure: 75, architecture: 40, mep: 35, finishes: 20 },
      },
      {
        id: "Ground",
        name: "Warehouse High-Bay Floor",
        shortName: "G",
        elevation: 0,
        height: 5.5,
        zones: ["High-bay Warehouse", "Loading Docks", "Dock Levelers"],
        status: "complete",
        progress: 100,
        tasksCount: 45,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 90, mep: 70, finishes: 60 },
      },
    ],
    zones: ["High-bay Warehouse", "Loading Docks", "Admin Mezzanine"],
    disciplines: ["Structure", "Architecture", "MEP"],
    buildings: ["Distribution Centre 1"],
    totalTasks: 410,
    completePercent: 65,
    overdueTasks: 2,
    blockedTasks: 1,
    dueThisWeek: 8,
    forecast: "01 Aug 2025 – 30 May 2026",
    modelAvailable: true,
    hasCrane: false,
  },
  {
    id: "civic-centre",
    name: "Civic Health & Education",
    building: "East Clinical Wing",
    category: "Healthcare",
    description: "Institutional clinical healthcare facility with specialized acoustic isolation and high-density services routing.",
    levels: ["Roof", "Level 3", "Level 2", "Level 1", "Ground"],
    floors: [
      {
        id: "Roof",
        name: "Roof Plant Deck",
        shortName: "RF",
        elevation: 13.0,
        height: 3.0,
        isRoof: true,
        zones: ["Medical Gas Plant", "Air Handling Units"],
        status: "not-started",
        progress: 0,
        tasksCount: 22,
        delayedCount: 0,
        criticalCount: 1,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 3",
        name: "Level 3 Inpatient",
        shortName: "L3",
        elevation: 9.6,
        height: 3.4,
        zones: ["Inpatient Ward", "Central Nurses Core"],
        status: "not-started",
        progress: 0,
        tasksCount: 42,
        delayedCount: 0,
        criticalCount: 2,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 2",
        name: "Level 2 Theatres & Diagnostics",
        shortName: "L2",
        elevation: 6.4,
        height: 3.2,
        zones: ["Operating Theatres", "Sterile Core", "Recovery"],
        status: "in-progress",
        progress: 45,
        tasksCount: 58,
        delayedCount: 2,
        criticalCount: 3,
        tradeBreakdown: { structure: 65, architecture: 25, mep: 30, finishes: 10 },
      },
      {
        id: "Level 1",
        name: "Level 1 Consultations",
        shortName: "L1",
        elevation: 3.2,
        height: 3.2,
        zones: ["Outpatient Clinics", "Pathology Lab"],
        status: "complete",
        progress: 100,
        tasksCount: 52,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 90, mep: 85, finishes: 70 },
      },
      {
        id: "Ground",
        name: "Ground Emergency & Triage",
        shortName: "G",
        elevation: 0,
        height: 3.2,
        zones: ["Emergency Intake", "Ambulance Bay", "Public Atrium"],
        status: "complete",
        progress: 100,
        tasksCount: 60,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 95, mep: 90, finishes: 85 },
      },
    ],
    zones: ["Clinical Inpatient", "Diagnostics Hub", "Public Atrium"],
    disciplines: ["Structure", "Architecture", "MEP", "Finishes"],
    buildings: ["East Clinical Wing"],
    totalTasks: 950,
    completePercent: 41,
    overdueTasks: 6,
    blockedTasks: 5,
    dueThisWeek: 14,
    forecast: "01 Sep 2025 – 10 Dec 2026",
    modelAvailable: true,
    hasCrane: true,
  },
  {
    id: "palm-villa",
    name: "Palm Luxury Villa",
    building: "Main Residence",
    category: "Villa",
    description: "Two-storey luxury residential residence with open-span living pavilion and cantilevered concrete roof canopy.",
    levels: ["Roof", "Level 1", "Ground"],
    floors: [
      {
        id: "Roof",
        name: "Roof Terrace",
        shortName: "RF",
        elevation: 6.6,
        height: 2.8,
        isRoof: true,
        zones: ["Pergola Terrace", "Solar Canopy"],
        status: "not-started",
        progress: 0,
        tasksCount: 12,
        delayedCount: 0,
        criticalCount: 1,
        tradeBreakdown: { structure: 0, architecture: 0, mep: 0, finishes: 0 },
      },
      {
        id: "Level 1",
        name: "Level 1 Bedrooms",
        shortName: "L1",
        elevation: 3.4,
        height: 3.2,
        zones: ["Master Bedroom", "Balcony Wing"],
        status: "in-progress",
        progress: 40,
        tasksCount: 22,
        delayedCount: 1,
        criticalCount: 2,
        tradeBreakdown: { structure: 70, architecture: 35, mep: 25, finishes: 10 },
      },
      {
        id: "Ground",
        name: "Ground Living Pavilion",
        shortName: "G",
        elevation: 0,
        height: 3.4,
        zones: ["Living Room", "Courtyard Garden", "Poolside"],
        status: "complete",
        progress: 100,
        tasksCount: 28,
        delayedCount: 0,
        criticalCount: 0,
        tradeBreakdown: { structure: 100, architecture: 90, mep: 90, finishes: 80 },
      },
    ],
    zones: ["Living Pavilion", "Master Suite", "Courtyard Garden"],
    disciplines: ["Structure", "Architecture", "MEP", "Finishes"],
    buildings: ["Main Residence"],
    totalTasks: 215,
    completePercent: 54,
    overdueTasks: 1,
    blockedTasks: 1,
    dueThisWeek: 5,
    forecast: "10 Nov 2025 – 20 Jun 2026",
    modelAvailable: true,
    hasCrane: false,
  },
  {
    id: "project-no-bim",
    name: "Harbour Point Works",
    building: "Civil Works Package",
    category: "Commercial",
    description: "Civil infrastructure and seawall stabilization works without building geometry.",
    levels: ["Ground"],
    floors: [],
    zones: ["Site Boundary", "Seawall"],
    disciplines: ["Civils", "Substructure"],
    buildings: ["Site Civils"],
    totalTasks: 110,
    completePercent: 20,
    overdueTasks: 0,
    blockedTasks: 0,
    dueThisWeek: 3,
    forecast: "01 Jan 2026 – 30 Aug 2026",
    modelAvailable: false,
    hasCrane: false,
  },
];

export const STATUS_CONFIG: Record<TaskStatus, {
  fill: string;
  stroke: string;
  light: string;
  dark: string;
  text: string;
  label: string;
  hex: number;
}> = {
  "complete":    { fill: "#10b981", stroke: "#059669", light: "#ecfdf5", dark: "#065f46", text: "#065f46", label: "Completed",   hex: 0x10b981 },
  "in-progress": { fill: "#2563eb", stroke: "#1d4ed8", light: "#eff6ff", dark: "#1e40af", text: "#1e40af", label: "In Progress", hex: 0x2563eb },
  "blocked":     { fill: "#ef4444", stroke: "#dc2626", light: "#fef2f2", dark: "#991b1b", text: "#991b1b", label: "Blocked",     hex: 0xef4444 },
  "not-started": { fill: "#94a3b8", stroke: "#64748b", light: "#f1f5f9", dark: "#475569", text: "#475569", label: "Not Started", hex: 0xd1d5db },
};

// ─── Programme Elements Data ──────────────────────────────────────────────────

export const MODEL_ELEMENTS: ModelElement[] = [
  // GROUND
  {
    id: "PRG-001", wbs: "2.1.1", name: "Ground Floor Slab", shortName: "Ground Slab",
    level: "Ground", elementType: "slab", status: "complete", progress: 100,
    startDate: "2025-10-01", endDate: "2025-10-14", displayStart: "01 Oct 2025", displayEnd: "14 Oct 2025", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: [],
    description: "Ground floor slab pour including preparation, formwork, reinforcement, and concrete placement.",
    notes: "Achieved 42 MPa at 28 days. All hold points cleared.",
    phase: "earthworks",
    drawing: { code: "ST-001", name: "Structural Foundation & Ground Slab" },
  },
  {
    id: "PRG-002", wbs: "2.1.2", name: "Ground Floor Columns", shortName: "GF Columns",
    level: "Ground", elementType: "columns", status: "complete", progress: 100,
    startDate: "2025-10-15", endDate: "2025-10-25", displayStart: "15 Oct 2025", displayEnd: "25 Oct 2025", duration: 8,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-001"],
    description: "Ground floor RC columns — 400x400mm grid arrangement.",
    notes: "All 12 columns cast and stripped. Inspection passed.",
    phase: "superstructure",
  },
  {
    id: "PRG-003", wbs: "2.1.3", name: "Ground Floor Core Walls", shortName: "GF Core",
    level: "Ground", elementType: "core", status: "complete", progress: 100,
    startDate: "2025-10-18", endDate: "2025-11-01", displayStart: "18 Oct 2025", displayEnd: "01 Nov 2025", duration: 10,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: true, float: 0, predecessors: ["PRG-001"],
    description: "Lift and stair core walls using jump form system.",
    notes: "Jump form erected and operational.",
    phase: "superstructure",
  },
  {
    id: "PRG-004", wbs: "2.1.4", name: "Ground Floor Beams", shortName: "GF Beams",
    level: "Ground", elementType: "beams", status: "complete", progress: 100,
    startDate: "2025-10-20", endDate: "2025-11-02", displayStart: "20 Oct 2025", displayEnd: "02 Nov 2025", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: false, float: 3, predecessors: ["PRG-001"],
    description: "Ground tie beams and grade beams.",
    notes: "Inspection passed.",
    phase: "superstructure",
  },
  // LEVEL 1
  {
    id: "PRG-010", wbs: "2.2.1", name: "Level 1 – Slab", shortName: "Level 1 – Slab",
    level: "Level 1", elementType: "slab", status: "complete", progress: 100,
    startDate: "2025-11-03", endDate: "2025-11-15", displayStart: "03 Nov 2025", displayEnd: "15 Nov 2025", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-002", "PRG-003"],
    description: "Level 1 flat slab — 300mm post-tensioned suspended slab. 100% complete.",
    notes: "Achieved 40 MPa. All stressing complete.",
    phase: "level-1",
    drawing: { code: "ST-101", name: "Structural Plan - Level 1" },
  },
  {
    id: "PRG-011", wbs: "2.2.2", name: "Level 1 Columns", shortName: "L1 Columns",
    level: "Level 1", elementType: "columns", status: "complete", progress: 100,
    startDate: "2025-11-16", endDate: "2025-11-28", displayStart: "16 Nov 2025", displayEnd: "28 Nov 2025", duration: 9,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-010"],
    description: "Level 1 reinforced concrete columns.",
    notes: "Complete.",
    phase: "level-1",
  },
  {
    id: "PRG-012", wbs: "2.2.3", name: "Level 1 Core Walls", shortName: "L1 Core",
    level: "Level 1", elementType: "core", status: "complete", progress: 100,
    startDate: "2025-11-10", endDate: "2025-11-26", displayStart: "10 Nov 2025", displayEnd: "26 Nov 2025", duration: 12,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: true, float: 0, predecessors: ["PRG-010"],
    description: "Level 1 core walls jumped from ground form.",
    notes: "Jump form jumped and in position for Level 2.",
    phase: "level-1",
  },
  {
    id: "PRG-014", wbs: "2.2.4", name: "Level 1 Beams", shortName: "L1 Beams",
    level: "Level 1", elementType: "beams", status: "complete", progress: 100,
    startDate: "2025-11-12", endDate: "2025-11-24", displayStart: "12 Nov 2025", displayEnd: "24 Nov 2025", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-010"],
    description: "Perimeter and drop beams on Level 1.",
    notes: "All cured and forms stripped.",
    phase: "level-1",
  },
  {
    id: "PRG-015", wbs: "2.2.5", name: "Level 1 Walls", shortName: "L1 Walls",
    level: "Level 1", elementType: "walls", status: "complete", progress: 100,
    startDate: "2025-11-18", endDate: "2025-11-30", displayStart: "18 Nov 2025", displayEnd: "30 Nov 2025", duration: 10,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: false, float: 3, predecessors: ["PRG-010"],
    description: "Internal concrete shear and partition walls.",
    notes: "Completed on schedule.",
    phase: "level-1",
  },
  {
    id: "PRG-013", wbs: "2.2.6", name: "Level 1 Façade", shortName: "L1 Façade",
    level: "Level 1", elementType: "facade", status: "complete", progress: 100,
    startDate: "2025-12-01", endDate: "2025-12-14", displayStart: "01 Dec 2025", displayEnd: "14 Dec 2025", duration: 10,
    trade: "Façade", assignee: "Pete Brown", assigneeInitials: "PB",
    isCritical: false, float: 5, predecessors: ["PRG-011"],
    description: "Curtain wall framing and cladding — Level 1.",
    notes: "Facade complete and weathertight.",
    phase: "facade",
  },
  // LEVEL 2 — ACTIVE IN FOCUS (Requirement 11, 13, 14)
  {
    id: "PRG-020", wbs: "2.3.1", name: "Level 2 Slab", shortName: "Level 2 Slab",
    level: "Level 2", elementType: "slab", status: "not-started", progress: 0,
    startDate: "2026-01-18", endDate: "2026-01-30", displayStart: "18 Jan 2026", displayEnd: "30 Jan 2026", duration: 10,
    trade: "Structural", assignee: "S. Kumar", assigneeInitials: "SK",
    isCritical: true, float: 0, predecessors: ["PRG-021"],
    description: "Level 2 suspended slab pour. Rebar ordering pending column completion.",
    notes: "Not started. Awaiting completion of Level 2 columns and core wall pour sign-off.",
    phase: "level-2",
    drawing: { code: "ST-102", name: "Structural Plan - Level 2" },
  },
  {
    id: "PRG-021", wbs: "2.3.2", name: "Level 2 - Columns", shortName: "Level 2 – Columns",
    level: "Level 2", elementType: "columns", status: "in-progress", progress: 60,
    startDate: "2025-12-20", endDate: "2026-01-16", displayStart: "20 Dec 2025", displayEnd: "16 Jan 2026", duration: 12,
    trade: "Structural", assignee: "S. Kumar", assigneeInitials: "SK",
    isCritical: true, float: 0, predecessors: ["PRG-010"],
    isDueThisWeek: true,
    description: "Formwork verticality, rebar cover, and concrete mix slump verified against structural CAD model.",
    notes: "6 of 10 columns cast and stripped. Remaining 4 in progress this week. Pour planned Thursday.",
    phase: "level-2",
    drawing: { code: "ST-102", name: "Structural Plan - Level 2" },
  },
  {
    id: "PRG-022", wbs: "2.3.3", name: "Core Wall", shortName: "Core Wall",
    level: "Level 2", elementType: "core", status: "blocked", progress: 45, isBlocked: true,
    startDate: "2025-12-15", endDate: "2026-01-20", displayStart: "15 Dec 2025", displayEnd: "20 Jan 2026", duration: 14,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: true, float: 0, predecessors: ["PRG-010"],
    blockedBy: "Awaiting pour approval",
    description: "Central elevator and services core wall on Level 2. Awaiting structural engineer pour sign-off.",
    notes: "Jump form in position. North & West walls done. East & South walls awaiting hold-point approval.",
    phase: "level-2",
    drawing: { code: "ST-102", name: "Structural Plan - Level 2" },
  },
  {
    id: "PRG-025", wbs: "2.3.4", name: "Level 2 Beams", shortName: "Level 2 Beams",
    level: "Level 2", elementType: "beams", status: "in-progress", progress: 40,
    startDate: "2025-12-28", endDate: "2026-01-18", displayStart: "28 Dec 2025", displayEnd: "18 Jan 2026", duration: 12,
    trade: "Structural", assignee: "S. Kumar", assigneeInitials: "SK",
    isCritical: true, float: 0, predecessors: ["PRG-021"],
    description: "Perimeter structural tie-beams and drop panels on Level 2.",
    notes: "Formwork partially erected.",
    phase: "level-2",
    drawing: { code: "ST-102", name: "Structural Plan - Level 2" },
  },
  {
    id: "PRG-026", wbs: "2.3.5", name: "Level 2 Walls", shortName: "Level 2 Walls",
    level: "Level 2", elementType: "walls", status: "not-started", progress: 0,
    startDate: "2026-01-16", endDate: "2026-01-28", displayStart: "16 Jan 2026", displayEnd: "28 Jan 2026", duration: 10,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: false, float: 4, predecessors: ["PRG-021"],
    description: "Shear walls and stair enclosure walls on Level 2.",
    notes: "Pending column strip.",
    phase: "level-2",
  },
  {
    id: "PRG-023", wbs: "2.3.6", name: "Level 2 Façade", shortName: "L2 Façade",
    level: "Level 2", elementType: "facade", status: "blocked", progress: 0, isBlocked: true,
    startDate: "2026-01-12", endDate: "2026-01-30", displayStart: "12 Jan 2026", displayEnd: "30 Jan 2026", duration: 14,
    trade: "Façade", assignee: "Pete Brown", assigneeInitials: "PB",
    isCritical: false, float: 4, predecessors: ["PRG-021"],
    blockedBy: "PRG-021 must reach 75% before facade clips can be fixed to columns.",
    description: "Curtain wall framing and cladding — Level 2. Cannot start until columns at 75%.",
    notes: "On hold until columns complete. Subcontractor notified. Material on site.",
    phase: "facade",
  },
  {
    id: "PRG-024", wbs: "2.3.7", name: "Level 2 Stairs", shortName: "Level 2 Stairs",
    level: "Level 2", elementType: "stairs", status: "not-started", progress: 0,
    startDate: "2026-01-22", endDate: "2026-02-05", displayStart: "22 Jan 2026", displayEnd: "05 Feb 2026", duration: 12,
    trade: "Structural", assignee: "S. Kumar", assigneeInitials: "SK",
    isCritical: false, float: 8, predecessors: ["PRG-022"],
    description: "Precast stair flights — Level 2. Delivery scheduled 20 Jan.",
    notes: "Precast flights ordered. Delivery 20 Jan.",
    phase: "level-2",
  },
  // LEVEL 3
  {
    id: "PRG-030", wbs: "2.4.1", name: "Level 3 Slab", shortName: "L3 Slab",
    level: "Level 3", elementType: "slab", status: "not-started", progress: 0,
    startDate: "2026-01-20", endDate: "2026-02-03", displayStart: "20 Jan 2026", displayEnd: "03 Feb 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-021", "PRG-022"],
    description: "Level 3 flat slab — dependent on L2 columns and core.",
    notes: "Cannot pour until L2 columns and core complete. Formwork booked.",
    phase: "level-3",
  },
  {
    id: "PRG-031", wbs: "2.4.2", name: "Level 3 Columns", shortName: "L3 Columns",
    level: "Level 3", elementType: "columns", status: "not-started", progress: 0,
    startDate: "2026-02-04", endDate: "2026-02-18", displayStart: "04 Feb 2026", displayEnd: "18 Feb 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-030"],
    description: "Level 3 columns above Level 3 slab.",
    notes: "Reo ordered.",
    phase: "level-3",
  },
  {
    id: "PRG-032", wbs: "2.4.3", name: "Level 3 Core Walls", shortName: "L3 Core",
    level: "Level 3", elementType: "core", status: "not-started", progress: 0,
    startDate: "2026-02-01", endDate: "2026-02-15", displayStart: "01 Feb 2026", displayEnd: "15 Feb 2026", duration: 10,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: true, float: 0, predecessors: ["PRG-030"],
    description: "Level 3 core walls continued from jump form.",
    notes: "Jump form to be jumped from Level 2 on completion.",
    phase: "level-3",
  },
  {
    id: "PRG-034", wbs: "2.4.4", name: "Level 3 Beams", shortName: "L3 Beams",
    level: "Level 3", elementType: "beams", status: "not-started", progress: 0,
    startDate: "2026-02-05", endDate: "2026-02-19", displayStart: "05 Feb 2026", displayEnd: "19 Feb 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: false, float: 2, predecessors: ["PRG-030"],
    description: "Perimeter structural beams on Level 3.",
    notes: "",
    phase: "level-3",
  },
  {
    id: "PRG-035", wbs: "2.4.5", name: "Level 3 Walls", shortName: "L3 Walls",
    level: "Level 3", elementType: "walls", status: "not-started", progress: 0,
    startDate: "2026-02-08", endDate: "2026-02-22", displayStart: "08 Feb 2026", displayEnd: "22 Feb 2026", duration: 10,
    trade: "Structural", assignee: "Rachel Taylor", assigneeInitials: "RT",
    isCritical: false, float: 4, predecessors: ["PRG-030"],
    description: "Internal shear partitions on Level 3.",
    notes: "",
    phase: "level-3",
  },
  {
    id: "PRG-033", wbs: "2.4.6", name: "Level 3 M&E Rough-in", shortName: "L3 M&E",
    level: "Level 3", elementType: "walls", status: "not-started", progress: 0,
    startDate: "2026-02-10", endDate: "2026-03-05", displayStart: "10 Feb 2026", displayEnd: "05 Mar 2026", duration: 18,
    trade: "M&E", assignee: "Tony Jones", assigneeInitials: "TJ",
    isCritical: false, float: 10, predecessors: ["PRG-030"],
    description: "M&E first fix rough-in for Level 3 apartments.",
    notes: "Coordination drawings issued for comment.",
    phase: "level-3",
  },
  // LEVEL 4
  {
    id: "PRG-040", wbs: "2.5.1", name: "Level 4 Slab", shortName: "L4 Slab",
    level: "Level 4", elementType: "slab", status: "not-started", progress: 0,
    startDate: "2026-02-20", endDate: "2026-03-06", displayStart: "20 Feb 2026", displayEnd: "06 Mar 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-031", "PRG-032"],
    description: "Level 4 flat slab pour — final structural level.",
    notes: "Critical path — must not slip.",
    phase: "level-4",
  },
  {
    id: "PRG-041", wbs: "2.5.2", name: "Level 4 Columns", shortName: "L4 Columns",
    level: "Level 4", elementType: "columns", status: "not-started", progress: 0,
    startDate: "2026-03-07", endDate: "2026-03-20", displayStart: "07 Mar 2026", displayEnd: "20 Mar 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-040"],
    description: "Level 4 RC columns to roof slab level.",
    notes: "",
    phase: "level-4",
  },
  {
    id: "PRG-042", wbs: "2.5.3", name: "Level 4 Beams", shortName: "L4 Beams",
    level: "Level 4", elementType: "beams", status: "not-started", progress: 0,
    startDate: "2026-03-09", endDate: "2026-03-22", displayStart: "09 Mar 2026", displayEnd: "22 Mar 2026", duration: 10,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: false, float: 2, predecessors: ["PRG-040"],
    description: "Level 4 transfer and ring beams.",
    notes: "",
    phase: "level-4",
  },
  // ROOF
  {
    id: "PRG-050", wbs: "2.6.1", name: "Roof Slab", shortName: "Roof Slab",
    level: "Roof", elementType: "slab", status: "not-started", progress: 0,
    startDate: "2026-03-25", endDate: "2026-04-10", displayStart: "25 Mar 26", displayEnd: "10 Apr 26", duration: 12,
    trade: "Structural", assignee: "James Smith", assigneeInitials: "JS",
    isCritical: true, float: 0, predecessors: ["PRG-041"],
    description: "Roof slab and plant room deck.",
    notes: "",
    phase: "level-4",
  },
  {
    id: "PRG-051", wbs: "2.6.2", name: "Roof Plant & Services", shortName: "Roof Plant",
    level: "Roof", elementType: "plant", status: "not-started", progress: 0,
    startDate: "2026-04-12", endDate: "2026-05-01", displayStart: "12 Apr 26", displayEnd: "01 May 26", duration: 14,
    trade: "M&E", assignee: "Tony Jones", assigneeInitials: "TJ",
    isCritical: false, float: 14, predecessors: ["PRG-050"],
    description: "Rooftop plant — HVAC, lift overrun, drainage.",
    notes: "",
    phase: "facade",
  },
];

// ─── Timeline Phases (Matches Timeline Chart rows 1 to 8) ────────────────────

export const TIMELINE_PHASES: TimelinePhase[] = [
  { id: "site-est",       index: 1, label: "Site Establishment", startMonth: 0, durationMonths: 1.5, status: "complete",    elementIds: [] },
  { id: "earthworks",     index: 2, label: "Earthworks",          startMonth: 1, durationMonths: 2.0, status: "complete",    elementIds: ["PRG-001"] },
  { id: "superstructure", index: 3, label: "Superstructure",      startMonth: 2, durationMonths: 4.0, status: "complete",    elementIds: ["PRG-002","PRG-003","PRG-004"] },
  { id: "level-1",        index: 4, label: "Level 1",             startMonth: 3, durationMonths: 3.0, status: "complete",    elementIds: ["PRG-010","PRG-011","PRG-012","PRG-014","PRG-015"], level: "Level 1" },
  { id: "level-2",        index: 5, label: "Level 2",             startMonth: 4, durationMonths: 3.5, status: "in-progress", elementIds: ["PRG-020","PRG-021","PRG-022","PRG-025","PRG-026","PRG-024"], level: "Level 2" },
  { id: "level-3",        index: 6, label: "Level 3",             startMonth: 6, durationMonths: 2.5, status: "not-started", elementIds: ["PRG-030","PRG-031","PRG-032","PRG-034","PRG-035","PRG-033"], level: "Level 3" },
  { id: "level-4",        index: 7, label: "Level 4",             startMonth: 8, durationMonths: 2.5, status: "not-started", elementIds: ["PRG-040","PRG-041","PRG-042","PRG-050"], level: "Level 4" },
  { id: "facade",         index: 8, label: "Façade",              startMonth: 8.5, durationMonths: 4.0, status: "not-started", elementIds: ["PRG-013","PRG-023","PRG-051"] },
];

// ─── Summary Stats ────────────────────────────────────────────────────────────

export const PROGRAMME_STATS = {
  totalTasks: 817,
  completedPercent: 48,
  overdueTasks: 5,
  blockedTasks: 3,
  dueThisWeek: 12,
  criticalTasks: 4,
  programmeStart: "01 Sep 2025",
  programmeEnd: "15 Nov 2026",
  version: "Working Forecast",
};

// ─── Building Levels & Lookups ───────────────────────────────────────────────

export const LEVELS: BuildingLevel[] = [
  "Roof",
  "Level 4",
  "Level 3",
  "Level 2",
  "Level 1",
  "Ground",
  "Basement 1",
];

export const LEVEL_ELEVATION: Record<string, number> = {
  "Roof":        16.0,
  "Level 5":     18.0,
  "Level 4":     12.8,
  "Level 3":      9.6,
  "Level 2":      6.4,
  "Level 1":      3.2,
  "Mezzanine":    5.5,
  "Ground":       0.0,
  "Basement 1":  -3.2,
  "Basement 2":  -6.4,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getFloorConfigForLevel(preset: ProjectModelPreset, levelName: string): FloorConfig | undefined {
  return preset.floors.find((f) => f.id === levelName || f.name === levelName || f.shortName === levelName);
}

export function getElementsForLevel(level: BuildingLevel): ModelElement[] {
  return MODEL_ELEMENTS.filter((e) => e.level === level);
}

export function getElementsForZone(elements: ModelElement[], zone: string): ModelElement[] {
  if (!zone || zone === "all") return elements;
  return elements.filter((e) => e.zone === zone);
}

export function getElementsForDiscipline(elements: ModelElement[], discipline: DisciplineType): ModelElement[] {
  if (!discipline || discipline === "all") return elements;
  return elements.filter((e) => e.discipline === discipline);
}

export function getLevelStatus(level: BuildingLevel): TaskStatus {
  const els = getElementsForLevel(level);
  if (!els.length) return "not-started";
  if (els.some((e) => e.status === "blocked")) return "blocked";
  if (els.some((e) => e.status === "in-progress")) return "in-progress";
  if (els.every((e) => e.status === "complete")) return "complete";
  return "not-started";
}

export function getElementById(id: string): ModelElement | undefined {
  return MODEL_ELEMENTS.find((e) => e.id === id);
}

export function getElementsForPhase(phaseId: string): ModelElement[] {
  const phase = TIMELINE_PHASES.find((p) => p.id === phaseId);
  if (!phase) return [];
  return MODEL_ELEMENTS.filter((e) => phase.elementIds.includes(e.id));
}

export function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
