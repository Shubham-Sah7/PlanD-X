"use client";

import React, { useState } from "react";
import { WBSPanel } from "./wbs-panel";
import { NetworkCanvas } from "./network-canvas";
import { NetworkFooter } from "./network-footer";
import { FolderTree, ChevronLeft, ChevronRight } from "lucide-react";

export function NetworkView() {
  const [wbsOpen, setWbsOpen] = useState(false);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white overflow-hidden select-none">
      {/* Network Canvas Main Section */}
      <div className="relative flex flex-1 overflow-hidden min-h-0">
        {/* Toggleable WBS Structure Panel */}
        {wbsOpen && (
          <WBSPanel
            isCollapsed={false}
            onToggleCollapse={() => setWbsOpen(false)}
          />
        )}

        {/* Collapsible WBS rail tab on left */}
        <button
          onClick={() => setWbsOpen(!wbsOpen)}
          className={`absolute left-0 top-20 z-20 flex items-center gap-1 rounded-r-lg border border-l-0 border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all ${
            wbsOpen ? "left-[230px]" : "left-0"
          }`}
          title={wbsOpen ? "Collapse WBS Structure" : "Expand WBS Structure"}
        >
          <FolderTree className="h-3 w-3 text-slate-500" />
          <span>WBS</span>
          {wbsOpen ? (
            <ChevronLeft className="h-3 w-3 text-slate-400" />
          ) : (
            <ChevronRight className="h-3 w-3 text-slate-400" />
          )}
        </button>

        {/* Full-width Network Canvas */}
        <div className="flex-1 min-w-0 h-full">
          <NetworkCanvas />
        </div>
      </div>

      {/* Network Footer: Legend on left, tasks count & View All on right */}
      <NetworkFooter />
    </div>
  );
}
