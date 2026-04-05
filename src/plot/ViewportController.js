/**
 * ViewportController — canvas dimensions, coordinate transforms, and domain state (ARCH-G).
 *
 * After ARCH-G this class owns ALL domain-mutation methods that previously lived
 * on AxisController.  AxisController is now config-only (scale type, tick format,
 * appearance); ViewportController holds the live domain for each axis and builds
 * d3 scale objects on demand.
 *
 * Provides:
 *   - Domain setters/getters for x and y axes
 *   - Zoom (zoomAroundX/Y) and pan (panByPixels) mutations
 *   - Midpoint-zoom (scaleDomainFromMidpointX/Y) used by F21 axis drag
 *   - Screen ↔ data coordinate conversions
 *   - deck.gl view-state computation
 *
 * Emits:
 *   'domainChanged'  — { xDomain, yDomain } — after any domain mutation
 *   'resize'         — { width, height, plotArea } — after setCanvasSize()
 *   'scalesUpdated'  — (internal) after _updateScales()
 */

import { EventEmitter } from 'events';

export class ViewportController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.marginLeft=60]
   * @param {number} [opts.marginRight=20]
   * @param {number} [opts.marginTop=20]
   * @param {number} [opts.marginBottom=50]
   */
  constructor(opts = {}) {
    super();

    this.marginLeft   = opts.marginLeft   ?? 60;
    this.marginRight  = opts.marginRight  ?? 20;
    this.marginTop    = opts.marginTop    ?? 20;
    this.marginBottom = opts.marginBottom ?? 50;

    // Canvas pixel dimensions (updated by resize)
    this.canvasWidth  = 800;
    this.canvasHeight = 600;

    // Plot area (region inside margins where data is drawn)
    this._updatePlotArea();

    // Axis config references (set by PlotController via setAxisConfig)
    this._xAxisCfg = null;
    this._yAxisCfg = null;

    // Domain state (data-space ranges)
    this._xDomain = [0, 1];
    this._yDomain = [0, 100];

    // Pixel range for each axis (set by PlotController during resize)
    // x: left-edge → right-edge; y: bottom-edge → top-edge (inverted)
    this._xRange = [this.marginLeft, this.canvasWidth - this.marginRight];
    this._yRange = [this.canvasHeight - this.marginBottom, this.marginTop];

    // Built d3 scale functions (updated by _updateScales)
    this._xScale = null;
    this._yScale = null;
  }

  // ─── Axis config registration ────────────────────────────────────────────────

  /**
   * Provide axis config objects so this controller can build d3 scales.
   * Called by PlotController after creating AxisController instances.
   *
   * @param {import('./axes/AxisController').AxisController} xAxis
   * @param {import('./axes/AxisController').AxisController} yAxis
   */
  setAxisConfig(xAxis, yAxis) {
    this._xAxisCfg = xAxis;
    this._yAxisCfg = yAxis;
    this._updateScales();
  }

  // ─── Domain state ────────────────────────────────────────────────────────────

  /**
   * Set the x-axis domain.  Rebuilds scales and emits 'domainChanged'.
   * @param {number[]} domain — [min, max]
   */
  setXDomain(domain) {
    const [min, max] = domain;
    if (min === max) return; // degenerate — ignore
    this._xDomain = [min, max];
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Set the y-axis domain.  Rebuilds scales and emits 'domainChanged'.
   * @param {number[]} domain — [min, max]
   */
  setYDomain(domain) {
    const [min, max] = domain;
    if (min === max) return;
    this._yDomain = [min, max];
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Set both domains atomically (one scale rebuild, one event).
   * Use this in restore-and-reapply patterns to avoid redundant updates.
   *
   * @param {number[]|null} xDomain
   * @param {number[]|null} yDomain
   */
  setDomains(xDomain, yDomain) {
    if (xDomain) {
      const [min, max] = xDomain;
      if (min !== max) this._xDomain = [min, max];
    }
    if (yDomain) {
      const [min, max] = yDomain;
      if (min !== max) this._yDomain = [min, max];
    }
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /** @returns {number[]} copy of current x domain [min, max] */
  getXDomain() { return [...this._xDomain]; }

  /** @returns {number[]} copy of current y domain [min, max] */
  getYDomain() { return [...this._yDomain]; }

  // ─── Pixel range ─────────────────────────────────────────────────────────────

  /**
   * Set the pixel range for the x axis.  Called by PlotController during resize.
   * @param {number[]} range — [pxLeft, pxRight]
   */
  setXRange(range) {
    this._xRange = range;
    this._updateScales();
  }

  /**
   * Set the pixel range for the y axis.  Called by PlotController during resize.
   * Note: the y range is intentionally inverted ([bottom_px, top_px]) so that
   * data-y=0 appears at the visual bottom.
   * @param {number[]} range — [pxBottom, pxTop]
   */
  setYRange(range) {
    this._yRange = range;
    this._updateScales();
  }

  // ─── Zoom mutations ──────────────────────────────────────────────────────────

  /**
   * Zoom the x domain around a focal data coordinate.
   * factor > 1 = zoom in (domain shrinks); factor < 1 = zoom out.
   *
   * @param {number} dataCenter — focal point in data-x space
   * @param {number} factor
   */
  zoomAroundX(dataCenter, factor) {
    this._xDomain = this._zoomDomain(this._xDomain, dataCenter, factor,
      this._xAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Zoom the y domain around a focal data coordinate.
   * @param {number} dataCenter
   * @param {number} factor
   */
  zoomAroundY(dataCenter, factor) {
    this._yDomain = this._zoomDomain(this._yDomain, dataCenter, factor,
      this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Zoom both axes simultaneously around focal data coordinates.
   * Used by PlotController.setZoom() to combine x+y in one event.
   *
   * @param {number} focalDataX
   * @param {number} focalDataY
   * @param {number} factor
   */
  zoomAround(focalDataX, focalDataY, factor) {
    this._xDomain = this._zoomDomain(this._xDomain, focalDataX, factor,
      this._xAxisCfg?.scaleType);
    this._yDomain = this._zoomDomain(this._yDomain, focalDataY, factor,
      this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Pan by pixel deltas.  Accepts a { dx?, dy? } object so callers can pan
   * one or both axes at once.
   *
   * Sign convention (same as legacy AxisController.panByPixels):
   *   x — positive dx pans the domain to the right (data moves left)
   *   y — positive dy pans the domain upward because the y range is inverted
   *       (double-negation: inverted range flips the effective direction)
   *
   * @param {{ dx?: number, dy?: number }} deltas
   */
  panByPixels({ dx, dy } = {}) {
    if (dx !== undefined && dx !== 0) {
      this._xDomain = this._panDomain(this._xDomain, this._xRange, dx,
        this._xAxisCfg?.scaleType);
    }
    if (dy !== undefined && dy !== 0) {
      this._yDomain = this._panDomain(this._yDomain, this._yRange, dy,
        this._yAxisCfg?.scaleType);
    }
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Zoom the x domain centered on its midpoint (used by F21 axis drag scaling).
   * factor > 1 = zoom in; factor < 1 = zoom out.
   *
   * @param {number} factor
   */
  scaleDomainFromMidpointX(factor) {
    this._xDomain = this._scaleDomainFromMidpoint(this._xDomain, factor,
      this._xAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  /**
   * Zoom the y domain centered on its midpoint.
   * @param {number} factor
   */
  scaleDomainFromMidpointY(factor) {
    this._yDomain = this._scaleDomainFromMidpoint(this._yDomain, factor,
      this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', { xDomain: this._xDomain, yDomain: this._yDomain });
  }

  // ─── Scale accessors (for AxisRenderer / coordinate transforms) ───────────────

  /** Returns the current built x d3 scale (domain+range already applied). */
  getXScale() { return this._xScale; }

  /** Returns the current built y d3 scale (domain+range already applied). */
  getYScale() { return this._yScale; }

  // ─── Dimensions ──────────────────────────────────────────────────────────────

  setCanvasSize(width, height) {
    this.canvasWidth  = width;
    this.canvasHeight = height;
    this._updatePlotArea();
    this.emit('resize', { width, height, plotArea: this.plotArea });
  }

  _updatePlotArea() {
    this.plotArea = {
      x:      this.marginLeft,
      y:      this.marginTop,
      width:  Math.max(1, this.canvasWidth  - this.marginLeft - this.marginRight),
      height: Math.max(1, this.canvasHeight - this.marginTop  - this.marginBottom),
      right:  this.canvasWidth  - this.marginRight,
      bottom: this.canvasHeight - this.marginBottom,
    };
  }

  // ─── Coordinate transforms ───────────────────────────────────────────────────

  dataXToScreen(dataX) {
    return this._xScale ? this._xScale(dataX) : 0;
  }

  dataYToScreen(dataY) {
    return this._yScale ? this._yScale(dataY) : 0;
  }

  screenXToData(screenX) {
    return this._xScale ? this._xScale.invert(screenX) : 0;
  }

  screenYToData(screenY) {
    return this._yScale ? this._yScale.invert(screenY) : 0;
  }

  getCanvasPosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  eventToData(event, canvas) {
    const { x, y } = this.getCanvasPosition(event, canvas);
    return {
      dataX:   this.screenXToData(x),
      dataY:   this.screenYToData(y),
      screenX: x,
      screenY: y,
    };
  }

  isInPlotArea(screenX, screenY) {
    const { x, y, width, height } = this.plotArea;
    return screenX >= x && screenX <= x + width &&
           screenY >= y && screenY <= y + height;
  }

  /**
   * Returns deck.gl OrthographicView parameters based on current domain/size.
   * @param {number[]} xDomain [min, max]
   * @param {number[]} yDomain [min, max]
   * @returns {object}
   */
  getDeckViewState(xDomain, yDomain) {
    const [xMin, xMax] = xDomain;
    const [yMin, yMax] = yDomain;
    const midX = (xMin + xMax) / 2;
    const midY = (yMin + yMax) / 2;
    const zoom = Math.log2(this.plotArea.width / (xMax - xMin));
    return { target: [midX, midY, 0], zoom };
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _updateScales() {
    if (this._xAxisCfg) {
      this._xScale = this._xAxisCfg.getScale(this._xDomain, this._xRange);
    }
    if (this._yAxisCfg) {
      this._yScale = this._yAxisCfg.getScale(this._yDomain, this._yRange);
    }
  }

  /**
   * Zoom a domain around a focal data point.
   * @param {number[]} domain
   * @param {number}   focal
   * @param {number}   factor  — >1 zoom in
   * @param {string}   scaleType
   * @returns {number[]} new domain
   */
  _zoomDomain(domain, focal, factor, scaleType) {
    const [min, max] = domain;
    if (scaleType === 'log') {
      const logMin   = Math.log10(Math.max(min, 1e-10));
      const logMax   = Math.log10(Math.max(max, 1e-10));
      const logFocal = Math.log10(Math.max(focal, 1e-10));
      const logSpan  = logMax - logMin;
      const newLogSpan = logSpan / factor;
      const ratio    = logSpan > 0 ? (logFocal - logMin) / logSpan : 0.5;
      const newLogMin = logFocal - ratio * newLogSpan;
      return [Math.pow(10, newLogMin), Math.pow(10, newLogMin + newLogSpan)];
    } else {
      const span    = max - min;
      const newSpan = span / factor;
      const ratio   = span > 0 ? (focal - min) / span : 0.5;
      const newMin  = focal - ratio * newSpan;
      return [newMin, newMin + newSpan];
    }
  }

  /**
   * Pan a domain by a pixel delta.
   * @param {number[]} domain
   * @param {number[]} range     — pixel range [pxStart, pxEnd]
   * @param {number}   pixelDelta
   * @param {string}   scaleType
   * @returns {number[]} new domain
   */
  _panDomain(domain, range, pixelDelta, scaleType) {
    const [pxMin, pxMax] = range;
    const pxSpan = pxMax - pxMin;
    if (pxSpan === 0) return domain;

    const [min, max] = domain;
    if (scaleType === 'log') {
      const logMin  = Math.log10(Math.max(min, 1e-10));
      const logMax  = Math.log10(Math.max(max, 1e-10));
      const logSpan = logMax - logMin;
      const dataDelta = -(pixelDelta / pxSpan) * logSpan;
      return [Math.pow(10, logMin + dataDelta), Math.pow(10, logMax + dataDelta)];
    } else {
      const dataDelta = -(pixelDelta / pxSpan) * (max - min);
      return [min + dataDelta, max + dataDelta];
    }
  }

  /**
   * Scale a domain around its midpoint.
   * @param {number[]} domain
   * @param {number}   factor  — >1 zoom in
   * @param {string}   scaleType
   * @returns {number[]} new domain
   */
  _scaleDomainFromMidpoint(domain, factor, scaleType) {
    const [min, max] = domain;
    if (scaleType === 'log') {
      const logMin  = Math.log10(Math.max(min, 1e-10));
      const logMax  = Math.log10(Math.max(max, 1e-10));
      const logMid  = (logMin + logMax) / 2;
      const newHalf = (logMax - logMin) / (2 * factor);
      return [Math.pow(10, logMid - newHalf), Math.pow(10, logMid + newHalf)];
    } else {
      const mid     = (min + max) / 2;
      const newHalf = (max - min) / (2 * factor);
      return [mid - newHalf, mid + newHalf];
    }
  }
}

export default ViewportController;
