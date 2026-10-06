"use client";

import { useProgramme } from "@/lib/programme-context";
import type { ViewMode } from "@/lib/programme-types";
import { BarChart3, Network, List, CalendarDays, Box } from "lucide-react";

const views: { id: ViewMode; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "gantt", label: "Gantt", icon: BarChart3 },
  { id: "network", label: "Network", icon: Network },
  { id: "list", label: "List", icon: List },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "3d", label: "3D", icon: Box },
];

export function ViewTabs() {
  const { state, setActiveView } = useProgramme();

  return (
    <div className="inline-flex items-center rounded-lg border border-border bg-muted/50 p-0.5">
      {views.map((view) => {
        const isActive = state.activeView === view.id;
        const Icon = view.icon;
        return (
          <button
            key={view.id}
            onClick={() => setActiveView(view.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium transition-all ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
