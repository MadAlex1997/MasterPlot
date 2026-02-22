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

import { EventEmitter } from 'events';

export class PlotDataView extends EventEmitter {
  /**
   * @param {import('./DataStore').DataStore|PlotDataView} source
   * @param {((data: object) => object)|null} [transformFn]  — applied to data on recompute
   * @param {object} [opts]
   * @param {import('./ROI/ROIController').ROIController} [opts.roiController]
   */
  constructor(source, transformFn = null, opts = {}) {
    super();

    this._source        = source;
    this._transform     = transformFn;
    this._roiController = opts.roiController || null;

    this._dirty    = true;
    this._snapshot = null;

    // Bind handlers for cleanup tracking
    this._onSourceDirty  = () => this.markDirty();
    this._onRoiFinalized = () => this.markDirty();
    this._onRoiExtUpdate = () => this.markDirty();

    // Wire source events
    source.on('dirty',       this._onSourceDirty);
    source.on('dataExpired', this._onSourceDirty);

    // Wire ROI commit events; 'roiUpdated' (drag) is intentionally NOT wired
    if (this._roiController) {
      this._roiController.on('roiFinalized',     this._onRoiFinalized);
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
    const filterFn = (data) => {
      return self._filterPoints(data, (i) => {
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
    return new PlotDataView(this, filterFn, { roiController: this._roiController });
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
    const filterFn = (data) => {
      const roi = roiController.getROI(roiId);
      if (!roi) {
        // ROI not found — return all data (graceful degradation)
        return data;
      }
      const { x1, x2, y1, y2 } = roi.getBounds();
      return self._filterPoints(data, (i) => {
        return data.x[i] >= x1 && data.x[i] <= x2 &&
               data.y[i] >= y1 && data.y[i] <= y2;
      });
    };
    return new PlotDataView(this, filterFn, { roiController });
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
  histogram({ field, bins }) {
    const data = this.getData();
    const arr  = data[field];
    if (!arr) {
      throw new Error(`PlotDataView.histogram: unknown field '${field}'. Valid: x, y, size`);
    }

    const n = arr.length;
    const edges  = new Float32Array(bins + 1);
    const counts = new Float32Array(bins);

    // Find range
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < n; i++) {
      if (arr[i] < min) min = arr[i];
      if (arr[i] > max) max = arr[i];
    }

    const span = max - min;

    // Populate edges
    for (let b = 0; b <= bins; b++) {
      edges[b] = min + (b / bins) * span;
    }

    if (span === 0) {
      // All values are equal — dump into bin 0
      counts[0] = n;
      return { counts, edges };
    }

    // Populate counts
    for (let i = 0; i < n; i++) {
      let bin = Math.floor(((arr[i] - min) / span) * bins);
      if (bin >= bins) bin = bins - 1; // clamp max value into last bin
      counts[bin]++;
    }

    return { counts, edges };
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
      x:     s.x.slice(),
      y:     s.y.slice(),
      size:  s.size.slice(),
      color: s.color.slice(),
    };
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  /**
   * Remove all event listeners registered by this view.
   * Must be called when the view is no longer needed to avoid listener leaks.
   */
  destroy() {
    this._source.removeListener('dirty',       this._onSourceDirty);
    this._source.removeListener('dataExpired', this._onSourceDirty);

    if (this._roiController) {
      this._roiController.removeListener('roiFinalized',     this._onRoiFinalized);
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
    this.emit('recomputed', { count: data.x.length });
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
    const outX     = new Float32Array(count);
    const outY     = new Float32Array(count);
    const outSize  = new Float32Array(count);
    const outColor = new Uint8Array(count * 4);

    // Second pass: copy matching points
    let j = 0;
    for (let i = 0; i < n; i++) {
      if (predicate(i)) {
        outX[j]    = data.x[i];
        outY[j]    = data.y[i];
        outSize[j] = data.size[i];
        const src = i * 4;
        const dst = j * 4;
        outColor[dst]     = data.color[src];
        outColor[dst + 1] = data.color[src + 1];
        outColor[dst + 2] = data.color[src + 2];
        outColor[dst + 3] = data.color[src + 3];
        j++;
      }
    }

    return { x: outX, y: outY, size: outSize, color: outColor };
  }
}

export default PlotDataView;
