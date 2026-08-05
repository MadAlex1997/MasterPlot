
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

5a. **Enforce source directory rules:**
   - `src/` — **library code only**: controllers, layers, stores, utilities that ship as part of the engine. No app glue, no entry points, no example-specific files.
   - `src/components/` — **library React API**: React components that are part of the engine's public surface (e.g. `PlotCanvas.jsx`, or a future multi-plot layout component that does significant cross-controller wiring). **Ask the user before adding any new file here** — the test is "does this belong in the library itself, or is it a convenience wrapper a user could reasonably write themselves?"
   - `examples/` — **example page components and their entry points**: `*.jsx` page components go directly in `examples/`; webpack entry JS files go in `examples/src/`.
   - `ui/` — **optional React UI extensions**: convenience wrappers for built-in controller interfaces (e.g. `LUTPanel.jsx`, `FilterPanel.jsx`). These are provided as a courtesy — users are expected to build their own UI on top of the controller events. Do NOT put these in `src/`.
   - `public/` — HTML templates only (unchanged).
   - Violating these boundaries is a plan deviation — stop and ask before adding files to the wrong directory.

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

10. **ON HOLD features are inert:**
   - Features marked `⏸ ON HOLD` must not be used as dependencies by any other feature
   - They must not appear in any documentation page (Architecture, Getting Started, API Reference, Deep-Dives, README) outside of the roadmap table in `PLAN.md`
   - Treat them as non-existent until the user explicitly resumes them

9. **Update the documentation site after every completed feature:**
   - The project has a live documentation SPA at `docs.html` (built in DOC1–DOC4). After DOC1 is merged, agents must keep it current.
   - For each completed feature, check whether any of the four doc sections need updating:
     - **Architecture** (`examples/docs/ArchitecturePage.jsx`) — update Mermaid diagrams if a new controller, layer type, or event-bus connection was added
     - **Getting Started** (`examples/docs/GettingStartedPage.jsx`) — update if default behaviour or key interaction patterns changed
     - **API Reference** (`examples/docs/ApiReferencePage.jsx`) — add/update method rows, constructor option rows, or event rows for every public API change
     - **ROI Deep-Dive** (`examples/docs/RoiDeepDivePage.jsx`) — update if ROI types, creation modes, versioning rules, or serialization shape changed
   - A feature is **not complete** until the doc site reflects it (same rule as README + HubPage)
   - If DOC1 has not yet been merged (i.e., `examples/docs/` does not exist), skip this step and note it in the PLAN.md changelog entry

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

## Phase 3 — COMPLETE ✅

All Phase 3 features done: F19 (cascading ROI), F20 (LineROI), F21 (axis drag zoom), EX4 (scatter perf dropdown), EX5 (seismography), EX6 (ROI table double-click selection).

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

**Directory ownership rules (enforced — see agent rule 5a):**
- `src/` = library code only
- `src/components/` = library React API (ask before adding — see rule 5a)
- `examples/` = example page JSX components
- `examples/src/` = webpack entry JS files (one per page)
- `ui/` = optional React UI convenience wrappers (not library code)
- `public/` = HTML templates

```
src/                             ← LIBRARY CODE ONLY
  audio/
    AudioController.js           (F30 — audio load/playback/STFT tiles/streaming)
    FilterController.js          (F13 — offline biquad DSP; kept for compat)
    PlaybackController.js        (F12 — Web Audio playback; kept for compat)
  components/
    PlotCanvas.jsx               (React wrapper for PlotController)
    ⚠️  Ask user before adding any new file here — see agent rule 5a
  integration/
    ExternalDataAdapter.js       (F18 — adapter contract)
    ExternalROIAdapter.js
    MockDataAdapter.js
    MockROIAdapter.js
  plot/
    DataStore.js                 (GPU typed-array buffers; rolling ring buffer F16)
    LUTHistogramController.js    (F28 — PlotController-backed histogram for LUT panel)
    PlotController.js            (main controller: zoom, pan, ROI, layers, render loop)
    PlotDataView.js              (F15 — lazy derived data view)
    ViewportController.js        (canvas ↔ data coordinate transforms)
    ROI/
      ConstraintEngine.js
      LinearRegion.js
      LineROI.js
      RectROI.js
      ROIBase.js
      ROIController.js
    axes/
      AxisController.js
      AxisRenderer.js
    layers/
      BitmapDataLayer.js         (F27 — generic bitmap layer; URL/array/image sources)
      _buildBitmapFromGrid.js    (F27 — shared CPU colorization util)
      LineLayer.js
      LUTController.js           (F28 — generalized colormap + level controller)
      PlotLayer.js
      ROILayer.js
      ScatterLayer.js
      SignalDataLayer.js
      TraceGroup.js
  popup/
    PopupWindowManager.js
    usePopupChannel.js

examples/                        ← EXAMPLE PAGE COMPONENTS
  src/                           ← webpack entry JS files (one per HTML page)
    example.js
    docs.js
    index.js
    live-signals.js
    multi-sensor.js
    shared-data.js
    spectrogramV2.js             (EX-Spec)
  docs/                          ← documentation SPA page components
    shared/
      CodeBlock.jsx
      MermaidDiagram.jsx
      NavSidebar.jsx
    ApiReferencePage.jsx
    ArchitecturePage.jsx
    GettingStartedPage.jsx
    PlotControllerDeepDivePage.jsx
    RoiDeepDivePage.jsx
  DocsPage.jsx
  ExampleApp.jsx
  HubPage.jsx                    (links all demos — update after every feature)
  LiveSignalsExample.jsx
  MultiSensorExample.jsx
  SeismographyExample.jsx
  SharedDataExample.jsx
  SpectrogramPopup.jsx           (popup host shell for SpectrogramV2 filter + labels panels)
  SpectrogramV2Example.jsx       (EX-Spec)

ui/                              ← OPTIONAL REACT UI EXTENSIONS (not library code)
  FilterPanel.jsx                (F13 — filter UI; users may replace with their own)
  LUTPanel.jsx                   (F29 — LUT histogram + colormap panel)

public/                          ← HTML TEMPLATES
  *.html

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

**Rule for any new pan/interaction code:** don't assume a universal "negate dy relative to dx"
law — the two shipped examples below don't actually follow one (one negates both dx and dy,
the other negates neither). Instead, verify the desired direction against the actual formula
above and cross-check against whichever of these two examples is the closer semantic match to
what you're building.

Examples (verified against shipped code, not just described from memory):
- Follow scroll (F5, velocity-based pan while holding the mouse away from the anchor point):
  `panByPixels({ dx: -dx * speed, dy: -dy * speed })` — **both** negated
  (`src/plot/PlotController.js`, `_scheduleRender()`'s follow-pan tick).
- Drag (grab) pan (content follows the cursor 1:1): `panByPixels({ dx, dy })` — raw values,
  **neither** negated (`src/plot/PlotController.js`, `_onMouseMove`'s grab-pan branch).

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
- ✅ PlotController + ScatterLayer + LineLayer + ROILayer
- ✅ ROI creation (LinearRegion + RectROI), constraint propagation, event log
- ✅ Audio pipeline: file load, STFT spectrogram, HistogramLUT, filters, playback
- ✅ Example pages: scatter (`example.html`), line (`line.html`)

**Phase 2 (Data Infrastructure) — COMPLETE ✅**
- ✅ F16: Rolling ring buffer DataStore
- ✅ F15: Lazy PlotDataView (filtering, histogram, shared views)
- ✅ F14: ROI versioning + serialization + external sync
- ✅ F17: Multi-plot shared DataStore/DataView + SharedDataExample
- ✅ F18: External integration adapter contracts + mock implementations + README guide

**Phase 3 (Engine Features + Seismography) — COMPLETE ✅**
- ✅ F19: Cascading ROI Update + Conditional Child Versioning
- ✅ F20: LineROI (Vertical/Horizontal + Half Variants + Labels)
- ✅ F21: Axis Drag Scaling (Midpoint Zoom)
- ✅ EX4: Scatter Performance Dropdown (10k–10M points)
- ✅ EX5: Geophysics / Seismography Example
- ✅ EX6: ROI Table Double-Click Selection (ExampleApp.jsx only)

**Phase 4 (Bitmap / LUT Refactor) — IN PROGRESS**
- 🔲 ARCH-F: Project Restructure — `src/` purity, `examples/src/` entry points, `ui/` non-library React
- 🔲 F27: Generic BitmapDataLayer (URL / array / image; `bitMapping`; `channels` + `dtype`)
- 🔲 F28: LUTController + LUTHistogramController (PlotController-backed histogram; HLine ROI handles)
- 🔲 F29: LUTPanel React component (fresh; in `ui/`)
- 🔲 F30: AudioController (absorbs playback + sample mgmt; stateless `setFilterFn` bridge; STFT tiles)
- 🔲 EX-Spec: Spectrogram V2 Example (PlotController + BitmapDataLayer + AudioController + LUTPanel)
- ✅ CLEANUP: Delete legacy SpectrogramLayer, HistogramLUTController, old spectrogram example

