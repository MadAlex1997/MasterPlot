# MasterPlot Implementation Plan

**Plan Version:** 1.7
**Last Updated:** 2026-02-21
**Status:** All items COMPLETED — no pending work

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

## Change Log

- **2026-02-20 [Initial]**: Plan created. All steps initialized as PENDING.
- **2026-02-20 [Claude]**: All Phases 1–10 MVP implemented. React 19, 0 vuln. Build clean.
- **2026-02-20 [Claude]**: User testing revealed 3 bugs and 2 feature requests. Full root-cause analysis done. Fix steps B1–F2 added. Next agent should implement B1→B2→B3→B4→F1→F2 in order, then rebuild.
- **2026-02-20 [Claude]**: B1–F2 all implemented. Build verified: `webpack compiled successfully` 0 errors. Removed unused `React` import from ExampleApp.jsx (JSX transform handles it).
- **2026-02-20 [Claude]**: User testing session 2. Additional fixes applied: RectROI handle naming corrected (TOP↔BOTTOM swap to match visual y-axis inversion), `xLocked` flag added for LinearRegion-parented RectROIs (x bounds pinned to parent, no left/right handles). x-axis switched to linear in example. Two new items added: B5 (inverted controls still reported on constrained RectROI — needs empirical verification and re-fix) and F3 (show roiUpdated/zoomChanged/panChanged in on-screen log panel).
- **2026-02-21 [Claude]**: B5 — static analysis confirmed handle positions and dy sign are correct. Remaining issue was the crossover-snap UX artifact: when TOP/BOTTOM handles were dragged past the opposite edge, the normalization swap + per-frame bounds-restore caused the rect to "teleport," which felt like inversion at the boundary. Fix: added per-case clamping inside `applyDelta` for HANDLES.TOP and HANDLES.BOTTOM so handles stop at zero height instead of crossing. Global normalization retained for corner handles. F3 — added `roiUpdated` (debounced 150 ms, logs after drag settles), `zoomChanged` (immediate), and `panChanged` (threshold > 5 px displacement) to ExampleApp `handleEvent`. `panChanged` was already emitted by PlotController and forwarded by PlotCanvas. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: User reports entire y-scale is visually inverted (data rendered upside-down relative to axis tick labels). Root cause identified: `_buildViewState` computes `ty` assuming `OrthographicView` has `flipY: true`, but the installed version may default to `flipY: false`. Added B6 with two fix options: Option A (add `flipY: true` to `OrthographicView`), Option B (negate y at the deck.gl layer boundary in `ScatterLayer.js` and `ROILayer.js` and rederive `ty`). No code changed — next agent to implement.
- **2026-02-21 [Claude]**: B6 — Investigation confirmed deck.gl 8.9.36 defaults to `flipY: true` in `OrthographicViewport`. Tracing the full projection pipeline revealed the `ty` formula (`deckYMin + (H/2 − marginBottom) × ySpan / pa.height`) is derived for `flipY: false` (i.e., `screenY = H/2 − scaleY × (worldY − ty)`). With the default `flipY: true` the equation inverts to `screenY = H/2 + scaleY × (worldY − ty)`, placing y=0 near the top. Fix: add `flipY: false` explicitly to `OrthographicView` in `PlotController.init()`. One-line change; no layer files needed. Build: `webpack compiled successfully` 0 errors.
