# MasterPlot Plan Archive

Historical record of completed features and full implementation specs.
All active/pending work is in [PLAN.md](../PLAN.md).

---

## EX20 [COMPLETED] Axis Options Showcase

**Branch:** `feature/EX20`
**Completed:** 2026-04-04
**Depends on:** F35

### Purpose

A single page (`axis-showcase.html`) with 6 small plots arranged in a 2×3 grid, each seeded with the same 200 random points, demonstrating the key axis positioning and appearance options from F34/F35.

### Layout (2 columns × 3 rows)

| Position | Title | Config |
|---|---|---|
| Top-left | Default border axes | `bordered: true`, `mode: 'border'`, edges: `['bottom']` / `['left']` |
| Top-right | No border fill | `bordered: false`, `mode: 'border'` |
| Mid-left | Mirrored axes | `bordered: true`, x edges: `['bottom','top']`, y edges: `['left','right']` |
| Mid-right | Crossing at zero | `bordered: true`, x+y: `{ mode: 'relative', crossingValue: 0, snapTolerancePx: 0 }` |
| Bot-left | Mobile axes (snap) | `bordered: true`, x+y: `{ mode: 'relative', crossingValue: 0, snapTolerancePx: 30, offscreen: 'border' }` |
| Bot-right | Mobile, hide offscreen | `bordered: true`, x+y: `{ mode: 'relative', crossingValue: 0, snapTolerancePx: 30, offscreen: 'hide' }` |

### Data

Deterministic LCG `makeData()` produces 200 points: x uniform `[-5,5]`, y uniform `[-5,5]`, quadrant-based RGBA colors. Module-level `SEED_DATA` constant; each `PlotCell` seeds its own `PlotController` with the same data and resets domain to `[-6,6]`.

### New files

- `examples/AxisShowcaseExample.jsx` — page component + `PlotCell`
- `examples/src/axis-showcase.js` — webpack entry
- `public/axis-showcase.html` — HTML template

**Also updated:** `webpack.config.js` (entry + HtmlWebpackPlugin), `examples/HubPage.jsx` (card), `README.md` (Phase 7 section).

---

## F35 [COMPLETED] Axis Positioning Modes

**Branch:** `feature/ARCH-G-F34-F35`
**Completed:** 2026-04-04

### AxisController new options

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `'border'|'relative'` | `'border'` | Positioning mode |
| `edges` | `string[]|null` | `null` (renderer default: `['bottom']`/`['left']`) | Border mode: edges to render at. x → `'top'`/`'bottom'`; y → `'left'`/`'right'`. Multiple = mirrored axes. |
| `crossingValue` | `number` | `0` | Relative mode: data coordinate the axis is anchored to (y-value for x-axis, x-value for y-axis) |
| `snapTolerancePx` | `number` | `0` | Relative mode: pixel distance from edge at which axis snaps to border. 0 = stationary. |
| `offscreen` | `'border'|'hide'` | `'border'` | Relative mode: behavior when crossingValue outside visible domain |
| `labelSide` | `'auto'|'positive'|'negative'` | `'auto'` | Relative mode: which side of axis line labels appear. auto = toward nearest edge |

### AxisRenderer behavior

**Border mode:** Grid drawn once. For each edge: outward-facing ticks + labels. `_renderXGrid`/`_renderYGrid` separated from `_renderXTicksAtEdge`/`_renderYTicksAtEdge` to avoid doubled grid lines with multiple edges.

**Relative mode (x-axis):** `crossingValue` is a y-data value. `screenY = yScale(crossingValue)`. Off-screen → snap to nearest border edge or hide. Snap check → within `snapTolerancePx` of top/bottom → render as border. Mid-plot → horizontal axis line at `screenY`; ticks flip direction at plot midpoint (toward nearer edge); labels on side resolved from `labelSide` (auto = same as ticks; positive = above line = lower screen-y; negative = below).

**Relative mode (y-axis):** Mirror of above with x-axis. `crossingValue` is an x-data value. `screenX = xScale(crossingValue)`. Snap to left/right. Tick flip at horizontal midpoint.

### Files modified

- `src/plot/axes/AxisController.js` — 6 new constructor options; `_formatter` unchanged
- `src/plot/axes/AxisRenderer.js` — replaced `_renderXTicks`/`_renderYTicks` with: `_renderXAxis`/`_renderYAxis` (dispatch); `_renderXGrid`/`_renderYGrid`; `_renderXTicksAtEdge(ctx, pa, ticks, edge)`/`_renderYTicksAtEdge`; `_renderXLabel`/`_renderYLabel`; `_renderXAxisRelative`/`_renderYAxisRelative` (full relative logic)

---

## F34 [COMPLETED] Bordered Plot Mode

**Branch:** `feature/ARCH-G-F34-F35`
**Completed:** 2026-04-04

### Purpose

Fill the four axis gutter areas (margins outside the inner plot rectangle) with the container's CSS background color so data never renders visually behind tick labels. No border line is drawn. Off by default.

### API

`new PlotController({ bordered: true })` / `<PlotCanvas bordered />`

`AxisRenderer.setBordered(bool)` — can also be called directly on an AxisRenderer instance.

### Behavior

Before any tick/label rendering, `AxisRenderer._fillGutters()` reads `getComputedStyle(canvas.parentElement).backgroundColor` and fills four `fillRect` calls covering the top, bottom, left, and right margin rectangles. If the resolved color is `transparent` or `rgba(0, 0, 0, 0)`, the fill is skipped (no visual change). No change to deck.gl viewport.

### Files modified

- `src/plot/axes/AxisRenderer.js` — `_bordered` flag; `setBordered(on)` method; `_fillGutters(ctx, W, H, pa)` private method; called from `render()` after `_clear()`
- `src/plot/PlotController.js` — `_bordered` from `opts.bordered ?? false`; calls `_axisRenderer.setBordered(true)` after `AxisRenderer` init
- `src/components/PlotCanvas.jsx` — `bordered` prop forwarded to `PlotController` constructor

---

## ARCH-G [COMPLETED] AxisController Config/Domain Split

**Branch:** `feature/ARCH-G-F34-F35`
**Completed:** 2026-04-04

### Motivation

Split `AxisController` into a config-only object (scale type, tick format, appearance) and move all domain-state methods (`setDomain`, `getDomain`, `zoomAround`, `panByPixels`, `scaleDomainFromMidpoint`) into `ViewportController`. This allows axis configuration to be shared across multiple `PlotController` instances (shared-style pattern) while each plot retains its own independent domain state.

### New public API

**`plotController.xAxis` / `plotController.yAxis`** → config-only `AxisController`

**`plotController.viewport`** → `ViewportController` with all domain mutations:

| Old call | New call |
|---|---|
| `plotController.xAxis.setDomain([a, b])` | `plotController.viewport.setXDomain([a, b])` |
| `plotController.yAxis.setDomain([a, b])` | `plotController.viewport.setYDomain([a, b])` |
| `plotController.xAxis.getDomain()` | `plotController.viewport.getXDomain()` |
| `plotController.yAxis.getDomain()` | `plotController.viewport.getYDomain()` |
| `plotController.xAxis.zoomAround(c, f)` | `plotController.viewport.zoomAroundX(c, f)` |
| `plotController.yAxis.zoomAround(c, f)` | `plotController.viewport.zoomAroundY(c, f)` |
| `plotController.xAxis.panByPixels(px)` | `plotController.viewport.panByPixels({ dx: px })` |
| `plotController.yAxis.panByPixels(px)` | `plotController.viewport.panByPixels({ dy: px })` |
| `plotController.xAxis.scaleDomainFromMidpoint(f)` | `plotController.viewport.scaleDomainFromMidpointX(f)` |
| `plotController.yAxis.scaleDomainFromMidpoint(f)` | `plotController.viewport.scaleDomainFromMidpointY(f)` |

Additional viewport method: `setDomains(xDomain, yDomain)` — sets both atomically (one scale rebuild, one event).

### AxisController new shape

Config-only (no EventEmitter). Constructor: `new AxisController({ scaleType, tickCount, label, tickFormat })`.

Methods: `getScale(domain, range)` → d3 scale; `getTicks(scale)` → `[{value, screen, label}]`; `formatTick(value, index)` → string; `getTickSize()` → number (px).

`xAxis`/`yAxis` props on `PlotCanvas` allow passing shared config instances from outside.

### Files modified

- `src/plot/axes/AxisController.js` — major refactor: removed domain state + EventEmitter; added `getScale(domain, range)`, `getTicks(scale)`, `formatTick`, `getTickSize`
- `src/plot/ViewportController.js` — added all domain-mutation methods; `setAxisConfig(xAxis, yAxis)`; `_updateScales()` builds scales internally; `getXScale()`/`getYScale()` accessors; `'domainChanged'` event carries `{ xDomain, yDomain }`
- `src/plot/PlotController.js` — accepts `opts.xAxis`/`opts.yAxis` shared instances; delegates all domain ops to `_viewport`; listens to `viewport.'domainChanged'` instead of per-axis events
- `src/plot/axes/AxisRenderer.js` — `_renderXTicks`/`_renderYTicks` now get scale from `viewport.getXScale()`/`getYScale()` and pass to `axis.getTicks(scale)`
- `src/components/PlotCanvas.jsx` — added `xAxis`/`yAxis` props
- `src/plot/LUTHistogramController.js` — `xAxis.setDomain` → `viewport.setXDomain`, `yAxis.setDomain` → `viewport.setYDomain`
- `src/plot/layers/BitmapViewGenerator.js` — `xAxis.getDomain()` → `viewport.getXDomain()`, `yAxis.getDomain()` → `viewport.getYDomain()`
- `src/plot/layers/SignalDataLayer.js` — doc comment updated
- `examples/ExampleApp.jsx`, `examples/LiveSignalsExample.jsx`, `examples/SeismographyExample.jsx`, `examples/SpectrogramV2Example.jsx`, `examples/DataLoadersExample.jsx`, `examples/docs/GettingStartedPage.jsx` — all `xAxis.*`/`yAxis.*` domain calls updated to `viewport.*`

---

## DOC2 [COMPLETED] Documentation: Getting Started Tutorial

**Branch:** `feature/DOC2`
**Completed:** 2026-03-07

### Modified files

- `examples/docs/GettingStartedPage.jsx` — replaced placeholder with full 7-step tutorial

### Content

Seven numbered steps, each rendered as a `<h3>` with a numbered badge, one or more `CodeBlock` components (with copy buttons via the shared `CodeBlock` utility), and inline `calloutStyle` note boxes where relevant:

1. **Install** — `git clone` + `npm install`; minimal webpack entry boilerplate (`src/myplot.js`); HTML template (`public/myplot.html`)
2. **Mount a plot** — minimal `PlotCanvas` + `onInit` callback; 1 000 static points via `ctrl.appendData({ x, y, size, color })`; callout: React must never hold data arrays or controller in `useState`
3. **Live data append** — `setInterval` + `appendData` every 2 s; `ctrl.setAutoExpand(true)`; callout: rolling mode via `enableRolling({ maxAgeMs: 30_000 })`
4. **Zoom and pan** — wheel zoom + drag-pan built-in; `ctrl.setPanMode('drag'|'follow')`; spacebar → `autoScale()`; `setHomeDomain(x, y)`; callout: y-axis inverted range + sign convention reference to Architecture page
5. **Add a LinearRegion ROI** — keyboard guide (L/R/D/V/H keys); programmatic creation via `new LinearRegion({ x1, x2 })` + `bumpVersion()` + `addROI()` + `onCreate()` + `emit('roisChanged')`; callout: constraint propagation + version bump on mouseup only when bounds changed
6. **Listen to events** — `ctrl.on('roiFinalized')`, `ctrl.on('domainChanged')`, `ctrl.on('dataAppended')`, `ctrl.on('zoomChanged')`, `ctrl.on('roiCreated'/'roiDeleted'/'roiUpdated')`
7. **Shared DataStore (advanced)** — two `PlotCanvas` instances sharing one module-level `DataStore`; zero data duplication; `dataStore` prop on `PlotCanvas`; live demo link → `shared-data.html`

---

## EX12 [COMPLETED] Stress Test Preset Segments

**Branch:** `feature/EX12`
**Completed:** 2026-03-06

### Goal
Add long-duration synthetic audio segments to the spectrogram preset dropdown to benchmark STFT throughput, rendering performance, and browser memory behavior.

### Files Modified
- `examples/SpectrogramExample.jsx` — added `STRESS_SR`, `STRESS_LOWPASS_HZ`, `DEFAULT_PRESET_PATH`, `STRESS_TEST_DURATIONS` constants; `lastPresetPathRef` ref; `generatingMsg` state; `handleStressTest()` async generator; modified `handlePresetLoad` to track last preset path and dispatch `stress:` prefix values; added `<optgroup label="── Stress Test ──">` to preset dropdown; `generatingMsg` label display.
- `README.md` — updated capability header; added stress-test row to spectrogram table; updated file listing.
- `PLAN.md` — marked EX12 COMPLETED; updated Feature Status Index; added changelog entry.

### Implementation Details
- **Durations:** 5, 10, 15, 30, 60 min options in `<optgroup label="── Stress Test ──">` below regular preset options.
- **Target rate:** 8 000 Hz (`STRESS_SR`) — original spec said 4 000 Hz but `OfflineAudioContext` enforces a minimum of 8 000 Hz per the Web Audio API spec. Anti-aliasing lowpass at 3 600 Hz (`STRESS_LOWPASS_HZ`, below Nyquist = 4 000 Hz).
- **Algorithm:** (1) `fetch` + `decodeAudioData` the last loaded preset WAV (default `sounds/plane1.wav`); (2) resample via `OfflineAudioContext(1, offlineLen, STRESS_SR)` with `BiquadFilterNode` (lowpass, 3 600 Hz) in the graph; (3) randomly stitch copies of the downsampled clip (random `startOffset` per copy) until `targetSamples = minutes × 60 × STRESS_SR` are filled; (4) wrap in `AudioContext.createBuffer` at `STRESS_SR`, call `outBuf.copyToChannel(output, 0)`, then hand to existing `loadAudioBuffer(outBuf, 'stress-Nmin')`.
- **UI:** Dropdown disabled while `loading`; label area shows orange `Generating N min…` text while in progress (via `generatingMsg` state); clears to `'Preset'` when done.
- **Memory note (code comment):** Documents that a future `DataStore` paging / tile-based STFT strategy could enable arbitrarily long recordings without proportional memory use, linking to the rolling ring buffer API.

### Memory Budget
| Duration | Samples @8 kHz | Float32 size |
|---|---|---|
| 5 min  | 2 400 000 | ≈ 9.6 MB |
| 10 min | 4 800 000 | ≈ 19.2 MB |
| 15 min | 7 200 000 | ≈ 28.8 MB |
| 30 min | 14 400 000 | ≈ 57.6 MB |
| 60 min | 28 800 000 | ≈ 115 MB |

---

## F24 [COMPLETED] Spectrogram Filter Popup Window

**Branch:** `feature/F24`
**Completed:** 2026-03-06
**Depends on:** ARCH-E

### Goal

Move `FilterPanel` out of the waveform sidebar into a dedicated connected popup window, reducing main-page clutter. Single source of truth: `FilterController` state lives in the main window; the popup reflects and drives it via `BroadcastChannel`.

### Files modified

| File | Action |
|------|--------|
| `examples/SpectrogramExample.jsx` | Replaced inline `FilterPanel` + Clear button sidebar with "Open Filter Panel" button; added `usePopupChannel` hook (channel: `spectrogram-filter`); wired `onMessage` to sync FC state and dispatch Apply/Clear; `buildFilterStateMsg` helper; send FILTER_STATE after Apply/Clear and 300 ms after popup opens; removed `applying`/`filterSampleRate` states (now unused). |
| `examples/SpectrogramPopup.jsx` | Added `FilterPanelPopup` component (local `FilterController` mirror, `suppressRef` anti-loop, `send`/`lastMessage` driven); added `case 'filter'` to `renderPanel`. |

### BroadcastChannel messages (channel: `spectrogram-filter`)

| Direction | Type | Payload |
|-----------|------|---------|
| Main → Popup | `FILTER_STATE` | `{ filterType, cutoff, q, lowFreq, highFreq, applied, sampleRate }` |
| Popup → Main | `FILTER_STATE` | same (on slider/dropdown change) |
| Popup → Main | `FILTER_APPLY` | `{}` |
| Popup → Main | `FILTER_CLEAR` | `{}` |

### Anti-loop design

Main receives `FILTER_STATE` → directly mutates `fc.state` fields (no emit → no re-echo). Popup receives `FILTER_STATE` → sets `suppressRef.current = true` before mutating local FC state and emitting `'changed'`; `onChange` listener skips sending if suppressed.

---

## F18 [COMPLETED] Feature: External Integration Interface Contracts

**Branch:** `feature/integration-contract`
**Completed:** 2026-02-22

### Goal

Define strict contracts for external integration packages. MasterPlot itself implements no HTTP, WebSocket, or authentication logic. This feature is primarily interface definitions + documentation, validated by mock implementations.

### Files created / modified

| File | Action |
|------|--------|
| `src/integration/ExternalDataAdapter.js` | Created — base class with throw-on-call methods + JSDoc |
| `src/integration/ExternalROIAdapter.js` | Created — base class with throw-on-call methods + `attach()`/`detach()` helpers |
| `src/integration/MockDataAdapter.js` | Created — random batch generator (setInterval); extends ExternalDataAdapter |
| `src/integration/MockROIAdapter.js` | Created — localStorage-backed ROI persistence; extends ExternalROIAdapter |
| `README.md` | Modified — added "External Integration (F18)" section with architecture diagram, contract docs, and mock snippets |
| `examples/HubPage.jsx` | Modified — added Integration Guide card linking to README section |

### Implementation summary

1. **ExternalDataAdapter** — base class requiring `replaceData(bufferStruct)` and `appendData(bufferStruct)`. Both throw descriptive errors if not overridden. `bufferStruct = { x: Float32Array, y: Float32Array, size?: Float32Array, color?: Uint8Array }`.

2. **ExternalROIAdapter** — base class requiring `load()`, `save(roi)`, `subscribe(callback)`. Provides a concrete `attach()` and `detach()` that wire `roiFinalized` → `save()` and `subscribe` → `updateFromExternal()`.

3. **MockDataAdapter** — generates random `(x, y)` batches at a configurable `intervalMs`/`batchSize`. `start()` / `stop()` control the interval. `replaceData` = `clear()` + `appendData()`.

4. **MockROIAdapter** — `load()` reads `localStorage[storageKey]`; `save()` upserts by `roi.id` and broadcasts to in-process `_subscribers`; `subscribe()` pushes callback into `_subscribers` and returns splice-based unsubscribe.

### Validation checklist

- [x] Import and subclass both adapters; calling unimplemented base methods throws descriptive `Error`
- [x] `MockDataAdapter.start()` → DataStore receives `appendData` batches at configured interval
- [x] `MockDataAdapter.replaceData({ x, y })` → DataStore cleared; `getPointCount() === x.length`
- [x] `MockROIAdapter.attach()` → localStorage ROIs restored via `deserializeAll()`
- [x] Create ROI → `roiFinalized` → `MockROIAdapter.save()` → ROI found in localStorage JSON
- [x] `subscribe()` returns unsubscribe function; after calling it, callback no longer fires
- [x] External update with stale version → `updateFromExternal` rejects; localStorage unchanged
- [x] README integration section renders correctly in GitHub markdown

---

## F17 [COMPLETED] Feature: Shared Data Infrastructure

**Branch:** `feature/shared-data`
**Completed:** 2026-02-22

### Goal

Allow multiple `PlotController` instances to share a single `DataStore` and/or `PlotDataView`. ROI filtering may affect some views and not others. Base data remains immutable. DataViews are reused across plots without duplicate recompute.

### Files created / modified

| File | Action |
|------|--------|
| `src/plot/PlotController.js` | **Modified** — `_ownsDataStore`/`_ownsDataView` flags; `_onDataViewDirty`/`_onDataViewRecomputed` bound handlers; DataView events wired in `_wireEvents()`; `_render()` uses `_dataView.getData()` when set; `destroy()` respects ownership; `setDataView(view, owns)` added; DataStore `'dirty'` wired to `_dirty` when no DataView |
| `src/components/PlotCanvas.jsx` | **Modified** — `dataStore` and `onInit` props accepted; passed through to PlotController |
| `examples/SharedDataExample.jsx` | **Created** — two-plot demo |
| `src/shared-data.js` | **Created** — webpack entry |
| `public/shared-data.html` | **Created** — HTML page |
| `webpack.config.js` | **Modified** — `shared-data` entry + HtmlWebpackPlugin |
| `examples/HubPage.jsx` | **Modified** — Shared Data link added |
| `README.md` | **Modified** — Shared DataStore / DataView section added |

### Implementation summary

1. **PlotController constructor** — added ownership flags and bound DataView handlers:
   ```js
   this._ownsDataStore = !opts.dataStore;
   this._ownsDataView  = !opts.dataView;
   this._onDataViewDirty      = () => { this._dirty = true; };
   this._onDataViewRecomputed = () => { this._dataTrigger++; };
   ```

2. **`_wireEvents()`** — DataStore `'dirty'` wired to `_dirty` when no DataView is present (shared store without DataView still re-renders); initial DataView events wired if `_dataView` is provided at construction time.

3. **`_render()`** — uses `_dataView.getData()` when a DataView is present, falling back to `_dataStore.getGPUAttributes()` otherwise. Both return the same `{ x, y, size, color }` shape.

4. **`setDataView(dataView, owns = true)`** — tears down old DataView listeners (and destroys if owned), wires new view, marks dirty.

5. **`destroy()`** — respects ownership flags:
   ```js
   if (this._ownsDataView  && this._dataView?.destroy)  this._dataView.destroy();
   if (this._ownsDataStore && this._dataStore?.destroy) this._dataStore.destroy();
   ```

6. **PlotCanvas.jsx** — `dataStore` prop threads through to PlotController; `onInit(controller)` callback fires after `controller.init()` for post-init DataView wiring.

7. **SharedDataExample.jsx** — demonstrates all F17 behaviours:
   - Single `DataStore` shared by two controllers (both receive `dataStore` prop)
   - `PlotDataView` wrapping the shared store, with Plot A's `roiController`
   - `baseView` set on both plots at startup (no filtering)
   - On `roiCreated` (LinearRegion on Plot A): `baseView.filterByROI(roi.id)` created and set on Plot B
   - On `roiDeleted`: Plot B reverts to `baseView`
   - "Generate data" appends to shared store → both plots update

### Validation checklist (verified by code review)

- [x] Two PlotControllers sharing one DataStore: `appendData()` fires `'dirty'`; both plots' `_dirty` set via DataView or direct DataStore listener
- [x] `PlotController({ dataStore: external }).destroy()` does NOT call `external.destroy()` — ownership flag prevents it
- [x] Plot A (base view): all points visible
- [x] Plot B (filtered view): only ROI-interior points visible
- [x] Drag ROI → Plot B does NOT recompute (dirty stays false during drag — `roiUpdated` not wired in PlotDataView)
- [x] Release ROI (mouseup) → `roiFinalized` → PlotDataView marks dirty → Plot B recomputes next getData()
- [x] Append: both plots update; shared DataView recomputes once (single `recomputed` event)
- [x] `setDataView()` destroys old owned view, wires new view, marks dirty

---

## F10 [COMPLETED] Feature: Audio file loading in SpectrogramExample

**File:** `examples/SpectrogramExample.jsx` (only file changed — no webpack changes needed)

**Behaviour:**
- Add an **"Open audio file"** button in the header that triggers a hidden `<input type="file" accept="audio/*">`. The browser's native file picker lets the user navigate to the `sounds/` folder and select a file.
- Supported formats: anything the browser's `AudioContext.decodeAudioData` can decode (WAV, MP3, OGG, FLAC, etc.).
- On file select:
  1. Stop live-append (clear interval, uncheck checkbox).
  2. Decode audio via `AudioContext.decodeAudioData` — uses the file's actual `sampleRate` (may differ from 44100).
  3. Clear all existing sample + waveform data.
  4. Load decoded PCM (`audioBuffer.getChannelData(0)`) directly into `samplesRef`.
  5. Downsample for waveform using the same `WAVEFORM_STEP = 50` logic as `appendSamples`.
  6. Update both x-axis domains to `[0, durationSecs]` and spectrogram y-axis to `[0, sr / 2]`.
  7. Trigger dirty flags on both panels.
  8. Log: `Loaded: <filename>  ·  <sr> Hz  ·  <dur>s`
- While decoding, button shows "Loading…" and is disabled.
- After load, clicking "Open audio file" again clears old data and loads the new file.

**New refs and state:**
```js
const fileInputRef        = useRef(null);
const loadedSampleRateRef = useRef(SAMPLE_RATE);  // actual sr of loaded audio
const [loading, setLoading] = useState(false);
```

**`handleFileLoad` async function** (add after `handleWindowSizeChange`):
```js
const handleFileLoad = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  setLoading(true);
  clearInterval(intervalRef.current);
  setLiveAppend(false);
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioCtx    = new AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    audioCtx.close();
    const pcm = audioBuffer.getChannelData(0);
    const sr  = audioBuffer.sampleRate;
    loadedSampleRateRef.current = sr;
    // Clear all existing data
    samplesRef.current   = new Float32Array(0);
    sampleCntRef.current = 0;
    waveXRef.current     = new Float32Array(0);
    waveYRef.current     = new Float32Array(0);
    // Load PCM
    samplesRef.current   = pcm;
    sampleCntRef.current = pcm.length;
    dataTriggerRef.current += 1;
    // Downsample for waveform
    const numWavePts = Math.floor(pcm.length / WAVEFORM_STEP);
    const newWX = new Float32Array(numWavePts);
    const newWY = new Float32Array(numWavePts);
    for (let i = 0; i < numWavePts; i++) {
      newWX[i] = (i * WAVEFORM_STEP) / sr;
      newWY[i] = pcm[i * WAVEFORM_STEP];
    }
    waveXRef.current = newWX;
    waveYRef.current = newWY;
    waveDataTrigger.current += 1;
    const durationSecs = pcm.length / sr;
    xAxisRef.current?.setDomain([0, durationSecs]);
    waveXAxisRef.current?.setDomain([0, durationSecs]);
    yAxisRef.current?.setDomain([0, sr / 2]);   // Nyquist for this file
    dirtyRef.current     = true;
    waveDirtyRef.current = true;
    addLog(`Loaded: ${file.name}  ·  ${sr} Hz  ·  ${durationSecs.toFixed(2)}s`);
  } catch (err) {
    addLog(`Error loading file: ${err.message}`);
  }
  setLoading(false);
  e.target.value = '';  // allow re-loading same file
};
```

**Fix `renderFrame`** — replace hardcoded `SAMPLE_RATE` with ref so it matches loaded audio:
```js
// BEFORE:
sampleRate:  SAMPLE_RATE,
// AFTER:
sampleRate:  loadedSampleRateRef.current,
```

**JSX header** — add after the "Live append" label:
```jsx
<label style={checkboxLabelStyle}>
  <button
    onClick={() => fileInputRef.current?.click()}
    disabled={loading}
    style={{
      background: '#222', border: '1px solid #555', borderRadius: 3,
      color: loading ? '#555' : '#adf', padding: '2px 8px',
      fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'monospace',
    }}
  >
    {loading ? 'Loading…' : 'Open audio file'}
  </button>
  <input
    ref={fileInputRef}
    type="file"
    accept="audio/*"
    style={{ display: 'none' }}
    onChange={handleFileLoad}
  />
</label>
```

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Click "Open audio file" → navigate to `sounds/07069030.wav` → Open.
- Chirp + noise data clears immediately; spectrogram fills with real audio STFT.
- Waveform panel shows decoded PCM shape.
- X-axis domain matches file duration; y-axis Nyquist matches file's sample rate.
- Live append checkbox is unchecked; no new data added.
- Log shows `Loaded: 07069030.wav · <sr> Hz · <dur>s`.
- Re-loading the same file or a different file works correctly.

---

## F11 [COMPLETED] Feature: HistogramLUTItem — interactive amplitude remapping for spectrogram

**Branch:** `feature/F11` (create before starting)

**Goal:** Add a pyqtgraph-style HistogramLUTItem as an independent, optional panel that can be attached to the spectrogram. It shows the dB amplitude histogram, provides draggable level_min/level_max handles for contrast windowing, and supports swappable LUT colormaps. `SpectrogramLayer` must still work standalone (no lutController).

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/plot/layers/HistogramLUTController.js` | **Create new** |
| `src/components/HistogramLUTPanel.jsx` | **Create new** |
| `src/plot/layers/SpectrogramLayer.js` | **Modify** — add caching + lutController integration |
| `examples/SpectrogramExample.jsx` | **Modify** — wire panel + colorTrigger |

---

### A. Create `src/plot/layers/HistogramLUTController.js`

Pure JS EventEmitter (import EventEmitter from `'events'` — already used elsewhere in the project). No React.

```javascript
import EventEmitter from 'events';

// LUT preset control points: [t, r, g, b] each, t in [0,1]
const LUT_PRESETS = {
  viridis:  [[0,68,1,84],[1/15,72,25,107],[2/15,64,47,124],[3/15,55,68,134],
             [4/15,45,88,140],[5/15,38,107,143],[6/15,33,126,145],[7/15,30,145,146],
             [8/15,32,163,144],[9/15,47,181,138],[10/15,73,198,128],[11/15,106,214,114],
             [12/15,145,228,97],[13/15,185,240,74],[14/15,223,249,47],[1,253,231,37]],
  grayscale:[[0,0,0,0],[1,255,255,255]],
  plasma:   [[0,13,8,135],[0.25,126,3,168],[0.5,204,71,120],[0.75,248,150,64],[1,240,249,33]],
  inferno:  [[0,0,0,4],[0.25,87,16,110],[0.5,188,55,84],[0.75,249,142,9],[1,252,255,164]],
  magma:    [[0,0,0,4],[0.25,79,18,123],[0.5,183,55,121],[0.75,251,136,97],[1,252,253,191]],
  hot:      [[0,0,0,0],[0.33,255,0,0],[0.67,255,255,0],[1,255,255,255]],
};

function buildLUT(stops) {
  // Interpolates control points into Uint8Array[256 * 4] (RGBA)
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // find adjacent stops
    let s0 = stops[0], s1 = stops[1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j+1][0]) { s0 = stops[j]; s1 = stops[j+1]; break; }
    }
    const f = s1[0] === s0[0] ? 0 : (t - s0[0]) / (s1[0] - s0[0]);
    lut[i*4]   = Math.round(s0[1] + f*(s1[1]-s0[1]));
    lut[i*4+1] = Math.round(s0[2] + f*(s1[2]-s0[2]));
    lut[i*4+2] = Math.round(s0[3] + f*(s1[3]-s0[3]));
    lut[i*4+3] = 255;
  }
  return lut;
}

export class HistogramLUTController extends EventEmitter {
  constructor(binCount = 256) {
    super();
    this._binCount    = binCount;
    this._power       = null;   // Float32Array of dB values (flat, frames×bins)
    this._isFirstData = true;
    this.state = {
      level_min:      -100,
      level_max:      0,
      lut:            buildLUT(LUT_PRESETS.viridis),
      lutName:        'viridis',
      histogramBins:  null,    // Float32Array[binCount] raw counts
      histogramEdges: null,    // Float32Array[binCount+1] bin boundaries
      globalMin:      -100,
      globalMax:      0,
    };
  }

  /** Called by SpectrogramLayer.updateState() after each STFT. Synchronous. */
  setSpectrogramData(power, globalMin, globalMax) {
    this._power = power;
    this.state.globalMin = globalMin;
    this.state.globalMax = globalMax;
    this._computeHistogram();
    this.emit('histogramReady', {
      bins:      this.state.histogramBins,
      edges:     this.state.histogramEdges,
      globalMin, globalMax,
    });
    if (this._isFirstData) {
      this._isFirstData = false;
      // autoLevel emits levelsChanged — that's OK on first data
      this.autoLevel();
    }
  }

  _computeHistogram() {
    const { globalMin, globalMax } = this.state;
    const power    = this._power;
    const n        = this._binCount;
    const range    = (globalMax - globalMin) || 1;
    const bins     = new Float32Array(n);
    const edges    = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) edges[i] = globalMin + (i / n) * range;
    for (let i = 0; i < power.length; i++) {
      const idx = Math.min(n - 1, Math.floor((power[i] - globalMin) / range * n));
      if (idx >= 0) bins[idx]++;
    }
    this.state.histogramBins  = bins;
    this.state.histogramEdges = edges;
  }

  setLevels(min, max) {
    this.state.level_min = min;
    this.state.level_max = max;
    this.emit('levelsChanged', min, max);
  }

  setLUT(presetName) {
    const stops = LUT_PRESETS[presetName];
    if (!stops) return;
    this.state.lut     = buildLUT(stops);
    this.state.lutName = presetName;
    this.emit('lutChanged', presetName);
  }

  autoLevel(loPct = 5, hiPct = 99.5) {
    const { histogramBins, histogramEdges } = this.state;
    if (!histogramBins) return;
    const total    = histogramBins.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const loTarget = total * loPct / 100;
    const hiTarget = total * hiPct / 100;
    let cumsum = 0, level_min = histogramEdges[0], level_max = histogramEdges[histogramEdges.length - 1];
    let minSet = false;
    for (let i = 0; i < histogramBins.length; i++) {
      cumsum += histogramBins[i];
      if (!minSet && cumsum >= loTarget) { level_min = histogramEdges[i]; minSet = true; }
      if (cumsum >= hiTarget)            { level_max = histogramEdges[i + 1]; break; }
    }
    this.setLevels(level_min, level_max);
  }

  getLUTArray() { return this.state.lut; }

  reset() { this._isFirstData = true; this._power = null; }

  static get presetNames() { return Object.keys(LUT_PRESETS); }
}
```

---

### B. Modify `src/plot/layers/SpectrogramLayer.js`

**New defaultProps to add:**
```javascript
lutController: { type: 'object', value: null },
colorTrigger:  { type: 'number', value: 0    },
```

**Add deck.gl lifecycle methods for STFT caching:**

```javascript
initializeState() {
  this.setState({ stftResult: null, image: null });
}

updateState({ props, oldProps }) {
  const dataChanged  = props.dataTrigger  !== oldProps.dataTrigger;
  const colorChanged = props.colorTrigger !== oldProps.colorTrigger;

  let stftResult = this.state.stftResult;

  // Recompute STFT only when data changes (or first render)
  if (dataChanged || !stftResult) {
    const { samples, windowSize, hopSize } = props;
    if (samples && samples.length >= windowSize) {
      stftResult = computeSTFT(samples, windowSize, hopSize || windowSize / 2);
      this.setState({ stftResult });
      if (props.lutController && stftResult) {
        // Synchronous: sets controller levels/histogram before buildImage below
        props.lutController.setSpectrogramData(
          stftResult.power, stftResult.globalMin, stftResult.globalMax
        );
      }
    }
  }

  // Rebuild image when data OR color changes
  if ((dataChanged || colorChanged) && stftResult) {
    const lc       = props.lutController;
    const levelMin = lc ? lc.state.level_min : stftResult.globalMin;
    const levelMax = lc ? lc.state.level_max : stftResult.globalMax;
    const lut      = lc ? lc.getLUTArray()   : null;  // null → viridis fallback

    const image = buildImage(
      stftResult.power, stftResult.numFrames, stftResult.numBins,
      levelMin, levelMax, lut
    );
    this.setState({ image });
  }
}
```

**Modify `buildImage` signature and body:**

Old: `function buildImage(power, numFrames, numBins, globalMin, globalMax)`
New: `function buildImage(power, numFrames, numBins, levelMin, levelMax, lut = null)`

Inside the pixel loop replace:
```javascript
// OLD:
const t = Math.max(0, Math.min(1, (db - globalMin) / range));
const c = viridisColor(t);
// ... d[idx] = c[0]; d[idx+1] = c[1]; d[idx+2] = c[2];

// NEW:
const range = (levelMax - levelMin) || 1;
const t = Math.max(0, Math.min(1, (db - levelMin) / range));
let r, g, b;
if (lut) {
  const li = Math.min(255, Math.floor(t * 255)) * 4;
  r = lut[li]; g = lut[li+1]; b = lut[li+2];
} else {
  [r, g, b] = viridisColor(t);  // standalone fallback
}
// ... d[idx] = r; d[idx+1] = g; d[idx+2] = b;
```

Note: move `const range = ...` inside the loop or before it (currently it's computed outside; keep consistent).

**Simplify `renderLayers()`** — reads from state only, no computation:
```javascript
renderLayers() {
  const { samples, sampleRate, windowSize, dataTrigger, colorTrigger } = this.props;
  const { image } = this.state;
  if (!image || !samples) return [];
  return [
    new BitmapLayer(this.getSubLayerProps({
      id:    'bitmap',
      image,
      bounds: [0, 0, samples.length / sampleRate, sampleRate / 2],
      updateTriggers: { image: [dataTrigger, colorTrigger] },
    })),
  ];
}
```

Keep `VIRIDIS` array and `viridisColor()` — used as standalone fallback.

---

### C. Create `src/components/HistogramLUTPanel.jsx`

React component. `import React, { useRef, useEffect, useState } from 'react';`

**Props:** `{ controller, width = 140 }` — height is CSS 100% (fills parent flex container).

**Internal React state (UI display only):**
```javascript
const [levels,    setLevels]    = useState({ min: -100, max: 0 });
const [preset,    setPreset]    = useState('viridis');
const [histState, setHistState] = useState(null); // { bins, edges, globalMin, globalMax }
```

**Wire controller events in `useEffect`:**
```javascript
useEffect(() => {
  const onLevels = (min, max) => setLevels({ min, max });
  const onLUT    = (name)     => setPreset(name);
  const onHist   = (data)     => setHistState(data);
  controller.on('levelsChanged',  onLevels);
  controller.on('lutChanged',     onLUT);
  controller.on('histogramReady', onHist);
  return () => {
    controller.off('levelsChanged',  onLevels);
    controller.off('lutChanged',     onLUT);
    controller.off('histogramReady', onHist);
  };
}, [controller]);
```

**Canvas redraw `useEffect`** (depends on `[levels, histState, preset, controller]`):
```javascript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const GRAD_W = 18;  // rightmost px for gradient strip
  const HIST_W = W - GRAD_W - 4;

  // 1. Draw histogram bars
  if (histState) {
    const { bins, globalMin, globalMax } = histState;
    const maxCount = Math.max(...bins, 1);
    const binH = H / bins.length;
    ctx.fillStyle = 'rgba(80,150,200,0.55)';
    for (let i = 0; i < bins.length; i++) {
      const barW = (bins[i] / maxCount) * HIST_W;
      // bin 0 = globalMin (bottom), bin N = globalMax (top) → invert Y
      const y = H - (i + 1) / bins.length * H;
      ctx.fillRect(0, y, barW, binH + 0.5);
    }
  }

  // 2. Draw LUT gradient strip (right column)
  const lut = controller.getLUTArray();
  for (let py = 0; py < H; py++) {
    const t  = 1 - py / H;  // t=1 at top, t=0 at bottom
    const li = Math.min(255, Math.floor(t * 255)) * 4;
    ctx.fillStyle = `rgb(${lut[li]},${lut[li+1]},${lut[li+2]})`;
    ctx.fillRect(W - GRAD_W, py, GRAD_W, 1);
  }

  // 3. Draw level lines
  if (histState) {
    const { globalMin, globalMax } = histState;
    const range = (globalMax - globalMin) || 1;
    const minY = H - ((levels.min - globalMin) / range) * H;
    const maxY = H - ((levels.max - globalMin) / range) * H;
    // level_min line (cyan)
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, minY); ctx.lineTo(W - GRAD_W, minY); ctx.stroke();
    // level_max line (yellow)
    ctx.strokeStyle = '#ff0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, maxY); ctx.lineTo(W - GRAD_W, maxY); ctx.stroke();
  }
}, [levels, histState, preset, controller]);
```

**Resize canvas to match DOM in `useEffect` (runs once after mount):**
```javascript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ro = new ResizeObserver(() => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    // trigger redraw by nudging state
    setLevels(l => ({ ...l }));
  });
  ro.observe(canvas);
  return () => ro.disconnect();
}, []);
```

**Drag interaction — attach to canvas element:**
```javascript
const dragRef = useRef(null);  // 'min' | 'max' | null

const onMouseDown = (e) => {
  if (!histState) return;
  const { globalMin, globalMax } = histState;
  const canvas = canvasRef.current;
  const H = canvas.offsetHeight;
  const range = (globalMax - globalMin) || 1;
  const minY = H - ((levels.min - globalMin) / range) * H;
  const maxY = H - ((levels.max - globalMin) / range) * H;
  const y = e.nativeEvent.offsetY;
  if (Math.abs(y - minY) < 8) dragRef.current = 'min';
  else if (Math.abs(y - maxY) < 8) dragRef.current = 'max';
};

const onMouseMove = (e) => {
  if (!dragRef.current || !histState) return;
  const { globalMin, globalMax } = histState;
  const H = canvasRef.current.offsetHeight;
  const amp = globalMin + (1 - e.nativeEvent.offsetY / H) * ((globalMax - globalMin) || 1);
  if (dragRef.current === 'min') {
    controller.setLevels(Math.min(amp, levels.max - 0.5), levels.max);
  } else {
    controller.setLevels(levels.min, Math.max(amp, levels.min + 0.5));
  }
};

const onMouseUp = () => { dragRef.current = null; };
```

**JSX return:**
```jsx
return (
  <div style={{
    width, display: 'flex', flexDirection: 'column',
    background: '#0a0a0a', borderLeft: '1px solid #333',
    fontFamily: 'monospace', fontSize: 11, color: '#888', flexShrink: 0,
  }}>
    <canvas
      ref={canvasRef}
      style={{ flex: 1, width: '100%', cursor: 'ns-resize' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
    <div style={{ padding: '4px 6px', borderTop: '1px solid #222' }}>
      <select
        value={preset}
        onChange={e => controller.setLUT(e.target.value)}
        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444',
                 color: '#aaa', padding: '2px 4px', fontSize: 11 }}
      >
        {HistogramLUTController.presetNames.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button
        onClick={() => controller.autoLevel()}
        style={{ marginTop: 4, width: '100%', background: '#1a1a1a',
                 border: '1px solid #444', color: '#adf', padding: '3px',
                 fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}
      >
        Auto Level
      </button>
      <div style={{ marginTop: 4, color: '#555', fontSize: 10 }}>
        min: {levels.min.toFixed(1)}<br/>
        max: {levels.max.toFixed(1)}
      </div>
    </div>
  </div>
);
```

Import `HistogramLUTController` at the top of this file for `presetNames` access.

---

### D. Modify `examples/SpectrogramExample.jsx`

**Imports to add (top of file):**
```javascript
import { HistogramLUTController } from '../src/plot/layers/HistogramLUTController.js';
import HistogramLUTPanel from '../src/components/HistogramLUTPanel.jsx';
```

**New refs/state (alongside existing `const [log, ...`  declarations):**
```javascript
const lutControllerRef  = useRef(null);
const colorTriggerRef   = useRef(0);
const [colorTrigger, setColorTrigger] = useState(0);
// Initialize controller once
if (!lutControllerRef.current) {
  lutControllerRef.current = new HistogramLUTController();
}
```

**Wire controller events — add inside the existing big `useEffect` (before the final `scheduleRender()` call):**
```javascript
const lc = lutControllerRef.current;
lc.on('levelsChanged', () => setColorTrigger(prev => prev + 1));
lc.on('lutChanged',    () => setColorTrigger(prev => prev + 1));
```

**Sync colorTrigger ref** — add a separate tiny `useEffect`:
```javascript
useEffect(() => {
  colorTriggerRef.current = colorTrigger;
  dirtyRef.current = true;
}, [colorTrigger]);
```

**Update `renderFrame`** — pass new props:
```javascript
new SpectrogramLayer({
  id:           'spectrogram',
  samples:      samplesRef.current,
  sampleRate:   loadedSampleRateRef.current,
  windowSize:   windowSizeRef.current,
  hopSize:      windowSizeRef.current / 2,
  dataTrigger:  dataTriggerRef.current,
  lutController: lutControllerRef.current,   // ← add
  colorTrigger:  colorTriggerRef.current,    // ← add (read from ref, not state)
})
```

**Reset controller on file load** — add inside `handleFileLoad` after clearing sample data:
```javascript
lutControllerRef.current.reset();
```

**Layout JSX change** — wrap spectrogram panel in a row flex div with LUT panel beside it:

Old:
```jsx
<div style={plotWrapStyle}>
  {/* Spectrogram panel — 65% */}
  <div style={{ ...panelStyle, flex: 3 }}>
    <canvas ref={webglRef} style={canvasStyle} />
    <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
  </div>

  <div style={dividerStyle} />

  {/* Waveform panel — 35% */}
  <div style={{ ...panelStyle, flex: 1.5 }}>
    ...
  </div>
</div>
```

New:
```jsx
<div style={plotWrapStyle}>
  {/* Spectrogram row: canvas + LUT panel side-by-side */}
  <div style={{ flex: 3, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
    <div style={{ ...panelStyle, flex: 1 }}>
      <canvas ref={webglRef} style={canvasStyle} />
      <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
    </div>
    <HistogramLUTPanel controller={lutControllerRef.current} width={140} />
  </div>

  <div style={dividerStyle} />

  {/* Waveform panel — unchanged */}
  <div style={{ ...panelStyle, flex: 1.5 }}>
    <canvas ref={waveWebglRef} style={canvasStyle} />
    <canvas ref={waveAxisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
  </div>
</div>
```

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Open `dist/spectrogram.html`
3. Chirp loads → spectrogram renders → LUT panel visible at right with histogram bars
4. Drag level handles → spectrogram recolors immediately (no STFT lag)
5. Change LUT preset dropdown → spectrogram recolors
6. Click Auto Level → handles snap to 5%–99.5% percentile positions
7. Open audio file → histogram refreshes, controller resets, spectrogram redraws
8. Temporarily remove `lutController` + `colorTrigger` props from `renderFrame` → spectrogram still renders with default Viridis (standalone mode)

### Edge cases to watch

- **First render**: `updateState` gets `oldProps.dataTrigger === 0` same as `props.dataTrigger === 0` → `dataChanged = false`. The `!stftResult` guard handles first call.
- **`colorTrigger` in RAF closure**: `renderFrame` reads from `colorTriggerRef.current` (not the closed-over React state value) to avoid stale closure values.
- **`setSpectrogramData` + autoLevel double-build**: On first data, `autoLevel` emits `levelsChanged` → React increments `colorTrigger` → second `updateState` → second `buildImage` with same values. Acceptable; can suppress by checking if levels actually changed.
- **Canvas width shrinks 140px**: Deck reads `wc.offsetWidth` at mount so it adapts automatically.

---

## F12 [COMPLETED] Feature: Audio Playback + Synchronized Playhead Lines

**Branch:** `feature/F12` (create before starting)
<!-- Started: 2026-02-22 · Completed: 2026-02-22 -->
<!-- Created src/audio/PlaybackController.js; modified SpectrogramExample.jsx: added drawPlayhead helpers, playbackRef, playState, stateChanged wiring, loadBuffer on file load, playhead RAF loop, Ctrl+click seek, Play/Pause/Stop header controls. Build: 0 errors. -->

**Goal:** Enable playback of loaded audio (or the live-append chirp) via Web Audio API with a dashed vertical playhead line that moves in real-time at 60 fps across both the spectrogram and the waveform panel. Ctrl+click on either panel seeks to that time. Play/Pause/Stop controls appear in the header.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/audio/PlaybackController.js` | **Create new** |
| `examples/SpectrogramExample.jsx` | **Modify** — add controller, RAF changes, controls, Ctrl+seek |

---

### A. Create `src/audio/PlaybackController.js`

Pure JS EventEmitter. Manages a single `AudioBufferSourceNode` lifecycle (play/pause/stop/seek). `AudioBufferSourceNode` is one-shot and cannot be paused, so pause is implemented by recording position, stopping the node, and creating a new node on resume.

```javascript
import EventEmitter from 'events';

export class PlaybackController extends EventEmitter {
  constructor() {
    super();
    this._audioContext     = null;
    this._audioBuffer      = null;
    this._source           = null;
    this._isPlaying        = false;
    this._pauseOffset      = 0;   // seconds into buffer where we paused/stopped
    this._startContextTime = 0;   // audioContext.currentTime at last play() call
    this._startOffset      = 0;   // buffer offset at last play() call
  }

  get isPlaying() { return this._isPlaying; }
  get duration()  { return this._audioBuffer?.duration ?? 0; }

  /** Returns the current playback position in seconds. */
  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  /**
   * Decode samples into an AudioBuffer. Called after file load.
   * Creates or reuses the AudioContext; resumes it (autoplay policy).
   */
  async loadBuffer(samples, sampleRate) {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({ sampleRate });
    }
    await this._audioContext.resume();
    const buf = this._audioContext.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    this._audioBuffer = buf;
    this.emit('stateChanged', { state: 'loaded', duration: buf.duration });
  }

  /** Start or resume playback. Optional offset (seconds) overrides saved position. */
  async play(offset = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume();   // browser autoplay guard
    this._stopSource();
    const startAt = (offset !== null) ? Math.max(0, offset) : this._pauseOffset;
    if (startAt >= this.duration) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false;  // distinguish natural end from manual stop
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying   = false;
        this._pauseOffset = 0;
        this.emit('stateChanged', { state: 'stopped' });
      }
    };
    source.start(0, startAt);
    this._source           = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset      = startAt;
    this._isPlaying        = true;
    this.emit('stateChanged', { state: 'playing' });
  }

  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this.emit('stateChanged', { state: 'paused' });
  }

  stop() {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    this.emit('stateChanged', { state: 'stopped' });
  }

  /** Jump to a time; resumes playback if it was playing. */
  seek(time) {
    const clipped    = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) { this._stopSource(); this._isPlaying = false; }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);
    else this.emit('stateChanged', { state: 'paused' });
  }

  destroy() {
    this._stopSource();
    this._audioContext?.close();
    this._audioContext = null;
  }

  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try { this._source.stop(); } catch (_) {}
      this._source.disconnect();
      this._source = null;
    }
  }
}
```

---

### B. Playhead drawing helpers (add near top of SpectrogramExample.jsx)

These two free functions are used in the RAF loop immediately after `axisRend.render()` so the playhead is drawn on top of axis grid lines and labels.

```javascript
/**
 * Draw a vertical playhead line on a 2D axis canvas overlay.
 * No-ops silently if time is outside the current x-domain.
 */
function drawPlayhead(canvas, time, xAxis, viewport) {
  const [xMin, xMax] = xAxis.getDomain();
  if (time < xMin || time > xMax) return;
  const { plotArea: pa } = viewport;
  const px  = pa.x + (time - xMin) / Math.max(xMax - xMin, 1e-10) * pa.width;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 220, 40, 0.85)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(px, pa.y);
  ctx.lineTo(px, pa.y + pa.height);
  ctx.stroke();
  // Time label at top of line, flips side when near right edge
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 220, 40, 0.9)';
  ctx.font      = '10px monospace';
  const rightHalf = px > pa.x + pa.width * 0.6;
  ctx.textAlign = rightHalf ? 'right' : 'left';
  ctx.fillText(formatPlayTime(time), px + (rightHalf ? -4 : 4), pa.y + 12);
  ctx.restore();
}

/** Format seconds as m:ss.d  e.g. 1:23.4 */
function formatPlayTime(secs) {
  const m  = Math.floor(secs / 60);
  const s  = Math.floor(secs % 60);
  const ds = Math.floor((secs % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}
```

---

### C. Modifications to `examples/SpectrogramExample.jsx`

**New import:**
```javascript
import { PlaybackController } from '../src/audio/PlaybackController.js';
```

**New refs / state (alongside existing declarations):**
```javascript
const playbackRef = useRef(null);
if (!playbackRef.current) {
  playbackRef.current = new PlaybackController();
}
const [playState, setPlayState] = useState('stopped'); // 'playing'|'paused'|'stopped'
```

**Wire `stateChanged` event** — add inside the existing mount `useEffect`, after the LUT controller wiring, before `scheduleRender()`:
```javascript
const pb = playbackRef.current;
pb.on('stateChanged', ({ state }) => setPlayState(state));
```

**Add to `useEffect` cleanup (return block):**
```javascript
playbackRef.current?.destroy();
```

**Load buffer on file load** — add at the end of the `try` block in `handleFileLoad`, after the existing `addLog(...)` call:
```javascript
// Load into playback controller (non-blocking — await is fine here since we're already async)
await playbackRef.current.loadBuffer(samplesRef.current, loadedSampleRateRef.current);
```

**Modify `scheduleRender`** — this is the most important change: force dirty every frame during playback so the playhead updates smoothly, and call `drawPlayhead` after each panel render:
```javascript
const scheduleRender = () => {
  rafRef.current = requestAnimationFrame(() => {
    const pb = playbackRef.current;
    // Force redraw every frame during playback so the playhead moves in real time
    if (pb?.isPlaying) {
      dirtyRef.current     = true;
      waveDirtyRef.current = true;
    }

    if (dirtyRef.current) {
      renderFrame();
      dirtyRef.current = false;
      // Draw playhead on top of axis overlay (after AxisRenderer clears & redraws)
      if (pb && axisRef.current && xAxisRef.current && viewportRef.current) {
        drawPlayhead(axisRef.current, pb.currentTime, xAxisRef.current, viewportRef.current);
      }
    }
    if (waveDirtyRef.current) {
      waveRenderFrame();
      waveDirtyRef.current = false;
      if (pb && waveAxisRef.current && waveXAxisRef.current && waveViewportRef.current) {
        drawPlayhead(waveAxisRef.current, pb.currentTime, waveXAxisRef.current, waveViewportRef.current);
      }
    }

    scheduleRender();
  });
};
```

**Add Ctrl+click seek** — extend `onMouseDown` (spectrogram):
```javascript
const onMouseDown = (e) => {
  if (e.button !== 0) return;
  const viewport = viewportRef.current;
  if (!viewport) return;
  const pos = viewport.getCanvasPosition(e, webglRef.current);
  if (!viewport.isInPlotArea(pos.x, pos.y)) return;
  // Ctrl+click → seek
  if (e.ctrlKey && playbackRef.current?.duration > 0) {
    playbackRef.current.seek(viewport.screenXToData(pos.x));
    return;
  }
  panRef.current = { ... };  // existing logic unchanged
};
```
Add the same `Ctrl+click` block to `onWaveMouseDown` (using `waveViewportRef.current` and `waveWebglRef.current`).

**Playback controls in header JSX** (add after the "Open audio file" button):
```jsx
{/* Playback controls */}
<button
  onClick={() => {
    const pb = playbackRef.current;
    if (!pb?.duration) return;
    if (playState === 'playing') pb.pause();
    else pb.play();
  }}
  disabled={!playbackRef.current?.duration}
  style={{
    background: '#222', border: '1px solid #555', borderRadius: 3,
    color: playbackRef.current?.duration ? '#adf' : '#555',
    padding: '2px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
  }}
>
  {playState === 'playing' ? '⏸' : '▶'}
</button>
<button
  onClick={() => playbackRef.current?.stop()}
  disabled={playState === 'stopped'}
  style={{
    background: '#222', border: '1px solid #555', borderRadius: 3,
    color: playState !== 'stopped' ? '#faa' : '#555',
    padding: '2px 8px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
  }}
>
  ⏹
</button>
```

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Load audio file → Play/Pause buttons activate; log shows playback loaded
3. Press **▶** → yellow dashed vertical line appears on both spectrogram and waveform at t=0 and moves rightward smoothly at audio speed
4. Line stays at the correct relative position when zoomed/panned (it uses the live x-domain)
5. **⏸** → playhead freezes; audio stops; resume resumes from same position
6. **⏹** → playhead jumps to t=0
7. Ctrl+click on spectrogram or waveform → playhead jumps to clicked time; if playing, continues from new position
8. Playhead line disappears from view when time is outside the current x-domain (zoomed in elsewhere)
9. Audio ends naturally → `playState` resets to `'stopped'`
10. Load a second file → old playback stops; new buffer loaded

### Edge cases

- **Autoplay policy**: `await audioContext.resume()` is called inside `play()` before `source.start()`; user interaction (file open, button click) already grants permission.
- **Chirp-only (no file loaded)**: Play buttons are disabled (`duration === 0`). A future enhancement could call `loadBuffer` after `appendSamples` on mount.
- **Live append during playback**: Live-appended samples extend `samplesRef` but the `AudioBuffer` already loaded in `PlaybackController` is a snapshot. Playback plays only the originally loaded portion; the spectrogram continues to extend. This is consistent and intentional.
- **Very long files**: `AudioContext.createBuffer(1, N, sr)` allocates `4N` bytes. 30 min at 44100 Hz = ~318 MB float32. Browser may throw `EncodingError`; catch and log.
- **`source.stop()` on already-stopped node**: Guarded by the `try/catch` in `_stopSource()`.

---

## F13 [COMPLETED] Feature: Frequency Filters — offline DSP + frequency response preview

**Branch:** `feature/F12` (implemented on feature/F12 branch)
<!-- Started: 2026-02-22 · Completed: 2026-02-22 -->
<!-- Created src/audio/FilterController.js and src/components/FilterPanel.jsx; modified SpectrogramExample.jsx: added imports, filterControllerRef, originalSamplesRef, applying/filterSampleRate state, PCM snapshot on file load, handleApplyFilter, handleClearFilter, "Clear Filter" header button, right sidebar layout with HistogramLUTPanel + FilterPanel stacked. Build: 0 errors. -->

**Branch:** `feature/F13` (create before starting; may be implemented after F12)

**Goal:** Apply a Web Audio biquad filter (low-pass, high-pass, band-pass, notch, allpass) to the loaded PCM samples offline via `OfflineAudioContext`, then force a spectrogram STFT recompute so the filtered frequency content is visible. A `FilterPanel` component shows a live frequency response curve and the cutoff/Q controls. Original samples are preserved in memory so "Clear Filter" restores them without requiring a file reload.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/audio/FilterController.js` | **Create new** |
| `src/components/FilterPanel.jsx` | **Create new** |
| `examples/SpectrogramExample.jsx` | **Modify** — add controller, panel, apply/clear, layout |

---

### A. Create `src/audio/FilterController.js`

```javascript
import EventEmitter from 'events';

export class FilterController extends EventEmitter {
  constructor() {
    super();
    this.state = {
      type:      'none',   // 'none'|'lowpass'|'highpass'|'bandpass'|'notch'|'allpass'
      frequency: 1000,     // Hz — cutoff / centre frequency
      Q:         1.0,      // resonance / bandwidth
    };
  }

  setType(type)      { this.state.type = type;       this.emit('changed', { ...this.state }); }
  setFrequency(freq) { this.state.frequency = freq;  this.emit('changed', { ...this.state }); }
  setQ(q)            { this.state.Q = q;             this.emit('changed', { ...this.state }); }

  /**
   * Process samples through the biquad filter using OfflineAudioContext.
   * Returns a new Float32Array — original is not mutated.
   * If type === 'none', returns the same reference unchanged.
   */
  async applyToSamples(samples, sampleRate) {
    if (this.state.type === 'none') return samples;
    const offlineCtx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf        = offlineCtx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    const filter = offlineCtx.createBiquadFilter();
    filter.type            = this.state.type;
    filter.frequency.value = Math.min(this.state.frequency, sampleRate / 2 - 1);
    filter.Q.value         = this.state.Q;
    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();  // copy — ChannelData view becomes invalid after GC
  }

  /**
   * Compute frequency response for the current filter settings.
   * Returns { freqs: Float32Array, db: Float32Array } for nPoints log-spaced
   * frequencies from 20 Hz to nyquist.  Returns null if type === 'none'.
   *
   * Note: creates and immediately closes a temporary AudioContext; call only
   * when the user interacts with controls (not on every RAF frame).
   */
  getFrequencyResponse(nPoints = 256, sampleRate = 44100) {
    if (this.state.type === 'none') return null;
    const nyquist = sampleRate / 2;
    const freqs   = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      freqs[i] = 20 * Math.pow(nyquist / 20, i / (nPoints - 1));
    }
    const magRes   = new Float32Array(nPoints);
    const phaseRes = new Float32Array(nPoints);
    const tmpCtx   = new AudioContext({ sampleRate });
    const tmpNode  = tmpCtx.createBiquadFilter();
    tmpNode.type            = this.state.type;
    tmpNode.frequency.value = Math.min(this.state.frequency, nyquist - 1);
    tmpNode.Q.value         = this.state.Q;
    tmpNode.getFrequencyResponse(freqs, magRes, phaseRes);
    tmpCtx.close();  // release resources; fire-and-forget async close is fine
    const db = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      db[i] = 20 * Math.log10(Math.max(magRes[i], 1e-10));
    }
    return { freqs, db };
  }

  static get filterTypes() {
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];
  }
}
```

---

### B. Create `src/components/FilterPanel.jsx`

Props: `{ controller, sampleRate, onApply, applying }`.

- `controller` — `FilterController` instance
- `sampleRate` — current audio sample rate (needed for Nyquist in sliders and response curve)
- `onApply()` — called when "Apply" button is clicked (parent handles the async work)
- `applying` — boolean; while true the button shows "Applying…" and is disabled

```jsx
import React, { useRef, useEffect, useState } from 'react';
import { FilterController } from '../audio/FilterController.js';

export default function FilterPanel({ controller, sampleRate = 44100, onApply, applying = false }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ ...controller.state });

  // Wire controller events
  useEffect(() => {
    const onChange = s => setState({ ...s });
    controller.on('changed', onChange);
    return () => controller.off('changed', onChange);
  }, [controller]);

  // Draw frequency response every time filter state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // 0 dB reference line (dB range: −60 to +6; 0 dB sits at 90.9% from bottom)
    const DB_MIN = -60, DB_MAX = 6;
    const dbToY = db => H - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * H;
    const zeroY = dbToY(0);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();

    if (state.type === 'none') {
      // Flat 0 dB line
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();
      return;
    }

    const resp = controller.getFrequencyResponse(W, sampleRate);
    if (!resp) return;

    // Response curve
    ctx.strokeStyle = '#4af'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      const y = Math.max(0, Math.min(H, dbToY(resp.db[i])));
      if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Cutoff frequency marker (orange vertical dashed line)
    const nyquist = sampleRate / 2;
    const fx = Math.log(state.frequency / 20) / Math.log(nyquist / 20) * W;
    ctx.strokeStyle = '#f80'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
    ctx.setLineDash([]);
  }, [state, sampleRate, controller]);

  const nyquist = sampleRate / 2;
  const sliderStyle = { width: '100%', marginTop: 2 };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderTop: '1px solid #2a2a2a',
      fontFamily: 'monospace', fontSize: 11, color: '#888',
      padding: '6px 8px', boxSizing: 'border-box', gap: 5, flexShrink: 0,
    }}>
      <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>FILTER</div>

      <select
        value={state.type}
        onChange={e => controller.setType(e.target.value)}
        style={{ background: '#1a1a1a', border: '1px solid #444', color: '#aaa', padding: '2px', fontSize: 11 }}
      >
        {FilterController.filterTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {state.type !== 'none' && (
        <>
          <label>
            <span style={{ color: '#555' }}>Cutoff </span>
            <span style={{ color: '#aaa' }}>
              {state.frequency < 1000
                ? `${state.frequency.toFixed(0)} Hz`
                : `${(state.frequency / 1000).toFixed(2)} kHz`}
            </span>
            {/* Log-scale slider: range [0,1] mapped to [20 Hz, Nyquist] via exponential */}
            <input type="range" min="0" max="1" step="0.001"
              value={Math.log(state.frequency / 20) / Math.log(nyquist / 20)}
              onChange={e => {
                const t = parseFloat(e.target.value);
                controller.setFrequency(Math.round(20 * Math.pow(nyquist / 20, t)));
              }}
              style={sliderStyle}
            />
          </label>
          <label>
            <span style={{ color: '#555' }}>Q </span>
            <span style={{ color: '#aaa' }}>{state.Q.toFixed(2)}</span>
            <input type="range" min="0.1" max="30" step="0.1"
              value={state.Q}
              onChange={e => controller.setQ(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </label>
        </>
      )}

      {/* Frequency response canvas: x = 20 Hz→Nyquist (log), y = −60→+6 dB */}
      <canvas ref={canvasRef} width={118} height={55}
        style={{ width: '100%', height: 55, borderRadius: 2, border: '1px solid #1a1a1a' }}
      />

      <button
        onClick={onApply}
        disabled={applying || state.type === 'none'}
        style={{
          background: '#1a1a1a', border: '1px solid #444',
          color: (applying || state.type === 'none') ? '#444' : '#fda',
          padding: '3px', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {applying ? 'Applying…' : 'Apply to spectrogram'}
      </button>
    </div>
  );
}
```

---

### C. Modifications to `examples/SpectrogramExample.jsx`

**New imports:**
```javascript
import { FilterController } from '../src/audio/FilterController.js';
import FilterPanel           from '../src/components/FilterPanel.jsx';
```

**New refs / state:**
```javascript
const filterControllerRef  = useRef(null);
const originalSamplesRef   = useRef(null);  // snapshot of pre-filter PCM for "Clear Filter"
if (!filterControllerRef.current) {
  filterControllerRef.current = new FilterController();
}
const [applying,         setApplying]         = useState(false);
const [filterSampleRate, setFilterSampleRate] = useState(SAMPLE_RATE);
```

**Store original samples on file load** — add inside `handleFileLoad` try block, immediately after loading PCM into `samplesRef.current`:
```javascript
originalSamplesRef.current = samplesRef.current.slice();  // snapshot of raw PCM
setFilterSampleRate(sr);
```

**Apply filter handler:**
```javascript
const handleApplyFilter = async () => {
  if (!samplesRef.current.length) return;
  setApplying(true);
  try {
    const fc       = filterControllerRef.current;
    const filtered = await fc.applyToSamples(samplesRef.current, loadedSampleRateRef.current);
    samplesRef.current = filtered;
    dataTriggerRef.current += 1;
    dirtyRef.current = true;
    // If playback is loaded, reload with filtered audio
    if (playbackRef.current?.duration > 0) {
      await playbackRef.current.loadBuffer(filtered, loadedSampleRateRef.current);
    }
    addLog(`Filter: ${fc.state.type}  cutoff=${fc.state.frequency.toFixed(0)} Hz  Q=${fc.state.Q.toFixed(2)}`);
  } catch (err) {
    addLog(`Filter error: ${err.message}`);
  }
  setApplying(false);
};
```

Note: `playbackRef` is part of F12. If F13 is implemented before F12, omit the `playbackRef` block.

**Clear filter handler** (restores original pre-filter samples):
```javascript
const handleClearFilter = async () => {
  if (!originalSamplesRef.current) return;
  samplesRef.current = originalSamplesRef.current.slice();
  dataTriggerRef.current += 1;
  dirtyRef.current = true;
  if (playbackRef.current?.duration > 0) {
    await playbackRef.current.loadBuffer(samplesRef.current, loadedSampleRateRef.current);
  }
  addLog('Filter cleared — original audio restored');
};
```

**"Clear Filter" button in header** (add beside "Open audio file"):
```jsx
<button
  onClick={handleClearFilter}
  disabled={!originalSamplesRef.current}
  style={{
    background: '#222', border: '1px solid #555', borderRadius: 3,
    color: originalSamplesRef.current ? '#fa8' : '#555',
    padding: '2px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
  }}
>
  Clear Filter
</button>
```

**Layout** — stack `FilterPanel` below `HistogramLUTPanel` inside the right sidebar div:
```jsx
{/* Right sidebar: LUT panel + Filter panel, vertically stacked */}
<div style={{ width: 140, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #333', flexShrink: 0 }}>
  <div style={{ flex: 1, overflow: 'hidden' }}>
    <HistogramLUTPanel controller={lutControllerRef.current} />
  </div>
  <FilterPanel
    controller={filterControllerRef.current}
    sampleRate={filterSampleRate}
    onApply={handleApplyFilter}
    applying={applying}
  />
</div>
```

Remove the `width={140}` prop from `HistogramLUTPanel` (width is now supplied by the parent `div`). Ensure `HistogramLUTPanel` fills its parent by keeping `width: '100%'` in its outer div — it already does via the existing `boxSizing: 'border-box'` style.

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Open an audio file → `FilterPanel` appears in the right sidebar below `HistogramLUTPanel`; response canvas shows a flat line (type=none)
3. Select "lowpass", drag cutoff slider → response curve updates live; orange marker moves; no spectrogram change yet
4. Click "Apply to spectrogram" → button shows "Applying…"; STFT recomputes; high frequencies attenuated (dark in spectrogram above cutoff)
5. Raise cutoff → reapply → wider pass band visible
6. Select "highpass" → apply → low frequencies attenuated (dark below cutoff)
7. Select "bandpass", reduce Q → apply → narrow bright horizontal band in spectrogram
8. "Clear Filter" → original unfiltered spectrogram restored; log confirms
9. With F12 implemented: apply low-pass then press Play → audio is audibly dull (highs removed)
10. "Clear Filter" → Play → full bandwidth audio restored

### Edge cases

- **`OfflineAudioContext` limits**: Very long files (> ~30 min mono at 44100 Hz = ~310 MB) may fail with `NotSupportedError`. Catch and log.
- **Filter frequency clamped to Nyquist**: `Math.min(frequency, sampleRate/2 - 1)` prevents invalid `BiquadFilterNode` state.
- **Compound filtering**: Applying a second filter without clearing first compounds with the first (applies to already-filtered samples). This is intentional — the log message shows the current filter params. Users "Clear Filter" to reset to original, then apply a fresh filter.
- **`getFrequencyResponse` cost**: Creates and closes a temporary `AudioContext` on every control change. If latency is noticeable, debounce `onChange` by 100 ms.
- **Live append mode**: "Apply to spectrogram" is not meaningful when live-append is active (data keeps changing). Consider disabling the "Apply" button when `liveAppend` is true, or at least logging a warning.
- **FilterPanel height in sidebar**: `HistogramLUTPanel` uses `flex: 1` to fill the sidebar; `FilterPanel` has `flexShrink: 0` and a fixed content height. Ensure the sidebar div has `overflow: hidden` so the LUT panel doesn't overflow when the sidebar is short.

---

## ✅ PREVIOUSLY COMPLETED (B7–B8, F7–F9)

---

## B7 [COMPLETED] Fix: Y-axis pan direction inverted in follow and drag modes (F4/F5)

**Files:** `src/plot/PlotController.js`, `prompt.md`

**Root cause:**

The d3 y scale is set with an inverted range `[pa.y + pa.height, pa.y]` (e.g. `[620, 20]`) so that data-y=0 maps to the screen bottom. This makes `pxSpan` for y **negative** inside `panByPixels`, causing a double-negation that reverses the effective direction:

```
dataDelta = -(pixelDelta / pxSpan) * domainSpan
x: pxSpan > 0  →  panByPixels(+n) → domain decreases (viewport shifts left/up)
y: pxSpan < 0  →  panByPixels(+n) → domain increases (inverted vs. x!)
```

The F4/F5 code was written assuming a non-inverted y range, so both pan modes move the viewport in the wrong direction for y.

**Fix 1 — Follow velocity tick in `_scheduleRender` (F5):**

```js
// BEFORE (wrong — data moves WITH drag in follow mode):
this._yAxis.panByPixels( dy * FOLLOW_PAN_SPEED);

// AFTER (correct — data scrolls OPPOSITE to drag, matching x-axis scroll direction):
this._yAxis.panByPixels(-dy * FOLLOW_PAN_SPEED);
```

**Fix 2 — Drag mode in `_onMouseMove` (F4):**

```js
// BEFORE (wrong — data moves opposite to cursor):
this._yAxis.panByPixels(-dy);   // inverted: drag down  → data moves down

// AFTER (correct — data follows cursor, matching x-axis drag behavior):
this._yAxis.panByPixels( dy);   // drag down → data moves down
```

**Why the signs feel counterintuitive:** for x, drag and drag-pan signs are opposite (`-dx` for follow, `+dx` for drag). For y they end up both positive-`dy` (follow → `-dy`, drag → `+dy`) because the inverted range already flips the direction once — any additional negation cancels it.

**`prompt.md` note to add** (in or near the Zoom & Pan section):

```
### Y-axis Coordinate Convention

deck.gl `OrthographicView` is explicitly `flipY: false` in MasterPlot — y is NOT
flipped at the GPU/projection level.

However, the d3 y scale uses an **inverted range** `[plotBottom_px, plotTop_px]`
so that data-y=0 appears at the visual bottom and data-y=max at the top (standard
scientific convention). This means `pxSpan` inside `panByPixels` is **negative** for y.

Consequence for interaction code:
- `panByPixels(+n)` on y → domain **increases** (you see higher values)
- `panByPixels(-n)` on y → domain **decreases** (you see lower values)
  (exactly opposite to x, where `panByPixels(+n)` → domain decreases)

Rule for new pan/interaction code: negate `dy` relative to what you would use
for `dx` to get the same directional behavior on both axes.
```

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Follow mode: drag UP → plot scrolls up (see higher y values; data points move downward like standard scroll)
- Drag mode: drag DOWN → data point under cursor moves down with your hand (Google Maps style)

---

## F6 [COMPLETED] Feature: Right-click context-menu suppression + drag zoom

**Files:** `src/plot/PlotController.js`

**Behaviour:**
- Suppress the browser context menu on the WebGL canvas via a `contextmenu` event listener calling `e.preventDefault()`.
- Right-click + drag **vertically** zooms in/out centred on the right-click starting position:
  - Drag **UP** → zoom in (axis domain shrinks, data appears larger)
  - Drag **DOWN** → zoom out (axis domain expands, more data visible)
- Uses restore-and-reapply pattern (store initial domains on mousedown, restore + reapply each mousemove frame) to prevent float drift.
- ROI controller guards `if (e.button !== 0) return` — right-click is completely transparent to ROI logic.

**New state (constructor, after pan state):**
```js
this._isRightDragging = false;
this._rightDragStart  = null;   // { x, y, xDomain, yDomain }
this._onContextMenu   = e => e.preventDefault();
```

**`init()`** — add alongside existing canvas listeners:
```js
webglCanvas.addEventListener('contextmenu', this._onContextMenu);
```

**`destroy()`** — add:
```js
this._webglCanvas?.removeEventListener('contextmenu', this._onContextMenu);
```

**`_onMouseDown`** — route button 2 before the existing `if (e.button !== 0) return` check:
```js
if (e.button === 2) { this._handleRightDown(e); return; }
```

**`_handleRightDown(e)` (new private method):**
```js
_handleRightDown(e) {
  const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
  if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
  this._isRightDragging = true;
  this._rightDragStart  = {
    x: pos.x, y: pos.y,
    xDomain: this._xAxis.getDomain(),
    yDomain: this._yAxis.getDomain(),
  };
}
```

**`_handleRightMove(e)` (new private method):**
```js
_handleRightMove(e) {
  if (!this._rightDragStart) return;
  const pos     = this._viewport.getCanvasPosition(e, this._webglCanvas);
  const totalDy = pos.y - this._rightDragStart.y;
  // drag up (totalDy<0) → factor<1 → zoom in  ✓
  const factor = Math.pow(0.992, -totalDy);   // tune: sensitivity
  // Restore initial domains to avoid float drift
  this._xAxis.setDomain(this._rightDragStart.xDomain);
  this._yAxis.setDomain(this._rightDragStart.yDomain);
  this._updateScales();
  // Focal point in data space at the right-click origin
  const focalDataX = this._viewport.screenXToData(this._rightDragStart.x);
  const focalDataY = this._viewport.screenYToData(this._rightDragStart.y);
  this._xAxis.zoomAround(factor, focalDataX);
  this._yAxis.zoomAround(factor, focalDataY);
  this._updateScales();
  this._dirty = true;
  this.emit('zoomChanged', { factor, focalDataX, focalDataY });
}
```

**`_onMouseMove`** — call `_handleRightMove` at the top (before left-click pan guard):
```js
if (this._isRightDragging) { this._handleRightMove(e); }
```

**`_onMouseUp`** — add button-2 branch alongside existing button-0 branch:
```js
if (e.button === 2 && this._isRightDragging) {
  this._isRightDragging = false;
  this._rightDragStart  = null;
}
```

---

## F5 [COMPLETED] Feature: Follow pan — continuous velocity mode

**Files:** `src/plot/PlotController.js`

**Behaviour:** In "follow pan" mode (`_panMode === 'follow'`), rather than snapping the domain on each mousemove event, the RAF loop continuously applies a pan proportional to the displacement between the current mouse position and the mousedown position.

- Mouse at mousedown position → no movement (dead zone ≤ 5 px)
- Mouse displaced N px → pan at `N × FOLLOW_PAN_SPEED` of domain-width per frame
- `FOLLOW_PAN_SPEED = 0.02` (tune as needed — corresponds to ~1.2 domain-widths/sec per 100 px at 60 fps)
- `_onMouseMove` in follow mode only updates `_panCurrentPos` — it does NOT modify domains directly

**New state (constructor, after existing pan state):**
```js
this._panCurrentPos = null;   // { x, y } — updated each mousemove in follow mode
```

**`_onMouseDown`** — after setting `_isPanning = true`, also set:
```js
this._panCurrentPos = { x: pos.x, y: pos.y };
```

**`_onMouseMove`** — replace the existing pan block with a mode branch:
```js
if (this._panMode === 'drag') {
  // drag pan: handled in F4
} else {
  // follow pan: just track current cursor position; RAF loop does the work
  this._panCurrentPos = { x: pos.x, y: pos.y };
}
```
(No domain mutation here in follow mode.)

**`_onMouseUp`** — clear `_panCurrentPos`:
```js
this._panCurrentPos = null;
```

**`_scheduleRender`** — insert velocity tick before the `_dirty` render check:
```js
if (this._isPanning && this._panMode === 'follow' && this._panCurrentPos && this._panStart) {
  const dx   = this._panCurrentPos.x - this._panStart.screenX;
  const dy   = this._panCurrentPos.y - this._panStart.screenY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const DEAD_ZONE        = 5;
  const FOLLOW_PAN_SPEED = 0.02;
  if (dist > DEAD_ZONE) {
    this._xAxis.panByPixels(-dx * FOLLOW_PAN_SPEED);
    this._yAxis.panByPixels( dy * FOLLOW_PAN_SPEED);
    this._updateScales();
    this._dirty = true;
    this.emit('panChanged', {
      dx: Math.round(-dx * FOLLOW_PAN_SPEED),
      dy: Math.round( dy * FOLLOW_PAN_SPEED),
    });
  }
}
```

---

## F4 [COMPLETED] Feature: Pan mode toggle (follow pan / drag pan)

**Files:** `src/plot/PlotController.js`, `examples/ExampleApp.jsx`

**Behaviour:**
- Two pan modes selectable at runtime:
  - `'follow'` (default): current behavior — viewport tracks the drag direction; the axis scrolls in the direction you drag. **After F5 this becomes a continuous velocity/joystick mode.**
  - `'drag'`: grab-and-drag — data moves with the cursor (inverted signs vs follow pan). Uses restore-and-reapply to prevent float drift. Like Google Maps / Photoshop pan.
- A "Drag pan" checkbox is added to the example app header.
- ROI interactions are completely unaffected.

**PlotController constructor** — add after existing pan state:
```js
this._panMode = opts.panMode || 'follow';
```

**New public method** (add after `setAutoExpand`):
```js
/** @param {'follow'|'drag'} mode */
setPanMode(mode) {
  this._panMode = (mode === 'drag') ? 'drag' : 'follow';
}
```

**`_onMouseMove`** — drag pan branch (inverted signs):
```js
if (this._panMode === 'drag') {
  const dx = pos.x - this._panStart.screenX;
  const dy = pos.y - this._panStart.screenY;
  this._xAxis.setDomain(this._panStart.xDomain);
  this._yAxis.setDomain(this._panStart.yDomain);
  this._xAxis.panByPixels(dx);    // inverted: drag right → data moves right
  this._yAxis.panByPixels(-dy);   // inverted: drag down  → data moves down
  this._updateScales();
  this._dirty = true;
  this.emit('panChanged', { dx, dy });
}
```

**`ExampleApp.jsx`** — add state + handler + checkbox:
```jsx
const [dragPan, setDragPan] = useState(false);

const handleDragPanChange = (e) => {
  const checked = e.target.checked;
  plotRef.current?.getController()?.setPanMode(checked ? 'drag' : 'follow');
  setDragPan(checked);
};

// in header JSX, after Auto-expand label:
<label style={checkboxLabelStyle}>
  <input type="checkbox" checked={dragPan} onChange={handleDragPanChange} />
  Drag pan
</label>
```

---

## B6 [COMPLETED] Fix: Y-axis data rendering is vertically inverted

**Files:** `src/plot/PlotController.js`, `src/plot/layers/ScatterLayer.js`, `src/plot/layers/ROILayer.js`

**Symptom:** Data points render upside-down relative to the axis tick labels. Low-y data values appear near the **top** of the plot; high-y values appear near the **bottom**. The axis labels (drawn by `AxisRenderer` via d3 scale) are correct — y=0 is labeled at the bottom and y=max at the top. Only the deck.gl-rendered scatter points and ROI rectangles are inverted.

**Root cause:**

`_buildViewState` (in `PlotController.js`) derives the deck.gl camera target `ty` from the equation:

```
screenY = -(worldY − ty) × 2^zoomY + H/2     ← assumes flipY:true
```

which requires:

```js
const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;
```

If the installed deck.gl version's `OrthographicView` defaults to `flipY: false` (y increases **downward**, screen convention), the actual relationship is:

```
screenY = (worldY − ty) × 2^zoomY + H/2      ← flipY:false
```

Under that convention a **larger** world-y value maps to a **larger** screen-y (visual bottom), inverting the entire plot. Both `ScatterLayer.js` (`getPosition` returns `[x, y_data, 0]`) and `ROILayer.js` (polygon vertices use raw `toY(roi.y1/y2)`) pass raw data-y without compensation, so every rendered element is affected.

**Investigation — do this first:**

1. Check `package.json` for the exact `@deck.gl/core` version installed.
2. Look up whether that version's `OrthographicView` defaults to `flipY: true` or `flipY: false`.
3. Add a quick sanity `console.log` inside `_render()` to print the computed `viewState` and compare `target[1]` against the expected midpoint of the y-domain.

**Fix — Option A (preferred, minimal change):**

Add `flipY: true` explicitly to the `OrthographicView` declaration in `PlotController.init()`:

```js
views: [new OrthographicView({ id: 'ortho', controller: false, flipY: true })],
```

If the `ty` formula was derived for `flipY: true` (as it was), and the view now matches, scatter points and ROI boxes should align with the axis labels without any changes to the layer files.

**Fix — Option B (if Option A doesn't resolve it):**

Negate all y coordinates at the deck.gl boundary to force screen-y convention everywhere:

1. **`PlotController._buildViewState`** — negate `deckYMin` and `deckYMax`, then re-derive `ty` for `flipY: false`:
   ```js
   const deckYMinN = -deckYMax;   // negate: larger data-y → smaller (more negative) deck-y
   const deckYMaxN = -deckYMin;
   const ySpanN    = deckYMaxN - deckYMinN;  // same magnitude as ySpan
   // For flipY:false: deckYMinN → screenY = H−marginBottom, deckYMaxN → screenY = marginTop
   // Equation: (worldY − ty)*zoom + H/2 = H−marginBottom  →  ty = deckYMinN − (H/2−marginBottom)*ySpanN/pa.height
   const ty = deckYMinN - (H / 2 - marginBottom) * ySpanN / pa.height;
   // zoom unchanged (uses pa.height / ySpanN = pa.height / ySpan)
   return { id: 'ortho', target: [tx, ty, 0], zoom: [zoomX, zoomY] };
   ```
2. **`ScatterLayer.js` — negate y in `getPosition`:**
   ```js
   getPosition: (_, { index }) => [
     xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
     -(yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index]),   // ← negate
     0,
   ],
   ```
3. **`ROILayer.js` — update `toY` to negate:**
   ```js
   const toY = v => -(yIsLog ? Math.log10(Math.max(v, 1e-10)) : v);
   ```
   All polygon, path, and handle positions in ROILayer already use `toY(...)`, so this one-line change covers them all.

**After fix:** The visual positions of scatter points and ROI boxes should align with axis tick labels. Verify by:
- Observing that a value of y=0 (lowest) appears at the bottom of the plot.
- Dragging a RectROI and confirming its rendered position matches its reported bounds in the log panel.
- Rebuilding: `npm run build` should produce 0 errors.

---

## B5 [COMPLETED] Fix: Inverted vertical controls on constrained RectROI

**Files:** `src/plot/ROI/RectROI.js`, `src/plot/ROI/ROIController.js`

**Context:** A prior fix (handle naming swap, `xLocked` flag) was applied but the user confirmed vertical controls on constrained RectROIs are still inverted. The fix must be re-examined and corrected from first principles.

**Root cause to verify:**

The y-axis scale range is set as `[pa.y + pa.height, pa.y]` — an inverted range where `y1s = yScale(y1)` is a **larger** screen-y (visual bottom) and `y2s = yScale(y2)` is a **smaller** screen-y (visual top). Dragging UP decreases screen-y → `dataY = yScale.invert(screenY)` **increases** (inverted scale) → `dy > 0`.

The handle naming in the current `RectROI.hitTestHandles` maps:
- `near(midX, y2s)` → `HANDLES.TOP` → `applyDelta(TOP)`: `y2 += dy`
- `near(midX, y1s)` → `HANDLES.BOTTOM` → `applyDelta(BOTTOM)`: `y1 += dy`

Trace the xLocked MOVE handle: `applyDelta(MOVE)` does `y1 += dy; y2 += dy`. After that, ROIController re-syncs `roi.x1 = parent.x1; roi.x2 = parent.x2`. The `dy` sign is correct for the inverted y-scale, so MOVE should be fine.

**Likely remaining issue:** The `_dragStartBounds` is captured at mousedown. Bounds are restored at the top of every `_onMouseMove` frame (`roi.y1 = sb.y1; roi.y2 = sb.y2`). If `applyDelta` then causes the normalization swap `[y1, y2] = [y2, y1]` (when dragging a BOTTOM handle so far up that `y1 > y2`), the restored bounds on the next frame reset to the original un-swapped values and the rect "snaps" — this can feel inverted on the boundary. Ensure the normalization in `applyDelta` does NOT fire during the frame restore (it shouldn't since restore happens before delta), and verify the corner-→-vertical remapping for xLocked rects is consistent.

**Steps:**
1. Instrument `_onMouseMove` with a temporary `console.log` of `dy`, the handle, and `roi.y1`/`roi.y2` before and after `applyDelta` to empirically confirm the sign issue.
2. Correct whichever path is wrong. Do NOT change both sides simultaneously without verifying one first.
3. Remove instrumentation, rebuild, and verify.

---

## F3 [COMPLETED] Feature: Show emitted events on the example page log panel

**File:** `examples/ExampleApp.jsx`

**Context:** The bottom log panel currently shows `roiCreated`, `roiDeleted`, `dataAppended`, and `domainChanged`. `roiUpdated` and `zoomChanged` are either skipped or console-only. The user wants meaningful emitted changes visible in the on-screen log.

**Required changes to `handleEvent` in ExampleApp:**

1. **`roiUpdated`** — currently a no-op in the switch. Throttle it: only log when the active ROI's bounds actually changed by more than a small epsilon (avoids flooding during drag). Display formatted bounds:
   ```javascript
   case 'roiUpdated': {
     const b = data.bounds;
     const msg = `roiUpdated: ${data.roi.id}  x[${b.x1.toFixed(1)}, ${b.x2.toFixed(1)}]  y[${b.y1.toFixed(1)}, ${b.y2.toFixed(1)}]`;
     addLog(msg);  // addLog already caps at 20 entries, so flooding is bounded
     break;
   }
   ```

2. **`zoomChanged`** — currently console-only. Add to the on-screen log:
   ```javascript
   case 'zoomChanged':
     console.log('[zoomChanged]', `factor=${data.factor?.toFixed(3)}`);
     addLog(`zoomChanged: factor=${data.factor?.toFixed(3)}`);
     break;
   ```

3. **`panChanged`** — PlotController already emits this (from `_onMouseMove`). Add a handler entry and log it (throttle: only when `Math.abs(dx) + Math.abs(dy) > 5` pixels to avoid spam):
   ```javascript
   case 'panChanged':
     if (Math.abs(data.dx) + Math.abs(data.dy) > 5) {
       addLog(`panChanged: dx=${data.dx.toFixed(0)} dy=${data.dy.toFixed(0)}`);
     }
     break;
   ```
   Also wire `panChanged` in `PlotCanvas.jsx` (or wherever `onEvent` is wired) if it is not already forwarded.

**Styling note:** Keep existing color scheme — most-recent entry is `#adf`, older entries are `#556`.

**After changes:** Rebuild and verify no new console errors.

---

## ✅ PREVIOUSLY COMPLETED — 2026-02-20

B1–F2 implemented and build verified (`webpack compiled successfully`, 0 errors).

---

## B1 [COMPLETED] Fix: Zoom (scroll wheel) does nothing

**File:** `src/plot/PlotController.js`

**Root cause:** `ViewportController.getCanvasPosition()` returns `{ x, y }` but `_onWheel` destructures `{ screenX, screenY }` → both `undefined` → `isInPlotArea(undefined, undefined)` returns `false` → handler exits immediately.

**Exact fix in `_onWheel` (line ~360):**
```javascript
// BEFORE (broken):
const { screenX, screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);

// AFTER (fixed):
const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
```

**Same bug exists in `_onMouseDown` (line ~377) in the ROI hitTest guard:**
```javascript
// BEFORE (broken):
const { screenX, screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);

// AFTER (fixed):
const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
```

---

## B2 [COMPLETED] Fix: deck.gl coordinate system mismatch (pan/zoom wrong, ROIs misplace)

**Root cause (3 compounding issues in `_buildViewState()`):**

1. **Single zoom level** — `zoom: Math.min(zoomX, zoomY)` forces both axes to same pixels-per-unit. For the example (x: log 1–10000, y: linear 0–100) this distorts the view. deck.gl 8.x supports `zoom: [zoomX, zoomY]` for independent per-axis scaling.

2. **No margin compensation** — deck.gl's `OrthographicView` places `target` at the **full canvas center** (including margins), but d3 scale ranges start at `marginLeft`/`marginTop`. The plot area center ≠ canvas center → points are offset from where axis ticks say they should be.

3. **Log scale mismatch** — points are positioned at raw data values (1–10000) in deck.gl's linear world space, but d3's `scaleLog` spreads them logarithmically. Point at x=10 appears near x=1 visually, but axis tick says 25% across. Complete misalignment.

**Exact replacement for `_buildViewState()` in `src/plot/PlotController.js`:**

```javascript
_buildViewState() {
  const [xMin, xMax] = this._xAxis.getDomain();
  const [yMin, yMax] = this._yAxis.getDomain();

  const { canvasWidth: W, canvasHeight: H, plotArea: pa,
          marginLeft, marginBottom } = this._viewport;

  const xIsLog = this._xAxis.scaleType === 'log';
  const yIsLog = this._yAxis.scaleType === 'log';

  // For log scale axes, work in log10 space so deck.gl's linear projection
  // matches the logarithmic d3 scale. Zoom/pan stays O(1) — viewState only.
  const deckXMin = xIsLog ? Math.log10(Math.max(xMin, 1e-10)) : xMin;
  const deckXMax = xIsLog ? Math.log10(Math.max(xMax, 1e-10)) : xMax;
  const deckYMin = yIsLog ? Math.log10(Math.max(yMin, 1e-10)) : yMin;
  const deckYMax = yIsLog ? Math.log10(Math.max(yMax, 1e-10)) : yMax;

  const xSpan = Math.max(deckXMax - deckXMin, 1e-10);
  const ySpan = Math.max(deckYMax - deckYMin, 1e-10);

  // Independent per-axis zoom (deck.gl 8.x supports zoom: [zoomX, zoomY])
  const zoomX = Math.log2(pa.width  / xSpan);
  const zoomY = Math.log2(pa.height / ySpan);

  // Adjust target to compensate for margin offset.
  // Derived from OrthographicView (flipY:true) projection equations:
  //   screenX = (worldX - tx) * 2^zoomX + W/2  →  solve for tx so that
  //   deckXMin maps to marginLeft and deckXMax maps to marginLeft+plotWidth.
  //
  //   screenY = -(worldY - ty) * 2^zoomY + H/2  (flipY negates y)
  //   deckYMin maps to marginTop+plotHeight, deckYMax maps to marginTop.
  const tx = deckXMin + (W / 2 - marginLeft) * xSpan / pa.width;
  const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;

  return {
    id:     'ortho',
    target: [tx, ty, 0],
    zoom:   [zoomX, zoomY],
  };
}
```

**Also expose `xIsLog`/`yIsLog` flags for use by layers. Add to `_render()` in the same file:**
```javascript
// Add these two lines near top of _render(), before building layers:
const xIsLog = this._xAxis.scaleType === 'log';
const yIsLog = this._yAxis.scaleType === 'log';

// Pass to buildScatterLayer:
layers.push(buildScatterLayer(gpuAttrs, { dataTrigger: this._dataTrigger, xIsLog, yIsLog }));

// Pass to ROILayer:
layers.push(new ROILayer({
  id:       'roi-layer',
  rois,
  plotYMin: yMin,
  plotYMax: yMax,
  xIsLog,
  yIsLog,
}));
```

**Note on `marginBottom`:** `ViewportController` doesn't currently expose `marginBottom` as a direct property. Either:
- Add `this.marginBottom` to `ViewportController` constructor (it already stores `this.marginBottom = opts.marginBottom ?? 50`) — check the file, it should already be there.
- Or compute `marginBottom = H - pa.y - pa.height` inside `_buildViewState()`.

---

## B3 [COMPLETED] Fix: ScatterLayer must transform to deck.gl coordinate space

**File:** `src/plot/layers/ScatterLayer.js`

For log-x axis: raw data values (1–10000) must be transformed to `log10(x)` before deck.gl renders them, since `_buildViewState()` now sets up the projection in log space. For linear axes, pass through unchanged.

**Exact replacement for `buildScatterLayer` function:**

```javascript
export function buildScatterLayer(gpuAttrs, opts = {}) {
  const { x, y, color, size } = gpuAttrs;
  const count = x.length;
  const xIsLog = opts.xIsLog || false;
  const yIsLog = opts.yIsLog || false;

  const data = { length: count };

  return new ScatterplotLayer({
    id:               opts.id || 'masterplot-scatter',
    data,
    radiusUnits:      'pixels',
    radiusMinPixels:  1,
    radiusMaxPixels:  30,
    pickable:         false,
    stroked:          false,

    getPosition: (_, { index }) => [
      xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
      yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index],
      0,
    ],
    getRadius: (_, { index }) => size[index] * 0.5,
    getColor:  (_, { index }) => {
      const base = index * 4;
      return [color[base], color[base + 1], color[base + 2], color[base + 3]];
    },

    updateTriggers: {
      getPosition: opts.dataTrigger || 0,
      getRadius:   opts.dataTrigger || 0,
      getColor:    opts.dataTrigger || 0,
    },

    ...opts.layerProps,
  });
}
```

**Key:** `updateTriggers.getPosition` is tied to `dataTrigger` (changes only on data append). Zoom/pan is handled by `viewState` changes alone — no accessor re-evaluation needed during interaction.

---

## B4 [COMPLETED] Fix: ROILayer must render in deck.gl coordinate space

**File:** `src/plot/layers/ROILayer.js`

ROIs are stored in data space (e.g., `roi.x1 = 1000` for log-x). deck.gl needs them in deck.gl space (`log10(1000) = 3`). Hit-testing already uses the d3 scale (correct), but the visual rendering was in raw data space → visual/click mismatch.

**Changes to `renderLayers()`:**

Add at the top of `renderLayers()`:
```javascript
const xIsLog = this.props.xIsLog || false;
const yIsLog = this.props.yIsLog || false;
const toX = v => xIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
const toY = v => yIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
const { plotYMin, plotYMax } = this.props;
// Convert plot y-extent to deck.gl space for LinearRegion height
const deckYMin = toY(plotYMin);
const deckYMax = toY(plotYMax);
```

Replace LinearRegion polygon:
```javascript
const polygon = [
  [toX(roi.x1), deckYMin],
  [toX(roi.x2), deckYMin],
  [toX(roi.x2), deckYMax],
  [toX(roi.x1), deckYMax],
];
// Edge paths:
{ path: [[toX(roi.x1), deckYMin, 0], [toX(roi.x1), deckYMax, 0]] },
{ path: [[toX(roi.x2), deckYMin, 0], [toX(roi.x2), deckYMax, 0]] },
```

Replace RectROI polygon:
```javascript
const dx1 = toX(roi.x1), dx2 = toX(roi.x2);
const dy1 = toY(roi.y1), dy2 = toY(roi.y2);
const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];

// Handles:
const handles = [
  [dx1, dy1], [dx2, dy1], [dx1, dy2], [dx2, dy2],
  [(dx1+dx2)/2, dy1], [(dx1+dx2)/2, dy2],
  [dx1, (dy1+dy2)/2], [dx2, (dy1+dy2)/2],
].map(([hx, hy]) => ({ position: [hx, hy, 0] }));
```

Add `xIsLog` and `yIsLog` to `ROILayer.defaultProps`:
```javascript
ROILayer.defaultProps = {
  rois:       { type: 'array',    value: [] },
  plotYMin:   { type: 'number',   value: 0   },
  plotYMax:   { type: 'number',   value: 100  },
  xIsLog:     { type: 'boolean',  value: false },
  yIsLog:     { type: 'boolean',  value: false },
  onROIClick: { type: 'function', value: null, optional: true },
};
```

---

## F1 [COMPLETED] Feature: Auto-expand domain toggle (API + UI)

### PlotController changes (`src/plot/PlotController.js`)

In constructor, after existing fields:
```javascript
this._autoExpand = opts.autoExpand ?? true;
```

Replace existing `appendData` method (remove second param, use internal flag):
```javascript
appendData(chunk) {
  this._dataStore.appendData(chunk);
  this._dataTrigger++;

  if (this._autoExpand) {
    this._autoExpandDomain(chunk);
  }

  this._dirty = true;
  this.emit('dataAppended', { count: chunk.x.length, total: this._dataStore.getPointCount() });
}
```

Add new public method:
```javascript
/** Toggle whether new data appended via appendData() expands the visible domain. */
setAutoExpand(enabled) {
  this._autoExpand = !!enabled;
}
```

### ExampleApp changes (`examples/ExampleApp.jsx`)

1. Add state: `const [autoExpand, setAutoExpand] = useState(true);`
2. When checkbox changes: call `plotRef.current?.getController()?.setAutoExpand(checked)`
3. Remove the `true` second arg from `controller.appendData(initialData, true)` and `controller.appendData(chunk, true)` calls (no longer needed since it's now internal state)

---

## F2 [COMPLETED] Feature: Live append on/off checkbox

### ExampleApp changes (`examples/ExampleApp.jsx`)

1. Move append interval to a ref: `const appendIntervalRef = useRef(null);`
2. Add state: `const [liveAppend, setLiveAppend] = useState(true);`
3. Extract a `startAppend(controller)` helper that sets `appendIntervalRef.current = setInterval(...)`
4. Checkbox onChange:
   ```javascript
   if (checked) {
     startAppend(plotRef.current?.getController());
   } else {
     clearInterval(appendIntervalRef.current);
   }
   setLiveAppend(checked);
   ```
5. `useEffect` cleanup should call `clearInterval(appendIntervalRef.current)` on unmount

### UI placement
Both checkboxes go in the header bar (same `<div style={headerStyle}>` row), after the keybind list, before the ROI count. Style to match the rest of the header (monospace, dark theme).

---

## Build Verification

After all changes: run `npx webpack --mode development` from the project root. It should complete with `compiled successfully` and 0 errors.

---

## Phase 1–10 Status (carried forward from v1.1)

All phases 1–10 MVP steps were COMPLETED in the initial session. The steps above (B1–F2) are new work items discovered during user testing.

### Previously completed steps remain completed. Summary:

| Phase | Status |
|-------|--------|
| 1. Setup | COMPLETED |
| 2. Core | COMPLETED |
| 3. Axes | COMPLETED |
| 4. Deck.gl | COMPLETED |
| 5. ROI Classes | COMPLETED |
| 6. ROI Controller | COMPLETED |
| 7. Zoom/Pan | COMPLETED (but bugs B1–B2 mean it doesn't work correctly — fix via B1–B2) |
| 8. Live Append | COMPLETED |
| 9. Example | COMPLETED |
| 10. Docs | COMPLETED (README) |

---

## F7 [COMPLETED] Feature: Runtime-tunable follow-pan speed + slider control

**Files:** `src/plot/PlotController.js`, `examples/ExampleApp.jsx`

**Behaviour:**
- `FOLLOW_PAN_SPEED` is currently a hardcoded constant (0.02) inside `_scheduleRender`.
  Convert it to an instance field `this._followPanSpeed` (default 0.02) and expose a public setter `setFollowPanSpeed(value)` so callers can tune it at runtime.
- Add a `<input type="range" min="0.005" max="0.1" step="0.001">` slider to the ExampleApp header next to the "Drag pan" checkbox so the user can find a good balance interactively.
  The current value is shown as a fixed-precision number beside the slider.

**PlotController.js changes:**
1. Add `this._followPanSpeed = 0.02;` in constructor after `this._panMode`.
2. Add public method after `setPanMode()`:
   ```js
   /** @param {number} speed  Tuning range: 0.005 – 0.1 */
   setFollowPanSpeed(speed) {
     this._followPanSpeed = Math.max(0.001, Number(speed));
   }
   ```
3. In `_scheduleRender()`, remove `const FOLLOW_PAN_SPEED = 0.02;` and replace both usages with `this._followPanSpeed`.

**ExampleApp.jsx changes:**
```jsx
const [panSpeed, setPanSpeed] = useState(0.02);
const handlePanSpeedChange = (e) => {
  const v = parseFloat(e.target.value);
  plotRef.current?.getController()?.setFollowPanSpeed(v);
  setPanSpeed(v);
};
// In JSX after "Drag pan" label:
<label style={checkboxLabelStyle}>
  Pan speed
  <input type="range" min="0.005" max="0.1" step="0.001"
    value={panSpeed} onChange={handlePanSpeedChange}
    style={{ verticalAlign: 'middle', margin: '0 4px' }} />
  {panSpeed.toFixed(3)}
</label>
```

---

## F8 [COMPLETED] Feature: LineLayer example page (random-walk + live-append time series)

**Files:** `webpack.config.js`, `src/line.js` (new), `examples/LineExample.jsx` (new)

**Behaviour:**
- Separate example page (`line.html`) demonstrating `buildLineLayer` (PathLayer wrapper).
- Three independent random-walk signals (A, B, C) with distinct colours: cyan, orange, lime.
- X axis: linear sample index 0–N. Y axis: linear value range auto-fit.
- Live append: every 1 s, 500 new samples added to each signal; layer rebuilt each tick.
- Header controls: Live append checkbox, Reset button (clears signals and restarts).
- Event log panel (same style as ExampleApp, last 20 entries).
- No ROI, no scatter — line layers only.

**webpack.config.js changes:** Convert single entry to multi-entry object; add two new HtmlWebpackPlugin instances for `line.html` and `spectrogram.html`.

---

## F9 [COMPLETED] Feature: SpectrogramLayer — STFT via fft.js + BitmapLayer rendering

**Files:** `package.json` (+fft.js), `src/plot/layers/SpectrogramLayer.js` (new), `src/spectrogram.js` (new), `examples/SpectrogramExample.jsx` (new)

**Behaviour:**
- New `buildSpectrogramLayer(samples, opts)` builder function (same style as existing layer builders).
- `samples`: `Float32Array` of raw time-domain samples.
- `opts`: `{ sampleRate, windowSize=1024, hopSize=512 }`
- Internal CPU pipeline:
  1. STFT using fft.js (Hann window, radix-2); output: power matrix `[numFrames × windowSize/2]`.
  2. dB normalization (global min/max).
  3. Viridis colour-map (hardcoded 16-stop LUT — no extra dep).
  4. `ImageData` → `BitmapLayer` with bounds `[0, 0, durationSecs, sampleRate/2]`.
- Demo page (`spectrogram.html`): 5-second chirp (440 → 4400 Hz) at 44100 Hz sampleRate + pink noise.
  Live append: every 500 ms, extend chirp by 0.25 s and rebuild layer.
  Header: windowSize selector (256/512/1024/2048), Live append checkbox.

---

## B8 [COMPLETED] Fix: Spectrogram page shows blank graph

**Files:** `src/plot/layers/SpectrogramLayer.js`, `examples/SpectrogramExample.jsx`

**Symptom:** The spectrogram demo page renders axes correctly but shows no spectrogram image.

**Root causes (four compounding issues):**

### Cause A — No `dataTrigger` counter (CompositeLayer re-invocation)

`SpectrogramLayer.renderLayers()` is a CompositeLayer method that deck.gl 8.x only re-runs when the layer's props change. The `samples` prop (`type: 'object'`) uses reference equality — it changes each append because `appendSamples` creates a new `Float32Array`. This *should* work, but it is fragile and can silently break if deck.gl batches or short-circuits prop comparisons. A numeric counter prop (`dataTrigger`) is the established pattern in this codebase (`PlotController._dataTrigger`) and guarantees re-invocation.

**Fix — add `dataTrigger` to `SpectrogramLayer.defaultProps`:**
```js
SpectrogramLayer.defaultProps = {
  samples:      { type: 'object',  value: null  },
  sampleRate:   { type: 'number',  value: 44100 },
  windowSize:   { type: 'number',  value: 1024  },
  hopSize:      { type: 'number',  value: 512   },
  dataTrigger:  { type: 'number',  value: 0     },  // ← add
};
```

**SpectrogramExample.jsx** — add a ref and pass it:
```js
const dataTriggerRef = useRef(0);

// Inside appendSamples(), after growing samplesRef.current:
dataTriggerRef.current += 1;

// Inside renderFrame(), inside the SpectrogramLayer props:
dataTrigger: dataTriggerRef.current,
```

### Cause B — BitmapLayer `image` prop has no `updateTrigger`

deck.gl 8.x sub-layers inside a CompositeLayer are reconciled by ID (`'spectrogram-bitmap'`). When `renderLayers()` returns a new `BitmapLayer` with a new canvas, deck.gl checks whether the `image` prop changed. For accessor-driven props this requires `updateTriggers`; for plain object props deck.gl compares by reference — but `BitmapLayer.image` is internally handled as a texture prop and may not be re-uploaded without an explicit trigger.

**Fix — add `updateTriggers` to the BitmapLayer inside `renderLayers()`:**
```js
new BitmapLayer(this.getSubLayerProps({
  id:             'bitmap',
  image,
  bounds:         [0, 0, durationSecs, sampleRate / 2],
  updateTriggers: { image: this.props.dataTrigger },  // ← add
})),
```

### Cause C — `OffscreenCanvas` not supported as luma.gl 8.5.x texture source

`@luma.gl/core@^8.5.21` creates a `Texture2D` from the `image` prop using `gl.texImage2D`. luma.gl 8.5.x accepts `HTMLCanvasElement`, `HTMLImageElement`, and `ImageBitmap`, but `OffscreenCanvas` support is unreliable at this version. Passing an `OffscreenCanvas` may silently produce an empty/black texture.

**Fix — call `transferToImageBitmap()` to convert OffscreenCanvas to ImageBitmap before returning:**
```js
// Replace the canvas return in buildImage() with:
ctx.putImageData(imgData, 0, 0);
// Return ImageBitmap (supported by luma.gl 8.x) instead of raw OffscreenCanvas
if (canvas.transferToImageBitmap) {
  return canvas.transferToImageBitmap();
}
return canvas;  // HTMLCanvasElement fallback path — already compatible
```

### Cause D — Double Y-flip makes the spectrogram inverted (shows upside-down, not blank)

`buildImage()` manually flips rows: `row = numBins - 1 - bin` so that bin 0 (0 Hz DC) sits at the bottom row of the canvas. However, deck.gl 8.x `BitmapLayer` uploads canvas/ImageBitmap textures with `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`, which flips the image again during GPU upload. This double-flip results in 0 Hz appearing at the *top* of the spectrogram — which is visually inverted rather than blank, but on a dark background with mostly dark-purple low-power colors the error can look like a blank or near-blank image.

**Fix — remove the manual row flip from `buildImage()`; let BitmapLayer/WebGL's UNPACK_FLIP_Y do the single correct flip:**
```js
// BEFORE (double-flip — wrong):
const row = numBins - 1 - bin;

// AFTER (no manual flip — correct, WebGL UNPACK_FLIP_Y handles orientation):
const row = bin;
```

---

**Investigation checklist (run in order if fixes don't immediately resolve the blank):**

1. Add `console.log('[SpectrogramLayer] renderLayers called, numFrames=', numFrames)` at the top of `renderLayers()` — verify it's called at all and with non-zero frames.
2. Log `globalMin`, `globalMax` from `computeSTFT` — if they are equal the image is monochrome dark purple.
3. Log the first pixel of the image canvas to confirm ImageData is being written.
4. In browser DevTools → WebGL inspector (or console `gl.getError()`) — check for texture upload errors.

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Spectrogram image fills the plot area with a Viridis colour gradient (dark purple → yellow).
- The chirp sweep appears as a diagonal bright band rising left-to-right.
- 0 Hz is at the visual bottom; Nyquist (22050 Hz) is at the top (matching the y-axis tick labels).
- Live append extends the spectrogram rightward every 500 ms; the x-domain auto-expands.
- Scroll-wheel zoom and drag-pan work correctly.

---

## ✅ ALL ITEMS COMPLETED (updated — B8 included)

---

## Change Log

- **2026-02-20 [Initial]**: Plan created. All steps initialized as PENDING.
- **2026-02-20 [Claude]**: All Phases 1–10 MVP implemented. React 19, 0 vuln. Build clean.
- **2026-02-20 [Claude]**: User testing revealed 3 bugs and 2 feature requests. Full root-cause analysis done. Fix steps B1–F2 added. Next agent should implement B1→B2→B3→B4→F1→F2 in order, then rebuild.
- **2026-02-20 [Claude]**: B1–F2 all implemented. Build verified: `webpack compiled successfully` 0 errors. Removed unused `React` import from ExampleApp.jsx (JSX transform handles it).
- **2026-02-20 [Claude]**: User testing session 2. Additional fixes applied: RectROI handle naming corrected (TOP↔BOTTOM swap to match visual y-axis inversion), `xLocked` flag added for LinearRegion-parented RectROIs (x bounds pinned to parent, no left/right handles). x-axis switched to linear in example. Two new items added: B5 (inverted controls still reported on constrained RectROI — needs empirical verification and re-fix) and F3 (show roiUpdated/zoomChanged/panChanged in on-screen log panel).
- **2026-02-21 [Claude]**: B5 — static analysis confirmed handle positions and dy sign are correct. Remaining issue was the crossover-snap UX artifact: when TOP/BOTTOM handles were dragged past the opposite edge, the normalization swap + per-frame bounds-restore caused the rect to "teleport," which felt like inversion at the boundary. Fix: added per-case clamping inside `applyDelta` for HANDLES.TOP and HANDLES.BOTTOM so handles stop at zero height instead of crossing. Global normalization retained for corner handles. F3 — added `roiUpdated` (debounced 150 ms, logs after drag settles), `zoomChanged` (immediate), and `panChanged` (threshold > 5 px displacement) to ExampleApp `handleEvent`. `panChanged` was already emitted by PlotController and forwarded by PlotCanvas. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: User reports entire y-scale is visually inverted (data rendered upside-down relative to axis tick labels). Root cause identified: `_buildViewState` computes `ty` assuming `OrthographicView` has `flipY: true`, but the installed version may default to `flipY: false`. Added B6 with two fix options: Option A (add `flipY: true` to `OrthographicView`), Option B (negate y at the deck.gl layer boundary in `ScatterLayer.js` and `ROILayer.js` and rederive `ty`). No code changed — next agent to implement.
- **2026-02-21 [Claude]**: B6 — Investigation confirmed deck.gl 8.9.36 defaults to `flipY: true` in `OrthographicViewport`. Tracing the full projection pipeline revealed the `ty` formula (`deckYMin + (H/2 − marginBottom) × ySpan / pa.height`) is derived for `flipY: false` (i.e., `screenY = H/2 − scaleY × (worldY − ty)`). With the default `flipY: true` the equation inverts to `screenY = H/2 + scaleY × (worldY − ty)`, placing y=0 near the top. Fix: add `flipY: false` explicitly to `OrthographicView` in `PlotController.init()`. One-line change; no layer files needed. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: User requested three new features: pan mode toggle (follow/drag), follow pan continuous velocity joystick mode, right-click context menu suppression + drag zoom. Added F4, F5, F6. Updated prompt.md with git branch rule (rule #6). Branch `feature/F4-F5-F6` created for implementation.
- **2026-02-21 [Claude]**: F4, F5, F6 all implemented. F4: added `_panMode` state and `setPanMode()` public method; drag-pan branch in `_onMouseMove` uses restore-and-reapply with inverted signs. F5: `_panCurrentPos` added; `_scheduleRender` RAF loop applies velocity tick for follow mode (dead zone 5 px, speed 0.02). F6: `contextmenu` event suppressed; `_handleRightDown`/`_handleRightMove` private methods handle right-click drag zoom centred on click origin, restore-and-reapply pattern prevents float drift. ExampleApp: "Drag pan" checkbox added to header wired to `setPanMode`. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: B7 — Fixed y-axis pan direction bugs in F4 and F5. Root cause: the d3 y scale uses an inverted range `[plotBottom, plotTop]`, making `pxSpan` negative inside `panByPixels`, which reverses its effective direction vs x. Follow velocity (F5): changed `+dy * speed` → `-dy * speed`. Drag mode (F4): changed `panByPixels(-dy)` → `panByPixels(dy)`. Both fixes make y-axis pan direction consistent with x-axis behavior. Also added Y-axis Coordinate Convention section to `prompt.md` documenting this gotcha. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: F7 — `FOLLOW_PAN_SPEED` hardcoded constant removed from `_scheduleRender`; all 4 usages replaced with `this._followPanSpeed`. Pan speed slider (`<input type="range">` 0.005–0.1, step 0.001) added to ExampleApp header, wired to `setFollowPanSpeed()`. F8 — `LinePlotController.js` created (signal registry, mutable path arrays with `updateTriggers`, drag-pan, wheel-zoom, RAF loop, auto domain expand). `LineExample.jsx` demonstrates 3 random-walk signals (cyan/orange/lime) with live 500-sample/s append and Reset. `src/line.js` entry point + `public/line.html` template added. F9 — `fft.js` installed (npm). `SpectrogramLayer.js` (CompositeLayer): STFT with Hann window via fft.js → dB normalization → 16-stop Viridis LUT → OffscreenCanvas `ImageData` → `BitmapLayer` with bounds `[0,0,durationSecs,sampleRate/2]`. `SpectrogramExample.jsx` demonstrates chirp (440→4400 Hz) + pink noise at 44100 Hz with live 0.25 s/tick append and windowSize selector. `src/spectrogram.js` + `public/spectrogram.html` added. `webpack.config.js` converted to multi-entry (`main`/`line`/`spectrogram`) with separate `HtmlWebpackPlugin` instances per page. Build: `webpack compiled successfully` 0 errors, 3 HTML outputs.
- **2026-02-21 [Claude]**: F10 added (PENDING) — Audio file loading for SpectrogramExample. Uses browser `<input type="file">` + `AudioContext.decodeAudioData`; no webpack changes needed. Clears existing data on load, uses file's actual sampleRate for both spectrogram and waveform panels. Next agent implements F10 then rebuilds.
- **2026-02-21 [Claude]**: F10 — Audio file loading implemented. Added `fileInputRef`, `loadedSampleRateRef`, and `loading` state. `handleFileLoad` async function: stops live append, decodes via `AudioContext.decodeAudioData`, clears all existing sample/waveform data, loads full PCM into `samplesRef`, downsamples for waveform at `WAVEFORM_STEP`, updates both x-axis domains to `[0, durationSecs]` and spectrogram y-axis to `[0, sr/2]`, triggers dirty flags. `renderFrame` now uses `loadedSampleRateRef.current` instead of hardcoded `SAMPLE_RATE`. "Open audio file" button added to header after "Live append" (shows "Loading…" + disabled while decoding; re-opens same file via `e.target.value = ''`). Branch: `feature/F10`. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: B8 — Four fixes applied to resolve blank spectrogram. (A) `dataTrigger` numeric prop added to `SpectrogramLayer.defaultProps`; `SpectrogramExample` increments `dataTriggerRef` on every `appendSamples()` and `windowSize` change, passes it to the layer — guarantees deck.gl re-invokes `renderLayers()`. (B) `updateTriggers: { image: this.props.dataTrigger }` added to BitmapLayer inside `renderLayers()` — forces luma.gl texture re-upload. (C) `buildImage()` now calls `canvas.transferToImageBitmap()` if available before returning — luma.gl 8.5.x silently fails with raw `OffscreenCanvas`. (D) Manual row-flip removed (`row = bin` instead of `row = numBins - 1 - bin`): BitmapLayer/luma.gl already applies `UNPACK_FLIP_Y_WEBGL`; the previous double-flip put 0 Hz at the top. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: F12, F13 added as PENDING. F12: `PlaybackController` (play/pause/stop/seek via `AudioBufferSourceNode`; `onended` uses `_userStopped` flag to distinguish natural end from manual stop), `drawPlayhead`/`formatPlayTime` helpers, RAF loop extended to force dirty-every-frame during playback and draw playhead on both axis canvases, Ctrl+click seek, Play/Pause/Stop header buttons. F13: `FilterController` (offline biquad via `OfflineAudioContext.startRendering()`, `getFrequencyResponse()` via temporary AudioContext, `originalSamplesRef` snapshot for Clear Filter), `FilterPanel` (type dropdown, log-scale cutoff slider, Q slider, live response canvas, Apply button), right sidebar refactored to stack LUT + Filter panels vertically. Both features depend on F10 (file loading) being complete.
- **2026-02-21 [Claude]**: F11 — HistogramLUTController and HistogramLUTPanel implemented. `HistogramLUTController.js`: pure EventEmitter; 6 LUT presets (viridis/grayscale/plasma/inferno/magma/hot) built as Uint8Array[256×4]; `setSpectrogramData()` computes histogram + auto-levels on first data; `setLevels()`/`setLUT()`/`autoLevel()` emit events. `HistogramLUTPanel.jsx`: canvas-based React component; ResizeObserver syncs backing store; histogram bars + gradient strip + draggable level lines drawn in one `useEffect`; LUT dropdown + Auto Level button. `SpectrogramLayer.js`: refactored to use `initializeState`/`updateState` lifecycle — STFT cached in layer state, recomputed only on `dataTrigger` change; `buildImage` now accepts `levelMin/levelMax/lut` params (Viridis fallback when no lutController); `renderLayers` reads from state only. `SpectrogramExample.jsx`: imports wired; `HistogramLUTController` created once at render init; levelsChanged/lutChanged → `setColorTrigger`; `colorTrigger` synced to ref for stale-closure safety; `renderFrame` passes `lutController`/`colorTrigger`; `handleFileLoad` calls `lutController.reset()`; spectrogram panel wrapped in row flex div with `<HistogramLUTPanel width={140} />`. Build: `webpack compiled successfully` 0 errors.
- **2026-02-22 [Claude]**: F16, F15, F14, F17, F18 added as PENDING (from Features.md). Mandatory implementation order: F16 → F15 → F14 → F17 → F18. Plan version bumped to 3.0.
- **2026-02-22 [Claude]**: F16 — Rolling ring buffer DataStore implemented. `DataStore` now extends `EventEmitter`; `_size` renamed to `_sizeArr`; `enableRolling({ maxPoints, maxAgeMs })` allocates fixed-capacity ring buffers including `Float64Array _timestamps`; rolling `_appendRolling` writes at `_headIndex`, advances `_tailIndex` when full; `expireIfNeeded()` advances tail evicting stale/excess points, emits `dataExpired`; `getLogicalData()` handles wrap-around via two-slice copy; `getGPUAttributes()` delegates to `getLogicalData()` in rolling mode; `emit('dirty')` on every `appendData`. `PlotController.appendData` calls `expireIfNeeded()` in rolling mode and `_recalcDomainFromStore()` when points were evicted; `_wireEvents()` forwards `dataExpired`. Branch: `feature/datastore-rolling`. Build: verified.

---

## F16 [COMPLETED] Feature: Rolling Ring Buffer DataStore

**Branch:** `feature/datastore-rolling`

**Goal:** Extend `DataStore` with an optional rolling-window mode supporting count-based and age-based expiration.

### Files Modified

| File | Action |
|------|--------|
| `src/plot/DataStore.js` | Extended with `EventEmitter`; `_size` renamed to `_sizeArr`; ring buffer internals + new public API added |
| `src/plot/PlotController.js` | `expireIfNeeded()` called in append path; `_recalcDomainFromStore()` added; `dataExpired` event wired |

### Implementation steps

1. **DataStore extends EventEmitter** — `import { EventEmitter } from 'events'`; class declaration changed; `super()` added in constructor.

2. **Rename internal size typed array** — `this._size` → `this._sizeArr` throughout `DataStore.js`.

3. **Rolling state fields in constructor:**
   ```js
   this._rollingEnabled = false;
   this._maxPoints      = Infinity;
   this._maxAgeMs       = Infinity;
   this._headIndex      = 0;
   this._tailIndex      = 0;
   this._timestamps     = null;
   ```

4. **`enableRolling({ maxPoints, maxAgeMs })`** — sets flags, allocates fixed-capacity typed arrays (including `_timestamps: Float64Array(capacity)`), resets head/tail/count.

5. **`appendData(chunk)`** — branches on `_rollingEnabled`; rolling path writes per-point via `_appendRolling` (point-by-point to handle circular indexing); non-rolling path uses batched `_appendLinear` (original logic); both emit `'dirty'`.

6. **`expireIfNeeded()`** — advances `_tailIndex` while oldest point exceeds `maxAgeMs` or `_count > maxPoints`; emits `'dataExpired', { expired, remaining }`.

7. **`getLogicalData()`** — returns ordered `{ x, y, size, color }` typed arrays tail→head via two-slice copy into fresh arrays.

8. **`getGPUAttributes()`** — rolling mode delegates to `getLogicalData()`; non-rolling returns live subarrays (no copy regression).

9. **`PlotController.appendData()`** — calls `expireIfNeeded()` after DataStore append in rolling mode; calls `_recalcDomainFromStore()` when points were evicted and `_autoExpand` is on.

10. **`_recalcDomainFromStore()`** — scans `getLogicalData()` for min/max x/y; updates both axes; calls `_updateScales()`.

11. **`_wireEvents()`** — `this._dataStore.on('dataExpired', e => this.emit('dataExpired', e))`.

### Validation checklist

- [x] `enableRolling({ maxPoints: 1000 })` + append 1500 → `getPointCount()` returns 1000
- [x] Wrapped buffer: headIndex wraps past capacity → `getLogicalData()` produces correct tail-to-head ordering
- [x] `expireIfNeeded` with `maxAgeMs` removes all points older than threshold
- [x] Axis domain updates correctly after expiration (auto-expand mode)
- [x] Manual zoom not overridden (auto-domain only runs when `_autoExpand = true`)
- [x] Non-rolling mode: prior behavior unchanged; `getGPUAttributes()` returns live subarray (no copy)
- [x] `DataStore` emits `'dataExpired'` with `{ expired, remaining }`; emits `'dirty'` on every append

---

## F15 [COMPLETED] Feature: Lazy DataView System

**Branch:** `feature/dataview-lazy`
**Completed:** 2026-02-22

**Goal:** Introduce a `PlotDataView` class representing a lazily-evaluated, dirty-flag-cached derived view over a `DataStore` (or another `PlotDataView`). Views support ROI filtering, domain filtering, histogram derivation, and snapshotting. They never mutate the DataStore. Multiple plots may share a single `PlotDataView`. Recomputation is deferred until `getData()` is called while dirty.

---

### Files created / modified

| File | Action |
|------|--------|
| `src/plot/PlotDataView.js` | **Created** — core lazy view class |
| `src/plot/ROI/ROIController.js` | **Modified** — emit `roiFinalized` stub from `_onMouseUp` |
| `src/plot/PlotController.js` | **Modified** — accept `opts.dataStore` / `opts.dataView`; forward `roiFinalized` in `_wireEvents()` |
| `README.md` | **Modified** — PlotDataView section, event table, architecture diagram |
| `examples/HubPage.jsx` | **Modified** — updated Scatter/ROI card description |

---

### Implementation

**`PlotDataView` constructor** `(source, transformFn = null, opts = {})`:
- Accepts `DataStore` or parent `PlotDataView` as `source`; optional `opts.roiController`
- `_dirty = true`, `_snapshot = null`
- Wires `'dirty'` and `'dataExpired'` on source → `markDirty()`
- Wires `'roiFinalized'` and `'roiExternalUpdate'` on roiController → `markDirty()`
- Does NOT wire `'roiUpdated'` — drag must not trigger recompute

**`getData()`** — if dirty, calls `_recompute()`, clears flag, returns snapshot; otherwise returns cached snapshot.

**`markDirty()`** — sets `_dirty = true`, emits `'dirty'` for child view cascade.

**`_recompute()`** — dispatches to `source.getLogicalData()` (DataStore) or `source.getData()` (parent PlotDataView); applies `_transform` if set; stores in `_snapshot`; emits `'recomputed'`.

**`filterByDomain(domain)`** — returns new `PlotDataView(this, filterFn)` keeping only points within `domain.x` / `domain.y` ranges.

**`filterByROI(roiId)`** — returns new `PlotDataView(this, filterFn)` keeping only points inside named ROI bounding box (reads bounds from `opts.roiController.getROI(roiId).getBounds()`); gracefully returns all data if ROI not found.

**`histogram({ field, bins })`** — computes histogram over `getData()[field]`; returns `{ counts: Float32Array, edges: Float32Array }` where `edges.length === bins + 1`.

**`snapshot()`** — returns deep copy via `.slice()` on all typed arrays.

**`destroy()`** — removes all event listeners added in constructor.

**`_filterPoints(data, predicate)`** — two-pass (count then copy) to allocate output typed arrays exactly sized to match count.

**ROIController `_onMouseUp` stub** — captures `roi` before clearing drag state, then emits `roiFinalized` with `{ roi, bounds: roi.getBounds() }`. F14 replaces with versioned bumpVersion() payload.

**PlotController opts prep** — `this._dataStore = opts.dataStore || new DataStore()` and `this._dataView = opts.dataView || null`. F17 adds ownership flags and render path integration.

**PlotController `_wireEvents()`** — forwards `roiFinalized` from ROIController to self.

---

### Validation checklist

- [x] `new PlotDataView(dataStore).getData()` returns same data as `dataStore.getLogicalData()`
- [x] `appendData` → DataStore emits `'dirty'` → PlotDataView dirty → recomputes on next `getData()`
- [x] `dataStore.expireIfNeeded()` fires `'dataExpired'` → PlotDataView dirty
- [x] `filterByDomain({ x: [0, 10] })` returns only points with x in [0, 10]
- [x] `filterByROI(roiId)` returns only points inside ROI bounding box
- [x] `getData()` called twice without dirty change → same snapshot (no recompute)
- [x] `roiUpdated` (drag) does NOT mark view dirty
- [x] `roiFinalized` stub DOES mark view dirty
- [x] Child view cascade: parent `markDirty()` → child becomes dirty via `'dirty'` event
- [x] `histogram({ field: 'x', bins: 32 })` → `counts.length === 32`, `edges.length === 33`
- [x] `snapshot()` returns deep copy — mutating it does not affect cache
- [x] `destroy()` removes all listeners

---

## F14

### F14 [COMPLETED] Feature: ROI Domain Model + Mandatory Versioning

**Completed:** 2026-02-22 | **Branch:** feature/roi-domain-versioning

**Depends on:** F15 (PlotDataView must exist with `roiFinalized` stub wired)

**Goal:** Add mandatory, monotonic versioning to every ROI. The serialized ROI schema gains `version`, `updatedAt`, and `domain: { x?, y? }` fields. `ROIController` gains `serializeAll()`, `deserializeAll()`, and `updateFromExternal()`. External updates are rejected if `incoming.version <= current.version`. Two new events: `roiFinalized` (mouseup / commit, enriched payload) and `roiExternalUpdate` (accepted external update).

---

### Files modified

| File | Action |
|------|--------|
| `src/plot/ROI/ROIBase.js` | Added `version`, `updatedAt`, `domain` fields to constructor; added `bumpVersion()` method |
| `src/plot/ROI/LinearRegion.js` | Added `bumpVersion()` override (domain omits `y`); overrides base domain in constructor |
| `src/plot/ROI/ROIController.js` | Replaced `roiFinalized` stub in `_onMouseUp`; added `serializeAll()`, `deserializeAll()`, `updateFromExternal()`, `_roiFromSerialized()` |
| `src/plot/PlotController.js` | Added `roiExternalUpdate` forwarding in `_wireEvents()` |
| `README.md` | Added ROI Versioning & Serialization section; updated events table |
| `examples/HubPage.jsx` | Updated Scatter/ROI card description |

---

### Implementation notes

- `ROIBase` constructor adds after `this.metadata`:
  ```js
  this.version   = opts.version   || 1;
  this.updatedAt = opts.updatedAt || Date.now();
  this.domain    = opts.domain    || { x: [this.x1, this.x2], y: [this.y1, this.y2] };
  ```

- `ROIBase.bumpVersion()`:
  ```js
  bumpVersion() {
    this.version  += 1;
    this.updatedAt = Date.now();
    this.domain    = { x: [this.x1, this.x2], y: [this.y1, this.y2] };
  }
  ```

- `LinearRegion` overrides `bumpVersion()` to set `domain = { x: [this.x1, this.x2] }` only (omits `y` — spans ±Infinity, not JSON-safe). Also overrides `domain` in constructor when `opts.domain` is absent.

- `ROIController._onMouseUp` now calls `roi.bumpVersion()` then emits `roiFinalized` with enriched payload `{ roi, bounds, version, updatedAt, domain }` and re-emits `roisChanged`.

- `updateFromExternal` does NOT call `bumpVersion()` — the incoming version is authoritative and applied directly.

- Version conflict rules:
  - `incoming.version > existing.version` → accepted
  - `incoming.version === existing.version` → rejected (silent)
  - `incoming.version < existing.version` → rejected (silent)
  - ROI not found → created as new ROI

---

### Validation checklist

- [x] Create ROI → `roi.version === 1`, `roi.updatedAt` is a recent timestamp
- [x] Drag ROI → `roiUpdated` fires during drag; version unchanged mid-drag
- [x] Mouseup → `roiFinalized` fires; `roi.version === 2`
- [x] `serializeAll()` → array with correct `{ id, type, version, updatedAt, domain, metadata }` per ROI
- [x] `deserializeAll(arr)` → `getAllROIs().length === arr.length`
- [x] `updateFromExternal({ version: 5 })` on ROI at v3 → accepted, returns `true`, `roiExternalUpdate` fires
- [x] `updateFromExternal({ version: 2 })` on ROI at v3 → rejected, returns `false`, no event
- [x] `updateFromExternal({ version: 3 })` (equal) on ROI at v3 → rejected, returns `false`
- [x] ConstraintEngine still enforces parent-child bounds (new fields don't collide with `x1/x2/y1/y2` reads)
- [x] PlotDataView (F15): `roiFinalized` marks dirty; `roiUpdated` does not
- [x] `roiExternalUpdate` marks PlotDataView dirty
- [x] No infinite update loops (`updateFromExternal` does not re-emit `roiFinalized`)


---

## EX1

### EX1 [COMPLETED] Scatter + ROI Tables Enhancement

**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
**Target file:** `examples/ExampleApp.jsx`

#### Objective

Enhance the scatter + histogram example with two ROI inspection tables:

1. **LinearRegion table** — lists all LinearRegion ROIs with: ID, Left bound, Right bound, Version
2. **RectROI subset table** — lists RectROIs that fall within the currently selected LinearRegion with: ID, Left, Right, Bottom, Top, Version

#### Implementation

- Added `onInit` prop to `<PlotCanvas>` call; handler stores `controller.roiController` in a ref and subscribes to `roiCreated`, `roiFinalized`, `roiDeleted`.
- `refreshROITables()` (stable via `useCallback`) calls `roiController.serializeAll()`, filters `linearRegion` type into `linearROIs` state, and filters `rect` type by x-overlap with the selected linear into `childRects` state.
- `selectedLinearId` stored in both React state and a ref (`selectedLinearIdRef`) so event handlers always read the current value without stale closures.
- `handleSelectLinear(id)` toggles selection and immediately recomputes `childRects`.
- Tables update only on `roiCreated`/`roiFinalized`/`roiDeleted` — NOT on `roiUpdated` — so drag does not trigger re-render.
- Added 160px ROI panel below the event log with two side-by-side tables styled to match the dark theme.

#### Validation

- Drag LinearRegion/RectROI → tables unchanged until mouseup (`roiFinalized`)
- Version number increments on each finalize
- Deleted linear clears selection and child table
- x-overlap test: `a[0] < b[1] && a[1] > b[0]`

---

## EX2

### EX2 [COMPLETED] Spectrogram Example UI Refinement

**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
**Target file:** `examples/SpectrogramExample.jsx`

#### Objective

1. Move `FilterPanel` from spectrogram sidebar to waveform sidebar
2. Add `lowFreq`/`highFreq` float inputs that control the spectrogram y-axis domain (visible frequency band)
3. Display both bounds explicitly with a validity indicator

#### Implementation

- `FilterPanel` removed from spectrogram sidebar (which now holds only `HistogramLUTPanel`).
- Waveform row changed from a bare canvas panel to a flex row: canvas (flex:1) + sidebar (width:180).
- Sidebar contains: frequency band section (Low/High `<input type="number" step="0.1">` inputs, validity display, "Reset to full" button) + `FilterPanel` + "Clear DSP Filter" button.
- React state: `lowFreq` (default 0), `highFreq` (default SAMPLE_RATE/2).
- `useEffect` on `[lowFreq, highFreq]` validates range and calls `yAxisRef.current.setDomain([lo, hi])`, sets `dirtyRef.current = true`.
- File load resets both bounds to `[0, sr/2]` for the newly loaded file.
- Note: SpectrogramLayer uses raw PCM — `filterByDomain` pattern from the spec maps to directly setting the y-axis domain (equivalent visible-domain filter for the spectrogram panel).

#### Validation

- Changing bounds zooms the spectrogram frequency axis
- Invalid range (lo >= hi) does not apply
- Domain values shown as "lo.f – hi.f Hz" in green; red when invalid
- FilterPanel and Clear DSP Filter operate independently on PCM data

---

## EX3

### EX3 [COMPLETED] Rolling Lines — Deterministic Waves

**Completed:** 2026-02-22 | **Branch:** feature/example-improvements
**Target files:** `examples/LineExample.jsx`, `examples/RollingLineExample.jsx`

#### Objective

Replace random data with deterministic sin/cos waves with vertical offsets, confirming rolling expiration is visually meaningful.

#### Implementation — LineExample.jsx

- Removed `walkState` and `generateWalkSamples`.
- Added `generateWaveSamples(signalIndex, startSample, count)`: uses `(startSample + i) * TIME_STEP` (TIME_STEP = 2π/200 → one cycle per 200 samples); even index → sin, odd → cos; `offset = i * (2 * AMPLITUDE + SPACING)` with AMPLITUDE=1, SPACING=3.
- `doTick` calls `ctrl.trimBefore(ctrl.xCounter - WINDOW_SAMPLES)` (WINDOW_SAMPLES=5000) for rolling expiration via `LinePlotController.trimBefore()`.
- Initial y-domain set to `[-1.5, 11.5]` to accommodate all three offset bands.
- Removed unused `React` import (new JSX transform).

#### Implementation — RollingLineExample.jsx

- Removed `makeSineNoiseGen` (had random phase + noise).
- Added `generateWaveSamples(signalIndex, xBase, count)`: uses wall-clock time as x → `t = xBase + i * dt`; FREQ=0.4 Hz; same amplitude/offset formula.
- `doTick` simplified: y-domain computed analytically from offsets instead of scanning path arrays. Rolling via existing `ctrl.trimBefore(xWindowMin)` call.
- Removed `ctrl._signals` internal scan.

#### Validation

- Waves clearly sin/cos (not noise), non-overlapping
- Rolling expiration visible: left edge advances each tick after WINDOW_SAMPLES/WINDOW_SECS
- Append interval unchanged (1s / 200ms respectively)

---

## F19 [COMPLETED] Cascading ROI Update + Conditional Child Versioning

**Branch:** `feature/F19`
**Completed:** 2026-02-24

### Problem

When a parent ROI (e.g. LinearRegion) was dragged, its children received constraint-adjusted bounds via `ConstraintEngine.enforceConstraints` but:
- Did NOT emit `roiUpdated` — so event log / tables never showed child movement
- Did NOT bump version on mouseup — so versioning model (F14) was incomplete
- Did NOT emit `roiFinalized` — breaking PlotDataView dirty propagation and external adapters

### Solution

**ConstraintEngine** (`src/plot/ROI/ConstraintEngine.js`):
- `enforceConstraints(parent, delta, visited)` replaced by:
  - Public `applyConstraints(parent, delta = {dx:0,dy:0}) → Set<ROIBase>`
  - Internal `_applyRecursive(parent, delta, visited, changed)` accumulates changed ROIs
- Before applying shift/clamp to each child, bounds are snapshotted
- After applying, bounds are compared (numeric); if different, child is added to the returned `Set`
- `onUpdate` still emitted on child for any future render-layer listeners

**ROIController drag phase** (`_onMouseMove`):
- Replaced `enforceConstraints(roi, delta)` with `const changed = applyConstraints(roi, delta)`
- After emitting `roiUpdated` for the active ROI, iterates `changed` and emits `roiUpdated` for each child

**ROIController mouseup phase** (`_onMouseUp`):
- After bumping the active ROI's version and emitting `roiFinalized`, walks all descendants via `roi.walkChildren(child => ...)`
- For each descendant, compares current bounds (`child.x1/x2/y1/y2`) against committed domain snapshot (`child.domain.x/y`)
- If any coordinate differs: calls `child.bumpVersion()` and emits `roiFinalized` with full versioned payload
- Guard: `d.y ? ... : false` handles LinearRegion children whose domain has no y field

### Acceptance Criteria Met

- Child ROIs emit `roiUpdated` live during parent drag ✅
- Version increments only when bounds actually changed ✅
- No false-positive bumps ✅
- PlotDataView dirty propagation correct (roiFinalized triggers markDirty) ✅

---

## F20 [COMPLETED] Feature: LineROI (Vertical/Horizontal + Half Variants + Labels)

**Branch:** `feature/F20`
**Completed:** 2026-02-24

### New File

`src/plot/ROI/LineROI.js` — extends `ROIBase`.

### Supported Modes

| Mode              | Geometry                        |
| ----------------- | ------------------------------- |
| vline             | Full height vertical line        |
| hline             | Full width horizontal line       |
| vline-half-top    | Vertical — midpoint → top        |
| vline-half-bottom | Vertical — bottom → midpoint     |
| hline-half-left   | Horizontal — left → midpoint     |
| hline-half-right  | Horizontal — midpoint → right    |

### Properties

```
orientation: 'vertical' | 'horizontal'
mode:        string (one of the 6 modes above)
position:    number  (data coordinate on primary axis)
label:       string | null  (max 25 chars; half variants only)
```

### ROIBase bounds sync

`_syncBoundsFromPosition()` — writes `position` into x1/x2 (vertical) or y1/y2 (horizontal) so ConstraintEngine can operate without special-casing LineROI.

`_syncPosition()` — writes the (possibly clamped) x1/y1 back into `position`. Called by ConstraintEngine after any clamp, and by ROIController after parent-upward clamping.

### Versioning

`bumpVersion()` override — domain stores `{ x: [position, position] }` (vertical) or `{ y: [position, position] }` (horizontal).

### Interaction

- Created with `V` key (vertical) or `H` key (horizontal) — single click sets position.
- Auto-parented: vertical LineROI inside a LinearRegion is parented and x-constrained.
- Draggable along primary axis; not resizable.
- `hitTest()` — returns `'move'` if pointer within 8 px of line.
- `applyDelta()` — restores-and-reapplies pattern; vertical uses `x1 + dx`, horizontal uses `y1 + dy`.

### Label Rendering

- Labels only rendered for half-variant modes.
- Drawn on the 2D canvas overlay by `AxisRenderer._renderLineROILabels()` — NOT in WebGL.
- Positioned near the tip (open end of the half-line), centered perpendicular to the line.
- Dark stroke behind text for readability over plot content.

### Serialization

```json
{ "id": "...", "type": "lineROI", "orientation": "vertical", "mode": "vline-half-bottom",
  "position": 42.5, "label": "P", "version": 3, "updatedAt": 1234567890, "domain": { "x": [42.5, 42.5] } }
```

`serialize()` instance method added to LineROI; `ROIController.serializeAll()` calls `roi.serialize()` when present.

### Files Modified

| File | Change |
|---|---|
| `src/plot/ROI/LineROI.js` | **NEW** — full LineROI implementation |
| `src/plot/ROI/ConstraintEngine.js` | Call `child._syncPosition?.()` after any clamp |
| `src/plot/ROI/ROIController.js` | Import LineROI; V/H keys; `createVLine`/`createHLine` modes; `_handleLineROICreationClick`; `_findLineROIParent`; `_hitTest` handles `lineROI`; `_roiFromSerialized` handles `lineROI`; `serializeAll` calls `roi.serialize()` if present; `updateFromExternal` syncs position/label/mode for LineROI; parent-clamp position sync |
| `src/plot/layers/ROILayer.js` | `plotXMin`/`plotXMax` props; LineROI rendering via PathLayer; selected-state handle dot |
| `src/plot/axes/AxisRenderer.js` | `render(rois=[])` signature; `_renderLineROILabels()` |
| `src/plot/PlotController.js` | Pass `plotXMin`/`plotXMax` to ROILayer; pass `rois` to `axisRenderer.render()` |
| `examples/ExampleApp.jsx` | V/H key hints in header and JSX doc comment |
| `examples/HubPage.jsx` | Updated Scatter/ROI card description |
| `README.md` | LineROI section; architecture tree updated |

### Acceptance Criteria Met

- `V` creates vertical vline ✅
- `H` creates horizontal hline ✅
- Labels render on half-variants via canvas overlay ✅
- Versioning works (bumpVersion on mouseup, conditional for children) ✅
- Vertical LineROI alignment rule enforced (auto-parent to LinearRegion) ✅
- Mixed alignment rule: horizontal LineROI not parented to LinearRegion ✅

---

## F21 [COMPLETED] Feature: Axis Drag Scaling (Midpoint Zoom)

**Branch:** `feature/F20` (implemented on same branch)
**Completed:** 2026-02-24

### Goal

Allow the user to zoom a single axis by clicking and dragging in its gutter area (the margin region showing tick labels). Dragging zooms the domain centered on the axis midpoint using exponential scaling — the same math as wheel zoom but axis-independent.

### Behavior Table

| Axis | Drag Direction | Result   |
| ---- | -------------- | -------- |
| Y    | Down           | Zoom In  |
| Y    | Up             | Zoom Out |
| X    | Left           | Zoom In  |
| X    | Right          | Zoom Out |

### Files Modified

| File | Change |
|------|--------|
| `src/plot/axes/AxisController.js` | Added `scaleDomainFromMidpoint(factor)` |
| `src/plot/axes/AxisRenderer.js` | Added `getAxisHit(px, py) → 'x' \| 'y' \| null` |
| `src/plot/PlotController.js` | Axis drag state + `_handleAxisDragMove()` + wired into `_onMouseDown`/`_onMouseMove`/`_onMouseUp` |

### Implementation Details

**`AxisController.scaleDomainFromMidpoint(factor)`**
- `factor > 1` = zoom in (domain shrinks); `factor < 1` = zoom out (domain expands)
- Linear: `mid = (min+max)/2`, `newSpan = span/factor`, new domain `[mid-newHalf, mid+newHalf]`
- Log: operates in log10 space, same midpoint logic, converts back with `Math.pow(10, ...)`

**`AxisRenderer.getAxisHit(px, py)`**
- X-axis gutter: `py > pa.y + pa.height && px in [pa.x, pa.x+pa.width]` → `'x'`
- Y-axis gutter: `px < pa.x && py in [pa.y, pa.y+pa.height]` → `'y'`
- Otherwise: `null`

**`PlotController` axis drag flow**
- State: `_isAxisDragging`, `_axisDragAxis`, `_axisDragStart` (`{ x, y, xDomain, yDomain }`)
- `_onMouseDown`: checks `getAxisHit` before ROI / plot-area guards (gutters are outside plot area)
- `_handleAxisDragMove`: restore-and-reapply pattern to prevent float drift; `delta = axis==='x' ? -dx : dy`; `zoomFactor = Math.exp(delta * 0.01)`; emits `zoomChanged`
- `_onMouseUp`: clears axis drag state
- Axis drag and plot pan are mutually exclusive (return early in `_onMouseMove`)

### Acceptance Criteria Met

- Dragging on X-axis gutter zooms X domain only ✅
- Dragging on Y-axis gutter zooms Y domain only ✅
- Dragging inside plot area still pans (unaffected) ✅
- Linear and log scales both handled correctly ✅
- No GPU buffer mutation ✅
- `zoomChanged` event emitted with `{ factor, axis }` ✅
- Float-drift prevented via restore-and-reapply pattern ✅

---

## EX5 [COMPLETED] Example: Geophysics / Seismography

**Branch:** `feature/EX5`
**Completed:** 2026-02-25

### Goal

Demonstrate MasterPlot in a seismography context: 10 stacked channels with
shared X-axis and per-channel P-wave picks managed through a React table.

### Files created / modified

| File | Action |
|------|--------|
| `examples/SeismographyExample.jsx` | Created — main React component |
| `src/seismography.js` | Created — webpack entry point |
| `public/seismography.html` | Created — HTML template |
| `webpack.config.js` | Modified — added `seismography` entry + HtmlWebpackPlugin |
| `examples/HubPage.jsx` | Modified — added Seismography card |
| `README.md` | Modified — EX5 section + file list update |

### Architecture

- **10 PlotCanvas instances** — each backed by its own `DataStore` with a pre-generated
  sin-wave signal (`y_i = sin(2π·freq_i·t + phase_i)`).
- **Independent Y-axis** per channel (`[-1.5, 1.5]`); distinct colour per channel.
- **Shared X-domain** via `domainChanged` event cross-propagation:
  `ctrl.on('domainChanged', ({ xDomain }) => others.forEach(o => o.xAxis.setDomain(xDomain)))`.
  A `syncingRef` boolean prevents infinite loops.
- **vline-half-bottom LineROI** seeded on each channel after all 10 controllers are
  ready (detected via `initCount.current === NUM_PLOTS`).

### Sidebar table

| Column | Source | Update trigger |
|--------|--------|----------------|
| Station | static label array | — |
| Label | `roi.label` | `roiFinalized` or edit submit |
| Pos (s) | `roi.position` | `roiFinalized` or edit submit |

- Inputs use `defaultValue` + `key={plotIndex-version}` so they re-mount with
  fresh values when the drag-committed version changes.
- Edit commit calls `updateFromExternal({ ...roi.serialize(), label/position, version: roi.version + 1 })`.
- React owns no geometry; `tableRows` is a display cache only.

### Signal parameters

| Plot i | freq_i (Hz) | phase_i (rad) | colour |
|--------|-------------|---------------|--------|
| 0 | 0.50 | 0.0 | `rgb(0,220,255)` |
| 1 | 0.65 | π/5 | `rgb(0,200,220)` |
| … | … | … | … |
| 9 | 1.85 | 9π/5 | `rgb(140,80,240)` |

2000 points per channel, t ∈ [0, 10 s].

### Acceptance criteria

- 10 signals render ✅
- Shared X zoom/pan ✅
- Independent Y axes ✅
- Vlines draggable ✅
- Table edits sync correctly ✅
- Version increments correct ✅
- No performance regression ✅

---

## EX6 [COMPLETED] ROI Table Double-Click Selection

**Branch:** `feature/EX6`
**Completed:** 2026-02-26
**Type:** Example Only (`examples/ExampleApp.jsx`)

### Problem

The LinearRegion table required a single-click to filter the RectROI table, with no way to highlight an ROI on the plot from the table.

### Solution

#### Engine change (minimal)
- `ROIController.serializeAll()` — enriched each entry with `parentId: roi.parent?.id ?? null` so RectROI rows know their parent without a secondary lookup.

#### ExampleApp.jsx additions
- **New state:** `plotSelectedLinearId`, `plotSelectedRectId` (+ matching refs `plotSelectedLinearIdRef`, `plotSelectedRectIdRef`) to track which rows carry the "plot-selected" double-click highlight independently from the single-click filter state.
- **`handleDoubleClickLinear(id)`** — always sets the filter to `id` (never toggles), calls `rc._selectOnly(roi)` + `rc.emit('roisChanged', ...)` to highlight on plot, sets `plotSelectedLinearId = id`.
- **`handleDoubleClickRect(id, parentId)`** — calls `rc._selectOnly(roi)` + `rc.emit('roisChanged', ...)` for the rect; sets `plotSelectedRectId = id`; auto-sets `selectedLinearId = parentId` (with child rect recompute) so the parent row is highlighted in the filter table too.
- **`refreshROITables`** — clears stale `plotSelectedRectId` on deletion; clears `plotSelectedLinearId` when its linear is deleted.
- **LinearRegion row:** `onDoubleClick` handler; `outline: '1px solid #4f4'` when `isPlotSelected`.
- **RectROI row:** `onDoubleClick` handler; `background: '#2a1a1a'` + `outline: '1px solid #f88'` when `isPlotSelected`; `cursor: 'pointer'`.
- Header hints updated: "click to filter · dbl-click to select on plot" / "dbl-click to select on plot".

### Acceptance Criteria — verified
- ✅ Double-clicking a LinearRegion row selects as filter AND highlights on plot (green outline)
- ✅ Double-clicking a RectROI row selects the rect on plot (red outline) AND auto-selects parent linear in filter table
- ✅ Single-click on LinearRegion rows continues to filter rect table unchanged
- ✅ No engine changes beyond adding `parentId` to `serializeAll()`
- ✅ No stale-closure issues (all cross-render state read via refs)

---

## ARCH-C [COMPLETED] ROILayer Internal Decomposition

**Branch:** `feature/ARCH-C`
**Completed:** 2026-03-01

**Goal:** Split the monolithic `renderLayers()` method in `src/plot/layers/ROILayer.js` into four focused private helpers. Pure internal refactor — external API (props, `defaultProps`, `layerName`) is unchanged.

**Files changed:** `src/plot/layers/ROILayer.js` only.

**Extracted methods:**

- `_buildCoordHelpers(props)` — builds `toX`/`toY` transform functions and pre-computes `deckXMin`/`deckXMax`/`deckYMin`/`deckYMax` from `plotXMin/Max`/`plotYMin/Max` and log-scale flags.
- `_buildLinearRegionLayers(roi, coords)` — returns `[PolygonLayer, PathLayer]` (fill + left/right edge lines) for a `linearRegion` ROI.
- `_buildLineROILayers(roi, coords)` — returns `[PathLayer]` (+ optional `ScatterplotLayer` handle when selected) for a `lineROI`.
- `_buildRectROILayers(roi, coords)` — returns `[PolygonLayer]` (+ optional `ScatterplotLayer` handles when selected) for a `rectROI`.

**Modified `renderLayers()`:**
```js
renderLayers() {
  const rois = this.props.rois || [];
  if (rois.length === 0) return [];
  const coords = this._buildCoordHelpers(this.props);
  const layers = [];
  for (const roi of rois) {
    if (!roi.flags.visible) continue;
    if (roi.type === 'linearRegion') layers.push(...this._buildLinearRegionLayers(roi, coords));
    else if (roi.type === 'lineROI') layers.push(...this._buildLineROILayers(roi, coords));
    else                             layers.push(...this._buildRectROILayers(roi, coords));
  }
  return layers;
}
```

**Acceptance criteria verified:**
- ✅ Build succeeds with zero errors (`webpack 5 compiled with 3 warnings` — pre-existing size warnings only)
- ✅ All sublayer ids are unchanged (embed `roi.id`), so no picking regressions
- ✅ No consumer code changes required

---

## ARCH-A [COMPLETED] PlotController Pluggable Data Layers

**Branch:** `feature/ARCH-A`
**Completed:** 2026-03-01

### Goal

Replace the hardcoded `buildScatterLayer` call inside `PlotController._render()` with a user-extensible registry of data layer factories, while keeping backwards compatibility (scatter still renders by default).

### Files Changed

- `src/plot/PlotController.js`

### What Was Built

#### DataLayerDef / RenderContext JSDoc typedefs

Added immediately before the `PlotController` class declaration:

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

#### Constructor changes

Added `_dataLayerDefs` Map and default scatter registration (with opt-out):

```js
this._dataLayerDefs = new Map();
if (!opts.disableDefaultDataLayer) {
  this.registerDataLayer('default-scatter', (ctx) => {
    if (ctx.gpuAttrs.x.length === 0) return null;
    return buildScatterLayer(ctx.gpuAttrs, {
      dataTrigger: ctx.dataTrigger,
      xIsLog:      ctx.xIsLog,
      yIsLog:      ctx.yIsLog,
    });
  });
}
```

Also added `disableDefaultDataLayer` to the constructor JSDoc.

#### Public API

```js
/** Register or replace a data layer factory. */
registerDataLayer(id, buildFn, props = {}) { ... }

/** Remove a registered layer by id. No-op if not found. */
unregisterDataLayer(id) { ... }

/** Update static props for an already-registered layer. */
updateDataLayerProps(id, props) { ... }
```

#### Modified `_render()`

```js
const layers = [];
const context = {
  gpuAttrs,
  dataTrigger: this._dataTrigger,
  xIsLog,
  yIsLog,
  xDomain: [xMin, xMax],
  yDomain: [yMin, yMax],
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

### Acceptance criteria verified

- ✅ Build passes with zero errors
- ✅ All existing examples render scatter correctly (default-scatter auto-registered)
- ✅ `disableDefaultDataLayer: true` option available for ARCH-D migration
- ✅ No existing public method signatures changed
- ✅ Insertion order of `_dataLayerDefs` Map matches deck.gl layer stack order

---

## ARCH-D [COMPLETED] SignalDataLayer + LinePlotController Retirement

**Branch:** `feature/ARCH-D`
**Completed:** 2026-03-01

### Goal

Retire `LinePlotController` by extracting its signal-management logic into a standalone `SignalStore` class and a `buildSignalLayers()` function. Migrate all three consumers (`LineExample.jsx`, `RollingLineExample.jsx`, `SeismographyExample.jsx`) to use `PlotController` + `SignalStore` via the ARCH-A pluggable layer registry. Delete `LinePlotController.js`.

### Files Changed

| File | Change |
|------|--------|
| `src/plot/layers/SignalDataLayer.js` | New: `SignalStore` class + `buildSignalLayers()` |
| `src/plot/LinePlotController.js` | Deleted |
| `examples/LineExample.jsx` | Migrated to `PlotController` + `SignalStore` |
| `examples/RollingLineExample.jsx` | Migrated to `PlotController` + `SignalStore` |
| `examples/SeismographyExample.jsx` | Migrated to `PlotController` + `SignalStore` |

### SignalStore API

```js
const signals = new SignalStore();
signals.addSignal(id, color)                    // register named signal with RGBA color
signals.getSignal(id)                           // direct access for static path building
signals.appendSignalData(id, yValues, xBase)    // append y-values; x = xBase + i
signals.advanceXCounter(n)                      // advance shared x index
signals.trimBefore(xMin)                        // rolling expiration (binary search)
signals.expandDomains()                         // returns { xDomain: [0, xMax], yDomain }
signals.getPointCount()                         // total path points across all signals
signals.reset()                                 // clear data, reset xCounter
signals.toLayerDef()                            // returns { id, build } for registerDataLayer
signals.xCounter                               // current shared x position (getter)
```

### Integration Pattern

```js
const signals = new SignalStore();
const ctrl    = new PlotController({ ..., disableDefaultDataLayer: true });
ctrl.registerDataLayer('signals', signals.toLayerDef().build);

signals.addSignal('a', [255, 100, 100, 255]);
signals.appendSignalData('a', yValues, xBase);
signals.trimBefore(xMin);
const { xDomain, yDomain } = signals.expandDomains();
ctrl.xAxis.setDomain(xDomain);   // sets dirty via _wireEvents
ctrl.yAxis.setDomain(yDomain);
```

### SeismographyExample Migration Notes

- Separate `ROIController` dropped — use `ctrl.roiController` (built into PlotController)
- `ctrl._onMouseDown` monkey-patch removed — `PlotController._onMouseDown` already yields to ROI
- `axisRenderer.render()` monkey-patch removed — `PlotController._render()` already calls `axisRenderer.render(rois)` which handles LineROI labels via `_renderLineROILabels()`
- `_drawROILines` canvas drawing function removed — `ROILayer._buildLineROILayers()` handles WebGL rendering
- X-domain sync via `domainChanged` + syncingRef guard (MEMORY.md pattern); no infinite-loop risk
- `panMode: 'drag'` explicitly set to match LinePlotController behavior
- Static signal path built via `signals.getSignal('s')` before `ctrl.init()`
- ROI events accessed via `ctrl.on('roiFinalized', ...)` and `ctrl.roiController.updateFromExternal()`

### Acceptance Criteria

- ✅ Build passes zero errors
- ✅ `LineExample` — 3 sin/cos signals render, rolling window trims, reset restarts, zoom/pan works
- ✅ `RollingLineExample` — 30s wall-clock rolling window, pause/resume, expiry log
- ✅ `SeismographyExample` — 50 stacked channels, shared X-axis sync, P-wave LineROI picks draggable, table editable via `updateFromExternal()`
- ✅ `LinePlotController.js` deleted; no runtime imports remain

---

## ARCH-B [COMPLETED] PlotLayer CompositeLayer

**Branch:** `feature/ARCH-B`
**Completed:** 2026-03-01

### Goal

Wrap all registered data layers and the ROILayer in a single `PlotLayer` CompositeLayer so the deck.gl layer list is a single composable unit. Gated behind `opts.usePlotLayer` so existing examples are unaffected.

### Files Changed

- `src/plot/layers/PlotLayer.js` (new, ~25 lines)
- `src/plot/PlotController.js` — import `PlotLayer`; `_render()` branches on `this._opts.usePlotLayer`

### Implementation Notes

- `PlotLayer extends CompositeLayer` with `renderLayers()` returning `[...dataLayers, roiLayer]`.
- `defaultProps` uses deck.gl typed descriptor objects (`{ type: 'array', value: [] }`, `{ type: 'object', value: null, optional: true }`).
- `_render()` builds `roiLayer` first, then either wraps in `PlotLayer` (flag on) or spreads flat (flag off — default).
- SubLayer id namespacing: CompositeLayer prefixes sublayer ids with the parent id. No consumer code inspects layer ids by string, so this is safe.

### Acceptance Criteria

- ✅ Build passes zero errors
- ✅ All examples render correctly with default flag-off path (flat layer array unchanged)
- ✅ `opts.usePlotLayer: true` produces a single-element `layers` array wrapping all content

---

## F22

### F22 — TraceGroup Abstraction

**Type:** Engine Primitive — `src/plot/layers/TraceGroup.js`
**Branch:** `feature/F22-EX7`
**Completed:** 2026-03-01

Generic multi-trace data layer. Partitions bulk data by a tag field into per-tag typed-array buffers in one O(n) pass. Resolves per-trace attributes (color, opacity, user-defined) via palette cycling + per-tag overrides. Plugs into `PlotController` via `registerDataLayer` using `.toLayerDef().build`. Layer-type agnostic: caller provides `buildLayer(traceId, traceData, attrs, ctx)` callback.

### Constructor

```js
new TraceGroup({
  palette,      // Array<[R,G,B,A]> — cycled by trace insertion order (required)
  traceAttrs,   // { [tag]: { color?, opacity?, ...userFields } } — per-tag overrides (optional)
  defaultAttrs, // { opacity?, size?, ...userFields } — global defaults (optional)
  buildLayer,   // (traceId, traceData, attrs, ctx) => deck.gl Layer | null (required)
})
```

### Internal Per-Trace Structure (TraceEntry)

```js
{
  x:              Float32Array,
  y:              Float32Array,
  size:           Float32Array,
  count:          number,         // live point count
  capacity:       number,         // doubles on overflow
  version:        number,         // bumped on appendData; drives deck.gl updateTriggers
  visible:        boolean,        // default true
  insertionIndex: number,         // stable index for palette cycling
}
```

### Public API

| Method | Description |
|--------|-------------|
| `appendData({ x, y, tag, size? })` | Bulk append O(n); doubling buffer growth; bumps version per trace |
| `setTraceVisible(tag, bool)` | Show/hide trace |
| `getTraceVisible(tag)` | Returns visibility bool |
| `setTraceAttr(tag, attrs)` | Merge per-tag attr overrides post-construction |
| `setPalette(palette)` | Replace palette (no remap of existing tags) |
| `getAllTags()` | Tags in insertion order |
| `getTrace(tag)` | Raw TraceEntry (advanced use) |
| `resolveAttrs(tag)` | Merged attrs (palette + overrides + defaults) |
| `toLayerDef()` | Returns `{ id, build }` for `registerDataLayer` |

### Attribute Resolution Priority (highest wins)

1. `traceAttrs[tag]` field
2. Palette color by `insertionIndex % palette.length`
3. `defaultAttrs` field
4. Library defaults: `{ opacity: 1.0, size: 4.0, color: [255,255,255,255] }`

### Implementation Notes

- No `EventEmitter` — `PlotController` polls `build()` every RAF tick
- `insertionIndex = this._traces.size` at first-seen time (stable)
- Buffer doubling mirrors `DataStore._grow()`

---

## EX7

### EX7 — Multi-Sensor Scatter Example

**Depends on:** F22
**Type:** Example — `examples/MultiSensorExample.jsx`
**Branch:** `feature/F22-EX7`
**Completed:** 2026-03-01

50 sensors × 10k points each (500k total). 25-color OKLAB-derived palette cycling so sensors 25–49 reuse slots 0–24. Scrollable sidebar with per-sensor visibility checkboxes + color swatches. "Show All" / "Hide All" bulk controls. All point data at module level — React owns zero arrays.

### Data Setup

- Tags: `sensor_0` … `sensor_49`; 10,000 points per sensor
- x: uniform `[0, 1000]`, y: uniform `[0, 100]`; LCG pseudo-random for reproducibility
- Generated once at module level (`let _traceGroup = null`; lazy init on first `onInit`)
- Single bulk `appendData({ x: allX, y: allY, tag: allTags })` call

### Palette

`PALETTE_25` — 25 RGBA colors hardcoded at top of `MultiSensorExample.jsx`, covering the hue wheel with high contrast on dark background.

### UI Layout

```
┌──────────────────────────────────────────────────────┐
│  "Multi-Sensor Scatter — 50 sensors × 10k pts each"  │
├───────────────────────────────┬──────────────────────┤
│  PlotCanvas (flex: 1)         │  Sidebar (240px)      │
│                               │  [Show All][Hide All] │
│  50 colored scatter layers    │  scrollable list:     │
│                               │  ☑ sensor_0  ████    │
│                               │  ☑ sensor_1  ████    │
│                               │  ☐ sensor_2  ████    │
└───────────────────────────────┴──────────────────────┘
```

### Files Created/Modified

| File | Action |
|------|--------|
| `src/plot/layers/TraceGroup.js` | Created (F22 engine primitive) |
| `examples/MultiSensorExample.jsx` | Created |
| `src/multi-sensor.js` | Created (webpack entry) |
| `public/multi-sensor.html` | Created |
| `webpack.config.js` | Added multi-sensor entry + HtmlWebpackPlugin |
| `examples/HubPage.jsx` | Added EX7 card |
| `README.md` | Added TraceGroup API section + EX7 section |

### Acceptance Criteria

- ✅ Build passes zero errors
- ✅ 500k points rendered via 50 ScatterplotLayer instances
- ✅ 25-color palette cycles correctly at sensor_25
- ✅ Toggle checkbox → trace visibility toggles on next RAF frame
- ✅ "Hide All" → empty canvas; "Show All" → all 50 traces return
- ✅ Zoom/pan works normally
- ✅ HubPage card links to `multi-sensor.html`
- ✅ README documents TraceGroup constructor + public API

---

## EX8

### EX8 [COMPLETED] Live Signal Analysis (Merge Line Examples)

**Completed:** 2026-03-01 | **Branch:** feature/EX8

**Goal:** Replace the redundant `LineExample` and `RollingLineExample` (near-identical 3-signal demos, neither with ROI) with a single unified **Live Signal Analysis** page.

**Files deleted:**
- `examples/LineExample.jsx`, `examples/RollingLineExample.jsx`
- `src/line.js`, `src/rolling-line.js`
- `public/line.html`, `public/rolling-line.html`

**Files created:**
- `examples/LiveSignalsExample.jsx` — unified replacement
- `src/live-signals.js` — entry point
- `public/live-signals.html` — shell (title: `MasterPlot — Live Signal Analysis`)

**Files modified:** `webpack.config.js`, `examples/HubPage.jsx`, `README.md`

**Implementation notes:**
- Layout: header / (plot canvas flex:1 + 220 px stats sidebar) / event log (last 25 entries)
- Wall-clock X-axis; three deterministic sin/cos signals (A/B/C); `windowSecsRef` mirrors state so dropdown changes take effect without re-mount
- Rolling trim via `signals.trimBefore(xWindowMin)` each tick
- ROI stats computed by filtering `signals.getSignal(id).path` for points with `x ∈ [roi.x1, roi.x2]`; mean, RMS (√(Σy²/n)), peak-to-peak (max−min), count; `—` when count = 0
- `roiUpdated` debounced 100 ms inline with `setTimeout`; `roiDeleted` clears sidebar only when no LinearRegion remains
- Stats re-run at end of each tick while a LinearRegion exists
- **Bug fix:** ROI bounds live directly on the object as `roi.x1`/`roi.x2` — not on a `roi.bounds` sub-object (ROIBase stores them as top-level properties)
- No engine files modified

**Acceptance criteria verified:**
1. `npm run build` passes zero errors ✅
2. `live-signals.html` emitted; three signals scroll on wall-clock X-axis ✅
3. Window dropdown changes rolling window without page reload ✅
4. L key → LinearRegion; stats sidebar populates immediately ✅
5. Stats update live each tick while ROI is active ✅
6. D key → ROI removed; stats panel reverts to placeholder ✅
7. Pause/Resume toggles append ✅
8. `dist/line.html` and `dist/rolling-line.html` absent from build output ✅
9. HubPage: new card present, old cards gone ✅
10. README updated ✅

---

## EX9 [COMPLETED] Spectrogram Overhaul

**Branch:** `feature/EX9`
**Completed:** 2026-03-01

### Overview

Six targeted improvements to the spectrogram page and its supporting engine modules:

1. Remove the "Freq Band" display-only filter (EX9-1)
2. Per-filter-type DSP input UI — single cutoff+Q for lowpass/highpass; dual low/high sliders with computed center+Q for bandpass/notch (EX9-2)
3. Auto-zoom spectrogram y-axis to filtered frequency range after Apply; restore full range on Clear (EX9-3)
4. Pluggable FFT window functions via `fft-windowing` npm; `SpectrogramLayer.windowFn` prop; `rectangular` skips windowing (EX9-4)
5. Preset sound file loading via dropdown in header; 4 WAV files from `/sounds`; `CopyWebpackPlugin` copies to `dist/sounds/`; shared `loadAudioBuffer` helper (EX9-5)
6. LUT level handle clamping fix — `HistogramLUTController.setSpectrogramData` clamps `level_min`/`level_max` to new `[globalMin, globalMax]` and emits `levelsChanged` only if actually clamped (EX9-6)

### Files Modified

| File | Change |
|------|--------|
| `examples/SpectrogramExample.jsx` | Remove freq band UI + state + useEffect; add `windowFn` state/ref + dropdown; add `PRESET_SOUNDS` + `handlePresetLoad`; extract `loadAudioBuffer` shared helper; y-axis auto-zoom in `handleApplyFilter` / restore in `handleClearFilter` |
| `src/audio/FilterController.js` | Add `lowFreq`/`highFreq` state; `setLowHighFreq()` (geometric-mean center + bandwidth Q); remove `allpass`; `setType()` resets to sensible defaults per type |
| `src/components/FilterPanel.jsx` | Type-aware layout: lowpass/highpass = single cutoff slider + Q; bandpass/notch = two frequency sliders + read-only center/Q; dual orange dashed markers on frequency-response canvas |
| `src/plot/layers/SpectrogramLayer.js` | `import * as fftWindowing from 'fft-windowing'`; `windowFn` prop (default `'hann'`); `computeSTFT` copies frame buffer then calls `fftWindowing[windowFn](frame)` (skipped for `'rectangular'`); `updateState` triggers STFT recompute on `windowFn` change |
| `src/plot/layers/HistogramLUTController.js` | `setSpectrogramData` clamps `level_min`/`level_max` to `[globalMin, globalMax]`; emits `levelsChanged` only when clamping actually occurred |
| `webpack.config.js` | `CopyWebpackPlugin` added; copies `sounds/` → `dist/sounds/` |
| `package.json` | `fft-windowing` runtime dep; `copy-webpack-plugin` dev dep |

### Implementation Notes

- `fft-windowing` exports named functions (`hann`, `hamming`, `blackman`, etc.) that mutate a `Float32Array` in-place and return the same array. There is no generic `windowFunction` export — use `import * as fftWindowing` and index by string.
- `'rectangular'` is not a `fft-windowing` export; the spec implementation skips window application when `windowFn === 'rectangular'`.

---

## EX4 [COMPLETED] Scatter Performance Dropdown

**Branch:** `main`
**Completed:** 2026-03-03

### Overview

Example-only change to `ExampleApp.jsx`: adds a point-count dropdown (10k / 100k / 1M / 5M / 10M) so the scatter example can be benchmarked at different data sizes. Default is 10k for fast initial load. No engine changes.

### Spec

**Default initial points:** 10,000

**Dropdown options:** 10,000 · 100,000 · 1,000,000 · 5,000,000 · 10,000,000

**On selection:**
1. Pause live append (`clearInterval`)
2. `controller.dataStore.clear()` — resets count/indices without de-allocating buffers
3. `controller.xAxis.setDomain([0, 10000])` + `controller.yAxis.setDomain([0, 100])` — reset to generator baseline so auto-expand starts clean
4. `controller.appendData(generatePoints(count))` — load new data; React holds only the integer `count`, no arrays
5. Resume live append if it was running

### Files Modified

| File | Change |
|------|--------|
| `examples/ExampleApp.jsx` | `POINT_COUNT_OPTIONS` constant; `pointCount` React state (integer only); `handlePointCountChange` handler; `<select>` control in header toolbar |

### Acceptance Criteria Verified

- Fast initial load at 10k ✅
- Clean re-render at 10M (GPU instanced, no GC spike) ✅
- No memory leaks — `dataStore.clear()` reuses existing buffers ✅
- React does not own large arrays — only `count: number` in state ✅

---

## F23

### F23 — Auto-Scale / Reset Zoom

**Completed:** 2026-03-03 | **Branch:** feature/F23-EX10

**Scope:** `src/plot/PlotController.js` — engine only.

**What was built:**
- `_homeDomain = { x: null, y: null }` and `_autoScaleKey = opts.autoScaleKey ?? ' '` added to constructor
- `_onKeyDown = null` placeholder in constructor; assigned and registered in `init()` after window resize listener
- Spacebar binding guards: `e.repeat`, `INPUT/TEXTAREA/SELECT` tag check, `e.key === this._autoScaleKey`
- `window.removeEventListener('keydown', this._onKeyDown)` cleanup in `destroy()`
- `autoScale()`: if both `_homeDomain.x` and `_homeDomain.y` are non-null → use directly; otherwise scan `DataStore.getLogicalData()` for min/max, add 5 % padding; no-op if 0 points; calls `_updateScales()`, sets `_dirty = true`, emits `'autoScaled'`
- `setHomeDomain(xDomain, yDomain)`: stores `{ x: xDomain ?? null, y: yDomain ?? null }`

**Acceptance criteria (all met):**
- Spacebar resets scatter example (`ExampleApp`) to full data extent ✅
- `ctrl.autoScale()` callable programmatically and emits `'autoScaled'` ✅
- `ctrl.setHomeDomain([0,10], [-1,1])` causes spacebar to restore those exact bounds ✅
- Spacebar is a no-op when focus is inside `<input>`, `<textarea>`, or `<select>` ✅
- Multiple PlotController instances each respond independently ✅
- No regression to existing zoom, pan, or ROI interactions ✅

---

## EX10

### EX10 — Spectrogram Axis Drag Zoom + Auto-Scale

**Completed:** 2026-03-03 | **Branch:** feature/F23-EX10

**Scope:** `examples/SpectrogramExample.jsx` — no engine changes.

**What was built:**
- `specAxisDragRef = useRef(null)` and `waveAxisDragRef = useRef(null)` added alongside existing refs
- **Spectrogram `onMouseDown`**: axis-hit check via `axisRendRef.current?.getAxisHit(pos.x, pos.y)` inserted BEFORE `isInPlotArea` guard; on hit: stores `{ axis, startX, startY, xDomain, yDomain }` in `specAxisDragRef.current` and returns early
- **Spectrogram `onMouseMove`**: reads `specAxisDragRef.current`; computes `delta = axis==='x' ? -dx : dy`; `factor = Math.exp(delta * 0.01)`; restore-and-reapply pattern; marks `dirtyRef.current = true`; returns early
- **Spectrogram `onMouseUp`**: clears both `specAxisDragRef.current = null` and `panRef.current = null`
- **Waveform panel**: identical pattern using `waveAxisDragRef`, `waveXAxisRef`, `waveYAxisRef`, `waveAxisRendRef`
- **Spacebar `onKeyDown`**: guards `e.repeat` and tag check; reads `loadedSampleRateRef.current` + `samplesRef.current.length`; no-op if `!dur`; sets both panels to `[0, dur]` × `[0, sr/2]` and `[0, dur]` × `[-1.1, 1.1]`; sets both dirty flags
- `window.addEventListener('keydown', onKeyDown)` inside mount `useEffect`; removed in cleanup return
- Header hint text updated to include `drag axis=zoom axis · space=reset zoom`

**Acceptance criteria (all met):**
- Drag on spectrogram X-axis gutter → zooms time axis (left=in, right=out) ✅
- Drag on spectrogram Y-axis gutter → zooms frequency axis (down=in, up=out) ✅
- Drag on waveform X-axis gutter → zooms time axis ✅
- Drag on waveform Y-axis gutter → zooms amplitude axis ✅
- Spacebar resets both panels to full range simultaneously ✅
- Spacebar is a no-op when no audio is loaded ✅
- Spacebar is a no-op when focus is inside `<input>`, `<textarea>`, or `<select>` ✅
- No regression to existing pan, wheel zoom, playhead, or filter interactions ✅

---

## ARCH-E

### ARCH-E [COMPLETED] BroadcastChannel Popup Window Infrastructure
**Completed:** 2026-03-06 | **Branch:** feature/ARCH-E

**Goal:** General-purpose infrastructure for spawning connected secondary browser windows from any MasterPlot page. Windows communicate bidirectionally via the browser's `BroadcastChannel` API. This enables panels (controls, labels, analysis) to be moved out of the main page to reduce clutter, while staying in sync with the plot.

**Scope:** Engine/utility only. No example UI changes in this track.

**New files created:**
- `src/popup/PopupWindowManager.js` — plain EventEmitter class; `open(url, channelName, windowFeatures)` opens popup via `window.open()`, creates `BroadcastChannel`, polls `popup.closed` every 500 ms, emits `'closed'` on detection; `send({ type, payload })` posts to channel; `close()` closes both popup and channel; `isOpen` getter; returns `false` from `open()` if blocked by browser popup blocker and logs a console warning; no React dependency.
- `src/popup/usePopupChannel.js` — React hook wrapping `PopupWindowManager`; `usePopupChannel(url, channelName, onMessage)` → `{ send, isOpen, open, close }`; manager created on mount, destroyed on unmount; `open()` is the trigger (not called automatically on mount); `onMessage` ref kept stable to avoid stale closure; BroadcastChannel listener removed and channel closed on unmount.
- `src/integration/BackendAdapter.js` — stub/comment-only file documenting the REST/WebSocket contract shape for a future server-side analysis adapter; no executable logic beyond export placeholder; documents transport-swap design (same `{ type, payload }` envelope works over BroadcastChannel or WebSocket); documents rolling-buffer integration path with DataStore.
- `examples/SpectrogramPopup.jsx` — React component for the popup host shell; reads `?panel=` and `?channel=` from URL; detects popup mode via `window.opener !== null || panel !== ''`; creates `BroadcastChannel(channelName)` when channel name provided and closes on unmount; `renderPanel()` switch routes to future panel components (F24 `filter`, EX11 `labels`); shows placeholder for unrecognized panel names.

**New webpack entry:**
- `src/spectrogram-popup.js` — entry point rendering `SpectrogramPopup`
- `public/spectrogram-popup.html` — HTML template (identical style to spectrogram.html)
- `webpack.config.js` — added `'spectrogram-popup'` entry + `HtmlWebpackPlugin` for `spectrogram-popup.html`

**Message protocol convention (all channels):**
```js
{ type: 'TYPE_NAME', payload: { ...data } }
```
Both sides must silently ignore unknown `type` values for forward-compatibility.

**Popup detection:** popup page detects it is secondary via `window.opener !== null` **or** the presence of a `?panel=` URL param. When detected, suppresses main-page chrome.

**Acceptance criteria (all met):**
- `PopupWindowManager` is a plain EventEmitter with no React imports ✅
- `open()` returns `false` and logs a warning when blocked by popup blocker ✅
- `usePopupChannel` cleans up channel and listeners on unmount ✅
- `spectrogram-popup.html` renders with no JS errors when loaded directly ✅
- `spectrogram-popup.html?panel=filter` shows "not yet implemented" placeholder ✅
- Webpack build passes zero errors ✅
- `BackendAdapter.js` documents the WebSocket transport-swap contract ✅

---

## EX11

### EX11 [COMPLETED] Spectrogram RectROI + Connected Label Popup

**Completed:** 2026-03-06 | **Branch:** feature/EX11

**Goal:** Add rectangular ROI drawing to the spectrogram panel and provide a connected popup window for listing, labeling, and navigating ROIs. Labels: `plane`, `bird`, `siren`.

**Spectrogram ROI specifics:**
- Uses existing `RectROI` with full versioning, serialization, and metadata — no new ROI types.
- No `LinearRegion` nesting; all RectROIs are top-level on the spectrogram.
- x-bounds: time in seconds; y-bounds: free-floating Hz values (not snapped to bins).
- Labels stored in `roi.metadata.label`.
- 'R' key / "Draw ROI" button enters creation mode; two clicks set top-left and bottom-right corners.
- ROI overlay rendered by `ROILayer` on the spectrogram deck.gl canvas.

**Files modified:**
- `examples/SpectrogramExample.jsx`:
  - Added `ROIController` + `ROILayer` imports.
  - Added `specRoiCtrlRef`, `zoomToSelectedRef`, `sendToLabelsRef` refs; `labelsEverOpened` state.
  - Added `usePopupChannel('spectrogram-labels')` with full message handler.
  - Mount useEffect: creates `ROIController(viewport)`, inits on spectrogram canvas, wires `roisChanged`/`roiCreated`/`roiSelected` events, added cleanup.
  - `renderFrame`: includes `ROILayer` in deck.gl layer array.
  - `onMouseDown`: guards against ROI creation mode and ROI hit before entering pan mode.
  - Header: "Draw ROI" button + "Open Label Panel" button.
- `examples/SpectrogramPopup.jsx`:
  - Added `LabelPanelPopup` component (ROI table, zoom-to-selected toggle, label dropdown, delete button).
  - Added `labelPanelStyles` constants.
  - `renderPanel` switch: added `case 'labels'`.

**BroadcastChannel messages (channel: `'spectrogram-labels'`):**

| Direction | Type | Payload |
|-----------|------|---------|
| Main → Popup | `ROIS_CHANGED` | `serializedROIs[]` |
| Main → Popup | `AUTO_SELECT` | `{ id }` |
| Popup → Main | `SELECT_ROI` | `{ id }` |
| Popup → Main | `SET_LABEL` | `{ id, label }` |
| Popup → Main | `DELETE_ROI` | `{ id }` |
| Popup → Main | `ZOOM_TOGGLE` | `{ enabled: bool }` |

**Verification:**
- ROI creation with 'R' key or "Draw ROI" button ✅
- ROI overlay renders on spectrogram (fill + border + handles) ✅
- Label popup opens via "Open Label Panel" button ✅
- ROI table updates live via ROIS_CHANGED ✅
- Row click → SELECT_ROI + optional zoom ✅
- Label dropdown → SET_LABEL ✅
- Delete button → DELETE_ROI ✅
- Auto-select on roiCreated/roiSelected ✅
- Pan is suppressed during ROI creation/drag ✅
- Webpack build passes zero errors ✅

---

## F25

### F25 [COMPLETED] Higher-Order Butterworth Filter (Cascaded Biquads)
**Completed:** 2026-03-06 | **Branch:** feature/F25

**Goal:** Replace the single-biquad filter with a properly designed higher-order Butterworth by cascading multiple `BiquadFilterNode`s inside the existing `OfflineAudioContext` pipeline. Add an "Order" selector (2 / 4 / 6 / 8) to `FilterPanel`.

**Files modified:**
- `src/audio/FilterController.js` — `order: 2` added to state; `setOrder(n)` (validates against `[2,4,6,8]`); `_butterworthQValues(order)` returns `Float32Array` of per-section Q values; `applyToSamples` cascades `Array.from(qs).map(...)` biquad nodes for lowpass/highpass (critical: must use `Array.from` since `Float32Array.map` returns a typed array, not an object array); `getFrequencyResponse` multiplies per-section linear magnitudes via `for...of` then converts to dB.
- `src/components/FilterPanel.jsx` — Order radio buttons (2/4/6/8) rendered for lowpass/highpass only, immediately above the cutoff slider section.
- `examples/SpectrogramExample.jsx` — `order` added to `buildFilterStateMsg` payload; receiver adds `if (msg.payload.order != null) fc.state.order = msg.payload.order`.
- `examples/SpectrogramPopup.jsx` — popup `onChange` includes `order: s.order` in `FILTER_STATE`; `FILTER_STATE` receiver syncs `fc.state.order`.
- `README.md` — Butterworth order sub-bullet appended to Per-type DSP filters row.

**Butterworth Q formula:** `Q_k = 1 / (2 * cos((2k − 1) * π / (2 * N)))` for `k = 1…N/2`

Spot-checks:
- order=2: [0.7071]
- order=4: [0.5412, 1.3066]
- order=6: [0.5176, 0.7071, 1.9319]
- order=8: [0.5098, 0.6013, 0.9000, 2.5629]

**Key bug fixed during implementation:** `Float32Array.prototype.map` returns a `Float32Array`, not an `Array`. Mapping over it to produce `BiquadFilterNode` objects silently coerces each node to `NaN`, making `source.connect(NaN)` throw `AudioNode.connect: Argument 1 is not valid`. Fixed by `Array.from(qs).map(...)`.

---

## DOC1

### DOC1 [COMPLETED] Documentation: Architecture Overview

**Goal:** A single-page docs SPA (`docs.html`) with a left-sidebar nav covering all four doc sections. DOC1 implements the infrastructure and the Architecture section content.

**New dev dependencies:**
```
npm install --save-dev mermaid prismjs
```

**New files:**
```
src/docs.js                            webpack entry; mounts <DocsPage />
public/docs.html                       HtmlWebpackPlugin template
examples/DocsPage.jsx                  shell: sticky left nav + <main> content area
examples/docs/shared/
  CodeBlock.jsx                        syntax-highlighted <pre> + copy-to-clipboard button
                                       (imports prismjs + prismjs/themes/prism-tomorrow.css)
  MermaidDiagram.jsx                   useEffect renders mermaid string → <svg> via mermaid.render()
  NavSidebar.jsx                       sticky nav; highlights active section via IntersectionObserver
examples/docs/ArchitecturePage.jsx     Section 1 content (6 subsections)
examples/docs/GettingStartedPage.jsx   placeholder <section> (content added in DOC2)
examples/docs/ApiReferencePage.jsx     placeholder <section> (content added in DOC3)
examples/docs/RoiDeepDivePage.jsx      placeholder <section> (content added in DOC4)
```

**Modified files:**
- `webpack.config.js` — added `docs` entry + `HtmlWebpackPlugin` for `public/docs.html`
- `examples/HubPage.jsx` — added "Documentation" card group (green accent, 4 cards) linking to `docs.html#architecture`, `docs.html#getting-started`, `docs.html#api-reference`, `docs.html#roi-deep-dive`

**ArchitecturePage.jsx content implemented:**
1. What is MasterPlot? — 2-paragraph intro (controller-driven, React-agnostic, WebGL rendering via deck.gl)
2. Mermaid `graph TD`: PlotController orchestration — PlotController at center; edges to AxisController×2, ViewportController, ROIController, DataStore, DataLayer Registry (→ ScatterLayer, SignalStore, TraceGroup), AxisRenderer, deck.gl Deck, ConstraintEngine
3. Mermaid `sequenceDiagram`: Render loop — RAF tick → expireIfNeeded → getData (if DataView) → _buildLayers via registry → deck.setProps → GPU draw
4. Mermaid `graph LR`: Event bus — which controllers emit which events; PlotController as relay to React
5. Coordinate systems — 3-column table (data/screen/deck.gl world space); Y-axis inversion explanation; flipY: false; pan sign convention with code block
6. Data flow prose + code block — appendData → DataStore Float32Array ring buffer → getGPUAttributes → layer accessors → deck.gl WebGL

**DocsPage layout:**
- Fixed 48px header bar with title + "← Back to hub" link
- 200px sticky left sidebar (NavSidebar) with IntersectionObserver-driven active highlight
- Scrollable `<main>` content area (max-width 900px, 48px padding)

**Build result:** `compiled with 2 warnings` (standard size warnings only, zero errors).

---

## DOC4

### DOC4 [COMPLETED] Documentation: ROI System Deep-Dive

**Completed:** 2026-03-07
**Branch:** feature/DOC4

**Goal:** Replace the placeholder `RoiDeepDivePage.jsx` with a complete, 6-section deep-dive on the ROI system.

**Modified files:**
- `examples/docs/RoiDeepDivePage.jsx` — full content replacing placeholder stub

**Content implemented:**

1. **Class hierarchy** — Mermaid `classDiagram`: `ROIBase → LinearRegion`, `ROIBase → RectROI`, `ROIBase → LineROI`; key property annotations per node (id/type/bounds, version/updatedAt/domain, orientation/mode/position/label, xLocked); property table with descriptions per class

2. **Creation modes table** — keyboard key (L/R/V/H/D/Escape) → ROI type → number of clicks → click semantics → auto-parent rule; note on programmatic creation via `roi.bumpVersion()` + `rc.addROI(roi)` + `roi.onCreate()`

3. **LineROI modes** — table of all 6 modes (`vline` / `hline` / `vline-half-top` / `vline-half-bottom` / `hline-half-left` / `hline-half-right`) with: orientation, rendered segment, label support, ASCII orientation sketch; callout on 25-char label cap and bounds convention (x1=x2=position for vertical, y1=y2=position for horizontal, ±Inf on the perpendicular axis)

4. **ConstraintEngine** — two Mermaid `sequenceDiagram`s:
   - *Drag (mouse-move)*: restore → applyDelta → applyConstraints(parent,delta) → shift+clamp children → `_syncPosition` for LineROI → emit `roiUpdated` for active ROI + each changed child
   - *Commit (mouse-up)*: bumpVersion on active ROI → `roiFinalized` → walkChildren → compare bounds vs domain snapshot → bumpVersion + `roiFinalized` only when changed
   - Callouts: restore-and-reapply pattern, xLocked children, `roiUpdated` vs `roiFinalized` distinction

5. **Versioning** — prose on monotonic counter; `domain` snapshot shape table per type; "what triggers a version bump" table (7 rows: drag mouseup/mid-drag/ROI creation/programmatic bumpVersion/updateFromExternal accepted|rejected/zoom-pan); `bumpVersion()` code sample showing programmatic creation pattern

6. **Serialization & external sync** — annotated `serializeAll()` output JSON example; `updateFromExternal()` version-gating table (3 rows: accepted/rejected/id-not-found); full round-trip code sample (serialize → localStorage → deserialize → updateFromExternal with version+1); warning callout on version discipline

**Build result:** Build passes zero errors.

---

## ARCH-F

### ARCH-F [COMPLETED] Project Restructure (src/ purity)
**Completed:** 2026-03-14 | **Branch:** feature/ARCH-F

**Goal:** `src/` contains only library code. Entry-point JS files and non-library React UI components move out.

**File moves:**

| From | To |
|---|---|
| `src/example.js` | `examples/src/example.js` |
| `src/docs.js` | `examples/src/docs.js` |
| `src/spectrogram.js` | `examples/src/spectrogram.js` |
| `src/spectrogram-popup.js` | `examples/src/spectrogram-popup.js` |
| `src/live-signals.js` | `examples/src/live-signals.js` |
| `src/multi-sensor.js` | `examples/src/multi-sensor.js` |
| `src/shared-data.js` | `examples/src/shared-data.js` |
| `src/index.js` | `examples/src/index.js` |
| `src/seismography.js` | `examples/src/seismography.js` |
| `src/components/FilterPanel.jsx` | `ui/FilterPanel.jsx` |
| `src/components/HistogramLUTPanel.jsx` | `ui/HistogramLUTPanel.jsx` |

`src/components/PlotCanvas.jsx` **stays** — it is library API code.

**`webpack.config.js`:** All `entry` paths updated from `./src/X.js` → `./examples/src/X.js`.

**Import path updates:**
- Each moved entry JS: `'../examples/X'` → `'../X'`
- `ui/FilterPanel.jsx`: `'../audio/FilterController.js'` → `'../src/audio/FilterController.js'`
- `ui/HistogramLUTPanel.jsx`: `'../plot/layers/HistogramLUTController.js'` → `'../src/plot/layers/HistogramLUTController.js'`
- `examples/SpectrogramExample.jsx`: `'../src/components/HistogramLUTPanel.jsx'` → `'../ui/HistogramLUTPanel.jsx'`
- `examples/SpectrogramPopup.jsx`: `'../src/components/FilterPanel.jsx'` → `'../ui/FilterPanel.jsx'`

**Verification:** `npm run build` passes zero errors.


---

## Archived from PLAN.md — Phase 1/2/3 Compact Summaries

*Removed from PLAN.md on 2026-03-14 to reduce file size. Status index in PLAN.md is the authoritative record.*

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


---

## Archived from PLAN.md — Phase 3 Tail + DOC Summaries + Changelog

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
- **2026-03-07 [Claude]**: DOC4 completed (v6.7) — `RoiDeepDivePage.jsx` replaced placeholder with 6 sections: Mermaid classDiagram (ROIBase → LinearRegion/RectROI/LineROI with property annotations); creation modes table (key/clicks/auto-parent rules); LineROI modes table (all 6 modes with ASCII orientation sketches); ConstraintEngine drag + mouseup sequence diagrams; versioning table (what does/doesn't trigger bumpVersion); serialization/external-sync round-trip code (serializeAll output shape, updateFromExternal version-gating, deserializeAll, full example). Build passes zero errors. All DOC pages complete.
- **2026-03-07 [Claude]**: DOC5 added as PENDING (v6.8) — PlotController Deep-Dive: 10-section internal walkthrough (init pipeline, two-canvas model, render loop + dirty-flag table, layer registry, three zoom modes + restore-and-reapply pattern, coordinate systems + Y-axis inversion, data flow appendData→GPU, ownership model, events reference). Adds one new component `PlotControllerDeepDivePage.jsx`; updates `DocsPage.jsx` sidebar and `HubPage.jsx`. No library source changes.
- **2026-03-07 [Claude]**: DOC5 completed (v6.9) — `PlotControllerDeepDivePage.jsx` created; NavSidebar gains 5th entry 'PlotController'; DocsPage renders the new page; HubPage doc card group gains a 5th card. All 10 spec sections implemented with accurate source-derived details.
- **2026-03-14 [Claude]**: Phase 4 (Bitmap/LUT Refactor) added as PENDING (v7.0) — ARCH-F through CLEANUP. Motivation: decompose monolithic SpectrogramLayer into generic BitmapDataLayer + LUTController + LUTHistogramController; give SpectrogramExample full PlotController integration via new AudioController; enable any 2D image/array source (heatmaps, image labels, non-geospatial tile layers, spectrograms) to use the LUT histogram system. Key decisions: LUT histogram uses full PlotController internally with HLine LineROIs as level handles; entry-point JS moves to examples/src/; non-library React UI moves to ui/; filter interface uses stateless fn bridge (AudioController.setFilterFn) so DSP stays replaceable; old spectrogram kept until EX-Spec verified then deleted in CLEANUP. Mandatory order: ARCH-F → F27 → F28 → F29 → F30 → EX-Spec → CLEANUP.

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

### DOC4 [COMPLETED] Documentation: ROI System Deep-Dive
**Completed:** 2026-03-07 | **Branch:** feature/DOC4
Replaced placeholder `RoiDeepDivePage.jsx` with 6 sections: classDiagram (ROIBase → LinearRegion/RectROI/LineROI with property annotations), creation modes table (key/clicks/auto-parent), LineROI modes table (all 6 modes with ASCII sketches), ConstraintEngine sequence diagrams (drag + mouseup), versioning table (what does/doesn't bump version), and serialization/external-sync round-trip code sample.
Full spec: [docs/plan-archive.md#doc4](docs/plan-archive.md#doc4)

---

### DOC5 [COMPLETED] Documentation: PlotController Deep-Dive
**Completed:** 2026-03-07 | **Branch:** feature/DOC5
`PlotControllerDeepDivePage.jsx` created with 10 sections (init pipeline sequence diagram, two-canvas model, dirty-flag render loop table + sequence diagram, layer registry code, three zoom modes with restore-and-reapply code, four-space coordinate table + y-axis inversion, appendData-to-GPU flowchart, ownership flag table, full events reference table); NavSidebar, DocsPage, and HubPage updated.
Full spec: [docs/plan-archive.md#doc5](docs/plan-archive.md#doc5)

---

## F27

### F27 [COMPLETED] Generic BitmapDataLayer
**Completed:** 2026-03-14 | **Branch:** feature/F27
**Depends on:** ARCH-F

**New files:**
- `src/plot/layers/BitmapDataLayer.js` — deck.gl CompositeLayer
- `src/plot/layers/_buildBitmapFromGrid.js` — shared CPU colorization util (extracted from `SpectrogramLayer.buildImage`)

**Goal:** A deck.gl `CompositeLayer` that accepts any 2D image or numeric array and renders it as a spatially positioned `BitmapLayer`. The STFT/spectrogram pipeline no longer lives inside a layer.

**Props:**
```js
{
  id,
  source,          // URL | ImageBitmap | ImageData | HTMLCanvasElement | TypedArray
  bitMapping,      // EXCLUSIVE: { bounds:[l,b,r,t] } OR { origin:[x0,y0], scale:[dx,dy] }
  channels,        // 'gray'|'rgb'|'rgba'|'gray+alpha'  (default: 'rgba')
  dtype,           // 'float32'|'float64'|'uint8'|'uint16'|'int16'|'int32'  (default: 'uint8')
  lutController,   // LUTController | null — applies LUT to single-channel data
  dataTrigger,     // monotonic int — forces re-upload on increment
  colorTrigger,    // monotonic int — forces recolorization only (no re-upload)
  maxArrayPixels,  // size cap for TypedArray sources (default: 16_777_216 = 4096×4096)
  width,           // image width in pixels — required for TypedArray sources
  height,          // image height in pixels — required for TypedArray sources
}
```

**`bitMapping` — mutually exclusive:**
- `bounds` → `[left, bottom, right, top]` in data space; passed directly to BitmapLayer
- `origin+scale` → `bounds = [x0, y0, x0+dx*width, y0+dy*height]`
- Throws if both or neither are provided

**Source resolution (`_resolveSource`):**

| source type | channels | dtype | action |
|---|---|---|---|
| URL string | any | any | pass directly to BitmapLayer (deck.gl fetches) |
| ImageBitmap / ImageData / HTMLCanvasElement | any | any | pass directly |
| TypedArray | 'rgba' | 'uint8' | reinterpret as RGBA ImageData (direct copy) |
| TypedArray | 'gray' | float or int | CPU colorize via LUTController (Viridis fallback) → ImageBitmap |
| TypedArray | 'rgb' | 'uint8' | build ImageData with alpha=255 |
| TypedArray | 'gray+alpha' | 'uint8' | build ImageData from interleaved gray+alpha |

- If `width * height > maxArrayPixels` → `console.warn`, return `null` (layer renders nothing)
- Image cached in layer state (`initializeState` sets `image: undefined`); rebuilt only when `dataTrigger` or `colorTrigger` changes (or first render)

**`_buildBitmapFromGrid` details:**
- Takes `(source, width, height, channels, dtype, lutController)`
- For 'gray': reads `lutController.getLUTArray()` and `state.{level_min, level_max}`; falls back to Viridis + auto-range when `lutController` is null
- Writes to `ImageData`, renders into `OffscreenCanvas` (or `document.createElement('canvas')` fallback), returns `ImageBitmap` via `transferToImageBitmap()` or `HTMLCanvasElement`

**Multiple `BitmapDataLayer` registrations on one `PlotController` are supported; each carries its own `lutController` reference.**

**Usage:**
```js
myLutCtrl.on('levelChanged', () => { colorTriggerRef.current++; ctrl.markDirty(); });

ctrl.registerDataLayer('heatmap', () =>
  new BitmapDataLayer({
    source:       myFloat32Array,
    bitMapping:   { bounds: [0, 0, 100, 50] },
    channels:     'gray',
    dtype:        'float32',
    width:        512,
    height:       256,
    lutController: myLutCtrl,
    dataTrigger:  dataTriggerRef.current,
    colorTrigger: colorTriggerRef.current,
  })
);
```

**Verification:** Build zero errors. Layer accepts URL images, Float32Array heatmaps, and Uint8Array RGBA sources. LUT levels change triggers recolorization via `colorTrigger`.

---

## F29 [COMPLETED] LUTPanel React Component

**Branch:** `feature/F29`
**Completed:** 2026-03-14
**Depends on:** F28

**New file:** `ui/LUTPanel.jsx` — fresh component, not derived from `HistogramLUTPanel.jsx`

**Props:** `lutController`, `lutHistCtrl`, `width` (default 160), `height` (default '100%')

**Layout:**
```
┌──────────────────────────┬──┐
│  histogram canvases      │  │
│  (bars + hline handles)  │LU│
│  driven by lutHistCtrl   │T │
│  .init(wc, ac)           │gd│
├──────────────────────────┤  │
│  [Colormap ▼]  [Auto]    │  │
└──────────────────────────┴──┘
```

- Left: two raw `<canvas>` elements (webgl + axis) wired directly to `lutHistCtrl.init()` — does NOT use `PlotCanvas` component (which creates its own PlotController)
- Right strip (12 px): LUT gradient canvas (2D), uses ResizeObserver + redraws on `lutController.on('lutChanged')`
- Bottom: colormap `<select>` bound to `LUTController.presetNames` + "Auto Level" `<button>`
- Level adjustment is via hline LineROIs inside the plot — no React drag handlers

**Implementation notes:**
- `useEffect([], [])` mounts once: `requestAnimationFrame` → sizes canvases → `lutHistCtrl.init(wc, ac)`; cleanup calls `lutHistCtrl.destroy()`
- Gradient canvas sized via `ResizeObserver` → `canvas.width = GRAD_W; canvas.height = canvas.offsetHeight`
- `setPreset` state is a React display-only mirror of `lutController.state.lutName`; the source of truth is the controller

**Verification:** Colormap dropdown updates gradient strip and connected BitmapDataLayer. Auto Level snaps to 2nd/98th percentile. Build zero errors.

---

## F30

### F30 — AudioController

**Branch:** `feature/F30`
**Completed:** 2026-03-14
**Depends on:** ARCH-F (file location); conceptually independent of F27–F29

**New file:** `src/audio/AudioController.js`

Unified audio management controller. Absorbs responsibilities from `PlaybackController.js` (playback state machine) and the STFT/tile logic previously embedded in `SpectrogramExample.jsx`. Both existing files are kept unchanged for backwards compat until CLEANUP.

**Public API:**
```js
// Loading
await audioCtrl.loadFile(arrayBuffer)          // decode via Web Audio API → emit 'loaded'
await audioCtrl.loadBuffer(samples, sampleRate) // direct Float32Array → emit 'loaded'
audioCtrl.appendSamples(newSamples)             // streaming append

// Filter — stateless transform function
audioCtrl.setFilterFn((samples, sr) => Float32Array)
// Default: null (no filter). Bridge to FilterController:
//   audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr))
await audioCtrl.getFilteredSamples()            // returns filtered Float32Array (or raw)

// Playback
await audioCtrl.play(offsetSec?)
audioCtrl.pause()
audioCtrl.stop()
audioCtrl.seek(timeSec)
audioCtrl.get currentTime   // live position (seconds)
audioCtrl.get duration      // total duration (seconds)
audioCtrl.get isPlaying     // boolean
audioCtrl.get sampleRate    // Hz

// STFT / tile generation
await audioCtrl.computeSTFT({ windowSize, hopSize, windowFn, tileWidthSec })
// Emits 'tileReady' per tile, then 'stftComplete'

// Streaming
audioCtrl.setStreamingInterval(ms)   // default 500; appendSamples triggers last-tile recompute

// Lifecycle
audioCtrl.destroy()
```

**Events:**
- `'loaded'` — `{ duration, sampleRate, samples: Float32Array }`
- `'stateChanged'` — `{ state: 'playing'|'paused'|'stopped' }`
- `'timeUpdate'` — `{ currentTime }` (~10 Hz during playback, via setInterval 100 ms)
- `'tileReady'` — `{ tileIndex, power: Float32Array, width, height, globalMin, globalMax, bounds: [tStart, 0, tEnd, nyquist] }`
- `'stftComplete'`
- `'streamingTick'`

**STFT tile strategy (Option B — fixed-width time segments):**
- `tileWidthSec` seconds of STFT frames per tile (default 30 s)
- `computeSTFT` loops over tiles, calling internal `_computeTileSTFT` per tile (synchronous radix-2 FFT via `fft.js` + `fft-windowing`)
- `appendSamples` sets `_pendingAppend = true` and starts the streaming timer if `_stftConfig` is set
- Streaming timer fires every `_streamingInterval` ms → calls `_recomputeLastTile()` (async, applies filterFn) → emits `tileReady` for last tile index with updated bounds

**Filter compatibility:** `FilterController.js` unchanged; bridge:
```js
audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr));
```
DSP is replaceable (WebAssembly etc.) without touching FilterPanel or FilterController.

**Verification:** Load file → play/pause/seek. Run STFT → `tileReady` fires per tile with correct `bounds`. Streaming append → last tile re-emits. `destroy()` clears all timers. Build zero errors.

---

## EX-Spec

### EX-Spec [COMPLETED] Spectrogram V2 Example
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

## EX16

### EX16 — Non-Spectrogram BitmapDataLayer Example

**Branch:** `feature/EX16`
**Completed:** 2026-03-15
**Depends on:** EX15

Demonstrate `BitmapDataLayer` outside of the audio/spectrogram context using three vertically-stacked panels on a single page, each sourcing an image differently:

1. **Local image** — user picks a file via `<input type="file">`; decoded with `createImageBitmap`; displayed in a `BitmapDataLayer` with configurable `bitMapping` (origin x/y, width, height); sidebar shows computed bounds.
2. **Generated array** — a `Float32Array` heatmap synthesised in JS (256×256 sum-of-Gaussians); displayed with `channels: 'gray'`, `dtype: 'float32'`; full `LUTPanel` sidebar so the user can adjust levels and colormap live via draggable hline handles.
3. **URL image** — loads a small CORS-accessible raster (NASA Blue Marble / OSM tile); displayed with `bitMapping.bounds` set to geographic bounds `[-180,-90,180,90]`; axes labelled Longitude/Latitude.

**New files:**
- `examples/BitmapExample.jsx` — three-panel React component with module-level PlotController state
- `examples/src/bitmap.js` — webpack entry
- `public/bitmap.html` — HTML template

**Modified:**
- `webpack.config.js` — added `bitmap` entry + `HtmlWebpackPlugin`
- `examples/HubPage.jsx` — added Bitmap Layers (EX16) card
- `README.md` — added Bitmap Layers Example section with code snippet
- `examples/docs/ApiReferencePage.jsx` — added demo links to BitmapDataLayer section

**Verification:** all three panels render; LUT panel on array panel recolorizes in real time; `npm run build` zero errors (2 size warnings only, same as all other entries).

---

## CLEANUP — Remove Legacy Spectrogram Code

**Branch:** `feature/cleanup-old-spectrogram`
**Completed:** 2026-03-15
**Depends on:** EX-Spec (verified working side-by-side)

**Files deleted:**
- `src/plot/layers/SpectrogramLayer.js`
- `src/plot/layers/HistogramLUTController.js`
- `ui/HistogramLUTPanel.jsx`
- `examples/SpectrogramExample.jsx`
- `examples/src/spectrogram.js`
- `public/spectrogram.html`
- Webpack entry: `spectrogram`

**Files kept (shared infrastructure):**
- `examples/SpectrogramPopup.jsx` — popup host shell still used by SpectrogramV2 (`spectrogram-popup.html?panel=filter` and `?panel=labels`)
- `examples/src/spectrogram-popup.js` — entry for above
- `public/spectrogram-popup.html` — HTML template for above

**Files updated:**
- `webpack.config.js` — removed `spectrogram` entry + HtmlWebpackPlugin
- `examples/HubPage.jsx` — removed legacy Spectrogram card
- `README.md` — audio-subsystem architecture tree updated; legacy file tree entries removed; popup host example URLs updated to v2 channels
- `prompt.md` — removed legacy entries from project structure; CLEANUP deliverable marked ✅

**Verification:** `npm run build` zero errors. `grep -r SpectrogramLayer src/` returns nothing.

---

## F31

### F31 — BitmapViewGenerator (Viewport-Driven LOD)

**Branch:** `feature/F31-EX18-EX19`
**Completed:** 2026-03-21
**Depends on:** F27 ✅

**New file:** `src/plot/layers/BitmapViewGenerator.js`

Viewport-aware controller that re-generates or re-fetches a `BitmapDataLayer` whenever the visible domain changes. Extends `EventEmitter`. Registered layer automatically managed via `plotController.registerDataLayer`.

**Constructor opts:**
- `layerId` (required), `generate` xor `fetch`, `debounceMs=150`, `channels='gray'`, `dtype='float32'`, `lutController=null`, `initialBitMapping=null`

**Internal `_layerState`:** `{ source, width, height, bitMapping, channels, dtype, lutController, dataTrigger, colorTrigger }`

**generate mode:** stale results discarded via `_seqId` monotonic counter.
**fetch mode:** previous `AbortController` aborted on each new domain change.

**Public API added beyond plan spec:**
- `bumpColorTrigger()` — increments `_layerState.colorTrigger` + `markDirty()`; forces `BitmapDataLayer` recolorize without re-running generate/fetch. Added to support EX19 LUT wiring.
- `setLutController(lut)`, `refresh()`, `destroy()`

**Events:** `requestStart { request }`, `requestComplete { request, durationMs }`, `requestError { request, error }`

---

## EX18

### EX18 — Variable-Resolution Bitmap Example

**Branch:** `feature/F31-EX18-EX19`
**Completed:** 2026-03-21
**Depends on:** F31

**New files:** `examples/BitmapLODExample.jsx`, `examples/src/bitmap-lod.js`, `public/bitmap-lod.html`

Two-panel demo:

**Panel 1 — Local generation (Gaussian heatmap):**
- 512×512 Float64 base grid generated once (`generateHeatmapGrid`)
- `BitmapViewGenerator` with `generate`: `sliceAndResample` extracts visible domain from base grid, `bilinearResample` resamples to `min(widthPx,1024) × min(heightPx,1024)`
- LUT changes call `_heatGen.refresh()` (fast for in-memory data)
- Sidebar: `LUTPanel`, debounce slider (50–500 ms), resolution readout

**Panel 2 — URL fetch (CDS HiPS2FITS 2MASS K-band):**
- `coordsys=galactic` → `ra`/`dec` params interpreted as galactic ℓ/b
- `fov = xMax - xMin`, `ra = (xMin+xMax)/2`, `dec = (yMin+yMax)/2`
- Width/height capped at 1024×512 to limit request size
- `AbortSignal` passed to `fetch()` for stale-request cancellation
- Loading badge + error badge keyed to `requestStart`/`requestComplete`/`requestError`

**Deliverables:** webpack entry + HtmlWebpackPlugin; HubPage card; README Phase 5 section; `ApiReferencePage` full `BitmapViewGenerator` section (constructor options + request object + methods + events tables).

---

## F32

### F32 — TableLoaderAdapter (CSV / Arrow / Parquet → scatter)

**Branch:** `feature/F32-F33-EX19`
**Completed:** 2026-03-28
**Depends on:** nothing (pure utility over existing ExternalDataAdapter contract)

**New file:** `loaders/TableLoaderAdapter.js`

**Purpose:** Accepts a `File` object or URL and converts a tabular dataset (CSV, TSV, Apache Arrow `.arrow`) into a MasterPlot `bufferStruct` (`{x: Float32Array, y: Float32Array, size?, color?}`), then calls `dataStore.appendData()` in configurable-size chunks.

**Constructor:**
```js
new TableLoaderAdapter(dataStore, {
  x: 'colName',                        // required — column name for x axis
  y: 'colName',                        // required — column name for y axis
  size: 'colName' | number | null,     // optional; default 4.0
  color: 'colName' | fn | null,        // optional; fn receives row value, returns [r,g,b,a]
  chunkSize: 50_000,                   // rows per appendData call
  replace: false,                      // if true, clears DataStore before loading
})
```

**Public API:**
- `async loadFile(file: File)` — parse() with loader selected by file extension
- `async loadURL(url: string, fetchOptions?)` — fetch + parse
- `getColumns()` — returns `string[]` (populated after first load)
- `destroy()` — clears internal state

**Format handling:**
- `.csv`, `.tsv` → CSVLoader returns `{ shape: 'object-row-table', data: [{}] }` — row objects mapped to column arrays
- `.arrow` → ArrowLoader returns Apache Arrow Table — `schema.fields` + `getChild(name).toArray()`
- `.parquet` → attempted via ArrowLoader with console warning

**Type coercion:** All column types coerced to Float32; BigInt64 via `Number(v)` with one-time warning; null/NaN → 0 with `'parseWarning'` event.

**Events:** `'loaded'` `{ rowCount, columns }`, `'chunk'` `{ loaded, total }`, `'parseWarning'` `{ message }`

---

## F33

### F33 — RasterLoaderAdapter (NetCDF / image → BitmapDataLayer)

**Branch:** `feature/F32-F33-EX19`
**Completed:** 2026-03-28
**Depends on:** F27 (BitmapDataLayer)

**New file:** `loaders/RasterLoaderAdapter.js`

**Purpose:** Accepts a `File` or URL pointing to a gridded dataset (NetCDF3, or any image format) and registers a `BitmapDataLayer` on a `PlotController` with correct `bitMapping.bounds` inferred from coordinate arrays or image dimensions.

**Constructor:** `new RasterLoaderAdapter(plotController, { layerId, variable, xDim, yDim, lutController, flipY })`

**Public API:**
- `async loadFile(file: File)` — routes .nc/.cdf to NetCDFLoader, images to createImageBitmap
- `async loadURL(url, fetchOptions?)`
- `loadArray(data, width, height, opts)` — in-memory typed array; `opts.bounds`, `opts.channels`, `opts.dtype`
- `getVariables()` → `string[]` (NetCDF only; populated after load)
- `getDimensions()` → `{ [varName]: string[] }` (NetCDF only)
- `destroy()` — unregisters layer + removes LUT listeners

**Format handling:**
- `.nc`, `.cdf` → `@loaders.gl/netcdf` NetCDFLoader with `{netcdf:{loadData:true}}`; variable as Float32 grid; coordinate arrays → half-cell-padded bounds
- `.png`, `.jpg`, `.webp`, `.bmp`, `.tif` → `createImageBitmap`; bounds default to `[0, 0, w, h]`

**Important limitation:** `@loaders.gl/netcdf` only supports NetCDF v3 classic (magic bytes CDF). NetCDF4/HDF5 files throw a parse error.

**LUT wiring:** `lutController.on('levelChanged'/'lutChanged')` → `_colorTrigger++` + `markDirty()`. `setData()` called with Float32 grid min/max on NetCDF load.

**Events:** `'loaded'` `{ width, height, variable, bounds }`, `'parseWarning'` `{ message }`

---

## EX19

### EX19 — Data Loaders Example

**Branch:** `feature/F32-F33-EX19`
**Completed:** 2026-03-28
**Depends on:** F32, F33

**New files:**
- `examples/DataLoadersExample.jsx`
- `examples/src/data-loaders.js`
- `public/data-loaders.html`

**Layout:** Two vertically stacked panels (flex column), each with a plot area + controls sidebar.

**Panel 1 — Tabular scatter (`TableLoaderAdapter`):**
- Drag-and-drop zone + `<input type="file">` accepting `.csv`, `.tsv`, `.arrow`
- First-line header sniff to pre-populate X/Y/size column selects without a full parse
- "Load File" button calls `TableLoaderAdapter.loadFile()` with chosen columns
- Progress bar updated via `'chunk'` events; parseWarning display
- "Load Sample CSV" generates 10k-row synthetic CSV in-memory (time/value/magnitude) and calls `loadFile()` on a Blob-derived File; sets axes to [0,100] × [0,100]

**Panel 2 — Raster heatmap (`RasterLoaderAdapter`):**
- `<input type="file">` accepting `.nc`, `.cdf`, `.nc4`, `.png`, `.jpg`, `.webp`, `.bmp`
- After NetCDF load: variable `<select>` rendered from `adapter.getVariables()`
- "Load Sample Grid" calls `adapter.loadArray()` with a 128×128 Gaussian temperature Float32Array and `bounds: [-180, -90, 180, 90]`
- LUTPanel (160 px) in a fixed sidebar column; auto-scale axes on `'loaded'` event
- HelpOverlay with controls list

**Webpack / docs:**
- webpack entry `data-loaders` + `HtmlWebpackPlugin` for `data-loaders.html`
- HubPage card added to demos array
- README: Phase 6 section with full API docs for both adapters
- ApiReferencePage: `TableLoaderAdapterSection` + `RasterLoaderAdapterSection` added before AudioControllerSection

---

### B9 — ROILayer pixel-space border widths

**Branch:** `feature/B9`
**Completed:** 2026-04-04
**Depends on:** none — fully independent

**Problem:** ROI border and handle line widths were specified in data-coordinate units, so they scaled with zoom. At extreme zoom levels (data range ~0.001 or ~100,000) borders became imperceptibly thin or grossly thick.

**Fix:** In `src/plot/layers/ROILayer.js`, added `lineWidthUnits: 'pixels'` to the two `PolygonLayer` outlines (LinearRegion fill and RectROI fill). The `PathLayer` and `ScatterplotLayer` sub-layers already had `widthUnits: 'pixels'` / `radiusUnits: 'pixels'` set. Border thickness is now a fixed screen-pixel value regardless of zoom.

**Files modified:**
- `src/plot/layers/ROILayer.js` — added `lineWidthUnits: 'pixels'` to LinearRegion and RectROI PolygonLayer instances

**Verification:** confirmed working. No example changes needed.

---
