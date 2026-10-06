"use client";

import React, { useRef, useEffect, useMemo, Suspense } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import {
  OrbitControls,
  PerspectiveCamera,
} from "@react-three/drei";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  ModelElement,
  BuildingLevel,
  ElementFilter,
  TaskStatus,
} from "./model-data";
import {
  MODEL_ELEMENTS,
  getElementsForLevel,
} from "./model-data";

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

// ─── 1. Construction Tower Crane ───────────────────────────────────────────────
function ConstructionCrane() {
  const craneX = -8.2;
  const craneZ = -3.5;
  const mastH = 28;
  const mastW = 1.4;

  return (
    <group position={[craneX, 0, craneZ]}>
      {/* Concrete Foundation Pad */}
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <boxGeometry args={[3.4, 0.6, 3.4]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
      </mesh>

      {/* Vertical Lattice Mast (4 corner vertical chords + cross lacing) */}
      {[-mastW / 2, mastW / 2].map((mx) =>
        [-mastW / 2, mastW / 2].map((mz) => (
          <mesh key={`post-${mx}-${mz}`} position={[mx, mastH / 2, mz]} castShadow>
            <boxGeometry args={[0.09, mastH, 0.09]} />
            <meshStandardMaterial color="#f59e0b" roughness={0.45} metalness={0.25} />
          </mesh>
        ))
      )}

      {/* Horizontal & Diagonal lattice bracing */}
      {Array.from({ length: 12 }).map((_, i) => {
        const y = 1.0 + i * 2.1;
        return (
          <group key={`brace-${i}`} position={[0, y, 0]}>
            <mesh position={[0, 0, mastW / 2]}>
              <boxGeometry args={[mastW, 0.06, 0.06]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[0, 0, -mastW / 2]}>
              <boxGeometry args={[mastW, 0.06, 0.06]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[mastW / 2, 0, 0]}>
              <boxGeometry args={[0.06, 0.06, mastW]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[-mastW / 2, 0, 0]}>
              <boxGeometry args={[0.06, 0.06, mastW]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[0, 1.05, mastW / 2]} rotation={[0, 0, 0.52]}>
              <boxGeometry args={[mastW * 1.5, 0.045, 0.045]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
            <mesh position={[0, 1.05, -mastW / 2]} rotation={[0, 0, -0.52]}>
              <boxGeometry args={[mastW * 1.5, 0.045, 0.045]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
          </group>
        );
      })}

      {/* Slewing Platform & Turntable Ring at Mast Top */}
      <mesh position={[0, mastH + 0.25, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 0.5, 16]} />
        <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
      </mesh>

      {/* Operator Cabin */}
      <group position={[1.1, mastH + 1.2, 0.6]}>
        <mesh castShadow>
          <boxGeometry args={[1.2, 1.8, 1.4]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.5} />
        </mesh>
        <mesh position={[0.61, 0.2, 0]}>
          <planeGeometry args={[1.3, 0.9]} />
          <meshStandardMaterial color="#1e293b" roughness={0.1} metalness={0.8} />
        </mesh>
      </group>

      {/* Cathead (A-Frame Apex Tower at top) */}
      <group position={[0, mastH + 0.5, 0]}>
        <mesh position={[0, 2.6, 0]}>
          <coneGeometry args={[0.85, 5.2, 4]} />
          <meshStandardMaterial color="#f59e0b" roughness={0.6} />
        </mesh>

        {/* Main Working Jib (Extending over building towards +X) */}
        <group position={[10.5, 0.8, 0]}>
          <mesh position={[0, 0.5, 0]} castShadow>
            <boxGeometry args={[21, 0.08, 0.08]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, -0.4, 0.5]} castShadow>
            <boxGeometry args={[21, 0.08, 0.08]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          <mesh position={[0, -0.4, -0.5]} castShadow>
            <boxGeometry args={[21, 0.08, 0.08]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          {Array.from({ length: 12 }).map((_, j) => (
            <mesh key={`jib-tie-${j}`} position={[-9.5 + j * 1.8, 0, 0]}>
              <boxGeometry args={[0.05, 0.9, 1.0]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
          ))}
        </group>

        {/* Trolley & Hoist Cable with Hook */}
        <group position={[7.5, 0.4, 0]}>
          <mesh position={[0, -0.15, 0]}>
            <boxGeometry args={[0.8, 0.25, 0.9]} />
            <meshStandardMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0, -6.5, 0]}>
            <cylinderGeometry args={[0.015, 0.015, 12.5, 4]} />
            <meshStandardMaterial color="#1e293b" metalness={0.9} />
          </mesh>
          <group position={[0, -12.8, 0]}>
            <mesh>
              <boxGeometry args={[0.4, 0.6, 0.35]} />
              <meshStandardMaterial color="#f59e0b" />
            </mesh>
            <mesh position={[0, -0.45, 0]}>
              <torusGeometry args={[0.18, 0.04, 8, 16, Math.PI * 1.3]} />
              <meshStandardMaterial color="#334155" metalness={0.9} />
            </mesh>
          </group>
        </group>

        {/* Counter-Jib (Extending backwards towards -X) */}
        <group position={[-4.0, 0.8, 0]}>
          <mesh position={[0, 0, 0]} castShadow>
            <boxGeometry args={[8.0, 0.7, 1.1]} />
            <meshStandardMaterial color="#f59e0b" />
          </mesh>
          {/* Concrete Counterweight Ballast Blocks */}
          <group position={[-2.8, -0.1, 0]}>
            <mesh castShadow>
              <boxGeometry args={[2.0, 1.4, 1.4]} />
              <meshStandardMaterial color="#64748b" roughness={0.9} />
            </mesh>
            <mesh position={[0, 0.8, 0]} castShadow>
              <boxGeometry args={[1.7, 0.6, 1.3]} />
              <meshStandardMaterial color="#475569" roughness={0.9} />
            </mesh>
          </group>
        </group>

        {/* Tension Stay Cables */}
        <mesh position={[5.2, 3.2, 0]} rotation={[0, 0, -0.45]}>
          <cylinderGeometry args={[0.02, 0.02, 11.5, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
        <mesh position={[-3.2, 3.2, 0]} rotation={[0, 0, 0.62]}>
          <cylinderGeometry args={[0.02, 0.02, 7.8, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 2. Yellow Construction Forklift ──────────────────────────────────────────
function Forklift({ position = [7.5, 0, 1.4], rotation = [0, -0.65, 0] }: { position?: [number, number, number]; rotation?: [number, number, number] }) {
  return (
    <group position={position} rotation={rotation} scale={0.9}>
      <mesh position={[0, 0.42, 0]} castShadow>
        <boxGeometry args={[1.7, 0.6, 1.1]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      </mesh>
      <mesh position={[-0.75, 0.5, 0]} castShadow>
        <boxGeometry args={[0.5, 0.72, 1.05]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-0.42, 0.42].map((px) =>
        [-0.45, 0.45].map((pz) => (
          <mesh key={`post-${px}-${pz}`} position={[px, 1.22, pz]}>
            <boxGeometry args={[0.06, 1.15, 0.06]} />
            <meshStandardMaterial color="#1e293b" metalness={0.8} />
          </mesh>
        ))
      )}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[0.95, 0.06, 0.95]} />
        <meshStandardMaterial color="#1e293b" metalness={0.8} />
      </mesh>
      <mesh position={[0.95, 1.05, 0]}>
        <boxGeometry args={[0.09, 1.9, 0.65]} />
        <meshStandardMaterial color="#334155" metalness={0.8} />
      </mesh>
      <mesh position={[1.45, 0.08, -0.2]}>
        <boxGeometry args={[0.95, 0.04, 0.12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} />
      </mesh>
      <mesh position={[1.45, 0.08, 0.2]}>
        <boxGeometry args={[0.95, 0.04, 0.12]} />
        <meshStandardMaterial color="#1e293b" metalness={0.9} />
      </mesh>
      {[-0.55, 0.65].map((wx, i) =>
        [-0.6, 0.6].map((wz, j) => (
          <mesh key={`whl-${i}-${j}`} position={[wx, 0.25, wz]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.18, 14]} />
            <meshStandardMaterial color="#0f172a" roughness={0.9} />
          </mesh>
        ))
      )}
    </group>
  );
}

// ─── 3. Perimeter Site Fence with Red Base Stripe ─────────────────────────────
function SitePerimeterFence() {
  const fenceH = 1.9;
  const stripeH = 0.38;

  return (
    <group>
      {/* Front Fence Segment */}
      <group position={[0, fenceH / 2, 8.2]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[26.4, fenceH, 0.1]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
        <mesh position={[0, -fenceH / 2 + stripeH / 2, 0.06]}>
          <boxGeometry args={[26.42, stripeH, 0.025]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
        <mesh position={[0, fenceH / 2, 0]}>
          <boxGeometry args={[26.5, 0.08, 0.15]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>

      {/* Right Fence Segment */}
      <group position={[13.2, fenceH / 2, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[0.1, fenceH, 18.2]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
        <mesh position={[-0.06, -fenceH / 2 + stripeH / 2, 0]}>
          <boxGeometry args={[0.025, stripeH, 18.22]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
        <mesh position={[0, fenceH / 2, 0]}>
          <boxGeometry args={[0.15, 0.08, 18.3]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>

      {/* Left Fence Segment */}
      <group position={[-12.8, fenceH / 2, 0]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[0.1, fenceH, 18.2]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
        <mesh position={[0.06, -fenceH / 2 + stripeH / 2, 0]}>
          <boxGeometry args={[0.025, stripeH, 18.22]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
        <mesh position={[0, fenceH / 2, 0]}>
          <boxGeometry args={[0.15, 0.08, 18.3]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      </group>

      {/* Rear Fence Segment */}
      <group position={[0, fenceH / 2, -9.6]}>
        <mesh receiveShadow castShadow>
          <boxGeometry args={[26.4, fenceH, 0.1]} />
          <meshStandardMaterial color="#f1f5f9" roughness={0.8} />
        </mesh>
        <mesh position={[0, -fenceH / 2 + stripeH / 2, 0.06]}>
          <boxGeometry args={[26.42, stripeH, 0.025]} />
          <meshStandardMaterial color="#ef4444" roughness={0.6} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 4. Site Surroundings, Roads, Office Cabins, Context ──────────────────────
function SiteSurroundings() {
  return (
    <group>
      {/* Ground plane */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[140, 120]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.95} />
      </mesh>

      {/* Paved concrete construction site apron */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0.2, 0.005, -0.6]}>
        <planeGeometry args={[25.8, 17.8]} />
        <meshStandardMaterial color="#e2e8f0" roughness={0.85} />
      </mesh>

      {/* Roads surrounding the construction site */}
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 13.5]}>
        <planeGeometry args={[95, 10.5]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
      </mesh>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[18.5, 0.01, 0]}>
        <planeGeometry args={[10.5, 85]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.92} />
      </mesh>

      {/* Road Markings */}
      {Array.from({ length: 10 }).map((_, i) => (
        <mesh key={`dash-${i}`} rotation={[-Math.PI / 2, 0, 0]} position={[-25 + i * 5.8, 0.015, 13.5]}>
          <planeGeometry args={[2.8, 0.22]} />
          <meshStandardMaterial color="#ffffff" roughness={0.5} />
        </mesh>
      ))}

      {/* Context Buildings in Background */}
      <group position={[-24, 0, -22]}>
        <mesh position={[0, 5, 0]} castShadow receiveShadow>
          <boxGeometry args={[16, 10, 14]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.8} />
        </mesh>
      </group>
      <group position={[22, 0, -22]}>
        <mesh position={[0, 6, 0]} castShadow receiveShadow>
          <boxGeometry args={[18, 12, 16]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.8} />
        </mesh>
      </group>
      <group position={[-24, 0, 14]}>
        <mesh position={[0, 4.5, 0]} castShadow receiveShadow>
          <boxGeometry args={[14, 9, 12]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.8} />
        </mesh>
      </group>

      {/* Perimeter Security Fence */}
      <SitePerimeterFence />

      {/* Tower Crane */}
      <ConstructionCrane />

      {/* Yellow Forklift on Right Apron */}
      <Forklift position={[7.5, 0, 1.4]} rotation={[0, -0.65, 0]} />

      {/* Modular site office cabins on right perimeter */}
      <group position={[9.2, 0, -4.8]}>
        <mesh position={[0, 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[4.8, 2.6, 2.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.7} />
        </mesh>
        <mesh position={[0, 2.65, 0]}>
          <boxGeometry args={[5.0, 0.12, 2.5]} />
          <meshStandardMaterial color="#3b82f6" roughness={0.6} />
        </mesh>
        {[-1.4, 0.3, 1.5].map((wx, i) => (
          <mesh key={i} position={[wx, 1.4, 1.21]}>
            <planeGeometry args={[0.8, 0.9]} />
            <meshStandardMaterial color="#1e293b" roughness={0.2} metalness={0.8} />
          </mesh>
        ))}
        <mesh position={[-0.5, 1.0, 1.21]}>
          <planeGeometry args={[0.7, 1.9]} />
          <meshStandardMaterial color="#475569" roughness={0.8} />
        </mesh>
      </group>

      {/* White Delivery Truck on Left Driveway */}
      <group position={[-7.5, 0, 3.8]} rotation={[0, 0.45, 0]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[3.4, 0.5, 1.5]} />
          <meshStandardMaterial color="#334155" roughness={0.7} />
        </mesh>
        <mesh position={[-1.0, 1.1, 0]} castShadow>
          <boxGeometry args={[1.3, 1.0, 1.4]} />
          <meshStandardMaterial color="#f8fafc" roughness={0.6} />
        </mesh>
        <mesh position={[0.7, 1.1, 0]} castShadow>
          <boxGeometry args={[2.0, 1.1, 1.4]} />
          <meshStandardMaterial color="#ffffff" roughness={0.6} />
        </mesh>
        {[-1.0, 0.9].map((wx, wi) =>
          [-0.8, 0.8].map((wz, wj) => (
            <mesh key={`${wi}-${wj}`} position={[wx, 0.25, wz]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.25, 0.25, 0.2, 12]} />
              <meshStandardMaterial color="#1e293b" roughness={0.9} />
            </mesh>
          ))
        )}
      </group>

      {/* Timber Formwork Pallets & Material Stacks */}
      <group position={[7.8, 0, 3.8]}>
        {[0, 0.25, 0.5, 0.75].map((ty, i) => (
          <mesh key={i} position={[0, ty + 0.1, 0]} castShadow>
            <boxGeometry args={[2.2, 0.18, 1.6]} />
            <meshStandardMaterial color="#d97706" roughness={0.85} />
          </mesh>
        ))}
      </group>
      <group position={[6.0, 0, -5.5]}>
        <mesh position={[0, 0.2, 0]} castShadow>
          <boxGeometry args={[3.2, 0.4, 1.2]} />
          <meshStandardMaterial color="#475569" roughness={0.6} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.55, 0]} castShadow>
          <boxGeometry args={[2.6, 0.35, 1.0]} />
          <meshStandardMaterial color="#64748b" roughness={0.6} metalness={0.7} />
        </mesh>
      </group>

      {/* Clustered Architectural Trees */}
      {[
        { x: 9.0, z: -1.8, s: 1.15, c: "#15803d" },
        { x: 10.4, z: -0.3, s: 1.35, c: "#166534" },
        { x: 9.5, z: 1.4, s: 1.1, c: "#15803d" },
        { x: 11.0, z: 2.5, s: 1.25, c: "#14532d" },
        { x: 8.6, z: 4.8, s: 1.1, c: "#166534" },
        { x: 10.2, z: 5.6, s: 0.95, c: "#15803d" },
        { x: -9.8, z: -3.8, s: 1.2, c: "#166534" },
        { x: -10.6, z: 1.8, s: 1.25, c: "#15803d" },
        { x: -9.2, z: 5.4, s: 1.1, c: "#14532d" },
        { x: -11.5, z: -1.0, s: 1.3, c: "#166534" },
      ].map((tree, i) => (
        <group key={i} position={[tree.x, 0, tree.z]} scale={tree.s}>
          <mesh position={[0, 0.7, 0]} castShadow>
            <cylinderGeometry args={[0.09, 0.13, 1.4, 7]} />
            <meshStandardMaterial color="#78350f" roughness={0.9} />
          </mesh>
          <mesh position={[0, 2.0, 0]} castShadow>
            <dodecahedronGeometry args={[1.1, 1]} />
            <meshStandardMaterial color={tree.c} roughness={0.75} />
          </mesh>
          <mesh position={[0.2, 2.7, 0.1]} castShadow>
            <dodecahedronGeometry args={[0.75, 1]} />
            <meshStandardMaterial color={tree.c} roughness={0.7} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── 5. Floor Slab Component (Solid Opaque Concrete with Green Level 1) ───────
function SlabMesh({
  elevation,
  level,
  isSelected,
  onClick,
}: {
  elevation: number;
  level: BuildingLevel;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const isLevel1 = level === "Level 1";

  // Level 1 slab is 100% complete: highlighted in bright clean green
  const color = isSelected
    ? "#2563eb"
    : isLevel1
    ? "#10b981"
    : "#cbd5e1";

  return (
    <mesh
      position={[0, elevation + SLAB_T / 2, 0]}
      receiveShadow
      castShadow
      onClick={onClick}
    >
      <boxGeometry args={[BUILDING_W, SLAB_T, BUILDING_D]} />
      <meshStandardMaterial
        color={color}
        roughness={0.65}
        metalness={0.06}
      />
    </mesh>
  );
}

// ─── 6. Floor Columns Component (Solid Opaque Concrete with Blue Level 2) ─────
function ColumnsMesh({
  floorBaseElevation,
  level,
  isSelected,
  onClick,
}: {
  floorBaseElevation: number;
  level: BuildingLevel;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const colH = FLOOR_H - SLAB_T;
  const colY = floorBaseElevation + SLAB_T + colH / 2;
  const isLevel2 = level === "Level 2";
  const isLevel4 = level === "Level 4";

  // Level 2 columns are in-progress (60%): highlighted in vibrant bright blue
  const color = isSelected
    ? "#1d4ed8"
    : isLevel2
    ? "#0066ff"
    : "#cbd5e1";

  return (
    <group onClick={onClick}>
      {COL_X.map((cx) =>
        COL_Z.map((cz) => {
          // Skip columns inside the core
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
                  color={color}
                  roughness={0.55}
                  metalness={0.08}
                />
              </mesh>
              {/* Level 4 columns have exposed vertical steel rebar starter dowels */}
              {isLevel4 && (
                <group position={[cx, colY + colH / 2 + 0.45, cz]}>
                  {[-0.1, 0.1].map((rx) =>
                    [-0.1, 0.1].map((rz) => (
                      <mesh key={`rebar-${rx}-${rz}`} position={[rx, 0, rz]}>
                        <cylinderGeometry args={[0.016, 0.016, 0.9, 6]} />
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

// ─── 7. Floor Beams Component ─────────────────────────────────────────────────
function BeamsMesh({
  floorBaseElevation,
  isSelected,
  onClick,
}: {
  floorBaseElevation: number;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const beamY = floorBaseElevation + FLOOR_H - BEAM_H / 2;
  const color = isSelected ? "#1d4ed8" : "#b0bccb";

  return (
    <group onClick={onClick}>
      <mesh position={[0, beamY, -BUILDING_D / 2 + BEAM_W / 2]} castShadow>
        <boxGeometry args={[BUILDING_W, BEAM_H, BEAM_W]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[0, beamY, BUILDING_D / 2 - BEAM_W / 2]} castShadow>
        <boxGeometry args={[BUILDING_W, BEAM_H, BEAM_W]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[-BUILDING_W / 2 + BEAM_W / 2, beamY, 0]} castShadow>
        <boxGeometry args={[BEAM_W, BEAM_H, BUILDING_D]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - BEAM_W / 2, beamY, 0]} castShadow>
        <boxGeometry args={[BEAM_W, BEAM_H, BUILDING_D]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>
    </group>
  );
}

// ─── 8. Floor Core Wall Component (Solid Opaque Concrete with Red Level 2) ────
function CoreMesh({
  floorBaseElevation,
  level,
  isSelected,
  onClick,
}: {
  floorBaseElevation: number;
  level: BuildingLevel;
  isSelected: boolean;
  onClick: (e: any) => void;
}) {
  const coreH = FLOOR_H - SLAB_T;
  const coreY = floorBaseElevation + SLAB_T + coreH / 2;
  const isLevel2 = level === "Level 2";

  // Level 2 core wall is blocked: highlighted in bright red
  const color = isSelected
    ? "#dc2626"
    : isLevel2
    ? "#ef4444"
    : "#cbd5e1";

  return (
    <group position={[CORE_X, coreY, CORE_Z]} onClick={onClick}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[CORE_W, coreH, CORE_D]} />
        <meshStandardMaterial
          color={color}
          roughness={0.65}
          metalness={0.06}
        />
      </mesh>
      <mesh position={[-CORE_W / 2 - 0.01, -0.2, 0]}>
        <boxGeometry args={[0.05, 2.1, 1.2]} />
        <meshStandardMaterial color="#475569" roughness={0.8} />
      </mesh>
    </group>
  );
}

// ─── 9. Realistic Stepped Concrete Stairs ─────────────────────────────────────
function RealisticStairs({ floorBaseElevation }: { floorBaseElevation: number }) {
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
        </mesh>
      ))}
      <mesh
        position={[stairW / 2 - 0.04, totalH / 2 + 0.45, -(steps * stepD) / 2]}
        rotation={[Math.atan2(totalH, steps * stepD), 0, 0]}
      >
        <cylinderGeometry args={[0.022, 0.022, Math.hypot(totalH, steps * stepD), 8]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.45} />
      </mesh>
    </group>
  );
}

// ─── 10. High-Visibility Yellow Edge Safety Railings ──────────────────────────
function EdgeRailingsMesh({ floorBaseElevation }: { floorBaseElevation: number }) {
  const y = floorBaseElevation + SLAB_T;
  const railH = 0.95;
  const yellowColor = "#f59e0b";

  return (
    <group position={[0, y, 0]}>
      {/* Front Edge (Z = BUILDING_D / 2) */}
      <mesh position={[0, railH, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.035, 0.035]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, railH * 0.5, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.025, 0.025]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      <mesh position={[0, 0.07, BUILDING_D / 2 - 0.05]}>
        <boxGeometry args={[BUILDING_W - 0.2, 0.14, 0.025]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4].map((x) => (
        <mesh key={`post-f-${x}`} position={[x, railH / 2, BUILDING_D / 2 - 0.05]}>
          <boxGeometry args={[0.035, railH, 0.035]} />
          <meshStandardMaterial color={yellowColor} roughness={0.45} />
        </mesh>
      ))}

      {/* Right Edge (X = BUILDING_W / 2) */}
      <mesh position={[BUILDING_W / 2 - 0.05, railH, 0]}>
        <boxGeometry args={[0.035, 0.035, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - 0.05, railH * 0.5, 0]}>
        <boxGeometry args={[0.025, 0.025, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      <mesh position={[BUILDING_W / 2 - 0.05, 0.07, 0]}>
        <boxGeometry args={[0.025, 0.14, BUILDING_D - 0.2]} />
        <meshStandardMaterial color="#d97706" roughness={0.6} />
      </mesh>
      {[-3.4, -1.7, 0, 1.7, 3.4].map((z) => (
        <mesh key={`post-r-${z}`} position={[BUILDING_W / 2 - 0.05, railH / 2, z]}>
          <boxGeometry args={[0.035, railH, 0.035]} />
          <meshStandardMaterial color={yellowColor} roughness={0.45} />
        </mesh>
      ))}

      {/* Left Edge (X = -BUILDING_W / 2) */}
      <mesh position={[-BUILDING_W / 2 + 0.05, railH, 0]}>
        <boxGeometry args={[0.035, 0.035, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      <mesh position={[-BUILDING_W / 2 + 0.05, railH * 0.5, 0]}>
        <boxGeometry args={[0.025, 0.025, BUILDING_D - 0.2]} />
        <meshStandardMaterial color={yellowColor} roughness={0.45} />
      </mesh>
      {[-3.4, -1.7, 0, 1.7, 3.4].map((z) => (
        <mesh key={`post-l-${z}`} position={[-BUILDING_W / 2 + 0.05, railH / 2, z]}>
          <boxGeometry args={[0.035, railH, 0.035]} />
          <meshStandardMaterial color={yellowColor} roughness={0.45} />
        </mesh>
      ))}
    </group>
  );
}

// ─── 11. Roof Assembly with Penthouse Overrun & Materials ──────────────────────
function RoofAssembly({
  isSectioned,
}: {
  isSectioned: boolean;
}) {
  if (isSectioned) return null;
  const elevation = 4 * FLOOR_H;

  return (
    <group position={[0, elevation, 0]}>
      {/* Roof slab */}
      <mesh position={[0, SLAB_T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BUILDING_W + 0.1, SLAB_T, BUILDING_D + 0.1]} />
        <meshStandardMaterial color="#cbd5e1" roughness={0.7} />
      </mesh>

      {/* High-vis Yellow Perimeter Railings on Roof */}
      <EdgeRailingsMesh floorBaseElevation={0} />

      {/* Column stubs extending up with exposed steel rebar dowels on roof */}
      {COL_X.map((cx) =>
        COL_Z.map((cz) => {
          if (Math.abs(cx - CORE_X) < 1.4 && Math.abs(cz - CORE_Z) < 1.4) return null;
          return (
            <group key={`roof-col-${cx}-${cz}`} position={[cx, SLAB_T, cz]}>
              <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
                <boxGeometry args={[COL_W, 1.3, COL_W]} />
                <meshStandardMaterial color="#cbd5e1" roughness={0.6} />
              </mesh>
              {[-0.12, 0.12].map((rx) =>
                [-0.12, 0.12].map((rz) => (
                  <mesh key={`rebar-${rx}-${rz}`} position={[rx, 1.65, rz]}>
                    <cylinderGeometry args={[0.016, 0.016, 0.8, 6]} />
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
        <mesh position={[0, 1.8, 0]} castShadow receiveShadow>
          <boxGeometry args={[CORE_W + 0.2, 3.6, CORE_D + 0.2]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.7} />
        </mesh>
        <mesh position={[0, 3.65, 0]} castShadow>
          <boxGeometry args={[CORE_W + 0.4, 0.16, CORE_D + 0.4]} />
          <meshStandardMaterial color="#64748b" roughness={0.6} />
        </mesh>
      </group>

      {/* Timber Formwork Pallets with Cement / Blocks on Roof */}
      <group position={[-2.8, SLAB_T + 0.12, 1.2]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.22, 1.4]} />
          <meshStandardMaterial color="#d97706" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.5, 0.35, 1.1]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      </group>
      <group position={[0.8, SLAB_T + 0.12, -1.8]}>
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.22, 1.4]} />
          <meshStandardMaterial color="#d97706" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[1.4, 0.35, 1.1]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ─── 12. Single Complete Floor Assembly ───────────────────────────────────────
function FloorAssembly({
  level,
  floorIndex,
  elements,
  selectedElementId,
  sectionMode,
  activeLevelIndex,
  onElementClick,
}: {
  level: BuildingLevel;
  floorIndex: number;
  elements: ModelElement[];
  selectedElementId: string | null;
  sectionMode: boolean;
  activeLevelIndex: number;
  onElementClick: (el: ModelElement) => void;
}) {
  if (sectionMode && floorIndex > activeLevelIndex) {
    return null;
  }

  const baseElevation = floorIndex * FLOOR_H;
  const slabEl  = elements.find((e) => e.elementType === "slab");
  const colEl   = elements.find((e) => e.elementType === "columns");
  const beamEl  = elements.find((e) => e.elementType === "beams");
  const coreEl  = elements.find((e) => e.elementType === "core");

  return (
    <group>
      {/* 1. Concrete Slab */}
      {slabEl && (
        <SlabMesh
          elevation={baseElevation}
          level={level}
          isSelected={selectedElementId === slabEl.id}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(slabEl);
          }}
        />
      )}

      {/* 2. Concrete Columns */}
      {colEl && (
        <ColumnsMesh
          floorBaseElevation={baseElevation}
          level={level}
          isSelected={selectedElementId === colEl.id}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(colEl);
          }}
        />
      )}

      {/* 3. Concrete Beams */}
      {beamEl && (
        <BeamsMesh
          floorBaseElevation={baseElevation}
          isSelected={selectedElementId === beamEl.id}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(beamEl);
          }}
        />
      )}

      {/* 4. Core Wall */}
      {coreEl && (
        <CoreMesh
          floorBaseElevation={baseElevation}
          level={level}
          isSelected={selectedElementId === coreEl.id}
          onClick={(e) => {
            e.stopPropagation();
            onElementClick(coreEl);
          }}
        />
      )}

      {/* 5. Realistic Concrete Stairs */}
      <RealisticStairs floorBaseElevation={baseElevation} />

      {/* 6. High-Visibility Yellow Edge Railings */}
      <EdgeRailingsMesh floorBaseElevation={baseElevation} />
    </group>
  );
}

// ─── 13. Dynamic Screen Projector with SVG Leader Lines ───────────────────────
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
}) {
  const { camera, size } = useThree();
  const tempV = useMemo(() => new THREE.Vector3(), []);

  // Precise 3D Anchor positions:
  // 1. Column target: front blue column on Level 2
  const vecCol = useMemo(() => new THREE.Vector3(-1.8, 2 * FLOOR_H + 1.8, 3.2), []);
  // 2. Slab target: front-left corner edge of green slab on Level 1
  const vecSlab = useMemo(() => new THREE.Vector3(-BUILDING_W / 2 + 0.4, 1 * FLOOR_H + SLAB_T + 0.05, BUILDING_D / 2 - 0.2), []);
  // 3. Core target: red core wall on Level 2
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

    // ─── 1. Level 2 - Columns Callout ──────────────────────────
    tempV.copy(vecCol).project(camera);
    if (tempV.z > 1) {
      if (colCardRef.current) colCardRef.current.style.display = "none";
      if (colGroupRef.current) colGroupRef.current.style.display = "none";
    } else {
      const cx = ((tempV.x + 1) * size.width) / 2;
      const cy = ((-tempV.y + 1) * size.height) / 2;

      const cardX = cx - 85;
      const cardY = cy - 135;

      if (colCardRef.current) {
        colCardRef.current.style.display = "block";
        colCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = cardX + 115;
      const lineStartY = cardY + 76;

      if (colGroupRef.current) colGroupRef.current.style.display = "block";
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

    // ─── 2. Level 1 - Slab Callout ─────────────────────────────
    tempV.copy(vecSlab).project(camera);
    if (tempV.z > 1) {
      if (slabCardRef.current) slabCardRef.current.style.display = "none";
      if (slabGroupRef.current) slabGroupRef.current.style.display = "none";
    } else {
      const sx = ((tempV.x + 1) * size.width) / 2;
      const sy = ((-tempV.y + 1) * size.height) / 2;

      const cardX = sx - 195;
      const cardY = sy - 26;

      if (slabCardRef.current) {
        slabCardRef.current.style.display = "block";
        slabCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = cardX + 148;
      const lineStartY = cardY + 26;

      if (slabGroupRef.current) slabGroupRef.current.style.display = "block";
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

    // ─── 3. Core Wall Callout ──────────────────────────────────
    tempV.copy(vecCore).project(camera);
    if (tempV.z > 1) {
      if (coreCardRef.current) coreCardRef.current.style.display = "none";
      if (coreGroupRef.current) coreGroupRef.current.style.display = "none";
    } else {
      const rx = ((tempV.x + 1) * size.width) / 2;
      const ry = ((-tempV.y + 1) * size.height) / 2;

      const cardX = rx + 80;
      const cardY = ry - 42;

      if (coreCardRef.current) {
        coreCardRef.current.style.display = "block";
        coreCardRef.current.style.transform = `translate3d(${cardX}px, ${cardY}px, 0)`;
      }

      const lineStartX = cardX;
      const lineStartY = cardY + 36;

      if (coreGroupRef.current) coreGroupRef.current.style.display = "block";
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

// ─── 14. Camera Controller ────────────────────────────────────────────────────
function CameraController({
  viewMode,
  controlsRef,
}: {
  targetLevel: BuildingLevel;
  viewMode: string;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}) {
  const { camera } = useThree();

  useEffect(() => {
    if (viewMode === "top") {
      camera.position.set(0, 48, 0.01);
      camera.lookAt(0, 5, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 5, 0);
        controlsRef.current.update();
      }
    } else if (viewMode === "2d") {
      camera.position.set(0, 8, 36);
      camera.lookAt(0, 7, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0, 7, 0);
        controlsRef.current.update();
      }
    } else {
      // Matching exact camera scale and angle from reference image
      camera.position.set(27.5, 24.0, 27.5);
      camera.lookAt(0.3, 6.0, 0);
      if (controlsRef.current) {
        controlsRef.current.target.set(0.3, 6.0, 0);
        controlsRef.current.update();
      }
    }
  }, [viewMode, camera, controlsRef]);

  return null;
}

// ─── 15. Main Scene Graph ─────────────────────────────────────────────────────
function Scene({
  selectedLevel,
  selectedElementId,
  viewMode,
  dragMode,
  sectionMode,
  controlsRef,
  onElementClick,
}: {
  selectedLevel: BuildingLevel;
  selectedElementId: string | null;
  elementFilter: ElementFilter;
  viewMode: string;
  dragMode: "pan" | "orbit";
  sectionMode: boolean;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
  onElementClick: (el: ModelElement) => void;
}) {
  const levelOrder: BuildingLevel[] = ["Ground", "Level 1", "Level 2", "Level 3", "Level 4", "Roof"];
  const activeLevelIndex = Math.max(0, levelOrder.indexOf(selectedLevel));

  return (
    <>
      {/* Background Daylight Color and Atmospheric Lighting */}
      <color attach="background" args={["#f1f5f9"]} />

      <ambientLight intensity={1.15} />
      <directionalLight
        position={[26, 32, 22]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={120}
        shadow-camera-left={-30}
        shadow-camera-right={30}
        shadow-camera-top={30}
        shadow-camera-bottom={-30}
        shadow-bias={-0.0001}
      />
      <directionalLight position={[-20, 16, -20]} intensity={0.45} />
      <directionalLight position={[0, -6, 24]} intensity={0.2} />
      <hemisphereLight args={[0xffffff, 0xf1f5f9, 0.65]} />

      <CameraController
        targetLevel={selectedLevel}
        viewMode={viewMode}
        controlsRef={controlsRef}
      />

      <OrbitControls
        ref={controlsRef}
        enableDamping
        dampingFactor={0.08}
        minDistance={8}
        maxDistance={90}
        maxPolarAngle={viewMode === "top" ? 0.01 : Math.PI / 2.05}
        enablePan
        panSpeed={0.8}
        rotateSpeed={0.65}
        zoomSpeed={1.1}
        screenSpacePanning
        mouseButtons={{
          LEFT: dragMode === "pan" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.PAN,
        }}
      />

      {/* Site Ground, Apron, Roads, Fence & Context */}
      <SiteSurroundings />

      {/* Architectural Storeys */}
      {levelOrder.map((level, idx) => {
        if (level === "Roof") return null;
        const elements = getElementsForLevel(level);

        return (
          <FloorAssembly
            key={level}
            level={level}
            floorIndex={idx}
            elements={elements}
            selectedElementId={selectedElementId}
            sectionMode={sectionMode}
            activeLevelIndex={activeLevelIndex}
            onElementClick={onElementClick}
          />
        );
      })}

      {/* Roof Deck */}
      <RoofAssembly
        isSectioned={sectionMode && activeLevelIndex < 4}
      />
    </>
  );
}

// ─── 16. Exported BuildingCanvas Component ─────────────────────────────────────
export interface BuildingCanvasProps {
  selectedLevel: BuildingLevel;
  selectedElementId: string | null;
  elementFilter: ElementFilter;
  viewMode: string;
  dragMode?: "pan" | "orbit";
  sectionMode?: boolean;
  showCallouts?: boolean;
  onElementClick: (el: ModelElement) => void;
  controlsRef: React.RefObject<OrbitControlsImpl | null>;
}

export function BuildingCanvas({
  selectedLevel,
  selectedElementId,
  elementFilter,
  viewMode = "3d",
  dragMode = "orbit",
  sectionMode = false,
  showCallouts = true,
  onElementClick,
  controlsRef,
}: BuildingCanvasProps) {
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

  const colElLvl2 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-021"), []);
  const coreElLvl2 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-022"), []);
  const slabElLvl1 = useMemo(() => MODEL_ELEMENTS.find((e) => e.id === "PRG-010"), []);

  return (
    <div className="relative h-full w-full overflow-hidden select-none bg-[#f1f5f9]">
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
        <PerspectiveCamera makeDefault position={[27.5, 24.0, 27.5]} fov={33} near={0.5} far={250} />
        <Suspense fallback={null}>
          <Scene
            selectedLevel={selectedLevel}
            selectedElementId={selectedElementId}
            elementFilter={elementFilter}
            viewMode={viewMode}
            dragMode={dragMode}
            sectionMode={sectionMode}
            controlsRef={controlsRef}
            onElementClick={onElementClick}
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
          />
        </Suspense>
      </Canvas>

      {/* Dynamic Screen-Space SVG Overlay Layer for Leader Lines & Anchor Rings */}
      <svg className="absolute inset-0 pointer-events-none w-full h-full z-20">
        {/* Callout 1 (Columns) Leader Line & Ring */}
        <g ref={colGroupRef} style={{ display: "none" }}>
          <line ref={colLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.5" />
          <circle ref={colOuterRingRef} cx={0} cy={0} r={6.5} fill="#ffffff" stroke="#0066ff" strokeWidth={2.2} />
          <circle ref={colInnerDotRef} cx={0} cy={0} r={2.5} fill="#0066ff" />
        </g>
        {/* Callout 2 (Slab) Leader Line & Ring */}
        <g ref={slabGroupRef} style={{ display: "none" }}>
          <line ref={slabLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.5" />
          <circle ref={slabOuterRingRef} cx={0} cy={0} r={6.5} fill="#ffffff" stroke="#10b981" strokeWidth={2.2} />
          <circle ref={slabInnerDotRef} cx={0} cy={0} r={2.5} fill="#10b981" />
        </g>
        {/* Callout 3 (Core Wall) Leader Line & Ring */}
        <g ref={coreGroupRef} style={{ display: "none" }}>
          <line ref={coreLineRef} x1={0} y1={0} x2={0} y2={0} stroke="#94a3b8" strokeWidth="1.5" />
          <circle ref={coreOuterRingRef} cx={0} cy={0} r={6.5} fill="#ffffff" stroke="#ef4444" strokeWidth={2.2} />
          <circle ref={coreInnerDotRef} cx={0} cy={0} r={2.5} fill="#ef4444" />
        </g>
      </svg>

      {/* ─── Callout 1: Level 2 - Columns (Matching Visual Reference) ─── */}
      <div
        ref={colCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (colElLvl2) onElementClick(colElLvl2);
        }}
        className="absolute left-0 top-0 cursor-pointer select-none rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-md transition-transform duration-150 hover:scale-105 pointer-events-auto"
        style={{
          zIndex: 25,
          minWidth: 175,
          willChange: "transform",
          boxShadow: "0 4px 18px -2px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="flex h-3 w-3 items-center justify-center rounded-full border-2 border-blue-600 bg-white">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
          </span>
          <span className="text-[12.5px] font-bold text-slate-900 tracking-tight">
            Level 2 - Columns
          </span>
        </div>
        <div className="text-[11px] font-semibold text-slate-500 mb-0.5 ml-4.5">
          60% complete
        </div>
        <div className="text-[10px] text-slate-400 font-medium ml-4.5">
          20 Dec 2025 – 16 Jan 2026
        </div>
      </div>

      {/* ─── Callout 2: Level 1 - Slab (Matching Visual Reference) ─── */}
      <div
        ref={slabCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (slabElLvl1) onElementClick(slabElLvl1);
        }}
        className="absolute left-0 top-0 cursor-pointer select-none rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-md transition-transform duration-150 hover:scale-105 pointer-events-auto"
        style={{
          zIndex: 26,
          minWidth: 145,
          willChange: "transform",
          boxShadow: "0 4px 18px -2px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-[12.5px] font-bold text-slate-900 tracking-tight">
            Level 1 - Slab
          </span>
        </div>
        <div className="text-[11px] font-semibold text-slate-500 ml-4">
          100% complete
        </div>
      </div>

      {/* ─── Callout 3: Core Wall (Blocked - Matching Visual Reference) ─── */}
      <div
        ref={coreCardRef}
        onClick={(e) => {
          e.stopPropagation();
          if (coreElLvl2) onElementClick(coreElLvl2);
        }}
        className="absolute left-0 top-0 cursor-pointer select-none rounded-xl border border-slate-200/90 bg-white px-3.5 py-2.5 shadow-md transition-transform duration-150 hover:scale-105 pointer-events-auto"
        style={{
          zIndex: 27,
          minWidth: 155,
          willChange: "transform",
          boxShadow: "0 4px 18px -2px rgba(15, 23, 42, 0.12), 0 2px 6px -1px rgba(15, 23, 42, 0.06)",
        }}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500 shrink-0" />
          <span className="text-[12.5px] font-bold text-slate-900 tracking-tight">
            Core Wall
          </span>
        </div>
        <div className="text-[11.5px] font-bold text-red-600 mb-0.5 ml-4">
          Blocked
        </div>
        <div className="text-[10px] text-slate-500 font-medium ml-4">
          Awaiting approval
        </div>
      </div>
    </div>
  );
}
