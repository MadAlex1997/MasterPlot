# MasterPlot

> **Prototype Disclosure**
> MasterPlot is an **experimental prototype**, not a production-ready library.
> It is being developed iteratively using **agentic AI** (Claude Code / Anthropic Claude) following a structured plan in [PLAN.md](PLAN.md).
> Expect breaking changes, incomplete documentation, and rough edges.

---

**[Live Demo →](https://madalex1997.github.io/MasterPlot/)** &nbsp;|&nbsp; **[Documentation →](https://madalex1997.github.io/MasterPlot/docs.html)**

A high-performance scientific plotting engine built on React, deck.gl (WebGL), and d3-scale.
Designed for real-time data, large datasets (tested to 1M+ points), and audio/signal analysis workflows.

---

## Current Capabilities (F1–F23 + F27–F30 + EX1–EX12 + EX-Spec + ARCH-A/B/C/D/F complete)

### Core Plotting Engine
- **WebGL rendering** via deck.gl `OrthographicView` — no maps, no geospatial assumptions
- **Scatter plots** with instanced rendering (`ScatterLayer`) — GPU typed array buffers, no per-point JS objects
- **Pluggable data layer registry (ARCH-A)** — `PlotController.registerDataLayer(id, buildFn, props?)` replaces the hardcoded scatter layer with a user-extensible registry; `unregisterDataLayer(id)` and `updateDataLayerProps(id, props)` for runtime management; `disableDefaultDataLayer: true` constructor option to start with an empty canvas; scatter is registered by default for backwards compatibility
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

### Auto-Scale / Reset Zoom (F23)
Press **Spacebar** to instantly fit both axes to the full extent of the current data:

```js
// Programmatic auto-scale (also triggered by spacebar)
ctrl.autoScale();

// Register an explicit home domain — spacebar restores these exact bounds instead of scanning data
ctrl.setHomeDomain([0, 10], [0, 100]);
```

| Behaviour | Details |
|-----------|---------|
| **Spacebar** | Resets both axes; ignored when focus is inside `<input>`, `<textarea>`, or `<select>` |
| **Data-driven** | Scans `DataStore.getLogicalData()` for min/max on both axes; adds 5 % padding each side |
| **Home domain** | If `setHomeDomain(x, y)` was called with both non-null, those exact bounds are used instead of scanning |
| **No-op guard** | Does nothing when the DataStore has 0 points and no home domain is set |
| **Multi-plot** | Each `PlotController` instance binds its own handler — no cross-firing on pages with multiple plots |
| **Event** | Emits `'autoScaled'` with `{ xDomain, yDomain }` |
| **Opt out** | Pass `autoScaleKey: null` in constructor options to disable the spacebar binding entirely |

### Spectrogram / Audio Analysis Example (EX9 + EX10 + EX12)
A full-featured spectrogram viewer is available at the demo (Spectrogram tab):

| Feature | Details |
|---|---|
| **Real-time STFT spectrogram** | WebGL rendered; configurable window size (256–8192); hop = window/2 |
| **FFT window function** | Dropdown selects Hann / Hamming / Blackman / Rectangular; switches immediately recompute STFT via `fft-windowing` npm |
| **Synchronized waveform** | PCM waveform shown below the spectrogram |
| **Audio file loading** | Any format `AudioContext.decodeAudioData` supports (WAV, MP3, OGG, FLAC, etc.) |
| **Preset sounds** | Dropdown loads 4 bundled WAV files (city blackbird, ringdove + car, plane 1, plane 2) from `/sounds`; no file picker needed |
| **Stress test presets (EX12)** | `── Stress Test ──` optgroup in the preset dropdown generates 5 / 10 / 15 / 30 / 60 min segments at 4 kHz; source is downsampled from the last loaded preset (default: plane1.wav) via `OfflineAudioContext` with 1 800 Hz anti-alias lowpass, then randomly stitched to target length; label shows `Generating N min…` while in progress; hands off to the standard `loadAudioBuffer` path when done |
| **Live append mode** | Chirp + noise generated every 500 ms; toggle on/off |
| **HistogramLUT panel** | pyqtgraph-style dB amplitude histogram; draggable level_min / level_max handles (clamp to new dB range after filtering — no more disappearing handles); 6 LUT presets; Auto Level button |
| **Audio playback** | Play / Pause / Stop; yellow dashed playhead line on both panels at 60 fps; Ctrl+click to seek on either panel |
| **Per-type DSP filters** | Offline biquad DSP via `OfflineAudioContext`; **lowpass/highpass**: single log-scale cutoff slider + Q slider; **bandpass/notch**: two frequency sliders (Low freq / High freq) with computed geometric-mean center + bandwidth Q shown as read-only text; dual orange markers on frequency-response canvas. Higher-order Butterworth (2nd / 4th / 6th / 8th order) via cascaded biquad sections; Q values derived from Butterworth pole positions (`Q_k = 1 / (2·cos((2k−1)π/(2N)))`). Order selector visible for lowpass / highpass types. |
| **Auto-zoom on Apply** | Clicking Apply zooms the spectrogram y-axis to the filtered range: `[0, cutoff]` (lowpass), `[cutoff, nyq]` (highpass), `[low, high]` (bandpass); Clear DSP Filter restores `[0, nyquist]` |
| **Axis drag zoom (EX10)** | Drag on the X or Y axis gutter to zoom that axis independently (same convention as F21: X left=in, Y down=in); works on both spectrogram and waveform panels |
| **Spacebar reset (EX10)** | Resets both panels to full duration × full frequency/amplitude range; no-op when no audio is loaded |

### Scatter + ROI Example (EX1 / EX4)
The main scatter demo (`ExampleApp`) includes a **point-count dropdown** for performance benchmarking and two live ROI inspection tables below the event log.

**Point-count dropdown (EX4)**

| Option | Points |
|---|---|
| 10,000 | Default; fast load |
| 100,000 | — |
| 1,000,000 | — |
| 5,000,000 | — |
| 10,000,000 | GPU stress test |

Selecting a new count pauses live append, calls `dataStore.clear()`, resets the domain, loads the new dataset, and resumes append — React holds only the integer count, no arrays.

**ROI inspection tables**

| Table | Contents | Update trigger |
|---|---|---|
| **LinearRegion table** | ID (truncated) · Left bound · Right bound · Version | `roiCreated`, `roiFinalized`, `roiDeleted` |
| **RectROI subset table** | ID · Left · Right · Bottom · Top · Version | Same — filtered to rects overlapping the selected LinearRegion |

Click any LinearRegion row to select it and populate the RectROI table. Click again to deselect. Tables never update during drag (`roiUpdated` is intentionally ignored), so there is no UI jitter while moving ROIs.

### Live Signal Analysis Example (EX8)

`LiveSignalsExample` replaces the former `LineExample` and `RollingLineExample` with a single unified page:

| Feature | Details |
|---|---|
| **Three live signals** | Deterministic sin/cos waves (A, B, C) appended every 200 ms; vertical offsets keep all bands visually separated |
| **Rolling window** | Configurable 10 s / 30 s / 60 s dropdown; `trimBefore()` evicts stale data each tick; left edge visibly advances |
| **Wall-clock X-axis** | X values are seconds elapsed since mount; domain tracks `[now - windowSecs, now]` |
| **ROI stats sidebar** | Press **L** to draw a `LinearRegion`; sidebar shows **mean**, **RMS**, and **peak-to-peak** per signal, updated live each tick and on every drag commit |
| **Pause / Resume** | Freeze / unfreeze live append without destroying the controller |
| **Event log** | Last 25 entries: zoom, pan, expiry, roi create/finalize/delete |

### Seismography Example (EX5)

Fifty stacked seismograph channels in a single page, each backed by its own `DataStore` and independent Y-axis:

| Feature | Details |
|---|---|
| **50 channels** | Independent sin-wave signals with distinct frequency and phase per channel |
| **Shared X-axis** | Zoom or pan on any channel propagates the new x-domain to all others via `domainChanged` → `xAxis.setDomain()` |
| **P-wave picks** | Each channel has a pre-seeded `vline-half-bottom` LineROI with a station label rendered on the canvas overlay |
| **Draggable picks** | Drag any pick to update its position; table row refreshes on `roiFinalized` |
| **Sidebar table** | Station · Label · Pos (s); edits committed on Enter/blur |
| **Version-gated edits** | Table edit calls `updateFromExternal()` with `version + 1`; rejected if a concurrent drag committed a higher version |
| **React owns no geometry** | `tableRows` is a display cache; all bounds live in `LineROI.position` |

### Multi-Sensor Scatter Example (F22 / EX7)

Fifty sensors × 10,000 points each (500k total points), each sensor colour-coded via a 25-entry palette that cycles at `sensor_25`:

| Feature | Details |
|---|---|
| **TraceGroup** | Partitions all 500k points by tag in one O(n) pass at module level; no React state holds any array |
| **25-color palette** | OKLAB-derived RGBA colors, high-contrast on dark background; sensors 25–49 reuse slots 0–24 |
| **Pluggable layer** | `traceGroup.toLayerDef().build` registered via `ctrl.registerDataLayer('traces', …)` |
| **Visibility sidebar** | Scrollable checkbox list; toggling a sensor calls `setTraceVisible()` + bumps a React counter — only the sidebar re-renders, not the canvas |
| **Show All / Hide All** | Bulk visibility controls; empty canvas on "Hide All", all 50 traces return on "Show All" |
| **React owns zero arrays** | All data lives at module level; `_traceGroup = null` on unmount |

---

### Phase 4 — Bitmap / LUT Layer (F27–F29, ARCH-F)

#### BitmapDataLayer (F27)

Generic `CompositeLayer` that renders any 2D image (URL, `ImageBitmap`, or typed-array grid) at an arbitrary data-space bounding rectangle. Useful for heatmaps, spectrograms, tile layers, and image overlays.

| Prop | Type | Description |
|---|---|---|
| `imageData` | `string \| ImageBitmap \| TypedArray` | Image source — URL (fetched), ImageBitmap (direct), or numeric grid |
| `bitMapping` | `{ bounds: [x0,y0,x1,y1] }` or `{ origin: [x0,y0], scale: [sx,sy] }` | Data-space placement; two forms are equivalent |
| `channels` | `'rgba' \| 'rgb' \| 'gray' \| 'gray+alpha'` | Channel layout of typed-array grids |
| `width`, `height` | `number` | Grid dimensions (typed-array source only) |
| `lutController` | `LUTController` | Optional per-layer LUT; colorizes grayscale grids; reacts to `version` |
| `colorTrigger` | `number` | Increment to force recolorization without new data |
| `dataTrigger` | `number` | Increment to force image re-resolution |

`_buildBitmapFromGrid` (`src/plot/layers/_buildBitmapFromGrid.js`) is the shared CPU colorizer — handles rgba/rgb direct copy, gray→LUT/Viridis colorize, gray+alpha.

#### LUTController (F28a)

Generalization of the legacy `HistogramLUTController`. Pure JS `EventEmitter` — no React.

```js
import { LUTController } from './src/plot/layers/LUTController.js';

const lut = new LUTController(256);   // 256 histogram bins
lut.setData(flatArray, globalMin, globalMax);  // compute histogram + auto-level on first call
lut.setLUT('plasma');          // switch colormap preset
lut.setLevels(min, max);       // set contrast window
lut.autoLevel(2, 98);          // snap to 2nd/98th percentile
lut.getLUTArray();             // Uint8Array[1024] RGBA lookup table
lut.version;                   // monotonic counter — use as colorTrigger
```

**Events:** `levelChanged({ level_min, level_max })`, `lutChanged(presetName)`, `dataChanged({ bins, edges, globalMin, globalMax })`

**Presets:** `viridis`, `grayscale`, `plasma`, `inferno`, `magma`, `hot`

#### LUTHistogramController (F28b)

Owns an internal `PlotController` configured as a read-only histogram viewer. Histogram bars are horizontal `SolidPolygonLayer` rectangles; level handles are draggable `hline` LineROIs. Intended as the backing controller for `LUTPanel`.

```js
import { LUTHistogramController } from './src/plot/LUTHistogramController.js';

const histCtrl = new LUTHistogramController({ lutController: lut, bins: 256 });
histCtrl.init(webglCanvas, axisCanvas);   // call once canvases are in DOM
histCtrl.plotController;                  // the internal PlotController instance
histCtrl.destroy();                       // cleanup
```

Dragging a hline → `roiUpdated` → `lutController.setLevels()` → `levelChanged` → connected `BitmapDataLayer` recolorizes. `autoLevel()` moves the hlines to match.

**`PlotController.disablePanZoom` option:** new constructor option that suppresses wheel and drag-pan/zoom handlers while keeping ROI drag active. Used by `LUTHistogramController`.

#### LUTPanel (F29)

React convenience component combining the histogram plot, LUT gradient strip, colormap dropdown, and Auto Level button in one panel. Lives in `ui/` (not library code — users may build their own UI on top of `LUTController` events).

```jsx
import LUTPanel from './ui/LUTPanel.jsx';

<LUTPanel
  lutController={lut}         // LUTController instance
  lutHistCtrl={histCtrl}      // LUTHistogramController instance
  width={160}                 // panel width in px (default 160)
  height="100%"               // CSS height (default '100%')
/>
```

**Layout:** histogram plot (left) + 12 px LUT gradient strip (right) + colormap `<select>` + Auto Level `<button>` (bottom). Level adjustment is via hline LineROIs inside the plot — no React drag handlers.

#### AudioController (F30)

Unified audio management controller. Absorbs `PlaybackController` and STFT/tile logic.

```js
import { AudioController } from './src/audio/AudioController.js';

const audioCtrl = new AudioController();

// Load from file input
const buf = await file.arrayBuffer();
await audioCtrl.loadFile(buf);                        // emits 'loaded'

// Stateless filter bridge (FilterController compatible)
audioCtrl.setFilterFn((samples, sr) => filterCtrl.applyToSamples(samples, sr));

// Tiled STFT
await audioCtrl.computeSTFT({ windowSize: 1024, windowFn: 'hann', tileWidthSec: 30 });
// → emits 'tileReady' per tile, then 'stftComplete'

// Playback
audioCtrl.play();    // emits 'stateChanged' + 'timeUpdate' at ~10 Hz
audioCtrl.pause();
audioCtrl.stop();
audioCtrl.seek(5.0);

audioCtrl.destroy(); // cleanup
```

**`tileReady` event payload:**
```js
{ tileIndex, power: Float32Array, width, height, globalMin, globalMax,
  bounds: [tStart, 0, tEnd, nyquist] }
```

#### Spectrogram V2 Example (EX-Spec)

Combines all Phase 4 primitives into a full audio analysis page at `spectrogram-v2.html`:

- **AudioController** computes tiled STFT → each `tileReady` registers a `BitmapDataLayer('tile-N')`
- **LUTController** + **LUTHistogramController** + **LUTPanel** sidebar for real-time colormap / level adjustment
- **FilterPanel** sidebar wired to `audioCtrl.setFilterFn` — Apply button recomputes STFT with filter
- Playhead `vline` LineROI updated on every `timeUpdate` event
- User `RectROI` annotations on the spectrogram (press `R`)
- Waveform `PlotController` (SignalStore / PathLayer) with x-axis synced to spectrogram

```js
// Tile → BitmapDataLayer registration pattern
audioCtrl.on('tileReady', ({ tileIndex, power, width, height, bounds }) => {
  tiles.set(tileIndex, { power, width, height, bounds, dataTrigger: (tiles.get(tileIndex)?.dataTrigger ?? -1) + 1 });
  specCtrl.registerDataLayer(`tile-${tileIndex}`, () => {
    const tile = tiles.get(tileIndex);
    return new BitmapDataLayer({
      source: tile.power, bitMapping: { bounds: tile.bounds },
      width: tile.width, height: tile.height,
      channels: 'gray', dtype: 'float32',
      lutController: lutCtrl,
      dataTrigger: tile.dataTrigger, colorTrigger: colorTrigger,
    });
  });
  specCtrl.markDirty();
});

// LUT level change → recolorize all tiles
lutCtrl.on('levelChanged', () => { colorTrigger++; specCtrl.markDirty(); });
```

---

#### Bitmap Layers Example (EX16)

Live demo at `bitmap.html` — three panels showing `BitmapDataLayer` without audio:

| Panel | Source type | Notes |
|-------|-------------|-------|
| 1 — Local Image | `ImageBitmap` via `createImageBitmap(file)` | User picks a local file; configurable `bitMapping` origin/size controls in sidebar |
| 2 — Generated Heatmap | `Float32Array` (256×256 sum-of-Gaussians) | `channels: 'gray'`, `dtype: 'float32'`; full `LUTPanel` sidebar with draggable level handles |
| 3 — URL Image | URL string (NASA Blue Marble tile) | `bitMapping.bounds: [-180,-90,180,90]`; axes show longitude/latitude |

```js
// Panel 2 — generated Float32 heatmap with LUTController
const heatmap = generateGaussianHeatmap(256, 256);   // Float32Array
const lutCtrl = new LUTController(256);
const lutHistCtrl = new LUTHistogramController({ lutController: lutCtrl });
lutCtrl.setData(heatmap, 0, 1);    // sets up histogram + auto-levels

lutCtrl.on('levelChanged', () => { colorTrigger++; ctrl.markDirty(); });
lutCtrl.on('lutChanged',   () => { colorTrigger++; ctrl.markDirty(); });

ctrl.registerDataLayer('heatmap', () =>
  new BitmapDataLayer({
    source: heatmap,
    bitMapping: { bounds: [0, 0, 256, 256] },
    channels: 'gray', dtype: 'float32',
    width: 256, height: 256,
    lutController: lutCtrl,
    colorTrigger,
  })
);
```

---

## TraceGroup (F22)

`TraceGroup` is a generic multi-trace data layer that partitions bulk point data by a string tag into per-tag `Float32Array` buffers, and plugs into `PlotController` via `registerDataLayer`.

### Constructor

```js
import { TraceGroup } from './src/plot/layers/TraceGroup.js';

const tg = new TraceGroup({
  palette:      [[255,100,100,255], [100,255,100,255], /* … */],  // required
  buildLayer:   (traceId, traceData, attrs, ctx) => new ScatterplotLayer({ … }), // required
  traceAttrs:   { 'sensor_0': { color: [255,0,0,255] } },   // optional per-tag overrides
  defaultAttrs: { opacity: 0.85, size: 3 },                 // optional global defaults
});
```

### Public API

| Method | Description |
|---|---|
| `appendData({ x, y, tag, size? })` | Bulk append; partitions by `tag` array into per-trace typed arrays in one O(n) pass. Resizes buffers (doubling) as needed. Bumps `version` for each modified trace. |
| `setTraceVisible(tag, bool)` | Show/hide a trace. Hidden traces are excluded from the next `build()` call. |
| `getTraceVisible(tag)` | Returns current visibility bool. |
| `setTraceAttr(tag, attrs)` | Merge per-tag attr overrides post-construction. |
| `setPalette(palette)` | Replace palette array (does not remap existing tags). |
| `getAllTags()` | Returns tags in insertion order. |
| `getTrace(tag)` | Returns raw `TraceEntry` (for advanced use). |
| `resolveAttrs(tag)` | Returns resolved attrs (palette + overrides + defaults merged). |
| `toLayerDef()` | Returns `{ id: 'trace-group', build: (ctx) => Layer[] \| null }` for `PlotController.registerDataLayer`. |

### Attribute resolution priority (highest wins)

1. Per-tag `traceAttrs[tag]` field
2. Palette color: `palette[insertionIndex % palette.length]`
3. `defaultAttrs` field
4. Library defaults: `{ opacity: 1.0, size: 4.0, color: [255,255,255,255] }`

Opacity is **not** baked into palette alpha — resolved separately so callers apply it via deck.gl's `opacity` prop.

### Usage with PlotController

```js
const ctrl = new PlotController({
  xDomain: [0, 1000], yDomain: [0, 100],
  panMode: 'drag',
  disableDefaultDataLayer: true,
});

const tg = new TraceGroup({
  palette: PALETTE_25,
  defaultAttrs: { opacity: 0.85, size: 3 },
  buildLayer: (traceId, traceData, attrs, ctx) => {
    const { x, y, count } = traceData;
    return new ScatterplotLayer({
      id:          traceId,
      data:        { length: count },
      getPosition: (_, { index }) => [
        ctx.xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
        ctx.yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index],
        0,
      ],
      getRadius:   attrs.size * 0.5,
      getColor:    attrs.color,
      opacity:     attrs.opacity,
      radiusUnits: 'pixels',
      pickable:    false,
      updateTriggers: { getPosition: traceData.version },
    });
  },
});

tg.appendData({ x: allX, y: allY, tag: allTags });
ctrl.registerDataLayer('traces', tg.toLayerDef().build);
```

### TraceEntry structure

```js
{
  x:              Float32Array,   // x coordinates
  y:              Float32Array,   // y coordinates
  size:           Float32Array,   // size per point (allocated, but only used if passed in appendData)
  count:          number,         // live point count
  capacity:       number,         // buffer allocation (doubles on overflow)
  version:        number,         // bumped on appendData; drives deck.gl updateTriggers
  visible:        boolean,        // default true; false excludes from build()
  insertionIndex: number,         // stable index for palette cycling (order first seen)
}
```

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

Audio subsystem (SpectrogramV2 example):
├── AudioController       — unified load/playback/STFT; emits tileReady per fixed-width tile
├── PlaybackController    — Web Audio API playback with seek (EventEmitter; kept for compat)
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
| `V` | Enter vertical LineROI creation mode (one click places the line) |
| `H` | Enter horizontal LineROI creation mode (one click places the line) |
| `D` | Delete the currently selected ROI |
| `Esc` | Cancel creation mode |
| `scroll` | Zoom (centered on cursor) |
| `drag` | Pan |
| `Ctrl+click` | Seek playhead (spectrogram example) |

---

## Performance Profile

Tested with:
- **10k default / up to 10M via dropdown (EX4)** — no stutter; `dataStore.clear()` + reload without buffer re-allocation
- **+10k points appended every 2 seconds** — smooth, no GC spikes
- **Zoom/pan** — domain-only update, no buffer re-upload
- **ROI picking** — O(n_rois) not O(n_points)
- **500k points (50 sensors × 10k)** — via `TraceGroup` with per-trace visibility toggling

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
src/                              ← library code only
  plot/
    PlotController.js             — central controller + render loop
    DataStore.js                  — GPU typed array buffers
    PlotDataView.js               — lazy derived view (filter / histogram / snapshot)
    ViewportController.js         — coordinate transforms
    LUTHistogramController.js     — internal PlotController histogram viewer for LUTPanel (F28b)
    ROI/
      ROIBase.js                  — abstract base class
      RectROI.js                  — draggable/resizable rectangle
      LinearRegion.js             — vertical strip
      LineROI.js                  — single-pixel line (6 modes, optional label)
      ROIController.js            — interaction handler
      ConstraintEngine.js         — parent-child constraint enforcement
    layers/
      ScatterLayer.js             — deck.gl scatter (instanced)
      LineLayer.js                — deck.gl polylines
      ROILayer.js                 — deck.gl composite ROI renderer
      BitmapDataLayer.js          — generic bitmap layer; URL/ImageBitmap/TypedArray (F27)
      _buildBitmapFromGrid.js     — CPU colorizer for typed-array grids (F27)
      LUTController.js            — colormap + level + histogram controller (F28a)
      SignalDataLayer.js          — SignalStore + buildSignalLayers for line plots (ARCH-D)
      TraceGroup.js               — multi-trace scatter partitioner with palette cycling (F22)
      PlotLayer.js                — optional CompositeLayer wrapper (ARCH-B)
    axes/
      AxisController.js           — d3-scale wrapper
      AxisRenderer.js             — canvas 2D ticks + labels
  audio/
    PlaybackController.js         — Web Audio API playback + seek
    FilterController.js           — offline biquad DSP + frequency response
  components/
    PlotCanvas.jsx                — React wrapper (canvas + controller lifecycle)
  integration/
    ExternalDataAdapter.js        — interface contract for external data sources (F18)
    ExternalROIAdapter.js         — interface contract for ROI persistence/sync (F18)
    MockDataAdapter.js            — random data generator mock (F18)
    MockROIAdapter.js             — localStorage-backed ROI persistence mock (F18)
ui/                               ← optional React UI extensions (not library code)
  LUTPanel.jsx                    — histogram + LUT gradient + colormap dropdown + Auto Level (F29)
  FilterPanel.jsx                 — filter type, cutoff, Q controls + response curve
examples/                         ← example page components
  src/                            ← webpack entry JS files (one per HTML page)
  HubPage.jsx                     — demo navigation hub
  ExampleApp.jsx                  — scatter/ROI/live-append + point-count dropdown + ROI tables (EX1/EX4)
  LiveSignalsExample.jsx          — three live signals + rolling window + ROI stats sidebar (EX8)
  MultiSensorExample.jsx          — 50 sensors × 10k pts via TraceGroup; visibility sidebar (EX7)
  SpectrogramV2Example.jsx        — Phase 4 spectrogram: AudioController + BitmapDataLayer + LUTPanel (EX-Spec)
  SharedDataExample.jsx           — two-plot shared DataStore + filtered DataView demo (F17)
  SeismographyExample.jsx         — 10 stacked channels, shared X-axis, vline picks + table (EX5)
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

---

## Popup Window Infrastructure (ARCH-E)

MasterPlot supports detached panel windows that stay bidirectionally in sync with the main plot via the browser's native `BroadcastChannel` API. All messages use the shared envelope:

```js
{ type: 'TYPE_NAME', payload: { ...data } }
```

Unknown `type` values are silently ignored on both sides for forward-compatibility.

### PopupWindowManager

Plain `EventEmitter` class — no React dependency.

```js
import { PopupWindowManager } from './src/popup/PopupWindowManager.js';

const manager = new PopupWindowManager();
manager.on('message', (msg) => console.log('from popup:', msg));
manager.on('closed',  ()    => console.log('popup closed'));

// Open popup and establish a BroadcastChannel
const opened = manager.open(
  'spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter',
  'spectrogram-v2-filter',
  'width=520,height=640'  // optional window.open features
);
if (!opened) {
  // popup was blocked — inform the user
}

// Send a message to the popup
manager.send({ type: 'FILTER_STATE', payload: { filterType: 'lowpass', cutoff: 1000 } });

// Programmatically close (also clean up via manager.destroy())
manager.close();
```

| Method / Property | Description |
|---|---|
| `open(url, channelName, windowFeatures?)` | Opens popup; returns `false` (+ console warning) if blocked |
| `send({ type, payload })` | Posts message to popup via BroadcastChannel |
| `close()` | Closes popup window and BroadcastChannel; emits `'closed'` |
| `destroy()` | `close()` + `removeAllListeners()` — call on unmount if not using the hook |
| `isOpen` | `true` while popup window is open |
| Event `'message'` | Fired for each incoming message from popup |
| Event `'closed'` | Fired when popup is closed (user or programmatic) |

### usePopupChannel (React hook)

```jsx
import { usePopupChannel } from './src/popup/usePopupChannel.js';

function MyComponent() {
  const { open, send, close, isOpen } = usePopupChannel(
    'spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter',
    'spectrogram-v2-filter',
    (msg) => {
      if (msg.type === 'FILTER_APPLY') handleApply(msg.payload);
    }
  );

  return (
    <button onClick={open} disabled={isOpen}>
      {isOpen ? 'Filter Panel Open' : 'Open Filter Panel'}
    </button>
  );
}
```

The hook creates `PopupWindowManager` on mount, tears it down on unmount, and keeps `onMessage` stable via a ref. The popup is not opened automatically — call `open()` from a user gesture.

### Popup page host (spectrogram-popup.html)

The `spectrogram-popup.html` entry serves as the host shell for SpectrogramV2 popup panels. It reads URL params to route to the correct panel and connect to the right channel:

```
spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter  → Filter Panel (F24) ✅
spectrogram-popup.html?panel=labels&channel=spectrogram-v2-labels  → ROI Label panel (EX11) ✅
```

Popup detection (`window.opener !== null` or `?panel=` present) suppresses main-page chrome so the popup renders only the requested panel.

### Filter Panel popup (F24)

The **Filter Panel** lives in a connected popup window launched from the Spectrogram example's waveform sidebar. Single source of truth: `FilterController` state lives in the main window; the popup holds only a mirror.

| Message | Direction | Payload |
|---------|-----------|---------|
| `FILTER_STATE` | Main → Popup | `{ filterType, cutoff, q, lowFreq, highFreq, applied, sampleRate }` |
| `FILTER_STATE` | Popup → Main | same (on slider/dropdown change) |
| `FILTER_APPLY` | Popup → Main | `{}` — main executes DSP, echoes back `FILTER_STATE` |
| `FILTER_CLEAR` | Popup → Main | `{}` — main restores original PCM, echoes back `FILTER_STATE` |

**Anti-loop design:** When main receives `FILTER_STATE` from popup it mutates `fc.state` fields directly (no emit → no re-echo). When popup receives `FILTER_STATE` from main it sets `suppressRef.current = true` before emitting `'changed'` to the local `FilterController`, blocking the outbound `FILTER_STATE` during that update.

### ROI Label Panel popup (EX11)

The **ROI Label Panel** (launched from the spectrogram header's "Open Label Panel" button) lists all `RectROI`s drawn on the spectrogram. It is driven entirely by messages from the main window and holds no independent ROI state.

Draw ROIs on the spectrogram with the **Draw ROI** button or the **R** key (two clicks: top-left then bottom-right). Delete selected ROI with **D**.

| Message | Direction | Payload |
|---------|-----------|---------|
| `ROIS_CHANGED` | Main → Popup | `serializedROIs[]` — full snapshot after any ROI change |
| `AUTO_SELECT` | Main → Popup | `{ id }` — highlight + scroll row after creation/canvas-click |
| `SELECT_ROI` | Popup → Main | `{ id }` — select ROI on plot (+ zoom if toggle enabled) |
| `SET_LABEL` | Popup → Main | `{ id, label }` — update `roi.metadata.label` |
| `DELETE_ROI` | Popup → Main | `{ id }` — remove ROI |
| `ZOOM_TOGGLE` | Popup → Main | `{ enabled: bool }` — enable/disable zoom-to-selected on SELECT_ROI |

Each row shows time bounds (`x1 s – x2 s`), frequency bounds (`y1 – y2 Hz`), a label dropdown (`plane` / `bird` / `siren` / none), and a delete button. Clicking a row selects the ROI on the spectrogram; with "Zoom to selected" checked it also pans/zooms the x- and y-axes to the ROI bounds.

### Future: BackendAdapter (transport swap)

`src/integration/BackendAdapter.js` is a documented stub describing how the same `{ type, payload }` message envelope allows the identical popup UI to be driven by a remote WebSocket server instead of a local `BroadcastChannel` — with only a thin transport-layer swap. See the file for the full contract shape and rolling-buffer integration notes.

---

## Documentation Site (DOC1–DOC5)

A live documentation SPA is served at [`docs.html`](https://madalex1997.github.io/MasterPlot/docs.html) alongside the demos. It contains five pages navigable from a sticky left sidebar:

| Page | Contents |
|------|----------|
| **Architecture** | PlotController orchestration diagram, render loop sequence, event bus graph, coordinate systems table, GPU data-flow code |
| **Getting Started** | 7-step tutorial: install, mount, live append, zoom/pan, LinearRegion ROI, events, shared DataStore |
| **API Reference** | Full constructor options, methods, and events for all 8 public classes (PlotController, AxisController, ROIController, DataStore, PlotDataView, TraceGroup, SignalStore, FilterController) |
| **ROI Deep-Dive** | Class hierarchy diagram, creation modes table, LineROI modes, ConstraintEngine drag + mouseup sequence, versioning rules, serialization round-trip code |
| **PlotController Deep-Dive** | Initialization pipeline, two-canvas model, dirty-flag render loop, layer registry internals, three zoom interaction modes (wheel / right-click drag / axis drag) with restore-and-reapply pattern, coordinate space table + Y-axis inversion, appendData-to-GPU flowchart, ownership model, full events reference |
