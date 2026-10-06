"use client";

import React, { useState, useMemo } from "react";
import { useProgramme } from "@/lib/programme-context";
import type { TaskStatus, Trade } from "@/lib/programme-types";
import {
  Building2,
  Search,
  SlidersHorizontal,
  Plus,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Flame,
  Folder,
  FileText,
  Check,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
  MoreHorizontal,
  MapPin,
  Shield,
  Zap,
  Truck,
  Compass,
  Package,
  Layers,
  Calendar,
  Tag,
  User,
  Activity,
  CircleDot,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  Download,
  FolderPlus,
  Milestone,
} from "lucide-react";

// Assignee avatar colors mapping
const ASSIGNEE_AVATARS: Record<string, { bg: string; text: string }> = {
  JS: { bg: "bg-gradient-to-br from-blue-600 to-indigo-700", text: "text-white" },
  PT: { bg: "bg-gradient-to-br from-purple-600 to-violet-700", text: "text-white" },
  SC: { bg: "bg-gradient-to-br from-fuchsia-600 to-pink-700", text: "text-white" },
  MJ: { bg: "bg-gradient-to-br from-indigo-600 to-blue-700", text: "text-white" },
  RW: { bg: "bg-gradient-to-br from-rose-600 to-red-700", text: "text-white" },
  EC: { bg: "bg-gradient-to-br from-amber-500 to-orange-600", text: "text-white" },
  DW: { bg: "bg-gradient-to-br from-teal-600 to-emerald-700", text: "text-white" },
  TH: { bg: "bg-gradient-to-br from-emerald-600 to-teal-700", text: "text-white" },
};

// Trade pill styles
const TRADE_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  Management: {
    bg: "bg-blue-50/90 border-blue-200/70",
    text: "text-blue-700",
    dot: "bg-blue-500",
  },
  Civils: {
    bg: "bg-emerald-50/90 border-emerald-200/70",
    text: "text-emerald-700",
    dot: "bg-emerald-500",
  },
  "M&E": {
    bg: "bg-amber-50/90 border-amber-200/70",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  Structural: {
    bg: "bg-purple-50/90 border-purple-200/70",
    text: "text-purple-700",
    dot: "bg-purple-500",
  },
  Substructure: {
    bg: "bg-cyan-50/90 border-cyan-200/70",
    text: "text-cyan-700",
    dot: "bg-cyan-500",
  },
  Façade: {
    bg: "bg-indigo-50/90 border-indigo-200/70",
    text: "text-indigo-700",
    dot: "bg-indigo-500",
  },
  Fitout: {
    bg: "bg-rose-50/90 border-rose-200/70",
    text: "text-rose-700",
    dot: "bg-rose-500",
  },
};

// Task-specific icon mapping matching user's image
function getTaskIcon(wbs: string) {
  if (wbs === "1.1.1") return <MapPin className="h-3.5 w-3.5 text-blue-500 shrink-0" />;
  if (wbs === "1.1.2") return <Shield className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  if (wbs === "1.1.3") return <Zap className="h-3.5 w-3.5 text-amber-500 shrink-0" />;
  if (wbs === "1.1.4") return <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  if (wbs === "1.1.5") return <Truck className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  if (wbs === "1.1.6" || wbs === "1.1.7") return <Layers className="h-3.5 w-3.5 text-indigo-500 shrink-0" />;
  if (wbs === "1.1.8") return <Package className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  if (wbs === "1.1.9") return <Compass className="h-3.5 w-3.5 text-emerald-500 shrink-0" />;
  if (wbs === "1.1.10") return <CircleDot className="h-3.5 w-3.5 text-slate-500 shrink-0" />;
  return <FileText className="h-3.5 w-3.5 text-slate-400 shrink-0" />;
}

// Full Phases Structure with subpackages and tasks for all phases
interface PhaseDef {
  id: string;
  wbs: string;
  name: string;
  icon: string;
  taskCount: number;
  progress: number;
  progressColor: string;
  start: string;
  finish: string;
  duration: string;
  subpackages: {
    id: string;
    wbs: string;
    name: string;
    taskCount: number;
    progress: number;
    start: string;
    finish: string;
    duration: string;
    tasks: {
      id: string;
      wbs: string;
      name: string;
      status: TaskStatus;
      isCritical: boolean;
      isMilestone?: boolean;
      start: string;
      finish: string;
      duration: number;
      progress: number;
      trade: Trade;
      assignee: string;
      assigneeInitials: string;
    }[];
  }[];
}

const ALL_PHASES_DATA: PhaseDef[] = [
  {
    id: "phase-1",
    wbs: "1",
    name: "Enabling Works & Site Setup",
    icon: "📦",
    taskCount: 32,
    progress: 80,
    progressColor: "bg-emerald-500",
    start: "01 Mar 2025",
    finish: "30 Apr 2025",
    duration: "60d",
    subpackages: [
      {
        id: "wp-1-1",
        wbs: "1.1",
        name: "Site Establishment",
        taskCount: 13,
        progress: 92,
        start: "01 Mar 2025",
        finish: "06 May 2025",
        duration: "46d",
        tasks: [
          {
            id: "task-1-1-1",
            wbs: "1.1.1",
            name: "Site possession",
            status: "complete",
            isCritical: true,
            isMilestone: true,
            start: "03 Mar 2025",
            finish: "03 Mar 2025",
            duration: 0,
            progress: 100,
            trade: "Management",
            assignee: "John Smith",
            assigneeInitials: "JS",
          },
          {
            id: "task-1-1-2",
            wbs: "1.1.2",
            name: "Hoarding and site signage installation",
            status: "complete",
            isCritical: false,
            start: "03 Mar 2025",
            finish: "10 Mar 2025",
            duration: 5,
            progress: 100,
            trade: "Civils",
            assignee: "Paul Turner",
            assigneeInitials: "PT",
          },
          {
            id: "task-1-1-3",
            wbs: "1.1.3",
            name: "Temporary services connection",
            status: "complete",
            isCritical: false,
            start: "06 Mar 2025",
            finish: "18 Mar 2025",
            duration: 8,
            progress: 100,
            trade: "M&E",
            assignee: "Sarah Carter",
            assigneeInitials: "SC",
          },
          {
            id: "task-1-1-4",
            wbs: "1.1.4",
            name: "Site welfare setup",
            status: "complete",
            isCritical: false,
            start: "13 Mar 2025",
            finish: "20 Mar 2025",
            duration: 5,
            progress: 100,
            trade: "Management",
            assignee: "Mike Johnson",
            assigneeInitials: "MJ",
          },
          {
            id: "task-1-1-5",
            wbs: "1.1.5",
            name: "Site compound and laydown areas",
            status: "complete",
            isCritical: false,
            start: "18 Mar 2025",
            finish: "27 Mar 2025",
            duration: 7,
            progress: 100,
            trade: "Civils",
            assignee: "Paul Turner",
            assigneeInitials: "PT",
          },
          {
            id: "task-1-1-6",
            wbs: "1.1.6",
            name: "Tower crane foundation",
            status: "in-progress",
            isCritical: true,
            start: "24 Mar 2025",
            finish: "07 Apr 2025",
            duration: 10,
            progress: 70,
            trade: "Structural",
            assignee: "Ryan Wilson",
            assigneeInitials: "RW",
          },
          {
            id: "task-1-1-7",
            wbs: "1.1.7",
            name: "Tower crane erection and commissioning",
            status: "in-progress",
            isCritical: true,
            start: "02 Apr 2025",
            finish: "09 Apr 2025",
            duration: 5,
            progress: 55,
            trade: "Structural",
            assignee: "Ryan Wilson",
            assigneeInitials: "RW",
          },
          {
            id: "task-1-1-8",
            wbs: "1.1.8",
            name: "Material hoist installation",
            status: "not-started",
            isCritical: false,
            start: "07 Apr 2025",
            finish: "11 Apr 2025",
            duration: 4,
            progress: 0,
            trade: "Structural",
            assignee: "Emma Collins",
            assigneeInitials: "EC",
          },
          {
            id: "task-1-1-9",
            wbs: "1.1.9",
            name: "Temporary access roads",
            status: "not-started",
            isCritical: false,
            start: "09 Apr 2025",
            finish: "17 Apr 2025",
            duration: 6,
            progress: 0,
            trade: "Civils",
            assignee: "Paul Turner",
            assigneeInitials: "PT",
          },
          {
            id: "task-1-1-10",
            wbs: "1.1.10",
            name: "Environmental controls - silt fencing",
            status: "not-started",
            isCritical: false,
            start: "15 Apr 2025",
            finish: "18 Apr 2025",
            duration: 3,
            progress: 0,
            trade: "Civils",
            assignee: "Sarah Carter",
            assigneeInitials: "SC",
          },
        ],
      },
    ],
  },
  {
    id: "phase-2",
    wbs: "2",
    name: "Substructure",
    icon: "🏛️",
    taskCount: 24,
    progress: 45,
    progressColor: "bg-blue-600",
    start: "20 Dec 2025",
    finish: "28 Feb 2026",
    duration: "70d",
    subpackages: [
      {
        id: "wp-2-1",
        wbs: "2.1",
        name: "Piling & Deep Foundations",
        taskCount: 10,
        progress: 65,
        start: "20 Dec 2025",
        finish: "10 Feb 2026",
        duration: "52d",
        tasks: [
          {
            id: "task-2-1-1",
            wbs: "2.1.1",
            name: "Continuous Flight Auger (CFA) piling",
            status: "complete",
            isCritical: true,
            start: "20 Dec 2025",
            finish: "15 Jan 2026",
            duration: 20,
            progress: 100,
            trade: "Civils",
            assignee: "Paul Turner",
            assigneeInitials: "PT",
          },
          {
            id: "task-2-1-2",
            wbs: "2.1.2",
            name: "Pile cap excavation & blinding",
            status: "in-progress",
            isCritical: false,
            start: "16 Jan 2026",
            finish: "02 Feb 2026",
            duration: 14,
            progress: 80,
            trade: "Civils",
            assignee: "Paul Turner",
            assigneeInitials: "PT",
          },
          {
            id: "task-2-1-3",
            wbs: "2.1.3",
            name: "Ground beam reinforcement & concrete pour",
            status: "in-progress",
            isCritical: true,
            start: "03 Feb 2026",
            finish: "28 Feb 2026",
            duration: 20,
            progress: 40,
            trade: "Structural",
            assignee: "Ryan Wilson",
            assigneeInitials: "RW",
          },
        ],
      },
    ],
  },
  {
    id: "phase-3",
    wbs: "3",
    name: "Superstructure",
    icon: "🏗️",
    taskCount: 18,
    progress: 18,
    progressColor: "bg-amber-500",
    start: "01 Mar 2026",
    finish: "15 May 2026",
    duration: "75d",
    subpackages: [
      {
        id: "wp-3-1",
        wbs: "3.1",
        name: "Concrete Core & Primary Framing",
        taskCount: 8,
        progress: 30,
        start: "01 Mar 2026",
        finish: "20 Apr 2026",
        duration: "50d",
        tasks: [
          {
            id: "task-3-1-1",
            wbs: "3.1.1",
            name: "Slipform core Level 00 to 04",
            status: "in-progress",
            isCritical: true,
            start: "01 Mar 2026",
            finish: "28 Mar 2026",
            duration: 24,
            progress: 35,
            trade: "Structural",
            assignee: "Ryan Wilson",
            assigneeInitials: "RW",
          },
          {
            id: "task-3-1-2",
            wbs: "3.1.2",
            name: "Precast column & beam installation",
            status: "not-started",
            isCritical: false,
            start: "29 Mar 2026",
            finish: "20 Apr 2026",
            duration: 18,
            progress: 0,
            trade: "Structural",
            assignee: "Ryan Wilson",
            assigneeInitials: "RW",
          },
        ],
      },
    ],
  },
  {
    id: "phase-4",
    wbs: "4",
    name: "Façade & Fitout",
    icon: "🏢",
    taskCount: 14,
    progress: 0,
    progressColor: "bg-slate-300",
    start: "21 Mar 2026",
    finish: "30 Jun 2026",
    duration: "100d",
    subpackages: [
      {
        id: "wp-4-1",
        wbs: "4.1",
        name: "Unitised Curtain Wall & Envelope",
        taskCount: 7,
        progress: 0,
        start: "21 Mar 2026",
        finish: "15 May 2026",
        duration: "55d",
        tasks: [
          {
            id: "task-4-1-1",
            wbs: "4.1.1",
            name: "Bracket installation & 3D survey alignment",
            status: "not-started",
            isCritical: false,
            start: "21 Mar 2026",
            finish: "15 Apr 2026",
            duration: 20,
            progress: 0,
            trade: "Façade",
            assignee: "Sarah Carter",
            assigneeInitials: "SC",
          },
        ],
      },
    ],
  },
  {
    id: "phase-5",
    wbs: "5",
    name: "Completion",
    icon: "🏁",
    taskCount: 10,
    progress: 0,
    progressColor: "bg-slate-300",
    start: "01 Nov 2026",
    finish: "15 Nov 2026",
    duration: "14d",
    subpackages: [
      {
        id: "wp-5-1",
        wbs: "5.1",
        name: "Testing, Commissioning & Handover",
        taskCount: 5,
        progress: 0,
        start: "01 Nov 2026",
        finish: "15 Nov 2026",
        duration: "14d",
        tasks: [
          {
            id: "task-5-1-1",
            wbs: "5.1.1",
            name: "Building control final inspection signoff",
            status: "not-started",
            isCritical: true,
            isMilestone: true,
            start: "01 Nov 2026",
            finish: "05 Nov 2026",
            duration: 4,
            progress: 0,
            trade: "Management",
            assignee: "John Smith",
            assigneeInitials: "JS",
          },
        ],
      },
    ],
  },
];

type SortField = "wbs" | "name" | "start" | "finish" | "duration" | "progress";
type SortOrder = "asc" | "desc";

export function ListView() {
  const { state, selectTask, openDrawer } = useProgramme();

  // Expanded nodes state: default to expanding Phase 1 and WP 1.1
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    new Set(["phase-1", "wp-1-1"])
  );

  // Selected row checkboxes
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(new Set());

  // Filter dropdown toggles
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [tradeFilterOpen, setTradeFilterOpen] = useState(false);
  const [assigneeFilterOpen, setAssigneeFilterOpen] = useState(false);
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false);
  const [addTaskDropdownOpen, setAddTaskDropdownOpen] = useState(false);

  // Filter selections
  const [selectedStatus, setSelectedStatus] = useState<string>("All Statuses");
  const [selectedTrade, setSelectedTrade] = useState<string>("All Trades");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("All Assignees");
  const [criticalOnly, setCriticalOnly] = useState(false);

  // Local Search Input
  const [searchQuery, setSearchQuery] = useState("");

  // Density setting: "comfortable" | "compact"
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");

  // Sorting
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

  // Inline status popover tracking: taskId -> boolean
  const [activeStatusPopover, setActiveStatusPopover] = useState<string | null>(null);

  // Local task overrides for status / progress updates
  const [taskOverrides, setTaskOverrides] = useState<
    Record<string, { status?: TaskStatus; progress?: number; trade?: Trade; assignee?: string; assigneeInitials?: string }>
  >({});

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    const allIds = new Set<string>();
    ALL_PHASES_DATA.forEach((p) => {
      allIds.add(p.id);
      p.subpackages.forEach((sp) => allIds.add(sp.id));
    });
    setExpandedNodes(allIds);
    setMoreFiltersOpen(false);
  };

  const collapseAll = () => {
    setExpandedNodes(new Set());
    setMoreFiltersOpen(false);
  };

  const toggleCheckbox = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Collect all task IDs across all phases for select all
  const allTaskIds = useMemo(() => {
    const ids: string[] = [];
    ALL_PHASES_DATA.forEach((p) => {
      ids.push(p.id);
      p.subpackages.forEach((sp) => {
        ids.push(sp.id);
        sp.tasks.forEach((t) => ids.push(t.id));
      });
    });
    return ids;
  }, []);

  const allSelected =
    selectedRowIds.size > 0 && selectedRowIds.size >= allTaskIds.length;

  const toggleSelectAll = () => {
    if (selectedRowIds.size > 0) {
      setSelectedRowIds(new Set());
    } else {
      setSelectedRowIds(new Set(allTaskIds));
    }
  };

  // Bulk actions
  const handleBulkComplete = () => {
    const updates: Record<string, { status: TaskStatus; progress: number }> = {};
    selectedRowIds.forEach((id) => {
      updates[id] = { status: "complete", progress: 100 };
    });
    setTaskOverrides((prev) => ({ ...prev, ...updates }));
    setSelectedRowIds(new Set());
  };

  const handleBulkSetTrade = (trade: Trade) => {
    const updates: Record<string, { trade: Trade }> = {};
    selectedRowIds.forEach((id) => {
      updates[id] = { trade };
    });
    setTaskOverrides((prev) => ({ ...prev, ...updates }));
    setSelectedRowIds(new Set());
  };

  // Inline status changer
  const handleSetStatus = (taskId: string, status: TaskStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    const progress = status === "complete" ? 100 : status === "in-progress" ? 50 : 0;
    setTaskOverrides((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], status, progress },
    }));
    setActiveStatusPopover(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortOrder === "asc") setSortOrder("desc");
      else {
        setSortField(null);
        setSortOrder("asc");
      }
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  // Filter tasks
  const isTaskVisible = (task: {
    name: string;
    wbs: string;
    status: TaskStatus;
    trade?: string | null;
    assignee?: string | null;
    isCritical?: boolean;
  }) => {
    const currentStatus = taskOverrides[task.wbs]?.status || task.status;
    const currentTrade = taskOverrides[task.wbs]?.trade || task.trade;
    const currentAssignee = taskOverrides[task.wbs]?.assignee || task.assignee;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = task.name.toLowerCase().includes(q);
      const matchWbs = task.wbs.toLowerCase().includes(q);
      const matchAssignee = currentAssignee?.toLowerCase().includes(q);
      const matchTrade = currentTrade?.toLowerCase().includes(q);
      if (!matchName && !matchWbs && !matchAssignee && !matchTrade) return false;
    }

    if (selectedStatus !== "All Statuses") {
      if (selectedStatus === "Complete" && currentStatus !== "complete") return false;
      if (selectedStatus === "In Progress" && currentStatus !== "in-progress") return false;
      if (selectedStatus === "Not Started" && currentStatus !== "not-started") return false;
      if (selectedStatus === "Blocked" && currentStatus !== "blocked") return false;
    }

    if (selectedTrade !== "All Trades" && currentTrade !== selectedTrade) {
      return false;
    }

    if (selectedAssignee !== "All Assignees" && currentAssignee !== selectedAssignee) {
      return false;
    }

    if (criticalOnly && !task.isCritical) {
      return false;
    }

    return true;
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" ||
    selectedStatus !== "All Statuses" ||
    selectedTrade !== "All Trades" ||
    selectedAssignee !== "All Assignees" ||
    criticalOnly;

  const resetAllFilters = () => {
    setSearchQuery("");
    setSelectedStatus("All Statuses");
    setSelectedTrade("All Trades");
    setSelectedAssignee("All Assignees");
    setCriticalOnly(false);
    setMoreFiltersOpen(false);
  };

  // Row height classes based on density
  const rowPy = density === "compact" ? "py-1.5" : "py-2.5";
  const taskRowPy = density === "compact" ? "py-1" : "py-2";

  return (
    <div className="relative flex h-full flex-col rounded-xl border border-slate-200 bg-white overflow-hidden select-none">
      {/* ─── 1. Ultra-Refined Sub-Header Banner ─────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-2.5 shrink-0 z-20">
        {/* Left: Building Icon Badge + Title + Project Subtitle */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
            <Building2 className="h-4.5 w-4.5" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="text-[18px] font-semibold tracking-tight text-slate-900 leading-tight">
                Programme Tasks
              </h2>
            </div>
            <span className="text-[12px] text-slate-400 mt-0.5">
              Ormiston Rise – Building 2 & Unit 80
            </span>
          </div>
        </div>

        {/* Center: Search Input with ⌘ K badge & clear */}
        <div className="relative flex items-center flex-1 max-w-sm mx-2">
          <Search className="absolute left-3 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search tasks, WBS, or assignees..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-14 text-[12.5px] text-slate-800 placeholder:text-slate-400 transition-all focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {searchQuery ? (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : (
            <div className="pointer-events-none absolute right-2.5 flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
              ⌘ K
            </div>
          )}
        </div>

        {/* Right: Filter Dropdowns + Add Task Button */}
        <div className="flex items-center gap-2">
          {/* Status Filter ▾: 36px (h-9) */}
          <div className="relative">
            <button
              onClick={() => {
                setStatusFilterOpen(!statusFilterOpen);
                setTradeFilterOpen(false);
                setAssigneeFilterOpen(false);
                setMoreFiltersOpen(false);
                setAddTaskDropdownOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                selectedStatus !== "All Statuses"
                  ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{selectedStatus === "All Statuses" ? "Status" : selectedStatus}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {statusFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100">
                {["All Statuses", "Complete", "In Progress", "Not Started", "Blocked"].map(
                  (s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setSelectedStatus(s);
                        setStatusFilterOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                        selectedStatus === s
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {s === "Complete" && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                        {s === "In Progress" && <span className="h-2 w-2 rounded-full bg-blue-500" />}
                        {s === "Not Started" && <span className="h-2 w-2 rounded-full bg-slate-400" />}
                        {s === "Blocked" && <span className="h-2 w-2 rounded-full bg-red-500" />}
                        <span>{s}</span>
                      </div>
                      {selectedStatus === s && <Check className="h-3.5 w-3.5 text-blue-600" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Trade Filter ▾: 36px (h-9) */}
          <div className="relative">
            <button
              onClick={() => {
                setTradeFilterOpen(!tradeFilterOpen);
                setStatusFilterOpen(false);
                setAssigneeFilterOpen(false);
                setMoreFiltersOpen(false);
                setAddTaskDropdownOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                selectedTrade !== "All Trades"
                  ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{selectedTrade === "All Trades" ? "Trade" : selectedTrade}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {tradeFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100">
                {["All Trades", "Management", "Civils", "M&E", "Structural", "Façade"].map(
                  (t) => (
                    <button
                      key={t}
                      onClick={() => {
                        setSelectedTrade(t);
                        setTradeFilterOpen(false);
                      }}
                      className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                        selectedTrade === t
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {TRADE_STYLES[t]?.dot && (
                          <span className={`h-2 w-2 rounded-full ${TRADE_STYLES[t].dot}`} />
                        )}
                        <span>{t}</span>
                      </div>
                      {selectedTrade === t && <Check className="h-3.5 w-3.5 text-blue-600" />}
                    </button>
                  )
                )}
              </div>
            )}
          </div>

          {/* Assignee Filter ▾: 36px (h-9) */}
          <div className="relative">
            <button
              onClick={() => {
                setAssigneeFilterOpen(!assigneeFilterOpen);
                setStatusFilterOpen(false);
                setTradeFilterOpen(false);
                setMoreFiltersOpen(false);
                setAddTaskDropdownOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                selectedAssignee !== "All Assignees"
                  ? "border-blue-300 bg-blue-50 text-blue-700 font-semibold"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <span>{selectedAssignee === "All Assignees" ? "Assignee" : selectedAssignee}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {assigneeFilterOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-52 rounded-lg border border-slate-200 bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100">
                {[
                  "All Assignees",
                  "John Smith",
                  "Paul Turner",
                  "Sarah Carter",
                  "Mike Johnson",
                  "Ryan Wilson",
                  "Emma Collins",
                ].map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setSelectedAssignee(a);
                      setAssigneeFilterOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[12px] transition-colors ${
                      selectedAssignee === a
                        ? "bg-blue-50 text-blue-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <span>{a}</span>
                    {selectedAssignee === a && <Check className="h-3.5 w-3.5 text-blue-600" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* More filters ▾: 36px (h-9) */}
          <div className="relative">
            <button
              onClick={() => {
                setMoreFiltersOpen(!moreFiltersOpen);
                setStatusFilterOpen(false);
                setTradeFilterOpen(false);
                setAssigneeFilterOpen(false);
                setAddTaskDropdownOpen(false);
              }}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-medium transition-colors ${
                criticalOnly || moreFiltersOpen
                  ? "border-blue-300 bg-blue-50 text-blue-700"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>More filters</span>
            </button>

            {moreFiltersOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-60 rounded-lg border border-slate-200 bg-white p-3 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100 text-[12px]">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100 mb-2">
                  <span className="font-semibold text-slate-800 uppercase tracking-wider text-[11px]">
                    Table View Options
                  </span>
                  {hasActiveFilters && (
                    <button
                      onClick={resetAllFilters}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      Reset all
                    </button>
                  )}
                </div>

                {/* Critical Path Only Toggle */}
                <label className="flex items-center justify-between py-1.5 px-1 hover:bg-slate-50 rounded-lg cursor-pointer">
                  <div className="flex items-center gap-2">
                    <Flame className="h-3.5 w-3.5 text-red-500" />
                    <span className="font-medium text-slate-700">Critical Path Only</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={criticalOnly}
                    onChange={(e) => setCriticalOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                </label>

                {/* Density Options */}
                <div className="py-2 border-t border-slate-100 mt-2">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">
                    Row Density
                  </span>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                    <button
                      onClick={() => setDensity("comfortable")}
                      className={`py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                        density === "comfortable"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Comfortable
                    </button>
                    <button
                      onClick={() => setDensity("compact")}
                      className={`py-1 rounded-md text-[11.5px] font-medium transition-colors ${
                        density === "compact"
                          ? "bg-white text-slate-900 shadow-xs font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      }`}
                    >
                      Compact
                    </button>
                  </div>
                </div>

                {/* Expand / Collapse All */}
                <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5">
                  <button
                    onClick={expandAll}
                    className="flex-1 rounded border border-slate-200 bg-slate-50 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Expand All
                  </button>
                  <button
                    onClick={collapseAll}
                    className="flex-1 rounded border border-slate-200 bg-slate-50 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Collapse All
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reset button if active filters */}
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-slate-100 hover:bg-slate-200 px-2.5 text-[11.5px] font-medium text-slate-600 transition-colors"
              title="Clear all active filters"
            >
              <X className="h-3.5 w-3.5" />
              <span>Clear</span>
            </button>
          )}

          {/* Divider */}
          <div className="h-5 w-px bg-slate-200 mx-0.5" />

          {/* + Add Task ▾ (Primary CTA: solid blue, 36px) */}
          <div className="relative">
            <button
              onClick={() => setAddTaskDropdownOpen(!addTaskDropdownOpen)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3.5 text-[12.5px] font-medium text-white transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add Task</span>
              <ChevronDown className="h-3.5 w-3.5 text-blue-200 ml-0.5" />
            </button>

            {addTaskDropdownOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-48 rounded-lg border border-slate-200 bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100">
                <button
                  onClick={() => {
                    const name = prompt("Enter task title:");
                    if (name) alert(`Task "${name}" added successfully to Site Establishment.`);
                    setAddTaskDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5 text-blue-600" />
                  <span>Add New Task</span>
                </button>
                <button
                  onClick={() => {
                    const name = prompt("Enter Work Package title:");
                    if (name) alert(`Work package "${name}" created.`);
                    setAddTaskDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <FolderPlus className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Add Work Package</span>
                </button>
                <button
                  onClick={() => {
                    const name = prompt("Enter Milestone title:");
                    if (name) alert(`Milestone "${name}" added.`);
                    setAddTaskDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50 transition-colors"
                >
                  <Milestone className="h-3.5 w-3.5 text-amber-600" />
                  <span>Add Milestone (0d)</span>
                </button>
                <div className="h-px bg-slate-100 my-1" />
                <button
                  onClick={() => {
                    alert("Exporting WBS schedule to CSV...");
                    setAddTaskDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  <Download className="h-3.5 w-3.5 text-slate-400" />
                  <span>Export CSV</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── 2. Table Column Headers with Icons & Rigid Proportions ──── */}
      <div className="flex h-11 shrink-0 items-center border-b border-slate-200 bg-white px-3 text-[12px] font-semibold text-slate-500 sticky top-0 z-10">
        {/* Checkbox column */}
        <div className="w-10 shrink-0 flex items-center justify-center">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          />
        </div>

        {/* # Column */}
        <div className="w-14 shrink-0 font-mono text-slate-500 text-center sm:text-left pl-1">
          #
        </div>

        {/* Task / WBS */}
        <div className="flex-1 min-w-[320px] text-slate-600 normal-case font-bold flex items-center gap-1.5">
          <span>Task / WBS</span>
        </div>

        {/* Status */}
        <div className="w-32 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600">
          <CircleDot className="h-3 w-3 text-slate-400" />
          <span>Status</span>
        </div>

        {/* Start (Sortable) */}
        <div
          onClick={() => handleSort("start")}
          className="w-28 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <Calendar className="h-3 w-3 text-slate-400" />
          <span>Start</span>
          {sortField === "start" ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3 w-3 text-blue-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 text-slate-300" />
          )}
        </div>

        {/* Finish (Sortable) */}
        <div
          onClick={() => handleSort("finish")}
          className="w-28 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <Calendar className="h-3 w-3 text-slate-400" />
          <span>Finish</span>
          {sortField === "finish" ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3 w-3 text-blue-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 text-slate-300" />
          )}
        </div>

        {/* Duration (Sortable) */}
        <div
          onClick={() => handleSort("duration")}
          className="w-20 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <Clock className="h-3 w-3 text-slate-400" />
          <span>Duration</span>
          {sortField === "duration" ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3 w-3 text-blue-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 text-slate-300" />
          )}
        </div>

        {/* Progress (Sortable) */}
        <div
          onClick={() => handleSort("progress")}
          className="w-32 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600 hover:text-slate-900 cursor-pointer transition-colors"
        >
          <Activity className="h-3 w-3 text-slate-400" />
          <span>Progress</span>
          {sortField === "progress" ? (
            sortOrder === "asc" ? (
              <ArrowUp className="h-3 w-3 text-blue-600" />
            ) : (
              <ArrowDown className="h-3 w-3 text-blue-600" />
            )
          ) : (
            <ArrowUpDown className="h-2.5 w-2.5 text-slate-300" />
          )}
        </div>

        {/* Trade */}
        <div className="w-28 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600">
          <Tag className="h-3 w-3 text-slate-400" />
          <span>Trade</span>
        </div>

        {/* Assignee */}
        <div className="w-36 shrink-0 flex items-center gap-1 normal-case font-bold text-slate-600">
          <User className="h-3 w-3 text-slate-400" />
          <span>Assignee</span>
        </div>

        {/* Actions */}
        <div className="w-10 shrink-0 text-center text-slate-400">
          <MoreHorizontal className="h-4 w-4 mx-auto" />
        </div>
      </div>

      {/* ─── 3. Table Rows Container with Rigid Column Alignment ────── */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 text-[12.5px] bg-white">
        {ALL_PHASES_DATA.map((phase) => {
          const isPhaseExpanded = expandedNodes.has(phase.id);
          const isPhaseChecked = selectedRowIds.has(phase.id);

          return (
            <React.Fragment key={phase.id}>
              {/* LEVEL 0: PHASE ROW */}
              <div
                onClick={() => toggleExpand(phase.id)}
                className={`flex items-center px-3 ${rowPy} bg-slate-50/50 hover:bg-slate-100/80 cursor-pointer transition-colors border-l-3 border-transparent hover:border-blue-500`}
              >
                {/* Checkbox */}
                <div className="w-10 shrink-0 flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={isPhaseChecked}
                    onClick={(e) => toggleCheckbox(phase.id, e)}
                    onChange={() => {}}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                </div>

                {/* # Column */}
                <div className="w-14 shrink-0 font-bold font-mono text-slate-800 pl-1">
                  {phase.wbs}
                </div>

                {/* Task / WBS: Level 0 indent */}
                <div className="flex-1 min-w-[320px] flex items-center gap-2 pr-3">
                  <button
                    onClick={(e) => toggleExpand(phase.id, e)}
                    className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                  >
                    {isPhaseExpanded ? (
                      <ChevronDown className="h-4 w-4 text-slate-600" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-600" />
                    )}
                  </button>
                  <span className="text-base select-none">{phase.icon}</span>
                  <span className="font-bold text-slate-900 text-[13.5px] tracking-tight truncate">
                    {phase.name}
                  </span>
                  <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10.5px] font-bold text-slate-600">
                    {phase.taskCount} tasks
                  </span>
                </div>

                {/* Status Column: Progress Bar for Phase */}
                <div className="w-32 shrink-0 flex items-center gap-2">
                  <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${phase.progressColor}`}
                      style={{ width: `${phase.progress}%` }}
                    />
                  </div>
                  <span className="font-bold font-mono text-[11.5px] text-slate-700">
                    {phase.progress}%
                  </span>
                </div>

                {/* Start */}
                <div className="w-28 shrink-0 font-medium text-slate-600 text-[12px]">
                  {phase.start}
                </div>

                {/* Finish */}
                <div className="w-28 shrink-0 font-medium text-slate-600 text-[12px]">
                  {phase.finish}
                </div>

                {/* Duration */}
                <div className="w-20 shrink-0 font-medium text-slate-600 text-[12px]">
                  {phase.duration}
                </div>

                {/* Progress Column: blank for phase */}
                <div className="w-32 shrink-0" />

                {/* Trade Column: blank for phase */}
                <div className="w-28 shrink-0" />

                {/* Assignee Column: blank for phase */}
                <div className="w-36 shrink-0" />

                {/* Actions */}
                <div className="w-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600">
                  <MoreHorizontal className="h-4 w-4" />
                </div>
              </div>

              {/* LEVEL 1: WORK PACKAGES */}
              {isPhaseExpanded &&
                phase.subpackages.map((wp) => {
                  const isWpExpanded = expandedNodes.has(wp.id);
                  const isWpChecked = selectedRowIds.has(wp.id);

                  return (
                    <React.Fragment key={wp.id}>
                      <div
                        onClick={() => toggleExpand(wp.id)}
                        className={`flex items-center px-3 ${rowPy} bg-white hover:bg-slate-50/90 cursor-pointer transition-colors border-l-3 border-transparent hover:border-blue-400`}
                      >
                        {/* Checkbox */}
                        <div className="w-10 shrink-0 flex items-center justify-center">
                          <input
                            type="checkbox"
                            checked={isWpChecked}
                            onClick={(e) => toggleCheckbox(wp.id, e)}
                            onChange={() => {}}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                          />
                        </div>

                        {/* # Column */}
                        <div className="w-14 shrink-0 font-bold font-mono text-slate-700 pl-1 text-[12.5px]">
                          {wp.wbs}
                        </div>

                        {/* Task / WBS: Level 1 Indented with branch connector */}
                        <div className="flex-1 min-w-[320px] flex items-center gap-2 pr-3 pl-4">
                          {/* Tree branch connector icon */}
                          <span className="text-slate-300 select-none font-mono">├─</span>
                          <button
                            onClick={(e) => toggleExpand(wp.id, e)}
                            className="h-5 w-5 rounded flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                          >
                            {isWpExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-slate-600" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-600" />
                            )}
                          </button>
                          <Folder className="h-4 w-4 text-blue-500 fill-blue-500/20 shrink-0" />
                          <span className="font-bold text-slate-900 text-[13px] truncate">
                            {wp.name}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] font-semibold text-slate-500">
                            {wp.taskCount} tasks
                          </span>
                        </div>

                        {/* Status Column: Progress bar for WP */}
                        <div className="w-32 shrink-0 flex items-center gap-2">
                          <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                              style={{ width: `${wp.progress}%` }}
                            />
                          </div>
                          <span className="font-bold font-mono text-[11.5px] text-slate-700">
                            {wp.progress}%
                          </span>
                        </div>

                        {/* Start */}
                        <div className="w-28 shrink-0 font-medium text-slate-600 text-[12px]">
                          {wp.start}
                        </div>

                        {/* Finish */}
                        <div className="w-28 shrink-0 font-medium text-slate-600 text-[12px]">
                          {wp.finish}
                        </div>

                        {/* Duration */}
                        <div className="w-20 shrink-0 font-medium text-slate-600 text-[12px]">
                          {wp.duration}
                        </div>

                        {/* Progress */}
                        <div className="w-32 shrink-0" />

                        {/* Trade */}
                        <div className="w-28 shrink-0" />

                        {/* Assignee */}
                        <div className="w-36 shrink-0" />

                        {/* Actions */}
                        <div className="w-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-600">
                          <MoreHorizontal className="h-4 w-4" />
                        </div>
                      </div>

                      {/* LEVEL 2: INDIVIDUAL TASKS */}
                      {isWpExpanded &&
                        wp.tasks
                          .filter(isTaskVisible)
                          .map((task) => {
                            const isTaskChecked = selectedRowIds.has(task.id);
                            const isSelected = state.selectedTaskId === task.id;

                            const override = taskOverrides[task.id] || {};
                            const currentStatus = override.status || task.status;
                            const currentProgress =
                              override.progress !== undefined ? override.progress : task.progress;
                            const currentTrade = override.trade || task.trade;
                            const currentAssignee = override.assignee || task.assignee;
                            const initials =
                              override.assigneeInitials || task.assigneeInitials || "JS";

                            const avatar =
                              ASSIGNEE_AVATARS[initials] || {
                                bg: "bg-gradient-to-br from-blue-600 to-indigo-700",
                                text: "text-white",
                              };
                            const tradeStyle =
                              TRADE_STYLES[currentTrade] || {
                                bg: "bg-blue-50 border-blue-200",
                                text: "text-blue-700",
                                dot: "bg-blue-500",
                              };

                            return (
                              <div
                                key={task.id}
                                onClick={() => {
                                  selectTask(task.id);
                                  openDrawer(task.id);
                                }}
                                className={`group flex items-center px-3 ${taskRowPy} cursor-pointer transition-all border-l-2 ${
                                  isSelected
                                    ? "bg-blue-50/80 border-blue-600 font-medium"
                                    : "bg-white hover:bg-slate-50/90 border-transparent"
                                }`}
                              >
                                {/* Checkbox */}
                                <div className="w-10 shrink-0 flex items-center justify-center">
                                  <input
                                    type="checkbox"
                                    checked={isTaskChecked}
                                    onClick={(e) => toggleCheckbox(task.id, e)}
                                    onChange={() => {}}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                  />
                                </div>

                                {/* # Column: Perfectly aligned with header & parents */}
                                <div className="w-14 shrink-0 font-mono text-[12px] text-slate-400 pl-1">
                                  {task.wbs}
                                </div>

                                {/* Task / WBS: Level 2 indent with tree guide line */}
                                <div className="flex-1 min-w-[320px] flex items-center gap-2 pr-3 pl-10">
                                  {/* Tree branch line */}
                                  <span className="text-slate-300 select-none font-mono text-xs">└─</span>

                                  {/* Task icon */}
                                  {getTaskIcon(task.wbs)}

                                  {/* Task Name: 14px / 600 */}
                                  <span className="text-[14px] text-slate-800 font-medium group-hover:text-blue-600 transition-colors truncate">
                                    {task.name}
                                  </span>

                                  {/* Critical Path Flame Badge */}
                                  {task.isCritical && (
                                    <div
                                      className="flex items-center"
                                      title="On Critical Path - delays impact project delivery"
                                    >
                                      <Flame className="h-3.5 w-3.5 text-rose-500 fill-rose-500/20 shrink-0 animate-pulse" />
                                    </div>
                                  )}

                                  {/* Milestone Indicator */}
                                  {task.isMilestone && (
                                    <span className="inline-flex items-center rounded-md bg-amber-50 border border-amber-200/80 px-1.5 py-0.2 text-[9.5px] font-bold text-amber-700 shrink-0">
                                      ◆ Milestone
                                    </span>
                                  )}
                                </div>

                                {/* Status Column: Interactive Pill Badge */}
                                <div className="w-32 shrink-0 relative">
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setActiveStatusPopover(
                                        activeStatusPopover === task.id ? null : task.id
                                      );
                                    }}
                                    className="focus:outline-none"
                                  >
                                    {currentStatus === "complete" && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700 shadow-2xs hover:bg-emerald-100/70 transition-colors">
                                        <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                                        <span>Complete</span>
                                      </span>
                                    )}
                                    {currentStatus === "in-progress" && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200/80 px-2.5 py-0.5 text-[11px] font-bold text-blue-700 shadow-2xs hover:bg-blue-100/70 transition-colors">
                                        <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping opacity-75" />
                                        <span>In Progress</span>
                                      </span>
                                    )}
                                    {currentStatus === "not-started" && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 border border-slate-200/80 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 hover:bg-slate-200/70 transition-colors">
                                        <XCircle className="h-3 w-3 text-slate-400" />
                                        <span>Not Started</span>
                                      </span>
                                    )}
                                    {currentStatus === "blocked" && (
                                      <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 border border-rose-200/80 px-2.5 py-0.5 text-[11px] font-bold text-rose-700 shadow-2xs hover:bg-rose-100/70 transition-colors">
                                        <AlertTriangle className="h-3 w-3 text-rose-600" />
                                        <span>Blocked</span>
                                      </span>
                                    )}
                                  </button>

                                  {/* Quick Status Popover */}
                                  {activeStatusPopover === task.id && (
                                    <div className="absolute left-0 top-full mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100">
                                      {(
                                        [
                                          { id: "complete", label: "Complete", color: "text-emerald-700" },
                                          { id: "in-progress", label: "In Progress", color: "text-blue-700" },
                                          { id: "not-started", label: "Not Started", color: "text-slate-600" },
                                          { id: "blocked", label: "Blocked", color: "text-rose-700" },
                                        ] as const
                                      ).map((st) => (
                                        <button
                                          key={st.id}
                                          onClick={(e) => handleSetStatus(task.id, st.id, e)}
                                          className={`flex w-full items-center justify-between rounded-lg px-2 py-1 text-[11.5px] font-semibold hover:bg-slate-50 transition-colors ${st.color}`}
                                        >
                                          <span>{st.label}</span>
                                          {currentStatus === st.id && (
                                            <Check className="h-3 w-3 text-slate-700" />
                                          )}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {/* Start Date */}
                                <div className="w-28 shrink-0 text-slate-600 text-[12px] font-medium font-sans">
                                  {task.start}
                                </div>

                                {/* Finish Date */}
                                <div className="w-28 shrink-0 text-slate-600 text-[12px] font-medium font-sans">
                                  {task.finish}
                                </div>

                                {/* Duration */}
                                <div className="w-20 shrink-0 text-slate-600 text-[12px] font-medium font-mono">
                                  {task.duration}d
                                </div>

                                {/* Progress Gradient Bar */}
                                <div className="w-32 shrink-0 flex items-center gap-2">
                                  <div className="h-2 w-16 rounded-full bg-slate-100 overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all duration-300 ${
                                        currentStatus === "complete"
                                          ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                          : currentStatus === "in-progress"
                                          ? "bg-gradient-to-r from-blue-600 to-indigo-600"
                                          : "bg-slate-200"
                                      }`}
                                      style={{ width: `${currentProgress}%` }}
                                    />
                                  </div>
                                  <span className="font-bold font-mono text-[11.5px] text-slate-700">
                                    {currentProgress}%
                                  </span>
                                </div>

                                {/* Trade Pill */}
                                <div className="w-28 shrink-0">
                                  {currentTrade ? (
                                    <span
                                      className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold tracking-tight shadow-2xs ${tradeStyle.bg} ${tradeStyle.text}`}
                                    >
                                      {currentTrade}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </div>

                                {/* Assignee: High-Res Avatar + Name */}
                                <div className="w-36 shrink-0 flex items-center gap-2 truncate pr-2">
                                  {currentAssignee ? (
                                    <>
                                      <div
                                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold shadow-2xs ring-1 ring-white ${avatar.bg} ${avatar.text}`}
                                      >
                                        {initials}
                                      </div>
                                      <span className="text-slate-800 text-[12px] font-medium truncate">
                                        {currentAssignee}
                                      </span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </div>

                                {/* Actions */}
                                <div className="w-10 shrink-0 flex items-center justify-center text-slate-400 hover:text-slate-700">
                                  <MoreHorizontal className="h-4 w-4" />
                                </div>
                              </div>
                            );
                          })}
                    </React.Fragment>
                  );
                })}
            </React.Fragment>
          );
        })}
      </div>

      {/* ─── 4. Interactive Floating Multi-Select Bulk Actions Bar ───── */}
      {selectedRowIds.size > 0 && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/95 px-4 py-2 text-white shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-2 pr-2 border-r border-slate-700">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-[11px] font-bold text-white">
              {selectedRowIds.size}
            </span>
            <span className="text-[12.5px] font-medium text-slate-200">tasks selected</span>
          </div>

          <button
            onClick={handleBulkComplete}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[12px] font-semibold text-white transition-colors"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>Mark Complete</span>
          </button>

          <button
            onClick={() => handleBulkSetTrade("Civils")}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-1 text-[12px] font-medium text-slate-200 transition-colors"
          >
            <Tag className="h-3.5 w-3.5 text-slate-400" />
            <span>Set Trade</span>
          </button>

          <button
            onClick={() => setSelectedRowIds(new Set())}
            className="inline-flex items-center gap-1 text-[12px] text-slate-400 hover:text-white px-2 py-1 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Deselect</span>
          </button>
        </div>
      )}

      {/* ─── 5. Bottom Pagination Bar matching user's image ─────────── */}
      <div className="flex shrink-0 items-center justify-between border-t border-slate-200/90 bg-white px-5 py-2.5 text-[12px] text-slate-600 z-10">
        {/* Showing 1-10 of 324 tasks */}
        <div className="font-medium text-slate-500">
          Showing <span className="font-semibold text-slate-800">1-10</span> of{" "}
          <span className="font-semibold text-slate-800">324</span> tasks
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center gap-1">
          <button className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button className="h-7 w-7 rounded-lg bg-blue-50 text-blue-700 font-bold flex items-center justify-center text-[12px] shadow-2xs border border-blue-200/60">
            1
          </button>
          <button className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center justify-center text-[12px] transition-colors">
            2
          </button>
          <button className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center justify-center text-[12px] transition-colors">
            3
          </button>
          <span className="px-1 text-slate-400">...</span>
          <button className="h-7 w-7 rounded-lg hover:bg-slate-100 text-slate-700 font-medium flex items-center justify-center text-[12px] transition-colors">
            33
          </button>
          <button className="h-7 w-7 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Rows per page dropdown */}
        <div className="flex items-center gap-2">
          <span className="text-slate-500 font-medium">Rows per page:</span>
          <button className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[12px] font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition-colors">
            <span>10</span>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>
        </div>
      </div>
    </div>
  );
}
