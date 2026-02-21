/**
 * DataStore — GPU-friendly buffer management for large point datasets.
 *
 * Buffer Append Strategy:
 * Rather than reallocating every time new data arrives, DataStore maintains
 * over-allocated typed arrays and expands them by 1.5x only when capacity is
 * exhausted. This keeps GC pauses to a minimum and allows GPU attribute
 * updates to use subarray views without copying the entire buffer.
 *
 * Memory layout: parallel typed arrays for x, y, size (Float32Array) and
 * color (Uint8Array, 4 bytes per point = RGBA).
 */

const INITIAL_CAPACITY = 65536;   // 64k points to start
const GROWTH_FACTOR    = 1.5;     // grow 50% when full

export class DataStore {
  constructor(initialCapacity = INITIAL_CAPACITY) {
    this._capacity = initialCapacity;
    this._count    = 0;

    // Allocate parallel GPU-ready typed arrays
    this._x     = new Float32Array(this._capacity);
    this._y     = new Float32Array(this._capacity);
    this._size  = new Float32Array(this._capacity);
    this._color = new Uint8Array(this._capacity * 4);   // RGBA per point

    // Per-point JS metadata (not GPU); keyed by numeric index
    this._metadata = new Map();
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

    // Grow buffers if needed — expand until we have capacity
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
        this._size.set(chunk.size, base);
      } else {
        for (let i = 0; i < incoming; i++) this._size[base + i] = chunk.size[i];
      }
    } else {
      this._size.fill(4.0, base, base + incoming);
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
   * Return GPU-ready buffer views (subarray covering only populated data).
   * These are live views — no copy is made.
   *
   * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
   */
  getGPUAttributes() {
    return {
      x:     this._x.subarray(0, this._count),
      y:     this._y.subarray(0, this._count),
      size:  this._size.subarray(0, this._count),
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
    this._count = 0;
    this._metadata.clear();
  }

  // ─── Internal ───────────────────────────────────────────────────────────────

  /**
   * Grow all buffers by GROWTH_FACTOR.
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
    newSize.set(this._size.subarray(0, this._count));
    newColor.set(this._color.subarray(0, this._count * 4));

    this._x     = newX;
    this._y     = newY;
    this._size  = newSize;
    this._color = newColor;

    this._capacity = newCapacity;
  }
}

export default DataStore;
