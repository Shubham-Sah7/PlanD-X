import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

// ─── Supported 3D Model Formats & Limits ─────────────────────────────────────────
export type SupportedModelFormat = "glb" | "gltf" | "obj";

export interface ModelFormatValidation {
  valid: boolean;
  format?: SupportedModelFormat;
  error?: string;
  recommendation?: string;
}

export interface ModelBoundingBox {
  min: [number, number, number];
  max: [number, number, number];
  size: [number, number, number];
  center: [number, number, number];
}

export interface ImportedModelData {
  id: string;
  name: string;
  fileName: string;
  fileSize: number; // bytes
  fileType: SupportedModelFormat;
  meshCount: number;
  vertexCount: number;
  boundingBox: ModelBoundingBox;
  scene: THREE.Group;
  loadedAt: string;
  source: "user-upload" | "sample";
  // Data Integrity: explicit indication that raw geometry is not mapped to WBS tasks
  hasTaskMapping: boolean;
  notes: string;
}

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB reasonable browser WebGL limit

/**
 * Validates a 3D model file name and size before parsing.
 * Returns actionable feedback for unsupported construction formats (IFC, RVT, NWD).
 */
export function validateModelFile(fileName: string, fileSize?: number): ModelFormatValidation {
  if (!fileName || typeof fileName !== "string") {
    return { valid: false, error: "Please select a valid file." };
  }

  const extension = fileName.toLowerCase().split(".").pop() || "";

  if (fileSize !== undefined && fileSize > MAX_FILE_SIZE_BYTES) {
    const sizeMb = (fileSize / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${sizeMb} MB) exceeds browser WebGL limit of 50 MB.`,
      recommendation: "Please optimise the 3D geometry or reduce polygon count before importing.",
    };
  }

  if (extension === "glb") {
    return { valid: true, format: "glb" };
  }
  if (extension === "gltf") {
    return { valid: true, format: "gltf" };
  }
  if (extension === "obj") {
    return { valid: true, format: "obj" };
  }

  if (extension === "ifc") {
    return {
      valid: false,
      error: "IFC format (.ifc) is not supported for direct browser parsing.",
      recommendation:
        "IFC parsing requires a WebAssembly IFC parser (web-ifc) or server-side conversion pipeline. Please export your BIM model to GLB or OBJ from Revit/Archicad/Solibri before importing.",
    };
  }

  if (extension === "rvt" || extension === "rfa") {
    return {
      valid: false,
      error: "Autodesk Revit (.rvt) is a closed proprietary binary format.",
      recommendation:
        "Revit files cannot be parsed in browser WebGL without Autodesk Platform Services (APS/Forge) server translation. Please export your project to GLB or OBJ.",
    };
  }

  if (extension === "nwd" || extension === "nwc") {
    return {
      valid: false,
      error: "Navisworks (.nwd / .nwc) files cannot be read directly in the browser.",
      recommendation:
        "Export the coordinated model to GLTF/GLB or Wavefront OBJ before importing into PlanD-X.",
    };
  }

  if (extension === "dwg" || extension === "dxf") {
    return {
      valid: false,
      error: "AutoCAD CAD files (.dwg / .dxf) are 2D/3D drafting formats.",
      recommendation: "Please export solid 3D geometry to OBJ or GLTF for 3D Programme visualisation.",
    };
  }

  return {
    valid: false,
    error: `Unsupported format ('.${extension}').`,
    recommendation: "PlanD-X currently supports .glb, .gltf, and .obj 3D models.",
  };
}

/**
 * Calculates bounding box and centers the 3D model geometry.
 */
function processAndCenterModel(group: THREE.Group): {
  boundingBox: ModelBoundingBox;
  meshCount: number;
  vertexCount: number;
} {
  const box = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  // Center model at origin on X and Z, and place base on Y=0 ground plane
  group.position.x -= center.x;
  group.position.z -= center.z;
  group.position.y -= box.min.y;

  // Scale down if model is extraordinarily large (> 100m) or scale up if tiny (< 1m)
  const maxDim = Math.max(size.x, size.y, size.z);
  if (maxDim > 80) {
    const scale = 30 / maxDim;
    group.scale.set(scale, scale, scale);
  } else if (maxDim > 0 && maxDim < 1) {
    const scale = 15 / maxDim;
    group.scale.set(scale, scale, scale);
  }

  let meshCount = 0;
  let vertexCount = 0;

  group.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshCount++;
      const mesh = child as THREE.Mesh;
      mesh.castShadow = true;
      mesh.receiveShadow = true;

      if (mesh.geometry && mesh.geometry.attributes.position) {
        vertexCount += mesh.geometry.attributes.position.count;
      }

      // If mesh lacks material or uses basic default, assign clean architectural material
      if (
        !mesh.material ||
        (Array.isArray(mesh.material) && mesh.material.length === 0)
      ) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: "#94a3b8",
          roughness: 0.6,
          metalness: 0.1,
        });
      }
    }
  });

  return {
    boundingBox: {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      size: [size.x, size.y, size.z],
      center: [center.x, center.y, center.z],
    },
    meshCount,
    vertexCount,
  };
}

/**
 * Parses an OBJ file text into ImportedModelData.
 */
export async function parseObjText(
  text: string,
  fileName: string,
  fileSize: number,
  source: "user-upload" | "sample" = "user-upload"
): Promise<ImportedModelData> {
  const loader = new OBJLoader();
  const group = loader.parse(text);

  if (!group || group.children.length === 0) {
    throw new Error("No 3D geometry or meshes were found in this OBJ file.");
  }

  const { boundingBox, meshCount, vertexCount } = processAndCenterModel(group);

  return {
    id: `model-${Date.now()}`,
    name: fileName.replace(/\.[^/.]+$/, ""),
    fileName,
    fileSize,
    fileType: "obj",
    meshCount,
    vertexCount,
    boundingBox,
    scene: group,
    loadedAt: new Date().toISOString(),
    source,
    hasTaskMapping: false,
    notes: "Imported 3D structural model geometry. Raw geometry has no automated WBS task linkages.",
  };
}

/**
 * Parses a GLB / GLTF ArrayBuffer into ImportedModelData.
 */
export function parseGlbBuffer(
  arrayBuffer: ArrayBuffer,
  fileName: string,
  fileSize: number,
  source: "user-upload" | "sample" = "user-upload"
): Promise<ImportedModelData> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.parse(
      arrayBuffer,
      "",
      (gltf) => {
        try {
          const group = gltf.scene || new THREE.Group();
          if (group.children.length === 0) {
            reject(new Error("The GLTF/GLB file does not contain any scene objects."));
            return;
          }

          const { boundingBox, meshCount, vertexCount } = processAndCenterModel(group);

          resolve({
            id: `model-${Date.now()}`,
            name: fileName.replace(/\.[^/.]+$/, ""),
            fileName,
            fileSize,
            fileType: fileName.toLowerCase().endsWith(".glb") ? "glb" : "gltf",
            meshCount,
            vertexCount,
            boundingBox,
            scene: group,
            loadedAt: new Date().toISOString(),
            source,
            hasTaskMapping: false,
            notes: "Imported GLTF/GLB construction model. Raw geometry has no automated WBS task linkages.",
          });
        } catch (err: any) {
          reject(new Error(err?.message || "Failed to process GLTF geometry"));
        }
      },
      (error) => {
        reject(new Error(`Failed to parse GLTF model: ${error?.message || "Unknown error"}`));
      }
    );
  });
}

/**
 * Loads and parses a user-selected File from the browser file input.
 */
export async function loadModelFromFile(file: File): Promise<ImportedModelData> {
  const validation = validateModelFile(file.name, file.size);
  if (!validation.valid) {
    throw new Error(validation.error + (validation.recommendation ? ` ${validation.recommendation}` : ""));
  }

  const format = validation.format;
  if (format === "obj") {
    const text = await file.text();
    return parseObjText(text, file.name, file.size, "user-upload");
  }

  if (format === "glb" || format === "gltf") {
    const buffer = await file.arrayBuffer();
    return parseGlbBuffer(buffer, file.name, file.size, "user-upload");
  }

  throw new Error(`Unsupported model format: ${format}`);
}

/**
 * Loads the bundled sample structural frame OBJ model.
 */
export async function loadSampleStructuralModel(): Promise<ImportedModelData> {
  const res = await fetch("/models/sample-structural-frame.obj");
  if (!res.ok) {
    throw new Error(`Failed to load sample structural model (HTTP ${res.status})`);
  }
  const text = await res.text();
  return parseObjText(text, "Ormiston_Rise_Structural_Frame.obj", text.length, "sample");
}
