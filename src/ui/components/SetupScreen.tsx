// ============================================================================
// Setup screen — configure starting cultures before simulation begins
// ============================================================================

import { useState, useCallback } from 'react';
import type { Genome } from '../../engine/types.ts';
import { PRESETS, createRandomGenome } from '../../engine/presets.ts';
import { GENE_RANGES, POPULATION_COLORS, createDefaultInteraction } from '../../engine/types.ts';
import { colors, panel, button, buttonOutline, h3, input as inputStyle } from '../styles.ts';

export interface CultureConfig {
  presetIndex: number; // -1 = random
  name: string;
  startingCells: number;
  genome: Genome;      // the actual genome (editable)
}

interface SetupScreenProps {
  onStart: (cultures: CultureConfig[]) => void;
}

const RANDOM_NAMES = [
  'Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta',
  'Iota', 'Kappa', 'Lambda', 'Mu', 'Nu', 'Xi', 'Omicron', 'Pi',
];

function createCulture(presetIndex: number, slotIndex: number): CultureConfig {
  if (presetIndex === -1) {
    return {
      presetIndex: -1,
      name: RANDOM_NAMES[slotIndex % RANDOM_NAMES.length],
      startingCells: 1,
      genome: createRandomGenome(),
    };
  }
  const preset = PRESETS[presetIndex];
  return {
    presetIndex,
    name: preset.name,
    startingCells: 1,
    genome: preset.createGenome(),
  };
}

// Key gene paths to expose as quick-edit sliders
const QUICK_EDIT_GENES = [
  'vitality.surviveMin',
  'vitality.birthMin',
  'vitality.birthMax',
  'movement.mobility',
  'energy.photosynthesis',
  'energy.metabolism',
  'energy.maxEnergy',
  'reproduction.mutationRate',
  'reproduction.reproductiveRate',
  'structure.adhesion',
] as const;

function getGeneValue(genome: Genome, path: string): number {
  const [group, key] = path.split('.');
  const obj = genome[group as keyof Genome] as unknown as Record<string, number>;
  return obj[key];
}

function setGeneValue(genome: Genome, path: string, value: number): void {
  const [group, key] = path.split('.');
  const obj = genome[group as keyof Genome] as unknown as Record<string, number>;
  obj[key] = value;
}

export function SetupScreen({ onStart }: SetupScreenProps) {
  const [cultures, setCultures] = useState<CultureConfig[]>([
    createCulture(0, 0),
    createCulture(1, 1),
  ]);
  const [expandedSlot, setExpandedSlot] = useState<number | null>(null);

  const addCulture = useCallback(() => {
    setCultures(prev => {
      if (prev.length >= 8) return prev;
      return [...prev, createCulture(-1, prev.length)];
    });
  }, []);

  const removeCulture = useCallback((index: number) => {
    setCultures(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const updateCulture = useCallback((index: number, updates: Partial<CultureConfig>) => {
    setCultures(prev => prev.map((c, i) => i === index ? { ...c, ...updates } : c));
  }, []);

  const changePreset = useCallback((index: number, presetIndex: number) => {
    setCultures(prev => prev.map((c, i) => {
      if (i !== index) return c;
      const newCulture = createCulture(presetIndex, i);
      newCulture.name = c.name; // preserve custom name
      newCulture.startingCells = c.startingCells;
      return newCulture;
    }));
  }, []);

  const rerollRandom = useCallback((index: number) => {
    setCultures(prev => prev.map((c, i) => {
      if (i !== index || c.presetIndex !== -1) return c;
      return { ...c, genome: createRandomGenome() };
    }));
  }, []);

  const handleStart = useCallback(() => {
    onStart(cultures);
  }, [cultures, onStart]);

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: colors.bg,
    }}>
      <div style={{
        ...panel,
        width: 620,
        maxHeight: '90vh',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}>
        {/* Title */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: 24,
            fontWeight: 700,
            color: colors.textBright,
            margin: '0 0 4px 0',
            letterSpacing: 2,
          }}>
            PRIMORDIAL SOUP
          </h1>
          <div style={{ fontSize: 12, color: colors.textDim }}>
            Configure your starting cultures
          </div>
        </div>

        {/* Culture slots */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ ...h3, margin: 0 }}>Starting Cultures ({cultures.length})</h3>
            <button
              style={{
                ...button,
                fontSize: 12,
                padding: '4px 12px',
                opacity: cultures.length >= 8 ? 0.4 : 1,
              }}
              onClick={addCulture}
              disabled={cultures.length >= 8}
            >
              + Add Culture
            </button>
          </div>

          {cultures.map((culture, index) => {
            const popColor = POPULATION_COLORS[index % POPULATION_COLORS.length];
            const isExpanded = expandedSlot === index;

            return (
              <div
                key={index}
                style={{
                  background: colors.bgLight,
                  border: `1px solid ${isExpanded ? colors.accent : colors.border}`,
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                {/* Slot header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedSlot(isExpanded ? null : index)}
                >
                  <div style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    background: `rgb(${popColor[0]}, ${popColor[1]}, ${popColor[2]})`,
                    flexShrink: 0,
                  }} />

                  {/* Name */}
                  <input
                    style={{
                      ...inputStyle,
                      flex: 1,
                      background: colors.bgInput,
                      fontSize: 13,
                      fontWeight: 500,
                    }}
                    value={culture.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateCulture(index, { name: e.target.value })}
                    placeholder="Culture name"
                  />

                  {/* Preset selector */}
                  <select
                    style={{
                      ...inputStyle,
                      width: 130,
                      fontSize: 12,
                    }}
                    value={culture.presetIndex}
                    onClick={e => e.stopPropagation()}
                    onChange={e => changePreset(index, Number(e.target.value))}
                  >
                    {PRESETS.map((p, i) => (
                      <option key={i} value={i}>{p.name}</option>
                    ))}
                    <option value={-1}>Random</option>
                  </select>

                  {/* Starting cells */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ fontSize: 10, color: colors.textDim, whiteSpace: 'nowrap' }}>Cells:</span>
                    <input
                      type="number"
                      style={{ ...inputStyle, width: 44, fontSize: 12, textAlign: 'center' }}
                      min={1}
                      max={100}
                      value={culture.startingCells}
                      onClick={e => e.stopPropagation()}
                      onChange={e => updateCulture(index, {
                        startingCells: Math.max(1, Math.min(100, Number(e.target.value) || 1)),
                      })}
                    />
                  </div>

                  {/* Expand arrow */}
                  <span style={{ fontSize: 10, color: colors.textDim }}>
                    {isExpanded ? '\u25B2' : '\u25BC'}
                  </span>

                  {/* Remove */}
                  <button
                    style={{
                      background: 'none',
                      border: 'none',
                      color: cultures.length > 1 ? colors.danger : colors.border,
                      cursor: cultures.length > 1 ? 'pointer' : 'default',
                      fontSize: 14,
                      padding: '0 2px',
                      fontFamily: 'inherit',
                    }}
                    onClick={e => { e.stopPropagation(); removeCulture(index); }}
                    disabled={cultures.length <= 1}
                    title="Remove culture"
                  >
                    x
                  </button>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div style={{
                    borderTop: `1px solid ${colors.border}`,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}>
                    {/* Preset description */}
                    {culture.presetIndex >= 0 && (
                      <div style={{ fontSize: 11, color: colors.textDim, marginBottom: 4 }}>
                        <b style={{ color: colors.text }}>{PRESETS[culture.presetIndex].strategy}</b>
                        <br />
                        Weakness: {PRESETS[culture.presetIndex].weakness}
                      </div>
                    )}
                    {culture.presetIndex === -1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: colors.textDim }}>
                          Randomized genome.
                        </span>
                        <button
                          style={{ ...buttonOutline, fontSize: 11, padding: '2px 8px' }}
                          onClick={() => rerollRandom(index)}
                        >
                          Reroll
                        </button>
                      </div>
                    )}

                    {/* Quick-edit gene sliders */}
                    <div style={{ fontSize: 11, color: colors.textDim, fontWeight: 600, marginTop: 2 }}>
                      Gene Tuning
                    </div>
                    {QUICK_EDIT_GENES.map(path => {
                      const range = GENE_RANGES[path];
                      if (!range) return null;
                      const value = getGeneValue(culture.genome, path);
                      return (
                        <div key={path} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            fontSize: 11,
                            color: colors.textDim,
                            width: 110,
                            flexShrink: 0,
                          }}>
                            {range.label}
                          </span>
                          <input
                            type="range"
                            min={range.min}
                            max={range.max}
                            step={range.step}
                            value={value}
                            onChange={e => {
                              const newGenome = { ...culture.genome };
                              setGeneValue(newGenome, path, Number(e.target.value));
                              updateCulture(index, { genome: newGenome });
                            }}
                            style={{ flex: 1, accentColor: colors.accent }}
                          />
                          <span style={{
                            fontSize: 11,
                            color: colors.text,
                            width: 36,
                            textAlign: 'right',
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {range.type === 'int' ? Math.round(value) : value.toFixed(2)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Quick presets row */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontSize: 11, color: colors.textDim }}>Quick Setup</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <QuickButton label="2 Random" onClick={() => {
              setCultures([createCulture(-1, 0), createCulture(-1, 1)]);
            }} />
            <QuickButton label="3 Random" onClick={() => {
              setCultures([createCulture(-1, 0), createCulture(-1, 1), createCulture(-1, 2)]);
            }} />
            <QuickButton label="4 Random" onClick={() => {
              setCultures([
                createCulture(-1, 0), createCulture(-1, 1),
                createCulture(-1, 2), createCulture(-1, 3),
              ]);
            }} />
            <QuickButton label="Predator vs Prey" onClick={() => {
              const pred = createCulture(7, 0); // Predator
              pred.name = 'Predator';
              const prey = createCulture(0, 1); // Classic Life
              prey.name = 'Prey';
              setCultures([pred, prey]);
            }} />
            <QuickButton label="Ecosystem" onClick={() => {
              setCultures([
                createCulture(0, 0), // Classic Life
                createCulture(1, 1), // Swarm
                createCulture(3, 2), // Parasite
                createCulture(4, 3), // Symbiont
              ]);
            }} />
            <QuickButton label="All Presets" onClick={() => {
              setCultures(PRESETS.map((_, i) => createCulture(i, i)).slice(0, 8));
            }} />
          </div>
        </div>

        {/* Start */}
        <button
          style={{
            ...button,
            width: '100%',
            padding: '12px 0',
            fontSize: 16,
            fontWeight: 700,
            letterSpacing: 1,
          }}
          onClick={handleStart}
        >
          Start Simulation
        </button>
      </div>
    </div>
  );
}

function QuickButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      style={{
        ...buttonOutline,
        fontSize: 11,
        padding: '4px 10px',
      }}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
