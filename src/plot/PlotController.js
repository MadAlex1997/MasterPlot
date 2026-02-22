/**
 * PlotController — the central controller of MasterPlot.
 *
 * Owns all subsystems:
 *   - DataStore        (GPU buffers)
 *   - AxisController   (x/y domains + scale functions)
 *   - ViewportController (coordinate transforms)
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
 * Event model:
 *   All subsystem events are re-emitted on PlotController for external
 *   consumers (console logging, UI badges, etc.).
 */

import { EventEmitter } from 'events';
import { Deck }         from '@deck.gl/core';
import { OrthographicView } from '@deck.gl/core';

import { DataStore }          from './DataStore.js';
import { ViewportController } from './ViewportController.js';
import { AxisController }     from './axes/AxisController.js';
import { AxisRenderer }       from './axes/AxisRenderer.js';
import { ROIController }      from './ROI/ROIController.js';
import { buildScatterLayer }  from './layers/ScatterLayer.js';
import { ROILayer }           from './layers/ROILayer.js';

export class PlotController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {string}  [opts.xScaleType='linear']
   * @param {string}  [opts.yScaleType='linear']
   * @param {number[]} [opts.xDomain=[0,1]]
   * @param {number[]} [opts.yDomain=[0,100]]
   */
  constructor(opts = {}) {
    super();

    this._opts = opts;

    // ── Subsystems ──────────────────────────────────────────────────────────
    this._dataStore = new DataStore();
    this._viewport  = new ViewportController();

    this._xAxis = new AxisController({
      axis:      'x',
      scaleType: opts.xScaleType || 'linear',
      domain:    opts.xDomain    || [0, 1],
    });

    this._yAxis = new AxisController({
      axis:      'y',
      scaleType: opts.yScaleType || 'linear',
      domain:    opts.yDomain    || [0, 100],
    });

    this._roiController = new ROIController(this._viewport);

    // Set axis labels (optional)
    if (opts.xLabel) this._xAxis.label = opts.xLabel;
    if (opts.yLabel) this._yAxis.label = opts.yLabel;

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

    // Zoom/pan interaction state
    this._isPanning    = false;
    this._panStart     = null;  // { screenX, screenY, xDomain, yDomain }

    // F4: pan mode toggle
    this._panMode = opts.panMode || 'follow';

    // F7: follow pan speed — runtime-tunable (default matches original hardcoded value)
    this._followPanSpeed = 0.02;

    // F5: follow pan velocity — current cursor position updated each mousemove
    this._panCurrentPos = null;  // { x, y }

    // F6: right-click drag zoom state
    this._isRightDragging = false;
    this._rightDragStart  = null;  // { x, y, xDomain, yDomain }
    this._onContextMenu   = e => e.preventDefault();

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

    // Initialize ROI controller (attaches canvas listeners)
    this._roiController.init(webglCanvas);

    // Attach zoom/pan listeners (before ROI so priority is correct)
    webglCanvas.addEventListener('contextmenu', this._onContextMenu);
    webglCanvas.addEventListener('wheel',     this._onWheel,     { passive: false });
    webglCanvas.addEventListener('mousedown', this._onMouseDown);
    webglCanvas.addEventListener('mousemove', this._onMouseMove);
    webglCanvas.addEventListener('mouseup',   this._onMouseUp);
    window.addEventListener('resize',         this._onResize);

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
    window.removeEventListener('resize', this._onResize);

    this._roiController.destroy();

    if (this._deck) {
      this._deck.finalize();
      this._deck = null;
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
    this._panMode = (mode === 'drag') ? 'drag' : 'follow';
  }

  /** @param {number} speed  Tuning range: 0.005 – 0.1 */
  setFollowPanSpeed(speed) {
    this._followPanSpeed = Math.max(0.001, Number(speed));
  }

  // ─── Zoom / Pan ────────────────────────────────────────────────────────────

  /**
   * Called by PlotController's own wheel handler.
   * Zoom around a focal data point.
   */
  setZoom(factor, focalScreenX, focalScreenY) {
    const focalDataX = this._viewport.screenXToData(focalScreenX);
    const focalDataY = this._viewport.screenYToData(focalScreenY);

    this._xAxis.zoomAround(factor, focalDataX);
    this._yAxis.zoomAround(factor, focalDataY);

    this._updateScales();
    this._dirty = true;
    this.emit('zoomChanged', { factor, focalDataX, focalDataY });
  }

  // ─── Public access ─────────────────────────────────────────────────────────

  get dataStore()      { return this._dataStore; }
  get xAxis()          { return this._xAxis;     }
  get yAxis()          { return this._yAxis;     }
  get viewport()       { return this._viewport;  }
  get roiController()  { return this._roiController; }

  // ─── Export placeholder (v2) ───────────────────────────────────────────────

  /**
   * Export the plot as PNG.
   * v2 feature — architecture is in place; implementation deferred.
   *
   * @param {object} [options]
   * @param {boolean} [options.hideAxes=false]
   * @param {boolean} [options.hideLegend=false]
   * @param {number}  [options.resolutionMultiplier=2]
   */
  exportPNG(options = {}) {
    const { hideAxes = false, resolutionMultiplier = 2 } = options;
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
          this._xAxis.panByPixels(-dx * this._followPanSpeed);
          this._yAxis.panByPixels(-dy * this._followPanSpeed); // negate: inverted y range flips panByPixels direction
          this._updateScales();
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

    // Build layers
    const gpuAttrs = this._dataStore.getGPUAttributes();
    const rois     = this._roiController.getAllROIs();
    const [yMin, yMax] = this._yAxis.getDomain();
    const xIsLog = this._xAxis.scaleType === 'log';
    const yIsLog = this._yAxis.scaleType === 'log';

    const layers = [];

    if (gpuAttrs.x.length > 0) {
      layers.push(buildScatterLayer(gpuAttrs, { dataTrigger: this._dataTrigger, xIsLog, yIsLog }));
    }

    layers.push(new ROILayer({
      id:       'roi-layer',
      rois,
      plotYMin: yMin,
      plotYMax: yMax,
      xIsLog,
      yIsLog,
    }));

    this._deck.setProps({
      viewState: this._buildViewState(),
      layers,
    });

    // Render axis overlay
    if (this._axisRenderer) {
      this._axisRenderer.render();
    }
  }

  // ─── Internal: coordinate / scale sync ────────────────────────────────────

  _resize(width, height) {
    this._viewport.setCanvasSize(width, height);
    const { plotArea: pa } = this._viewport;

    // Set axis ranges to plot area pixel bounds
    this._xAxis.setRange([pa.x, pa.x + pa.width]);
    // y axis: screen y increases downward, so invert range
    this._yAxis.setRange([pa.y + pa.height, pa.y]);

    this._updateScales();
  }

  _updateScales() {
    // Provide current scale functions to ViewportController
    this._viewport.setScales(this._xAxis.getScale(), this._yAxis.getScale());
  }

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

    const [curXMin, curXMax] = this._xAxis.getDomain();
    const [curYMin, curYMax] = this._yAxis.getDomain();

    let changed = false;
    if (xMin < curXMin || xMax > curXMax) {
      this._xAxis.setDomain([Math.min(xMin, curXMin), Math.max(xMax, curXMax)]);
      changed = true;
    }
    if (yMin < curYMin || yMax > curYMax) {
      this._yAxis.setDomain([Math.min(yMin, curYMin), Math.max(yMax, curYMax)]);
      changed = true;
    }

    if (changed) {
      this._updateScales();
      this.emit('domainChanged', {
        xDomain: this._xAxis.getDomain(),
        yDomain: this._yAxis.getDomain(),
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

    this._xAxis.setDomain([xMin, xMax]);
    this._yAxis.setDomain([yMin, yMax]);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xAxis.getDomain(),
      yDomain: this._yAxis.getDomain(),
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
    // F6: route right-click before the left-click-only guard
    if (e.button === 2) { this._handleRightDown(e); return; }

    if (e.button !== 0) return;
    if (this._roiController._mode !== 'idle') return; // ROI creation takes priority
    if (this._roiController._hitTest) {
      // Check if ROIController will handle this event
      const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
      if (this._roiController._hitTest(screenX, screenY)) return;
    }

    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;

    this._isPanning = true;
    this._panStart  = {
      screenX:  pos.x,
      screenY:  pos.y,
      xDomain: this._xAxis.getDomain(),
      yDomain: this._yAxis.getDomain(),
    };
    // F5: track current cursor position for velocity pan
    this._panCurrentPos = { x: pos.x, y: pos.y };
  }

  _onMouseMove(e) {
    // F6: handle right-click drag zoom (independent of left-click pan)
    if (this._isRightDragging) { this._handleRightMove(e); }

    if (!this._isPanning || !this._panStart) return;

    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);

    if (this._panMode === 'drag') {
      // F4: drag pan — data moves with cursor (restore-and-reapply, inverted signs)
      const dx = pos.x - this._panStart.screenX;
      const dy = pos.y - this._panStart.screenY;
      this._xAxis.setDomain(this._panStart.xDomain);
      this._yAxis.setDomain(this._panStart.yDomain);
      this._xAxis.panByPixels(dx);    // drag right → data moves right
      this._yAxis.panByPixels( dy);   // drag down → data moves down (inverted y range makes +dy correct)
      this._updateScales();
      this._dirty = true;
      this.emit('panChanged', { dx, dy });
    } else {
      // F5: follow pan — just track position; RAF velocity tick does the work
      this._panCurrentPos = { x: pos.x, y: pos.y };
    }
  }

  _onMouseUp(e) {
    // F6: clear right-click drag zoom state
    if (e.button === 2 && this._isRightDragging) {
      this._isRightDragging = false;
      this._rightDragStart  = null;
    }
    if (this._isPanning) {
      this._isPanning     = false;
      this._panStart      = null;
      this._panCurrentPos = null;  // F5: stop velocity pan
    }
  }

  // F6: right-click mousedown — start drag zoom if inside plot area
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

  // F6: right-click drag — zoom centred on the right-click origin
  _handleRightMove(e) {
    if (!this._rightDragStart) return;
    const pos     = this._viewport.getCanvasPosition(e, this._webglCanvas);
    const totalDy = pos.y - this._rightDragStart.y;
    // drag up (totalDy<0) → factor<1 → zoom in
    const factor = Math.pow(0.992, -totalDy);
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

  _onResize() {
    if (!this._webglCanvas) return;
    const w = this._webglCanvas.offsetWidth;
    const h = this._webglCanvas.offsetHeight;
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

    // ROI events
    this._roiController.on('roiCreated',  e => this.emit('roiCreated',  e));
    this._roiController.on('roiUpdated',  e => this.emit('roiUpdated',  e));
    this._roiController.on('roiDeleted',  e => this.emit('roiDeleted',  e));
    this._roiController.on('roisChanged', e => { this._dirty = true; });

    // Axis domain events
    this._xAxis.on('domainChanged', e => {
      this._updateScales();
      this._dirty = true;
      this.emit('domainChanged', { ...e, xDomain: e.domain });
    });
    this._yAxis.on('domainChanged', e => {
      this._updateScales();
      this._dirty = true;
    });

    // Viewport resize
    this._viewport.on('resize', () => {
      this._dirty = true;
    });
  }
}

export default PlotController;
