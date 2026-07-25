# MasterPlot Implementation Plan

**Plan Version:** 9.20
**Last Updated:** 2026-07-25
**Status:** Phase 7 + Phase 8 + Phase 9 complete. Phase 10 (1.0.0 Release Hardening) in progress — REL1, REL2, REL3, REL4, REL5, REL6 complete; REL7–REL9 pending. No pending feature work; all pending work is release-hardening (tests, types, CI, packaging).

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
| F36 | ROI Interaction Control (movable/resizable lock + pickable) | ✅ COMPLETED | feature/F36 | 2026-07-24 |
| F37 | Rect Zoom Mode (middle-click drag-to-zoom) | ✅ COMPLETED | feature/F37 | 2026-07-24 |
| F38 | Configurable Mouse Button Bindings | ✅ COMPLETED | feature/F38 | 2026-07-24 |
| REL1 | Dependency Footprint Audit & loaders.gl Isolation | ✅ COMPLETED | feature/REL1 | 2026-07-24 |
| REL2 | npm Package Metadata & Publish Readiness | ✅ COMPLETED | feature/REL2 | 2026-07-24 |
| REL3 | Test Infrastructure & Core Coverage | ✅ COMPLETED | feature/REL3 | 2026-07-24 |
| REL4 | TypeScript Declarations | ✅ COMPLETED | feature/REL4 | 2026-07-24 |
| REL5 | CI Quality Gate (lint + typecheck + test) | ✅ COMPLETED | feature/REL5 | 2026-07-24 |
| REL6 | CHANGELOG + Semver Policy + Drop "Experimental" Framing | ✅ COMPLETED | feature/REL6 | 2026-07-25 |
| REL7 | Public API Input Validation | 🔲 PENDING | — | — |
| REL8 | Peer Dependency Range Audit | 🔲 PENDING | — | — |
| REL9 | Cut & Publish v1.0.0 | 🔲 PENDING | — | — |

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

F35 → EX20 ✅

F36  (independent — no dependencies) ✅

F37  (independent — no dependencies) ✅

F38  (depends on F37 — remaps the button F37 hardcodes to middle-click) ✅

REL1  (independent — no dependencies)

REL2  (depends on REL1 — files/dependencies must be final before locking package metadata)

REL3a → REL3b  (independent of other REL items)

REL4  (independent — no dependencies)

REL5  (depends on REL3a for `npm test`, REL4 for `tsc --noEmit`)

REL6  (depends on REL3, REL4 — claims made in README/CHANGELOG must be true when written)

REL7  (independent — no dependencies)

REL8  (independent — no dependencies)

REL9  (depends on REL1–REL8 — final release gate, requires explicit user go-ahead before `npm publish`)
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

## Phase 8 — ROI Interaction Control

**Motivation:** `ROIBase.flags` declared `movable` and `resizable` but `ROIController` never read them; `ROILayer` hardcoded deck.gl `pickable: true` with no per-ROI override. This phase wired both up.

---

### F36 [COMPLETED] ROI Interaction Control (movable/resizable lock + pickable)
**Completed:** 2026-07-24 | **Branch:** feature/F36
Added `pickable: true` to `ROIBase` default flags; `ROIController._hitTest` now skips non-pickable ROIs, and `_onMouseDown` gates drag-start on `movable`/`resizable` per handle type (locked ROIs stay selectable, just un-draggable); new `ROIController.setFlags(id, patch)` helper (no version bump — flags are behavioural, not geometric); `ROILayer` fill-layer `pickable` prop now reads `roi.flags.pickable !== false`; `ExampleApp.jsx` ROI tables (EX6) got Locked/Pickable checkbox columns; docs updated (RoiDeepDivePage §7, ApiReferencePage, README).
Full spec: [docs/plan-archive.md#f36](docs/plan-archive.md#f36)

---

## Phase 9 — Rect Zoom Mode

**Motivation:** Users currently zoom via wheel (cursor-centered) or right-click-drag (axis-scaling, F6). Neither lets a user precisely select an arbitrary rectangular region and zoom directly to it. This adds an opt-in mode: press middle mouse button, drag diagonally to draw a rectangle from wherever the pointer started to wherever it is now, release to zoom the viewport to exactly that rectangle's data bounds.

---

### F37 [COMPLETED] Rect Zoom Mode (middle-click drag-to-zoom)
**Completed:** 2026-07-24 | **Branch:** feature/F37
Opt-in rect-zoom action on `PlotController` (enabled via F38's `mouseButtons` mapping — no separate flag): dragging a button assigned `'rectZoom'` draws a live `PolygonLayer` rectangle overlay (log-scale aware) between press and current cursor position, release zooms `viewport.setDomains()` to the exact data bounds; sub-3px drags no-op; wired into `ExampleApp.jsx` via a checkbox + HelpOverlay entry; README + ApiReferencePage updated.
Full spec: [docs/plan-archive.md#f37](docs/plan-archive.md#f37)

---

### F38 [COMPLETED] Configurable Mouse Button Bindings
**Completed:** 2026-07-24 | **Branch:** feature/F38
`PlotController` gains `mouseButtons` constructor option + `setMouseButtons()` runtime setter — a `{ left, middle, right }` → `'pan'|'zoomDrag'|'rectZoom'|'none'` map (default `{ left: 'pan', middle: 'none', right: 'zoomDrag' }`) replacing hardcoded `e.button === N` checks in `_onMouseDown`/`_onMouseMove`/`_onMouseUp`; pan's inlined start/move logic extracted into `_handlePanDown`/`_handlePanMove` for parity with F6/F37's handlers; F37's separate `rectZoomMode` flag/`setRectZoomMode()` removed entirely — rect-zoom is now enabled solely by assigning `'rectZoom'` to a button. README + ApiReferencePage updated.
Full spec: [docs/plan-archive.md#f38](docs/plan-archive.md#f38)

---

## Phase 10 — 1.0.0 Release Hardening

**Motivation:** Phases 4–9 left MasterPlot feature-complete, but it has never been published and does not yet meet the bar of a "real" 1.0.0 library release: zero automated tests, no TypeScript declarations, no CI quality gate (only a demo-deploy workflow), incomplete npm package metadata, a dependency graph that forces every consumer to install the full loaders.gl + Node-polyfill tree regardless of whether they touch `masterplot/loaders`, and a README that still opens with "Experimental — expect breaking changes and rough edges." This phase is hardening only — no new user-facing features.

---

### REL1 [COMPLETED] Dependency Footprint Audit & loaders.gl Isolation
**Completed:** 2026-07-24 | **Branch:** feature/REL1
`@loaders.gl/*` + `zstd-codec` moved from `dependencies` to optional `peerDependencies` (never bundled — true peers of `masterplot/loaders` only); `lz4js`/`snappyjs` moved to `devDependencies` (already inlined into the shipped loaders bundle by rollup, never needed by consumers); the 6 Node polyfills moved to `devDependencies` (demo-build-only, never imported by library code); README "Data Loaders" install instructions updated to match.
Full spec: [docs/plan-archive.md#rel1](docs/plan-archive.md#rel1)

---

### REL2 [COMPLETED] npm Package Metadata & Publish Readiness
**Completed:** 2026-07-24 | **Branch:** feature/REL2
`package.json` gained `author`/`homepage`/`repository`/`bugs`/`keywords`/`engines.node: ">=18"`/`"sideEffects": false` (audit found zero module-scope side effects across `src/`, `ui/`, `loaders/`); `.npmignore` deleted (proven byte-for-byte redundant against the `files` allowlist via dry-run diff); untracked `masterplot-*.tgz` local-pack artifacts removed from repo root, `.gitignore` generalized to `*.tgz`.
Full spec: [docs/plan-archive.md#rel2](docs/plan-archive.md#rel2)

---

### REL3 [COMPLETED] Test Infrastructure & Core Coverage
**Completed:** 2026-07-24 | **Branch:** feature/REL3
Added Vitest + jsdom + `@testing-library/react` (`test`/`test:watch` scripts, `vitest.config.mjs`, jsdom environment); 104 tests across 6 files in `test/` covering `ViewportController` (pan/zoom domain math incl. the y-axis inverted-range sign convention), `ROI/ConstraintEngine` (shift/clamp/xLocked/multi-level cascade), `ROI/ROIBase` + `ROIController` versioning (`bumpVersion`, `updateFromExternal` gating), `DataStore` (ring buffer eviction, `_grow()` 1.5× policy, wrap-boundary correctness), `PlotDataView` (dirty propagation incl. the `roiUpdated`-must-not-recompute rule, `filterByDomain`/`filterByROI`, `histogram()`), and `AxisController` (linear/log/time scales, `formatTick`).
Full spec: [docs/plan-archive.md#rel3](docs/plan-archive.md#rel3)

---

### REL4 [COMPLETED] TypeScript Declarations
**Completed:** 2026-07-24 | **Branch:** feature/REL4
Hand-written `.d.ts` for all three entry points (`src/index.d.ts`, `ui/index.d.ts`, `loaders/index.d.ts`, co-located with their `.js`/`.jsx` sources), covering every exported class/function/component across ~38 symbols; `package.json` gained `"types"` + a `types` condition on each `exports` subpath; `test-types/smoke.tsx` (throwaway, not shipped) + `test-types/tsconfig.json` exercise the full API surface via the real `masterplot`/`masterplot/ui`/`masterplot/loaders` self-referencing package imports; `npm run typecheck` runs `tsc --noEmit` against it.
Full spec: [docs/plan-archive.md#rel4](docs/plan-archive.md#rel4)

---

### REL5 [COMPLETED] CI Quality Gate (lint + typecheck + test)
**Completed:** 2026-07-24 | **Branch:** feature/REL5
Added ESLint 9 flat config (`eslint.config.mjs`) scoped to `src/`/`ui/`/`loaders/`/`test/` (not `examples/` — demo scaffolding, per this repo's own directory-ownership rules) with correctness-only rules (`no-unused-vars`, `no-undef`, `eslint-plugin-react-hooks` recommended for `ui/` + `src/components/`); fixed the ~14 real findings the first lint pass surfaced (unused params, unused React imports under the automatic JSX runtime, a genuine `react-hooks/set-state-in-effect` issue in `HelpOverlay.jsx`) rather than suppressing them. New `.github/workflows/ci.yml` runs `npm ci → build → lint → test → typecheck` on PRs + push to `main`; `deploy.yml` untouched.
Full spec: [docs/plan-archive.md#rel5](docs/plan-archive.md#rel5)

---

### REL6 [COMPLETED] CHANGELOG + Semver Policy + Drop "Experimental" Framing
**Completed:** 2026-07-25 | **Branch:** feature/REL6
Created `CHANGELOG.md` (Keep a Changelog format) with an `[Unreleased]` section for the remaining REL7/REL8 hardening work and a single dated `[1.0.0] - 2026-07-25` entry summarizing all pre-1.0 development by category (core rendering, ROI, data pipeline, bitmap/LUT, audio, loaders, utilities, release engineering), since pre-1.0 history had no per-version compatibility guarantees; removed the README's `> **Experimental**` banner and replaced it with a "Stability" section stating the semver policy (`src/` → `masterplot` is semver-stable; `ui/` → `masterplot/ui` and `loaders/` → `masterplot/loaders` are convenience layers that may move faster) and linking to the new CHANGELOG.
Full spec: [docs/plan-archive.md#rel6](docs/plan-archive.md#rel6)

---

### REL7 [PENDING] Public API Input Validation
**Branch:** `feature/REL7`
**Depends on:** none (independent)

**Problem:** Constructor options and adapter contracts are almost entirely unvalidated — malformed input produces cryptic downstream errors (undefined property access, NaN into GPU buffers) instead of an actionable message at the boundary. F38's `mouseButtons` validation (warn + fallback on an unrecognized action name) is the one place this pattern already exists — extend it to the rest of the public surface.

**Scope (boundary-only — this is real external/user input, not the "don't validate what can't happen" case):**
- `PlotController` constructor options
- `DataStore.appendData()` — shape/type check on the incoming buffer struct
- `ExternalDataAdapter` / `ExternalROIAdapter` — validate adapter method signatures at registration time, not first use
- `ROIController.updateFromExternal()` — validate serialized ROI shape before version-gating

**Verification:** A malformed constructor option or adapter throws or warns (matching F38's precedent) with a message naming the offending field.

---

### REL8 [PENDING] Peer Dependency Range Audit
**Branch:** `feature/REL8`
**Depends on:** none (independent)

**Problem:** All `peerDependencies` are open-ended lower bounds (`>=9`, `>=18`, `>=3`/`>=4`). A future breaking major of deck.gl/luma.gl/React won't be caught by the peer range — npm will let it install silently.

**Changes:**
- Pin the tested upper bound per peer (e.g. `"@deck.gl/core": ">=9 <10"`) based on versions currently verified in this repo
- Document the tested version matrix in README
- Widen deliberately (not automatically) only after a new peer major is verified to work

**Verification:** Installing a peer one major above the tested range produces an `ERESOLVE`/peer warning instead of silently succeeding.

---

### REL9 [PENDING] Cut & Publish v1.0.0
**Branch:** `feature/REL9`
**Depends on:** REL1–REL8 (all)

Final gate — no code changes beyond version metadata and release notes.

- Clean `npm run build` + `npm test` + `npm run lint` + `tsc --noEmit` on `main`
- `npm pack --dry-run` review confirming REL1/REL2 changes took effect
- `npm publish` — **requires explicit user go-ahead**, this is an irreversible public action
- `git tag v1.0.0` + GitHub release notes generated from `CHANGELOG.md`

**Verification:** `npm install masterplot` from the public registry works end-to-end for a minimal `PlotController` + scatter example in a scratch project.

---

## Recent Changelog

> Full history in [docs/plan-archive.md — Change Log](docs/plan-archive.md#change-log).

- **2026-07-25 [Claude]**: REL6 completed (v9.20) — created `CHANGELOG.md` (Keep a Changelog format): an `[Unreleased]` section for the remaining REL7/REL8 hardening still pending before `npm publish`, and a single dated `[1.0.0] - 2026-07-25` entry summarizing all pre-1.0 work by subsystem (core rendering/interaction, ROI system, data pipeline, bitmap/LUT + viewport LOD, audio, data loaders, utilities, release engineering) as user-facing capability bullets rather than implementation diffs — pre-1.0 history had no per-version compatibility guarantees, so it's deliberately not reconstructed as a fictitious multi-version history. Removed the README's `> **Experimental**` banner and replaced it with a `## Stability` section: states that 1.0.0 is the first release where a breaking change requires a major bump, plus a 3-row table mapping each package entry point to its stability tier (`masterplot`/`src` = semver-stable; `masterplot/ui` and `masterplot/loaders` = convenience layers that may move faster, tracking upstream churn per REL1's loaders.gl isolation); links to the new CHANGELOG. Verified via grep that no "Experimental" framing remains outside PLAN.md's own historical entries. Branch: `feature/REL6`.
- **2026-07-24 [Claude]**: REL5 completed (v9.19) — added ESLint 9 (flat config, `eslint.config.mjs`) as a devDependency (`eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `globals`); scoped linting to `src/`, `ui/`, `loaders/`, `test/` only — `examples/` (60+ of the 134 initial findings, mostly dead example/doc-page code) was deliberately excluded as a scoping decision, since it's demo/docs scaffolding rather than the shipped library per this repo's own directory-ownership rules (prompt.md rule 5a), and cleaning it up was out of scope for "set up the gate." Within the chosen scope, fixed every real finding rather than config-suppressing: removed 4 unused `import React from 'react'` statements (dead under the project's `runtime: 'automatic'` JSX babel preset — `PlotCanvas.jsx`, `FilterPanel.jsx`, `HelpOverlay.jsx`, `LUTPanel.jsx`), dropped two genuinely-unused params (`globalMin`/`globalMax`) from `LUTHistogramController._rebuildBars()` and both its call sites rather than just silencing the warning, renamed 5 intentionally-unused handler/stub params to a `_`-prefix convention (`ROIController._onMouseUp`/`_handleLinearCreationClick`, `ExternalDataAdapter.replaceData/appendData`, `ExternalROIAdapter.save/subscribe`) with a matching `argsIgnorePattern: '^_'` in the config, converted `catch (_) {}` to bare `catch { /* comment */ }` in `AudioController`/`PlaybackController`'s `_stopSource()`, and fixed a genuine `react-hooks/set-state-in-effect` finding in `HelpOverlay.jsx` by replacing the post-mount `useEffect` + `setState` pair with a `useState(() => ...)` lazy initializer that reads `localStorage` during the initial render instead — same behavior, no double-render, and it incidentally fixes a closed-then-reopens flash the old code had. New `.github/workflows/ci.yml`: `npm ci` → `npm run build` → `npm run lint` → `npm test` → `npm run typecheck` (the last substitutes for a bare `tsc --noEmit` since it needs `-p test-types` to find the right tsconfig), on `pull_request` + `push: main`; `deploy.yml` untouched. Verified both directions of the gate actually work, not just that the happy path passes: temporarily reintroduced an unused-var into `DataStore.js` and confirmed `npm run lint` exits 1 (then reverted) — mirrors the same tsc-error sanity check done in REL4. `npm ci` (real, not dry-run) plus the full `build → lint → test → typecheck` sequence all pass locally end to end. README gained a "CI" subsection. Branch: `feature/REL5`.
- **2026-07-24 [Claude]**: REL4 completed (v9.18) — hand-written `.d.ts` declarations for all three package entry points, co-located with their sources: `src/index.d.ts` (~1150 lines covering all ~30 exports re-exported from `src/index.js`: `PlotController`, `ViewportController`, `DataStore`, `PlotDataView`, `AxisController`/`AxisRenderer`, the full ROI system (`ROIBase`/`LinearRegion`/`RectROI`/`LineROI`/`ConstraintEngine`/`ROIController`), all layer classes/builders (`BitmapDataLayer`, `BitmapViewGenerator`, `LUTController`, `LUTHistogramController`, `ROILayer`, `buildScatterLayer`, `buildLineLayer`, `PlotLayer`, `TraceGroup`, `SignalStore`/`buildSignalLayers`), audio (`AudioController`/`FilterController`/`PlaybackController`), integration adapters, popup utilities, and `PlotCanvas`), `ui/index.d.ts` (`FilterPanel`/`LUTPanel`/`HelpOverlay`), `loaders/index.d.ts` (`TableLoaderAdapter`/`RasterLoaderAdapter`). Every `EventEmitter`-based class got typed `on`/`once`/`off`/`emit` overloads for its known events (not just a generic string fallback) — e.g. `PlotController`'s `zoomChanged` is a 3-way discriminated union across its three emit sites (wheel/setZoom, F21 axis-drag, F37 rect-zoom). Used 4 parallel research agents to extract the full API surface (constructor options, method signatures, event payloads, ambiguous/unvalidated runtime behavior) from ~30 source files before writing a single line of the declarations by hand. Caught and fixed a real authoring mistake during the pass: `export default X;` was mistakenly written once per class (copying the per-file pattern) instead of zero times — a module can only have one default export, and `src/index.js`/`ui/index.js`/`loaders/index.js` are 100% named re-exports with no default at all; stripped all 21 stray `export default` lines. `package.json` gained `"types": "./src/index.d.ts"` plus a `types` condition on each of the three `exports` subpaths (added `typescript`, `@types/react`, `@types/react-dom` as devDependencies to verify). Verification used the *actual* consumer resolution path, not just direct file checks: `test-types/smoke.tsx` (throwaway, not shipped — excluded from `files`) imports from the self-referencing `masterplot`/`masterplot/ui`/`masterplot/loaders` specifiers (not relative paths) and exercises a representative slice of every exported symbol; `test-types/tsconfig.json` uses `moduleResolution: "bundler"` + `strict: true`. New `npm run typecheck` script runs `tsc --noEmit -p test-types` — passes clean. Confirmed the type-checking is real (not a silent no-op) by deliberately injecting a type error and verifying `tsc` catches it, then reverting. Also independently type-checked all three `.d.ts` files standalone under `--strict` with zero errors. `npm pack --dry-run` confirms the three `.d.ts` files ship (already covered by REL2's `files` allowlist) and `test-types/` does not. `npm test`/`npm run build` still clean. README gained a "TypeScript" subsection under Installation & Running; removed the now-stale "TypeScript migration" line from the Roadmap's unscheduled list. Branch: `feature/REL4`.
- **2026-07-24 [Claude]**: REL3 completed (v9.17) — added `vitest`/`jsdom`/`@testing-library/react` devDependencies, `vitest.config.mjs` (jsdom environment, `test/**/*.test.js`), and `npm test`/`npm run test:watch` scripts (REL3a). Wrote 104 tests across 6 files in `test/` (REL3b), one per module in the priority order specified: `test/plot/ViewportController.test.js` (domain get/set, linear+log zoom math, `scaleDomainFromMidpoint`, and the full `panByPixels` sign-convention matrix per the AGENT.md y-inversion rule — verified against the *actual* default pixel ranges, not assumed ones, after an initial draft had the x-range span wrong by 40px and caught it via failing tests), `test/plot/ROI/ConstraintEngine.test.js` (shift rule, asymmetric clamp, xLocked bypass of `_clampChild` entirely — including that xLocked children never get y-clamped, only y-shifted — multi-level cascade, loop guard), `test/plot/ROI/ROIBase.test.js` (`bumpVersion()` increments/refreshes `updatedAt`/re-snapshots domain from current bounds, plus `ROIController.updateFromExternal()` version-gating: reject `<=`, accept `>`, create-on-unknown-id, reject-unknown-type), `test/plot/DataStore.test.js` (non-rolling `_grow()` exact 1.5× sequence, rolling `maxPoints` eviction + wrap-boundary ordering in `getLogicalData()`, `expireIfNeeded()` with `maxAgeMs` under fake timers), `test/plot/PlotDataView.test.js` (dirty propagation matrix incl. confirming `roiUpdated` does NOT mark dirty, parent→child cascade, `filterByDomain`/`filterByROI`/`histogram()` edge cases), `test/plot/axes/AxisController.test.js` (linear/log/time `getScale()`, default numeric formatter's fixed-vs-scientific magnitude threshold cross-checked against direct `d3-format` calls rather than hardcoded strings, custom `tickFormat` override). All 104 tests pass via `npm test`; `npm run build` still clean (only the two pre-existing unrelated asset-size warnings); confirmed `test/` and `vitest.config.mjs` do not leak into `npm pack --dry-run` output. Branch: `feature/REL3`.
- **2026-07-24 [Claude]**: REL2 completed (v9.16) — `package.json` gained `author`/`homepage`/`repository`/`bugs`/`keywords`/`engines.node: ">=18"` (driven by `rollup@4`'s minimum) and `"sideEffects": false`, the last only after a subagent audit of every file reachable from `src/index.js` plus a manual check of `ui/index.js` and `loaders/index.js`'s exports found zero module-scope side effects (all `addEventListener`/`setInterval`/`console.*`/`new` calls live inside class methods, not at import time). `.npmignore` deleted after an `npm pack --dry-run` diff (with/without the file) showed byte-identical tarball output — it had been fully superseded by the `files` allowlist since that field was added in an earlier phase. `masterplot-1.0.0.tgz`/`masterplot-1.0.1.tgz` removed from the repo root (both were untracked, never actually committed despite the plan's assumption); `.gitignore`'s exact-filename entry generalized to `*.tgz`. Verified: `npm pack --dry-run` (57 files, unchanged content set, no `.tgz` written to disk), `npm publish --dry-run` (clean, fails only on the expected not-logged-in dry-run notice), `npm run build` (zero errors, only the two pre-existing unrelated asset-size warnings). Branch: `feature/REL2`.
- **2026-07-24 [Claude]**: REL1 completed (v9.15) — `package.json`: `@loaders.gl/{arrow,core,csv,netcdf,parquet,schema}` + `zstd-codec` moved `dependencies` → `peerDependencies` (optional via `peerDependenciesMeta`) + duplicated into `devDependencies` for local build/test; `lz4js`/`snappyjs` moved to `devDependencies` (confirmed already inlined into `lib/loaders.*.js` by rollup — never a runtime need for consumers); the 6 Node polyfills (`buffer`/`crypto-browserify`/`path-browserify`/`process`/`stream-browserify`/`vm-browserify`) moved to `devDependencies` (confirmed zero direct imports anywhere in `src`/`ui`/`loaders` — they're `webpack.config.js` demo-build fallbacks only). `fft.js`/`fft-windowing` confirmed used by `AudioController` (main entry) and left in `dependencies`. README "Data Loaders" section rewritten with per-adapter install commands, dropping the old `--legacy-peer-deps` workaround. Verified: `npm install`, `npm run build:lib` (grep-confirmed `@loaders.gl/*`/`zstd-codec` still external imports, `lz4js`/`snappyjs` still inlined), `npm run build:demo`, `npm pack --dry-run` all clean. No `rollup.config.mjs` changes needed. Branch: `feature/REL1`.
- **2026-07-24 [Claude]**: Phase 10 (1.0.0 Release Hardening) added as PENDING (v9.14) — library-as-product audit found zero automated tests, no TypeScript declarations, no CI test/lint gate (only a demo-deploy workflow), incomplete npm package metadata (`sideEffects`, `repository`/`homepage`/`bugs`/`keywords`/`engines`, `.npmignore`/`files` duplication), loaders.gl + 6 Node-polyfill packages listed under `dependencies` instead of scoped to the `masterplot/loaders` subpath (bloats install for every consumer), open-ended peer-dependency ranges, no CHANGELOG.md, and a README still marked "Experimental." Nine tasks added: REL1 (loaders.gl dependency isolation), REL2 (npm metadata/publish readiness), REL3 (test infra + core coverage of ViewportController/ConstraintEngine/ROI versioning/DataStore ring buffer/PlotDataView dirty propagation/AxisController), REL4 (hand-written `.d.ts` for the full public API), REL5 (CI quality gate: lint+typecheck+test on PRs), REL6 (CHANGELOG + semver policy + drop "Experimental" framing), REL7 (public API input validation, extending F38's mouseButtons-validation precedent), REL8 (peer dependency upper-bound audit), REL9 (final publish gate — requires explicit user go-ahead for `npm publish`). Investigated an unmerged `feature/UI1-B10-EX21` branch (VirtualPlotList/TextLayer ROI labels/seismography migration, 2026-04-05, not referenced anywhere in PLAN.md or main) — per user instruction this is intentionally left out of scope for this phase. Mandatory order: REL1 → REL2; REL3a → REL3b independent; REL4 independent; REL5 depends on REL3a+REL4; REL6 depends on REL3+REL4; REL7/REL8 independent; REL9 depends on all. No branch yet — planning only, no code changes in this commit.
- **2026-07-24 [Claude]**: F38 completed (v9.13) — `PlotController` gains `mouseButtons` constructor option + `setMouseButtons()`; `DEFAULT_MOUSE_BUTTONS = { left: 'pan', middle: 'none', right: 'zoomDrag' }`; `_setMouseButtonMap()` builds a buttonCode→action lookup with fallback-to-default + console warning on unrecognized action names; `_onMouseDown`/`_onMouseUp` replaced hardcoded `e.button === N` checks with `this._buttonActions[e.button]` lookups (fixing a latent bug where mouseup's button checks would have silently failed to clear drag state under remapping); pan's inlined logic extracted into `_handlePanDown(pos)`/`_handlePanMove(pos)`. Per user request, F37's separate `rectZoomMode` flag and `setRectZoomMode()` method were removed — rect-zoom is now purely opt-in via assigning `'rectZoom'` to a button (`ExampleApp.jsx`'s checkbox now calls `setMouseButtons({ middle: checked ? 'rectZoom' : 'none' })`). Verified manually: default behavior unchanged, button remap swaps interactions correctly, invalid action name warns and falls back. Build zero errors. Branch: `feature/F38`.
- **2026-07-24 [Claude]**: F37 completed (v9.12) — `PlotController` gains `rectZoomMode` constructor option + `setRectZoomMode()`; middle-click drag draws a live rectangle overlay (`PolygonLayer`, log-scale aware via the same `toX`/`toY` helper pattern as `ROILayer`) between press and current cursor position; release computes `[min,max]` per axis from the two corners and calls `viewport.setDomains()` for an atomic zoom; sub-3px drags are a no-op; `_onMouseDown`/`_onMouseMove`/`_onMouseUp` gained button-1 branches mutually exclusive with pan/axis-drag. `ExampleApp.jsx` got a "Rect zoom (middle-drag)" checkbox + HelpOverlay entry. README + `ApiReferencePage.jsx` updated. Verified manually on both a linear-axis page and a temporary log-x-axis test page (deleted after verification). Build zero errors. Branch: `feature/F37`.
- **2026-07-24 [Claude]**: F38 (Configurable Mouse Button Bindings) added as PENDING (v9.11) — replaces PlotController's hardcoded button→action assignment (left=pan, right=F6 drag-zoom, middle=F37 rect-zoom) with a configurable `opts.mouseButtons` map; requires extracting pan's currently-inlined start/move/end logic into `_handlePanDown/Move/Up` for parity with F6/F37's already-separated handlers. Depends on F37. Branch: `feature/F38`.
- **2026-07-24 [Claude]**: Phase 9 (Rect Zoom Mode) added as PENDING (v9.10) — F37: opt-in middle-click drag-to-zoom; draws a corner-to-corner rectangle overlay while the middle button is held, zooms the viewport to the rectangle's data bounds via `viewport.setDomains()` on release. Independent — no dependencies. Branch: `feature/F37`.
- **2026-07-24 [Claude]**: F36 completed (v9.9) — `ROIBase` flags gain `pickable: true`; `ROIController._hitTest` skips `flags.pickable === false` ROIs; `_onMouseDown` gates drag-start on `flags.movable`/`flags.resizable` per handle type (MOVE vs resize) while still selecting locked ROIs; new `ROIController.setFlags(id, patch)` (emits `roisChanged`, no version bump); `ROILayer` fill layers use `roi.flags.pickable !== false`; `ExampleApp.jsx` ROI tables (EX6) gain Locked/Pickable checkboxes wired via `setFlags()` + direct `refreshROITables()`; RoiDeepDivePage §7 "Behaviour Flags", ApiReferencePage `setFlags()`/`deleteROI()`/`serializeAll()` rows + callout, README "Behaviour Flags" subsection all added. Build zero errors. Branch: `feature/F36`.
- **2026-07-24 [Claude]**: Phase 8 (ROI Interaction Control) added as PENDING (v9.8) — F36: wires the already-declared but never-enforced `flags.movable`/`flags.resizable` into `ROIController` hit-test/drag-start; adds new `flags.pickable` gating both `ROILayer`'s deck.gl `pickable` prop and `ROIController._hitTest`; `ROIController.setFlags()` helper; ExampleApp ROI table gets Locked/Pickable checkboxes (EX6). Independent — no dependencies. Branch: `feature/F36`.
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
