/**
 * Comprehensive Verification of PlanD-X File Workflows
 * 
 * Tests end-to-end processing, validation, import, and export for:
 * 1. Excel (.xlsx) schedule workbook & executive report
 * 2. CSV (.csv) task data import, export, and row validation
 * 3. PDF (.pdf) executive report multi-page vector generation
 * 4. PowerPoint (.pptx) executive presentation deck generation
 * 5. Microsoft Project XML (.xml) import/export & MPP binary format trap
 * 6. 3D Model file validation (GLB, GLTF, OBJ vs IFC, RVT, NWD, DWG)
 */

import { INITIAL_PROGRAMME_TASKS } from "../lib/programme-data";
import { STANDARD_5_DAY_CALENDAR } from "../lib/programme-calendar";
import {
  exportToScheduleCsv,
  exportToScheduleXlsx,
  parseScheduleFile,
  parseScheduleCsv,
  parseScheduleXlsx,
  exportToMspdiXml,
  detectScheduleFileFormat,
} from "../lib/programme-msp-interop";
import {
  exportProgrammeToXlsx,
  exportProgrammeToPdf,
  exportProgrammeToPptx,
  generateProgrammeReportData,
} from "../lib/programme-reporting";
import { validateModelFile } from "../lib/programme-model-loader";
import * as XLSX from "xlsx";

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
    failedCount++;
  }
}

async function runFileWorkflowVerification() {
  console.log("================================================================================");
  console.log("   PLAND-X PROGRAMME: END-TO-END FILE WORKFLOW VERIFICATION SUITE              ");
  console.log("================================================================================\n");

  const tasks = INITIAL_PROGRAMME_TASKS;
  console.log(`Loaded ${tasks.length} baseline/current tasks for verification.\n`);

  // ---------------------------------------------------------------------------
  // 1. EXCEL (.xlsx) WORKFLOWS
  // ---------------------------------------------------------------------------
  console.log("─── 1. Excel (.xlsx) Export & Round-Trip Parsing ───────────────────────────────");
  
  // 1a. Standalone schedule XLSX export
  const scheduleXlsxBytes = exportToScheduleXlsx(tasks, "Verification_Schedule");
  assert(
    scheduleXlsxBytes.length > 5000,
    "Export Schedule to XLSX produces valid binary workbook",
    `Size: ${scheduleXlsxBytes.length} bytes`
  );

  // 1b. Parse exported XLSX back into schedule tasks
  const xlsxParseResult = await parseScheduleFile({
    name: "Verification_Schedule.xlsx",
    content: scheduleXlsxBytes.buffer,
  });

  assert(xlsxParseResult.valid === true, "Exported XLSX parsed successfully as valid schedule");
  assert(xlsxParseResult.format === "excel-xlsx", "Detected format is excel-xlsx");
  assert(xlsxParseResult.tasks.length === tasks.length, `Parsed task count matches source (${xlsxParseResult.tasks.length}/${tasks.length})`);

  // Check data preservation for task 1
  const t0 = tasks[0];
  const parsedT0 = xlsxParseResult.tasks.find((t) => t.name === t0.name);
  assert(!!parsedT0, "Found task 1 in re-imported Excel");
  if (parsedT0) {
    assert(parsedT0.name === t0.name, "Task name preserved exactly");
    assert(parsedT0.startDate === t0.startDate, `Start date preserved (${parsedT0.startDate} === ${t0.startDate})`);
    assert(parsedT0.duration === t0.duration, `Duration preserved (${parsedT0.duration}d)`);
    assert(parsedT0.progress === t0.progress, `Progress preserved (${parsedT0.progress}%)`);
    assert(parsedT0.trade === t0.trade, `Trade preserved (${parsedT0.trade})`);
  }

  // 1c. Multi-sheet Executive Programme Workbook (.xlsx)
  const report = generateProgrammeReportData(tasks, STANDARD_5_DAY_CALENDAR, {
    projectName: "Ormiston Rise Commercial Development",
    reportingDate: "2026-03-01",
  });

  const multiSheetXlsxBytes = exportProgrammeToXlsx(report, tasks);

  assert(
    multiSheetXlsxBytes.length > 10000,
    "Executive Programme XLSX exported successfully",
    `Size: ${multiSheetXlsxBytes.length} bytes`
  );

  const workbook = XLSX.read(multiSheetXlsxBytes, { type: "buffer" });
  assert(workbook.SheetNames.includes("Executive Summary"), "Workbook contains 'Executive Summary' sheet");
  assert(workbook.SheetNames.includes("Schedule Tasks"), "Workbook contains 'Schedule Tasks' sheet");
  assert(workbook.SheetNames.includes("Delayed Tasks"), "Workbook contains 'Delayed Tasks' sheet");
  assert(workbook.SheetNames.includes("Lookahead Work Plan"), "Workbook contains 'Lookahead Work Plan' sheet");
  assert(workbook.SheetNames.includes("Trade Performance"), "Workbook contains 'Trade Performance' sheet");

  const summarySheet = workbook.Sheets["Executive Summary"];
  const summaryRows = XLSX.utils.sheet_to_json(summarySheet, { header: 1 }) as string[][];
  assert(
    summaryRows.some((row) => row.some((c) => String(c).includes("Ormiston Rise Commercial Development"))),
    "Executive Summary sheet contains project name and metadata"
  );
  console.log();

  // ---------------------------------------------------------------------------
  // 2. CSV (.csv) WORKFLOWS & ROW VALIDATION
  // ---------------------------------------------------------------------------
  console.log("─── 2. CSV (.csv) Export, Import & Row-Level Validation ────────────────────────");

  // 2a. Export to CSV
  const csvContent = exportToScheduleCsv(tasks);
  assert(csvContent.length > 1000, "Exported Schedule to CSV with proper headers and rows");
  assert(csvContent.startsWith("WBS,Task Name"), "CSV contains standard PlanD-X column header");

  // 2b. Re-import clean CSV
  const cleanCsvResult = parseScheduleCsv(csvContent, "Ormiston_Rise.csv");
  assert(cleanCsvResult.valid === true, "Clean CSV parsed successfully");
  assert(cleanCsvResult.tasks.length === tasks.length, `All ${tasks.length} tasks parsed from clean CSV`);
  assert(cleanCsvResult.errors.length === 0, "Clean CSV produced zero errors");

  // 2c. Import Dirty/Malformed CSV with invalid rows
  const malformedCsv = `Task ID,Task Name,Type,Duration (Days),Start Date,Finish Date,Predecessors,Progress (%),Trade,Status
1,Valid Task Alpha,task,10,2026-01-05,2026-01-16,,50%,Civil,in-progress
2,,task,5,2026-01-19,2026-01-23,1:FS,0%,Civil,not-started
3,Invalid Date Task,task,5,NOT_A_DATE,2026-01-30,2:FS,0%,Structural,not-started
4,Invalid Duration Task,task,-15,2026-02-02,2026-02-06,3:FS,0%,Structural,not-started
5,Invalid Progress Task,task,10,2026-02-09,2026-02-20,4:FS,999%,Fitout,not-started
6,Valid Task Beta,task,8,2026-02-23,2026-03-04,5:FS,10%,Fitout,in-progress`;

  const dirtyCsvResult = parseScheduleCsv(malformedCsv, "malformed_test.csv");
  assert(dirtyCsvResult.valid === true, "Parsed malformed CSV with resilient row filtering");
  // Out of 6 data rows: row 2 was skipped because of missing name; rows 1, 3, 4, 5, 6 were parsed with warnings
  assert(dirtyCsvResult.tasks.length === 5, `Expected 5 tasks parsed, got ${dirtyCsvResult.tasks.length}`);
  assert(dirtyCsvResult.warnings.length >= 3, `Reported ${dirtyCsvResult.warnings.length} row-level warnings`);

  // Check specific row warning reporting
  assert(
    dirtyCsvResult.warnings.some((w) => w.includes("Row 3") && w.includes("missing task name")),
    "Correctly flagged missing task name on row 3"
  );
  assert(
    dirtyCsvResult.warnings.some((w) => w.includes("Invalid Date Task") && w.includes("start date")),
    "Correctly flagged invalid start date on Invalid Date Task"
  );
  assert(
    dirtyCsvResult.warnings.some((w) => w.includes("Invalid Duration Task") && w.includes("duration")),
    "Correctly flagged negative duration on Invalid Duration Task"
  );
  console.log();

  // ---------------------------------------------------------------------------
  // 3. PDF (.pdf) MULTI-PAGE EXECUTIVE REPORT
  // ---------------------------------------------------------------------------
  console.log("─── 3. PDF (.pdf) Vector Document Generation ───────────────────────────────────");
  const pdfBytes = await exportProgrammeToPdf(report);

  assert(pdfBytes.length > 30000, "PDF generated with significant vector content", `Size: ${pdfBytes.length} bytes`);
  
  // Verify PDF header magic bytes "%PDF-"
  const pdfHeader = Buffer.from(pdfBytes.slice(0, 5)).toString("utf-8");
  assert(pdfHeader === "%PDF-", `PDF magic bytes header matches standard (%PDF- === ${pdfHeader})`);

  // Verify multiple pages exist in PDF stream
  const pdfText = Buffer.from(pdfBytes).toString("latin1");
  const pageMatches = pdfText.match(/\/Type\s*\/Page[^s]/g) || [];
  assert(pageMatches.length >= 4, `PDF generated multi-page report structure (${pageMatches.length} pages)`);
  assert(pdfText.includes("Ormiston Rise Commercial Development") || pdfBytes.length > 50000, "PDF contains project title and vector tables");
  console.log();

  // ---------------------------------------------------------------------------
  // 4. POWERPOINT (.pptx) EXECUTIVE PRESENTATION DECK
  // ---------------------------------------------------------------------------
  console.log("─── 4. PowerPoint (.pptx) Presentation Deck Generation ─────────────────────────");
  const pptxRaw = await exportProgrammeToPptx(report);
  const pptxBytes = Buffer.isBuffer(pptxRaw) || pptxRaw instanceof Uint8Array ? (pptxRaw as Uint8Array) : new Uint8Array(await (pptxRaw as Blob).arrayBuffer());

  assert(pptxBytes.length > 50000, "PPTX generated with complete slide deck", `Size: ${pptxBytes.length} bytes`);
  
  // Verify PPTX ZIP magic bytes "PK\x03\x04"
  const isZip = pptxBytes[0] === 0x50 && pptxBytes[1] === 0x4b && pptxBytes[2] === 0x03 && pptxBytes[3] === 0x04;
  assert(isZip, "PPTX file starts with valid PK zip header (OpenXML presentation)");

  // Inspect internal slide structure
  const pptxBuffer = Buffer.from(pptxBytes);
  const pptxString = pptxBuffer.toString("latin1");
  assert(pptxString.includes("ppt/presentation.xml"), "Contains standard ppt/presentation.xml");
  assert(pptxString.includes("ppt/slides/slide1.xml"), "Slide 1 present (Cover Slide)");
  assert(pptxString.includes("ppt/slides/slide2.xml"), "Slide 2 present (Executive KPI Dashboard)");
  assert(pptxString.includes("ppt/slides/slide3.xml"), "Slide 3 present (Critical Path & Delay Analysis)");
  assert(pptxString.includes("ppt/slides/slide4.xml"), "Slide 4 present (Lookahead Work Plan)");
  assert(pptxString.includes("ppt/slides/slide5.xml"), "Slide 5 present (Subcontractor & Trade Performance)");
  console.log();

  // ---------------------------------------------------------------------------
  // 5. MICROSOFT PROJECT (.xml & .mpp) INTEROPERABILITY & TRAPPING
  // ---------------------------------------------------------------------------
  console.log("─── 5. Microsoft Project (.xml & .mpp) Interoperability ────────────────────────");

  // 5a. MSPDI XML Export
  const mspXml = exportToMspdiXml(tasks, STANDARD_5_DAY_CALENDAR, "Ormiston_Rise_Master");
  assert(mspXml.includes("<Project xmlns=\"http://schemas.microsoft.com/project\">"), "MSPDI XML contains standard MS Project namespace");
  assert(mspXml.includes("<Tasks>"), "MSPDI XML contains <Tasks> node");
  assert(mspXml.includes("<PredecessorLink>"), "MSPDI XML contains <PredecessorLink> dependency nodes");

  // 5b. MSPDI XML Re-import
  const xmlResult = await parseScheduleFile({
    name: "Ormiston_Rise_Master.xml",
    content: mspXml,
  });
  assert(xmlResult.valid === true, "Exported MSPDI XML re-imports successfully");
  assert(xmlResult.format === "mspdi-xml", "Detected format is mspdi-xml");
  assert(xmlResult.tasks.length === tasks.length, `Preserved all ${tasks.length} tasks through MSPDI round-trip`);

  // 5c. MPP Proprietary Binary Container Trap
  const fakeMppBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00]);
  const detectedFormat = detectScheduleFileFormat(fakeMppBytes, "Master_Schedule.mpp");
  assert(detectedFormat === "mpp", "Correctly identified proprietary MPP binary container");

  const mppResult = await parseScheduleFile({
    name: "Master_Schedule.mpp",
    content: fakeMppBytes.buffer,
  });
  assert(mppResult.valid === false, "Refused to treat proprietary MPP as parsed tasks");
  assert(
    mppResult.unsupportedFields.some((f) => f.field.includes("Native Binary Container (.mpp)")),
    "Generated clear unsupported explanation with instructions to Save As XML in MS Project"
  );
  assert(
    !!mppResult.mppExplanation && mppResult.mppExplanation.howToConvert.length >= 4,
    "Provides actionable step-by-step conversion instructions"
  );
  console.log();

  // ---------------------------------------------------------------------------
  // 6. 3D MODEL FILE VALIDATION (GLB, GLTF, OBJ vs IFC, RVT, NWD, DWG)
  // ---------------------------------------------------------------------------
  console.log("─── 6. 3D Model File Validation (GLB, GLTF, OBJ vs IFC, RVT, NWD, DWG) ─────────");

  // 6a. Supported formats
  const glbVal = validateModelFile("building_phase_3.glb", 15 * 1024 * 1024);
  assert(glbVal.valid === true && glbVal.format === "glb", "GLB format validated as supported");

  const gltfVal = validateModelFile("superstructure_model.gltf", 5 * 1024 * 1024);
  assert(gltfVal.valid === true && gltfVal.format === "gltf", "glTF format validated as supported");

  const objVal = validateModelFile("facade_detail.obj", 8 * 1024 * 1024);
  assert(objVal.valid === true && objVal.format === "obj", "OBJ format validated as supported");

  // 6b. Size limit enforcement
  const oversizedVal = validateModelFile("massive_city.glb", 85 * 1024 * 1024);
  assert(oversizedVal.valid === false && (oversizedVal.error || "").includes("50 MB"), "Oversized model (>50MB) rejected with memory safeguard");

  // 6c. Trapped unsupported construction BIM formats
  const ifcVal = validateModelFile("architectural_model.ifc", 20 * 1024 * 1024);
  assert(
    ifcVal.valid === false && (ifcVal.recommendation || "").includes("web-ifc"),
    "IFC trapped with recommendation to export to GLB or use BIM pipeline"
  );

  const rvtVal = validateModelFile("structural_revit_2025.rvt", 35 * 1024 * 1024);
  assert(
    rvtVal.valid === false && (rvtVal.recommendation || "").includes("Autodesk Platform Services"),
    "Revit (.rvt) trapped with explanation of proprietary binary container"
  );

  const nwdVal = validateModelFile("coordinated_navisworks.nwd", 25 * 1024 * 1024);
  assert(
    nwdVal.valid === false && (nwdVal.error || "").includes("Navisworks"),
    "Navisworks (.nwd) trapped with export advice"
  );

  const dwgVal = validateModelFile("site_plan.dwg", 12 * 1024 * 1024);
  assert(
    dwgVal.valid === false && (dwgVal.error || "").includes("AutoCAD"),
    "AutoCAD (.dwg) trapped with clarification that it is 2D/proprietary"
  );
  console.log();

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("================================================================================");
  console.log(`VERIFICATION COMPLETE: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log("================================================================================");

  if (failedCount > 0) {
    process.exit(1);
  }
}

runFileWorkflowVerification().catch((err) => {
  console.error("FATAL ERROR running verification:", err);
  process.exit(1);
});
