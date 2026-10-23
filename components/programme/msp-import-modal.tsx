"use client";

import React, { useState, useRef } from "react";
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
  } = useProgramme();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parseResult, setParseResult] = useState<ScheduleParseResult | null>(null);
  const [activeTab, setActiveTab] = useState<"summary" | "tasks" | "unsupported" | "warnings">("summary");
  const [useImportedCalendar, setUseImportedCalendar] = useState<boolean>(true);
  const [isDragOver, setIsDragOver] = useState(false);

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

    importSchedule(parseResult.tasks, targetCalendar, parseResult.projectName);
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

              {/* 1. MPP Binary Trap Notice */}
              {parseResult.format === "mpp" && parseResult.mppExplanation && (
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
                        Microsoft Project Binary (.mpp) File Detected
                      </h4>
                      <p className="text-[12.5px] text-amber-900 mt-1 leading-relaxed">
                        {parseResult.mppExplanation.reason} PlanD-X adheres to strict schedule integrity standards and does not attempt unsafe reverse-engineering of closed Microsoft binary blobs.
                      </p>
                    </div>
                  </div>

                  {/* Step-by-step conversion instructions */}
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

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11.5px] text-amber-800">
                      ✓ Microsoft Project XML preserves 100% of tasks, links, calendars, and baselines.
                    </span>
                    <button
                      id="mpp-try-sample-xml-btn"
                      onClick={handleLoadSampleXml}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-amber-700 transition-colors shadow-2xs"
                    >
                      <span>Try Sample XML Schedule Instead</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
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
                  <div className="flex items-center gap-2 border-b border-slate-200">
                    <button
                      id="tab-import-summary"
                      onClick={() => setActiveTab("summary")}
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors ${
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
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors ${
                        activeTab === "tasks"
                          ? "border-blue-600 text-blue-600"
                          : "border-transparent text-slate-500 hover:text-slate-800"
                      }`}
                    >
                      Task Hierarchy ({parseResult.tasks.length})
                    </button>
                    <button
                      id="tab-import-unsupported"
                      onClick={() => setActiveTab("unsupported")}
                      className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
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
                        className={`pb-2.5 px-3 text-[13px] font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
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
              <button
                id="msp-import-confirm-btn"
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-[13px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-2xs"
              >
                <span>Confirm &amp; Import Schedule</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
