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
    description: 'Standard Conway\'s Game of Life rules with energy.',
    strategy: 'Classic GoL patterns emerge naturally.',
    weakness: 'No movement or interactions.',
    createGenome: () => mergeGenome({}),
  },
  {
    name: 'Swarm',
    description: 'High birth rate, high mobility, low adhesion, fast metabolism.',
    strategy: 'Rapid expansion, overwhelms through numbers.',
    weakness: 'Fragile — no structures, vulnerable to hostile environments.',
    createGenome: () => mergeGenome({
      vitality: { birthMin: 2, birthMax: 4, surviveMin: 1, surviveMax: 4, birthEnergyCost: 0.5, spawnEnergy: 0.8 },
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
      vitality: { birthMin: 3, birthMax: 4, surviveMin: 2, surviveMax: 5, longevity: 500 },
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
      vitality: { birthMin: 2, birthMax: 3, surviveMin: 1, surviveMax: 3, birthEnergyCost: 0.5 },
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
      vitality: { birthMin: 2, birthMax: 4, surviveMin: 1, surviveMax: 4, birthEnergyCost: 0.8 },
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
      vitality: { birthMin: 2, birthMax: 3, surviveMin: 1, surviveMax: 3, birthEnergyCost: 0.6, spawnEnergy: 1.2 },
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
      vitality: { birthMin: 2, birthMax: 4, surviveMin: 1, surviveMax: 5, longevity: 800 },
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
      vitality: { birthMin: 2, birthMax: 3, surviveMin: 1, surviveMax: 3, birthEnergyCost: 1.2, spawnEnergy: 1.5 },
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
      vitality: { birthMin: 3, birthMax: 4, surviveMin: 2, surviveMax: 4, longevity: 300 },
      movement: { mobility: 0.2, moveCost: 0.4, swarmPull: 0.4 },
      energy: { metabolism: 0.7, efficiency: 1.0, maxEnergy: 7.0, photosynthesis: 0.15 },
      structure: { adhesion: 0.8, signalingRange: 2, differentiationChance: 0.25, shellFormation: 0.4, bridgeAffinity: 0.6 },
      reproduction: { mutationRate: 0.02, reproductiveRate: 0.9 },
    }),
  },
];
