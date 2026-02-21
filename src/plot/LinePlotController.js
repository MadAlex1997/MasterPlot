/**
 * LinePlotController — lightweight controller for line/time-series plots.
 *
 * Manages multiple named signals rendered as deck.gl PathLayers.
 * Shares the same axis/viewport/RAF infrastructure as PlotController but
 * uses PathLayer instead of ScatterLayer + ROILayer.
 *
 * API:
 *   addSignal(id, color)                 — register a named signal with RGBA color
 *   appendSignalData(id, yValues, xBase) — append y values (x = xBase + i)
 *   advanceXCounter(n)                   — advance the shared x index by n
 *   reset()                              — clear all signals and reset domains
 *   expandDomains()                      — fit axes to current data extents
 *   init(webglCanvas, axisCanvas)        — attach to DOM, start render loop
 *   destroy()                            — clean up
 */

import { EventEmitter } from 'events';
import { Deck }             from '@deck.gl/core';
import { OrthographicView } from '@deck.gl/core';
import { PathLayer }        from '@deck.gl/layers';

import { ViewportController } from './ViewportController.js';
import { AxisController }     from './axes/AxisController.js';
import { AxisRenderer }       from './axes/AxisRenderer.js';

export class LinePlotController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number[]} [opts.xDomain=[0,1]]
   * @param {number[]} [opts.yDomain=[-1,1]]
   * @param {string}  [opts.xLabel]
   * @param {string}  [opts.yLabel]
   */
  constructor(opts = {}) {
    super();

    this._opts = opts;

    // Subsystems
    this._viewport = new ViewportController();

    this._xAxis = new AxisController({
      axis: 'x', scaleType: 'linear',
      domain: opts.xDomain || [0, 1],
    });
    this._yAxis = new AxisController({
      axis: 'y', scaleType: 'linear',
      domain: opts.yDomain || [-1, 1],
    });

    if (opts.xLabel) this._xAxis.label = opts.xLabel;
    if (opts.yLabel) this._yAxis.label = opts.yLabel;

    // Signal registry: id → { path: [], color, layerData, version }
    // path entries are [x, y, 0] triples used directly by PathLayer
    this._signals = new Map();
    this._xCounter = 0;  // global x index, shared across all signals per tick

    // Canvas + deck
    this._webglCanvas  = null;
    this._axisCanvas   = null;
    this._deck         = null;
    this._axisRenderer = null;

    // Render loop
    this._rafId  = null;
    this._dirty  = true;

    // Pan state (drag mode only for simplicity)
    this._isPanning = false;
    this._panStart  = null;  // { screenX, screenY, xDomain, yDomain }

    // Bound handlers
    this._onWheel     = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp   = this._onMouseUp.bind(this);
    this._onResize    = this._onResize.bind(this);

    // Propagate axis domain changes to viewport
    this._xAxis.on('domainChanged', () => { this._updateScales(); this._dirty = true; });
    this._yAxis.on('domainChanged', () => { this._updateScales(); this._dirty = true; });
  }

  // ─── Signal management ─────────────────────────────────────────────────────

  /**
   * Register a named signal.
   * @param {string}   id    — unique identifier
   * @param {number[]} color — [R, G, B, A] 0-255
   */
  addSignal(id, color) {
    this._signals.set(id, {
      path:      [],     // mutable array of [x, y, 0] triples
      color,
      layerData: null,   // cached [{path, color}] — replaced on each append
      version:   0,      // incremented on append, drives updateTriggers
    });
  }

  /**
   * Append y-values to a signal. X values are assigned from xBase + i.
   *
   * @param {string}              id      — signal id
   * @param {number[]|Float32Array} yValues
   * @param {number}              xBase  — x coordinate of yValues[0]
   */
  appendSignalData(id, yValues, xBase) {
    const sig = this._signals.get(id);
    if (!sig) return;

    for (let i = 0; i < yValues.length; i++) {
      sig.path.push([xBase + i, yValues[i], 0]);
    }

    // New layerData reference → deck.gl detects data change and re-evaluates getPath
    sig.layerData = [{ path: sig.path, color: sig.color }];
    sig.version++;
    this._dirty = true;
  }

  /** Advance the shared x counter by n (call after one round of appendSignalData). */
  advanceXCounter(n) {
    this._xCounter += n;
  }

  get xCounter() { return this._xCounter; }

  /** Clear all signal data and reset domains/counter. */
  reset() {
    for (const sig of this._signals.values()) {
      sig.path      = [];
      sig.layerData = null;
      sig.version++;
    }
    this._xCounter = 0;
    this._xAxis.setDomain([0, 1]);
    this._yAxis.setDomain([-1, 1]);
    this._updateScales();
    this._dirty = true;
    this.emit('reset');
  }

  /**
   * Fit x and y domains to the current data extents (with 5% y padding).
   * No-op if no data has been appended yet.
   */
  expandDomains() {
    let xMax = 1;
    let yMin = Infinity, yMax = -Infinity;

    for (const sig of this._signals.values()) {
      if (sig.path.length === 0) continue;
      xMax = Math.max(xMax, sig.path[sig.path.length - 1][0]);
      for (const pt of sig.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
    }

    if (yMin === Infinity) return;

    const yPad = (yMax - yMin) * 0.05 || 0.1;
    this._xAxis.setDomain([0, xMax]);
    this._yAxis.setDomain([yMin - yPad, yMax + yPad]);
    this._updateScales();
  }

  // ─── Init / destroy ────────────────────────────────────────────────────────

  init(webglCanvas, axisCanvas) {
    this._webglCanvas = webglCanvas;
    this._axisCanvas  = axisCanvas;

    const w = webglCanvas.offsetWidth  || 800;
    const h = webglCanvas.offsetHeight || 600;

    this._resize(w, h);

    this._deck = new Deck({
      canvas: webglCanvas,
      width:  w,
      height: h,
      views:  [new OrthographicView({ id: 'ortho', controller: false, flipY: false })],
      viewState: this._buildViewState(),
      layers: [],
      controller: false,
    });

    this._axisRenderer = new AxisRenderer(axisCanvas, this._xAxis, this._yAxis, this._viewport);

    webglCanvas.addEventListener('wheel',     this._onWheel,     { passive: false });
    webglCanvas.addEventListener('mousedown', this._onMouseDown);
    webglCanvas.addEventListener('mousemove', this._onMouseMove);
    webglCanvas.addEventListener('mouseup',   this._onMouseUp);
    window.addEventListener('resize',         this._onResize);

    this._scheduleRender();
  }

  destroy() {
    if (this._rafId) cancelAnimationFrame(this._rafId);

    if (this._webglCanvas) {
      this._webglCanvas.removeEventListener('wheel',     this._onWheel);
      this._webglCanvas.removeEventListener('mousedown', this._onMouseDown);
      this._webglCanvas.removeEventListener('mousemove', this._onMouseMove);
      this._webglCanvas.removeEventListener('mouseup',   this._onMouseUp);
    }
    window.removeEventListener('resize', this._onResize);

    if (this._deck) { this._deck.finalize(); this._deck = null; }
  }

  // ─── Render loop ───────────────────────────────────────────────────────────

  _scheduleRender() {
    this._rafId = requestAnimationFrame(() => {
      if (this._dirty) {
        this._render();
        this._dirty = false;
      }
      this._scheduleRender();
    });
  }

  _render() {
    if (!this._deck) return;

    const layers = [];

    for (const [id, sig] of this._signals) {
      if (!sig.layerData || sig.path.length < 2) continue;

      layers.push(new PathLayer({
        id:           `line-${id}`,
        data:         sig.layerData,
        getPath:      d => d.path,
        getColor:     d => d.color,
        getWidth:     2,
        widthUnits:   'pixels',
        pickable:     false,
        updateTriggers: { getPath: sig.version },
      }));
    }

    this._deck.setProps({ viewState: this._buildViewState(), layers });

    if (this._axisRenderer) this._axisRenderer.render();
  }

  // ─── Coordinate / scale ────────────────────────────────────────────────────

  _resize(w, h) {
    this._viewport.setCanvasSize(w, h);
    const { plotArea: pa } = this._viewport;
    this._xAxis.setRange([pa.x, pa.x + pa.width]);
    this._yAxis.setRange([pa.y + pa.height, pa.y]);  // inverted: y=0 at visual bottom
    this._updateScales();
  }

  _updateScales() {
    this._viewport.setScales(this._xAxis.getScale(), this._yAxis.getScale());
  }

  _buildViewState() {
    const [xMin, xMax] = this._xAxis.getDomain();
    const [yMin, yMax] = this._yAxis.getDomain();
    const { canvasWidth: W, canvasHeight: H, plotArea: pa, marginLeft, marginBottom } = this._viewport;

    const xSpan = Math.max(xMax - xMin, 1e-10);
    const ySpan = Math.max(yMax - yMin, 1e-10);

    const zoomX = Math.log2(pa.width  / xSpan);
    const zoomY = Math.log2(pa.height / ySpan);

    // Same formula as PlotController (flipY:false convention)
    const tx = xMin + (W / 2 - marginLeft)  * xSpan / pa.width;
    const ty = yMin + (H / 2 - marginBottom) * ySpan / pa.height;

    return { id: 'ortho', target: [tx, ty, 0], zoom: [zoomX, zoomY] };
  }

  // ─── Interaction handlers ──────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    const { x: sx, y: sy } = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(sx, sy)) return;

    const delta  = e.deltaY || e.detail || -e.wheelDelta;
    const factor = delta > 0 ? 0.85 : 1 / 0.85;

    const focalDataX = this._viewport.screenXToData(sx);
    const focalDataY = this._viewport.screenYToData(sy);
    this._xAxis.zoomAround(factor, focalDataX);
    this._yAxis.zoomAround(factor, focalDataY);
    this._updateScales();
    this._dirty = true;
    this.emit('zoomChanged', { factor });
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;

    this._isPanning = true;
    this._panStart  = {
      screenX: pos.x, screenY: pos.y,
      xDomain: this._xAxis.getDomain(),
      yDomain: this._yAxis.getDomain(),
    };
  }

  _onMouseMove(e) {
    if (!this._isPanning || !this._panStart) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    const dx  = pos.x - this._panStart.screenX;
    const dy  = pos.y - this._panStart.screenY;

    // Drag-pan: restore initial domain then apply delta (avoids float drift)
    this._xAxis.setDomain(this._panStart.xDomain);
    this._yAxis.setDomain(this._panStart.yDomain);
    this._xAxis.panByPixels(dx);
    this._yAxis.panByPixels(dy);  // +dy correct because of inverted y range
    this._updateScales();
    this._dirty = true;
    this.emit('panChanged', { dx, dy });
  }

  _onMouseUp() {
    this._isPanning = false;
    this._panStart  = null;
  }

  _onResize() {
    if (!this._webglCanvas) return;
    const w = this._webglCanvas.offsetWidth;
    const h = this._webglCanvas.offsetHeight;
    if (!w || !h) return;

    this._webglCanvas.width = w;
    this._webglCanvas.height = h;
    this._axisCanvas.width  = w;
    this._axisCanvas.height = h;

    this._deck?.setProps({ width: w, height: h });
    this._resize(w, h);
    this._dirty = true;
  }
}

export default LinePlotController;
