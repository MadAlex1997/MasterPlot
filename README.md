# MasterPlot

> **Prototype Disclosure**
> MasterPlot is an **experimental prototype**, not a production-ready library.
> It is being developed iteratively using **agentic AI** (Claude Code / Anthropic Claude) following a structured plan in [PLAN.md](PLAN.md).
> Expect breaking changes, incomplete documentation, and rough edges.

---

**[Live Demo →](https://madalex1997.github.io/MasterPlot/)**

A high-performance scientific plotting engine built on React, deck.gl (WebGL), and d3-scale.
Designed for real-time data, large datasets (tested to 1M+ points), and audio/signal analysis workflows.

---

## Current Capabilities (F1–F21 + EX1–EX5 complete)

### Core Plotting Engine
- **WebGL rendering** via deck.gl `OrthographicView` — no maps, no geospatial assumptions
- **Scatter plots** with instanced rendering (`ScatterLayer`) — GPU typed array buffers, no per-point JS objects
- **Line plots** (`LineLayer`)
- **Linear and log axes** via d3-scale; canvas 2D overlay for tick labels and grid
- **Zoom** (mouse wheel, centered on cursor) and **pan** (drag) without touching data buffers
- **Semi-live data append** — `Float32Array` buffers grow by 1.5× when capacity is exhausted; no full reallocation; deck.gl attribute views (`subarray`) update without copying
- **Rolling ring buffer** — optional fixed-capacity circular buffer with count-based and age-based expiration; axis domain recalculates automatically after eviction
- **PlotDataView** — lazily-evaluated, dirty-flag-cached derived view over a `DataStore` or another `PlotDataView`; supports domain filtering, ROI filtering, histogram derivation, and deep snapshot; dirty propagates through arbitrarily deep view chains
- **Shared DataStore / DataView (F17)** — multiple `PlotController` instances can share a single `DataStore` and/or `PlotDataView`; ownership tracking ensures `destroy()` only releases resources the controller allocated
- **External integration adapter contracts (F18)** — `ExternalDataAdapter` and `ExternalROIAdapter` base classes define the boundary between the MasterPlot engine and external data sources; `MockDataAdapter` and `MockROIAdapter` are reference implementations
- **Event log panel** — on-screen log of `dataAppended`, `domainChanged`, `zoomChanged`, `panChanged`, `roiCreated`, `roiUpdated`, `roiDeleted`, `roiFinalized`

### ROI System (pyqtgraph-style)
- **LinearRegion** — vertical strip defined by x1/x2; created with `L` key + two clicks
- **RectROI** — draggable/resizable rectangle; created with `R` key + two clicks; parented to a LinearRegion
- **LineROI (F20)** — single-pixel line ROI (vertical or horizontal); created with `V` (vertical) or `H` (horizontal) key + one click
  - **Modes:** `vline` · `hline` · `vline-half-top` · `vline-half-bottom` · `hline-half-left` · `hline-half-right`
  - **Labels** — optional string (≤25 chars); rendered on the canvas 2D overlay (not WebGL); only on half-variants; positioned near the tip
  - **Draggable** along its primary axis; not resizable
  - **Auto-parenting** — vertical LineROI created inside a LinearRegion is automatically parented and x-constrained
  - **Alignment rules** — vertical LineROI may be child of LinearRegion; horizontal LineROI may be child of a horizontal-bounding ROI; mixed alignments ignored
  - **Versioning** — `bumpVersion()` stores `domain: { x: [pos, pos] }` (vertical) or `{ y: [pos, pos] }` (horizontal); `serialize()` / `updateFromExternal()` carry `position`, `label`, `mode`
- **ConstraintEngine** — enforces parent-child bounds automatically:
  - Children shift when parent moves (preserving relative offset)
  - Children are clamped to parent bounds (not discarded)
  - Recursive enforcement for multi-level nesting
  - **F19:** `applyConstraints` returns the set of descendants whose bounds actually changed; `bumpVersion` + `roiFinalized` only emitted when bounds differ from last committed domain snapshot
- **Deletion** with `D` key; cancel creation with `Esc`
- **ROI versioning (F14)** — every ROI carries a monotonic `version` counter, `updatedAt` timestamp, and a JSON-safe `domain` snapshot; `bumpVersion()` is called automatically on mouseup; `LinearRegion.domain` omits `y` (spans ±Infinity)

### Axis Drag Scaling (F21)
Drag directly on the axis gutter (the tick-label margin) to zoom that axis independently, centered on its midpoint:

| Axis | Drag Direction | Result   |
|------|----------------|----------|
| Y    | Down           | Zoom In  |
| Y    | Up             | Zoom Out |
| X    | Left           | Zoom In  |
| X    | Right          | Zoom Out |

- Dragging inside the plot area still **pans** as before; only gutter drags zoom
- Works on linear and log scales; uses exponential scaling (`Math.exp`) identical in feel to wheel zoom
- Emits `zoomChanged` with `{ factor, axis }`
- Float drift prevented via restore-and-reapply pattern

### Spectrogram / Audio Analysis Example
A full-featured spectrogram viewer is available at the demo (Spectrogram tab):

| Feature | Details |
|---|---|
| **Real-time STFT spectrogram** | WebGL rendered; configurable window size; hop = window/2 |
| **Synchronized waveform** | PCM waveform shown below the spectrogram |
| **Audio file loading** | Any format `AudioContext.decodeAudioData` supports (WAV, MP3, OGG, FLAC, etc.) |
| **Live append mode** | Chirp + noise generated every 100 ms; toggle on/off |
| **HistogramLUT panel** | pyqtgraph-style dB amplitude histogram; draggable level_min / level_max handles; 6 LUT presets (Viridis, Plasma, Inferno, Magma, Hot, Grayscale); Auto Level button |
| **Audio playback** | Play / Pause / Stop; yellow dashed playhead line on both panels at 60 fps; Ctrl+click to seek on either panel |
| **Frequency band controls (EX2)** | Low/High `<input type="number">` inputs next to the waveform panel; updates the spectrogram y-axis domain in real time to zoom to a frequency band; validity indicator + "Reset to full" button |
| **Frequency filters** | Offline biquad DSP via `OfflineAudioContext` (lowpass, highpass, bandpass, notch, allpass) in the waveform sidebar; frequency response curve preview; Apply / Clear DSP Filter |

### Scatter + ROI Example (EX1)
The main scatter demo (`ExampleApp`) includes two live ROI inspection tables below the event log:

| Table | Contents | Update trigger |
|---|---|---|
| **LinearRegion table** | ID (truncated) · Left bound · Right bound · Version | `roiCreated`, `roiFinalized`, `roiDeleted` |
| **RectROI subset table** | ID · Left · Right · Bottom · Top · Version | Same — filtered to rects overlapping the selected LinearRegion |

Click any LinearRegion row to select it and populate the RectROI table. Click again to deselect. Tables never update during drag (`roiUpdated` is intentionally ignored), so there is no UI jitter while moving ROIs.

### Line / Rolling-Window Examples (EX3)
Both `LineExample` and `RollingLineExample` now use **deterministic sin/cos waves** instead of random walks:

- Signal A and C → `amplitude × sin(t) + offset`
- Signal B → `amplitude × cos(t) + offset`
- Vertical offset per signal (`i × (2 × amplitude + spacing)`) keeps all bands visually separated
- Rolling expiration (`trimBefore`) removes the trailing edge of each wave as new data arrives, making the rolling window immediately obvious

### Seismography Example (EX5)

Ten stacked seismograph channels in a single page, each backed by its own `DataStore` and independent Y-axis:

| Feature | Details |
|---|---|
| **10 channels** | Independent sin-wave signals with distinct frequency and phase per channel |
| **Shared X-axis** | Zoom or pan on any channel propagates the new x-domain to all others via `domainChanged` → `xAxis.setDomain()` |
| **P-wave picks** | Each channel has a pre-seeded `vline-half-bottom` LineROI with a station label rendered on the canvas overlay |
| **Draggable picks** | Drag any pick to update its position; table row refreshes on `roiFinalized` |
| **Sidebar table** | Station · Label · Pos (s); edits committed on Enter/blur |
| **Version-gated edits** | Table edit calls `updateFromExternal()` with `version + 1`; rejected if a concurrent drag committed a higher version |
| **React owns no geometry** | `tableRows` is a display cache; all bounds live in `LineROI.position` |

---

## Architecture Overview

MasterPlot is **controller-driven**, not React-state-driven. React only manages DOM layout and UI chrome. All rendering, zoom, pan, ROI interaction, and audio processing run outside React's reconciler.

```
PlotController (EventEmitter)
├── DataStore             — GPU typed array buffers (x/y/color/size)
│   └── PlotDataView      — lazy derived view (filter, histogram, snapshot)
├── ViewportController    — canvas dimensions + screen↔data transforms
├── AxisController (x)    — d3-scale domain/range, tick generation
├── AxisController (y)
├── ROIController         — creation, drag, resize, delete
│   ├── ConstraintEngine  — parent-child bound enforcement
│   ├── LinearRegion      — vertical strip, contains RectROIs / LineROIs
│   ├── RectROI           — draggable/resizable rectangle
│   └── LineROI           — single vertical or horizontal line (6 modes, optional label)
└── deck.gl Deck          — WebGL render target (OrthographicView)

AxisRenderer              — Canvas 2D overlay (ticks, labels, grid)

Integration layer (optional, no engine changes needed):
├── ExternalDataAdapter   — interface contract for data sources (HTTP, WS, etc.)
├── ExternalROIAdapter    — interface contract for ROI persistence and sync
├── MockDataAdapter       — random batch generator (extends ExternalDataAdapter)
└── MockROIAdapter        — localStorage-backed ROI store (extends ExternalROIAdapter)

Audio subsystem (spectrogram example only):
├── SpectrogramLayer      — custom deck.gl layer; STFT → ImageBitmap → WebGL texture
├── HistogramLUTController — dB histogram + LUT remapping (EventEmitter)
├── PlaybackController    — Web Audio API playback with seek (EventEmitter)
└── FilterController      — offline biquad DSP + frequency response (EventEmitter)
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
| `dataExpired` | `{ expired, remaining }` | Points evicted by rolling expiration |
| `domainChanged` | `{ axis, domain }` | Axis domain changed (zoom/pan/auto-expand) |
| `zoomChanged` | `{ factor, focalDataX, focalDataY }` | Zoom event |
| `panChanged` | `{ dx, dy }` | Pan delta in screen pixels |
| `roiCreated` | `{ roi, type }` | ROI was created |
| `roiUpdated` | `{ roi, bounds }` | ROI was moved or resized (drag; fires many times) |
| `roiFinalized` | `{ roi, bounds, version, updatedAt, domain }` | ROI drag committed on mouseup; `version` already incremented |
| `roiDeleted` | `{ id }` | ROI was deleted |
| `roiExternalUpdate` | `{ roi, version }` | External update accepted via `updateFromExternal()` |

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

## Rolling Ring Buffer (F16)

`DataStore` supports an optional fixed-capacity circular ring buffer mode for streaming/real-time scenarios where only the most recent N points or most recent T milliseconds of data should be retained.

### API

```js
// Activate rolling mode (must be called before any appendData)
dataStore.enableRolling({ maxPoints: 1000 });          // keep last 1000 points
dataStore.enableRolling({ maxAgeMs: 5000 });           // keep points < 5s old
dataStore.enableRolling({ maxPoints: 500, maxAgeMs: 2000 }); // both constraints

// Evict expired points (PlotController calls this automatically after each appendData)
dataStore.expireIfNeeded();

// Get ordered logical data (tail→head, handles wrap-around)
const { x, y, size, color } = dataStore.getLogicalData();
```

### Events

```js
dataStore.on('dirty', () => { /* emitted on every appendData */ });
dataStore.on('dataExpired', ({ expired, remaining }) => { /* points were evicted */ });

// PlotController re-emits dataExpired:
plotController.on('dataExpired', ({ expired, remaining }) => {
  console.log(`Evicted ${expired} pts, ${remaining} remaining`);
});
```

### Behavior

| Property | Non-rolling | Rolling |
|---|---|---|
| Buffer allocation | Grows dynamically (1.5× factor) | Fixed at `maxPoints` capacity |
| Expiration | None | Count and/or age based |
| `getGPUAttributes()` | Returns live subarray views (no copy) | Returns ordered copy (handles wrap) |
| `getLogicalData()` | Returns live subarray views | Returns ordered copy tail→head |
| `_grow()` | Used for resize | Never called (fixed capacity) |

Rolling mode is transparent to `PlotController` — `appendData()`, auto-expand domain, and `dataExpired` events all work as expected.

---

## PlotDataView (F15)

`PlotDataView` (`src/plot/PlotDataView.js`) is a lazily-evaluated, dirty-flag-cached derived view over a `DataStore` or another `PlotDataView`. It never mutates its source.

### API

```js
import { PlotDataView } from './src/plot/PlotDataView.js';

// Wrap a DataStore
const view = new PlotDataView(dataStore);

// Or wrap another view (creates a child view; dirty cascades automatically)
const domainView = new PlotDataView(parentView, null, { roiController });

// Get data (recomputes only if dirty)
const { x, y, size, color } = view.getData();

// Derived views
const filtered = view.filterByDomain({ x: [0, 100], y: [0, 50] });
const roiView  = view.filterByROI('roi_1', { roiController });

// Histogram (does not re-recompute if not dirty)
const { counts, edges } = view.histogram({ field: 'x', bins: 64 });
// edges.length === 65, counts.length === 64

// Deep snapshot — mutating result does not affect cache
const copy = view.snapshot();

// Manual dirty mark (triggers child cascade)
view.markDirty();

// Cleanup
view.destroy();
```

### Dirty propagation rules

| Source event | Marks dirty? |
|---|---|
| `DataStore 'dirty'` (after `appendData`) | ✅ yes |
| `DataStore 'dataExpired'` (rolling eviction) | ✅ yes |
| `roiFinalized` (drag commit on mouseup) | ✅ yes |
| `roiExternalUpdate` (incoming external sync) | ✅ yes |
| `roiUpdated` (drag in progress) | ❌ no — drag must not trigger recompute |

Child views automatically cascade dirty when their parent emits `'dirty'`. Chains of arbitrary depth work correctly.

### Events

| Event | Payload | Description |
|---|---|---|
| `'dirty'` | — | View became dirty (propagates to children) |
| `'recomputed'` | `{ count }` | Recompute finished; snapshot is fresh |

---

## ROI Versioning & Serialization (F14)

Every ROI instance carries:
- **`version`** — monotonic integer starting at 1; incremented on each user mouseup commit
- **`updatedAt`** — `Date.now()` timestamp of the last `bumpVersion()` call
- **`domain`** — JSON-safe snapshot: `{ x: [x1, x2], y?: [y1, y2] }` (`LinearRegion` omits `y`)

### ROIController Serialization API

```js
const roiController = plotController.roiController;

// Serialize all ROIs to plain objects (JSON-safe)
const snapshot = roiController.serializeAll();
// → [{ id, type, version, updatedAt, domain, metadata }, ...]

// Restore from a snapshot (clears existing ROIs, emits roisChanged)
roiController.deserializeAll(snapshot);

// Apply an external update — version-gated (rejects if incoming.version <= current)
const accepted = roiController.updateFromExternal({
  id: 'roi_1',
  type: 'linearRegion',
  version: 5,
  updatedAt: Date.now(),
  domain: { x: [10, 50] },
  metadata: {},
});
// Returns true if accepted, false if rejected
```

### Version conflict rules

| Condition | Result |
|---|---|
| `incoming.version > existing.version` | Accepted → bounds updated, `roiExternalUpdate` emitted |
| `incoming.version === existing.version` | **Rejected** (silent) |
| `incoming.version < existing.version` | **Rejected** (silent) |
| ROI not found in `_rois` | Created as a new ROI |

`updateFromExternal` does **not** call `bumpVersion()` — the incoming version is authoritative and is applied directly.

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
| `Ctrl+click` | Seek playhead (spectrogram example) |

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
    PlotDataView.js       — lazy derived view (filter / histogram / snapshot)
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
      SpectrogramLayer.js — STFT + WebGL texture spectrogram
      HistogramLUTController.js — dB histogram + LUT remapping
    axes/
      AxisController.js   — d3-scale wrapper
      AxisRenderer.js     — canvas 2D ticks + labels
  audio/
    PlaybackController.js — Web Audio API playback + seek
    FilterController.js   — offline biquad DSP + frequency response
  components/
    PlotCanvas.jsx        — React wrapper (canvas + controller lifecycle)
    HistogramLUTPanel.jsx — histogram + level handles + LUT preset UI
    FilterPanel.jsx       — filter type, cutoff, Q controls + response curve
examples/
  HubPage.jsx              — demo navigation hub
  ExampleApp.jsx           — scatter/ROI/live-append + ROI inspection tables (EX1)
  LineExample.jsx          — deterministic sin/cos waves + 5k-sample rolling window (EX3)
  RollingLineExample.jsx   — deterministic sin/cos waves + 30s wall-clock rolling window (EX3)
  SpectrogramExample.jsx   — full audio analysis + frequency band inputs (EX2)
  SharedDataExample.jsx    — two-plot shared DataStore + filtered DataView demo (F17)
  SeismographyExample.jsx  — 10 stacked channels, shared X-axis, vline picks + table (EX5)
src/
  integration/
    ExternalDataAdapter.js — interface contract for external data sources (F18)
    ExternalROIAdapter.js  — interface contract for ROI persistence/sync (F18)
    MockDataAdapter.js     — random data generator mock (F18)
    MockROIAdapter.js      — localStorage-backed ROI persistence mock (F18)
public/
  index.html
```

---

## Shared DataStore / DataView (F17)

Multiple `PlotController` instances can share a single `DataStore` and optionally a single `PlotDataView`. This enables multi-panel dashboards where one write propagates to all plots in the same render frame.

### Quick start

```js
import { DataStore }    from './src/plot/DataStore.js';
import { PlotDataView } from './src/plot/PlotDataView.js';
import { PlotController } from './src/plot/PlotController.js';

const sharedStore = new DataStore();

// Both controllers receive the shared store; neither owns it
const ctrlA = new PlotController({ dataStore: sharedStore });
const ctrlB = new PlotController({ dataStore: sharedStore });

// Append once → both plots update
sharedStore.appendData({ x: new Float32Array([1,2,3]), y: new Float32Array([4,5,6]) });

// destroy() does NOT call sharedStore.destroy() — caller manages lifecycle
ctrlA.destroy();
ctrlB.destroy();
sharedStore.destroy?.(); // optional if DataStore ever gains a destroy()
```

### Filtered view on one plot

```js
// Plot A shows all data; Plot B shows only points inside a LinearRegion
const baseView = new PlotDataView(sharedStore, null, {
  roiController: ctrlA.roiController,   // watches roiFinalized on Plot A
});

ctrlA.setDataView(baseView, /* owns */ false);  // Plot A: all points
ctrlB.setDataView(baseView, /* owns */ false);  // Plot B: initially all points

// When user finishes drawing a LinearRegion on Plot A:
ctrlA.on('roiCreated', ({ type, roi }) => {
  if (type !== 'LinearRegion') return;
  const filteredView = baseView.filterByROI(roi.id);  // child PlotDataView
  ctrlB.setDataView(filteredView, /* owns */ true);    // Plot B now filtered
});

// When ROI is deleted:
ctrlA.on('roiDeleted', () => {
  ctrlB.setDataView(baseView, /* owns */ false);       // Plot B reverts
});
```

### Ownership rules

| Scenario | `owns` flag | `destroy()` behavior |
|---|---|---|
| `new PlotController()` (no opts) | `_ownsDataStore = true` | destroys DataStore |
| `new PlotController({ dataStore })` | `_ownsDataStore = false` | does NOT destroy DataStore |
| `new PlotController({ dataView })` | `_ownsDataView = false` | does NOT destroy DataView |
| `setDataView(view, true)` | `_ownsDataView = true` | destroys DataView on swap/destroy |
| `setDataView(view, false)` | `_ownsDataView = false` | does NOT destroy DataView |

### Key constraint

The shared-data demo is in [`examples/SharedDataExample.jsx`](examples/SharedDataExample.jsx) and linked from the hub page.

---

## External Integration (F18)

MasterPlot never implements HTTP, WebSocket, or authentication logic. The engine boundary sits at `DataStore.appendData()` and `ROIController.updateFromExternal()`. External integration packages implement two adapter interfaces.

### Architecture boundary

```
External Source
      │
      ▼
 Adapter (your code)
 ├── ExternalDataAdapter ─► DataStore ─► PlotDataView ─► PlotController ─► deck.gl
 └── ExternalROIAdapter  ─► ROIController ─► roiExternalUpdate ─► PlotDataView dirty
```

### bufferStruct type

| Field | Type | Required | Description |
|---|---|---|---|
| `x` | `Float32Array` | ✅ | x coordinates |
| `y` | `Float32Array` | ✅ | y coordinates |
| `size` | `Float32Array` | optional | per-point pixel size (default 4.0) |
| `color` | `Uint8Array` | optional | RGBA per point — 4 bytes each (default opaque white) |

### ExternalDataAdapter contract

```js
import { ExternalDataAdapter } from './src/integration/ExternalDataAdapter.js';

class MyWSAdapter extends ExternalDataAdapter {
  constructor(dataStore, wsUrl) {
    super(dataStore);
    this._ws = new WebSocket(wsUrl);
    this._ws.onmessage = (evt) => {
      const buf = JSON.parse(evt.data);
      this.appendData({ x: new Float32Array(buf.x), y: new Float32Array(buf.y) });
    };
  }

  // Replace entire dataset with an incoming snapshot
  replaceData(bufferStruct) {
    this._dataStore.clear();
    this._dataStore.appendData(bufferStruct);
  }

  // Append incremental points
  appendData(bufferStruct) {
    this._dataStore.appendData(bufferStruct);
  }
}
```

### ExternalROIAdapter contract

```js
import { ExternalROIAdapter } from './src/integration/ExternalROIAdapter.js';

class MyServerROIAdapter extends ExternalROIAdapter {
  async load()            { /* fetch and return SerializedROI[] */ }
  async save(roi)         { /* PUT roi to server */ }
  subscribe(callback)     { /* register callback; return unsubscribe fn */ }
}

// Convenience: load → deserializeAll → start save/subscribe lifecycle
await adapter.attach();

// Cleanup
adapter.detach();
```

#### ROI sync flow

```
roiFinalized → adapter.save(roi) → storage
                                 → (other clients)
                                       → adapter.subscribe callback
                                             → roiController.updateFromExternal(roi)
                                                   → roiExternalUpdate
                                                         → PlotDataView dirty
```

#### Version conflict rules

| Condition | Result |
|---|---|
| `incoming.version > existing.version` | ✅ Accepted; bounds updated, `roiExternalUpdate` emitted |
| `incoming.version === existing.version` | ❌ Rejected (silent) |
| `incoming.version < existing.version` | ❌ Rejected (silent) |
| ROI id not found | ✅ Created as new ROI |

`updateFromExternal` does **not** call `bumpVersion()` — the incoming version is authoritative.

### Mock adapters (testing / demos)

```js
import { DataStore }       from './src/plot/DataStore.js';
import { MockDataAdapter } from './src/integration/MockDataAdapter.js';
import { MockROIAdapter }  from './src/integration/MockROIAdapter.js';

// MockDataAdapter: random batches on a timer
const store   = new DataStore();
const dataAdp = new MockDataAdapter(store, { intervalMs: 500, batchSize: 100 });
dataAdp.start();   // begins appending 100 random points every 500 ms
dataAdp.stop();    // stops the interval

// Full dataset replacement (store.clear() + appendData())
dataAdp.replaceData({ x: new Float32Array([1,2,3]), y: new Float32Array([4,5,6]) });

// MockROIAdapter: localStorage-backed persistence
const roiAdp = new MockROIAdapter(roiController, { storageKey: 'my_rois' });
await roiAdp.attach();   // restores ROIs from localStorage; starts save/subscribe
roiAdp.detach();         // removes all listeners
```

---

## Roadmap

See [PLAN.md](PLAN.md) for the full implementation plan and step status.

Later (unscheduled):

- Full multi-level RectROI nesting
- High-resolution PNG export (`plotController.exportPNG(options)`)
- Snapping constraints for ROIs
- TypeScript migration
