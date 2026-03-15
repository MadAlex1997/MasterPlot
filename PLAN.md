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
| F28 | LUTController + LUTHistogramController | ✅ COMPLETED | feature/F28 | 2026-03-14 |
| F29 | LUTPanel React Component | ✅ COMPLETED | feature/F29 | 2026-03-14 |
| F30 | AudioController | ✅ COMPLETED | feature/F30 | 2026-03-14 |
| EX-Spec | Spectrogram V2 Example | ✅ COMPLETED | feature/EX-Spec | 2026-03-14 |
| EX17 | SpectrogramV2 Waveform Controls Panel (layout fix) | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX14 | Reintroduce Stress-Test Audio Files | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX15 | First-Load Help Icon (Controls Overlay) | ✅ COMPLETED | feature/EX17-EX14-EX15 | 2026-03-15 |
| EX16 | Non-Spectrogram BitmapDataLayer Example | ✅ COMPLETED | feature/EX16 | 2026-03-15 |
| DOC6 | Documentation Update (Phase 4 complete) | ✅ COMPLETED | feature/DOC6 | 2026-03-15 |
| CLEANUP | Remove Legacy Spectrogram Code | 🔲 PENDING | — | — |

---

> All completed feature specs are in [docs/plan-archive.md](docs/plan-archive.md).
> The Feature Status Index above is the authoritative completion record.

---

## Pending Features

**Mandatory implementation order:**

```
F27 → F28 → F29 → F30 → EX-Spec → EX17 ✅ → EX14 ✅ → EX15 ✅ → EX16 ✅ → DOC6 ✅ → CLEANUP
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
- **2026-03-14 [Claude]**: F28 completed (v7.3) — `LUTController.js` (generalizes HistogramLUTController; `setData`/`setSpectrogramData` alias; `version` getter; `levelChanged`/`lutChanged`/`dataChanged` events) and `LUTHistogramController.js` (internal PlotController with `disablePanZoom:true`; SolidPolygonLayer histogram bars; hline LineROIs for level handles; bidirectional LUT↔ROI wiring); `PlotController.disablePanZoom` option added; build zero errors. Next: F29 (unblocked).
- **2026-03-14 [Claude]**: F29 completed (v7.4) — `ui/LUTPanel.jsx` (fresh component; props: `lutController`/`lutHistCtrl`/`width`/`height`; two raw canvases wired to `lutHistCtrl.init()`; 12 px LUT gradient with ResizeObserver + `lutChanged` listener; colormap select from `LUTController.presetNames`; Auto Level button; level drag via hline ROIs in plot); build zero errors. Next: F30 (unblocked).
- **2026-03-14 [Claude]**: F30 completed (v7.5) — `src/audio/AudioController.js` (unified audio controller; `loadFile(arrayBuffer)` via Web Audio decodeAudioData + `loadBuffer(samples, sr)` direct + `appendSamples` streaming; stateless `setFilterFn` bridge compatible with FilterController.applyToSamples; play/pause/stop/seek with `timeUpdate` at ~10 Hz; tiled STFT via `computeSTFT({windowSize, hopSize, windowFn, tileWidthSec=30})` emitting `tileReady` per fixed-width tile + `stftComplete`; streaming timer recomputes last tile on each `appendSamples` tick; `destroy()` cleans all timers + AudioContext); build zero errors. Next: EX-Spec (unblocked).
- **2026-03-15 [Claude]**: EX17 completed (v7.9) — waveform controls panel: 160 px panel mirrors LUTPanel column; playback buttons + time display + Filter ↗ + Labels ↗ moved from header to controls panel; dead "Recompute STFT" button removed; x-axes visually aligned; build zero errors.
- **2026-03-15 [Claude]**: EX14 completed (v7.10) — `generateStressAudio(60, 22050)` synthesises chirp + pink noise + AM tones; "Stress (60 s)" preset added; `handlePresetChange` routes `stress:N` path to generator + `loadBuffer`; no new files; build zero errors.
- **2026-03-15 [Claude]**: EX15 completed (v7.11) — `ui/HelpOverlay.jsx` created; added to ExampleApp, LiveSignalsExample, MultiSensorExample, SeismographyExample, SharedDataExample, SpectrogramV2Example with unique storageKey + per-page controls list; `position:relative` added to each outer container; build zero errors. Next: EX16 (unblocked).
- **2026-03-15 [Claude]**: EX16 completed (v7.12) — `examples/BitmapExample.jsx` + `examples/src/bitmap.js` + `public/bitmap.html`; three panels: local file (createImageBitmap + configurable bitMapping sidebar), 256×256 Float32 Gaussian heatmap (LUTPanel with live level handles + colormap select), URL image (NASA tile with geographic bounds); webpack entry + HtmlWebpackPlugin; HubPage card; README section; ApiReferencePage demo links; build zero errors. Next: DOC6 (unblocked).
- **2026-03-15 [Claude]**: DOC6 completed (v7.13) — ArchitecturePage: `ui/` subgraph added to BITMAP_LUT_DIAGRAM (LUTPanel/FilterPanel/HelpOverlay), `ui/` prose paragraph added; ApiReferencePage: `disablePanZoom` option added to PlotController table, full `LUTPanel` section (props table + usage callout) and `HelpOverlay` section (props table + placement callout) added; GettingStartedPage: step 8 (BitmapDataLayer heatmap + LUTPanel quick-start) and step 9 (AudioController + STFT spectrogram quick-start) added; RoiDeepDivePage verified accurate (no Phase 4 ROI changes); build zero errors. Next: CLEANUP (unblocked).
- **2026-03-15 [Claude]**: Added EX17 (SpectrogramV2 waveform layout fix + controls panel) (v7.8) — slots between EX-Spec and EX14; removes dead Recompute STFT button; moves playback+popup controls to 160 px panel next to waveform to align x-axes.
- **2026-03-15 [Claude]**: Added EX14/EX15/EX16/DOC6 from Features.md (v7.7) — inserted before CLEANUP; mandatory order updated to `EX-Spec → EX14 → EX15 → EX16 → DOC6 → CLEANUP`.
- **2026-03-14 [Claude]**: EX-Spec completed (v7.6) — `examples/SpectrogramV2Example.jsx` + entry `examples/src/spectrogramV2.js` + `public/spectrogram-v2.html` + `webpack.config.js` entry + HtmlWebpackPlugin; module-level state pattern (React owns no geometry); AudioController `tileReady` → `_registerTileLayer` → `BitmapDataLayer` per tile; shared `LUTController` with `_colorTrigger` bump on `levelChanged`/`lutChanged`; `LUTHistogramController` + `LUTPanel` sidebar; `FilterPanel` sidebar with `setFilterFn` bridge + Recompute STFT; waveform `PlotController` (SignalStore PathLayer) with x-domain domainChanged sync; playhead vline LineROI updated via `updateFromExternal` on `timeUpdate`; R key → RectROI annotation; HubPage V2 card added + legacy card renamed; ArchitecturePage Phase 4 diagram + prose; ApiReferencePage LUTController/LUTHistogramController/BitmapDataLayer/AudioController sections; README AudioController + EX-Spec sections; build zero errors. Next: CLEANUP (unblocked).
