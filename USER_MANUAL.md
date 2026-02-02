# Modelium User Manual

Modelium is a lightweight System Dynamics playground for building causal graphs and running step-based simulations.

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Interface Overview](#interface-overview)
3. [Working with Nodes](#working-with-nodes)
4. [Working with Edges](#working-with-edges)
5. [Running Simulations](#running-simulations)
6. [Debug Controls](#debug-controls)
7. [Import and Export](#import-and-export)
8. [Understanding the Model](#understanding-the-model)
9. [Keyboard Shortcuts](#keyboard-shortcuts)
10. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Installation

```bash
# Clone the repository
git clone https://github.com/marcolangoni/modelium.git
cd modelium

# Install dependencies
npm install

# Start the development server
npm run dev
```

Open your browser and navigate to `http://localhost:5173/`.

### First Steps

When you launch Modelium, you'll see a demo model with three nodes connected by edges. This is a simple causal chain demonstrating how values flow through the system.

---

## Interface Overview

### Toolbar

The toolbar at the top of the screen contains:

| Button | Description |
|--------|-------------|
| **Export JSON** | Download the current model as a JSON file |
| **Import JSON** | Load a model from a JSON file |
| **Play** | Start the simulation |
| **Pause** | Pause a running simulation |
| **Step** | Execute a single simulation step (visible when paused) |
| **Resume** | Continue a paused simulation |
| **Reset** | Stop simulation and restore initial values |
| **- / +** | Decrease / increase simulation speed |
| **Speed indicator** | Shows current speed (1x, 2x, 0.5x slower, etc.) |
| **Clear Breakpoints** | Remove all breakpoints (visible when breakpoints exist) |

The status indicator on the right shows the current simulation state.

### Canvas

The main area displays your causal graph. You can:
- **Pan**: Click and drag on empty space
- **Zoom**: Use mouse wheel or pinch gesture
- **Select**: Click on a node or edge

---

## Working with Nodes

Nodes represent variables in your system. Each node has:
- **Label**: A descriptive name
- **Value**: The current numeric value
- **Min** (optional): Minimum allowed value
- **Max** (optional): Maximum allowed value

### Adding a Node

1. **Double-click** on empty canvas space
2. Fill in the node properties in the modal:
   - **Label**: Enter a name (required)
   - **Value**: Enter the initial value (required)
   - **Min**: Optional lower bound
   - **Max**: Optional upper bound
3. Click **Save**

### Editing a Node

1. **Double-click** on the node you want to edit
2. Modify the properties in the modal
3. Click **Save** to apply changes

### Deleting a Node

1. **Hover** your mouse over the node
2. A red **×** button appears near the node
3. **Click** the × button to delete the node

> Note: Deleting a node also removes all edges connected to it.

### Moving a Node

Simply **click and drag** the node to reposition it on the canvas.

> Note: While dragging a node, the delete button and edge handle are hidden for a cleaner experience.

---

## Working with Edges

Edges represent causal relationships between nodes. Each edge has:
- **Weight**: The strength of the influence (multiplier)
- **Polarity**: Direction of influence (+ or -)

### Understanding Polarity

| Polarity | Meaning | Visual |
|----------|---------|--------|
| **+** (positive) | When source increases, target tends to increase | Green arrow |
| **-** (negative) | When source increases, target tends to decrease | Red arrow |

### Adding an Edge

1. **Hover** over the source node
2. A small **green circle** (edge handle) appears on the right side of the node
3. **Click and drag** from the green handle toward the target node
4. **Release** over the target node
5. Fill in the edge properties:
   - **Weight**: Influence strength (e.g., 0.5, 1.0, 2.0)
   - **Polarity**: Select + or -
6. Click **Save**

### Editing an Edge

1. **Double-click** on the edge
2. Modify weight and/or polarity
3. Click **Save**

### Deleting an Edge

1. **Hover** your mouse over the edge
2. A red **×** button appears near the edge midpoint
3. **Click** the × button to delete the edge

### Inspecting an Edge

When you hover over any edge, an **info panel** appears showing:
- **From**: The source node label
- **To**: The target node label
- **Weight**: The influence multiplier
- **Polarity**: The direction of influence (+ or -)

The panel disappears automatically when you move your mouse away.

---

## Running Simulations

The simulation computes how node values change over time based on their connections.

### Simulation Formula

For each time step, the simulation calculates:

```
new_value[node] = current_value[node] + dt × Σ(weight × source_value × polarity)
```

Where:
- **dt** is the time step size (0.1 by default)
- The sum is over all incoming edges to the node
- **polarity** is +1 for positive edges, -1 for negative edges

### Starting a Simulation

1. Click **Play** in the toolbar
2. Watch the node values change in real-time
3. Sparklines appear inside each node showing value history

### Value-Based Node Coloring

During simulation, nodes with min/max constraints display **dynamic colors** based on where their current value falls in the range:

| Value Position | Color |
|----------------|-------|
| At minimum | Blue |
| At midpoint | Yellow |
| At maximum | Red |

Colors transition **smoothly and gradually** as values change, providing visual feedback on how close each node is to its limits.

### Pausing and Resuming

- Click **Pause** to temporarily stop the simulation
- Click **Resume** to continue from where you paused

### Constraint Breaches

If a node reaches its **min** or **max** value:
1. The simulation **automatically pauses**
2. The breached node turns **red**
3. The status shows which node hit its limit
4. Click **Resume** to continue (the value stays clamped at the limit)

### Resetting

Click **Reset** to:
- Stop the simulation
- Restore all nodes to their initial values
- Clear sparkline history
- Remove breach highlighting

---

## Debug Controls

Modelium provides IDE-like debugging controls for detailed simulation analysis.

### Speed Control

Adjust how fast the simulation runs:

| Control | Effect |
|---------|--------|
| **-** button or `[` or `-` key | Slow down (halve speed) |
| **+** button or `]` or `+` key | Speed up (double speed) |

The speed indicator in the toolbar shows the current speed:
- **4x** - 4 times faster than normal
- **2x** - 2 times faster
- **1x** - Normal speed
- **2x slower** - Half speed
- **4x slower** - Quarter speed

Speed can range from **4x faster** to **32x slower**.

### Step-by-Step Execution

When the simulation is paused, you can execute one step at a time:

1. **Pause** the simulation (or it pauses automatically at a breakpoint)
2. Click the **Step** button, or press `S` or `N`
3. The simulation advances exactly one step
4. Observe the value changes
5. Repeat to step through the simulation

This is useful for:
- Debugging unexpected behavior
- Understanding exactly when values change
- Watching breakpoint conditions approach their thresholds

### Breakpoints

Breakpoints pause the simulation when a node's value meets a specified condition.

#### Adding a Breakpoint

1. **Right-click** on a node
2. Select **Add Breakpoint...**
3. Choose a condition:
   - `>=` (greater than or equal)
   - `<=` (less than or equal)
   - `>` (greater than)
   - `<` (less than)
   - `=` (equal to)
4. Enter the threshold value
5. Click **Save**

The node now shows an **orange border** indicating it has a breakpoint.

#### How Breakpoints Work

During simulation, after each step:
1. All breakpoints are checked
2. If any condition is met, the simulation pauses
3. The status shows which breakpoint was hit and the actual value
4. The node with the hit breakpoint is highlighted

#### Editing a Breakpoint

1. **Right-click** on a node with a breakpoint
2. Select **Edit Breakpoint...**
3. Modify the condition or value
4. Click **Save**

#### Removing Breakpoints

**Single breakpoint:**
1. Right-click on the node
2. Select **Remove Breakpoint**

**All breakpoints:**
1. Click **Clear Breakpoints** in the toolbar

#### Breakpoint Tips

- Set breakpoints before critical thresholds to catch them
- Use `>=` for upper bounds, `<=` for lower bounds
- Multiple nodes can have breakpoints simultaneously
- Breakpoints persist until you remove them or import a new model
- After a breakpoint hit, use **Step** to advance carefully or **Resume** to continue

---

## Import and Export

### Exporting Your Model

1. Click **Export JSON**
2. A file named `modelium-export.json` downloads to your computer
3. This file contains all nodes, edges, and their properties

### Importing a Model

1. Click **Import JSON**
2. Select a Modelium JSON file from your computer
3. The current model is replaced with the imported one

> Warning: Importing replaces your current work. Export first if you want to save it.

---

## Understanding the Model

### JSON Format

Modelium models are stored as JSON with this structure:

```json
{
  "version": 1,
  "meta": {
    "name": "My Model",
    "createdAt": "2026-02-01T12:00:00Z"
  },
  "nodes": [
    {
      "id": "A",
      "label": "Population",
      "value": 1000,
      "min": 0,
      "max": 10000
    }
  ],
  "edges": [
    {
      "id": "e1",
      "from": "A",
      "to": "B",
      "weight": 0.5,
      "polarity": "+"
    }
  ]
}
```

### Node Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| label | string | Yes | Display name |
| value | number | Yes | Current/initial value |
| min | number | No | Minimum constraint |
| max | number | No | Maximum constraint |

### Edge Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| id | string | Yes | Unique identifier |
| from | string | Yes | Source node ID |
| to | string | Yes | Target node ID |
| weight | number | Yes | Influence multiplier |
| polarity | "+" or "-" | Yes | Direction of influence |

---

## Keyboard Shortcuts

### Simulation Controls

| Key | Action |
|-----|--------|
| **Space** | Toggle play/pause |
| **S** or **N** | Step (execute single step when paused) |
| **[** or **-** | Slow down (halve speed) |
| **]** or **+** | Speed up (double speed) |

### Modal Dialogs

| Key | Action |
|-----|--------|
| **Escape** | Close modal dialog |
| **Enter** | Save modal (when in input field) |

### Context Menu

| Action | How |
|--------|-----|
| Open context menu | Right-click on a node |
| Close context menu | Click elsewhere or press Escape |

---

## Troubleshooting

### Nodes won't move

- Make sure the simulation is **not running**
- Editing is disabled during simulation

### Can't add nodes or edges

- Check if simulation is running (Pause or Reset first)
- Editing is disabled while simulation is active

### Simulation doesn't change values

- Verify edges exist between nodes
- Check that source nodes have non-zero values
- Ensure edge weights are not zero

### Import fails

- Ensure the file is valid JSON
- Check that it follows the Modelium schema
- Version must be `1`
- All required fields must be present

### Sparklines don't appear

- Sparklines only show after 2+ simulation steps
- They appear inside the node as a small line chart
- Reset clears sparkline history

### Breakpoint doesn't trigger

- Verify the condition and value are correct
- Check that the node's value actually reaches the threshold
- Use step-by-step execution to watch the value approach the threshold
- Try using `>=` instead of `=` for exact values (floating-point precision)

### Keyboard shortcuts don't work

- Make sure the focus is not in a text input field
- Click on the canvas first to ensure focus is on the main application
- Check that a modal dialog is not open

---

## Tips and Best Practices

1. **Start simple**: Begin with 2-3 nodes to understand the dynamics
2. **Use constraints**: Add min/max values to prevent runaway values
3. **Watch the sparklines**: They reveal oscillations and trends
4. **Export often**: Save your work before major changes
5. **Name nodes clearly**: Good labels make models easier to understand

---

## Example Models

### Simple Growth

```
[Population] ---(+0.1)---> [Population]
```
A node feeding back into itself with positive polarity creates exponential growth.

### Predator-Prey

```
[Rabbits] ---(+0.5)---> [Foxes]
[Foxes] ---(-0.3)---> [Rabbits]
```
Classic oscillating system where predators and prey influence each other.

### Feedback Loop

```
[Demand] ---(+0.4)---> [Production]
[Production] ---(-0.2)---> [Demand]
```
Negative feedback creates stability; positive feedback amplifies changes.

---

## Getting Help

- **GitHub Issues**: Report bugs or request features
- **README.md**: Technical documentation and setup instructions

---

*Modelium is open source software released under the MIT License.*
