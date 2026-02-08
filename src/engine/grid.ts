// ============================================================================
// Grid utilities — toroidal wrapping and neighbor lookups
// ============================================================================

import type { Cell, Tile, SimulationConfig } from './types.ts';
import { TerrainType } from './types.ts';

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

/** Get Moore neighborhood positions (radius 1) with toroidal wrapping */
export function getNeighborPositions(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number = 1
): [number, number][] {
  const positions: [number, number][] = [];
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      if (dx === 0 && dy === 0) continue;
      positions.push([wrap(x + dx, width), wrap(y + dy, height)]);
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

/** Generate terrain with variety */
export function generateTerrain(
  environment: Tile[],
  width: number,
  height: number
): void {
  // Create patches of different terrain types using simple noise
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
      // Fertile with variation
      terrain = TerrainType.FertilePlains;
      baseEnergy = 5.0 + Math.random() * 3.0;
      regenRate = 0.3 + Math.random() * 0.4;
    }

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = wrap(cx + dx, width);
        const ny = wrap(cy + dy, height);
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
