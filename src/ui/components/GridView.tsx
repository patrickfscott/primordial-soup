// ============================================================================
// Grid View — Canvas rendering component
// ============================================================================

import { useRef, useEffect, useCallback } from 'react';
import type { SimulationState } from '../../engine/types.ts';
import { CanvasRenderer } from '../../renderer/canvas-renderer.ts';

interface GridViewProps {
  state: SimulationState;
  showTerrain: boolean;
  showTrails: boolean;
  showEnergy: boolean;
}

export function GridView({ state, showTerrain, showTrails, showEnergy }: GridViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleResize = useCallback(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    rendererRef.current?.resize(rect.width, rect.height);
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    rendererRef.current = new CanvasRenderer(canvasRef.current);
    handleResize();

    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);

    return () => observer.disconnect();
  }, [handleResize]);

  useEffect(() => {
    rendererRef.current?.setOptions({
      showTerrain,
      showTrails,
      showEnergy,
    });
  }, [showTerrain, showTrails, showEnergy]);

  useEffect(() => {
    if (rendererRef.current) {
      rendererRef.current.render(state);
    }
  });

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: 'relative',
        overflow: 'hidden',
        background: '#0a0a0f',
        borderRadius: 6,
        border: '1px solid #2a2a40',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
}
