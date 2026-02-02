# Modelium

Modelium is a lightweight **System Dynamics** playground for building **causal graphs** and running **step-based simulations**.

- **Visual graph editing**: Add, edit, and delete nodes and edges directly on the canvas
- **Directed links** with **weights** and **polarity (+ / −)**
- **Min/max constraints** on nodes with automatic pause on breach
- **Real-time sparklines** inside nodes showing value history
- **Simulations in a Web Worker** (UI stays smooth)
- **JSON import/export** (no database)
- **Minimal stack**: TypeScript + Vite + Cytoscape.js

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 in your browser.

## Features

### Graph Editing

| Action | How |
|--------|-----|
| Add node | Double-click on empty canvas |
| Edit node | Double-click on node |
| Delete node | Hover node → click × button |
| Add edge | Hover node → drag green handle to target |
| Edit edge | Double-click on edge |
| Delete edge | Hover edge → click × button |
| Move node | Drag node |
| Pan | Drag on empty canvas |
| Zoom | Mouse wheel |

### Simulation

- Click **Play** to start the simulation
- Watch values update in real-time with sparklines
- Nodes with constraints turn **red** when breached
- Simulation **auto-pauses** on constraint breach
- Click **Resume** to continue or **Reset** to start over

### Import/Export

- **Export JSON**: Download current model
- **Import JSON**: Load a model file

## Tech Stack

- **TypeScript** - Type-safe development
- **Vite** - Fast build tooling
- **Cytoscape.js** - Graph rendering and interactions
- **Web Worker** - Simulation runs off the main thread

## Project Structure

```
modelium/
  src/
    main.ts               # App bootstrap
    styles.css            # Global styles
    graph/
      cytoscape.ts        # Cytoscape setup, styling
      interactions.ts     # Editing interactions
      sparkline.ts        # Canvas-based sparklines
    model/
      schema.ts           # JSON types + validation
      seed.ts             # Default demo model
    sim/
      engine.ts           # Pure simulation logic
      types.ts            # Simulation message types
      worker.ts           # Web Worker entrypoint
    ui/
      toolbar.ts          # Toolbar controls
      modal.ts            # Edit modals
      file-io.ts          # Import/export helpers
      sim-controls.ts     # Simulation controller
  index.html
  vite.config.ts
  tsconfig.json
```

## Model JSON Format

```json
{
  "version": 1,
  "meta": { "name": "My Model", "createdAt": "2026-02-01T00:00:00Z" },
  "nodes": [
    { "id": "A", "label": "Input", "value": 10 },
    { "id": "B", "label": "Buffer", "value": 0, "min": -20, "max": 50 },
    { "id": "C", "label": "Output", "value": 5, "max": 100 }
  ],
  "edges": [
    { "id": "e1", "from": "A", "to": "B", "weight": 0.5, "polarity": "+" },
    { "id": "e2", "from": "B", "to": "C", "weight": 0.3, "polarity": "+" }
  ]
}
```

### Node Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| label | string | Yes | Display name |
| value | number | Yes | Initial value |
| min | number | No | Minimum constraint |
| max | number | No | Maximum constraint |

### Edge Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| from | string | Yes | Source node ID |
| to | string | Yes | Target node ID |
| weight | number | Yes | Influence multiplier |
| polarity | "+" or "-" | Yes | + increases, - decreases |

## Simulation Formula

Each step computes:

```
new_value[node] = current_value + dt × Σ(weight × source_value × polarity)
```

- **dt**: Time step (0.1 default)
- **polarity**: +1 for positive, -1 for negative edges
- Values are clamped to min/max if constraints exist

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run preview` | Preview production build |
| `npm run typecheck` | Run TypeScript type checking |

## Documentation

See [USER_MANUAL.md](USER_MANUAL.md) for detailed usage instructions.

## Roadmap

- [ ] Per-node activation functions (linear, sigmoid, clamp)
- [ ] Scenario runner (batch multiple runs)
- [ ] Export reports: JSON + CSV
- [ ] Keyboard shortcuts for editing
- [ ] Undo/redo support
- [ ] Deterministic seeded runs

## License

MIT License - see [LICENSE](LICENSE) for details.
