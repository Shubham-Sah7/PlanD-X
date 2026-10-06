"use client";

import React, { useRef, useEffect, useState, useMemo, Suspense, useCallback } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
  Edges,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  ModelElement,
  BuildingLevel,
  ElementFilter,
  ProjectModelPreset,
  FloorConfig,
  VisualizationMode,
  DisciplineType,
} from "./model-data";
import {
  MODEL_ELEMENTS,
  PROJECT_PRESETS,
  getElementsForLevel,
} from "./model-data";

// ─── Status & Programme Visualization Palette Resolver ─────────────────────────
function getElementStatusColors(
  element: ModelElement | undefined,
  isSelected: boolean,
  visMode: VisualizationMode = "status",
  defaultFallbackStatus: "complete" | "in-progress" | "not-started" | "blocked" = "not-started"
): { color: string; edgeColor: string; opacity: number } {
  if (isSelected) {
    return { color: "#1d4ed8", edgeColor: "#93c5fd", opacity: 1.0 };
  }

  const status = element?.status || defaultFallbackStatus;
  const isCritical = !!element?.isCritical;
  const variance = element?.varianceDays ?? (status === "complete" ? 0 : status === "blocked" ? -6 : 0);

  if (visMode === "critical-path") {
    if (isCritical) {
      return { color: "#dc2626", edgeColor: "#fca5a5", opacity: 1.0 };
    }
    return { color: "#e2e8f0", edgeColor: "#cbd5e1", opacity: 0.16 };
  }

  if (visMode === "upcoming") {
    if (element?.isDueThisWeek || element?.isUpcoming || status === "in-progress") {
      return { color: "#0284c7", edgeColor: "#38bdf8", opacity: 1.0 };
    }
    return { color: "#f1f5f9", edgeColor: "#cbd5e1", opacity: 0.16 };
  }

  if (visMode === "schedule") {
    if (variance < -2 || status === "blocked") {
      return { color: "#ef4444", edgeColor: "#b91c1c", opacity: 1.0 };
    }
    if (variance < 0) {
      return { color: "#f59e0b", edgeColor: "#d97706", opacity: 1.0 };
    }
    if (status === "complete" || variance >= 0) {
      return { color: "#10b981", edgeColor: "#047857", opacity: 1.0 };
    }
    return { color: "#e2e8f0", edgeColor: "#cbd5e1", opacity: 0.5 };
  }

  if (visMode === "progress") {
    const prog = element?.progress ?? (status === "complete" ? 100 : status === "in-progress" ? 60 : 0);
    if (prog >= 100) return { color: "#10b981", edgeColor: "#047857", opacity: 1.0 };
    if (prog >= 50) return { color: "#2563eb", edgeColor: "#1d4ed8", opacity: 1.0 };
    if (prog > 0) return { color: "#60a5fa", edgeColor: "#3b82f6", opacity: 1.0 };
    return { color: "#e2e8f0", edgeColor: "#cbd5e1", opacity: 0.6 };
  }

  if (visMode === "baseline") {
    if (variance < 0 || status === "blocked") {
      return { color: "#ef4444", edgeColor: "#b91c1c", opacity: 1.0 };
    }
    return { color: "#10b981", edgeColor: "#047857", opacity: 1.0 };
  }

  // Default: "status"
  if (status === "complete") {
    return { color: "#10b981", edgeColor: "#047857", opacity: 1.0 };
  }
  if (status === "blocked") {
    return { color: "#ef4444", edgeColor: "#b91c1c", opacity: 1.0 };
  }
  if (status === "in-progress") {
    return { color: "#2563eb", edgeColor: "#1d4ed8", opacity: 1.0 };
  }
  return { color: "#e2e8f0", edgeColor: "#94a3b8", opacity: 1.0 };
}

// ─── Building Dimensions ───────────────────────────────────────────────────────
const BUILDING_W = 12.0; // X dimension
const BUILDING_D = 8.0;  // Z dimension
const FLOOR_H    = 3.2;  // Floor-to-floor height
const SLAB_T     = 0.30; // Slab thickness
const COL_W      = 0.45; // Column cross-section width
const BEAM_H     = 0.45; // Beam depth
const BEAM_W     = 0.32; // Beam width
const CORE_W     = 3.0;  // Core width (X)
const CORE_D     = 2.6;  // Core depth (Z)
const CORE_X     = 3.0;  // Core position X
const CORE_Z     = -1.6; // Core position Z

// Column grid coordinates (4 x 3 = 12 columns)
const COL_X = [-5.2, -1.8, 1.8, 5.2];
const COL_Z = [-3.2, 0.0, 3.2];

// ─── 1. Tower Crane (Refined Architectural Steel Style, positioned in background) ──
function ConstructionCrane() {
  const craneX = -13.5;
  const craneZ = -9.0;
  const mastH = 30;
  const mastW = 1.35;

  const steelGrey = "#475569";
  const darkSteel = "#334155";
  const safetyAmber = "#d97706";

  return (
    <group position={[craneX, 0, craneZ]}>
      {/* Concrete Foundation Pad */}
      <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.2, 0.5, 3.2]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        <Edges color="#94a3b8" threshold={15} />
      </mesh>

      {/* Vertical Lattice Mast */}
      {[-mastW / 2, mastW / 2].map((mx) =>
        [-mastW / 2, mastW / 2].map((mz) => (
          <mesh key={`post-${mx}-${mz}`} position={[mx, mastH / 2, mz]} castShadow>
            <boxGeometry args={[0.08, mastH, 0.08]} />
            <meshStandardMaterial color={steelGrey} roughness={0.5} metalness={0.4} />
          </mesh>
        ))
      )}

      {/* Horizontal & Diagonal lattice bracing */}
      {Array.from({ length: 14 }).map((_, i) => {
        const y = 1.0 + i * 2.1;
        return (
          <group key={`brace-${i}`} position={[0, y, 0]}>
            <mesh position={[0, 0, mastW / 2]}>
              <boxGeometry args={[mastW, 0.05, 0.05]} />
              <meshStandardMaterial color={steelGrey} metalness={0.3} />
            </mesh>
            <mesh position={[0, 0, -mastW / 2]}>
              <boxGeometry args={[mastW, 0.05, 0.05]} />
              <meshStandardMaterial color={steelGrey} metalness={0.3} />
            </mesh>
            <mesh position={[mastW / 2, 0, 0]}>
              <boxGeometry args={[0.05, 0.05, mastW]} />
              <meshStandardMaterial color={steelGrey} metalness={0.3} />
            </mesh>
            <mesh position={[-mastW / 2, 0, 0]}>
              <boxGeometry args={[0.05, 0.05, mastW]} />
              <meshStandardMaterial color={steelGrey} metalness={0.3} />
            </mesh>
            <mesh position={[0, 1.05, mastW / 2]} rotation={[0, 0, 0.52]}>
              <boxGeometry args={[mastW * 1.5, 0.04, 0.04]} />
              <meshStandardMaterial color={darkSteel} />
            </mesh>
            <mesh position={[0, 1.05, -mastW / 2]} rotation={[0, 0, -0.52]}>
              <boxGeometry args={[mastW * 1.5, 0.04, 0.04]} />
              <meshStandardMaterial color={darkSteel} />
            </mesh>
          </group>
        );
      })}

      {/* Slewing Platform */}
      <mesh position={[0, mastH + 0.25, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 0.45, 16]} />
        <meshStandardMaterial color={darkSteel} metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Operator Cabin */}
      <group position={[1.0, mastH + 1.2, 0.5]}>
        <mesh castShadow>
          <boxGeometry args={[1.1, 1.7, 1.3]} />
          <meshStandardMaterial color={steelGrey} roughness={0.5} />
          <Edges color="#1e293b" threshold={15} />
        </mesh>
        <mesh position={[0.56, 0.2, 0]}>
          <planeGeometry args={[1.2, 0.85]} />
          <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.9} />
        </mesh>
      </group>

      {/* Cathead Apex Tower */}
      <group position={[0, mastH + 0.5, 0]}>
        <mesh position={[0, 2.5, 0]}>
          <coneGeometry args={[0.8, 5.0, 4]} />
          <meshStandardMaterial color={steelGrey} roughness={0.6} />
        </mesh>

        {/* Main Working Jib */}
        <group position={[11.0, 0.75, 0]}>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[22, 0.07, 0.07]} />
            <meshStandardMaterial color={steelGrey} />
          </mesh>
          <mesh position={[0, -0.35, 0.45]} castShadow>
            <boxGeometry args={[22, 0.07, 0.07]} />
            <meshStandardMaterial color={steelGrey} />
          </mesh>
          <mesh position={[0, -0.35, -0.45]} castShadow>
            <boxGeometry args={[22, 0.07, 0.07]} />
            <meshStandardMaterial color={steelGrey} />
          </mesh>
          {Array.from({ length: 12 }).map((_, j) => (
            <mesh key={`jib-tie-${j}`} position={[-10.0 + j * 1.8, 0, 0]}>
              <boxGeometry args={[0.04, 0.8, 0.9]} />
              <meshStandardMaterial color={darkSteel} />
            </mesh>
          ))}
        </group>

        {/* Trolley & Hoist Hook */}
        <group position={[7.5, 0.35, 0]}>
          <mesh position={[0, -0.12, 0]}>
            <boxGeometry args={[0.7, 0.2, 0.8]} />
            <meshStandardMaterial color={safetyAmber} />
          </mesh>
          <mesh position={[0, -7.0, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 13.5, 4]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
          <group position={[0, -13.8, 0]}>
            <mesh>
              <boxGeometry args={[0.35, 0.5, 0.3]} />
              <meshStandardMaterial color={safetyAmber} />
            </mesh>
            <mesh position={[0, -0.38, 0]}>
              <torusGeometry args={[0.15, 0.035, 8, 16, Math.PI * 1.3]} />
              <meshStandardMaterial color="#1e293b" metalness={0.9} />
            </mesh>
          </group>
        </group>

        {/* Counter-Jib */}
        <group position={[-4.2, 0.75, 0]}>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[8.4, 0.65, 1.0]} />
            <meshStandardMaterial color={steelGrey} />
          </mesh>
          {/* Concrete Counterweight Ballast */}
          <group position={[-2.8, -0.1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[2.0, 1.3, 1.3]} />
              <meshStandardMaterial color="#64748b" roughness={0.9} />
              <Edges color="#475569" threshold={15} />
            </mesh>
          </group>
        </group>

        {/* Tension Stay Cables */}
        <mesh position={[5.2, 3.1, 0]} rotation={[0, 0, -0.44]}>
          <cylinderGeometry args={[0.018, 0.018, 11.5, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        <mesh position={[-3.2, 3.1, 0]} rotation={[0, 0, 0.62]}>
          <cylinderGeometry args={[0.018, 0.018, 7.8, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 2. Clean Site Surroundings & BIM Coordinate Grid ─────────────────────────
function SiteSurroundings({ hasCrane = true }: { hasCrane?: boolean }) {
  return (
    <group>
      {hasCrane && <ConstructionCrane />}
      {/* Neutral Site Ground Plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[140, 120]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.96} />
      </mesh>

      {/* BIM Structural Coordinate Grid (clean 2m grid lines) */}
      <gridHelper args={[40, 20, "#cbd5e1", "#e2e8f0"]} position={[0, 0.002, 0]} />

      {/* Clean Survey / Boundary Markers at Site Corners */}
      {[
        [-10.8, 7.5],
        [11.2, 7.5],
        [-10.8, -8.5],
        [11.2, -8.5],
      ].map(([x, z], idx) => (
        <group key={`corner-mark-${idx}`} position={[x, 0.01, z]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.22, 16]} />
            <meshBasicMaterial color="#94a3b8" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.07, 16]} />
            <meshBasicMaterial color="#0066ff" />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── 3. Floor Slab Component (Crisp BIM Slabs with Level Status Color) ─────────
// ─── 3. Floor Slab Component (Crisp BIM Slabs with Level Status Color) ─────────
function SlabMesh({
  elevation,
  level,
  isSelected,
  isLevelActive,
  isAnyLevelActive,
  visMode = "status",
  element,
  onClick,
  onDoubleClick,
}: {
  elevation: number;
  level: BuildingLevel;
  isSelected: boolean;
  isLevelActive: boolean;
  isAnyLevelActive: boolean;
  visMode?: VisualizationMode;
  element?: ModelElement;
  onClick: (e: any) => void;
  onDoubleClick?: (e: any) => void;
}) {
  const isComplete = level === "Level 1" || level === "Ground" || level === "Basement 1";
  const defaultStatus = isComplete ? "complete" : "not-started";
  const { color: baseColor, edgeColor: baseEdgeColor } = getElementStatusColors(element, isSelected, visMode, defaultStatus);

  // If level is not active, render in calm, clean architectural neutral grey
  const color = !isLevelActive ? (isComplete ? "#a7f3d0" : "#f1f5f9") : baseColor;
  const edgeColor = !isLevelActive ? (isComplete ? "#6ee7b7" : "#cbd5e1") : isSelected ? "#ffffff" : baseEdgeColor;
  const opacity = 1.0;

  return (
    <mesh
      position={[0, elevation + SLAB_T / 2, 0]}
      receiveShadow
      castShadow
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <boxGeometry args={[BUILDING_W, SLAB_T, BUILDING_D]} />
      <meshStandardMaterial
        color={color}
        roughness={0.62}
        metalness={0.05}
        emissive={isSelected ? "#0066ff" : "#000000"}
        emissiveIntensity={isSelected ? 0.2 : 0}
      />
      <Edges color={edgeColor} threshold={15} />
    </mesh>
  );
}

// ─── 4. Floor Columns Component (Highlighted Level 2 Columns) ─────────────────
function ColumnsMesh({
  floorBaseElevation,
  floorHeight = FLOOR_H,
  level,
  isSelected,
  isLevelActive,
  isAnyLevelActive,
  selectedZone = "all",
  visMode = "status",
  element,
  onClick,
  onDoubleClick,
}: {
  floorBaseElevation: number;
  floorHeight?: number;
  level: BuildingLevel;
  isSelected: boolean;
  isLevelActive: boolean;
  isAnyLevelActive: boolean;
  selectedZone?: string;
  visMode?: VisualizationMode;
  element?: ModelElement;
  onClick: (e: any) => void;
  onDoubleClick?: (e: any) => void;
}) {
  const colH = floorHeight - SLAB_T;
  const colY = floorBaseElevation + SLAB_T + colH / 2;
  const isLevel4 = level === "Level 4";
  const isLevel2 = level === "Level 2";
  const defaultStatus = (level === "Level 1" || level === "Ground" || level === "Basement 1") ? "complete" : isLevel2 ? "in-progress" : "not-started";

  const { color: baseColColor, edgeColor: baseEdgeColor } = getElementStatusColors(element, isSelected, visMode, defaultStatus);

  const colColor = isSelected
    ? "#0066ff"
    : !isLevelActive
    ? "#f1f5f9"
    : isLevel2
    ? "#0066ff"
    : baseColColor;

  const edgeColor = isSelected
    ? "#ffffff"
    : !isLevelActive
    ? "#cbd5e1"
    : isLevel2
    ? "#0052cc"
    : baseEdgeColor;

  const scaleVal = isSelected ? 1.05 : 1.0;

  return (
    <group
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      scale={[scaleVal, isSelected ? 1.02 : 1.0, scaleVal]}
      position={[0, isSelected ? 0.04 : 0, 0]}
    >
      {COL_X.map((cx) =>
        COL_Z.map((cz) => {
          // Skip columns inside core
          if (Math.abs(cx - CORE_X) < 1.2 && Math.abs(cz - CORE_Z) < 1.2) return null;

          return (
            <group key={`col-${cx}-${cz}`}>
              <mesh
                position={[cx, colY, cz]}
                castShadow
                receiveShadow
              >
                <boxGeometry args={[COL_W, colH, COL_W]} />
                <meshStandardMaterial
                  color={colColor}
                  roughness={0.48}
                  metalness={0.08}
                  emissive={isSelected ? "#0066ff" : "#000000"}
                  emissiveIntensity={isSelected ? 0.32 : 0}
                />
                <Edges color={edgeColor} threshold={15} />
              </mesh>
              {isLevel4 && (
                <group position={[cx, colY + colH / 2 + 0.45, cz]}>
                  {[-0.1, 0.1].map((rx) =>
                    [-0.1, 0.1].map((rz) => (
                      <mesh key={`rebar-${rx}-${rz}`} position={[rx, 0, rz]}>
                        <cylinderGeometry args={[0.015, 0.015, 0.85, 6]} />
                        <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.8} />
                      </mesh>
                    ))
                  )}
                </group>
              )}
            </group>
          );
        })
      )}
    </group>
  );
}

// ─── 5. Floor Beams Component ─────────────────────────────────────────────────
function BeamsMesh({
  floorBaseElevation,
  floorHeight = FLOOR_H,
  isSelected,
  isLevelActive,
  isAnyLevelActive,
  visMode = "status",
  element,
  onClick,
}: {
  floorBaseElevation: number;
  floorHeight?: number;
  isSelected: boolean;
  isLevelActive: boolean;
  isAnyLevelActive: boolean;
  visMode?: VisualizationMode;
  element?: ModelElement;
  onClick: (e: any) => void;
}) {
  const beamY = floorBaseElevation + floorHeight - BEAM_H / 2;
  const color = !isLevelActive ? "#f1f5f9" : isSelected ? "#0066ff" : "#e2e8f0";
  const edgeColor = !isLevelActive ? "#cbd5e1" : isSelected ? "#ffffff" : "#94a3b8";

  return (
    <group onClick={onClick}>
      <mesh position={[0, beamY, -BUILDING_D / 2 + BEAM_W / 2]} castShadow>
        <boxGeometry args={[BUILDING_W, BEAM_H, BEAM_W]} />
        <meshStandardMaterial color={color} roughness={0.7} />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      <mesh position={[0, beamY, BUILDING_D / 2 - BEAM_W / 2]} castShadow>
        <boxGeometry args={[BUILDING_W, BEAM_H, BEAM_W]} />
        <meshStandardMaterial color={color} roughness={0.7} />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      <mesh position={[-BUILDING_W / 2 + BEAM_W / 2, beamY, 0]} castShadow>
        <boxGeometry args={[BEAM_W, BEAM_H, BUILDING_D]} />
        <meshStandardMaterial color={color} roughness={0.7} />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - BEAM_W / 2, beamY, 0]} castShadow>
        <boxGeometry args={[BEAM_W, BEAM_H, BUILDING_D]} />
        <meshStandardMaterial color={color} roughness={0.7} />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
    </group>
  );
}

// ─── 6. Floor Core Wall Component (Level 2 Blocked Red) ───────────────────────
function CoreMesh({
  floorBaseElevation,
  floorHeight = FLOOR_H,
  level,
  isSelected,
  isLevelActive,
  isAnyLevelActive,
  selectedZone = "all",
  visMode = "status",
  element,
  onClick,
  onDoubleClick,
}: {
  floorBaseElevation: number;
  floorHeight?: number;
  level: BuildingLevel;
  isSelected: boolean;
  isLevelActive: boolean;
  isAnyLevelActive: boolean;
  selectedZone?: string;
  visMode?: VisualizationMode;
  element?: ModelElement;
  onClick: (e: any) => void;
  onDoubleClick?: (e: any) => void;
}) {
  const coreH = floorHeight - SLAB_T;
  const coreY = floorBaseElevation + SLAB_T + coreH / 2;
  const isLevel2 = level === "Level 2";

  const color = isSelected
    ? "#ef4444"
    : !isLevelActive
    ? "#f1f5f9"
    : isLevel2
    ? "#ef4444"
    : "#e2e8f0";

  const edgeColor = isSelected
    ? "#ffffff"
    : !isLevelActive
    ? "#cbd5e1"
    : isLevel2
    ? "#b91c1c"
    : "#94a3b8";

  return (
    <group
      position={[CORE_X, coreY, CORE_Z]}
      scale={isSelected ? [1.03, 1.02, 1.03] : [1, 1, 1]}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
    >
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CORE_W, coreH, CORE_D]} />
        <meshStandardMaterial
          color={color}
          roughness={0.58}
          metalness={0.06}
          emissive={isSelected || (isLevelActive && isLevel2) ? "#ef4444" : "#000000"}
          emissiveIntensity={isSelected ? 0.3 : (isLevelActive && isLevel2) ? 0.08 : 0}
        />
        <Edges color={edgeColor} threshold={15} />
      </mesh>
      {/* Elevator Door Cutout Opening */}
      <mesh position={[-CORE_W / 2 - 0.01, -0.2, 0]}>
        <boxGeometry args={[0.04, 2.1, 1.2]} />
        <meshStandardMaterial color="#334155" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── 7. Precast Concrete Stairs (Active Level Only to Prevent Visual Clutter) ─
function RealisticStairs({
  floorBaseElevation,
  isLevelActive,
}: {
  floorBaseElevation: number;
  isLevelActive: boolean;
  isAnyLevelActive?: boolean;
}) {
  if (!isLevelActive) return null;

  const steps = 10;
  const totalH = FLOOR_H - SLAB_T;
  const stepH = totalH / steps;
  const stepD = 0.26;
  const stairW = 1.15;
  const startX = 1.2;
  const startZ = 2.4;
  const startY = floorBaseElevation + SLAB_T;

  return (
    <group position={[startX, startY, startZ]} rotation={[0, -Math.PI / 2, 0]}>
      {Array.from({ length: steps }).map((_, i) => (
        <mesh
          key={i}
          position={[0, i * stepH + stepH / 2, -i * stepD - stepD / 2]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[stairW, stepH, stepD]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.8} />
          <Edges color="#94a3b8" threshold={15} />
        </mesh>
      ))}
      <mesh
        position={[stairW / 2 - 0.04, totalH / 2 + 0.45, -(steps * stepD) / 2]}
        rotation={[Math.atan2(totalH, steps * stepD), 0, 0]}
      >
        <cylinderGeometry args={[0.02, 0.02, Math.hypot(totalH, steps * stepD), 8]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.45} />
      </mesh>
    </group>
  );
}

// ─── 8. Architectural Perimeter Edge Protection (Active Floor Only) ───────────
function EdgeRailingsMesh({ floorBaseElevation }: { floorBaseElevation: number }) {
  const y = floorBaseElevation + SLAB_T;
  const railH = 0.95;
  const postColor = "#64748b";
  const amberColor = "#f59e0b";

  return (
    <group position={[0, y, 0]}>
      {/* Front Edge */}
      <mesh position={[0, railH, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.035, 0.035]} />
        <meshStandardMaterial color={amberColor} roughness={0.4} />
      </mesh>
      <mesh position={[0, railH * 0.5, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.02, 0.02]} />
        <meshStandardMaterial color={postColor} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.07, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.14, 0.025]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4].map((x) => (
        <mesh key={`post-f-${x}`} position={[x, railH / 2, BUILDING_D / 2 - 0.05]}>
          <boxGeometry args={[0.03, railH, 0.03]} />
          <meshStandardMaterial color={postColor} roughness={0.5} />
        </mesh>
      ))}

      {/* Right Edge */}
      <mesh position={[BUILDING_W / 2 - 0.05, railH, 0]}>
        <boxGeometry args={[0.035, 0.035, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={amberColor} roughness={0.4} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - 0.05, railH * 0.5, 0]}>
        <boxGeometry args={[0.02, 0.02, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={postColor} roughness={0.5} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - 0.05, 0.07, 0]}>
        <boxGeometry args={[0.025, 0.14, BUILDING_D - 0.2]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-3.4, -1.7, 0, 1.7, 3.4].map((z) => (
        <mesh key={`post-r-${z}`} position={[BUILDING_W / 2 - 0.05, railH / 2, z]}>
          <boxGeometry args={[0.03, railH, 0.03]} />
          <meshStandardMaterial color={postColor} roughness={0.5} />
        </mesh>
      ))}

      {/* Left Edge */}
      <mesh position={[-BUILDING_W / 2 + 0.05, railH, 0]}>
        <boxGeometry args={[0.035, 0.035, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={amberColor} roughness={0.4} />
      </mesh>
      <mesh position={[-BUILDING_W / 2 + 0.05, railH * 0.5, 0]}>
        <boxGeometry args={[0.02, 0.02, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={postColor} roughness={0.5} />
      </mesh>
      <mesh position={[-BUILDING_W / 2 + 0.05, 0.07, 0]}>
        <boxGeometry args={[0.025, 0.14, BUILDING_D - 0.2]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-3.4, -1.7, 0, 1.7, 3.4].map((z) => (
        <mesh key={`post-l-${z}`} position={[-BUILDING_W / 2 + 0.05, railH / 2, z]}>
          <boxGeometry args={[0.03, railH, 0.03]} />
          <meshStandardMaterial color={postColor} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

// ─── 9. Roof Assembly ─────────────────────────────────────────────────────────
function RoofAssembly({
  elevation,
  isSectioned,
  isLevelActive,
  isAnyLevelActive,
}: {
  elevation: number;
  isSectioned: boolean;
  isLevelActive: boolean;
  isAnyLevelActive: boolean;
}) {
  if (isSectioned) return null;
  const opacity = isAnyLevelActive && !isLevelActive ? 0.20 : 1.0;
  const transparent = opacity < 1.0;

  return (
    <group position={[0, elevation, 0]}>
      {/* Roof slab */}
      <mesh position={[0, SLAB_T / 2, 0]} castShadow={!transparent} receiveShadow>
        <boxGeometry args={[BUILDING_W + 0.1, SLAB_T, BUILDING_D + 0.1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} transparent={transparent} opacity={opacity} />
        <Edges color={transparent ? "#cbd5e1" : "#94a3b8"} threshold={15} />
      </mesh>

      {/* Perimeter Railings */}
      <EdgeRailingsMesh floorBaseElevation={0} />

      {/* Column stubs extending up with steel rebar dowels */}
      {COL_X.map((cx) =>
        COL_Z.map((cz) => {
          if (Math.abs(cx - CORE_X) < 1.4 && Math.abs(cz - CORE_Z) < 1.4) return null;
          return (
            <group key={`roof-col-${cx}-${cz}`} position={[cx, SLAB_T, cz]}>
              <mesh position={[0, 0.6, 0]} castShadow={!transparent} receiveShadow>
                <boxGeometry args={[COL_W, 1.2, COL_W]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.6} transparent={transparent} opacity={opacity} />
                <Edges color={transparent ? "#cbd5e1" : "#94a3b8"} threshold={15} />
              </mesh>
              {[-0.12, 0.12].map((rx) =>
                [-0.12, 0.12].map((rz) => (
                  <mesh key={`rebar-${rx}-${rz}`} position={[rx, 1.5, rz]}>
                    <cylinderGeometry args={[0.015, 0.015, 0.75, 6]} />
                    <meshStandardMaterial color="#475569" roughness={0.5} metalness={0.8} />
                  </mesh>
                ))
              )}
            </group>
          );
        })
      )}

      {/* Lift overrun / mechanical penthouse tower */}
      <group position={[CORE_X, SLAB_T, CORE_Z]}>
        <mesh position={[0, 1.7, 0]} castShadow={!transparent} receiveShadow>
          <boxGeometry args={[CORE_W + 0.2, 3.4, CORE_D + 0.2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} transparent={transparent} opacity={opacity} />
          <Edges color={transparent ? "#cbd5e1" : "#64748b"} threshold={15} />
        </mesh>
        <mesh position={[0, 3.45, 0]} castShadow={!transparent}>
          <boxGeometry args={[CORE_W + 0.4, 0.15, CORE_D + 0.4]} />
          <meshStandardMaterial color="#64748b" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 10. Floor Assembly ───────────────────────────────────────────────────────
function FloorAssembly({
  floor,
  floorIndex,
  elements,
  selectedElementId,
  selectedLevel,
  selectedLevels = [],
  selectedZone = "all",
  selectedDiscipline = "all",
  visMode = "status",
  sectionMode,
  activeLevelIndex,
  onElementClick,
  onElementDoubleClick,
}: {
  floor: FloorConfig;
  floorIndex: number;
  elements: ModelElement[];
  selectedElementId: string | null;
  selectedLevel: string | null;
  selectedLevels?: string[];
  selectedZone?: string;
  selectedDiscipline?: DisciplineType;
  visMode?: VisualizationMode;
  sectionMode: boolean;
  activeLevelIndex: number;
  onElementClick: (el: ModelElement) => void;
  onElementDoubleClick?: (el: ModelElement) => void;
}) {
  if (sectionMode && floorIndex > activeLevelIndex) {
    return null;
  }

  const baseElevation = floor.elevation;
  const isLevelActive = selectedLevels.length > 0 ? selectedLevels.includes(floor.id) : selectedLevel === floor.id;
  const isAnyLevelActive = selectedLevels.length > 0 || selectedLevel !== null;

  const slabEl = elements.find((e) => e.elementType === "slab");
  const colEl  = elements.find((e) => e.elementType === "columns");
  const beamEl = elements.find((e) => e.elementType === "beams");
  const coreEl = elements.find((e) => e.elementType === "core");

  const showStructure = selectedDiscipline === "all" || selectedDiscipline === "Structure";

  return (
    <group>
      {/* 1. Concrete Slab */}
      {slabEl && showStructure && (
        <SlabMesh
          elevation={baseElevation}
          level={floor.id}
          isSelected={selectedElementId === slabEl.id}
          isLevelActive={isLevelActive}
          isAnyLevelActive={isAnyLevelActive}
          visMode={visMode}
          element={slabEl}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(slabEl);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onElementDoubleClick?.(slabEl);
          }}
        />
      )}

      {/* Basement Retaining Walls */}
      {floor.isBasement && (
        <group position={[0, baseElevation + SLAB_T + floor.height / 2, 0]}>
          <mesh position={[0, 0, -BUILDING_D / 2]}>
            <boxGeometry args={[BUILDING_W, floor.height, 0.4]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
            <Edges color="#334155" threshold={15} />
          </mesh>
          <mesh position={[0, 0, BUILDING_D / 2]}>
            <boxGeometry args={[BUILDING_W, floor.height, 0.4]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
            <Edges color="#334155" threshold={15} />
          </mesh>
          <mesh position={[-BUILDING_W / 2, 0, 0]}>
            <boxGeometry args={[0.4, floor.height, BUILDING_D]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
            <Edges color="#334155" threshold={15} />
          </mesh>
          <mesh position={[BUILDING_W / 2, 0, 0]}>
            <boxGeometry args={[0.4, floor.height, BUILDING_D]} />
            <meshStandardMaterial color="#475569" roughness={0.9} />
            <Edges color="#334155" threshold={15} />
          </mesh>
        </group>
      )}

      {/* 2. Concrete Columns */}
      {colEl && showStructure && (
        <ColumnsMesh
          floorBaseElevation={baseElevation}
          floorHeight={floor.height}
          level={floor.id}
          isSelected={selectedElementId === colEl.id}
          isLevelActive={isLevelActive}
          isAnyLevelActive={isAnyLevelActive}
          selectedZone={selectedZone}
          visMode={visMode}
          element={colEl}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(colEl);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onElementDoubleClick?.(colEl);
          }}
        />
      )}

      {/* 3. Concrete Beams */}
      {beamEl && showStructure && (
        <BeamsMesh
          floorBaseElevation={baseElevation}
          floorHeight={floor.height}
          isSelected={selectedElementId === beamEl.id}
          isLevelActive={isLevelActive}
          isAnyLevelActive={isAnyLevelActive}
          visMode={visMode}
          element={beamEl}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(beamEl);
          }}
        />
      )}

      {/* 4. Core Wall */}
      {coreEl && showStructure && (
        <CoreMesh
          floorBaseElevation={baseElevation}
          floorHeight={floor.height}
          level={floor.id}
          isSelected={selectedElementId === coreEl.id}
          isLevelActive={isLevelActive}
          isAnyLevelActive={isAnyLevelActive}
          selectedZone={selectedZone}
          visMode={visMode}
          element={coreEl}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(coreEl);
          }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onElementDoubleClick?.(coreEl);
          }}
        />
      )}

      {/* 5. Concrete Stairs */}
      {!floor.isBasement && (
        <RealisticStairs
          floorBaseElevation={baseElevation}
          isLevelActive={isLevelActive}
          isAnyLevelActive={isAnyLevelActive}
        />
      )}

      {/* 6. Edge Railings on Active Floor */}
      {isLevelActive && !floor.isBasement && <EdgeRailingsMesh floorBaseElevation={baseElevation} />}
    </group>
  );
}

// ─── 11. Section Cut Plane Overlay ────────────────────────────────────────────
function SectionCutPlane({
  activeLevelIndex,
  visible,
}: {
  activeLevelIndex: number;
  visible: boolean;
}) {
  if (!visible) return null;
  const cutY = (activeLevelIndex + 1) * FLOOR_H;

  return (
    <group position={[0, cutY, 0]}>
      {/* Semi-transparent section slice plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BUILDING_W + 1.2, BUILDING_D + 1.2]} />
        <meshBasicMaterial color="#2563eb" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      {/* Crisp Section Boundary */}
      <lineSegments rotation={[-Math.PI / 2, 0, 0]}>
        <edgesGeometry args={[new THREE.PlaneGeometry(BUILDING_W + 1.2, BUILDING_D + 1.2)]} />
        <lineBasicMaterial color="#2563eb" linewidth={2} />
      </lineSegments>
    </group>
  );
}

// ─── 12. Dynamic Screen-Space Projector ────────────────────────────────────────
function DynamicCalloutProjector({
  colCardRef,
  slabCardRef,
  coreCardRef,
  colLineRef,
  colOuterRingRef,
  colInnerDotRef,
  colGroupRef,
  slabLineRef,
  slabOuterRingRef,
  slabInnerDotRef,
  slabGroupRef,
  coreLineRef,
  coreOuterRingRef,
  coreInnerDotRef,
  coreGroupRef,
  showCallouts,
  selectedElementId,
  hoveredCard,
  sectionMode,
  selectedLevel,
}: {
  colCardRef: React.RefObject<HTMLDivElement | null>;
  slabCardRef: React.RefObject<HTMLDivElement | null>;
  coreCardRef: React.RefObject<HTMLDivElement | null>;
  colLineRef: React.RefObject<SVGLineElement | null>;
  colOuterRingRef: React.RefObject<SVGCircleElement | null>;
  colInnerDotRef: React.RefObject<SVGCircleElement | null>;
  colGroupRef: React.RefObject<SVGGElement | null>;
  slabLineRef: React.RefObject<SVGLineElement | null>;
  slabOuterRingRef: React.RefObject<SVGCircleElement | null>;
  slabInnerDotRef: React.RefObject<SVGCircleElement | null>;
  slabGroupRef: React.RefObject<SVGGElement | null>;
  coreLineRef: React.RefObject<SVGLineElement | null>;
  coreOuterRingRef: React.RefObject<SVGCircleElement | null>;
  coreInnerDotRef: React.RefObject<SVGCircleElement | null>;
  coreGroupRef: React.RefObject<SVGGElement | null>;
  showCallouts: boolean;
  selectedElementId: string | null;
  hoveredCard: string | null;
  sectionMode?: boolean;
  selectedLevel?: BuildingLevel;
}) {
  const { camera, size } = useThree();
  const tempV = useMemo(() => new THREE.Vector3(), []);

  // Precise 3D Anchor positions:
  const vecCol = useMemo(() => new THREE.Vector3(-1.8, 2 * FLOOR_H + 1.8, 3.2), []);
  const vecSlab = useMemo(() => new THREE.Vector3(-BUILDING_W / 2 + 0.4, 1 * FLOOR_H + SLAB_T + 0.05, BUILDING_D / 2 - 0.2), []);
  const vecCore = useMemo(() => new THREE.Vector3(CORE_X + CORE_W / 2 + 0.05, 2 * FLOOR_H + 1.6, CORE_Z), []);

  useFrame(() => {
    if (!showCallouts) {
      if (colCardRef.current) colCardRef.current.style.display = "none";
      if (slabCardRef.current) slabCardRef.current.style.display = "none";
      if (coreCardRef.current) coreCardRef.current.style.display = "none";
      if (colGroupRef.current) colGroupRef.current.style.display = "none";
      if (slabGroupRef.current) slabGroupRef.current.style.display = "none";
      if (coreGroupRef.current) coreGroupRef.current.style.display = "none";
      return;
    }

    const activeLevelIndex = ["Ground", "Level 1", "Level 2", "Level 3", "Level 4", "Roof"].indexOf(selectedLevel || "Level 2");
    const isColSliced = !!sectionMode && activeLevelIndex < 2;
    const isCoreSliced = !!sectionMode && activeLevelIndex < 2;
    const isSlabSliced = !!sectionMode && activeLevelIndex < 1;

    // ─── 1. Columns Callout ──────────────────────────
    tempV.copy(vecCol).project(camera);
    if (tempV.z > 1 || isColSliced) {
      if (colCardRef.current) colCardRef.current.style.display = "none";
      if (colGroupRef.current) colGroupRef.current.style.display = "none";
    } else {
      const cx = ((tempV.x + 1) * size.width) / 2;
      const cy = ((-tempV.y + 1) * size.height) / 2;

      const isColSelected = selectedElementId === "PRG-021";
      const isColHovered = hoveredCard === "columns";

      // Selected: placed to the right of columns so model is completely visible
      // Normal: compact pin directly at anchor point
      const cardX = isColSelected ? cx + 75 : isColHovered ? cx + 18 : cx + 14;
      const cardY = isColSelected ? cy - 70 : cy - 14;

      if (colCardRef.current) {
        colCardRef.current.style.display = "block";
        colCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = isColSelected ? cardX : cx;
      const lineStartY = isColSelected ? cardY + 28 : cy;

      if (colGroupRef.current) colGroupRef.current.style.display = isColSelected ? "block" : "none";
      if (colLineRef.current) {
        colLineRef.current.setAttribute("x1", String(lineStartX));
        colLineRef.current.setAttribute("y1", String(lineStartY));
        colLineRef.current.setAttribute("x2", String(cx));
        colLineRef.current.setAttribute("y2", String(cy));
      }
      if (colOuterRingRef.current) {
        colOuterRingRef.current.setAttribute("cx", String(cx));
        colOuterRingRef.current.setAttribute("cy", String(cy));
      }
      if (colInnerDotRef.current) {
        colInnerDotRef.current.setAttribute("cx", String(cx));
        colInnerDotRef.current.setAttribute("cy", String(cy));
      }
    }

    // ─── 2. Slab Callout ─────────────────────────────
    tempV.copy(vecSlab).project(camera);
    if (tempV.z > 1 || isSlabSliced) {
      if (slabCardRef.current) slabCardRef.current.style.display = "none";
      if (slabGroupRef.current) slabGroupRef.current.style.display = "none";
    } else {
      const sx = ((tempV.x + 1) * size.width) / 2;
      const sy = ((-tempV.y + 1) * size.height) / 2;

      const isSlabSelected = selectedElementId === "PRG-010";
      const isSlabHovered = hoveredCard === "slab";

      const cardX = isSlabSelected ? sx - 180 : isSlabHovered ? sx - 130 : sx - 90;
      const cardY = isSlabSelected ? sy - 35 : sy - 14;

      if (slabCardRef.current) {
        slabCardRef.current.style.display = "block";
        slabCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = isSlabSelected ? cardX + 160 : sx;
      const lineStartY = isSlabSelected ? cardY + 24 : sy;

      if (slabGroupRef.current) slabGroupRef.current.style.display = isSlabSelected ? "block" : "none";
      if (slabLineRef.current) {
        slabLineRef.current.setAttribute("x1", String(lineStartX));
        slabLineRef.current.setAttribute("y1", String(lineStartY));
        slabLineRef.current.setAttribute("x2", String(sx));
        slabLineRef.current.setAttribute("y2", String(sy));
      }
      if (slabOuterRingRef.current) {
        slabOuterRingRef.current.setAttribute("cx", String(sx));
        slabOuterRingRef.current.setAttribute("cy", String(sy));
      }
      if (slabInnerDotRef.current) {
        slabInnerDotRef.current.setAttribute("cx", String(sx));
        slabInnerDotRef.current.setAttribute("cy", String(sy));
      }
    }

    // ─── 3. Core Wall Callout ──────────────────────────
    tempV.copy(vecCore).project(camera);
    if (tempV.z > 1 || isCoreSliced) {
      if (coreCardRef.current) coreCardRef.current.style.display = "none";
      if (coreGroupRef.current) coreGroupRef.current.style.display = "none";
    } else {
      const rx = ((tempV.x + 1) * size.width) / 2;
      const ry = ((-tempV.y + 1) * size.height) / 2;

      const isCoreSelected = selectedElementId === "PRG-022";
      const isCoreHovered = hoveredCard === "core";

      const cardX = isCoreSelected ? rx + 65 : isCoreHovered ? rx + 18 : rx + 14;
      const cardY = isCoreSelected ? ry - 50 : ry - 14;

      if (coreCardRef.current) {
        coreCardRef.current.style.display = "block";
        coreCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = isCoreSelected ? cardX : rx;
      const lineStartY = isCoreSelected ? cardY + 24 : ry;

      if (coreGroupRef.current) coreGroupRef.current.style.display = isCoreSelected ? "block" : "none";
      if (coreLineRef.current) {
        coreLineRef.current.setAttribute("x1", String(lineStartX));
        coreLineRef.current.setAttribute("y1", String(lineStartY));
        coreLineRef.current.setAttribute("x2", String(rx));
        coreLineRef.current.setAttribute("y2", String(ry));
      }
      if (coreOuterRingRef.current) {
        coreOuterRingRef.current.setAttribute("cx", String(rx));
        coreOuterRingRef.current.setAttribute("cy", String(ry));
      }
      if (coreInnerDotRef.current) {
        coreInnerDotRef.current.setAttribute("cx", String(rx));
        coreInnerDotRef.current.setAttribute("cy", String(ry));
      }
    }
  });

  return null;
}

// ─── 13. Camera Controller with Smooth Framing & Drawer Compensation ─────────
function CameraController({
  viewMode,
  selectedLevel,
  currentProject,
  isDrawerOpen,
  controlsRef,
}: {
  viewMode: string;
  selectedLevel: string;
  currentProject?: ProjectModelPreset;
  isDrawerOpen?: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    // When drawer is open, adjust center target so building is centered in visible 3D canvas
    const targetX = isDrawerOpen ? -1.1 : 0.2;
    const floor = currentProject?.floors?.find((f) => f.id === selectedLevel || f.name === selectedLevel || f.shortName === selectedLevel);
    const targetY = floor ? Math.max(1.0, floor.elevation + 1.2) : 6.0;

    if (viewMode === "top") {
      camera.position.set(targetX, 42, 0.01);
      camera.lookAt(targetX, targetY, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(targetX, targetY, 0);
        controlsRef.current.update();
      }
    } else if (viewMode === "2d") {
      camera.position.set(targetX, targetY + 1.5, 30);
      camera.lookAt(targetX, targetY, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(targetX, targetY, 0);
        controlsRef.current.update();
      }
    } else {
      // Default isometric 3D view: smooth focus on the active level
      camera.position.set(25.0 + targetX, 17.0 + (targetY - 6.0) * 0.5, 25.0);
      camera.lookAt(targetX, targetY, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(targetX, targetY, 0);
        controlsRef.current.update();
      }
    }
  }, [viewMode, selectedLevel, currentProject, isDrawerOpen, camera, controlsRef]);

  return null;
}

// ─── 14. Main Scene Graph ─────────────────────────────────────────────────────
function Scene({
  currentProject = PROJECT_PRESETS[0],
  selectedLevel,
  selectedLevels = [],
  selectedZone = "all",
  selectedDiscipline = "all",
  visMode = "status",
  selectedElementId,
  elementFilter,
  viewMode,
  dragMode,
  sectionMode,
  isDrawerOpen,
  controlsRef,
  onElementClick,
  onElementDoubleClick,
}: {
  currentProject?: ProjectModelPreset;
  selectedLevel: string;
  selectedLevels?: string[];
  selectedZone?: string;
  selectedDiscipline?: DisciplineType;
  visMode?: VisualizationMode;
  selectedElementId: string | null;
  elementFilter: ElementFilter;
  viewMode: string;
  dragMode: "pan" | "orbit";
  sectionMode: boolean;
  isDrawerOpen?: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onElementClick: (el: ModelElement) => void;
  onElementDoubleClick?: (el: ModelElement) => void;
}) {
  const floors = useMemo(() => {
    if (currentProject && currentProject.floors && currentProject.floors.length > 0) {
      return [...currentProject.floors].sort((a, b) => a.elevation - b.elevation);
    }
    return [
      { id: "Ground", name: "Ground", shortName: "G", elevation: 0, height: FLOOR_H, zones: ["East Wing", "West Wing"], status: "complete" as const, progress: 100, tasksCount: 42, delayedCount: 0, criticalCount: 0 },
      { id: "Level 1", name: "Level 1", shortName: "L1", elevation: 3.2, height: FLOOR_H, zones: ["East Wing", "West Wing"], status: "complete" as const, progress: 100, tasksCount: 48, delayedCount: 0, criticalCount: 0 },
      { id: "Level 2", name: "Level 2", shortName: "L2", elevation: 6.4, height: FLOOR_H, zones: ["East Wing", "West Wing"], status: "in-progress" as const, progress: 60, tasksCount: 52, delayedCount: 2, criticalCount: 4 },
      { id: "Level 3", name: "Level 3", shortName: "L3", elevation: 9.6, height: FLOOR_H, zones: ["East Wing", "West Wing"], status: "not-started" as const, progress: 0, tasksCount: 46, delayedCount: 0, criticalCount: 3 },
      { id: "Level 4", name: "Level 4", shortName: "L4", elevation: 12.8, height: FLOOR_H, zones: ["East Wing", "West Wing"], status: "not-started" as const, progress: 0, tasksCount: 38, delayedCount: 0, criticalCount: 2 },
      { id: "Roof", name: "Roof", shortName: "RF", elevation: 16.0, height: 3.4, isRoof: true, zones: ["Roof Deck"], status: "not-started" as const, progress: 0, tasksCount: 24, delayedCount: 0, criticalCount: 1 },
    ];
  }, [currentProject]);

  const activeLevelIndex = Math.max(0, floors.findIndex((f) => f.id === selectedLevel || f.name === selectedLevel));
  const roofFloor = floors.find((f) => f.isRoof) || floors[floors.length - 1];
  const roofElevation = roofFloor ? roofFloor.elevation : 16.0;

  return (
    <>
      {/* Subtle Neutral BIM Canvas Background */}
      <color attach="background" args={["#f8fafc"]} />

      {/* Professional Studio Ambient & Directional Lighting */}
      <ambientLight intensity={0.45} />
      <directionalLight
        position={[28, 38, 22]}
        intensity={1.8}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={24}
        shadow-camera-bottom={-24}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[-20, 16, -18]} intensity={0.45} color="#e0f2fe" />
      <directionalLight position={[0, -10, 10]} intensity={0.15} color="#f8fafc" />
      <hemisphereLight args={["#ffffff", "#cbd5e1", 0.35]} />

      <CameraController
        viewMode={viewMode}
        selectedLevel={selectedLevel}
        currentProject={currentProject}
        isDrawerOpen={isDrawerOpen}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.06}
        minDistance={11}
        maxDistance={65}
        maxPolarAngle={viewMode === "top" ? 0.01 : Math.PI / 2.05}
        enablePan
        panSpeed={0.8}
        rotateSpeed={0.65}
        zoomSpeed={1.05}
        screenSpacePanning
        mouseButtons={{
          LEFT: dragMode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      {/* Neutral Site Ground, Coordinate Grid & Site Boundary */}
      <SiteSurroundings hasCrane={currentProject?.hasCrane !== false} />

      {/* Section Plane Cut Overlay */}
      <SectionCutPlane activeLevelIndex={activeLevelIndex} visible={sectionMode} />

      {/* Dynamic Building Floors */}
      {floors.map((floor, idx) => {
        if (floor.isRoof) return null;
        const elements = getElementsForLevel(floor.id);

        return (
          <FloorAssembly
            key={floor.id}
            floor={floor}
            floorIndex={idx}
            elements={elements}
            selectedElementId={selectedElementId}
            selectedLevel={selectedLevel}
            selectedLevels={selectedLevels}
            selectedZone={selectedZone}
            selectedDiscipline={selectedDiscipline}
            visMode={visMode}
            sectionMode={sectionMode}
            activeLevelIndex={activeLevelIndex}
            onElementClick={onElementClick}
            onElementDoubleClick={onElementDoubleClick}
          />
        );
      })}

      {/* Dynamic Roof Deck */}
      <RoofAssembly
        elevation={roofElevation}
        isSectioned={sectionMode && activeLevelIndex < floors.length - 2}
        isLevelActive={selectedLevel === "Roof"}
        isAnyLevelActive={selectedLevel !== null}
      />
    </>
  );
}

// ─── 15. Exported BuildingCanvas Component ─────────────────────────────────────
export interface BuildingCanvasProps {
  currentProject?: ProjectModelPreset;
  selectedLevel: string;
  selectedLevels?: string[];
  selectedZone?: string;
  selectedDiscipline?: DisciplineType;
  visMode?: VisualizationMode;
  scrubDate?: number | string | null;
  selectedElementId: string | null;
  elementFilter: ElementFilter;
  viewMode: string;
  dragMode?: "pan" | "orbit";
  sectionMode?: boolean;
  showCallouts?: boolean;
  isDrawerOpen?: boolean;
  onElementClick: (el: ModelElement) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

export function BuildingCanvas({
  currentProject = PROJECT_PRESETS[0],
  selectedLevel,
  selectedLevels = [],
  selectedZone = "all",
  selectedDiscipline = "all",
  visMode = "status",
  scrubDate = null,
  selectedElementId,
  elementFilter,
  viewMode = "3d",
  dragMode = "orbit",
  sectionMode = false,
  showCallouts = true,
  isDrawerOpen = false,
  onElementClick,
  controlsRef,
}: BuildingCanvasProps) {
  // Edge Case: Requirement 29 - Empty state when project has no 3D model
  if (currentProject && !currentProject.modelAvailable) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-[#f8fafc] text-center p-8 select-none">
        <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-slate-100 border border-slate-200 text-slate-400 mb-3">
          <svg className="h-6 w-6 stroke-[1.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          </svg>
        </div>
        <h3 className="text-[14px] font-semibold text-slate-800 mb-1">No 3D Model Available</h3>
        <p className="text-[12px] text-slate-500 max-w-[360px] leading-relaxed mb-4">
          This project package does not have an active 3D BIM model attached. Programme tasks, WBS, and milestones remain fully functional in Gantt, List, Network, and Calendar views.
        </p>
      </div>
    );
  }

  const colCardRef = useRef<HTMLDivElement | null>(null);
  const slabCardRef = useRef<HTMLDivElement | null>(null);
  const coreCardRef = useRef<HTMLDivElement | null>(null);

  const colLineRef = useRef<SVGLineElement | null>(null);
  const colOuterRingRef = useRef<SVGCircleElement | null>(null);
  const colInnerDotRef = useRef<SVGCircleElement | null>(null);
  const colGroupRef = useRef<SVGGElement | null>(null);

  const slabLineRef = useRef<SVGLineElement | null>(null);
  const slabOuterRingRef = useRef<SVGCircleElement | null>(null);
  const slabInnerDotRef = useRef<SVGCircleElement | null>(null);
  const slabGroupRef = useRef<SVGGElement | null>(null);

  const coreLineRef = useRef<SVGLineElement | null>(null);
  const coreOuterRingRef = useRef<SVGCircleElement | null>(null);
  const coreInnerDotRef = useRef<SVGCircleElement | null>(null);
  const coreGroupRef = useRef<SVGGElement | null>(null);

  const [hoveredCard, setHoveredCard] = useState<string | null>(null);

  const colElLvl2 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-021"), []);
  const coreElLvl2 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-022"), []);
  const slabElLvl1 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-010"), []);

  // Double click handler to focus element in 3D
  const handleElementDoubleClick = useCallback(
    (el: ModelElement) => {
      if (controlsRef.current) {
        const floor = currentProject?.floors?.find((f) => f.id === el.level);
        const targetY = floor ? floor.elevation + 1.6 : 6.0;
        controlsRef.current.target.set(0.3, targetY, 0);
        controlsRef.current.update();
      }
      onElementClick(el);
    },
    [controlsRef, onElementClick, currentProject]
  );

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-[#f8fafc]">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        style={{ width: "100%", height: "100%" }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[27.0, 23.5, 27.0]} fov={33} near={0.5} far={250} />
        <Suspense fallback={null}>
          <Scene
            currentProject={currentProject}
            selectedLevel={selectedLevel}
            selectedLevels={selectedLevels}
            selectedZone={selectedZone}
            selectedDiscipline={selectedDiscipline}
            visMode={visMode}
            selectedElementId={selectedElementId}
            elementFilter={elementFilter}
            viewMode={viewMode}
            dragMode={dragMode}
            sectionMode={sectionMode}
            isDrawerOpen={isDrawerOpen}
            controlsRef={controlsRef}
            onElementClick={onElementClick}
            onElementDoubleClick={handleElementDoubleClick}
          />
          <DynamicCalloutProjector
            colCardRef={colCardRef}
            slabCardRef={slabCardRef}
            coreCardRef={coreCardRef}
            colLineRef={colLineRef}
            colOuterRingRef={colOuterRingRef}
            colInnerDotRef={colInnerDotRef}
            colGroupRef={colGroupRef}
            slabLineRef={slabLineRef}
            slabOuterRingRef={slabOuterRingRef}
            slabInnerDotRef={slabInnerDotRef}
            slabGroupRef={slabGroupRef}
            coreLineRef={coreLineRef}
            coreOuterRingRef={coreOuterRingRef}
            coreInnerDotRef={coreInnerDotRef}
            coreGroupRef={coreGroupRef}
            showCallouts={showCallouts}
            selectedElementId={selectedElementId}
            hoveredCard={hoveredCard}
            sectionMode={sectionMode}
            selectedLevel={selectedLevel}
          />
        </Suspense>
      </Canvas>

      {/* SVG Screen-Space Layer for Minimal Leader Lines & Anchor Rings */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full z-20">
        {/* Callout 1 (Columns) */}
        <g ref={colGroupRef} style={{ display: "none" }}>
          <line ref={colLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle ref={colOuterRingRef} cx={0} cy={0} r={5.5} fill="#ffffff" stroke="#2563eb" strokeWidth={2} />
          <circle ref={colInnerDotRef} cx={0} cy={0} r={2} fill="#2563eb" />
        </g>
        {/* Callout 2 (Slab) */}
        <g ref={slabGroupRef} style={{ display: "none" }}>
          <line ref={slabLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle ref={slabOuterRingRef} cx={0} cy={0} r={5.5} fill="#ffffff" stroke="#10b981" strokeWidth={2} />
          <circle ref={slabInnerDotRef} cx={0} cy={0} r={2} fill="#10b981" />
        </g>
        {/* Callout 3 (Core Wall) */}
        <g ref={coreGroupRef} style={{ display: "none" }}>
          <line ref={coreLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3 2" />
          <circle ref={coreOuterRingRef} cx={0} cy={0} r={5.5} fill="#ffffff" stroke="#ef4444" strokeWidth={2} />
          <circle ref={coreInnerDotRef} cx={0} cy={0} r={2} fill="#ef4444" />
        </g>
      </svg>

      {/* ─── Progressive Disclosure Callout 1: Level 2 — Columns ─── */}
      <div
        ref={colCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (colElLvl2) onElementClick(colElLvl2);
        }}
        onMouseEnter={() => setHoveredCard("columns")}
        onMouseLeave={() => setHoveredCard(null)}
        className={`absolute left-0 top-0 cursor-pointer select-none transition-all duration-150 pointer-events-auto ${
          selectedElementId === "PRG-021"
            ? "rounded-lg border border-blue-600 bg-white/98 p-2.5 shadow-md ring-2 ring-blue-500/20"
            : hoveredCard === "columns"
            ? "rounded-full border border-blue-500 bg-white px-2.5 py-1 shadow-xs"
            : "rounded-full border border-slate-200/90 bg-white/95 px-2 py-0.5 shadow-xs hover:border-blue-400"
        }`}
        style={{ zIndex: selectedElementId === "PRG-021" ? 28 : 25, willChange: "transform" }}
      >
        {selectedElementId === "PRG-021" ? (
          // Full Selected Card (Requirement 6)
          <div className="min-w-[155px]">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="text-[12px] font-bold text-slate-900 leading-tight">Level 2 — Columns</span>
              </div>
              <span className="rounded bg-blue-50 px-1.5 py-0.2 text-[9.5px] font-bold text-blue-700 font-mono">
                60%
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] text-slate-500">
              <span className="font-medium text-blue-700">In Progress</span>
              <span>Structural</span>
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400 font-mono">
              20 Dec 2025 → 16 Jan 2026
            </div>
          </div>
        ) : hoveredCard === "columns" ? (
          // Hover State
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            <span className="font-semibold text-slate-800">Level 2 — Columns</span>
            <span className="font-mono text-blue-600 font-bold text-[10px]">60%</span>
          </div>
        ) : (
          // Normal Compact Marker (Requirement 7)
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" />
            <span>L2 Columns</span>
            <span className="font-mono text-[9px] text-blue-700 font-semibold">60%</span>
          </div>
        )}
      </div>

      {/* ─── Progressive Disclosure Callout 2: Level 1 — Slab ─── */}
      <div
        ref={slabCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (slabElLvl1) onElementClick(slabElLvl1);
        }}
        onMouseEnter={() => setHoveredCard("slab")}
        onMouseLeave={() => setHoveredCard(null)}
        className={`absolute left-0 top-0 cursor-pointer select-none transition-all duration-150 pointer-events-auto ${
          selectedElementId === "PRG-010"
            ? "rounded-lg border border-emerald-600 bg-white/98 p-2.5 shadow-md ring-2 ring-emerald-500/20"
            : hoveredCard === "slab"
            ? "rounded-full border border-emerald-500 bg-white px-2.5 py-1 shadow-xs"
            : "rounded-full border border-slate-200/90 bg-white/95 px-2 py-0.5 shadow-xs hover:border-emerald-400"
        }`}
        style={{ zIndex: selectedElementId === "PRG-010" ? 28 : 25, willChange: "transform" }}
      >
        {selectedElementId === "PRG-010" ? (
          // Full Selected Card
          <div className="min-w-[145px]">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span className="text-[12px] font-bold text-slate-900 leading-tight">Level 1 — Slab</span>
              </div>
              <span className="rounded bg-emerald-50 px-1.5 py-0.2 text-[9.5px] font-bold text-emerald-700 font-mono">
                100%
              </span>
            </div>
            <div className="mt-1 text-[10px] text-emerald-700 font-medium">
              Completed Milestone
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400 font-mono">
              03 Nov 2025 → 15 Nov 2025
            </div>
          </div>
        ) : hoveredCard === "slab" ? (
          // Hover State
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            <span className="font-semibold text-slate-800">Level 1 — Slab</span>
            <span className="font-mono text-emerald-700 font-bold text-[10px]">100%</span>
          </div>
        ) : (
          // Normal Compact Marker
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
            <span>L1 Slab</span>
            <span className="font-mono text-[9px] text-emerald-700 font-semibold">100%</span>
          </div>
        )}
      </div>

      {/* ─── Progressive Disclosure Callout 3: Core Wall (Blocked) ─── */}
      <div
        ref={coreCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (coreElLvl2) onElementClick(coreElLvl2);
        }}
        onMouseEnter={() => setHoveredCard("core")}
        onMouseLeave={() => setHoveredCard(null)}
        className={`absolute left-0 top-0 cursor-pointer select-none transition-all duration-150 pointer-events-auto ${
          selectedElementId === "PRG-022"
            ? "rounded-lg border border-red-600 bg-white/98 p-2.5 shadow-md ring-2 ring-red-500/20"
            : hoveredCard === "core"
            ? "rounded-full border border-red-500 bg-white px-2.5 py-1 shadow-xs"
            : "rounded-full border border-red-200 bg-white/95 px-2 py-0.5 shadow-xs hover:border-red-400"
        }`}
        style={{ zIndex: selectedElementId === "PRG-022" ? 28 : 25, willChange: "transform" }}
      >
        {selectedElementId === "PRG-022" ? (
          // Full Selected Card
          <div className="min-w-[150px]">
            <div className="flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-600 shrink-0" />
                <span className="text-[12px] font-bold text-slate-900 leading-tight">Core Wall</span>
              </div>
              <span className="rounded bg-red-50 px-1.5 py-0.2 text-[9.5px] font-bold text-red-600 uppercase">
                Blocked
              </span>
            </div>
            <div className="mt-1 text-[10px] font-medium text-red-600">
              Awaiting approval
            </div>
            <div className="mt-0.5 text-[9.5px] text-slate-400 font-mono">
              Structural Core · Jump Form
            </div>
          </div>
        ) : hoveredCard === "core" ? (
          // Hover State
          <div className="flex items-center gap-1.5 text-[10.5px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
            <span className="font-semibold text-slate-800">Core Wall</span>
            <span className="text-[9.5px] font-bold text-red-600 uppercase">Blocked</span>
          </div>
        ) : (
          // Normal Compact Marker
          <div className="flex items-center gap-1.5 text-[10px] font-medium text-slate-700">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600 shrink-0" />
            <span>Core Wall</span>
            <span className="text-[9px] font-bold text-red-600">Blocked</span>
          </div>
        )}
      </div>
    </div>
  );
}
