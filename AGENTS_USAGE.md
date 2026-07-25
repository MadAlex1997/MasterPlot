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
vendor it (e.g. from a pre-populated package cache or an internal mirror),
not to work around the missing import — do not stub or reimplement a peer
dependency.

## Where to look next

- Full constructor options, methods, and events for every class:
  `node_modules/masterplot/README.md` (ships offline).
- Exact TypeScript contracts: `node_modules/masterplot/src/index.d.ts`,
  `ui/index.d.ts`, `loaders/index.d.ts` (ship offline).
- If you have network access: the live docs SPA at
  https://madalex1997.github.io/MasterPlot/docs.html has a friendlier
  "Getting Started" walkthrough and an ROI Deep-Dive — purely a convenience,
  everything it covers is also in `README.md`.
