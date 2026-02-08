// ============================================================================
// Primordial Soup — Main Application
// ============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSimulation } from './hooks/useSimulation.ts';
import { GridView } from './components/GridView.tsx';
import { Controls } from './components/Controls.tsx';
import { PopulationPanel } from './components/PopulationPanel.tsx';
import { GenomeEditor } from './components/GenomeEditor.tsx';
import { Dashboard, type PopulationHistory } from './components/Dashboard.tsx';
import { PRESETS } from '../engine/presets.ts';
import { createDefaultInteraction } from '../engine/types.ts';
import { colors } from './styles.ts';

export function App() {
  const sim = useSimulation({ width: 128, height: 128 });
  const [selectedPopulation, setSelectedPopulation] = useState<number | null>(null);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [rightPanel, setRightPanel] = useState<'genome' | 'dashboard'>('dashboard');
  const [, setRenderTick] = useState(0);
  const historyRef = useRef<PopulationHistory[]>([]);
  const lastHistoryTick = useRef(-1);
  const initialized = useRef(false);

  // Initialize with two default populations
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const state = sim.getState();

    // Add a Classic Life population
    const genome1 = PRESETS[0].createGenome(); // Classic Life
    sim.addPop('Classic Life', genome1, 40, 40, 50);

    // Add a Swarm population
    const genome2 = PRESETS[1].createGenome(); // Swarm
    sim.addPop('Swarm', genome2, 90, 90, 50);

    // Set up initial interactions
    const pop1 = state.populations.get(0);
    const pop2 = state.populations.get(1);
    if (pop1 && pop2) {
      pop1.genome.interactions.set(1, {
        neighborWeight: -0.5,
        suppress: 0.0,
        energyTransfer: 0.0,
        birthAssist: 0.0,
        signalMask: true,
      });
      pop2.genome.interactions.set(0, {
        neighborWeight: -0.5,
        suppress: 0.0,
        energyTransfer: 0.0,
        birthAssist: 0.0,
        signalMask: true,
      });
    }
  }, [sim]);

  // Record history periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const state = sim.getState();
      if (state.tick !== lastHistoryTick.current && state.running) {
        lastHistoryTick.current = state.tick;
        const sizes = new Map<number, number>();
        for (const [id, pop] of state.populations) {
          sizes.set(id, pop.cellCount);
        }
        historyRef.current.push({ tick: state.tick, sizes });

        // Keep last 1000 entries
        if (historyRef.current.length > 1000) {
          historyRef.current = historyRef.current.slice(-1000);
        }
      }
      setRenderTick(t => t + 1);
    }, 200);

    return () => clearInterval(interval);
  }, [sim]);

  const handleGenomeChange = useCallback(() => {
    setRenderTick(t => t + 1);
  }, []);

  const state = sim.getState();

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      padding: 8,
      background: colors.bg,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '4px 8px',
      }}>
        <h1 style={{
          fontSize: 18,
          fontWeight: 700,
          color: colors.textBright,
          margin: 0,
          letterSpacing: 1,
        }}>
          PRIMORDIAL SOUP
        </h1>
        <span style={{ fontSize: 11, color: colors.textDim }}>
          Interactive Evolutionary Cellular Automata
        </span>

        {/* View toggles */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <ToggleButton label="Terrain" active={showTerrain} onClick={() => setShowTerrain(!showTerrain)} />
          <ToggleButton label="Trails" active={showTrails} onClick={() => setShowTrails(!showTrails)} />
          <ToggleButton label="Energy" active={showEnergy} onClick={() => setShowEnergy(!showEnergy)} />
          <div style={{ width: 1, height: 20, background: colors.border }} />
          <ToggleButton label="Genome" active={rightPanel === 'genome'} onClick={() => setRightPanel('genome')} />
          <ToggleButton label="Stats" active={rightPanel === 'dashboard'} onClick={() => setRightPanel('dashboard')} />
        </div>
      </div>

      {/* Controls */}
      <Controls sim={sim} />

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', gap: 8, overflow: 'hidden' }}>
        {/* Left sidebar — Populations */}
        <div style={{
          width: 260,
          flexShrink: 0,
          overflow: 'auto',
        }}>
          <PopulationPanel
            sim={sim}
            selectedPopulation={selectedPopulation}
            onSelectPopulation={setSelectedPopulation}
          />
        </div>

        {/* Center — Grid View */}
        <GridView
          state={state}
          showTerrain={showTerrain}
          showTrails={showTrails}
          showEnergy={showEnergy}
        />

        {/* Right sidebar — Genome Editor or Dashboard */}
        <div style={{
          width: 300,
          flexShrink: 0,
          overflow: 'auto',
        }}>
          {rightPanel === 'genome' ? (
            <GenomeEditor
              state={state}
              selectedPopulation={selectedPopulation}
              onGenomeChange={handleGenomeChange}
            />
          ) : (
            <Dashboard state={state} history={historyRef.current} />
          )}
        </div>
      </div>
    </div>
  );
}

function ToggleButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? colors.accent : 'transparent',
        color: active ? colors.textBright : colors.textDim,
        border: `1px solid ${active ? colors.accent : colors.border}`,
        borderRadius: 4,
        padding: '3px 8px',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  );
}
