# Modelium

Modelium is a lightweight **System Dynamics** playground for building **causal graphs** and running **step-based simulations**.

- Draw nodes + directed links with **weights** and **polarity (+ / −)**
- Set initial values (all zero or custom)
- Run simulations in a **Web Worker** (UI stays smooth)
- Save / load everything as **JSON files** (no database)
- Minimal stack: **TypeScript + Vite + Cytoscape.js**

## Tech Stack

- **TypeScript**
- **Vite**
- **Cytoscape.js** (graph editor/renderer)
- **Web Worker** (simulation loop off the main thread)

## Getting Started

### Prereqs
- Node.js 18+ recommended

### Install
```bash
npm install
```

### Run (dev)
```bash
npm run dev
```

### Build
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## Project Structure 

```code
modelium/
  src/
    app/
      ui/                 # minimalist UI (panels, toolbar)
      graph/              # cytoscape setup, styling, interactions
    sim/
      engine.ts           # pure simulation logic (deterministic)
      schema.ts           # JSON types + validation helpers
      worker.ts           # simulation worker entrypoint
    main.ts               # app bootstrap
    styles.css
  public/
  index.html
  vite.config.ts
```

## Model JSON Format (example)

Modelium models are plain JSON with nodes + edges.
```json
{
  "version": 1,
  "meta": { "name": "Demo Model", "createdAt": "2026-02-01T00:00:00Z" },
  "nodes": [
    { "id": "A", "label": "Node A", "value": 10 },
    { "id": "B", "label": "Node B", "value": 0 }
  ],
  "edges": [
    { "id": "A->B", "from": "A", "to": "B", "weight": 0.5, "polarity": "+" }
  ],
  "simulation": {
    "dt": 1,
    "steps": 100,
    "clamp": { "min": -1e9, "max": 1e9 }
  }
}
```

### Polarity and Weight
	•	polarity: "+" means increasing the source tends to increase the target
	•	polarity: "-" means increasing the source tends to decrease the target
	•	weight is the magnitude of the influence

## Simulation (how it runs)

The simulation runs off the UI thread in a Web Worker.

Typical flow:
	1.	UI sends { model, initialState } to the worker
	2.	Worker iterates step() in a loop (fixed dt)
	3.	Worker streams progress snapshots back to the UI
	4.	UI can pause/resume/stop at any time
	5.	End-of-run report is returned (time series + summary stats)


## Scripts

(Adjust to your package.json as needed)
	•	npm run dev – start dev server
	•	npm run build – production build
	•	npm run preview – preview the build locally
	•	npm run test – unit tests

## Roadmap
	•	Per-node activation functions (linear, sigmoid, clamp)
	•	Scenario runner (batch multiple runs)
	•	Export reports: JSON + CSV
	•	Keyboard-driven graph editing (fast workflows)
	•	Deterministic seeded runs

## License
MIT license
