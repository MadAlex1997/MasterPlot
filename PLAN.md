# MasterPlot Implementation Plan

**Plan Version:** 6.6
**Last Updated:** 2026-03-07
**Status:** DOC3 complete 2026-03-07. DOC4 pending.

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
| DOC4 | Documentation: ROI System Deep-Dive     | [PENDING] | — | — |

---

## Completed Features — Compact Summaries

> Full implementation specs for all completed items are in [docs/plan-archive.md](docs/plan-archive.md).

### B1 [COMPLETED] Fix: Zoom scroll wheel does nothing
**Completed:** 2026-02-20 | **Branch:** —
Fixed destructuring of `getCanvasPosition()` return value in wheel handler; zoom now centers on cursor correctly.
Full spec: [docs/plan-archive.md#b1](docs/plan-archive.md#b1)

### B2 [COMPLETED] Fix: deck.gl coordinate system mismatch
**Completed:** 2026-02-20 | **Branch:** —
Fixed `viewState` computation, log scale handling, and margin compensation in `PlotController._buildViewState()`.
Full spec: [docs/plan-archive.md#b2](docs/plan-archive.md#b2)

### B3 [COMPLETED] Fix: ScatterLayer coordinate space
**Completed:** 2026-02-20 | **Branch:** —
Added log scale transformation in `getPosition` accessor so scatter points render at correct data-space positions.
Full spec: [docs/plan-archive.md#b3](docs/plan-archive.md#b3)

### B4 [COMPLETED] Fix: ROILayer coordinate space
**Completed:** 2026-02-20 | **Branch:** —
Added log scale transformation to ROI rendering so ROI bounds match scatter point positions.
Full spec: [docs/plan-archive.md#b4](docs/plan-archive.md#b4)

### B5 [COMPLETED] Fix: Inverted vertical controls on RectROI
**Completed:** 2026-02-21 | **Branch:** —
Added per-case clamping for TOP/BOTTOM handles in `applyDelta`; handles stop at zero height instead of crossing and causing a teleport artifact.
Full spec: [docs/plan-archive.md#b5](docs/plan-archive.md#b5)

### B6 [COMPLETED] Fix: Y-axis data rendering inverted
**Completed:** 2026-02-21 | **Branch:** —
Added explicit `flipY: false` to `OrthographicView` in `PlotController.init()` to correct upside-down data rendering.
Full spec: [docs/plan-archive.md#b6](docs/plan-archive.md#b6)

### B7 [COMPLETED] Fix: Y-axis pan direction inverted
**Completed:** 2026-02-21 | **Branch:** —
Fixed follow velocity and drag pan y-signs to account for inverted d3 y-scale range. Documented Y-axis coordinate convention in `prompt.md`.
Full spec: [docs/plan-archive.md#b7](docs/plan-archive.md#b7)

### B8 [COMPLETED] Fix: Spectrogram page blank
**Completed:** 2026-02-21 | **Branch:** —
Four fixes: numeric `dataTrigger` prop + `updateTriggers`; `transferToImageBitmap()` for luma.gl 8.5.x compatibility; removed manual row-flip (was causing double-flip).
Full spec: [docs/plan-archive.md#b8](docs/plan-archive.md#b8)

### F1 [COMPLETED] Feature: Auto-expand domain toggle
**Completed:** 2026-02-20 | **Branch:** feature/F4-F5-F6
Added `_autoExpand` flag and UI checkbox; domain expands automatically when new data exceeds current bounds.
Full spec: [docs/plan-archive.md#f1](docs/plan-archive.md#f1)

### F2 [COMPLETED] Feature: Live append on/off checkbox
**Completed:** 2026-02-20 | **Branch:** feature/F4-F5-F6
Added UI toggle to start/stop the 2-second live append interval in `ExampleApp`.
Full spec: [docs/plan-archive.md#f2](docs/plan-archive.md#f2)

### F3 [COMPLETED] Feature: Event logging on UI
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Added on-screen log panel showing `roiUpdated` (debounced 150 ms), `zoomChanged`, and `panChanged` (threshold > 5 px) events in `ExampleApp`.
Full spec: [docs/plan-archive.md#f3](docs/plan-archive.md#f3)

### F4 [COMPLETED] Feature: Pan mode toggle (follow / drag)
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Added `_panMode` + `setPanMode()` to `PlotController`; drag-pan branch uses restore-and-reapply with correct inverted signs; ExampleApp shows "Drag pan" checkbox.
Full spec: [docs/plan-archive.md#f4](docs/plan-archive.md#f4)

### F5 [COMPLETED] Feature: Follow pan velocity mode
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Added `_panCurrentPos` + RAF velocity tick for follow mode; dead zone 5 px, speed 0.02.
Full spec: [docs/plan-archive.md#f5](docs/plan-archive.md#f5)

### F6 [COMPLETED] Feature: Right-click drag zoom
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Right-click + vertical drag zooms in/out centered on click origin; `contextmenu` event suppressed; restore-and-reapply prevents float drift.
Full spec: [docs/plan-archive.md#f6](docs/plan-archive.md#f6)

### F7 [COMPLETED] Feature: Tunable follow-pan speed
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Replaced `FOLLOW_PAN_SPEED` constant with `this._followPanSpeed`; range slider (0.005–0.1, step 0.001) added to ExampleApp header.
Full spec: [docs/plan-archive.md#f7](docs/plan-archive.md#f7)

### F8 [COMPLETED] Feature: LineLayer example page
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Created `LinePlotController.js`, `LineExample.jsx`, `src/line.js`, `public/line.html`. Demonstrates 3 random-walk signals with live 500-sample/s append and Reset.
Full spec: [docs/plan-archive.md#f8](docs/plan-archive.md#f8)

### F9 [COMPLETED] Feature: SpectrogramLayer (STFT via fft.js)
**Completed:** 2026-02-21 | **Branch:** feature/F4-F5-F6
Created `SpectrogramLayer.js` (STFT + Hann window + Viridis LUT + BitmapLayer), `SpectrogramExample.jsx`, `src/spectrogram.js`, `public/spectrogram.html`. Webpack converted to multi-entry.
Full spec: [docs/plan-archive.md#f9](docs/plan-archive.md#f9)

### F10 [COMPLETED] Feature: Audio file loading
**Completed:** 2026-02-21 | **Branch:** feature/F10
Added "Open audio file" button to `SpectrogramExample.jsx`; decodes via `AudioContext.decodeAudioData`; adapts both panels to actual file sample rate.
Full spec: [docs/plan-archive.md#f10](docs/plan-archive.md#f10)

### F11 [COMPLETED] Feature: HistogramLUTItem
**Completed:** 2026-02-21 | **Branch:** feature/F11
Created `HistogramLUTController.js` (6 LUT presets, histogram + auto-levels) and `HistogramLUTPanel.jsx` (canvas drag handles). Refactored `SpectrogramLayer.js` to cache STFT in deck.gl layer state.
Full spec: [docs/plan-archive.md#f11](docs/plan-archive.md#f11)

### F12 [COMPLETED] Feature: Audio Playback + Synchronized Playhead Lines
**Completed:** 2026-02-22 | **Branch:** feature/F12
Created `PlaybackController.js` (play/pause/stop/seek via `AudioBufferSourceNode`). RAF-driven playhead drawn on both axis canvases. Ctrl+click seek.
Full spec: [docs/plan-archive.md#f12](docs/plan-archive.md#f12)

### F13 [COMPLETED] Feature: Frequency Filters
**Completed:** 2026-02-22 | **Branch:** feature/F13
Created `FilterController.js` (offline biquad via `OfflineAudioContext`) and `FilterPanel.jsx` (filter type dropdown, log-scale cutoff/Q sliders, live frequency response canvas, Apply/Clear buttons).
Full spec: [docs/plan-archive.md#f13](docs/plan-archive.md#f13)

---

## Recent Changelog

> Full history in [docs/plan-archive.md — Change Log](docs/plan-archive.md#change-log).


---

### F16 [COMPLETED] Feature: Rolling Ring Buffer DataStore
**Completed:** 2026-02-22 | **Branch:** feature/datastore-rolling
`DataStore` extended with `EventEmitter`; `_sizeArr` rename; `enableRolling({ maxPoints, maxAgeMs })`, `expireIfNeeded()`, `getLogicalData()` added; `PlotController` calls expire after append and recalculates domain on eviction.
Full spec: [docs/plan-archive.md#f16](docs/plan-archive.md#f16)

---

### F15 [COMPLETED] Feature: Lazy DataView System
**Completed:** 2026-02-22 | **Branch:** feature/dataview-lazy
Created `PlotDataView` (dirty-flag-cached lazy view with `filterByDomain`, `filterByROI`, `histogram`, `snapshot`, `destroy`); added `roiFinalized` stub to `ROIController._onMouseUp`; added `opts.dataStore`/`opts.dataView` prep and `roiFinalized` forwarding to `PlotController`.
Full spec: [docs/plan-archive.md#f15](docs/plan-archive.md#f15)


---

### F14 [COMPLETED] Feature: ROI Domain Model + Mandatory Versioning
**Completed:** 2026-02-22 | **Branch:** feature/roi-domain-versioning
Added `version`, `updatedAt`, `domain` to `ROIBase`; `bumpVersion()` called on mouseup; `LinearRegion` overrides `bumpVersion()` to omit `y`; `ROIController` gains `serializeAll()`, `deserializeAll()`, `updateFromExternal()` (version-gated, emits `roiExternalUpdate`); `PlotController._wireEvents()` forwards `roiExternalUpdate`.
Full spec: [docs/plan-archive.md#f14](docs/plan-archive.md#f14)

---

### F17 [COMPLETED] Feature: Shared Data Infrastructure
**Completed:** 2026-02-22 | **Branch:** feature/shared-data
`PlotController` gains `_ownsDataStore`/`_ownsDataView` flags, `setDataView()`, and DataView event wiring; `_render()` uses `_dataView.getData()` when set; `PlotCanvas` gains `dataStore`/`onInit` props; `SharedDataExample.jsx` demonstrates two plots sharing one DataStore with per-ROI filtered view on Plot B.
Full spec: [docs/plan-archive.md#f17](docs/plan-archive.md#f17)

---

### F18 [COMPLETED] Feature: External Integration Interface Contracts
**Completed:** 2026-02-22 | **Branch:** feature/integration-contract
Created `ExternalDataAdapter`/`ExternalROIAdapter` base classes (throw-on-call contracts); `MockDataAdapter` (random batch timer) and `MockROIAdapter` (localStorage-backed); README "External Integration" section with architecture diagram, bufferStruct table, contract docs, and mock snippets; HubPage integration guide card added.
Full spec: [docs/plan-archive.md#f18](docs/plan-archive.md#f18)


- **2026-02-22 [Claude]**: F16, F15, F14, F17, F18 added as PENDING (from Features.md). Mandatory implementation order: F16 → F15 → F14 → F17 → F18. Plan version 3.0.
- **2026-02-22 [Claude]**: Plan reorganized to v3.1 — completed specs archived to `docs/plan-archive.md`; PLAN.md now contains compact summaries + pending specs only. Future agents: follow rule 7 (archive on completion).
- **2026-02-22 [Claude]**: F15 completed (v3.2) — `PlotDataView` created; `roiFinalized` stub added to ROIController; `opts.dataStore`/`opts.dataView` prep added to PlotController. Next: F14.
- **2026-02-22 [Claude]**: F14 completed (v3.3) — ROI versioning + serialization implemented. `ROIBase` gains `version`/`updatedAt`/`domain`/`bumpVersion()`; `LinearRegion` overrides `bumpVersion()` to omit `y`; `ROIController` gains `serializeAll()`/`deserializeAll()`/`updateFromExternal()`; `PlotController` forwards `roiExternalUpdate`. Next: F17.
- **2026-02-22 [Claude]**: F17 completed (v3.4) — Shared Data Infrastructure. `PlotController` gains ownership flags, `setDataView()`, and DataView event wiring; `_render()` uses DataView when present; `PlotCanvas` gains `dataStore`/`onInit` props; `SharedDataExample.jsx` created; webpack entry + HTML added. Next: F18.
- **2026-02-22 [Claude]**: F18 completed (v3.5) — External Integration Contracts. `src/integration/` directory created with `ExternalDataAdapter`, `ExternalROIAdapter`, `MockDataAdapter`, `MockROIAdapter`. README "External Integration" section added with architecture diagram, bufferStruct table, contract docs, ROI sync flow, and mock snippets. HubPage integration guide card added. All Phase 2 features (F14–F18) now complete.
- **2026-02-22 [Claude]**: EX1, EX2, EX3 added as PENDING (v3.6) — example-only improvements from Features.md. No engine modifications permitted. Implementation order: EX1 → EX2 → EX3.
- **2026-02-22 [Claude]**: EX1, EX2, EX3 completed (v3.7) — EX1: ROI tables in ExampleApp.jsx (roiController.serializeAll(), onInit subscription, selectedLinearId ref pattern); EX2: FilterPanel relocated to waveform sidebar, lowFreq/highFreq number inputs set spectrogram y-axis domain; EX3: deterministic sin/cos waves with vertical offsets in both LineExample.jsx and RollingLineExample.jsx, rolling via trimBefore(). All EX features done.
- **2026-02-24 [Claude]**: Phase 3 incorporated (v3.8) — F19, F20, F21, EX4, EX5 added as PENDING from Features.md. Mandatory order: F19 → F20 → F21 → EX4 → EX5. Features.md cleared to stub; prompt.md updated to reflect Phase 2 complete / Phase 3 active.
- **2026-02-24 [Claude]**: F19 completed (v3.9) — `ConstraintEngine.enforceConstraints` replaced by `applyConstraints(parent, delta) → Set<ROI>`; ROIController drag emits `roiUpdated` for changed children; mouseup walks descendants via `walkChildren`, bumps version and emits `roiFinalized` only when bounds differ from domain snapshot. Next: F20.
- **2026-02-24 [Claude]**: F20 completed (v4.0) — `LineROI` (6 modes, optional label, half-variant canvas labels, auto-parent to LinearRegion); V/H keys; `_syncPosition` hook in ConstraintEngine; `ROILayer` LineROI rendering via PathLayer + plotXMin/plotXMax props; `AxisRenderer.render(rois)` + `_renderLineROILabels`; `PlotController` passes rois to axisRenderer and xMin/xMax to ROILayer; `ROIController.serializeAll` calls `roi.serialize()`; `updateFromExternal` handles LineROI. Next: F21.
- **2026-02-24 [Claude]**: F21 completed (v4.1) — `AxisController.scaleDomainFromMidpoint(factor)` (linear+log); `AxisRenderer.getAxisHit(px,py)`; `PlotController` axis drag state + `_handleAxisDragMove` (restore-and-reapply, sensitivity=0.01, X:left=zoom-in, Y:down=zoom-in); emits `zoomChanged`. Next: EX4.
- **2026-02-25 [Claude]**: EX5 completed (v4.2) — `SeismographyExample.jsx` (10 stacked PlotCanvas, shared X via domainChanged cross-propagation, one vline-half-bottom LineROI per channel, React table with version-gated label/position edits); webpack + HubPage + README updated. EX4 still pending.
- **2026-02-26 [Claude]**: EX6 added as PENDING (v4.3) — ROI Table Double-Click Selection; ExampleApp.jsx only; adds `onDoubleClick` to `<tr>` rows to programmatically select ROIs on plot + auto-select parent LinearRegion from RectROI row; requires adding `parentId` to `serializeAll()` output. No engine changes otherwise.
- **2026-02-26 [Claude]**: EX6 completed (v4.4) — `serializeAll()` enriched with `parentId`; `ExampleApp.jsx` gains double-click handlers + `plotSelectedLinearId`/`plotSelectedRectId` state; green outline on double-clicked LinearRegion rows, red outline on double-clicked RectROI rows; single-click filter unchanged. All Phase 3 features now complete.
- **2026-03-01 [Claude]**: ARCH-C completed (v4.6) — `ROILayer.renderLayers()` decomposed into `_buildCoordHelpers`, `_buildLinearRegionLayers`, `_buildLineROILayers`, `_buildRectROILayers`; zero API change; build passes. Next: ARCH-A.
- **2026-03-01 [Claude]**: ARCH-A completed (v4.7) — `PlotController` gains `DataLayerDef`/`RenderContext` JSDoc typedefs, `_dataLayerDefs` Map, default scatter auto-registration, `registerDataLayer()`/`unregisterDataLayer()`/`updateDataLayerProps()` public API, and a registry-driven `_render()` loop; build verified. Next: ARCH-D.
- **2026-03-01 [Claude]**: ARCH-D completed (v4.8) — `SignalStore` + `buildSignalLayers()` in `src/plot/layers/SignalDataLayer.js`; `LinePlotController.js` deleted; `LineExample.jsx`, `RollingLineExample.jsx`, `SeismographyExample.jsx` migrated to `PlotController` + `SignalStore`; seismography X-sync via `domainChanged` + syncingRef; ROI via built-in `ctrl.roiController`; no monkey-patching; build passes zero errors. Next: ARCH-B.
- **2026-03-01 [Claude]**: Architecture refactor added as PENDING (v4.5) — ARCH-C/A/D/B tracks. Goal: pluggable data layer registration in PlotController, ROILayer internal decomposition, SignalStore + SignalDataLayer replacing LinePlotController, and PlotLayer CompositeLayer. Examples may be refactored; demonstrated features must be preserved. LinePlotController to be deleted after ARCH-D migration of LineExample + SeismographyExample.
- **2026-03-01 [Claude]**: ARCH-B completed (v4.9) — `PlotLayer extends CompositeLayer` created in `src/plot/layers/PlotLayer.js`; `PlotController._render()` gates on `opts.usePlotLayer` to wrap all data layers + ROILayer into a single CompositeLayer; default (flag off) keeps existing flat-array path unchanged; build passes zero errors. All ARCH tracks complete.
- **2026-03-01 [Claude]**: F22 + EX7 completed (v5.0) — `TraceGroup` created in `src/plot/layers/TraceGroup.js`; O(n) bulk partition, doubling buffer growth, palette cycling, per-tag attr overrides, `toLayerDef()` for `registerDataLayer`; `MultiSensorExample.jsx` (50 sensors × 10k pts, 500k total, scrollable sidebar, 25-color palette cycling, React owns zero arrays); webpack entry + HTML + HubPage card + README TraceGroup API section; build passes zero errors. EX4 still PENDING.
- **2026-03-01 [Claude]**: EX8 added as PENDING (v5.1) — Live Signal Analysis replaces redundant LineExample + RollingLineExample. Merges wall-clock time X-axis, configurable 10s/30s/60s rolling window, and new LinearRegion ROI stats sidebar (mean/RMS/peak-to-peak per signal). No engine changes; example-only. Next agent: implement EX8.
- **2026-03-01 [Claude]**: EX8 completed (v5.1) — `LiveSignalsExample.jsx` created; six old files deleted; webpack/HubPage/README updated; build passes zero errors. Bug fix applied during implementation: ROI bounds accessed as `roi.x1`/`roi.x2` (not `roi.bounds`). EX4 still PENDING.
- **2026-03-01 [Claude]**: EX9 added as PENDING (v5.1 note) — Spectrogram Overhaul: 6 sub-tasks covering Freq Band removal, per-type DSP inputs, y-axis auto-zoom after Apply, fft-windowing npm integration, preset sounds dropdown, and LUT handle clamping fix.
- **2026-03-01 [Claude]**: EX9 completed (v5.2) — All 6 sub-tasks implemented: Freq Band UI removed; `FilterController` gains `lowFreq`/`highFreq` state + `setLowHighFreq()` + geometric-mean center/Q; `FilterPanel` per-type layout with dual canvas markers; `SpectrogramLayer` `windowFn` prop via `fft-windowing` (`import * as fftWindowing`; `rectangular` skips windowing); `handleApplyFilter` auto-zooms y-axis; `handleClearFilter` restores full range; `CopyWebpackPlugin` copies `sounds/` → `dist/sounds/`; `loadAudioBuffer` shared helper; `HistogramLUTController.setSpectrogramData` clamps levels. Build passes zero errors.
- **2026-03-03 [Claude]**: EX4 completed (v5.3) — `ExampleApp.jsx` gains points dropdown (10k/100k/1M/5M/10M); on change: pauses live append, clears DataStore, resets domain, loads new points, resumes append; React holds no arrays. All features in PLAN.md now complete.
- **2026-03-03 [Claude]**: F23 + EX10 added as PENDING (v5.4) — F23: `PlotController.autoScale()` + `setHomeDomain()` + spacebar binding (engine; all PlotController-based examples gain it automatically); EX10: axis drag zoom (both spectrogram and waveform panels) + spacebar reset for SpectrogramExample which bypasses PlotController. Implementation order: F23 → EX10.
- **2026-03-03 [Claude]**: F23 + EX10 completed (v5.5) — F23: `_homeDomain`/`_autoScaleKey` in constructor, spacebar in `init()`, `autoScale()`/`setHomeDomain()` public methods, cleanup in `destroy()`; EX10: `specAxisDragRef`/`waveAxisDragRef`, axis-hit guards in both panels' `onMouseDown`/`onMouseMove`/`onMouseUp`, spacebar `onKeyDown` with cleanup; README updated; build passes zero errors. All features complete.
- **2026-03-06 [Claude]**: F24 completed (v5.8) — `FilterPanelPopup` component added to `SpectrogramPopup.jsx` (`case 'filter'`); `usePopupChannel` wired in `SpectrogramExample.jsx`; inline `FilterPanel` + Clear button sidebar replaced with "Open/Reopen Filter Panel" button; `buildFilterStateMsg` sends state after Apply/Clear and 300 ms after popup opens; `applying`/`filterSampleRate` states removed (popup-side now owns them). Build passes zero errors. Next: EX11 (unblocked).
- **2026-03-06 [Claude]**: ARCH-E completed (v5.7) — `PopupWindowManager` (EventEmitter, 500 ms poll, blocked-popup guard) + `usePopupChannel` React hook; `BackendAdapter.js` stub documents WebSocket transport-swap; `SpectrogramPopup.jsx` panel host shell with `?panel=`/`?channel=` routing; webpack entry `spectrogram-popup.js`/`spectrogram-popup.html`; build passes zero errors. F24 and EX11 now unblocked.

---

## Example Improvements — Completed

### EX1 [COMPLETED] Scatter + ROI Tables Enhancement
**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
Added two ROI inspection tables to `ExampleApp.jsx`: LinearRegion table (ID/Left/Right/Version, click to select) and RectROI subset table (ID/Left/Right/Bottom/Top/Version, filtered to rects overlapping selected linear). Tables update only on `roiCreated`/`roiFinalized`/`roiDeleted` (not on drag). Access via `onInit` → `controller.roiController`.
Full spec: [docs/plan-archive.md#ex1](docs/plan-archive.md#ex1)

### EX2 [COMPLETED] Spectrogram Example UI Refinement
**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
Moved `FilterPanel` from spectrogram sidebar to waveform sidebar in `SpectrogramExample.jsx`. Added `lowFreq`/`highFreq` `<input type="number" step="0.1">` controls that set the spectrogram y-axis domain (visible frequency band). Added "Reset to full" button and live validity indicator. File load resets bounds to full Nyquist range.
Full spec: [docs/plan-archive.md#ex2](docs/plan-archive.md#ex2)

### EX3 [COMPLETED] Rolling Lines — Deterministic Waves
**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
Replaced random-walk generators in `LineExample.jsx` and `RollingLineExample.jsx` with deterministic sin/cos waves (amplitude=1, spacing=3, vertical offsets per signal). Rolling expiration via `trimBefore()` keeps a 5000-sample window in LineExample and 30s wall-clock window in RollingLineExample. Waves are clearly sin/cos, non-overlapping.
Full spec: [docs/plan-archive.md#ex3](docs/plan-archive.md#ex3)

---

## Phase 3 — Pending Features

**Mandatory implementation order:**

```
F19 → F20 → F21 → EX4 → EX5
```

---

### F19 [COMPLETED] Cascading ROI Update + Conditional Child Versioning
**Completed:** 2026-02-24 | **Branch:** feature/F19
`ConstraintEngine.enforceConstraints` replaced by `applyConstraints(parent, delta) → Set<ROI>` (snapshots bounds before/after, returns changed descendants); `ROIController` drag phase emits `roiUpdated` for each changed child; mouseup phase walks descendants via `walkChildren`, compares to domain snapshot, and calls `bumpVersion()` + emits `roiFinalized` only when bounds actually changed.
Full spec: [docs/plan-archive.md#f19](docs/plan-archive.md#f19)

### F20 [COMPLETED] LineROI (Vertical/Horizontal + Half Variants + Labels)
**Completed:** 2026-02-24 | **Branch:** feature/F20
New `LineROI` class (6 modes: vline/hline + 4 half-variants); V/H keys create full lines; single-click creation; draggable; optional label (≤25 chars) on half-variants rendered via canvas 2D overlay; auto-parenting of vertical LineROI into LinearRegion; `_syncPosition` hook in ConstraintEngine; `serialize()` override; `serializeAll` and `updateFromExternal` extended.
Full spec: [docs/plan-archive.md#f20](docs/plan-archive.md#f20)

### F21 [COMPLETED] Axis Drag Scaling (Midpoint Zoom)
**Completed:** 2026-02-24 | **Branch:** feature/F20
`AxisController.scaleDomainFromMidpoint(factor)` (linear + log); `AxisRenderer.getAxisHit(px, py)` hits X/Y gutter regions; `PlotController` axis drag state + `_handleAxisDragMove` using restore-and-reapply + `Math.exp(delta*0.01)`; emits `zoomChanged`. X: drag-left=zoom-in; Y: drag-down=zoom-in.
Full spec: [docs/plan-archive.md#f21](docs/plan-archive.md#f21)

---

### EX4 [COMPLETED] Scatter Performance Dropdown
**Completed:** 2026-03-03 | **Branch:** main
`ExampleApp.jsx` gains a `<select>` dropdown (10k / 100k / 1M / 5M / 10M); on change: pauses live append, calls `dataStore.clear()`, resets domain to baseline, loads new points via `generatePoints(count)`, resumes append; React holds only the count integer, no arrays.
Full spec: [docs/plan-archive.md#ex4](docs/plan-archive.md#ex4)

---

### EX5 [COMPLETED] Geophysics / Seismography Example
**Completed:** 2026-02-25 | **Branch:** feature/EX5
10 stacked channels with shared X-axis (domainChanged cross-propagation), independent Y-axes, one vline-half-bottom LineROI per channel seeded after all 10 controllers are ready, and a React sidebar table with version-gated label/position edits via `updateFromExternal()`.
Full spec: [docs/plan-archive.md#ex5](docs/plan-archive.md#ex5)

---

### EX6 [COMPLETED] ROI Table Double-Click Selection
**Completed:** 2026-02-26 | **Branch:** feature/EX6
`serializeAll()` enriched with `parentId`; `ExampleApp.jsx` gains `handleDoubleClickLinear` + `handleDoubleClickRect` handlers; double-clicking a LinearRegion row sets it as filter AND calls `rc._selectOnly(roi)` + emits `roisChanged` for a plot highlight (green outline on table row); double-clicking a RectROI row selects the rect on plot (red outline), auto-selects its parent LinearRegion in the filter, and highlights both rows.
Full spec: [docs/plan-archive.md#ex6](docs/plan-archive.md#ex6)

---

## Architecture Refactor — Pending

**Goal:** Make `PlotController` type-agnostic by replacing the hardcoded scatter layer with a pluggable registered-layer system, and improve the composability of deck.gl layers inside the rendering pipeline.

**Motivation:**
- `PlotController` and `LinePlotController` duplicate all infrastructure (Deck, AxisController ×2, ViewportController, AxisRenderer, RAF loop, wheel zoom, drag pan).
- `PlotController._render()` hardcodes `buildScatterLayer()` — impossible to mix scatter + line + spectrogram in one plot.
- `ROILayer.renderLayers()` is a 160-line `if/else if/else` monolith making per-type changes error-prone.

**Implementation order (mandatory):** ARCH-C → ARCH-A → ARCH-D → ARCH-B

**Backwards compatibility:** Demonstrated features must be preserved in all examples, but example source code may be refactored as part of these tracks. LinePlotController may be fully retired once SeismographyExample and LineExample are migrated to the unified PlotController API.

---

### ARCH-C [COMPLETED] ROILayer Internal Decomposition
**Completed:** 2026-03-01 | **Branch:** feature/ARCH-C
Split `renderLayers()` into `_buildCoordHelpers`, `_buildLinearRegionLayers`, `_buildLineROILayers`, `_buildRectROILayers`; external API (props, defaultProps, layerName, sublayer ids) unchanged; build verified zero errors.
Full spec: [docs/plan-archive.md#arch-c](docs/plan-archive.md#arch-c)

---

### ARCH-A [COMPLETED] PlotController Pluggable Data Layers
**Completed:** 2026-03-01 | **Branch:** feature/ARCH-A
Added `DataLayerDef`/`RenderContext` JSDoc typedefs; `this._dataLayerDefs = new Map()` with default scatter auto-registered (opt-out via `disableDefaultDataLayer`); `registerDataLayer()`, `unregisterDataLayer()`, `updateDataLayerProps()` public methods; `_render()` replaced hardcoded scatter block with registry loop; build passes zero errors.
Full spec: [docs/plan-archive.md#arch-a](docs/plan-archive.md#arch-a)

---

### ARCH-D [COMPLETED] SignalDataLayer + LinePlotController Retirement
**Completed:** 2026-03-01 | **Branch:** feature/ARCH-D
`SignalStore` class + `buildSignalLayers()` created in `src/plot/layers/SignalDataLayer.js`; `LinePlotController.js` deleted; `LineExample.jsx`, `RollingLineExample.jsx`, and `SeismographyExample.jsx` migrated to `PlotController` + `SignalStore` (`disableDefaultDataLayer: true`, `registerDataLayer('signals', signals.toLayerDef().build)`); seismography X-sync via `domainChanged` + syncingRef; ROI handled by built-in `ctrl.roiController`; no monkey-patching; build passes zero errors.
Full spec: [docs/plan-archive.md#arch-d](docs/plan-archive.md#arch-d)

---

### ARCH-B [COMPLETED] PlotLayer CompositeLayer
**Completed:** 2026-03-01 | **Branch:** feature/ARCH-B
New `PlotLayer extends CompositeLayer` in `src/plot/layers/PlotLayer.js`; `PlotController._render()` branches on `opts.usePlotLayer` to wrap all data layers + ROILayer in a single CompositeLayer (default off — flat array unchanged); build passes zero errors.
Full spec: [docs/plan-archive.md#arch-b](docs/plan-archive.md#arch-b)

---

### F22 [COMPLETED] TraceGroup Abstraction
**Completed:** 2026-03-01 | **Branch:** feature/F22-EX7
`TraceGroup` created in `src/plot/layers/TraceGroup.js`; partitions bulk data by tag in one O(n) pass into per-tag `Float32Array` buffers with doubling growth; resolves attrs via palette cycling + per-tag overrides + defaultAttrs + lib defaults; `toLayerDef()` returns a `DataLayerDef` for `PlotController.registerDataLayer`; no EventEmitter needed (polled every RAF tick).
Full spec: [docs/plan-archive.md#f22](docs/plan-archive.md#f22)

---

### EX7 [COMPLETED] Multi-Sensor Scatter Example
**Completed:** 2026-03-01 | **Branch:** feature/F22-EX7
`MultiSensorExample.jsx` created: 50 sensors × 10k pts (500k total) via `TraceGroup`; 25-color OKLAB-derived palette cycles at sensor_25; scrollable sidebar with per-sensor checkboxes + swatches + Show All / Hide All; React owns zero arrays; `src/multi-sensor.js`, `public/multi-sensor.html`, webpack entry + HtmlWebpackPlugin, HubPage card, README TraceGroup API section all added; build passes zero errors.
Full spec: [docs/plan-archive.md#ex7](docs/plan-archive.md#ex7)

---

### EX8 [COMPLETED] Live Signal Analysis (Merge Line Examples)
**Completed:** 2026-03-01 | **Branch:** feature/EX8
Replaced `LineExample`/`RollingLineExample` with `LiveSignalsExample.jsx`: three live sin/cos signals on a configurable rolling window (10 s/30 s/60 s), wall-clock X-axis, and a 220 px stats sidebar showing mean/RMS/peak-to-peak per signal inside a drawn LinearRegion ROI (updated live each tick); old six files deleted; webpack/HubPage/README updated; bug fix: ROI bounds accessed as `roi.x1`/`roi.x2` (not `roi.bounds`).
Full spec: [docs/plan-archive.md#ex8](docs/plan-archive.md#ex8)

---

### EX9 [COMPLETED] Spectrogram Overhaul
**Completed:** 2026-03-01 | **Branch:** feature/EX9
Six improvements: removed misleading "Freq Band" y-axis pan UI; per-type DSP filter inputs (single cutoff+Q for lowpass/highpass, dual low/high sliders with computed center+Q for bandpass/notch, dual canvas markers); auto-zoom spectrogram y-axis after Apply/Clear; `fft-windowing` npm for pluggable window functions (hann/hamming/blackman/rectangular) via `SpectrogramLayer.windowFn` prop; preset sound dropdown in header loading 4 WAV files from `/sounds` via `CopyWebpackPlugin`; LUT handle clamping fix in `HistogramLUTController.setSpectrogramData()`.
Full spec: [docs/plan-archive.md#ex9](docs/plan-archive.md#ex9)

---

## Pending Features

**Mandatory implementation order:**

```
F25  (independent)
```

---

### F25 [COMPLETED] Higher-Order Butterworth Filter (Cascaded Biquads)
**Completed:** 2026-03-06 | **Branch:** feature/F25
`order` (2/4/6/8) added to `FilterController` state; `setOrder(n)`, `_butterworthQValues(order)` helper added; `applyToSamples` cascades `order/2` biquads for lowpass/highpass; `getFrequencyResponse` multiplies per-section linear magnitudes before converting to dB; bandpass/notch unchanged; `FilterPanel` shows Order radio buttons (2/4/6/8) for lowpass/highpass only; README updated.
Full spec: [docs/plan-archive.md#f25](docs/plan-archive.md#f25)

---

### ARCH-E [COMPLETED] BroadcastChannel Popup Window Infrastructure
**Completed:** 2026-03-06 | **Branch:** feature/ARCH-E
`PopupWindowManager` (EventEmitter, polls closed every 500 ms, returns false if blocked) + `usePopupChannel` React hook; `BackendAdapter.js` stub documents WebSocket transport swap; `SpectrogramPopup.jsx` + webpack entry `spectrogram-popup.js`/`spectrogram-popup.html` panel host shell with `?panel=`/`?channel=` URL routing; build passes zero errors.
Full spec: [docs/plan-archive.md#arch-e](docs/plan-archive.md#arch-e)

---

### F24 [COMPLETED] Spectrogram Filter Popup Window
**Completed:** 2026-03-06 | **Branch:** feature/F24
Moved `FilterPanel` out of the waveform sidebar into a connected popup (`?panel=filter&channel=spectrogram-filter`); `FilterController` remains in main window; popup mirrors state via BroadcastChannel; Apply/Clear messages trigger main-side DSP and echo back `FILTER_STATE`; anti-loop via direct `fc.state` mutation on main + `suppressRef` on popup side.
Full spec: [docs/plan-archive.md#f24](docs/plan-archive.md#f24)

---

### EX11 [COMPLETED] Spectrogram RectROI + Connected Label Popup
**Completed:** 2026-03-06 | **Branch:** feature/EX11
`ROIController` wired to spectrogram panel with `ROILayer` overlay; "Draw ROI" button + 'R' key enter rect creation mode; `usePopupChannel('spectrogram-labels')` sends `ROIS_CHANGED`/`AUTO_SELECT` to popup; `LabelPanelPopup` (`?panel=labels`) shows time/freq/label table with zoom-to-selected toggle, row click → `SELECT_ROI`, label dropdown → `SET_LABEL`, delete button → `DELETE_ROI`.
Full spec: [docs/plan-archive.md#ex11](docs/plan-archive.md#ex11)

---

### EX12 [COMPLETED] Stress Test Preset Segments
**Completed:** 2026-03-06 | **Branch:** feature/EX12
`STRESS_TEST_DURATIONS` (5/10/15/30/60 min) added as `<optgroup>` in preset dropdown; `handleStressTest()` fetches last preset, resamples to 4 kHz via `OfflineAudioContext` + 1 800 Hz lowpass, randomly stitches copies to target sample count, wraps in `AudioBuffer`, hands off to `loadAudioBuffer`; `generatingMsg` state shows progress; `lastPresetPathRef` tracks source for stress test.
Full spec: [docs/plan-archive.md#ex12](docs/plan-archive.md#ex12)

---

### F23 [COMPLETED] Auto-Scale / Reset Zoom
**Completed:** 2026-03-03 | **Branch:** feature/F23-EX10
Added `autoScale()` (data-driven or home-domain) and `setHomeDomain(x, y)` to `PlotController`; spacebar binding in `init()` (skipped for INPUT/TEXTAREA/SELECT); cleanup in `destroy()`; emits `'autoScaled'`; `autoScaleKey: null` opt-out.
Full spec: [docs/plan-archive.md#f23](docs/plan-archive.md#f23)

---

### EX10 [COMPLETED] Spectrogram Axis Drag Zoom + Auto-Scale
**Completed:** 2026-03-03 | **Branch:** feature/F23-EX10
Added `specAxisDragRef`/`waveAxisDragRef`; axis-hit check before plot-area guard in both `onMouseDown` handlers; restore-and-reapply zoom in both `onMouseMove` handlers; spacebar `onKeyDown` resets both panels to full duration × Nyquist / amplitude range; hint text updated.
Full spec: [docs/plan-archive.md#ex10](docs/plan-archive.md#ex10)

- **2026-03-06 [Claude]**: ARCH-E, F24, EX11, EX12 added as PENDING (v5.6). Motivation: move spectrogram controls into connected popup windows (BroadcastChannel) to reduce main-page clutter; add RectROI + label system to spectrogram; add stress-test preset segments (4 kHz, 5–60 min). Mandatory order: ARCH-E → F24, ARCH-E → EX11; EX12 is independent. Full specs in Pending Features section above.
- **2026-03-06 [Claude]**: EX11 completed (v5.9) — `ROIController` + `ROILayer` wired to spectrogram deck.gl panel; spectrogram `onMouseDown` guards for ROI creation/hit; `usePopupChannel('spectrogram-labels')` with `ROIS_CHANGED`/`AUTO_SELECT`/`SELECT_ROI`/`SET_LABEL`/`DELETE_ROI`/`ZOOM_TOGGLE` protocol; `LabelPanelPopup` component added to `SpectrogramPopup.jsx` (`case 'labels'`); "Draw ROI" + "Open Label Panel" buttons in spectrogram header. Build passes zero errors. Next: EX12 (independent).
- **2026-03-06 [Claude]**: EX12 completed (v6.0) — `STRESS_TEST_DURATIONS` (5/10/15/30/60 min) added as `<optgroup>` in preset dropdown; `handleStressTest()` fetches + downsamples last preset to 4 kHz via `OfflineAudioContext` + 1 800 Hz lowpass biquad, randomly stitches copies, wraps in `AudioBuffer`, hands off to `loadAudioBuffer`; `generatingMsg` state shows progress; `lastPresetPathRef` tracks source. All PLAN.md features now complete.
- **2026-03-06 [Claude]**: F25 added as PENDING (v6.1) — Higher-Order Butterworth Filter via cascaded biquads. Motivation: current single-biquad (2nd-order, Q=1.0 default) produces gentle rolloff that does not match Butterworth expectations. F25 adds `order` (2/4/6/8) to `FilterController` state, a `_butterworthQValues(order)` helper (formula: Q_k = 1/(2·cos((2k−1)π/(2N)))), cascades order/2 BiquadFilterNodes in `applyToSamples` and multiplies per-section magnitude in `getFrequencyResponse`. Order selector radio buttons added to `FilterPanel` for lowpass/highpass only; bandpass/notch unchanged. No new webpack entries or pages needed.
- **2026-03-06 [Claude]**: F25 completed (v6.2) — `order` (2/4/6/8) added to `FilterController` state; `setOrder(n)` + `_butterworthQValues(order)` added; `applyToSamples` cascades `Array.from(qs).map(...)` biquad nodes for lowpass/highpass (bug fix: `Float32Array.map` returns typed array, not object array — must use `Array.from` first); `getFrequencyResponse` multiplies per-section linear magnitudes via `for...of`; `FilterPanel` shows Order radio buttons for lowpass/highpass only; `order` field added to BroadcastChannel `FILTER_STATE` payload in both `buildFilterStateMsg` and popup `onChange` handler; main+popup receivers both sync `order` from payload; build passes zero errors.
- **2026-03-07 [Claude]**: DOC1–DOC4 added as PENDING (v6.3) — four documentation pages (Architecture Overview, Getting Started, API Reference, ROI Deep-Dive) as a single docs SPA served via webpack. Dev dependencies: `mermaid` (diagrams) + `prismjs` (syntax highlighting). Mandatory order: DOC1 → DOC2 → DOC3 → DOC4.
- **2026-03-07 [Claude]**: DOC1 completed (v6.4) — docs SPA infrastructure created; `DocsPage.jsx` shell, shared `CodeBlock`/`MermaidDiagram`/`NavSidebar`, `ArchitecturePage.jsx` with all 6 spec sections (2-para intro + 3 Mermaid diagrams + coordinate table + data-flow code block), placeholder pages for DOC2–DOC4; webpack `docs` entry + `HtmlWebpackPlugin`; HubPage Documentation card group (green accent, 4 cards). Build passes zero errors. Next: DOC2 (unblocked).
- **2026-03-07 [Claude]**: DOC2 completed (v6.5) — `GettingStartedPage.jsx` replaced placeholder with 7 numbered steps (Install / Mount / Live Append / Zoom+Pan / LinearRegion ROI / Events / Shared DataStore); each step has a `CodeBlock` + copy button, inline callout notes, y-axis convention note in step 4, constraint propagation note in step 5, live demo link in step 7. Build passes zero errors. Next: DOC3 (unblocked).
- **2026-03-07 [Claude]**: DOC3 completed (v6.6) — `ApiReferencePage.jsx` replaced placeholder with full API tables for all 8 classes (PlotController 12 opts + 14 methods + 5 getters + 13 events; AxisController 4 opts + 11 methods + 2 events; ROIController 11 methods + 8 events + keybinds table; DataStore 8 methods + 2 events; PlotDataView 3 ctor params + 7 methods + 2 events + dirty-propagation callout; TraceGroup 4 opts + 9 methods + attr-priority code; SignalStore 9 methods + buildSignalLayers helper note; FilterController 6 state fields + 7 methods + 1 event + Butterworth Q code). Build passes zero errors. Next: DOC4 (unblocked).

---

## Documentation Pages — Pending

**Mandatory implementation order:**

```
DOC1 → DOC2 → DOC3 → DOC4
```

DOC1 creates the shared utilities and webpack entry that all subsequent pages depend on.

---

### DOC1 [COMPLETED] Documentation: Architecture Overview
**Completed:** 2026-03-07 | **Branch:** feature/DOC1
Docs SPA (`docs.html`): `DocsPage.jsx` shell (sticky left nav + main), shared `CodeBlock`/`MermaidDiagram`/`NavSidebar` utilities, `ArchitecturePage.jsx` with 6 sections (intro, 3 Mermaid diagrams, coordinate systems table, data-flow code), placeholder pages for DOC2–DOC4; `mermaid`+`prismjs` installed; webpack entry + HubPage Documentation card group added.
Full spec: [docs/plan-archive.md#doc1](docs/plan-archive.md#doc1)

---

### DOC2 [COMPLETED] Documentation: Getting Started Tutorial
**Completed:** 2026-03-07 | **Branch:** feature/DOC2
Replaced placeholder `GettingStartedPage.jsx` with 7 numbered steps (Install / Mount / Live Append / Zoom+Pan / ROI / Events / Shared DataStore), each with a `CodeBlock` + copy button and inline callout notes; live SharedDataExample link included.
Full spec: [docs/plan-archive.md#doc2](docs/plan-archive.md#doc2)

---

### DOC3 [COMPLETED] Documentation: API Reference
**Completed:** 2026-03-07 | **Branch:** feature/DOC3
Replaced placeholder `ApiReferencePage.jsx` with full API tables for all 8 classes (PlotController, AxisController, ROIController, DataStore, PlotDataView, TraceGroup, SignalStore, FilterController); each class has Constructor / Methods / Events subsections plus callouts for keybinds, dirty-propagation rules, and Butterworth Q formula.
Full spec: [docs/plan-archive.md#doc3](docs/plan-archive.md#doc3)

---

### DOC4 [PENDING] Documentation: ROI System Deep-Dive

**Dependencies:** DOC1

**Modified files:** `examples/docs/RoiDeepDivePage.jsx` (replace placeholder with full content)

**Content:**
1. Mermaid `classDiagram`: ROI class hierarchy — ROIBase → LinearRegion, RectROI, LineROI; key property annotations per node
2. Creation modes table — keyboard key → ROI type → number of clicks → auto-parent rule (vertical LineROI auto-parents into LinearRegion)
3. LineROI modes — table of all 6 modes (vline / hline / vline-half-top / vline-half-bottom / hline-half-left / hline-half-right) with ASCII orientation diagram per mode
4. ConstraintEngine — Mermaid `sequenceDiagram`: drag event → `applyConstraints(parent, delta)` → propagate to changed children → `roiUpdated` per child; mouseup → `walkChildren` → `bumpVersion()` + `roiFinalized` only when bounds differ from domain snapshot
5. Versioning — `version` monotonic counter; `bumpVersion()` on mouseup; `domain` snapshot (JSON-safe `{ x: [x1,x2], y?: [y1,y2] }`); table: what does / does not trigger a version bump
6. Serialization & external sync — `serializeAll()` output shape; `updateFromExternal()` version-gating (reject if `incoming.version <= current.version`); `deserializeAll()` restore; full round-trip code sample