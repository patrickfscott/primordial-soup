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
import { SetupScreen, type CultureConfig } from './components/SetupScreen.tsx';
import { createDefaultInteraction } from '../engine/types.ts';
import { colors } from './styles.ts';

export function App() {
  const sim = useSimulation({ width: 128, height: 128 });
  const [started, setStarted] = useState(false);
  const [selectedPopulation, setSelectedPopulation] = useState<number | null>(null);
  const [showTerrain, setShowTerrain] = useState(true);
  const [showTrails, setShowTrails] = useState(true);
  const [showEnergy, setShowEnergy] = useState(true);
  const [rightPanel, setRightPanel] = useState<'genome' | 'dashboard'>('dashboard');
  const [, setRenderTick] = useState(0);
  const historyRef = useRef<PopulationHistory[]>([]);
  const lastHistoryTick = useRef(-1);

  const handleStart = useCallback((cultures: CultureConfig[]) => {
    // Reset simulation to clear any previous state
    sim.reset();

    // Add each culture
    const state = sim.getState();
    const w = state.config.width;
    const h = state.config.height;

    // Distribute starting positions evenly around the grid
    cultures.forEach((culture, i) => {
      const angle = (2 * Math.PI * i) / cultures.length;
      const cx = Math.round(w / 2 + Math.cos(angle) * w * 0.25);
      const cy = Math.round(h / 2 + Math.sin(angle) * h * 0.25);
      sim.addPop(culture.name, culture.genome, cx, cy, culture.startingCells);
    });

    // Set up default competitive interactions between all populations
    for (const [idA, popA] of state.populations) {
      for (const [idB] of state.populations) {
        if (idA === idB) continue;
        if (!popA.genome.interactions.has(idB)) {
          popA.genome.interactions.set(idB, {
            ...createDefaultInteraction(),
            neighborWeight: -0.3,
          });
        }
      }
    }

    historyRef.current = [];
    lastHistoryTick.current = -1;
    setStarted(true);
  }, [sim]);

  const handleBackToSetup = useCallback(() => {
    sim.pause();
    sim.reset();
    historyRef.current = [];
    lastHistoryTick.current = -1;
    setStarted(false);
    setSelectedPopulation(null);
  }, [sim]);

  // Record history periodically
  useEffect(() => {
    if (!started) return;
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
  }, [sim, started]);

  const handleGenomeChange = useCallback(() => {
    setRenderTick(t => t + 1);
  }, []);

  // Setup screen
  if (!started) {
    return <SetupScreen onStart={handleStart} />;
  }

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
      <Controls sim={sim} onNewSimulation={handleBackToSetup} />

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
