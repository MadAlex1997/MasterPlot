/**
 * ViewportController — manages canvas dimensions and coordinate transforms.
 *
 * Provides the critical screen ↔ world (data) coordinate conversions used by:
 *   - AxisRenderer (to position tick marks)
 *   - ROIController (to convert mouse events to data coordinates)
 *   - Zoom/pan logic (to compute cursor-centered zoom)
 *
 * "World" coordinates here are data-space coordinates (x/y values as stored
 * in DataStore).  "Screen" coordinates are pixel offsets from the top-left of
 * the canvas.
 *
 * The viewport maps [domainX, domainY] → [screenX, screenY] using the axis
 * scales supplied by AxisController.  This class does not own those scales —
 * it delegates.
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

    // PlotArea is the region inside margins where data is drawn
    this._updatePlotArea();

    // Axis scale accessors (set by PlotController after AxisController is ready)
    // Each is a function (dataValue) -> screenPixel
    this._xScale = null;
    this._yScale = null;
  }

  // ─── Dimensions ─────────────────────────────────────────────────────────────

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

  // ─── Scale registration ──────────────────────────────────────────────────────

  setScales(xScale, yScale) {
    this._xScale = xScale;
    this._yScale = yScale;
  }

  // ─── Coordinate transforms ───────────────────────────────────────────────────

  /**
   * Convert data x value → canvas pixel x.
   * @param {number} dataX
   * @returns {number}
   */
  dataXToScreen(dataX) {
    return this._xScale ? this._xScale(dataX) : 0;
  }

  /**
   * Convert data y value → canvas pixel y.
   * Note: canvas y increases downward, data y typically increases upward.
   * @param {number} dataY
   * @returns {number}
   */
  dataYToScreen(dataY) {
    return this._yScale ? this._yScale(dataY) : 0;
  }

  /**
   * Convert canvas pixel x → data x value.
   * @param {number} screenX
   * @returns {number}
   */
  screenXToData(screenX) {
    return this._xScale ? this._xScale.invert(screenX) : 0;
  }

  /**
   * Convert canvas pixel y → data y value.
   * @param {number} screenY
   * @returns {number}
   */
  screenYToData(screenY) {
    return this._yScale ? this._yScale.invert(screenY) : 0;
  }

  /**
   * Get mouse position relative to canvas element.
   * @param {MouseEvent} event
   * @param {HTMLElement} canvas
   * @returns {{ x: number, y: number }}
   */
  getCanvasPosition(event, canvas) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  /**
   * Convert a mouse event directly to data coordinates.
   * @param {MouseEvent} event
   * @param {HTMLElement} canvas
   * @returns {{ dataX: number, dataY: number, screenX: number, screenY: number }}
   */
  eventToData(event, canvas) {
    const { x, y } = this.getCanvasPosition(event, canvas);
    return {
      dataX:   this.screenXToData(x),
      dataY:   this.screenYToData(y),
      screenX: x,
      screenY: y,
    };
  }

  /**
   * Check whether a screen coordinate is inside the plot area.
   * @param {number} screenX
   * @param {number} screenY
   * @returns {boolean}
   */
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

    return {
      target: [midX, midY, 0],
      zoom,
    };
  }
}

export default ViewportController;
