# MasterPlot — Agent Guide

This file is the single source of truth for agents working on this project.
Read it before touching any code.

---

## Current Status

**Phase 7 complete as of 2026-04-04. No pending features.**

All features through B9, ARCH-G, F34, F35, EX20 are done. `PLAN.md` is the authoritative
status tracker — check it for the full feature index. `prompt.md` is a historical spec
document from early development; its phase-status sections are outdated and should be ignored.

Active branch convention: `feature/<step-ids>` (e.g. `feature/F22-EX7`). Never commit directly to `main`.
GitHub Actions deploys from `main` → https://madalex1997.github.io/MasterPlot/

---

## Where Documentation Lives

| What you need | Where to look |
|---|---|
| Public API (constructor options, methods, events, code examples) | `README.md` |
| Feature implementation status | `PLAN.md` |
| Agent protocol rules (branching, archiving, doc updates) | `PLAN.md` → "Protocol for Agents" |
| Directory ownership rules | `PLAN.md` → "Protocol for Agents" → rule 5a |
| Full specs of completed features | `docs/plan-archive.md` |
| Live docs SPA | `docs.html` / `examples/docs/` |

---

## Key Architecture Rules

- **React owns NO geometry** — no arrays, no ROI bounds, no zoom state in React state.
- All rendering is driven by `PlotController` (EventEmitter + RAF loop).
- deck.gl uses `OrthographicView` only; `flipY: false`.
- Domain state lives in `ViewportController`, not `AxisController`. `AxisController` is config-only (scale type, tick format, label, positioning mode). Use `ctrl.viewport.setXDomain()` etc. for all domain mutations.

### Y-Axis Sign Convention

The d3 y scale uses an **inverted range** `[plotBottom_px, plotTop_px]` — data-y=0 appears at the
visual bottom. This makes `pxSpan` negative for y, which flips pan direction:

```
x axis: pxSpan > 0  →  panByPixels(+n) shifts viewport right
y axis: pxSpan < 0  →  panByPixels(+n) shifts viewport up  (double-negation)
```

For any new pan/interaction code: to match x-axis directional behavior on y, **negate `dy`** relative
to `dx`. Follow-pan: x uses `-dx`, y uses `+dy`. Drag pan: both use `+dx` / `+dy`.

---

## Non-Obvious Implementation Patterns

These are not in the README but will bite you if you don't know them.

### Programmatic LineROI Creation

`addROI()` alone is not enough — you must also call `onCreate()` and emit `roisChanged`:

```js
import { LineROI } from './src/plot/ROI/LineROI.js';

const roi = new LineROI({ orientation: 'vertical', mode: 'vline-half-bottom', position: 5.0, label: 'P-wave' });
roi.bumpVersion();
ctrl.roiController.addROI(roi);
roi.onCreate();                    // ← required; wires up drag listeners
ctrl.roiController.emit('roisChanged', { rois: ctrl.roiController.getAllROIs() });
```

### Version-Keyed Table Rows

When rendering ROI data in a React table with uncontrolled inputs (`defaultValue`), key each row on
`version` so inputs re-mount with fresh values when a drag commit changes the ROI:

```jsx
<tr key={`${roi.id}-${roi.version}`}>
  <td><input defaultValue={roi.position} /></td>
</tr>
```

Without this, the input retains its stale value after an external or programmatic update.

### Module-Level DataStore (Avoid React Holding Large Arrays)

For examples that allocate large typed-array buffers, keep the stores outside React state:

```js
let _stores = null;
function getStores() {
  if (!_stores) { _stores = /* build stores */; }
  return _stores;
}
// In cleanup useEffect: _stores = null;
```

### Stable `onInit` Callbacks

`PlotCanvas` calls `onInit` exactly once per mount. If you build the callback inline in a component
body it will be recreated on every render but only the first instance fires. Use a ref guard:

```js
const onInitFns = useRef(null);
if (!onInitFns.current) {
  onInitFns.current = Array.from({ length: N }, (_, i) => (ctrl) => { /* ... */ });
}
// In cleanup useEffect: onInitFns.current = null;
```

### Multi-Plot X-Domain Sync

Prevent infinite feedback loops when syncing domain across multiple plots:

```js
const syncingRef = useRef(false);
ctrl.on('domainChanged', ({ xDomain }) => {
  if (syncingRef.current || !xDomain) return;
  syncingRef.current = true;
  otherCtrls.forEach(o => o.viewport.setXDomain(xDomain));
  syncingRef.current = false;
});
```

### `updateFromExternal` Pattern

```js
const accepted = ctrl.roiController.updateFromExternal({
  ...roi.serialize(),
  position: newPos,
  domain: { x: [newPos, newPos] },
  version: roi.version + 1,
  updatedAt: Date.now(),
});
// roi.version === submitted version if accepted
```

---

## Shelved / Rejected Features

**Do not implement or suggest these without explicit user approval and a full security discussion.**

### Pyodide Scripting Panel (F26/F27/EX13)

Built but shelved. Pyodide gives users full Python execution with unrestricted network access
(`fetch`, `WebSocket`) and arbitrary package installs (`micropip`) — this is an RCE surface for
enterprise deployments. To be reconsidered only after: CSP lockdown, `micropip` disabled,
`js.fetch`/`WebSocket` removed from globals, module import allowlist, audit logging.
The implementation exists on `feature/pyodide-dsp` but must not be merged or referenced.

### Pyodide scipy DSP Backend

Also on `feature/pyodide-dsp`. Key technical finding if it's ever revived: `np.asarray()` on a
`pyodide.toPy()` `Float32Array` proxy crashes scipy's `sliding_window_view`. Fix: use `np.array()`
to force a C-contiguous copy before passing to scipy.

---

## Completing a Feature (Checklist)

A feature is **not complete** until all of these are done:

1. Code committed on a `feature/<id>` branch
2. `README.md` updated for any new public API, constructor options, or behavior changes
3. `examples/HubPage.jsx` updated if a new example page was added
4. `webpack.config.js` and `public/` updated if a new HTML page was added
5. Doc SPA updated (`examples/docs/`) — check Architecture, Getting Started, API Reference, ROI Deep-Dive, and PlotController Deep-Dive pages as appropriate
6. `PLAN.md` step marked `[COMPLETED]` with date and compact summary; full spec moved to `docs/plan-archive.md`
