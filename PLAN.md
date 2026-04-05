# MasterPlot Implementation Plan

**Plan Version:** 9.7
**Last Updated:** 2026-04-04
**Status:** Phase 7 complete. B9 + ARCH-G + F34 + F35 + EX20 all done. No pending features.

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

8. **ON HOLD features are inert**: Features marked `⏸ ON HOLD` must not be used as dependencies by other features, and must not appear in any documentation page (Architecture, Getting Started, API Reference, Deep-Dives, README) outside of the Feature Status Index roadmap table. Treat them as if they do not exist until explicitly resumed by the user.

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
| F28 | LUTController + LUTHistogramController | ✅ COMPLETED | feature/F28 | 2026-03-14 |
| F29 | LUTPanel React Component | ✅ COMPLETED | feature/F29 | 2026-03-14 |
| F30 | AudioController | ✅ COMPLETED | feature/F30 | 2026-03-14 |
| EX-Spec | Spectrogram V2 Example | ✅ COMPLETED | feature/EX-Spec | 2026-03-14 |
| EX17 | SpectrogramV2 Waveform Controls Panel (layout fix) | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX14 | Reintroduce Stress-Test Audio Files | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX15 | First-Load Help Icon (Controls Overlay) | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX16 | Non-Spectrogram BitmapDataLayer Example | ✅ COMPLETED | feature/EX16 | 2026-03-15 |
| DOC6 | Documentation Update (Phase 4 complete) | ✅ COMPLETED | feature/DOC6 | 2026-03-15 |
| CLEANUP | Remove Legacy Spectrogram Code | ✅ COMPLETED | feature/cleanup-old-spectrogram | 2026-03-15 |
| F31  | BitmapViewGenerator (Viewport-Driven LOD) | ✅ COMPLETED | feature/F31-EX18-EX19 | 2026-03-21 |
| EX18 | Variable-Resolution Bitmap Example | ✅ COMPLETED | feature/F31-EX18-EX19 | 2026-03-21 |
| F32  | TableLoaderAdapter (CSV / Arrow / Parquet → scatter) | ✅ COMPLETED | feature/F32-F33-EX19 | 2026-03-28 |
| F33  | RasterLoaderAdapter (NetCDF / GeoTIFF / image → BitmapDataLayer) | ✅ COMPLETED | feature/F32-F33-EX19 | 2026-03-28 |
| EX19 | Data Loaders Example | ✅ COMPLETED | feature/F32-F33-EX19 | 2026-03-28 |
| B9   | ROILayer pixel-space border widths | ✅ COMPLETED | feature/B9 | 2026-04-04 |
| ARCH-G | AxisController Config/Domain Split | ✅ COMPLETED | feature/ARCH-G-F34-F35 | 2026-04-04 |
| F34  | Bordered Plot Mode | ✅ COMPLETED | feature/ARCH-G-F34-F35 | 2026-04-04 |
| F35  | Axis Positioning Modes | ✅ COMPLETED | feature/ARCH-G-F34-F35 | 2026-04-04 |
| EX20 | Axis Options Showcase | ✅ COMPLETED | feature/EX20 | 2026-04-04 |

---

> All completed feature specs are in [docs/plan-archive.md](docs/plan-archive.md).
> The Feature Status Index above is the authoritative completion record.

---

## Pending Features

**Mandatory implementation order:**

```
F27 → F28 → F29 → F30 → EX-Spec → EX17 ✅ → EX14 ✅ → EX15 ✅ → EX16 ✅ → DOC6 ✅ → CLEANUP ✅

F31 → EX18 ✅

F32 → F33 → EX19

B9  (independent — no dependencies) ✅

ARCH-G → F34 → F35 ✅

F35 → EX20
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

### F28 [COMPLETED] LUTController + LUTHistogramController
**Completed:** 2026-03-14 | **Branch:** feature/F28
Created `src/plot/layers/LUTController.js` (generalization of HistogramLUTController; `setData(arr,min,max)` + alias `setSpectrogramData`; `version` getter as colorTrigger; events: `levelChanged`/`lutChanged`/`dataChanged`) and `src/plot/LUTHistogramController.js` (owns internal `PlotController` with `disablePanZoom:true`; horizontal SolidPolygonLayer histogram bars; two `hline` LineROIs for level handles; bidirectional wiring with LUTController); added `disablePanZoom` option to `PlotController`; build zero errors.
Full spec: [docs/plan-archive.md#f28](docs/plan-archive.md#f28)

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

### F29 [COMPLETED] LUTPanel React Component
**Completed:** 2026-03-14 | **Branch:** feature/F29
Created `ui/LUTPanel.jsx`: props `lutController`/`lutHistCtrl`/`width`(160)/`height`('100%'); left area = two raw canvases wired via `lutHistCtrl.init(wc, ac)`; right = 12 px LUT gradient canvas redrawn on `lutChanged`; bottom = colormap `<select>` + Auto Level `<button>`; level adjustment via hline LineROIs inside the plot; build zero errors.
Full spec: [docs/plan-archive.md#f29](docs/plan-archive.md#f29)

---

### F30 [COMPLETED] AudioController
**Completed:** 2026-03-14 | **Branch:** feature/F30
Created `src/audio/AudioController.js`: unified audio controller absorbing PlaybackController + STFT/tile logic; `loadFile(arrayBuffer)` / `loadBuffer(samples, sr)` / `appendSamples()`; stateless `setFilterFn` bridge (compatible with FilterController); `play`/`pause`/`stop`/`seek` with `timeUpdate` at ~10 Hz; tiled STFT via `computeSTFT({windowSize, hopSize, windowFn, tileWidthSec})` emitting `tileReady` per tile + `stftComplete`; streaming timer recomputes last tile on `appendSamples`; build zero errors.
Full spec: [docs/plan-archive.md#f30](docs/plan-archive.md#f30)

---

### EX-Spec [COMPLETED] Spectrogram V2 Example
**Completed:** 2026-03-14 | **Branch:** feature/EX-Spec
Created `examples/SpectrogramV2Example.jsx` + `examples/src/spectrogramV2.js` + `public/spectrogram-v2.html`: AudioController `tileReady` → per-tile `BitmapDataLayer` registration; `timeUpdate` → playhead vline ROI; shared `LUTController` with `colorTrigger` bump on `levelChanged`/`lutChanged`; `LUTPanel` + `FilterPanel` sidebar; waveform `PlotController` (SignalStore/PathLayer) with x-domain sync; HubPage updated with V2 card (legacy card renamed); Architecture + API reference docs updated for Phase 4 classes; README updated; build zero errors.
Full spec: [docs/plan-archive.md#ex-spec](docs/plan-archive.md#ex-spec)

---

### EX17 [COMPLETED] SpectrogramV2 Waveform Controls Panel (layout fix)
**Completed:** 2026-03-15 | **Branch:** feature/EX17-EX14-EX15
Replaced full-width waveform row with two-column layout mirroring the spectrogram row; waveform plot is `flex:1` and a 160 px controls panel holds playback buttons, time display, Filter ↗ and Labels ↗ popup buttons; removed dead "Recompute STFT" button and moved all playback/popup controls out of the header; spectrogram and waveform x-axes now visually align.
Full spec: [docs/plan-archive.md#ex17](docs/plan-archive.md#ex17)

---

### EX14 [COMPLETED] Reintroduce Stress-Test Audio Files
**Completed:** 2026-03-15 | **Branch:** feature/EX17-EX14-EX15
Added `generateStressAudio(durationSec, sr)` helper in `SpectrogramV2Example.jsx` (chirp 200–4 kHz + pink noise + two AM tones, normalised ±0.9); added "Stress (60 s)" preset entry with `path: 'stress:60'`; `handlePresetChange` detects the `stress:` prefix, calls the generator, and loads via `AudioController.loadBuffer()`; no new files.
Full spec: [docs/plan-archive.md#ex14](docs/plan-archive.md#ex14)

---

### EX15 [COMPLETED] First-Load Help Icon (Controls Overlay)
**Completed:** 2026-03-15 | **Branch:** feature/EX17-EX14-EX15
Created `ui/HelpOverlay.jsx` (props: `title`, `controls: [{key,description}]`, `storageKey`; auto-opens on first visit via `localStorage`; always-visible `?` button with `position:absolute`; semi-transparent fixed modal with keybind table); added to all 6 example pages (`ExampleApp`, `LiveSignalsExample`, `MultiSensorExample`, `SeismographyExample`, `SharedDataExample`, `SpectrogramV2Example`) each with a unique `storageKey` and page-specific `controls` list; added `position:relative` to each page's outermost container.
Full spec: [docs/plan-archive.md#ex15](docs/plan-archive.md#ex15)

---

### EX16 [COMPLETED] Non-Spectrogram BitmapDataLayer Example
**Completed:** 2026-03-15 | **Branch:** feature/EX16
Created `examples/BitmapExample.jsx` + `examples/src/bitmap.js` + `public/bitmap.html`: three stacked panels — (1) local file via `createImageBitmap` with configurable `bitMapping` controls sidebar; (2) 256×256 Float32 sum-of-Gaussians heatmap with `LUTPanel` sidebar (level handles + colormap select + Auto Level); (3) URL image (NASA Blue Marble tile) with geographic lon/lat `bitMapping.bounds`; webpack entry + HtmlWebpackPlugin added; HubPage card added; README Bitmap section added; ApiReferencePage demo links added; build zero errors.
Full spec: [docs/plan-archive.md#ex16](docs/plan-archive.md#ex16)

---

### DOC6 [COMPLETED] Documentation Update (Phase 4 complete)
**Completed:** 2026-03-15 | **Branch:** feature/DOC6
ArchitecturePage: added `ui/` subgraph (LUTPanel, FilterPanel, HelpOverlay) to BITMAP_LUT_DIAGRAM + prose for `ui/` directory; ApiReferencePage: added `disablePanZoom` to PlotController options, added full `LUTPanel` and `HelpOverlay` sections; GettingStartedPage: added steps 8 (BitmapDataLayer heatmap quick-start) and 9 (AudioController spectrogram quick-start); RoiDeepDivePage verified accurate; build zero errors.
Full spec: [docs/plan-archive.md#doc6](docs/plan-archive.md#doc6)

---

### CLEANUP [COMPLETED] Remove Legacy Spectrogram Code
**Completed:** 2026-03-15 | **Branch:** feature/cleanup-old-spectrogram
Deleted `SpectrogramLayer.js`, `HistogramLUTController.js`, `HistogramLUTPanel.jsx`, `SpectrogramExample.jsx`, `examples/src/spectrogram.js`, `public/spectrogram.html`, and the `spectrogram` webpack entry; popup host files kept intact (still used by SpectrogramV2); HubPage legacy card removed; README and prompt.md project structure updated; build zero errors.
Full spec: [docs/plan-archive.md#cleanup](docs/plan-archive.md#cleanup)

---

## Phase 5 — Viewport-Driven LOD

**Motivation:** `BitmapDataLayer` currently renders at a fixed resolution set at load time. Zooming in on a spectrogram or heatmap shows a blurry upscaled tile; zooming out wastes GPU bandwidth on resolution that exceeds pixel density. `BitmapViewGenerator` adds a thin controller layer that debounces `domainChanged` events and re-generates or re-fetches the bitmap at exactly the resolution needed for the current viewport — locally for in-memory data, or via parameterized API calls for remote sources.

---

### F31 [COMPLETED] BitmapViewGenerator (Viewport-Driven LOD)
**Completed:** 2026-03-21 | **Branch:** feature/F31-EX18-EX19
Created `src/plot/layers/BitmapViewGenerator.js`: EventEmitter; `generate` (stale-seq) or `fetch` (AbortController) modes; debounced `domainChanged` → fires request → updates `_layerState`; `bumpColorTrigger()` for LUT recolorize without re-generation; `refresh()` bypasses debounce; `destroy()` unsubscribes + aborts + unregisters layer; `colorTrigger` added to `_layerState` and forwarded to `BitmapDataLayer`; build zero errors.
Full spec: [docs/plan-archive.md#f31](docs/plan-archive.md#f31)

---

### EX18 [COMPLETED] Variable-Resolution Bitmap Example
**Completed:** 2026-03-21 | **Branch:** feature/F31-EX18-EX19
Created `examples/BitmapLODExample.jsx` + `examples/src/bitmap-lod.js` + `public/bitmap-lod.html`: Panel 1 — 512×512 Float64 Gaussian base grid; `generate` callback slices visible domain + bilinear-resamples (slice→Float32 → bilinearResample); LUTPanel sidebar; debounce slider 50–500 ms; resolution readout. Panel 2 — CDS HiPS2FITS `fetch`; `coordsys=galactic` so ra/dec=galactic l/b; width/height parameterized from widthPx/heightPx; AbortSignal cancellation; loading/error badges. Webpack entry + HtmlWebpackPlugin added; HubPage card added; README Phase 5 section + BitmapViewGenerator API docs added; build zero errors.
Full spec: [docs/plan-archive.md#ex18](docs/plan-archive.md#ex18)

---

## Phase 6 — loaders.gl Data Loaders

**Motivation:** MasterPlot currently requires callers to manually decode files (Web Audio API for audio, `createImageBitmap` for images, hand-written parsers for CSV/NetCDF) before passing typed arrays to the engine. Adding loaders.gl adapter utilities covers the most common scientific file formats (CSV, Apache Arrow/Parquet, NetCDF, GeoTIFF) without touching the library core, so users can drop files straight onto plots.

**Directory:** `loaders/` (new top-level directory, parallel to `ui/`; framework-agnostic — no React). Per directory-ownership rules, these are optional convenience utilities, not library code — they do not go in `src/`.

**Packages required:** `@loaders.gl/core`, `@loaders.gl/csv`, `@loaders.gl/arrow`, `@loaders.gl/netcdf` (and optionally `@loaders.gl/images` for TIFF). All are tree-shakeable; users install only what they need.

---

### F32 [COMPLETED] TableLoaderAdapter (CSV / Arrow / Parquet → scatter)
**Completed:** 2026-03-28 | **Branch:** feature/F32-F33-EX19
Created `loaders/TableLoaderAdapter.js`: EventEmitter; `loadFile(File)` + `loadURL(url)`; CSVLoader (`object-row-table` shape) + ArrowLoader (`schema.fields` / `getChild()`); chunked `appendData()` per `chunkSize` rows with `'chunk'` progress events; coerces any numeric column type to Float32; BigInt64 warns once; null/NaN → 0 + `'parseWarning'`; `getColumns()` populated after load; `color` option accepts fn `(val)→[r,g,b,a]`.
Full spec: [docs/plan-archive.md#f32](docs/plan-archive.md#f32)

---

### F33 [COMPLETED] RasterLoaderAdapter (NetCDF / image → BitmapDataLayer)
**Completed:** 2026-03-28 | **Branch:** feature/F32-F33-EX19
Created `loaders/RasterLoaderAdapter.js`: EventEmitter; `loadFile(File)` routes `.nc`/`.cdf` to NetCDFLoader (`{netcdf:{loadData:true}}`), images to `createImageBitmap`; infers `bitMapping.bounds` from coordinate arrays with half-cell padding; `flipY` flips row order for raster convention; `loadArray(Float32Array, w, h, opts)` for in-memory data; wires `lutController` levelChanged/lutChanged to `colorTrigger` bump; `getVariables()` / `getDimensions()` populated after NetCDF load; calls `plotController.registerDataLayer()` + `markDirty()`. Note: `@loaders.gl/netcdf` only supports NetCDF v3 classic (not NetCDF4/HDF5).
Full spec: [docs/plan-archive.md#f33](docs/plan-archive.md#f33)

---

### EX19 [COMPLETED] Data Loaders Example
**Completed:** 2026-03-28 | **Branch:** feature/F32-F33-EX19
Created `examples/DataLoadersExample.jsx` + `examples/src/data-loaders.js` + `public/data-loaders.html`: Panel 1 — drag-and-drop CSV/Arrow; header-sniff column selects for X/Y/size; chunked load with progress bar + parseWarning display; "Load Sample CSV" generates 10k-row synthetic sensor CSV in-memory. Panel 2 — file input for .nc/.cdf/images; "Load Sample Grid" generates 128×128 Gaussian temperature field via `loadArray()`; LUTPanel sidebar; auto-scale axes on `'loaded'` event; HelpOverlay. Webpack entry + HtmlWebpackPlugin added; HubPage card added; README Phase 6 section added; ApiReferencePage sections for both adapters added; build zero errors (2 asset-size warnings from loaders.gl).
Full spec: [docs/plan-archive.md#ex19](docs/plan-archive.md#ex19)

---

---

## Phase 7 — Axis System Refactor

**Motivation:** The axis rendering system has two UX problems: (1) ROI borders thin to near-invisibility at extreme zoom (thousandths↔thousands of data units); (2) tick labels have no gutter background, so data renders through them making them illegible. Additionally, the `AxisController` mixes config/behavior with domain state, preventing sharing of axis configuration across multiple plots and coupling concerns that should be independent. This phase separates config from state, adds a bordered mode, and introduces flexible axis positioning.

---

### B9 [COMPLETED] ROILayer pixel-space border widths
**Completed:** 2026-04-04 | **Branch:** feature/B9
Added `lineWidthUnits: 'pixels'` to the two `PolygonLayer` outline instances in `ROILayer.js` (LinearRegion fill and RectROI fill); `PathLayer` and `ScatterplotLayer` sub-layers already had pixel units set; ROI borders now render at a fixed screen-pixel thickness regardless of zoom level.
Full spec: [docs/plan-archive.md#b9](docs/plan-archive.md#b9)

---

### ARCH-G [COMPLETED] AxisController Config/Domain Split
**Completed:** 2026-04-04 | **Branch:** feature/ARCH-G-F34-F35
`AxisController` is now config-only (`scaleType`, `tickCount`, `label`, `tickFormat`; methods: `getScale(domain, range)`, `getTicks(scale)`, `formatTick`, `getTickSize`); all domain-mutation methods (`setDomain`, `getDomain`, `zoomAround`, `panByPixels`, `scaleDomainFromMidpoint`) moved to `ViewportController` as `setXDomain`/`setYDomain`/`getXDomain`/`getYDomain`/`zoomAroundX`/`zoomAroundY`/`panByPixels({dx,dy})`/`scaleDomainFromMidpointX`/`scaleDomainFromMidpointY`; `PlotCanvas` gains `xAxis`/`yAxis` props; all 7 callers in examples + 3 src files updated.
Full spec: [docs/plan-archive.md#arch-g](docs/plan-archive.md#arch-g)

---

### F34 [COMPLETED] Bordered Plot Mode
**Completed:** 2026-04-04 | **Branch:** feature/ARCH-G-F34-F35
`PlotController({ bordered: true })` / `<PlotCanvas bordered />` fills the four axis gutter rectangles with `getComputedStyle(canvas.parentElement).backgroundColor` before ticks are drawn; skipped when container background is transparent; no-op when `bordered: false` (default); `AxisRenderer.setBordered(bool)` added.
Full spec: [docs/plan-archive.md#f34](docs/plan-archive.md#f34)

---

### F35 [COMPLETED] Axis Positioning Modes
**Completed:** 2026-04-04 | **Branch:** feature/ARCH-G-F34-F35
`AxisController` gains `mode`/`edges`/`crossingValue`/`snapTolerancePx`/`offscreen`/`labelSide` options. `AxisRenderer` refactored: `_renderXAxis`/`_renderYAxis` dispatch to border (multi-edge, grid once, outward ticks) or relative (anchor at data coordinate, off-screen/snap/mid-plot with tick-flip and labelSide); grid separated from tick rendering so multi-edge doesn't double grid lines.
Full spec: [docs/plan-archive.md#f35](docs/plan-archive.md#f35)

---

### EX20 [COMPLETED] Axis Options Showcase
**Completed:** 2026-04-04 | **Branch:** `feature/EX20`
**Files:** `examples/AxisShowcaseExample.jsx`, `examples/src/axis-showcase.js`, `public/axis-showcase.html`; webpack entry + HtmlWebpackPlugin; HubPage card; README section.
**Summary:** 2×3 grid of 6 independently pannable/zoomable plots — deterministic LCG 200-point scatter seeded once at module load (`SEED_DATA`). Covers all F34/F35 combos: bordered, no-border, mirrored edges, relative-stationary, mobile-snap, mobile-hide.

---

## Recent Changelog

> Full history in [docs/plan-archive.md — Change Log](docs/plan-archive.md#change-log).

- **2026-04-04 [Claude]**: EX20 completed (v9.7) — `AxisShowcaseExample.jsx` (2×3 CSS grid; 6 `PlotCell` components; deterministic LCG `makeData()` → 200-point `SEED_DATA`; each cell uses two raw `<canvas>` refs with `useEffect` init); webpack entry `axis-showcase.js`; HTML template; HubPage card; README section. Branch: `feature/EX20`.
- **2026-04-04 [Claude]**: F35 completed (v9.6) — `AxisController` gains `mode`/`edges`/`crossingValue`/`snapTolerancePx`/`offscreen`/`labelSide` positioning options. `AxisRenderer` refactored: `_renderXTicks`/`_renderYTicks` replaced by `_renderXAxis`/`_renderYAxis` dispatchers; border mode loops over `edges[]` with outward-facing ticks and single grid pass; relative mode anchors axis line to a data coordinate with snap-to-edge, off-screen handling, mid-plot tick-flip at viewport midpoint, and configurable label side. Branch: `feature/ARCH-G-F34-F35`.
- **2026-04-04 [Claude]**: F34 completed (v9.5) — `AxisRenderer._fillGutters()` fills four margin rects with container CSS background before tick rendering; `AxisRenderer.setBordered(bool)` public method; `PlotController` accepts `bordered` opt and calls `setBordered(true)` after `AxisRenderer` init; `PlotCanvas` forwards `bordered` prop; transparent/unset backgrounds are skipped. Branch: `feature/ARCH-G-F34-F35`.
- **2026-04-04 [Claude]**: ARCH-G completed (v9.4) — `AxisController` refactored to config-only (no domain state, no EventEmitter); domain mutation methods (`setXDomain`/`setYDomain`/`getXDomain`/`getYDomain`/`zoomAroundX`/`zoomAroundY`/`panByPixels({dx,dy})`/`scaleDomainFromMidpointX`/`scaleDomainFromMidpointY`) added to `ViewportController`; `PlotController` wires viewport `'domainChanged'` event; `PlotCanvas` gains `xAxis`/`yAxis` props; all 7 example/doc files + 3 src library files updated from old API; lib build zero errors. Branch: `feature/ARCH-G-F34-F35`.
- **2026-04-04 [Claude]**: B9 completed (v9.3) — Added `lineWidthUnits: 'pixels'` to the two `PolygonLayer` outline instances in `ROILayer.js` (LinearRegion fill and RectROI fill); PathLayer + ScatterplotLayer sub-layers already had pixel units; ROI borders now render at fixed screen-pixel thickness regardless of zoom. Branch: `feature/B9`.
- **2026-04-04 [Claude]**: Phase 7 (Axis System Refactor) added (v9.2) — B9 (ROILayer pixel-space widths; confirmed working on test branch), ARCH-G (AxisController config/domain split; domain methods move to ViewportController; shared-config pattern; breaking API change), F34 (bordered plot mode; gutter fill from CSS background), F35 (axis positioning modes; border multi-edge + relative/mobile with snap/offscreen/labelSide/tick-flip). Mandatory order: B9 independent; ARCH-G → F34 → F35 on single branch `feature/ARCH-G-F34-F35`.
- **2026-03-28 [Claude]**: F32/F33/EX19 completed (v9.1) — F32: `loaders/TableLoaderAdapter.js` (CSVLoader + ArrowLoader; chunked appendData; BigInt/null coercion; 'chunk'+'parseWarning' events); F33: `loaders/RasterLoaderAdapter.js` (NetCDFLoader for .nc/.cdf, createImageBitmap for images; coordinate-array bounds; flipY; loadArray() for in-memory grids; LUT wiring); EX19: `DataLoadersExample.jsx` two-panel demo (drag-and-drop CSV + synthetic 10k sample / image+nc drop + synthetic 128×128 temp field + LUTPanel); webpack entry/HTML added; HubPage card + README Phase 6 section + ApiReferencePage sections added; build zero errors.
- **2026-03-28 [Claude]**: Phase 6 (loaders.gl Data Loaders) added (v9.0) — F32 (`TableLoaderAdapter`: CSV/Arrow/Parquet → scatter; column mapping + streaming `parseInBatches`), F33 (`RasterLoaderAdapter`: NetCDF/GeoTIFF/image → `BitmapDataLayer`; coordinate bounds from metadata), EX19 (two-panel demo: drag-and-drop tabular + raster files). New top-level `loaders/` directory (framework-agnostic, not `src/`). Mandatory order: F32 → F33 → EX19. Branch: `feature/F32-F33-EX19`.
- **2026-03-14 [Claude]**: Phase 4 (Bitmap/LUT Refactor) added as PENDING (v7.0) — ARCH-F through CLEANUP. Motivation: decompose monolithic SpectrogramLayer into generic BitmapDataLayer + LUTController + LUTHistogramController. Mandatory order: ARCH-F → F27 → F28 → F29 → F30 → EX-Spec → CLEANUP.
- **2026-03-14 [Claude]**: ARCH-F completed (v7.1) — 9 webpack entry JS files moved from `src/` to `examples/src/`; `FilterPanel.jsx` and `HistogramLUTPanel.jsx` moved from `src/components/` to `ui/`; `src/components/` now holds only `PlotCanvas.jsx`; build passes zero errors. Next: F27 (unblocked).
- **2026-03-14 [Claude]**: F27 completed (v7.2) — `BitmapDataLayer.js` and `_buildBitmapFromGrid.js` created; accepts URL/ImageBitmap/TypedArray sources; `bitMapping` exclusive bounds vs origin+scale; per-layer `lutController` duck-typed; gray/rgb/rgba/gray+alpha channel handling; build zero errors. Next: F28 (unblocked).
- **2026-03-14 [Claude]**: F28 completed (v7.3) — `LUTController.js` (generalizes HistogramLUTController; `setData`/`setSpectrogramData` alias; `version` getter; `levelChanged`/`lutChanged`/`dataChanged` events) and `LUTHistogramController.js` (internal PlotController with `disablePanZoom:true`; SolidPolygonLayer histogram bars; hline LineROIs for level handles; bidirectional LUT↔ROI wiring); `PlotController.disablePanZoom` option added; build zero errors. Next: F29 (unblocked).
- **2026-03-14 [Claude]**: F29 completed (v7.4) — `ui/LUTPanel.jsx` (fresh component; props: `lutController`/`lutHistCtrl`/`width`/`height`; two raw canvases wired to `lutHistCtrl.init()`; 12 px LUT gradient with ResizeObserver + `lutChanged` listener; colormap select from `LUTController.presetNames`; Auto Level button; level drag via hline ROIs in plot); build zero errors. Next: F30 (unblocked).
- **2026-03-14 [Claude]**: F30 completed (v7.5) — `src/audio/AudioController.js` (unified audio controller; `loadFile(arrayBuffer)` via Web Audio decodeAudioData + `loadBuffer(samples, sr)` direct + `appendSamples` streaming; stateless `setFilterFn` bridge compatible with FilterController.applyToSamples; play/pause/stop/seek with `timeUpdate` at ~10 Hz; tiled STFT via `computeSTFT({windowSize, hopSize, windowFn, tileWidthSec=30})` emitting `tileReady` per fixed-width tile + `stftComplete`; streaming timer recomputes last tile on each `appendSamples` tick; `destroy()` cleans all timers + AudioContext); build zero errors. Next: EX-Spec (unblocked).
- **2026-03-21 [Claude]**: F31/EX18 completed (v8.0) — F31: `BitmapViewGenerator` (`src/plot/layers/BitmapViewGenerator.js`); generate (stale-seq) + fetch (AbortController) modes; debounced domainChanged; `bumpColorTrigger()` for LUT recolorize; `colorTrigger` added to `_layerState`. EX18: `BitmapLODExample.jsx` — Panel 1 bilinear LOD on 512×512 Gaussian grid + LUTPanel; Panel 2 CDS HiPS2FITS fetch with AbortSignal + loading badges; webpack/HTML/HubPage/README/API docs added; build zero errors.- **2026-03-15 [Claude]**: EX17 completed (v7.9) — waveform controls panel: 160 px panel mirrors LUTPanel column; playback buttons + time display + Filter ↗ + Labels ↗ moved from header to controls panel; dead "Recompute STFT" button removed; x-axes visually aligned; build zero errors.
- **2026-03-15 [Claude]**: EX14 completed (v7.10) — `generateStressAudio(60, 22050)` synthesises chirp + pink noise + AM tones; "Stress (60 s)" preset added; `handlePresetChange` routes `stress:N` path to generator + `loadBuffer`; no new files; build zero errors.
- **2026-03-15 [Claude]**: EX15 completed (v7.11) — `ui/HelpOverlay.jsx` created; added to ExampleApp, LiveSignalsExample, MultiSensorExample, SeismographyExample, SharedDataExample, SpectrogramV2Example with unique storageKey + per-page controls list; `position:relative` added to each outer container; build zero errors. Next: EX16 (unblocked).
- **2026-03-15 [Claude]**: EX16 completed (v7.12) — `examples/BitmapExample.jsx` + `examples/src/bitmap.js` + `public/bitmap.html`; three panels: local file (createImageBitmap + configurable bitMapping sidebar), 256×256 Float32 Gaussian heatmap (LUTPanel with live level handles + colormap select), URL image (NASA tile with geographic bounds); webpack entry + HtmlWebpackPlugin; HubPage card; README section; ApiReferencePage demo links; build zero errors. Next: DOC6 (unblocked).
- **2026-03-15 [Claude]**: CLEANUP completed (v7.14) — deleted `SpectrogramLayer.js`, `HistogramLUTController.js`, `HistogramLUTPanel.jsx`, `SpectrogramExample.jsx`, `examples/src/spectrogram.js`, `public/spectrogram.html`, webpack `spectrogram` entry; popup host (`SpectrogramPopup.jsx` / `spectrogram-popup.html`) retained as it is shared by SpectrogramV2; HubPage legacy card removed; README audio-subsystem tree + file tree updated; prompt.md project structure updated; build zero errors.
- **2026-03-21 [Claude]**: Phase 5 (Viewport-Driven LOD) added (v8.0) — F31 (`BitmapViewGenerator`), EX18 (variable-resolution bitmap demo). Mandatory order: F31 → EX18. Branch: `feature/F31-EX18-EX19`.
- **2026-03-15 [Claude]**: DOC6 completed (v7.13) — ArchitecturePage: `ui/` subgraph added to BITMAP_LUT_DIAGRAM (LUTPanel/FilterPanel/HelpOverlay), `ui/` prose paragraph added; ApiReferencePage: `disablePanZoom` option added to PlotController table, full `LUTPanel` section (props table + usage callout) and `HelpOverlay` section (props table + placement callout) added; GettingStartedPage: step 8 (BitmapDataLayer heatmap + LUTPanel quick-start) and step 9 (AudioController + STFT spectrogram quick-start) added; RoiDeepDivePage verified accurate (no Phase 4 ROI changes); build zero errors. Next: CLEANUP (unblocked).
- **2026-03-15 [Claude]**: Added EX17 (SpectrogramV2 waveform layout fix + controls panel) (v7.8) — slots between EX-Spec and EX14; removes dead Recompute STFT button; moves playback+popup controls to 160 px panel next to waveform to align x-axes.
- **2026-03-15 [Claude]**: Added EX14/EX15/EX16/DOC6 from Features.md (v7.7) — inserted before CLEANUP; mandatory order updated to `EX-Spec → EX14 → EX15 → EX16 → DOC6 → CLEANUP`.
- **2026-03-14 [Claude]**: EX-Spec completed (v7.6) — `examples/SpectrogramV2Example.jsx` + entry `examples/src/spectrogramV2.js` + `public/spectrogram-v2.html` + `webpack.config.js` entry + HtmlWebpackPlugin; module-level state pattern (React owns no geometry); AudioController `tileReady` → `_registerTileLayer` → `BitmapDataLayer` per tile; shared `LUTController` with `_colorTrigger` bump on `levelChanged`/`lutChanged`; `LUTHistogramController` + `LUTPanel` sidebar; `FilterPanel` sidebar with `setFilterFn` bridge + Recompute STFT; waveform `PlotController` (SignalStore PathLayer) with x-domain domainChanged sync; playhead vline LineROI updated via `updateFromExternal` on `timeUpdate`; R key → RectROI annotation; HubPage V2 card added + legacy card renamed; ArchitecturePage Phase 4 diagram + prose; ApiReferencePage LUTController/LUTHistogramController/BitmapDataLayer/AudioController sections; README AudioController + EX-Spec sections; build zero errors. Next: CLEANUP (unblocked).
