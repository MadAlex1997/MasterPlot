
# Production-Grade Scientific Plotting Engine Specification for MasterPlot

---

## ⚠️ AGENT IMPLEMENTATION PROTOCOL

**This project uses a structured multistep plan document: [PLAN.md](PLAN.md)**

All implementation work follows the plan in `PLAN.md`. **Read that file first before starting any work.**

### Critical Rules for Agents:

1. **Always check PLAN.md status** before beginning work
   - Identify unblocked, PENDING steps
   - Mark your step as `[IN_PROGRESS]` when you start
   - Updated with timestamp and notes when you make changes

2. **If requirements change or you discover new needs:**
   - STOP and request clarification from the user
   - Do NOT deviate from the plan without explicit permission
   - Explain why the plan needs to change and propose alternatives

3. **If you update or modify plan steps:**
   - Update the status (`[COMPLETED]`, `[REGRESSED]`, `[BLOCKED]`, etc.)
   - Add a date/time and brief note explaining what changed
   - If a step broke a previous one, mark affected steps as `[REGRESSED]`

4. **Before handing off to the next agent:**
   - Mark your completed steps as `[COMPLETED]`
   - Mark the next logical step as ready for pickup
   - Ensure all in-progress work is clearly documented
   - Add notes about any blockers or warnings

5. **Avoid scope creep:**
   - Stick to the current phase unless explicitly told otherwise
   - Don't add features that aren't in the plan
   - If you finish early, ask before moving to the next phase

6. **Before starting any implementation, create a new git branch:**
   - Run: `git checkout -b feature/<step-ids>` (e.g., `git checkout -b feature/F4-F5-F6`)
   - All commits for this work go on the feature branch — do NOT commit directly to main/master
   - After build verification, the branch is ready for review/merge

7. **After every completed feature, update the README and demo:**
   - Update `README.md` to document any new capabilities, controls, or architecture changes
   - Update `examples/HubPage.jsx` so the new demo/example is linked from the hub page
   - If a new webpack entry/HTML page is needed, add it to `webpack.config.js` and `public/`
   - GitHub Actions deploys from `main` automatically — merging to `main` updates https://madalex1997.github.io/MasterPlot/
   - A feature is **not complete** until README and HubPage reflect it

8. **Archive completed specs in PLAN.md:**
   - When marking a feature `[COMPLETED]`, replace its full spec block in `PLAN.md` with the compact 4-line summary format
   - Move the full spec to `docs/plan-archive.md` (append-only historical record)
   - This keeps `PLAN.md` stable at ~600–700 lines regardless of project history
   - See the compact summary template in `PLAN.md` → "Protocol for Agents" → rule 7

---

You are building a **production-grade scientific plotting engine** in:

- React (plain JS)
- Webpack
- No TypeScript required (but design must be TypeScript-ready)

This is NOT a simple chart component.

## MVP — IMPLEMENTED ✅

All MVP features are complete (F1–F13, B1–B8). Implemented:
- 10M+ points via WebGL / deck.gl ScatterplotLayer
- Linear / log axes with d3-scale; scientific tick formatting
- Wheel zoom (cursor-centered), drag pan (follow + grab modes), right-click drag zoom
- Semi-live data append every 2 s with auto-expand domain
- pyqtgraph-style ROIs (LinearRegion + nested RectROI, constraint propagation, x-locked children)
- Audio pipeline: file loading, STFT spectrogram, HistogramLUT, biquad filters, playback + playhead
- On-screen event log for all major events

## Phase 2 — COMPLETE ✅

All Phase 2 features done: F16 (rolling DataStore), F15 (lazy DataView), F14 (ROI versioning), F17 (shared data), F18 (external adapters).

## Phase 3 — ACTIVE (see PLAN.md for specs)

Implement in order: **F19 → F20 → F21 → EX4 → EX5**

- **F19** Cascading ROI Update + Conditional Child Versioning (Engine Fix — Critical)
- **F20** LineROI (Vertical/Horizontal + Half Variants + Labels)
- **F21** Axis Drag Scaling (Midpoint Zoom) on X and Y axes
- **EX4** Scatter Performance Dropdown (10k–10M points)
- **EX5** Geophysics / Seismography Example (10 stacked plots, shared X, vline ROIs)

Later (unscheduled):
- Full nested RectROI nesting (multiple levels)
- High-resolution export (`plotController.exportPNG(options)`)
- Snapping constraints

---

# Required Technologies

- deck.gl (WebGL rendering, OrthographicView only)
- d3-scale (axis transforms: linear, log, time)
- Canvas overlay for axes/ticks rendering
- EventEmitter (Node-style event system for controllers)
- Controller-based architecture (NOT React-state-driven)

---

# Project Structure

```
src/
  audio/
    FilterController.js          (F13 — offline biquad DSP)
    PlaybackController.js        (F12 — Web Audio playback + seek)
  components/
    FilterPanel.jsx              (F13 — filter UI + frequency response canvas)
    HistogramLUTPanel.jsx        (F11 — amplitude remapping panel)
    PlotCanvas.jsx               (React wrapper for PlotController)
  integration/                   (F18 — PENDING; adapter contracts)
    ExternalDataAdapter.js
    ExternalROIAdapter.js
    MockDataAdapter.js
    MockROIAdapter.js
  plot/
    DataStore.js                 (GPU typed-array buffers; F16 adds rolling ring buffer)
    LinePlotController.js        (F8 — line/path plot variant)
    PlotController.js            (main controller: zoom, pan, ROI, layers, render loop)
    PlotDataView.js              (F15 — PENDING; lazy derived data view)
    ViewportController.js        (canvas ↔ data coordinate transforms)
    ROI/
      ConstraintEngine.js
      LinearRegion.js
      RectROI.js
      ROIBase.js                 (F14 adds: version, updatedAt, domain, bumpVersion())
      ROIController.js           (F14 adds: serializeAll, deserializeAll, updateFromExternal)
    axes/
      AxisController.js
      AxisRenderer.js
    layers/
      HistogramLUTController.js  (F11 — LUT presets + histogram computation)
      LineLayer.js
      ROILayer.js
      ScatterLayer.js
      SpectrogramLayer.js        (F9 — STFT + BitmapLayer)
examples/
  ExampleApp.jsx                 (scatter plot demo)
  HubPage.jsx                    (links all demos — update after every feature)
  LineExample.jsx                (F8 — random-walk line demo)
  SharedDataExample.jsx          (F17 — PENDING; multi-plot shared DataStore demo)
  SpectrogramExample.jsx         (F9–F13 — audio spectrogram demo)
docs/
  plan-archive.md                (full specs of all completed features; append-only)
```

---

# Data Structure (MVP)

Points are structured objects with GPU-friendly attributes:

```javascript
const pointData = {
  x: Float32Array([...]),        // x coordinates
  y: Float32Array([...]),        // y coordinates
  color: Uint8Array([...]),      // packed RGBA (1 value per point = vec3 interpret)
  size: Float32Array([...]),     // point size (pixels)
  metadata: Map([id, {...}])     // optional per-point data (not GPU)
};
```

**Important:** Store x/y/color/size as GPU buffers. Metadata stays in JS.

---

# Event Architecture

All controllers emit events using Node-style EventEmitter:

```javascript
class PlotController extends EventEmitter {
  constructor() {
    super();
  }
  
  appendData(newPoints) {
    this.emit('dataAppended', { count: newPoints.length });
  }
  
  setZoom(zoomLevel) {
    this.emit('zoomChanged', { zoom: zoomLevel });
  }
}
```

Controllers expose:
- `.on(eventName, callback)`
- `.emit(eventName, data)`
- `.off(eventName, callback)` (cleanup)

1. React must NOT hold:
   - Point arrays
   - ROI geometry
   - Zoom state

2. React ONLY manages:
   - UI toggles
   - Configuration props

3. All rendering must be driven by `PlotController`.

4. All coordinate transforms must use `d3-scale`.

5. deck.gl must use `OrthographicView` (no maps).

6. Data must be stored in `Float32Array` buffers.

7. Data append must update GPU buffers without full reallocation.

---

# Axis Requirements

Support:

- Linear scale
- Log scale
- Time scale (Date objects or timestamps)

## AxisController Responsibilities

- Maintain domain
- Update scale functions
- Generate ticks
- Provide screen ↔ data transforms

## AxisRenderer Responsibilities

- Render ticks + labels to Canvas overlay
- Support toggle visibility
- Support export mode

---

# ROI System Requirements (pyqtgraph-like)

## ROIBase

Properties:
- id, parent, children
- bounds: x1, x2, y1, y2
- flags: movable, resizable, visible
- metadata
- **version** (monotonic integer, incremented on each user commit) ← F14
- **updatedAt** (timestamp of last `bumpVersion()` call) ← F14
- **domain** (`{ x: [x1, x2], y?: [y1, y2] }` snapshot, JSON-safe) ← F14

Methods:
- **`bumpVersion()`** — increments version, refreshes updatedAt + domain snapshot ← F14

Events:
- onCreate, onUpdate, onDelete

---

## RectROI

- Draggable
- Resizable via corner handles
- Optional snapping

---

## LinearRegion

- Vertical only
- Defines x1 and x2
- Can contain RectROIs
- Enforces constraints:
  - child.x1 >= parent.x1
  - child.x2 <= parent.x2
  - Children shift when parent moves

---

## ConstraintEngine

- Runs after any ROI mutation
- Enforces parent-child relationships
- Supports nesting
- Emits cascading update events

---

## ROIController

Handles:
- Keybind listener (e.g., 'R' key) OR button click to enter creation mode
- While in creation mode: watch for plot canvas clicks to define ROI corners
  - For LinearRegion: single click sets x1, second click sets x2
  - For RectROI: first click sets top-left, second click sets bottom-right
- Mouse move (drag to move existing ROI)
- Mouse up → calls `roi.bumpVersion()`, emits `roiFinalized` ← F14
- Handle selection (corner/edge detection)
- Deletion

**Events emitted:** `roiCreated`, `roiUpdated` (drag), `roiFinalized` (commit on mouseup), `roiDeleted`, `roiExternalUpdate`, `roisChanged`

**Serialization API (F14):**
- `serializeAll()` → `[{ id, type, version, updatedAt, domain, metadata }]`
- `deserializeAll(array)` — restore from serialized array (initial load only)
- `updateFromExternal(serializedROI)` — version-gated: reject if `incoming.version <= current.version`; emit `roiExternalUpdate` on acceptance

Must operate independently of React.

---

# Rendering Requirements

Implement custom deck.gl layers:

- ScatterLayer (instanced)
- LineLayer
- ROILayer (composite layer rendering rectangles + borders + handles)

Do NOT use React re-renders to update WebGL.

`PlotController` must:

- Own deck instance
- Own layers
- Call `setProps` directly
- Manage redraw loop

---

# Zoom & Pan

Implement:

- Wheel zoom centered on cursor
- Drag to pan
- Zoom modifies axis domain
- Data buffers must NOT change during zoom

## Y-axis Coordinate Convention

deck.gl `OrthographicView` is explicitly `flipY: false` in MasterPlot — y is **NOT** flipped at the GPU/projection level.

However, the d3 y scale uses an **inverted range** `[plotBottom_px, plotTop_px]` so that data-y=0 appears at the visual bottom and data-y=max at the top (standard scientific convention). This makes `pxSpan` inside `AxisController.panByPixels` **negative** for y.

**Consequence for interaction code:**

```
dataDelta = -(pixelDelta / pxSpan) * domainSpan

x axis: pxSpan > 0  →  panByPixels(+n) decreases domain (viewport shifts right)
y axis: pxSpan < 0  →  panByPixels(+n) increases domain (double-negation — opposite of x!)
```

**Rule for any new pan/interaction code:** to achieve the same directional behavior on y as on x, **negate `dy`** relative to what you would use for `dx`.

Examples:
- Follow scroll: x uses `panByPixels(-dx)`, y must use `panByPixels(+dy)` ← `+dy` not `-dy`
- Drag (grab) pan: x uses `panByPixels(+dx)`, y must use `panByPixels(+dy)` as well ← same sign, NOT negated

---

# DataStore Requirements

- Extends `EventEmitter`; emits `'dirty'` on every append, `'dataExpired'` when rolling eviction occurs
- Holds `Float32Array` buffers for x, y, size (`_sizeArr`); `Uint8Array` for colors (RGBA)
- `appendData(newChunk)` — adds new points; resizes GPU buffers if needed (non-rolling) or writes into ring (rolling)
- `getGPUAttributes()` — returns `{ x, y, size, color }` GPU-ready buffers (subarrays in non-rolling mode; ordered copy in rolling mode)
- `getPointCount()` — returns current live point count
- `getLogicalData()` — returns ordered `{ x, y, size, color }` (handles wrapped ring buffer; safe for CPU-side use)

**Rolling ring buffer (F16):**
- `enableRolling({ maxPoints?, maxAgeMs? })` — activates fixed-capacity ring mode; allocates `_timestamps: Float64Array`
- `expireIfNeeded()` — advances `tailIndex` to evict stale/excess points; emits `'dataExpired'`
- Internal fields: `_headIndex`, `_tailIndex`, `_rollingEnabled`, `_maxPoints`, `_maxAgeMs`, `_timestamps`
- Non-rolling mode (`enableRolling` never called): all prior behavior unchanged; `_grow()` still used for dynamic resize

---

# PlotDataView Requirements (F15 — PENDING)

`PlotDataView` (`src/plot/PlotDataView.js`) is a lazily-evaluated, dirty-flag-cached derived view over a `DataStore` or another `PlotDataView`. It never mutates its source.

- `constructor(source, transformFn = null, opts = {})` — `opts.roiController` optional
- `getData()` — recomputes if dirty, returns cached snapshot otherwise
- `markDirty()` — sets dirty flag, emits `'dirty'` for child cascade
- `filterByDomain(domain)` → new child PlotDataView
- `filterByROI(roiId)` → new child PlotDataView (uses ROI bounding box)
- `histogram({ field, bins })` → `{ counts: Float32Array, edges: Float32Array }`
- `snapshot()` → deep copy (`.slice()` of all typed arrays)
- `destroy()` — removes all event listeners

**Dirty propagation rules:**
- Mark dirty on: DataStore `'dirty'`, DataStore `'dataExpired'`, `roiFinalized`, `roiExternalUpdate`
- Do **NOT** mark dirty on `roiUpdated` (drag must not trigger recompute)
- Child views cascade via `'dirty'` event from parent

---

# External Integration Contracts (F18 — PENDING)

The engine never implements HTTP, WebSocket, or auth. Integration packages implement two interfaces:

**ExternalDataAdapter** (`src/integration/ExternalDataAdapter.js`):
- `replaceData(bufferStruct)` — full dataset replacement; `bufferStruct = { x: Float32Array, y, size?, color? }`
- `appendData(bufferStruct)` — incremental append

**ExternalROIAdapter** (`src/integration/ExternalROIAdapter.js`):
- `async load()` → `Promise<SerializedROI[]>` — load on init
- `async save(serializedROI)` → `Promise<void>` — persist after `roiFinalized`
- `subscribe(callback)` → unsubscribe function — receive external updates; engine calls `updateFromExternal()`

Mock implementations in `src/integration/MockDataAdapter.js` and `MockROIAdapter.js`.

---

# Export Mode (unscheduled)

Implement later:

```javascript
plotController.exportPNG(options)
```

Options: hideAxes, hideLegend, resolutionMultiplier

---

# Performance Requirements

- Must handle 10M points without freezing UI
- No per-point hover picking
- ROI picking only
- No expensive object allocations during drag
- Avoid garbage collection spikes

---

# Example Usage

Provide a complete example demonstrating:

1. **Static render**:
   - 1M initial random points (x: log scale 1–10000, y: linear 0–100)
   - Points colored by density region (3 color bands)
   - Different point sizes based on y-value

2. **Interaction**:
   - Zoom with mouse wheel (centered on cursor)
   - Pan with drag
   - Press 'L' to create a LinearRegion (click once for x1, click again for x2)
   - Press 'R' to create a RectROI inside a LinearRegion
   - Drag LinearRegion → nested RectROI moves with it (constraint demo)
   - Delete ROI with 'D' key
   - Pan/zoom updates axis labels dynamically

3. **Live append**:
   - Every 2 seconds: append 10k new random points
   - GPU buffer updates without freezing UI
   - Auto-expand domain if needed
   - Emit `dataAppended` event

4. **Events shown in on-screen log panel and console**:
   - roiCreated, roiDeleted — always shown
   - roiUpdated — shown with formatted bounds (x1, x2, y1, y2)
   - dataAppended — always shown
   - domainChanged, zoomChanged — always shown
   - panChanged — shown when displacement > 5px (throttled to avoid spam)

---

# Code Quality Requirements

- Modular
- No global variables
- Event-driven
- Clean separation of rendering vs logic
- Future TypeScript conversion easy
- No unnecessary dependencies

---

# Important Constraints

- Do NOT use Redux
- Do NOT use React state for plot data
- Do NOT use SVG for data rendering
- Do NOT use Mapbox
- Must use OrthographicView
- Must not assume geospatial coordinates

---

# Deliverables

**Phase 1 (MVP) — COMPLETE**
- ✅ PlotController + ScatterLayer + LineLayer + ROILayer + SpectrogramLayer
- ✅ ROI creation (LinearRegion + RectROI), constraint propagation, event log
- ✅ Audio pipeline: file load, STFT spectrogram, HistogramLUT, filters, playback
- ✅ Example pages: scatter (`example.html`), line (`line.html`), spectrogram (`spectrogram.html`)

**Phase 2 (Data Infrastructure) — COMPLETE ✅**
- ✅ F16: Rolling ring buffer DataStore
- ✅ F15: Lazy PlotDataView (filtering, histogram, shared views)
- ✅ F14: ROI versioning + serialization + external sync
- ✅ F17: Multi-plot shared DataStore/DataView + SharedDataExample
- ✅ F18: External integration adapter contracts + mock implementations + README guide

**Phase 3 (Engine Features + Seismography) — ACTIVE**
- ⏳ F19: Cascading ROI Update + Conditional Child Versioning
- ⏳ F20: LineROI (Vertical/Horizontal + Half Variants + Labels)
- ⏳ F21: Axis Drag Scaling (Midpoint Zoom)
- ⏳ EX4: Scatter Performance Dropdown (10k–10M points)
- ⏳ EX5: Geophysics / Seismography Example

