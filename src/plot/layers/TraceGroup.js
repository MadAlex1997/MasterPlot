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
const LIB_DEFAULTS = { opacity: 1.0, size: 4.0, color: [255, 255, 255, 255] };

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

export class TraceGroup {
  /**
   * @param {object} opts
   * @param {Array<number[]>} opts.palette       — Array<[R,G,B,A]>, cycled by insertion order (required)
   * @param {function}        opts.buildLayer    — (traceId, traceData, attrs, ctx) => Layer | null (required)
   * @param {object}          [opts.traceAttrs]  — { [tag]: { color?, opacity?, ...userFields } }
   * @param {object}          [opts.defaultAttrs]— { opacity?, size?, ...userFields }
   */
  constructor({ palette, buildLayer, traceAttrs = {}, defaultAttrs = {} }) {
    if (!palette || palette.length === 0) throw new Error('TraceGroup: palette is required and must be non-empty');
    if (typeof buildLayer !== 'function')  throw new Error('TraceGroup: buildLayer must be a function');

    this._palette     = palette;
    this._buildLayer  = buildLayer;
    this._traceAttrs  = { ...traceAttrs };
    this._defaultAttrs = { ...defaultAttrs };

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
  appendData({ x, y, tag, size = null }) {
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
      const t     = tag[i];
      const entry = this._traces.get(t);
      const idx   = entry.count++;
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
    this._traceAttrs[tag] = { ...(this._traceAttrs[tag] || {}), ...attrs };
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
    const entry      = this._traces.get(tag);
    const paletteColor = entry
      ? this._palette[entry.insertionIndex % this._palette.length]
      : LIB_DEFAULTS.color;

    const overrides = this._traceAttrs[tag] || {};

    return {
      ...LIB_DEFAULTS,
      ...this._defaultAttrs,
      color: paletteColor,   // palette is priority-2; overrides step below
      ...overrides,          // per-tag overrides win over palette (priority-1)
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
      id:    'trace-group',
      build: (ctx) => {
        const layers = [];
        for (const [tag, entry] of this._traces) {
          if (!entry.visible || entry.count === 0) continue;
          const attrs = this.resolveAttrs(tag);
          const layer = this._buildLayer(`trace-${tag}`, entry, attrs, ctx);
          if (layer) layers.push(layer);
        }
        return layers.length > 0 ? layers : null;
      },
    };
  }

  // ─── Internal helpers ──────────────────────────────────────────────────────

  /** @returns {TraceEntry} */
  _newEntry() {
    const cap = INITIAL_CAPACITY;
    return {
      x:              new Float32Array(cap),
      y:              new Float32Array(cap),
      size:           new Float32Array(cap),
      count:          0,
      capacity:       cap,
      version:        0,
      visible:        true,
      insertionIndex: this._traces.size,  // size before insertion = stable index
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

    const newX    = new Float32Array(cap);
    const newY    = new Float32Array(cap);
    const newSize = new Float32Array(cap);

    newX.set(entry.x.subarray(0, entry.count));
    newY.set(entry.y.subarray(0, entry.count));
    if (entry.size) newSize.set(entry.size.subarray(0, entry.count));

    entry.x        = newX;
    entry.y        = newY;
    entry.size     = newSize;
    entry.capacity = cap;
  }
}
