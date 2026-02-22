
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

---

You are building a **production-grade scientific plotting engine** in:

- React (plain JS)
- Webpack
- No TypeScript required (but design must be TypeScript-ready)

This is NOT a simple chart component.

## MVP Priority (for rapid prototype)

Must support:
- 100k → 10M+ points
- WebGL rendering via deck.gl
- Linear / log / datetime axes
- Zoom (wheel) / pan (drag)
- Scientific tick formatting
- **Semi-live data append** (streaming updates every N ms)
- **pyqtgraph-style ROIs** (LinearRegion with nested RectROI, constraint propagation)
  - Constrained RectROIs (parented to a LinearRegion) must have x-bounds locked to their parent at all times; no independent left/right movement or resize handles
- Keybind/button to activate ROI creation, then click-based drawing flow
- No hover tooltips, no React state for large data
- On-screen event log showing roiCreated, roiUpdated (with bounds), roiDeleted, dataAppended, domainChanged, zoomChanged, panChanged

Later (v2):
- Full nested RectROI nesting (multiple levels)
- High-resolution export
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

ssrc/
  plot/
    PlotController.js
    ViewportController.js
    DataStore.js
    ROI/
      ROIBase.js
      RectROI.js
      LinearRegion.js
      ROIController.js
      ConstraintEngine.js
    layers/
      ScatterLayer.js
      LineLayer.js
      ROILayer.js
    axes/
      AxisController.js
      AxisRenderer.js
  components/
    PlotCanvas.jsx

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
- id
- parent
- children
- bounds (x1, x2, y1, y2)
- flags (movable, resizable, visible)
- metadata

Events:
- onCreate
- onUpdate
- onDelete

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
- Mouse up
- Handle selection (corner/edge detection)
- Deletion
- Emits events upward (all via EventEmitter)

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

- Holds `Float32Array` buffers for x, y, size; `Uint8Array` for colors
- `appendData(newChunk)` — adds new points, resizes GPU buffers if needed
  - Should update GPU buffers WITHOUT full reallocation (use buffer offset tricks or expand only)
- `getGPUAttributes()` — returns { x, y, color, size } GPU-ready buffers
- `getPointCount()` — returns current point count
- Exposes no JSON arrays (all GPU-ready)

---

# Export Mode (v2 feature)

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

1. **Working implementation** with all MVP features:
   - PlotController managing render loop
   - ROI creation via keybind + click
   - Live append every 2 seconds
   - Constraint propagation (nested ROIs)
   - All events emitted properly

2. **Clear README** explaining:
   - Architecture and data flow
   - How controllers interact
   - EventEmitter usage
   - Performance profile (how many points tested)
   - Keybinds and interaction guide

3. **Annotated code** for:
   - ConstraintEngine logic (how nesting works)
   - GPU buffer append strategy
   - ROI coordinate calculation (screen ↔ data)

4. **Example page** (HTML + React component):
   - 1M points + live append demo
   - All interaction features working
   - Console logs for event debugging
```

