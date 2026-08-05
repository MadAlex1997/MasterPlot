# Changelog

All notable changes to this project are documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/) starting at `1.0.0`.
See the [Stability](README.md#stability) section of the README for what the version
number does and does not cover.

Pre-1.0 development had no compatibility guarantees and is summarized below as a single
`1.0.0` entry rather than a per-commit history — see [PLAN.md](PLAN.md) and
[docs/plan-archive.md](docs/plan-archive.md) for the full, dated build log if you need it.

## [Unreleased]

Phase 11 (high-precision time axes + configurable keybindings) planned, not yet implemented —
see [PLAN.md](PLAN.md).

## [1.0.0] - 2026-07-25

Initial public release.

### Added

**Core rendering & interaction**
- Controller-driven WebGL rendering via deck.gl `OrthographicView`; React owns no plot
  geometry or zoom state — all rendering runs through `PlotController`'s render loop
- `ScatterLayer` (instanced GPU scatter, tested to 10M+ points) and `LineLayer`; pluggable
  layer registry (`registerDataLayer` / `unregisterDataLayer` / `updateDataLayerProps`)
- Linear, log, and time axes via d3-scale, with a canvas 2D overlay for ticks and grid
- Axis positioning modes: fixed-edge "border" mode (with mirrored edges) and floating
  "relative" mode anchored to a data coordinate, with snap/offscreen/label-side options
- Bordered plot mode — fills axis gutters with the container's CSS background color
- Wheel zoom (cursor-centered), drag pan (follow and grab modes), right-click drag zoom,
  axis-gutter drag zoom, opt-in rectangle-select zoom, and configurable mouse-button
  bindings (`mouseButtons` / `setMouseButtons()`)
- Auto-scale / reset-zoom to full data extent or an explicit registered home domain

**ROI system**
- `LinearRegion`, `RectROI`, and six-mode `LineROI` (full and half vline/hline variants,
  with optional labels), all keyboard/click driven
- `ConstraintEngine` for parent-child bound enforcement, including cascading multi-level
  nesting and x-locked children
- ROI versioning (`version`, `updatedAt`, JSON-safe `domain` snapshot) and a
  serialization API (`serializeAll` / `deserializeAll` / `updateFromExternal`) for
  persistence and multi-client sync
- Per-ROI behaviour flags (`movable`, `resizable`, `visible`, `pickable`, `deletable`)

**Data pipeline**
- `DataStore` — GPU typed-array buffers with 1.5× growth and no full reallocation;
  optional rolling ring buffer with count- and age-based expiration
- `PlotDataView` — lazily-evaluated, dirty-flag-cached derived views supporting domain
  filtering, ROI filtering, histograms, and deep snapshots, with correct dirty-cascade
  semantics (drag updates never trigger recompute; commits and external updates do)
- Shared `DataStore` / `PlotDataView` across multiple `PlotController` instances with
  explicit ownership tracking
- `ExternalDataAdapter` / `ExternalROIAdapter` integration contracts (plus mock
  implementations) as the engine's boundary for HTTP, WebSocket, or any other backend

**Bitmap, LUT & viewport-driven LOD**
- `BitmapDataLayer` — generic image/heatmap/tile layer accepting a URL, `ImageBitmap`,
  or typed-array grid, placed at an arbitrary data-space rectangle
- `BitmapViewGenerator` — debounced, viewport-aware regeneration/refetch of a
  `BitmapDataLayer` on every domain change, with local-generate and remote-fetch
  (`AbortSignal`-cancellable) modes
- `LUTController` (colormap + contrast window + histogram, 6 presets) and
  `LUTHistogramController` (draggable-handle histogram viewer); `LUTPanel` React
  convenience component in `ui/`

**Audio & signal analysis**
- `AudioController` — unified file/buffer loading, playback with seek and
  ~10 Hz `timeUpdate`, tiled STFT spectrogram computation, and a stateless filter bridge
- `FilterController` — offline biquad DSP (lowpass/highpass/bandpass/notch) with
  higher-order Butterworth via cascaded biquad sections
- `SignalStore` — multi-signal `PathLayer`-backed line plots with rolling-window trim

**Data loaders** (`loaders/`, optional peer-dependency footprint)
- `TableLoaderAdapter` — streaming CSV/TSV/Apache Arrow ingestion into a `DataStore`
- `RasterLoaderAdapter` — NetCDF3 and image ingestion into a `BitmapDataLayer`, with
  bounds inferred from coordinate arrays

**Utilities**
- `TraceGroup` — palette-cycling multi-trace scatter partitioner with per-trace
  visibility toggling
- `PopupWindowManager` / `usePopupChannel` — `BroadcastChannel`-synced detached panel
  windows

**Release engineering**
- Vitest test suite covering `ViewportController`, `ConstraintEngine`, ROI versioning,
  `DataStore`, `PlotDataView`, `AxisController`, `PlotController` construction, and the
  external integration adapters
- Hand-written TypeScript declarations for all three entry points (`masterplot`,
  `masterplot/ui`, `masterplot/loaders`) with a `tsc`-checked smoke test
- GitHub Actions CI quality gate (build → lint → test → typecheck) on every PR and push
  to `main`
- npm package metadata (`sideEffects: false`, `engines`, `repository`/`homepage`/`bugs`)
  and isolation of the `loaders.gl` dependency tree into optional peer dependencies so a
  plain install never pulls it in
- Input validation at every public-API boundary — `PlotController` constructor options,
  `DataStore.appendData()`, `ExternalDataAdapter`/`ExternalROIAdapter` subclass method
  overrides, and `ROIController.updateFromExternal()` — warn-and-fall-back or throw with a
  message naming the offending field, instead of a cryptic downstream failure
- `peerDependencies` ranges have a tested upper bound (e.g. `>=9 <10` for deck.gl/luma.gl)
  rather than an open-ended lower bound, so a future breaking peer major surfaces as an
  install-time warning instead of installing silently
