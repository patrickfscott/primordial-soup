// ============================================================================
// Canvas-based Hex Grid Renderer
// ============================================================================
//
// Renders the hex grid using a 2x2-pixel-per-cell offscreen buffer.
// Odd rows are shifted right by 1 pixel to produce the hex stagger.
// Offscreen dimensions: (gridWidth * 2 + 1) x (gridHeight * 2)

import type { SimulationState, Cell, Population } from '../engine/types.ts';
import { TerrainType, SpecialistType, Season } from '../engine/types.ts';
import { fromIndex } from '../engine/grid.ts';

export interface RenderOptions {
  showEnergy: boolean;
  showTrails: boolean;
  showStructures: boolean;
  showTerrain: boolean;
  showEvents: boolean;
  cellSize: number;
}

const DEFAULT_OPTIONS: RenderOptions = {
  showEnergy: true,
  showTrails: true,
  showStructures: false,
  showTerrain: true,
  showEvents: true,
  cellSize: 4,
};

interface TrailEntry {
  x: number;
  y: number;
  r: number;
  g: number;
  b: number;
  age: number;
}

/** Convert grid (x, y) to pixel position in the offscreen hex buffer */
function hexToPixel(x: number, y: number): [number, number] {
  const px = x * 2 + (y & 1); // odd rows shift right by 1 pixel
  const py = y * 2;
  return [px, py];
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;
  private imageData: ImageData | null = null;
  private options: RenderOptions;
  private trails: TrailEntry[] = [];
  private maxTrails = 5000;
  private cameraX = 0;
  private cameraY = 0;
  private zoom = 1;
  private renderWidth = 0;
  private renderHeight = 0;

  constructor(canvas: HTMLCanvasElement, options?: Partial<RenderOptions>) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.offscreen = document.createElement('canvas');
    this.offCtx = this.offscreen.getContext('2d', { alpha: false })!;
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  setOptions(options: Partial<RenderOptions>): void {
    this.options = { ...this.options, ...options };
  }

  setCamera(x: number, y: number, zoom: number): void {
    this.cameraX = x;
    this.cameraY = y;
    this.zoom = zoom;
  }

  render(state: SimulationState): void {
    const { config, grid, environment, populations } = state;
    const { width, height } = config;

    // Offscreen buffer: 2 pixels per cell + 1 for odd-row offset
    const renderWidth = width * 2 + 1;
    const renderHeight = height * 2;

    if (this.offscreen.width !== renderWidth || this.offscreen.height !== renderHeight) {
      this.offscreen.width = renderWidth;
      this.offscreen.height = renderHeight;
      this.imageData = this.offCtx.createImageData(renderWidth, renderHeight);
      this.renderWidth = renderWidth;
      this.renderHeight = renderHeight;
    }

    if (!this.imageData) return;

    const data = this.imageData.data;

    // Clear to dark background
    for (let i = 0; i < data.length; i += 4) {
      data[i] = 8;
      data[i + 1] = 8;
      data[i + 2] = 12;
      data[i + 3] = 255;
    }

    // Draw terrain/energy background
    if (this.options.showTerrain) {
      for (let gi = 0; gi < environment.length; gi++) {
        const tile = environment[gi];
        const [gx, gy] = fromIndex(gi, width);
        const [px, py] = hexToPixel(gx, gy);

        let r = 8, g = 8, b = 12;

        switch (tile.terrain) {
          case TerrainType.FertilePlains: {
            const intensity = Math.min(1, tile.energy / 10);
            r = Math.floor(10 + intensity * 15);
            g = Math.floor(12 + intensity * 25);
            b = Math.floor(8 + intensity * 10);
            break;
          }
          case TerrainType.BarrenWasteland:
            r = 20; g = 15; b = 10;
            break;
          case TerrainType.Oasis: {
            const intensity = Math.min(1, tile.energy / 10);
            r = Math.floor(10 + intensity * 10);
            g = Math.floor(20 + intensity * 40);
            b = Math.floor(25 + intensity * 35);
            break;
          }
          case TerrainType.ToxicZone:
            r = 30; g = 10; b = 10;
            break;
          case TerrainType.DeepVent:
            r = 5; g = 5; b = 15;
            break;
          case TerrainType.FlowCurrent:
            r = 10; g = 15; b = 25;
            break;
        }

        // Energy intensity overlay
        if (this.options.showEnergy) {
          const energyBright = Math.min(1, tile.energy / 10) * 0.15;
          r = Math.min(255, Math.floor(r + energyBright * 30));
          g = Math.min(255, Math.floor(g + energyBright * 30));
          b = Math.min(255, Math.floor(b + energyBright * 15));
        }

        this.fillHexCell(data, renderWidth, px, py, r, g, b);
      }
    }

    // Draw trails (fading)
    if (this.options.showTrails) {
      const newTrails: TrailEntry[] = [];
      for (const trail of this.trails) {
        trail.age++;
        if (trail.age > 15) continue;
        newTrails.push(trail);

        const [px, py] = hexToPixel(trail.x, trail.y);
        const fade = 1 - trail.age / 15;
        const alpha = fade * 0.3;
        this.blendHexCell(data, renderWidth, px, py,
          trail.r * alpha, trail.g * alpha, trail.b * alpha);
      }
      this.trails = newTrails;
    }

    // Draw cells
    for (let gi = 0; gi < grid.length; gi++) {
      const cell = grid[gi];
      if (!cell) continue;

      const pop = populations.get(cell.populationId);
      if (!pop) continue;

      const [cr, cg, cb] = this.getCellColor(cell, pop);
      const [gx, gy] = fromIndex(gi, width);
      const [px, py] = hexToPixel(gx, gy);

      this.fillHexCell(data, renderWidth, px, py, cr, cg, cb);

      // Record trail for moving cells
      if (this.options.showTrails && (cell.dirX !== 0 || cell.dirY !== 0)) {
        if (this.trails.length < this.maxTrails) {
          this.trails.push({
            x: gx, y: gy,
            r: pop.color[0],
            g: pop.color[1],
            b: pop.color[2],
            age: 0,
          });
        }
      }
    }

    // Draw active events
    if (this.options.showEvents) {
      for (const event of state.activeEvents) {
        this.drawEventMarker(data, renderWidth, renderHeight, event);
      }
    }

    // Put image data to offscreen, then scale to main canvas
    this.offCtx.putImageData(this.imageData, 0, 0);

    // Scale to fill canvas with nearest-neighbor
    this.ctx.imageSmoothingEnabled = false;
    const displayWidth = this.canvas.width;
    const displayHeight = this.canvas.height;

    // Calculate fit-to-canvas scaling
    const scaleX = displayWidth / renderWidth;
    const scaleY = displayHeight / renderHeight;
    const scale = Math.min(scaleX, scaleY) * this.zoom;

    const offsetX = (displayWidth - renderWidth * scale) / 2 + this.cameraX;
    const offsetY = (displayHeight - renderHeight * scale) / 2 + this.cameraY;

    // Clear main canvas
    this.ctx.fillStyle = '#0a0a0f';
    this.ctx.fillRect(0, 0, displayWidth, displayHeight);

    this.ctx.drawImage(
      this.offscreen,
      0, 0, renderWidth, renderHeight,
      offsetX, offsetY, renderWidth * scale, renderHeight * scale,
    );

    // Draw season indicator
    this.drawSeasonIndicator(state);
  }

  /** Fill a 2x2 hex cell block in the ImageData */
  private fillHexCell(
    data: Uint8ClampedArray,
    renderWidth: number,
    px: number,
    py: number,
    r: number, g: number, b: number,
  ): void {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const idx = ((py + dy) * renderWidth + (px + dx)) * 4;
        if (idx >= 0 && idx < data.length - 3) {
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        }
      }
    }
  }

  /** Additive blend a 2x2 hex cell block */
  private blendHexCell(
    data: Uint8ClampedArray,
    renderWidth: number,
    px: number,
    py: number,
    r: number, g: number, b: number,
  ): void {
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const idx = ((py + dy) * renderWidth + (px + dx)) * 4;
        if (idx >= 0 && idx < data.length - 3) {
          data[idx] = Math.min(255, Math.floor(data[idx] + r));
          data[idx + 1] = Math.min(255, Math.floor(data[idx + 1] + g));
          data[idx + 2] = Math.min(255, Math.floor(data[idx + 2] + b));
        }
      }
    }
  }

  private getCellColor(cell: Cell, pop: Population): [number, number, number] {
    let [r, g, b] = pop.color;

    // Brightness based on energy
    const energyRatio = cell.energy / (cell.genome.energy.maxEnergy || 5);
    const brightness = 0.3 + energyRatio * 0.7;

    r = Math.floor(r * brightness);
    g = Math.floor(g * brightness);
    b = Math.floor(b * brightness);

    // Specialist visual modifications
    switch (cell.specialist) {
      case SpecialistType.Scout:
        r = Math.min(255, r + 50);
        g = Math.min(255, g + 50);
        b = Math.min(255, b + 50);
        break;
      case SpecialistType.Guardian:
        r = Math.floor(r * 0.6);
        g = Math.floor(g * 0.6);
        b = Math.floor(b * 0.6);
        break;
      case SpecialistType.Harvester:
        g = Math.min(255, g + 40);
        break;
      case SpecialistType.Relay: {
        const pulse = Math.sin(cell.age * 0.3) * 0.3 + 0.7;
        r = Math.floor(r * pulse);
        g = Math.floor(g * pulse);
        b = Math.floor(b * pulse);
        break;
      }
    }

    return [
      Math.max(0, Math.min(255, r)),
      Math.max(0, Math.min(255, g)),
      Math.max(0, Math.min(255, b)),
    ];
  }

  private drawEventMarker(
    data: Uint8ClampedArray,
    renderWidth: number,
    renderHeight: number,
    event: { type: string; x: number; y: number; radius: number; remainingTicks: number },
  ): void {
    const fade = Math.min(1, event.remainingTicks / 20);
    const radius = Math.min(event.radius, 3);

    let er = 255, eg = 255, eb = 255;
    switch (event.type) {
      case 'meteor': er = 255; eg = 100; eb = 0; break;
      case 'drought': er = 200; eg = 150; eb = 50; break;
      case 'bloom': er = 50; eg = 255; eb = 100; break;
      case 'plague': er = 200; eg = 0; eb = 200; break;
      case 'rift': er = 100; eg = 100; eb = 255; break;
    }

    // Draw marker at event center using hex pixel coords
    const [cpx, cpy] = hexToPixel(event.x, event.y);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const px = cpx + dx * 2;
        const py = cpy + dy * 2;
        if (px >= 0 && px < renderWidth - 1 && py >= 0 && py < renderHeight - 1) {
          this.blendHexCell(data, renderWidth, px, py,
            er * fade * 0.5, eg * fade * 0.5, eb * fade * 0.5);
        }
      }
    }
  }

  private drawSeasonIndicator(state: SimulationState): void {
    const ctx = this.ctx;
    const seasonColors: Record<string, string> = {
      [Season.Spring]: '#66ff66',
      [Season.Summer]: '#ffdd44',
      [Season.Autumn]: '#ff8844',
      [Season.Winter]: '#88bbff',
    };

    ctx.save();
    ctx.font = '11px monospace';
    ctx.fillStyle = seasonColors[state.season] || '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(
      `${state.season.toUpperCase()} | Tick ${state.tick} | Gen ${state.generation}`,
      this.canvas.width - 10,
      16,
    );
    ctx.restore();
  }

  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }
}
