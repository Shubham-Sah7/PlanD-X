"use client";

import React, { useMemo } from "react";
import { useProgramme } from "@/lib/programme-context";
import { getVisibleTasks, getProgrammeData } from "@/lib/programme-data";
import { WBSTree } from "./wbs-tree";
import { Timeline } from "./timeline";

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

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Left Sticky WBS Hierarchy Table */}
      <WBSTree tasks={visibleTasks} />

      {/* Right Horizontally Scrollable Timeline */}
      <Timeline tasks={visibleTasks} />
    </div>
  );
}
