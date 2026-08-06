# MasterPlot

**[Live Demo →](https://madalex1997.github.io/MasterPlot/)** &nbsp;|&nbsp; **[Documentation →](https://madalex1997.github.io/MasterPlot/docs.html)**

A high-performance scientific plotting engine built on React, deck.gl (WebGL), and d3-scale.
Designed for real-time data, large datasets (tested to 10M+ points), and audio/signal analysis workflows.

---

## Stability

MasterPlot is versioned with [semver](https://semver.org/), starting at `1.0.0` — the first
published release. Pre-1.0 development had no compatibility guarantees; from `1.0.0` onward,
a breaking change to any public API requires a major version bump.

| Surface | Package entry point | Stability |
|---|---|---|
| **Core engine** (`src/`) | `masterplot` | Semver-stable. `PlotController`, `ViewportController`, `DataStore`, `PlotDataView`, the ROI system, layers, and `AudioController` are the supported public API. |
| **UI extensions** (`ui/`) | `masterplot/ui` | Convenience wrappers (`LUTPanel`, `FilterPanel`, `HelpOverlay`) over core-engine events. May iterate faster than the core engine; each is designed to be easy to replace with your own component if its API doesn't fit. |
| **Data loaders** (`loaders/`) | `masterplot/loaders` | Convenience adapters over third-party parsers (`@loaders.gl/*`). Tracks upstream format-library churn and may move faster than the core engine. |

See [CHANGELOG.md](CHANGELOG.md) for the version history.

---

## Features

### Core Engine
- **WebGL rendering** via deck.gl `OrthographicView` — no maps, no geospatial assumptions
- **Scatter plots** with instanced rendering (`ScatterLayer`) — GPU typed-array buffers, no per-point JS objects
- **Line plots** (`LineLayer`) and **signal line plots** (`SignalStore`) for waveform/time-series data with rolling-window trim support
- Arbitrary custom layers via a pluggable layer registry
- **Pluggable layer registry** — `PlotController.registerDataLayer(id, buildFn)` replaces the default scatter layer with any deck.gl layer; `unregisterDataLayer` and `updateDataLayerProps` for runtime management; `disableDefaultDataLayer` constructor option to start empty
- **Linear, log, and time axes** via d3-scale; canvas 2D overlay for tick labels and grid
- **Multi-granularity time tick formatting** — `scaleType: 'time'` axes use d3-scale's built-in default formatter, auto-switching label granularity (year → month → day → hour → minute → second → millisecond) as you zoom
- **High-precision epoch-offset time axis** — `timeOrigin` / `timeOriginUnits` constructor options work around `DataStore`'s `Float32Array` x-buffer precision limit (~7 significant digits, too coarse for absolute epoch-seconds timestamps with microsecond precision) by keeping small offsets in the buffer and reconstructing absolute time for tick labels from a double-precision reference; `dataXToEpochSeconds()` / `epochSecondsToDataX()` / `dataXToDate()` conversion helpers
- **Axis positioning modes** — axes can sit at fixed canvas edges (border mode) or float at a data coordinate with optional edge-snapping (relative mode); axes can be mirrored (ticks on both sides)
- **Bordered plot mode** — fills axis gutter areas with the container's CSS background color, useful for dark-background layouts
- **Wheel zoom** (cursor-centered), **drag pan**, and **right-click drag zoom**
- **Axis drag zoom** — drag directly on a tick-label gutter to zoom that axis independently from its midpoint
- **Rect zoom mode** — opt-in; drag draws a rectangle corner-to-corner, zooms the viewport to its exact data bounds on release
- **Configurable mouse buttons** — remap which mouse button drives pan, right-drag zoom, or rect zoom via `mouseButtons` / `setMouseButtons()`
- **Auto-scale** — spacebar fits both axes to full data extent; `setHomeDomain()` registers explicit reset bounds

### ROI System
- **LinearRegion** — vertical strip defined by x1/x2; created with `L` key + two clicks
- **RectROI** — draggable/resizable rectangle; created with `R` key + two clicks; can be parented to a LinearRegion
- **LineROI** — single-pixel vertical or horizontal line in six modes (`vline`, `hline`, and four half-line variants); optional label; auto-parented when created inside a LinearRegion
- **ConstraintEngine** — enforces parent-child bounds automatically: children shift when parent moves, are clamped to parent bounds, and constraints recurse through arbitrarily deep hierarchies
- **ROI versioning** — every ROI carries a monotonic `version` counter, `updatedAt` timestamp, and a JSON-safe `domain` snapshot; version is bumped on mouseup; only emitted when bounds actually changed
- **Serialization API** — `serializeAll()` / `deserializeAll()` / `updateFromExternal()` for persistence and multi-client sync

### Data Pipeline
- **DataStore** — GPU typed-array buffers (`Float32Array` for x/y/size; `Uint8Array` for RGBA); grows 1.5× on capacity overflow; no full reallocation; deck.gl reads live `subarray` views
- **Rolling ring buffer** — optional fixed-capacity circular buffer with count-based and age-based expiration; axis domain recalculates automatically after eviction
- **PlotDataView** — lazily-evaluated, dirty-flag-cached derived view over a `DataStore` or another `PlotDataView`; supports domain filtering, ROI filtering, histogram derivation, and deep snapshot; dirty cascades through arbitrarily deep view chains
- **Shared data** — multiple `PlotController` instances can share a single `DataStore` and/or `PlotDataView`; ownership tracking ensures `destroy()` only releases resources the controller allocated
- **External adapter contracts** — `ExternalDataAdapter` and `ExternalROIAdapter` define the engine boundary for HTTP, WebSocket, or any other data source; mock implementations included

### Bitmap & Image Layers
- **BitmapDataLayer** — renders any 2D image (URL, `ImageBitmap`, or typed-array grid) at an arbitrary data-space rectangle; suitable for heatmaps, spectrograms, and tile overlays
- **BitmapViewGenerator** — viewport-aware controller that re-generates or re-fetches a `BitmapDataLayer` on every domain change; debounced; supports a local `generate` callback or a remote `fetch` callback with `AbortSignal` cancellation

### LUT System
- **LUTController** — colormap + contrast-window controller with histogram; presets: `viridis`, `grayscale`, `plasma`, `inferno`, `magma`, `hot`; `autoLevel(loPct, hiPct)` clips to percentiles
- **LUTHistogramController** — internal `PlotController` configured as a read-only histogram viewer; level handles are draggable `hline` LineROIs
- **LUTPanel** — React convenience component combining histogram, LUT gradient strip, colormap dropdown, and Auto Level button (lives in `ui/`, not library code)

### Audio & Signal Analysis
- **AudioController** — unified load/playback/STFT controller; stateless `setFilterFn` bridge for offline DSP; tiled STFT with per-tile `tileReady` events
- **FilterController** — offline biquad DSP via `OfflineAudioContext`; lowpass/highpass/bandpass/notch; higher-order Butterworth via cascaded sections
- **PlaybackController** — Web Audio API playback with seek; 60 fps playhead

### Data Loaders
- **TableLoaderAdapter** — loads CSV, TSV, or Apache Arrow into a `DataStore`; streaming; configurable column mapping
- **RasterLoaderAdapter** — loads NetCDF3 or images and registers a `BitmapDataLayer` with bounds inferred from coordinate arrays

### Utilities
- **TraceGroup** — partitions bulk point data by string tag into per-tag `Float32Array` buffers; palette cycling; per-trace visibility toggling; plugs into `registerDataLayer`
- **Popup infrastructure** — `PopupWindowManager` and `usePopupChannel` React hook for detached panel windows synced via `BroadcastChannel`

---

## Examples

| Demo | URL | What it shows |
|------|-----|---------------|
| Scatter / ROI | `index.html` | 10k–10M scatter points via dropdown; LinearRegion + RectROI + LineROI; live append; ROI inspection tables |
| Live Signals | `live-signals.html` | Three live sin/cos signals; rolling 10/30/60 s window; ROI stats sidebar |
| Seismography | `seismography.html` | 50 stacked channels; shared X-axis sync; vline P-wave picks with editable table |
| Multi-Sensor | `multi-sensor.html` | 50 sensors × 10k pts via TraceGroup; visibility sidebar; 25-color palette |
| Shared Data | `shared-data.html` | Two plots sharing one DataStore and a filtered DataView |
| Spectrogram V2 | `spectrogram-v2.html` | AudioController + BitmapDataLayer tiles + LUTPanel + FilterPanel popup |
| Bitmap Layers | `bitmap.html` | BitmapDataLayer with local file, generated heatmap, and URL source |
| Bitmap LOD | `bitmap-lod.html` | BitmapViewGenerator: bilinear resample (local) and HiPS2FITS fetch (remote) |
| Data Loaders | `data-loaders.html` | TableLoaderAdapter (CSV/Arrow) and RasterLoaderAdapter (NetCDF/image) |
| Axis Showcase | `axis-showcase.html` | 2×3 grid covering all axis positioning and border-mode combinations |
| Time Axis Showcase | `time-axis-showcase.html` | A real `scaleType:'time'` axis showing multi-granularity tick switching, plus a `timeOrigin` epoch-offset axis over a synthetic 200 kHz waveform showing microsecond-precision labels |

---

## Architecture Overview

MasterPlot is **controller-driven**, not React-state-driven. React only manages DOM layout and UI chrome. All rendering, zoom, pan, ROI interaction, and audio processing run outside React's reconciler.

```
PlotController (EventEmitter)
├── DataStore             — GPU typed-array buffers (x/y/color/size)
│   └── PlotDataView      — lazy derived view (filter, histogram, snapshot)
├── ViewportController    — canvas dimensions + screen↔data transforms + domain state
├── AxisController (x)    — config-only: scale type, tick format, label, positioning mode
├── AxisController (y)
├── ROIController         — creation, drag, resize, delete
│   ├── ConstraintEngine  — parent-child bound enforcement
│   ├── LinearRegion      — vertical strip, contains RectROIs / LineROIs
│   ├── RectROI           — draggable/resizable rectangle
│   └── LineROI           — single vertical or horizontal line (6 modes, optional label)
└── deck.gl Deck          — WebGL render target (OrthographicView)

AxisRenderer              — Canvas 2D overlay (ticks, labels, grid)

Integration layer (optional):
├── ExternalDataAdapter   — interface contract for data sources (HTTP, WS, etc.)
├── ExternalROIAdapter    — interface contract for ROI persistence and sync
├── MockDataAdapter       — random batch generator
└── MockROIAdapter        — localStorage-backed ROI store

Audio subsystem:
├── AudioController       — unified load/playback/STFT; emits tileReady per tile
├── PlaybackController    — Web Audio API playback with seek (kept for compat)
└── FilterController      — offline biquad DSP + frequency response
```

## Data Flow

```
appendData(chunk)
    → DataStore (buffer update, no reallocation if capacity ok)
    → dataTrigger++ (tells deck.gl to re-fetch accessors)
    → PlotController.emit('dataAppended')

wheel event
    → PlotController._onWheel
    → ViewportController.zoomAround(focalX, focalY, factor)
    → ViewportController.emit('domainChanged')
    → PlotController re-emits 'domainChanged' → _dirty = true
    → deck.gl viewState rebuilt on next rAF

rAF loop
    → _render()
    → buildScatterLayer(gpuAttrs)  [no data copy — live typed-array views]
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
| `domainChanged` | `{ xDomain, yDomain }` | Axis domain changed (zoom/pan/auto-expand) |
| `zoomChanged` | `{ factor, focalDataX?, focalDataY?, axis? }` | Zoom event |
| `panChanged` | `{ dx, dy }` | Pan delta in screen pixels |
| `autoScaled` | `{ xDomain, yDomain }` | After `autoScale()` completes |
| `roiCreated` | `{ roi, type }` | ROI was created |
| `roiUpdated` | `{ roi, bounds }` | ROI was moved or resized (drag; fires many times) |
| `roiFinalized` | `{ roi, bounds, version, updatedAt, domain }` | ROI drag committed on mouseup; `version` already incremented |
| `roiDeleted` | `{ id }` | ROI was deleted |
| `roiExternalUpdate` | `{ roi, version }` | External update accepted via `updateFromExternal()` |

```js
plotController.on('dataAppended', ({ count, total }) => {
  console.log(`+${count} pts, total: ${total}`);
});
```

---

## PlotController

Central controller. Extends `EventEmitter`. Owns the render loop, deck.gl instance, and all sub-controllers.

### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `xScaleType` | `'linear'\|'log'\|'time'` | `'linear'` | d3 scale type for the X axis |
| `yScaleType` | `'linear'\|'log'\|'time'` | `'linear'` | d3 scale type for the Y axis |
| `xDomain` | `number[]` | `[0, 1]` | Initial X domain `[min, max]` |
| `yDomain` | `number[]` | `[0, 100]` | Initial Y domain `[min, max]` |
| `xLabel` | `string` | `''` | Label text painted beside the X axis |
| `yLabel` | `string` | `''` | Label text painted beside the Y axis |
| `xAxis` | `AxisController` | (auto) | Config-only x-axis descriptor (scale type, tick format, label, positioning mode) |
| `yAxis` | `AxisController` | (auto) | Config-only y-axis descriptor |
| `timeOrigin` | `Date\|number` | (none) | F40: reference epoch (Date or epoch-ms). Activates epoch-offset high-precision time mode for the x-axis. See [High-Precision Time Axis](#high-precision-time-axis-f40) below. |
| `timeOriginUnits` | `'seconds'\|'ms'` | `'seconds'` | F40: unit convention for x-domain offsets relative to `timeOrigin` |
| `panMode` | `'follow'\|'drag'` | `'drag'` | Initial pan mode |
| `mouseButtons` | `object` | `{ left: 'pan', middle: 'none', right: 'zoomDrag' }` | Button→action map (F38). Values: `'pan'`, `'zoomDrag'` (F6), `'rectZoom'` (F37, opt-in), `'none'` |
| `keyBindings` | `object` | see [Configurable Keybindings](#configurable-keybindings-f41) | F41: action→key map covering ROI creation + zoom/pan; `null` per-action to disable |
| `scalePresets` | `object[]` | `[]` | F41: opt-in fixed-view-jump keybinds; see [Scale Presets](#scale-presets-f41) |
| `bordered` | `boolean` | `true` | Fill axis gutter areas with the container element's CSS `backgroundColor` before rendering ticks |
| `autoExpand` | `boolean` | `true` | Expand domain automatically when new data exceeds current bounds |
| `autoScaleKey` | `string\|null` | `' '` | **Deprecated** — use `keyBindings.autoScale` instead. Keyboard key that triggers `autoScale()`; `null` to disable. Kept as a warn-once alias. |
| `disableDefaultDataLayer` | `boolean` | `false` | Omit the built-in scatter layer; register custom layers via `registerDataLayer()` instead |
| `disablePanZoom` | `boolean` | `false` | Disable wheel zoom and mouse-drag pan/zoom. ROI hit-testing still works. Used by `LUTHistogramController`. |
| `dataStore` | `DataStore` | (auto) | External DataStore; ownership NOT transferred — `destroy()` will not destroy it |
| `dataView` | `PlotDataView` | `null` | External PlotDataView used as the GPU data source; bypasses DataStore when set |

### Methods

| Method | Returns | Description |
|---|---|---|
| `init(webglCanvas, axisCanvas)` | `void` | Initialize deck.gl, AxisRenderer, ROIController, event listeners, and start the RAF loop. Must be called once both canvases are in the DOM. |
| `destroy()` | `void` | Remove all DOM and window listeners, cancel the RAF loop, and finalize deck.gl. Destroys owned DataStore/DataView; leaves externally-injected ones alive. |
| `appendData(chunk)` | `void` | Append `{ x, y, size?, color?, metadata? }` typed arrays to DataStore. Expands domain if `autoExpand` is on. Emits `'dataAppended'`. |
| `setAutoExpand(enabled)` | `void` | Toggle whether `appendData()` widens the visible domain to encompass new data. |
| `setPanMode(mode)` | `void` | Switch between `'follow'` (velocity-based) and `'drag'` (cursor-locked) pan modes. |
| `setMouseButtons(cfg)` | `void` | Remap button→action bindings (F38) at runtime. Partial override of `{ left, middle, right }`; cancels any in-progress drag. Unrecognized action names fall back to the default with a console warning. |
| `setFollowPanSpeed(speed)` | `void` | Set follow-pan velocity scalar. Recommended range 0.005–0.1. |
| `autoScale()` | `void` | Fit both axes to full data extents (±5 % padding) or to the registered home domain. Emits `'autoScaled'`. |
| `setHomeDomain(xDomain, yDomain)` | `void` | Register explicit home bounds used by `autoScale()`. Either argument may be `null` to fall back to data extents. |
| `setZoom(factor, focalScreenX, focalScreenY)` | `void` | Zoom both axes around a screen-space focal point. factor > 1 = zoom in. Emits `'zoomChanged'`. |
| `setDataView(dataView, owns?)` | `void` | Swap the active PlotDataView at runtime. Pass `owns=false` when sharing a view across controllers. |
| `registerDataLayer(id, buildFn, props?)` | `void` | Register or replace a data-layer factory. `buildFn` receives a `RenderContext` and must return a Layer, Layer[], or null. |
| `unregisterDataLayer(id)` | `void` | Remove a registered layer by id. No-op if not found. |
| `updateDataLayerProps(id, props)` | `void` | Merge static props forwarded into the RenderContext for an already-registered layer. |
| `markDirty()` | `void` | Schedule a re-render on the next RAF tick. Call when external state changes outside the DataStore/ROI event chain. |
| `dataXToEpochSeconds(x)` | `number` | F40: convert a data-x offset to absolute epoch seconds (double precision). Throws if `timeOrigin` was not set. |
| `epochSecondsToDataX(epochSeconds)` | `number` | F40: inverse of `dataXToEpochSeconds()` — convert an absolute timestamp to the small offset to write into `DataStore`/ROI positions. |
| `dataXToDate(x)` | `Date` | F40: convenience, millisecond precision only — prefer `dataXToEpochSeconds()` for full-precision display. |
| `setKeyBindings(patch)` | `void` | F41: remap ROI-creation and/or zoom/pan keybinds at runtime. Partial override, merged over the defaults; forwards the ROI-relevant slice to `ROIController`. |
| `setScalePresets(presets)` | `void` | F41: replace the scale-presets array entirely (not a merge, unlike `setKeyBindings`/`setMouseButtons`). |

### Getters

| Getter | Returns | Description |
|---|---|---|
| `dataStore` | `DataStore` | The owned or injected DataStore. |
| `xAxis` | `AxisController` | Config-only x-axis descriptor. |
| `yAxis` | `AxisController` | Config-only y-axis descriptor. |
| `viewport` | `ViewportController` | Domain owner — use `viewport.setXDomain()` etc. for all domain mutations. |
| `roiController` | `ROIController` | The ROI system controller. |

---

## ViewportController

Owns canvas dimensions, coordinate transforms (screen ↔ data), and all domain state. Accessed via `ctrl.viewport`. Extends `EventEmitter`.

### Domain Methods

| Method | Returns | Description |
|---|---|---|
| `setXDomain([min, max])` | `void` | Set x-axis domain; rebuilds scales; emits `'domainChanged'`. |
| `setYDomain([min, max])` | `void` | Set y-axis domain; rebuilds scales; emits `'domainChanged'`. |
| `setDomains(xDomain, yDomain)` | `void` | Set both domains atomically — one scale rebuild, one event. Pass `null` to skip an axis. |
| `getXDomain()` | `number[]` | Returns copy of current x domain `[min, max]`. |
| `getYDomain()` | `number[]` | Returns copy of current y domain `[min, max]`. |
| `zoomAroundX(dataCenter, factor)` | `void` | Zoom x domain around a focal data coordinate. factor > 1 = zoom in. Handles log-space. |
| `zoomAroundY(dataCenter, factor)` | `void` | Zoom y domain around a focal data coordinate. |
| `zoomAround(focalX, focalY, factor)` | `void` | Zoom both axes simultaneously — one event emitted. |
| `panByPixels({ dx?, dy? })` | `void` | Pan x/y domain by pixel deltas. Y-axis range inversion is handled internally. |
| `scaleDomainFromMidpointX(factor)` | `void` | Scale x domain from its midpoint (used by axis-drag zoom). |
| `scaleDomainFromMidpointY(factor)` | `void` | Scale y domain from its midpoint. |

**Multi-plot x-domain sync pattern:**

```js
const syncingRef = { current: false };
ctrl.on('domainChanged', ({ xDomain }) => {
  if (syncingRef.current || !xDomain) return;
  syncingRef.current = true;
  otherCtrls.forEach(o => o.viewport.setXDomain(xDomain));
  syncingRef.current = false;
});
```

---

## AxisController

Config-only axis descriptor. Holds scale type, tick formatting, label, and positioning options. No domain state — domain is owned by `ViewportController`. Can be shared across multiple `PlotController` instances so they use the same tick rules while maintaining independent domains.

```js
import { AxisController } from './src/plot/axes/AxisController.js';

// Share one config across two plots with different domains
const xAxis = new AxisController({ scaleType: 'log', tickCount: 8 });
const plot1 = new PlotController({ xAxis, xDomain: [1, 1000] });
const plot2 = new PlotController({ xAxis, xDomain: [1, 100] });
```

### Constructor Options

| Option | Type | Default | Description |
|---|---|---|---|
| `scaleType` | `'linear'\|'log'\|'time'` | `'linear'` | d3 scale type |
| `tickCount` | `number` | `5` | Approximate target tick count |
| `label` | `string\|null` | `null` | Axis label text |
| `tickFormat` | `fn\|null` | `null` | Custom formatter `(value, index) => string`; defaults to SI/fixed auto-formatter |
| `mode` | `'border'\|'relative'` | `'border'` | `'border'` — axis at fixed canvas edges. `'relative'` — axis floats at a data coordinate. |
| `edges` | `string[]\|null` | `null` | Border mode only. Which edges to draw on, e.g. `['bottom','top']` for mirrored axes. `null` = renderer default. |
| `crossingValue` | `number` | `0` | Relative mode only. Data coordinate where the axis line sits. |
| `snapTolerancePx` | `number` | `0` | Relative mode only. Snap to nearest edge when within this many pixels. `0` = stationary. |
| `offscreen` | `'border'\|'hide'` | `'border'` | Relative mode only. What to do when `crossingValue` is outside the visible domain. |
| `labelSide` | `'auto'\|'positive'\|'negative'` | `'auto'` | Relative mode only. Which side of the axis line to draw labels. `'auto'` flips at the viewport midpoint. |

### Axis Positioning Examples

```js
// Mirrored border axes (ticks on both sides):
new AxisController({ mode: 'border', edges: ['bottom', 'top'] })   // x-axis
new AxisController({ mode: 'border', edges: ['left', 'right'] })   // y-axis

// Axis crosses at zero, stationary:
new AxisController({ mode: 'relative', crossingValue: 0, snapTolerancePx: 0 })

// Mobile axis that snaps to the nearest edge when pushed off-screen:
new AxisController({
  mode: 'relative',
  crossingValue: 0,
  snapTolerancePx: 30,    // snap within 30px of edge
  offscreen: 'border',    // pin to edge rather than hide
  labelSide: 'auto',
})
```

| Config | Result |
|--------|--------|
| `bordered: true`, `mode: 'border'` | Default — gutter filled, axis at edge |
| `bordered: false`, `mode: 'border'` | No gutter fill |
| `edges: ['bottom','top']` | Mirrored x-axis |
| `mode: 'relative'`, `snapTolerancePx: 0` | Stationary crossing axis |
| `mode: 'relative'`, `snapTolerancePx: 30`, `offscreen: 'border'` | Mobile axis, snaps to edge |
| `mode: 'relative'`, `snapTolerancePx: 30`, `offscreen: 'hide'` | Mobile axis, hides off-screen |

### Time Axis Tick Formatting (F39)

`scaleType: 'time'` axes use d3-scale's own built-in default `tickFormat()` — a multi-granularity formatter that auto-selects label precision per tick from year down to millisecond, based on which time boundary each tick falls on. No configuration needed; pass a `tickFormat` option to override it, same as any other scale type.

```js
new AxisController({ scaleType: 'time' })
// Zoomed out: "2024", "Mar 2024"...
// Zoomed in:  "14:32", "14:32:07", "14:32:07.250"...
```

### High-Precision Time Axis (F40)

`DataStore`'s GPU x-buffer is a `Float32Array` (~7 significant decimal digits). An absolute epoch-seconds timestamp with microsecond precision (e.g. `1712345678.123456`) can't survive that round-trip — at that magnitude float32's representable gap already exceeds 100, aliasing point positions, not just losing sub-second precision.

The fix: feed `DataStore`/ROI x-values as **small offsets from a reference time**, and let `PlotController`'s `timeOrigin` option reconstruct absolute time for tick labels using double-precision math.

```js
const originMs = Date.now(); // your reference time
const ctrl = new PlotController({
  timeOrigin: originMs,
  timeOriginUnits: 'seconds', // x-domain offsets are in seconds since originMs (default)
  xDomain: [0, 0.02],         // 20 ms window
});

// Feed small offsets (seconds since originMs) into appendData — these fit
// Float32Array precision fine, unlike raw epoch-seconds values would.
ctrl.appendData({ x: offsetsInSeconds, y: samples });

// Convert back to absolute time for display/logging (double precision, no
// GPU buffer involved — safe down to microseconds):
const epochSeconds = ctrl.dataXToEpochSeconds(offsetsInSeconds[0]);
```

Tick labels auto-scale granularity the same way as F39, extended down to microseconds (`HH:MM:SS.ssssss`) for sub-millisecond zoom.

**Caveats:**
- X-axis only. If you pass your own `xAxis` alongside `timeOrigin`, the shared instance is never mutated (consistent with `AxisController`'s shareable-config design) — only the `dataXToEpochSeconds()`/`epochSecondsToDataX()`/`dataXToDate()` conversion methods become active. Pass `buildEpochTickFormatter()` (also exported) to your own `xAxis`'s `tickFormat` if you want the labels too.
- The offset itself still lives in a `Float32Array`, so precision is bounded by keeping the offset small — a live-streaming session running for hours will eventually re-exhaust float32's ~7 significant digits even with a well-chosen origin. Rebasing `timeOrigin` periodically for long-running sessions is a caller responsibility (not automated).

See the [Time Axis Showcase](#examples) example for both F39 and F40 side by side.

### Axis Drag Scaling

Drag directly on the axis gutter (tick-label margin) to zoom that axis independently, centered on its midpoint:

| Axis | Drag Direction | Result |
|------|----------------|--------|
| Y | Down | Zoom In |
| Y | Up | Zoom Out |
| X | Left | Zoom In |
| X | Right | Zoom Out |

Dragging inside the plot area still **pans** as before; only gutter drags zoom. Emits `zoomChanged` with `{ factor, axis }`.

### Rect Zoom Mode

Opt-in — no button has this action by default. When a button is assigned `'rectZoom'` (see [Configurable Mouse Buttons](#configurable-mouse-buttons) below), holding that button and dragging inside the plot area draws a live rectangle overlay from the press point to the current cursor position (any direction, corner-to-corner). Releasing zooms the viewport to exactly that rectangle's data bounds via `viewport.setDomains()`. Drags under ~3px are treated as a no-op click.

```js
const ctrl = new PlotController({ mouseButtons: { middle: 'rectZoom' } });
// or remap at runtime:
ctrl.setMouseButtons({ middle: 'rectZoom' });
```

Mutually exclusive with pan and right-click drag zoom (different mouse buttons); does not interfere with ROI creation or the axis-drag-zoom gutters. Ignored when `disablePanZoom` is set. Emits `zoomChanged` with `{ mode: 'rect', xDomain, yDomain }`.

### Configurable Mouse Buttons

`PlotController` maps each mouse button to one interaction action via `mouseButtons` (constructor option) or `setMouseButtons()` (runtime). Keys are `'left'`, `'middle'`, `'right'`; values are `'pan'`, `'zoomDrag'` (F6 right-drag-style zoom), `'rectZoom'` (F37, opt-in), or `'none'`. Default: `{ left: 'pan', middle: 'none', right: 'zoomDrag' }` — unspecified buttons keep their default action, and an unrecognized action name falls back to the default for that button with a console warning.

```js
// Swap so middle button pans and left button rect-zooms
ctrl.setMouseButtons({ left: 'rectZoom', middle: 'pan' });
```

Axis-drag zoom (dragging a tick-label gutter) is triggered by cursor position, not button choice, and always follows whichever button is mapped to `'pan'`.

### Auto-Scale

```js
// Programmatic auto-scale (also triggered by spacebar)
ctrl.autoScale();

// Register an explicit home domain — spacebar restores these exact bounds instead of scanning data
ctrl.setHomeDomain([0, 10], [0, 100]);
```

### Configurable Keybindings (F41)

`PlotController` maps every keyboard-driven action to a key via `keyBindings` (constructor option) or `setKeyBindings()` (runtime), mirroring `mouseButtons`' merge-over-defaults pattern. This covers both ROI-creation actions (forwarded to `ROIController`) and zoom/pan actions (handled directly). Pass `null` for an action to disable its key entirely.

| Action | Default key | Handled by |
|---|---|---|
| `createLinear` | `l` | ROIController |
| `createRect` | `r` | ROIController |
| `createVLine` | `v` | ROIController |
| `createHLine` | `h` | ROIController |
| `deleteROI` | `d` | ROIController |
| `cancel` | `Escape` | ROIController |
| `autoScale` | `Space` | PlotController |
| `zoomIn` | `=` | PlotController — `viewport.scaleDomainFromMidpointX/Y(1.25)` |
| `zoomOut` | `-` | PlotController — `viewport.scaleDomainFromMidpointX/Y(0.8)` |
| `panLeft` / `panRight` / `panUp` / `panDown` | arrow keys | PlotController — `viewport.panByPixels()`, 40px step |

```js
// Remap ROI creation to different keys and disable delete-by-key
ctrl.setKeyBindings({ createLinear: 'q', createRect: 'w', deleteROI: null });

// ROIController is independently configurable too, if used standalone
import { ROIController } from './src/plot/ROI/ROIController.js';
const roiCtrl = new ROIController(viewport, { keyBindings: { cancel: 'x' } });
```

Arrow-key panning follows the "camera pans toward the arrow" convention (matching F5's follow-pan mode) — `ArrowRight` reveals more content to the right, `ArrowUp` reveals more content above. Note: `keyBindings` keys are scoped per sub-controller — a preset or zoom-action key colliding with a ROI-action key (e.g. binding `zoomIn` to `l`) will fire both, since they're independent `keydown` listeners.

`opts.autoScaleKey` (the old F23 option) is **deprecated** in favor of `keyBindings.autoScale`; it's still accepted as a warn-once alias for backward compatibility.

#### Scale Presets (F41)

Bind a key to a fixed-view jump on one or both axes — e.g. press `1` to snap the y-axis to a known sensor range while leaving the current x-view untouched:

```js
const ctrl = new PlotController({
  scalePresets: [
    { bind: '1', yMin: 0, yMax: 200 },                    // y-only; x stays as-is
    { bind: '2', xMin: 0, xMax: 10, yMin: -5, yMax: 5 },   // both axes
  ],
});

// Replace the whole array at runtime (not a merge, unlike setKeyBindings/setMouseButtons)
ctrl.setScalePresets([{ bind: '3', yMin: -1, yMax: 1 }]);
```

No default presets — bounds are domain-specific, so this is fully opt-in. Invalid entries (missing `bind`, a one-sided `xMin`/`xMax` pair, non-finite bounds, or `min === max`) are skipped with a console warning rather than thrown. Recommend digits (`1`–`9`) as bind keys to avoid colliding with the default ROI/zoom letter keys.

---

## DataStore

Holds GPU typed-array buffers. Extends `EventEmitter`.

```js
import { DataStore } from './src/plot/DataStore.js';

const store = new DataStore();
store.appendData({
  x:     new Float32Array([1, 2, 3]),
  y:     new Float32Array([4, 5, 6]),
  size:  new Float32Array([4, 4, 4]),  // optional; default 4 px
  color: new Uint8Array([255,255,255,255, 255,255,255,255, 255,255,255,255]), // optional RGBA
});

const { x, y, size, color } = store.getGPUAttributes(); // live subarray views
store.getPointCount();     // live count
store.getLogicalData();    // ordered copy (handles ring wrap)
store.clear();             // reset without deallocating buffers
```

### GPU Buffer Append Strategy

1. Initial capacity: 64k points
2. On `appendData()`: if `count + incoming > capacity` → allocate at `capacity * 1.5`, copy existing data
3. GPU attribute accessors use `subarray(0, count)` — a **live view**, no copy
4. deck.gl re-reads attributes on next frame via `updateTriggers`

### Rolling Ring Buffer

Optional fixed-capacity circular buffer for streaming scenarios where only the most recent N points or T milliseconds should be retained.

```js
// Activate rolling mode (call before any appendData)
dataStore.enableRolling({ maxPoints: 1000 });           // keep last 1000 points
dataStore.enableRolling({ maxAgeMs: 5000 });            // keep points < 5 s old
dataStore.enableRolling({ maxPoints: 500, maxAgeMs: 2000 }); // both constraints
```

| Property | Non-rolling | Rolling |
|---|---|---|
| Buffer allocation | Grows dynamically (1.5× factor) | Fixed at `maxPoints` capacity |
| Expiration | None | Count and/or age based |
| `getGPUAttributes()` | Returns live subarray views (no copy) | Returns ordered copy (handles wrap) |
| `getLogicalData()` | Returns live subarray views | Returns ordered copy tail→head |

```js
dataStore.on('dirty',       ()                    => { /* emitted on every appendData */ });
dataStore.on('dataExpired', ({ expired, remaining }) => { /* points were evicted */ });

// PlotController re-emits dataExpired:
plotController.on('dataExpired', ({ expired, remaining }) => {
  console.log(`Evicted ${expired} pts, ${remaining} remaining`);
});
```

Rolling mode is transparent to `PlotController` — `appendData()`, auto-expand domain, and `dataExpired` events all work as expected.

---

## PlotDataView

Lazily-evaluated, dirty-flag-cached derived view over a `DataStore` or another `PlotDataView`. Never mutates its source.

```js
import { PlotDataView } from './src/plot/PlotDataView.js';

// Wrap a DataStore
const view = new PlotDataView(dataStore);

// Or wrap another view (dirty cascades automatically)
const domainView = new PlotDataView(parentView, null, { roiController });

// Get data (recomputes only if dirty)
const { x, y, size, color } = view.getData();

// Derived views
const filtered = view.filterByDomain({ x: [0, 100], y: [0, 50] });
const roiView  = view.filterByROI('roi_1', { roiController });

// Histogram (cached; does not recompute if not dirty)
const { counts, edges } = view.histogram({ field: 'x', bins: 64 });
// edges.length === 65, counts.length === 64

// Deep snapshot — mutating result does not affect cache
const copy = view.snapshot();

view.markDirty();  // trigger child cascade
view.destroy();    // remove all event listeners
```

### Dirty Propagation Rules

| Source event | Marks dirty? |
|---|---|
| `DataStore 'dirty'` (after `appendData`) | ✅ yes |
| `DataStore 'dataExpired'` (rolling eviction) | ✅ yes |
| `roiFinalized` (drag commit on mouseup) | ✅ yes |
| `roiExternalUpdate` (incoming external sync) | ✅ yes |
| `roiUpdated` (drag in progress) | ❌ no — drag must not trigger recompute |

---

## Shared DataStore / DataView

Multiple `PlotController` instances can share a single `DataStore` and optionally a single `PlotDataView`. One write propagates to all plots in the same render frame.

```js
import { DataStore }     from './src/plot/DataStore.js';
import { PlotDataView }  from './src/plot/PlotDataView.js';
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
```

### Filtered View on One Plot

```js
// Plot A shows all data; Plot B shows only points inside a LinearRegion
const baseView = new PlotDataView(sharedStore, null, {
  roiController: ctrlA.roiController,
});

ctrlA.setDataView(baseView, /* owns */ false);
ctrlB.setDataView(baseView, /* owns */ false);

ctrlA.on('roiCreated', ({ type, roi }) => {
  if (type !== 'LinearRegion') return;
  const filteredView = baseView.filterByROI(roi.id);
  ctrlB.setDataView(filteredView, /* owns */ true);
});

ctrlA.on('roiDeleted', () => {
  ctrlB.setDataView(baseView, /* owns */ false);
});
```

### Ownership Rules

| Scenario | `owns` flag | `destroy()` behavior |
|---|---|---|
| `new PlotController()` (no opts) | `_ownsDataStore = true` | destroys DataStore |
| `new PlotController({ dataStore })` | `_ownsDataStore = false` | does NOT destroy DataStore |
| `new PlotController({ dataView })` | `_ownsDataView = false` | does NOT destroy DataView |
| `setDataView(view, true)` | `_ownsDataView = true` | destroys DataView on swap/destroy |
| `setDataView(view, false)` | `_ownsDataView = false` | does NOT destroy DataView |

---

## BitmapDataLayer

Generic `CompositeLayer` that renders any 2D image at an arbitrary data-space bounding rectangle.

| Prop | Type | Description |
|---|---|---|
| `imageData` | `string \| ImageBitmap \| TypedArray` | Image source — URL (fetched), ImageBitmap (direct), or numeric grid |
| `bitMapping` | `{ bounds: [x0,y0,x1,y1] }` or `{ origin: [x0,y0], scale: [sx,sy] }` | Data-space placement |
| `channels` | `'rgba' \| 'rgb' \| 'gray' \| 'gray+alpha'` | Channel layout of typed-array grids |
| `width`, `height` | `number` | Grid dimensions (typed-array source only) |
| `dtype` | `'uint8' \| 'float32'` | Element type of typed-array grids |
| `lutController` | `LUTController` | Optional per-layer LUT; colorizes grayscale grids; reacts to `version` |
| `colorTrigger` | `number` | Increment to force recolorization without new data |
| `dataTrigger` | `number` | Increment to force image re-resolution |

```js
ctrl.registerDataLayer('heatmap', () =>
  new BitmapDataLayer({
    source:     myFloat32Grid,
    bitMapping: { bounds: [0, 0, 256, 256] },
    channels:   'gray',
    dtype:      'float32',
    width:      256,
    height:     256,
    lutController: lutCtrl,
    colorTrigger,
  })
);
```

---

## BitmapViewGenerator

Viewport-aware controller that re-generates or re-fetches a `BitmapDataLayer` whenever the visible domain changes. Debounces `domainChanged` events and fires at the current viewport resolution.

```js
import { BitmapViewGenerator } from './src/plot/layers/BitmapViewGenerator.js';

// Local generator mode
const gen = new BitmapViewGenerator(plotController, {
  layerId:    'my-layer',
  debounceMs: 150,
  channels:   'gray',
  dtype:      'float32',
  lutController: myLutCtrl,
  generate: async ({ xMin, xMax, yMin, yMax, widthPx, heightPx }) => {
    const outW = Math.min(widthPx, 1024);
    const outH = Math.min(heightPx, 1024);
    return { source: myResampleFn(xMin, xMax, yMin, yMax, outW, outH), width: outW, height: outH };
    // bitMapping defaults to { bounds: [xMin, yMin, xMax, yMax] } if omitted
  },
});

// Remote fetch mode (AbortSignal cancels stale requests)
const gen2 = new BitmapViewGenerator(plotController, {
  layerId: 'remote-layer',
  fetch: async ({ xMin, xMax, yMin, yMax, widthPx, heightPx }, signal) => {
    const resp = await fetch(buildApiUrl(xMin, xMax, yMin, yMax, widthPx, heightPx), { signal });
    return { source: await createImageBitmap(await resp.blob()), width: widthPx, height: heightPx };
  },
});

// LUT changes → recolorize without re-running generate
myLutCtrl.on('levelChanged', () => gen.bumpColorTrigger());
myLutCtrl.on('lutChanged',   () => gen.bumpColorTrigger());

gen.on('requestStart',    ({ request }) => showSpinner());
gen.on('requestComplete', ({ request, durationMs }) => hideSpinner());
gen.on('requestError',    ({ request, error }) => console.error(error));

gen.refresh();   // bypass debounce; fire immediately
gen.destroy();
```

---

## LUTController

Pure JS `EventEmitter` — no React. Generalized colormap + contrast-window controller with histogram.

```js
import { LUTController } from './src/plot/layers/LUTController.js';

const lut = new LUTController(256);            // 256 histogram bins
lut.setData(flatArray, globalMin, globalMax);  // compute histogram + auto-level on first call
lut.setLUT('plasma');                          // switch colormap preset
lut.setLevels(min, max);                       // set contrast window
lut.autoLevel(2, 98);                          // snap to 2nd/98th percentile
lut.getLUTArray();                             // Uint8Array[1024] RGBA lookup table
lut.version;                                   // monotonic counter — use as colorTrigger
```

**Events:** `levelChanged({ level_min, level_max })`, `lutChanged(presetName)`, `dataChanged({ bins, edges, globalMin, globalMax })`

**Presets:** `viridis`, `grayscale`, `plasma`, `inferno`, `magma`, `hot`

---

## LUTHistogramController

Owns an internal `PlotController` configured as a read-only histogram viewer. Histogram bars are `SolidPolygonLayer` rectangles; level handles are draggable `hline` LineROIs. Intended as the backing controller for `LUTPanel`.

```js
import { LUTHistogramController } from './src/plot/LUTHistogramController.js';

const histCtrl = new LUTHistogramController({ lutController: lut, bins: 256 });
histCtrl.init(webglCanvas, axisCanvas);  // call once canvases are in DOM
histCtrl.plotController;                 // the internal PlotController
histCtrl.destroy();
```

Dragging a hline → `roiUpdated` → `lutController.setLevels()` → `levelChanged` → connected `BitmapDataLayer` recolorizes. `autoLevel()` moves the hlines to match.

---

## LUTPanel

React convenience component combining the histogram plot, LUT gradient strip, colormap dropdown, and Auto Level button. Lives in `ui/` — not library code; users may build their own UI on top of `LUTController` events.

```jsx
import LUTPanel from './ui/LUTPanel.jsx';

<LUTPanel
  lutController={lut}         // LUTController instance
  lutHistCtrl={histCtrl}      // LUTHistogramController instance
  width={160}                 // panel width in px (default 160)
  height="100%"               // CSS height (default '100%')
/>
```

---

## AudioController

Unified audio management. Absorbs playback and STFT tile logic.

```js
import { AudioController } from './src/audio/AudioController.js';

const audioCtrl = new AudioController();

// Load from file input
const buf = await file.arrayBuffer();
await audioCtrl.loadFile(buf);  // emits 'loaded'

// Stateless filter bridge
audioCtrl.setFilterFn((samples, sr) => filterCtrl.applyToSamples(samples, sr));

// Tiled STFT
await audioCtrl.computeSTFT({ windowSize: 1024, windowFn: 'hann', tileWidthSec: 30 });
// → emits 'tileReady' per tile, then 'stftComplete'

// Playback
audioCtrl.play();    // emits 'stateChanged' + 'timeUpdate' at ~10 Hz
audioCtrl.pause();
audioCtrl.stop();
audioCtrl.seek(5.0);

audioCtrl.destroy();
```

**`tileReady` event payload:**
```js
{ tileIndex, power: Float32Array, width, height, globalMin, globalMax,
  bounds: [tStart, 0, tEnd, nyquist] }
```

**Tile → BitmapDataLayer registration pattern:**
```js
audioCtrl.on('tileReady', ({ tileIndex, power, width, height, bounds }) => {
  tiles.set(tileIndex, { power, width, height, bounds,
    dataTrigger: (tiles.get(tileIndex)?.dataTrigger ?? -1) + 1 });
  specCtrl.registerDataLayer(`tile-${tileIndex}`, () => {
    const tile = tiles.get(tileIndex);
    return new BitmapDataLayer({
      source: tile.power, bitMapping: { bounds: tile.bounds },
      width: tile.width, height: tile.height,
      channels: 'gray', dtype: 'float32',
      lutController: lutCtrl,
      dataTrigger: tile.dataTrigger, colorTrigger,
    });
  });
  specCtrl.markDirty();
});

// LUT level change → recolorize all tiles without re-running STFT
lutCtrl.on('levelChanged', () => { colorTrigger++; specCtrl.markDirty(); });
```

---

## TraceGroup

Multi-trace data layer that partitions bulk point data by string tag into per-tag `Float32Array` buffers. Plugs into `PlotController` via `registerDataLayer`.

```js
import { TraceGroup } from './src/plot/layers/TraceGroup.js';

const tg = new TraceGroup({
  palette:      [[255,100,100,255], [100,255,100,255], /* … */],  // required
  buildLayer:   (traceId, traceData, attrs, ctx) => new ScatterplotLayer({ … }),
  traceAttrs:   { 'sensor_0': { color: [255,0,0,255] } },  // per-tag overrides
  defaultAttrs: { opacity: 0.85, size: 3 },
});

tg.appendData({ x: allX, y: allY, tag: allTags });
ctrl.registerDataLayer('traces', tg.toLayerDef().build);

tg.setTraceVisible('sensor_0', false);   // takes effect on next RAF tick
tg.setTraceAttr('sensor_0', { color: [0,255,0,255] });
```

### API

| Method | Description |
|---|---|
| `appendData({ x, y, tag, size? })` | Bulk append; partitions by `tag` in one O(n) pass. Bumps `version` for each modified trace. |
| `setTraceVisible(tag, bool)` | Show/hide a trace. |
| `getTraceVisible(tag)` | Returns current visibility bool. |
| `setTraceAttr(tag, attrs)` | Merge per-tag attr overrides post-construction. |
| `getAllTags()` | Returns tags in insertion order. |
| `toLayerDef()` | Returns `{ id, build: (ctx) => Layer[] \| null }` for `registerDataLayer`. |

### Attribute Resolution Priority (highest wins)

1. Per-tag `traceAttrs[tag]`
2. Palette color: `palette[insertionIndex % palette.length]`
3. `defaultAttrs`
4. Library defaults: `{ opacity: 1.0, size: 4.0, color: [255,255,255,255] }`

---

## SignalStore

Multi-signal line-plot layer backed by deck.gl `PathLayer`. Designed for waveform and time-series data where each signal is a continuous polyline. Plugs into `PlotController` via `registerDataLayer`, just like `TraceGroup`.

```js
import { SignalStore } from './src/plot/layers/SignalDataLayer.js';

const signals = new SignalStore();
const ctrl = new PlotController({ disableDefaultDataLayer: true });

// Register signals before appending data
signals.addSignal('ch0', [255, 100, 100, 255]);
signals.addSignal('ch1', [100, 255, 100, 255]);

ctrl.registerDataLayer('signals', signals.toLayerDef().build);

// Append samples — x values assigned automatically from xBase + i
signals.appendSignalData('ch0', ch0Samples, signals.xCounter);
signals.appendSignalData('ch1', ch1Samples, signals.xCounter);
signals.advanceXCounter(ch0Samples.length);

// Fit domain to current data
const { xDomain, yDomain } = signals.expandDomains();
ctrl.viewport.setXDomain(xDomain);
ctrl.viewport.setYDomain(yDomain);
ctrl.markDirty();
```

### Rolling window (trim old data)

```js
// Keep only the last 10 seconds of samples (xCounter increments per sample)
const windowSize = 10 * sampleRate;
signals.trimBefore(signals.xCounter - windowSize);
```

### API

| Method | Returns | Description |
|---|---|---|
| `addSignal(id, color)` | `void` | Register a named signal. `color` is `[R, G, B, A]` 0–255. |
| `appendSignalData(id, yValues, xBase)` | `void` | Append y-values; x coordinates are `xBase + i`. Bumps signal version. |
| `advanceXCounter(n)` | `void` | Advance the shared x counter by `n` after one round of appends. |
| `trimBefore(xMin)` | `void` | Remove all path points where `x < xMin`. Binary-search per signal; versions bumped. |
| `expandDomains()` | `{ xDomain, yDomain }` | Compute `[0, xMax]` / `[yMin-pad, yMax+pad]` extents from current data. |
| `getSignal(id)` | `object \| undefined` | Direct access to signal internals `{ path, color, layerData, version }`. |
| `getPointCount()` | `number` | Total path points across all registered signals. |
| `reset()` | `void` | Clear all signal data and reset `xCounter` to 0. |
| `toLayerDef()` | `{ id, build }` | Returns a layer def for `registerDataLayer`. |

| Getter | Returns | Description |
|---|---|---|
| `xCounter` | `number` | Shared x position counter; increment with `advanceXCounter`. |

---

## ROI System

### Creation

| Key | Mode | Clicks |
|-----|------|--------|
| `L` | LinearRegion | click x1, then x2 |
| `R` | RectROI | click top-left, then bottom-right |
| `V` | Vertical LineROI | one click |
| `H` | Horizontal LineROI | one click |
| `D` | Delete selected ROI | — |
| `Esc` | Cancel creation mode | — |

These are the defaults — all six keys are configurable via `keyBindings` / `setKeyBindings()` (F41); see [Configurable Keybindings](#configurable-keybindings-f41).

### Behaviour Flags

Every ROI carries a `flags` object consulted by `ROIController` hit-testing and `ROILayer` rendering. Flags are behavioural, not geometric — toggling them never bumps `version` or emits `roiFinalized`.

| Flag | Default | Effect when `false` |
|------|---------|----------------------|
| `movable` | `true` | Dragging the ROI body has no effect; still selectable and (if `resizable`) still resizable |
| `resizable` | `true` | Corner/edge resize handles have no effect; still movable (if `movable`) and selectable |
| `visible` | `true` | Not rendered; excluded from hit-testing |
| `pickable` | `true` | Fully inert to clicks — excluded from `ROIController` hit-testing (no select/drag/resize/hover) **and** the deck.gl fill layer's `pickable` prop is set `false` (no `onROIClick`/`autoHighlight`). Stays visible if `visible` is true |
| `deletable` | `true` | `roiController.deleteROI(id)` (including the `D` keybind) is a no-op |

```js
// Lock an ROI in place but keep it clickable/selectable
ctrl.roiController.setFlags(roi.id, { movable: false, resizable: false });

// Make an ROI fully inert — visible but unclickable (e.g. a background reference band)
ctrl.roiController.setFlags(roi.id, { pickable: false });
```

`setFlags(id, flagsPatch)` merges the patch into `roi.flags` and emits `roisChanged`.

### LineROI Modes

| Mode | Description |
|------|-------------|
| `vline` | Full-height vertical line |
| `hline` | Full-width horizontal line |
| `vline-half-top` | Vertical line, upper half only; supports label |
| `vline-half-bottom` | Vertical line, lower half only; supports label |
| `hline-half-left` | Horizontal line, left half only; supports label |
| `hline-half-right` | Horizontal line, right half only; supports label |

```js
import { LineROI } from './src/plot/ROI/LineROI.js';

const roi = new LineROI({ orientation: 'vertical', mode: 'vline-half-bottom', position: 5.0, label: 'P-wave' });
roi.bumpVersion();
ctrl.roiController.addROI(roi);
roi.onCreate();
ctrl.roiController.emit('roisChanged', { rois: ctrl.roiController.getAllROIs() });
```

### ROI Versioning & Serialization

Every ROI instance carries:
- **`version`** — monotonic integer starting at 1; incremented on each user mouseup commit
- **`updatedAt`** — `Date.now()` timestamp of the last `bumpVersion()` call
- **`domain`** — JSON-safe snapshot: `{ x: [x1, x2], y?: [y1, y2] }` (`LinearRegion` omits `y`)

```js
const roiController = plotController.roiController;

// Serialize all ROIs to plain objects (JSON-safe)
const snapshot = roiController.serializeAll();
// → [{ id, type, version, updatedAt, domain, metadata }, ...]

// Restore from a snapshot (clears existing ROIs, emits roisChanged)
roiController.deserializeAll(snapshot);

// Apply an external update — version-gated (rejects if incoming.version <= current)
const accepted = roiController.updateFromExternal({
  id: 'roi_1', type: 'linearRegion', version: 5,
  updatedAt: Date.now(), domain: { x: [10, 50] }, metadata: {},
});
// Returns true if accepted, false if rejected
```

### Version Conflict Rules

| Condition | Result |
|---|---|
| `incoming.version > existing.version` | Accepted → bounds updated, `roiExternalUpdate` emitted |
| `incoming.version === existing.version` | Rejected (silent) |
| `incoming.version < existing.version` | Rejected (silent) |
| ROI not found in `_rois` | Created as a new ROI |

`updateFromExternal` does **not** call `bumpVersion()` — the incoming version is applied directly.

### Constraint System

`ConstraintEngine.enforceConstraints(parent, delta)`:

1. **Shift rule** — children move by the same `{ dx, dy }` as the parent (preserving relative position)
2. **Clamp rule** — child edges outside the parent bounds are clamped (asymmetric: child shrinks to fit, not discarded)
3. **Recursion** — after adjusting a child, the engine recurses into that child's children with `delta = {0, 0}`
4. **Loop guard** — a `Set` of visited ROI ids prevents infinite loops in circular references

---

## External Integration

MasterPlot never implements HTTP, WebSocket, or authentication. The engine boundary sits at `DataStore.appendData()` and `ROIController.updateFromExternal()`.

```
External Source
      │
      ▼
 Adapter (your code)
 ├── ExternalDataAdapter ─► DataStore ─► PlotDataView ─► PlotController ─► deck.gl
 └── ExternalROIAdapter  ─► ROIController ─► roiExternalUpdate ─► PlotDataView dirty
```

### ExternalDataAdapter

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

  replaceData(bufferStruct) {
    this._dataStore.clear();
    this._dataStore.appendData(bufferStruct);
  }

  appendData(bufferStruct) {
    this._dataStore.appendData(bufferStruct);
  }
}
```

### ExternalROIAdapter

```js
import { ExternalROIAdapter } from './src/integration/ExternalROIAdapter.js';

class MyServerROIAdapter extends ExternalROIAdapter {
  async load()        { /* fetch and return SerializedROI[] */ }
  async save(roi)     { /* PUT roi to server */ }
  subscribe(callback) { /* register callback; return unsubscribe fn */ }
}

await adapter.attach();  // load → deserializeAll → start save/subscribe lifecycle
adapter.detach();        // remove all listeners
```

### ROI Sync Flow

```
roiFinalized → adapter.save(roi) → storage
                                 → (other clients)
                                       → adapter.subscribe callback
                                             → roiController.updateFromExternal(roi)
                                                   → roiExternalUpdate
                                                         → PlotDataView dirty
```

### Mock Adapters (testing / demos)

```js
import { MockDataAdapter } from './src/integration/MockDataAdapter.js';
import { MockROIAdapter }  from './src/integration/MockROIAdapter.js';

const dataAdp = new MockDataAdapter(store, { intervalMs: 500, batchSize: 100 });
dataAdp.start();  // begins appending 100 random points every 500 ms
dataAdp.stop();

const roiAdp = new MockROIAdapter(roiController, { storageKey: 'my_rois' });
await roiAdp.attach();  // restores ROIs from localStorage; starts save/subscribe
roiAdp.detach();
```

---

## Data Loaders

Optional adapter utilities in `loaders/` for loading common scientific file formats directly into MasterPlot data structures. These pull in `@loaders.gl/*` and, for Parquet, `zstd-codec` — listed as **optional peer dependencies**, so a plain `npm install masterplot` never installs them. Install only what you use:

```
# TableLoaderAdapter (CSV/Arrow)
npm install @loaders.gl/core @loaders.gl/csv @loaders.gl/arrow

# + Parquet support
npm install @loaders.gl/parquet @loaders.gl/schema zstd-codec

# RasterLoaderAdapter (NetCDF)
npm install @loaders.gl/core @loaders.gl/netcdf
```

`lz4js` and `snappyjs` (Parquet compression codecs) are bundled into `masterplot/loaders` directly — you don't need to install them yourself.

### TableLoaderAdapter

Loads CSV, TSV, or Apache Arrow into a `DataStore` via streaming chunks.

```js
import { TableLoaderAdapter } from './loaders/TableLoaderAdapter.js';

const adapter = new TableLoaderAdapter(dataStore, {
  x:         'time',       // required — column name for X
  y:         'amplitude',  // required — column name for Y
  size:      'magnitude',  // optional — column name, fixed number, or omit (default 4 px)
  color:     null,         // optional — column name, fn(value)→[r,g,b,a], or null
  chunkSize: 50_000,       // rows per appendData call
  replace:   true,         // clear DataStore before loading
});

adapter.on('loaded',       ({ rowCount, columns }) => console.log(rowCount, 'rows'));
adapter.on('chunk',        ({ loaded, total })     => updateProgressBar(loaded / total));
adapter.on('parseWarning', ({ message })           => console.warn(message));

await adapter.loadFile(file);
await adapter.loadURL('https://example.com/data.csv');

adapter.getColumns();  // string[] — populated after load
adapter.destroy();
```

**Supported formats:** `.csv`/`.tsv` → CSVLoader · `.arrow` → ArrowLoader

### RasterLoaderAdapter

Loads a gridded dataset (NetCDF3 or image) and registers a `BitmapDataLayer` with `bitMapping.bounds` inferred from coordinate arrays or image dimensions.

```js
import { RasterLoaderAdapter } from './loaders/RasterLoaderAdapter.js';

const adapter = new RasterLoaderAdapter(plotController, {
  layerId:       'temperature',
  variable:      'temp',     // NetCDF variable (auto-detected if omitted)
  xDim:          'lon',
  yDim:          'lat',
  lutController: myLutCtrl,
  flipY:         true,
});

adapter.on('loaded', ({ width, height, bounds }) => {
  plotController.viewport.setXDomain([bounds[0], bounds[2]]);
  plotController.viewport.setYDomain([bounds[1], bounds[3]]);
});

await adapter.loadFile(file);  // .nc/.cdf → NetCDF; images → createImageBitmap
adapter.loadArray(float32Grid, w, h, { bounds: [-180, -90, 180, 90] });
adapter.destroy();
```

**Supported formats:** `.nc`/`.cdf` → NetCDF v3 classic · `.png`/`.jpg`/`.webp` → `createImageBitmap`

> **Note:** NetCDF4 (HDF5-based `.nc4`) is not supported; only classic NetCDF3.

---

## Popup Infrastructure

Detached panel windows that stay bidirectionally in sync via the browser's `BroadcastChannel` API. All messages use the envelope `{ type: 'TYPE_NAME', payload: { ...data } }`.

### PopupWindowManager

Plain `EventEmitter` — no React dependency.

```js
import { PopupWindowManager } from './src/popup/PopupWindowManager.js';

const manager = new PopupWindowManager();
manager.on('message', (msg) => console.log('from popup:', msg));
manager.on('closed',  ()    => console.log('popup closed'));

const opened = manager.open(
  'spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter',
  'spectrogram-v2-filter',
  'width=520,height=640'
);
if (!opened) { /* popup was blocked */ }

manager.send({ type: 'FILTER_STATE', payload: { filterType: 'lowpass', cutoff: 1000 } });
manager.close();
manager.destroy();  // close() + removeAllListeners()
```

### usePopupChannel (React hook)

```jsx
import { usePopupChannel } from './src/popup/usePopupChannel.js';

const { open, send, close, isOpen } = usePopupChannel(
  'spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter',
  'spectrogram-v2-filter',
  (msg) => { if (msg.type === 'FILTER_APPLY') handleApply(msg.payload); }
);

// Call open() from a user gesture — popup is not opened on mount
<button onClick={open} disabled={isOpen}>Open Filter Panel</button>
```

### Spectrogram Popup Host

`spectrogram-popup.html` routes via URL params:

| URL | Panel |
|-----|-------|
| `?panel=filter&channel=spectrogram-v2-filter` | Filter Panel |
| `?panel=labels&channel=spectrogram-v2-labels` | ROI Label Panel |

---

## Keybinds

| Key | Action |
|---|---|
| `L` | Enter LinearRegion creation mode (click x1, then x2) |
| `R` | Enter RectROI creation mode (click top-left, then bottom-right) |
| `V` | Enter vertical LineROI creation mode (one click) |
| `H` | Enter horizontal LineROI creation mode (one click) |
| `D` | Delete the currently selected ROI |
| `Esc` | Cancel creation mode |
| `Space` | Auto-scale to full data extent |
| `scroll` | Zoom (centered on cursor) |
| `drag` | Pan |
| `Ctrl+click` | Seek playhead (spectrogram example) |

---

## Performance Profile

- **10M points** via GPU instancing (`ScatterLayer`); no stutter
- **Live append** every 2 s — `Float32Array` buffer grows 1.5× on overflow; no GC spikes
- **Zoom/pan** — domain-only update; data buffers never change
- **ROI picking** — O(n_rois), not O(n_points)
- **500k points** (50 sensors × 10k) — via `TraceGroup` with per-trace visibility toggling
- **Rolling buffer** — fixed capacity; oldest points evict silently

---

## File Structure

```
src/                              ← library code only
  plot/
    PlotController.js             — central controller + render loop
    DataStore.js                  — GPU typed-array buffers
    PlotDataView.js               — lazy derived view (filter / histogram / snapshot)
    ViewportController.js         — coordinate transforms + domain state
    LUTHistogramController.js     — internal PlotController histogram viewer for LUTPanel
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
      BitmapDataLayer.js          — generic bitmap layer; URL/ImageBitmap/TypedArray
      BitmapViewGenerator.js      — viewport-driven LOD controller; generate or fetch mode
      _buildBitmapFromGrid.js     — CPU colorizer for typed-array grids
      LUTController.js            — colormap + level + histogram controller
      SignalDataLayer.js          — SignalStore + buildSignalLayers for line plots
      TraceGroup.js               — multi-trace scatter partitioner with palette cycling
      PlotLayer.js                — optional CompositeLayer wrapper
    axes/
      AxisController.js           — d3-scale wrapper + positioning config
      AxisRenderer.js             — canvas 2D ticks + labels
  audio/
    AudioController.js            — unified load/playback/STFT/filter bridge
    PlaybackController.js         — Web Audio API playback + seek (kept for compat)
    FilterController.js           — offline biquad DSP + frequency response
  components/
    PlotCanvas.jsx                — React wrapper (canvas + controller lifecycle)
  integration/
    ExternalDataAdapter.js        — interface contract for external data sources
    ExternalROIAdapter.js         — interface contract for ROI persistence/sync
    MockDataAdapter.js            — random data generator mock
    MockROIAdapter.js             — localStorage-backed ROI persistence mock
  popup/
    PopupWindowManager.js         — EventEmitter popup manager
    usePopupChannel.js            — React hook wrapper

ui/                               ← optional React UI extensions (not library code)
  LUTPanel.jsx                    — histogram + LUT gradient + colormap dropdown + Auto Level
  FilterPanel.jsx                 — filter type, cutoff, Q controls + response curve

loaders/                          ← optional data loader adapters (not library code)
  TableLoaderAdapter.js           — CSV / TSV / Arrow → DataStore
  RasterLoaderAdapter.js          — NetCDF / image → BitmapDataLayer

examples/                         ← example page components
  src/                            ← webpack entry JS files (one per HTML page)
  HubPage.jsx                     — demo navigation hub
  ExampleApp.jsx                  — scatter/ROI/live-append + point-count dropdown + ROI tables
  LiveSignalsExample.jsx          — three live signals + rolling window + ROI stats sidebar
  MultiSensorExample.jsx          — 50 sensors × 10k pts via TraceGroup; visibility sidebar
  SpectrogramV2Example.jsx        — AudioController + BitmapDataLayer + LUTPanel
  BitmapLODExample.jsx            — BitmapViewGenerator: local bilinear LOD + remote fetch
  SharedDataExample.jsx           — two-plot shared DataStore + filtered DataView
  SeismographyExample.jsx         — 50 stacked channels, shared X-axis, vline picks + table
  AxisShowcaseExample.jsx         — 2×3 grid of all axis positioning combinations

public/
  *.html                          — HTML templates (one per page)
```

---

## Installation & Running

```bash
npm install
npm start        # webpack dev server on http://localhost:3000
npm run build    # production bundle in dist/
npm test         # run the Vitest suite (test/**/*.test.js)
npm run test:watch
npm run typecheck   # tsc --noEmit against test-types/smoke.tsx
npm run lint         # eslint (src/, ui/, loaders/, test/) — correctness rules only
```

### Peer Dependencies

`peerDependencies` in `package.json` are ranged with a tested upper bound (`>=<tested major> <next major>`), not an open-ended lower bound — installing a peer one major above the tested range produces an `ERESOLVE`/peer warning instead of silently succeeding against an unverified API. Ranges are widened deliberately, only after the new major is verified against this repo's test suite and examples — never automatically.

| Peer | Range | Verified against |
|---|---|---|
| `@deck.gl/core`, `@deck.gl/layers` | `>=9 <10` | 9.2.11 |
| `@luma.gl/core` | `>=9 <10` | 9.2.6 |
| `react`, `react-dom` | `>=18 <20` | 19.2.4 |
| `d3-scale` | `>=4 <5` | 4.0.2 |
| `d3-format` | `>=3 <4` | 3.1.2 |
| `d3-time-format` | `>=4 <5` | 4.1.0 |
| `events` | `>=3 <4` | 3.3.0 |
| `@loaders.gl/*` (optional) | `>=4.3.4 <5` | 4.3.4 |
| `zstd-codec` (optional) | `>=0.1.5 <0.2.0` | 0.1.5 |

### Offline Installation

For air-gapped or network-restricted environments, `npm run bundle:offline` (`scripts/bundle-offline.mjs`) builds a self-contained bundle of masterplot plus every package in its `dependencies` and `peerDependencies` (including optional loaders):

```bash
npm run bundle:offline
# → offline-bundle/                       (contents below)
# → masterplot-<version>-offline-bundle.tar.gz  (single-file archive)
```

The bundle contains the `npm pack` tarball, a populated npm cache (`npm-cache.tar.gz`, for `npm install --offline --cache`), a vendored `node_modules.tar.gz` (extract-and-go, no npm step), a resolved `package-lock.json` for reference, and `install-offline.sh` (installs into a target project via the cache method — see `INSTALL-OFFLINE.md` inside the bundle for both methods in full). Regenerate it whenever `dependencies`/`peerDependencies` change.

### TypeScript

MasterPlot ships hand-written `.d.ts` declarations for all three entry points (`masterplot`, `masterplot/ui`, `masterplot/loaders`) — no `@types/masterplot` package needed. `import { PlotController } from 'masterplot'` gets full autocomplete and type-checking out of the box. Declarations live next to their source (`src/index.d.ts`, `ui/index.d.ts`, `loaders/index.d.ts`) and are wired up via the `types` condition on each `exports` subpath in `package.json`. `test-types/smoke.tsx` is a throwaway fixture (not published) exercising a representative slice of the API — run `npm run typecheck` to catch declaration drift against the real source.

### CI

Every pull request and push to `main` runs a quality gate (`.github/workflows/ci.yml`): `npm run build` → `npm run lint` → `npm test` → `npm run typecheck`. The lint pass (ESLint flat config, `eslint.config.mjs`) is scoped to `src/`, `ui/`, `loaders/`, and `test/` — the shipped library and its tests, not the `examples/` demo pages — and focuses on correctness (`no-unused-vars`, `no-undef`, and `eslint-plugin-react-hooks`'s rules for `ui/` and `src/components/`) rather than code style. Deployment (`.github/workflows/deploy.yml`) remains a separate, `main`-only concern.

---

## Documentation

A live documentation SPA is served at [`docs.html`](https://madalex1997.github.io/MasterPlot/docs.html):

| Page | Contents |
|------|----------|
| **Architecture** | PlotController orchestration diagram, render loop sequence, event bus graph, coordinate systems, GPU data-flow |
| **Getting Started** | 7-step tutorial: install, mount, live append, zoom/pan, LinearRegion ROI, events, shared DataStore |
| **API Reference** | Constructor options, methods, and events for all public classes |
| **ROI Deep-Dive** | Class hierarchy, creation modes, LineROI modes, ConstraintEngine sequence, versioning, serialization |
| **PlotController Deep-Dive** | Initialization pipeline, two-canvas model, dirty-flag render loop, layer registry, zoom modes, coordinate space, appendData-to-GPU flowchart |

---

## Roadmap

See [PLAN.md](PLAN.md) for the implementation plan.

Unscheduled:
- Full multi-level RectROI nesting
- High-resolution PNG export (`plotController.exportPNG(options)`)
- Snapping constraints for ROIs
