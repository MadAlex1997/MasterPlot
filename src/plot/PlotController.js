/**
 * PlotController — the central controller of MasterPlot.
 *
 * Owns all subsystems:
 *   - DataStore        (GPU buffers)
 *   - AxisController   (config-only: scale type, tick format, appearance) [ARCH-G]
 *   - ViewportController (coordinate transforms + domain state)            [ARCH-G]
 *   - ROIController    (ROI CRUD + interaction)
 *   - AxisRenderer     (canvas 2D overlay for ticks)
 *   - deck.gl Deck     (WebGL rendering)
 *
 * Render loop:
 *   requestAnimationFrame → render() → AxisRenderer.render() + deck.setProps()
 *
 * React is NOT involved in any rendering.  React only calls:
 *   plotController.init(webglCanvas, axisCanvas)
 *   plotController.appendData(chunk)
 *   plotController.destroy()
 *
 * ARCH-G: All domain mutations (setDomain, zoom, pan) now go through
 *   plotController.viewport.setXDomain() / .setYDomain() / .panByPixels() etc.
 *   AxisController instances are config-only and can be shared across plots.
 */

import { EventEmitter } from 'events';
import { Deck }         from '@deck.gl/core';
import { OrthographicView } from '@deck.gl/core';

import { DataStore }          from './DataStore.js';
import { ViewportController } from './ViewportController.js';
import { AxisController }     from './axes/AxisController.js';
import { AxisRenderer }       from './axes/AxisRenderer.js';
import {
  buildEpochTickFormatter,
  dataXToEpochSeconds as _dataXToEpochSeconds,
  epochSecondsToDataX as _epochSecondsToDataX,
} from './axes/epochTickFormat.js';
import { ROIController }      from './ROI/ROIController.js';
import { buildScatterLayer }  from './layers/ScatterLayer.js';
import { ROILayer }           from './layers/ROILayer.js';
import { PlotLayer }          from './layers/PlotLayer.js';
import { PolygonLayer }       from '@deck.gl/layers';

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

// F38: configurable mouse button bindings — defaults match pre-F38 hardcoded behavior
const DEFAULT_MOUSE_BUTTONS = { left: 'pan', middle: 'none', right: 'zoomDrag' };
const BUTTON_NAME_TO_CODE   = { left: 0, middle: 1, right: 2 };
const VALID_MOUSE_ACTIONS   = new Set(['pan', 'zoomDrag', 'rectZoom', 'none']);

// F41: configurable keybindings — unifies ROI-creation actions (forwarded to
// ROIController) and zoom/pan actions (handled here) under one map, mirroring
// F38's mouseButtons pattern. 'autoScale' replaces the old standalone
// autoScaleKey option; autoScaleKey is kept as a deprecated alias (see below).
const DEFAULT_KEY_BINDINGS = {
  createLinear: 'l', createRect: 'r', createVLine: 'v', createHLine: 'h',
  deleteROI: 'd', cancel: 'escape',
  autoScale: ' ',
  zoomIn: '=', zoomOut: '-',
  panLeft: 'arrowleft', panRight: 'arrowright', panUp: 'arrowup', panDown: 'arrowdown',
};
const ROI_KEY_ACTIONS  = new Set(['createLinear', 'createRect', 'createVLine', 'createHLine', 'deleteROI', 'cancel']);
const ZOOM_PAN_ACTIONS = new Set(['autoScale', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown']);
const VALID_KEY_ACTIONS = new Set([...ROI_KEY_ACTIONS, ...ZOOM_PAN_ACTIONS]);
const PAN_STEP_PX    = 40;
const ZOOM_IN_FACTOR  = 1.25;
const ZOOM_OUT_FACTOR = 0.8;

// F41: opt-in scale-preset keybinds — press a bound key to jump to a fixed
// view on one or both axes. No defaults (domain-specific); array, not part
// of keyBindings, since presets aren't a fixed action set.
function _validateScalePresets(presets) {
  if (presets === undefined) return [];
  if (!Array.isArray(presets)) {
    console.warn(`PlotController: "scalePresets" must be an array; got ${JSON.stringify(presets)}. Ignoring.`);
    return [];
  }
  const valid = [];
  const seenKeys = new Set();
  for (const p of presets) {
    if (!p || typeof p.bind !== 'string' || p.bind.length === 0) {
      console.warn(`PlotController: scalePresets entry missing a valid "bind" string; skipping: ${JSON.stringify(p)}`);
      continue;
    }
    const hasX = p.xMin !== undefined || p.xMax !== undefined;
    const hasY = p.yMin !== undefined || p.yMax !== undefined;
    if (!hasX && !hasY) {
      console.warn(`PlotController: scalePresets entry "${p.bind}" has neither an x nor y bound pair; skipping.`);
      continue;
    }
    const pairOk = (min, max) =>
      min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max) && min !== max;
    if (hasX && !pairOk(p.xMin, p.xMax)) {
      console.warn(`PlotController: scalePresets entry "${p.bind}" has an invalid xMin/xMax pair; skipping.`);
      continue;
    }
    if (hasY && !pairOk(p.yMin, p.yMax)) {
      console.warn(`PlotController: scalePresets entry "${p.bind}" has an invalid yMin/yMax pair; skipping.`);
      continue;
    }
    const key = p.bind.toLowerCase();
    if (seenKeys.has(key)) {
      console.warn(`PlotController: multiple scalePresets bind to "${key}"; the last one wins.`);
    }
    seenKeys.add(key);
    valid.push({ ...p, bind: key });
  }
  return valid;
}

// REL7: constructor option validation — extends F38's warn+fallback precedent
// to the rest of the public constructor surface.
const VALID_SCALE_TYPES = new Set(['linear', 'log', 'time']);
const VALID_PAN_MODES   = new Set(['drag', 'follow']);

/** REL7: validate a [min, max] domain option; warn + fall back on malformed input. */
function _validateDomain(domain, name, fallback) {
  if (domain === undefined) return fallback;
  const ok = Array.isArray(domain) && domain.length === 2
    && Number.isFinite(domain[0]) && Number.isFinite(domain[1])
    && domain[0] !== domain[1];
  if (!ok) {
    console.warn(
      `PlotController: invalid "${name}" option (expected [min, max] finite numbers with min !== max, ` +
      `got ${JSON.stringify(domain)}); falling back to ${JSON.stringify(fallback)}`
    );
    return fallback;
  }
  return domain;
}

/** REL7: validate a scaleType option ('linear'|'log'|'time'); warn + fall back to 'linear'. */
function _validateScaleType(scaleType, name) {
  if (scaleType === undefined) return undefined;
  if (!VALID_SCALE_TYPES.has(scaleType)) {
    console.warn(
      `PlotController: unknown "${name}" value ${JSON.stringify(scaleType)}; falling back to "linear"`
    );
    return 'linear';
  }
  return scaleType;
}

/** REL7: validate a panMode option ('drag'|'follow'); warn + fall back to 'drag'. */
function _validatePanMode(panMode) {
  if (panMode === undefined) return 'drag';
  if (!VALID_PAN_MODES.has(panMode)) {
    console.warn(
      `PlotController: unknown "panMode" value ${JSON.stringify(panMode)}; falling back to "drag"`
    );
    return 'drag';
  }
  return panMode;
}

export class PlotController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {AxisController} [opts.xAxis]       — shared config object; created from scaleType if absent
   * @param {AxisController} [opts.yAxis]       — shared config object; created from scaleType if absent
   * @param {string}  [opts.xScaleType='linear'] — used only when opts.xAxis is not supplied.
   *                                                 REL7: unrecognized value warns and falls back to 'linear'.
   * @param {string}  [opts.yScaleType='linear'] — used only when opts.yAxis is not supplied.
   *                                                 REL7: unrecognized value warns and falls back to 'linear'.
   * @param {string}  [opts.xLabel]             — convenience; sets xAxis.label when not sharing
   * @param {string}  [opts.yLabel]             — convenience; sets yAxis.label when not sharing
   * @param {Date|number} [opts.timeOrigin]     — F40: reference epoch (Date or epoch-ms).
   *                                                Activates epoch-offset high-precision time
   *                                                mode for the x-axis: x-domain/DataStore
   *                                                values are treated as small offsets from
   *                                                this reference (fits Float32Array precision;
   *                                                DataStore's x buffer can't hold an absolute
   *                                                epoch-seconds timestamp with sub-second
   *                                                precision — see dataXToEpochSeconds()).
   *                                                Undefined (default) leaves the feature off.
   *                                                X-axis only. If opts.xAxis is also supplied,
   *                                                the shared instance is never mutated — only
   *                                                the conversion helper methods become active;
   *                                                pass buildEpochTickFormatter() to your own
   *                                                xAxis's tickFormat if you want the labels too.
   * @param {'seconds'|'ms'} [opts.timeOriginUnits='seconds'] — F40: unit convention for x-domain
   *                                                offsets relative to timeOrigin.
   * @param {number[]} [opts.xDomain=[0,1]]     — REL7: malformed (not a 2-element finite-number array
   *                                                 with min !== max) warns and falls back to [0,1].
   * @param {number[]} [opts.yDomain=[0,100]]   — REL7: same validation as xDomain; falls back to [0,100].
   * @param {boolean} [opts.disableDefaultDataLayer=false]
   * @param {boolean} [opts.disablePanZoom=false]  — disable wheel zoom, right-drag zoom, pan,
   *                                                  and axis-drag zoom; ROI interaction still works
   * @param {object}  [opts.mouseButtons]          — F38: button→action map. Keys 'left'|'middle'|'right';
   *                                                  values 'pan'|'zoomDrag'|'rectZoom'|'none'.
   *                                                  Default: { left: 'pan', middle: 'none', right: 'zoomDrag' }.
   *                                                  F37's rect-zoom is opt-in — assign 'rectZoom' to a button to enable it.
   * @param {object}  [opts.keyBindings]           — F41: action→key map. Actions: 'createLinear'('l'),
   *                                                  'createRect'('r'), 'createVLine'('v'), 'createHLine'('h'),
   *                                                  'deleteROI'('d'), 'cancel'('escape') — forwarded to ROIController —
   *                                                  plus 'autoScale'(' '), 'zoomIn'('='), 'zoomOut'('-'),
   *                                                  'panLeft'('arrowleft'), 'panRight'('arrowright'),
   *                                                  'panUp'('arrowup'), 'panDown'('arrowdown'). Pass null for an
   *                                                  action to disable its key. Unrecognized keys warn + fall back.
   * @param {Array<{bind: string, xMin?: number, xMax?: number, yMin?: number, yMax?: number}>} [opts.scalePresets=[]]
   *   — F41: press `bind` to jump the view to the given bounds on whichever axis/axes are supplied;
   *     the other axis (or both, if omitted) is left at its current value. No defaults — fully opt-in.
   * @param {string|null} [opts.autoScaleKey]      — DEPRECATED, use keyBindings.autoScale instead.
   *                                                  Kept as a warn-once alias for backward compatibility.
   */
  constructor(opts = {}) {
    super();

    this._opts = opts;

    // ── Subsystems ──────────────────────────────────────────────────────────
    // F17: accept external DataStore / DataView injection; track ownership
    this._dataStore     = opts.dataStore || new DataStore();
    this._ownsDataStore = !opts.dataStore;
    this._dataView      = opts.dataView  || null;
    this._ownsDataView  = !opts.dataView;
    this._viewport      = new ViewportController();

    // ARCH-A: pluggable data layer registry (insertion order = deck.gl stack order)
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

    // Bound handlers for DataView event cleanup
    this._onDataViewDirty      = () => { this._dirty = true; };
    this._onDataViewRecomputed = () => { this._dataTrigger++; };

    // F40: epoch-offset high-precision time axis — resolve the reference time and
    // build its tick formatter *before* constructing the default xAxis, since
    // AxisController resolves its formatter once at construction time and has no
    // post-hoc setter (config-only, shareable-across-plots, per ARCH-G).
    this._timeOriginMs = opts.timeOrigin !== undefined
      ? (opts.timeOrigin instanceof Date ? opts.timeOrigin.getTime() : opts.timeOrigin)
      : null;
    this._unitsPerSecond = opts.timeOriginUnits === 'ms' ? 1000 : 1;

    let _epochTickFormat = null;
    if (this._timeOriginMs !== null) {
      if (opts.xAxis) {
        console.warn(
          'PlotController: both "xAxis" and "timeOrigin" were supplied; the shared xAxis ' +
          'instance will not be mutated. Pass buildEpochTickFormatter() (from ' +
          '"masterplot") as that AxisController\'s own tickFormat if you want epoch-offset labels.'
        );
      } else {
        _epochTickFormat = buildEpochTickFormatter({
          timeOriginMs: this._timeOriginMs,
          unitsPerSecond: this._unitsPerSecond,
        });
      }
    }

    // ARCH-G: AxisController is config-only.  Accept a shared instance or create a default.
    this._xAxis = opts.xAxis || new AxisController({
      scaleType: _validateScaleType(opts.xScaleType, 'xScaleType') || 'linear',
      label:     opts.xLabel     || null,
      tickFormat: _epochTickFormat,
    });
    this._yAxis = opts.yAxis || new AxisController({
      scaleType: _validateScaleType(opts.yScaleType, 'yScaleType') || 'linear',
      label:     opts.yLabel     || null,
    });

    // Convenience: set label from opts even when a shared xAxis was passed
    // (only if the shared instance has no label of its own)
    if (opts.xLabel && !this._xAxis.label) this._xAxis.label = opts.xLabel;
    if (opts.yLabel && !this._yAxis.label) this._yAxis.label = opts.yLabel;

    // Wire axis config into viewport; set initial domains (silently, no event yet)
    this._viewport._xDomain = _validateDomain(opts.xDomain, 'xDomain', [0, 1]);
    this._viewport._yDomain = _validateDomain(opts.yDomain, 'yDomain', [0, 100]);
    this._viewport.setAxisConfig(this._xAxis, this._yAxis);

    // F41: unified keyBindings — build before constructing ROIController so we
    // can pass it the ROI-relevant slice.
    this._keyBindings = null;
    this._setKeyBindingMap(opts.keyBindings);

    // F23/F41: autoScaleKey is deprecated in favor of keyBindings.autoScale,
    // kept as a warn-once alias for backward compatibility (published API).
    if (opts.autoScaleKey !== undefined && (!opts.keyBindings || opts.keyBindings.autoScale === undefined)) {
      console.warn(
        'PlotController: "autoScaleKey" is deprecated; use keyBindings.autoScale instead. ' +
        `Mapping autoScaleKey (${JSON.stringify(opts.autoScaleKey)}) into keyBindings.autoScale.`
      );
      this._keyBindings.autoScale = opts.autoScaleKey
        ? String(opts.autoScaleKey).toLowerCase()
        : null; // falsy (null/''/undefined-after-check) disables, matching old semantics
    }

    // F41: opt-in scale-preset keybinds — no defaults, fully user-supplied.
    this._scalePresets = _validateScalePresets(opts.scalePresets);
    this._scalePresetMap = new Map(this._scalePresets.map(p => [p.bind, p]));

    this._roiController = new ROIController(this._viewport, { keyBindings: this._pickRoiKeyBindings() });

    // Canvas references (set during init)
    this._webglCanvas = null;
    this._axisCanvas  = null;
    this._deck        = null;
    this._axisRenderer = null;

    // Render loop
    this._rafId       = null;
    this._dirty       = true;  // flag: re-render next frame

    // Data trigger counter for deck.gl updateTriggers
    this._dataTrigger = 0;

    // Auto-expand domain when new data is appended
    this._autoExpand = opts.autoExpand ?? true;

    // Axis style overrides applied after init()
    this._hideXAxis = opts.hideXAxis ?? false;
    this._bordered  = opts.bordered  ?? true;   // F34: default on — gutters are opaque by default

    // Zoom/pan interaction state
    this._isPanning    = false;
    this._panStart     = null;  // { screenX, screenY, xDomain, yDomain }

    // F4: pan mode toggle
    this._panMode = _validatePanMode(opts.panMode);

    // F7: follow pan speed — runtime-tunable (default matches original hardcoded value)
    this._followPanSpeed = 0.02;

    // F5: follow pan velocity — current cursor position updated each mousemove
    this._panCurrentPos = null;  // { x, y }

    // F6: right-click drag zoom state
    this._isRightDragging = false;
    this._rightDragStart  = null;  // { x, y, xDomain, yDomain }
    this._onContextMenu   = e => e.preventDefault();

    // F21: axis drag zoom state
    this._isAxisDragging = false;
    this._axisDragAxis   = null;   // 'x' | 'y'
    this._axisDragStart  = null;   // { x, y, xDomain, yDomain }

    // F37: rect zoom — middle-click drag draws a rectangle, zooms to it on release.
    // Enabled/disabled purely via F38's mouseButtons mapping (no separate flag).
    this._isRectZooming   = false;
    this._rectZoomStart   = null;  // { x, y } screen pixels
    this._rectZoomCurrent = null;  // { x, y } screen pixels

    // F38: configurable mouse button bindings — this._buttonActions: { [buttonCode]: action }
    this._buttonActions = null;
    this._setMouseButtonMap(opts.mouseButtons);

    // F28: disable pan/zoom (used by LUTHistogramController's internal PlotController)
    this._disablePanZoom = opts.disablePanZoom ?? false;

    // F23: auto-scale / home domain
    this._homeDomain   = { x: null, y: null };
    this._onKeyDown    = null;  // assigned in init()

    // Bound event handlers for cleanup
    this._onWheel      = this._onWheel.bind(this);
    this._onMouseDown  = this._onMouseDown.bind(this);
    this._onMouseMove  = this._onMouseMove.bind(this);
    this._onMouseUp    = this._onMouseUp.bind(this);
    this._onResize     = this._onResize.bind(this);

    // Wire up subsystem events → re-emit on self
    this._wireEvents();
  }

  // ─── Initialization ────────────────────────────────────────────────────────

  /**
   * Initialize deck.gl and axis renderer.  Must be called once the canvases
   * are in the DOM.
   *
   * @param {HTMLCanvasElement} webglCanvas
   * @param {HTMLCanvasElement} axisCanvas
   */
  init(webglCanvas, axisCanvas) {
    this._webglCanvas = webglCanvas;
    this._axisCanvas  = axisCanvas;

    const w = webglCanvas.offsetWidth  || webglCanvas.width  || 800;
    const h = webglCanvas.offsetHeight || webglCanvas.height || 600;

    this._resize(w, h);

    // Initialize deck.gl
    this._deck = new Deck({
      canvas: webglCanvas,
      width:  w,
      height: h,
      views:  [new OrthographicView({ id: 'ortho', controller: false, flipY: false })],
      viewState: this._buildViewState(),
      layers: [],
      controller: false, // we handle events ourselves
      onWebGLInitialized: () => {
        this._dirty = true;
      },
    });

    // Initialize axis renderer
    this._axisRenderer = new AxisRenderer(axisCanvas, this._xAxis, this._yAxis, this._viewport);
    if (this._hideXAxis) this._axisRenderer.setStyle({ hideXAxis: true });
    if (this._bordered)  this._axisRenderer.setBordered(true);  // F34

    // Initialize ROI controller (attaches canvas listeners)
    this._roiController.init(webglCanvas);

    // Attach zoom/pan listeners (before ROI so priority is correct)
    webglCanvas.addEventListener('contextmenu', this._onContextMenu);
    if (!this._disablePanZoom) {
      webglCanvas.addEventListener('wheel', this._onWheel, { passive: false });
    }
    webglCanvas.addEventListener('mousedown', this._onMouseDown);
    webglCanvas.addEventListener('mousemove', this._onMouseMove);
    webglCanvas.addEventListener('mouseup',   this._onMouseUp);
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this._webglCanvas.parentElement);

    // F23/F41: autoScale + keyboard zoom/pan + scale presets (skipped when pan/zoom is disabled)
    if (!this._disablePanZoom) {
      this._onKeyDown = (e) => {
        if (e.repeat) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

        const k = e.key.toLowerCase();
        const kb = this._keyBindings;

        if (k === kb.autoScale) { e.preventDefault(); this.autoScale(); return; }
        if (k === kb.zoomIn) {
          e.preventDefault();
          this._viewport.scaleDomainFromMidpointX(ZOOM_IN_FACTOR);
          this._viewport.scaleDomainFromMidpointY(ZOOM_IN_FACTOR);
          this._dirty = true;
          return;
        }
        if (k === kb.zoomOut) {
          e.preventDefault();
          this._viewport.scaleDomainFromMidpointX(ZOOM_OUT_FACTOR);
          this._viewport.scaleDomainFromMidpointY(ZOOM_OUT_FACTOR);
          this._dirty = true;
          return;
        }
        // Camera pans toward the arrow (matches F5 follow-pan's precedent, not
        // grab-drag's opposite metaphor) — see prompt.md's Y-axis Coordinate
        // Convention section for the sign derivation.
        if (k === kb.panLeft)  { e.preventDefault(); this._viewport.panByPixels({ dx:  PAN_STEP_PX }); this._dirty = true; return; }
        if (k === kb.panRight) { e.preventDefault(); this._viewport.panByPixels({ dx: -PAN_STEP_PX }); this._dirty = true; return; }
        if (k === kb.panUp)    { e.preventDefault(); this._viewport.panByPixels({ dy:  PAN_STEP_PX }); this._dirty = true; return; }
        if (k === kb.panDown)  { e.preventDefault(); this._viewport.panByPixels({ dy: -PAN_STEP_PX }); this._dirty = true; return; }

        // F41: scale presets — jump to a fixed view on one or both axes.
        const preset = this._scalePresetMap.get(k);
        if (preset) {
          e.preventDefault();
          const xDomain = preset.xMin !== undefined ? [preset.xMin, preset.xMax] : this._viewport.getXDomain();
          const yDomain = preset.yMin !== undefined ? [preset.yMin, preset.yMax] : this._viewport.getYDomain();
          this._viewport.setDomains(xDomain, yDomain);
          this._dirty = true;
        }
      };
      window.addEventListener('keydown', this._onKeyDown);
    }

    // Start render loop
    this._scheduleRender();
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);

    if (this._webglCanvas) {
      this._webglCanvas.removeEventListener('contextmenu', this._onContextMenu);
      this._webglCanvas.removeEventListener('wheel',     this._onWheel);
      this._webglCanvas.removeEventListener('mousedown', this._onMouseDown);
      this._webglCanvas.removeEventListener('mousemove', this._onMouseMove);
      this._webglCanvas.removeEventListener('mouseup',   this._onMouseUp);
    }
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    if (this._onKeyDown) window.removeEventListener('keydown', this._onKeyDown);

    this._roiController.destroy();

    if (this._deck) {
      this._deck.finalize();
      this._deck = null;
    }

    // F17: only destroy owned resources; external shared resources stay alive
    if (this._ownsDataView && this._dataView && this._dataView.destroy) {
      this._dataView.destroy();
    }
    if (this._ownsDataStore && this._dataStore && this._dataStore.destroy) {
      this._dataStore.destroy();
    }
  }

  // ─── Data ──────────────────────────────────────────────────────────────────

  /**
   * Append new point data.  GPU buffers are updated; re-render is scheduled.
   *
   * @param {object} chunk — see DataStore.appendData()
   */
  appendData(chunk) {
    this._dataStore.appendData(chunk);
    this._dataTrigger++;

    if (this._dataStore._rollingEnabled) {
      const prevCount = this._dataStore.getPointCount();
      this._dataStore.expireIfNeeded();
      // If points were expired and auto-expand is on, recalc domain from surviving data
      if (this._autoExpand && this._dataStore.getPointCount() < prevCount) {
        this._recalcDomainFromStore();
      } else if (this._autoExpand) {
        this._autoExpandDomain(chunk);
      }
    } else if (this._autoExpand) {
      this._autoExpandDomain(chunk);
    }

    this._dirty = true;
    this.emit('dataAppended', { count: chunk.x.length, total: this._dataStore.getPointCount() });
  }

  /** Toggle whether new data appended via appendData() expands the visible domain. */
  setAutoExpand(enabled) {
    this._autoExpand = !!enabled;
  }

  /** @param {'follow'|'drag'} mode */
  setPanMode(mode) {
    this._panMode = _validatePanMode(mode);
  }

  /** @param {number} speed  Tuning range: 0.005 – 0.1 */
  setFollowPanSpeed(speed) {
    this._followPanSpeed = Math.max(0.001, Number(speed));
  }

  /**
   * F38: remap which mouse button drives which interaction.
   * Assign 'rectZoom' to a button to enable F37's rect-zoom (opt-in; no
   * button has it by default); assign 'none' to disable a button entirely.
   * @param {object} [cfg] — partial override of { left, middle, right }; unspecified
   *   buttons keep their default action. Unrecognized action names fall back to
   *   the default for that button (with a console warning).
   */
  setMouseButtons(cfg) {
    this._setMouseButtonMap(cfg);

    // Cancel any in-progress drag — its originating button may no longer map
    // to the action that started it.
    this._isPanning       = false;
    this._panStart        = null;
    this._panCurrentPos   = null;
    this._isRightDragging = false;
    this._rightDragStart  = null;
    this._isRectZooming   = false;
    this._rectZoomStart   = null;
    this._rectZoomCurrent = null;
    this._isAxisDragging  = false;
    this._axisDragAxis    = null;
    this._axisDragStart   = null;
    this._dirty = true;
  }

  /** F38: internal — build the buttonCode→action lookup table from a { left, middle, right } config. */
  _setMouseButtonMap(cfg) {
    const merged = { ...DEFAULT_MOUSE_BUTTONS, ...(cfg || {}) };
    const map = {};
    for (const [name, code] of Object.entries(BUTTON_NAME_TO_CODE)) {
      let action = merged[name];
      if (!VALID_MOUSE_ACTIONS.has(action)) {
        console.warn(
          `PlotController: unknown mouseButtons action "${action}" for "${name}"; ` +
          `falling back to default "${DEFAULT_MOUSE_BUTTONS[name]}"`
        );
        action = DEFAULT_MOUSE_BUTTONS[name];
      }
      map[code] = action;
    }
    this._buttonActions = map;
  }

  // ─── F41: Configurable keybindings ─────────────────────────────────────────

  /**
   * Remap ROI-creation and/or zoom/pan keybinds at runtime. Partial override,
   * merged over DEFAULT_KEY_BINDINGS (same "merge over the default" semantics
   * as setMouseButtons()). Pass null for an action's key to disable it.
   * @param {object} patch — subset of DEFAULT_KEY_BINDINGS's keys
   */
  setKeyBindings(patch) {
    this._setKeyBindingMap(patch);
    this._roiController.setKeyBindings(this._pickRoiKeyBindings());
  }

  /** @private */
  _setKeyBindingMap(cfg) {
    const merged = { ...DEFAULT_KEY_BINDINGS, ...(cfg || {}) };
    const map = {};
    const seen = new Map();

    for (const action of VALID_KEY_ACTIONS) {
      let key = merged[action];
      if (key === null) {
        map[action] = null;
        continue;
      }
      if (typeof key !== 'string' || key.length === 0) {
        console.warn(
          `PlotController: invalid keyBindings.${action} value ${JSON.stringify(merged[action])}; ` +
          `falling back to default "${DEFAULT_KEY_BINDINGS[action]}"`
        );
        key = DEFAULT_KEY_BINDINGS[action];
      }
      key = key.toLowerCase();
      map[action] = key;

      const prior = seen.get(key);
      if (prior) {
        console.warn(`PlotController: keyBindings "${prior}" and "${action}" both bind to "${key}"; both will fire on that keypress.`);
      }
      seen.set(key, action);
    }

    if (cfg) {
      for (const action of Object.keys(cfg)) {
        if (!VALID_KEY_ACTIONS.has(action)) {
          console.warn(`PlotController: unknown keyBindings action "${action}"; ignored.`);
        }
      }
    }

    this._keyBindings = map;
  }

  /** @private */
  _pickRoiKeyBindings() {
    const roi = {};
    for (const action of ROI_KEY_ACTIONS) roi[action] = this._keyBindings[action];
    return roi;
  }

  /**
   * F41: replace the scale-presets array at runtime. Unlike setKeyBindings()/
   * setMouseButtons(), this REPLACES the whole array rather than merging —
   * presets have no meaningful default array to merge against.
   * @param {Array<{bind: string, xMin?: number, xMax?: number, yMin?: number, yMax?: number}>} presets
   */
  setScalePresets(presets) {
    this._scalePresets = _validateScalePresets(presets);
    this._scalePresetMap = new Map(this._scalePresets.map(p => [p.bind, p]));
  }

  // ─── F23: Auto-scale ───────────────────────────────────────────────────────

  /**
   * Fit both axes to the full extent of current data (+ 5 % padding each side).
   * If setHomeDomain() was called with both x and y non-null, those exact bounds are used.
   * Emits 'autoScaled' with { xDomain, yDomain }.
   */
  autoScale() {
    let xDomain, yDomain;
    if (this._homeDomain.x !== null && this._homeDomain.y !== null) {
      xDomain = this._homeDomain.x;
      yDomain = this._homeDomain.y;
    } else {
      const data = this._dataStore.getLogicalData();
      const n = data.x.length;
      if (n === 0) return;
      let xMin = Infinity, xMax = -Infinity, yMin = Infinity, yMax = -Infinity;
      for (let i = 0; i < n; i++) {
        if (data.x[i] < xMin) xMin = data.x[i];
        if (data.x[i] > xMax) xMax = data.x[i];
        if (data.y[i] < yMin) yMin = data.y[i];
        if (data.y[i] > yMax) yMax = data.y[i];
      }

      const xIsLog = this._xAxis.scaleType === 'log';
      const yIsLog = this._yAxis.scaleType === 'log';

      // For log axes, pad in log10 space so 5% reads as equal visual padding
      // and the resulting domain always stays strictly positive.
      if (xIsLog) {
        const lo = Math.log10(Math.max(xMin, 1e-10));
        const hi = Math.log10(Math.max(xMax, 1e-10));
        const pad = (hi - lo) * 0.05 || 0.05;
        xDomain = [10 ** (lo - pad), 10 ** (hi + pad)];
      } else {
        const xPad = (xMax - xMin) * 0.05 || 0.05;
        xDomain = [xMin - xPad, xMax + xPad];
      }

      if (yIsLog) {
        const lo = Math.log10(Math.max(yMin, 1e-10));
        const hi = Math.log10(Math.max(yMax, 1e-10));
        const pad = (hi - lo) * 0.05 || 0.05;
        yDomain = [10 ** (lo - pad), 10 ** (hi + pad)];
      } else {
        const yPad = (yMax - yMin) * 0.05 || 0.05;
        yDomain = [yMin - yPad, yMax + yPad];
      }
    }
    this._viewport.setDomains(xDomain, yDomain);
    this._dirty = true;
    this.emit('autoScaled', { xDomain, yDomain });
  }

  /**
   * Register an explicit home domain used by autoScale().
   * autoScale() uses home domains only when BOTH x and y are non-null.
   *
   * @param {number[]|null} xDomain — e.g. [0, 10], or null to compute from data
   * @param {number[]|null} yDomain — e.g. [0, 100], or null to compute from data
   */
  setHomeDomain(xDomain, yDomain) {
    this._homeDomain = { x: xDomain ?? null, y: yDomain ?? null };
  }

  // ─── Zoom / Pan ────────────────────────────────────────────────────────────

  /**
   * Zoom around a focal data point (both axes).
   * Called by PlotController's own wheel handler.
   */
  setZoom(factor, focalScreenX, focalScreenY) {
    const focalDataX = this._viewport.screenXToData(focalScreenX);
    const focalDataY = this._viewport.screenYToData(focalScreenY);

    this._viewport.zoomAround(focalDataX, focalDataY, factor);
    this._dirty = true;
    this.emit('zoomChanged', { factor, focalDataX, focalDataY });
  }

  // ─── Public access ─────────────────────────────────────────────────────────

  get dataStore()      { return this._dataStore; }
  /** Config-only AxisController for the x axis (scale type, tick format, label). */
  get xAxis()          { return this._xAxis;     }
  /** Config-only AxisController for the y axis. */
  get yAxis()          { return this._yAxis;     }
  /** ViewportController — owns domain state and all zoom/pan mutations. */
  get viewport()       { return this._viewport;  }
  get roiController()  { return this._roiController; }

  // ─── F40: epoch-offset high-precision time conversion ─────────────────────

  /**
   * Convert a data-x offset value into an absolute epoch-seconds timestamp,
   * computed entirely in JS double precision (never touches a Float32 buffer,
   * so no precision loss at the point of use/display). Requires `timeOrigin`
   * to have been set at construction.
   *
   * @param {number} x
   * @returns {number} epoch seconds (double precision)
   */
  dataXToEpochSeconds(x) {
    if (this._timeOriginMs === null) {
      throw new Error('PlotController.dataXToEpochSeconds(): "timeOrigin" was not set at construction.');
    }
    return _dataXToEpochSeconds(x, this._timeOriginMs, this._unitsPerSecond);
  }

  /**
   * Inverse of dataXToEpochSeconds() — convert an absolute epoch-seconds
   * timestamp into the small offset value to feed into DataStore.appendData()
   * or an ROI position, so it stays precise once written into a Float32Array.
   *
   * @param {number} epochSeconds
   * @returns {number}
   */
  epochSecondsToDataX(epochSeconds) {
    if (this._timeOriginMs === null) {
      throw new Error('PlotController.epochSecondsToDataX(): "timeOrigin" was not set at construction.');
    }
    return _epochSecondsToDataX(epochSeconds, this._timeOriginMs, this._unitsPerSecond);
  }

  /**
   * Convenience: data-x offset → Date. Millisecond precision only (Date can't
   * hold sub-ms) — prefer dataXToEpochSeconds() for full-precision display.
   *
   * @param {number} x
   * @returns {Date}
   */
  dataXToDate(x) {
    return new Date(this.dataXToEpochSeconds(x) * 1000);
  }

  /**
   * Swap the active DataView at runtime.
   * The previous DataView is destroyed if it was owned by this controller.
   *
   * @param {import('./PlotDataView').PlotDataView|null} dataView
   * @param {boolean} [owns=true] — pass false when sharing a view across controllers
   */
  setDataView(dataView, owns = true) {
    // Tear down old view listeners and destroy if owned
    if (this._dataView) {
      this._dataView.removeListener('dirty',      this._onDataViewDirty);
      this._dataView.removeListener('recomputed', this._onDataViewRecomputed);
      if (this._ownsDataView && this._dataView.destroy) {
        this._dataView.destroy();
      }
    }

    this._dataView     = dataView;
    this._ownsDataView = owns;

    if (this._dataView) {
      this._dataView.on('dirty',      this._onDataViewDirty);
      this._dataView.on('recomputed', this._onDataViewRecomputed);
    }

    this._dirty = true;
  }

  // ─── ARCH-A: Data layer registration ──────────────────────────────────────

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

  /**
   * Schedule a re-render on the next RAF tick.
   * Call this when external state (e.g. TraceGroup visibility) changes
   * without going through a DataStore or ROI event.
   */
  markDirty() {
    this._dirty = true;
  }

  // ─── Export placeholder (v2) ───────────────────────────────────────────────

  exportPNG(options = {}) {
    const { hideAxes = false } = options;
    if (hideAxes) this._axisRenderer.exportMode(true);
    // TODO (v2): offscreen canvas + WebGL readPixels + axis canvas composite
    console.warn('exportPNG: v2 feature, not yet implemented');
    if (hideAxes) this._axisRenderer.exportMode(false);
  }

  // ─── Internal: render loop ─────────────────────────────────────────────────

  _scheduleRender() {
    this._rafId = requestAnimationFrame(() => {
      // F5: follow pan velocity tick — runs every frame while panning in follow mode
      if (this._isPanning && this._panMode === 'follow' && this._panCurrentPos && this._panStart) {
        const dx   = this._panCurrentPos.x - this._panStart.screenX;
        const dy   = this._panCurrentPos.y - this._panStart.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const DEAD_ZONE = 5;
        if (dist > DEAD_ZONE) {
          this._viewport.panByPixels({
            dx: -dx * this._followPanSpeed,
            dy: -dy * this._followPanSpeed, // inverted y range handles sign automatically
          });
          this._dirty = true;
          this.emit('panChanged', {
            dx: Math.round(-dx * this._followPanSpeed),
            dy: Math.round( dy * this._followPanSpeed),
          });
        }
      }

      if (this._dirty) {
        this._render();
        this._dirty = false;
      }
      this._scheduleRender();
    });
  }

  _render() {
    if (!this._deck) return;

    // F17: use DataView when present (authoritative GPU source); else fall back to DataStore
    const gpuAttrs = this._dataView
      ? this._dataView.getData()
      : this._dataStore.getGPUAttributes();
    const rois          = this._roiController.getAllROIs();
    const [xMin, xMax]  = this._viewport.getXDomain();
    const [yMin, yMax]  = this._viewport.getYDomain();
    const xIsLog = this._xAxis.scaleType === 'log';
    const yIsLog = this._yAxis.scaleType === 'log';

    // Build registered data layers (ARCH-A)
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

    const roiLayer = new ROILayer({
      id:       'roi-layer',
      rois,
      plotXMin: xMin,
      plotXMax: xMax,
      plotYMin: yMin,
      plotYMax: yMax,
      xIsLog,
      yIsLog,
    });

    // ARCH-B: when opts.usePlotLayer is set, wrap everything in a single CompositeLayer
    const deckLayers = this._opts.usePlotLayer
      ? [new PlotLayer({ id: 'plot-layer', dataLayers: layers, roiLayer })]
      : [...layers, roiLayer];

    // F37: live rect-zoom drag rectangle, drawn on top of everything else
    const rectZoomLayer = this._buildRectZoomLayer();
    if (rectZoomLayer) deckLayers.push(rectZoomLayer);

    this._deck.setProps({
      viewState: this._buildViewState(),
      layers: deckLayers,
    });

    // Render axis overlay (pass rois so LineROI labels are drawn on canvas)
    if (this._axisRenderer) {
      this._axisRenderer.render(rois);
    }
  }

  // ─── Internal: coordinate / scale sync ────────────────────────────────────

  _resize(width, height) {
    this._viewport.setCanvasSize(width, height);
    const { plotArea: pa } = this._viewport;

    // Set axis pixel ranges on viewport
    this._viewport.setXRange([pa.x, pa.x + pa.width]);
    // y axis: screen y increases downward → invert range so data-y=0 is at bottom
    this._viewport.setYRange([pa.y + pa.height, pa.y]);
  }

  _buildViewState() {
    const [xMin, xMax] = this._viewport.getXDomain();
    const [yMin, yMax] = this._viewport.getYDomain();

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

    const tx = deckXMin + (W / 2 - marginLeft) * xSpan / pa.width;
    const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;

    return {
      id:     'ortho',
      target: [tx, ty, 0],
      zoom:   [zoomX, zoomY],
    };
  }

  _autoExpandDomain(chunk) {
    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    const xs = chunk.x;
    const ys = chunk.y;
    for (let i = 0; i < xs.length; i++) {
      if (xs[i] < xMin) xMin = xs[i];
      if (xs[i] > xMax) xMax = xs[i];
      if (ys[i] < yMin) yMin = ys[i];
      if (ys[i] > yMax) yMax = ys[i];
    }

    const [curXMin, curXMax] = this._viewport.getXDomain();
    const [curYMin, curYMax] = this._viewport.getYDomain();

    let newX = null, newY = null;
    if (xMin < curXMin || xMax > curXMax) {
      newX = [Math.min(xMin, curXMin), Math.max(xMax, curXMax)];
    }
    if (yMin < curYMin || yMax > curYMax) {
      newY = [Math.min(yMin, curYMin), Math.max(yMax, curYMax)];
    }

    if (newX || newY) {
      this._viewport.setDomains(newX, newY);
      this.emit('domainChanged', {
        xDomain: this._viewport.getXDomain(),
        yDomain: this._viewport.getYDomain(),
      });
    }
  }

  /**
   * Recalculate axis domains by scanning all surviving logical data.
   * Used after rolling expiration when some points have been evicted.
   */
  _recalcDomainFromStore() {
    const data = this._dataStore.getLogicalData();
    const n = data.x.length;
    if (n === 0) return;

    let xMin = Infinity, xMax = -Infinity;
    let yMin = Infinity, yMax = -Infinity;

    for (let i = 0; i < n; i++) {
      if (data.x[i] < xMin) xMin = data.x[i];
      if (data.x[i] > xMax) xMax = data.x[i];
      if (data.y[i] < yMin) yMin = data.y[i];
      if (data.y[i] > yMax) yMax = data.y[i];
    }

    this._viewport.setDomains([xMin, xMax], [yMin, yMax]);
    this.emit('domainChanged', {
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain(),
    });
  }

  // ─── Internal: wheel zoom ─────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();

    const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(screenX, screenY)) return;

    // Normalize delta across browsers
    const delta  = e.deltaY || e.detail || -e.wheelDelta;
    const factor = delta > 0 ? 0.85 : 1 / 0.85;  // zoom in or out

    this.setZoom(factor, screenX, screenY);
  }

  // ─── Internal: pan ────────────────────────────────────────────────────────

  _onMouseDown(e) {
    // F38: resolve the action bound to whichever button was pressed
    const action = this._buttonActions[e.button];
    if (action === undefined) return; // unmapped button (e.g. browser back/forward)

    // F6: right-drag zoom
    if (action === 'zoomDrag') {
      if (!this._disablePanZoom) this._handleRightDown(e);
      return;
    }

    // F37: rect zoom drag-to-zoom
    if (action === 'rectZoom') {
      if (!this._disablePanZoom) {
        e.preventDefault(); // block native middle-click autoscroll cursor
        this._handleRectZoomDown(e);
      }
      return;
    }

    if (action !== 'pan') return; // 'none' — no-op

    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);

    // F21: axis drag — must be checked before ROI / plot-area guards because
    // axis gutters are outside the plot area.
    if (!this._disablePanZoom && this._axisRenderer && this._roiController._mode === 'idle') {
      const axisHit = this._axisRenderer.getAxisHit(pos.x, pos.y);
      if (axisHit) {
        this._isAxisDragging = true;
        this._axisDragAxis   = axisHit;
        this._axisDragStart  = {
          x: pos.x, y: pos.y,
          xDomain: this._viewport.getXDomain(),
          yDomain: this._viewport.getYDomain(),
        };
        return;
      }
    }

    if (this._roiController._mode !== 'idle') return; // ROI creation takes priority
    if (this._roiController._hitTest) {
      const { x: screenX, y: screenY } = { x: pos.x, y: pos.y };
      if (this._roiController._hitTest(screenX, screenY)) return;
    }

    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;

    if (this._disablePanZoom) return; // ROI hit-test ran; no pan/zoom

    this._handlePanDown(pos);
  }

  _onMouseMove(e) {
    // F6: handle right-click drag zoom (independent of pan)
    if (this._isRightDragging) { this._handleRightMove(e); }

    // F37: rect zoom drag — mutually exclusive with plot pan
    if (this._isRectZooming) { this._handleRectZoomMove(e); return; }

    // F21: axis drag zoom — mutually exclusive with plot pan
    if (this._isAxisDragging) { this._handleAxisDragMove(e); return; }

    if (!this._isPanning || !this._panStart) return;

    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    this._handlePanMove(pos);
  }

  _onMouseUp(e) {
    // F38: resolve the action bound to whichever button was released
    const action = this._buttonActions[e.button];

    // F6: clear right-click drag zoom state
    if (action === 'zoomDrag' && this._isRightDragging) {
      this._isRightDragging = false;
      this._rightDragStart  = null;
    }
    // F21: clear axis drag zoom state
    if (this._isAxisDragging) {
      this._isAxisDragging = false;
      this._axisDragAxis   = null;
      this._axisDragStart  = null;
    }
    // F37: commit rect zoom drag
    if (action === 'rectZoom' && this._isRectZooming) {
      this._handleRectZoomUp();
    }
    if (action === 'pan' && this._isPanning) {
      this._isPanning     = false;
      this._panStart      = null;
      this._panCurrentPos = null;  // F5: stop velocity pan
    }
  }

  // F4/F5: pan mousedown — start pan (drag or follow, per this._panMode)
  _handlePanDown(pos) {
    this._isPanning = true;
    this._panStart  = {
      screenX:  pos.x,
      screenY:  pos.y,
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain(),
    };
    // F5: track current cursor position for velocity pan
    this._panCurrentPos = { x: pos.x, y: pos.y };
  }

  // F4/F5: pan mousemove — apply drag pan immediately, or track position for follow pan
  _handlePanMove(pos) {
    if (this._panMode === 'drag') {
      // F4: drag pan — restore start domains then re-apply pixel delta (avoids float drift)
      const dx = pos.x - this._panStart.screenX;
      const dy = pos.y - this._panStart.screenY;
      this._viewport.setDomains(this._panStart.xDomain, this._panStart.yDomain);
      this._viewport.panByPixels({ dx, dy });
      this._dirty = true;
      this.emit('panChanged', { dx, dy });
    } else {
      // F5: follow pan — just track position; RAF velocity tick does the work
      this._panCurrentPos = { x: pos.x, y: pos.y };
    }
  }

  // F6: right-click mousedown — start drag zoom if inside plot area
  _handleRightDown(e) {
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
    this._isRightDragging = true;
    this._rightDragStart  = {
      x: pos.x, y: pos.y,
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain(),
    };
  }

  // F6: right-click drag — zoom centred on the right-click origin
  _handleRightMove(e) {
    if (!this._rightDragStart) return;
    const pos     = this._viewport.getCanvasPosition(e, this._webglCanvas);
    const totalDy = pos.y - this._rightDragStart.y;
    // drag up (totalDy<0) → factor<1 → zoom in
    const factor = Math.pow(0.992, -totalDy);
    // Restore initial domains to avoid float drift
    this._viewport.setDomains(this._rightDragStart.xDomain, this._rightDragStart.yDomain);
    // Focal point in data space at the right-click origin
    const focalDataX = this._viewport.screenXToData(this._rightDragStart.x);
    const focalDataY = this._viewport.screenYToData(this._rightDragStart.y);
    this._viewport.zoomAround(focalDataX, focalDataY, factor);
    this._dirty = true;
    this.emit('zoomChanged', { factor, focalDataX, focalDataY });
  }

  // F21: axis drag — zoom axis domain centered on its midpoint
  _handleAxisDragMove(e) {
    if (!this._axisDragStart || !this._axisDragAxis) return;

    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    const dx  = pos.x - this._axisDragStart.x;
    const dy  = pos.y - this._axisDragStart.y;

    // Sign convention (matches spec table):
    //   X axis — drag left  (dx < 0) → zoom in  (factor > 1)
    //   Y axis — drag down  (dy > 0) → zoom in  (factor > 1)
    const SENSITIVITY = 0.01;
    const axis        = this._axisDragAxis;
    const delta       = axis === 'x' ? -dx : dy;
    const zoomFactor  = Math.exp(delta * SENSITIVITY);

    // Restore initial domains before re-applying to prevent float drift
    this._viewport.setDomains(this._axisDragStart.xDomain, this._axisDragStart.yDomain);

    if (axis === 'x') {
      this._viewport.scaleDomainFromMidpointX(zoomFactor);
    } else {
      this._viewport.scaleDomainFromMidpointY(zoomFactor);
    }

    this._dirty = true;
    this.emit('zoomChanged', { factor: zoomFactor, axis });
  }

  // F37: middle-click mousedown — start rect zoom drag if inside plot area
  _handleRectZoomDown(e) {
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
    this._isRectZooming   = true;
    this._rectZoomStart   = { x: pos.x, y: pos.y };
    this._rectZoomCurrent = { x: pos.x, y: pos.y };
    this._dirty = true;
  }

  // F37: middle-click drag — update the live rectangle overlay
  _handleRectZoomMove(e) {
    if (!this._rectZoomStart) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    this._rectZoomCurrent = { x: pos.x, y: pos.y };
    this._dirty = true;
  }

  // F37: middle-click release — zoom to the drawn rectangle's data bounds
  _handleRectZoomUp() {
    const start = this._rectZoomStart;
    const end   = this._rectZoomCurrent;
    this._isRectZooming   = false;
    this._rectZoomStart   = null;
    this._rectZoomCurrent = null;
    this._dirty = true;

    if (!start || !end) return;

    const DRAG_THRESHOLD_PX = 3; // sub-threshold drags are treated as a no-op click
    if (Math.hypot(end.x - start.x, end.y - start.y) < DRAG_THRESHOLD_PX) return;

    const xA = this._viewport.screenXToData(start.x);
    const xB = this._viewport.screenXToData(end.x);
    const yA = this._viewport.screenYToData(start.y);
    const yB = this._viewport.screenYToData(end.y);

    const xDomain = [Math.min(xA, xB), Math.max(xA, xB)];
    const yDomain = [Math.min(yA, yB), Math.max(yA, yB)];

    this._viewport.setDomains(xDomain, yDomain);
    this.emit('zoomChanged', { mode: 'rect', xDomain, yDomain });
  }

  // F37: build the live drag rectangle overlay layer (null when not dragging)
  _buildRectZoomLayer() {
    if (!this._isRectZooming || !this._rectZoomStart || !this._rectZoomCurrent) return null;

    const xIsLog = this._xAxis.scaleType === 'log';
    const yIsLog = this._yAxis.scaleType === 'log';
    const toX = v => xIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
    const toY = v => yIsLog ? Math.log10(Math.max(v, 1e-10)) : v;

    const xA = this._viewport.screenXToData(this._rectZoomStart.x);
    const xB = this._viewport.screenXToData(this._rectZoomCurrent.x);
    const yA = this._viewport.screenYToData(this._rectZoomStart.y);
    const yB = this._viewport.screenYToData(this._rectZoomCurrent.y);

    const dx1 = toX(Math.min(xA, xB)), dx2 = toX(Math.max(xA, xB));
    const dy1 = toY(Math.min(yA, yB)), dy2 = toY(Math.max(yA, yB));
    const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];

    return new PolygonLayer({
      id:                 'rect-zoom-overlay',
      data:               [{ polygon }],
      getPolygon:         d => d.polygon,
      getFillColor:       [255, 255, 255, 40],
      getLineColor:       [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      lineWidthUnits:     'pixels',
      pickable:           false,
    });
  }

  _onResize() {
    const container = this._webglCanvas?.parentElement;
    if (!container) return;
    const w = container.offsetWidth;
    const h = container.offsetHeight;
    if (w === 0 || h === 0) return;

    this._webglCanvas.width = w;
    this._webglCanvas.height = h;
    this._axisCanvas.width = w;
    this._axisCanvas.height = h;

    this._deck && this._deck.setProps({ width: w, height: h });
    this._resize(w, h);
    this._dirty = true;
  }

  // ─── Internal: event wiring ────────────────────────────────────────────────

  _wireEvents() {
    // DataStore events
    this._dataStore.on('dataExpired', e => this.emit('dataExpired', e));
    // DataStore dirty without a DataView — still need to re-render
    this._dataStore.on('dirty', () => {
      if (!this._dataView) { this._dirty = true; }
    });

    // F17: wire initial DataView if provided at construction time
    if (this._dataView) {
      this._dataView.on('dirty',      this._onDataViewDirty);
      this._dataView.on('recomputed', this._onDataViewRecomputed);
    }

    // ROI events
    this._roiController.on('roiCreated',   e => this.emit('roiCreated',   e));
    this._roiController.on('roiUpdated',   e => this.emit('roiUpdated',   e));
    this._roiController.on('roiDeleted',   e => this.emit('roiDeleted',   e));
    this._roiController.on('roiFinalized',     e => this.emit('roiFinalized',     e));
    this._roiController.on('roiExternalUpdate', e => this.emit('roiExternalUpdate', e)); // F14
    this._roiController.on('roisChanged',  () => { this._dirty = true; });

    // ARCH-G: domain changes come from viewport now (not from individual AxisControllers)
    this._viewport.on('domainChanged', ({ xDomain, yDomain }) => {
      this._dirty = true;
      this.emit('domainChanged', { xDomain, yDomain });
    });

    // Viewport resize
    this._viewport.on('resize', () => {
      this._dirty = true;
    });
  }
}

export default PlotController;
