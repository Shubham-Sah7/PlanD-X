"use client";

import React, { useMemo, useRef, useCallback } from "react";
import { useProgramme } from "@/lib/programme-context";
import { getVisibleTasks, getProgrammeData } from "@/lib/programme-data";
import { WBSTree } from "./wbs-tree";
import { Timeline } from "./timeline";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";

export function GanttView() {
  const programme = useMemo(() => getProgrammeData(), []);
  const { state, attentionFilter } = useProgramme();

  // Compute visible tasks taking into account expanded groups, attention filter, and search
  const visibleTasks = useMemo(() => {
    return getVisibleTasks(
      programme,
      state.expandedNodes,
      attentionFilter,
      state.filters.search,
    );
  }, [programme, state.expandedNodes, attentionFilter, state.filters.search]);

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

  // Save layout split to localStorage for persistence
  const handleLayoutChanged = useCallback((layoutData: Record<string, number>) => {
    const wbsSize = layoutData["gantt-wbs-panel"] ?? 40;
    const timelineSize = layoutData["gantt-timeline-panel"] ?? 60;
    try {
      localStorage.setItem(
        "plandx_gantt_split",
        JSON.stringify([wbsSize, timelineSize])
      );
    } catch {}
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
      <ResizablePanelGroup
        orientation="horizontal"
        onLayoutChanged={handleLayoutChanged}
        className="h-full w-full"
      >
        {/* Left Sticky WBS Hierarchy Table */}
        <ResizablePanel
          id="gantt-wbs-panel"
          defaultSize={40}
          minSize={22}
          maxSize={65}
          className="min-w-0 overflow-hidden"
        >
          <WBSTree
            tasks={visibleTasks}
            scrollRef={wbsScrollRef}
            onScroll={handleWbsScroll}
          />
        </ResizablePanel>

        {/* Resizable Draggable Divider */}
        <ResizableHandle
          withHandle
          className="w-1.5 hover:w-1.5 bg-slate-200 hover:bg-blue-500 active:bg-blue-600 transition-colors cursor-col-resize group z-20"
        />

        {/* Right Horizontally Scrollable Timeline */}
        <ResizablePanel
          id="gantt-timeline-panel"
          defaultSize={60}
          minSize={35}
          maxSize={78}
          className="min-w-0 overflow-hidden"
        >
          <Timeline
            tasks={visibleTasks}
            scrollRef={timelineScrollRef}
            onScroll={handleTimelineScroll}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
