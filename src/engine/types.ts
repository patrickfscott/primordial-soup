// ============================================================================
// Primordial Soup — Core Type Definitions
// ============================================================================

/** Specialist cell types that emerge from differentiation */
export enum SpecialistType {
  None = 'none',
  Scout = 'scout',
  Guardian = 'guardian',
  Harvester = 'harvester',
  Relay = 'relay',
}

/** Terrain types for the environment */
export enum TerrainType {
  FertilePlains = 'fertile_plains',
  BarrenWasteland = 'barren_wasteland',
  Oasis = 'oasis',
  ToxicZone = 'toxic_zone',
  DeepVent = 'deep_vent',
  FlowCurrent = 'flow_current',
}

/** Season cycle */
export enum Season {
  Spring = 'spring',
  Summer = 'summer',
  Autumn = 'autumn',
  Winter = 'winter',
}

/** Environmental event types */
export enum EventType {
  Meteor = 'meteor',
  Drought = 'drought',
  Bloom = 'bloom',
  Plague = 'plague',
  Rift = 'rift',
}

// ============================================================================
// Genome Definition
// ============================================================================

/** Vitality genes — birth & death parameters (hex grid: 6 neighbors max) */
export interface VitalityGenes {
  birthMin: number;       // 1–4, default 2
  birthMax: number;       // 1–6, default 3
  surviveMin: number;     // 0–4, default 2
  surviveMax: number;     // 1–6, default 3
  longevity: number;      // 0–1000, default 0 (0=immortal)
  birthEnergyCost: number; // 0.0–5.0, default 1.0
  spawnEnergy: number;    // 0.5–3.0, default 1.0
}

/** Movement genes */
export interface MovementGenes {
  mobility: number;       // 0.0–1.0, default 0.0
  moveCost: number;       // 0.0–2.0, default 0.5
  chemotaxis: number;     // -1.0–1.0, default 0.0
  swarmPull: number;      // -1.0–1.0, default 0.0
  fleeThreshold: number;  // 0–6, default 0
  chaseThreshold: number; // 0–6, default 0
  momentum: number;       // 0.0–1.0, default 0.0
}

/** Per-population interaction genes */
export interface InteractionGenes {
  neighborWeight: number;  // -2.0–2.0, default 0.0
  suppress: number;        // 0.0–1.0, default 0.0
  energyTransfer: number;  // -1.0–1.0, default 0.0
  birthAssist: number;     // 0.0–1.0, default 0.0
  signalMask: boolean;     // default true
}

/** Energy & metabolism genes */
export interface EnergyGenes {
  metabolism: number;          // 0.1–3.0, default 1.0
  efficiency: number;          // 0.1–3.0, default 1.0
  maxEnergy: number;           // 1.0–20.0, default 5.0
  starvationTolerance: number; // 1–10, default 3
  photosynthesis: number;      // 0.0–1.0, default 0.0
  energyOnDeath: number;       // 0.0–1.0, default 0.5
}

/** Structure & signaling genes */
export interface StructureGenes {
  adhesion: number;              // 0.0–1.0, default 0.5
  signalingRange: number;        // 1–3, default 1
  differentiationChance: number; // 0.0–0.3, default 0.0
  shellFormation: number;        // 0.0–1.0, default 0.0
  bridgeAffinity: number;        // 0.0–1.0, default 0.0
}

/** Reproduction & mutation genes */
export interface ReproductionGenes {
  mutationRate: number;      // 0.001–0.15, default 0.02
  mutationMagnitude: number; // 0.05–1.0, default 0.2
  mutationBias: number;      // -0.5–0.5, default 0.0
  crossoverRate: number;     // 0.0–0.5, default 0.0
  reproductiveRate: number;  // 0.5–2.0, default 1.0
  offspringVariance: number; // 0.0–0.3, default 0.0
}

/** Complete genome for a population */
export interface Genome {
  vitality: VitalityGenes;
  movement: MovementGenes;
  interactions: Map<number, InteractionGenes>; // keyed by target population ID
  energy: EnergyGenes;
  structure: StructureGenes;
  reproduction: ReproductionGenes;
}

/** Serializable genome (interactions as record instead of Map) */
export interface SerializableGenome {
  vitality: VitalityGenes;
  movement: MovementGenes;
  interactions: Record<number, InteractionGenes>;
  energy: EnergyGenes;
  structure: StructureGenes;
  reproduction: ReproductionGenes;
}

// ============================================================================
// Gene metadata for UI and mutation
// ============================================================================

export interface GeneRange {
  min: number;
  max: number;
  default: number;
  step: number;
  type: 'int' | 'float' | 'bool';
  label: string;
  group: string;
}

export const GENE_RANGES: Record<string, GeneRange> = {
  // Vitality
  'vitality.birthMin':       { min: 1, max: 4, default: 1, step: 1, type: 'int', label: 'Birth Min Neighbors', group: 'Vitality' },
  'vitality.birthMax':       { min: 1, max: 6, default: 3, step: 1, type: 'int', label: 'Birth Max Neighbors', group: 'Vitality' },
  'vitality.surviveMin':     { min: 0, max: 4, default: 0, step: 1, type: 'int', label: 'Survive Min Neighbors', group: 'Vitality' },
  'vitality.surviveMax':     { min: 1, max: 6, default: 3, step: 1, type: 'int', label: 'Survive Max Neighbors', group: 'Vitality' },
  'vitality.longevity':      { min: 0, max: 1000, default: 0, step: 10, type: 'int', label: 'Longevity (0=immortal)', group: 'Vitality' },
  'vitality.birthEnergyCost':{ min: 0, max: 5, default: 1, step: 0.1, type: 'float', label: 'Birth Energy Cost', group: 'Vitality' },
  'vitality.spawnEnergy':    { min: 0.5, max: 3, default: 1, step: 0.1, type: 'float', label: 'Spawn Energy', group: 'Vitality' },
  // Movement
  'movement.mobility':       { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Mobility', group: 'Movement' },
  'movement.moveCost':       { min: 0, max: 2, default: 0.5, step: 0.1, type: 'float', label: 'Move Cost', group: 'Movement' },
  'movement.chemotaxis':     { min: -1, max: 1, default: 0, step: 0.05, type: 'float', label: 'Chemotaxis', group: 'Movement' },
  'movement.swarmPull':      { min: -1, max: 1, default: 0, step: 0.05, type: 'float', label: 'Swarm Pull', group: 'Movement' },
  'movement.fleeThreshold':  { min: 0, max: 6, default: 0, step: 1, type: 'int', label: 'Flee Threshold', group: 'Movement' },
  'movement.chaseThreshold': { min: 0, max: 6, default: 0, step: 1, type: 'int', label: 'Chase Threshold', group: 'Movement' },
  'movement.momentum':       { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Momentum', group: 'Movement' },
  // Energy
  'energy.metabolism':          { min: 0.1, max: 3, default: 1, step: 0.1, type: 'float', label: 'Metabolism', group: 'Energy' },
  'energy.efficiency':          { min: 0.1, max: 3, default: 1, step: 0.1, type: 'float', label: 'Efficiency', group: 'Energy' },
  'energy.maxEnergy':           { min: 1, max: 20, default: 5, step: 0.5, type: 'float', label: 'Max Energy', group: 'Energy' },
  'energy.starvationTolerance': { min: 1, max: 10, default: 3, step: 1, type: 'int', label: 'Starvation Tolerance', group: 'Energy' },
  'energy.photosynthesis':      { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Photosynthesis', group: 'Energy' },
  'energy.energyOnDeath':       { min: 0, max: 1, default: 0.5, step: 0.05, type: 'float', label: 'Energy on Death', group: 'Energy' },
  // Structure
  'structure.adhesion':              { min: 0, max: 1, default: 0.5, step: 0.05, type: 'float', label: 'Adhesion', group: 'Structure' },
  'structure.signalingRange':        { min: 1, max: 3, default: 1, step: 1, type: 'int', label: 'Signaling Range', group: 'Structure' },
  'structure.differentiationChance': { min: 0, max: 0.3, default: 0, step: 0.01, type: 'float', label: 'Differentiation Chance', group: 'Structure' },
  'structure.shellFormation':        { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Shell Formation', group: 'Structure' },
  'structure.bridgeAffinity':        { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Bridge Affinity', group: 'Structure' },
  // Reproduction
  'reproduction.mutationRate':      { min: 0.001, max: 0.15, default: 0.02, step: 0.001, type: 'float', label: 'Mutation Rate', group: 'Reproduction' },
  'reproduction.mutationMagnitude': { min: 0.05, max: 1, default: 0.2, step: 0.05, type: 'float', label: 'Mutation Magnitude', group: 'Reproduction' },
  'reproduction.mutationBias':      { min: -0.5, max: 0.5, default: 0, step: 0.05, type: 'float', label: 'Mutation Bias', group: 'Reproduction' },
  'reproduction.crossoverRate':     { min: 0, max: 0.5, default: 0, step: 0.01, type: 'float', label: 'Crossover Rate', group: 'Reproduction' },
  'reproduction.reproductiveRate':  { min: 0.5, max: 2, default: 1, step: 0.1, type: 'float', label: 'Reproductive Rate', group: 'Reproduction' },
  'reproduction.offspringVariance': { min: 0, max: 0.3, default: 0, step: 0.01, type: 'float', label: 'Offspring Variance', group: 'Reproduction' },
};

export const INTERACTION_GENE_RANGES: Record<string, GeneRange> = {
  'neighborWeight':  { min: -2, max: 2, default: 0, step: 0.1, type: 'float', label: 'Neighbor Weight', group: 'Interaction' },
  'suppress':        { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Suppress', group: 'Interaction' },
  'energyTransfer':  { min: -1, max: 1, default: 0, step: 0.05, type: 'float', label: 'Energy Transfer', group: 'Interaction' },
  'birthAssist':     { min: 0, max: 1, default: 0, step: 0.05, type: 'float', label: 'Birth Assist', group: 'Interaction' },
};

// ============================================================================
// Cell State
// ============================================================================

export interface Cell {
  populationId: number;
  genome: Genome;          // per-cell genome (inherited from parent + mutations)
  energy: number;
  age: number;
  dirX: number;           // movement direction X (-1, 0, 1)
  dirY: number;           // movement direction Y (-1, 0, 1)
  starvationCounter: number;
  specialist: SpecialistType;
}

// ============================================================================
// Tile State (environment)
// ============================================================================

export interface Tile {
  energy: number;
  terrain: TerrainType;
  baseEnergy: number;
  regenRate: number;
  currentDirX: number;   // flow current direction
  currentDirY: number;
}

// ============================================================================
// Population
// ============================================================================

export interface Population {
  id: number;
  name: string;
  color: [number, number, number]; // RGB 0-255
  genome: Genome;
  cellCount: number;
  peakCellCount: number;
  totalEnergyReserves: number;
  territory: number;       // distinct 8x8 chunks occupied
  fitness: number;
  generation: number;
  alive: boolean;
  lockedGenes: Set<string>; // gene paths that won't mutate
  lineage: GenomeMutation[];
}

export interface GenomeMutation {
  generation: number;
  gene: string;
  oldValue: number;
  newValue: number;
  fitness: number;
}

// ============================================================================
// Simulation State
// ============================================================================

export interface SimulationConfig {
  width: number;
  height: number;
  ticksPerGeneration: number;
  seasonLength: number;       // ticks per season
  eventProbability: number;   // chance of event per tick
  carryingCapacityPerChunk: number;
  chunkSize: number;
  enableSeasons: boolean;
  enableEvents: boolean;
  enableStructureDetection: boolean;
  enableMutation: boolean;
}

export interface SimulationState {
  config: SimulationConfig;
  tick: number;
  generation: number;
  season: Season;
  populations: Map<number, Population>;
  grid: (Cell | null)[];       // flat array, width * height
  environment: Tile[];         // flat array, width * height
  running: boolean;
  speed: number;               // ticks per frame
  nextPopulationId: number;
  activeEvents: ActiveEvent[];
  stats: TickStats;
}

export interface ActiveEvent {
  type: EventType;
  x: number;
  y: number;
  radius: number;
  remainingTicks: number;
}

export interface TickStats {
  populationSizes: Map<number, number>;
  populationEnergies: Map<number, number>;
  births: number;
  deaths: number;
  movements: number;
  suppressions: number;
}

// ============================================================================
// Structure types for detection
// ============================================================================

export enum StructureType {
  StableCluster = 'stable_cluster',
  Oscillator = 'oscillator',
  Glider = 'glider',
  Enclosure = 'enclosure',
  Bridge = 'bridge',
}

export interface DetectedStructure {
  type: StructureType;
  cells: [number, number][]; // positions
  populationId: number;
  age: number; // ticks since detection
}

// ============================================================================
// Default genome factory
// ============================================================================

/** Deep clone a genome, including the interactions Map */
export function cloneGenome(g: Genome): Genome {
  const interactions = new Map<number, InteractionGenes>();
  for (const [k, v] of g.interactions) {
    interactions.set(k, { ...v });
  }
  return {
    vitality: { ...g.vitality },
    movement: { ...g.movement },
    interactions,
    energy: { ...g.energy },
    structure: { ...g.structure },
    reproduction: { ...g.reproduction },
  };
}

export function createDefaultGenome(): Genome {
  return {
    vitality: {
      birthMin: 1,
      birthMax: 3,
      surviveMin: 0,
      surviveMax: 3,
      longevity: 0,
      birthEnergyCost: 1.0,
      spawnEnergy: 1.0,
    },
    movement: {
      mobility: 0.0,
      moveCost: 0.5,
      chemotaxis: 0.0,
      swarmPull: 0.0,
      fleeThreshold: 0,
      chaseThreshold: 0,
      momentum: 0.0,
    },
    interactions: new Map(),
    energy: {
      metabolism: 1.0,
      efficiency: 1.0,
      maxEnergy: 5.0,
      starvationTolerance: 3,
      photosynthesis: 0.0,
      energyOnDeath: 0.5,
    },
    structure: {
      adhesion: 0.5,
      signalingRange: 1,
      differentiationChance: 0.0,
      shellFormation: 0.0,
      bridgeAffinity: 0.0,
    },
    reproduction: {
      mutationRate: 0.02,
      mutationMagnitude: 0.2,
      mutationBias: 0.0,
      crossoverRate: 0.0,
      reproductiveRate: 1.0,
      offspringVariance: 0.0,
    },
  };
}

export function createDefaultInteraction(): InteractionGenes {
  return {
    neighborWeight: 0.0,
    suppress: 0.0,
    energyTransfer: 0.0,
    birthAssist: 0.0,
    signalMask: true,
  };
}

/** Default simulation config */
export function createDefaultConfig(): SimulationConfig {
  return {
    width: 128,
    height: 128,
    ticksPerGeneration: 100,
    seasonLength: 100,
    eventProbability: 0.002,
    carryingCapacityPerChunk: 40,
    chunkSize: 16,
    enableSeasons: true,
    enableEvents: true,
    enableStructureDetection: true,
    enableMutation: true,
  };
}

/** Population colors palette */
export const POPULATION_COLORS: [number, number, number][] = [
  [0, 180, 255],    // cyan-blue
  [255, 80, 80],    // red
  [80, 220, 80],    // green
  [255, 200, 40],   // gold
  [200, 80, 255],   // purple
  [255, 140, 40],   // orange
  [40, 255, 200],   // teal
  [255, 80, 200],   // pink
  [140, 200, 255],  // light blue
  [200, 255, 80],   // lime
  [255, 160, 160],  // salmon
  [80, 160, 200],   // steel blue
  [200, 160, 80],   // tan
  [160, 80, 200],   // violet
  [80, 200, 160],   // sea green
  [200, 200, 200],  // silver
];
