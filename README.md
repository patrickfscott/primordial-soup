# Primordial Soup

An interactive evolutionary cellular automata engine where multiple populations of cells compete, cooperate, parasitize, and co-evolve on a shared toroidal grid.

## Quick Start

```bash
npm install
npm run dev
```

Then open `http://localhost:5173` in your browser.

## Build

```bash
npm run build
npm run preview
```

## Architecture

- **Engine** (`src/engine/`) — Core simulation logic: grid, cell lifecycle, movement, interactions, energy, mutation, structure detection, environment
- **Renderer** (`src/renderer/`) — Canvas-based real-time grid visualization with trails, terrain, and energy overlays
- **UI** (`src/ui/`) — React components: playback controls, genome editor, population management, stats dashboard

## Features

- Full cellular automata engine with 25+ genome parameters across 6 gene groups
- Multiple populations with asymmetric interaction matrices
- Movement system with chemotaxis, swarming, fleeing, and momentum
- Energy economy with metabolism, photosynthesis, and resource competition
- Mutation and evolution at generation boundaries with adaptive mutation rates
- Cell differentiation (scouts, guardians, harvesters, relays)
- Environment with terrain types, seasonal cycles, and random events
- Structure detection with energy bonuses for clusters and bridges
- 9 preset archetypes: Classic Life, Swarm, Fortress, Parasite, Symbiont, Nomad, Extremophile, Predator, Architect
