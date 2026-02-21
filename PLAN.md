# MasterPlot Implementation Plan

**Plan Version:** 2.2
**Last Updated:** 2026-02-21
**Status:** F10 PENDING

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

---

## F10 [PENDING] Feature: Audio file loading in SpectrogramExample

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
- **2026-02-21 [Claude]**: B8 — Four fixes applied to resolve blank spectrogram. (A) `dataTrigger` numeric prop added to `SpectrogramLayer.defaultProps`; `SpectrogramExample` increments `dataTriggerRef` on every `appendSamples()` and `windowSize` change, passes it to the layer — guarantees deck.gl re-invokes `renderLayers()`. (B) `updateTriggers: { image: this.props.dataTrigger }` added to BitmapLayer inside `renderLayers()` — forces luma.gl texture re-upload. (C) `buildImage()` now calls `canvas.transferToImageBitmap()` if available before returning — luma.gl 8.5.x silently fails with raw `OffscreenCanvas`. (D) Manual row-flip removed (`row = bin` instead of `row = numBins - 1 - bin`): BitmapLayer/luma.gl already applies `UNPACK_FLIP_Y_WEBGL`; the previous double-flip put 0 Hz at the top. Build: `webpack compiled successfully` 0 errors.
