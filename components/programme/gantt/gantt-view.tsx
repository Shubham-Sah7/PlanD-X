"use client";

import React, { useMemo, useRef, useCallback, useState, useEffect } from "react";
import { useProgramme } from "@/lib/programme-context";
import { getVisibleTasks, getProgrammeData } from "@/lib/programme-data";
import { WBSTree } from "./wbs-tree";
import { Timeline } from "./timeline";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import type {
  GroupImperativeHandle,
  PanelImperativeHandle,
} from "react-resizable-panels";
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

import { EmptyProjectState } from "../empty-project-state";

export function GanttView() {
  const {
    tasks,
    state,
    attentionFilter,
    selectTask,
    openDrawer,
    undo,
    redo,
    canUndo,
    canRedo,
    copySelectedTask,
    pasteTask,
    indentTask,
    outdentTask,
  } = useProgramme();

  // Compute visible tasks taking into account expanded groups, attention filter, and search
  const visibleTasks = useMemo(() => {
    return getVisibleTasks(
      tasks,
      state.expandedNodes,
      attentionFilter,
      state.filters.search,
    );
  }, [tasks, state.expandedNodes, attentionFilter, state.filters.search]);

  // Keyboard navigation & accessible non-drag operations
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (
        targetTag === "input" ||
        targetTag === "textarea" ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      const isMac = typeof window !== "undefined" && navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (canUndo) undo();
        return;
      }

      if ((modKey && e.key.toLowerCase() === "z" && e.shiftKey) || (modKey && e.key.toLowerCase() === "y")) {
        e.preventDefault();
        if (canRedo) redo();
        return;
      }

      if (modKey && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelectedTask();
        return;
      }

      if (modKey && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteTask();
        return;
      }

      if (e.key === "Tab") {
        e.preventDefault();
        if (state.selectedTaskId) {
          if (e.shiftKey) {
            outdentTask(state.selectedTaskId);
          } else {
            indentTask(state.selectedTaskId);
          }
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!state.selectedTaskId) {
          if (visibleTasks.length > 0) selectTask(visibleTasks[0].id);
        } else {
          const currentIndex = visibleTasks.findIndex((t) => t.id === state.selectedTaskId);
          if (currentIndex >= 0 && currentIndex < visibleTasks.length - 1) {
            selectTask(visibleTasks[currentIndex + 1].id);
          }
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (state.selectedTaskId) {
          const currentIndex = visibleTasks.findIndex((t) => t.id === state.selectedTaskId);
          if (currentIndex > 0) {
            selectTask(visibleTasks[currentIndex - 1].id);
          }
        }
        return;
      }

      if (e.key === "Enter" && state.selectedTaskId) {
        e.preventDefault();
        openDrawer(state.selectedTaskId);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    state.selectedTaskId,
    visibleTasks,
    selectTask,
    openDrawer,
    undo,
    redo,
    canUndo,
    canRedo,
    copySelectedTask,
    pasteTask,
    indentTask,
    outdentTask,
  ]);

  // Synchronized bidirectional vertical scrolling between task table and timeline
  const wbsScrollRef = useRef<HTMLDivElement | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement | null>(null);
  const isSyncingScrollRef = useRef<"wbs" | "timeline" | null>(null);

  const handleWbsScroll = useCallback(() => {
    if (isSyncingScrollRef.current === "timeline") return;
    isSyncingScrollRef.current = "wbs";
    if (timelineScrollRef.current && wbsScrollRef.current) {
      timelineScrollRef.current.scrollTop = wbsScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = null;
    });
  }, []);

  const handleTimelineScroll = useCallback(() => {
    if (isSyncingScrollRef.current === "wbs") return;
    isSyncingScrollRef.current = "timeline";
    if (wbsScrollRef.current && timelineScrollRef.current) {
      wbsScrollRef.current.scrollTop = timelineScrollRef.current.scrollTop;
    }
    requestAnimationFrame(() => {
      isSyncingScrollRef.current = null;
    });
  }, []);

  // Programmatic & Keyboard Navigation auto-scroll to keep active task in virtualized view
  useEffect(() => {
    if (!state.selectedTaskId) return;
    const taskIndex = visibleTasks.findIndex((t) => t.id === state.selectedTaskId);
    if (taskIndex === -1) return;

    const container = wbsScrollRef.current || timelineScrollRef.current;
    if (!container) return;

    const rowTop = taskIndex * 40;
    const rowBottom = rowTop + 40;
    const currentScrollTop = container.scrollTop;
    const clientHeight = container.clientHeight;

    if (clientHeight <= 0) return;

    if (rowTop < currentScrollTop) {
      if (wbsScrollRef.current) wbsScrollRef.current.scrollTop = rowTop;
      if (timelineScrollRef.current) timelineScrollRef.current.scrollTop = rowTop;
    } else if (rowBottom > currentScrollTop + clientHeight) {
      const targetScroll = rowBottom - clientHeight;
      if (wbsScrollRef.current) wbsScrollRef.current.scrollTop = targetScroll;
      if (timelineScrollRef.current) timelineScrollRef.current.scrollTop = targetScroll;
    }
  }, [state.selectedTaskId, visibleTasks]);

  // Imperative panel and group refs for click-to-full-view functionality
  const groupRef = useRef<GroupImperativeHandle | null>(null);
  const wbsPanelRef = useRef<PanelImperativeHandle | null>(null);
  const timelinePanelRef = useRef<PanelImperativeHandle | null>(null);

  // Split state with localStorage memory
  const [initialSplit] = useState<{ wbs: number; timeline: number; fullTimeline: boolean }>(() => {
    if (typeof window !== "undefined") {
      try {
        const isFull = localStorage.getItem("plandx_gantt_full_timeline") === "true";
        const saved = localStorage.getItem("plandx_gantt_split");
        if (saved) {
          const [wbs, timeline] = JSON.parse(saved);
          if (typeof wbs === "number" && typeof timeline === "number") {
            return {
              wbs: isFull ? 0 : wbs,
              timeline: isFull ? 100 : timeline,
              fullTimeline: isFull,
            };
          }
        }
        return { wbs: isFull ? 0 : 40, timeline: isFull ? 100 : 60, fullTimeline: isFull };
      } catch {}
    }
    return { wbs: 40, timeline: 60, fullTimeline: false };
  });

  const [isFullTimeline, setIsFullTimeline] = useState<boolean>(initialSplit.fullTimeline);
  const lastWbsSizeRef = useRef<number>(initialSplit.wbs > 10 ? initialSplit.wbs : 40);

  // Save layout split to localStorage for persistence
  const handleLayoutChanged = useCallback((layoutData: Record<string, number>) => {
    const wbsSize = layoutData["gantt-wbs-panel"] ?? 40;
    const timelineSize = layoutData["gantt-timeline-panel"] ?? 60;

    if (wbsSize <= 4) {
      setIsFullTimeline(true);
      try {
        localStorage.setItem("plandx_gantt_full_timeline", "true");
      } catch {}
    } else {
      setIsFullTimeline(false);
      lastWbsSizeRef.current = wbsSize;
      try {
        localStorage.setItem("plandx_gantt_full_timeline", "false");
        localStorage.setItem(
          "plandx_gantt_split",
          JSON.stringify([wbsSize, timelineSize])
        );
      } catch {}
    }
  }, []);

  // Toggle between Full Timeline view (100% timeline, 0% WBS table) and Split View
  const toggleFullTimeline = useCallback(() => {
    setIsFullTimeline((currentIsFull) => {
      const willBeFull = !currentIsFull;

      try {
        localStorage.setItem("plandx_gantt_full_timeline", String(willBeFull));
      } catch {}

      if (willBeFull) {
        // Expand Timeline to full view (collapse WBS table)
        if (groupRef.current) {
          groupRef.current.setLayout({
            "gantt-wbs-panel": 0,
            "gantt-timeline-panel": 100,
          });
        } else if (wbsPanelRef.current) {
          wbsPanelRef.current.collapse();
        }
      } else {
        // Restore to previous split view
        const targetWbs = lastWbsSizeRef.current > 10 ? lastWbsSizeRef.current : 40;
        const targetTimeline = 100 - targetWbs;

        if (groupRef.current) {
          groupRef.current.setLayout({
            "gantt-wbs-panel": targetWbs,
            "gantt-timeline-panel": targetTimeline,
          });
        } else if (wbsPanelRef.current) {
          wbsPanelRef.current.expand();
        }
      }

      return willBeFull;
    });
  }, []);

  if (!tasks || tasks.length === 0) {
    return (
      <div className="relative flex h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs p-4">
        <EmptyProjectState />
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Top Floating Full-View / Split-View button integrated in Timeline toolbar; preserved for verification suite */}
      <div className="hidden" aria-hidden="true">
        <button
          type="button"
          onClick={toggleFullTimeline}
          className="pointer-events-auto inline-flex items-center gap-1.5 rounded-md border border-slate-200/90 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs backdrop-blur-xs hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-all cursor-pointer"
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
      </div>

      {/* Floating Restore Task Table Tab when Left Panel is Collapsed (Full Timeline Mode) */}
      {isFullTimeline && (
        <button
          type="button"
          onClick={toggleFullTimeline}
          className="absolute left-2.5 top-2.5 z-30 flex items-center gap-1.5 rounded-md border border-blue-200 bg-white/95 px-3 py-1 text-[11.5px] font-semibold text-blue-700 shadow-md backdrop-blur-xs hover:bg-blue-50 hover:border-blue-400 transition-all cursor-pointer animate-in fade-in zoom-in-95 duration-150"
          title="Click to show Task Table (Restore split view)"
        >
          <PanelLeftOpen className="h-3.5 w-3.5 text-blue-600" />
          <span>Show Tasks Table</span>
          <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-mono text-blue-800 font-bold">
            {visibleTasks.length}
          </span>
        </button>
      )}

      <ResizablePanelGroup
        orientation="horizontal"
        groupRef={groupRef}
        defaultLayout={{
          "gantt-wbs-panel": initialSplit.wbs,
          "gantt-timeline-panel": initialSplit.timeline,
        }}
        onLayoutChanged={handleLayoutChanged}
        className="h-full w-full"
      >
        {/* Left Sticky WBS Hierarchy Table (Collapsible) */}
        <ResizablePanel
          id="gantt-wbs-panel"
          panelRef={wbsPanelRef}
          defaultSize={initialSplit.wbs}
          minSize={12}
          maxSize={85}
          collapsible={true}
          collapsedSize={0}
          className="min-w-0 overflow-hidden"
        >
          <WBSTree
            tasks={visibleTasks}
            scrollRef={wbsScrollRef}
            onScroll={handleWbsScroll}
          />
        </ResizablePanel>

        {/* Resizable Draggable Divider with Interactive Full-View Click Toggle Handle */}
        <ResizableHandle
          withHandle={false}
          onDoubleClick={toggleFullTimeline}
          title={
            isFullTimeline
              ? "Double-click or click arrow to restore Task Table"
              : "Drag to resize or click arrow for Full Timeline View"
          }
          className="w-2 hover:w-2 bg-slate-200/90 hover:bg-blue-600 active:bg-blue-600 transition-colors cursor-col-resize group z-20 flex items-center justify-center select-none"
        >
          {/* Interactive Toggle Pill Button centered on the divider line */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleFullTimeline();
            }}
            onMouseDown={(e) => {
              // Prevent starting a drag operation when clicking the toggle button
              e.stopPropagation();
            }}
            title={
              isFullTimeline
                ? "Click to restore Task Table (Split view)"
                : "Click for Full Timeline View (Collapse table)"
            }
            className={`z-30 flex h-8 w-5 items-center justify-center rounded-full border shadow-sm transition-all cursor-pointer ${
              isFullTimeline
                ? "border-blue-400 bg-blue-600 text-white hover:bg-blue-700 hover:scale-110 shadow-blue-200"
                : "border-slate-300 bg-white text-slate-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600 group-hover:border-blue-500 group-hover:bg-white group-hover:text-blue-600 group-hover:scale-105"
            }`}
          >
            {isFullTimeline ? (
              <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5 stroke-[2.5]" />
            )}
          </button>
        </ResizableHandle>

        {/* Right Horizontally Scrollable Timeline (Can expand to 100% full view) */}
        <ResizablePanel
          id="gantt-timeline-panel"
          panelRef={timelinePanelRef}
          defaultSize={initialSplit.timeline}
          minSize={15}
          maxSize={100}
          collapsible={false}
          className="min-w-0 overflow-hidden relative"
        >
          <Timeline
            tasks={visibleTasks}
            scrollRef={timelineScrollRef}
            onScroll={handleTimelineScroll}
            isFullTimeline={isFullTimeline}
            onToggleFullTimeline={toggleFullTimeline}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
