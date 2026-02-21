# MasterPlot

A production-grade scientific plotting engine built with React, deck.gl (WebGL), and d3-scale.

---

## Architecture Overview

MasterPlot is **controller-driven**, not React-state-driven. React only manages DOM layout and UI chrome. All rendering, zoom, pan, and ROI interaction runs outside React's reconciler.

```
PlotController (EventEmitter)
├── DataStore             — GPU typed array buffers (x/y/color/size)
├── ViewportController    — canvas dimensions + screen↔data transforms
├── AxisController (x)    — d3-scale domain/range, tick generation
├── AxisController (y)
├── ROIController         — creation, drag, resize, delete
│   ├── ConstraintEngine  — parent-child bound enforcement
│   ├── RectROI           — draggable/resizable rectangle
│   └── LinearRegion      — vertical strip, contains RectROIs
└── deck.gl Deck          — WebGL render target (OrthographicView)

AxisRenderer              — Canvas 2D overlay (ticks, labels, grid)
```

---

## Data Flow

```
appendData(chunk)
    → DataStore (buffer update, no reallocation if capacity ok)
    → dataTrigger++ (tells deck.gl to re-fetch accessors)
    → PlotController.emit('dataAppended')

wheel event
    → PlotController._onWheel
    → AxisController.zoomAround(factor, focalData)
    → AxisController.emit('domainChanged')
    → ViewportController scale updated
    → deck.gl viewState rebuilt → _dirty = true

rAF loop
    → _render()
    → buildScatterLayer(gpuAttrs)  [no data copy — live typed array views]
    → ROILayer([...rois])
    → deck.setProps({ viewState, layers })
    → AxisRenderer.render()        [canvas 2D ticks + labels]
```

---

## EventEmitter API

All events are emitted on `PlotController` (or `ROIController` before being re-emitted).

| Event | Payload | Description |
|---|---|---|
| `dataAppended` | `{ count, total }` | New points added to GPU buffer |
| `domainChanged` | `{ axis, domain }` | Axis domain changed (zoom/pan/auto-expand) |
| `zoomChanged` | `{ factor, focalDataX, focalDataY }` | Zoom event |
| `panChanged` | `{ dx, dy }` | Pan delta in screen pixels |
| `roiCreated` | `{ roi, type }` | ROI was created |
| `roiUpdated` | `{ roi, bounds }` | ROI was moved or resized |
| `roiDeleted` | `{ id }` | ROI was deleted |

Usage:
```js
plotController.on('dataAppended', ({ count, total }) => {
  console.log(`+${count} pts, total: ${total}`);
});
```

---

## GPU Buffer Append Strategy

`DataStore` maintains over-allocated `Float32Array` buffers that only grow when capacity is exhausted:

1. Initial capacity: 64k points
2. On `appendData()`: if `count + incoming > capacity` → allocate new buffer at `capacity * 1.5`, copy existing data
3. GPU attribute accessors use `subarray(0, count)` — a **live view**, no copy
4. deck.gl re-reads attributes on next frame via `updateTriggers`

This avoids GC spikes during continuous data append.

---

## ROI Constraint System

`ConstraintEngine.enforceConstraints(parent, delta)`:

1. **Shift rule**: children move by the same `{ dx, dy }` as the parent (preserving relative position)
2. **Clamp rule**: if any child edge would lie outside the parent bounds, it is clamped to the parent edge (asymmetric: child shrinks to fit, not discarded)
3. **Recursion**: after adjusting a child, the engine recurses into that child's children with `delta = {0, 0}` (they must re-satisfy constraints relative to the now-clamped child)
4. **Loop guard**: a `Set` of visited ROI ids prevents infinite loops in circular reference scenarios

---

## Keybinds

| Key | Action |
|---|---|
| `L` | Enter LinearRegion creation mode (click x1, then x2) |
| `R` | Enter RectROI creation mode (click top-left, then bottom-right) |
| `D` | Delete the currently selected ROI |
| `Esc` | Cancel creation mode |
| `scroll` | Zoom (centered on cursor) |
| `drag` | Pan |

---

## Performance Profile

Tested with:
- **1M initial points** — no stutter on initial load
- **+10k points appended every 2 seconds** — smooth, no GC spikes
- **Zoom/pan** — domain-only update, no buffer re-upload
- **ROI picking** — O(n_rois) not O(n_points)

Target: 10M+ points (GPU instancing; only viewport-culling limits performance).

---

## Installation & Running

```bash
npm install
npm start        # webpack dev server on http://localhost:3000
npm run build    # production bundle in dist/
```

---

## File Structure

```
src/
  plot/
    PlotController.js     — central controller + render loop
    DataStore.js          — GPU typed array buffers
    ViewportController.js — coordinate transforms
    ROI/
      ROIBase.js          — abstract base class
      RectROI.js          — draggable/resizable rectangle
      LinearRegion.js     — vertical strip
      ROIController.js    — interaction handler
      ConstraintEngine.js — parent-child constraint enforcement
    layers/
      ScatterLayer.js     — deck.gl scatter (instanced)
      LineLayer.js        — deck.gl polylines
      ROILayer.js         — deck.gl composite ROI renderer
    axes/
      AxisController.js   — d3-scale wrapper
      AxisRenderer.js     — canvas 2D ticks + labels
  components/
    PlotCanvas.jsx        — React wrapper (canvas + controller lifecycle)
examples/
  ExampleApp.jsx          — demo with all MVP features
  dataGenerator.js        — test data generation
public/
  index.html
```
