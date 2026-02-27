# MasterPlot Implementation Plan

**Plan Version:** 4.4
**Last Updated:** 2026-02-26
**Status:** All Phase 1, Phase 2, Phase 3 complete. F19/F20/F21/EX4/EX5/EX6 all done.

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