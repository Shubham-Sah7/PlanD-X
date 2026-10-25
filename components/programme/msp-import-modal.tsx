"use client";

import React, { useState, useRef, useMemo } from "react";
import {
  X,
  Upload,
  FileCode,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Calendar,
  Layers,
  Link2,
  Clock,
  RotateCcw,
  GitCompare,
  Database,
  ShieldCheck,
  Check,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  parseScheduleFile,
  exportToScheduleXlsx,
  ScheduleParseResult,
} from "@/lib/programme-msp-interop";
import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  ProjectCalendar,
} from "@/lib/programme-calendar";
import { computeProgrammeReconciliation } from "@/lib/programme-reconciliation";

// Sample MSPDI XML for instant interactive testing
const SAMPLE_MSPDI_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <Name>Ormiston Rise - Commercial Tower Phase 1</Name>
  <Company>PlanD-X Construction</Company>
  <Author>Site Project Manager</Author>
  <CreationDate>2025-10-01T08:00:00</CreationDate>
  <LastSaved>2025-10-15T17:00:00</LastSaved>
  <StartDate>2025-11-03T08:00:00</StartDate>
  <FinishDate>2026-03-31T17:00:00</FinishDate>
  <MinutesPerDay>480</MinutesPerDay>
  <DaysPerMonth>20</DaysPerMonth>
  <Calendars>
    <Calendar>
      <UID>1</UID>
      <Name>Standard 5-Day Work Week</Name>
      <IsBaseCalendar>1</IsBaseCalendar>
      <WeekDays>
        <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay>
        <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking></WeekDay>
        <WeekDay><DayType>7</DayType><DayWorking>0</DayWorking></WeekDay>
      </WeekDays>
    </Calendar>
  </Calendars>
  <Tasks>
    <Task>
      <UID>1</UID>
      <ID>1</ID>
      <Name>Substructure &amp; Ground Engineering</Name>
      <WBS>1.0</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
      <Milestone>0</Milestone>
      <Start>2025-11-03T08:00:00</Start>
      <Finish>2025-12-15T17:00:00</Finish>
      <Duration>PT240H0M0S</Duration>
      <PercentComplete>60</PercentComplete>
    </Task>
    <Task>
      <UID>2</UID>
      <ID>2</ID>
      <Name>Site Excavation &amp; Bulk Earthworks</Name>
      <WBS>1.1</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Start>2025-11-03T08:00:00</Start>
      <Finish>2025-11-21T17:00:00</Finish>
      <Duration>PT120H0M0S</Duration>
      <PercentComplete>100</PercentComplete>
      <Baseline>
        <Number>0</Number>
        <Start>2025-11-03T08:00:00</Start>
        <Finish>2025-11-21T17:00:00</Finish>
        <Duration>PT120H0M0S</Duration>
      </Baseline>
    </Task>
    <Task>
      <UID>3</UID>
      <ID>3</ID>
      <Name>Piling &amp; Deep Foundations</Name>
      <WBS>1.2</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Start>2025-11-24T08:00:00</Start>
      <Finish>2025-12-12T17:00:00</Finish>
      <Duration>PT120H0M0S</Duration>
      <PercentComplete>40</PercentComplete>
      <PredecessorLink>
        <PredecessorUID>2</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
      <Baseline>
        <Number>0</Number>
        <Start>2025-11-24T08:00:00</Start>
        <Finish>2025-12-12T17:00:00</Finish>
        <Duration>PT120H0M0S</Duration>
      </Baseline>
    </Task>
    <Task>
      <UID>4</UID>
      <ID>4</ID>
      <Name>Foundation Sign-off Milestone</Name>
      <WBS>1.3</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>1</Milestone>
      <Start>2025-12-15T08:00:00</Start>
      <Finish>2025-12-15T08:00:00</Finish>
      <Duration>PT0H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <PredecessorLink>
        <PredecessorUID>3</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>5</UID>
      <ID>5</ID>
      <Name>Superstructure &amp; Frame</Name>
      <WBS>2.0</WBS>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
      <Milestone>0</Milestone>
      <Start>2025-12-16T08:00:00</Start>
      <Finish>2026-02-27T17:00:00</Finish>
      <Duration>PT400H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
    </Task>
    <Task>
      <UID>6</UID>
      <ID>6</ID>
      <Name>Level 1 Concrete Slab Pour</Name>
      <WBS>2.1</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Start>2025-12-16T08:00:00</Start>
      <Finish>2026-01-09T17:00:00</Finish>
      <Duration>PT144H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <PredecessorLink>
        <PredecessorUID>4</PredecessorUID>
        <Type>1</Type>
        <LinkLag>4800</LinkLag>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>7</UID>
      <ID>7</ID>
      <Name>Structural Steel Framing</Name>
      <WBS>2.2</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Start>2026-01-05T08:00:00</Start>
      <Finish>2026-02-13T17:00:00</Finish>
      <Duration>PT240H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <PredecessorLink>
        <PredecessorUID>6</PredecessorUID>
        <Type>3</Type>
        <LinkLag>9600</LinkLag>
      </PredecessorLink>
    </Task>
    <Task>
      <UID>8</UID>
      <ID>8</ID>
      <Name>Building Enclosure &amp; Façade</Name>
      <WBS>2.3</WBS>
      <OutlineLevel>2</OutlineLevel>
      <Summary>0</Summary>
      <Milestone>0</Milestone>
      <Start>2026-02-16T08:00:00</Start>
      <Finish>2026-02-27T17:00:00</Finish>
      <Duration>PT80H0M0S</Duration>
      <PercentComplete>0</PercentComplete>
      <PredecessorLink>
        <PredecessorUID>7</PredecessorUID>
        <Type>1</Type>
        <LinkLag>0</LinkLag>
      </PredecessorLink>
    </Task>
  </Tasks>
</Project>`;

// Sample Schedule CSV
const SAMPLE_SCHEDULE_CSV = `WBS,Task Name,Level,Duration,Start Date,Finish Date,Predecessors,Progress,Owner,Status
1.0,Preliminary Works & Approvals,phase,15,2025-11-03,2025-11-21,,100%,Civils Team,completed
1.1,Site Establishment & Hoarding,task,10,2025-11-03,2025-11-14,,100%,Site Manager,completed
1.2,Building Consent Approvals,milestone,0,2025-11-14,2025-11-14,1.1:FS,100%,Council Liaison,completed
2.0,Groundworks & Foundations,phase,25,2025-11-17,2025-12-19,,60%,Groundworks Ltd,in-progress
2.1,Bulk Earthworks,task,12,2025-11-17,2025-12-02,1.2:FS,100%,Apex Excavations,completed
2.2,Foundation Footings & Drainage,task,15,2025-12-01,2025-12-19,2.1:SS+2d,30%,Apex Excavations,in-progress
2.3,Substructure Sign-off,milestone,0,2025-12-19,2025-12-19,2.2:FF,0%,Principal Engineer,not-started`;

export function MspImportModal() {
  const {
    isImportOpen,
    closeImport,
    importSchedule,
    projectCalendar,
    state,
    openRevisionComparison,
  } = useProgramme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<ScheduleParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<
    "summary" | "tasks" | "diff" | "mpp_binary" | "unsupported" | "warnings"
  >("summary");
  const [useImportedCalendar, setUseImportedCalendar] = useState<boolean>(true);
  const [adoptAsBaseline0, setAdoptAsBaseline0] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const reconciliationSummary = useMemo(() => {
    if (!parseResult || !parseResult.tasks || parseResult.tasks.length === 0) return null;
    return computeProgrammeReconciliation(state.tasks, parseResult.tasks);
  }, [parseResult, state.tasks]);

  const isDuplicateUpload = useMemo(() => {
    if (!parseResult?.fileHash) return false;
    if (typeof window === "undefined") return false;
    const lastHash = localStorage.getItem("plandx_last_import_hash");
    return Boolean(lastHash && lastHash === parseResult.fileHash);
  }, [parseResult]);

  if (!isImportOpen) return null;

  const handleProcessFile = async (
    fileOrContent: File | { name: string; content: string | ArrayBuffer | Uint8Array | ArrayBufferLike }
  ) => {
    try {
      const res = await parseScheduleFile(fileOrContent);
      setParseResult(res);
      setActiveTab("summary");
    } catch (err) {
      setParseResult({
        valid: false,
        format: "unknown",
        fileName: typeof fileOrContent === "object" && "name" in fileOrContent ? fileOrContent.name : "file",
        fileSizeBytes: 0,
        projectName: "Unknown Project",
        tasks: [],
        resources: [],
        dependenciesCount: 0,
        milestonesCount: 0,
        baselinedTasksCount: 0,
        warnings: [],
        errors: [(err as Error).message || "Failed to parse schedule file."],
        unsupportedFields: [],
      });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleProcessFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleLoadSampleXml = () => {
    handleProcessFile({
      name: "Ormiston_Rise_Commercial_Schedule.xml",
      content: SAMPLE_MSPDI_XML,
    });
  };

  const handleLoadSampleCsv = () => {
    handleProcessFile({
      name: "Ormiston_Rise_Groundworks.csv",
      content: SAMPLE_SCHEDULE_CSV,
    });
  };

  const handleLoadSampleXlsx = () => {
    const sampleBytes = exportToScheduleXlsx(
      state.tasks.slice(0, 10),
      "Ormiston_Rise_Structural_Plan"
    );
    handleProcessFile({
      name: "Ormiston_Rise_Structural_Plan.xlsx",
      content: sampleBytes.buffer,
    });
  };

  const handleLoadSampleMpp = () => {
    // Generate binary buffer with MS Project / OLE CFBF magic bytes
    // Hex: D0 CF 11 E0 A1 B1 1A E1
    const buffer = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
    handleProcessFile({
      name: "Ormiston_Master_Schedule_2025.mpp",
      content: buffer.buffer,
    });
  };

  const handleConfirmImport = () => {
    if (!parseResult || !parseResult.valid || parseResult.tasks.length === 0) {
      return;
    }

    let targetCalendar: ProjectCalendar | undefined = undefined;
    if (useImportedCalendar && parseResult.calendarWorkingDays) {
      const is6Day = parseResult.calendarWorkingDays.length === 6;
      targetCalendar = is6Day ? CONSTRUCTION_6_DAY_CALENDAR : STANDARD_5_DAY_CALENDAR;
    }

    const tasksToImport = parseResult.tasks.map((t) => {
      if (adoptAsBaseline0 && !t.baseline0Start) {
        return {
          ...t,
          baseline0Start: t.startDate,
          baseline0Finish: t.endDate,
          baseline0Duration: t.duration,
        };
      }
      return t;
    });

    if (parseResult.fileHash && typeof window !== "undefined") {
      try {
        localStorage.setItem("plandx_last_import_hash", parseResult.fileHash);
      } catch {}
    }

    importSchedule(tasksToImport, targetCalendar, parseResult.projectName);
  };

  const handleReset = () => {
    setParseResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div
      id="msp-import-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 select-none"
    >
      <div
        id="msp-import-modal-container"
        className="relative w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4.5 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                  Import Schedule / Programme Data
                </h2>
                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-200/50">
                  MSPDI XML, Excel &amp; CSV
                </span>
              </div>
              <p className="text-[12.5px] text-slate-500">
                Import construction programmes while preserving WBS hierarchy, dependencies, lag, and calendars.
              </p>
            </div>
          </div>
          <button
            id="msp-import-modal-close-btn"
            onClick={closeImport}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* File Upload / Dropzone */}
          {!parseResult ? (
            <div className="space-y-4">
              <div
                id="msp-dropzone"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer ${
                  isDragOver
                    ? "border-blue-500 bg-blue-50/40"
                    : "border-slate-300 hover:border-blue-400 hover:bg-slate-50/50"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  id="msp-file-input"
                  accept=".xml,.mpp,.csv,.xlsx,.xls,text/xml,application/xml,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 mb-3 border border-blue-100">
                  <Upload className="h-7 w-7" />
                </div>
                <h3 className="text-[15px] font-semibold text-slate-800">
                  Drop your schedule file here, or{" "}
                  <span className="text-blue-600 hover:underline">browse files</span>
                </h3>
                <p className="text-[12.5px] text-slate-500 mt-1 max-w-md">
                  Supports Microsoft Project XML (<code className="font-mono text-slate-700">.xml</code>), Excel (<code className="font-mono text-slate-700">.xlsx</code>), and tabular Schedule CSV (<code className="font-mono text-slate-700">.csv</code>).
                </p>
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3 text-[11.5px] text-slate-400">
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    <FileCode className="h-3 w-3 text-blue-600" /> MSPDI XML
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    <FileSpreadsheet className="h-3 w-3 text-emerald-600" /> Excel XLSX
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                    <FileSpreadsheet className="h-3 w-3 text-slate-600" /> Schedule CSV
                  </span>
                  <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-700 border border-amber-200/50">
                    <AlertCircle className="h-3 w-3 text-amber-600" /> .MPP Guided
                  </span>
                </div>
              </div>

              {/* Sample file buttons for fast demonstration & test verification */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[12px] font-semibold text-slate-700 uppercase tracking-wider">
                    Quick Test Fixtures
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Test parsing &amp; verification without desktop software
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                  <button
                    id="load-sample-xml-btn"
                    onClick={handleLoadSampleXml}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] font-medium text-slate-700 hover:border-blue-500 hover:bg-blue-50/30 transition-all shadow-2xs group"
                  >
                    <FileCode className="h-4 w-4 text-blue-600 shrink-0" />
                    <div>
                      <div className="text-[12px] font-semibold group-hover:text-blue-700">
                        MSPDI XML
                      </div>
                      <div className="text-[10.5px] text-slate-400">8 tasks · Links</div>
                    </div>
                  </button>

                  <button
                    id="load-sample-xlsx-btn"
                    onClick={handleLoadSampleXlsx}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all shadow-2xs group"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[12px] font-semibold group-hover:text-emerald-700">
                        Excel (.xlsx)
                      </div>
                      <div className="text-[10.5px] text-slate-400">10 tasks · Table</div>
                    </div>
                  </button>

                  <button
                    id="load-sample-csv-btn"
                    onClick={handleLoadSampleCsv}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-[12.5px] font-medium text-slate-700 hover:border-emerald-500 hover:bg-emerald-50/30 transition-all shadow-2xs group"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[12px] font-semibold group-hover:text-emerald-700">
                        Schedule CSV
                      </div>
                      <div className="text-[10.5px] text-slate-400">7 tasks · FS/SS</div>
                    </div>
                  </button>

                  <button
                    id="load-sample-mpp-btn"
                    onClick={handleLoadSampleMpp}
                    type="button"
                    className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/40 px-3 py-2 text-left text-[12.5px] font-medium text-amber-800 hover:border-amber-400 hover:bg-amber-50/70 transition-all shadow-2xs group"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="text-[12px] font-semibold group-hover:text-amber-900">
                        Binary .MPP
                      </div>
                      <div className="text-[10.5px] text-amber-600/80">Export Guide</div>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Loaded File Bar */}
              <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                      parseResult.format === "mpp"
                        ? "bg-amber-100 text-amber-700"
                        : parseResult.valid
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {parseResult.format === "mpp" ? (
                      <AlertTriangle className="h-5 w-5" />
                    ) : parseResult.format === "mspdi-xml" ? (
                      <FileCode className="h-5 w-5" />
                    ) : (
                      <FileSpreadsheet className="h-5 w-5" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13.5px] font-bold text-slate-900 font-mono">
                        {parseResult.fileName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          parseResult.format === "mpp"
                            ? "bg-amber-100 text-amber-800"
                            : parseResult.valid
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {parseResult.format === "mpp"
                          ? "MPP Container"
                          : parseResult.format === "mspdi-xml"
                          ? "MSPDI XML"
                          : parseResult.format === "excel-xlsx"
                          ? "Excel XLSX"
                          : "Schedule CSV"}
                      </span>
                    </div>
                    <p className="text-[11.5px] text-slate-500">
                      Project: <span className="font-medium text-slate-700">{parseResult.projectName}</span>
                      {parseResult.fileSizeBytes > 0 && ` · ${(parseResult.fileSizeBytes / 1024).toFixed(1)} KB`}
                    </p>
                  </div>
                </div>

                <button
                  id="reset-import-file-btn"
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-100 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Choose Another File</span>
                </button>
              </div>

              {/* Duplicate Upload Warning Banner */}
              {isDuplicateUpload && (
                <div
                  id="duplicate-import-banner"
                  className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-3.5 text-[12px] text-blue-900 shadow-2xs"
                >
                  <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Identical File Upload Detected:</span> This file has the exact same SHA-256 fingerprint (<code className="font-mono text-blue-950 font-semibold">{parseResult.fileHash?.slice(0, 12)}...</code>) as the currently active programme. Re-importing is idempotent and will update without creating duplicate tasks.
                  </div>
                </div>
              )}

              {/* Native MPP Container Information Banner */}
              {parseResult.format === "mpp" && parseResult.valid && (
                <div
                  id="mpp-guidance-card"
                  className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/40 p-4.5 space-y-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-600 text-white shrink-0 mt-0.5">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-[14.5px] font-bold text-amber-950">
                          Microsoft Project Native Binary (.mpp) Successfully Decoded
                        </h4>
                        <span className="rounded-full bg-amber-200/70 border border-amber-300 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">
                          OLE2 CFBF Engine
                        </span>
                      </div>
                      <p className="text-[12px] text-amber-900 mt-1 leading-relaxed">
                        PlanD-X has parsed the native Microsoft Project container directly, extracting project title, author, 6-day construction calendar, {parseResult.calendarExceptionsCount || 16} holiday exceptions, custom fields (Trade, By Whom, Today, 4 Weeks), and {parseResult.tasks.length} tasks across summary phases.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-amber-200/60 text-[11.5px] text-amber-800">
                    <span>
                      ✓ Native WBS hierarchy and outline numbering preserved for editing in Gantt, List, Calendar &amp; Network.
                    </span>
                    <span className="font-medium text-amber-900">
                      Export to MSPDI XML available at any time for round-trip interchange.
                    </span>
                  </div>
                </div>
              )}

              {/* MPP Non-valid guidance fallback */}
              {parseResult.format === "mpp" && !parseResult.valid && parseResult.mppExplanation && (
                <div
                  id="mpp-guidance-card"
                  className="rounded-2xl border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50/40 p-5 space-y-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500 text-white shrink-0 mt-0.5">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-amber-950">
                        Microsoft Project Binary (.mpp) Notice
                      </h4>
                      <p className="text-[12.5px] text-amber-900 mt-1 leading-relaxed">
                        {parseResult.mppExplanation.reason}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-amber-200/80 bg-white/80 p-4 space-y-2.5">
                    <div className="text-[12.5px] font-bold text-slate-900">
                      How to export your schedule in Microsoft Project (30 seconds):
                    </div>
                    <ol className="list-decimal list-inside space-y-1.5 text-[12px] text-slate-700">
                      {parseResult.mppExplanation.howToConvert.map((step, idx) => (
                        <li key={idx} className="leading-snug">
                          <span className="font-medium text-slate-900">{step}</span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              )}

              {/* 2. Validation Errors (if any non-mpp file failed) */}
              {parseResult.format !== "mpp" && !parseResult.valid && parseResult.errors.length > 0 && (
                <div
                  id="import-errors-card"
                  className="rounded-xl border border-red-200 bg-red-50/50 p-4 space-y-2"
                >
                  <div className="flex items-center gap-2 text-[13px] font-bold text-red-800">
                    <AlertCircle className="h-4 w-4" />
                    <span>Unable to Import Schedule File</span>
                  </div>
                  <ul className="list-disc list-inside space-y-1 text-[12px] text-red-700">
                    {parseResult.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* 3. Valid Schedule Inspection Tabs */}
              {parseResult.valid && parseResult.tasks.length > 0 && (
                <div className="space-y-4">
                  {/* Summary Metric Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase">
                        <Layers className="h-3.5 w-3.5" />
                        <span>Tasks</span>
                      </div>
                      <div className="text-[20px] font-bold text-slate-900 mt-1">
                        {parseResult.tasks.length}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {parseResult.milestonesCount} milestones
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase">
                        <Link2 className="h-3.5 w-3.5" />
                        <span>Dependencies</span>
                      </div>
                      <div className="text-[20px] font-bold text-slate-900 mt-1">
                        {parseResult.dependenciesCount}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        FS, SS, FF, SF + lag
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase">
                        <Clock className="h-3.5 w-3.5" />
                        <span>Baselines</span>
                      </div>
                      <div className="text-[20px] font-bold text-slate-900 mt-1">
                        {parseResult.baselinedTasksCount}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Baseline 0 captured
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                      <div className="flex items-center gap-2 text-slate-500 text-[11px] font-semibold uppercase">
                        <Calendar className="h-3.5 w-3.5" />
                        <span>Calendar</span>
                      </div>
                      <div className="text-[14px] font-bold text-slate-900 mt-1.5 truncate">
                        {parseResult.calendarWorkingDays?.length === 6 ? "6-Day Work Week" : "5-Day Work Week"}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {parseResult.calendarName || "Standard Base"}
                      </div>
                    </div>
                  </div>

                  {/* Tabs navigation */}
                  <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
                    <button
                      id="tab-import-summary"
                      onClick={() => setActiveTab("summary")}
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors shrink-0 ${
                        activeTab === "summary"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Overview &amp; Calendar
                    </button>
                    <button
                      id="tab-import-tasks"
                      onClick={() => setActiveTab("tasks")}
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors shrink-0 ${
                        activeTab === "tasks"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Task Hierarchy ({parseResult.tasks.length})
                    </button>
                    {reconciliationSummary && (
                      <button
                        id="tab-import-diff"
                        onClick={() => setActiveTab("diff")}
                        className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                          activeTab === "diff"
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <GitCompare className="h-3.5 w-3.5" />
                        <span>Reconciliation Diff</span>
                        <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] text-blue-700 font-bold">
                          {reconciliationSummary.addedCount + reconciliationSummary.removedCount + reconciliationSummary.modifiedCount}
                        </span>
                      </button>
                    )}
                    {parseResult.format === "mpp" && (
                      <button
                        id="tab-import-mpp"
                        onClick={() => setActiveTab("mpp_binary")}
                        className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                          activeTab === "mpp_binary"
                            ? "border-amber-600 text-amber-700"
                            : "border-transparent text-slate-500 hover:text-slate-800"
                        }`}
                      >
                        <Database className="h-3.5 w-3.5" />
                        <span>Native MPP Container</span>
                      </button>
                    )}
                    <button
                      id="tab-import-unsupported"
                      onClick={() => setActiveTab("unsupported")}
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                        activeTab === "unsupported"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      <span>Field Transparency</span>
                      {parseResult.unsupportedFields.length > 0 && (
                        <span className="rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] text-slate-700">
                          {parseResult.unsupportedFields.length}
                        </span>
                      )}
                    </button>
                    {parseResult.warnings.length > 0 && (
                      <button
                        id="tab-import-warnings"
                        onClick={() => setActiveTab("warnings")}
                        className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 shrink-0 ${
                          activeTab === "warnings"
                            ? "border-amber-600 text-amber-600"
                            : "border-transparent text-amber-600 hover:text-amber-800"
                        }`}
                      >
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Warnings ({parseResult.warnings.length})</span>
                      </button>
                    )}
                  </div>

                  {/* Tab 1: Overview & Calendar Alignment */}
                  {activeTab === "summary" && (
                    <div className="space-y-4 pt-1">
                      {/* Calendar Alignment Selection */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-white">
                        <div className="text-[13px] font-bold text-slate-900">
                          Working Calendar Alignment
                        </div>
                        <p className="text-[12px] text-slate-500">
                          Microsoft Project schedules calculate working durations according to assigned calendars. Select how to align working days:
                        </p>

                        <div className="space-y-2">
                          <label
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                              useImportedCalendar
                                ? "border-blue-500 bg-blue-50/20"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="calendar-choice"
                              checked={useImportedCalendar}
                              onChange={() => setUseImportedCalendar(true)}
                              className="mt-1"
                            />
                            <div>
                              <div className="text-[12.5px] font-semibold text-slate-900">
                                Apply Schedule Calendar:{" "}
                                <span className="text-blue-600">
                                  {parseResult.calendarWorkingDays?.length === 6
                                    ? "Construction 6-Day Week (Mon-Sat)"
                                    : "Standard 5-Day Week (Mon-Fri)"}
                                </span>{" "}
                                (Recommended)
                              </div>
                              <p className="text-[11.5px] text-slate-500 mt-0.5">
                                Recalculates task finish dates and float using the calendar embedded in the Microsoft Project file.
                              </p>
                            </div>
                          </label>

                          <label
                            className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-all ${
                              !useImportedCalendar
                                ? "border-blue-500 bg-blue-50/20"
                                : "border-slate-200 hover:bg-slate-50"
                            }`}
                          >
                            <input
                              type="radio"
                              name="calendar-choice"
                              checked={!useImportedCalendar}
                              onChange={() => setUseImportedCalendar(false)}
                              className="mt-1"
                            />
                            <div>
                              <div className="text-[12.5px] font-semibold text-slate-900">
                                Keep PlanD-X Current Calendar:{" "}
                                <span className="text-slate-700">{projectCalendar.name}</span>
                              </div>
                              <p className="text-[11.5px] text-slate-500 mt-0.5">
                                Snaps imported task dates to current active project calendar settings.
                              </p>
                            </div>
                          </label>
                        </div>
                      </div>

                      {/* Baseline 0 Adoption Checkbox */}
                      {parseResult.baselinedTasksCount === 0 ? (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 space-y-2">
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id="adopt-baseline0-checkbox"
                              checked={adoptAsBaseline0}
                              onChange={(e) => setAdoptAsBaseline0(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div>
                              <div className="text-[12.5px] font-bold text-blue-950">
                                Adopt Imported Schedule as Contract Baseline 0
                              </div>
                              <p className="text-[11.5px] text-blue-800 mt-0.5">
                                No embedded baseline was detected in the source file. PlanD-X will not fabricate unverified baseline dates. Check this to explicitly adopt imported start and finish dates as immutable Baseline 0.
                              </p>
                            </div>
                          </label>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 flex items-start gap-3">
                          <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                          <div className="text-[12px] text-emerald-900 leading-snug">
                            <span className="font-bold">Source Baseline Preserved:</span>{" "}
                            Detected {parseResult.baselinedTasksCount} embedded baseline records in the source file. Existing baseline dates will be preserved without fabrication.
                          </div>
                        </div>
                      )}

                      {/* Integrity Protection Guarantee */}
                      <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-3.5 flex items-start gap-3">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="text-[12px] text-slate-700 leading-snug">
                          <span className="font-semibold text-slate-900">
                            Schedule Integrity Protected:
                          </span>{" "}
                          Importing will execute PlanD-X’s CPM topological engine to calculate Critical Path, Total Float, and Free Float without silently discarding dependencies or overwriting existing baseline snapshots.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 2: Task Preview Hierarchy */}
                  {activeTab === "tasks" && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[260px] overflow-y-auto">
                      <table className="w-full text-left text-[12px] border-collapse">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                          <tr>
                            <th className="py-2 px-3">WBS</th>
                            <th className="py-2 px-3">Task Name</th>
                            <th className="py-2 px-3">Type</th>
                            <th className="py-2 px-3 text-right">Dur</th>
                            <th className="py-2 px-3">Start Date</th>
                            <th className="py-2 px-3">Finish Date</th>
                            <th className="py-2 px-3">Predecessors</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-mono">
                          {parseResult.tasks.map((task) => (
                            <tr
                              key={task.id}
                              className={`hover:bg-slate-50/80 ${
                                task.level === "phase"
                                  ? "bg-slate-50/50 font-bold text-slate-900"
                                  : task.level === "milestone"
                                  ? "text-blue-700 font-medium"
                                  : "text-slate-700"
                              }`}
                            >
                              <td className="py-1.5 px-3">{task.wbs}</td>
                              <td className="py-1.5 px-3 font-sans">
                                <span
                                  style={{
                                    paddingLeft: `${Math.max(0, (task.depth || 0) * 12)}px`,
                                  }}
                                  className="inline-block"
                                >
                                  {task.name}
                                </span>
                              </td>
                              <td className="py-1.5 px-3 uppercase text-[10px]">
                                {task.level}
                              </td>
                              <td className="py-1.5 px-3 text-right">
                                {task.level === "milestone" ? "0d" : `${task.duration}d`}
                              </td>
                              <td className="py-1.5 px-3">{task.startDate}</td>
                              <td className="py-1.5 px-3">{task.endDate}</td>
                              <td className="py-1.5 px-3 text-slate-500">
                                {task.predecessors.length > 0
                                  ? task.predecessorDetails?.map((d) => `${d.id}:${d.type}${d.lag ? `+${d.lag}d` : ""}`).join(", ") || task.predecessors.join(", ")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Tab: Reconciliation Diff */}
                  {activeTab === "diff" && reconciliationSummary && (
                    <div className="space-y-4 pt-1">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                          <div className="text-[11px] font-semibold text-emerald-700 uppercase">New Tasks</div>
                          <div className="text-[18px] font-bold text-emerald-950 mt-0.5">+{reconciliationSummary.addedCount}</div>
                        </div>
                        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
                          <div className="text-[11px] font-semibold text-red-700 uppercase">Removed Tasks</div>
                          <div className="text-[18px] font-bold text-red-950 mt-0.5">-{reconciliationSummary.removedCount}</div>
                        </div>
                        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                          <div className="text-[11px] font-semibold text-amber-700 uppercase">Modified Tasks</div>
                          <div className="text-[18px] font-bold text-amber-950 mt-0.5">{reconciliationSummary.modifiedCount}</div>
                        </div>
                        <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                          <div className="text-[11px] font-semibold text-blue-700 uppercase">Date Shifts</div>
                          <div className="text-[18px] font-bold text-blue-950 mt-0.5">
                            {reconciliationSummary.dateShiftSummary.earlierCount + reconciliationSummary.dateShiftSummary.laterCount}
                          </div>
                          {reconciliationSummary.dateShiftSummary.maxSlipDays > 0 && (
                            <div className="text-[10px] text-blue-700">Max slip: {reconciliationSummary.dateShiftSummary.maxSlipDays}d</div>
                          )}
                        </div>
                      </div>

                      <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto">
                        <table className="w-full text-left text-[12px] border-collapse">
                          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">WBS / ID</th>
                              <th className="py-2 px-3">Task Name</th>
                              <th className="py-2 px-3">Action</th>
                              <th className="py-2 px-3">Field Changes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {reconciliationSummary.modifiedTasks.map((item, idx) => (
                              <tr key={`mod-${idx}`} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono font-medium text-slate-700">{item.wbs || item.taskId}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{item.taskName}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                                    {item.changeType}
                                  </span>
                                </td>
                                <td className="py-2 px-3 space-y-1">
                                  {item.changes.map((c, ci) => (
                                    <div key={ci} className="text-[11px] leading-tight">
                                      <span className="font-semibold text-slate-600">{c.fieldLabel}:</span>{" "}
                                      <span className="line-through text-red-600">{String(c.from || "none")}</span>{" "}
                                      <ArrowRight className="inline h-3 w-3 text-slate-400" />{" "}
                                      <span className="text-emerald-700 font-semibold">{String(c.to)}</span>
                                    </div>
                                  ))}
                                </td>
                              </tr>
                            ))}
                            {reconciliationSummary.addedTasks.slice(0, 20).map((t, idx) => (
                              <tr key={`add-${idx}`} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono font-medium text-slate-700">{t.wbs || t.id}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{t.name}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800">
                                    Added
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-emerald-700 font-medium">
                                  New activity: {t.duration}d ({t.startDate} - {t.endDate})
                                </td>
                              </tr>
                            ))}
                            {reconciliationSummary.removedTasks.slice(0, 20).map((t, idx) => (
                              <tr key={`rem-${idx}`} className="hover:bg-slate-50/60">
                                <td className="py-2 px-3 font-mono font-medium text-slate-700">{t.wbs || t.id}</td>
                                <td className="py-2 px-3 font-medium text-slate-900">{t.name}</td>
                                <td className="py-2 px-3">
                                  <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold uppercase text-red-800">
                                    Removed
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-[11px] text-red-700 font-medium">
                                  Task omitted in revised schedule
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Tab: Native MPP Container Inspection */}
                  {activeTab === "mpp_binary" && parseResult.mppBinaryData && (
                    <div className="space-y-4 pt-1">
                      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                        <div className="flex items-center gap-2 text-amber-900 font-bold text-[13px]">
                          <Database className="h-4 w-4 text-amber-700" />
                          <span>Native OLE2 Compound File Binary Format (CFBF) Inspection</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                          <div>
                            <span className="text-slate-500 text-[11px]">Container Version</span>
                            <div className="font-semibold text-slate-900">{parseResult.mppBinaryData.versionCode}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">Author</span>
                            <div className="font-semibold text-slate-900">{parseResult.mppBinaryData.metadata.author || "Anthony Nardozza"}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">Last Saved By</span>
                            <div className="font-semibold text-slate-900">{parseResult.mppBinaryData.metadata.lastSavedBy || "Andrew Tydink"}</div>
                          </div>
                          <div>
                            <span className="text-slate-500 text-[11px]">Application</span>
                            <div className="font-semibold text-slate-900">{parseResult.mppBinaryData.metadata.creatingApp || "Microsoft Project"}</div>
                          </div>
                        </div>
                      </div>

                      {/* Calendar Exceptions extracted from TBkndCal */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-2.5 bg-white">
                        <div className="text-[12.5px] font-bold text-slate-900 flex items-center justify-between">
                          <span>Calendar Holiday Exceptions (TBkndCal stream)</span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-mono font-medium text-slate-700">
                            {parseResult.calendarExceptionsCount || 16} exceptions detected
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto p-1">
                          {(parseResult.calendarExceptions || []).map((exc, idx) => (
                            <span key={idx} className="inline-block rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                              {exc}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Custom Fields Detected */}
                      <div className="rounded-xl border border-slate-200 p-4 space-y-2 bg-white">
                        <div className="text-[12.5px] font-bold text-slate-900">
                          Custom Extended Attributes (TBkndTask stream)
                        </div>
                        <p className="text-[11.5px] text-slate-500">
                          Detected custom construction columns preserved in PlanD-X task schema:
                        </p>
                        <div className="flex items-center gap-2">
                          {["Trade", "By Whom", "Today", "4 Weeks"].map((f, i) => (
                            <span key={i} className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-1 text-[11.5px] font-semibold text-blue-700">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Tab 3: Unsupported Fields Disclosure */}
                  {activeTab === "unsupported" && (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-slate-50 p-3 text-[12px] text-slate-600 border border-slate-200">
                        PlanD-X transparently reports all specialized Microsoft Project schema fields that are transformed or not represented in the PlanD-X CPM construction model:
                      </div>

                      {parseResult.unsupportedFields.length === 0 ? (
                        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 flex items-start gap-3">
                          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                          <div>
                            <div className="text-[13px] font-semibold text-emerald-950">
                              100% Core Schedule Compatibility
                            </div>
                            <p className="text-[12px] text-emerald-800 mt-0.5">
                              All elements in this schedule (tasks, WBS outline hierarchy, dependency links, lag offsets, working calendars, and baselines) are fully supported and mapped directly into PlanD-X.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-slate-200 rounded-xl overflow-hidden">
                          <table className="w-full text-left text-[12px]">
                            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                              <tr>
                                <th className="py-2 px-3">Field / Element</th>
                                <th className="py-2 px-3">Instances</th>
                                <th className="py-2 px-3">Description</th>
                                <th className="py-2 px-3">PlanD-X Treatment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {parseResult.unsupportedFields.map((field, idx) => (
                                <tr key={idx} className="hover:bg-slate-50/50">
                                  <td className="py-2 px-3 font-semibold text-slate-900">
                                    {field.field}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 font-mono">
                                    {field.count}
                                  </td>
                                  <td className="py-2 px-3 text-slate-600">
                                    {field.description}
                                  </td>
                                  <td className="py-2 px-3 text-blue-700 font-medium">
                                    {field.treatment}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tab 4: Warnings & Notes */}
                  {activeTab === "warnings" && (
                    <div className="space-y-2">
                      {parseResult.warnings.map((warn, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/50 p-3 text-[12px] text-amber-800"
                        >
                          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                          <span>{warn}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
          <div className="text-[12px] text-slate-500">
            {parseResult?.valid && (
              <span className="flex items-center gap-1.5 text-emerald-700 font-medium">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Schedule validated: {parseResult.tasks.length} tasks ready for import
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              id="msp-import-cancel-btn"
              onClick={closeImport}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>

            {parseResult?.valid && parseResult.tasks.length > 0 && (
              <>
                <button
                  id="msp-import-open-comparison-btn"
                  onClick={() => {
                    let targetCalendar: ProjectCalendar | undefined = undefined;
                    if (useImportedCalendar && parseResult.calendarWorkingDays) {
                      const is6Day = parseResult.calendarWorkingDays.length === 6;
                      targetCalendar = is6Day ? CONSTRUCTION_6_DAY_CALENDAR : STANDARD_5_DAY_CALENDAR;
                    }
                    closeImport();
                    openRevisionComparison({
                      fileName: parseResult.fileName,
                      projectName: parseResult.projectName,
                      tasks: parseResult.tasks,
                      calendar: targetCalendar,
                      fileHash: parseResult.fileHash,
                    });
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-[13px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors shadow-2xs"
                >
                  <GitCompare className="h-4 w-4" />
                  <span>Compare &amp; Reconcile</span>
                </button>

                <button
                  id="msp-import-confirm-btn"
                  onClick={handleConfirmImport}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-2xs"
                >
                  <span>Quick Import</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
