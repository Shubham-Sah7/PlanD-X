"use client";

import React, { useState } from "react";
import {
  HardHat,
  Truck,
  Building2,
  ClipboardCheck,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Clock,
  DollarSign,
  ChevronDown,
  UserCheck,
} from "lucide-react";
import type {
  ProgrammeTask,
  ProjectResource,
  TaskResourceAssignment,
  SiteAttendanceRecord,
  ResourceType,
} from "@/lib/programme-types";
import {
  MASTER_SUBCONTRACTORS,
  createTaskAssignment,
  distinguishTaskResources,
} from "@/lib/programme-resources";

interface TaskResourceAttendanceSectionProps {
  task: ProgrammeTask;
  projectResources: ProjectResource[];
  onAssignResource: (assignment: Omit<TaskResourceAssignment, "assignmentId">) => void;
  onRemoveResource: (assignmentId: string) => void;
  onLinkSubcontractor: (vendorId: string, vendorName: string) => void;
  onRecordAttendance: (attendance: Omit<SiteAttendanceRecord, "id">) => void;
}

export function TaskResourceAttendanceSection({
  task,
  projectResources,
  onAssignResource,
  onRemoveResource,
  onLinkSubcontractor,
  onRecordAttendance,
}: TaskResourceAttendanceSectionProps) {
  const distinction = distinguishTaskResources(task, projectResources);

  // Assignment creation form state
  const [isAddingAssignment, setIsAddingAssignment] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState<string>(
    projectResources[0]?.id || ""
  );
  const [assignmentUnits, setAssignmentUnits] = useState<number>(1.0);

  // Vendor linking state
  const [isLinkingVendor, setIsLinkingVendor] = useState(false);
  const [selectedVendorId, setSelectedVendorId] = useState<string>(
    MASTER_SUBCONTRACTORS[0]?.id || ""
  );

  // Attendance form state
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [attendanceHeadcount, setAttendanceHeadcount] = useState<number>(4);
  const [attendanceVerifier, setAttendanceVerifier] = useState<string>("Site Supervisor");
  const [attendanceNotes, setAttendanceNotes] = useState<string>("");

  const handleCreateAssignment = () => {
    const res = projectResources.find((r) => r.id === selectedResourceId);
    if (!res) return;

    const taskDuration = task.duration || 1;
    const assignment = createTaskAssignment(res, assignmentUnits, taskDuration, 8);
    onAssignResource(assignment);
    setIsAddingAssignment(false);
  };

  const handleLinkVendor = () => {
    const vendor = MASTER_SUBCONTRACTORS.find((v) => v.id === selectedVendorId);
    if (!vendor) return;

    onLinkSubcontractor(vendor.id, vendor.name);
    setIsLinkingVendor(false);
  };

  const handleAddAttendance = () => {
    if (attendanceHeadcount <= 0) return;

    onRecordAttendance({
      date: attendanceDate,
      headcount: attendanceHeadcount,
      trade: (typeof task.trade === "string" ? task.trade : task.tradeText) || "General",
      verifiedBy: attendanceVerifier,
      verifiedAt: new Date().toISOString(),
      notes: attendanceNotes.trim() || undefined,
    });
    setIsAddingAttendance(false);
    setAttendanceNotes("");
  };

  const getResourceTypeIcon = (type: ResourceType) => {
    switch (type) {
      case "equipment":
        return <Truck className="h-3.5 w-3.5 text-amber-600" />;
      case "work":
      case "labour":
        return <HardHat className="h-3.5 w-3.5 text-blue-600" />;
      case "cost":
        return <DollarSign className="h-3.5 w-3.5 text-emerald-600" />;
      default:
        return <HardHat className="h-3.5 w-3.5 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* ─── Architectural Principle Callout ─────────────────────────── */}
      <div className="rounded-lg border border-slate-200/80 bg-slate-50/80 p-2.5 text-[11.5px] text-slate-600 leading-relaxed">
        <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
          <HelpCircle className="h-3.5 w-3.5 text-indigo-600" />
          <span>Strict Construction Distinction Policy</span>
        </div>
        <p>
          <strong>1. Resource Assignment</strong> (Labour gangs & plant equipment executing hours) ≠{" "}
          <strong>2. Subcontractor Responsibility</strong> (Commercial vendor entity legally bound) ≠{" "}
          <strong>3. Site Attendance</strong> (Physical daily headcount logged on site).
        </p>
      </div>

      {/* ─── Part 1: Resource Assignments (Labour & Plant) ───────────── */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <HardHat className="h-4 w-4 text-indigo-600" />
            <span className="text-[12px] font-semibold text-slate-800">
              1. Resource Assignments ({task.assignments?.length || 0})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingAssignment(!isAddingAssignment)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Assign Resource</span>
          </button>
        </div>

        {/* Add Assignment Sub-form */}
        {isAddingAssignment && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 animate-in fade-in">
            <span className="text-[11px] font-semibold uppercase text-slate-500 block">
              Assign Resource from Catalogue
            </span>
            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-600 font-medium block mb-1">
                  Resource
                </label>
                <select
                  value={selectedResourceId}
                  onChange={(e) => setSelectedResourceId(e.target.value)}
                  className="w-full text-[12px] rounded border border-slate-300 p-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {projectResources.map((res) => (
                    <option key={res.id} value={res.id}>
                      {res.name} ({res.type.toUpperCase()}) · ${res.standardRate}/hr
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">
                    Units (1.0 = 100%)
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    max="10.0"
                    step="0.1"
                    value={assignmentUnits}
                    onChange={(e) => setAssignmentUnits(parseFloat(e.target.value) || 1.0)}
                    className="w-full text-[12px] rounded border border-slate-300 p-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-slate-600 font-medium block mb-1">
                    Duration
                  </label>
                  <div className="text-[12px] font-semibold text-slate-700 p-1.5 bg-slate-100 rounded border border-slate-200">
                    {task.duration || 1} working days
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingAssignment(false)}
                  className="text-[11px] px-2.5 py-1 rounded text-slate-600 hover:bg-slate-200 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreateAssignment}
                  className="text-[11px] px-2.5 py-1 rounded bg-indigo-600 text-white font-medium hover:bg-indigo-700 shadow-2xs"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Existing Assignments List */}
        {task.assignments && task.assignments.length > 0 ? (
          <div className="space-y-1.5">
            {task.assignments.map((asgn) => (
              <div
                key={asgn.assignmentId}
                className="flex items-center justify-between p-2 rounded-lg border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="p-1 rounded bg-white border border-slate-200 shrink-0">
                    {getResourceTypeIcon(asgn.resourceType)}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[12px] font-medium text-slate-800 truncate">
                      {asgn.resourceName}
                    </div>
                    <div className="flex items-center gap-2 text-[10.5px] text-slate-500">
                      <span>{(asgn.units * 100).toFixed(0)}% units</span>
                      <span>·</span>
                      <span>{asgn.plannedWorkHours}h work</span>
                      {asgn.cost > 0 && (
                        <>
                          <span>·</span>
                          <span className="font-semibold text-slate-700">${asgn.cost.toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onRemoveResource(asgn.assignmentId)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                  title="Remove assignment"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-[11.5px]">
            No specific labour gangs or plant equipment assigned yet.
          </div>
        )}
      </div>

      {/* ─── Part 2: Subcontractor Responsibility (Commercial Legal) ── */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4 text-amber-600" />
            <span className="text-[12px] font-semibold text-slate-800">
              2. Subcontractor Responsibility
            </span>
          </div>
          <span className="text-[10.5px] text-slate-500 font-medium">Commercial Entity</span>
        </div>

        {/* Current Subcontractor Status */}
        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-slate-900">
                {task.subcontractor || (typeof task.trade === "string" ? task.trade : "Unassigned Subcontractor")}
              </span>
              {distinction.subcontractor.isVerifiedVendor ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded">
                  <CheckCircle2 className="h-3 w-3" />
                  Verified Vendor
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  <AlertCircle className="h-3 w-3" />
                  Unverified Trade Name
                </span>
              )}
            </div>
            {!distinction.subcontractor.isVerifiedVendor && (
              <button
                type="button"
                onClick={() => setIsLinkingVendor(!isLinkingVendor)}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 hover:underline"
              >
                Link Vendor
              </button>
            )}
          </div>

          <p className="text-[11px] text-slate-500">
            {distinction.subcontractor.isVerifiedVendor
              ? "Linked to verified PlanD-X commercial vendor record with validated insurance and subcontract terms."
              : "Imported trade text from MS Project schedule. Not automatically converted to a verified vendor."}
          </p>

          {/* Linking Sub-form */}
          {isLinkingVendor && (
            <div className="p-2 bg-white rounded border border-slate-200 mt-2 space-y-2 animate-in fade-in">
              <label className="text-[11px] font-semibold text-slate-700 block">
                Select Verified PlanD-X Subcontractor
              </label>
              <select
                value={selectedVendorId}
                onChange={(e) => setSelectedVendorId(e.target.value)}
                className="w-full text-[12px] rounded border border-slate-300 p-1.5 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {MASTER_SUBCONTRACTORS.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.trades})
                  </option>
                ))}
              </select>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsLinkingVendor(false)}
                  className="text-[11px] px-2 py-0.5 text-slate-500 hover:bg-slate-100 rounded"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleLinkVendor}
                  className="text-[11px] px-2.5 py-1 bg-blue-600 text-white rounded font-medium hover:bg-blue-700"
                >
                  Link to Record
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── Part 3: Actual Site Attendance (Physical Site Verification) ─ */}
      <div className="rounded-lg border border-slate-200/90 bg-white p-3 space-y-2.5 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <ClipboardCheck className="h-4 w-4 text-emerald-600" />
            <span className="text-[12px] font-semibold text-slate-800">
              3. Actual Site Attendance ({task.siteAttendance?.length || 0})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingAttendance(!isAddingAttendance)}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-0.5 rounded transition-colors"
          >
            <Plus className="h-3 w-3" />
            <span>Log Headcount</span>
          </button>
        </div>

        {/* Add Attendance Sub-form */}
        {isAddingAttendance && (
          <div className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-2 animate-in fade-in">
            <span className="text-[11px] font-semibold uppercase text-emerald-800 block">
              Log Daily Verified Headcount
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10.5px] text-slate-600 font-medium block mb-0.5">
                  Date
                </label>
                <input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="w-full text-[12px] rounded border border-slate-300 p-1 bg-white text-slate-900"
                />
              </div>
              <div>
                <label className="text-[10.5px] text-slate-600 font-medium block mb-0.5">
                  Headcount (Operatives)
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={attendanceHeadcount}
                  onChange={(e) => setAttendanceHeadcount(parseInt(e.target.value, 10) || 1)}
                  className="w-full text-[12px] rounded border border-slate-300 p-1 bg-white text-slate-900"
                />
              </div>
            </div>
            <div>
              <label className="text-[10.5px] text-slate-600 font-medium block mb-0.5">
                Verified By
              </label>
              <input
                type="text"
                value={attendanceVerifier}
                onChange={(e) => setAttendanceVerifier(e.target.value)}
                placeholder="Supervisor Name"
                className="w-full text-[12px] rounded border border-slate-300 p-1 bg-white text-slate-900"
              />
            </div>
            <div>
              <label className="text-[10.5px] text-slate-600 font-medium block mb-0.5">
                Notes / Weather / Activity
              </label>
              <input
                type="text"
                value={attendanceNotes}
                onChange={(e) => setAttendanceNotes(e.target.value)}
                placeholder="e.g. Ground slab pour prep, dry weather"
                className="w-full text-[12px] rounded border border-slate-300 p-1 bg-white text-slate-900"
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingAttendance(false)}
                className="text-[11px] px-2 py-0.5 text-slate-600 hover:bg-slate-200 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddAttendance}
                className="text-[11px] px-2.5 py-1 bg-emerald-600 text-white rounded font-medium hover:bg-emerald-700 shadow-2xs"
              >
                Save Attendance Record
              </button>
            </div>
          </div>
        )}

        {/* Existing Attendance Logs */}
        {task.siteAttendance && task.siteAttendance.length > 0 ? (
          <div className="space-y-1.5">
            {task.siteAttendance.map((rec) => (
              <div
                key={rec.id}
                className="p-2 rounded-lg border border-slate-200 bg-slate-50/60 flex items-center justify-between text-[11.5px]"
              >
                <div>
                  <div className="flex items-center gap-2 font-medium text-slate-800">
                    <span>{rec.date}</span>
                    <span className="font-bold text-emerald-700">
                      {rec.headcount} Operatives on site
                    </span>
                  </div>
                  <div className="text-[10.5px] text-slate-500">
                    <span>Verified by: {rec.verifiedBy}</span>
                    {rec.notes && <span> · {rec.notes}</span>}
                  </div>
                </div>
                <UserCheck className="h-4 w-4 text-emerald-600 shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="p-2.5 text-center border border-dashed border-slate-200 rounded-lg text-slate-400 text-[11.5px]">
            No physical headcount verified for this activity yet.
          </div>
        )}
      </div>
    </div>
  );
}
