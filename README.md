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

## Current Capabilities (F1–F16)

### Core Plotting Engine
- **WebGL rendering** via deck.gl `OrthographicView` — no maps, no geospatial assumptions
- **Scatter plots** with instanced rendering (`ScatterLayer`) — GPU typed array buffers, no per-point JS objects
- **Line plots** (`LineLayer`)
- **Linear and log axes** via d3-scale; canvas 2D overlay for tick labels and grid
- **Zoom** (mouse wheel, centered on cursor) and **pan** (drag) without touching data buffers
- **Semi-live data append** — `Float32Array` buffers grow by 1.5× when capacity is exhausted; no full reallocation; deck.gl attribute views (`subarray`) update without copying
- **Rolling ring buffer** — optional fixed-capacity circular buffer with count-based and age-based expiration; axis domain recalculates automatically after eviction
- **Event log panel** — on-screen log of `dataAppended`, `domainChanged`, `zoomChanged`, `panChanged`, `roiCreated`, `roiUpdated`, `roiDeleted`

### ROI System (pyqtgraph-style)
- **LinearRegion** — vertical strip defined by x1/x2; created with `L` key + two clicks
- **RectROI** — draggable/resizable rectangle; created with `R` key + two clicks; parented to a LinearRegion
- **ConstraintEngine** — enforces parent-child bounds automatically:
  - Children shift when parent moves (preserving relative offset)
  - Children are clamped to parent bounds (not discarded)
  - Recursive enforcement for multi-level nesting
- **Deletion** with `D` key; cancel creation with `Esc`

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
| **Frequency filters** | Offline biquad DSP via `OfflineAudioContext` (lowpass, highpass, bandpass, notch, allpass); frequency response curve preview; Apply / Clear Filter |

---

## Architecture Overview

MasterPlot is **controller-driven**, not React-state-driven. React only manages DOM layout and UI chrome. All rendering, zoom, pan, ROI interaction, and audio processing run outside React's reconciler.

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
  HubPage.jsx             — demo navigation hub
  ExampleApp.jsx          — scatter/ROI/live-append demo
  LineExample.jsx         — line plot demo
  SpectrogramExample.jsx  — full audio analysis demo
public/
  index.html
```

---

## Roadmap

See [PLAN.md](PLAN.md) for the full implementation plan and step status.

Planned (not yet implemented):
- Full multi-level RectROI nesting
- High-resolution PNG export
- Snapping constraints for ROIs
- TypeScript migration
