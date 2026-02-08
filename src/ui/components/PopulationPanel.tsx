// ============================================================================
// Population management panel
// ============================================================================

import { useState } from 'react';
import type { SimulationState, Genome } from '../../engine/types.ts';
import type { SimulationControls } from '../hooks/useSimulation.ts';
import { PRESETS } from '../../engine/presets.ts';
import { createDefaultGenome, createDefaultInteraction } from '../../engine/types.ts';
import { colors, panel, button, buttonDanger, buttonOutline, h3, label } from '../styles.ts';

interface PopulationPanelProps {
  sim: SimulationControls;
  onSelectPopulation: (id: number | null) => void;
  selectedPopulation: number | null;
}

export function PopulationPanel({ sim, onSelectPopulation, selectedPopulation }: PopulationPanelProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(0);

  const state = sim.getState();
  const populations = Array.from(state.populations.values());

  const handleAdd = () => {
    const preset = PRESETS[selectedPreset];
    const genome = preset.createGenome();

    // Set up default interactions with all existing populations
    for (const [otherId] of state.populations) {
      if (!genome.interactions.has(otherId)) {
        genome.interactions.set(otherId, createDefaultInteraction());
      }
    }

    // For presets with default interaction behaviors
    if (preset.name === 'Parasite') {
      for (const [otherId] of state.populations) {
        genome.interactions.set(otherId, {
          neighborWeight: 0.5,
          suppress: 0.0,
          energyTransfer: -0.5,
          birthAssist: 0.0,
          signalMask: true,
        });
      }
    } else if (preset.name === 'Predator') {
      for (const [otherId] of state.populations) {
        genome.interactions.set(otherId, {
          neighborWeight: -0.5,
          suppress: 0.3,
          energyTransfer: -0.3,
          birthAssist: 0.0,
          signalMask: true,
        });
      }
    } else if (preset.name === 'Symbiont') {
      for (const [otherId] of state.populations) {
        genome.interactions.set(otherId, {
          neighborWeight: 0.5,
          suppress: 0.0,
          energyTransfer: 0.3,
          birthAssist: 0.3,
          signalMask: true,
        });
      }
    }

    const name = newName || `${preset.name} ${state.nextPopulationId}`;

    // Place at random position
    const x = Math.floor(Math.random() * state.config.width * 0.6 + state.config.width * 0.2);
    const y = Math.floor(Math.random() * state.config.height * 0.6 + state.config.height * 0.2);

    sim.addPop(name, genome, x, y, 1);
    setShowAdd(false);
    setNewName('');
  };

  return (
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={h3}>Populations</h3>
        <button style={{ ...button, fontSize: 12, padding: '4px 10px' }} onClick={() => setShowAdd(!showAdd)}>
          + Add
        </button>
      </div>

      {/* Add population form */}
      {showAdd && (
        <div style={{
          background: colors.bgLight,
          borderRadius: 4,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          <input
            style={{
              background: colors.bgInput,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              color: colors.text,
              padding: '4px 8px',
              fontSize: 13,
            }}
            placeholder="Name (optional)"
            value={newName}
            onChange={e => setNewName(e.target.value)}
          />
          <select
            style={{
              background: colors.bgInput,
              border: `1px solid ${colors.border}`,
              borderRadius: 4,
              color: colors.text,
              padding: '4px 8px',
              fontSize: 13,
            }}
            value={selectedPreset}
            onChange={e => setSelectedPreset(Number(e.target.value))}
          >
            {PRESETS.map((p, i) => (
              <option key={i} value={i}>{p.name} — {p.description}</option>
            ))}
          </select>
          <div style={{ display: 'flex', gap: 6 }}>
            <button style={{ ...button, fontSize: 12 }} onClick={handleAdd}>Create</button>
            <button style={{ ...buttonOutline, fontSize: 12 }} onClick={() => setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Population list */}
      {populations.length === 0 && (
        <div style={{ fontSize: 12, color: colors.textDim, textAlign: 'center', padding: 16 }}>
          No populations yet. Click "+ Add" to create one.
        </div>
      )}

      {populations.map(pop => (
        <div
          key={pop.id}
          style={{
            background: selectedPopulation === pop.id ? colors.bgLight : 'transparent',
            border: `1px solid ${selectedPopulation === pop.id ? colors.accent : colors.border}`,
            borderRadius: 4,
            padding: 8,
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onClick={() => onSelectPopulation(selectedPopulation === pop.id ? null : pop.id)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{
              width: 12,
              height: 12,
              borderRadius: 3,
              background: `rgb(${pop.color[0]}, ${pop.color[1]}, ${pop.color[2]})`,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: colors.textBright, flex: 1 }}>
              {pop.name}
            </span>
            {!pop.alive && (
              <span style={{ fontSize: 10, color: colors.danger, fontWeight: 600 }}>EXTINCT</span>
            )}
            <button
              style={{
                background: 'none',
                border: 'none',
                color: colors.textDim,
                cursor: 'pointer',
                fontSize: 14,
                padding: '0 4px',
              }}
              onClick={(e) => { e.stopPropagation(); sim.removePop(pop.id); }}
              title="Remove population"
            >
              x
            </button>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: colors.textDim }}>
            <span>Cells: <b style={{ color: colors.text }}>{pop.cellCount}</b></span>
            <span>Territory: <b style={{ color: colors.text }}>{pop.territory}</b></span>
            <span>Gen: <b style={{ color: colors.text }}>{pop.generation}</b></span>
          </div>
          <div style={{ display: 'flex', gap: 12, fontSize: 11, color: colors.textDim, marginTop: 2 }}>
            <span>Avg Energy: <b style={{ color: colors.text }}>
              {pop.cellCount > 0 ? (pop.totalEnergyReserves / pop.cellCount).toFixed(1) : '0.0'}
            </b></span>
            <span>Fitness: <b style={{ color: colors.text }}>{pop.fitness.toFixed(2)}</b></span>
          </div>
        </div>
      ))}
    </div>
  );
}
