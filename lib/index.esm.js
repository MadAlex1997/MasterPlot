import EventEmitter$1, { EventEmitter } from 'events';
import { CompositeLayer, Deck, OrthographicView } from '@deck.gl/core';
import { scaleLinear, scaleTime, scaleLog } from 'd3-scale';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';
import { ScatterplotLayer, PolygonLayer, PathLayer, SolidPolygonLayer, BitmapLayer } from '@deck.gl/layers';
import FFT from 'fft.js';
import * as fftWindowing from 'fft-windowing';
import { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { jsxs, jsx } from 'react/jsx-runtime';

/**
 * DataStore — GPU-friendly buffer management for large point datasets.
 *
 * Buffer Append Strategy (non-rolling):
 * Rather than reallocating every time new data arrives, DataStore maintains
 * over-allocated typed arrays and expands them by 1.5x only when capacity is
 * exhausted. This keeps GC pauses to a minimum and allows GPU attribute
 * updates to use subarray views without copying the entire buffer.
 *
 * Rolling Ring Buffer (optional, enabled via enableRolling()):
 * Fixed-capacity circular buffer. New points write at _headIndex; expired
 * points are evicted by advancing _tailIndex. No array splicing. Axis
 * auto-domain updates on expiration. Non-rolling mode is fully unchanged.
 *
 * Memory layout: parallel typed arrays for x, y, _sizeArr (Float32Array) and
 * color (Uint8Array, 4 bytes per point = RGBA).
 */

const INITIAL_CAPACITY$1 = 65536; // 64k points to start
const GROWTH_FACTOR = 1.5; // grow 50% when full

/** REL7: array-like check accepting both typed arrays and plain number[]. */
function _isArrayLike(v) {
  return Array.isArray(v) || ArrayBuffer.isView(v);
}
class DataStore extends EventEmitter {
  constructor(initialCapacity = INITIAL_CAPACITY$1) {
    super();
    this._capacity = initialCapacity;
    this._count = 0;

    // Allocate parallel GPU-ready typed arrays
    this._x = new Float32Array(this._capacity);
    this._y = new Float32Array(this._capacity);
    this._sizeArr = new Float32Array(this._capacity); // renamed from _size (avoids semantic collision)
    this._color = new Uint8Array(this._capacity * 4); // RGBA per point

    // Per-point JS metadata (not GPU); keyed by numeric index
    this._metadata = new Map();

    // ── Rolling ring buffer state (inactive until enableRolling() is called) ──
    this._rollingEnabled = false;
    this._maxPoints = Infinity;
    this._maxAgeMs = Infinity;
    this._headIndex = 0;
    this._tailIndex = 0;
    this._timestamps = null; // Float64Array, allocated in enableRolling()
  }

  // ─── Rolling API ────────────────────────────────────────────────────────────

  /**
   * Activate rolling ring-buffer mode with fixed capacity.
   * Must be called before any data is appended.
   *
   * @param {object} opts
   * @param {number} [opts.maxPoints=Infinity]  — evict oldest when count exceeds this
   * @param {number} [opts.maxAgeMs=Infinity]   — evict points older than this many ms
   */
  enableRolling({
    maxPoints = Infinity,
    maxAgeMs = Infinity
  } = {}) {
    if (maxPoints === Infinity && maxAgeMs === Infinity) {
      throw new Error('enableRolling: must specify maxPoints and/or maxAgeMs');
    }
    const capacity = maxPoints === Infinity ? INITIAL_CAPACITY$1 : maxPoints;
    this._rollingEnabled = true;
    this._maxPoints = maxPoints;
    this._maxAgeMs = maxAgeMs;
    this._headIndex = 0;
    this._tailIndex = 0;
    this._count = 0;

    // Allocate fixed-size ring buffers (replaces any previous allocation)
    this._capacity = capacity;
    this._x = new Float32Array(capacity);
    this._y = new Float32Array(capacity);
    this._sizeArr = new Float32Array(capacity);
    this._color = new Uint8Array(capacity * 4);
    this._timestamps = new Float64Array(capacity);
    this._metadata.clear();
  }

  /**
   * Advance tailIndex to evict points that are too old or exceed maxPoints.
   * Emits 'dataExpired' if any points were removed.
   */
  expireIfNeeded() {
    if (!this._rollingEnabled) return;
    let expired = 0;
    const now = Date.now();
    while (this._count > 0) {
      const oldestTs = this._timestamps[this._tailIndex];
      const ageOk = now - oldestTs <= this._maxAgeMs;
      const countOk = this._count <= this._maxPoints;
      if (ageOk && countOk) break;

      // Evict oldest point
      this._tailIndex = (this._tailIndex + 1) % this._capacity;
      this._count--;
      expired++;
    }
    if (expired > 0) {
      this.emit('dataExpired', {
        expired,
        remaining: this._count
      });
    }
  }

  /**
   * Return ordered logical data from tailIndex → headIndex.
   * Handles wrap-around via two-slice copy into fresh typed arrays.
   * Safe for CPU-side use (filtering, domain recalc, histogram).
   *
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  getLogicalData() {
    if (!this._rollingEnabled) {
      // Non-rolling: just return live subarrays (same as getGPUAttributes)
      return {
        x: this._x.subarray(0, this._count),
        y: this._y.subarray(0, this._count),
        size: this._sizeArr.subarray(0, this._count),
        color: this._color.subarray(0, this._count * 4)
      };
    }
    const n = this._count;
    const tail = this._tailIndex;
    const cap = this._capacity;
    const outX = new Float32Array(n);
    const outY = new Float32Array(n);
    const outSize = new Float32Array(n);
    const outColor = new Uint8Array(n * 4);

    // How many elements fit before wrapping
    const firstSlice = Math.min(n, cap - tail);
    const secondSlice = n - firstSlice;
    outX.set(this._x.subarray(tail, tail + firstSlice), 0);
    outY.set(this._y.subarray(tail, tail + firstSlice), 0);
    outSize.set(this._sizeArr.subarray(tail, tail + firstSlice), 0);
    outColor.set(this._color.subarray(tail * 4, (tail + firstSlice) * 4), 0);
    if (secondSlice > 0) {
      outX.set(this._x.subarray(0, secondSlice), firstSlice);
      outY.set(this._y.subarray(0, secondSlice), firstSlice);
      outSize.set(this._sizeArr.subarray(0, secondSlice), firstSlice);
      outColor.set(this._color.subarray(0, secondSlice * 4), firstSlice * 4);
    }
    return {
      x: outX,
      y: outY,
      size: outSize,
      color: outColor
    };
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Append new point data to the store.
   *
   * @param {object} chunk
   * @param {Float32Array|number[]} chunk.x
   * @param {Float32Array|number[]} chunk.y
   * @param {Float32Array|number[]} [chunk.size]    — defaults to 4.0
   * @param {Uint8Array|number[]}   [chunk.color]   — RGBA per point (4 values each)
   * @param {object[]}              [chunk.metadata] — one JS object per point
   * @throws {Error} REL7: if chunk.x/chunk.y are missing/not array-like, their
   *   lengths mismatch, or chunk.size/chunk.color don't match chunk.x's length.
   */
  appendData(chunk) {
    this._validateChunk(chunk);
    const incoming = chunk.x.length;
    if (incoming === 0) return;
    if (this._rollingEnabled) {
      this._appendRolling(chunk, incoming);
    } else {
      this._appendLinear(chunk, incoming);
    }
    this.emit('dirty');
  }

  /**
   * Return GPU-ready buffer views.
   * Non-rolling: live subarray views (no copy).
   * Rolling: ordered copy via getLogicalData() to handle wrap-around.
   *
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  getGPUAttributes() {
    if (this._rollingEnabled) {
      return this.getLogicalData();
    }
    return {
      x: this._x.subarray(0, this._count),
      y: this._y.subarray(0, this._count),
      size: this._sizeArr.subarray(0, this._count),
      color: this._color.subarray(0, this._count * 4)
    };
  }

  /** @returns {number} */
  getPointCount() {
    return this._count;
  }

  /** @returns {object|undefined} */
  getMetadata(index) {
    return this._metadata.get(index);
  }

  /** Clear all data (reset without de-allocating buffers). */
  clear() {
    this._count = 0;
    this._headIndex = 0;
    this._tailIndex = 0;
    this._metadata.clear();
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * REL7: validate an incoming appendData() chunk at the boundary, before any
   * buffer writes happen. Throws with a message naming the offending field —
   * malformed input here would otherwise silently write NaN into GPU buffers
   * or throw a cryptic "Cannot read property 'length' of undefined" deep
   * inside _appendLinear/_appendRolling.
   */
  _validateChunk(chunk) {
    if (!chunk || typeof chunk !== 'object') {
      throw new Error('DataStore.appendData: chunk must be an object with "x" and "y" arrays');
    }
    if (!_isArrayLike(chunk.x)) {
      throw new Error('DataStore.appendData: chunk.x must be an array or typed array');
    }
    if (!_isArrayLike(chunk.y)) {
      throw new Error('DataStore.appendData: chunk.y must be an array or typed array');
    }
    if (chunk.x.length !== chunk.y.length) {
      throw new Error(`DataStore.appendData: chunk.x.length (${chunk.x.length}) must equal chunk.y.length (${chunk.y.length})`);
    }
    if (chunk.size !== undefined) {
      if (!_isArrayLike(chunk.size)) {
        throw new Error('DataStore.appendData: chunk.size must be an array or typed array');
      }
      if (chunk.size.length !== chunk.x.length) {
        throw new Error(`DataStore.appendData: chunk.size.length (${chunk.size.length}) must equal chunk.x.length (${chunk.x.length})`);
      }
    }
    if (chunk.color !== undefined) {
      if (!_isArrayLike(chunk.color)) {
        throw new Error('DataStore.appendData: chunk.color must be an array or typed array');
      }
      if (chunk.color.length !== chunk.x.length * 4) {
        throw new Error(`DataStore.appendData: chunk.color.length (${chunk.color.length}) must equal chunk.x.length * 4 (${chunk.x.length * 4})`);
      }
    }
  }

  /**
   * Append path for rolling ring buffer mode.
   * Writes each incoming point at headIndex; if buffer is full, advances
   * tailIndex (evicting the oldest point).
   */
  _appendRolling(chunk, incoming) {
    const now = Date.now();
    const cap = this._capacity;
    for (let i = 0; i < incoming; i++) {
      const head = this._headIndex;
      this._x[head] = chunk.x[i];
      this._y[head] = chunk.y[i];
      this._sizeArr[head] = chunk.size ? chunk.size[i] : 4.0;
      this._timestamps[head] = now;
      const colorBase = head * 4;
      if (chunk.color) {
        const srcBase = i * 4;
        this._color[colorBase] = chunk.color[srcBase];
        this._color[colorBase + 1] = chunk.color[srcBase + 1];
        this._color[colorBase + 2] = chunk.color[srcBase + 2];
        this._color[colorBase + 3] = chunk.color[srcBase + 3];
      } else {
        this._color[colorBase] = 255;
        this._color[colorBase + 1] = 255;
        this._color[colorBase + 2] = 255;
        this._color[colorBase + 3] = 255;
      }
      this._headIndex = (head + 1) % cap;
      if (this._count < cap) {
        this._count++;
      } else {
        // Buffer full — advance tail to overwrite oldest
        this._tailIndex = (this._tailIndex + 1) % cap;
      }
    }
  }

  /**
   * Append path for non-rolling (linear growth) mode.
   * Identical to original implementation; _grow() is used for resize.
   */
  _appendLinear(chunk, incoming) {
    let needed = this._count + incoming;
    while (needed > this._capacity) {
      this._grow();
    }
    const base = this._count;

    // Copy x / y
    if (chunk.x instanceof Float32Array) {
      this._x.set(chunk.x, base);
    } else {
      for (let i = 0; i < incoming; i++) this._x[base + i] = chunk.x[i];
    }
    if (chunk.y instanceof Float32Array) {
      this._y.set(chunk.y, base);
    } else {
      for (let i = 0; i < incoming; i++) this._y[base + i] = chunk.y[i];
    }

    // Copy size (default 4.0)
    if (chunk.size) {
      if (chunk.size instanceof Float32Array) {
        this._sizeArr.set(chunk.size, base);
      } else {
        for (let i = 0; i < incoming; i++) this._sizeArr[base + i] = chunk.size[i];
      }
    } else {
      this._sizeArr.fill(4.0, base, base + incoming);
    }

    // Copy color (RGBA, default opaque white)
    if (chunk.color) {
      const colorBase = base * 4;
      if (chunk.color instanceof Uint8Array) {
        this._color.set(chunk.color, colorBase);
      } else {
        for (let i = 0; i < incoming * 4; i++) {
          this._color[colorBase + i] = chunk.color[i];
        }
      }
    } else {
      this._color.fill(255, base * 4, (base + incoming) * 4);
    }

    // Metadata (optional per-point JS objects)
    if (chunk.metadata) {
      for (let i = 0; i < incoming; i++) {
        if (chunk.metadata[i] !== undefined) {
          this._metadata.set(base + i, chunk.metadata[i]);
        }
      }
    }
    this._count += incoming;
  }

  /**
   * Grow all buffers by GROWTH_FACTOR (non-rolling mode only).
   * Copies existing data into new, larger arrays.
   */
  _grow() {
    const newCapacity = Math.ceil(this._capacity * GROWTH_FACTOR);
    const newX = new Float32Array(newCapacity);
    const newY = new Float32Array(newCapacity);
    const newSize = new Float32Array(newCapacity);
    const newColor = new Uint8Array(newCapacity * 4);
    newX.set(this._x.subarray(0, this._count));
    newY.set(this._y.subarray(0, this._count));
    newSize.set(this._sizeArr.subarray(0, this._count));
    newColor.set(this._color.subarray(0, this._count * 4));
    this._x = newX;
    this._y = newY;
    this._sizeArr = newSize;
    this._color = newColor;
    this._capacity = newCapacity;
  }
}

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

class ViewportController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.marginLeft=60]
   * @param {number} [opts.marginRight=20]
   * @param {number} [opts.marginTop=20]
   * @param {number} [opts.marginBottom=50]
   */
  constructor(opts = {}) {
    super();
    this.marginLeft = opts.marginLeft ?? 60;
    this.marginRight = opts.marginRight ?? 20;
    this.marginTop = opts.marginTop ?? 20;
    this.marginBottom = opts.marginBottom ?? 50;

    // Canvas pixel dimensions (updated by resize)
    this.canvasWidth = 800;
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
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
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
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
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
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
  }

  /** @returns {number[]} copy of current x domain [min, max] */
  getXDomain() {
    return [...this._xDomain];
  }

  /** @returns {number[]} copy of current y domain [min, max] */
  getYDomain() {
    return [...this._yDomain];
  }

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
    this._xDomain = this._zoomDomain(this._xDomain, dataCenter, factor, this._xAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
  }

  /**
   * Zoom the y domain around a focal data coordinate.
   * @param {number} dataCenter
   * @param {number} factor
   */
  zoomAroundY(dataCenter, factor) {
    this._yDomain = this._zoomDomain(this._yDomain, dataCenter, factor, this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
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
    this._xDomain = this._zoomDomain(this._xDomain, focalDataX, factor, this._xAxisCfg?.scaleType);
    this._yDomain = this._zoomDomain(this._yDomain, focalDataY, factor, this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
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
  panByPixels({
    dx,
    dy
  } = {}) {
    if (dx !== undefined && dx !== 0) {
      this._xDomain = this._panDomain(this._xDomain, this._xRange, dx, this._xAxisCfg?.scaleType);
    }
    if (dy !== undefined && dy !== 0) {
      this._yDomain = this._panDomain(this._yDomain, this._yRange, dy, this._yAxisCfg?.scaleType);
    }
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
  }

  /**
   * Zoom the x domain centered on its midpoint (used by F21 axis drag scaling).
   * factor > 1 = zoom in; factor < 1 = zoom out.
   *
   * @param {number} factor
   */
  scaleDomainFromMidpointX(factor) {
    this._xDomain = this._scaleDomainFromMidpoint(this._xDomain, factor, this._xAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
  }

  /**
   * Zoom the y domain centered on its midpoint.
   * @param {number} factor
   */
  scaleDomainFromMidpointY(factor) {
    this._yDomain = this._scaleDomainFromMidpoint(this._yDomain, factor, this._yAxisCfg?.scaleType);
    this._updateScales();
    this.emit('domainChanged', {
      xDomain: this._xDomain,
      yDomain: this._yDomain
    });
  }

  // ─── Scale accessors (for AxisRenderer / coordinate transforms) ───────────────

  /** Returns the current built x d3 scale (domain+range already applied). */
  getXScale() {
    return this._xScale;
  }

  /** Returns the current built y d3 scale (domain+range already applied). */
  getYScale() {
    return this._yScale;
  }

  // ─── Dimensions ──────────────────────────────────────────────────────────────

  setCanvasSize(width, height) {
    this.canvasWidth = width;
    this.canvasHeight = height;
    this._updatePlotArea();
    this.emit('resize', {
      width,
      height,
      plotArea: this.plotArea
    });
  }
  _updatePlotArea() {
    this.plotArea = {
      x: this.marginLeft,
      y: this.marginTop,
      width: Math.max(1, this.canvasWidth - this.marginLeft - this.marginRight),
      height: Math.max(1, this.canvasHeight - this.marginTop - this.marginBottom),
      right: this.canvasWidth - this.marginRight,
      bottom: this.canvasHeight - this.marginBottom
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
      y: event.clientY - rect.top
    };
  }
  eventToData(event, canvas) {
    const {
      x,
      y
    } = this.getCanvasPosition(event, canvas);
    return {
      dataX: this.screenXToData(x),
      dataY: this.screenYToData(y),
      screenX: x,
      screenY: y
    };
  }
  isInPlotArea(screenX, screenY) {
    const {
      x,
      y,
      width,
      height
    } = this.plotArea;
    return screenX >= x && screenX <= x + width && screenY >= y && screenY <= y + height;
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
      zoom
    };
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
      const logMin = Math.log10(Math.max(min, 1e-10));
      const logMax = Math.log10(Math.max(max, 1e-10));
      const logFocal = Math.log10(Math.max(focal, 1e-10));
      const logSpan = logMax - logMin;
      const newLogSpan = logSpan / factor;
      const ratio = logSpan > 0 ? (logFocal - logMin) / logSpan : 0.5;
      const newLogMin = logFocal - ratio * newLogSpan;
      return [Math.pow(10, newLogMin), Math.pow(10, newLogMin + newLogSpan)];
    } else {
      const span = max - min;
      const newSpan = span / factor;
      const ratio = span > 0 ? (focal - min) / span : 0.5;
      const newMin = focal - ratio * newSpan;
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
      const logMin = Math.log10(Math.max(min, 1e-10));
      const logMax = Math.log10(Math.max(max, 1e-10));
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
      const logMin = Math.log10(Math.max(min, 1e-10));
      const logMax = Math.log10(Math.max(max, 1e-10));
      const logMid = (logMin + logMax) / 2;
      const newHalf = (logMax - logMin) / (2 * factor);
      return [Math.pow(10, logMid - newHalf), Math.pow(10, logMid + newHalf)];
    } else {
      const mid = (min + max) / 2;
      const newHalf = (max - min) / (2 * factor);
      return [mid - newHalf, mid + newHalf];
    }
  }
}

/**
 * AxisController — config-only axis descriptor (ARCH-G).
 *
 * Holds scale type, tick formatting, and appearance options that can be shared
 * across multiple PlotController instances.  All domain/range state and
 * zoom/pan mutations have moved to ViewportController.
 *
 * Shared-config example:
 *   const xAxis = new AxisController({ scaleType: 'log', tickCount: 8 });
 *   const plot1 = new PlotController({ xAxis });
 *   const plot2 = new PlotController({ xAxis });
 *   // Both plots use the same tick formatting; each has its own domain.
 */


// Scientific number formatter: uses SI prefix for large/small numbers
const formatSci = format('.3~s');
const formatFixed = format('.4~g');

// F39: d3-scale's own multi-granularity default time formatter (ms→sec→min→hour→
// day/week→month→year, auto-selected per tick from which time boundary it falls on).
// Built once — confirmed against d3-scale's source that this closure is domain/range
// -independent, so a single instance is safe to reuse across every 'time' axis.
const defaultTimeFormat = scaleTime().tickFormat();
function defaultFormatter(scaleType) {
  if (scaleType === 'time') {
    return defaultTimeFormat;
  }
  return v => {
    const abs = Math.abs(v);
    if (abs === 0) return '0';
    if (abs >= 1e4 || abs < 1e-3) return formatSci(v);
    return formatFixed(v);
  };
}
const DEFAULT_TICK_SIZE = 5; // px

class AxisController {
  /**
   * @param {object} opts
   *
   * Scale / tick appearance (ARCH-G):
   * @param {'linear'|'log'|'time'} [opts.scaleType='linear']
   * @param {function|null}          [opts.tickFormat=null]  — (value, index, step?) => string
   *   `step` (F39/F40) is the delta between consecutive tick values — undefined when
   *   there are fewer than 2 ticks. Existing 2-arg formatters can ignore it.
   * @param {number}                 [opts.tickCount=5]
   * @param {string|null}            [opts.label=null]
   *
   * Positioning (F35):
   * @param {'border'|'relative'}    [opts.mode='border']
   *   'border'   — axis rendered at fixed canvas edges (default behavior)
   *   'relative' — axis line tracks a data coordinate; can snap/hide at edges
   *
   * Border-mode options:
   * @param {string[]|null}          [opts.edges=null]
   *   Edges to render at. For x-axis: 'top'|'bottom'; for y-axis: 'left'|'right'.
   *   Multiple values produce mirrored axes. `null` → AxisRenderer uses its
   *   per-axis default (['bottom'] for x, ['left'] for y).
   *
   * Relative-mode options:
   * @param {number}   [opts.crossingValue=0]
   *   The data coordinate the axis line is anchored to (y-value for x-axis,
   *   x-value for y-axis).
   * @param {number}   [opts.snapTolerancePx=0]
   *   Pixels from edge at which the axis snaps to border rendering.
   *   0 = never snap (stationary). >0 = mobile behavior.
   * @param {'border'|'hide'} [opts.offscreen='border']
   *   What to do when crossingValue is outside the visible domain.
   *   'border' = render at nearest border edge. 'hide' = render nothing.
   * @param {'auto'|'positive'|'negative'} [opts.labelSide='auto']
   *   Which side of the axis line labels appear on.
   *   'auto' = toward nearest edge. 'positive' = data-positive side.
   *   'negative' = data-negative side.
   *
   */
  constructor(opts = {}) {
    // ── Appearance ────────────────────────────────────────────────────────────
    this.scaleType = opts.scaleType || 'linear';
    this.tickCount = opts.tickCount ?? 5;
    this.label = opts.label ?? null;
    this.tickFormat = opts.tickFormat ?? null;

    // ── Positioning (F35) ─────────────────────────────────────────────────────
    this.mode = opts.mode ?? 'border';
    this.edges = opts.edges ?? null; // null → renderer default
    this.crossingValue = opts.crossingValue ?? 0;
    this.snapTolerancePx = opts.snapTolerancePx ?? 0;
    this.offscreen = opts.offscreen ?? 'border';
    this.labelSide = opts.labelSide ?? 'auto';
    this._formatter = this.tickFormat || defaultFormatter(this.scaleType);
  }

  // ─── Methods consumed by AxisRenderer / ViewportController ──────────────────

  /**
   * Build and return a fresh d3 scale with the given domain and range applied.
   * Does NOT mutate any internal state — safe to share across plots.
   *
   * @param {number[]} domain  — [min, max]
   * @param {number[]} range   — [pxStart, pxEnd]
   * @returns {Function} d3 scale
   */
  getScale(domain, range) {
    let scale;
    switch (this.scaleType) {
      case 'log':
        scale = scaleLog();
        break;
      case 'time':
        scale = scaleTime();
        break;
      default:
        scale = scaleLinear();
        break;
    }
    return scale.domain(domain).range(range);
  }

  /**
   * Generate tick values from a pre-built d3 scale.
   *
   * @param {Function} scale — d3 scale (already has domain+range applied)
   * @returns {{ value: number, screen: number, label: string }[]}
   */
  getTicks(scale) {
    const ticks = scale.ticks(this.tickCount);
    // F39/F40: step between consecutive ticks, passed as a 3rd arg to the formatter
    // so it can pick a display granularity (e.g. epoch-offset µs formatting in F40).
    // For 'time' scales this is a millisecond delta (Date - Date coerces via valueOf());
    // for 'linear'/'log' it's raw domain units. undefined when there are <2 ticks.
    const step = ticks.length >= 2 ? ticks[1] - ticks[0] : undefined;
    return ticks.map((v, i) => ({
      value: v,
      screen: scale(v),
      label: this._formatter(v, i, step)
    }));
  }

  /**
   * Format a single tick value as a display string.
   *
   * @param {number} value
   * @param {number} [index=0]
   * @returns {string}
   */
  formatTick(value, index = 0) {
    return this._formatter(value, index);
  }

  /**
   * Tick mark length in pixels.
   * @returns {number}
   */
  getTickSize() {
    return DEFAULT_TICK_SIZE;
  }
}

/**
 * AxisRenderer — renders axis ticks, labels, and grid lines to a 2D Canvas overlay.
 *
 * This canvas sits on top of the deck.gl WebGL canvas.  It is styled with
 * pointer-events:none so mouse events pass through to deck.gl.
 *
 * Rendering is triggered by PlotController's render loop (requestAnimationFrame).
 * AxisRenderer does NOT schedule its own rAF — it is called synchronously from
 * PlotController.render().
 */

class AxisRenderer {
  /**
   * @param {HTMLCanvasElement} canvas  — 2D overlay canvas
   * @param {AxisController}    xAxis
   * @param {AxisController}    yAxis
   * @param {ViewportController} viewport
   */
  constructor(canvas, xAxis, yAxis, viewport) {
    this._canvas = canvas;
    this._ctx = canvas.getContext('2d');
    this._xAxis = xAxis;
    this._yAxis = yAxis;
    this._viewport = viewport;
    this._visible = true;
    this._exportMode = false;
    this._bordered = false; // F34: fill gutters with container background

    // Style
    this._style = {
      background: 'rgba(13,13,13,0.0)',
      axisColor: '#666',
      tickColor: '#888',
      labelColor: '#ccc',
      gridColor: 'rgba(80,80,80,0.25)',
      fontSize: 11,
      fontFamily: 'monospace',
      tickLength: 5,
      labelPadding: 4
    };
  }

  // ─── Visibility ───────────────────────────────────────────────────────────────

  setVisible(v) {
    this._visible = v;
  }

  /** In export mode axes can be hidden via options */
  exportMode(hide = false) {
    this._exportMode = hide;
  }

  /** Merge partial style overrides (e.g. { hideXAxis: true }) */
  setStyle(partial) {
    Object.assign(this._style, partial);
  }

  /**
   * F34: enable/disable gutter fill.
   * When true, the four margin rectangles are filled with the container's
   * CSS background color before ticks are drawn, so data never bleeds
   * visually behind tick labels.
   * @param {boolean} on
   */
  setBordered(on) {
    this._bordered = !!on;
  }

  // ─── Main render ─────────────────────────────────────────────────────────────

  /**
   * Render axes and optional LineROI labels onto the 2D canvas overlay.
   *
   * @param {import('../ROI/ROIBase').ROIBase[]} [rois=[]] — current ROI list;
   *   half-variant LineROI labels are drawn here per spec (NOT in WebGL).
   */
  render(rois = []) {
    if (!this._visible || this._exportMode) {
      this._clear();
      return;
    }
    const ctx = this._ctx;
    const {
      canvasWidth: W,
      canvasHeight: H,
      plotArea: pa
    } = this._viewport;

    // Resize canvas to match display
    if (this._canvas.width !== W || this._canvas.height !== H) {
      this._canvas.width = W;
      this._canvas.height = H;
    }
    this._clear();

    // F34: fill gutters with container background before drawing any ticks/labels
    if (this._bordered) this._fillGutters(ctx, W, H, pa);
    ctx.save();

    // Plot area border
    ctx.strokeStyle = this._style.axisColor;
    ctx.lineWidth = 1;
    ctx.strokeRect(pa.x, pa.y, pa.width, pa.height);

    // F35: dispatch to mode-aware x/y axis renderers
    if (!this._style.hideXAxis) this._renderXAxis(ctx, pa);
    this._renderYAxis(ctx, pa);

    // LineROI labels (half-variants only; canvas overlay per spec)
    this._renderLineROILabels(ctx, rois, pa);
    ctx.restore();
  }

  // ─── Axis hit-test (F21) ─────────────────────────────────────────────────────

  /**
   * Determine whether a canvas pixel position falls inside an axis gutter.
   *
   * X-axis gutter: below the plot bottom edge, within the plot's x extent.
   * Y-axis gutter: left of the plot left edge, within the plot's y extent.
   *
   * @param {number} px — canvas pixel x
   * @param {number} py — canvas pixel y
   * @returns {'x'|'y'|null}
   */
  getAxisHit(px, py) {
    const {
      plotArea: pa
    } = this._viewport;

    // X-axis gutter — below plot area, horizontally within plot
    if (py > pa.y + pa.height && px >= pa.x && px <= pa.x + pa.width) {
      return 'x';
    }

    // Y-axis gutter — left of plot area, vertically within plot
    if (px < pa.x && py >= pa.y && py <= pa.y + pa.height) {
      return 'y';
    }
    return null;
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  _clear() {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  /**
   * F34: fill the four gutter rectangles (margins outside the plot area) with
   * the container's CSS background color so data cannot bleed behind tick labels.
   *
   * Uses `getComputedStyle(canvas.parentElement).backgroundColor` so the color
   * automatically matches whatever the host application sets on the container.
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} W   — canvas width
   * @param {number} H   — canvas height
   * @param {{ x, y, width, height, right, bottom }} pa  — plot area
   */
  _fillGutters(ctx, W, H, pa) {
    // Walk up the DOM until we find a non-transparent background color.
    // This handles cases where the immediate parent has no background set
    // (e.g. a flex wrapper with only layout styles).
    const isTransparent = c => !c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)';
    let bg = 'transparent';
    let el = this._canvas.parentElement;
    while (el && el !== document.documentElement) {
      const c = getComputedStyle(el).backgroundColor;
      if (!isTransparent(c)) {
        bg = c;
        break;
      }
      el = el.parentElement;
    }

    // Skip if no opaque background found
    if (isTransparent(bg)) return;
    ctx.save();
    ctx.fillStyle = bg;

    // Top gutter   (full width, above plot area)
    ctx.fillRect(0, 0, W, pa.y);
    // Bottom gutter (full width, below plot area)
    ctx.fillRect(0, pa.bottom, W, H - pa.bottom);
    // Left gutter   (between top and bottom gutters, left of plot area)
    ctx.fillRect(0, pa.y, pa.x, pa.height);
    // Right gutter  (between top and bottom gutters, right of plot area)
    ctx.fillRect(pa.right, pa.y, W - pa.right, pa.height);
    ctx.restore();
  }

  // ─── F35: X-axis dispatch ────────────────────────────────────────────────────

  _renderXAxis(ctx, pa) {
    const xScale = this._viewport.getXScale();
    if (!xScale) return;
    const ticks = this._xAxis.getTicks(xScale);
    const mode = this._xAxis.mode || 'border';
    if (mode === 'relative') {
      this._renderXAxisRelative(ctx, pa, ticks);
    } else {
      // border mode — render grid once, then per-edge ticks
      const edges = this._xAxis.edges ?? ['bottom'];
      this._renderXGrid(ctx, pa, ticks);
      for (const edge of edges) {
        this._renderXTicksAtEdge(ctx, pa, ticks, edge);
      }
      // axis label at outermost of the listed edges (bottom if available, else top)
      if (this._xAxis.label) {
        const labelEdge = edges.includes('bottom') ? 'bottom' : edges[0] ?? 'bottom';
        this._renderXLabel(ctx, pa, labelEdge);
      }
    }
  }

  /** Grid lines only — rendered once regardless of number of edges. */
  _renderXGrid(ctx, pa, ticks) {
    const s = this._style;
    ctx.strokeStyle = s.gridColor;
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;
      ctx.beginPath();
      ctx.moveTo(sx, pa.y);
      ctx.lineTo(sx, pa.y + pa.height);
      ctx.stroke();
    }
  }

  /**
   * Tick marks + labels at a single x-axis edge.
   * @param {'top'|'bottom'} edge
   */
  _renderXTicksAtEdge(ctx, pa, ticks, edge) {
    const s = this._style;
    const tickLength = this._xAxis.getTickSize();
    const atBottom = edge !== 'top';
    const baseY = atBottom ? pa.y + pa.height : pa.y;
    // Outward direction: +1 = downward (outward from bottom), -1 = upward (outward from top)
    const outDir = atBottom ? 1 : -1;
    ctx.textAlign = 'center';
    ctx.textBaseline = atBottom ? 'top' : 'bottom';
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(sx, baseY);
      ctx.lineTo(sx, baseY + outDir * tickLength);
      ctx.stroke();
      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, sx, baseY + outDir * (tickLength + s.labelPadding));
    }
  }
  _renderXLabel(ctx, pa, edge) {
    const s = this._style;
    const atBottom = edge !== 'top';
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = s.labelColor;
    if (atBottom) {
      ctx.textBaseline = 'top';
      ctx.fillText(this._xAxis.label, pa.x + pa.width / 2, pa.y + pa.height + 30);
    } else {
      ctx.textBaseline = 'bottom';
      ctx.fillText(this._xAxis.label, pa.x + pa.width / 2, pa.y - 18);
    }
  }

  /**
   * Relative-mode x-axis: the axis line is horizontal, anchored at a y-data
   * value (`crossingValue`), and can snap to edges or hide when off-screen.
   */
  _renderXAxisRelative(ctx, pa, ticks) {
    const yScale = this._viewport.getYScale();
    if (!yScale) return;
    const ax = this._xAxis;
    const crossVal = ax.crossingValue ?? 0;
    const [yMin, yMax] = this._viewport.getYDomain();

    // Off-screen check
    const inDomain = crossVal >= Math.min(yMin, yMax) && crossVal <= Math.max(yMin, yMax);
    if (!inDomain) {
      if (ax.offscreen === 'hide') return;
      // 'border' → nearest edge
      // y domain min/max doesn't directly map to bottom/top because of inverted range
      // screenY at domain edge: yMin maps to plotBottom (pa.y+pa.height), yMax to pa.y
      // crossVal < yMin → off the bottom of data → screen bottom edge
      const [rangeA, rangeB] = [yScale.range()[0], yScale.range()[1]];
      const screenBottomVal = rangeA > rangeB ? rangeA : rangeB; // larger screen-y = bottom
      const offEdge = yScale(crossVal) > screenBottomVal ? 'bottom' : 'top';
      this._renderXGrid(ctx, pa, ticks);
      this._renderXTicksAtEdge(ctx, pa, ticks, offEdge);
      if (ax.label) this._renderXLabel(ctx, pa, offEdge);
      return;
    }
    const screenY = yScale(crossVal);

    // Snap check
    const snap = ax.snapTolerancePx ?? 0;
    if (snap > 0) {
      const distBottom = Math.abs(screenY - (pa.y + pa.height));
      const distTop = Math.abs(screenY - pa.y);
      if (distBottom <= snap || distTop <= snap) {
        const snapEdge = distBottom <= distTop ? 'bottom' : 'top';
        this._renderXGrid(ctx, pa, ticks);
        this._renderXTicksAtEdge(ctx, pa, ticks, snapEdge);
        if (ax.label) this._renderXLabel(ctx, pa, snapEdge);
        return;
      }
    }

    // Mid-plot render
    const s = this._style;

    // Grid lines (at each x-tick position, full plot height)
    this._renderXGrid(ctx, pa, ticks);

    // Axis line (horizontal at screenY, full plot width)
    ctx.strokeStyle = s.axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pa.x, screenY);
    ctx.lineTo(pa.x + pa.width, screenY);
    ctx.stroke();

    // Tick direction: toward nearer edge
    const midY = pa.y + pa.height / 2;
    // Ticks point outward toward nearest edge:
    //   upper half (screenY < midY) → ticks go upward (-1)
    //   lower half (screenY >= midY) → ticks go downward (+1)
    const tickDir = screenY < midY ? -1 : 1;
    const tickLen = ax.getTickSize();

    // Label side: resolve from labelSide option
    // 'auto'     → same side as ticks (toward nearest edge)
    // 'positive' → above the line (data-positive y direction = lower screen y)
    // 'negative' → below the line (data-negative y direction = higher screen y)
    let labelDir;
    if (ax.labelSide === 'positive') {
      // positive y in data = smaller screen y (inverted range)
      labelDir = -1;
    } else if (ax.labelSide === 'negative') {
      labelDir = 1;
    } else {
      // 'auto' → same direction as ticks
      labelDir = tickDir;
    }
    const labelBaseline = labelDir < 0 ? 'bottom' : 'top';
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sx = tick.screen;
      if (sx < pa.x || sx > pa.x + pa.width) continue;
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(sx, screenY);
      ctx.lineTo(sx, screenY + tickDir * tickLen);
      ctx.stroke();
      ctx.fillStyle = s.labelColor;
      ctx.textBaseline = labelBaseline;
      ctx.fillText(tick.label, sx, screenY + labelDir * (tickLen + s.labelPadding));
    }
    if (ax.label) {
      ctx.fillStyle = s.labelColor;
      ctx.textAlign = 'center';
      ctx.textBaseline = labelBaseline;
      ctx.fillText(ax.label, pa.x + pa.width / 2, screenY + labelDir * (tickLen + s.labelPadding + 14));
    }
  }

  // ─── F35: Y-axis dispatch ────────────────────────────────────────────────────

  _renderYAxis(ctx, pa) {
    const yScale = this._viewport.getYScale();
    if (!yScale) return;
    const ticks = this._yAxis.getTicks(yScale);
    const mode = this._yAxis.mode || 'border';
    if (mode === 'relative') {
      this._renderYAxisRelative(ctx, pa, ticks);
    } else {
      const edges = this._yAxis.edges ?? ['left'];
      this._renderYGrid(ctx, pa, ticks);
      for (const edge of edges) {
        this._renderYTicksAtEdge(ctx, pa, ticks, edge);
      }
      if (this._yAxis.label) {
        const labelEdge = edges.includes('left') ? 'left' : edges[0] ?? 'left';
        this._renderYLabel(ctx, pa, labelEdge);
      }
    }
  }
  _renderYGrid(ctx, pa, ticks) {
    const s = this._style;
    ctx.strokeStyle = s.gridColor;
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;
      ctx.beginPath();
      ctx.moveTo(pa.x, sy);
      ctx.lineTo(pa.x + pa.width, sy);
      ctx.stroke();
    }
  }

  /**
   * Tick marks + labels at a single y-axis edge.
   * @param {'left'|'right'} edge
   */
  _renderYTicksAtEdge(ctx, pa, ticks, edge) {
    const s = this._style;
    const tickLength = this._yAxis.getTickSize();
    const atLeft = edge !== 'right';
    const baseX = atLeft ? pa.x : pa.x + pa.width;
    // Outward: -1 = leftward (outward from left edge), +1 = rightward (outward from right)
    const outDir = atLeft ? -1 : 1;
    ctx.textBaseline = 'middle';
    ctx.textAlign = atLeft ? 'right' : 'left';
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(baseX, sy);
      ctx.lineTo(baseX + outDir * tickLength, sy);
      ctx.stroke();
      ctx.fillStyle = s.labelColor;
      ctx.fillText(tick.label, baseX + outDir * (tickLength + s.labelPadding), sy);
    }
  }
  _renderYLabel(ctx, pa, edge) {
    const s = this._style;
    const atLeft = edge !== 'right';
    ctx.save();
    if (atLeft) {
      ctx.translate(12, pa.y + pa.height / 2);
    } else {
      ctx.translate(pa.x + pa.width + this._viewport.marginRight - 12, pa.y + pa.height / 2);
    }
    ctx.rotate(-Math.PI / 2);
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = s.labelColor;
    ctx.fillText(this._yAxis.label, 0, 0);
    ctx.restore();
  }

  /**
   * Relative-mode y-axis: the axis line is vertical, anchored at an x-data
   * value (`crossingValue`), with snap/offscreen/labelSide support.
   */
  _renderYAxisRelative(ctx, pa, ticks) {
    const xScale = this._viewport.getXScale();
    if (!xScale) return;
    const ay = this._yAxis;
    const crossVal = ay.crossingValue ?? 0;
    const [xMin, xMax] = this._viewport.getXDomain();

    // Off-screen check
    const inDomain = crossVal >= Math.min(xMin, xMax) && crossVal <= Math.max(xMin, xMax);
    if (!inDomain) {
      if (ay.offscreen === 'hide') return;
      const offEdge = crossVal < Math.min(xMin, xMax) ? 'left' : 'right';
      this._renderYGrid(ctx, pa, ticks);
      this._renderYTicksAtEdge(ctx, pa, ticks, offEdge);
      if (ay.label) this._renderYLabel(ctx, pa, offEdge);
      return;
    }
    const screenX = xScale(crossVal);

    // Snap check
    const snap = ay.snapTolerancePx ?? 0;
    if (snap > 0) {
      const distLeft = Math.abs(screenX - pa.x);
      const distRight = Math.abs(screenX - (pa.x + pa.width));
      if (distLeft <= snap || distRight <= snap) {
        const snapEdge = distLeft <= distRight ? 'left' : 'right';
        this._renderYGrid(ctx, pa, ticks);
        this._renderYTicksAtEdge(ctx, pa, ticks, snapEdge);
        if (ay.label) this._renderYLabel(ctx, pa, snapEdge);
        return;
      }
    }

    // Mid-plot render
    const s = this._style;
    this._renderYGrid(ctx, pa, ticks);

    // Axis line (vertical at screenX, full plot height)
    ctx.strokeStyle = s.axisColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(screenX, pa.y);
    ctx.lineTo(screenX, pa.y + pa.height);
    ctx.stroke();

    // Tick direction: toward nearer edge
    const midX = pa.x + pa.width / 2;
    // Left half  (screenX < midX) → ticks go left  (-1)
    // Right half (screenX >= midX) → ticks go right (+1)
    const tickDir = screenX < midX ? -1 : 1;
    const tickLen = ay.getTickSize();

    // Label side
    let labelDir;
    if (ay.labelSide === 'positive') {
      // positive x direction = rightward (+1)
      labelDir = 1;
    } else if (ay.labelSide === 'negative') {
      labelDir = -1;
    } else {
      // 'auto' → same as ticks
      labelDir = tickDir;
    }
    const textAlign = labelDir < 0 ? 'right' : 'left';
    ctx.font = `${s.fontSize}px ${s.fontFamily}`;
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 1;
    for (const tick of ticks) {
      const sy = tick.screen;
      if (sy < pa.y || sy > pa.y + pa.height) continue;
      ctx.strokeStyle = s.tickColor;
      ctx.beginPath();
      ctx.moveTo(screenX, sy);
      ctx.lineTo(screenX + tickDir * tickLen, sy);
      ctx.stroke();
      ctx.fillStyle = s.labelColor;
      ctx.textAlign = textAlign;
      ctx.fillText(tick.label, screenX + labelDir * (tickLen + s.labelPadding), sy);
    }
    if (ay.label) {
      ctx.save();
      ctx.translate(screenX + labelDir * (tickLen + s.labelPadding + 14), pa.y + pa.height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = s.labelColor;
      ctx.fillText(ay.label, 0, 0);
      ctx.restore();
    }
  }

  // ─── LineROI labels ──────────────────────────────────────────────────────────

  /**
   * Render text labels for LineROI half-variants onto the canvas overlay.
   *
   * Rules (from spec):
   *   - Labels only render on half variants (mode contains 'half')
   *   - Positioned near the tip (the "open" end of the half-line)
   *   - Centered perpendicular to the line direction
   *   - Clipped to plot area
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {import('../ROI/ROIBase').ROIBase[]} rois
   * @param {{ x, y, width, height }} pa  — plot area bounds
   */
  _renderLineROILabels(ctx, rois, pa) {
    const s = this._style;
    for (const roi of rois) {
      if (roi.type !== 'lineROI') continue;
      if (!roi.flags.visible) continue;
      if (!roi.label) continue;
      if (!roi.mode.includes('half')) continue;
      const LABEL_PAD = 14; // pixels from the tip edge

      ctx.save();
      ctx.font = `bold ${s.fontSize}px ${s.fontFamily}`;
      ctx.lineWidth = 3;
      // Dark stroke behind text for legibility over the plot
      ctx.strokeStyle = 'rgba(0,0,0,0.65)';
      if (roi.orientation === 'vertical') {
        const lx = this._viewport.dataXToScreen(roi.position);
        // Only render if within plot x-range
        if (lx < pa.x || lx > pa.x + pa.width) {
          ctx.restore();
          continue;
        }
        ctx.textAlign = 'center';
        let ly;
        if (roi.mode === 'vline-half-top') {
          // Tip is at the top of the plot area
          ly = pa.y + LABEL_PAD;
          ctx.textBaseline = 'top';
        } else {
          // vline-half-bottom: tip is at the bottom
          ly = pa.y + pa.height - LABEL_PAD;
          ctx.textBaseline = 'bottom';
        }
        ctx.strokeText(roi.label, lx, ly);
        ctx.fillStyle = '#fff';
        ctx.fillText(roi.label, lx, ly);
      } else {
        const ly = this._viewport.dataYToScreen(roi.position);
        // Only render if within plot y-range
        if (ly < pa.y || ly > pa.y + pa.height) {
          ctx.restore();
          continue;
        }
        ctx.textBaseline = 'bottom';
        let lx;
        if (roi.mode === 'hline-half-left') {
          // Tip is at the left edge of the plot
          lx = pa.x + LABEL_PAD;
          ctx.textAlign = 'left';
        } else {
          // hline-half-right: tip is at the right edge
          lx = pa.x + pa.width - LABEL_PAD;
          ctx.textAlign = 'right';
        }
        ctx.strokeText(roi.label, lx, ly - 2);
        ctx.fillStyle = '#fff';
        ctx.fillText(roi.label, lx, ly - 2);
      }
      ctx.restore();
    }
  }
}

/**
 * epochTickFormat — F40: tick formatting + conversion helpers for the epoch-offset
 * high-precision time axis pattern.
 *
 * DataStore's GPU buffers are Float32Array (~7 significant decimal digits), which
 * cannot hold an absolute epoch-seconds timestamp with microsecond precision — at
 * that magnitude (~1.7e9) float32's representable gap already exceeds 100. The fix
 * is to keep small offsets-from-a-reference-time in the GPU buffer (which fit
 * float32 fine) and reconstruct absolute time for display using a reference time
 * kept in JS double precision (PlotController's `timeOrigin` option).
 */

const fmtDate = timeFormat('%Y-%m-%d');
const fmtHour = timeFormat('%m-%d %H:%M');
const fmtMinute = timeFormat('%H:%M');
const fmtSecond = timeFormat('%H:%M:%S');

/**
 * Round `frac` (in [0, 1)) to `decimals` places without the classic toFixed()
 * carry bug (e.g. 0.9999996.toFixed(6) === "1.000000", which would silently
 * belong to the next whole second, not the current one). Returns the corrected
 * whole-second count (bumped by 1 if rounding carried) and a zero-padded string.
 */
function roundFraction(wholeSeconds, frac, decimals) {
  const scale = 10 ** decimals;
  let units = Math.round(frac * scale);
  let whole = wholeSeconds;
  if (units >= scale) {
    units -= scale;
    whole += 1;
  }
  return {
    whole,
    fracStr: String(units).padStart(decimals, '0')
  };
}

/**
 * Build a tick formatter for an epoch-offset x-axis.
 *
 * @param {object} opts
 * @param {number} opts.timeOriginMs   — reference epoch, milliseconds (JS double)
 * @param {number} [opts.unitsPerSecond=1] — 1 if x-domain units are seconds, 1000 if ms
 * @returns {(value: number, index?: number, step?: number) => string}
 */
function buildEpochTickFormatter({
  timeOriginMs,
  unitsPerSecond = 1
}) {
  return function epochTickFormatter(value, _index, step) {
    const epochSeconds = dataXToEpochSeconds(value, timeOriginMs, unitsPerSecond);
    const stepSeconds = step === undefined ? undefined : Math.abs(step) / unitsPerSecond;
    if (stepSeconds === undefined || stepSeconds >= 86400) {
      return fmtDate(new Date(Math.trunc(epochSeconds * 1000)));
    }
    if (stepSeconds >= 3600) {
      return fmtHour(new Date(Math.trunc(epochSeconds * 1000)));
    }
    if (stepSeconds >= 60) {
      return fmtMinute(new Date(Math.trunc(epochSeconds * 1000)));
    }
    const wholeSecondFloor = Math.floor(epochSeconds);
    const frac = epochSeconds - wholeSecondFloor; // 0 <= frac < 1, double precision

    if (stepSeconds >= 1) {
      return fmtSecond(new Date(wholeSecondFloor * 1000));
    }

    // Sub-second: the fractional digits come from the double `frac`, NOT from
    // Date.getMilliseconds() (which truncates at 1ms and would silently defeat
    // the whole point of this feature).
    const decimals = stepSeconds >= 0.001 ? 3 : 6;
    const {
      whole,
      fracStr
    } = roundFraction(wholeSecondFloor, frac, decimals);
    return `${fmtSecond(new Date(whole * 1000))}.${fracStr}`;
  };
}

/**
 * Convert a data-x offset value into an absolute epoch-seconds timestamp,
 * in JS double precision (never touches a Float32 buffer, so no precision loss).
 *
 * @param {number} x
 * @param {number} timeOriginMs
 * @param {number} [unitsPerSecond=1]
 * @returns {number} epoch seconds (double precision)
 */
function dataXToEpochSeconds(x, timeOriginMs, unitsPerSecond = 1) {
  return timeOriginMs / 1000 + x / unitsPerSecond;
}

/**
 * Inverse of dataXToEpochSeconds — convert an absolute epoch-seconds timestamp
 * into the small offset value that should be written into a DataStore/ROI x.
 *
 * @param {number} epochSeconds
 * @param {number} timeOriginMs
 * @param {number} [unitsPerSecond=1]
 * @returns {number}
 */
function epochSecondsToDataX(epochSeconds, timeOriginMs, unitsPerSecond = 1) {
  return (epochSeconds - timeOriginMs / 1000) * unitsPerSecond;
}

/**
 * ROIBase — abstract base class for all Region-of-Interest types.
 *
 * Stores bounds in data (world) coordinates.  The ConstraintEngine operates
 * on these same coordinates so there is no screen ↔ data conversion needed
 * during constraint enforcement.
 *
 * Event model: ROIBase extends EventEmitter; events bubble upward manually
 * (child emits → ROIController re-emits on PlotController).
 */

let _nextId = 1;
class ROIBase extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.x1]
   * @param {number} [opts.x2]
   * @param {number} [opts.y1]
   * @param {number} [opts.y2]
   * @param {object} [opts.flags]
   * @param {object} [opts.metadata]
   */
  constructor(opts = {}) {
    super();
    this.id = opts.id || `roi_${_nextId++}`;
    this.type = 'base'; // overridden by subclasses

    // Data-space bounds
    this.x1 = opts.x1 ?? 0;
    this.x2 = opts.x2 ?? 1;
    this.y1 = opts.y1 ?? 0;
    this.y2 = opts.y2 ?? 1;

    // Tree relationships
    this.parent = null;
    this.children = [];

    // Behaviour flags
    this.flags = {
      movable: true,
      resizable: true,
      visible: true,
      pickable: true,
      ...opts.flags
    };
    this.metadata = opts.metadata || {};
    this.color = opts.color || null;

    // F14: versioning + serialization fields
    this.version = opts.version || 1;
    this.updatedAt = opts.updatedAt || Date.now();
    this.domain = opts.domain || {
      x: [this.x1, this.x2],
      y: [this.y1, this.y2]
    };

    // Visual state
    this.selected = false;
    this.hovered = false;
  }

  // ─── Versioning ──────────────────────────────────────────────────────────────

  /**
   * Increment version, refresh updatedAt and domain snapshot.
   * Called by ROIController on mouseup (user commit). Never called for
   * external updates — use updateFromExternal() to set version directly.
   */
  bumpVersion() {
    this.version += 1;
    this.updatedAt = Date.now();
    this.syncDomain();
  }

  /**
   * Snapshot current bounds into this.domain without bumping version.
   * Call after programmatic bound changes (e.g. post-constraint clamping on add).
   * Subclasses override to omit non-JSON-safe axes (±Infinity y, single-axis lines).
   */
  syncDomain() {
    this.domain = {
      x: [this.x1, this.x2],
      y: [this.y1, this.y2]
    };
  }

  // ─── Bounds ──────────────────────────────────────────────────────────────────

  getBounds() {
    return {
      x1: this.x1,
      x2: this.x2,
      y1: this.y1,
      y2: this.y2
    };
  }
  setBounds(bounds, silent = false) {
    this.x1 = bounds.x1;
    this.x2 = bounds.x2;
    this.y1 = bounds.y1;
    this.y2 = bounds.y2;
    if (!silent) this.emit('onUpdate', {
      roi: this,
      bounds: this.getBounds()
    });
  }
  get width() {
    return Math.abs(this.x2 - this.x1);
  }
  get height() {
    return Math.abs(this.y2 - this.y1);
  }

  // ─── Tree ────────────────────────────────────────────────────────────────────

  setParent(parent) {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.parent = parent;
    if (parent) {
      parent.addChild(this);
    }
  }
  addChild(child) {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
  }
  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }

  /**
   * Walk all descendants (depth-first).
   * @param {Function} fn — called with each child ROI
   */
  walkChildren(fn) {
    for (const child of this.children) {
      fn(child);
      child.walkChildren(fn);
    }
  }

  // ─── Serialization ───────────────────────────────────────────────────────────

  /**
   * Serialize to a plain JSON-safe object.
   * Subclasses (e.g. LineROI) override this to add type-specific fields.
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      x1: this.x1,
      x2: this.x2,
      y1: this.y1,
      y2: this.y2,
      flags: this.flags,
      metadata: this.metadata,
      color: this.color,
      version: this.version,
      updatedAt: this.updatedAt,
      domain: this.domain
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  onCreate() {
    this.emit('onCreate', {
      roi: this
    });
  }
  onDelete() {
    this.emit('onDelete', {
      roi: this
    });
    // Detach from parent
    if (this.parent) {
      this.parent.removeChild(this);
      this.parent = null;
    }
    // Recursively delete children
    for (const child of [...this.children]) {
      child.onDelete();
    }
    this.children = [];
  }
}

/**
 * RectROI — rectangular region of interest.
 *
 * Draggable and resizable via eight handles (corners + edges).
 * Bounds are stored in data coordinates; screen conversions happen in
 * ROIController using ViewportController.
 *
 * Handle naming convention — names match VISUAL screen positions:
 *   TOP_*    = upper part of the rect on screen  = the y2 data edge (y2 > y1)
 *   BOTTOM_* = lower part of the rect on screen  = the y1 data edge
 * (y-scale is inverted: y2 maps to smaller screen-y, i.e. visually higher)
 *
 * xLocked flag:
 *   When true (set for RectROIs parented to a LinearRegion) the LEFT, RIGHT,
 *   and x-component of corner handles are suppressed.  Only vertical resizing
 *   and pure-y MOVE is allowed.  X bounds are managed entirely by the parent.
 */

const HANDLES = {
  NONE: 'none',
  MOVE: 'move',
  TOP_LEFT: 'tl',
  TOP_RIGHT: 'tr',
  BOTTOM_LEFT: 'bl',
  BOTTOM_RIGHT: 'br',
  TOP: 'tm',
  BOTTOM: 'bm',
  LEFT: 'ml',
  RIGHT: 'mr'
};
const HANDLE_SIZE_PX = 8;
class RectROI extends ROIBase {
  constructor(opts = {}) {
    super(opts);
    this.type = 'rect';
    // When true, x1/x2 are owned by the parent LinearRegion.
    // Left/right handles are hidden and dx is ignored in applyDelta.
    this.xLocked = opts.xLocked ?? false;
  }

  /**
   * Detect which handle (if any) is under the given screen position.
   *
   * Visual layout (y-scale inverted — y2 is higher on screen than y1):
   *   TL ─ TM ─ TR      ← y2s (small screen-y, visual top)
   *   ML         MR
   *   BL ─ BM ─ BR      ← y1s (large screen-y, visual bottom)
   *
   * @param {number} sx — screen x
   * @param {number} sy — screen y
   * @param {ViewportController} viewport
   * @returns {string} — one of HANDLES.*
   */
  hitTestHandles(sx, sy, viewport) {
    if (!this.flags.visible) return HANDLES.NONE;
    const x1s = viewport.dataXToScreen(this.x1);
    const x2s = viewport.dataXToScreen(this.x2);
    // y1 < y2 in data, but y scale is inverted so y1s > y2s on screen
    const y1s = viewport.dataYToScreen(this.y1); // visual bottom (large screen-y)
    const y2s = viewport.dataYToScreen(this.y2); // visual top   (small screen-y)

    const h = HANDLE_SIZE_PX;
    const midX = (x1s + x2s) / 2;
    const midY = (y1s + y2s) / 2;
    const near = (cx, cy) => Math.abs(sx - cx) <= h && Math.abs(sy - cy) <= h;
    if (this.xLocked) {
      // Only vertical resize + move allowed.
      // Corner positions redirect to pure-vertical handles.
      if (near(midX, y2s)) return HANDLES.TOP;
      if (near(midX, y1s)) return HANDLES.BOTTOM;
      // Corner hits → collapse to the matching vertical-only handle
      if (near(x1s, y2s) || near(x2s, y2s)) return HANDLES.TOP;
      if (near(x1s, y1s) || near(x2s, y1s)) return HANDLES.BOTTOM;
      // Left/right midpoint → block (no x movement)
      const inX = sx >= Math.min(x1s, x2s) && sx <= Math.max(x1s, x2s);
      const inY = sy >= Math.min(y2s, y1s) && sy <= Math.max(y2s, y1s);
      if (inX && inY) return HANDLES.MOVE;
      return HANDLES.NONE;
    }

    // Full handle set — names match visual positions:
    //   y2s is the visual TOP, y1s is the visual BOTTOM
    if (near(x1s, y2s)) return HANDLES.TOP_LEFT;
    if (near(x2s, y2s)) return HANDLES.TOP_RIGHT;
    if (near(x1s, y1s)) return HANDLES.BOTTOM_LEFT;
    if (near(x2s, y1s)) return HANDLES.BOTTOM_RIGHT;
    if (near(midX, y2s)) return HANDLES.TOP;
    if (near(midX, y1s)) return HANDLES.BOTTOM;
    if (near(x1s, midY)) return HANDLES.LEFT;
    if (near(x2s, midY)) return HANDLES.RIGHT;
    const inX = sx >= Math.min(x1s, x2s) && sx <= Math.max(x1s, x2s);
    const inY = sy >= Math.min(y2s, y1s) && sy <= Math.max(y2s, y1s);
    if (inX && inY) return HANDLES.MOVE;
    return HANDLES.NONE;
  }

  /**
   * Apply a delta to bounds based on the active handle.
   * All deltas are in DATA coordinates.
   *
   * Handle semantics (corrected to match visual positions):
   *   TOP_*    modifies y2 (the visually upper edge, y2 > y1 in data)
   *   BOTTOM_* modifies y1 (the visually lower edge)
   *
   * When xLocked, dx is silently ignored — x bounds are managed by the parent.
   *
   * @param {string} handle
   * @param {number} dx — data-space delta x
   * @param {number} dy — data-space delta y
   */
  applyDelta(handle, dx, dy) {
    const applyX = !this.xLocked;
    switch (handle) {
      case HANDLES.MOVE:
        if (applyX) {
          this.x1 += dx;
          this.x2 += dx;
        }
        this.y1 += dy;
        this.y2 += dy;
        break;
      case HANDLES.TOP_LEFT:
        if (applyX) this.x1 += dx;
        this.y2 += dy; // TOP → y2 (visual top edge)
        break;
      case HANDLES.TOP_RIGHT:
        if (applyX) this.x2 += dx;
        this.y2 += dy;
        break;
      case HANDLES.BOTTOM_LEFT:
        if (applyX) this.x1 += dx;
        this.y1 += dy; // BOTTOM → y1 (visual bottom edge)
        break;
      case HANDLES.BOTTOM_RIGHT:
        if (applyX) this.x2 += dx;
        this.y1 += dy;
        break;
      case HANDLES.TOP:
        this.y2 += dy; // visual top edge = y2
        // Clamp: TOP handle must not cross below the BOTTOM edge.
        // Clamping (not swapping) prevents the confusing snap/teleport that
        // occurs when the restore-then-delta approach hits the normalization
        // swap at the crossover boundary.
        if (this.y2 < this.y1) this.y2 = this.y1;
        break;
      case HANDLES.BOTTOM:
        this.y1 += dy; // visual bottom edge = y1
        // Clamp: BOTTOM handle must not cross above the TOP edge.
        if (this.y1 > this.y2) this.y1 = this.y2;
        break;
      case HANDLES.LEFT:
        if (applyX) this.x1 += dx;
        break;
      case HANDLES.RIGHT:
        if (applyX) this.x2 += dx;
        break;
    }

    // Normalise so x1 ≤ x2 and y1 ≤ y2
    if (this.x1 > this.x2) [this.x1, this.x2] = [this.x2, this.x1];
    if (this.y1 > this.y2) [this.y1, this.y2] = [this.y2, this.y1];
    this.emit('onUpdate', {
      roi: this,
      bounds: this.getBounds()
    });
  }
}

/**
 * LinearRegion — vertical strip ROI (defined by x1 and x2 on the x-axis).
 *
 * y1 / y2 span the full plot height; only x1 / x2 are user-controlled.
 * Can contain RectROI children; ConstraintEngine enforces that children
 * stay within the x range of this region.
 *
 * Interaction:
 *   - Click on left or right edge → resize (move that edge independently)
 *   - Click in body → move (x1 and x2 shift by same delta)
 */

const EDGE_THRESHOLD_PX = 8; // screen pixels for edge hit detection

const LR_HANDLES = {
  NONE: 'none',
  MOVE: 'move',
  LEFT_EDGE: 'left',
  RIGHT_EDGE: 'right'
};
class LinearRegion extends ROIBase {
  /**
   * @param {object} opts
   * @param {number} opts.x1   — left edge in data coordinates
   * @param {number} opts.x2   — right edge in data coordinates
   * @param {number} [opts.y1=-Infinity]  — auto-spans full plot area
   * @param {number} [opts.y2=Infinity]
   */
  constructor(opts = {}) {
    super(opts);
    this.type = 'linearRegion';
    // y-bounds default to ±Infinity (full height)
    this.y1 = opts.y1 ?? -Infinity;
    this.y2 = opts.y2 ?? Infinity;
    // Override base domain: LinearRegion has no meaningful y domain
    if (!opts.domain) {
      this.domain = {
        x: [this.x1, this.x2]
      };
    }
  }

  /**
   * F14: Override — LinearRegion domain omits y (spans ±Infinity; not JSON-safe).
   */
  bumpVersion() {
    this.version += 1;
    this.updatedAt = Date.now();
    this.syncDomain();
  }
  syncDomain() {
    this.domain = {
      x: [this.x1, this.x2]
    };
  }

  /**
   * Hit test: detect left edge, right edge, or body (move).
   *
   * @param {number} sx — screen x
   * @param {number} sy — screen y
   * @param {ViewportController} viewport
   * @returns {string} LR_HANDLES.*
   */
  hitTest(sx, sy, viewport) {
    if (!this.flags.visible) return LR_HANDLES.NONE;
    const x1s = viewport.dataXToScreen(this.x1);
    const x2s = viewport.dataXToScreen(this.x2);
    const {
      plotArea: pa
    } = viewport;

    // Only hit-test within y bounds of plot area
    if (sy < pa.y || sy > pa.y + pa.height) return LR_HANDLES.NONE;
    const left = Math.min(x1s, x2s);
    const right = Math.max(x1s, x2s);
    if (Math.abs(sx - left) < EDGE_THRESHOLD_PX) return LR_HANDLES.LEFT_EDGE;
    if (Math.abs(sx - right) < EDGE_THRESHOLD_PX) return LR_HANDLES.RIGHT_EDGE;
    if (sx > left && sx < right) return LR_HANDLES.MOVE;
    return LR_HANDLES.NONE;
  }

  /**
   * Apply a data-space delta based on the active handle.
   * @param {string} handle
   * @param {number} dx
   */
  applyDelta(handle, dx) {
    switch (handle) {
      case LR_HANDLES.MOVE:
        this.x1 += dx;
        this.x2 += dx;
        break;
      case LR_HANDLES.LEFT_EDGE:
        this.x1 += dx;
        if (this.x1 > this.x2) this.x1 = this.x2;
        break;
      case LR_HANDLES.RIGHT_EDGE:
        this.x2 += dx;
        if (this.x2 < this.x1) this.x2 = this.x1;
        break;
    }
    this.emit('onUpdate', {
      roi: this,
      bounds: this.getBounds()
    });
  }
}

/**
 * LineROI — a single vertical or horizontal line ROI.
 *
 * Supported modes:
 *   vline             — full-height vertical line
 *   hline             — full-width horizontal line
 *   vline-half-top    — vertical, midpoint → top of plot
 *   vline-half-bottom — vertical, bottom of plot → midpoint
 *   hline-half-left   — horizontal, left edge → midpoint
 *   hline-half-right  — horizontal, midpoint → right edge
 *
 * Labels (optional, max 25 chars) are only rendered on half-variant modes.
 * Labels are drawn on the canvas 2D overlay — NOT in WebGL.
 *
 * Constraint / nesting rules (enforced by ConstraintEngine):
 *   - Vertical LineROI may be a child of LinearRegion (x is constrained).
 *   - Horizontal LineROI may be a child of a horizontal-bounding ROI.
 *   - Mixed alignments are disallowed (vertical inside horizontal is a no-op).
 *
 * ROIBase bounds are kept in sync with this.position so that ConstraintEngine
 * can reason about them without special-casing:
 *   vertical:   x1 = x2 = position; y1 = -Inf; y2 = +Inf
 *   horizontal: y1 = y2 = position; x1 = -Inf; x2 = +Inf
 *
 * After ConstraintEngine clamps the bounds it calls child._syncPosition() (if
 * it exists) to write the updated bound back into this.position.
 *
 * Serialization format:
 *   { id, type:'lineROI', orientation, mode, position, label, version, updatedAt, domain, metadata }
 */

const DRAG_THRESHOLD_PX = 8;
const LINE_HANDLE = {
  NONE: 'none',
  MOVE: 'move'
};
class LineROI extends ROIBase {
  /**
   * @param {object}   opts
   * @param {'vertical'|'horizontal'} [opts.orientation='vertical']
   * @param {string}   [opts.mode]       One of the 6 mode strings (defaults to
   *                                     'vline' for vertical, 'hline' for horizontal)
   * @param {number}   [opts.position=0] Data coordinate on the primary axis
   * @param {string}   [opts.label]      Optional label ≤25 chars; half variants only
   */
  constructor(opts = {}) {
    super(opts);
    this.type = 'lineROI';
    this.orientation = opts.orientation || 'vertical';
    this.mode = opts.mode || (this.orientation === 'vertical' ? 'vline' : 'hline');
    this.position = opts.position ?? 0;
    this.label = opts.label != null ? String(opts.label).slice(0, 25) : null;

    // Sync ROIBase x1/x2/y1/y2 from the initial position
    this._syncBoundsFromPosition();

    // Override base domain unless one was passed in (deserialization path)
    if (!opts.domain) {
      this.domain = this._buildDomain();
    }

    // LineROI is movable but not resizable
    this.flags.resizable = false;
  }

  // ─── Domain helpers ───────────────────────────────────────────────────────

  _buildDomain() {
    return this.orientation === 'vertical' ? {
      x: [this.position, this.position]
    } : {
      y: [this.position, this.position]
    };
  }

  /**
   * F14 override — domain captures position for version-gating.
   */
  bumpVersion() {
    this.version += 1;
    this.updatedAt = Date.now();
    this.syncDomain();
  }
  syncDomain() {
    this.domain = this._buildDomain();
  }

  // ─── Bounds ↔ position sync ───────────────────────────────────────────────

  /**
   * Write this.position into the ROIBase x1/x2/y1/y2 fields so that
   * ConstraintEngine can operate on them without special-casing LineROI.
   */
  _syncBoundsFromPosition() {
    if (this.orientation === 'vertical') {
      this.x1 = this.x2 = this.position;
      this.y1 = -Infinity;
      this.y2 = Infinity;
    } else {
      this.y1 = this.y2 = this.position;
      this.x1 = -Infinity;
      this.x2 = Infinity;
    }
  }

  /**
   * Write the ROIBase bounds back into this.position.
   * Called by ConstraintEngine and ROIController after any external clamp.
   */
  _syncPosition() {
    if (this.orientation === 'vertical') {
      this.position = this.x1; // x1 === x2 after clamping
    } else {
      this.position = this.y1; // y1 === y2 after clamping
    }
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  /**
   * Hit test — returns LINE_HANDLE.MOVE if the pointer is within DRAG_THRESHOLD_PX
   * of the rendered line, LINE_HANDLE.NONE otherwise.
   *
   * @param {number} sx — screen x (canvas pixels)
   * @param {number} sy — screen y (canvas pixels)
   * @param {ViewportController} viewport
   * @returns {'move'|'none'}
   */
  hitTest(sx, sy, viewport) {
    if (!this.flags.visible) return LINE_HANDLE.NONE;
    const {
      plotArea: pa
    } = viewport;
    if (this.orientation === 'vertical') {
      // Only match within the y bounds of the plot area
      if (sy < pa.y || sy > pa.y + pa.height) return LINE_HANDLE.NONE;
      const lineScreenX = viewport.dataXToScreen(this.position);
      if (Math.abs(sx - lineScreenX) <= DRAG_THRESHOLD_PX) return LINE_HANDLE.MOVE;
    } else {
      // Only match within the x bounds of the plot area
      if (sx < pa.x || sx > pa.x + pa.width) return LINE_HANDLE.NONE;
      const lineScreenY = viewport.dataYToScreen(this.position);
      if (Math.abs(sy - lineScreenY) <= DRAG_THRESHOLD_PX) return LINE_HANDLE.MOVE;
    }
    return LINE_HANDLE.NONE;
  }

  /**
   * Apply a data-space delta.
   *
   * ROIController restores bounds to dragStartBounds before calling this, so
   * dx/dy represent the total displacement from the drag origin (avoids float
   * drift).  After applying the delta we re-sync the bounds.
   *
   * @param {string} handle — always LINE_HANDLE.MOVE for LineROI
   * @param {number} dx     — total horizontal data-space displacement
   * @param {number} dy     — total vertical data-space displacement
   */
  applyDelta(handle, dx, dy) {
    if (handle !== LINE_HANDLE.MOVE) return;
    if (this.orientation === 'vertical') {
      // this.x1 was restored to the drag-start position just before this call
      this.position = this.x1 + dx;
    } else {
      // this.y1 was restored to the drag-start position just before this call
      this.position = this.y1 + dy;
    }
    this._syncBoundsFromPosition();
    this.emit('onUpdate', {
      roi: this,
      bounds: this.getBounds()
    });
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Override ROIBase to include LineROI-specific fields.
   * Called by ROIController.serializeAll().
   *
   * @returns {{ id, type, orientation, mode, position, label, version, updatedAt, domain, metadata }}
   */
  serialize() {
    return {
      id: this.id,
      type: this.type,
      // 'lineROI'
      orientation: this.orientation,
      mode: this.mode,
      position: this.position,
      label: this.label,
      version: this.version,
      updatedAt: this.updatedAt,
      domain: this.domain,
      metadata: this.metadata,
      color: this.color
    };
  }
}

/**
 * ConstraintEngine — enforces parent-child bounds constraints after any ROI mutation.
 *
 * How it works:
 * ─────────────
 * 1. After a parent ROI is moved/resized, call applyConstraints(parent, delta).
 * 2. The engine walks the parent's children (and their children, depth-first).
 * 3. For each child, it applies two rules:
 *      a. SHIFT rule  — if the parent *moved*, shift the child by the same delta
 *         so it stays in the same relative position within the parent.
 *      b. CLAMP rule  — if (after shifting) any child edge would lie outside
 *         the parent bounds, clamp it to the nearest parent edge.
 * 4. After adjusting a child, recurse into that child's own children (they must
 *    also satisfy constraints relative to the newly-clamped child).
 *
 * Return value:
 *   applyConstraints returns a Set<ROIBase> containing only the descendants
 *   whose bounds actually changed (numeric comparison). The caller uses this to
 *   emit roiUpdated (drag) or bumpVersion + roiFinalized (mouseup) selectively.
 *
 * Cascade sequence:
 *   parentMoved → childShifted → grandChildShifted → ...
 *
 * Infinite loop guard:
 *   Each call gets a Set of visited ROI ids; if we see the same id twice we stop.
 *
 * Note: y constraints are only enforced for ROIBase subclasses with finite y bounds.
 * LinearRegion has y = ±Infinity, so children are only constrained in x.
 */

class ConstraintEngine {
  constructor() {
    // No state; this is a pure algorithm.
  }

  /**
   * Apply constraints on all descendants of a moved/resized parent.
   * Returns the set of descendant ROIs whose bounds actually changed.
   *
   * @param {ROIBase} parent     — the ROI that was just updated
   * @param {object}  delta      — { dx, dy } the parent itself moved by
   *                               (pass {dx:0,dy:0} for resize-only operations)
   * @returns {Set<ROIBase>}     — descendants whose bounds changed (numeric comparison)
   */
  applyConstraints(parent, delta = {
    dx: 0,
    dy: 0
  }) {
    const changed = new Set();
    this._applyRecursive(parent, delta, new Set(), changed);
    return changed;
  }

  /**
   * Internal recursive implementation.
   *
   * @param {ROIBase} parent
   * @param {object}  delta     — { dx, dy }
   * @param {Set}     visited   — loop guard (ROI ids)
   * @param {Set}     changed   — accumulator for ROIs whose bounds changed
   */
  _applyRecursive(parent, delta, visited, changed) {
    if (visited.has(parent.id)) return;
    visited.add(parent.id);
    for (const child of parent.children) {
      if (visited.has(child.id)) continue;

      // ── Snapshot before any modification ─────────────────────────────────
      const before = {
        x1: child.x1,
        x2: child.x2,
        y1: child.y1,
        y2: child.y2
      };

      // ── Step 1: Shift child by same delta as parent ───────────────────────
      // This preserves the child's relative position inside the parent.
      if (delta.dx !== 0 || delta.dy !== 0) {
        child.x1 += delta.dx;
        child.x2 += delta.dx;

        // Only shift y if the parent has finite y bounds (i.e. not LinearRegion)
        if (isFinite(parent.y1)) {
          child.y1 += delta.dy;
          child.y2 += delta.dy;
        }
      }

      // ── Step 2: Clamp child within parent bounds ──────────────────────────
      if (child.xLocked) {
        // xLocked children always match the parent x bounds exactly
        child.x1 = parent.x1;
        child.x2 = parent.x2;
      } else {
        this._clampChild(child, parent);
      }

      // ── For LineROI: write the clamped x1/y1 back into position ─────────
      if (typeof child._syncPosition === 'function') {
        child._syncPosition();
      }

      // ── Track whether bounds actually changed (numeric comparison) ────────
      if (child.x1 !== before.x1 || child.x2 !== before.x2 || child.y1 !== before.y1 || child.y2 !== before.y2) {
        changed.add(child);
      }

      // Emit an update event so any future render-layer listeners pick up changes
      child.emit('onUpdate', {
        roi: child,
        bounds: child.getBounds()
      });

      // ── Step 3: Recurse — child's own children must satisfy constraints ───
      // delta for the grandchildren is zero here because the child itself may
      // have been clamped to a different position than a straight shift would give.
      this._applyRecursive(child, {
        dx: 0,
        dy: 0
      }, visited, changed);
    }
  }

  /**
   * Clamp child bounds so they do not exceed parent bounds.
   * The child is modified in-place.
   *
   * Clamping is asymmetric: if the child is wider than the parent, it is
   * shrunk to fit rather than moved.
   *
   * @param {ROIBase} child
   * @param {ROIBase} parent
   */
  _clampChild(child, parent) {
    const px1 = parent.x1;
    const px2 = parent.x2;

    // Clamp x
    if (child.x1 < px1) {
      const overflow = px1 - child.x1;
      child.x1 = px1;
      // Try to shift x2 right to preserve width, but don't exceed parent
      child.x2 = Math.min(child.x2 + overflow, px2);
    }
    if (child.x2 > px2) {
      const overflow = child.x2 - px2;
      child.x2 = px2;
      // Try to shift x1 left to preserve width, but don't go below parent
      child.x1 = Math.max(child.x1 - overflow, px1);
    }

    // Clamp y (only when parent has finite y bounds)
    if (isFinite(parent.y1) && isFinite(parent.y2)) {
      const py1 = Math.min(parent.y1, parent.y2);
      const py2 = Math.max(parent.y1, parent.y2);
      if (child.y1 < py1) {
        const overflow = py1 - child.y1;
        child.y1 = py1;
        child.y2 = Math.min(child.y2 + overflow, py2);
      }
      if (child.y2 > py2) {
        const overflow = child.y2 - py2;
        child.y2 = py2;
        child.y1 = Math.max(child.y1 - overflow, py1);
      }
    }
  }
}

/**
 * ROIController — handles all ROI interaction (creation, drag, resize, delete).
 *
 * Operates entirely independently of React.  Mouse events come from canvas
 * DOM listeners registered during init().  All state is stored in this class.
 *
 * Screen ↔ Data coordinate conversion:
 *   ViewportController.screenXToData / screenYToData handle this using the
 *   current axis scales.  This means ROI positions are always in data space
 *   and remain valid across zoom/pan operations.
 *
 * Creation modes (F41: keys are configurable via opts.keyBindings / setKeyBindings()):
 *   'L' key → LinearRegion creation (2 clicks: x1, x2)
 *   'R' key → RectROI creation (2 clicks: top-left, bottom-right)
 *   'D' key → delete active/selected ROI
 *   Escape  → cancel creation
 *
 * Event flow:
 *   ROIController emits → PlotController listens → re-emits on own EventEmitter
 */


// REL7: recognized ROI type discriminators, per _roiFromSerialized()
const VALID_ROI_TYPES = new Set(['linearRegion', 'rect', 'lineROI']);

/**
 * REL7: validate a serializedROI object shape before it reaches
 * version-gating/apply logic. Returns null if valid, or a string describing
 * the offending field otherwise.
 */
function _validateSerializedROI(s) {
  if (!s || typeof s !== 'object') return '"serializedROI" must be an object';
  if (typeof s.id !== 'string' || s.id.length === 0) return '"id" must be a non-empty string';
  if (!VALID_ROI_TYPES.has(s.type)) {
    return `"type" must be one of ${[...VALID_ROI_TYPES].join(', ')} (got ${JSON.stringify(s.type)})`;
  }
  if (typeof s.version !== 'number' || !Number.isFinite(s.version)) {
    return '"version" must be a finite number';
  }
  const validRange = r => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite);
  if (s.type === 'linearRegion' || s.type === 'rect') {
    if (!s.domain || !validRange(s.domain.x)) {
      return '"domain.x" must be a 2-element array of finite numbers';
    }
  }
  if (s.type === 'rect') {
    if (!validRange(s.domain.y)) {
      return '"domain.y" must be a 2-element array of finite numbers';
    }
  }
  if (s.type === 'lineROI' && s.position === undefined && !s.domain) {
    return 'lineROI requires either "position" or "domain"';
  }
  return null;
}

// F41: configurable ROI-creation keybinds — action name -> key (lowercased).
// 'deleteROI' fires regardless of mouse position (see _onKeyDown); the rest
// are gated on the mouse being over this controller's canvas.
const DEFAULT_ROI_KEY_BINDINGS = {
  createLinear: 'l',
  createRect: 'r',
  createVLine: 'v',
  createHLine: 'h',
  deleteROI: 'd',
  cancel: 'escape'
};
const VALID_ROI_KEY_ACTIONS = new Set(Object.keys(DEFAULT_ROI_KEY_BINDINGS));
class ROIController extends EventEmitter {
  /**
   * @param {ViewportController} viewport
   * @param {object} [opts]
   * @param {object} [opts.keyBindings] — F41: partial override of
   *   { createLinear, createRect, createVLine, createHLine, deleteROI, cancel },
   *   merged over DEFAULT_ROI_KEY_BINDINGS. Unrecognized action names or
   *   non-string/empty values warn and fall back to the default.
   */
  constructor(viewport, opts = {}) {
    super();
    this._viewport = viewport;
    this._constraintEngine = new ConstraintEngine();

    // F41: configurable keybinds — this._keyBindings: { [action]: key }
    this._keyBindings = null;
    this._setKeyBindingMap(opts.keyBindings);

    // All ROIs keyed by id
    this._rois = new Map();

    // Interaction state
    this._mode = 'idle'; // 'idle' | 'createLinear' | 'createRect'
    this._creationStep = 0; // 0 = waiting for first click, 1 = waiting for second
    this._creationData = null; // partial bounds during creation

    // Drag/resize state
    this._dragging = false;
    this._dragROI = null; // ROI being dragged
    this._dragHandle = null; // handle type
    this._dragStartData = null; // { dataX, dataY } at mousedown
    this._dragStartBounds = null; // ROI bounds at mousedown

    // Currently selected ROI
    this._activeROI = null;

    // Canvas reference (set during init)
    this._canvas = null;

    // Track whether the mouse is currently over this controller's canvas.
    // Used to gate keybinds so only the hovered plot responds.
    this._mouseIsOver = false;

    // Bound handlers for cleanup
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onMouseEnter = () => {
      this._mouseIsOver = true;
    };
    this._onMouseLeave = () => {
      this._mouseIsOver = false;
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Attach to canvas and start listening for events.
   * @param {HTMLElement} canvas
   */
  init(canvas) {
    this._canvas = canvas;
    canvas.addEventListener('mousedown', this._onMouseDown);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mouseenter', this._onMouseEnter);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
    window.addEventListener('keydown', this._onKeyDown);
  }
  destroy() {
    if (this._canvas) {
      this._canvas.removeEventListener('mousedown', this._onMouseDown);
      this._canvas.removeEventListener('mousemove', this._onMouseMove);
      this._canvas.removeEventListener('mouseup', this._onMouseUp);
      this._canvas.removeEventListener('mouseenter', this._onMouseEnter);
      this._canvas.removeEventListener('mouseleave', this._onMouseLeave);
    }
    window.removeEventListener('keydown', this._onKeyDown);
  }

  // ─── Public ROI management ───────────────────────────────────────────────────

  getAllROIs() {
    return [...this._rois.values()];
  }
  getROI(id) {
    return this._rois.get(id);
  }
  addROI(roi) {
    this._rois.set(roi.id, roi);
    roi.syncDomain();
  }
  deleteROI(id) {
    const roi = this._rois.get(id);
    if (!roi) return;
    if (roi.flags.deletable === false) return;

    // Remove children from map recursively
    roi.walkChildren(child => this._rois.delete(child.id));
    roi.onDelete();
    this._rois.delete(id);
    if (this._activeROI && this._activeROI.id === id) {
      this._activeROI = null;
    }
    this.emit('roiDeleted', {
      id
    });
    this.emit('roisChanged', {
      rois: this.getAllROIs()
    });
  }

  /**
   * Merge a patch into an ROI's behaviour flags (movable/resizable/visible/pickable/...).
   * Flags are not geometry — this does not bump version or emit roiFinalized.
   * @param {string} id
   * @param {object} flagsPatch
   */
  setFlags(id, flagsPatch) {
    const roi = this._rois.get(id);
    if (!roi) return;
    Object.assign(roi.flags, flagsPatch);
    this.emit('roisChanged', {
      rois: this.getAllROIs()
    });
  }

  // ─── F14: Serialization API ──────────────────────────────────────────────────

  /**
   * Serialize all ROIs to plain JSON-safe objects.
   * @returns {{ id, type, version, updatedAt, domain, metadata }[]}
   */
  serializeAll() {
    return this.getAllROIs().map(roi => {
      const s = typeof roi.serialize === 'function' ? roi.serialize() : {
        id: roi.id,
        type: roi.type,
        version: roi.version,
        updatedAt: roi.updatedAt,
        domain: roi.domain,
        metadata: roi.metadata
      };
      s.parentId = roi.parent?.id ?? null;
      return s;
    });
  }

  /**
   * Restore ROIs from a serialized array (initial load only).
   * Clears all existing ROIs; emits 'roisChanged' once.
   * @param {{ id, type, version, updatedAt, domain, metadata }[]} array
   */
  deserializeAll(array) {
    this._rois.clear();
    this._activeROI = null;
    for (const s of array) {
      const roi = this._roiFromSerialized(s);
      if (roi) this._rois.set(roi.id, roi);
    }
    this.emit('roisChanged', {
      rois: this.getAllROIs()
    });
  }

  /**
   * Apply an externally-sourced ROI update, gated by version.
   * Rejects silently if incoming.version <= current.version.
   *
   * @param {{ id, type, version, updatedAt, domain, metadata }} serializedROI
   * @returns {boolean} true if accepted, false if rejected (stale version or,
   *   per REL7, malformed shape — a warning names the offending field)
   */
  updateFromExternal(serializedROI) {
    const shapeError = _validateSerializedROI(serializedROI);
    if (shapeError) {
      console.warn(`ROIController.updateFromExternal: rejected — ${shapeError}`);
      return false;
    }
    const existing = this._rois.get(serializedROI.id);

    // Reject stale or equal version
    if (existing && serializedROI.version <= existing.version) {
      return false;
    }
    if (existing) {
      // Apply bounds from domain
      if (serializedROI.domain && serializedROI.domain.x) {
        existing.x1 = serializedROI.domain.x[0];
        existing.x2 = serializedROI.domain.x[1];
      }
      if (serializedROI.domain && serializedROI.domain.y) {
        existing.y1 = serializedROI.domain.y[0];
        existing.y2 = serializedROI.domain.y[1];
      }
      // LineROI: sync position from explicit field or from updated bounds
      if (existing.type === 'lineROI') {
        if (serializedROI.position !== undefined) {
          existing.position = serializedROI.position;
          existing._syncBoundsFromPosition();
        } else if (typeof existing._syncPosition === 'function') {
          existing._syncPosition();
        }
        if (serializedROI.label !== undefined) {
          existing.label = serializedROI.label != null ? String(serializedROI.label).slice(0, 25) : null;
        }
        if (serializedROI.mode !== undefined) existing.mode = serializedROI.mode;
      }
      existing.version = serializedROI.version;
      existing.updatedAt = serializedROI.updatedAt;
      existing.domain = serializedROI.domain;
      if (serializedROI.metadata) existing.metadata = serializedROI.metadata;
      if (serializedROI.color != null) existing.color = serializedROI.color;
    } else {
      // ROI not found — create it
      const roi = this._roiFromSerialized(serializedROI);
      if (!roi) return false;
      this._rois.set(roi.id, roi);
    }
    const target = this._rois.get(serializedROI.id);
    this.emit('roiExternalUpdate', {
      roi: target,
      version: serializedROI.version
    });
    this.emit('roisChanged', {
      rois: this.getAllROIs()
    });
    return true;
  }

  // ─── Creation mode ────────────────────────────────────────────────────────────

  enterCreateMode(type) {
    this._mode = type === 'linear' ? 'createLinear' : type === 'rect' ? 'createRect' : type === 'vline' ? 'createVLine' : type === 'hline' ? 'createHLine' : 'idle';
    this._creationStep = 0;
    this._creationData = null;
    this.emit('modeChanged', {
      mode: this._mode
    });
  }
  cancelCreateMode() {
    this._mode = 'idle';
    this._creationStep = 0;
    this._creationData = null;
    this.emit('modeChanged', {
      mode: 'idle'
    });
  }

  // ─── Event handlers ───────────────────────────────────────────────────────────

  // ─── F41: Configurable keybinds ───────────────────────────────────────────────

  /**
   * Remap ROI-creation keybinds at runtime. Partial override, merged over
   * DEFAULT_ROI_KEY_BINDINGS (not over the current map — matches setMouseButtons()'s
   * "merge over the default" semantics from F38).
   * @param {object} patch — subset of { createLinear, createRect, createVLine, createHLine, deleteROI, cancel }
   */
  setKeyBindings(patch) {
    this._setKeyBindingMap(patch);
  }

  /** @private */
  _setKeyBindingMap(cfg) {
    const merged = {
      ...DEFAULT_ROI_KEY_BINDINGS,
      ...(cfg || {})
    };
    const map = {};
    const seen = new Map(); // key -> action, for collision detection

    for (const action of VALID_ROI_KEY_ACTIONS) {
      let key = merged[action];
      if (key === null) {
        // Explicitly disabled — no key triggers this action.
        map[action] = null;
        continue;
      }
      if (typeof key !== 'string' || key.length === 0) {
        console.warn(`ROIController: invalid keyBindings.${action} value ${JSON.stringify(merged[action])}; ` + `falling back to default "${DEFAULT_ROI_KEY_BINDINGS[action]}"`);
        key = DEFAULT_ROI_KEY_BINDINGS[action];
      }
      key = key.toLowerCase();
      map[action] = key;
      const prior = seen.get(key);
      if (prior) {
        console.warn(`ROIController: keyBindings "${prior}" and "${action}" both bind to "${key}"; both will fire on that keypress.`);
      }
      seen.set(key, action);
    }

    // Warn on unrecognized action names in the supplied config (ignored otherwise)
    if (cfg) {
      for (const action of Object.keys(cfg)) {
        if (!VALID_ROI_KEY_ACTIONS.has(action)) {
          console.warn(`ROIController: unknown keyBindings action "${action}"; ignored.`);
        }
      }
    }
    this._keyBindings = map;
  }
  _onKeyDown(e) {
    const k = e.key.toLowerCase();
    const kb = this._keyBindings;

    // deleteROI fires regardless of whether the mouse is over this canvas —
    // allows deletion after selecting from a table row.
    if (k === kb.deleteROI) {
      const target = this._activeROI ?? [...this._rois.values()].find(r => r.selected) ?? null;
      if (target) this.deleteROI(target.id);
      return;
    }

    // All other keybinds only fire when the mouse is over this plot's canvas,
    // so multiple plots on the same page don't all activate simultaneously.
    if (!this._mouseIsOver) return;
    if (k === kb.createLinear) this.enterCreateMode('linear');else if (k === kb.createRect) this.enterCreateMode('rect');else if (k === kb.createVLine) this.enterCreateMode('vline');else if (k === kb.createHLine) this.enterCreateMode('hline');else if (k === kb.cancel) this.cancelCreateMode();
  }
  _onMouseDown(e) {
    if (e.button !== 0) return; // left button only

    const {
      dataX,
      dataY,
      screenX,
      screenY
    } = this._viewport.eventToData(e, this._canvas);
    if (!this._viewport.isInPlotArea(screenX, screenY)) return;

    // ── Creation mode: handle clicks for 2-click workflow ──────────────────
    if (this._mode === 'createLinear') {
      this._handleLinearCreationClick(dataX, dataY);
      return;
    }
    if (this._mode === 'createRect') {
      this._handleRectCreationClick(dataX, dataY);
      return;
    }
    if (this._mode === 'createVLine') {
      this._handleLineROICreationClick(dataX, dataY, 'vertical');
      return;
    }
    if (this._mode === 'createHLine') {
      this._handleLineROICreationClick(dataX, dataY, 'horizontal');
      return;
    }

    // ── Idle mode: check for ROI hit ────────────────────────────────────────
    const hit = this._hitTest(screenX, screenY);
    if (hit) {
      this._activeROI = hit.roi;

      // Deselect all, select hit ROI (locked ROIs remain selectable/clickable)
      this._selectOnly(hit.roi);
      this.emit('roiSelected', {
        roi: hit.roi
      });
      const isMoveHandle = hit.handle === HANDLES.MOVE || hit.handle === LR_HANDLES.MOVE || hit.handle === LINE_HANDLE.MOVE;
      const blocked = isMoveHandle ? hit.roi.flags.movable === false : hit.roi.flags.resizable === false;
      if (!blocked) {
        this._dragging = true;
        this._dragROI = hit.roi;
        this._dragHandle = hit.handle;
        this._dragStartData = {
          dataX,
          dataY
        };
        this._dragStartBounds = hit.roi.getBounds();
      }
    } else {
      // Click on empty space → deselect
      this._deselectAll();
      this._activeROI = null;
      this.emit('roiDeselected', {});
    }
  }
  _onMouseMove(e) {
    const {
      dataX,
      dataY,
      screenX,
      screenY
    } = this._viewport.eventToData(e, this._canvas);
    if (this._dragging && this._dragROI) {
      // Compute data-space delta from drag start
      const dx = dataX - this._dragStartData.dataX;
      const dy = dataY - this._dragStartData.dataY;
      const roi = this._dragROI;

      // Restore to start bounds then apply delta (avoids float drift)
      const sb = this._dragStartBounds;
      roi.x1 = sb.x1;
      roi.x2 = sb.x2;
      roi.y1 = sb.y1;
      roi.y2 = sb.y2;
      if (roi.type === 'linearRegion') {
        roi.applyDelta(this._dragHandle, dx);
      } else {
        roi.applyDelta(this._dragHandle, dx, dy);
      }

      // Enforce constraints upward (parent might clip this ROI)
      if (roi.parent) {
        // xLocked rects always track parent x bounds exactly
        if (roi.xLocked) {
          roi.x1 = roi.parent.x1;
          roi.x2 = roi.parent.x2;
        } else {
          this._constraintEngine._clampChild(roi, roi.parent);
        }
        // LineROI: write the clamped bound back into position
        if (typeof roi._syncPosition === 'function') {
          roi._syncPosition();
        }
        roi.emit('onUpdate', {
          roi,
          bounds: roi.getBounds()
        });
      }

      // Enforce constraints downward (children follow); collect changed set (F19)
      const delta = roi.type === 'linearRegion' ? {
        dx: roi.x1 - sb.x1,
        dy: 0
      } : {
        dx: roi.x1 - sb.x1,
        dy: roi.y1 - sb.y1
      };
      const changed = this._constraintEngine.applyConstraints(roi, delta);

      // Emit roiUpdated for the active ROI itself
      this.emit('roiUpdated', {
        roi,
        bounds: roi.getBounds()
      });

      // F19: also emit roiUpdated for each child whose bounds actually changed
      changed.forEach(child => {
        this.emit('roiUpdated', {
          roi: child,
          bounds: child.getBounds()
        });
      });
      this.emit('roisChanged', {
        rois: this.getAllROIs()
      });
      return;
    }

    // Hover detection (update hovered state for visual feedback)
    for (const roi of this._rois.values()) {
      roi.hovered = false;
    }
    if (this._viewport.isInPlotArea(screenX, screenY)) {
      const hit = this._hitTest(screenX, screenY);
      if (hit) hit.roi.hovered = true;
    }
  }
  _onMouseUp(_e) {
    if (this._dragging) {
      const roi = this._dragROI;
      this._dragging = false;
      this._dragROI = null;
      this._dragHandle = null;
      this._dragStartData = null;

      // F14: bump version on commit, emit full versioned payload
      if (roi) {
        roi.bumpVersion();
        this.emit('roiFinalized', {
          roi,
          bounds: roi.getBounds(),
          version: roi.version,
          updatedAt: roi.updatedAt,
          domain: roi.domain
        });

        // F19: for each descendant whose bounds differ from the last committed
        // domain snapshot, bump its version and emit roiFinalized.
        // Only bumps when bounds actually changed — no false-positive increments.
        roi.walkChildren(child => {
          const d = child.domain;
          const xChanged = child.x1 !== d.x[0] || child.x2 !== d.x[1];
          const yChanged = d.y ? child.y1 !== d.y[0] || child.y2 !== d.y[1] : false;
          if (xChanged || yChanged) {
            child.bumpVersion();
            this.emit('roiFinalized', {
              roi: child,
              bounds: child.getBounds(),
              version: child.version,
              updatedAt: child.updatedAt,
              domain: child.domain
            });
          }
        });
        this.emit('roisChanged', {
          rois: this.getAllROIs()
        });
      }
    }
  }

  // ─── Creation helpers ─────────────────────────────────────────────────────────

  _handleLinearCreationClick(dataX, _dataY) {
    if (this._creationStep === 0) {
      this._creationData = {
        x1: dataX
      };
      this._creationStep = 1;
    } else {
      const {
        x1
      } = this._creationData;
      const x2 = dataX;
      const lr = new LinearRegion({
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2)
      });
      this._rois.set(lr.id, lr);
      lr.onCreate();
      this._activeROI = lr;
      this._selectOnly(lr);
      this.emit('roiCreated', {
        roi: lr,
        type: 'linearRegion'
      });
      this.emit('roisChanged', {
        rois: this.getAllROIs()
      });
      this.cancelCreateMode();
    }
  }
  _handleRectCreationClick(dataX, dataY) {
    if (this._creationStep === 0) {
      this._creationData = {
        x1: dataX,
        y1: dataY
      };
      this._creationStep = 1;
    } else {
      const {
        x1,
        y1
      } = this._creationData;
      const x2 = dataX;
      const y2 = dataY;
      const rect = new RectROI({
        x1: Math.min(x1, x2),
        x2: Math.max(x1, x2),
        y1: Math.min(y1, y2),
        y2: Math.max(y1, y2)
      });

      // Try to parent this rect inside the first LinearRegion it overlaps
      const parent = this._findLinearRegionParent(rect);
      if (parent) {
        rect.setParent(parent);
        // Bind x bounds exactly to the parent LinearRegion
        rect.xLocked = true;
        rect.x1 = parent.x1;
        rect.x2 = parent.x2;
        // Clamp y within parent (no-op for LinearRegion which has ±Infinity y)
        this._constraintEngine._clampChild(rect, parent);
        rect.syncDomain();
      }
      this._rois.set(rect.id, rect);
      rect.onCreate();
      this._activeROI = rect;
      this._selectOnly(rect);
      this.emit('roiCreated', {
        roi: rect,
        type: 'rect'
      });
      this.emit('roisChanged', {
        rois: this.getAllROIs()
      });
      this.cancelCreateMode();
    }
  }

  /**
   * Single-click creation of a LineROI.
   * V key → vertical vline, H key → horizontal hline.
   *
   * Vertical LineROIs are auto-parented to the first LinearRegion whose
   * x-range contains the click position.
   *
   * @param {number} dataX
   * @param {number} dataY
   * @param {'vertical'|'horizontal'} orientation
   */
  _handleLineROICreationClick(dataX, dataY, orientation) {
    const position = orientation === 'vertical' ? dataX : dataY;
    const mode = orientation === 'vertical' ? 'vline' : 'hline';
    const lineROI = new LineROI({
      orientation,
      mode,
      position
    });

    // Auto-parent vertical LineROI inside the first enclosing LinearRegion
    if (orientation === 'vertical') {
      const parent = this._findLineROIParent(lineROI);
      if (parent) lineROI.setParent(parent);
    }
    this._rois.set(lineROI.id, lineROI);
    lineROI.onCreate();
    this._activeROI = lineROI;
    this._selectOnly(lineROI);
    this.emit('roiCreated', {
      roi: lineROI,
      type: 'lineROI'
    });
    this.emit('roisChanged', {
      rois: this.getAllROIs()
    });
    this.cancelCreateMode();
  }

  /**
   * Find the first LinearRegion whose x-range contains the LineROI's position.
   * @param {LineROI} lineROI
   * @returns {LinearRegion|null}
   */
  _findLineROIParent(lineROI) {
    for (const roi of this._rois.values()) {
      if (roi.type !== 'linearRegion') continue;
      if (lineROI.position >= roi.x1 && lineROI.position <= roi.x2) {
        return roi;
      }
    }
    return null;
  }

  /**
   * Reconstruct a ROI instance from a serialized object.
   * @param {{ id, type, version, updatedAt, domain, metadata }} s
   * @returns {ROIBase|null}
   */
  _roiFromSerialized(s) {
    let roi;
    if (s.type === 'linearRegion') {
      const [x1, x2] = s.domain.x;
      roi = new LinearRegion({
        id: s.id,
        x1,
        x2,
        metadata: s.metadata || {}
      });
    } else if (s.type === 'rect') {
      const [x1, x2] = s.domain.x;
      const [y1, y2] = s.domain.y;
      roi = new RectROI({
        id: s.id,
        x1,
        x2,
        y1,
        y2,
        metadata: s.metadata || {}
      });
    } else if (s.type === 'lineROI') {
      // Recover position: prefer explicit field, fall back to domain
      const position = s.position !== undefined ? s.position : s.orientation === 'horizontal' ? s.domain?.y?.[0] ?? 0 : s.domain?.x?.[0] ?? 0;
      roi = new LineROI({
        id: s.id,
        orientation: s.orientation || 'vertical',
        mode: s.mode || (s.orientation === 'horizontal' ? 'hline' : 'vline'),
        position,
        label: s.label || null,
        domain: s.domain || undefined,
        metadata: s.metadata || {}
      });
    } else {
      return null;
    }
    roi.version = s.version;
    roi.updatedAt = s.updatedAt;
    roi.domain = s.domain;
    if (s.color != null) roi.color = s.color;
    return roi;
  }

  /**
   * Find the first LinearRegion that contains the given RectROI (by x-overlap).
   */
  _findLinearRegionParent(rect) {
    for (const roi of this._rois.values()) {
      if (roi.type !== 'linearRegion') continue;
      if (rect.x1 >= roi.x1 && rect.x2 <= roi.x2) {
        return roi;
      }
    }
    return null;
  }

  // ─── Hit testing ─────────────────────────────────────────────────────────────

  /**
   * Find the topmost ROI under screen position.
   * @returns {{ roi, handle } | null}
   */
  _hitTest(screenX, screenY) {
    // Iterate in reverse insertion order (later = on top)
    const rois = [...this._rois.values()].reverse();
    for (const roi of rois) {
      if (!roi.flags.visible || roi.flags.pickable === false) continue;
      if (roi.type === 'linearRegion') {
        const handle = roi.hitTest(screenX, screenY, this._viewport);
        if (handle !== LR_HANDLES.NONE) return {
          roi,
          handle
        };
      } else if (roi.type === 'lineROI') {
        const handle = roi.hitTest(screenX, screenY, this._viewport);
        if (handle !== LINE_HANDLE.NONE) return {
          roi,
          handle
        };
      } else {
        const handle = roi.hitTestHandles(screenX, screenY, this._viewport);
        if (handle !== HANDLES.NONE) return {
          roi,
          handle
        };
      }
    }
    return null;
  }

  // ─── Selection helpers ────────────────────────────────────────────────────────

  _selectOnly(target) {
    for (const roi of this._rois.values()) {
      roi.selected = roi === target;
    }
  }
  _deselectAll() {
    for (const roi of this._rois.values()) {
      roi.selected = false;
    }
  }
}

/**
 * ScatterLayer — custom deck.gl layer for high-performance scatter plot rendering.
 *
 * Uses deck.gl's ScatterplotLayer under the hood but wrapped to accept our
 * DataStore GPU attribute buffers directly, avoiding JSON object allocation
 * per point.
 *
 * For 10M+ points we use instanced rendering via deck.gl's attribute system.
 * The data is passed as a plain object with a `length` property (duck-typed
 * iterable) and per-attribute accessors that index into our typed arrays.
 *
 * deck.gl version 8.x attribute accessors:
 *   - getPosition: [x, y] — called once per point
 *   - getColor:    [r,g,b,a]
 *   - getRadius:   number
 *
 * Performance note: Passing typed arrays directly through `data` with numeric
 * `length` allows deck.gl to use them without object-per-point overhead.
 */


/**
 * Build a deck.gl ScatterplotLayer from DataStore GPU attributes.
 *
 * @param {object} gpuAttrs — { x, y, color, size } typed arrays
 * @param {object} [opts]
 * @returns {ScatterplotLayer}
 */
function buildScatterLayer(gpuAttrs, opts = {}) {
  const {
    x,
    y,
    color,
    size
  } = gpuAttrs;
  const count = x.length;
  const xIsLog = opts.xIsLog || false;
  const yIsLog = opts.yIsLog || false;
  const data = {
    length: count
  };
  return new ScatterplotLayer({
    id: opts.id || 'masterplot-scatter',
    data,
    radiusUnits: 'pixels',
    radiusMinPixels: 1,
    radiusMaxPixels: 30,
    pickable: false,
    stroked: false,
    getPosition: (_, {
      index
    }) => [xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index], yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index], 0],
    getRadius: (_, {
      index
    }) => size[index] * 0.5,
    getColor: (_, {
      index
    }) => {
      const base = index * 4;
      return [color[base], color[base + 1], color[base + 2], color[base + 3]];
    },
    updateTriggers: {
      getPosition: opts.dataTrigger || 0,
      getRadius: opts.dataTrigger || 0,
      getColor: opts.dataTrigger || 0
    },
    ...opts.layerProps
  });
}

/**
 * ROILayer — composite deck.gl layer for rendering ROIs (RectROI, LinearRegion).
 *
 * Renders each ROI as:
 *   - A semi-transparent fill rectangle (PolygonLayer)
 *   - A border outline
 *   - Corner/edge handles (ScatterplotLayer) when selected
 *
 * ROILayer is rebuilt from scratch on every render because ROI count is small
 * (typically < 100) and structural changes (add/remove ROI) require new layers.
 * This is fine — deck.gl diffing handles it efficiently.
 *
 * Coordinate system: ROI bounds are in DATA coordinates. deck.gl's
 * OrthographicView maps data coordinates directly to screen pixels when the
 * view state is set accordingly by PlotController.
 */

const FILL_ALPHA = 40;
const SELECTED_ALPHA = 70;
const HANDLE_RADIUS = 5;
class ROILayer extends CompositeLayer {
  static get layerName() {
    return 'ROILayer';
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Build shared coordinate-space transform helpers.
   * Extracted from the top of the current renderLayers() (lines 32–41).
   */
  _buildCoordHelpers(props) {
    const {
      xIsLog,
      yIsLog,
      plotXMin,
      plotXMax,
      plotYMin,
      plotYMax
    } = props;
    const toX = v => xIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
    const toY = v => yIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
    return {
      toX,
      toY,
      deckXMin: toX(plotXMin),
      deckXMax: toX(plotXMax),
      deckYMin: toY(plotYMin),
      deckYMax: toY(plotYMax)
    };
  }

  /** Build PolygonLayer + PathLayer for a LinearRegion ROI. */
  _buildLinearRegionLayers(roi, coords) {
    const {
      toX,
      deckYMin,
      deckYMax
    } = coords;
    const alpha = roi.selected ? SELECTED_ALPHA : FILL_ALPHA;
    const color = roi.color || [100, 160, 255];
    const polygon = [[toX(roi.x1), deckYMin], [toX(roi.x2), deckYMin], [toX(roi.x2), deckYMax], [toX(roi.x1), deckYMax]];
    const fillLayer = new PolygonLayer({
      id: `${roi.id}-fill`,
      data: [{
        polygon
      }],
      getPolygon: d => d.polygon,
      getFillColor: [...color, alpha],
      getLineColor: [...color, 200],
      lineWidthMinPixels: 1,
      lineWidthUnits: 'pixels',
      pickable: roi.flags.pickable !== false,
      autoHighlight: true,
      onClick: () => this.props.onROIClick && this.props.onROIClick(roi)
    });
    const edgeColor = roi.hovered ? [255, 255, 100, 220] : [...color, 180];
    const edgeLayer = new PathLayer({
      id: `${roi.id}-edges`,
      data: [{
        path: [[toX(roi.x1), deckYMin, 0], [toX(roi.x1), deckYMax, 0]]
      }, {
        path: [[toX(roi.x2), deckYMin, 0], [toX(roi.x2), deckYMax, 0]]
      }],
      getPath: d => d.path,
      getColor: edgeColor,
      getWidth: roi.selected ? 2 : 1,
      widthUnits: 'pixels',
      pickable: false
    });
    return [fillLayer, edgeLayer];
  }

  /** Build PathLayer + handle ScatterplotLayer for a LineROI. */
  _buildLineROILayers(roi, coords) {
    const {
      toX,
      toY,
      deckXMin,
      deckXMax,
      deckYMin,
      deckYMax
    } = coords;
    const color = roi.color || [255, 80, 80];
    const lineAlpha = roi.selected ? 240 : 180;
    const lineWidth = roi.selected ? 2 : 1;
    const midX = (deckXMin + deckXMax) / 2;
    const midY = (deckYMin + deckYMax) / 2;
    let path;
    if (roi.orientation === 'vertical') {
      const lx = toX(roi.position);
      switch (roi.mode) {
        case 'vline-half-top':
          path = [[lx, midY, 0], [lx, deckYMax, 0]];
          break;
        case 'vline-half-bottom':
          path = [[lx, deckYMin, 0], [lx, midY, 0]];
          break;
        default:
          path = [[lx, deckYMin, 0], [lx, deckYMax, 0]];
      }
    } else {
      const ly = toY(roi.position);
      switch (roi.mode) {
        case 'hline-half-left':
          path = [[deckXMin, ly, 0], [midX, ly, 0]];
          break;
        case 'hline-half-right':
          path = [[midX, ly, 0], [deckXMax, ly, 0]];
          break;
        default:
          path = [[deckXMin, ly, 0], [deckXMax, ly, 0]];
      }
    }
    const layers = [];
    layers.push(new PathLayer({
      id: `${roi.id}-line`,
      data: [{
        path
      }],
      getPath: d => d.path,
      getColor: [...color, lineAlpha],
      getWidth: lineWidth,
      widthUnits: 'pixels',
      pickable: false
    }));
    if (roi.selected) {
      const handlePos = roi.orientation === 'vertical' ? [toX(roi.position), midY, 0] : [midX, toY(roi.position), 0];
      layers.push(new ScatterplotLayer({
        id: `${roi.id}-handle`,
        data: [{
          position: handlePos
        }],
        getPosition: d => d.position,
        getRadius: HANDLE_RADIUS,
        getFillColor: [255, 255, 255, 220],
        getLineColor: [0, 0, 0, 255],
        stroked: true,
        getLineWidth: 1,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        pickable: false
      }));
    }
    return layers;
  }

  /** Build PolygonLayer + handle ScatterplotLayer for a RectROI. */
  _buildRectROILayers(roi, coords) {
    const {
      toX,
      toY
    } = coords;
    const alpha = roi.selected ? SELECTED_ALPHA : FILL_ALPHA;
    const color = roi.color || [255, 140, 60];
    const dx1 = toX(roi.x1),
      dx2 = toX(roi.x2);
    const dy1 = toY(roi.y1),
      dy2 = toY(roi.y2);
    const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];
    const layers = [];
    layers.push(new PolygonLayer({
      id: `${roi.id}-fill`,
      data: [{
        polygon
      }],
      getPolygon: d => d.polygon,
      getFillColor: [...color, alpha],
      getLineColor: [...color, 200],
      lineWidthMinPixels: 1,
      lineWidthUnits: 'pixels',
      pickable: roi.flags.pickable !== false,
      autoHighlight: true,
      onClick: () => this.props.onROIClick && this.props.onROIClick(roi)
    }));
    if (roi.selected) {
      const handlePositions = roi.xLocked ? [[(dx1 + dx2) / 2, dy2], [(dx1 + dx2) / 2, dy1]] : [[dx1, dy1], [dx2, dy1], [dx1, dy2], [dx2, dy2], [(dx1 + dx2) / 2, dy1], [(dx1 + dx2) / 2, dy2], [dx1, (dy1 + dy2) / 2], [dx2, (dy1 + dy2) / 2]];
      const handles = handlePositions.map(([hx, hy]) => ({
        position: [hx, hy, 0]
      }));
      layers.push(new ScatterplotLayer({
        id: `${roi.id}-handles`,
        data: handles,
        getPosition: d => d.position,
        getRadius: HANDLE_RADIUS,
        getFillColor: [255, 255, 255, 220],
        getLineColor: [0, 0, 0, 255],
        stroked: true,
        getLineWidth: 1,
        radiusUnits: 'pixels',
        lineWidthUnits: 'pixels',
        pickable: false
      }));
    }
    return layers;
  }

  // ---------------------------------------------------------------------------
  // CompositeLayer interface
  // ---------------------------------------------------------------------------

  renderLayers() {
    const rois = this.props.rois || [];
    if (rois.length === 0) return [];
    const coords = this._buildCoordHelpers(this.props);
    const layers = [];
    for (const roi of rois) {
      if (!roi.flags.visible) continue;
      if (roi.type === 'linearRegion') layers.push(...this._buildLinearRegionLayers(roi, coords));else if (roi.type === 'lineROI') layers.push(...this._buildLineROILayers(roi, coords));else layers.push(...this._buildRectROILayers(roi, coords));
    }
    return layers;
  }
}
ROILayer.defaultProps = {
  rois: {
    type: 'array',
    value: []
  },
  plotXMin: {
    type: 'number',
    value: 0
  },
  plotXMax: {
    type: 'number',
    value: 1
  },
  plotYMin: {
    type: 'number',
    value: 0
  },
  plotYMax: {
    type: 'number',
    value: 100
  },
  xIsLog: {
    type: 'boolean',
    value: false
  },
  yIsLog: {
    type: 'boolean',
    value: false
  },
  onROIClick: {
    type: 'function',
    value: null,
    optional: true
  }
};

/**
 * PlotLayer — CompositeLayer that aggregates all registered data layers
 * and the ROILayer into a single composable unit for deck.gl.
 *
 * Props:
 *   dataLayers  {Layer[]}  — ordered array of data layers (scatter, line, spectrogram, etc.)
 *   roiLayer    {Layer}    — ROILayer instance (always rendered last / on top)
 */
class PlotLayer extends CompositeLayer {
  static get layerName() {
    return 'PlotLayer';
  }
  renderLayers() {
    const {
      dataLayers = [],
      roiLayer
    } = this.props;
    return roiLayer ? [...dataLayers, roiLayer] : dataLayers;
  }
}
PlotLayer.defaultProps = {
  dataLayers: {
    type: 'array',
    value: []
  },
  roiLayer: {
    type: 'object',
    value: null,
    optional: true
  }
};

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
const DEFAULT_MOUSE_BUTTONS = {
  left: 'pan',
  middle: 'none',
  right: 'zoomDrag'
};
const BUTTON_NAME_TO_CODE = {
  left: 0,
  middle: 1,
  right: 2
};
const VALID_MOUSE_ACTIONS = new Set(['pan', 'zoomDrag', 'rectZoom', 'none']);

// F41: configurable keybindings — unifies ROI-creation actions (forwarded to
// ROIController) and zoom/pan actions (handled here) under one map, mirroring
// F38's mouseButtons pattern. 'autoScale' replaces the old standalone
// autoScaleKey option; autoScaleKey is kept as a deprecated alias (see below).
const DEFAULT_KEY_BINDINGS = {
  createLinear: 'l',
  createRect: 'r',
  createVLine: 'v',
  createHLine: 'h',
  deleteROI: 'd',
  cancel: 'escape',
  autoScale: ' ',
  zoomIn: '=',
  zoomOut: '-',
  panLeft: 'arrowleft',
  panRight: 'arrowright',
  panUp: 'arrowup',
  panDown: 'arrowdown'
};
const ROI_KEY_ACTIONS = new Set(['createLinear', 'createRect', 'createVLine', 'createHLine', 'deleteROI', 'cancel']);
const ZOOM_PAN_ACTIONS = new Set(['autoScale', 'zoomIn', 'zoomOut', 'panLeft', 'panRight', 'panUp', 'panDown']);
const VALID_KEY_ACTIONS = new Set([...ROI_KEY_ACTIONS, ...ZOOM_PAN_ACTIONS]);
const PAN_STEP_PX = 40;
const ZOOM_IN_FACTOR = 1.25;
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
    const pairOk = (min, max) => min !== undefined && max !== undefined && Number.isFinite(min) && Number.isFinite(max) && min !== max;
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
    valid.push({
      ...p,
      bind: key
    });
  }
  return valid;
}

// REL7: constructor option validation — extends F38's warn+fallback precedent
// to the rest of the public constructor surface.
const VALID_SCALE_TYPES = new Set(['linear', 'log', 'time']);
const VALID_PAN_MODES = new Set(['drag', 'follow']);

/** REL7: validate a [min, max] domain option; warn + fall back on malformed input. */
function _validateDomain(domain, name, fallback) {
  if (domain === undefined) return fallback;
  const ok = Array.isArray(domain) && domain.length === 2 && Number.isFinite(domain[0]) && Number.isFinite(domain[1]) && domain[0] !== domain[1];
  if (!ok) {
    console.warn(`PlotController: invalid "${name}" option (expected [min, max] finite numbers with min !== max, ` + `got ${JSON.stringify(domain)}); falling back to ${JSON.stringify(fallback)}`);
    return fallback;
  }
  return domain;
}

/** REL7: validate a scaleType option ('linear'|'log'|'time'); warn + fall back to 'linear'. */
function _validateScaleType(scaleType, name) {
  if (scaleType === undefined) return undefined;
  if (!VALID_SCALE_TYPES.has(scaleType)) {
    console.warn(`PlotController: unknown "${name}" value ${JSON.stringify(scaleType)}; falling back to "linear"`);
    return 'linear';
  }
  return scaleType;
}

/** REL7: validate a panMode option ('drag'|'follow'); warn + fall back to 'drag'. */
function _validatePanMode(panMode) {
  if (panMode === undefined) return 'drag';
  if (!VALID_PAN_MODES.has(panMode)) {
    console.warn(`PlotController: unknown "panMode" value ${JSON.stringify(panMode)}; falling back to "drag"`);
    return 'drag';
  }
  return panMode;
}
class PlotController extends EventEmitter {
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
    this._dataStore = opts.dataStore || new DataStore();
    this._ownsDataStore = !opts.dataStore;
    this._dataView = opts.dataView || null;
    this._ownsDataView = !opts.dataView;
    this._viewport = new ViewportController();

    // ARCH-A: pluggable data layer registry (insertion order = deck.gl stack order)
    this._dataLayerDefs = new Map();
    if (!opts.disableDefaultDataLayer) {
      this.registerDataLayer('default-scatter', ctx => {
        if (ctx.gpuAttrs.x.length === 0) return null;
        return buildScatterLayer(ctx.gpuAttrs, {
          dataTrigger: ctx.dataTrigger,
          xIsLog: ctx.xIsLog,
          yIsLog: ctx.yIsLog
        });
      });
    }

    // Bound handlers for DataView event cleanup
    this._onDataViewDirty = () => {
      this._dirty = true;
    };
    this._onDataViewRecomputed = () => {
      this._dataTrigger++;
    };

    // F40: epoch-offset high-precision time axis — resolve the reference time and
    // build its tick formatter *before* constructing the default xAxis, since
    // AxisController resolves its formatter once at construction time and has no
    // post-hoc setter (config-only, shareable-across-plots, per ARCH-G).
    this._timeOriginMs = opts.timeOrigin !== undefined ? opts.timeOrigin instanceof Date ? opts.timeOrigin.getTime() : opts.timeOrigin : null;
    this._unitsPerSecond = opts.timeOriginUnits === 'ms' ? 1000 : 1;
    let _epochTickFormat = null;
    if (this._timeOriginMs !== null) {
      if (opts.xAxis) {
        console.warn('PlotController: both "xAxis" and "timeOrigin" were supplied; the shared xAxis ' + 'instance will not be mutated. Pass buildEpochTickFormatter() (from ' + '"masterplot") as that AxisController\'s own tickFormat if you want epoch-offset labels.');
      } else {
        _epochTickFormat = buildEpochTickFormatter({
          timeOriginMs: this._timeOriginMs,
          unitsPerSecond: this._unitsPerSecond
        });
      }
    }

    // ARCH-G: AxisController is config-only.  Accept a shared instance or create a default.
    this._xAxis = opts.xAxis || new AxisController({
      scaleType: _validateScaleType(opts.xScaleType, 'xScaleType') || 'linear',
      label: opts.xLabel || null,
      tickFormat: _epochTickFormat
    });
    this._yAxis = opts.yAxis || new AxisController({
      scaleType: _validateScaleType(opts.yScaleType, 'yScaleType') || 'linear',
      label: opts.yLabel || null
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
      console.warn('PlotController: "autoScaleKey" is deprecated; use keyBindings.autoScale instead. ' + `Mapping autoScaleKey (${JSON.stringify(opts.autoScaleKey)}) into keyBindings.autoScale.`);
      this._keyBindings.autoScale = opts.autoScaleKey ? String(opts.autoScaleKey).toLowerCase() : null; // falsy (null/''/undefined-after-check) disables, matching old semantics
    }

    // F41: opt-in scale-preset keybinds — no defaults, fully user-supplied.
    this._scalePresets = _validateScalePresets(opts.scalePresets);
    this._scalePresetMap = new Map(this._scalePresets.map(p => [p.bind, p]));
    this._roiController = new ROIController(this._viewport, {
      keyBindings: this._pickRoiKeyBindings()
    });

    // Canvas references (set during init)
    this._webglCanvas = null;
    this._axisCanvas = null;
    this._deck = null;
    this._axisRenderer = null;

    // Render loop
    this._rafId = null;
    this._dirty = true; // flag: re-render next frame

    // Data trigger counter for deck.gl updateTriggers
    this._dataTrigger = 0;

    // Auto-expand domain when new data is appended
    this._autoExpand = opts.autoExpand ?? true;

    // Axis style overrides applied after init()
    this._hideXAxis = opts.hideXAxis ?? false;
    this._bordered = opts.bordered ?? true; // F34: default on — gutters are opaque by default

    // Zoom/pan interaction state
    this._isPanning = false;
    this._panStart = null; // { screenX, screenY, xDomain, yDomain }

    // F4: pan mode toggle
    this._panMode = _validatePanMode(opts.panMode);

    // F7: follow pan speed — runtime-tunable (default matches original hardcoded value)
    this._followPanSpeed = 0.02;

    // F5: follow pan velocity — current cursor position updated each mousemove
    this._panCurrentPos = null; // { x, y }

    // F6: right-click drag zoom state
    this._isRightDragging = false;
    this._rightDragStart = null; // { x, y, xDomain, yDomain }
    this._onContextMenu = e => e.preventDefault();

    // F21: axis drag zoom state
    this._isAxisDragging = false;
    this._axisDragAxis = null; // 'x' | 'y'
    this._axisDragStart = null; // { x, y, xDomain, yDomain }

    // F37: rect zoom — middle-click drag draws a rectangle, zooms to it on release.
    // Enabled/disabled purely via F38's mouseButtons mapping (no separate flag).
    this._isRectZooming = false;
    this._rectZoomStart = null; // { x, y } screen pixels
    this._rectZoomCurrent = null; // { x, y } screen pixels

    // F38: configurable mouse button bindings — this._buttonActions: { [buttonCode]: action }
    this._buttonActions = null;
    this._setMouseButtonMap(opts.mouseButtons);

    // F28: disable pan/zoom (used by LUTHistogramController's internal PlotController)
    this._disablePanZoom = opts.disablePanZoom ?? false;

    // F23: auto-scale / home domain
    this._homeDomain = {
      x: null,
      y: null
    };
    this._onKeyDown = null; // assigned in init()

    // Bound event handlers for cleanup
    this._onWheel = this._onWheel.bind(this);
    this._onMouseDown = this._onMouseDown.bind(this);
    this._onMouseMove = this._onMouseMove.bind(this);
    this._onMouseUp = this._onMouseUp.bind(this);
    this._onResize = this._onResize.bind(this);

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
    this._axisCanvas = axisCanvas;
    const w = webglCanvas.offsetWidth || webglCanvas.width || 800;
    const h = webglCanvas.offsetHeight || webglCanvas.height || 600;
    this._resize(w, h);

    // Initialize deck.gl
    this._deck = new Deck({
      canvas: webglCanvas,
      width: w,
      height: h,
      views: [new OrthographicView({
        id: 'ortho',
        controller: false,
        flipY: false
      })],
      viewState: this._buildViewState(),
      layers: [],
      controller: false,
      // we handle events ourselves
      onWebGLInitialized: () => {
        this._dirty = true;
      }
    });

    // Initialize axis renderer
    this._axisRenderer = new AxisRenderer(axisCanvas, this._xAxis, this._yAxis, this._viewport);
    if (this._hideXAxis) this._axisRenderer.setStyle({
      hideXAxis: true
    });
    if (this._bordered) this._axisRenderer.setBordered(true); // F34

    // Initialize ROI controller (attaches canvas listeners)
    this._roiController.init(webglCanvas);

    // Attach zoom/pan listeners (before ROI so priority is correct)
    webglCanvas.addEventListener('contextmenu', this._onContextMenu);
    if (!this._disablePanZoom) {
      webglCanvas.addEventListener('wheel', this._onWheel, {
        passive: false
      });
    }
    webglCanvas.addEventListener('mousedown', this._onMouseDown);
    webglCanvas.addEventListener('mousemove', this._onMouseMove);
    webglCanvas.addEventListener('mouseup', this._onMouseUp);
    this._resizeObserver = new ResizeObserver(() => this._onResize());
    this._resizeObserver.observe(this._webglCanvas.parentElement);

    // F23/F41: autoScale + keyboard zoom/pan + scale presets (skipped when pan/zoom is disabled)
    if (!this._disablePanZoom) {
      this._onKeyDown = e => {
        if (e.repeat) return;
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
        const k = e.key.toLowerCase();
        const kb = this._keyBindings;
        if (k === kb.autoScale) {
          e.preventDefault();
          this.autoScale();
          return;
        }
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
        if (k === kb.panLeft) {
          e.preventDefault();
          this._viewport.panByPixels({
            dx: PAN_STEP_PX
          });
          this._dirty = true;
          return;
        }
        if (k === kb.panRight) {
          e.preventDefault();
          this._viewport.panByPixels({
            dx: -PAN_STEP_PX
          });
          this._dirty = true;
          return;
        }
        if (k === kb.panUp) {
          e.preventDefault();
          this._viewport.panByPixels({
            dy: PAN_STEP_PX
          });
          this._dirty = true;
          return;
        }
        if (k === kb.panDown) {
          e.preventDefault();
          this._viewport.panByPixels({
            dy: -PAN_STEP_PX
          });
          this._dirty = true;
          return;
        }

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
      this._webglCanvas.removeEventListener('wheel', this._onWheel);
      this._webglCanvas.removeEventListener('mousedown', this._onMouseDown);
      this._webglCanvas.removeEventListener('mousemove', this._onMouseMove);
      this._webglCanvas.removeEventListener('mouseup', this._onMouseUp);
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
    this.emit('dataAppended', {
      count: chunk.x.length,
      total: this._dataStore.getPointCount()
    });
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
    this._isPanning = false;
    this._panStart = null;
    this._panCurrentPos = null;
    this._isRightDragging = false;
    this._rightDragStart = null;
    this._isRectZooming = false;
    this._rectZoomStart = null;
    this._rectZoomCurrent = null;
    this._isAxisDragging = false;
    this._axisDragAxis = null;
    this._axisDragStart = null;
    this._dirty = true;
  }

  /** F38: internal — build the buttonCode→action lookup table from a { left, middle, right } config. */
  _setMouseButtonMap(cfg) {
    const merged = {
      ...DEFAULT_MOUSE_BUTTONS,
      ...(cfg || {})
    };
    const map = {};
    for (const [name, code] of Object.entries(BUTTON_NAME_TO_CODE)) {
      let action = merged[name];
      if (!VALID_MOUSE_ACTIONS.has(action)) {
        console.warn(`PlotController: unknown mouseButtons action "${action}" for "${name}"; ` + `falling back to default "${DEFAULT_MOUSE_BUTTONS[name]}"`);
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
    const merged = {
      ...DEFAULT_KEY_BINDINGS,
      ...(cfg || {})
    };
    const map = {};
    const seen = new Map();
    for (const action of VALID_KEY_ACTIONS) {
      let key = merged[action];
      if (key === null) {
        map[action] = null;
        continue;
      }
      if (typeof key !== 'string' || key.length === 0) {
        console.warn(`PlotController: invalid keyBindings.${action} value ${JSON.stringify(merged[action])}; ` + `falling back to default "${DEFAULT_KEY_BINDINGS[action]}"`);
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
      let xMin = Infinity,
        xMax = -Infinity,
        yMin = Infinity,
        yMax = -Infinity;
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
    this.emit('autoScaled', {
      xDomain,
      yDomain
    });
  }

  /**
   * Register an explicit home domain used by autoScale().
   * autoScale() uses home domains only when BOTH x and y are non-null.
   *
   * @param {number[]|null} xDomain — e.g. [0, 10], or null to compute from data
   * @param {number[]|null} yDomain — e.g. [0, 100], or null to compute from data
   */
  setHomeDomain(xDomain, yDomain) {
    this._homeDomain = {
      x: xDomain ?? null,
      y: yDomain ?? null
    };
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
    this.emit('zoomChanged', {
      factor,
      focalDataX,
      focalDataY
    });
  }

  // ─── Public access ─────────────────────────────────────────────────────────

  get dataStore() {
    return this._dataStore;
  }
  /** Config-only AxisController for the x axis (scale type, tick format, label). */
  get xAxis() {
    return this._xAxis;
  }
  /** Config-only AxisController for the y axis. */
  get yAxis() {
    return this._yAxis;
  }
  /** ViewportController — owns domain state and all zoom/pan mutations. */
  get viewport() {
    return this._viewport;
  }
  get roiController() {
    return this._roiController;
  }

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
    return dataXToEpochSeconds(x, this._timeOriginMs, this._unitsPerSecond);
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
    return epochSecondsToDataX(epochSeconds, this._timeOriginMs, this._unitsPerSecond);
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
      this._dataView.removeListener('dirty', this._onDataViewDirty);
      this._dataView.removeListener('recomputed', this._onDataViewRecomputed);
      if (this._ownsDataView && this._dataView.destroy) {
        this._dataView.destroy();
      }
    }
    this._dataView = dataView;
    this._ownsDataView = owns;
    if (this._dataView) {
      this._dataView.on('dirty', this._onDataViewDirty);
      this._dataView.on('recomputed', this._onDataViewRecomputed);
    }
    this._dirty = true;
  }

  // ─── ARCH-A: Data layer registration ──────────────────────────────────────

  /** Register or replace a data layer factory. */
  registerDataLayer(id, buildFn, props = {}) {
    this._dataLayerDefs.set(id, {
      build: buildFn,
      props
    });
    this._dirty = true;
  }

  /** Remove a registered layer by id. No-op if not found. */
  unregisterDataLayer(id) {
    if (this._dataLayerDefs.delete(id)) this._dirty = true;
  }

  /** Update static props for an already-registered layer. */
  updateDataLayerProps(id, props) {
    const def = this._dataLayerDefs.get(id);
    if (def) {
      def.props = props;
      this._dirty = true;
    }
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
    const {
      hideAxes = false
    } = options;
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
        const dx = this._panCurrentPos.x - this._panStart.screenX;
        const dy = this._panCurrentPos.y - this._panStart.screenY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const DEAD_ZONE = 5;
        if (dist > DEAD_ZONE) {
          this._viewport.panByPixels({
            dx: -dx * this._followPanSpeed,
            dy: -dy * this._followPanSpeed // inverted y range handles sign automatically
          });
          this._dirty = true;
          this.emit('panChanged', {
            dx: Math.round(-dx * this._followPanSpeed),
            dy: Math.round(dy * this._followPanSpeed)
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
    const gpuAttrs = this._dataView ? this._dataView.getData() : this._dataStore.getGPUAttributes();
    const rois = this._roiController.getAllROIs();
    const [xMin, xMax] = this._viewport.getXDomain();
    const [yMin, yMax] = this._viewport.getYDomain();
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
      yDomain: [yMin, yMax]
    };
    for (const [, def] of this._dataLayerDefs) {
      const result = def.build({
        ...context,
        props: def.props
      });
      if (result == null) continue;
      if (Array.isArray(result)) layers.push(...result);else layers.push(result);
    }
    const roiLayer = new ROILayer({
      id: 'roi-layer',
      rois,
      plotXMin: xMin,
      plotXMax: xMax,
      plotYMin: yMin,
      plotYMax: yMax,
      xIsLog,
      yIsLog
    });

    // ARCH-B: when opts.usePlotLayer is set, wrap everything in a single CompositeLayer
    const deckLayers = this._opts.usePlotLayer ? [new PlotLayer({
      id: 'plot-layer',
      dataLayers: layers,
      roiLayer
    })] : [...layers, roiLayer];

    // F37: live rect-zoom drag rectangle, drawn on top of everything else
    const rectZoomLayer = this._buildRectZoomLayer();
    if (rectZoomLayer) deckLayers.push(rectZoomLayer);
    this._deck.setProps({
      viewState: this._buildViewState(),
      layers: deckLayers
    });

    // Render axis overlay (pass rois so LineROI labels are drawn on canvas)
    if (this._axisRenderer) {
      this._axisRenderer.render(rois);
    }
  }

  // ─── Internal: coordinate / scale sync ────────────────────────────────────

  _resize(width, height) {
    this._viewport.setCanvasSize(width, height);
    const {
      plotArea: pa
    } = this._viewport;

    // Set axis pixel ranges on viewport
    this._viewport.setXRange([pa.x, pa.x + pa.width]);
    // y axis: screen y increases downward → invert range so data-y=0 is at bottom
    this._viewport.setYRange([pa.y + pa.height, pa.y]);
  }
  _buildViewState() {
    const [xMin, xMax] = this._viewport.getXDomain();
    const [yMin, yMax] = this._viewport.getYDomain();
    const {
      canvasWidth: W,
      canvasHeight: H,
      plotArea: pa,
      marginLeft,
      marginBottom
    } = this._viewport;
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
    const zoomX = Math.log2(pa.width / xSpan);
    const zoomY = Math.log2(pa.height / ySpan);
    const tx = deckXMin + (W / 2 - marginLeft) * xSpan / pa.width;
    const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;
    return {
      id: 'ortho',
      target: [tx, ty, 0],
      zoom: [zoomX, zoomY]
    };
  }
  _autoExpandDomain(chunk) {
    let xMin = Infinity,
      xMax = -Infinity;
    let yMin = Infinity,
      yMax = -Infinity;
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
    let newX = null,
      newY = null;
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
        yDomain: this._viewport.getYDomain()
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
    let xMin = Infinity,
      xMax = -Infinity;
    let yMin = Infinity,
      yMax = -Infinity;
    for (let i = 0; i < n; i++) {
      if (data.x[i] < xMin) xMin = data.x[i];
      if (data.x[i] > xMax) xMax = data.x[i];
      if (data.y[i] < yMin) yMin = data.y[i];
      if (data.y[i] > yMax) yMax = data.y[i];
    }
    this._viewport.setDomains([xMin, xMax], [yMin, yMax]);
    this.emit('domainChanged', {
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain()
    });
  }

  // ─── Internal: wheel zoom ─────────────────────────────────────────────────

  _onWheel(e) {
    e.preventDefault();
    const {
      x: screenX,
      y: screenY
    } = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(screenX, screenY)) return;

    // Normalize delta across browsers
    const delta = e.deltaY || e.detail || -e.wheelDelta;
    const factor = delta > 0 ? 0.85 : 1 / 0.85; // zoom in or out

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
        this._axisDragAxis = axisHit;
        this._axisDragStart = {
          x: pos.x,
          y: pos.y,
          xDomain: this._viewport.getXDomain(),
          yDomain: this._viewport.getYDomain()
        };
        return;
      }
    }
    if (this._roiController._mode !== 'idle') return; // ROI creation takes priority
    if (this._roiController._hitTest) {
      const {
        x: screenX,
        y: screenY
      } = {
        x: pos.x,
        y: pos.y
      };
      if (this._roiController._hitTest(screenX, screenY)) return;
    }
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
    if (this._disablePanZoom) return; // ROI hit-test ran; no pan/zoom

    this._handlePanDown(pos);
  }
  _onMouseMove(e) {
    // F6: handle right-click drag zoom (independent of pan)
    if (this._isRightDragging) {
      this._handleRightMove(e);
    }

    // F37: rect zoom drag — mutually exclusive with plot pan
    if (this._isRectZooming) {
      this._handleRectZoomMove(e);
      return;
    }

    // F21: axis drag zoom — mutually exclusive with plot pan
    if (this._isAxisDragging) {
      this._handleAxisDragMove(e);
      return;
    }
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
      this._rightDragStart = null;
    }
    // F21: clear axis drag zoom state
    if (this._isAxisDragging) {
      this._isAxisDragging = false;
      this._axisDragAxis = null;
      this._axisDragStart = null;
    }
    // F37: commit rect zoom drag
    if (action === 'rectZoom' && this._isRectZooming) {
      this._handleRectZoomUp();
    }
    if (action === 'pan' && this._isPanning) {
      this._isPanning = false;
      this._panStart = null;
      this._panCurrentPos = null; // F5: stop velocity pan
    }
  }

  // F4/F5: pan mousedown — start pan (drag or follow, per this._panMode)
  _handlePanDown(pos) {
    this._isPanning = true;
    this._panStart = {
      screenX: pos.x,
      screenY: pos.y,
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain()
    };
    // F5: track current cursor position for velocity pan
    this._panCurrentPos = {
      x: pos.x,
      y: pos.y
    };
  }

  // F4/F5: pan mousemove — apply drag pan immediately, or track position for follow pan
  _handlePanMove(pos) {
    if (this._panMode === 'drag') {
      // F4: drag pan — restore start domains then re-apply pixel delta (avoids float drift)
      const dx = pos.x - this._panStart.screenX;
      const dy = pos.y - this._panStart.screenY;
      this._viewport.setDomains(this._panStart.xDomain, this._panStart.yDomain);
      this._viewport.panByPixels({
        dx,
        dy
      });
      this._dirty = true;
      this.emit('panChanged', {
        dx,
        dy
      });
    } else {
      // F5: follow pan — just track position; RAF velocity tick does the work
      this._panCurrentPos = {
        x: pos.x,
        y: pos.y
      };
    }
  }

  // F6: right-click mousedown — start drag zoom if inside plot area
  _handleRightDown(e) {
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
    this._isRightDragging = true;
    this._rightDragStart = {
      x: pos.x,
      y: pos.y,
      xDomain: this._viewport.getXDomain(),
      yDomain: this._viewport.getYDomain()
    };
  }

  // F6: right-click drag — zoom centred on the right-click origin
  _handleRightMove(e) {
    if (!this._rightDragStart) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
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
    this.emit('zoomChanged', {
      factor,
      focalDataX,
      focalDataY
    });
  }

  // F21: axis drag — zoom axis domain centered on its midpoint
  _handleAxisDragMove(e) {
    if (!this._axisDragStart || !this._axisDragAxis) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    const dx = pos.x - this._axisDragStart.x;
    const dy = pos.y - this._axisDragStart.y;

    // Sign convention (matches spec table):
    //   X axis — drag left  (dx < 0) → zoom in  (factor > 1)
    //   Y axis — drag down  (dy > 0) → zoom in  (factor > 1)
    const SENSITIVITY = 0.01;
    const axis = this._axisDragAxis;
    const delta = axis === 'x' ? -dx : dy;
    const zoomFactor = Math.exp(delta * SENSITIVITY);

    // Restore initial domains before re-applying to prevent float drift
    this._viewport.setDomains(this._axisDragStart.xDomain, this._axisDragStart.yDomain);
    if (axis === 'x') {
      this._viewport.scaleDomainFromMidpointX(zoomFactor);
    } else {
      this._viewport.scaleDomainFromMidpointY(zoomFactor);
    }
    this._dirty = true;
    this.emit('zoomChanged', {
      factor: zoomFactor,
      axis
    });
  }

  // F37: middle-click mousedown — start rect zoom drag if inside plot area
  _handleRectZoomDown(e) {
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
    this._isRectZooming = true;
    this._rectZoomStart = {
      x: pos.x,
      y: pos.y
    };
    this._rectZoomCurrent = {
      x: pos.x,
      y: pos.y
    };
    this._dirty = true;
  }

  // F37: middle-click drag — update the live rectangle overlay
  _handleRectZoomMove(e) {
    if (!this._rectZoomStart) return;
    const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
    this._rectZoomCurrent = {
      x: pos.x,
      y: pos.y
    };
    this._dirty = true;
  }

  // F37: middle-click release — zoom to the drawn rectangle's data bounds
  _handleRectZoomUp() {
    const start = this._rectZoomStart;
    const end = this._rectZoomCurrent;
    this._isRectZooming = false;
    this._rectZoomStart = null;
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
    this.emit('zoomChanged', {
      mode: 'rect',
      xDomain,
      yDomain
    });
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
    const dx1 = toX(Math.min(xA, xB)),
      dx2 = toX(Math.max(xA, xB));
    const dy1 = toY(Math.min(yA, yB)),
      dy2 = toY(Math.max(yA, yB));
    const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];
    return new PolygonLayer({
      id: 'rect-zoom-overlay',
      data: [{
        polygon
      }],
      getPolygon: d => d.polygon,
      getFillColor: [255, 255, 255, 40],
      getLineColor: [255, 255, 255, 220],
      lineWidthMinPixels: 1,
      lineWidthUnits: 'pixels',
      pickable: false
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
    this._deck && this._deck.setProps({
      width: w,
      height: h
    });
    this._resize(w, h);
    this._dirty = true;
  }

  // ─── Internal: event wiring ────────────────────────────────────────────────

  _wireEvents() {
    // DataStore events
    this._dataStore.on('dataExpired', e => this.emit('dataExpired', e));
    // DataStore dirty without a DataView — still need to re-render
    this._dataStore.on('dirty', () => {
      if (!this._dataView) {
        this._dirty = true;
      }
    });

    // F17: wire initial DataView if provided at construction time
    if (this._dataView) {
      this._dataView.on('dirty', this._onDataViewDirty);
      this._dataView.on('recomputed', this._onDataViewRecomputed);
    }

    // ROI events
    this._roiController.on('roiCreated', e => this.emit('roiCreated', e));
    this._roiController.on('roiUpdated', e => this.emit('roiUpdated', e));
    this._roiController.on('roiDeleted', e => this.emit('roiDeleted', e));
    this._roiController.on('roiFinalized', e => this.emit('roiFinalized', e));
    this._roiController.on('roiExternalUpdate', e => this.emit('roiExternalUpdate', e)); // F14
    this._roiController.on('roisChanged', () => {
      this._dirty = true;
    });

    // ARCH-G: domain changes come from viewport now (not from individual AxisControllers)
    this._viewport.on('domainChanged', ({
      xDomain,
      yDomain
    }) => {
      this._dirty = true;
      this.emit('domainChanged', {
        xDomain,
        yDomain
      });
    });

    // Viewport resize
    this._viewport.on('resize', () => {
      this._dirty = true;
    });
  }
}

/**
 * PlotDataView — lazily-evaluated, dirty-flag-cached derived view over a
 * DataStore or another PlotDataView.
 *
 * Views never mutate their source. Multiple plots may share a single
 * PlotDataView. Recomputation is deferred until getData() is called while dirty.
 *
 * Dirty propagation rules:
 *   - Marks dirty on: source 'dirty', source 'dataExpired', 'roiFinalized', 'roiExternalUpdate'
 *   - Does NOT mark dirty on 'roiUpdated' — drag must not trigger recompute
 *   - Child views cascade via 'dirty' event emitted by parent
 *
 * Named PlotDataView (not DataView) to avoid shadowing the browser built-in DataView.
 */

class PlotDataView extends EventEmitter {
  /**
   * @param {import('./DataStore').DataStore|PlotDataView} source
   * @param {((data: object) => object)|null} [transformFn]  — applied to data on recompute
   * @param {object} [opts]
   * @param {import('./ROI/ROIController').ROIController} [opts.roiController]
   */
  constructor(source, transformFn = null, opts = {}) {
    super();
    this._source = source;
    this._transform = transformFn;
    this._roiController = opts.roiController || null;
    this._dirty = true;
    this._snapshot = null;

    // Bind handlers for cleanup tracking
    this._onSourceDirty = () => this.markDirty();
    this._onRoiFinalized = () => this.markDirty();
    this._onRoiExtUpdate = () => this.markDirty();

    // Wire source events
    source.on('dirty', this._onSourceDirty);
    source.on('dataExpired', this._onSourceDirty);

    // Wire ROI commit events; 'roiUpdated' (drag) is intentionally NOT wired
    if (this._roiController) {
      this._roiController.on('roiFinalized', this._onRoiFinalized);
      this._roiController.on('roiExternalUpdate', this._onRoiExtUpdate);
    }
  }

  // ─── Core API ────────────────────────────────────────────────────────────────

  /**
   * Return cached snapshot, recomputing if dirty.
   * Calling twice without an intervening dirty mark returns the same object.
   *
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  getData() {
    if (this._dirty) {
      this._recompute();
      this._dirty = false;
    }
    return this._snapshot;
  }

  /**
   * Mark this view dirty and cascade to child views via 'dirty' event.
   */
  markDirty() {
    this._dirty = true;
    this.emit('dirty');
  }

  // ─── Derived views ──────────────────────────────────────────────────────────

  /**
   * Return a new child PlotDataView keeping only points within the given domain.
   *
   * @param {{ x?: [number,number], y?: [number,number] }} domain
   * @returns {PlotDataView}
   */
  filterByDomain(domain) {
    // Capture `this` for use inside the transform closure
    const self = this;
    const filterFn = data => {
      return self._filterPoints(data, i => {
        if (domain.x) {
          const v = data.x[i];
          if (v < domain.x[0] || v > domain.x[1]) return false;
        }
        if (domain.y) {
          const v = data.y[i];
          if (v < domain.y[0] || v > domain.y[1]) return false;
        }
        return true;
      });
    };
    return new PlotDataView(this, filterFn, {
      roiController: this._roiController
    });
  }

  /**
   * Return a new child PlotDataView keeping only points inside the named ROI
   * bounding box. Requires opts.roiController to have been set.
   *
   * @param {string} roiId
   * @returns {PlotDataView}
   */
  filterByROI(roiId) {
    if (!this._roiController) {
      throw new Error('PlotDataView.filterByROI: roiController not provided in constructor opts');
    }
    const roiController = this._roiController;
    const self = this;
    const filterFn = data => {
      const roi = roiController.getROI(roiId);
      if (!roi) {
        // ROI not found — return all data (graceful degradation)
        return data;
      }
      const {
        x1,
        x2,
        y1,
        y2
      } = roi.getBounds();
      return self._filterPoints(data, i => {
        return data.x[i] >= x1 && data.x[i] <= x2 && data.y[i] >= y1 && data.y[i] <= y2;
      });
    };
    return new PlotDataView(this, filterFn, {
      roiController
    });
  }

  // ─── Histogram ───────────────────────────────────────────────────────────────

  /**
   * Compute a histogram over the specified data field.
   *
   * @param {{ field: string, bins: number }} opts
   *   field — 'x', 'y', or 'size'
   *   bins  — number of histogram buckets
   * @returns {{ counts: Float32Array, edges: Float32Array }}
   *   edges.length === bins + 1
   */
  histogram({
    field,
    bins
  }) {
    const data = this.getData();
    const arr = data[field];
    if (!arr) {
      throw new Error(`PlotDataView.histogram: unknown field '${field}'. Valid: x, y, size`);
    }
    const n = arr.length;
    const edges = new Float32Array(bins + 1);
    const counts = new Float32Array(bins);

    // Find range
    let min = Infinity,
      max = -Infinity;
    for (let i = 0; i < n; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }
    const span = max - min;

    // Populate edges
    for (let b = 0; b <= bins; b++) {
      edges[b] = min + b / bins * span;
    }
    if (span === 0) {
      // All values are equal — dump into bin 0
      counts[0] = n;
      return {
        counts,
        edges
      };
    }

    // Populate counts
    for (let i = 0; i < n; i++) {
      let bin = Math.floor((arr[i] - min) / span * bins);
      if (bin >= bins) bin = bins - 1; // clamp max value into last bin
      counts[bin]++;
    }
    return {
      counts,
      edges
    };
  }

  // ─── Snapshot ────────────────────────────────────────────────────────────────

  /**
   * Deep copy of current snapshot via .slice() on all typed arrays.
   * Mutating the returned object does not affect the internal cache.
   *
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  snapshot() {
    const s = this.getData();
    return {
      x: s.x.slice(),
      y: s.y.slice(),
      size: s.size.slice(),
      color: s.color.slice()
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Remove all event listeners registered by this view.
   * Must be called when the view is no longer needed to avoid listener leaks.
   */
  destroy() {
    this._source.removeListener('dirty', this._onSourceDirty);
    this._source.removeListener('dataExpired', this._onSourceDirty);
    if (this._roiController) {
      this._roiController.removeListener('roiFinalized', this._onRoiFinalized);
      this._roiController.removeListener('roiExternalUpdate', this._onRoiExtUpdate);
    }
    this.removeAllListeners();
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  /**
   * Recompute snapshot from source. Called by getData() when dirty.
   * Emits 'recomputed' after updating _snapshot.
   */
  _recompute() {
    // Dispatch to the correct source API
    let data;
    if (typeof this._source.getLogicalData === 'function') {
      // Source is a DataStore
      data = this._source.getLogicalData();
    } else {
      // Source is a parent PlotDataView
      data = this._source.getData();
    }

    // Apply transform (e.g. filterByDomain / filterByROI filter functions)
    if (this._transform) {
      data = this._transform(data);
    }
    this._snapshot = data;
    this.emit('recomputed', {
      count: data.x.length
    });
  }

  /**
   * Filter points by predicate. Two-pass: count then copy.
   * Allocates output typed arrays exactly sized to the match count.
   *
   * @param {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }} data
   * @param {(i: number) => boolean} predicate
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  _filterPoints(data, predicate) {
    const n = data.x.length;

    // First pass: count matches
    let count = 0;
    for (let i = 0; i < n; i++) {
      if (predicate(i)) count++;
    }

    // Allocate output buffers exactly sized
    const outX = new Float32Array(count);
    const outY = new Float32Array(count);
    const outSize = new Float32Array(count);
    const outColor = new Uint8Array(count * 4);

    // Second pass: copy matching points
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (predicate(i)) {
        outX[j] = data.x[i];
        outY[j] = data.y[i];
        outSize[j] = data.size[i];
        const src = i * 4;
        const dst = j * 4;
        outColor[dst] = data.color[src];
        outColor[dst + 1] = data.color[src + 1];
        outColor[dst + 2] = data.color[src + 2];
        outColor[dst + 3] = data.color[src + 3];
        j++;
      }
    }
    return {
      x: outX,
      y: outY,
      size: outSize,
      color: outColor
    };
  }
}

/**
 * LUTHistogramController — owns an internal PlotController configured as a
 * read-only histogram viewer.  Intended as the backing controller for LUTPanel.jsx.
 *
 * Histogram layout:
 *   x-axis: bin counts  (0 → maxCount)
 *   y-axis: data values (globalMin → globalMax)
 *   Bars: horizontal SolidPolygonLayer rectangles, one per bin
 *   Level handles: two 'hline' LineROIs draggable to set level_min / level_max
 *
 * Constructor:
 *   new LUTHistogramController({ lutController, bins = 256 })
 *
 * Public API:
 *   init(webglCanvas, axisCanvas)  — call once canvases are in DOM
 *   destroy()
 *   get plotController()           — the internal PlotController instance
 *
 * Event wiring:
 *   lutController 'dataChanged'  → rebuild bars + update y-domain
 *   lutController 'levelChanged' → move hlines → markDirty
 *   HLine 'roiUpdated'  (drag)   → lutController.setLevels → levelChanged → recolorize
 *   HLine 'roiFinalized' (up)    → same (commit event; use for deferred server-side saves)
 */

class LUTHistogramController {
  /**
   * @param {object}        opts
   * @param {LUTController} opts.lutController  — the shared LUT controller
   * @param {number}        [opts.bins=256]     — number of histogram bins
   */
  constructor({
    lutController,
    bins = 256
  } = {}) {
    if (!lutController) throw new Error('LUTHistogramController: lutController is required');
    this._lutController = lutController;
    this._bins = bins;
    this._barData = []; // array of polygon objects for SolidPolygonLayer
    this._maxCount = 1; // current histogram peak (y-axis upper bound)

    // Internal PlotController — read-only histogram viewer
    const {
      level_min,
      level_max,
      globalMin,
      globalMax
    } = lutController.state;
    this._plotController = new PlotController({
      disableDefaultDataLayer: true,
      disablePanZoom: true,
      hideXAxis: true,
      xDomain: [0, 1],
      // updated after first data
      yDomain: [globalMin, globalMax],
      yLabel: 'value',
      autoExpand: false
    });

    // Register histogram bar layer
    this._plotController.registerDataLayer('histogram-bars', ctx => {
      if (this._barData.length === 0) return null;
      return new SolidPolygonLayer({
        id: 'histogram-bars',
        data: this._barData,
        getPolygon: d => d.polygon,
        getFillColor: [80, 140, 220, 200],
        extruded: false,
        updateTriggers: {
          getPolygon: ctx.dataTrigger
        }
      });
    });

    // Create the two hline level-handle LineROIs
    this._hlineMin = new LineROI({
      orientation: 'horizontal',
      mode: 'hline',
      position: level_min,
      flags: {
        deletable: false
      }
    });
    this._hlineMin.bumpVersion();
    this._hlineMax = new LineROI({
      orientation: 'horizontal',
      mode: 'hline',
      position: level_max,
      flags: {
        deletable: false
      }
    });
    this._hlineMax.bumpVersion();

    // Bind handlers for cleanup
    this._onDataChanged = this._onDataChanged.bind(this);
    this._onLevelChanged = this._onLevelChanged.bind(this);
    this._onROIUpdated = this._onROIUpdated.bind(this);

    // Wire LUTController events
    this._lutController.on('dataChanged', this._onDataChanged);
    this._lutController.on('levelChanged', this._onLevelChanged);
  }

  // ─── Public API ────────────────────────────────────────────────────────────

  get plotController() {
    return this._plotController;
  }

  /**
   * Initialize the internal PlotController.
   * Call once after both canvases are mounted in the DOM.
   *
   * @param {HTMLCanvasElement} webglCanvas
   * @param {HTMLCanvasElement} axisCanvas
   */
  init(webglCanvas, axisCanvas) {
    this._plotController.init(webglCanvas, axisCanvas);

    // Add hline ROIs after init (ROIController is set up by init)
    const roiCtrl = this._plotController.roiController;
    roiCtrl.addROI(this._hlineMin);
    this._hlineMin.onCreate();
    roiCtrl.addROI(this._hlineMax);
    this._hlineMax.onCreate();
    roiCtrl.emit('roisChanged', {
      rois: roiCtrl.getAllROIs()
    });

    // Wire ROI events → LUT level updates
    roiCtrl.on('roiUpdated', this._onROIUpdated);
    roiCtrl.on('roiFinalized', this._onROIUpdated);

    // If LUT already has data, build initial bars
    const {
      histogramBins,
      histogramEdges
    } = this._lutController.state;
    if (histogramBins) {
      this._rebuildBars(histogramBins, histogramEdges);
    }
  }
  destroy() {
    this._lutController.off('dataChanged', this._onDataChanged);
    this._lutController.off('levelChanged', this._onLevelChanged);
    const roiCtrl = this._plotController.roiController;
    roiCtrl.off('roiUpdated', this._onROIUpdated);
    roiCtrl.off('roiFinalized', this._onROIUpdated);
    this._plotController.destroy();
  }

  // ─── Internal event handlers ───────────────────────────────────────────────

  /** LUTController emitted 'dataChanged' — rebuild bars and update axes. */
  _onDataChanged({
    bins,
    edges,
    globalMin,
    globalMax
  }) {
    this._rebuildBars(bins, edges);

    // Update y-domain to match new data range
    this._plotController.viewport.setYDomain([globalMin, globalMax]);

    // Clamp hlines into new y-domain
    this._clampHlinePositions(globalMin, globalMax);
    this._plotController.markDirty();
  }

  /** LUTController emitted 'levelChanged' — move hlines to match. */
  _onLevelChanged({
    level_min,
    level_max
  }) {
    // Only update hlines if they differ (avoid infinite loop with _onROIUpdated)
    if (this._hlineMin.position !== level_min) {
      this._hlineMin.position = level_min;
      this._hlineMin._syncBoundsFromPosition();
    }
    if (this._hlineMax.position !== level_max) {
      this._hlineMax.position = level_max;
      this._hlineMax._syncBoundsFromPosition();
    }
    this._plotController.markDirty();
  }

  /**
   * A hline was dragged or committed — push new levels to LUTController.
   * Triggered by both 'roiUpdated' (drag) and 'roiFinalized' (mouseUp).
   */
  _onROIUpdated({
    roi
  }) {
    if (roi !== this._hlineMin && roi !== this._hlineMax) return;

    // Read both current positions (either may have changed)
    const level_min = Math.min(this._hlineMin.position, this._hlineMax.position);
    const level_max = Math.max(this._hlineMin.position, this._hlineMax.position);

    // setLevels emits 'levelChanged' → _onLevelChanged → we move hlines.
    // Guard: only call if the values actually changed to avoid circular ping.
    const state = this._lutController.state;
    if (state.level_min !== level_min || state.level_max !== level_max) {
      this._lutController.setLevels(level_min, level_max);
    }
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /**
   * Rebuild horizontal bar polygon data from histogram bins/edges.
   * Each bar is a horizontal rectangle:
   *   x: 0 → count,  y: edgeLow → edgeHigh
   */
  _rebuildBars(bins, edges) {
    let maxCount = 1;
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] > maxCount) maxCount = bins[i];
    }
    this._maxCount = maxCount;
    const bars = [];
    for (let i = 0; i < bins.length; i++) {
      if (bins[i] === 0) continue;
      const yLo = edges[i];
      const yHi = edges[i + 1];
      bars.push({
        polygon: [[0, yLo], [bins[i], yLo], [bins[i], yHi], [0, yHi]]
      });
    }
    this._barData = bars;

    // Update x-domain to count range
    this._plotController.viewport.setXDomain([0, maxCount]);
  }

  /** Ensure hline positions stay within the current y-domain. */
  _clampHlinePositions(globalMin, globalMax) {
    const clampFn = v => Math.max(globalMin, Math.min(v, globalMax));
    this._hlineMin.position = clampFn(this._hlineMin.position);
    this._hlineMax.position = clampFn(this._hlineMax.position);
    this._hlineMin._syncBoundsFromPosition();
    this._hlineMax._syncBoundsFromPosition();
  }
}

/**
 * _buildBitmapFromGrid — CPU colorization utility for typed-array bitmap sources.
 *
 * Extracted from SpectrogramLayer.buildImage; generalized for BitmapDataLayer.
 *
 * Supported channel/dtype combinations:
 *   channels='rgba',       dtype='uint8'       → direct RGBA copy
 *   channels='rgb',        dtype='uint8'       → RGB + alpha=255
 *   channels='gray+alpha', dtype='uint8'       → interleaved gray+alpha → RGBA
 *   channels='gray',       dtype=float or int  → colorize via lutController (Viridis fallback)
 *
 * @param {TypedArray}  source        — flat pixel data
 * @param {number}      width         — image width in pixels
 * @param {number}      height        — image height in pixels
 * @param {string}      channels      — 'gray' | 'rgb' | 'rgba' | 'gray+alpha'
 * @param {string}      dtype         — 'float32'|'float64'|'uint8'|'uint16'|'int16'|'int32'
 * @param {object|null} lutController — duck-typed { getLUTArray(), state: { level_min, level_max } }
 * @returns {ImageBitmap|HTMLCanvasElement}
 */

// Viridis LUT stops (16 evenly-spaced) — standalone fallback when no lutController is provided
const VIRIDIS = [[68, 1, 84], [72, 25, 107], [64, 47, 124], [55, 68, 134], [45, 88, 140], [38, 107, 143], [33, 126, 145], [30, 145, 146], [32, 163, 144], [47, 181, 138], [73, 198, 128], [106, 214, 114], [145, 228, 97], [185, 240, 74], [223, 249, 47], [253, 231, 37]];
function viridisColor(t) {
  const n = VIRIDIS.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const c0 = VIRIDIS[i];
  const c1 = VIRIDIS[i + 1];
  return [Math.round(c0[0] + f * (c1[0] - c0[0])), Math.round(c0[1] + f * (c1[1] - c0[1])), Math.round(c0[2] + f * (c1[2] - c0[2]))];
}
function buildBitmapFromGrid(source, width, height, channels, dtype, lutController) {
  const pixelCount = width * height;
  const imgData = new ImageData(width, height);
  const d = imgData.data;
  if (channels === 'rgba' && dtype === 'uint8') {
    // Direct RGBA copy — source is already packed Uint8 RGBA
    d.set(source.subarray(0, pixelCount * 4));
  } else if (channels === 'rgb' && dtype === 'uint8') {
    for (let i = 0; i < pixelCount; i++) {
      d[i * 4] = source[i * 3];
      d[i * 4 + 1] = source[i * 3 + 1];
      d[i * 4 + 2] = source[i * 3 + 2];
      d[i * 4 + 3] = 255;
    }
  } else if (channels === 'gray+alpha' && dtype === 'uint8') {
    for (let i = 0; i < pixelCount; i++) {
      const v = source[i * 2];
      d[i * 4] = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = source[i * 2 + 1];
    }
  } else {
    // 'gray' channel with any dtype: colorize via LUT (or Viridis fallback)
    const lut = lutController ? lutController.getLUTArray() : null;
    let rangeMin = lutController ? lutController.state.level_min : null;
    let rangeMax = lutController ? lutController.state.level_max : null;

    // When no lutController, auto-range from data min/max
    if (rangeMin == null || rangeMax == null) {
      let lo = Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pixelCount; i++) {
        if (source[i] < lo) lo = source[i];
        if (source[i] > hi) hi = source[i];
      }
      rangeMin = lo;
      rangeMax = hi;
    }
    const range = rangeMax - rangeMin || 1;
    for (let i = 0; i < pixelCount; i++) {
      const t = Math.max(0, Math.min(1, (source[i] - rangeMin) / range));
      let r, g, b;
      if (lut) {
        const li = Math.min(255, Math.floor(t * 255)) * 4;
        r = lut[li];
        g = lut[li + 1];
        b = lut[li + 2];
      } else {
        [r, g, b] = viridisColor(t);
      }
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
  }

  // Render into a canvas and return ImageBitmap for reliable BitmapLayer support.
  // OffscreenCanvas preferred (no DOM dependency); regular canvas as fallback.
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d');
  ctx.putImageData(imgData, 0, 0);
  if (canvas.transferToImageBitmap) {
    return canvas.transferToImageBitmap();
  }
  return canvas; // HTMLCanvasElement fallback (luma.gl 8.5.x accepts this)
}

/**
 * BitmapDataLayer — deck.gl CompositeLayer that renders any 2D image or numeric
 * array as a spatially positioned BitmapLayer inside a PlotController.
 *
 * Supports source types:
 *   URL string             → passed directly to BitmapLayer (deck.gl fetches)
 *   ImageBitmap            → passed directly
 *   ImageData              → passed directly
 *   HTMLCanvasElement      → passed directly
 *   TypedArray             → CPU-colorized via _buildBitmapFromGrid (requires width + height props)
 *
 * Props:
 *   source        {string|ImageBitmap|ImageData|HTMLCanvasElement|TypedArray}
 *   bitMapping    {{ bounds:[l,b,r,t] } | { origin:[x0,y0], scale:[dx,dy] }}  — EXCLUSIVE
 *                 bounds  → [left, bottom, right, top] in data space
 *                 origin+scale → bounds computed as [x0, y0, x0+dx*w, y0+dy*h]
 *   width         {number}  — image width  in pixels; required for TypedArray sources
 *                             and for bitMapping.origin+scale
 *   height        {number}  — image height in pixels; same requirements as width
 *   channels      {string}  — 'gray' | 'rgb' | 'rgba' | 'gray+alpha'  (default: 'rgba')
 *   dtype         {string}  — 'float32'|'float64'|'uint8'|'uint16'|'int16'|'int32'
 *                             (default: 'uint8')
 *   lutController {object|null}  — duck-typed { getLUTArray(), state:{level_min,level_max} };
 *                                  applies LUT to single-channel (gray) TypedArray sources
 *   dataTrigger   {number}  — increment to force re-upload + re-colorize  (default: 0)
 *   colorTrigger  {number}  — increment to force recolorization only      (default: 0)
 *   maxArrayPixels {number} — pixel count cap for TypedArray sources       (default: 16_777_216)
 *
 * Usage example:
 *   myLutCtrl.on('levelChanged', () => { colorTriggerRef.current++; ctrl.markDirty(); });
 *
 *   ctrl.registerDataLayer('heatmap', () =>
 *     new BitmapDataLayer({
 *       source:       myFloat32Array,
 *       bitMapping:   { bounds: [0, 0, 100, 50] },
 *       channels:     'gray',
 *       dtype:        'float32',
 *       width:        512,
 *       height:       256,
 *       lutController: myLutCtrl,
 *       dataTrigger:  dataTriggerRef.current,
 *       colorTrigger: colorTriggerRef.current,
 *     })
 *   );
 */

const DEFAULT_MAX_ARRAY_PIXELS = 16_777_216; // 4096 × 4096

class BitmapDataLayer extends CompositeLayer {
  initializeState() {
    // undefined = not yet resolved; null = resolved to empty (invalid/null source)
    this.setState({
      image: undefined
    });
  }
  updateState({
    props,
    oldProps
  }) {
    const firstRender = this.state.image === undefined;
    const dataChanged = props.dataTrigger !== oldProps.dataTrigger;
    const colorChanged = props.colorTrigger !== oldProps.colorTrigger;
    if (!firstRender && !dataChanged && !colorChanged) return;
    this.setState({
      image: this._resolveSource(props)
    });
  }

  // ── Source resolution ───────────────────────────────────────────────────────

  _resolveSource(props) {
    const {
      source,
      channels,
      dtype,
      lutController,
      maxArrayPixels,
      width,
      height
    } = props;
    if (source == null) return null;

    // URL string: pass directly to BitmapLayer (deck.gl handles fetch)
    if (typeof source === 'string') return source;

    // Native image types: pass directly (no CPU work needed)
    if (source instanceof ImageBitmap || source instanceof ImageData || source instanceof HTMLCanvasElement || typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement) {
      return source;
    }

    // TypedArray: CPU colorize via _buildBitmapFromGrid
    if (ArrayBuffer.isView(source)) {
      if (!width || !height) {
        console.warn('BitmapDataLayer: width and height props are required for TypedArray sources');
        return null;
      }
      const cap = maxArrayPixels ?? DEFAULT_MAX_ARRAY_PIXELS;
      if (width * height > cap) {
        console.warn(`BitmapDataLayer: TypedArray source (${width}×${height} = ${width * height} px) ` + `exceeds maxArrayPixels=${cap} — layer will not render`);
        return null;
      }
      return buildBitmapFromGrid(source, width, height, channels, dtype, lutController);
    }
    console.warn('BitmapDataLayer: unsupported source type', typeof source);
    return null;
  }

  // ── Bounds resolution ───────────────────────────────────────────────────────

  _resolveBounds(props) {
    const {
      bitMapping,
      width,
      height
    } = props;
    if (!bitMapping) {
      throw new Error('BitmapDataLayer: bitMapping prop is required');
    }
    const hasBounds = bitMapping.bounds != null;
    const hasOrigin = bitMapping.origin != null;
    const hasScale = bitMapping.scale != null;
    if (hasBounds && (hasOrigin || hasScale)) {
      throw new Error('BitmapDataLayer: bitMapping.bounds and bitMapping.origin/scale are mutually exclusive');
    }
    if (!hasBounds && !hasOrigin) {
      throw new Error('BitmapDataLayer: bitMapping must provide either bounds or origin+scale');
    }
    if (hasBounds) {
      return bitMapping.bounds; // [left, bottom, right, top]
    }

    // origin + scale → compute bounds from image pixel dimensions
    if (!width || !height) {
      throw new Error('BitmapDataLayer: width and height props are required when using bitMapping.origin+scale');
    }
    const [x0, y0] = bitMapping.origin;
    const [dx, dy] = bitMapping.scale;
    return [x0, y0, x0 + dx * width, y0 + dy * height];
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  renderLayers() {
    const {
      image
    } = this.state;
    if (!image) return [];
    let bounds;
    try {
      bounds = this._resolveBounds(this.props);
    } catch (e) {
      console.error('BitmapDataLayer:', e.message);
      return [];
    }
    const {
      dataTrigger,
      colorTrigger
    } = this.props;
    return [new BitmapLayer(this.getSubLayerProps({
      id: 'bitmap',
      image,
      bounds,
      updateTriggers: {
        image: [dataTrigger, colorTrigger]
      }
    }))];
  }
}
BitmapDataLayer.layerName = 'BitmapDataLayer';
BitmapDataLayer.defaultProps = {
  source: {
    type: 'object',
    value: null,
    optional: true
  },
  bitMapping: {
    type: 'object',
    value: null
  },
  width: {
    type: 'number',
    value: 0,
    optional: true
  },
  height: {
    type: 'number',
    value: 0,
    optional: true
  },
  channels: {
    type: 'string',
    value: 'rgba'
  },
  dtype: {
    type: 'string',
    value: 'uint8'
  },
  lutController: {
    type: 'object',
    value: null,
    optional: true
  },
  dataTrigger: {
    type: 'number',
    value: 0
  },
  colorTrigger: {
    type: 'number',
    value: 0
  },
  maxArrayPixels: {
    type: 'number',
    value: DEFAULT_MAX_ARRAY_PIXELS
  }
};

/**
 * BitmapViewGenerator — Viewport-aware controller that re-generates or
 * re-fetches a BitmapDataLayer whenever the visible domain changes.
 *
 * Decouples "what resolution to request" from "how to render it."
 * Works for both local generation (STFT resampling, heatmap downsampling)
 * and remote API fetches (pass domain bounds + pixel dimensions as query params).
 *
 * Constructor: new BitmapViewGenerator(plotController, opts)
 *
 * opts:
 *   layerId        {string}          — ID passed to plotController.registerDataLayer()
 *   generate       {async fn}        — local generator; exactly one of generate/fetch required
 *   fetch          {async fn}        — remote fetcher; mutually exclusive with generate
 *   debounceMs     {number}   150    — delay after domainChanged before firing
 *   channels       {string}   'gray' — forwarded to BitmapDataLayer
 *   dtype          {string}   'float32' — forwarded to BitmapDataLayer
 *   lutController  {object|null} null — forwarded to BitmapDataLayer
 *   initialBitMapping {object|null} null — starting bitMapping; prevents empty first frame
 *
 * Request object passed to both callbacks:
 *   { xMin, xMax, yMin, yMax, widthPx, heightPx, pixelsPerUnitX, pixelsPerUnitY }
 *
 * generate(request) → { source, width, height, bitMapping? }
 *   - bitMapping defaults to { bounds: [xMin, yMin, xMax, yMax] } if omitted
 *
 * fetch(request, signal) → Promise<{ source, width, height, bitMapping? }>
 *   - signal is an AbortSignal; pass to fetch() calls to cancel stale inflight requests
 *
 * Events: 'requestStart', 'requestComplete', 'requestError'
 */

class BitmapViewGenerator extends EventEmitter {
  /**
   * @param {import('../PlotController.js').PlotController} plotController
   * @param {object} opts
   */
  constructor(plotController, opts = {}) {
    super();
    if (!opts.layerId) throw new Error('BitmapViewGenerator: opts.layerId is required');
    if (!opts.generate && !opts.fetch) {
      throw new Error('BitmapViewGenerator: exactly one of opts.generate or opts.fetch is required');
    }
    if (opts.generate && opts.fetch) {
      throw new Error('BitmapViewGenerator: opts.generate and opts.fetch are mutually exclusive');
    }
    this._ctrl = plotController;
    this._layerId = opts.layerId;
    this._generateFn = opts.generate || null;
    this._fetchFn = opts.fetch || null;
    this._debounceMs = opts.debounceMs ?? 150;

    // Internal layer state — closed over by the registered build fn
    this._layerState = {
      source: null,
      width: 0,
      height: 0,
      bitMapping: opts.initialBitMapping || null,
      channels: opts.channels || 'gray',
      dtype: opts.dtype || 'float32',
      lutController: opts.lutController || null,
      dataTrigger: 0,
      colorTrigger: 0
    };

    // Stale-result detection (generate mode)
    this._seqId = 0;

    // Inflight abort controller (fetch mode)
    this._abortController = null;

    // Debounce timer
    this._debounceTimer = null;

    // Register the layer
    this._ctrl.registerDataLayer(this._layerId, () => this._buildLayer());

    // Subscribe to domainChanged
    this._onDomainChanged = () => this._scheduleTick();
    this._ctrl.on('domainChanged', this._onDomainChanged);

    // Trigger an initial request immediately if we have initialBitMapping
    // (so the canvas isn't empty on first frame)
    this._scheduleTick();
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  _buildLayer() {
    const s = this._layerState;
    if (!s.source || !s.bitMapping) return null;
    return new BitmapDataLayer({
      id: this._layerId,
      source: s.source,
      bitMapping: s.bitMapping,
      width: s.width,
      height: s.height,
      channels: s.channels,
      dtype: s.dtype,
      lutController: s.lutController,
      dataTrigger: s.dataTrigger,
      colorTrigger: s.colorTrigger
    });
  }
  _getRequest() {
    const pa = this._ctrl.viewport.plotArea;
    const widthPx = Math.max(1, Math.round(pa.width));
    const heightPx = Math.max(1, Math.round(pa.height));
    const [xMin, xMax] = this._ctrl.viewport.getXDomain();
    const [yMin, yMax] = this._ctrl.viewport.getYDomain();
    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;
    return {
      xMin,
      xMax,
      yMin,
      yMax,
      widthPx,
      heightPx,
      pixelsPerUnitX: widthPx / xSpan,
      pixelsPerUnitY: heightPx / ySpan
    };
  }
  _scheduleTick() {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._fire();
    }, this._debounceMs);
  }
  async _fire() {
    const request = this._getRequest();
    this.emit('requestStart', {
      request
    });
    const t0 = performance.now();
    if (this._generateFn) {
      await this._fireGenerate(request, t0);
    } else {
      await this._fireFetch(request, t0);
    }
  }
  async _fireGenerate(request, t0) {
    const seqId = ++this._seqId;
    let result;
    try {
      result = await this._generateFn(request);
    } catch (err) {
      this.emit('requestError', {
        request,
        error: err
      });
      return;
    }

    // Discard stale results
    if (seqId !== this._seqId) return;
    this._applyResult(result, request);
    this.emit('requestComplete', {
      request,
      durationMs: performance.now() - t0
    });
  }
  async _fireFetch(request, t0) {
    // Abort previous inflight request
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const {
      signal
    } = this._abortController;
    let result;
    try {
      result = await this._fetchFn(request, signal);
    } catch (err) {
      if (err.name === 'AbortError') return; // stale — silently ignore
      this.emit('requestError', {
        request,
        error: err
      });
      return;
    }
    this._applyResult(result, request);
    this.emit('requestComplete', {
      request,
      durationMs: performance.now() - t0
    });
  }
  _applyResult(result, request) {
    if (!result) return;
    const bitMapping = result.bitMapping ?? {
      bounds: [request.xMin, request.yMin, request.xMax, request.yMax]
    };
    this._layerState.source = result.source;
    this._layerState.width = result.width;
    this._layerState.height = result.height;
    this._layerState.bitMapping = bitMapping;
    this._layerState.dataTrigger++;
    this._ctrl.markDirty();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Update the lutController forwarded to BitmapDataLayer.
   * Call markDirty() on the plotController after this if you want an immediate repaint.
   * @param {object|null} lutController
   */
  setLutController(lutController) {
    this._layerState.lutController = lutController;
  }

  /**
   * Increment colorTrigger and schedule a markDirty() on the plotController.
   * Use this when the LUT colormap or levels change but the underlying data has not —
   * it forces BitmapDataLayer to re-colorize without re-running the generate/fetch fn.
   */
  bumpColorTrigger() {
    this._layerState.colorTrigger++;
    this._ctrl.markDirty();
  }

  /**
   * Force an immediate re-request (bypassing the debounce).
   */
  refresh() {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._fire();
  }

  /**
   * Unsubscribes from plotController, aborts any pending request, clears debounce timer.
   */
  destroy() {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._ctrl.off('domainChanged', this._onDomainChanged);
    this._ctrl.unregisterDataLayer(this._layerId);
    this.removeAllListeners();
  }
}

/**
 * LUTController — pure JS EventEmitter (no React) that manages:
 *   - LUT colormap selection (viridis, grayscale, plasma, inferno, magma, hot)
 *   - level_min / level_max contrast windowing
 *   - Amplitude histogram computation from any flat numeric array
 *
 * Generalization of HistogramLUTController.js.  Old name kept for compat until CLEANUP.
 *
 * Events:
 *   'levelChanged'  { level_min, level_max }   — levels changed (drag or setLevels)
 *   'lutChanged'    presetName (string)         — colormap swapped
 *   'dataChanged'   { bins, edges, globalMin, globalMax } — new data + histogram
 *
 * The `version` getter increments on every levelChanged or lutChanged emission.
 * Use it as a `colorTrigger` for BitmapDataLayer.
 */


// LUT preset control points: [t, r, g, b], t in [0, 1]
const LUT_PRESETS = {
  viridis: [[0, 68, 1, 84], [1 / 15, 72, 25, 107], [2 / 15, 64, 47, 124], [3 / 15, 55, 68, 134], [4 / 15, 45, 88, 140], [5 / 15, 38, 107, 143], [6 / 15, 33, 126, 145], [7 / 15, 30, 145, 146], [8 / 15, 32, 163, 144], [9 / 15, 47, 181, 138], [10 / 15, 73, 198, 128], [11 / 15, 106, 214, 114], [12 / 15, 145, 228, 97], [13 / 15, 185, 240, 74], [14 / 15, 223, 249, 47], [1, 253, 231, 37]],
  grayscale: [[0, 0, 0, 0], [1, 255, 255, 255]],
  plasma: [[0, 13, 8, 135], [0.25, 126, 3, 168], [0.5, 204, 71, 120], [0.75, 248, 150, 64], [1, 240, 249, 33]],
  inferno: [[0, 0, 0, 4], [0.25, 87, 16, 110], [0.5, 188, 55, 84], [0.75, 249, 142, 9], [1, 252, 255, 164]],
  magma: [[0, 0, 0, 4], [0.25, 79, 18, 123], [0.5, 183, 55, 121], [0.75, 251, 136, 97], [1, 252, 253, 191]],
  hot: [[0, 0, 0, 0], [0.33, 255, 0, 0], [0.67, 255, 255, 0], [1, 255, 255, 255]]
};
function buildLUT(stops) {
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let s0 = stops[0],
      s1 = stops[1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j + 1][0]) {
        s0 = stops[j];
        s1 = stops[j + 1];
        break;
      }
    }
    const f = s1[0] === s0[0] ? 0 : (t - s0[0]) / (s1[0] - s0[0]);
    lut[i * 4] = Math.round(s0[1] + f * (s1[1] - s0[1]));
    lut[i * 4 + 1] = Math.round(s0[2] + f * (s1[2] - s0[2]));
    lut[i * 4 + 2] = Math.round(s0[3] + f * (s1[3] - s0[3]));
    lut[i * 4 + 3] = 255;
  }
  return lut;
}
class LUTController extends EventEmitter$1 {
  /**
   * @param {number} [binCount=256]
   */
  constructor(binCount = 256) {
    super();
    this._binCount = binCount;
    this._data = null; // Float32Array (or any TypedArray) — raw values
    this._isFirstData = true;
    this._version = 0; // monotonic counter for colorTrigger

    this.state = {
      level_min: -100,
      level_max: 0,
      lut: buildLUT(LUT_PRESETS.viridis),
      lutName: 'viridis',
      histogramBins: null,
      // Float32Array[binCount] raw counts
      histogramEdges: null,
      // Float32Array[binCount+1] bin boundaries
      globalMin: -100,
      globalMax: 0
    };
  }

  // ─── Version (colorTrigger) ────────────────────────────────────────────────

  get version() {
    return this._version;
  }

  // ─── Data ─────────────────────────────────────────────────────────────────

  /**
   * Load new data and recompute the histogram.
   * Emits 'dataChanged' with { bins, edges, globalMin, globalMax }.
   * Auto-levels on first call.
   *
   * @param {ArrayLike<number>} flatArray  — any flat numeric array of values
   * @param {number}            globalMin  — minimum possible value
   * @param {number}            globalMax  — maximum possible value
   */
  setData(flatArray, globalMin, globalMax) {
    this._data = flatArray;
    this.state.globalMin = globalMin;
    this.state.globalMax = globalMax;
    this._computeHistogram();

    // Clamp existing levels into the new range so handles stay on-canvas
    const clampedMin = Math.max(globalMin, Math.min(this.state.level_min, globalMax));
    const clampedMax = Math.max(globalMin, Math.min(this.state.level_max, globalMax));
    if (clampedMin !== this.state.level_min || clampedMax !== this.state.level_max) {
      this.state.level_min = clampedMin;
      this.state.level_max = clampedMax;
      this._version++;
      this.emit('levelChanged', {
        level_min: clampedMin,
        level_max: clampedMax
      });
    }
    this.emit('dataChanged', {
      bins: this.state.histogramBins,
      edges: this.state.histogramEdges,
      globalMin,
      globalMax
    });
    if (this._isFirstData) {
      this._isFirstData = false;
      this.autoLevel();
    }
  }

  /** Alias for backwards compatibility with HistogramLUTController consumers. */
  setSpectrogramData(power, globalMin, globalMax) {
    return this.setData(power, globalMin, globalMax);
  }

  // ─── Level / LUT ──────────────────────────────────────────────────────────

  setLevels(min, max) {
    this.state.level_min = min;
    this.state.level_max = max;
    this._version++;
    this.emit('levelChanged', {
      level_min: min,
      level_max: max
    });
  }
  setLUT(presetName) {
    const stops = LUT_PRESETS[presetName];
    if (!stops) return;
    this.state.lut = buildLUT(stops);
    this.state.lutName = presetName;
    this._version++;
    this.emit('lutChanged', presetName);
  }
  autoLevel(loPct = 2, hiPct = 98) {
    const {
      histogramBins,
      histogramEdges
    } = this.state;
    if (!histogramBins) return;
    const total = histogramBins.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const loTarget = total * loPct / 100;
    const hiTarget = total * hiPct / 100;
    let cumsum = 0;
    let level_min = histogramEdges[0];
    let level_max = histogramEdges[histogramEdges.length - 1];
    let minSet = false;
    for (let i = 0; i < histogramBins.length; i++) {
      cumsum += histogramBins[i];
      if (!minSet && cumsum >= loTarget) {
        level_min = histogramEdges[i];
        minSet = true;
      }
      if (cumsum >= hiTarget) {
        level_max = histogramEdges[i + 1];
        break;
      }
    }
    this.setLevels(level_min, level_max);
  }
  getLUTArray() {
    return this.state.lut;
  }
  reset() {
    this._isFirstData = true;
    this._data = null;
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  _computeHistogram() {
    const {
      globalMin,
      globalMax
    } = this.state;
    const data = this._data;
    const n = this._binCount;
    const range = globalMax - globalMin || 1;
    const bins = new Float32Array(n);
    const edges = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) edges[i] = globalMin + i / n * range;
    for (let i = 0; i < data.length; i++) {
      const idx = Math.min(n - 1, Math.floor((data[i] - globalMin) / range * n));
      if (idx >= 0) bins[idx]++;
    }
    this.state.histogramBins = bins;
    this.state.histogramEdges = edges;
  }
  static get presetNames() {
    return Object.keys(LUT_PRESETS);
  }
}

/**
 * LineLayer — deck.gl layer for rendering connected polylines.
 *
 * Uses deck.gl's PathLayer. Points are expected to be pre-ordered sequences
 * (a single connected path or multiple paths separated by a segment count array).
 *
 * This is a v1 placeholder with a simple API. Full multi-path support is v2.
 */


/**
 * @param {object} gpuAttrs  — { x, y } Float32Arrays
 * @param {object} [opts]
 * @returns {PathLayer}
 */
function buildLineLayer(gpuAttrs, opts = {}) {
  const {
    x,
    y
  } = gpuAttrs;
  const count = x.length;

  // Build a single path as array of [x,y] pairs
  // For large data sets this is less optimal; kept simple for v1
  const path = [];
  for (let i = 0; i < count; i++) {
    path.push([x[i], y[i], 0]);
  }
  return new PathLayer({
    id: opts.id || 'masterplot-line',
    data: [{
      path
    }],
    getPath: d => d.path,
    getColor: opts.color || [100, 200, 255, 200],
    getWidth: opts.width || 1,
    widthUnits: 'pixels',
    pickable: false,
    ...opts.layerProps
  });
}

/**
 * TraceGroup — generic multi-trace data layer for PlotController.
 *
 * Partitions bulk data by a string `tag` field into per-tag typed-array
 * buffers in a single O(n) pass.  Resolves per-trace attributes (color,
 * opacity, size, and any user-defined fields) via palette cycling plus
 * per-tag overrides.
 *
 * Plugs into PlotController via:
 *   ctrl.registerDataLayer('traces', traceGroup.toLayerDef().build);
 *
 * No EventEmitter needed — PlotController polls build() every RAF tick.
 *
 * Usage:
 *   const tg = new TraceGroup({
 *     palette: [[255,100,100,255], [100,255,100,255]],
 *     buildLayer: (traceId, traceData, attrs, ctx) => new ScatterplotLayer({ ... }),
 *   });
 *   tg.appendData({ x: xArr, y: yArr, tag: tagArr });
 *   ctrl.registerDataLayer('traces', tg.toLayerDef().build);
 */

const INITIAL_CAPACITY = 4096;

/** Library-level defaults (lowest priority in attribute resolution). */
const LIB_DEFAULTS = {
  opacity: 1.0,
  size: 4.0,
  color: [255, 255, 255, 255]
};

/**
 * @typedef {object} TraceEntry
 * @property {Float32Array} x
 * @property {Float32Array} y
 * @property {Float32Array|null} size
 * @property {number} count           — live point count (≤ capacity)
 * @property {number} capacity        — allocated buffer length
 * @property {number} version         — bumped on every appendData that touches this trace
 * @property {boolean} visible        — hidden traces are excluded from build()
 * @property {number} insertionIndex  — stable index for palette cycling (order first seen)
 */

class TraceGroup {
  /**
   * @param {object} opts
   * @param {Array<number[]>} opts.palette       — Array<[R,G,B,A]>, cycled by insertion order (required)
   * @param {function}        opts.buildLayer    — (traceId, traceData, attrs, ctx) => Layer | null (required)
   * @param {object}          [opts.traceAttrs]  — { [tag]: { color?, opacity?, ...userFields } }
   * @param {object}          [opts.defaultAttrs]— { opacity?, size?, ...userFields }
   */
  constructor({
    palette,
    buildLayer,
    traceAttrs = {},
    defaultAttrs = {}
  }) {
    if (!palette || palette.length === 0) throw new Error('TraceGroup: palette is required and must be non-empty');
    if (typeof buildLayer !== 'function') throw new Error('TraceGroup: buildLayer must be a function');
    this._palette = palette;
    this._buildLayer = buildLayer;
    this._traceAttrs = {
      ...traceAttrs
    };
    this._defaultAttrs = {
      ...defaultAttrs
    };

    /** @type {Map<string, TraceEntry>} */
    this._traces = new Map();
  }

  // ─── Data ingestion ────────────────────────────────────────────────────────

  /**
   * Bulk append points, partitioned by tag array in one O(n) pass.
   *
   * @param {object}                    chunk
   * @param {Float32Array|number[]}     chunk.x
   * @param {Float32Array|number[]}     chunk.y
   * @param {string[]|Uint8Array}       chunk.tag   — one tag string per point
   * @param {Float32Array|number[]|null} [chunk.size]
   */
  appendData({
    x,
    y,
    tag,
    size = null
  }) {
    const n = x.length;
    if (n === 0) return;

    // Accumulate per-tag counts first (one pass) to batch-allocate.
    /** @type {Map<string, number>} */
    const incoming = new Map();
    for (let i = 0; i < n; i++) {
      const t = tag[i];
      incoming.set(t, (incoming.get(t) || 0) + 1);
    }

    // Ensure each tag has a TraceEntry with enough capacity.
    for (const [t, cnt] of incoming) {
      if (!this._traces.has(t)) {
        this._traces.set(t, this._newEntry());
      }
      const entry = this._traces.get(t);
      const needed = entry.count + cnt;
      if (needed > entry.capacity) {
        this._grow(entry, needed);
      }
    }

    // Second pass: scatter points into per-tag buffers.
    for (let i = 0; i < n; i++) {
      const t = tag[i];
      const entry = this._traces.get(t);
      const idx = entry.count++;
      entry.x[idx] = x[i];
      entry.y[idx] = y[i];
      if (size !== null && entry.size !== null) {
        entry.size[idx] = size[i];
      }
    }

    // Bump version for every touched trace.
    for (const t of incoming.keys()) {
      this._traces.get(t).version++;
    }
  }

  // ─── Visibility + attribute control ───────────────────────────────────────

  /**
   * Show or hide a trace. Hidden traces are excluded from the next build() call.
   * @param {string}  tag
   * @param {boolean} visible
   */
  setTraceVisible(tag, visible) {
    const entry = this._traces.get(tag);
    if (entry) entry.visible = visible;
  }

  /** @param {string} tag @returns {boolean} */
  getTraceVisible(tag) {
    const entry = this._traces.get(tag);
    return entry ? entry.visible : false;
  }

  /**
   * Merge per-tag attribute overrides post-construction.
   * @param {string} tag
   * @param {object} attrs
   */
  setTraceAttr(tag, attrs) {
    this._traceAttrs[tag] = {
      ...(this._traceAttrs[tag] || {}),
      ...attrs
    };
  }

  /**
   * Replace the palette array.  Does NOT remap already-registered tags
   * (their insertionIndex stays the same; only the colour at that index changes).
   * @param {Array<number[]>} palette
   */
  setPalette(palette) {
    this._palette = palette;
  }

  // ─── Inspection ────────────────────────────────────────────────────────────

  /** @returns {string[]} tags in insertion order */
  getAllTags() {
    return Array.from(this._traces.keys());
  }

  /**
   * Returns raw TraceEntry for advanced use.
   * @param {string} tag
   * @returns {TraceEntry|undefined}
   */
  getTrace(tag) {
    return this._traces.get(tag);
  }

  // ─── Attribute resolution ──────────────────────────────────────────────────

  /**
   * Resolve final attrs for a tag.  Priority (highest wins):
   *   1. traceAttrs[tag] field
   *   2. Palette color (by insertionIndex % palette.length)
   *   3. defaultAttrs field
   *   4. LIB_DEFAULTS
   *
   * Opacity is NOT baked into palette alpha — it is resolved separately.
   *
   * @param {string} tag
   * @returns {object}
   */
  resolveAttrs(tag) {
    const entry = this._traces.get(tag);
    const paletteColor = entry ? this._palette[entry.insertionIndex % this._palette.length] : LIB_DEFAULTS.color;
    const overrides = this._traceAttrs[tag] || {};
    return {
      ...LIB_DEFAULTS,
      ...this._defaultAttrs,
      color: paletteColor,
      // palette is priority-2; overrides step below
      ...overrides // per-tag overrides win over palette (priority-1)
    };
  }

  // ─── Layer def integration ─────────────────────────────────────────────────

  /**
   * Returns a DataLayerDef compatible with PlotController.registerDataLayer().
   *
   * @returns {{ id: string, build: function }}
   */
  toLayerDef() {
    return {
      id: 'trace-group',
      build: ctx => {
        const layers = [];
        for (const [tag, entry] of this._traces) {
          if (!entry.visible || entry.count === 0) continue;
          const attrs = this.resolveAttrs(tag);
          const layer = this._buildLayer(`trace-${tag}`, entry, attrs, ctx);
          if (layer) layers.push(layer);
        }
        return layers.length > 0 ? layers : null;
      }
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** @returns {TraceEntry} */
  _newEntry() {
    const cap = INITIAL_CAPACITY;
    return {
      x: new Float32Array(cap),
      y: new Float32Array(cap),
      size: new Float32Array(cap),
      count: 0,
      capacity: cap,
      version: 0,
      visible: true,
      insertionIndex: this._traces.size // size before insertion = stable index
    };
  }

  /**
   * Grow an entry's buffers to hold at least `needed` points (doubling strategy).
   * @param {TraceEntry} entry
   * @param {number}     needed
   */
  _grow(entry, needed) {
    let cap = entry.capacity;
    while (cap < needed) cap *= 2;
    const newX = new Float32Array(cap);
    const newY = new Float32Array(cap);
    const newSize = new Float32Array(cap);
    newX.set(entry.x.subarray(0, entry.count));
    newY.set(entry.y.subarray(0, entry.count));
    if (entry.size) newSize.set(entry.size.subarray(0, entry.count));
    entry.x = newX;
    entry.y = newY;
    entry.size = newSize;
    entry.capacity = cap;
  }
}

/**
 * SignalDataLayer — signal store and PathLayer builder for line/waveform plots.
 *
 * Replaces the signal management previously embedded in LinePlotController.
 * Used with PlotController.registerDataLayer() so line plots share the same
 * unified controller infrastructure (zoom, pan, ROI, axes, RAF loop).
 *
 * Usage:
 *   const signals = new SignalStore();
 *   const ctrl    = new PlotController({ ..., disableDefaultDataLayer: true });
 *   ctrl.registerDataLayer('signals', signals.toLayerDef().build);
 *
 *   signals.addSignal('a', [255, 100, 100, 255]);
 *   signals.appendSignalData('a', yValues, xBase);
 *   const { xDomain, yDomain } = signals.expandDomains();
 *   ctrl.viewport.setXDomain(xDomain);
 *   ctrl.viewport.setYDomain(yDomain);
 */

class SignalStore {
  constructor() {
    /** @type {Map<string, { path: number[][], color: number[], layerData: object[]|null, version: number }>} */
    this._signals = new Map();
    this._xCounter = 0;
  }

  // ─── Signal management ────────────────────────────────────────────────────

  /**
   * Register a named signal.
   * @param {string}   id    — unique identifier
   * @param {number[]} color — [R, G, B, A] 0-255
   */
  addSignal(id, color) {
    this._signals.set(id, {
      path: [],
      // mutable array of [x, y, 0] triples for PathLayer
      color,
      layerData: null,
      // cached [{path, color}] — replaced on each append
      version: 0 // incremented on append, drives deck.gl updateTriggers
    });
  }

  /**
   * Direct access to a signal's internals for path-building scenarios
   * (e.g. building a full static dataset without going through appendSignalData).
   * After modifying sig.path directly, caller must set sig.layerData and
   * increment sig.version to ensure deck.gl picks up the change.
   *
   * @param {string} id
   * @returns {{ path: number[][], color: number[], layerData: object[]|null, version: number } | undefined}
   */
  getSignal(id) {
    return this._signals.get(id);
  }

  /**
   * Append y-values to a signal. X values are assigned from xBase + i.
   * @param {string}               id      — signal id
   * @param {number[]|Float32Array} yValues
   * @param {number}               xBase   — x coordinate of yValues[0]
   */
  appendSignalData(id, yValues, xBase) {
    const sig = this._signals.get(id);
    if (!sig) return;
    for (let i = 0; i < yValues.length; i++) {
      sig.path.push([xBase + i, yValues[i], 0]);
    }

    // New reference → deck.gl detects the change and re-evaluates getPath
    sig.layerData = [{
      path: sig.path,
      color: sig.color
    }];
    sig.version++;
  }

  /** Advance the shared x counter by n (call after one round of appends). */
  advanceXCounter(n) {
    this._xCounter += n;
  }
  get xCounter() {
    return this._xCounter;
  }

  /**
   * Remove points from all signals where x < xMin.
   * Used to maintain a rolling time window.
   * @param {number} xMin
   */
  trimBefore(xMin) {
    for (const sig of this._signals.values()) {
      if (sig.path.length === 0) continue;

      // Binary-search first index where x >= xMin
      let lo = 0,
        hi = sig.path.length;
      while (lo < hi) {
        const mid = lo + hi >>> 1;
        if (sig.path[mid][0] < xMin) lo = mid + 1;else hi = mid;
      }
      if (lo > 0) {
        sig.path = sig.path.slice(lo);
        sig.layerData = sig.path.length > 0 ? [{
          path: sig.path,
          color: sig.color
        }] : null;
        sig.version++;
      }
    }
  }

  /**
   * Compute x/y domain extents from current data.
   * Returns { xDomain: [0, xMax], yDomain: [yMin-pad, yMax+pad] }.
   * Falls back to sensible defaults when no data is present.
   * @returns {{ xDomain: number[], yDomain: number[] }}
   */
  expandDomains() {
    let xMax = 1;
    let yMin = Infinity,
      yMax = -Infinity;
    for (const sig of this._signals.values()) {
      if (sig.path.length === 0) continue;
      xMax = Math.max(xMax, sig.path[sig.path.length - 1][0]);
      for (const pt of sig.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
    }
    if (yMin === Infinity) return {
      xDomain: [0, xMax],
      yDomain: [-1, 1]
    };
    const yPad = (yMax - yMin) * 0.05 || 0.1;
    return {
      xDomain: [0, xMax],
      yDomain: [yMin - yPad, yMax + yPad]
    };
  }

  /** Total path points across all registered signals. */
  getPointCount() {
    let n = 0;
    for (const sig of this._signals.values()) n += sig.path.length;
    return n;
  }

  /** Clear all signal data and reset the x counter. */
  reset() {
    for (const sig of this._signals.values()) {
      sig.path = [];
      sig.layerData = null;
      sig.version++;
    }
    this._xCounter = 0;
  }

  /**
   * Create a DataLayerDef for use with PlotController.registerDataLayer().
   * The build closure captures this SignalStore; the store stays alive as long
   * as the returned def is registered.
   *
   * @returns {{ id: string, build: function }}
   */
  toLayerDef() {
    return {
      id: 'signal-data',
      build: _ctx => {
        const layers = buildSignalLayers(this._signals);
        return layers.length > 0 ? layers : null;
      }
    };
  }
}

/**
 * Build PathLayer instances for all signals that have data.
 *
 * @param {Map} signalsMap — SignalStore._signals
 * @returns {PathLayer[]}
 */
function buildSignalLayers(signalsMap) {
  const layers = [];
  for (const [id, sig] of signalsMap) {
    if (!sig.layerData || sig.path.length < 2) continue;
    layers.push(new PathLayer({
      id: `line-${id}`,
      data: sig.layerData,
      getPath: d => d.path,
      getColor: d => d.color,
      getWidth: 2,
      widthUnits: 'pixels',
      pickable: false,
      updateTriggers: {
        getPath: sig.version
      }
    }));
  }
  return layers;
}

/**
 * AudioController — unified audio management controller.
 *
 * Absorbs functionality from PlaybackController.js and the STFT/tile logic
 * previously embedded in SpectrogramExample.jsx. PlaybackController.js and
 * FilterController.js are kept unchanged for backwards compatibility until
 * the CLEANUP step.
 *
 * Responsibilities:
 *   - Load audio from ArrayBuffer (file) or direct Float32Array (generated/streamed)
 *   - Optional stateless filter bridge: setFilterFn((samples, sr) => Float32Array)
 *   - Playback: play / pause / stop / seek, with timeUpdate events at ~10 Hz
 *   - Tiled STFT: fixed-width time segments → 'tileReady' per tile → 'stftComplete'
 *   - Streaming append: last tile is recomputed on a configurable interval
 *
 * Events:
 *   'loaded'        { duration, sampleRate, samples: Float32Array }
 *   'stateChanged'  { state: 'playing'|'paused'|'stopped' }
 *   'timeUpdate'    { currentTime }   (~10 Hz during playback)
 *   'tileReady'     { tileIndex, power: Float32Array, width, height,
 *                     globalMin, globalMax, bounds: [tStart, 0, tEnd, nyquist] }
 *   'stftComplete'
 *   'streamingTick'
 */

class AudioController extends EventEmitter$1 {
  constructor() {
    super();

    // ── Raw sample storage ───────────────────────────────────────────────────
    this._samples = null; // Float32Array — raw (pre-filter) samples
    this._sampleRate = 0;

    // ── Filter bridge ────────────────────────────────────────────────────────
    this._filterFn = null; // (samples: Float32Array, sr: number) => Float32Array | Promise<Float32Array>

    // ── Playback state ───────────────────────────────────────────────────────
    this._audioContext = null;
    this._audioBuffer = null;
    this._source = null;
    this._isPlaying = false;
    this._pauseOffset = 0; // seconds into buffer where we paused/stopped
    this._startContextTime = 0; // audioContext.currentTime at last play() call
    this._startOffset = 0; // buffer offset at last play() call
    this._timeUpdateTimer = null;

    // ── STFT / tiling ────────────────────────────────────────────────────────
    this._stftConfig = null; // { windowSize, hopSize, windowFn, tileWidthSec }

    // ── Streaming ────────────────────────────────────────────────────────────
    this._streamingInterval = 500;
    this._streamingTimer = null;
    this._pendingAppend = false;
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get isPlaying() {
    return this._isPlaying;
  }
  get sampleRate() {
    return this._sampleRate;
  }
  get duration() {
    return this._samples ? this._samples.length / this._sampleRate : 0;
  }
  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  /**
   * Decode an ArrayBuffer (e.g. from FileReader or fetch) using the Web Audio API.
   * Emits 'loaded' when ready.
   */
  async loadFile(arrayBuffer) {
    // Temporary context for decoding; sampleRate unknown until decoded.
    const tmpCtx = new AudioContext();
    let decoded;
    try {
      decoded = await tmpCtx.decodeAudioData(arrayBuffer);
    } finally {
      tmpCtx.close();
    }
    const samples = decoded.getChannelData(0).slice(); // copy — ChannelData view is GC'd
    await this.loadBuffer(samples, decoded.sampleRate);
  }

  /**
   * Load from a pre-built Float32Array. Emits 'loaded' when ready.
   * @param {Float32Array} samples
   * @param {number}       sampleRate
   */
  async loadBuffer(samples, sampleRate) {
    this._stopPlayback();
    this._samples = samples instanceof Float32Array ? samples : new Float32Array(samples);
    this._sampleRate = sampleRate;
    this._pendingAppend = false;

    // Create / reuse AudioContext matched to the sample rate.
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({
        sampleRate
      });
    }
    await this._audioContext.resume();
    await this._rebuildAudioBuffer();
    this.emit('loaded', {
      duration: this.duration,
      sampleRate: this._sampleRate,
      samples: this._samples
    });
  }

  /**
   * Append additional samples to the existing buffer (streaming mode).
   * Rebuilds the playback AudioBuffer in the background.
   * If computeSTFT() was already called, starts the streaming timer so the
   * last STFT tile is recomputed on the configured interval.
   * @param {Float32Array} newSamples
   */
  appendSamples(newSamples) {
    if (!this._samples) throw new Error('AudioController: call loadBuffer() before appendSamples()');
    const combined = new Float32Array(this._samples.length + newSamples.length);
    combined.set(this._samples);
    combined.set(newSamples, this._samples.length);
    this._samples = combined;
    this._pendingAppend = true;
    this._rebuildAudioBuffer(); // fire-and-forget

    if (this._stftConfig) this._startStreamingTimer();
  }

  // ── Filter bridge ────────────────────────────────────────────────────────────

  /**
   * Set (or clear) the stateless filter transform.
   * @param {function|null} fn  (samples: Float32Array, sr: number) => Float32Array | Promise<Float32Array>
   *
   * Bridge to FilterController:
   *   audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr));
   */
  setFilterFn(fn) {
    this._filterFn = fn ?? null;
  }

  /**
   * Returns filtered samples (or raw samples if no filterFn is set).
   * The return value is always a Float32Array; may be the same reference as
   * _samples when no filter is applied.
   */
  async getFilteredSamples() {
    if (!this._samples) return null;
    if (!this._filterFn) return this._samples;
    const result = await this._filterFn(this._samples, this._sampleRate);
    return result instanceof Float32Array ? result : new Float32Array(result);
  }

  /**
   * Rebuild the AudioBuffer using filtered samples (or raw if no filter is set).
   * Call after setFilterFn() + filter changes to update what the user hears.
   */
  async rebuildFilteredBuffer() {
    if (!this._samples || !this._audioContext) return;
    const filtered = await this.getFilteredSamples();
    const buf = this._audioContext.createBuffer(1, filtered.length, this._sampleRate);
    buf.getChannelData(0).set(filtered);
    this._audioBuffer = buf;
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  /** Start or resume playback. Optional offsetSec overrides saved position. */
  async play(offsetSec = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume();
    this._stopSource();
    const startAt = offsetSec !== null ? Math.max(0, offsetSec) : this._pauseOffset;
    if (startAt >= this.duration) return;
    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false;
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying = false;
        this._pauseOffset = 0;
        this._stopTimeUpdate();
        this.emit('stateChanged', {
          state: 'stopped'
        });
      }
    };
    source.start(0, startAt);
    this._source = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset = startAt;
    this._isPlaying = true;
    this._startTimeUpdate();
    this.emit('stateChanged', {
      state: 'playing'
    });
  }
  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this._stopTimeUpdate();
    this.emit('stateChanged', {
      state: 'paused'
    });
  }
  stop() {
    this._stopPlayback();
    this.emit('stateChanged', {
      state: 'stopped'
    });
  }

  /** Jump to a time position; resumes playback if it was already playing. */
  seek(timeSec) {
    const clipped = Math.max(0, Math.min(timeSec, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) {
      this._stopSource();
      this._isPlaying = false;
      this._stopTimeUpdate();
    }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);else this.emit('stateChanged', {
      state: 'paused'
    });
  }

  // ── STFT / Tile generation ───────────────────────────────────────────────────

  /**
   * Compute the STFT in fixed-width time tiles. Emits 'tileReady' for each tile,
   * then 'stftComplete' when all tiles are done. If appendSamples() is called
   * afterward, the streaming timer recomputes the last tile automatically.
   *
   * @param {object} opts
   * @param {number} [opts.windowSize=1024]  — FFT window size (power of 2)
   * @param {number} [opts.hopSize]          — frame hop (default windowSize/2)
   * @param {string} [opts.windowFn='hann']  — 'hann'|'hamming'|'blackman'|'rectangular'
   * @param {number} [opts.tileWidthSec=30]  — seconds per tile
   */
  async computeSTFT({
    windowSize = 1024,
    hopSize,
    windowFn = 'hann',
    tileWidthSec = 30
  } = {}) {
    if (!this._samples || this._samples.length === 0) return;
    const hop = hopSize ?? windowSize / 2;

    // Persist config so the streaming timer can recompute the last tile.
    this._stftConfig = {
      windowSize,
      hopSize: hop,
      windowFn,
      tileWidthSec
    };
    const samples = await this.getFilteredSamples();
    const nyquist = this._sampleRate / 2;
    const samplesPerTile = Math.round(tileWidthSec * this._sampleRate);
    const numTiles = Math.ceil(samples.length / samplesPerTile);
    for (let t = 0; t < numTiles; t++) {
      const sampleStart = t * samplesPerTile;
      const sampleEnd = Math.min(sampleStart + samplesPerTile, samples.length);
      const tStart = t * tileWidthSec;
      const tEnd = sampleEnd / this._sampleRate;
      const tileSamples = samples.subarray(sampleStart, sampleEnd);
      const result = this._computeTileSTFT(tileSamples, windowSize, hop, windowFn);
      if (!result) continue;
      this.emit('tileReady', {
        tileIndex: t,
        power: result.power,
        width: result.numFrames,
        height: result.numBins,
        globalMin: result.globalMin,
        globalMax: result.globalMax,
        bounds: [tStart, 0, tEnd, nyquist]
      });
    }
    this.emit('stftComplete');

    // If samples were already appended before computeSTFT was called, kick off timer.
    if (this._pendingAppend) this._startStreamingTimer();
  }

  /**
   * Set how often the streaming timer fires (ms). Default 500.
   * Takes effect on the next appendSamples() call.
   */
  setStreamingInterval(ms) {
    this._streamingInterval = ms;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  destroy() {
    this._stopPlayback();
    this._stopStreamingTimer();
    this._audioContext?.close();
    this._audioContext = null;
    this._samples = null;
    this.removeAllListeners();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  async _rebuildAudioBuffer() {
    if (!this._samples || !this._audioContext) return;
    const buf = this._audioContext.createBuffer(1, this._samples.length, this._sampleRate);
    buf.getChannelData(0).set(this._samples);
    this._audioBuffer = buf;
  }

  /**
   * Run the radix-2 FFT over a single tile of samples.
   * Returns { power, numFrames, numBins, globalMin, globalMax } or null if too short.
   */
  _computeTileSTFT(samples, windowSize, hopSize, windowFn) {
    const numBins = windowSize / 2;
    const numFrames = Math.max(0, Math.floor((samples.length - windowSize) / hopSize) + 1);
    if (numFrames === 0) return null;
    const fft = new FFT(windowSize);
    const out = fft.createComplexArray();
    const frame = new Float32Array(windowSize);
    const power = new Float32Array(numFrames * numBins);
    let globalMin = Infinity;
    let globalMax = -Infinity;
    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      for (let i = 0; i < windowSize; i++) frame[i] = samples[offset + i] || 0;
      if (windowFn !== 'rectangular' && typeof fftWindowing[windowFn] === 'function') {
        fftWindowing[windowFn](frame); // mutates frame in-place
      }
      fft.realTransform(out, frame);
      for (let bin = 0; bin < numBins; bin++) {
        const re = out[bin * 2];
        const im = out[bin * 2 + 1];
        const mag = Math.sqrt(re * re + im * im) / windowSize;
        const db = 20 * Math.log10(Math.max(mag, 1e-10));
        // Row-major layout with Y-flip so _buildBitmapFromGrid produces the
        // correct orientation when luma.gl uploads with UNPACK_FLIP_Y_WEBGL:
        //   bin 0 (DC, 0 Hz)  → last image row  → texture v=0 → worldY=0 (bottom) ✓
        //   bin numBins-1     → first image row  → texture v=1 → worldY=nyquist (top) ✓
        //   frame f (time)    → column f                                               ✓
        power[(numBins - 1 - bin) * numFrames + f] = db;
        if (db < globalMin) globalMin = db;
        if (db > globalMax) globalMax = db;
      }
    }
    return {
      power,
      numFrames,
      numBins,
      globalMin,
      globalMax
    };
  }

  /** Recompute and re-emit the last STFT tile (called from streaming timer). */
  async _recomputeLastTile() {
    if (!this._stftConfig || !this._samples) return;
    const {
      windowSize,
      hopSize,
      windowFn,
      tileWidthSec
    } = this._stftConfig;
    const samples = await this.getFilteredSamples();
    const nyquist = this._sampleRate / 2;
    const samplesPerTile = Math.round(tileWidthSec * this._sampleRate);
    const numTiles = Math.ceil(samples.length / samplesPerTile);
    const lastIdx = numTiles - 1;
    const sampleStart = lastIdx * samplesPerTile;
    const tStart = lastIdx * tileWidthSec;
    const tEnd = samples.length / this._sampleRate;
    const tileSamples = samples.subarray(sampleStart);
    const result = this._computeTileSTFT(tileSamples, windowSize, hopSize, windowFn);
    if (!result) return;
    this.emit('tileReady', {
      tileIndex: lastIdx,
      power: result.power,
      width: result.numFrames,
      height: result.numBins,
      globalMin: result.globalMin,
      globalMax: result.globalMax,
      bounds: [tStart, 0, tEnd, nyquist]
    });
  }
  _startStreamingTimer() {
    if (this._streamingTimer) return;
    this._streamingTimer = setInterval(() => {
      if (!this._pendingAppend) return;
      this._pendingAppend = false;
      this._recomputeLastTile(); // async — fire-and-forget
      this.emit('streamingTick');
    }, this._streamingInterval);
  }
  _stopStreamingTimer() {
    if (this._streamingTimer) {
      clearInterval(this._streamingTimer);
      this._streamingTimer = null;
    }
  }
  _startTimeUpdate() {
    this._stopTimeUpdate();
    this._timeUpdateTimer = setInterval(() => {
      if (this._isPlaying) this.emit('timeUpdate', {
        currentTime: this.currentTime
      });
    }, 100); // ~10 Hz
  }
  _stopTimeUpdate() {
    if (this._timeUpdateTimer) {
      clearInterval(this._timeUpdateTimer);
      this._timeUpdateTimer = null;
    }
  }
  _stopPlayback() {
    this._stopSource();
    this._isPlaying = false;
    this._pauseOffset = 0;
    this._stopTimeUpdate();
  }
  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try {
        this._source.stop();
      } catch {/* already stopped */}
      this._source.disconnect();
      this._source = null;
    }
  }
}

class FilterController extends EventEmitter$1 {
  constructor() {
    super();
    this.state = {
      type: 'none',
      // 'none'|'lowpass'|'highpass'|'bandpass'|'notch'
      frequency: 1000,
      // Hz — cutoff for lowpass/highpass; computed center for bandpass/notch
      Q: 1.0,
      // resonance for lowpass/highpass; computed from bandwidth for bandpass/notch
      lowFreq: 500,
      // Hz — low edge for bandpass/notch (user-facing)
      highFreq: 2000,
      // Hz — high edge for bandpass/notch (user-facing)
      order: 2 // 2|4|6|8 — only used for lowpass/highpass (cascaded Butterworth sections)
    };
  }
  setOrder(n) {
    this.state.order = [2, 4, 6, 8].includes(n) ? n : 2;
    this.emit('changed', {
      ...this.state
    });
  }

  /**
   * Compute Butterworth Q values for each biquad section.
   * Formula: Q_k = 1 / (2 * cos((2k − 1) * π / (2 * order))), k = 1…order/2
   * Spot-checks:
   *   order=2: [0.7071]
   *   order=4: [0.5412, 1.3066]
   *   order=6: [0.5176, 0.7071, 1.9319]
   *   order=8: [0.5098, 0.6013, 0.9000, 2.5629]
   */
  _butterworthQValues(order) {
    const sections = order / 2;
    const qs = new Float32Array(sections);
    for (let k = 1; k <= sections; k++) {
      qs[k - 1] = 1 / (2 * Math.cos((2 * k - 1) * Math.PI / (2 * order)));
    }
    return qs;
  }
  setType(type) {
    this.state.type = type;
    // Reset parameters to sensible defaults when switching between single/dual input modes
    if (type === 'bandpass' || type === 'notch') {
      this.state.lowFreq = 500;
      this.state.highFreq = 2000;
      this._updateCenterFromLowHigh();
    } else if (type === 'lowpass' || type === 'highpass') {
      this.state.frequency = 1000;
      this.state.Q = 1.0;
    }
    this.emit('changed', {
      ...this.state
    });
  }
  setFrequency(freq) {
    this.state.frequency = freq;
    this.emit('changed', {
      ...this.state
    });
  }
  setQ(q) {
    this.state.Q = q;
    this.emit('changed', {
      ...this.state
    });
  }

  /**
   * Set bandpass/notch filter via low + high frequency edges.
   * Computes geometric-mean center + bandwidth-derived Q.
   */
  setLowHighFreq(lowFreq, highFreq) {
    this.state.lowFreq = lowFreq;
    this.state.highFreq = highFreq;
    this._updateCenterFromLowHigh();
    this.emit('changed', {
      ...this.state
    });
  }
  _updateCenterFromLowHigh() {
    const {
      lowFreq,
      highFreq
    } = this.state;
    const center = Math.sqrt(lowFreq * highFreq);
    const bw = highFreq - lowFreq;
    this.state.frequency = center;
    this.state.Q = bw > 0 ? center / bw : 1.0;
  }

  /**
   * Process samples through the biquad filter using OfflineAudioContext.
   * Returns a new Float32Array — original is not mutated.
   * If type === 'none', returns the same reference unchanged.
   */
  async applyToSamples(samples, sampleRate) {
    if (this.state.type === 'none') return samples;
    const offlineCtx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf = offlineCtx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    const clampedFreq = Math.min(this.state.frequency, sampleRate / 2 - 1);
    if (this.state.type === 'lowpass' || this.state.type === 'highpass') {
      // Cascade order/2 biquad sections with Butterworth Q values
      const qs = this._butterworthQValues(this.state.order);
      const filters = Array.from(qs).map(q => {
        const f = offlineCtx.createBiquadFilter();
        f.type = this.state.type;
        f.frequency.value = clampedFreq;
        f.Q.value = q;
        return f;
      });
      // Chain: source → filters[0] → filters[1] → … → destination
      source.connect(filters[0]);
      for (let i = 0; i < filters.length - 1; i++) {
        filters[i].connect(filters[i + 1]);
      }
      filters[filters.length - 1].connect(offlineCtx.destination);
    } else {
      // bandpass/notch: single biquad as before
      const filter = offlineCtx.createBiquadFilter();
      filter.type = this.state.type;
      filter.frequency.value = clampedFreq;
      filter.Q.value = this.state.Q;
      source.connect(filter);
      filter.connect(offlineCtx.destination);
    }
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice(); // copy — ChannelData view becomes invalid after GC
  }

  /**
   * Compute frequency response for the current filter settings.
   * Returns { freqs: Float32Array, db: Float32Array } for nPoints log-spaced
   * frequencies from 20 Hz to nyquist.  Returns null if type === 'none'.
   *
   * Note: creates and immediately closes a temporary AudioContext; call only
   * when the user interacts with controls (not on every RAF frame).
   */
  getFrequencyResponse(nPoints = 256, sampleRate = 44100) {
    if (this.state.type === 'none') return null;
    const nyquist = sampleRate / 2;
    const clampedFreq = Math.min(this.state.frequency, nyquist - 1);
    const freqs = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      freqs[i] = 20 * Math.pow(nyquist / 20, i / (nPoints - 1));
    }
    const magBuf = new Float32Array(nPoints);
    const phaseBuf = new Float32Array(nPoints);
    const tmpCtx = new AudioContext({
      sampleRate
    });
    let db;
    if (this.state.type === 'lowpass' || this.state.type === 'highpass') {
      // Multiply linear magnitudes of each cascaded section
      const qs = this._butterworthQValues(this.state.order);
      const combinedMag = new Float32Array(nPoints).fill(1.0);
      for (const q of qs) {
        const node = tmpCtx.createBiquadFilter();
        node.type = this.state.type;
        node.frequency.value = clampedFreq;
        node.Q.value = q;
        node.getFrequencyResponse(freqs, magBuf, phaseBuf);
        for (let i = 0; i < nPoints; i++) combinedMag[i] *= magBuf[i];
      }
      db = new Float32Array(nPoints);
      for (let i = 0; i < nPoints; i++) {
        db[i] = 20 * Math.log10(Math.max(combinedMag[i], 1e-10));
      }
    } else {
      // bandpass/notch: single section
      const node = tmpCtx.createBiquadFilter();
      node.type = this.state.type;
      node.frequency.value = clampedFreq;
      node.Q.value = this.state.Q;
      node.getFrequencyResponse(freqs, magBuf, phaseBuf);
      db = new Float32Array(nPoints);
      for (let i = 0; i < nPoints; i++) {
        db[i] = 20 * Math.log10(Math.max(magBuf[i], 1e-10));
      }
    }
    tmpCtx.close(); // release resources; fire-and-forget async close is fine
    return {
      freqs,
      db
    };
  }
  static get filterTypes() {
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch'];
  }
}

class PlaybackController extends EventEmitter$1 {
  constructor() {
    super();
    this._audioContext = null;
    this._audioBuffer = null;
    this._source = null;
    this._isPlaying = false;
    this._pauseOffset = 0; // seconds into buffer where we paused/stopped
    this._startContextTime = 0; // audioContext.currentTime at last play() call
    this._startOffset = 0; // buffer offset at last play() call
  }
  get isPlaying() {
    return this._isPlaying;
  }
  get duration() {
    return this._audioBuffer?.duration ?? 0;
  }

  /** Returns the current playback position in seconds. */
  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  /**
   * Decode samples into an AudioBuffer. Called after file load.
   * Creates or reuses the AudioContext; resumes it (autoplay policy).
   */
  async loadBuffer(samples, sampleRate) {
    this._stopSource();
    this._isPlaying = false;
    this._pauseOffset = 0;
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({
        sampleRate
      });
    }
    await this._audioContext.resume();
    const buf = this._audioContext.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    this._audioBuffer = buf;
    this.emit('stateChanged', {
      state: 'loaded',
      duration: buf.duration
    });
  }

  /** Start or resume playback. Optional offset (seconds) overrides saved position. */
  async play(offset = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume(); // browser autoplay guard
    this._stopSource();
    const startAt = offset !== null ? Math.max(0, offset) : this._pauseOffset;
    if (startAt >= this.duration) return;
    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false; // distinguish natural end from manual stop
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying = false;
        this._pauseOffset = 0;
        this.emit('stateChanged', {
          state: 'stopped'
        });
      }
    };
    source.start(0, startAt);
    this._source = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset = startAt;
    this._isPlaying = true;
    this.emit('stateChanged', {
      state: 'playing'
    });
  }
  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this.emit('stateChanged', {
      state: 'paused'
    });
  }
  stop() {
    this._stopSource();
    this._isPlaying = false;
    this._pauseOffset = 0;
    this.emit('stateChanged', {
      state: 'stopped'
    });
  }

  /** Jump to a time; resumes playback if it was playing. */
  seek(time) {
    const clipped = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) {
      this._stopSource();
      this._isPlaying = false;
    }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);else this.emit('stateChanged', {
      state: 'paused'
    });
  }
  destroy() {
    this._stopSource();
    this._audioContext?.close();
    this._audioContext = null;
  }
  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try {
        this._source.stop();
      } catch {/* already stopped */}
      this._source.disconnect();
      this._source = null;
    }
  }
}

/**
 * ExternalDataAdapter — interface contract for external data sources.
 *
 * MasterPlot never implements HTTP, WebSocket, or authentication logic.
 * Integration packages extend this class and implement the two methods below.
 *
 * bufferStruct shape (same as DataStore.appendData / clear+appendData):
 * ```
 * {
 *   x:      Float32Array   — required; x coordinates
 *   y:      Float32Array   — required; y coordinates
 *   size?:  Float32Array   — optional; per-point size in pixels (default 4.0)
 *   color?: Uint8Array     — optional; RGBA per point (4 bytes each, default opaque white)
 * }
 * ```
 *
 * Usage (extend and override):
 * ```js
 * import { ExternalDataAdapter } from './ExternalDataAdapter.js';
 *
 * class MyWSAdapter extends ExternalDataAdapter {
 *   constructor(dataStore, wsUrl) {
 *     super(dataStore);
 *     this._ws = new WebSocket(wsUrl);
 *     this._ws.onmessage = (evt) => {
 *       const buf = JSON.parse(evt.data);
 *       this.appendData({
 *         x: new Float32Array(buf.x),
 *         y: new Float32Array(buf.y),
 *       });
 *     };
 *   }
 *   appendData(bufferStruct) { this._dataStore.appendData(bufferStruct); }
 *   replaceData(bufferStruct) {
 *     this._dataStore.clear();
 *     this._dataStore.appendData(bufferStruct);
 *   }
 * }
 * ```
 */
class ExternalDataAdapter {
  /**
   * @param {import('../plot/DataStore.js').DataStore} dataStore
   */
  constructor(dataStore) {
    if (!dataStore) {
      throw new Error('ExternalDataAdapter: dataStore is required');
    }
    this._dataStore = dataStore;

    // REL7: validate the adapter's method signatures at registration time
    // (construction) rather than letting a missing override surface as a
    // "must be implemented by subclass" throw the first time it's called.
    for (const method of ['replaceData', 'appendData']) {
      if (typeof this[method] !== 'function') {
        throw new Error(`ExternalDataAdapter: subclass must define method "${method}"`);
      }
      if (this[method] === ExternalDataAdapter.prototype[method]) {
        throw new Error(`ExternalDataAdapter: subclass must override "${method}()" — the base implementation ` + 'only throws');
      }
    }
  }

  /**
   * Replace the entire dataset with a new snapshot.
   * Clears the DataStore and loads the incoming buffer.
   *
   * @param {object} bufferStruct
   * @param {Float32Array} bufferStruct.x
   * @param {Float32Array} bufferStruct.y
   * @param {Float32Array} [bufferStruct.size]
   * @param {Uint8Array}   [bufferStruct.color]
   */
  replaceData(_bufferStruct) {
    throw new Error('ExternalDataAdapter.replaceData() must be implemented by subclass. ' + 'Call this._dataStore.clear() then this._dataStore.appendData(bufferStruct).');
  }

  /**
   * Append incremental data points to the DataStore.
   *
   * @param {object} bufferStruct
   * @param {Float32Array} bufferStruct.x
   * @param {Float32Array} bufferStruct.y
   * @param {Float32Array} [bufferStruct.size]
   * @param {Uint8Array}   [bufferStruct.color]
   */
  appendData(_bufferStruct) {
    throw new Error('ExternalDataAdapter.appendData() must be implemented by subclass. ' + 'Call this._dataStore.appendData(bufferStruct).');
  }
}

/**
 * ExternalROIAdapter — interface contract for external ROI persistence and sync.
 *
 * MasterPlot never implements HTTP, WebSocket, or authentication logic.
 * Integration packages extend this class and implement the three methods below.
 *
 * SerializedROI schema (produced by ROIController.serializeAll()):
 * ```
 * {
 *   id:        string   — stable UUID
 *   type:      'linearRegion' | 'rect'
 *   version:   number   — monotonic integer; incremented on each user commit
 *   updatedAt: number   — Date.now() timestamp of last bumpVersion()
 *   domain:    { x: [x1, x2], y?: [y1, y2] }   — JSON-safe bounds snapshot
 *   metadata:  object   — arbitrary per-ROI data
 * }
 * ```
 *
 * Event lifecycle:
 * ```
 * User drags ROI → mouseup
 *   → roi.bumpVersion()
 *   → roiController.emit('roiFinalized', { roi, version, domain, ... })
 *   → adapter.save(serializedROI)               ← persist to storage
 *   → (other clients receive update via subscription)
 *   → adapter.subscribe callback fires
 *   → roiController.updateFromExternal(roi)     ← version-gated; rejects if stale
 *   → roiController.emit('roiExternalUpdate')
 *   → PlotDataView marked dirty
 * ```
 *
 * Version conflict rules:
 *   incoming.version > current.version  → accepted, bounds updated
 *   incoming.version <= current.version → rejected (silent)
 *
 * Usage (extend and override):
 * ```js
 * import { ExternalROIAdapter } from './ExternalROIAdapter.js';
 *
 * class MyServerROIAdapter extends ExternalROIAdapter {
 *   constructor(roiController, apiUrl) {
 *     super(roiController);
 *     this._apiUrl = apiUrl;
 *   }
 *   async load() {
 *     const res = await fetch(`${this._apiUrl}/rois`);
 *     return res.json();
 *   }
 *   async save(roi) {
 *     await fetch(`${this._apiUrl}/rois/${roi.id}`, {
 *       method: 'PUT', body: JSON.stringify(roi),
 *       headers: { 'Content-Type': 'application/json' },
 *     });
 *   }
 *   subscribe(callback) {
 *     const ws = new WebSocket(`${this._apiUrl}/rois/ws`);
 *     ws.onmessage = (evt) => callback(JSON.parse(evt.data));
 *     return () => ws.close();
 *   }
 * }
 * ```
 */
class ExternalROIAdapter {
  /**
   * @param {import('../plot/ROI/ROIController.js').ROIController} roiController
   */
  constructor(roiController) {
    if (!roiController) {
      throw new Error('ExternalROIAdapter: roiController is required');
    }
    this._roiController = roiController;

    // REL7: validate the adapter's method signatures at registration time
    // (construction) rather than letting a missing override surface as a
    // "must be implemented by subclass" throw the first time it's called.
    for (const method of ['load', 'save', 'subscribe']) {
      if (typeof this[method] !== 'function') {
        throw new Error(`ExternalROIAdapter: subclass must define method "${method}"`);
      }
      if (this[method] === ExternalROIAdapter.prototype[method]) {
        throw new Error(`ExternalROIAdapter: subclass must override "${method}()" — the base implementation ` + 'only throws');
      }
    }
  }

  /**
   * Load persisted ROIs on initialisation.
   * Called once during `attach()`. Pass result to `roiController.deserializeAll()`.
   *
   * @returns {Promise<Array<{id, type, version, updatedAt, domain, metadata}>>}
   */
  async load() {
    throw new Error('ExternalROIAdapter.load() must be implemented by subclass. ' + 'Return a Promise that resolves to a SerializedROI array.');
  }

  /**
   * Persist a single ROI after it has been finalized.
   * Called by `attach()` on every `roiFinalized` event.
   *
   * @param {{ id, type, version, updatedAt, domain, metadata }} serializedROI
   * @returns {Promise<void>}
   */
  async save(_serializedROI) {
    throw new Error('ExternalROIAdapter.save() must be implemented by subclass. ' + 'Persist the serializedROI object to your storage backend.');
  }

  /**
   * Subscribe to incoming ROI updates from external sources (e.g. other clients).
   * The engine calls `roiController.updateFromExternal(roi)` for each update.
   *
   * @param {function({ id, type, version, updatedAt, domain, metadata }): void} callback
   * @returns {function(): void} unsubscribe — call to stop receiving updates
   */
  subscribe(_callback) {
    throw new Error('ExternalROIAdapter.subscribe() must be implemented by subclass. ' + 'Register the callback with your external source and return an unsubscribe function.');
  }

  /**
   * Convenience helper: load persisted ROIs, restore them, and start the
   * save/subscribe lifecycle. Subclasses may override for custom attach logic.
   *
   * Flow:
   *   1. `await load()` → `roiController.deserializeAll(rois)`
   *   2. Start subscription: incoming updates → `roiController.updateFromExternal()`
   *   3. Listen for `roiFinalized` → `save(serializedROI)`
   *
   * @returns {Promise<void>}
   */
  async attach() {
    // Restore persisted ROIs
    const rois = await this.load();
    this._roiController.deserializeAll(rois);

    // External updates → version-gated apply
    this._unsubscribe = this.subscribe(roi => {
      this._roiController.updateFromExternal(roi);
    });

    // User commits → save to storage
    this._onFinalized = payload => {
      const {
        roi,
        version,
        updatedAt,
        domain
      } = payload;
      this.save({
        id: roi.id,
        type: roi.type,
        version,
        updatedAt,
        domain,
        metadata: roi.metadata || {}
      });
    };
    this._roiController.on('roiFinalized', this._onFinalized);
  }

  /**
   * Detach all listeners set up in `attach()`. Safe to call if `attach()` was
   * never called.
   */
  detach() {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
    if (this._onFinalized) {
      this._roiController.off('roiFinalized', this._onFinalized);
      this._onFinalized = null;
    }
  }
}

/**
 * MockDataAdapter — reference implementation of ExternalDataAdapter.
 *
 * Generates random (x, y) point batches on a fixed interval and appends them
 * to the supplied DataStore. Useful for testing and demos; replace with a
 * real adapter (WebSocket, HTTP polling, etc.) in production.
 *
 * Usage:
 * ```js
 * import { DataStore }       from '../plot/DataStore.js';
 * import { MockDataAdapter } from './MockDataAdapter.js';
 *
 * const store   = new DataStore();
 * const adapter = new MockDataAdapter(store, { intervalMs: 500, batchSize: 100 });
 *
 * adapter.start();
 *
 * // Replace all data with a specific snapshot:
 * adapter.replaceData({
 *   x: new Float32Array([1, 2, 3]),
 *   y: new Float32Array([4, 5, 6]),
 * });
 *
 * // Stop generating data:
 * adapter.stop();
 * ```
 */

class MockDataAdapter extends ExternalDataAdapter {
  /**
   * @param {import('../plot/DataStore.js').DataStore} dataStore
   * @param {object}  [opts]
   * @param {number}  [opts.intervalMs=500]  — ms between each batch
   * @param {number}  [opts.batchSize=100]   — points appended per interval
   * @param {number}  [opts.xMin=0]          — random x lower bound
   * @param {number}  [opts.xMax=100]        — random x upper bound
   * @param {number}  [opts.yMin=0]          — random y lower bound
   * @param {number}  [opts.yMax=100]        — random y upper bound
   */
  constructor(dataStore, opts = {}) {
    super(dataStore);
    this._intervalMs = opts.intervalMs ?? 500;
    this._batchSize = opts.batchSize ?? 100;
    this._xMin = opts.xMin ?? 0;
    this._xMax = opts.xMax ?? 100;
    this._yMin = opts.yMin ?? 0;
    this._yMax = opts.yMax ?? 100;
    this._timer = null;
  }

  /**
   * Start generating and appending random point batches.
   * Safe to call multiple times — will not start a second interval if already
   * running.
   */
  start() {
    if (this._timer !== null) return;
    this._timer = setInterval(() => {
      const n = this._batchSize;
      const x = new Float32Array(n);
      const y = new Float32Array(n);
      const xRange = this._xMax - this._xMin;
      const yRange = this._yMax - this._yMin;
      for (let i = 0; i < n; i++) {
        x[i] = this._xMin + Math.random() * xRange;
        y[i] = this._yMin + Math.random() * yRange;
      }
      this.appendData({
        x,
        y
      });
    }, this._intervalMs);
  }

  /** Stop the interval. Safe to call if not running. */
  stop() {
    if (this._timer !== null) {
      clearInterval(this._timer);
      this._timer = null;
    }
  }

  /**
   * Replace the entire DataStore with a new snapshot.
   * @param {{ x: Float32Array, y: Float32Array, size?: Float32Array, color?: Uint8Array }} bufferStruct
   */
  replaceData(bufferStruct) {
    this._dataStore.clear();
    this._dataStore.appendData(bufferStruct);
  }

  /**
   * Append incremental data to the DataStore.
   * @param {{ x: Float32Array, y: Float32Array, size?: Float32Array, color?: Uint8Array }} bufferStruct
   */
  appendData(bufferStruct) {
    this._dataStore.appendData(bufferStruct);
  }
}

/**
 * MockROIAdapter — reference implementation of ExternalROIAdapter.
 *
 * Persists ROIs to `localStorage` under a configurable key. Useful for
 * verifying the ROI sync contract in browser demos. Replace with a real
 * adapter (WebSocket broadcast, REST API, etc.) in production.
 *
 * Usage:
 * ```js
 * import { MockROIAdapter } from './MockROIAdapter.js';
 *
 * const adapter = new MockROIAdapter(roiController, {
 *   storageKey: 'masterplot_rois',
 * });
 *
 * // Restore persisted ROIs and start save/subscribe lifecycle:
 * await adapter.attach();
 *
 * // When done:
 * adapter.detach();
 * ```
 *
 * Notes:
 * - `subscribe()` in this mock does NOT simulate a multi-client broadcast.
 *   It validates the contract shape only. A real server adapter would push
 *   updates to all connected clients.
 * - Version conflict rule (inherited from ROIController.updateFromExternal):
 *   incoming.version > current.version → accepted; otherwise rejected silently.
 */

const DEFAULT_KEY = 'masterplot_rois';
class MockROIAdapter extends ExternalROIAdapter {
  /**
   * @param {import('../plot/ROI/ROIController.js').ROIController} roiController
   * @param {object} [opts]
   * @param {string} [opts.storageKey='masterplot_rois'] — localStorage key
   */
  constructor(roiController, opts = {}) {
    super(roiController);
    this._storageKey = opts.storageKey ?? DEFAULT_KEY;

    // Internal list of external-update subscribers (for mock broadcast)
    this._subscribers = [];
  }

  // ─── ExternalROIAdapter interface ─────────────────────────────────────────

  /**
   * Load persisted ROIs from localStorage.
   * Returns an empty array if nothing is stored or JSON is invalid.
   *
   * @returns {Promise<Array<{id, type, version, updatedAt, domain, metadata}>>}
   */
  async load() {
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  /**
   * Upsert a single ROI into localStorage by id.
   * Merges with any existing array (keyed by `roi.id`).
   *
   * @param {{ id, type, version, updatedAt, domain, metadata }} serializedROI
   * @returns {Promise<void>}
   */
  async save(serializedROI) {
    let rois = [];
    try {
      const raw = localStorage.getItem(this._storageKey);
      if (raw) rois = JSON.parse(raw);
    } catch {
      // Start fresh on corrupt storage
    }
    const idx = rois.findIndex(r => r.id === serializedROI.id);
    if (idx === -1) {
      rois.push(serializedROI);
    } else {
      rois[idx] = serializedROI;
    }
    localStorage.setItem(this._storageKey, JSON.stringify(rois));

    // Broadcast to in-process subscribers (simulates multi-client push)
    for (const cb of this._subscribers) {
      cb(serializedROI);
    }
  }

  /**
   * Register a callback that fires whenever an external ROI update arrives.
   * In this mock the broadcast happens synchronously inside `save()`.
   *
   * @param {function({ id, type, version, updatedAt, domain, metadata }): void} callback
   * @returns {function(): void} unsubscribe
   */
  subscribe(callback) {
    this._subscribers.push(callback);
    return () => {
      const idx = this._subscribers.indexOf(callback);
      if (idx !== -1) this._subscribers.splice(idx, 1);
    };
  }
}

/**
 * PopupWindowManager — opens a connected secondary browser window and manages
 * bidirectional communication via the BroadcastChannel API.
 *
 * All messages follow the shared envelope convention:
 *   { type: 'TYPE_NAME', payload: { ...data } }
 *
 * Both sides must silently ignore unknown `type` values for forward-compatibility.
 *
 * Usage:
 * ```js
 * const manager = new PopupWindowManager();
 * manager.on('message', (msg) => console.log('from popup:', msg));
 * manager.on('closed',  ()    => console.log('popup closed'));
 *
 * const opened = manager.open('spectrogram-popup.html?panel=filter', 'spectrogram-filter');
 * if (!opened) alert('Popup was blocked — please allow popups for this site.');
 *
 * manager.send({ type: 'FILTER_STATE', payload: { filterType: 'lowpass', cutoff: 1000 } });
 * ```
 *
 * Events emitted:
 *   'message' (msg)  — incoming message from the popup window
 *   'closed'         — popup window was closed (by the user or via manager.close())
 */
class PopupWindowManager extends EventEmitter {
  constructor() {
    super();
    /** @type {Window|null} */
    this._popup = null;
    /** @type {BroadcastChannel|null} */
    this._channel = null;
    /** @type {ReturnType<typeof setInterval>|null} */
    this._pollTimer = null;
  }

  /**
   * Whether the popup window is currently open.
   * @type {boolean}
   */
  get isOpen() {
    return this._popup !== null && !this._popup.closed;
  }

  /**
   * Open a secondary popup window and establish a BroadcastChannel.
   *
   * @param {string} url           - URL of the popup page (e.g. 'spectrogram-popup.html?panel=filter&channel=spectrogram-filter')
   * @param {string} channelName   - BroadcastChannel name to use for bidirectional messaging
   * @param {string} [windowFeatures] - window.open features string (default: 'width=520,height=640')
   * @returns {boolean} true if the popup was opened; false if blocked by the browser
   */
  open(url, channelName, windowFeatures = 'width=520,height=640') {
    if (this.isOpen) return true;
    const popup = window.open(url, '_blank', windowFeatures);
    if (!popup) {
      console.warn('[PopupWindowManager] Popup was blocked by the browser. ' + 'Allow popups for this site and try again.');
      return false;
    }
    this._popup = popup;
    this._channel = new BroadcastChannel(channelName);

    // Forward incoming messages to listeners
    this._channel.onmessage = evt => {
      const msg = evt.data;
      if (msg && typeof msg.type === 'string') {
        this.emit('message', msg);
      }
    };

    // Poll every 500 ms to detect user-initiated closure
    this._pollTimer = setInterval(() => {
      if (this._popup && this._popup.closed) {
        this._cleanup();
        this.emit('closed');
      }
    }, 500);
    return true;
  }

  /**
   * Send a message to the popup window.
   * No-op if the popup is not currently open.
   *
   * @param {{ type: string, payload: object }} message
   */
  send(message) {
    if (!this._channel) return;
    this._channel.postMessage(message);
  }

  /**
   * Programmatically close the popup window and clean up resources.
   * Emits 'closed'.
   */
  close() {
    if (this._popup && !this._popup.closed) {
      this._popup.close();
    }
    this._cleanup();
    this.emit('closed');
  }

  /**
   * Tear down all resources and listeners.
   * Call this when the managing component unmounts (if not using usePopupChannel).
   */
  destroy() {
    this._cleanup();
    this.removeAllListeners();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  _cleanup() {
    if (this._pollTimer !== null) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
    if (this._channel) {
      this._channel.close();
      this._channel = null;
    }
    this._popup = null;
  }
}

/**
 * usePopupChannel — React hook that wraps PopupWindowManager for use in
 * functional components.
 *
 * The popup is NOT opened automatically on mount. Call the returned `open()`
 * function to open it (e.g., from a button click handler).
 *
 * The BroadcastChannel is created when `open()` is called and closed on unmount
 * to prevent memory leaks.
 *
 * @param {string}   url         - Popup page URL (passed to PopupWindowManager.open)
 * @param {string}   channelName - BroadcastChannel name
 * @param {function} onMessage   - Callback invoked for every incoming message from the popup
 *                                 Signature: (msg: { type: string, payload: object }) => void
 *
 * @returns {{ open: () => boolean, send: (msg: object) => void, close: () => void, isOpen: boolean }}
 *
 * Example:
 * ```jsx
 * const { open, send, close, isOpen } = usePopupChannel(
 *   'spectrogram-popup.html?panel=filter&channel=spectrogram-filter',
 *   'spectrogram-filter',
 *   (msg) => {
 *     if (msg.type === 'FILTER_APPLY') handleApply();
 *   }
 * );
 *
 * return (
 *   <button onClick={open} disabled={isOpen}>
 *     {isOpen ? 'Filter Panel Open' : 'Open Filter Panel'}
 *   </button>
 * );
 * ```
 */
function usePopupChannel(url, channelName, onMessage) {
  const managerRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  // Keep onMessage ref stable so the effect closure doesn't go stale
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  useEffect(() => {
    const manager = new PopupWindowManager();
    managerRef.current = manager;
    manager.on('message', msg => {
      if (onMessageRef.current) onMessageRef.current(msg);
    });
    manager.on('closed', () => {
      setIsOpen(false);
    });
    return () => {
      manager.destroy();
      managerRef.current = null;
    };
  }, []); // intentionally empty — create/destroy once with the component

  const open = () => {
    const manager = managerRef.current;
    if (!manager) return false;
    const opened = manager.open(url, channelName);
    if (opened) setIsOpen(true);
    return opened;
  };
  const send = message => {
    if (managerRef.current) managerRef.current.send(message);
  };
  const close = () => {
    if (managerRef.current) managerRef.current.close();
  };
  return {
    send,
    isOpen,
    open,
    close
  };
}

/**
 * PlotCanvas — thin React wrapper around PlotController.
 *
 * This component's only job is to:
 *   1. Create the canvas DOM elements
 *   2. Instantiate PlotController and call init() once mounted
 *   3. Call destroy() on unmount
 *   4. Expose plotController via ref for the parent to call appendData() etc.
 *
 * React state is NOT used for:
 *   - Point data
 *   - Zoom / pan state
 *   - ROI geometry
 *
 * React state IS used for:
 *   - UI overlay text (mode indicator, point count badge)
 */

const PlotCanvas = /*#__PURE__*/forwardRef(function PlotCanvas(props, ref) {
  const {
    width = '100%',
    height = '100%',
    xScaleType = 'linear',
    yScaleType = 'linear',
    xDomain = [0, 1],
    yDomain = [0, 100],
    xLabel,
    yLabel,
    xAxis,
    // ARCH-G: optional shared AxisController config object
    yAxis,
    // ARCH-G: optional shared AxisController config object
    bordered,
    // F34: fill axis gutters with container background color
    dataStore,
    // F17: optional shared DataStore instance
    onEvent,
    // optional: (eventName, data) => void
    onInit // optional: (controller) => void — fires once after init
  } = props;
  const containerRef = useRef(null);
  const webglCanvasRef = useRef(null);
  const axisCanvasRef = useRef(null);
  const controllerRef = useRef(null);
  const [modeText, setModeText] = useState('');
  const [pointCount, setPointCount] = useState(0);

  // Expose controller via ref
  useImperativeHandle(ref, () => ({
    getController: () => controllerRef.current,
    appendData: (chunk, autoExpand) => controllerRef.current?.appendData(chunk, autoExpand)
  }));
  useEffect(() => {
    if (!webglCanvasRef.current || !axisCanvasRef.current) return;
    const controller = new PlotController({
      xScaleType,
      yScaleType,
      xDomain,
      yDomain,
      xLabel,
      yLabel,
      ...(xAxis ? {
        xAxis
      } : {}),
      ...(yAxis ? {
        yAxis
      } : {}),
      ...(bordered ? {
        bordered
      } : {}),
      ...(dataStore ? {
        dataStore
      } : {})
    });
    controllerRef.current = controller;

    // Initialise after next paint so canvas dimensions are settled
    const raf = requestAnimationFrame(() => {
      const wc = webglCanvasRef.current;
      const ac = axisCanvasRef.current;
      if (!wc || !ac) return;
      const w = wc.offsetWidth || 800;
      const h = wc.offsetHeight || 600;
      wc.width = w;
      ac.width = w;
      wc.height = h;
      ac.height = h;
      controller.init(wc, ac);

      // F17: notify parent that controller is ready for post-init setup
      if (onInit) onInit(controller);

      // Wire events to UI state (cheap: only a few events/sec)
      controller.on('dataAppended', ({
        total
      }) => setPointCount(total));
      controller.on('modeChanged', ({
        mode
      }) => {
        const labels = {
          idle: '',
          createLinear: 'Mode: Draw LinearRegion — click x1, then x2',
          createRect: 'Mode: Draw RectROI — click top-left, then bottom-right'
        };
        setModeText(labels[mode] || mode);
      });

      // Bubble all events to parent if requested
      if (onEvent) {
        const names = ['roiCreated', 'roiUpdated', 'roiDeleted', 'dataAppended', 'domainChanged', 'zoomChanged', 'panChanged'];
        names.forEach(n => controller.on(n, d => onEvent(n, d)));
      }

      // Also listen to ROI controller's mode changes
      controller.roiController.on('modeChanged', ({
        mode
      }) => {
        const labels = {
          idle: '',
          createLinear: 'Mode: Draw LinearRegion — click x1, then x2',
          createRect: 'Mode: Draw RectROI — click top-left, then bottom-right'
        };
        setModeText(labels[mode] || mode);
      });
    });
    return () => {
      cancelAnimationFrame(raf);
      controller.destroy();
      controllerRef.current = null;
    };
  }, []); // mount once

  const overlayStyle = {
    position: 'absolute',
    bottom: 4,
    right: 8,
    color: '#aaa',
    fontSize: 11,
    fontFamily: 'monospace',
    pointerEvents: 'none',
    userSelect: 'none'
  };
  const modeStyle = {
    position: 'absolute',
    top: 4,
    left: '50%',
    transform: 'translateX(-50%)',
    color: '#ffd700',
    fontSize: 12,
    fontFamily: 'monospace',
    pointerEvents: 'none',
    background: 'rgba(0,0,0,0.6)',
    padding: '2px 8px',
    borderRadius: 3,
    display: modeText ? 'block' : 'none'
  };
  const canvasStyle = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%'
  };
  return /*#__PURE__*/jsxs("div", {
    ref: containerRef,
    style: {
      position: 'relative',
      width,
      height,
      background: '#0d0d0d',
      overflow: 'hidden'
    },
    children: [/*#__PURE__*/jsx("canvas", {
      ref: webglCanvasRef,
      style: canvasStyle
    }), /*#__PURE__*/jsx("canvas", {
      ref: axisCanvasRef,
      style: {
        ...canvasStyle,
        pointerEvents: 'none'
      }
    }), /*#__PURE__*/jsx("div", {
      style: modeStyle,
      children: modeText
    }), /*#__PURE__*/jsxs("div", {
      style: overlayStyle,
      children: [pointCount.toLocaleString(), " pts"]
    })]
  });
});

export { AudioController, AxisController, AxisRenderer, BitmapDataLayer, BitmapViewGenerator, ConstraintEngine, DataStore, ExternalDataAdapter, ExternalROIAdapter, FilterController, LUTController, LUTHistogramController, LineROI, LinearRegion, MockDataAdapter, MockROIAdapter, PlaybackController, PlotCanvas, PlotController, PlotDataView, PlotLayer, PopupWindowManager, ROIBase, ROIController, ROILayer, RectROI, SignalStore, TraceGroup, ViewportController, buildEpochTickFormatter, buildLineLayer, buildScatterLayer, buildSignalLayers, dataXToEpochSeconds, epochSecondsToDataX, usePopupChannel };
//# sourceMappingURL=index.esm.js.map
