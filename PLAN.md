# MasterPlot Implementation Plan

**Plan Version:** 4.6
**Last Updated:** 2026-03-01
**Status:** All Phase 1, Phase 2, Phase 3 complete. ARCH-C done. ARCH-A/D/B pending.

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
| EX4 | Scatter Performance Dropdown | ⏳ PENDING | — | — |
| EX5 | Geophysics / Seismography Example | ✅ COMPLETED | feature/EX5 | 2026-02-25 |
| EX6 | ROI Table Double-Click Selection | ✅ COMPLETED | feature/EX6 | 2026-02-26 |
| ARCH-C | ROILayer Internal Decomposition | ✅ COMPLETED | feature/ARCH-C | 2026-03-01 |
| ARCH-A | PlotController Pluggable Data Layers | ⏳ PENDING | — | — |
| ARCH-D | SignalDataLayer Extraction | ⏳ PENDING | — | — |
| ARCH-B | PlotLayer CompositeLayer | ⏳ PENDING | — | — |

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
- **2026-03-01 [Claude]**: Architecture refactor added as PENDING (v4.5) — ARCH-C/A/D/B tracks. Goal: pluggable data layer registration in PlotController, ROILayer internal decomposition, SignalStore + SignalDataLayer replacing LinePlotController, and PlotLayer CompositeLayer. Examples may be refactored; demonstrated features must be preserved. LinePlotController to be deleted after ARCH-D migration of LineExample + SeismographyExample.

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

# EX4 [PENDING] — Scatter Performance Dropdown

**Type:** Example Only

---

## Changes

### Default Initial Points

Set to:

```
10,000
```

---

### Add Dropdown

Options:

```
10,000
100,000
1,000,000
5,000,000
10,000,000
```

On selection:

* Replace DataStore data
* Recompute domain
* Reset live append state

No engine changes allowed.

---

## Acceptance Criteria

* Fast initial load
* Clean re-render
* No memory leaks
* React does not own large arrays

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

### ARCH-A [PENDING] PlotController Pluggable Data Layers

**Files changed:** `src/plot/PlotController.js`

**What to build:**

#### DataLayerDef contract (JSDoc, no TS file)
```js
/**
 * @typedef {object} DataLayerDef
 * @property {string}   id
 * @property {function} build  — (ctx: RenderContext) => Layer | Layer[] | null
 * @property {object}   [props]  — static user props forwarded into ctx.props
 */

/**
 * @typedef {object} RenderContext
 * @property {object}   gpuAttrs     — { x, y, color, size } typed arrays from DataStore/DataView
 * @property {number}   dataTrigger  — monotonically increasing counter
 * @property {boolean}  xIsLog
 * @property {boolean}  yIsLog
 * @property {number[]} xDomain      — [xMin, xMax]
 * @property {number[]} yDomain      — [yMin, yMax]
 * @property {object}   props        — the static props from the layer def
 */
```

#### Storage
Add to constructor: `this._dataLayerDefs = new Map();` (insertion order = deck.gl layer stack order).

#### Default scatter layer (backwards compat)
```js
// In constructor, after _dataLayerDefs init:
if (!opts.disableDefaultDataLayer) {
  this.registerDataLayer('default-scatter', (ctx) => {
    if (ctx.gpuAttrs.x.length === 0) return null;
    return buildScatterLayer(ctx.gpuAttrs, {
      dataTrigger: ctx.dataTrigger,
      xIsLog: ctx.xIsLog,
      yIsLog: ctx.yIsLog,
    });
  });
}
```

#### New public methods
```js
/** Register or replace a data layer factory. */
registerDataLayer(id, buildFn, props = {}) {
  this._dataLayerDefs.set(id, { build: buildFn, props });
  this._dirty = true;
}

/** Remove a registered layer by id. No-op if not found. */
unregisterDataLayer(id) {
  if (this._dataLayerDefs.delete(id)) this._dirty = true;
}

/** Update static props for an already-registered layer. */
updateDataLayerProps(id, props) {
  const def = this._dataLayerDefs.get(id);
  if (def) { def.props = props; this._dirty = true; }
}
```

#### Modified `_render()`

Replace the hardcoded `buildScatterLayer` block with:
```js
// Build registered data layers
const layers = [];
const context = {
  gpuAttrs, dataTrigger: this._dataTrigger,
  xIsLog, yIsLog, xDomain: [xMin, xMax], yDomain: [yMin, yMax],
};
for (const [, def] of this._dataLayerDefs) {
  const result = def.build({ ...context, props: def.props });
  if (result == null) continue;
  if (Array.isArray(result)) layers.push(...result);
  else layers.push(result);
}
// ROILayer always last
layers.push(new ROILayer({ id: 'roi-layer', rois, plotXMin: xMin, plotXMax: xMax, plotYMin: yMin, plotYMax: yMax, xIsLog, yIsLog }));
this._deck.setProps({ viewState: this._buildViewState(), layers });
```

**Net change:** ~50 lines added to a 750-line file. No existing method signatures change.

**Verification:** ExampleApp + SharedDataExample — scatter renders, live append works, ROIs work. Confirm `disableDefaultDataLayer: true` produces an empty plot (only ROI layer).

---

### ARCH-D [PENDING] SignalDataLayer + LinePlotController Retirement

**Files changed:**
- `src/plot/layers/SignalDataLayer.js` (new, ~50 lines)
- `src/plot/LinePlotController.js` (deleted)
- `examples/LineExample.jsx` (migrated to PlotController + SignalDataLayer)
- `examples/SeismographyExample.jsx` (migrated to PlotController + SignalDataLayer)

**What to build:**

#### New file `src/plot/layers/SignalDataLayer.js`

A `SignalStore` class manages the signals Map (previously embedded in LinePlotController) and exposes the same data API. A `buildSignalLayers(signalsMap)` function produces the PathLayer array for the registered layer def.

```js
import { PathLayer } from '@deck.gl/layers';

/**
 * SignalStore — manages a collection of named time-series signals.
 * Replaces the signal management previously in LinePlotController.
 * Used with PlotController.registerDataLayer() for line/waveform plots.
 */
export class SignalStore {
  constructor() {
    this._signals = new Map();
    this._xCounter = 0;
  }

  addSignal(id, color) { ... }                          // same semantics as LinePlotController
  appendSignalData(id, yValues, xBase) { ... }          // same
  advanceXCounter(n) { this._xCounter += n; }
  trimBefore(xMin) { ... }                              // remove points where x < xMin
  expandDomains() { ... }                               // returns { xDomain, yDomain } for caller to set
  getPointCount() { ... }
  reset() { ... }
  get xCounter() { return this._xCounter; }

  /** Create a DataLayerDef for use with PlotController.registerDataLayer(). */
  toLayerDef() {
    return {
      id:    'signal-data',
      build: (_ctx) => {
        const layers = buildSignalLayers(this._signals);
        return layers.length > 0 ? layers : null;
      },
    };
  }
}

/** Build PathLayer instances for all signals. */
export function buildSignalLayers(signalsMap) {
  const layers = [];
  for (const [id, sig] of signalsMap) {
    if (!sig.layerData || sig.path.length < 2) continue;
    layers.push(new PathLayer({
      id:             `line-${id}`,
      data:           sig.layerData,
      getPath:        d => d.path,
      getColor:       d => d.color,
      getWidth:       2,
      widthUnits:     'pixels',
      pickable:       false,
      updateTriggers: { getPath: sig.version },
    }));
  }
  return layers;
}
```

#### Migrate `LineExample.jsx`

Replace `LinePlotController` usage with `PlotController` + `SignalStore`:

```js
// Before:
const ctrl = new LinePlotController({ xDomain, yDomain });
ctrl.addSignal('a', [255, 100, 100, 255]);
ctrl.appendSignalData('a', samples, xBase);
ctrl.trimBefore(xMin);
ctrl.expandDomains();

// After:
const signals = new SignalStore();
const ctrl = new PlotController({ xDomain, yDomain, disableDefaultDataLayer: true });
ctrl.registerDataLayer('signals', signals.toLayerDef().build);
signals.addSignal('a', [255, 100, 100, 255]);
signals.appendSignalData('a', samples, xBase);
signals.trimBefore(xMin);
const { xDomain: xd, yDomain: yd } = signals.expandDomains();
ctrl.xAxis.setDomain(xd);
ctrl.yAxis.setDomain(yd);
```

All demonstrated features preserved: multi-signal render, rolling window, reset, zoom/pan, axis labels.

#### Migrate `SeismographyExample.jsx`

Replace the 10 `LinePlotController` instances with `PlotController` + `SignalStore`. The example currently accesses:
- `ctrl._signals.get('s')` → `signalStore._signals.get('s')` (or a public `getSignal(id)` accessor on SignalStore)
- `ctrl._viewport` → `ctrl.viewport` (already a public getter on PlotController)
- `ctrl._axisRenderer` → PlotController does not expose axisRenderer; label rendering moves to be driven purely via `xLabel`/`yLabel` props on PlotCanvas
- `ctrl._dirty` → `ctrl._markDirty()` call or removed (PlotController's RAF loop handles dirty automatically)
- `ctrl._xAxis` → `ctrl.xAxis` (already a public getter)
- `ctrl._onMouseDown` → remove the manual event re-routing; PlotController handles its own mouse events

The seismography features to preserve: 10 stacked channels, shared X-axis via `domainChanged` cross-propagation, one `vline-half-bottom` LineROI per channel, React table with version-gated label/position edits via `updateFromExternal()`.

#### Delete `src/plot/LinePlotController.js`

Once both examples are migrated and verified, delete the file. Remove its webpack entry and `import` references.

**Note:** `PlotController` gains ROI support for free in migrated examples — the seismography P-wave picks continue to work via the standard ROI system.

**Verification:** LineExample — 3 signals render, rolling window trims correctly, reset works, zoom/pan via mouse. SeismographyExample — 10 stacked channels, shared X sync, P-wave picks draggable and table-editable, no regression vs. current behavior.

---

### ARCH-B [PENDING] PlotLayer CompositeLayer

**Files changed:**
- `src/plot/layers/PlotLayer.js` (new, ~30 lines)
- `src/plot/PlotController.js` (`_render()` uses PlotLayer; gated by `opts.usePlotLayer`)

**What to build:**

**New file `src/plot/layers/PlotLayer.js`:**
```js
import { CompositeLayer } from '@deck.gl/core';

/**
 * PlotLayer — CompositeLayer that aggregates all registered data layers
 * and the ROILayer into a single composable unit for deck.gl.
 *
 * Props:
 *   dataLayers  {Layer[]}  — ordered array of data layers (scatter, line, spectrogram, etc.)
 *   roiLayer    {Layer}    — ROILayer instance (always rendered last / on top)
 */
export class PlotLayer extends CompositeLayer {
  static get layerName() { return 'PlotLayer'; }

  renderLayers() {
    const { dataLayers = [], roiLayer } = this.props;
    return roiLayer ? [...dataLayers, roiLayer] : dataLayers;
  }
}

PlotLayer.defaultProps = {
  dataLayers: { type: 'array', value: [] },
  roiLayer:   { type: 'object', value: null, optional: true },
};
```

**Modified `PlotController._render()`:**
```js
const roiLayer = new ROILayer({ id: 'roi-layer', rois, plotXMin: xMin, plotXMax: xMax, plotYMin: yMin, plotYMax: yMax, xIsLog, yIsLog });
this._deck.setProps({
  viewState: this._buildViewState(),
  layers: [new PlotLayer({ id: 'plot-layer', dataLayers, roiLayer })],
});
```

**Note on sublayer id namespacing:** CompositeLayer wrapping prefixes sublayer ids (e.g., `roi-layer-${roi.id}-fill` becomes `plot-layer-roi-layer-${roi.id}-fill`). No consumer code inspects deck.gl layer ids by string, so this is safe. Verify ROI picking and drag still work after the change.

**Verification:** All examples — render correctly; ROI drag/resize works; no picking regressions.