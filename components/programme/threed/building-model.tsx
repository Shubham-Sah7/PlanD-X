"use client";

import React from "react";
import type { BuildingTask, ElementStatus } from "./threed-data";
import { STATUS_COLORS, getTasksForLevel } from "./threed-data";

interface BuildingModelProps {
  selectedLevel: string;
  selectedTaskId: string | null;
  highlightFilter: string | null; // "blocked" | "overdue" | "critical" | "due-this-week" | null
  onTaskSelect: (task: BuildingTask) => void;
  onLevelSelect: (level: string) => void;
}

// Isometric building model drawn in SVG
// Coordinate system: isometric projection
// Each level stacks vertically

const LEVEL_HEIGHT = 68; // px height of each floor in isometric
const BUILDING_W = 380;
const BUILDING_D = 180;

// Convert isometric coordinates to screen x,y
// iso_x, iso_y = grid position, z = height
function iso(x: number, y: number): [number, number] {
  return [
    x - y,
    (x + y) * 0.5,
  ];
}

// Scale factors
const SX = 1.0;
const SY = 1.0;

interface FloorConfig {
  level: string;
  levelIndex: number; // 0 = ground
  z: number; // vertical offset in px (0 = base)
}

const FLOORS: FloorConfig[] = [
  { level: "Ground", levelIndex: 0, z: 0 },
  { level: "Level 1", levelIndex: 1, z: 68 },
  { level: "Level 2", levelIndex: 2, z: 136 },
  { level: "Level 3", levelIndex: 3, z: 204 },
  { level: "Level 4", levelIndex: 4, z: 272 },
  { level: "Roof", levelIndex: 5, z: 340 },
];

function getStatusFill(status: ElementStatus, opacity: number = 1): string {
  const color = STATUS_COLORS[status];
  if (opacity < 1) {
    // Convert hex to rgb
    const hex = color.fill.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${opacity})`;
  }
  return color.fill;
}

// Pulsing dot for in-progress hotspot
function HotspotDot({
  cx,
  cy,
  status,
  isSelected,
  onClick,
  label,
}: {
  cx: number;
  cy: number;
  status: ElementStatus;
  isSelected: boolean;
  onClick: () => void;
  label: string;
}) {
  const color = STATUS_COLORS[status].fill;
  return (
    <g onClick={onClick} style={{ cursor: "pointer" }}>
      {/* Outer ring */}
      <circle cx={cx} cy={cy} r={isSelected ? 10 : 8} fill="white" stroke={color} strokeWidth={isSelected ? 2.5 : 1.5} opacity={0.95} />
      {/* Inner dot */}
      <circle cx={cx} cy={cy} r={isSelected ? 5 : 4} fill={color} />
      {/* Pulse ring for in-progress */}
      {status === "in-progress" && (
        <circle cx={cx} cy={cy} r={12} fill="none" stroke={color} strokeWidth={1} opacity={0.3}>
          <animate attributeName="r" values="8;14;8" dur="2s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.4;0;0.4" dur="2s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}

export function BuildingModel({
  selectedLevel,
  selectedTaskId,
  highlightFilter,
  onTaskSelect,
  onLevelSelect,
}: BuildingModelProps) {
  // SVG viewBox: wide enough for the isometric building
  const viewW = 540;
  const viewH = 520;
  // Offset to center the building
  const originX = 270;
  const originY = 450;

  // Building corners in isometric grid (bx, by = grid units)
  // The building is a rectangle: 4 wide, 2.5 deep
  const bW = 4.2;  // width in grid units
  const bD = 2.8;  // depth in grid units
  const scale = 65; // pixels per grid unit

  // Each "floor" is drawn as a box
  const floorH = 0.9; // height of one storey in grid units

  // Convert grid position to SVG coords
  function toSVG(gx: number, gy: number, gz: number): { x: number; y: number } {
    const [ix, iy] = iso(gx * scale, gy * scale);
    return {
      x: originX + ix * SX,
      y: originY - gz * scale * 0.6 + iy * SY,
    };
  }

  // Draw a floor slab polygon (top face + two side faces)
  function FloorBox({
    gz,
    level,
    tasks,
    isSelected,
    isActiveLevel,
  }: {
    gz: number;
    level: string;
    tasks: BuildingTask[];
    isSelected: boolean;
    isActiveLevel: boolean;
  }) {
    const slabTask = tasks.find((t) => t.elementType === "slab");
    const slabStatus: ElementStatus = slabTask?.status ?? "not-started";

    // Dim non-selected levels
    const alpha = isActiveLevel ? 1 : isSelected ? 0.85 : 0.55;
    const topAlpha = isActiveLevel ? 0.92 : 0.4;

    // Corners of the floor top face
    const tl = toSVG(0, 0, gz + floorH);
    const tr = toSVG(bW, 0, gz + floorH);
    const br = toSVG(bW, bD, gz + floorH);
    const bl = toSVG(0, bD, gz + floorH);

    // Bottom corners for side faces
    const btl = toSVG(0, 0, gz);
    const btr = toSVG(bW, 0, gz);
    const bbr = toSVG(bW, bD, gz);
    const bbl = toSVG(0, bD, gz);

    const isLevelComplete = slabStatus === "complete";
    const topFill = isActiveLevel
      ? getStatusFill(slabStatus, topAlpha)
      : isLevelComplete
        ? `rgba(209,250,229,${topAlpha})`
        : `rgba(248,250,252,${topAlpha})`;

    const rightFaceColor = isLevelComplete ? "#d1fae5" : "#e2e8f0";
    const leftFaceColor = isLevelComplete ? "#a7f3d0" : "#f1f5f9";

    return (
      <g
        onClick={() => onLevelSelect(level)}
        style={{ cursor: "pointer" }}
        opacity={alpha}
      >
        {/* Left face (south-west) */}
        <polygon
          points={`${bbl.x},${bbl.y} ${bl.x},${bl.y} ${tl.x},${tl.y} ${btl.x},${btl.y}`}
          fill={leftFaceColor}
          stroke={isActiveLevel ? "#94a3b8" : "#cbd5e1"}
          strokeWidth={isActiveLevel ? 1.5 : 0.75}
        />
        {/* Right face (south-east) */}
        <polygon
          points={`${bbl.x},${bbl.y} ${bbr.x},${bbr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
          fill={rightFaceColor}
          stroke={isActiveLevel ? "#94a3b8" : "#cbd5e1"}
          strokeWidth={isActiveLevel ? 1.5 : 0.75}
        />
        {/* Top face */}
        <polygon
          points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
          fill={topFill}
          stroke={isActiveLevel ? (slabStatus === "in-progress" ? STATUS_COLORS["in-progress"].stroke : "#94a3b8") : "#cbd5e1"}
          strokeWidth={isActiveLevel ? 1.5 : 0.75}
        />
        {/* Level label */}
        {isActiveLevel && (
          <text
            x={(tl.x + br.x) / 2}
            y={(tl.y + br.y) / 2 - 2}
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill={slabStatus === "complete" ? "#065f46" : slabStatus === "in-progress" ? "#1e40af" : "#475569"}
            fontFamily="Inter, sans-serif"
            style={{ pointerEvents: "none" }}
          >
            {level.toUpperCase()}
          </text>
        )}
      </g>
    );
  }

  // Draw columns for a level
  function LevelColumns({
    gz,
    level,
    task,
    isActiveLevel,
  }: {
    gz: number;
    level: string;
    task: BuildingTask | undefined;
    isActiveLevel: boolean;
  }) {
    if (!isActiveLevel || !task) return null;
    const status = task.status;
    const color = STATUS_COLORS[status].fill;
    const colPositions: [number, number][] = [
      [0, 0], [bW, 0], [0, bD], [bW, bD],
      [bW / 2, 0], [0, bD / 2],
    ];
    const colW = 0.15;
    const colH = floorH;

    return (
      <g>
        {colPositions.map(([cx, cy], i) => {
          const base = toSVG(cx - colW / 2, cy - colW / 2, gz + floorH);
          const top = toSVG(cx - colW / 2, cy - colW / 2, gz + floorH + colH);
          const topR = toSVG(cx + colW / 2, cy - colW / 2, gz + floorH + colH);
          const topBR = toSVG(cx + colW / 2, cy + colW / 2, gz + floorH + colH);
          const topBL = toSVG(cx - colW / 2, cy + colW / 2, gz + floorH + colH);
          const baseR = toSVG(cx + colW / 2, cy - colW / 2, gz + floorH);
          const baseBR = toSVG(cx + colW / 2, cy + colW / 2, gz + floorH);
          const baseBL = toSVG(cx - colW / 2, cy + colW / 2, gz + floorH);

          return (
            <g key={i} onClick={(e) => { e.stopPropagation(); onTaskSelect(task); }} style={{ cursor: "pointer" }}>
              {/* Column right face */}
              <polygon
                points={`${baseBL.x},${baseBL.y} ${baseBR.x},${baseBR.y} ${topBR.x},${topBR.y} ${topBL.x},${topBL.y}`}
                fill={color}
                fillOpacity={0.7}
                stroke={STATUS_COLORS[status].stroke}
                strokeWidth={0.8}
              />
              {/* Column front face */}
              <polygon
                points={`${base.x},${base.y} ${baseR.x},${baseR.y} ${topR.x},${topR.y} ${top.x},${top.y}`}
                fill={color}
                fillOpacity={0.85}
                stroke={STATUS_COLORS[status].stroke}
                strokeWidth={0.8}
              />
              {/* Column top */}
              <polygon
                points={`${top.x},${top.y} ${topR.x},${topR.y} ${topBR.x},${topBR.y} ${topBL.x},${topBL.y}`}
                fill={color}
                fillOpacity={0.95}
                stroke={STATUS_COLORS[status].stroke}
                strokeWidth={0.8}
              />
            </g>
          );
        })}
      </g>
    );
  }

  // Draw core walls for a level
  function CoreWalls({
    gz,
    level,
    task,
    isActiveLevel,
  }: {
    gz: number;
    level: string;
    task: BuildingTask | undefined;
    isActiveLevel: boolean;
  }) {
    if (!isActiveLevel || !task) return null;
    const status = task.status;
    const color = STATUS_COLORS[status].fill;

    // Core is at the centre-right of the building
    const cx = bW * 0.6, cy = bD * 0.4;
    const cW = 0.6, cD = 0.5;
    const cH = floorH * 0.95;
    const base_gz = gz + floorH;

    const corners = [
      toSVG(cx, cy, base_gz),
      toSVG(cx + cW, cy, base_gz),
      toSVG(cx + cW, cy + cD, base_gz),
      toSVG(cx, cy + cD, base_gz),
      toSVG(cx, cy, base_gz + cH),
      toSVG(cx + cW, cy, base_gz + cH),
      toSVG(cx + cW, cy + cD, base_gz + cH),
      toSVG(cx, cy + cD, base_gz + cH),
    ];

    const [b0, b1, b2, b3, t0, t1, t2, t3] = corners;

    return (
      <g onClick={(e) => { e.stopPropagation(); onTaskSelect(task); }} style={{ cursor: "pointer" }}>
        {/* Left wall */}
        <polygon points={`${b3.x},${b3.y} ${b0.x},${b0.y} ${t0.x},${t0.y} ${t3.x},${t3.y}`}
          fill={color} fillOpacity={0.6} stroke={STATUS_COLORS[status].stroke} strokeWidth={0.8} />
        {/* Right wall */}
        <polygon points={`${b3.x},${b3.y} ${b2.x},${b2.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`}
          fill={color} fillOpacity={0.7} stroke={STATUS_COLORS[status].stroke} strokeWidth={0.8} />
        {/* Top */}
        <polygon points={`${t0.x},${t0.y} ${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`}
          fill={color} fillOpacity={0.85} stroke={STATUS_COLORS[status].stroke} strokeWidth={0.8} />
      </g>
    );
  }

  // Hotspot positions for each level's tasks
  function LevelHotspots({
    gz,
    tasks,
    isActiveLevel,
  }: {
    gz: number;
    tasks: BuildingTask[];
    isActiveLevel: boolean;
  }) {
    if (!isActiveLevel) return null;

    const hotspotPositions: Record<string, { gx: number; gy: number }> = {
      "slab": { gx: 1.5, gy: 1.8 },
      "columns": { gx: 0.6, gy: 0.5 },
      "core": { gx: bW * 0.6 + 0.3, gy: bD * 0.4 + 0.25 },
      "facade": { gx: 3.8, gy: 1.4 },
      "stairs": { gx: 0.3, gy: 1.8 },
      "plant": { gx: 2.0, gy: 1.0 },
      "walls": { gx: 2.0, gy: 2.2 },
    };

    return (
      <>
        {tasks.map((task) => {
          const pos = hotspotPositions[task.elementType] ?? { gx: 2, gy: 1.5 };
          const svgPos = toSVG(pos.gx, pos.gy, gz + floorH + 0.3);
          const isSelected = selectedTaskId === task.id;
          return (
            <HotspotDot
              key={task.id}
              cx={svgPos.x}
              cy={svgPos.y}
              status={task.status}
              isSelected={isSelected}
              onClick={() => onTaskSelect(task)}
              label={task.name}
            />
          );
        })}
      </>
    );
  }

  const floorsToRender = FLOORS.slice(0, 5); // Ground to Level 4
  const roofFloor = FLOORS[5];

  return (
    <svg
      viewBox={`0 0 ${viewW} ${viewH}`}
      width="100%"
      height="100%"
      style={{ maxHeight: "100%", overflow: "visible" }}
    >
      {/* Ground plane */}
      {(() => {
        const g0 = toSVG(-0.3, -0.3, 0);
        const g1 = toSVG(bW + 0.3, -0.3, 0);
        const g2 = toSVG(bW + 0.3, bD + 0.3, 0);
        const g3 = toSVG(-0.3, bD + 0.3, 0);
        return (
          <polygon
            points={`${g0.x},${g0.y} ${g1.x},${g1.y} ${g2.x},${g2.y} ${g3.x},${g3.y}`}
            fill="#f1f5f9"
            stroke="#e2e8f0"
            strokeWidth={1}
          />
        );
      })()}

      {/* Floors rendered bottom to top */}
      {floorsToRender.map((floor) => {
        const gz = floor.levelIndex;
        const levelTasks = getTasksForLevel(floor.level);
        const isActiveLevel = floor.level === selectedLevel;
        const isSelected = isActiveLevel;

        const colTask = levelTasks.find((t) => t.elementType === "columns");
        const coreTask = levelTasks.find((t) => t.elementType === "core");

        return (
          <g key={floor.level}>
            <FloorBox
              gz={gz}
              level={floor.level}
              tasks={levelTasks}
              isSelected={isSelected}
              isActiveLevel={isActiveLevel}
            />
            <LevelColumns gz={gz} level={floor.level} task={colTask} isActiveLevel={isActiveLevel} />
            <CoreWalls gz={gz} level={floor.level} task={coreTask} isActiveLevel={isActiveLevel} />
            <LevelHotspots gz={gz} tasks={levelTasks} isActiveLevel={isActiveLevel} />
          </g>
        );
      })}

      {/* Roof */}
      {(() => {
        const gz = roofFloor.levelIndex;
        const roofTasks = getTasksForLevel("Roof");
        const slabTask = roofTasks.find((t) => t.elementType === "slab");
        const slabStatus: ElementStatus = slabTask?.status ?? "not-started";
        const isActive = selectedLevel === "Roof";
        const alpha = isActive ? 1 : 0.5;

        const tl = toSVG(0, 0, gz + 0.15);
        const tr = toSVG(bW, 0, gz + 0.15);
        const br = toSVG(bW, bD, gz + 0.15);
        const bl = toSVG(0, bD, gz + 0.15);
        const btl = toSVG(0, 0, gz);
        const btr = toSVG(bW, 0, gz);
        const bbr = toSVG(bW, bD, gz);
        const bbl = toSVG(0, bD, gz);

        return (
          <g onClick={() => onLevelSelect("Roof")} style={{ cursor: "pointer" }} opacity={alpha}>
            <polygon points={`${bbl.x},${bbl.y} ${bl.x},${bl.y} ${tl.x},${tl.y} ${btl.x},${btl.y}`}
              fill="#f1f5f9" stroke={isActive ? "#94a3b8" : "#cbd5e1"} strokeWidth={isActive ? 1.5 : 0.75} />
            <polygon points={`${bbl.x},${bbl.y} ${bbr.x},${bbr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
              fill="#e2e8f0" stroke={isActive ? "#94a3b8" : "#cbd5e1"} strokeWidth={isActive ? 1.5 : 0.75} />
            <polygon points={`${tl.x},${tl.y} ${tr.x},${tr.y} ${br.x},${br.y} ${bl.x},${bl.y}`}
              fill={isActive ? "#f8fafc" : "#f1f5f9"}
              stroke={isActive ? "#94a3b8" : "#cbd5e1"}
              strokeWidth={isActive ? 1.5 : 0.75}
            />
            {isActive && (
              <text x={(tl.x + br.x) / 2} y={(tl.y + br.y) / 2}
                textAnchor="middle" fontSize="9" fontWeight="600" fill="#475569"
                fontFamily="Inter, sans-serif" style={{ pointerEvents: "none" }}>ROOF</text>
            )}
          </g>
        );
      })()}

      {/* Compass / orientation indicator */}
      <g transform="translate(490, 470)">
        <circle cx={0} cy={0} r={16} fill="white" stroke="#e2e8f0" strokeWidth={1} />
        <text x={0} y={-6} textAnchor="middle" fontSize="7" fontWeight="700" fill="#64748b" fontFamily="Inter, sans-serif">N</text>
        <text x={6} y={3} textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="Inter, sans-serif">E</text>
        <text x={-6} y={3} textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="Inter, sans-serif">W</text>
        <text x={0} y={10} textAnchor="middle" fontSize="6" fill="#94a3b8" fontFamily="Inter, sans-serif">S</text>
        <line x1={0} y1={-12} x2={0} y2={12} stroke="#cbd5e1" strokeWidth={0.5} />
        <line x1={-12} y1={0} x2={12} y2={0} stroke="#cbd5e1" strokeWidth={0.5} />
      </g>

      {/* Scale bar */}
      <g transform="translate(20, 480)">
        <line x1={0} y1={0} x2={60} y2={0} stroke="#94a3b8" strokeWidth={1.5} />
        <line x1={0} y1={-3} x2={0} y2={3} stroke="#94a3b8" strokeWidth={1} />
        <line x1={60} y1={-3} x2={60} y2={3} stroke="#94a3b8" strokeWidth={1} />
        <text x={30} y={-6} textAnchor="middle" fontSize="8" fill="#64748b" fontFamily="Inter, sans-serif">~10m</text>
      </g>
    </svg>
  );
}
