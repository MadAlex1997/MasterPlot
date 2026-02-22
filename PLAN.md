# MasterPlot Implementation Plan

**Plan Version:** 3.1
**Last Updated:** 2026-02-22
**Status:** F16 last completed — F15, F14, F17, F18 PENDING (implement in this order)

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
| F15 | Lazy DataView System | ⏳ PENDING | feature/dataview-lazy | — |
| F14 | ROI Domain Model + Versioning | ⏳ PENDING | feature/roi-domain-versioning | — |
| F17 | Shared Data Infrastructure | ⏳ PENDING | feature/shared-data | — |
| F18 | External Integration Contracts | ⏳ PENDING | feature/integration-contract | — |

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

## F15 [PENDING] Feature: Lazy DataView System

**Branch:** `feature/dataview-lazy` (create before starting)

**Depends on:** F16 (`'dataExpired'` event and `getLogicalData()` on DataStore)

**Partially depends on:** F14 — needs `roiFinalized` and `roiExternalUpdate` events from ROIController. Stub them during F15 development; wire fully after F14 lands.

**Goal:** Introduce a `PlotDataView` class representing a lazily-evaluated, dirty-flag-cached derived view over a `DataStore` (or another `PlotDataView`). Views support ROI filtering, domain filtering, histogram derivation, and snapshotting. They never mutate the DataStore. Multiple plots may share a single `PlotDataView`. Recomputation is deferred until `getData()` is called while dirty.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/plot/PlotDataView.js` | **Create new** — core lazy view class |
| `src/plot/ROI/ROIController.js` | **Modify (stub)** — emit `roiFinalized` from `_onMouseUp` |
| `src/plot/PlotController.js` | **Modify** — accept `opts.dataStore` / `opts.dataView` (prep for F17) |

---

### Implementation steps

1. **Create `src/plot/PlotDataView.js`** extending EventEmitter:
   - Constructor: `(source, transformFn = null, opts = {})` — accepts DataStore or parent PlotDataView; optional `opts.roiController`
   - `_dirty = true`, `_snapshot = null`
   - Wire source events: listen for `'dataExpired'` and `'dirty'` on source, and `'roiFinalized'` / `'roiExternalUpdate'` on `opts.roiController`; all call `this.markDirty()`
   - **Do NOT** listen on `'roiUpdated'` — drag must not trigger recompute

2. **`getData()`** — if dirty, call `_recompute()`, clear dirty flag, return snapshot. Otherwise return cached snapshot directly.

3. **`markDirty()`** — sets `_dirty = true`, emits `'dirty'` to enable child view cascade.

4. **`_recompute()`** — calls `source.getLogicalData()` (DataStore) or `source.getData()` (parent PlotDataView); applies `_transform` if set; stores in `_snapshot`; emits `'recomputed'`.

5. **`filterByDomain(domain)`** — returns new `PlotDataView(this, filterFn)` keeping only points within `domain.x` / `domain.y` ranges.

6. **`filterByROI(roiId)`** — returns new `PlotDataView(this, filterFn)` keeping only points inside named ROI bounding box (reads bounds from `opts.roiController.getROI(roiId).getBounds()`).

7. **`histogram({ field, bins })`** — computes histogram over `getData()[field]`; returns `{ counts: Float32Array, edges: Float32Array }`.

8. **`snapshot()`** — returns deep copy via `.slice()` on all typed arrays.

9. **`destroy()`** — removes all event listeners.

10. **Private `_filterPoints(data, predicate)` helper** — allocates output typed arrays of matching size; copies matching indices.

11. **ROIController stub** — in `_onMouseUp`, after clearing drag state, add:
    ```js
    if (roi) this.emit('roiFinalized', { roi, bounds: roi.getBounds() });
    ```
    (F14 will replace this stub with versioned payload.)

12. **PlotController opts prep** — add to constructor:
    ```js
    this._dataStore = opts.dataStore || new DataStore();
    this._dataView  = opts.dataView  || null;
    ```

---

### Validation checklist

- [ ] `new PlotDataView(dataStore).getData()` returns same data as `dataStore.getLogicalData()`
- [ ] `appendData` → DataStore emits `'dirty'` → PlotDataView dirty → recomputes on next `getData()`
- [ ] `dataStore.expireIfNeeded()` fires `'dataExpired'` → PlotDataView dirty
- [ ] `filterByDomain({ x: [0, 10] })` returns only points with x in [0, 10]
- [ ] `filterByROI(roiId)` returns only points inside ROI bounding box
- [ ] `getData()` called twice without dirty change → same snapshot (no recompute)
- [ ] `roiUpdated` (drag) does NOT mark view dirty
- [ ] `roiFinalized` stub DOES mark view dirty
- [ ] Child view cascade: parent `markDirty()` → child becomes dirty via `'dirty'` event
- [ ] `histogram({ field: 'x', bins: 32 })` → `counts.length === 32`, `edges.length === 33`
- [ ] `snapshot()` returns deep copy — mutating it does not affect cache
- [ ] `destroy()` removes all listeners (verify with `.listenerCount()`)
- [ ] 1M point identity `getData()` < 5 ms

---

### Notes

- Class named `PlotDataView` (file `src/plot/PlotDataView.js`) to avoid shadowing browser built-in `DataView`.
- Dirty cascade relies on child views listening for the `'dirty'` event on their parent view — arbitrarily deep chains propagate correctly.
- `roiUpdated` (drag) is explicitly NOT wired — this is the key performance invariant.
- F14 replaces the `_onMouseUp` stub with a proper versioned `roiFinalized` event. `PlotDataView` wiring does not need to change — it only cares about the event name.
- After completing: update `README.md`; update `examples/HubPage.jsx`.


---

## F14 [PENDING] Feature: ROI Domain Model + Mandatory Versioning

**Branch:** `feature/roi-domain-versioning` (create before starting)

**Depends on:** F15 (PlotDataView must exist with `roiFinalized` stub wired)

**Goal:** Add mandatory, monotonic versioning to every ROI. The serialized ROI schema gains `version`, `updatedAt`, and `domain: { x?, y? }` fields. `ROIController` gains `serializeAll()`, `deserializeAll()`, and `updateFromExternal()`. External updates are rejected if `incoming.version <= current.version`. Two new events: `roiFinalized` (mouseup / commit) and `roiExternalUpdate` (accepted external update).

---

### Files to modify

| File | Action |
|------|--------|
| `src/plot/ROI/ROIBase.js` | **Modify** — add `version`, `updatedAt`, `domain` fields; add `bumpVersion()` |
| `src/plot/ROI/ROIController.js` | **Modify** — replace `roiFinalized` stub; add `serializeAll()`, `deserializeAll()`, `updateFromExternal()`; emit `roiExternalUpdate` |
| `src/plot/PlotController.js` | **Modify** — forward new events in `_wireEvents()` |

---

### Implementation steps

1. **ROIBase constructor additions** (after existing `this.metadata = opts.metadata || {}`):
   ```js
   this.version   = opts.version   || 1;
   this.updatedAt = opts.updatedAt || Date.now();
   this.domain    = opts.domain    || { x: [this.x1, this.x2], y: [this.y1, this.y2] };
   ```
   For `LinearRegion`: set `domain = { x: [x1, x2] }` only (no `y` key — JSON-safe; y spans Infinity).

2. **`bumpVersion()`** on ROIBase:
   ```js
   bumpVersion() {
     this.version  += 1;
     this.updatedAt = Date.now();
     this.domain    = { x: [this.x1, this.x2], y: [this.y1, this.y2] };
   }
   ```

3. **Replace `_onMouseUp` stub in ROIController** — call `roi.bumpVersion()` then emit full payload:
   ```js
   roi.bumpVersion();
   this.emit('roiFinalized', { roi, bounds: roi.getBounds(), version: roi.version, updatedAt: roi.updatedAt, domain: roi.domain });
   this.emit('roisChanged', { rois: this.getAllROIs() });
   ```

4. **`serializeAll()`** — maps all ROIs to `{ id, type, version, updatedAt, domain, metadata }`.

5. **`deserializeAll(array)`** — clears `_rois`, reconstructs each ROI from type + domain fields, restores version/updatedAt/domain/metadata, emits `roisChanged` once.

6. **`updateFromExternal(serializedROI)`** — version-gated external update:
   - If `existing && incoming.version <= existing.version` → return `false` (silent reject)
   - Else: apply bounds from `serializedROI.domain`, set fields, emit `roiExternalUpdate`, emit `roisChanged`, return `true`
   - If ROI not found in `_rois`: create it, add it, emit same events

7. **PlotController `_wireEvents()`** — add forwarding:
   ```js
   this._roiController.on('roiFinalized',      e => this.emit('roiFinalized',      e));
   this._roiController.on('roiExternalUpdate',  e => this.emit('roiExternalUpdate', e));
   ```

---

### Validation checklist

- [ ] Create ROI → `roi.version === 1`, `roi.updatedAt` is a recent timestamp
- [ ] Drag ROI → `roiUpdated` fires during drag; version unchanged mid-drag
- [ ] Mouseup → `roiFinalized` fires; `roi.version === 2`
- [ ] `serializeAll()` → array with correct `{ id, type, version, updatedAt, domain, metadata }` per ROI
- [ ] `deserializeAll(arr)` → `getAllROIs().length === arr.length`
- [ ] `updateFromExternal({ version: 5 })` on ROI at v3 → accepted, returns `true`, `roiExternalUpdate` fires
- [ ] `updateFromExternal({ version: 2 })` on ROI at v3 → rejected, returns `false`, no event
- [ ] `updateFromExternal({ version: 3 })` (equal) on ROI at v3 → rejected, returns `false`
- [ ] ConstraintEngine still enforces parent-child bounds (new fields don't collide with `x1/x2/y1/y2` reads)
- [ ] PlotDataView (F15): `roiFinalized` marks dirty; `roiUpdated` does not
- [ ] `roiExternalUpdate` marks PlotDataView dirty
- [ ] No infinite update loops (`updateFromExternal` does not re-emit `roiFinalized`)

---

### Notes

- `LinearRegion.bumpVersion()` override sets `domain = { x: [this.x1, this.x2] }` only (omit `y`).
- `updateFromExternal` does NOT call `bumpVersion()` — the incoming version IS the authoritative version. Do not increment locally.
- `ConstraintEngine` reads `roi.x1/x2/y1/y2` directly; new fields have no collision risk.
- After completing: update `README.md`; update `examples/HubPage.jsx`.


---

## F17 [PENDING] Feature: Shared Data Infrastructure

**Branch:** `feature/shared-data` (create before starting)

**Depends on:** F15 (PlotDataView), F16 (DataStore `getLogicalData`)

**Goal:** Allow multiple `PlotController` instances to share a single `DataStore` and/or `PlotDataView`. ROI filtering may affect some views and not others. Base data remains immutable. DataViews are reused across plots without duplicate recompute.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/plot/PlotController.js` | **Modify** — complete `opts.dataStore` / `opts.dataView` injection; ownership flags; render path uses DataView when present; safe `destroy()` |
| `examples/SharedDataExample.jsx` | **Create new** — two-plot demo |
| `examples/HubPage.jsx` | **Modify** — link SharedDataExample |

---

### Implementation steps

1. **PlotController constructor** — finalize injection (replace F15 prep stubs):
   ```js
   this._dataStore     = opts.dataStore || new DataStore();
   this._ownsDataStore = !opts.dataStore;
   this._dataView      = opts.dataView  || null;
   this._ownsDataView  = !opts.dataView;
   ```

2. **Render path** — in `_render()`, if `this._dataView` is set, use `this._dataView.getData()` in place of `this._dataStore.getGPUAttributes()` to get point attributes.

3. **DataView recompute → render trigger** — after setting `this._dataView` in constructor:
   ```js
   if (this._dataView) {
     this._dataView.on('recomputed', () => { this._dataTrigger++; this._dirty = true; });
   }
   ```

4. **`destroy()`** — only release owned resources:
   ```js
   if (this._ownsDataStore && this._dataStore.destroy) this._dataStore.destroy();
   if (this._ownsDataView  && this._dataView  && this._dataView.destroy) this._dataView.destroy();
   ```

5. **Create `examples/SharedDataExample.jsx`**:
   - Single `DataStore` shared between Plot A and Plot B
   - Plot A renders base `PlotDataView` (all points)
   - Plot B renders `baseView.filterByROI(roiId)` (points inside a LinearRegion on Plot A)
   - "Generate data" button appends random points → both plots update
   - Drawing + releasing a LinearRegion on Plot A → `roiFinalized` → Plot B filtered view recomputes
   - Removing ROI → Plot B reverts to all points

6. **Update `examples/HubPage.jsx`** — add link to SharedDataExample.

---

### Validation checklist

- [ ] Two PlotControllers sharing one DataStore: `appendData()` reflects in both plots within same frame
- [ ] `PlotController({ dataStore: external }).destroy()` does NOT call `external.destroy()`
- [ ] Plot A (base view): all 1000 points visible
- [ ] Plot B (filtered view): only ROI-interior points visible
- [ ] Drag ROI → Plot B does NOT recompute (dirty stays false during drag)
- [ ] Release ROI (mouseup) → Plot B recomputes within one render frame
- [ ] Append 10k points: both plots update; shared DataView recomputes once (not twice)
- [ ] Destroying Plot A leaves DataStore and shared DataView intact for Plot B

---

### Notes

- Ownership is determined by whether `opts.dataStore` / `opts.dataView` was provided — not by a ref-count. External callers (the example component) are responsible for destroying shared resources when all consumers are gone.
- `PlotController._render()` must handle the case where `_dataView.getData()` returns a snapshot with different `.length` than stored `_dataTrigger` — just treat the snapshot as the authoritative GPU source.
- After completing: update `README.md` with shared-data section; update `examples/HubPage.jsx`.


---

## F18 [PENDING] Feature: External Integration Interface Contracts

**Branch:** `feature/integration-contract` (create before starting)

**Depends on:** F14 (ROI schema + `updateFromExternal`), F15 (PlotDataView API stable), F16 (DataStore API stable), F17 (shared-data pattern demonstrated)

**Goal:** Define strict contracts for external integration packages. MasterPlot itself implements no HTTP, WebSocket, or authentication logic. This feature is primarily interface definitions + documentation, validated by mock implementations.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/integration/ExternalDataAdapter.js` | **Create new** — interface definition with JSDoc |
| `src/integration/ExternalROIAdapter.js` | **Create new** — interface definition with JSDoc |
| `src/integration/MockDataAdapter.js` | **Create new** — mock implementation (random data on timer) |
| `src/integration/MockROIAdapter.js` | **Create new** — localStorage-backed mock |
| `README.md` | **Modify** — add "External Integration" section |
| `examples/HubPage.jsx` | **Modify** — link integration guide or demo |

---

### Implementation steps

1. **`src/integration/ExternalDataAdapter.js`** — base class with throw-on-call methods:
   - `replaceData(bufferStruct)` — full snapshot replacement; `bufferStruct = { x: Float32Array, y: Float32Array, size?: Float32Array, color?: Uint8Array }`
   - `appendData(bufferStruct)` — incremental append; same struct

2. **`src/integration/ExternalROIAdapter.js`** — base class with throw-on-call methods:
   - `async load()` → `Promise<SerializedROI[]>` — load persisted ROIs on init
   - `async save(serializedROI)` → `Promise<void>` — persist after `roiFinalized`
   - `subscribe(callback)` → `Function` (unsubscribe) — receive external ROI updates; engine calls `roiController.updateFromExternal(roi)` on each callback

3. **`src/integration/MockDataAdapter.js`** — extends `ExternalDataAdapter`:
   - Constructor: `{ dataStore, intervalMs = 500, batchSize = 100 }`
   - `start()` — `setInterval` generating random float batches → calls `appendData`
   - `stop()` — `clearInterval`
   - `replaceData` / `appendData` — delegate to `this._dataStore`

4. **`src/integration/MockROIAdapter.js`** — extends `ExternalROIAdapter`:
   - `load()` — reads from `localStorage[storageKey]`; returns parsed array or `[]`
   - `save(roi)` — upserts into localStorage array by `roi.id`
   - `subscribe(callback)` — wires `roiController.on('roiFinalized', ...)` → save + broadcast; returns unsubscribe
   - `attach()` — convenience: `load()` → `roiController.deserializeAll(rois)` + starts subscription

5. **`README.md` integration section** covering:
   - Architecture boundary: engine core vs. integration layer
   - `ExternalDataAdapter` contract with `bufferStruct` type table
   - `ExternalROIAdapter` contract with event lifecycle and version conflict rules
   - Mock adapter example code snippet
   - ASCII data flow diagram: `External Source → Adapter → DataStore → DataView → PlotController → deck.gl`
   - ROI sync flow: `roiFinalized → adapter.save() → storage → (other clients) → adapter.subscribe callback → updateFromExternal() → roiExternalUpdate → DataView dirty`

6. **Update `examples/HubPage.jsx`** — add link to integration guide section in README (or link SharedDataExample if it demonstrates adapters).

---

### Validation checklist

- [ ] Import and subclass both adapters; calling unimplemented base methods throws descriptive `Error`
- [ ] `MockDataAdapter.start()` → DataStore receives `appendData` batches at configured interval
- [ ] `MockDataAdapter.replaceData({ x, y })` → DataStore cleared; `getPointCount() === x.length`
- [ ] `MockROIAdapter.attach()` → localStorage ROIs restored via `deserializeAll()`
- [ ] Create ROI → `roiFinalized` → `MockROIAdapter.save()` → ROI found in localStorage JSON
- [ ] Reload (call `attach()` again) → ROI restored at correct version
- [ ] `subscribe()` returns unsubscribe function; after calling it, callback no longer fires
- [ ] External update with stale version → `updateFromExternal` rejects; localStorage unchanged
- [ ] README integration section renders correctly in GitHub markdown

---

### Notes

- `src/integration/` is a new directory. No webpack changes needed.
- JavaScript does not have abstract classes; throw-on-call is the idiomatic interface contract pattern here.
- `MockROIAdapter.subscribe` multi-subscriber broadcast is a simplification — a real server would broadcast to all connected clients. The mock validates the contract shape only.
- F18 adds no new engine events. All events it relies on (`roiFinalized`, `roiExternalUpdate`, `dataExpired`) are defined in F14/F16.
- After completing: README integration section IS the primary deliverable. Update `examples/HubPage.jsx`.


- **2026-02-22 [Claude]**: F16, F15, F14, F17, F18 added as PENDING (from Features.md). Mandatory implementation order: F16 → F15 → F14 → F17 → F18. Plan version 3.0.
- **2026-02-22 [Claude]**: Plan reorganized to v3.1 — completed specs archived to `docs/plan-archive.md`; PLAN.md now contains compact summaries + pending specs only. Future agents: follow rule 7 (archive on completion).
