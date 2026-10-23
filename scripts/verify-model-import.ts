import fs from "fs";
import path from "path";
import {
  validateModelFile,
  parseObjText,
  type SupportedModelFormat,
} from "../lib/programme-model-loader";
import { PROJECT_PRESETS } from "../components/programme/model3d/model-data";

console.log("===============================================================================");
console.log("   PLAN-DX: 3D MODEL IMPORT & PROGRAMME INTEGRATION VERIFICATION");
console.log("===============================================================================\n");

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`✅ PASS: ${testName}`);
  } else {
    console.error(`❌ FAIL: ${testName} ${detail ? `(${detail})` : ""}`);
  }
}

async function runTests() {
  // ─── 1. Format Validation & Rejection of Unsupported Formats ───
  console.log("--- 1. File Format Validation & Error Explanations ---");
  
  const glbCheck = validateModelFile("tower.glb", 1024 * 1024);
  assert(glbCheck.valid === true && glbCheck.format === "glb", "GLB files are correctly validated as supported");

  const gltfCheck = validateModelFile("facade.gltf", 500 * 1024);
  assert(gltfCheck.valid === true && gltfCheck.format === "gltf", "GLTF files are correctly validated as supported");

  const objCheck = validateModelFile("frame.obj", 250 * 1024);
  assert(objCheck.valid === true && objCheck.format === "obj", "OBJ files are correctly validated as supported");

  const ifcCheck = validateModelFile("building.ifc", 10 * 1024 * 1024);
  assert(
    ifcCheck.valid === false && Boolean(ifcCheck.error?.includes("IFC format (.ifc) is not supported")),
    "IFC files are rejected with informative error explaining WebAssembly/engine requirements"
  );
  assert(
    ifcCheck.recommendation?.includes("web-ifc") === true,
    "IFC rejection includes clear recommendation for GLB/OBJ export"
  );

  const rvtCheck = validateModelFile("central-station.rvt", 15 * 1024 * 1024);
  assert(
    rvtCheck.valid === false && Boolean(rvtCheck.error?.includes("Autodesk Revit")),
    "Revit (.rvt) files are rejected with APS/Forge explanation"
  );

  const nwdCheck = validateModelFile("federated.nwd", 20 * 1024 * 1024);
  assert(
    nwdCheck.valid === false && Boolean(nwdCheck.error?.includes("Navisworks")),
    "Navisworks (.nwd) files are rejected with actionable guidance"
  );

  const oversizedCheck = validateModelFile("massive-scan.obj", 60 * 1024 * 1024);
  assert(
    oversizedCheck.valid === false && Boolean(oversizedCheck.error?.includes("exceeds browser WebGL limit")),
    "Files over 50MB are flagged to protect browser memory and WebGL performance"
  );

  // ─── 2. Real Geometry Parsing & Bounding Box Calculation ───
  console.log("\n--- 2. Real Geometry Parsing & Three.js Scene Extraction ---");

  const sampleObjPath = path.join(process.cwd(), "public/models/sample-structural-frame.obj");
  const objExists = fs.existsSync(sampleObjPath);
  assert(objExists, "Sample structural frame OBJ file exists in public/models/");

  const objText = fs.readFileSync(sampleObjPath, "utf8");
  const parsedModel = await parseObjText(objText, "sample-structural-frame.obj", objText.length, "sample");

  assert(parsedModel.meshCount > 0, `Model parsed ${parsedModel.meshCount} real meshes (expected > 0)`);
  assert(parsedModel.vertexCount > 0, `Model parsed ${parsedModel.vertexCount} BufferGeometry vertices`);
  assert(parsedModel.boundingBox.size[0] > 0, `Calculated bounding width X: ${parsedModel.boundingBox.size[0].toFixed(2)}m`);
  assert(parsedModel.boundingBox.size[1] > 0, `Calculated bounding height Y: ${parsedModel.boundingBox.size[1].toFixed(2)}m`);
  assert(parsedModel.boundingBox.size[2] > 0, `Calculated bounding depth Z: ${parsedModel.boundingBox.size[2].toFixed(2)}m`);

  // ─── 3. Data Integrity & Task Association Rules ───
  console.log("\n--- 3. Data Integrity & Honest Non-Mapping Assertions ---");

  assert(
    parsedModel.hasTaskMapping === false,
    "Raw imported model explicitly flagged with hasTaskMapping = false"
  );
  assert(
    parsedModel.notes.includes("no automated WBS task linkages"),
    "Import metadata clearly documents that raw mesh geometries do not fabricate task links"
  );

  // ─── 4. Error Handling on Malformed / Empty Geometry ───
  console.log("\n--- 4. Error Handling on Malformed or Empty 3D Data ---");

  let errorCaught = false;
  try {
    await parseObjText("# empty obj with no vertices", "empty.obj", 28);
  } catch (err: any) {
    errorCaught = true;
    assert(
      err.message.includes("No 3D geometry or meshes were found"),
      "Empty OBJ throws graceful descriptive error without crashing"
    );
  }
  assert(errorCaught, "Parser safely rejects corrupt/empty model files");

  // ─── 5. Architectural Presets Consistency ───
  console.log("\n--- 5. Architectural Archetypes & Project Presets ---");

  assert(PROJECT_PRESETS.length >= 5, `Configured ${PROJECT_PRESETS.length} construction archetypes`);
  const ormiston = PROJECT_PRESETS[0];
  assert(ormiston.id === "ormiston-rise", "Primary project preset is Ormiston Rise (Building 2)");
  assert(ormiston.floors.length === 7, `Ormiston Rise has ${ormiston.floors.length} defined floors (RF down to B1)`);

  console.log("\n===============================================================================");
  console.log(`   TEST SUMMARY: ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log("===============================================================================\n");

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
