// ============================================================================
// Genome Editor — slider-based genome editing
// ============================================================================

import { useState, useMemo } from 'react';
import type { SimulationState, Population, Genome, InteractionGenes } from '../../engine/types.ts';
import { GENE_RANGES, INTERACTION_GENE_RANGES, createDefaultInteraction } from '../../engine/types.ts';
import { colors, panel, h3, label } from '../styles.ts';

interface GenomeEditorProps {
  state: SimulationState;
  selectedPopulation: number | null;
  onGenomeChange: () => void;
}

export function GenomeEditor({ state, selectedPopulation, onGenomeChange }: GenomeEditorProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>('Vitality');

  const population = selectedPopulation !== null ? state.populations.get(selectedPopulation) : null;

  if (!population) {
    return (
      <div style={{ ...panel, textAlign: 'center', color: colors.textDim, fontSize: 12, padding: 24 }}>
        Select a population to edit its genome
      </div>
    );
  }

  const genome = population.genome;

  // Group genes
  const groups = useMemo(() => {
    const grouped: Record<string, { path: string; range: typeof GENE_RANGES[string] }[]> = {};
    for (const [path, range] of Object.entries(GENE_RANGES)) {
      if (!grouped[range.group]) grouped[range.group] = [];
      grouped[range.group].push({ path, range });
    }
    return grouped;
  }, []);

  const getGeneValue = (path: string): number => {
    const [group, key] = path.split('.');
    const obj = genome[group as keyof Genome] as unknown as Record<string, unknown>;
    return (obj?.[key] as number) ?? 0;
  };

  const setGeneValue = (path: string, value: number) => {
    const [group, key] = path.split('.');
    const obj = genome[group as keyof Genome] as unknown as Record<string, unknown>;
    if (obj) {
      obj[key] = value;
      onGenomeChange();
    }
  };

  const isLocked = (path: string) => population.lockedGenes.has(path);

  const toggleLock = (path: string) => {
    if (population.lockedGenes.has(path)) {
      population.lockedGenes.delete(path);
    } else {
      population.lockedGenes.add(path);
    }
    onGenomeChange();
  };

  // Other populations for interaction editing
  const otherPopulations = Array.from(state.populations.values()).filter(p => p.id !== selectedPopulation);

  return (
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'auto', maxHeight: '100%' }}>
      <h3 style={{ ...h3, position: 'sticky', top: 0, background: colors.bgPanel, paddingBottom: 4, zIndex: 1 }}>
        Genome: {population.name}
      </h3>

      {/* Gene groups */}
      {Object.entries(groups).map(([groupName, genes]) => (
        <div key={groupName}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: expandedGroup === groupName ? colors.accent : colors.textDim,
              cursor: 'pointer',
              padding: '6px 0',
              borderBottom: `1px solid ${colors.border}`,
              userSelect: 'none',
            }}
            onClick={() => setExpandedGroup(expandedGroup === groupName ? null : groupName)}
          >
            {expandedGroup === groupName ? '- ' : '+ '}{groupName}
          </div>
          {expandedGroup === groupName && (
            <div style={{ padding: '6px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {genes.map(({ path, range }) => (
                <GeneSlider
                  key={path}
                  label={range.label}
                  value={getGeneValue(path)}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  locked={isLocked(path)}
                  onLock={() => toggleLock(path)}
                  onChange={(v) => setGeneValue(path, range.type === 'int' ? Math.round(v) : v)}
                />
              ))}
            </div>
          )}
        </div>
      ))}

      {/* Interaction genes */}
      {otherPopulations.length > 0 && (
        <div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: expandedGroup === 'Interactions' ? colors.accent : colors.textDim,
              cursor: 'pointer',
              padding: '6px 0',
              borderBottom: `1px solid ${colors.border}`,
              userSelect: 'none',
            }}
            onClick={() => setExpandedGroup(expandedGroup === 'Interactions' ? null : 'Interactions')}
          >
            {expandedGroup === 'Interactions' ? '- ' : '+ '}Interactions
          </div>
          {expandedGroup === 'Interactions' && (
            <div style={{ padding: '6px 0' }}>
              {otherPopulations.map(otherPop => {
                let interaction = genome.interactions.get(otherPop.id);
                if (!interaction) {
                  interaction = createDefaultInteraction();
                  genome.interactions.set(otherPop.id, interaction);
                }
                return (
                  <div key={otherPop.id} style={{ marginBottom: 10 }}>
                    <div style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: `rgb(${otherPop.color[0]}, ${otherPop.color[1]}, ${otherPop.color[2]})`,
                      marginBottom: 4,
                    }}>
                      vs. {otherPop.name}
                    </div>
                    {Object.entries(INTERACTION_GENE_RANGES).map(([key, range]) => (
                      <GeneSlider
                        key={`${otherPop.id}-${key}`}
                        label={range.label}
                        value={(interaction as unknown as Record<string, number>)[key] ?? range.default}
                        min={range.min}
                        max={range.max}
                        step={range.step}
                        locked={false}
                        onLock={() => {}}
                        onChange={(v) => {
                          (interaction as unknown as Record<string, number>)[key] = v;
                          onGenomeChange();
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Gene Slider Component
// ============================================================================

function GeneSlider({
  label: labelText,
  value,
  min,
  max,
  step,
  locked,
  onLock,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  locked: boolean;
  onLock: () => void;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <button
        style={{
          background: 'none',
          border: 'none',
          color: locked ? colors.warning : colors.textDim,
          cursor: 'pointer',
          fontSize: 12,
          padding: 0,
          width: 14,
          flexShrink: 0,
        }}
        onClick={onLock}
        title={locked ? 'Unlock gene' : 'Lock gene (prevent mutation)'}
      >
        {locked ? 'L' : 'U'}
      </button>
      <span style={{
        fontSize: 11,
        color: colors.textDim,
        width: 110,
        flexShrink: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {labelText}
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{
          flex: 1,
          height: 4,
          accentColor: colors.accent,
        }}
      />
      <span style={{
        fontSize: 11,
        color: colors.text,
        width: 40,
        textAlign: 'right',
        flexShrink: 0,
        fontFamily: 'monospace',
      }}>
        {Number.isInteger(step) && step >= 1 ? value : value.toFixed(2)}
      </span>
    </div>
  );
}
