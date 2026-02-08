// ============================================================================
// Playback controls
// ============================================================================

import type { SimulationControls } from '../hooks/useSimulation.ts';
import { colors, button, buttonOutline } from '../styles.ts';

interface ControlsProps {
  sim: SimulationControls;
  onNewSimulation?: () => void;
}

export function Controls({ sim, onNewSimulation }: ControlsProps) {
  const speedOptions = [1, 2, 5, 10, 25, 50, 100];

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '8px 12px',
      background: colors.bgPanel,
      border: `1px solid ${colors.border}`,
      borderRadius: 6,
    }}>
      {/* Play/Pause */}
      <button
        style={sim.isRunning ? { ...buttonOutline, minWidth: 60 } : { ...button, minWidth: 60 }}
        onClick={sim.isRunning ? sim.pause : sim.play}
      >
        {sim.isRunning ? 'Pause' : 'Play'}
      </button>

      {/* Step */}
      <button
        style={buttonOutline}
        onClick={sim.step}
        disabled={sim.isRunning}
      >
        Step
      </button>

      {/* Speed selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 11, color: colors.textDim }}>Speed:</span>
        <select
          value={sim.speed}
          onChange={(e) => sim.setSpeed(Number(e.target.value))}
          style={{
            background: colors.bgInput,
            border: `1px solid ${colors.border}`,
            borderRadius: 4,
            color: colors.text,
            padding: '4px 6px',
            fontSize: 12,
          }}
        >
          {speedOptions.map(s => (
            <option key={s} value={s}>{s}x</option>
          ))}
        </select>
      </div>

      {/* New Simulation / Reset */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        {onNewSimulation && (
          <button style={buttonOutline} onClick={onNewSimulation}>
            New
          </button>
        )}
        <button style={buttonOutline} onClick={() => sim.reset()}>
          Reset
        </button>
      </div>

      {/* Stats */}
      <div style={{ fontSize: 11, color: colors.textDim, marginLeft: 8 }}>
        FPS: {sim.fps} | TPS: {sim.tps}
      </div>
    </div>
  );
}
