"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Check,
  Plus,
  Trash2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Info,
  Layers,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  ProjectCalendar,
  ProjectHoliday,
  WorkingWeekPreset,
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  CONTINUOUS_7_DAY_CALENDAR,
  formatDisplayDate,
  countWorkingDays,
} from "@/lib/programme-calendar";

const DAYS_OF_WEEK = [
  { day: 1, name: "Monday", short: "Mon" },
  { day: 2, name: "Tuesday", short: "Tue" },
  { day: 3, name: "Wednesday", short: "Wed" },
  { day: 4, name: "Thursday", short: "Thu" },
  { day: 5, name: "Friday", short: "Fri" },
  { day: 6, name: "Saturday", short: "Sat" },
  { day: 0, name: "Sunday", short: "Sun" },
];

export function ProjectCalendarModal() {
  const {
    projectCalendar,
    applyCalendar,
    isCalendarModalOpen,
    closeCalendarModal,
  } = useProgramme();

  // Local draft state for calendar editing
  const [draftCalendar, setDraftCalendar] = useState<ProjectCalendar>(projectCalendar);
  const [activeTab, setActiveTab] = useState<"working-days" | "holidays">("working-days");

  // Form state for adding custom holidays
  const [newHolName, setNewHolName] = useState("");
  const [newHolDate, setNewHolDate] = useState("");
  const [newHolType, setNewHolType] = useState<ProjectHoliday["type"]>("public-holiday");
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (isCalendarModalOpen) {
      setDraftCalendar(projectCalendar);
      setValidationError(null);
    }
  }, [isCalendarModalOpen, projectCalendar]);

  if (!isCalendarModalOpen) return null;

  // Handle Preset selection
  const selectPreset = (preset: WorkingWeekPreset) => {
    setValidationError(null);
    if (preset === "5-day") {
      setDraftCalendar((prev) => ({
        ...prev,
        name: STANDARD_5_DAY_CALENDAR.name,
        workingWeekPreset: "5-day",
        workingDays: [1, 2, 3, 4, 5],
      }));
    } else if (preset === "6-day") {
      setDraftCalendar((prev) => ({
        ...prev,
        name: CONSTRUCTION_6_DAY_CALENDAR.name,
        workingWeekPreset: "6-day",
        workingDays: [1, 2, 3, 4, 5, 6],
      }));
    } else if (preset === "7-day") {
      setDraftCalendar((prev) => ({
        ...prev,
        name: CONTINUOUS_7_DAY_CALENDAR.name,
        workingWeekPreset: "7-day",
        workingDays: [0, 1, 2, 3, 4, 5, 6],
      }));
    } else {
      setDraftCalendar((prev) => ({
        ...prev,
        workingWeekPreset: "custom",
      }));
    }
  };

  // Toggle individual day
  const toggleWorkingDay = (day: number) => {
    setValidationError(null);
    setDraftCalendar((prev) => {
      let nextDays = [...prev.workingDays];
      if (nextDays.includes(day)) {
        if (nextDays.length === 1) {
          setValidationError("At least one working day must be configured in the week.");
          return prev;
        }
        nextDays = nextDays.filter((d) => d !== day);
      } else {
        nextDays.push(day);
        nextDays.sort();
      }

      let preset: WorkingWeekPreset = "custom";
      let name = `Custom Calendar (${nextDays.length}d)`;
      if (nextDays.length === 5 && !nextDays.includes(0) && !nextDays.includes(6)) {
        preset = "5-day";
        name = "Standard 5-Day Week (Mon–Fri)";
      } else if (nextDays.length === 6 && !nextDays.includes(0)) {
        preset = "6-day";
        name = "Construction 6-Day Week (Mon–Sat)";
      } else if (nextDays.length === 7) {
        preset = "7-day";
        name = "Continuous 7-Day Operations";
      }

      return {
        ...prev,
        workingDays: nextDays,
        workingWeekPreset: preset,
        name,
      };
    });
  };

  // Add holiday / exception
  const handleAddHoliday = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolName.trim() || !newHolDate) {
      setValidationError("Please enter both a name and date for the holiday or non-working day.");
      return;
    }

    if (draftCalendar.holidays.some((h) => h.date === newHolDate)) {
      setValidationError("A holiday or exception is already configured for this date.");
      return;
    }

    const newHol: ProjectHoliday = {
      id: `hol-${Date.now()}`,
      name: newHolName.trim(),
      date: newHolDate,
      type: newHolType,
    };

    setDraftCalendar((prev) => ({
      ...prev,
      holidays: [...prev.holidays, newHol].sort((a, b) => a.date.localeCompare(b.date)),
    }));

    setNewHolName("");
    setNewHolDate("");
    setValidationError(null);
  };

  const removeHoliday = (id: string) => {
    setDraftCalendar((prev) => ({
      ...prev,
      holidays: prev.holidays.filter((h) => h.id !== id),
    }));
  };

  const handleApply = () => {
    if (draftCalendar.workingDays.length === 0) {
      setValidationError("Cannot apply calendar with 0 working days.");
      return;
    }
    applyCalendar(draftCalendar);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] rounded-xl border border-slate-200 bg-white shadow-2xl overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-semibold text-slate-900 leading-tight">
                Project Working Calendar &amp; Time
              </h2>
              <p className="text-[12.5px] text-slate-500 mt-0.5">
                Configure working days, weekly shift patterns, and project holidays for Ormiston Rise.
              </p>
            </div>
          </div>
          <button
            onClick={closeCalendarModal}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 px-6 bg-white text-[13px] font-medium text-slate-600">
          <button
            onClick={() => setActiveTab("working-days")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === "working-days"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Working Week &amp; Hours</span>
            <span className="rounded-full bg-blue-100 text-blue-700 px-1.5 py-0.2 text-[11px] font-semibold">
              {draftCalendar.workingDays.length}d / wk
            </span>
          </button>
          <button
            onClick={() => setActiveTab("holidays")}
            className={`py-3 px-3 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              activeTab === "holidays"
                ? "border-blue-600 text-blue-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CalendarIcon className="h-4 w-4" />
            <span>Holidays &amp; Site Closures</span>
            <span className="rounded-full bg-slate-100 text-slate-600 px-1.5 py-0.2 text-[11px] font-semibold">
              {draftCalendar.holidays.length}
            </span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-[13px]">
          {validationError && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 p-3 text-[12.5px] text-red-800">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
              <span>{validationError}</span>
            </div>
          )}

          {activeTab === "working-days" && (
            <>
              {/* Preset Selector */}
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-slate-500 mb-2.5">
                  Standard Working Week Presets
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Preset 1: 5-Day Week */}
                  <div
                    onClick={() => selectPreset("5-day")}
                    className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                      draftCalendar.workingWeekPreset === "5-day"
                        ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-[13.5px]">5-Day Standard</span>
                      {draftCalendar.workingWeekPreset === "5-day" && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11.5px] text-slate-500 leading-snug">
                      Mon – Fri (Saturday &amp; Sunday non-working). Standard commercial contract timeline.
                    </p>
                  </div>

                  {/* Preset 2: 6-Day Week */}
                  <div
                    onClick={() => selectPreset("6-day")}
                    className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                      draftCalendar.workingWeekPreset === "6-day"
                        ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-[13.5px]">6-Day Construction</span>
                      {draftCalendar.workingWeekPreset === "6-day" && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11.5px] text-slate-500 leading-snug">
                      Mon – Sat (Sunday non-working). Accelerated structural pours and contractor shifts.
                    </p>
                  </div>

                  {/* Preset 3: 7-Day Continuous */}
                  <div
                    onClick={() => selectPreset("7-day")}
                    className={`rounded-lg border p-3.5 cursor-pointer transition-all ${
                      draftCalendar.workingWeekPreset === "7-day"
                        ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-600"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-900 text-[13.5px]">7-Day Continuous</span>
                      {draftCalendar.workingWeekPreset === "7-day" && (
                        <Check className="h-4 w-4 text-blue-600" />
                      )}
                    </div>
                    <p className="text-[11.5px] text-slate-500 leading-snug">
                      Continuous 7-day works. Used for specialized continuous concrete curing and civil works.
                    </p>
                  </div>
                </div>
              </div>

              {/* Working Days Pills */}
              <div>
                <label className="block text-[12px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Active Working Days (Click to toggle)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-7 gap-2">
                  {DAYS_OF_WEEK.map((item) => {
                    const isWorking = draftCalendar.workingDays.includes(item.day);
                    return (
                      <button
                        key={item.day}
                        type="button"
                        onClick={() => toggleWorkingDay(item.day)}
                        className={`flex flex-col items-center justify-center p-3 rounded-lg border text-center transition-all ${
                          isWorking
                            ? "border-blue-300 bg-blue-50/90 text-blue-900 shadow-2xs"
                            : "border-slate-200 bg-slate-50 text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        <span className="font-bold text-[13px]">{item.short}</span>
                        <span
                          className={`mt-1 text-[10.5px] font-medium uppercase tracking-wider ${
                            isWorking ? "text-blue-700" : "text-slate-400"
                          }`}
                        >
                          {isWorking ? "Working" : "Off"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Working Hours Configuration */}
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 flex items-center justify-between">
                <div>
                  <span className="font-semibold text-slate-900 block text-[13.5px]">Daily Working Hours</span>
                  <span className="text-[12px] text-slate-500">
                    Standard single shift: 08:00 – 17:00 with 1 hour lunch break.
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={4}
                    max={16}
                    step={0.5}
                    value={draftCalendar.workingHoursPerDay}
                    onChange={(e) =>
                      setDraftCalendar((prev) => ({
                        ...prev,
                        workingHoursPerDay: Math.max(1, Math.min(24, Number(e.target.value) || 8)),
                      }))
                    }
                    className="h-8 w-18 rounded border border-slate-200 bg-white px-2 text-center font-mono font-medium text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                  <span className="text-slate-600 text-[12.5px] font-medium">hrs / day</span>
                </div>
              </div>

              {/* Schedule Impact Explanation */}
              <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3.5 flex items-start gap-2.5">
                <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[12px] text-blue-950 leading-relaxed">
                  <span className="font-semibold">Scheduling Engine Impact:</span>{" "}
                  {draftCalendar.workingWeekPreset === "6-day" ? (
                    <span>
                      Applying a <strong>6-Day Construction Calendar</strong> schedules tasks across Saturdays, skipping only Sundays and declared public holidays. This reduces overall calendar duration and accelerates milestone handovers.
                    </span>
                  ) : draftCalendar.workingWeekPreset === "5-day" ? (
                    <span>
                      Applying a <strong>5-Day Standard Calendar</strong> skips both Saturdays and Sundays for all task working day calculations. Successors with Finish-to-Start dependencies will resume on Mondays.
                    </span>
                  ) : (
                    <span>
                      Custom working week with <strong>{draftCalendar.workingDays.length} working days</strong>. Non-working days will be automatically bypassed when computing task finish dates and predecessor lag.
                    </span>
                  )}
                </div>
              </div>
            </>
          )}

          {activeTab === "holidays" && (
            <>
              {/* Add Holiday Form */}
              <form onSubmit={handleAddHoliday} className="rounded-lg border border-slate-200 bg-slate-50/60 p-4 space-y-3">
                <span className="block font-semibold text-slate-900 text-[13px]">
                  Add Project Holiday or Non-Working Exception
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <input
                    type="text"
                    placeholder="e.g. Site Summer Closure"
                    value={newHolName}
                    onChange={(e) => setNewHolName(e.target.value)}
                    className="h-8 rounded border border-slate-200 bg-white px-3 text-[12.5px] text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                  <input
                    type="date"
                    value={newHolDate}
                    onChange={(e) => setNewHolDate(e.target.value)}
                    className="h-8 rounded border border-slate-200 bg-white px-2.5 text-[12.5px] text-slate-800 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                  />
                  <div className="flex gap-2">
                    <select
                      value={newHolType}
                      onChange={(e) => setNewHolType(e.target.value as any)}
                      className="h-8 flex-1 rounded border border-slate-200 bg-white px-2 text-[12px] text-slate-700 shadow-2xs focus:border-blue-500 focus:outline-hidden"
                    >
                      <option value="public-holiday">Public Holiday</option>
                      <option value="site-closure">Site Closure</option>
                      <option value="weather">Weather Downtime</option>
                      <option value="custom">Other Exception</option>
                    </select>
                    <button
                      type="submit"
                      className="inline-flex h-8 items-center gap-1 rounded bg-blue-600 px-3 text-[12px] font-medium text-white hover:bg-blue-700 transition-colors shrink-0 shadow-2xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </form>

              {/* Holidays List */}
              <div>
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-slate-500">
                    Configured Project Exceptions ({draftCalendar.holidays.length})
                  </span>
                  <span className="text-[11.5px] text-slate-400">
                    Tasks spanning these dates will skip them as non-working time
                  </span>
                </div>

                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                  {draftCalendar.holidays.map((h) => (
                    <div
                      key={h.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3.5 py-2 hover:bg-slate-50/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[12px] font-semibold text-slate-700">
                          {formatDisplayDate(h.date)}
                        </span>
                        <span className="text-[13px] font-medium text-slate-900">{h.name}</span>
                        <span
                          className={`rounded px-1.5 py-0.2 text-[10px] font-semibold uppercase tracking-wide ${
                            h.type === "site-closure"
                              ? "bg-amber-100 text-amber-800"
                              : h.type === "weather"
                              ? "bg-sky-100 text-sky-800"
                              : "bg-purple-100 text-purple-800"
                          }`}
                        >
                          {h.type.replace("-", " ")}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeHoliday(h.id)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded transition-colors"
                        title="Remove exception"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3.5 bg-slate-50/60">
          <div className="text-[12px] text-slate-500">
            Active: <span className="font-semibold text-slate-700">{projectCalendar.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeCalendarModal}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[12.5px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              className="rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-[12.5px] font-semibold text-white transition-colors shadow-2xs flex items-center gap-1.5"
            >
              <Check className="h-4 w-4" />
              <span>Apply &amp; Recalculate Schedule</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
