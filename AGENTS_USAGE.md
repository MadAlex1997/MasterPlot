# Using MasterPlot (for coding agents)

This file ships inside the `masterplot` npm package
(`node_modules/masterplot/AGENTS_USAGE.md`) specifically so an agent working
in a project that depends on it — **including on an air-gapped machine with
no network access** — can find complete usage instructions without needing
this repo, the GitHub page, or the live docs site.

**Everything referenced below ships inside the installed package.** Nothing
in this file requires network access. The one exception is the live docs
SPA link in "Where to look next", which is a convenience for when you *do*
have connectivity — treat it as optional, not a dependency.

```
npm install masterplot
```

## What's actually in the package (verify locally, don't assume)

Run this once to confirm what your installed copy contains — file layout can
change between versions, and this doc describes the version at hand:

```
cat node_modules/masterplot/package.json   # confirm the installed version
ls node_modules/masterplot/                # lib/, src/, ui/, loaders/, README.md, AGENTS_USAGE.md, LICENSE
```

Ground truth, in order of preference when this file's prose and the code
disagree:

1. **`node_modules/masterplot/src/index.d.ts`** (and `ui/index.d.ts`,
   `loaders/index.d.ts`) — hand-written TypeScript declarations, the exact
   contract for every exported class, method, option, and event payload.
2. **`node_modules/masterplot/README.md`** — full prose API reference,
   architecture overview, and per-controller sections (same content as this
   repo's README, always included in the published tarball).
3. **`node_modules/masterplot/src/**/*.js`** — the actual implementation.
   Full source ships (not just compiled output), so when the `.d.ts` or
   README leave a behavior ambiguous, read the source directly instead of
   guessing.

`CHANGELOG.md` does **not** ship in the package — don't look for it there.

## Installing on an air-gapped machine

If `masterplot` isn't in `node_modules` yet and there is no registry access,
`npm install masterplot` won't work — look for an offline bundle instead of
giving up or stubbing the dependency:

```
ls masterplot-*-offline-bundle.tar.gz offline-bundle/ 2>&1   # already present in this project?
```

If one exists (or someone with network access hands you one — built from the
`masterplot` source repo via `npm run bundle:offline`, see
`scripts/bundle-offline.mjs` there), it contains the `masterplot` package
tarball plus every `dependencies`/`peerDependencies` package, installable
with **zero network access**:

```
tar -xzf masterplot-*-offline-bundle.tar.gz    # → offline-bundle/
cat offline-bundle/INSTALL-OFFLINE.md          # full instructions, both methods below
```

- **Method A (recommended):** `./offline-bundle/install-offline.sh /path/to/your/project`
  — installs via a populated npm cache (`npm install --offline --cache ...`),
  merges cleanly with a project that already has other dependencies.
- **Method B (fastest):** extract `offline-bundle/node_modules.tar.gz` and
  `offline-bundle/masterplot-<version>.tgz` directly into your project's
  `node_modules/` — no `npm` invocation at all.

Do not attempt to hand-write stub versions of `masterplot` or its peer
dependencies to work around a missing offline bundle — ask for one instead.

## Entry points

| Import from | Contains |
|---|---|
| `masterplot` | Core engine — `PlotController`, `PlotCanvas`, `ViewportController`, `DataStore`, `PlotDataView`, the ROI system, layers, `AudioController` |
| `masterplot/ui` | Optional React panels — `LUTPanel`, `FilterPanel`, `HelpOverlay` |
| `masterplot/loaders` | `TableLoaderAdapter` (CSV/TSV/Arrow/Parquet), `RasterLoaderAdapter` (NetCDF/image) |

## React quick start

```jsx
import { PlotCanvas } from 'masterplot';

function Chart() {
  return (
    <PlotCanvas
      xDomain={[0, 100]}
      yDomain={[0, 100]}
      xScaleType="linear"
      onInit={(ctrl) => {
        // ctrl is a PlotController — appendData/viewport calls go here, not React state
        ctrl.appendData({ x: myXFloat32Array, y: myYFloat32Array });
      }}
    />
  );
}
```

## Vanilla JS quick start

```js
import { PlotController } from 'masterplot';

const ctrl = new PlotController({ xDomain: [0, 100], yDomain: [0, 100] });
ctrl.init(webglCanvasEl, axisCanvasEl); // both canvases must already be in the DOM
ctrl.appendData({ x: new Float32Array([...]), y: new Float32Array([...]) });
// ...
ctrl.destroy(); // on teardown
```

## Time axes (F39/F40)

Time-scale tick labels (`scaleType: 'time'`) auto-switch granularity with
zoom level (year → ... → millisecond) via d3-scale's built-in formatter — no
configuration needed.

For **microsecond-precision absolute timestamps**, don't put raw epoch
values into `x`/`y` `Float32Array` buffers — float32 only holds ~7
significant digits, which aliases point positions at that magnitude. Instead
use `timeOrigin`: keep small offsets-from-a-reference-time in the data
buffer, and let `PlotController` reconstruct absolute time (double
precision) for tick labels and conversions:

```js
const ctrl = new PlotController({
  timeOrigin: originMs,        // Date or epoch-ms reference
  timeOriginUnits: 'seconds',  // x-domain offsets are in seconds since originMs (default)
});
ctrl.appendData({ x: offsetsInSeconds, y: ... }); // small offsets, not raw epoch values

ctrl.dataXToEpochSeconds(offsetsInSeconds[0]); // → absolute epoch seconds, double precision
ctrl.epochSecondsToDataX(absoluteTimestamp);   // → small offset to write back into buffers/ROIs
ctrl.dataXToDate(x);                           // → Date, millisecond precision only
```

X-axis only. If you pass your own `xAxis` config alongside `timeOrigin`, it
is never mutated — only the conversion methods activate; pass
`buildEpochTickFormatter()` (also exported) to your own `xAxis.tickFormat`
for the labels too. Rebase `timeOrigin` periodically in long-running
live-streaming sessions — float32 precision re-exhausts even with a
well-chosen origin.

## Configurable keybindings (F41)

Every keyboard-driven action — ROI creation (`l`/`r`/`v`/`h`/`d`/`escape`),
zoom (`=`/`-`), pan (arrow keys), autoscale (`' '`) — is remappable via one
`keyBindings` option (constructor or `setKeyBindings()` at runtime, merge-
over-defaults like `mouseButtons`). Pass `null` for an action to disable its
key.

```js
const ctrl = new PlotController({ keyBindings: { createLinear: 'q', deleteROI: null } });
ctrl.setKeyBindings({ zoomIn: ']', zoomOut: '[' }); // runtime remap, merged over current
```

`opts.autoScaleKey` (pre-F41) still works but is deprecated — use
`keyBindings.autoScale` instead.

Opt-in `scalePresets` bind a key to a fixed-view jump on one or both axes
(`setScalePresets()` **replaces** the array — not a merge, unlike
`setKeyBindings`):

```js
const ctrl = new PlotController({
  scalePresets: [{ bind: '1', xMin: 0, xMax: 100, yMin: -1, yMax: 1 }],
});
ctrl.setScalePresets([{ bind: '2', yMin: -10, yMax: 10 }]); // whole-array replace
```

Arrow-key pan direction is "camera pans toward the arrow" (`ArrowRight`
reveals more content to the right). `keyBindings` are scoped per
sub-controller — a preset/zoom key colliding with a ROI-action key fires
both, since they're independent `keydown` listeners.

## Rules that matter to consumers

- Data is GPU-buffer-driven, not React-state-driven: `x`/`y` must be
  `Float32Array`, color is packed `Uint8Array` RGBA. Mutate via
  `ctrl.appendData()`, never by re-rendering React with new arrays.
- All zoom/pan/domain mutation goes through `ctrl.viewport`
  (`setXDomain`, `setYDomain`, `setDomains`, `zoomAroundX/Y`, `panByPixels`) —
  not `ctrl.xAxis`/`ctrl.yAxis`, which are config-only (scale type, ticks, label).
- `PlotController` extends `EventEmitter` (`.on`/`.off`/`.emit`) — subscribe to
  `dataAppended`, `domainChanged`, `zoomChanged`, `roiFinalized`, etc. instead
  of polling.
- Call `ctrl.destroy()` on unmount/teardown to release deck.gl and DOM listeners.

## Peer dependencies (must already be present — nothing installs itself offline)

`masterplot` declares these as `peerDependencies`, meaning **the consuming
project must already have them installed**; on an air-gapped system there is
no `npm install <missing-peer>` fallback, so check for them up front:

```
ls node_modules/@deck.gl/core node_modules/@deck.gl/layers node_modules/@luma.gl/core \
   node_modules/d3-scale node_modules/d3-format node_modules/d3-time-format \
   node_modules/react node_modules/react-dom node_modules/events 2>&1
```

Required for the core (`masterplot`) entry point: `react`, `react-dom`,
`@deck.gl/core`, `@deck.gl/layers`, `@luma.gl/core`, `d3-scale`, `d3-format`,
`d3-time-format`, `events`.

Optional, only needed if you actually use `masterplot/loaders`:
`@loaders.gl/core` + the format-specific package(s) (`@loaders.gl/csv`,
`@loaders.gl/arrow`, `@loaders.gl/netcdf`, `@loaders.gl/parquet`,
`@loaders.gl/schema`) and `zstd-codec` (Parquet only). If a loader format
isn't needed, its peer isn't needed either — check
`node_modules/masterplot/package.json` → `peerDependenciesMeta` for which
peers are marked `optional`.

Exact tested version ranges: `node_modules/masterplot/README.md` → "Peer
Dependencies" (same info as `package.json` → `peerDependencies`, but with
narrative context).

If a required peer is missing and you have no registry access, the fix is to
vendor it (e.g. from a pre-populated package cache or an internal mirror) —
the offline bundle described in "Installing on an air-gapped machine" above
already includes every peer dependency if that's how `masterplot` got
installed. Do not stub or reimplement a peer dependency to work around a
missing one.

## Where to look next

- Full constructor options, methods, and events for every class:
  `node_modules/masterplot/README.md` (ships offline).
- Exact TypeScript contracts: `node_modules/masterplot/src/index.d.ts`,
  `ui/index.d.ts`, `loaders/index.d.ts` (ship offline).
- If you have network access: the live docs SPA at
  https://madalex1997.github.io/MasterPlot/docs.html has a friendlier
  "Getting Started" walkthrough and an ROI Deep-Dive — purely a convenience,
  everything it covers is also in `README.md`.
