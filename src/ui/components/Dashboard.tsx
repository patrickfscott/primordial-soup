// ============================================================================
// Dashboard — population stats and visualization overlays
// ============================================================================

import { useRef, useEffect } from 'react';
import type { SimulationState, Population } from '../../engine/types.ts';
import { colors, panel, h3 } from '../styles.ts';

interface DashboardProps {
  state: SimulationState;
  history: PopulationHistory[];
}

export interface PopulationHistory {
  tick: number;
  sizes: Map<number, number>;
}

export function Dashboard({ state, history }: DashboardProps) {
  const populations = Array.from(state.populations.values());

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Population graph */}
      <div style={panel}>
        <h3 style={h3}>Population Over Time</h3>
        <PopulationGraph
          populations={populations}
          history={history}
          width={280}
          height={120}
        />
      </div>

      {/* Quick stats */}
      <div style={panel}>
        <h3 style={h3}>Simulation Stats</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
          <StatItem label="Tick" value={state.tick.toString()} />
          <StatItem label="Generation" value={state.generation.toString()} />
          <StatItem label="Season" value={state.season} />
          <StatItem label="Populations" value={populations.filter(p => p.alive).length.toString()} />
          <StatItem label="Total Cells" value={populations.reduce((s, p) => s + p.cellCount, 0).toString()} />
          <StatItem label="Events" value={state.activeEvents.length.toString()} />
          <StatItem label="Births/tick" value={state.stats.births.toString()} />
          <StatItem label="Deaths/tick" value={state.stats.deaths.toString()} />
        </div>
      </div>

      {/* Interaction matrix */}
      {populations.length >= 2 && (
        <div style={panel}>
          <h3 style={h3}>Interaction Matrix</h3>
          <InteractionMatrix populations={populations} />
        </div>
      )}
    </div>
  );
}

function StatItem({ label: l, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: colors.textDim }}>{l}</span>
      <span style={{ color: colors.text, fontWeight: 500 }}>{value}</span>
    </div>
  );
}

// ============================================================================
// Population Graph (mini canvas)
// ============================================================================

function PopulationGraph({
  populations,
  history,
  width,
  height,
}: {
  populations: Population[];
  history: PopulationHistory[];
  width: number;
  height: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = width;
    canvas.height = height;

    ctx.fillStyle = colors.bgLight;
    ctx.fillRect(0, 0, width, height);

    if (history.length < 2) {
      ctx.fillStyle = colors.textDim;
      ctx.font = '10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for data...', width / 2, height / 2);
      return;
    }

    // Find max population size for scaling
    let maxSize = 10;
    for (const h of history) {
      for (const size of h.sizes.values()) {
        if (size > maxSize) maxSize = size;
      }
    }

    // Draw grid lines
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 4; i++) {
      const y = (height * (i + 1)) / 5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Draw lines per population
    const displayHistory = history.slice(-200);

    for (const pop of populations) {
      ctx.strokeStyle = `rgb(${pop.color[0]}, ${pop.color[1]}, ${pop.color[2]})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      let started = false;
      for (let i = 0; i < displayHistory.length; i++) {
        const x = (i / (displayHistory.length - 1)) * width;
        const size = displayHistory[i].sizes.get(pop.id) || 0;
        const y = height - (size / maxSize) * (height - 4);

        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }
  }, [populations, history, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ borderRadius: 4, display: 'block', width: '100%', height: 120 }}
    />
  );
}

// ============================================================================
// Interaction Matrix
// ============================================================================

function InteractionMatrix({ populations }: { populations: Population[] }) {
  const alivePops = populations.filter(p => p.alive);
  if (alivePops.length < 2) return null;

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: 10, width: '100%' }}>
        <thead>
          <tr>
            <th style={{ padding: 2 }}></th>
            {alivePops.map(p => (
              <th key={p.id} style={{
                padding: 2,
                color: `rgb(${p.color[0]}, ${p.color[1]}, ${p.color[2]})`,
                fontWeight: 600,
                maxWidth: 40,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                {p.name.slice(0, 4)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alivePops.map(from => (
            <tr key={from.id}>
              <td style={{
                padding: 2,
                color: `rgb(${from.color[0]}, ${from.color[1]}, ${from.color[2]})`,
                fontWeight: 600,
              }}>
                {from.name.slice(0, 4)}
              </td>
              {alivePops.map(to => {
                if (from.id === to.id) {
                  return <td key={to.id} style={{ padding: 2, textAlign: 'center', color: colors.textDim }}>-</td>;
                }
                const interaction = from.genome.interactions.get(to.id);
                if (!interaction) {
                  return <td key={to.id} style={{ padding: 2, textAlign: 'center', color: colors.textDim }}>?</td>;
                }

                // Classify relationship
                const nw = interaction.neighborWeight;
                const et = interaction.energyTransfer;
                const sp = interaction.suppress;

                let emoji = '';
                let color = colors.textDim;

                if (sp > 0.2) { emoji = 'ATK'; color = colors.danger; }
                else if (et < -0.2) { emoji = 'DRN'; color = '#ff8844'; }
                else if (et > 0.2 && nw > 0.3) { emoji = 'AID'; color = colors.success; }
                else if (nw > 0.3) { emoji = 'FRD'; color = '#88ff88'; }
                else if (nw < -0.3) { emoji = 'HOS'; color = '#ff6666'; }
                else { emoji = 'NEU'; color = colors.textDim; }

                return (
                  <td key={to.id} style={{
                    padding: 2,
                    textAlign: 'center',
                    color,
                    fontWeight: 500,
                    fontSize: 9,
                  }}>
                    {emoji}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
