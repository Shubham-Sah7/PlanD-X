"use client";

import React, { useMemo, useState } from "react";
import {
  X,
  FileSpreadsheet,
  Printer,
  FileText,
  FileCode,
  CheckCircle2,
  Calendar,
  Layers,
  ArrowRight,
  ExternalLink,
  Presentation,
  Download,
  FileDown,
  Loader2,
} from "lucide-react";
import { useProgramme } from "@/lib/programme-context";
import {
  generateProgrammeReportData,
  exportProgrammeToCsv,
  exportProgrammeToXlsx,
  exportProgrammeToPdf,
  exportProgrammeToPptx,
  downloadReportFile,
  downloadBinaryFile,
} from "@/lib/programme-reporting";
import { exportToMspdiXml } from "@/lib/programme-msp-interop";

export function ExportModal() {
  const {
    isExportOpen,
    closeExport,
    state,
    projectCalendar,
    setActiveView,
  } = useProgramme();

  const [isExporting, setIsExporting] = useState<string | null>(null);

  const report = useMemo(() => {
    return generateProgrammeReportData(state.tasks, projectCalendar, {
      projectName: "Ormiston Rise — Building 2 & Unit 80",
      projectLocation: "Siliguri, WB",
      reportingDate: "2025-10-15",
    });
  }, [state.tasks, projectCalendar]);

  if (!isExportOpen) return null;

  const handleDownloadMspXml = () => {
    const xml = exportToMspdiXml(
      state.tasks,
      projectCalendar,
      "Ormiston Rise — Building 2 & Unit 80"
    );
    const dateStr = report.reportingDate.replace(/-/g, "");
    downloadReportFile(
      xml,
      `PlanD-X_MSProject_${dateStr}.xml`,
      "application/xml;charset=utf-8;"
    );
    closeExport();
  };

  const handleDownloadXlsx = () => {
    setIsExporting("xlsx");
    try {
      const xlsxBytes = exportProgrammeToXlsx(report, state.tasks);
      const dateStr = report.reportingDate.replace(/-/g, "");
      downloadBinaryFile(
        xlsxBytes,
        `PlanD-X_Schedule_Report_${dateStr}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      closeExport();
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadPdf = async () => {
    setIsExporting("pdf");
    try {
      const pdfBytes = await exportProgrammeToPdf(report);
      const dateStr = report.reportingDate.replace(/-/g, "");
      downloadBinaryFile(
        pdfBytes,
        `PlanD-X_Performance_Report_${dateStr}.pdf`,
        "application/pdf"
      );
      closeExport();
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadPptx = async () => {
    setIsExporting("pptx");
    try {
      const pptxData = await exportProgrammeToPptx(report);
      const dateStr = report.reportingDate.replace(/-/g, "");
      downloadBinaryFile(
        pptxData as any,
        `PlanD-X_Executive_Presentation_${dateStr}.pptx`,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      );
      closeExport();
    } finally {
      setIsExporting(null);
    }
  };

  const handleDownloadCsv = () => {
    const csv = exportProgrammeToCsv(report);
    const dateStr = report.reportingDate.replace(/-/g, "");
    downloadReportFile(csv, `PlanD-X_Schedule_Report_${dateStr}.csv`);
    closeExport();
  };

  const handleDownloadJson = () => {
    const json = JSON.stringify(report, null, 2);
    const dateStr = report.reportingDate.replace(/-/g, "");
    downloadReportFile(
      json,
      `PlanD-X_Schedule_Report_${dateStr}.json`,
      "application/json;charset=utf-8;"
    );
    closeExport();
  };

  const handlePrintPdf = () => {
    closeExport();
    setActiveView("reports");
    setTimeout(() => {
      if (typeof window !== "undefined") {
        window.print();
      }
    }, 400);
  };

  const handleViewReport = () => {
    closeExport();
    setActiveView("reports");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl p-6 mx-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 border border-blue-200/60">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-[17px] font-bold text-slate-900 tracking-tight">
                Export Programme Data &amp; Reports
              </h2>
              <p className="text-[12.5px] text-slate-500">
                Generate verified project reports in standard industry formats.
              </p>
            </div>
          </div>
          <button
            onClick={closeExport}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content options */}
        <div className="py-3 space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
          {/* Option: Microsoft Project XML (MSPDI) */}
          <div
            id="export-modal-msp-xml-option"
            onClick={handleDownloadMspXml}
            className="flex items-start justify-between rounded-xl border border-blue-200 bg-blue-50/20 p-3 hover:border-blue-500 hover:bg-blue-50/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shrink-0 mt-0.5 shadow-xs">
                <FileCode className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                    Microsoft Project XML (*.xml)
                  </span>
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">
                    MSPDI Schema
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Standard MS Project interchange format. Preserves WBS hierarchy, dependencies (FS/SS/FF/SF + lag), working calendars, milestones, and Baseline 0.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-blue-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: Microsoft Excel Spreadsheet (.xlsx) */}
          <div
            id="export-modal-xlsx-option"
            onClick={handleDownloadXlsx}
            className="flex items-start justify-between rounded-xl border border-emerald-200 bg-emerald-50/20 p-3 hover:border-emerald-500 hover:bg-emerald-50/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white shrink-0 mt-0.5 shadow-xs">
                {isExporting === "xlsx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileSpreadsheet className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    Microsoft Excel Spreadsheet (*.xlsx)
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    5 Formatted Sheets
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Multi-sheet workbook: Executive Summary, Schedule Tasks with dependencies, Delayed Tasks, Lookahead Work Plan, and Trade Breakdown.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-emerald-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: Download PDF Performance Report */}
          <div
            id="export-modal-pdf-download-option"
            onClick={handleDownloadPdf}
            className="flex items-start justify-between rounded-xl border border-red-200 bg-red-50/20 p-3 hover:border-red-500 hover:bg-red-50/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-600 text-white shrink-0 mt-0.5 shadow-xs">
                {isExporting === "pdf" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileDown className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900 group-hover:text-red-700 transition-colors">
                    Download PDF Performance Report (*.pdf)
                  </span>
                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                    A4 Multi-Page
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Clean vector-rendered report with PlanD-X executive header, KPI summary, baseline 0 slip breakdown, lookahead schedule, and trade metrics.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-red-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: PowerPoint Presentation (.pptx) */}
          <div
            id="export-modal-pptx-option"
            onClick={handleDownloadPptx}
            className="flex items-start justify-between rounded-xl border border-amber-200 bg-amber-50/20 p-3 hover:border-amber-500 hover:bg-amber-50/40 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-600 text-white shrink-0 mt-0.5 shadow-xs">
                {isExporting === "pptx" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Presentation className="h-4 w-4" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                    PowerPoint Presentation (*.pptx)
                  </span>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                    16:9 Deck
                  </span>
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  5 presentation slides: Title cover, Executive schedule dashboard, Critical path &amp; delay analysis, Lookahead work plan, and Trade progress.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-amber-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: CSV Export */}
          <div
            id="export-modal-csv-option"
            onClick={handleDownloadCsv}
            className="flex items-start justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200 shrink-0 mt-0.5">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Export Schedule to CSV (*.csv)
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Standard RFC-4180 CSV with UTF-8 BOM. Contains summary metadata, baseline 0 slip, lookahead, and blockers.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-blue-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: Print or Save as PDF */}
          <div
            id="export-modal-pdf-option"
            onClick={handlePrintPdf}
            className="flex items-start justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200 shrink-0 mt-0.5">
                <Printer className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Print via Browser / System Print Dialog
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Opens interactive browser print preview optimized for screen-to-paper layout.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-blue-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: Full Programme Report View */}
          <div
            id="export-modal-view-report-option"
            onClick={handleViewReport}
            className="flex items-start justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-200/60 shrink-0 mt-0.5">
                <FileText className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Open Interactive Programme Report Page
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Explore interactive KPI cards, filter by reporting period, inspect delays, and drill into tasks.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-blue-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>

          {/* Option: JSON Data Dump */}
          <div
            id="export-modal-json-option"
            onClick={handleDownloadJson}
            className="flex items-start justify-between rounded-xl border border-slate-200 p-3 hover:border-blue-400 hover:bg-blue-50/30 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600 border border-slate-200 shrink-0 mt-0.5">
                <FileCode className="h-4 w-4" />
              </div>
              <div>
                <div className="text-[13px] font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                  Export Machine-Readable JSON (*.json)
                </div>
                <p className="text-[11.5px] text-slate-500 mt-0.5 leading-snug">
                  Complete structured payload for system integrations, API sync, or offline audits.
                </p>
              </div>
            </div>
            <div className="text-slate-400 group-hover:text-blue-600 shrink-0 pt-2">
              <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>

        {/* Footer info note */}
        <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-[11.5px] text-slate-400 font-mono">
          <span>Project: Ormiston Rise</span>
          <span>{report.totalTasks} Tasks · {report.overallProgress}% Complete</span>
        </div>
      </div>
    </div>
  );
}
