// Verification Test Suite: Microsoft Project Compatibility (Phase 5)
// ===================================================================
// Tests the 9 scenarios specified in the objective:
// 1. Task hierarchy & WBS levels
// 2. Multiple dependency types (FS, SS, FF, SF) and lag/lead
// 3. Milestones and task durations
// 4. Five-day & six-day working calendars
// 5. Non-working days and calendar exceptions
// 6. Baselines (Baseline 0) and progress data
// 7. Resource assignments & trade roles
// 8. Invalid files, binary .MPP trap, and unsupported field disclosure
// 9. Round-trip Import -> Export -> Re-import parity

import {
  parseScheduleFile,
  detectScheduleFileFormat,
  parseMspdiXml,
  parseScheduleCsv,
  exportToMspdiXml,
  exportToScheduleCsv,
  parseMspDurationToDays,
  parseMspLinkLagToDays,
  ScheduleParseResult,
} from "../lib/programme-msp-interop";
import {
  STANDARD_5_DAY_CALENDAR,
  CONSTRUCTION_6_DAY_CALENDAR,
  recalculateSchedule,
  formatDateIso,
} from "../lib/programme-calendar";
import { ProgrammeTask } from "../lib/programme-types";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
  console.log(`  ✓ ${message}`);
}

async function runVerification() {
  console.log("===============================================================");
  console.log(" PlanD-X Microsoft Project Compatibility Verification Suite");
  console.log("===============================================================\n");

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. A Simple Task Hierarchy & WBS
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("--- Scenario 1: Simple Task Hierarchy & WBS ---");
  const xmlHierarchy = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Name>Civil Infrastructure Project</Name>
    <Tasks>
      <Task>
        <UID>1</UID>
        <ID>1</ID>
        <Name>Phase 1 - Earthworks</Name>
        <WBS>1.0</WBS>
        <OutlineLevel>1</OutlineLevel>
        <Summary>1</Summary>
        <Start>2025-11-03T08:00:00</Start>
        <Finish>2025-11-21T17:00:00</Finish>
        <Duration>PT120H0M0S</Duration>
      </Task>
      <Task>
        <UID>2</UID>
        <ID>2</ID>
        <Name>Site Clearing</Name>
        <WBS>1.1</WBS>
        <OutlineLevel>2</OutlineLevel>
        <Summary>0</Summary>
        <Start>2025-11-03T08:00:00</Start>
        <Finish>2025-11-07T17:00:00</Finish>
        <Duration>PT40H0M0S</Duration>
      </Task>
      <Task>
        <UID>3</UID>
        <ID>3</ID>
        <Name>Bulk Grading</Name>
        <WBS>1.2</WBS>
        <OutlineLevel>2</OutlineLevel>
        <Summary>0</Summary>
        <Start>2025-11-10T08:00:00</Start>
        <Finish>2025-11-21T17:00:00</Finish>
        <Duration>PT80H0M0S</Duration>
      </Task>
    </Tasks>
  </Project>`;

  const resHierarchy = await parseScheduleFile({
    name: "hierarchy_test.xml",
    content: xmlHierarchy,
  });

  assert(resHierarchy.valid, "Hierarchy XML parsed successfully");
  assert(resHierarchy.tasks.length === 3, `Expected 3 tasks, got ${resHierarchy.tasks.length}`);
  const phase1 = resHierarchy.tasks.find((t) => t.id === "1");
  const child1 = resHierarchy.tasks.find((t) => t.id === "2");
  assert(phase1?.level === "phase", "Summary task correctly mapped to level='phase'");
  assert(phase1?.wbs === "1.0", "Phase has exact WBS code '1.0'");
  assert(child1?.parentId === "1", "Child task has parentId pointing to Phase 1");
  assert(phase1?.children?.includes("2") === true, "Phase children array includes child task '2'");
  assert(child1?.depth === 1, "Child depth correctly resolved to 1");

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Tasks with Multiple Dependency Types & Lag/Lead
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 2: Multiple Dependency Types (FS, SS, FF, SF) & Lag ---");
  const xmlDependencies = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Name>Dependency Test Suite</Name>
    <Tasks>
      <Task><UID>10</UID><ID>1</ID><Name>Anchor Task</Name><WBS>1.1</WBS><Duration>PT40H0M0S</Duration><Start>2025-11-03T08:00:00</Start><Finish>2025-11-07T17:00:00</Finish></Task>
      <Task>
        <UID>20</UID><ID>2</ID><Name>FS Successor with Lag</Name><WBS>1.2</WBS><Duration>PT40H0M0S</Duration>
        <Start>2025-11-12T08:00:00</Start><Finish>2025-11-18T17:00:00</Finish>
        <PredecessorLink>
          <PredecessorUID>10</PredecessorUID>
          <Type>1</Type>
          <LinkLag>9600</LinkLag> <!-- 2 days lag: 20 * 480 mins -->
        </PredecessorLink>
      </Task>
      <Task>
        <UID>30</UID><ID>3</ID><Name>SS Successor</Name><WBS>1.3</WBS><Duration>PT40H0M0S</Duration>
        <Start>2025-11-03T08:00:00</Start><Finish>2025-11-07T17:00:00</Finish>
        <PredecessorLink>
          <PredecessorUID>10</PredecessorUID>
          <Type>3</Type>
          <LinkLag>0</LinkLag>
        </PredecessorLink>
      </Task>
      <Task>
        <UID>40</UID><ID>4</ID><Name>FF Successor</Name><WBS>1.4</WBS><Duration>PT40H0M0S</Duration>
        <Start>2025-11-03T08:00:00</Start><Finish>2025-11-07T17:00:00</Finish>
        <PredecessorLink>
          <PredecessorUID>10</PredecessorUID>
          <Type>0</Type>
          <LinkLag>0</LinkLag>
        </PredecessorLink>
      </Task>
      <Task>
        <UID>50</UID><ID>5</ID><Name>SF Successor</Name><WBS>1.5</WBS><Duration>PT40H0M0S</Duration>
        <Start>2025-11-03T08:00:00</Start><Finish>2025-11-07T17:00:00</Finish>
        <PredecessorLink>
          <PredecessorUID>10</PredecessorUID>
          <Type>2</Type>
          <LinkLag>0</LinkLag>
        </PredecessorLink>
      </Task>
    </Tasks>
  </Project>`;

  const resDeps = await parseScheduleFile({
    name: "deps_test.xml",
    content: xmlDependencies,
  });

  assert(resDeps.valid, "Dependencies XML parsed successfully");
  const taskFS = resDeps.tasks.find((t) => t.id === "20");
  const taskSS = resDeps.tasks.find((t) => t.id === "30");
  const taskFF = resDeps.tasks.find((t) => t.id === "40");
  const taskSF = resDeps.tasks.find((t) => t.id === "50");

  assert(taskFS?.predecessors.includes("10") === true, "Task 20 links to predecessor 10");
  assert(taskFS?.predecessorDetails?.[0]?.type === "FS", "Task 20 has dependency type 'FS'");
  assert(taskFS?.predecessorDetails?.[0]?.lag === 2, `Task 20 has 2 days lag (parsed ${taskFS?.predecessorDetails?.[0]?.lag}d)`);

  assert(taskSS?.predecessorDetails?.[0]?.type === "SS", "Task 30 has dependency type 'SS'");
  assert(taskFF?.predecessorDetails?.[0]?.type === "FF", "Task 40 has dependency type 'FF'");
  assert(taskSF?.predecessorDetails?.[0]?.type === "SF", "Task 50 has dependency type 'SF'");

  // Verify anchor task knows its successors
  const anchor = resDeps.tasks.find((t) => t.id === "10");
  assert(anchor?.successors.length === 4, `Anchor task has 4 successors (got ${anchor?.successors.length})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Milestones and Task Durations
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 3: Milestones and Task Durations ---");
  const xmlMilestones = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Tasks>
      <Task>
        <UID>100</UID>
        <Name>Long Concrete Cure Task</Name>
        <Milestone>0</Milestone>
        <Duration>PT160H0M0S</Duration> <!-- 20 days -->
        <Start>2025-11-03T08:00:00</Start>
        <Finish>2025-11-28T17:00:00</Finish>
      </Task>
      <Task>
        <UID>101</UID>
        <Name>Engineering Completion Sign-Off</Name>
        <Milestone>1</Milestone>
        <Duration>PT0H0M0S</Duration> <!-- 0 days -->
        <Start>2025-11-28T17:00:00</Start>
        <Finish>2025-11-28T17:00:00</Finish>
      </Task>
    </Tasks>
  </Project>`;

  const resMilestones = await parseScheduleFile({
    name: "milestone_test.xml",
    content: xmlMilestones,
  });

  const taskDur = resMilestones.tasks.find((t) => t.id === "100");
  const taskMs = resMilestones.tasks.find((t) => t.id === "101");

  assert(taskDur?.duration === 20, `Task duration correctly computed to 20 days (got ${taskDur?.duration})`);
  assert(taskDur?.level === "task", "Duration activity is level 'task'");
  assert(taskMs?.duration === 0, `Milestone duration correctly set to 0 days (got ${taskMs?.duration})`);
  assert(taskMs?.level === "milestone", "Milestone flag correctly mapped to level 'milestone'");
  assert(resMilestones.milestonesCount === 1, `Total milestone count is 1 (got ${resMilestones.milestonesCount})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. Five-Day or Other Supported Working Calendars
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 4: Five-Day and Six-Day Working Calendars ---");
  const xml6DayCal = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Calendars>
      <Calendar>
        <UID>1</UID>
        <Name>Civil Works 6-Day Schedule</Name>
        <WeekDays>
          <WeekDay><DayType>1</DayType><DayWorking>0</DayWorking></WeekDay> <!-- Sunday: Off -->
          <WeekDay><DayType>2</DayType><DayWorking>1</DayWorking></WeekDay> <!-- Monday: Work -->
          <WeekDay><DayType>3</DayType><DayWorking>1</DayWorking></WeekDay>
          <WeekDay><DayType>4</DayType><DayWorking>1</DayWorking></WeekDay>
          <WeekDay><DayType>5</DayType><DayWorking>1</DayWorking></WeekDay>
          <WeekDay><DayType>6</DayType><DayWorking>1</DayWorking></WeekDay>
          <WeekDay><DayType>7</DayType><DayWorking>1</DayWorking></WeekDay> <!-- Saturday: Work -->
        </WeekDays>
      </Calendar>
    </Calendars>
    <Tasks>
      <Task><UID>1</UID><Name>Saturday Concrete Pour</Name><Duration>PT48H0M0S</Duration><Start>2025-11-03T08:00:00</Start><Finish>2025-11-08T17:00:00</Finish></Task>
    </Tasks>
  </Project>`;

  const res6Day = await parseScheduleFile({
    name: "cal_6day.xml",
    content: xml6DayCal,
  });

  assert(res6Day.calendarWorkingDays?.length === 6, `Calendar working days detected as 6 days (got ${res6Day.calendarWorkingDays?.length})`);
  assert(res6Day.calendarWorkingDays?.includes(6) === true, "Saturday (day 6) is registered as working day");

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. Non-Working Days and Calendar Exceptions
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 5: Non-Working Days and Calendar Exceptions ---");
  const xmlExceptions = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Calendars>
      <Calendar>
        <UID>1</UID>
        <Name>Standard With Christmas Shutdown</Name>
        <TimephasedData>
          <Type>11</Type>
          <UID>1</UID>
          <Start>2025-12-25T00:00:00</Start>
          <Finish>2025-12-26T23:59:59</Finish>
        </TimephasedData>
        <Exceptions>
          <Exception>
            <Name>Christmas Shutdown</Name>
            <DayWorking>0</DayWorking>
          </Exception>
        </Exceptions>
      </Calendar>
    </Calendars>
    <Tasks>
      <Task><UID>1</UID><Name>Winter Paving</Name><Duration>PT40H0M0S</Duration><Start>2025-12-22T08:00:00</Start><Finish>2025-12-29T17:00:00</Finish></Task>
    </Tasks>
  </Project>`;

  const resExceptions = await parseScheduleFile({
    name: "cal_exceptions.xml",
    content: xmlExceptions,
  });

  assert(resExceptions.valid, "File with calendar exceptions parsed safely");
  const calField = resExceptions.unsupportedFields.find((f) => f.field.includes("Calendar Exceptions"));
  assert(calField !== undefined, "Calendar exceptions detected and reported in Unsupported Fields disclosure");

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. Baselines and Progress Data
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 6: Baselines (Baseline 0) & Progress Data ---");
  const xmlBaseline = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Tasks>
      <Task>
        <UID>200</UID>
        <Name>Retaining Wall Construction</Name>
        <PercentComplete>75</PercentComplete>
        <Start>2025-11-10T08:00:00</Start>
        <Finish>2025-11-28T17:00:00</Finish>
        <Duration>PT120H0M0S</Duration>
        <Baseline>
          <Number>0</Number>
          <Start>2025-11-03T08:00:00</Start>
          <Finish>2025-11-21T17:00:00</Finish>
          <Duration>PT120H0M0S</Duration>
        </Baseline>
      </Task>
    </Tasks>
  </Project>`;

  const resBaseline = await parseScheduleFile({
    name: "baseline_test.xml",
    content: xmlBaseline,
  });

  const baseTask = resBaseline.tasks.find((t) => t.id === "200");
  assert(baseTask?.progress === 75, `Task progress captured at 75% (got ${baseTask?.progress}%)`);
  assert(baseTask?.status === "in-progress", `Task status resolves to 'in-progress'`);
  assert(baseTask?.baseline0Start === "2025-11-03", `Baseline 0 start captured as '2025-11-03' (got ${baseTask?.baseline0Start})`);
  assert(baseTask?.baseline0Finish === "2025-11-21", `Baseline 0 finish captured as '2025-11-21' (got ${baseTask?.baseline0Finish})`);
  assert(resBaseline.baselinedTasksCount === 1, `Baselined tasks count is 1 (got ${resBaseline.baselinedTasksCount})`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 7. Resource Assignments Where Supported
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 7: Resource Assignments & Trade Roles ---");
  const xmlResources = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Resources>
      <Resource><UID>1</UID><Name>Civils Contractor Alpha</Name></Resource>
      <Resource><UID>2</UID><Name>Structural Steel Team</Name></Resource>
    </Resources>
    <Tasks>
      <Task><UID>10</UID><Name>Ground Remediation</Name><Duration>PT40H0M0S</Duration><Start>2025-11-03T08:00:00</Start><Finish>2025-11-07T17:00:00</Finish></Task>
    </Tasks>
    <Assignments>
      <Assignment>
        <TaskUID>10</TaskUID>
        <ResourceUID>1</ResourceUID>
      </Assignment>
    </Assignments>
  </Project>`;

  const resResources = await parseScheduleFile({
    name: "resources_test.xml",
    content: xmlResources,
  });

  assert(resResources.resources.length === 2, `Resources parsed: 2 items (got ${resResources.resources.length})`);
  const assignedTask = resResources.tasks.find((t) => t.id === "10");
  assert(assignedTask?.subcontractor === "Civils Contractor Alpha", `Assigned subcontractor correctly mapped: ${assignedTask?.subcontractor}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // 8. Invalid Files, Binary .MPP Trap & Unsupported Fields Disclosure
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 8: Invalid Files, Binary .MPP Trap & Unsupported Fields ---");

  // 8A: Binary .MPP Trap
  const mppHeaderBytes = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x12]);
  const resMpp = await parseScheduleFile({
    name: "master_schedule.mpp",
    content: mppHeaderBytes.buffer,
  });

  assert(resMpp.format === "mpp", "Detected .mpp binary format from magic bytes");
  assert(resMpp.valid === false, ".mpp marked invalid for direct parsing");
  assert(resMpp.mppExplanation !== undefined, "Detailed MPP guidance explanation returned");
  assert(resMpp.mppExplanation?.howToConvert.length === 4, "4-step conversion guidance provided");
  assert(Boolean(resMpp.mppExplanation?.howToConvert[2].includes("XML Format (*.xml)")), "Conversion guide explicitly names 'XML Format (*.xml)'");

  // 8B: Corrupted / Malformed XML
  const corruptedXml = `<Project><UnclosedTag>`;
  const resCorrupted = await parseScheduleFile({
    name: "corrupted.xml",
    content: corruptedXml,
  });
  assert(resCorrupted.valid === false || resCorrupted.tasks.length === 0, "Corrupted XML handled safely without crashing");

  // 8C: Unsupported fields inspection (Cost rate tables, recurring tasks)
  const xmlAdvancedFields = `<?xml version="1.0" encoding="UTF-8"?>
  <Project xmlns="http://schemas.microsoft.com/project">
    <Resources>
      <Resource>
        <UID>1</UID><Name>Senior Engineer</Name>
        <CostRateTable><CostPerUse>500</CostPerUse></CostRateTable>
      </Resource>
    </Resources>
    <Tasks>
      <Task>
        <UID>1</UID><Name>Weekly Safety Briefing</Name><Recurring>1</Recurring>
        <Duration>PT8H0M0S</Duration><Start>2025-11-03T08:00:00</Start><Finish>2025-11-03T17:00:00</Finish>
        <TimephasedData><Type>1</Type></TimephasedData>
      </Task>
    </Tasks>
  </Project>`;

  const resAdvanced = await parseScheduleFile({
    name: "advanced_msp.xml",
    content: xmlAdvancedFields,
  });

  assert(resAdvanced.unsupportedFields.length >= 3, `Identified ${resAdvanced.unsupportedFields.length} unsupported fields`);
  const costField = resAdvanced.unsupportedFields.find((f) => f.field.includes("Cost Rate"));
  const recurField = resAdvanced.unsupportedFields.find((f) => f.field.includes("Recurring"));
  const contourField = resAdvanced.unsupportedFields.find((f) => f.field.includes("Timephased"));

  assert(costField !== undefined, "Cost rate tables reported in transparency list");
  assert(recurField !== undefined, "Recurring tasks reported in transparency list");
  assert(contourField !== undefined, "Timephased / work contours reported in transparency list");

  // ─────────────────────────────────────────────────────────────────────────────
  // 9. Round-Trip Parity: Import -> Export -> Re-import
  // ─────────────────────────────────────────────────────────────────────────────
  console.log("\n--- Scenario 9: Round-Trip Parity (Import -> Export -> Re-import) ---");

  // Take the tasks parsed from Scenario 2 (with FS, SS, FF, SF links & lag)
  const initialTasks = resDeps.tasks;

  // Export to standard MSPDI XML
  const exportedXml = exportToMspdiXml(
    initialTasks,
    STANDARD_5_DAY_CALENDAR,
    "Roundtrip Test Schedule"
  );

  assert(exportedXml.includes("<Project xmlns=\"http://schemas.microsoft.com/project\">"), "Exported XML includes MSPDI schema namespace");
  assert(exportedXml.includes("<Name>Roundtrip Test Schedule</Name>"), "Exported XML contains correct project name");
  assert(exportedXml.includes("<PredecessorUID>10</PredecessorUID>"), "Exported XML preserves predecessor UID links");

  // Re-import the exported XML
  const reimportedRes = await parseScheduleFile({
    name: "roundtrip_reimport.xml",
    content: exportedXml,
  });

  assert(reimportedRes.valid, "Re-imported XML is valid");
  assert(reimportedRes.tasks.length === initialTasks.length, `Task count preserved: ${reimportedRes.tasks.length} == ${initialTasks.length}`);

  for (const orig of initialTasks) {
    const re = reimportedRes.tasks.find((t) => t.id === orig.id);
    assert(re !== undefined, `Task ${orig.id} found in re-imported schedule`);
    assert(re?.name === orig.name, `Task ${orig.id} name preserved ("${orig.name}" == "${re?.name}")`);
    assert(re?.duration === orig.duration, `Task ${orig.id} duration preserved (${orig.duration}d)`);
    assert(re?.predecessors.length === orig.predecessors.length, `Task ${orig.id} predecessor count preserved`);

    if (orig.predecessorDetails && orig.predecessorDetails.length > 0) {
      assert(
        re?.predecessorDetails?.[0]?.type === orig.predecessorDetails[0].type,
        `Task ${orig.id} dependency type preserved (${orig.predecessorDetails[0].type})`
      );
      assert(
        re?.predecessorDetails?.[0]?.lag === orig.predecessorDetails[0].lag,
        `Task ${orig.id} lag preserved (${orig.predecessorDetails[0].lag}d)`
      );
    }
  }

  // Also test CSV Export -> CSV Import roundtrip
  console.log("\n--- Scenario 9B: CSV Export & Re-import Parity ---");
  const exportedCsv = exportToScheduleCsv(initialTasks);
  const reimportedCsvRes = await parseScheduleFile({
    name: "roundtrip_reimport.csv",
    content: exportedCsv,
  });

  assert(reimportedCsvRes.valid, "Re-imported CSV is valid");
  assert(reimportedCsvRes.tasks.length === initialTasks.length, `CSV roundtrip task count preserved: ${reimportedCsvRes.tasks.length}`);

  console.log("\n===============================================================");
  console.log(" ✅ ALL 9 SCENARIOS VERIFIED SUCCESSFULLY!");
  console.log("===============================================================");
}

runVerification().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
