// ============================================================================
// Grid utilities — hex grid with toroidal wrapping (odd-r offset coordinates)
// ============================================================================
//
// Hex grid uses "odd-r" offset coordinates:
// - Odd rows (y % 2 == 1) are shifted right by half a cell width
// - Each cell has 6 neighbors instead of 8 (Moore)
//
// Neighbor offsets differ by row parity:
//   Even row (y%2==0):  (-1,-1) (0,-1)  /  (-1,0) (+1,0)  /  (-1,+1) (0,+1)
//   Odd  row (y%2==1):  (0,-1) (+1,-1)  /  (-1,0) (+1,0)  /  (0,+1) (+1,+1)

import type { Cell, Tile, SimulationConfig } from './types.ts';
import { TerrainType } from './types.ts';

/** Hex neighbor offsets for even rows (y % 2 == 0) */
const HEX_EVEN_ROW: readonly [number, number][] = [
  [-1, -1], [0, -1],  // upper-left, upper-right
  [-1,  0], [1,  0],  // left, right
  [-1,  1], [0,  1],  // lower-left, lower-right
];

/** Hex neighbor offsets for odd rows (y % 2 == 1) */
const HEX_ODD_ROW: readonly [number, number][] = [
  [0, -1], [1, -1],   // upper-left, upper-right
  [-1, 0], [1,  0],   // left, right
  [0,  1], [1,  1],   // lower-left, lower-right
];

/** Wrap coordinate for toroidal grid */
export function wrap(val: number, size: number): number {
  return ((val % size) + size) % size;
}

/** Convert (x, y) to flat array index */
export function toIndex(x: number, y: number, width: number): number {
  return y * width + x;
}

/** Convert flat index to (x, y) */
export function fromIndex(index: number, width: number): [number, number] {
  return [index % width, Math.floor(index / width)];
}

// ============================================================================
// Cube coordinate helpers for extended hex neighborhoods
// ============================================================================

/** Convert odd-r offset coords to cube coords */
function offsetToCube(x: number, y: number): [number, number, number] {
  const q = x - Math.floor((y - (y & 1)) / 2);
  const r = y;
  const s = -q - r;
  return [q, r, s];
}

/** Convert cube coords to odd-r offset coords */
function cubeToOffset(q: number, r: number): [number, number] {
  const x = q + Math.floor((r - (r & 1)) / 2);
  const y = r;
  return [x, y];
}

/** Hex distance in cube coordinates */
function hexDistanceCube(q1: number, r1: number, s1: number, q2: number, r2: number, s2: number): number {
  return Math.max(Math.abs(q1 - q2), Math.abs(r1 - r2), Math.abs(s1 - s2));
}

// ============================================================================
// Neighbor lookups
// ============================================================================

/** Get hex neighborhood positions with toroidal wrapping.
 *  radius=1: 6 neighbors, radius=2: 18 neighbors, radius=3: 36 neighbors */
export function getNeighborPositions(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 1
): [number, number][] {
  if (radius === 1) {
    // Fast path for the common case
    const offsets = (y % 2 === 0) ? HEX_EVEN_ROW : HEX_ODD_ROW;
    const positions: [number, number][] = [];
    for (const [dx, dy] of offsets) {
      positions.push([wrap(x + dx, width), wrap(y + dy, height)]);
    }
    return positions;
  }

  // Extended radius via cube coordinates
  const [cq, cr, cs] = offsetToCube(x, y);
  const positions: [number, number][] = [];

  for (let dq = -radius; dq <= radius; dq++) {
    for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
      const ds = -dq - dr;
      if (dq === 0 && dr === 0 && ds === 0) continue;
      const [ox, oy] = cubeToOffset(cq + dq, cr + dr);
      positions.push([wrap(ox, width), wrap(oy, height)]);
    }
  }

  return positions;
}

/** Get neighbor cells for a given position */
export function getNeighborCells(
  x: number,
  y: number,
  grid: (Cell | null)[],
  width: number,
  height: number,
  radius: number = 1
): { cell: Cell; x: number; y: number }[] {
  const result: { cell: Cell; x: number; y: number }[] = [];
  const positions = getNeighborPositions(x, y, width, height, radius);
  for (const [nx, ny] of positions) {
    const cell = grid[toIndex(nx, ny, width)];
    if (cell) {
      result.push({ cell, x: nx, y: ny });
    }
  }
  return result;
}

/** Get empty neighbor positions */
export function getEmptyNeighborPositions(
  x: number,
  y: number,
  grid: (Cell | null)[],
  width: number,
  height: number,
): [number, number][] {
  const result: [number, number][] = [];
  const positions = getNeighborPositions(x, y, width, height, 1);
  for (const [nx, ny] of positions) {
    if (!grid[toIndex(nx, ny, width)]) {
      result.push([nx, ny]);
    }
  }
  return result;
}

/** Initialize environment tiles */
export function createEnvironment(config: SimulationConfig): Tile[] {
  const tiles: Tile[] = new Array(config.width * config.height);
  for (let i = 0; i < tiles.length; i++) {
    tiles[i] = {
      energy: 5.0,
      terrain: TerrainType.FertilePlains,
      baseEnergy: 5.0,
      regenRate: 0.5,
      currentDirX: 0,
      currentDirY: 0,
    };
  }
  return tiles;
}

/** Generate terrain with variety (uses hex distance for patch shape) */
export function generateTerrain(
  environment: Tile[],
  width: number,
  height: number
): void {
  const numPatches = Math.floor((width * height) / 400);

  for (let i = 0; i < numPatches; i++) {
    const cx = Math.floor(Math.random() * width);
    const cy = Math.floor(Math.random() * height);
    const radius = 3 + Math.floor(Math.random() * 8);
    const roll = Math.random();

    let terrain: TerrainType;
    let baseEnergy: number;
    let regenRate: number;

    if (roll < 0.3) {
      terrain = TerrainType.BarrenWasteland;
      baseEnergy = 0.5 + Math.random() * 1.0;
      regenRate = 0.05;
    } else if (roll < 0.4) {
      terrain = TerrainType.Oasis;
      baseEnergy = 10.0;
      regenRate = 0.2;
    } else if (roll < 0.5) {
      terrain = TerrainType.ToxicZone;
      baseEnergy = 3.0;
      regenRate = 0.3;
    } else if (roll < 0.55) {
      terrain = TerrainType.DeepVent;
      baseEnergy = 0.0;
      regenRate = 0.0;
    } else if (roll < 0.6) {
      terrain = TerrainType.FlowCurrent;
      baseEnergy = 2.0;
      regenRate = 0.1;
    } else {
      terrain = TerrainType.FertilePlains;
      baseEnergy = 5.0 + Math.random() * 3.0;
      regenRate = 0.3 + Math.random() * 0.4;
    }

    // Use hex-aware distance for natural-looking patches
    const [cq, cr, cs] = offsetToCube(cx, cy);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = wrap(cx + dx, width);
        const ny = wrap(cy + dy, height);
        const [nq, nr, ns] = offsetToCube(nx, ny);
        if (hexDistanceCube(cq, cr, cs, nq, nr, ns) > radius) continue;
        const idx = toIndex(nx, ny, width);
        environment[idx].terrain = terrain;
        environment[idx].baseEnergy = baseEnergy;
        environment[idx].regenRate = regenRate;
        environment[idx].energy = baseEnergy;
        if (terrain === TerrainType.FlowCurrent) {
          const angle = Math.random() * Math.PI * 2;
          environment[idx].currentDirX = Math.round(Math.cos(angle));
          environment[idx].currentDirY = Math.round(Math.sin(angle));
        }
      }
    }
  }
}
