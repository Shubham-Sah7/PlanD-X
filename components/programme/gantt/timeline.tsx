"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import type { ProgrammeTask, ZoomLevel } from "@/lib/programme-types";
import { useProgramme } from "@/lib/programme-context";
import { getTaskPredecessorLinks } from "@/lib/programme-dependencies";
import {
  AlertCircle,
  Compass,
  Maximize2,
  Minimize2,
  Maximize,
  ZoomIn,
  ZoomOut,
  X,
  GitCompare,
  Flame,
  MoveHorizontal,
  ArrowLeftRight,
  Hand,
  ChevronLeft,
  ChevronRight,
  Calendar,
} from "lucide-react";
import {
  calculateScheduleVariance,
  formatVarianceDisplay,
  addWorkingDays,
  countWorkingDays,
  getNextWorkingDay,
  formatDateIso,
  formatDisplayDate,
  parseIsoDate,
} from "@/lib/programme-calendar";

export interface MonthDef {
  key: string;
  name: string;
  year: number;
  width: number;
}

export const ZOOM_CONFIG: Record<
  ZoomLevel,
  {
    monthWidth: number;
    label: string;
    subdivision: "day" | "week" | "month" | "quarter" | "year";
  }
> = {
  year: { monthWidth: 24, label: "Year", subdivision: "year" },
  quarter: { monthWidth: 44, label: "Quarter", subdivision: "quarter" },
  month: { monthWidth: 76, label: "Month", subdivision: "month" },
  week: { monthWidth: 150, label: "Week", subdivision: "week" },
  day: { monthWidth: 360, label: "Day", subdivision: "day" },
};

export const ZOOM_LEVELS_ORDER: ZoomLevel[] = ["year", "quarter", "month", "week", "day"];

/**
 * Bounds and flips tooltip position to prevent clipping off the viewport edges.
 */
export function getBoundedTooltipStyle(
  x: number,
  y: number,
  tooltipWidth = 320,
  tooltipHeight = 220
): React.CSSProperties {
  const margin = 16;
  const vw = typeof window !== "undefined" && window.innerWidth > 0 ? window.innerWidth : 1280;
  const vh = typeof window !== "undefined" && window.innerHeight > 0 ? window.innerHeight : 800;

  let left = x;
  let top = y;
  let transformX = "-50%";
  let transformY = "-100%";

  // Check horizontal overflow against viewport right edge
  if (x + tooltipWidth / 2 > vw - margin) {
    left = Math.min(x, vw - margin);
    transformX = "-100%";
  } else if (x - tooltipWidth / 2 < margin) {
    left = Math.max(margin, x);
    transformX = "0%";
  }

  // Check vertical overflow against viewport top edge
  if (y - tooltipHeight < margin) {
    top = y + 24;
    transformY = "0%";
  } else if (y + tooltipHeight > vh - margin && transformY === "0%") {
    top = Math.max(margin, vh - tooltipHeight - margin);
  }

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: `translate(${transformX}, ${transformY})`,
  };
}

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Computes dynamic timeline month & year boundaries covering all tasks and baseline dates.
 * Automatically defaults to project baseline (Sep 2025 - Dec 2026, 16 months) when applicable,
 * but expands dynamically to multi-year mega-projects.
 */
export function computeTimelineRange(tasks: ProgrammeTask[], monthWidth = 76) {
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const t of tasks) {
    if (t.startDate) {
      const d = parseIsoDate(t.startDate);
      if (!isNaN(d.getTime())) minTime = Math.min(minTime, d.getTime());
    }
    if (t.endDate) {
      const d = parseIsoDate(t.endDate);
      if (!isNaN(d.getTime())) maxTime = Math.max(maxTime, d.getTime());
    }
    if (t.baseline0Start) {
      const d = parseIsoDate(t.baseline0Start);
      if (!isNaN(d.getTime())) minTime = Math.min(minTime, d.getTime());
    }
    if (t.baseline0Finish) {
      const d = parseIsoDate(t.baseline0Finish);
      if (!isNaN(d.getTime())) maxTime = Math.max(maxTime, d.getTime());
    }
  }

  let startYear = 2025;
  let startMonth = 8; // Sep (0-indexed)
  let totalMonths = 16;

  if (minTime !== Infinity && maxTime !== -Infinity) {
    const minD = new Date(minTime);
    const maxD = new Date(maxTime);

    let sy = minD.getFullYear();
    let sm = minD.getMonth() - 1;
    if (sm < 0) {
      sy -= 1;
      sm += 12;
    }

    let ey = maxD.getFullYear();
    let em = maxD.getMonth() + 2;
    if (em >= 12) {
      ey += Math.floor(em / 12);
      em = em % 12;
    }

    // Default sample project is Sep 2025 to Dec 2026; if data is roughly in that range, anchor to Sep 2025
    if (sy >= 2025 && sy <= 2026 && ey <= 2027 && minD.getFullYear() === 2025 && minD.getMonth() >= 8) {
      sy = 2025;
      sm = 8;
      if (ey < 2026 || (ey === 2026 && em < 11)) {
        ey = 2026;
        em = 11;
      }
    }

    const calculatedMonths = (ey - sy) * 12 + (em - sm) + 1;
    totalMonths = Math.max(12, Math.min(600, calculatedMonths));
    startYear = sy;
    startMonth = sm;
  }

  const months: MonthDef[] = [];
  const yearGroupsMap = new Map<number, number>();

  for (let i = 0; i < totalMonths; i++) {
    const absMonth = startMonth + i;
    const y = startYear + Math.floor(absMonth / 12);
    const m = absMonth % 12;
    const key = `${MONTH_NAMES[m].toLowerCase()}-${String(y).slice(-2)}`;
    months.push({
      key,
      name: MONTH_NAMES[m],
      year: y,
      width: monthWidth,
    });
    yearGroupsMap.set(y, (yearGroupsMap.get(y) || 0) + 1);
  }

  const yearGroups: { year: number; count: number; width: number }[] = [];
  yearGroupsMap.forEach((count, year) => {
    yearGroups.push({
      year,
      count,
      width: count * monthWidth,
    });
  });

  return {
    startYear,
    startMonth,
    months,
    yearGroups,
    totalMonths,
  };
}

/**
 * Converts a date string to pixel offset on the timeline canvas.
 */
export function dateToX(
  dateStr?: string,
  monthWidth = 76,
  startYear = 2025,
  startMonth = 8
): number {
  if (!dateStr) return 0;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  const yearDiff = d.getFullYear() - startYear;
  const monthDiff = yearDiff * 12 + d.getMonth() - startMonth;
  const dayOfMonth = d.getDate();
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return Math.max(0, monthDiff * monthWidth + (dayOfMonth / daysInMonth) * monthWidth);
}

/**
 * Converts pixel offset on the timeline canvas back to a date string (YYYY-MM-DD).
 */
export function xToDate(
  x: number,
  monthWidth = 76,
  startYear = 2025,
  startMonth = 8
): string {
  const totalMonths = Math.max(0, x) / monthWidth;
  const monthIndex = Math.floor(totalMonths);
  const fraction = totalMonths - monthIndex;
  const absoluteMonth = startMonth + monthIndex;
  const year = startYear + Math.floor(absoluteMonth / 12);
  const month = absoluteMonth % 12;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(daysInMonth, Math.max(1, Math.round(fraction * daysInMonth) || 1));
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type InteractionMode = "idle" | "dragging" | "resizing-start" | "resizing-end" | "panning";

interface ActiveInteraction {
  mode: InteractionMode;
  taskId?: string;
  initialPointerX: number;
  initialPointerY: number;
  currentPointerX: number;
  currentPointerY: number;
  initialTaskLeft: number;
  initialTaskWidth: number;
  initialStartDate: string;
  initialEndDate: string;
  initialDuration: number;
  initialScrollLeft: number;
  hasMoved: boolean;
}

export interface TimelineProps {
  tasks: ProgrammeTask[];
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  isFullTimeline?: boolean;
  onToggleFullTimeline?: () => void;
}

export function Timeline({
  tasks,
  scrollRef,
  onScroll,
  isFullTimeline,
  onToggleFullTimeline,
}: TimelineProps) {
  const {
    state,
    setZoomLevel,
    selectTask,
    updateTaskSchedule,
    criticalPathActive,
    showBaselineComparison,
    projectCalendar,
  } = useProgramme();

  const [showNavigator, setShowNavigator] = useState<boolean>(false);
  const [hoveredTask, setHoveredTask] = useState<{
    task: ProgrammeTask;
    x: number;
    y: number;
  } | null>(null);

  // Active Drag / Resize / Pan state
  const [activeInteraction, setActiveInteraction] = useState<ActiveInteraction | null>(null);

  // Local fallback ref if outer ref is not provided
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const getContainer = useCallback(() => {
    return (scrollRef && scrollRef.current) || internalContainerRef.current;
  }, [scrollRef]);

  const monthWidth = ZOOM_CONFIG[state.zoomLevel]?.monthWidth ?? 76;
  const headerHeight = state.zoomLevel === "day" || state.zoomLevel === "week" ? 60 : 44;

  // Dynamic multi-year timeline range based on tasks
  const timelineRange = useMemo(
    () => computeTimelineRange(tasks, monthWidth),
    [tasks, monthWidth]
  );
  const totalWidth = timelineRange.months.length * monthWidth;

  // Today marker X position in Oct 2025 (or current project status date)
  const todayX = Math.round(
    dateToX("2025-10-15", monthWidth, timelineRange.startYear, timelineRange.startMonth)
  );

  // Focal Zooming: Keeps the focal date centered or under mouse cursor during timescale transitions
  const zoomTo = useCallback(
    (targetZoom: ZoomLevel, focalClientX?: number) => {
      const container = getContainer();
      if (!container) {
        setZoomLevel(targetZoom);
        return;
      }

      const currentMonthWidth = ZOOM_CONFIG[state.zoomLevel]?.monthWidth ?? 76;
      const targetMonthWidth = ZOOM_CONFIG[targetZoom]?.monthWidth ?? 76;

      const rect = container.getBoundingClientRect();
      let focalX: number;
      let viewportOffset: number;

      if (typeof focalClientX === "number") {
        viewportOffset = focalClientX - rect.left;
        focalX = container.scrollLeft + viewportOffset;
      } else {
        viewportOffset = container.clientWidth / 2;
        focalX = container.scrollLeft + viewportOffset;
      }

      // Convert current focal pixel into date string
      const focalDateStr = xToDate(
        focalX,
        currentMonthWidth,
        timelineRange.startYear,
        timelineRange.startMonth
      );

      setZoomLevel(targetZoom);

      // Preserve anchor position after state update
      requestAnimationFrame(() => {
        if (!container) return;
        const newFocalX = dateToX(
          focalDateStr,
          targetMonthWidth,
          timelineRange.startYear,
          timelineRange.startMonth
        );
        const targetScrollLeft = Math.max(0, Math.round(newFocalX - viewportOffset));
        container.scrollLeft = targetScrollLeft;
      });
    },
    [getContainer, state.zoomLevel, timelineRange, setZoomLevel]
  );

  const handleZoomIn = useCallback(
    (focalClientX?: number) => {
      const currentIndex = ZOOM_LEVELS_ORDER.indexOf(state.zoomLevel);
      if (currentIndex < ZOOM_LEVELS_ORDER.length - 1) {
        const nextZoom = ZOOM_LEVELS_ORDER[currentIndex + 1];
        zoomTo(nextZoom, focalClientX);
      }
    },
    [state.zoomLevel, zoomTo]
  );

  const handleZoomOut = useCallback(
    (focalClientX?: number) => {
      const currentIndex = ZOOM_LEVELS_ORDER.indexOf(state.zoomLevel);
      if (currentIndex > 0) {
        const prevZoom = ZOOM_LEVELS_ORDER[currentIndex - 1];
        zoomTo(prevZoom, focalClientX);
      }
    },
    [state.zoomLevel, zoomTo]
  );

  const handleScrollToToday = useCallback(() => {
    const container = getContainer();
    if (!container) return;
    const targetX = Math.max(0, todayX - container.clientWidth / 2);
    container.scrollTo({ left: targetX, behavior: "smooth" });
  }, [getContainer, todayX]);

  const handleFitProject = useCallback(() => {
    const container = getContainer();
    if (!container || tasks.length === 0) return;

    let minTime = Infinity;
    let maxTime = -Infinity;
    let firstStartDate = "";

    for (const t of tasks) {
      if (t.startDate) {
        const d = parseIsoDate(t.startDate);
        if (!isNaN(d.getTime())) {
          if (d.getTime() < minTime) {
            minTime = d.getTime();
            firstStartDate = t.startDate;
          }
        }
      }
      if (t.endDate) {
        const d = parseIsoDate(t.endDate);
        if (!isNaN(d.getTime())) {
          maxTime = Math.max(maxTime, d.getTime());
        }
      }
    }

    if (minTime === Infinity || maxTime === -Infinity) return;

    const minDate = new Date(minTime);
    const maxDate = new Date(maxTime);
    const totalMonthsSpan = Math.max(
      1,
      (maxDate.getFullYear() - minDate.getFullYear()) * 12 +
        (maxDate.getMonth() - minDate.getMonth()) +
        1
    );

    const availableWidth = Math.max(300, container.clientWidth - 48);
    const idealMonthWidth = availableWidth / totalMonthsSpan;

    let targetZoom: ZoomLevel = "year";
    if (idealMonthWidth >= 250) {
      targetZoom = "day";
    } else if (idealMonthWidth >= 110) {
      targetZoom = "week";
    } else if (idealMonthWidth >= 60) {
      targetZoom = "month";
    } else if (idealMonthWidth >= 32) {
      targetZoom = "quarter";
    } else {
      targetZoom = "year";
    }

    setZoomLevel(targetZoom);

    requestAnimationFrame(() => {
      if (!container) return;
      const targetMonthWidth = ZOOM_CONFIG[targetZoom]?.monthWidth ?? 76;
      const startX = Math.round(
        dateToX(
          firstStartDate || "2025-09-01",
          targetMonthWidth,
          timelineRange.startYear,
          timelineRange.startMonth
        )
      );
      container.scrollTo({
        left: Math.max(0, startX - 24),
        behavior: "smooth",
      });
    });
  }, [getContainer, tasks, timelineRange, setZoomLevel]);

  const handlePrevPeriod = useCallback(() => {
    const container = getContainer();
    if (!container) return;
    container.scrollBy({ left: -Math.max(120, container.clientWidth * 0.7), behavior: "smooth" });
  }, [getContainer]);

  const handleNextPeriod = useCallback(() => {
    const container = getContainer();
    if (!container) return;
    container.scrollBy({ left: Math.max(120, container.clientWidth * 0.7), behavior: "smooth" });
  }, [getContainer]);

  // Keyboard navigation shortcuts (+ for Zoom In, - for Zoom Out, T for Today, F for Fit)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "textarea" ||
        targetTag === "select" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        handleZoomIn();
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleZoomOut();
      } else if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleScrollToToday();
      } else if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        handleFitProject();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleZoomIn, handleZoomOut, handleScrollToToday, handleFitProject]);

  // Virtualization state & container resize observation
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(800);

  useEffect(() => {
    const container = getContainer();
    if (!container) return;
    setViewportHeight(container.clientHeight || 800);
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setViewportHeight(entry.contentRect.height);
        }
      }
    });
    ro.observe(container);
    return () => ro.disconnect();
  }, [getContainer]);

  const handleContainerScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      setScrollTop(e.currentTarget.scrollTop);
      if (onScroll) onScroll(e);
    },
    [onScroll]
  );

  const ROW_HEIGHT = 40;
  const OVERSCAN = 12;
  const totalCount = tasks.length;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalCount - endIndex) * ROW_HEIGHT);
  const visibleSlice = useMemo(
    () => tasks.slice(startIndex, endIndex),
    [tasks, startIndex, endIndex]
  );

  // Fast O(1) index map for dependency connector rendering
  const taskIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((t, i) => map.set(t.id, i));
    return map;
  }, [tasks]);

  // Extract all dependency links across visible tasks
  const dependencyLinks = useMemo(() => {
    const links: { pred: string; succ: string; type: string }[] = [];
    const taskIds = new Set(tasks.map((t) => t.id));

    for (const task of tasks) {
      const predLinks = getTaskPredecessorLinks(task);
      for (const link of predLinks) {
        if (taskIds.has(link.id)) {
          links.push({
            pred: link.id,
            succ: task.id,
            type: link.type || "FS",
          });
        }
      }
    }
    return links;
  }, [tasks]);

  // Calibrated bar coordinates & labels matching the primary design reference
  const getTaskBarCoords = useCallback(
    (
      task: ProgrammeTask,
    ): {
      left: number;
      width: number;
      type: string;
      label: string;
      hasMilestone?: boolean;
      isInteracting?: boolean;
    } => {
      const startX = Math.round(
        dateToX(task.startDate, monthWidth, timelineRange.startYear, timelineRange.startMonth)
      );
      const endX = Math.round(
        dateToX(task.endDate, monthWidth, timelineRange.startYear, timelineRange.startMonth)
      );
      let left = startX;
      let width = Math.max(endX - startX, task.isMilestone ? 18 : 24);
      let type = "task-blue";
      let label = `${task.name} ${task.progress}%`;
      let hasMilestone = false;
      let isInteracting = false;

      // Real-time visual delta during drag or resize
      if (activeInteraction && activeInteraction.taskId === task.id) {
        isInteracting = true;
        const deltaX = activeInteraction.currentPointerX - activeInteraction.initialPointerX;

        if (activeInteraction.mode === "dragging") {
          left = Math.max(0, activeInteraction.initialTaskLeft + deltaX);
        } else if (activeInteraction.mode === "resizing-start") {
          const maxLeftShift = activeInteraction.initialTaskWidth - 16;
          const shift = Math.min(deltaX, maxLeftShift);
          left = Math.max(0, activeInteraction.initialTaskLeft + shift);
          width = Math.max(16, activeInteraction.initialTaskWidth - shift);
        } else if (activeInteraction.mode === "resizing-end") {
          width = Math.max(16, activeInteraction.initialTaskWidth + deltaX);
        }
      }

      if (task.id === "task-columns") {
        type = "selected-columns";
        label = "Level 2 - Columns";
        hasMilestone = true;
      } else if (task.level === "phase" || task.id === "task-superstructure") {
        type = "summary-bracket";
        label = `${task.name} ${task.progress}%`;
        hasMilestone = true;
      } else if (task.isMilestone || task.duration === 0 || task.id === "task-completion") {
        type = "milestone-diamond";
        label = task.name + (task.progress >= 100 ? " 100%" : " ◆");
      } else if (task.progress >= 100) {
        type = "complete-green";
        label = `${task.name} 100%`;
      } else if (task.progress === 0) {
        type = "task-gray";
        label = `${task.name} 0%`;
      }

      return {
        left,
        width,
        type,
        label,
        hasMilestone,
        isInteracting,
      };
    },
    [monthWidth, activeInteraction, timelineRange.startYear, timelineRange.startMonth]
  );

  // Baseline 0 Bar coordinates & variance calculation
  const getBaselineBarCoords = useCallback(
    (
      task: ProgrammeTask,
    ): {
      left: number;
      width: number;
      hasBaseline: boolean;
      isMilestone?: boolean;
      varianceDays: number;
      isDelayed: boolean;
      isAhead: boolean;
    } | null => {
      if (!task.baseline0Start || !task.baseline0Finish) {
        return null;
      }

      const startX = Math.round(
        dateToX(task.baseline0Start, monthWidth, timelineRange.startYear, timelineRange.startMonth)
      );
      const endX = Math.round(
        dateToX(task.baseline0Finish, monthWidth, timelineRange.startYear, timelineRange.startMonth)
      );
      const left = startX;
      const width = Math.max(endX - startX, task.isMilestone ? 14 : 18);
      const variance = calculateScheduleVariance(task, projectCalendar);

      return {
        left,
        width,
        hasBaseline: true,
        isMilestone: task.isMilestone || task.duration === 0 || task.id === "task-completion",
        varianceDays: variance.finishVariance,
        isDelayed: variance.isDelayed,
        isAhead: variance.isAhead,
      };
    },
    [monthWidth, projectCalendar, timelineRange.startYear, timelineRange.startMonth]
  );

  // ─── Task Drag & Resize Handlers ──────────────────────────────────────────────

  const handleTaskPointerDown = (task: ProgrammeTask, e: React.PointerEvent) => {
    // Only primary button
    if (e.button !== 0) return;
    // Don't drag phases/summary brackets
    if (task.level === "phase" || task.id === "task-superstructure") {
      selectTask(task.id);
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    setHoveredTask(null);

    const coords = getTaskBarCoords(task);
    const container = getContainer();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setActiveInteraction({
      mode: "dragging",
      taskId: task.id,
      initialPointerX: e.clientX,
      initialPointerY: e.clientY,
      currentPointerX: e.clientX,
      currentPointerY: e.clientY,
      initialTaskLeft: coords.left,
      initialTaskWidth: coords.width,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      initialDuration: task.duration,
      initialScrollLeft: container ? container.scrollLeft : 0,
      hasMoved: false,
    });
  };

  const handleResizePointerDown = (
    task: ProgrammeTask,
    handle: "start" | "end",
    e: React.PointerEvent
  ) => {
    if (e.button !== 0) return;
    // Milestones and phases cannot be resized
    if (task.isMilestone || task.level === "phase") return;

    e.preventDefault();
    e.stopPropagation();
    setHoveredTask(null);

    const coords = getTaskBarCoords(task);
    const container = getContainer();

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}

    setActiveInteraction({
      mode: handle === "start" ? "resizing-start" : "resizing-end",
      taskId: task.id,
      initialPointerX: e.clientX,
      initialPointerY: e.clientY,
      currentPointerX: e.clientX,
      currentPointerY: e.clientY,
      initialTaskLeft: coords.left,
      initialTaskWidth: coords.width,
      initialStartDate: task.startDate,
      initialEndDate: task.endDate,
      initialDuration: task.duration,
      initialScrollLeft: container ? container.scrollLeft : 0,
      hasMoved: false,
    });
  };

  // ─── Canvas Drag-to-Pan Handlers ──────────────────────────────────────────────

  const handleCanvasPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    // Don't pan if clicking an interactive task element
    if ((e.target as HTMLElement).closest("[data-task-interactive]")) return;

    const container = getContainer();
    if (!container) return;

    try {
      container.setPointerCapture(e.pointerId);
    } catch {}

    setActiveInteraction({
      mode: "panning",
      initialPointerX: e.clientX,
      initialPointerY: e.clientY,
      currentPointerX: e.clientX,
      currentPointerY: e.clientY,
      initialTaskLeft: 0,
      initialTaskWidth: 0,
      initialStartDate: "",
      initialEndDate: "",
      initialDuration: 0,
      initialScrollLeft: container.scrollLeft,
      hasMoved: false,
    });
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!activeInteraction) return;

    const deltaX = e.clientX - activeInteraction.initialPointerX;
    const hasMoved = activeInteraction.hasMoved || Math.abs(deltaX) > 3;

    if (activeInteraction.mode === "panning") {
      const container = getContainer();
      if (container) {
        container.scrollLeft = activeInteraction.initialScrollLeft - deltaX;
      }
      setActiveInteraction((prev) => (prev ? {
        ...prev,
        currentPointerX: e.clientX,
        currentPointerY: e.clientY,
        hasMoved,
      } : null));
    } else {
      setActiveInteraction((prev) => (prev ? {
        ...prev,
        currentPointerX: e.clientX,
        currentPointerY: e.clientY,
        hasMoved,
      } : null));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!activeInteraction) return;

    try {
      (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    } catch {}

    const deltaX = activeInteraction.currentPointerX - activeInteraction.initialPointerX;
    const task = tasks.find((t) => t.id === activeInteraction.taskId);

    if (activeInteraction.hasMoved && task) {
      if (activeInteraction.mode === "dragging") {
        // Compute new start date from target pixel coordinate
        const targetLeft = Math.max(0, activeInteraction.initialTaskLeft + deltaX);
        const candidateDateStr = xToDate(
          targetLeft,
          monthWidth,
          timelineRange.startYear,
          timelineRange.startMonth
        );
        const snappedStart = getNextWorkingDay(parseIsoDate(candidateDateStr), projectCalendar);
        const newStartDateIso = formatDateIso(snappedStart);

        updateTaskSchedule(task.id, {
          startDate: newStartDateIso,
          duration: task.duration,
        });
      } else if (activeInteraction.mode === "resizing-start") {
        // Adjust start date, keeping finish date fixed
        const targetLeft = Math.max(0, activeInteraction.initialTaskLeft + deltaX);
        const candidateDateStr = xToDate(
          targetLeft,
          monthWidth,
          timelineRange.startYear,
          timelineRange.startMonth
        );
        const snappedStart = getNextWorkingDay(parseIsoDate(candidateDateStr), projectCalendar);
        const finishDateObj = parseIsoDate(task.endDate);

        if (snappedStart.getTime() <= finishDateObj.getTime()) {
          const newDur = Math.max(
            task.isMilestone ? 0 : 1,
            countWorkingDays(snappedStart, finishDateObj, projectCalendar)
          );
          updateTaskSchedule(task.id, {
            startDate: formatDateIso(snappedStart),
            duration: newDur,
          });
        }
      } else if (activeInteraction.mode === "resizing-end") {
        // Adjust duration & finish date, keeping start date fixed
        const targetEndLeft = Math.max(
          activeInteraction.initialTaskLeft + 16,
          activeInteraction.initialTaskLeft + activeInteraction.initialTaskWidth + deltaX
        );
        const candidateEndDateStr = xToDate(
          targetEndLeft,
          monthWidth,
          timelineRange.startYear,
          timelineRange.startMonth
        );
        const newDur = Math.max(
          task.isMilestone ? 0 : 1,
          countWorkingDays(task.startDate, candidateEndDateStr, projectCalendar)
        );
        updateTaskSchedule(task.id, {
          duration: newDur,
        });
      }
    } else if (!activeInteraction.hasMoved && activeInteraction.taskId) {
      // Clean click without drag: select task & open detail drawer
      selectTask(activeInteraction.taskId);
    }

    setActiveInteraction(null);
  };

  // Support Trackpad horizontal navigation, Shift + Wheel, and Pinch-to-Zoom
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const container = getContainer();
    if (!container) return;

    // Pinch-to-zoom (Ctrl/Meta + Wheel)
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn(e.clientX);
      } else if (e.deltaY > 0) {
        handleZoomOut(e.clientX);
      }
      return;
    }

    // Shift + Wheel horizontal scroll
    if (e.shiftKey && e.deltaY !== 0) {
      container.scrollLeft += e.deltaY;
      return;
    }
  };

  // Real-time preview calculation during active drag or resize
  const previewInfo = useMemo(() => {
    if (!activeInteraction || !activeInteraction.hasMoved || !activeInteraction.taskId) {
      return null;
    }
    const task = tasks.find((t) => t.id === activeInteraction.taskId);
    if (!task) return null;

    const deltaX = activeInteraction.currentPointerX - activeInteraction.initialPointerX;

    if (activeInteraction.mode === "dragging") {
      const targetLeft = Math.max(0, activeInteraction.initialTaskLeft + deltaX);
      const candidateDateStr = xToDate(
        targetLeft,
        monthWidth,
        timelineRange.startYear,
        timelineRange.startMonth
      );
      const snappedStart = getNextWorkingDay(parseIsoDate(candidateDateStr), projectCalendar);
      const newEnd = task.isMilestone
        ? snappedStart
        : addWorkingDays(snappedStart, task.duration, projectCalendar);

      const origStart = parseIsoDate(task.startDate);
      const dayDiff = Math.round((snappedStart.getTime() - origStart.getTime()) / (1000 * 60 * 60 * 24));

      return {
        action: "Moving Task",
        taskName: task.name,
        startDate: formatDisplayDate(snappedStart),
        endDate: formatDisplayDate(newEnd),
        duration: task.duration,
        deltaText: dayDiff === 0 ? "Same date" : dayDiff > 0 ? `+${dayDiff}d` : `${dayDiff}d`,
      };
    } else if (activeInteraction.mode === "resizing-start") {
      const targetLeft = Math.max(0, activeInteraction.initialTaskLeft + deltaX);
      const candidateDateStr = xToDate(
        targetLeft,
        monthWidth,
        timelineRange.startYear,
        timelineRange.startMonth
      );
      const snappedStart = getNextWorkingDay(parseIsoDate(candidateDateStr), projectCalendar);
      const finishDateObj = parseIsoDate(task.endDate);
      const newDur = snappedStart.getTime() <= finishDateObj.getTime()
        ? countWorkingDays(snappedStart, finishDateObj, projectCalendar)
        : 1;

      return {
        action: "Adjusting Start Date",
        taskName: task.name,
        startDate: formatDisplayDate(snappedStart),
        endDate: formatDisplayDate(finishDateObj),
        duration: newDur,
        deltaText: `${newDur - task.duration >= 0 ? `+${newDur - task.duration}` : newDur - task.duration}d duration`,
      };
    } else if (activeInteraction.mode === "resizing-end") {
      const targetEndLeft = Math.max(
        activeInteraction.initialTaskLeft + 16,
        activeInteraction.initialTaskLeft + activeInteraction.initialTaskWidth + deltaX
      );
      const candidateEndDateStr = xToDate(
        targetEndLeft,
        monthWidth,
        timelineRange.startYear,
        timelineRange.startMonth
      );
      const newDur = Math.max(
        task.isMilestone ? 0 : 1,
        countWorkingDays(task.startDate, candidateEndDateStr, projectCalendar)
      );
      const newEnd = addWorkingDays(task.startDate, newDur, projectCalendar);

      return {
        action: "Adjusting Duration",
        taskName: task.name,
        startDate: formatDisplayDate(task.startDate),
        endDate: formatDisplayDate(newEnd),
        duration: newDur,
        deltaText: `${newDur - task.duration >= 0 ? `+${newDur - task.duration}` : newDur - task.duration}d`,
      };
    }
    return null;
  }, [activeInteraction, tasks, monthWidth, projectCalendar, timelineRange.startYear, timelineRange.startMonth]);

  return (
    <div className="flex h-full flex-col select-none relative bg-white overflow-hidden">
      {/* Compact Floating Navigation & Zoom Toolbar in Top-Right Header */}
      <div
        className="absolute top-1.5 right-3 z-30 flex items-center gap-1 rounded-md border border-slate-200/90 bg-white/95 p-0.5 shadow-sm backdrop-blur-xs select-none"
        role="toolbar"
        aria-label="Gantt Timeline Navigation and Zoom"
      >
        {/* Navigation: Previous / Next Period */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={handlePrevPeriod}
            title="Previous Period [Left]"
            className="p-1 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={handleNextPeriod}
            title="Next Period [Right]"
            className="p-1 rounded-xs text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        {/* Today Navigation */}
        <button
          type="button"
          onClick={handleScrollToToday}
          title="Scroll to Today (Oct 15, 2025) [Shortcut: T]"
          className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
        >
          <Calendar className="h-3 w-3 text-blue-600" />
          <span>Today</span>
        </button>

        {/* Fit Project to Screen */}
        <button
          type="button"
          onClick={handleFitProject}
          title="Fit Project to Screen [Shortcut: F]"
          className="inline-flex items-center gap-1 rounded-xs px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Maximize className="h-3 w-3 text-slate-500" />
          <span className="hidden sm:inline">Fit</span>
        </button>

        <div className="h-3.5 w-px bg-slate-200 mx-0.5" />

        {/* Zoom Out Button */}
        <button
          type="button"
          onClick={() => handleZoomOut()}
          disabled={state.zoomLevel === "year"}
          title="Zoom Out (-) [Shortcut: -]"
          className="p-1 rounded-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>

        {/* Timescale / Zoom Level Selector */}
        <select
          value={state.zoomLevel}
          onChange={(e) => zoomTo(e.target.value as ZoomLevel)}
          title="Select Timescale / Zoom Level"
          className="h-5.5 rounded border-0 bg-transparent px-1 text-[11px] font-bold text-slate-700 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="quarter">Quarter</option>
          <option value="year">Year</option>
        </select>

        {/* Zoom In Button */}
        <button
          type="button"
          onClick={() => handleZoomIn()}
          disabled={state.zoomLevel === "day"}
          title="Zoom In (+) [Shortcut: +]"
          className="p-1 rounded-xs text-slate-600 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>

        {/* Full View / Split View Button */}
        {onToggleFullTimeline && (
          <>
            <div className="h-3.5 w-px bg-slate-200 mx-0.5" />
            <button
              type="button"
              onClick={onToggleFullTimeline}
              className="inline-flex items-center gap-1.5 rounded-xs px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
              title={
                isFullTimeline
                  ? "Restore split view with task table"
                  : "Expand timeline to full width view"
              }
            >
              {isFullTimeline ? (
                <>
                  <Minimize2 className="h-3 w-3 text-blue-600" />
                  <span>Split View</span>
                </>
              ) : (
                <>
                  <Maximize2 className="h-3 w-3 text-slate-500" />
                  <span>Full View</span>
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Scrollable Canvas Container with Drag-to-Pan */}
      <div
        ref={(el) => {
          internalContainerRef.current = el;
          if (scrollRef && typeof scrollRef === "object") {
            (scrollRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
          }
        }}
        onScroll={handleContainerScroll}
        onWheel={handleWheel}
        onPointerDown={handleCanvasPointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className={`flex-1 overflow-x-auto overflow-y-auto relative ${
          activeInteraction?.mode === "panning"
            ? "cursor-grabbing"
            : activeInteraction
            ? "cursor-ew-resize"
            : "cursor-default"
        }`}
      >
        <div style={{ width: `${totalWidth}px` }} className="relative min-h-full">
          {/* Timeline Header (Sticky) */}
          <div className="sticky top-0 z-20 border-b border-slate-200 bg-white shadow-2xs">
            {/* Row 1: Years */}
            <div className="flex h-5 border-b border-slate-100 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
              {timelineRange.yearGroups.map((yg) => (
                <div
                  key={yg.year}
                  style={{ width: `${yg.width}px` }}
                  className="pl-3 flex items-center border-r border-slate-100 truncate"
                >
                  {yg.year}
                </div>
              ))}
            </div>

            {/* Row 2: Timescale Subdivision (Months or Quarters) */}
            <div
              className={`flex ${
                state.zoomLevel === "day" || state.zoomLevel === "week"
                  ? "h-5 text-[10px] font-bold text-slate-600 border-b border-slate-100"
                  : "h-6 text-[11px] font-semibold text-slate-600"
              } items-center relative`}
            >
              {state.zoomLevel === "year" ? (
                // In Year zoom: render Quarters Q1..Q4 across each year
                timelineRange.yearGroups.map((yg) => (
                  <div key={yg.year} style={{ width: `${yg.width}px` }} className="flex h-full border-r border-slate-200">
                    <div className="w-1/4 h-full border-r border-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-500">Q1</div>
                    <div className="w-1/4 h-full border-r border-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-500">Q2</div>
                    <div className="w-1/4 h-full border-r border-slate-100 flex items-center justify-center text-[10px] font-mono text-slate-500">Q3</div>
                    <div className="w-1/4 h-full flex items-center justify-center text-[10px] font-mono text-slate-500">Q4</div>
                  </div>
                ))
              ) : (
                // In Day, Week, Month, Quarter: render months
                timelineRange.months.map((m) => (
                  <div
                    key={m.key}
                    style={{ width: `${monthWidth}px` }}
                    className="text-center shrink-0 border-r border-slate-100/90 truncate px-1"
                  >
                    {state.zoomLevel === "day"
                      ? `${m.name} ${m.year}`
                      : m.name}
                  </div>
                ))
              )}

              {/* Blue "Today" Badge (rendered at header bottom when height is 44px) */}
              {headerHeight === 44 && todayX >= 0 && todayX <= totalWidth && (
                <div
                  className="absolute -bottom-1 z-30 -translate-x-1/2 rounded-xs bg-blue-600 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white pointer-events-none shadow-xs"
                  style={{ left: `${todayX}px` }}
                >
                  Today
                </div>
              )}
            </div>

            {/* Row 3 (Optional): Days or Weeks Sub-scale */}
            {state.zoomLevel === "day" && (
              <div className="flex h-5 items-center text-[9px] font-mono text-slate-500 relative bg-slate-50/50">
                {timelineRange.months.map((m) => {
                  const daysInMonth = new Date(m.year, MONTH_NAMES.indexOf(m.name) + 1, 0).getDate();
                  const dayWidth = monthWidth / daysInMonth;
                  return (
                    <div
                      key={`days-${m.key}`}
                      style={{ width: `${monthWidth}px` }}
                      className="flex h-full border-r border-slate-200/80 shrink-0"
                    >
                      {Array.from({ length: daysInMonth }, (_, dIdx) => {
                        const dayNum = dIdx + 1;
                        const dateObj = new Date(m.year, MONTH_NAMES.indexOf(m.name), dayNum);
                        const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
                        const showLabel = dayNum === 1 || dayNum === 15 || dayNum % 5 === 0;
                        return (
                          <div
                            key={`d-${dayNum}`}
                            style={{ width: `${dayWidth}px` }}
                            className={`h-full border-r border-slate-100 flex items-center justify-center text-[8.5px] ${
                              isWeekend ? "bg-slate-100/60 font-semibold text-slate-400" : ""
                            }`}
                          >
                            {showLabel ? dayNum : ""}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}

                {/* Blue "Today" Badge for 3-row header */}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div
                    className="absolute -bottom-1 z-30 -translate-x-1/2 rounded-xs bg-blue-600 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white pointer-events-none shadow-xs"
                    style={{ left: `${todayX}px` }}
                  >
                    Today
                  </div>
                )}
              </div>
            )}

            {state.zoomLevel === "week" && (
              <div className="flex h-5 items-center text-[9.5px] font-mono text-slate-500 relative bg-slate-50/40">
                {timelineRange.months.map((m) => {
                  const weekWidth = monthWidth / 4;
                  return (
                    <div
                      key={`weeks-${m.key}`}
                      style={{ width: `${monthWidth}px` }}
                      className="flex h-full border-r border-slate-200/80 shrink-0"
                    >
                      {["W1", "W2", "W3", "W4"].map((w, wIdx) => (
                        <div
                          key={w}
                          style={{ width: `${weekWidth}px` }}
                          className={`h-full ${
                            wIdx < 3 ? "border-r border-slate-100" : ""
                          } flex items-center justify-center text-[9px] text-slate-400`}
                        >
                          {w}
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Blue "Today" Badge for 3-row header */}
                {todayX >= 0 && todayX <= totalWidth && (
                  <div
                    className="absolute -bottom-1 z-30 -translate-x-1/2 rounded-xs bg-blue-600 px-1.5 py-0.5 text-[9px] font-mono font-semibold text-white pointer-events-none shadow-xs"
                    style={{ left: `${todayX}px` }}
                  >
                    Today
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dotted Vertical "Today" Line extending down */}
          <div
            className="absolute bottom-0 w-px border-l-2 border-dotted border-blue-400/80 z-10 pointer-events-none"
            style={{ left: `${todayX}px`, top: `${headerHeight}px` }}
          />

          {/* Timescale Vertical Grid Lines */}
          <div
            className="absolute inset-0 pointer-events-none flex"
            style={{ top: `${headerHeight}px` }}
          >
            {timelineRange.months.map((m) => (
              <div
                key={m.key}
                style={{ width: `${monthWidth}px` }}
                className="h-full border-r border-slate-100/80 shrink-0"
              />
            ))}
          </div>

          {/* Dynamic SVG Bezier Dependency Lines Overlay */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
            style={{ top: `${headerHeight}px` }}
          >
            <defs>
              <marker
                id="arrowhead-default"
                markerWidth="6"
                markerHeight="6"
                refX="5"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
              </marker>
              <marker
                id="arrowhead-active"
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#2563eb" />
              </marker>
              <marker
                id="arrowhead-critical"
                markerWidth="7"
                markerHeight="7"
                refX="5"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 7 3.5, 0 7" fill="#ef4444" />
              </marker>
            </defs>
            {dependencyLinks.map((link, idx) => {
              const pIndex = taskIndexMap.get(link.pred);
              const sIndex = taskIndexMap.get(link.succ);
              if (pIndex === undefined || sIndex === undefined) return null;

              const y1 = pIndex * 40 + 20;
              const y2 = sIndex * 40 + 20;

              // Spatial vertical culling: only render SVG path if at least part of the link is near the viewport
              const minY = Math.min(y1, y2);
              const maxY = Math.max(y1, y2);
              if (maxY < scrollTop - 200 || minY > scrollTop + viewportHeight + 200) {
                return null;
              }

              const pTask = tasks[pIndex];
              const sTask = tasks[sIndex];
              const pCoords = getTaskBarCoords(pTask);
              const sCoords = getTaskBarCoords(sTask);

              let x1: number;
              let x2: number;
              if (link.type === "SS") {
                x1 = pCoords.left;
                x2 = sCoords.left;
              } else if (link.type === "FF") {
                x1 = pCoords.left + pCoords.width;
                x2 = sCoords.left + sCoords.width;
              } else if (link.type === "SF") {
                x1 = pCoords.left;
                x2 = sCoords.left + sCoords.width;
              } else {
                x1 = pCoords.left + pCoords.width;
                x2 = sCoords.left;
              }

              const isDirectlyConnected =
                state.selectedTaskId &&
                (link.pred === state.selectedTaskId || link.succ === state.selectedTaskId);
              const isCriticalLink =
                criticalPathActive &&
                (pTask.isCritical || link.pred === "task-columns") &&
                (sTask.isCritical || link.succ === "task-columns");
              const isDimmed =
                (state.selectedTaskId && !isDirectlyConnected) ||
                (criticalPathActive && !isCriticalLink);

              const d =
                x2 >= x1
                  ? `M ${x1} ${y1} C ${x1 + 16} ${y1}, ${x2 - 16} ${y2}, ${x2} ${y2}`
                  : `M ${x1} ${y1} H ${x1 + 12} V ${y2} H ${x2}`;

              const strokeColor = isCriticalLink
                ? "#ef4444"
                : isDirectlyConnected
                ? "#2563eb"
                : isDimmed
                ? "#e2e8f0"
                : "#94a3b8";

              const markerEnd = isCriticalLink
                ? "url(#arrowhead-critical)"
                : isDirectlyConnected
                ? "url(#arrowhead-active)"
                : "url(#arrowhead-default)";

              return (
                <g key={`dep-g-${idx}`}>
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={isCriticalLink ? 2.5 : isDirectlyConnected ? 2.5 : 1.5}
                    opacity={isDimmed ? 0.3 : 1}
                    markerEnd={markerEnd}
                    strokeLinecap="round"
                    className="transition-all duration-75"
                  />
                  {link.type !== "FS" && !isDimmed && (
                    <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
                      <rect
                        x="-10"
                        y="-7"
                        width="20"
                        height="14"
                        rx="3"
                        fill="#ffffff"
                        stroke={strokeColor}
                        strokeWidth="1"
                      />
                      <text
                        x="0"
                        y="3.5"
                        textAnchor="middle"
                        fontSize="9"
                        fontWeight="bold"
                        fill={strokeColor}
                        fontFamily="monospace"
                      >
                        {link.type}
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Task Gantt Bars Rows */}
          <div className="divide-y divide-slate-100">
            {topSpacerHeight > 0 && (
              <div style={{ height: `${topSpacerHeight}px` }} aria-hidden="true" />
            )}
            {visibleSlice.map((task) => {
              const coords = getTaskBarCoords(task);
              const isSelected = state.selectedTaskId === task.id;
              const isCritical = Boolean(
                task.isCritical || (typeof task.float === "number" && task.float <= 0)
              );
              const isDimmed = criticalPathActive && !isCritical;
              const isDualTrack = Boolean(showBaselineComparison);
              const baselineCoords = isDualTrack ? getBaselineBarCoords(task) : null;
              const isInteractingThis = activeInteraction?.taskId === task.id;

              return (
                <div
                  key={task.id}
                  onMouseEnter={(e) => {
                    if (!activeInteraction) {
                      setHoveredTask({
                        task,
                        x: e.clientX,
                        y: e.clientY - 12,
                      });
                    }
                  }}
                  onMouseLeave={() => {
                    if (!activeInteraction) {
                      setHoveredTask(null);
                    }
                  }}
                  className={`relative flex h-10 items-center transition-all ${
                    isSelected ? "bg-blue-50/50" : "hover:bg-slate-50/40"
                  } ${isDimmed ? "opacity-35" : "opacity-100"}`}
                >
                  {/* Task Bar Element Container */}
                  <div
                    data-task-interactive={task.id}
                    onPointerDown={(e) => handleTaskPointerDown(task, e)}
                    style={{
                      left: `${coords.left}px`,
                      width: `${coords.width}px`,
                    }}
                    className={`absolute flex items-center select-none cursor-grab active:cursor-grabbing transition-shadow ${
                      isInteractingThis
                        ? "ring-2 ring-blue-500 ring-offset-1 z-30 shadow-lg scale-[1.01]"
                        : "z-15 hover:shadow-xs"
                    } ${isDualTrack ? "top-1 h-4" : "h-5.5"}`}
                  >
                    {/* Left Resize Handle (Start Date Adjustment) */}
                    {!task.isMilestone && task.level !== "phase" && (
                      <div
                        data-task-interactive="handle-start"
                        onPointerDown={(e) => handleResizePointerDown(task, "start", e)}
                        title="Drag left edge to adjust start date"
                        className="absolute -left-1 top-0 bottom-0 w-2.5 cursor-ew-resize z-30 group/handle flex items-center justify-center hover:bg-white/40 rounded-l-xs"
                      >
                        <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/handle:bg-white group-hover/handle:h-4 group-hover/handle:w-1 transition-all" />
                      </div>
                    )}

                    {/* Bar Fill & Content by Type */}
                    {coords.type === "complete-green" && (
                      <div
                        className={`w-full h-full rounded-xs bg-emerald-500 flex items-center px-2 relative overflow-hidden ${
                          isCritical ? "border-t-2 border-rose-500" : ""
                        }`}
                      >
                        <span className="relative z-10 text-[9.5px] font-semibold text-white tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                          {isCritical && <Flame className="h-2.5 w-2.5 text-white/90 shrink-0" />}
                          <span>{coords.label}</span>
                        </span>
                      </div>
                    )}

                    {coords.type === "summary-bracket" && (
                      <div
                        className={`w-full h-full rounded-xs bg-blue-600 flex items-center relative ${
                          isCritical ? "border-t-2 border-rose-500" : ""
                        }`}
                      >
                        <span className="absolute -bottom-1 left-0 h-2 w-1.5 bg-blue-600 rounded-bl-xs" />
                        <span className="absolute -bottom-1 right-0 h-2 w-1.5 bg-blue-600 rounded-br-xs" />
                        <span className="relative z-10 text-[9px] font-bold text-white px-1.5 truncate">
                          {coords.label}
                        </span>
                        {coords.hasMilestone && (
                          <div className="absolute -right-2 h-2.5 w-2.5 rotate-45 bg-slate-800" />
                        )}
                      </div>
                    )}

                    {coords.type === "selected-columns" && (
                      <div
                        className={`w-full h-full rounded-xs border-2 border-blue-600 bg-blue-100/95 flex items-center px-2 text-blue-950 font-bold text-[10px] tracking-tight relative overflow-visible ${
                          isCritical ? "border-t-4 border-t-rose-600" : ""
                        }`}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-blue-300/60 rounded-l-xs pointer-events-none"
                          style={{ width: `${task.progress}%` }}
                        />
                        <span className="relative z-10 whitespace-nowrap pr-1 pl-1 truncate font-bold text-blue-950 flex items-center gap-1">
                          {isCritical && <Flame className="h-3 w-3 text-rose-600 shrink-0" />}
                          <span>{coords.label}</span>
                        </span>
                        {coords.hasMilestone && (
                          <div className="absolute -right-2 h-3 w-3 rotate-45 bg-slate-800 z-20" />
                        )}
                      </div>
                    )}

                    {coords.type === "task-blue" && (
                      <div
                        className={`w-full h-full rounded-xs bg-blue-500 flex items-center px-2 relative overflow-hidden ${
                          isCritical ? "border-t-2 border-rose-500" : ""
                        }`}
                      >
                        <div
                          className="absolute left-0 top-0 bottom-0 bg-blue-700/30 rounded-l-xs pointer-events-none"
                          style={{ width: `${task.progress}%` }}
                        />
                        <span className="relative z-10 text-[9.5px] font-semibold text-white tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                          {isCritical && <Flame className="h-2.5 w-2.5 text-white/90 shrink-0" />}
                          <span>{coords.label}</span>
                        </span>
                      </div>
                    )}

                    {coords.type === "task-gray" && (
                      <div
                        className={`w-full h-full rounded-xs border border-slate-300 bg-slate-200/90 flex items-center px-2 relative overflow-hidden ${
                          isCritical ? "border-t-2 border-rose-500" : ""
                        }`}
                      >
                        <span className="relative z-10 text-[9.5px] font-semibold text-slate-700 tracking-tight truncate w-full text-center flex items-center justify-center gap-1">
                          {isCritical && <Flame className="h-2.5 w-2.5 text-rose-600 shrink-0" />}
                          <span>{coords.label}</span>
                        </span>
                      </div>
                    )}

                    {coords.type === "milestone-diamond" && (
                      <div className="flex items-center">
                        <div
                          className={`h-3.5 w-3.5 rotate-45 bg-amber-500 ring-2 ${
                            isCritical ? "ring-rose-500" : "ring-white"
                          }`}
                        />
                        <span className="ml-2.5 whitespace-nowrap text-[11px] font-semibold text-slate-800 flex items-center gap-1">
                          {isCritical && <Flame className="h-3 w-3 text-rose-600 shrink-0" />}
                          <span>{coords.label}</span>
                        </span>
                      </div>
                    )}

                    {/* Right Resize Handle (Duration / Finish Adjustment) */}
                    {!task.isMilestone && task.level !== "phase" && (
                      <div
                        data-task-interactive="handle-end"
                        onPointerDown={(e) => handleResizePointerDown(task, "end", e)}
                        title="Drag right edge to extend or shorten duration"
                        className="absolute -right-1 top-0 bottom-0 w-2.5 cursor-ew-resize z-30 group/handle flex items-center justify-center hover:bg-white/40 rounded-r-xs"
                      >
                        <div className="w-0.5 h-3 bg-white/70 rounded-full group-hover/handle:bg-white group-hover/handle:h-4 group-hover/handle:w-1 transition-all" />
                      </div>
                    )}
                  </div>

                  {/* Dual-Track Baseline Reference Bar */}
                  {isDualTrack && baselineCoords && (
                    <>
                      {/* Translucent Delay Band connecting baseline finish to current finish */}
                      {baselineCoords.varianceDays > 0 && (
                        <div
                          className="absolute top-1 bottom-1.5 rounded-xs bg-amber-500/15 border-t border-b border-dashed border-amber-500/60 pointer-events-none z-8"
                          style={{
                            left: `${Math.min(
                              baselineCoords.left + baselineCoords.width,
                              coords.left + coords.width
                            )}px`,
                            width: `${Math.max(
                              4,
                              Math.abs(
                                coords.left +
                                  coords.width -
                                  (baselineCoords.left + baselineCoords.width)
                              )
                            )}px`,
                          }}
                        />
                      )}

                      {/* Baseline Solid/Hatched Bar */}
                      {baselineCoords.isMilestone ? (
                        <div
                          className="absolute bottom-1 h-3 w-3 rotate-45 border-2 border-slate-600 bg-slate-400 z-12"
                          style={{ left: `${baselineCoords.left}px` }}
                          title={`Baseline 0 Milestone: ${task.baseline0Start}`}
                        />
                      ) : (
                        <div
                          className="absolute bottom-1.5 h-2.5 rounded-xs border border-slate-500/80 z-10 overflow-visible"
                          style={{
                            left: `${baselineCoords.left}px`,
                            width: `${baselineCoords.width}px`,
                            backgroundImage:
                              "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 3px, rgba(100, 116, 139, 0.95) 3px, rgba(100, 116, 139, 0.95) 6px)",
                          }}
                          title={`Baseline 0: ${task.baseline0Start} → ${task.baseline0Finish}`}
                        >
                          <span className="absolute -top-1 left-0 h-4 w-0.5 bg-slate-600 rounded-full" />
                          <span className="absolute -top-1 right-0 h-4 w-0.5 bg-slate-600 rounded-full" />
                        </div>
                      )}

                      {/* Variance Indicator Badge at finish edge */}
                      <span
                        className={`absolute inline-flex items-center rounded px-1.5 py-0.5 text-[9.5px] font-mono font-bold whitespace-nowrap z-25 border shadow-2xs ${
                          baselineCoords.varianceDays > 0
                            ? baselineCoords.varianceDays >= 5
                              ? "bg-red-50 text-red-700 border-red-300"
                              : "bg-amber-50 text-amber-800 border-amber-300"
                            : baselineCoords.varianceDays < 0
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}
                        style={{
                          left: `${
                            Math.max(
                              coords.left + coords.width,
                              baselineCoords.left + baselineCoords.width
                            ) + 6
                          }px`,
                          top: "2px",
                        }}
                      >
                        {baselineCoords.varianceDays > 0
                          ? `+${baselineCoords.varianceDays}d`
                          : baselineCoords.varianceDays < 0
                          ? `${baselineCoords.varianceDays}d`
                          : "0d"}
                      </span>
                    </>
                  )}

                  {/* Task with No Baseline Indicator */}
                  {isDualTrack && !baselineCoords && (
                    <span
                      className="absolute text-[9px] text-slate-300 font-mono italic whitespace-nowrap pointer-events-none"
                      style={{
                        left: `${coords.left + coords.width + 8}px`,
                        top: "12px",
                      }}
                    >
                      No baseline
                    </span>
                  )}
                </div>
              );
            })}
            {bottomSpacerHeight > 0 && (
              <div style={{ height: `${bottomSpacerHeight}px` }} aria-hidden="true" />
            )}
          </div>
        </div>
      </div>

      {/* Live Floating Drag & Resize Indicator Pill */}
      {previewInfo && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg border border-blue-400 bg-slate-900/95 px-3.5 py-2 text-white shadow-2xl backdrop-blur-md select-none animate-in fade-in zoom-in-95 duration-100"
          style={getBoundedTooltipStyle(
            activeInteraction?.currentPointerX || 0,
            (activeInteraction?.currentPointerY || 0) - 18,
            240,
            80
          )}
        >
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-blue-600/80 px-1.5 py-0.5 text-[10px] font-bold text-white uppercase tracking-wider">
              <MoveHorizontal className="h-3 w-3" />
              {previewInfo.action}
            </span>
            <span className="text-[12px] font-semibold text-white truncate max-w-[180px]">
              {previewInfo.taskName}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-mono">
            <span className="text-slate-300">
              {previewInfo.startDate} → {previewInfo.endDate}
            </span>
            <span className="rounded bg-blue-500/20 px-1.5 py-0.2 text-[10px] font-bold text-blue-300 border border-blue-400/30">
              {previewInfo.duration}d
            </span>
            <span className="text-amber-300 font-bold">
              ({previewInfo.deltaText})
            </span>
          </div>
        </div>
      )}

      {/* Floating Gantt Mini-Map / Navigator Overlay (Toggled from bottom bar) */}
      {showNavigator && (
        <div className="absolute bottom-13 left-4 z-30 flex flex-col rounded-sm border border-slate-200 bg-white p-2.5 shadow-md w-52 select-none pointer-events-auto">
          <div className="flex items-center justify-between text-[9.5px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5 px-0.5">
            <span className="flex items-center gap-1 text-slate-800 font-bold">
              <Compass className="h-3 w-3 text-blue-600" />
              Timeline Navigator
            </span>
            <button
              onClick={() => setShowNavigator(false)}
              className="text-slate-400 hover:text-slate-600 p-0.5 rounded-xs"
            >
              <X className="h-3 w-3" />
            </button>
          </div>

          <div className="relative h-11 w-full rounded-xs bg-slate-50 border border-slate-100 overflow-hidden px-1 py-1 flex flex-col justify-between">
            <div className="flex items-center gap-1 w-full">
              <div className="h-1 rounded-xs bg-emerald-500 w-4" />
              <div className="h-1 rounded-xs bg-emerald-500 w-6" />
            </div>
            <div className="h-1 rounded-xs bg-blue-600 w-22 ml-4" />
            <div className="flex items-center gap-1 w-full ml-11">
              <div className="h-1 rounded-xs bg-blue-500 w-6" />
              <div className="h-1 rounded-xs bg-blue-600 w-8" />
              <div className="h-1 rounded-xs bg-slate-300 w-5" />
            </div>
            <div className="flex items-center gap-1 w-full ml-24">
              <div className="h-1 rounded-xs bg-cyan-500 w-10" />
              <div className="h-1 rounded-xs bg-slate-300 w-8" />
              <div className="h-1.5 w-1.5 rotate-45 bg-amber-500 ml-1" />
            </div>

            <div
              className="absolute inset-y-0.5 border border-blue-600 bg-blue-600/15 rounded-xs pointer-events-none"
              style={{ left: "4px", width: "64px" }}
            />
          </div>
        </div>
      )}

      {/* Hover Floating Tooltip (Suppressed during active drag/resize/pan) */}
      {hoveredTask && !activeInteraction && (
        <div
          className="fixed z-50 pointer-events-none rounded-md border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-white shadow-xl max-w-xs select-none backdrop-blur-md"
          style={getBoundedTooltipStyle(hoveredTask.x, hoveredTask.y, 320, 220)}
        >
          <div className="text-[12px] font-semibold text-white truncate">
            {hoveredTask.task.name}
          </div>
          <div className="mt-1 space-y-1 text-[10.5px] font-mono">
            <div className="flex items-center justify-between gap-3 text-slate-300">
              <span className="text-slate-400">Current:</span>
              <span className="font-medium text-white">
                {hoveredTask.task.displayStart || hoveredTask.task.startDate} →{" "}
                {hoveredTask.task.displayEnd || hoveredTask.task.endDate} (
                {hoveredTask.task.duration}d)
              </span>
            </div>
            {hoveredTask.task.baseline0Start && hoveredTask.task.baseline0Finish ? (
              <>
                <div className="flex items-center justify-between gap-3 text-slate-300">
                  <span className="text-slate-400">Baseline 0:</span>
                  <span className="font-medium text-slate-200">
                    {hoveredTask.task.baseline0Start} → {hoveredTask.task.baseline0Finish}
                  </span>
                </div>
                {(() => {
                  const v = calculateScheduleVariance(hoveredTask.task, projectCalendar);
                  const disp = formatVarianceDisplay(v.finishVariance);
                  return (
                    <div className="flex items-center justify-between gap-3 pt-1 mt-1 border-t border-slate-700/80">
                      <span className="text-slate-400">Variance:</span>
                      <span
                        className={`font-semibold px-1 py-0.2 rounded text-[10px] ${
                          v.finishVariance > 0
                            ? "bg-amber-950/80 text-amber-300"
                            : v.finishVariance < 0
                            ? "bg-emerald-950/80 text-emerald-300"
                            : "bg-slate-800 text-slate-300"
                        }`}
                      >
                        {disp.label}
                      </span>
                    </div>
                  );
                })()}
              </>
            ) : (
              <div className="text-[10px] text-slate-400 italic pt-0.5">
                No baseline reference saved
              </div>
            )}
            <div className="flex items-center justify-between gap-3 text-slate-300 pt-1 mt-1 border-t border-slate-700/80">
              <span className="text-slate-400">Total / Free Float:</span>
              <span className="font-medium text-white">
                {hoveredTask.task.float ?? 0}d /{" "}
                {hoveredTask.task.freeFloat ?? hoveredTask.task.float ?? 0}d
              </span>
            </div>
            {hoveredTask.task.isCritical && (
              <div className="flex items-center gap-1.5 text-rose-400 font-semibold pt-0.5 text-[10.5px]">
                <Flame className="h-3 w-3 text-rose-500" />
                <span>Critical Path Activity</span>
              </div>
            )}
            <div className="text-[9.5px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
              <span>Drag to move · Edges to resize</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status / Critical Path / Zoom Toolbar */}
      <div className="flex h-11 shrink-0 items-center justify-between border-t border-slate-200 bg-white px-5 text-[12px] text-slate-600 select-none">
        {/* Left: Status Dot Legend */}
        <div className="flex items-center gap-4 text-[11.5px] font-medium text-slate-600">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-emerald-500" />
            <span>On track</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-amber-500" />
            <span>At risk</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-red-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-slate-300" />
            <span>Not started</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2 w-2 rotate-45 bg-slate-800" />
            <span>Milestone</span>
          </div>

          {showBaselineComparison && (
            <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
              <div className="flex items-center gap-1.5">
                <div
                  className="h-2 w-4 rounded-xs border border-slate-500/80"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.95), rgba(148, 163, 184, 0.95) 2px, rgba(100, 116, 139, 0.95) 2px, rgba(100, 116, 139, 0.95) 4px)",
                  }}
                />
                <span className="font-semibold text-slate-700">Baseline 0</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-xs bg-amber-500" />
                <span className="font-semibold text-amber-700">Schedule Slip</span>
              </div>
            </div>
          )}
        </div>

        {/* Center / Right: Navigator Toggle + Pan Hint + Task Count */}
        <div className="flex items-center gap-3 text-[12px]">
          <span className="text-[11px] text-slate-400 flex items-center gap-1">
            <Hand className="h-3 w-3 text-slate-400" />
            <span>Click &amp; drag canvas to pan</span>
          </span>

          <span className="text-slate-300">·</span>

          {/* Navigator Toggle Button */}
          <button
            onClick={() => setShowNavigator(!showNavigator)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-sm border text-[11px] font-medium transition-colors ${
              showNavigator
                ? "border-blue-500 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
            title="Toggle Gantt Mini-Map Navigator"
          >
            <Compass className="h-3.5 w-3.5 text-blue-600" />
            <span>Navigator</span>
          </button>

          {/* Tasks Shown Counter */}
          <div className="flex items-center gap-1.5 text-[11.5px] pl-1 font-mono">
            <span className="text-slate-500">{tasks.length} tasks shown</span>
          </div>
        </div>
      </div>
    </div>
  );
}
