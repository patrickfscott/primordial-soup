// ============================================================================
// Preset Genome Archetypes
// ============================================================================

import type { Genome } from './types.ts';
import { createDefaultGenome } from './types.ts';

export interface PresetArchetype {
  name: string;
  description: string;
  strategy: string;
  weakness: string;
  createGenome: () => Genome;
}

/** Create a genome with all genes randomized within valid ranges */
export function createRandomGenome(): Genome {
  const r = (min: number, max: number) => min + Math.random() * (max - min);
  const ri = (min: number, max: number) => Math.round(r(min, max));

  const base = createDefaultGenome();
  base.vitality.birthMin = ri(1, 3);
  base.vitality.birthMax = ri(base.vitality.birthMin, 5);
  base.vitality.surviveMin = ri(0, 2);
  base.vitality.surviveMax = ri(base.vitality.surviveMin + 1, 5);
  base.vitality.longevity = Math.random() < 0.3 ? ri(100, 800) : 0;
  base.vitality.birthEnergyCost = r(0.3, 2.0);
  base.vitality.spawnEnergy = r(0.5, 2.0);

  base.movement.mobility = r(0, 1);
  base.movement.moveCost = r(0.1, 1.0);
  base.movement.chemotaxis = r(-0.5, 0.7);
  base.movement.swarmPull = r(-0.5, 0.5);
  base.movement.fleeThreshold = ri(0, 3);
  base.movement.chaseThreshold = ri(0, 3);
  base.movement.momentum = r(0, 0.7);

  base.energy.metabolism = r(0.3, 2.0);
  base.energy.efficiency = r(0.3, 2.0);
  base.energy.maxEnergy = r(3, 12);
  base.energy.starvationTolerance = ri(2, 7);
  base.energy.photosynthesis = r(0, 0.6);
  base.energy.energyOnDeath = r(0.2, 0.8);

  base.structure.adhesion = r(0.1, 0.9);
  base.structure.signalingRange = ri(1, 2);
  base.structure.differentiationChance = Math.random() < 0.3 ? r(0.05, 0.2) : 0;
  base.structure.shellFormation = Math.random() < 0.3 ? r(0.2, 0.7) : 0;
  base.structure.bridgeAffinity = Math.random() < 0.3 ? r(0.2, 0.6) : 0;

  base.reproduction.mutationRate = r(0.01, 0.08);
  base.reproduction.mutationMagnitude = r(0.1, 0.5);
  base.reproduction.mutationBias = r(-0.2, 0.2);
  base.reproduction.crossoverRate = Math.random() < 0.4 ? r(0.05, 0.3) : 0;
  base.reproduction.reproductiveRate = r(0.7, 1.5);
  base.reproduction.offspringVariance = r(0, 0.15);

  return base;
}

function mergeGenome(overrides: Partial<{
  vitality: Partial<Genome['vitality']>;
  movement: Partial<Genome['movement']>;
  energy: Partial<Genome['energy']>;
  structure: Partial<Genome['structure']>;
  reproduction: Partial<Genome['reproduction']>;
}>): Genome {
  const base = createDefaultGenome();
  if (overrides.vitality) Object.assign(base.vitality, overrides.vitality);
  if (overrides.movement) Object.assign(base.movement, overrides.movement);
  if (overrides.energy) Object.assign(base.energy, overrides.energy);
  if (overrides.structure) Object.assign(base.structure, overrides.structure);
  if (overrides.reproduction) Object.assign(base.reproduction, overrides.reproduction);
  return base;
}

export const PRESETS: PresetArchetype[] = [
  {
    name: 'Classic Life',
    description: 'Hex adaptation of Conway\'s Game of Life rules with energy.',
    strategy: 'Classic GoL patterns emerge naturally on the hex grid.',
    weakness: 'No movement or interactions.',
    createGenome: () => mergeGenome({
      energy: { photosynthesis: 0.2 },
    }),
  },
  {
    name: 'Swarm',
    description: 'High birth rate, high mobility, low adhesion, fast metabolism.',
    strategy: 'Rapid expansion, overwhelms through numbers.',
    weakness: 'Fragile — no structures, vulnerable to hostile environments.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 4, surviveMin: 0, surviveMax: 4, birthEnergyCost: 0.5, spawnEnergy: 0.8 },
      movement: { mobility: 0.7, moveCost: 0.2, swarmPull: 0.3, chemotaxis: 0.3, momentum: 0.2 },
      energy: { metabolism: 1.5, efficiency: 1.2, maxEnergy: 4.0, photosynthesis: 0.1 },
      structure: { adhesion: 0.2, signalingRange: 1 },
      reproduction: { mutationRate: 0.05, reproductiveRate: 1.8 },
    }),
  },
  {
    name: 'Fortress',
    description: 'High adhesion, high shell formation, low mobility.',
    strategy: 'Builds dense clusters that resist attack.',
    weakness: 'Slow to expand. Vulnerable to parasitism.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 2, birthMax: 4, surviveMin: 0, surviveMax: 5, longevity: 500 },
      movement: { mobility: 0.05, moveCost: 1.0 },
      energy: { metabolism: 0.5, efficiency: 1.0, maxEnergy: 10.0, starvationTolerance: 6, photosynthesis: 0.2 },
      structure: { adhesion: 0.9, shellFormation: 0.8, bridgeAffinity: 0.3, signalingRange: 2 },
      reproduction: { mutationRate: 0.01, reproductiveRate: 0.8, mutationMagnitude: 0.1 },
    }),
  },
  {
    name: 'Parasite',
    description: 'Drains energy from nearby populations, high mobility.',
    strategy: 'Attaches to other populations and drains them.',
    weakness: 'Dies without hosts.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 3, surviveMin: 0, surviveMax: 3, birthEnergyCost: 0.5 },
      movement: { mobility: 0.6, moveCost: 0.3, chemotaxis: 0.5, chaseThreshold: 1 },
      energy: { metabolism: 0.8, efficiency: 0.5, maxEnergy: 6.0, starvationTolerance: 5 },
      structure: { adhesion: 0.3, signalingRange: 2 },
      reproduction: { mutationRate: 0.04, reproductiveRate: 1.3 },
    }),
  },
  {
    name: 'Symbiont',
    description: 'Boosts adjacent populations. Thrives by cooperation.',
    strategy: 'Makes allies thrive, benefits from proximity.',
    weakness: 'Cannot survive alone.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 4, surviveMin: 0, surviveMax: 4, birthEnergyCost: 0.8 },
      movement: { mobility: 0.3, moveCost: 0.3, swarmPull: 0.2, chemotaxis: 0.2 },
      energy: { metabolism: 0.7, efficiency: 1.2, maxEnergy: 6.0, photosynthesis: 0.3 },
      structure: { adhesion: 0.6, signalingRange: 2, bridgeAffinity: 0.4 },
      reproduction: { mutationRate: 0.02, reproductiveRate: 1.0 },
    }),
  },
  {
    name: 'Nomad',
    description: 'Maximum mobility, high momentum, constantly migrating.',
    strategy: 'Migrates following resources. Hard to pin down.',
    weakness: 'Never builds structures. Low energy reserves.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 3, surviveMin: 0, surviveMax: 3, birthEnergyCost: 0.6, spawnEnergy: 1.2 },
      movement: { mobility: 0.9, moveCost: 0.2, chemotaxis: 0.7, swarmPull: -0.3, momentum: 0.7 },
      energy: { metabolism: 0.8, efficiency: 1.5, maxEnergy: 4.0 },
      structure: { adhesion: 0.1, signalingRange: 2 },
      reproduction: { mutationRate: 0.03, reproductiveRate: 1.2 },
    }),
  },
  {
    name: 'Extremophile',
    description: 'High photosynthesis, survives in harsh environments.',
    strategy: 'Survives where others cannot. Slow but indestructible.',
    weakness: 'Low competitive ability in rich environments.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 4, surviveMin: 0, surviveMax: 5, longevity: 800 },
      movement: { mobility: 0.1, moveCost: 0.5 },
      energy: { metabolism: 0.3, efficiency: 0.5, maxEnergy: 8.0, starvationTolerance: 10, photosynthesis: 0.8, energyOnDeath: 0.8 },
      structure: { adhesion: 0.6, shellFormation: 0.3 },
      reproduction: { mutationRate: 0.01, reproductiveRate: 0.7 },
    }),
  },
  {
    name: 'Predator',
    description: 'Actively hunts and kills other populations.',
    strategy: 'High suppress, chases prey, gains from kills.',
    weakness: 'Boom/bust cycle. Needs prey to survive.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 1, birthMax: 3, surviveMin: 0, surviveMax: 3, birthEnergyCost: 1.2, spawnEnergy: 1.5 },
      movement: { mobility: 0.8, moveCost: 0.3, chaseThreshold: 1, momentum: 0.4 },
      energy: { metabolism: 1.5, efficiency: 0.8, maxEnergy: 8.0, starvationTolerance: 4 },
      structure: { adhesion: 0.3, signalingRange: 2 },
      reproduction: { mutationRate: 0.03, reproductiveRate: 1.1 },
    }),
  },
  {
    name: 'Architect',
    description: 'High differentiation, builds complex structures.',
    strategy: 'Specialized cells form emergent architecture.',
    weakness: 'Slow to develop. Vulnerable early.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 2, birthMax: 4, surviveMin: 0, surviveMax: 4, longevity: 300 },
      movement: { mobility: 0.2, moveCost: 0.4, swarmPull: 0.4 },
      energy: { metabolism: 0.7, efficiency: 1.0, maxEnergy: 7.0, photosynthesis: 0.15 },
      structure: { adhesion: 0.8, signalingRange: 2, differentiationChance: 0.25, shellFormation: 0.4, bridgeAffinity: 0.6 },
      reproduction: { mutationRate: 0.02, reproductiveRate: 0.9 },
    }),
  },
];
