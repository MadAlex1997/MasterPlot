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

import { EventEmitter } from 'events';

const INITIAL_CAPACITY = 65536;   // 64k points to start
const GROWTH_FACTOR    = 1.5;     // grow 50% when full

export class DataStore extends EventEmitter {
  constructor(initialCapacity = INITIAL_CAPACITY) {
    super();

    this._capacity = initialCapacity;
    this._count    = 0;

    // Allocate parallel GPU-ready typed arrays
    this._x        = new Float32Array(this._capacity);
    this._y        = new Float32Array(this._capacity);
    this._sizeArr  = new Float32Array(this._capacity);  // renamed from _size (avoids semantic collision)
    this._color    = new Uint8Array(this._capacity * 4);   // RGBA per point

    // Per-point JS metadata (not GPU); keyed by numeric index
    this._metadata = new Map();

    // ── Rolling ring buffer state (inactive until enableRolling() is called) ──
    this._rollingEnabled = false;
    this._maxPoints      = Infinity;
    this._maxAgeMs       = Infinity;
    this._headIndex      = 0;
    this._tailIndex      = 0;
    this._timestamps     = null;   // Float64Array, allocated in enableRolling()
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
  enableRolling({ maxPoints = Infinity, maxAgeMs = Infinity } = {}) {
    if (maxPoints === Infinity && maxAgeMs === Infinity) {
      throw new Error('enableRolling: must specify maxPoints and/or maxAgeMs');
    }

    const capacity = maxPoints === Infinity ? INITIAL_CAPACITY : maxPoints;

    this._rollingEnabled = true;
    this._maxPoints      = maxPoints;
    this._maxAgeMs       = maxAgeMs;
    this._headIndex      = 0;
    this._tailIndex      = 0;
    this._count          = 0;

    // Allocate fixed-size ring buffers (replaces any previous allocation)
    this._capacity  = capacity;
    this._x         = new Float32Array(capacity);
    this._y         = new Float32Array(capacity);
    this._sizeArr   = new Float32Array(capacity);
    this._color     = new Uint8Array(capacity * 4);
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
      const ageOk    = (now - oldestTs) <= this._maxAgeMs;
      const countOk  = this._count <= this._maxPoints;

      if (ageOk && countOk) break;

      // Evict oldest point
      this._tailIndex = (this._tailIndex + 1) % this._capacity;
      this._count--;
      expired++;
    }

    if (expired > 0) {
      this.emit('dataExpired', { expired, remaining: this._count });
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
        x:     this._x.subarray(0, this._count),
        y:     this._y.subarray(0, this._count),
        size:  this._sizeArr.subarray(0, this._count),
        color: this._color.subarray(0, this._count * 4),
      };
    }

    const n    = this._count;
    const tail = this._tailIndex;
    const cap  = this._capacity;

    const outX    = new Float32Array(n);
    const outY    = new Float32Array(n);
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

    return { x: outX, y: outY, size: outSize, color: outColor };
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
   */
  appendData(chunk) {
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
      x:     this._x.subarray(0, this._count),
      y:     this._y.subarray(0, this._count),
      size:  this._sizeArr.subarray(0, this._count),
      color: this._color.subarray(0, this._count * 4),
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
    this._count     = 0;
    this._headIndex = 0;
    this._tailIndex = 0;
    this._metadata.clear();
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

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

      this._x[head]         = chunk.x[i];
      this._y[head]         = chunk.y[i];
      this._sizeArr[head]   = chunk.size  ? chunk.size[i]  : 4.0;
      this._timestamps[head] = now;

      const colorBase = head * 4;
      if (chunk.color) {
        const srcBase = i * 4;
        this._color[colorBase]     = chunk.color[srcBase];
        this._color[colorBase + 1] = chunk.color[srcBase + 1];
        this._color[colorBase + 2] = chunk.color[srcBase + 2];
        this._color[colorBase + 3] = chunk.color[srcBase + 3];
      } else {
        this._color[colorBase]     = 255;
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

    const newX     = new Float32Array(newCapacity);
    const newY     = new Float32Array(newCapacity);
    const newSize  = new Float32Array(newCapacity);
    const newColor = new Uint8Array(newCapacity * 4);

    newX.set(this._x.subarray(0, this._count));
    newY.set(this._y.subarray(0, this._count));
    newSize.set(this._sizeArr.subarray(0, this._count));
    newColor.set(this._color.subarray(0, this._count * 4));

    this._x        = newX;
    this._y        = newY;
    this._sizeArr  = newSize;
    this._color    = newColor;

    this._capacity = newCapacity;
  }
}

export default DataStore;
