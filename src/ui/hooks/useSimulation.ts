// ============================================================================
// Core simulation hook — manages the game loop and state
// ============================================================================

import { useState, useRef, useCallback, useEffect } from 'react';
import type { SimulationState, SimulationConfig, Genome } from '../../engine/types.ts';
import { createSimulation, addPopulation, removePopulation, simulateTick } from '../../engine/simulation.ts';

export interface SimulationControls {
  state: SimulationState;
  isRunning: boolean;
  speed: number;
  fps: number;
  tps: number;
  play: () => void;
  pause: () => void;
  step: () => void;
  reset: (config?: Partial<SimulationConfig>) => void;
  setSpeed: (speed: number) => void;
  addPop: (name: string, genome: Genome, x: number, y: number, count?: number) => void;
  removePop: (id: number) => void;
  getState: () => SimulationState;
}

export function useSimulation(initialConfig?: Partial<SimulationConfig>): SimulationControls {
  const [, setRenderTick] = useState(0);
  const stateRef = useRef<SimulationState>(createSimulation(initialConfig));
  const runningRef = useRef(false);
  const speedRef = useRef(1);
  const frameRef = useRef<number>(0);
  const fpsRef = useRef(0);
  const tpsRef = useRef(0);
  const frameCountRef = useRef(0);
  const tickCountRef = useRef(0);
  const lastStatsTimeRef = useRef(performance.now());

  const triggerRender = useCallback(() => {
    setRenderTick(t => t + 1);
  }, []);

  const gameLoop = useCallback(() => {
    if (!runningRef.current) return;

    const ticksThisFrame = speedRef.current;
    for (let i = 0; i < ticksThisFrame; i++) {
      simulateTick(stateRef.current);
      tickCountRef.current++;
    }
    frameCountRef.current++;

    // Update FPS/TPS counter every second
    const now = performance.now();
    if (now - lastStatsTimeRef.current >= 1000) {
      fpsRef.current = frameCountRef.current;
      tpsRef.current = tickCountRef.current;
      frameCountRef.current = 0;
      tickCountRef.current = 0;
      lastStatsTimeRef.current = now;
    }

    triggerRender();
    frameRef.current = requestAnimationFrame(gameLoop);
  }, [triggerRender]);

  const play = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    stateRef.current.running = true;
    frameRef.current = requestAnimationFrame(gameLoop);
    triggerRender();
  }, [gameLoop, triggerRender]);

  const pause = useCallback(() => {
    runningRef.current = false;
    stateRef.current.running = false;
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
    }
    triggerRender();
  }, [triggerRender]);

  const step = useCallback(() => {
    if (runningRef.current) return;
    simulateTick(stateRef.current);
    triggerRender();
  }, [triggerRender]);

  const reset = useCallback((config?: Partial<SimulationConfig>) => {
    pause();
    stateRef.current = createSimulation(config ?? initialConfig);
    triggerRender();
  }, [pause, triggerRender, initialConfig]);

  const setSpeed = useCallback((speed: number) => {
    speedRef.current = Math.max(1, Math.min(100, speed));
    triggerRender();
  }, [triggerRender]);

  const addPop = useCallback((name: string, genome: Genome, x: number, y: number, count?: number) => {
    addPopulation(stateRef.current, name, genome, x, y, count);
    triggerRender();
  }, [triggerRender]);

  const removePop = useCallback((id: number) => {
    removePopulation(stateRef.current, id);
    triggerRender();
  }, [triggerRender]);

  const getState = useCallback(() => stateRef.current, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, []);

  return {
    state: stateRef.current,
    isRunning: runningRef.current,
    speed: speedRef.current,
    fps: fpsRef.current,
    tps: tpsRef.current,
    play,
    pause,
    step,
    reset,
    setSpeed,
    addPop,
    removePop,
    getState,
  };
}
