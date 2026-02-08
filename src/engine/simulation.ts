// ============================================================================
// Primordial Soup — Main Simulation Engine
// ============================================================================

import type {
  Cell, Tile, Population, Genome, SimulationState, SimulationConfig,
  InteractionGenes, TickStats, ActiveEvent,
} from './types.ts';
import {
  Season, TerrainType, EventType, SpecialistType,
  createDefaultConfig, createDefaultGenome, createDefaultInteraction,
  POPULATION_COLORS,
} from './types.ts';
import {
  wrap, toIndex, fromIndex, getNeighborPositions, getNeighborCells,
  getEmptyNeighborPositions, createEnvironment, generateTerrain,
} from './grid.ts';

// ============================================================================
// Simulation creation
// ============================================================================

export function createSimulation(config?: Partial<SimulationConfig>): SimulationState {
  const cfg = { ...createDefaultConfig(), ...config };
  const environment = createEnvironment(cfg);
  generateTerrain(environment, cfg.width, cfg.height);

  return {
    config: cfg,
    tick: 0,
    generation: 0,
    season: Season.Spring,
    populations: new Map(),
    grid: new Array(cfg.width * cfg.height).fill(null),
    environment,
    running: false,
    speed: 1,
    nextPopulationId: 0,
    activeEvents: [],
    stats: createEmptyStats(),
  };
}

function createEmptyStats(): TickStats {
  return {
    populationSizes: new Map(),
    populationEnergies: new Map(),
    births: 0,
    deaths: 0,
    movements: 0,
    suppressions: 0,
  };
}

// ============================================================================
// Population management
// ============================================================================

export function addPopulation(
  state: SimulationState,
  name: string,
  genome: Genome,
  startX: number,
  startY: number,
  initialCells: number = 50,
): Population {
  const id = state.nextPopulationId++;
  const color = POPULATION_COLORS[id % POPULATION_COLORS.length];

  // Ensure interaction genes exist for all existing populations
  for (const [otherId] of state.populations) {
    if (!genome.interactions.has(otherId)) {
      genome.interactions.set(otherId, createDefaultInteraction());
    }
    // Also ensure existing populations have interaction genes for this new one
    const otherPop = state.populations.get(otherId)!;
    if (!otherPop.genome.interactions.has(id)) {
      otherPop.genome.interactions.set(id, createDefaultInteraction());
    }
  }

  const population: Population = {
    id,
    name,
    color,
    genome,
    cellCount: 0,
    peakCellCount: 0,
    totalEnergyReserves: 0,
    territory: 0,
    fitness: 0,
    generation: 0,
    alive: true,
    lockedGenes: new Set(),
    lineage: [],
  };

  state.populations.set(id, population);

  // Place initial cells in a cluster around startX, startY
  let placed = 0;
  const radius = Math.ceil(Math.sqrt(initialCells));
  for (let dy = -radius; dy <= radius && placed < initialCells; dy++) {
    for (let dx = -radius; dx <= radius && placed < initialCells; dx++) {
      if (Math.random() > 0.6) continue; // Sparse placement
      const nx = wrap(startX + dx, state.config.width);
      const ny = wrap(startY + dy, state.config.height);
      const idx = toIndex(nx, ny, state.config.width);
      if (!state.grid[idx]) {
        state.grid[idx] = {
          populationId: id,
          energy: genome.energy.maxEnergy * 0.6,
          age: 0,
          dirX: 0,
          dirY: 0,
          starvationCounter: 0,
          specialist: SpecialistType.None,
        };
        placed++;
      }
    }
  }

  population.cellCount = placed;
  population.peakCellCount = placed;
  return population;
}

export function removePopulation(state: SimulationState, id: number): void {
  // Remove all cells
  for (let i = 0; i < state.grid.length; i++) {
    if (state.grid[i]?.populationId === id) {
      state.grid[i] = null;
    }
  }
  state.populations.delete(id);
  // Remove interaction genes referencing this population
  for (const [, pop] of state.populations) {
    pop.genome.interactions.delete(id);
  }
}

// ============================================================================
// Main tick — resolves all 6 phases
// ============================================================================

export function simulateTick(state: SimulationState): void {
  const { config, grid, environment, populations } = state;
  const { width, height } = config;
  const stats = createEmptyStats();

  // Phase 1: Movement
  resolveMovement(state, stats);

  // Phase 2: Interaction
  resolveInteractions(state, stats);

  // Phase 3: Energy
  resolveEnergy(state, stats);

  // Phase 4: Birth/Death
  resolveBirthDeath(state, stats);

  // Phase 5: Structure bonuses (simplified)
  if (config.enableStructureDetection) {
    resolveStructureBonuses(state);
  }

  // Phase 6: Cleanup
  resolveCleanup(state, stats);

  // Environment updates
  updateEnvironment(state);

  // Season update
  if (config.enableSeasons) {
    updateSeason(state);
  }

  // Random events
  if (config.enableEvents && Math.random() < config.eventProbability) {
    triggerRandomEvent(state);
  }

  // Update active events
  updateActiveEvents(state);

  // Generation boundary
  state.tick++;
  if (config.enableMutation && state.tick % config.ticksPerGeneration === 0) {
    state.generation++;
    resolveGeneration(state);
  }

  state.stats = stats;
}

// ============================================================================
// Phase 1: Movement
// ============================================================================

function resolveMovement(state: SimulationState, stats: TickStats): void {
  const { config, grid, environment, populations } = state;
  const { width, height } = config;

  // Collect all movement intentions
  const moves: { fromIdx: number; toIdx: number; energy: number }[] = [];

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const pop = populations.get(cell.populationId);
    if (!pop) continue;
    const genome = pop.genome;

    // Effective mobility (specialists may modify)
    let mobility = genome.movement.mobility;
    if (cell.specialist === SpecialistType.Scout) mobility = Math.min(1, mobility * 1.5);
    if (cell.specialist === SpecialistType.Guardian) mobility *= 0.5;

    if (mobility <= 0 || Math.random() > mobility) continue;

    const [cx, cy] = fromIndex(i, width);
    const emptyNeighbors = getEmptyNeighborPositions(cx, cy, grid, width, height);
    if (emptyNeighbors.length === 0) {
      // Pay move cost even if blocked
      cell.energy -= genome.movement.moveCost;
      continue;
    }

    // Score each empty neighbor
    let bestScore = -Infinity;
    let bestPos: [number, number] | null = null;

    for (const [nx, ny] of emptyNeighbors) {
      let score = Math.random() * 0.1; // Small random noise

      // Chemotaxis: energy gradient
      const tileEnergy = environment[toIndex(nx, ny, width)].energy;
      score += genome.movement.chemotaxis * tileEnergy * 0.2;

      // Swarm pull: population density gradient
      const neighbors = getNeighborPositions(nx, ny, width, height);
      let ownCount = 0;
      let hostileCount = 0;
      let preyCount = 0;

      for (const [nnx, nny] of neighbors) {
        const ncell = grid[toIndex(nnx, nny, width)];
        if (!ncell) continue;
        if (ncell.populationId === cell.populationId) {
          ownCount++;
        } else {
          const interaction = genome.interactions.get(ncell.populationId);
          if (interaction) {
            if (interaction.neighborWeight < -0.3) hostileCount++;
            if (interaction.suppress > 0.1 || interaction.energyTransfer < -0.1) preyCount++;
          }
        }
      }

      score += genome.movement.swarmPull * ownCount * 0.15;

      // Flee
      if (genome.movement.fleeThreshold > 0 && hostileCount >= genome.movement.fleeThreshold) {
        // Move away from hostiles
        const hostileNeighbors = getNeighborPositions(cx, cy, width, height);
        let avgHx = 0, avgHy = 0, hCount = 0;
        for (const [hnx, hny] of hostileNeighbors) {
          const hcell = grid[toIndex(hnx, hny, width)];
          if (hcell && hcell.populationId !== cell.populationId) {
            avgHx += hnx - cx;
            avgHy += hny - cy;
            hCount++;
          }
        }
        if (hCount > 0) {
          const awayX = -(avgHx / hCount);
          const awayY = -(avgHy / hCount);
          const dx = nx - cx;
          const dy = ny - cy;
          score += (dx * awayX + dy * awayY) * 0.5;
        }
      }

      // Chase
      if (genome.movement.chaseThreshold > 0 && preyCount >= genome.movement.chaseThreshold) {
        score += preyCount * 0.3;
      }

      // Momentum
      if (genome.movement.momentum > 0) {
        const dx = nx - cx;
        const dy = ny - cy;
        const alignment = dx * cell.dirX + dy * cell.dirY;
        score += genome.movement.momentum * alignment * 0.3;
      }

      if (score > bestScore) {
        bestScore = score;
        bestPos = [nx, ny];
      }
    }

    if (bestPos) {
      moves.push({
        fromIdx: i,
        toIdx: toIndex(bestPos[0], bestPos[1], width),
        energy: cell.energy,
      });
    }
  }

  // Resolve collisions: if multiple cells target the same position, highest energy wins
  const targetMap = new Map<number, { fromIdx: number; energy: number }[]>();
  for (const move of moves) {
    if (!targetMap.has(move.toIdx)) {
      targetMap.set(move.toIdx, []);
    }
    targetMap.get(move.toIdx)!.push({ fromIdx: move.fromIdx, energy: move.energy });
  }

  for (const [targetIdx, candidates] of targetMap) {
    if (grid[targetIdx] !== null) continue; // Space was taken

    // Sort by energy, highest first
    candidates.sort((a, b) => b.energy - a.energy);
    const winner = candidates[0];
    const cell = grid[winner.fromIdx]!;
    const pop = populations.get(cell.populationId);
    if (!pop) continue;

    // Execute move
    const [fromX, fromY] = fromIndex(winner.fromIdx, width);
    const [toX, toY] = fromIndex(targetIdx, width);

    cell.dirX = Math.sign(toX - fromX) || cell.dirX;
    cell.dirY = Math.sign(toY - fromY) || cell.dirY;
    cell.energy -= pop.genome.movement.moveCost;

    grid[targetIdx] = cell;
    grid[winner.fromIdx] = null;
    stats.movements++;

    // Losers stay put but pay move cost
    for (let i = 1; i < candidates.length; i++) {
      const loserCell = grid[candidates[i].fromIdx];
      if (loserCell) {
        const loserPop = populations.get(loserCell.populationId);
        if (loserPop) {
          loserCell.energy -= loserPop.genome.movement.moveCost;
        }
      }
    }
  }
}

// ============================================================================
// Phase 2: Interactions
// ============================================================================

function resolveInteractions(state: SimulationState, stats: TickStats): void {
  const { config, grid, environment, populations } = state;
  const { width, height } = config;

  // Collect all interaction effects to apply simultaneously
  const energyDeltas = new Float32Array(grid.length);
  const killList: number[] = [];

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const pop = populations.get(cell.populationId);
    if (!pop) continue;

    const [cx, cy] = fromIndex(i, width);
    const range = pop.genome.structure.signalingRange;
    const neighbors = getNeighborPositions(cx, cy, width, height, range);

    for (const [nx, ny] of neighbors) {
      const nIdx = toIndex(nx, ny, width);
      const neighbor = grid[nIdx];
      if (!neighbor || neighbor.populationId === cell.populationId) continue;

      const interaction = pop.genome.interactions.get(neighbor.populationId);
      if (!interaction) continue;

      // Energy transfer
      if (interaction.energyTransfer < 0) {
        // Drain from neighbor (parasitism)
        const drain = Math.min(Math.abs(interaction.energyTransfer), neighbor.energy);
        energyDeltas[i] += drain;
        energyDeltas[nIdx] -= drain;
      } else if (interaction.energyTransfer > 0) {
        // Donate to neighbor (altruism)
        const give = Math.min(interaction.energyTransfer, cell.energy);
        energyDeltas[i] -= give;
        energyDeltas[nIdx] += give;
      }

      // Suppress (direct attack)
      let suppressChance = interaction.suppress;
      if (cell.specialist === SpecialistType.Guardian) suppressChance *= 1.5;
      if (suppressChance > 0 && Math.random() < suppressChance) {
        killList.push(nIdx);
        // Attacker gains fraction of victim's energy
        energyDeltas[i] += neighbor.energy * 0.3;
        stats.suppressions++;
      }
    }
  }

  // Apply energy deltas
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (cell && energyDeltas[i] !== 0) {
      cell.energy = Math.max(0, Math.min(
        populations.get(cell.populationId)?.genome.energy.maxEnergy ?? 5,
        cell.energy + energyDeltas[i]
      ));
    }
  }

  // Apply kills
  for (const idx of killList) {
    const cell = grid[idx];
    if (cell) {
      const pop = populations.get(cell.populationId);
      if (pop) {
        // Release energy on death
        const tile = state.environment[idx];
        tile.energy += cell.energy * pop.genome.energy.energyOnDeath;
      }
      grid[idx] = null;
      stats.deaths++;
    }
  }
}

// ============================================================================
// Phase 3: Energy
// ============================================================================

function resolveEnergy(state: SimulationState, stats: TickStats): void {
  const { config, grid, environment, populations } = state;
  const { width, height } = config;

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const pop = populations.get(cell.populationId);
    if (!pop) continue;
    const genome = pop.genome;

    const tile = environment[i];

    // Energy gain
    let efficiencyMult = genome.energy.efficiency;
    if (cell.specialist === SpecialistType.Harvester) efficiencyMult *= 2;

    let gain = tile.energy * efficiencyMult * 0.1; // Fraction of tile energy
    tile.energy = Math.max(0, tile.energy - gain); // Deplete tile

    // Photosynthesis
    let photoGain = genome.energy.photosynthesis;
    if (cell.specialist === SpecialistType.Harvester) photoGain *= 1.5;
    if (tile.terrain === TerrainType.DeepVent) photoGain += 2.0;
    gain += photoGain;

    // Energy loss
    let loss = genome.energy.metabolism;
    if (cell.specialist === SpecialistType.Relay) loss *= 0.7;

    // Toxic zone damage
    if (tile.terrain === TerrainType.ToxicZone) {
      loss += 0.5;
    }

    // Adhesion bonus (nearby own cells reduce cost)
    if (genome.structure.adhesion > 0) {
      const [cx, cy] = fromIndex(i, width);
      const neighbors = getNeighborPositions(cx, cy, width, height);
      let ownCount = 0;
      for (const [nx, ny] of neighbors) {
        const ncell = grid[toIndex(nx, ny, width)];
        if (ncell && ncell.populationId === cell.populationId) ownCount++;
      }
      loss -= genome.structure.adhesion * ownCount * 0.05;
      loss = Math.max(0.05, loss); // Minimum metabolism
    }

    cell.energy = Math.min(genome.energy.maxEnergy, cell.energy + gain - loss);

    // Starvation tracking
    if (cell.energy <= 0) {
      cell.energy = 0;
      cell.starvationCounter++;
    } else {
      cell.starvationCounter = 0;
    }
  }
}

// ============================================================================
// Phase 4: Birth/Death
// ============================================================================

function resolveBirthDeath(state: SimulationState, stats: TickStats): void {
  const { config, grid, environment, populations } = state;
  const { width, height } = config;

  const newGrid = grid.slice(); // Copy for simultaneous evaluation
  const deathIndices: number[] = [];
  const birthCandidates: Map<number, { popId: number; weightedCount: number; energy: number }[]> = new Map();

  // Evaluate existing cells for death
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const pop = populations.get(cell.populationId);
    if (!pop) continue;
    const genome = pop.genome;
    const [cx, cy] = fromIndex(i, width);

    // Count weighted neighbors
    const range = genome.structure.signalingRange;
    const neighbors = getNeighborPositions(cx, cy, width, height, range);
    let weightedCount = 0;

    for (const [nx, ny] of neighbors) {
      const ncell = grid[toIndex(nx, ny, width)];
      if (!ncell) continue;
      if (ncell.populationId === cell.populationId) {
        weightedCount += 1;
      } else {
        const interaction = genome.interactions.get(ncell.populationId);
        if (interaction) {
          weightedCount += interaction.neighborWeight;
        }
      }
    }

    // Survive check
    let shouldDie = false;

    if (weightedCount < genome.vitality.surviveMin || weightedCount > genome.vitality.surviveMax) {
      // Shell formation can save boundary cells
      let shellBonus = 0;
      if (genome.structure.shellFormation > 0) {
        if (cell.specialist === SpecialistType.Guardian) shellBonus = genome.structure.shellFormation;
        else shellBonus = genome.structure.shellFormation * 0.5;
      }
      if (Math.random() > shellBonus) {
        shouldDie = true;
      }
    }

    // Longevity check
    if (genome.vitality.longevity > 0 && cell.age >= genome.vitality.longevity) {
      shouldDie = true;
    }

    // Starvation check
    if (cell.starvationCounter >= genome.energy.starvationTolerance) {
      shouldDie = true;
    }

    if (shouldDie) {
      deathIndices.push(i);
    }
  }

  // Evaluate empty cells for birth
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] !== null) continue;

    const [cx, cy] = fromIndex(i, width);
    const neighbors = getNeighborPositions(cx, cy, width, height);

    // Count neighbors per population with weighted contributions
    const popContributions = new Map<number, { count: number; weighted: number; totalEnergy: number }>();

    for (const [nx, ny] of neighbors) {
      const ncell = grid[toIndex(nx, ny, width)];
      if (!ncell) continue;

      const pop = populations.get(ncell.populationId);
      if (!pop) continue;

      if (!popContributions.has(ncell.populationId)) {
        popContributions.set(ncell.populationId, { count: 0, weighted: 0, totalEnergy: 0 });
      }
      const contrib = popContributions.get(ncell.populationId)!;
      contrib.count++;
      contrib.weighted += 1;
      contrib.totalEnergy += ncell.energy;
    }

    // For each population, check if birth conditions are met
    for (const [popId, contrib] of popContributions) {
      const pop = populations.get(popId);
      if (!pop) continue;
      const genome = pop.genome;

      // Apply interaction-based neighbor weight adjustments
      let adjustedCount = contrib.weighted;
      for (const [nx, ny] of neighbors) {
        const ncell = grid[toIndex(nx, ny, width)];
        if (!ncell || ncell.populationId === popId) continue;
        const interaction = genome.interactions.get(ncell.populationId);
        if (interaction) {
          adjustedCount += interaction.neighborWeight;
        }
      }

      // Birth assist from other populations
      let birthMultiplier = genome.reproduction.reproductiveRate;
      for (const [nx, ny] of neighbors) {
        const ncell = grid[toIndex(nx, ny, width)];
        if (!ncell || ncell.populationId === popId) continue;
        const otherPop = populations.get(ncell.populationId);
        if (!otherPop) continue;
        const otherInteraction = otherPop.genome.interactions.get(popId);
        if (otherInteraction && otherInteraction.birthAssist > 0) {
          birthMultiplier *= (1 + otherInteraction.birthAssist);
        }
      }

      if (adjustedCount >= genome.vitality.birthMin &&
          adjustedCount <= genome.vitality.birthMax) {
        // Birth probability check with reproductive rate
        if (Math.random() < birthMultiplier) {
          if (!birthCandidates.has(i)) {
            birthCandidates.set(i, []);
          }
          birthCandidates.get(i)!.push({
            popId,
            weightedCount: adjustedCount * birthMultiplier,
            energy: contrib.totalEnergy,
          });
        }
      }
    }
  }

  // Apply deaths
  for (const idx of deathIndices) {
    const cell = grid[idx];
    if (cell) {
      const pop = populations.get(cell.populationId);
      if (pop) {
        environment[idx].energy += cell.energy * pop.genome.energy.energyOnDeath;
      }
      newGrid[idx] = null;
      stats.deaths++;
    }
  }

  // Apply births — resolve conflicts (highest weighted contribution wins)
  for (const [idx, candidates] of birthCandidates) {
    if (newGrid[idx] !== null) continue; // Position already taken by surviving cell

    candidates.sort((a, b) => b.weightedCount - a.weightedCount);
    const winner = candidates[0];
    const pop = populations.get(winner.popId);
    if (!pop) continue;

    // Deduct birth energy cost from parent cells
    const genome = pop.genome;
    const [cx, cy] = fromIndex(idx, width);
    const neighbors = getNeighborPositions(cx, cy, width, height);
    let parentCount = 0;
    for (const [nx, ny] of neighbors) {
      const ncell = grid[toIndex(nx, ny, width)];
      if (ncell && ncell.populationId === winner.popId) parentCount++;
    }
    if (parentCount > 0) {
      const costPerParent = genome.vitality.birthEnergyCost / parentCount;
      for (const [nx, ny] of neighbors) {
        const nIdx = toIndex(nx, ny, width);
        const ncell = newGrid[nIdx];
        if (ncell && ncell.populationId === winner.popId) {
          ncell.energy -= costPerParent;
        }
      }
    }

    // Determine specialist type
    let specialist = SpecialistType.None;
    if (genome.structure.differentiationChance > 0 &&
        Math.random() < genome.structure.differentiationChance) {
      specialist = determineSpecialist(idx, grid, width, height, winner.popId, pop);
    }

    newGrid[idx] = {
      populationId: winner.popId,
      energy: genome.vitality.spawnEnergy,
      age: 0,
      dirX: 0,
      dirY: 0,
      starvationCounter: 0,
      specialist,
    };
    stats.births++;
  }

  // Copy newGrid back
  for (let i = 0; i < grid.length; i++) {
    state.grid[i] = newGrid[i];
  }
}

function determineSpecialist(
  idx: number,
  grid: (Cell | null)[],
  width: number,
  height: number,
  popId: number,
  pop: Population,
): SpecialistType {
  const [cx, cy] = fromIndex(idx, width);
  const neighbors = getNeighborPositions(cx, cy, width, height);

  let ownCount = 0;
  let hostileCount = 0;
  let totalNeighbors = 0;

  for (const [nx, ny] of neighbors) {
    const ncell = grid[toIndex(nx, ny, width)];
    if (ncell) {
      totalNeighbors++;
      if (ncell.populationId === popId) ownCount++;
      else {
        const interaction = pop.genome.interactions.get(ncell.populationId);
        if (interaction && interaction.neighborWeight < 0) hostileCount++;
      }
    }
  }

  // Weight by context
  const weights = [
    { type: SpecialistType.Scout, weight: ownCount <= 2 ? 3 : 1 },
    { type: SpecialistType.Guardian, weight: hostileCount >= 3 ? 4 : hostileCount >= 1 ? 2 : 0.5 },
    { type: SpecialistType.Harvester, weight: 1.5 },
    { type: SpecialistType.Relay, weight: ownCount >= 2 && ownCount <= 4 ? 2 : 0.5 },
  ];

  const totalWeight = weights.reduce((s, w) => s + w.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const w of weights) {
    roll -= w.weight;
    if (roll <= 0) return w.type;
  }
  return SpecialistType.Scout;
}

// ============================================================================
// Phase 5: Structure bonuses (simplified)
// ============================================================================

function resolveStructureBonuses(state: SimulationState): void {
  const { config, grid, populations } = state;
  const { width, height } = config;

  // Simple cluster detection: cells surrounded by own kind get energy bonus
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const [cx, cy] = fromIndex(i, width);
    const neighbors = getNeighborPositions(cx, cy, width, height);
    let ownCount = 0;
    let emptyCount = 0;

    for (const [nx, ny] of neighbors) {
      const ncell = grid[toIndex(nx, ny, width)];
      if (!ncell) emptyCount++;
      else if (ncell.populationId === cell.populationId) ownCount++;
    }

    // Stable cluster bonus: well-connected cells get energy
    if (ownCount >= 4) {
      cell.energy = Math.min(
        populations.get(cell.populationId)?.genome.energy.maxEnergy ?? 5,
        cell.energy + 0.2
      );
    }

    // Shell formation: boundary cells (some empty neighbors, some own) resist death
    // Already handled in birth/death phase via shellFormation gene

    // Bridge affinity bonus: cells connecting groups
    const pop = populations.get(cell.populationId);
    if (pop && pop.genome.structure.bridgeAffinity > 0 && ownCount >= 2 && ownCount <= 4 && emptyCount >= 3) {
      cell.energy = Math.min(
        pop.genome.energy.maxEnergy,
        cell.energy + pop.genome.structure.bridgeAffinity * 0.4
      );
    }
  }
}

// ============================================================================
// Phase 6: Cleanup
// ============================================================================

function resolveCleanup(state: SimulationState, stats: TickStats): void {
  const { grid, populations, config } = state;

  // Reset population stats
  for (const [, pop] of populations) {
    pop.cellCount = 0;
    pop.totalEnergyReserves = 0;
    pop.territory = 0;
  }

  // Track occupied chunks for territory
  const chunkOccupancy = new Map<number, Set<string>>();

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    cell.age++;

    const pop = populations.get(cell.populationId);
    if (!pop) continue;

    pop.cellCount++;
    pop.totalEnergyReserves += cell.energy;

    // Territory tracking
    const [x, y] = fromIndex(i, config.width);
    const chunkKey = `${Math.floor(x / 8)},${Math.floor(y / 8)}`;
    if (!chunkOccupancy.has(cell.populationId)) {
      chunkOccupancy.set(cell.populationId, new Set());
    }
    chunkOccupancy.get(cell.populationId)!.add(chunkKey);

    // Stats
    if (!stats.populationSizes.has(cell.populationId)) {
      stats.populationSizes.set(cell.populationId, 0);
    }
    stats.populationSizes.set(cell.populationId, stats.populationSizes.get(cell.populationId)! + 1);

    if (!stats.populationEnergies.has(cell.populationId)) {
      stats.populationEnergies.set(cell.populationId, 0);
    }
    stats.populationEnergies.set(cell.populationId, stats.populationEnergies.get(cell.populationId)! + cell.energy);
  }

  for (const [popId, chunks] of chunkOccupancy) {
    const pop = populations.get(popId);
    if (pop) {
      pop.territory = chunks.size;
      pop.peakCellCount = Math.max(pop.peakCellCount, pop.cellCount);
      pop.alive = pop.cellCount > 0;
    }
  }

  // Mark empty populations
  for (const [, pop] of populations) {
    if (pop.cellCount === 0) {
      pop.alive = false;
    }
  }
}

// ============================================================================
// Environment updates
// ============================================================================

function updateEnvironment(state: SimulationState): void {
  const { config, environment } = state;

  // Season multiplier for regeneration
  let regenMultiplier = 1.0;
  switch (state.season) {
    case Season.Spring: regenMultiplier = 2.0; break;
    case Season.Summer: regenMultiplier = 1.0; break;
    case Season.Autumn: regenMultiplier = 0.5; break;
    case Season.Winter: regenMultiplier = 0.25; break;
  }

  for (let i = 0; i < environment.length; i++) {
    const tile = environment[i];
    // Regenerate energy toward base level
    if (tile.energy < tile.baseEnergy) {
      tile.energy = Math.min(tile.baseEnergy, tile.energy + tile.regenRate * regenMultiplier);
    }
  }

  // Carrying capacity check
  const { width, height, chunkSize, carryingCapacityPerChunk } = config;
  const chunksX = Math.ceil(width / chunkSize);
  const chunksY = Math.ceil(height / chunkSize);

  for (let cy = 0; cy < chunksY; cy++) {
    for (let cx = 0; cx < chunksX; cx++) {
      let cellCount = 0;
      const startX = cx * chunkSize;
      const startY = cy * chunkSize;

      for (let dy = 0; dy < chunkSize && startY + dy < height; dy++) {
        for (let dx = 0; dx < chunkSize && startX + dx < width; dx++) {
          const idx = toIndex(startX + dx, startY + dy, width);
          if (state.grid[idx]) cellCount++;
        }
      }

      // Apply overshoot penalty
      if (cellCount > carryingCapacityPerChunk) {
        const overshoot = (cellCount - carryingCapacityPerChunk) / carryingCapacityPerChunk;
        const penalty = overshoot * 0.3;

        for (let dy = 0; dy < chunkSize && startY + dy < height; dy++) {
          for (let dx = 0; dx < chunkSize && startX + dx < width; dx++) {
            const idx = toIndex(startX + dx, startY + dy, width);
            const cell = state.grid[idx];
            if (cell) {
              cell.energy = Math.max(0, cell.energy - penalty);
            }
          }
        }
      }
    }
  }
}

function updateSeason(state: SimulationState): void {
  const seasonTick = state.tick % (state.config.seasonLength * 4);
  if (seasonTick < state.config.seasonLength) {
    state.season = Season.Spring;
  } else if (seasonTick < state.config.seasonLength * 2) {
    state.season = Season.Summer;
  } else if (seasonTick < state.config.seasonLength * 3) {
    state.season = Season.Autumn;
  } else {
    state.season = Season.Winter;
  }
}

// ============================================================================
// Environmental events
// ============================================================================

function triggerRandomEvent(state: SimulationState): void {
  const { config } = state;
  const roll = Math.random();
  const x = Math.floor(Math.random() * config.width);
  const y = Math.floor(Math.random() * config.height);

  if (roll < 0.2) {
    // Meteor
    const radius = 3 + Math.floor(Math.random() * 5);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = wrap(x + dx, config.width);
        const ny = wrap(y + dy, config.height);
        const idx = toIndex(nx, ny, config.width);
        state.grid[idx] = null;
        state.environment[idx].energy = 10.0; // Oasis at impact
        state.environment[idx].baseEnergy = 8.0;
      }
    }
    state.activeEvents.push({ type: EventType.Meteor, x, y, radius, remainingTicks: 50 });
  } else if (roll < 0.4) {
    // Drought
    const radius = 8 + Math.floor(Math.random() * 10);
    state.activeEvents.push({ type: EventType.Drought, x, y, radius, remainingTicks: 50 });
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = wrap(x + dx, config.width);
        const ny = wrap(y + dy, config.height);
        const idx = toIndex(nx, ny, config.width);
        state.environment[idx].energy = 0;
      }
    }
  } else if (roll < 0.6) {
    // Bloom
    const radius = 5 + Math.floor(Math.random() * 8);
    state.activeEvents.push({ type: EventType.Bloom, x, y, radius, remainingTicks: 30 });
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        if (dx * dx + dy * dy > radius * radius) continue;
        const nx = wrap(x + dx, config.width);
        const ny = wrap(y + dy, config.height);
        const idx = toIndex(nx, ny, config.width);
        state.environment[idx].energy = 10.0;
      }
    }
  } else if (roll < 0.8) {
    // Plague — random population loses 30% of cells
    const popIds = Array.from(state.populations.keys());
    if (popIds.length > 0) {
      const targetPop = popIds[Math.floor(Math.random() * popIds.length)];
      let killed = 0;
      const targetKills = Math.floor((state.populations.get(targetPop)?.cellCount ?? 0) * 0.3);
      for (let i = 0; i < state.grid.length && killed < targetKills; i++) {
        const cell = state.grid[i];
        if (cell && cell.populationId === targetPop && Math.random() < 0.3) {
          state.grid[i] = null;
          killed++;
        }
      }
      state.activeEvents.push({ type: EventType.Plague, x, y, radius: 0, remainingTicks: 10 });
    }
  } else {
    // Rift — barrier of dead cells
    const length = 10 + Math.floor(Math.random() * 20);
    const horizontal = Math.random() > 0.5;
    state.activeEvents.push({ type: EventType.Rift, x, y, radius: length, remainingTicks: 100 });
    for (let d = 0; d < length; d++) {
      const nx = horizontal ? wrap(x + d, config.width) : x;
      const ny = horizontal ? y : wrap(y + d, config.height);
      const idx = toIndex(nx, ny, config.width);
      state.grid[idx] = null;
      state.environment[idx].energy = 0;
      state.environment[idx].baseEnergy = 0;
      state.environment[idx].regenRate = 0;
    }
  }
}

function updateActiveEvents(state: SimulationState): void {
  state.activeEvents = state.activeEvents.filter(e => {
    e.remainingTicks--;
    if (e.remainingTicks <= 0) {
      // Restore terrain for rift events
      if (e.type === EventType.Rift) {
        const length = e.radius;
        const horizontal = true; // Simplified
        for (let d = 0; d < length; d++) {
          const nx = horizontal ? wrap(e.x + d, state.config.width) : e.x;
          const ny = horizontal ? e.y : wrap(e.y + d, state.config.height);
          const idx = toIndex(nx, ny, state.config.width);
          state.environment[idx].baseEnergy = 5.0;
          state.environment[idx].regenRate = 0.5;
        }
      }
      return false;
    }
    return true;
  });
}

// ============================================================================
// Generation — Mutation & Evolution
// ============================================================================

function resolveGeneration(state: SimulationState): void {
  for (const [, pop] of state.populations) {
    if (!pop.alive) continue;

    pop.generation++;

    // Calculate fitness
    const sizeFitness = pop.peakCellCount > 0 ? pop.cellCount / pop.peakCellCount : 0;
    const totalChunks = Math.ceil(state.config.width / 8) * Math.ceil(state.config.height / 8);
    const territoryFitness = pop.territory / totalChunks;
    const energyFitness = pop.cellCount > 0
      ? (pop.totalEnergyReserves / pop.cellCount) / pop.genome.energy.maxEnergy
      : 0;

    pop.fitness = sizeFitness * 0.4 + territoryFitness * 0.3 + energyFitness * 0.3;

    // Mutate genome
    mutateGenome(pop);

    // Reset peak for next generation
    pop.peakCellCount = pop.cellCount;
  }

  // Horizontal gene transfer
  resolveHorizontalGeneTransfer(state);
}

function mutateGenome(pop: Population): void {
  const genome = pop.genome;
  const mr = genome.reproduction.mutationRate;
  const mm = genome.reproduction.mutationMagnitude;
  const mb = genome.reproduction.mutationBias;

  // Adaptive mutation: low fitness -> bigger mutations
  const adaptiveFactor = pop.fitness < 0.3 ? 2.0 : pop.fitness < 0.6 ? 1.0 : 0.5;

  const mutateGene = (
    obj: Record<string, unknown>,
    key: string,
    min: number,
    max: number,
    genePath: string,
    isInt: boolean = false,
  ) => {
    if (pop.lockedGenes.has(genePath)) return;
    if (Math.random() > mr * adaptiveFactor) return;

    const range = max - min;
    const current = obj[key] as number;
    const delta = (gaussianRandom() * mm * range * adaptiveFactor) + (mb * range * 0.1);
    let newVal = current + delta;
    newVal = Math.max(min, Math.min(max, newVal));
    if (isInt) newVal = Math.round(newVal);

    pop.lineage.push({
      generation: pop.generation,
      gene: genePath,
      oldValue: current,
      newValue: newVal,
      fitness: pop.fitness,
    });

    obj[key] = newVal;
  };

  // Mutate vitality genes
  const v = genome.vitality as unknown as Record<string, unknown>;
  mutateGene(v, 'birthMin', 1, 5, 'vitality.birthMin', true);
  mutateGene(v, 'birthMax', 1, 6, 'vitality.birthMax', true);
  mutateGene(v, 'surviveMin', 0, 4, 'vitality.surviveMin', true);
  mutateGene(v, 'surviveMax', 1, 6, 'vitality.surviveMax', true);
  mutateGene(v, 'longevity', 0, 1000, 'vitality.longevity', true);
  mutateGene(v, 'birthEnergyCost', 0, 5, 'vitality.birthEnergyCost');
  mutateGene(v, 'spawnEnergy', 0.5, 3, 'vitality.spawnEnergy');

  // Mutate movement genes
  const m = genome.movement as unknown as Record<string, unknown>;
  mutateGene(m, 'mobility', 0, 1, 'movement.mobility');
  mutateGene(m, 'moveCost', 0, 2, 'movement.moveCost');
  mutateGene(m, 'chemotaxis', -1, 1, 'movement.chemotaxis');
  mutateGene(m, 'swarmPull', -1, 1, 'movement.swarmPull');
  mutateGene(m, 'fleeThreshold', 0, 6, 'movement.fleeThreshold', true);
  mutateGene(m, 'chaseThreshold', 0, 6, 'movement.chaseThreshold', true);
  mutateGene(m, 'momentum', 0, 1, 'movement.momentum');

  // Mutate energy genes
  const e = genome.energy as unknown as Record<string, unknown>;
  mutateGene(e, 'metabolism', 0.1, 3, 'energy.metabolism');
  mutateGene(e, 'efficiency', 0.1, 3, 'energy.efficiency');
  mutateGene(e, 'maxEnergy', 1, 20, 'energy.maxEnergy');
  mutateGene(e, 'starvationTolerance', 1, 10, 'energy.starvationTolerance', true);
  mutateGene(e, 'photosynthesis', 0, 1, 'energy.photosynthesis');
  mutateGene(e, 'energyOnDeath', 0, 1, 'energy.energyOnDeath');

  // Mutate structure genes
  const s = genome.structure as unknown as Record<string, unknown>;
  mutateGene(s, 'adhesion', 0, 1, 'structure.adhesion');
  mutateGene(s, 'signalingRange', 1, 3, 'structure.signalingRange', true);
  mutateGene(s, 'differentiationChance', 0, 0.3, 'structure.differentiationChance');
  mutateGene(s, 'shellFormation', 0, 1, 'structure.shellFormation');
  mutateGene(s, 'bridgeAffinity', 0, 1, 'structure.bridgeAffinity');

  // Mutate reproduction genes (meta!)
  const r = genome.reproduction as unknown as Record<string, unknown>;
  mutateGene(r, 'mutationRate', 0.001, 0.15, 'reproduction.mutationRate');
  mutateGene(r, 'mutationMagnitude', 0.05, 1, 'reproduction.mutationMagnitude');
  mutateGene(r, 'mutationBias', -0.5, 0.5, 'reproduction.mutationBias');
  mutateGene(r, 'crossoverRate', 0, 0.5, 'reproduction.crossoverRate');
  mutateGene(r, 'reproductiveRate', 0.5, 2, 'reproduction.reproductiveRate');
  mutateGene(r, 'offspringVariance', 0, 0.3, 'reproduction.offspringVariance');

  // Mutate interaction genes
  for (const [targetId, interaction] of genome.interactions) {
    const ig = interaction as unknown as Record<string, unknown>;
    const prefix = `interaction.${targetId}`;
    mutateGene(ig, 'neighborWeight', -2, 2, `${prefix}.neighborWeight`);
    mutateGene(ig, 'suppress', 0, 1, `${prefix}.suppress`);
    mutateGene(ig, 'energyTransfer', -1, 1, `${prefix}.energyTransfer`);
    mutateGene(ig, 'birthAssist', 0, 1, `${prefix}.birthAssist`);
  }
}

function resolveHorizontalGeneTransfer(state: SimulationState): void {
  const { grid, populations, config } = state;
  const { width, height } = config;

  // Find populations with adjacent cells
  const adjacencies = new Map<string, boolean>();

  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i];
    if (!cell) continue;

    const [cx, cy] = fromIndex(i, width);
    const neighbors = getNeighborPositions(cx, cy, width, height);

    for (const [nx, ny] of neighbors) {
      const ncell = grid[toIndex(nx, ny, width)];
      if (ncell && ncell.populationId !== cell.populationId) {
        const key = `${Math.min(cell.populationId, ncell.populationId)}-${Math.max(cell.populationId, ncell.populationId)}`;
        adjacencies.set(key, true);
      }
    }
  }

  // For each adjacent pair, check crossover
  for (const key of adjacencies.keys()) {
    const [idA, idB] = key.split('-').map(Number);
    const popA = populations.get(idA);
    const popB = populations.get(idB);
    if (!popA || !popB) continue;

    // A might acquire from B
    if (popA.genome.reproduction.crossoverRate > 0 && Math.random() < popA.genome.reproduction.crossoverRate) {
      transferRandomGene(popB.genome, popA.genome);
    }

    // B might acquire from A
    if (popB.genome.reproduction.crossoverRate > 0 && Math.random() < popB.genome.reproduction.crossoverRate) {
      transferRandomGene(popA.genome, popB.genome);
    }
  }
}

function transferRandomGene(from: Genome, to: Genome): void {
  const groups = ['vitality', 'movement', 'energy', 'structure'] as const;
  const group = groups[Math.floor(Math.random() * groups.length)];

  const fromGroup = from[group] as unknown as Record<string, unknown>;
  const toGroup = to[group] as unknown as Record<string, unknown>;
  const keys = Object.keys(fromGroup);
  const key = keys[Math.floor(Math.random() * keys.length)];
  toGroup[key] = fromGroup[key];
}

// ============================================================================
// Utility
// ============================================================================

function gaussianRandom(): number {
  // Box-Muller transform
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}
