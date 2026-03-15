# MasterPlot Implementation Plan

**Plan Version:** 7.0
**Last Updated:** 2026-03-14
**Status:** Phase 4 (Bitmap/LUT Refactor) added 2026-03-14. ARCH-F through CLEANUP pending.

---

## Instructions for Agents

This document tracks the multi-step implementation of MasterPlot. Each step has a status indicator:

- **[PENDING]** — Not started
- **[IN_PROGRESS]** — Currently being worked on
- **[COMPLETED]** — Finished and verified
- **[BLOCKED]** — Cannot proceed (waiting on dependency or clarification)
- **[REGRESSED]** — Previously completed, now broken (needs action)

### Protocol for Agents

1. **Before Starting**: Mark the step you're working on as `[IN_PROGRESS]`
2. **When Making Changes**:
   - Update status of affected steps
   - Add a timestamp and brief note explaining the change
   - If deviating from plan or discovering new requirements → **STOP and ask for clarification**
3. **When Completing**: Mark step as `[COMPLETED]` and verify dependencies
4. **If Something Breaks**: Mark the affected step as `[REGRESSED]` and document the issue
5. **On Handoff**: Clearly mark next step for the following agent
6. **After every completed feature**: Update `README.md` to reflect new capabilities **and** update `HubPage.jsx` so the new demo/example is linked from the hub. GitHub Actions deploys from `main` — a merged PR or push to `main` is sufficient to update https://madalex1997.github.io/MasterPlot/. Do NOT mark a feature `[COMPLETED]` without completing this step.
7. **Archive completed specs**: When marking a feature `[COMPLETED]`, replace its full spec block in this file with the compact summary format below, then append the full spec to `docs/plan-archive.md`. This keeps PLAN.md from growing indefinitely.

**Compact summary template:**
```markdown
### FXX [COMPLETED] Title
**Completed:** YYYY-MM-DD | **Branch:** branch-name
One sentence describing what was built and which files were created/modified.
Full spec: [docs/plan-archive.md#fxx](docs/plan-archive.md#fxx)
```

---

## Feature Status Index

| ID | Title | Status | Branch | Completed |
|----|-------|--------|--------|-----------|
| F1  | Auto-expand domain toggle | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-20 |
| F2  | Live append on/off checkbox | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-20 |
| F3  | Event logging on UI | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F4  | Pan mode toggle | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F5  | Follow pan velocity mode | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F6  | Right-click drag zoom | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F7  | Tunable follow-pan speed | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F8  | LineLayer example page | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F9  | SpectrogramLayer | ✅ COMPLETED | feature/F4-F5-F6 | 2026-02-21 |
| F10 | Audio file loading | ✅ COMPLETED | feature/F10 | 2026-02-21 |
| F11 | HistogramLUTItem | ✅ COMPLETED | feature/F11 | 2026-02-21 |
| F12 | Audio Playback + Playhead | ✅ COMPLETED | feature/F12 | 2026-02-22 |
| F13 | Frequency Filters | ✅ COMPLETED | feature/F13 | 2026-02-22 |
| B1  | Fix: Zoom scroll wheel | ✅ COMPLETED | — | 2026-02-20 |
| B2  | Fix: deck.gl coord mismatch | ✅ COMPLETED | — | 2026-02-20 |
| B3  | Fix: ScatterLayer coord space | ✅ COMPLETED | — | 2026-02-20 |
| B4  | Fix: ROILayer coord space | ✅ COMPLETED | — | 2026-02-20 |
| B5  | Fix: Inverted vertical controls | ✅ COMPLETED | — | 2026-02-21 |
| B6  | Fix: Y-axis inverted rendering | ✅ COMPLETED | — | 2026-02-21 |
| B7  | Fix: Y-axis pan direction | ✅ COMPLETED | — | 2026-02-21 |
| B8  | Fix: Spectrogram page blank | ✅ COMPLETED | — | 2026-02-21 |
| F16 | Rolling Ring Buffer DataStore | ✅ COMPLETED | feature/datastore-rolling | 2026-02-22 |
| F15 | Lazy DataView System | ✅ COMPLETED | feature/dataview-lazy | 2026-02-22 |
| F14 | ROI Domain Model + Versioning | ✅ COMPLETED | feature/roi-domain-versioning | 2026-02-22 |
| F17 | Shared Data Infrastructure | ✅ COMPLETED | feature/shared-data | 2026-02-22 |
| F18 | External Integration Contracts | ✅ COMPLETED | feature/integration-contract | 2026-02-22 |
| EX1 | Scatter + ROI Tables | ✅ COMPLETED | feature/example-improvements | 2026-02-22 |
| EX2 | Spectrogram UI Refinement | ✅ COMPLETED | feature/example-improvements | 2026-02-22 |
| EX3 | Rolling Lines Improvement | ✅ COMPLETED | feature/example-improvements | 2026-02-22 |
| F19 | Cascading ROI Update + Child Versioning | ✅ COMPLETED | feature/F19 | 2026-02-24 |
| F20 | LineROI (Vertical/Horizontal + Labels) | ✅ COMPLETED | feature/F20 | 2026-02-24 |
| F21 | Axis Drag Scaling (Midpoint Zoom) | ✅ COMPLETED | feature/F20 | 2026-02-24 |
| EX4 | Scatter Performance Dropdown | ✅ COMPLETED | main | 2026-03-03 |
| EX5 | Geophysics / Seismography Example | ✅ COMPLETED | feature/EX5 | 2026-02-25 |
| EX6 | ROI Table Double-Click Selection | ✅ COMPLETED | feature/EX6 | 2026-02-26 |
| ARCH-C | ROILayer Internal Decomposition | ✅ COMPLETED | feature/ARCH-C | 2026-03-01 |
| ARCH-A | PlotController Pluggable Data Layers | ✅ COMPLETED | feature/ARCH-A | 2026-03-01 |
| ARCH-D | SignalDataLayer Extraction | ✅ COMPLETED | feature/ARCH-D | 2026-03-01 |
| ARCH-B | PlotLayer CompositeLayer | ✅ COMPLETED | feature/ARCH-B | 2026-03-01 |
| F22 | TraceGroup Abstraction | ✅ COMPLETED | feature/F22-EX7 | 2026-03-01 |
| EX7 | Multi-Sensor Scatter Example | ✅ COMPLETED | feature/F22-EX7 | 2026-03-01 |
| EX8 | Live Signal Analysis (Merge Line Examples) | ✅ COMPLETED | feature/EX8 | 2026-03-01 |
| EX9 | Spectrogram Overhaul | ✅ COMPLETED | feature/EX9 | 2026-03-01 |
| F23 | Auto-Scale / Reset Zoom | ✅ COMPLETED | feature/F23-EX10 | 2026-03-03 |
| EX10 | Spectrogram Axis Drag Zoom + Auto-Scale | ✅ COMPLETED | feature/F23-EX10 | 2026-03-03 |
| ARCH-E | BroadcastChannel Popup Window Infrastructure | ✅ COMPLETED | feature/ARCH-E | 2026-03-06 |
| F24 | Spectrogram Filter Popup Window | ✅ COMPLETED | feature/F24 | 2026-03-06 |
| EX11 | Spectrogram RectROI + Connected Label Popup | ✅ COMPLETED | feature/EX11 | 2026-03-06 |
| EX12 | Stress Test Preset Segments | ✅ COMPLETED | feature/EX12 | 2026-03-06 |
| F25 | Higher-Order Butterworth Filter (Cascaded Biquads) | ✅ COMPLETED | feature/F25 | 2026-03-06 |
| DOC1 | Documentation: Architecture Overview    | ✅ COMPLETED | feature/DOC1 | 2026-03-07 |
| DOC2 | Documentation: Getting Started Tutorial | ✅ COMPLETED | feature/DOC2 | 2026-03-07 |
| DOC3 | Documentation: API Reference            | ✅ COMPLETED | feature/DOC3 | 2026-03-07 |
| DOC4 | Documentation: ROI System Deep-Dive     | ✅ COMPLETED | feature/DOC4 | 2026-03-07 |
| DOC5 | Documentation: PlotController Deep-Dive | ✅ COMPLETED | feature/DOC5 | 2026-03-07 |
| ARCH-F | Project Restructure (src/ purity) | ✅ COMPLETED | feature/ARCH-F | 2026-03-14 |
| F27 | Generic BitmapDataLayer | ✅ COMPLETED | feature/F27 | 2026-03-14 |
| F28 | LUTController + LUTHistogramController | 🔲 PENDING | — | — |
| F29 | LUTPanel React Component | 🔲 PENDING | — | — |
| F30 | AudioController | 🔲 PENDING | — | — |
| EX-Spec | Spectrogram V2 Example | 🔲 PENDING | — | — |
| CLEANUP | Remove Legacy Spectrogram Code | 🔲 PENDING | — | — |

---

> All completed feature specs are in [docs/plan-archive.md](docs/plan-archive.md).
> The Feature Status Index above is the authoritative completion record.

---

## Pending Features

**Mandatory implementation order:**

```
F27 → F28 → F29 → F30 → EX-Spec → CLEANUP
```

---

## Phase 4 — Bitmap / LUT Refactor

**Motivation:** `SpectrogramLayer` bundles STFT computation, image building, LUT lookup, and bitmap rendering into one monolithic layer, and `SpectrogramExample` bypasses `PlotController` entirely (two raw Deck instances). The goal is to decompose these into generic composable primitives so any 2D image or numeric array (heatmaps, image segments, tile layers, spectrograms from any source) can be displayed through `PlotController` with a shared LUT histogram panel.

---

### ARCH-F [COMPLETED] Project Restructure (src/ purity)
**Completed:** 2026-03-14 | **Branch:** feature/ARCH-F
Moved 9 webpack entry JS files from `src/` to `examples/src/`; moved `FilterPanel.jsx` and `HistogramLUTPanel.jsx` from `src/components/` to `ui/`; updated all import paths and `webpack.config.js` entries; `src/components/` now contains only `PlotCanvas.jsx`; build passes zero errors.
Full spec: [docs/plan-archive.md#arch-f](docs/plan-archive.md#arch-f)

---

### F27 [COMPLETED] Generic BitmapDataLayer
**Completed:** 2026-03-14 | **Branch:** feature/F27
Created `src/plot/layers/BitmapDataLayer.js` (CompositeLayer accepting URL/ImageBitmap/TypedArray; `bitMapping` exclusive bounds vs origin+scale; per-layer `lutController`) and `src/plot/layers/_buildBitmapFromGrid.js` (CPU colorizer: rgba/rgb/gray+alpha direct copy, gray→LUT/Viridis colorize); build zero errors.
Full spec: [docs/plan-archive.md#f27](docs/plan-archive.md#f27)

---

### F28 [PENDING] LUTController + LUTHistogramController

**Branch:** `feature/F28-F29`
**Depends on:** F27

**New files:**
- `src/plot/layers/LUTController.js`
- `src/plot/LUTHistogramController.js`

**Modified:** `src/plot/PlotController.js` — add `disablePanZoom` constructor option

---

#### F28a — LUTController

Generalization of `HistogramLUTController.js`. All existing behavior preserved; naming widened.

**Changes from `HistogramLUTController`:**
- `setData(flatArray, globalMin, globalMax)` replaces `setSpectrogramData` (old name kept as alias until CLEANUP)
- `version` getter — monotonic counter incremented on every `levelChanged` or `lutChanged`; use as `colorTrigger`
- Event `dataChanged` emitted after `setData` (replaces `histogramReady`)
- All 6 LUT presets, `autoLevel`, `getLUTArray`, `setLevels`, `setLUT` unchanged

**Events:** `levelChanged`, `lutChanged`, `dataChanged`

---

#### F28b — LUTHistogramController

Owns an internal `PlotController` configured as a read-only histogram viewer. Backing controller for `LUTPanel.jsx`.

**Constructor:** `new LUTHistogramController({ lutController, bins = 256 })`

**Internal `PlotController` configuration:**
- `disableDefaultDataLayer: true`
- `disablePanZoom: true` (new opt — see below)
- `xDomain: [globalMin, globalMax]` — value axis, updated on `dataChanged`
- `yDomain: [0, maxCount]` — count axis, auto-scaled to histogram peak
- Registers `'histogram-bars'` layer using `SolidPolygonLayer` — one rectangle per bin
- `ROIController` holds two `LineROI` objects in `hline` mode for `level_min` and `level_max`

**Public API:** `init(webglCanvas, axisCanvas)`, `destroy()`, `get plotController()`

**Event wiring:**
- `lutController.on('dataChanged')` → recompute bins → `markDirty()`
- `lutController.on('levelChanged')` → move hlines → `markDirty()`
- HLine `roiUpdated` (drag) → `lutController.setLevels(min, max)` → `levelChanged` → connected BitmapDataLayer bumps `colorTrigger`
- HLine `roiFinalized` (mouseUp) → same; this is the commit event (deferred server-side requests use this)

**`PlotController.disablePanZoom` option:**
- `this._disablePanZoom = opts.disablePanZoom ?? false` in constructor
- In `init()`: skip `_onWheel` listener when flag set
- In `_onMouseDown`: skip pan/right-drag-zoom path when flag set; ROI hit-test runs normally

**Verification:** Drag hlines → connected BitmapDataLayer recolorizes in real-time. `autoLevel()` moves hlines. Histogram bars reflect actual data distribution.

---

### F29 [PENDING] LUTPanel React Component

**Branch:** `feature/F28-F29` (same branch as F28)
**Depends on:** F28

**New file:** `ui/LUTPanel.jsx` — fresh component, not derived from `HistogramLUTPanel.jsx`

**Props:** `lutController`, `lutHistCtrl`, `width` (default 160), `height` (default '100%')

**Layout:**
```
┌──────────────────────────┬──┐
│  PlotCanvas              │  │
│  (histogram bars +       │LU│
│   hline level handles)   │T │
│                          │gd│
├──────────────────────────┤  │
│  [Colormap ▼] [Auto]     │  │
└──────────────────────────┴──┘
```

- Left: `PlotCanvas` bound to `lutHistCtrl.plotController` via `onInit`
- Right strip: 12 px LUT gradient canvas (2D), redraws on `lutController.on('lutChanged')`
- Bottom: colormap `<select>` + "Auto Level" `<button>`
- Level adjustment is via hline LineROIs inside the plot — no React drag handlers needed

**Verification:** Colormap dropdown updates gradient strip and connected BitmapDataLayer. Auto Level snaps to 2nd/98th percentile. Build zero errors.

---

### F30 [PENDING] AudioController

**Branch:** `feature/F30`
**Depends on:** ARCH-F (file location); conceptually independent of F27–F29

**New file:** `src/audio/AudioController.js`

Replaces scattered audio management across `PlaybackController.js`, `FilterController.js`, and `SpectrogramExample.jsx`. `PlaybackController.js` and `FilterController.js` are **not deleted** — kept for backwards compat until CLEANUP.

**Public API:**
```js
// Loading
await audioCtrl.loadFile(arrayBuffer)          // decode via Web Audio API → emit 'loaded'
audioCtrl.loadBuffer(samples, sampleRate)       // direct Float32Array → emit 'loaded'
audioCtrl.appendSamples(newSamples)             // streaming append

// Filter — stateless transform function
audioCtrl.setFilterFn((samples, sr) => Float32Array)
// Default: null (no filter). Bridge to FilterController:
//   audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr))
audioCtrl.getFilteredSamples()                  // returns filtered Float32Array (or raw)

// Playback
audioCtrl.play(offsetSec?)
audioCtrl.pause()
audioCtrl.stop()
audioCtrl.seek(timeSec)
audioCtrl.get currentTime
audioCtrl.get duration
audioCtrl.get isPlaying
audioCtrl.get sampleRate

// STFT / tile generation
audioCtrl.computeSTFT({ windowSize, hopSize, windowFn, tileWidthSec })
// Emits 'tileReady' per tile, then 'stftComplete'

// Streaming
audioCtrl.setStreamingInterval(ms)              // default 500; appendSamples triggers last-tile recompute
```

**Events:**
- `'loaded'` — `{ duration, sampleRate, samples: Float32Array }`
- `'stateChanged'` — `{ state: 'playing'|'paused'|'stopped' }`
- `'timeUpdate'` — `{ currentTime }` (~10 Hz during playback)
- `'tileReady'` — `{ tileIndex, power: Float32Array, width, height, globalMin, globalMax, bounds: [tStart, 0, tEnd, nyquist] }`
- `'stftComplete'`, `'streamingTick'`

**Filter compatibility:** `FilterController.js` unchanged. `ui/FilterPanel.jsx` continues using it unchanged. Bridge via `setFilterFn`:
```js
audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr));
```
DSP is therefore replaceable (WebAssembly later) without touching FilterPanel or FilterController.

**Verification:** Load file → play/pause/seek. Run STFT → `tileReady` fires per tile with correct `bounds`. Streaming append → last tile re-emits. Build zero errors.

---

### EX-Spec [PENDING] Spectrogram V2 Example

**Branch:** `feature/EX-Spec`
**Depends on:** F27, F28, F29, F30

**New files:** `examples/SpectrogramV2Example.jsx`, `examples/src/spectrogramV2.js`, `public/spectrogram-v2.html`

**Architecture:**
```
AudioController
  ├── 'tileReady'   → registerDataLayer('tile-N') with BitmapDataLayer per tile
  └── 'timeUpdate'  → playhead LineROI position update → ctrl.markDirty()

PlotController (spectrogram panel)
  ├── disableDefaultDataLayer: true
  ├── registerDataLayer('tile-0') → BitmapDataLayer { bounds:[0,0,t1,nyquist], lutController }
  ├── registerDataLayer('tile-N') → BitmapDataLayer { bounds:[tN,0,tEnd,nyquist], lutController }
  └── ROIController — user-drawn RectROIs for labeling

LUTController  →  levelChanged → colorTriggerRef++ → ctrl.markDirty()
LUTHistogramController + ui/LUTPanel.jsx (sidebar)
PlotController (waveform)  →  SignalStore pattern (existing)
ui/FilterPanel.jsx  →  audioCtrl.setFilterFn bridge
```

**Tile strategy (Option B — fixed-width time segments):**
- Each tile = `tileWidthSec` seconds of STFT frames (default 30 s)
- `AudioController` emits `'tileReady'` per tile; each registered as `'tile-N'` with matching `bounds`
- Streaming: on `'streamingTick'`, last tile's `dataTrigger` bumped → image re-resolved
- Trailing-edge artifact fix: last tile recomputed in full when new audio arrives

**Hub page:** Add "Spectrogram V2" card. Keep existing "Spectrogram" card with "(legacy)" suffix until CLEANUP.

**Verification:** Load audio → tiles appear. Adjust LUT → colors update in real-time. Play → playhead moves. Draw RectROI → overlays spectrogram. Waveform x-axis synced.

---

### CLEANUP [PENDING] Remove Legacy Spectrogram Code

**Branch:** `feature/cleanup-old-spectrogram`
**Depends on:** EX-Spec (verified working side-by-side)

**Delete:**
- `src/plot/layers/SpectrogramLayer.js`
- `src/plot/layers/HistogramLUTController.js`
- `ui/HistogramLUTPanel.jsx`
- `examples/SpectrogramExample.jsx`
- `examples/SpectrogramPopup.jsx`
- `examples/src/spectrogram.js`, `examples/src/spectrogram-popup.js`
- `public/spectrogram.html`, `public/spectrogram-popup.html`
- Webpack entries: `spectrogram`, `spectrogram-popup`

**Update:** HubPage (remove legacy card), README, prompt.md (remove SpectrogramLayer/HistogramLUTController from project structure diagram), PLAN.md (mark ARCH-F through CLEANUP as COMPLETED).

**Verification:** `npm run build` zero errors. All remaining pages work. `grep -r SpectrogramLayer src/` returns nothing.


---

## Recent Changelog

> Full history in [docs/plan-archive.md — Change Log](docs/plan-archive.md#change-log).

- **2026-03-14 [Claude]**: Phase 4 (Bitmap/LUT Refactor) added as PENDING (v7.0) — ARCH-F through CLEANUP. Motivation: decompose monolithic SpectrogramLayer into generic BitmapDataLayer + LUTController + LUTHistogramController. Mandatory order: ARCH-F → F27 → F28 → F29 → F30 → EX-Spec → CLEANUP.
- **2026-03-14 [Claude]**: ARCH-F completed (v7.1) — 9 webpack entry JS files moved from `src/` to `examples/src/`; `FilterPanel.jsx` and `HistogramLUTPanel.jsx` moved from `src/components/` to `ui/`; `src/components/` now holds only `PlotCanvas.jsx`; build passes zero errors. Next: F27 (unblocked).
- **2026-03-14 [Claude]**: F27 completed (v7.2) — `BitmapDataLayer.js` and `_buildBitmapFromGrid.js` created; accepts URL/ImageBitmap/TypedArray sources; `bitMapping` exclusive bounds vs origin+scale; per-layer `lutController` duck-typed; gray/rgb/rgba/gray+alpha channel handling; build zero errors. Next: F28 (unblocked).
