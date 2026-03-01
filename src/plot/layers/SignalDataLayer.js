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
 *   ctrl.xAxis.setDomain(xDomain);
 *   ctrl.yAxis.setDomain(yDomain);
 */

import { PathLayer } from '@deck.gl/layers';

export class SignalStore {
  constructor() {
    /** @type {Map<string, { path: number[][], color: number[], layerData: object[]|null, version: number }>} */
    this._signals  = new Map();
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
      path:      [],     // mutable array of [x, y, 0] triples for PathLayer
      color,
      layerData: null,   // cached [{path, color}] — replaced on each append
      version:   0,      // incremented on append, drives deck.gl updateTriggers
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
    sig.layerData = [{ path: sig.path, color: sig.color }];
    sig.version++;
  }

  /** Advance the shared x counter by n (call after one round of appends). */
  advanceXCounter(n) { this._xCounter += n; }

  get xCounter() { return this._xCounter; }

  /**
   * Remove points from all signals where x < xMin.
   * Used to maintain a rolling time window.
   * @param {number} xMin
   */
  trimBefore(xMin) {
    for (const sig of this._signals.values()) {
      if (sig.path.length === 0) continue;

      // Binary-search first index where x >= xMin
      let lo = 0, hi = sig.path.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (sig.path[mid][0] < xMin) lo = mid + 1;
        else hi = mid;
      }

      if (lo > 0) {
        sig.path      = sig.path.slice(lo);
        sig.layerData = sig.path.length > 0 ? [{ path: sig.path, color: sig.color }] : null;
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
    let yMin = Infinity, yMax = -Infinity;

    for (const sig of this._signals.values()) {
      if (sig.path.length === 0) continue;
      xMax = Math.max(xMax, sig.path[sig.path.length - 1][0]);
      for (const pt of sig.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
    }

    if (yMin === Infinity) return { xDomain: [0, xMax], yDomain: [-1, 1] };

    const yPad = (yMax - yMin) * 0.05 || 0.1;
    return {
      xDomain: [0, xMax],
      yDomain: [yMin - yPad, yMax + yPad],
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
      sig.path      = [];
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
      id:    'signal-data',
      build: (_ctx) => {
        const layers = buildSignalLayers(this._signals);
        return layers.length > 0 ? layers : null;
      },
    };
  }
}

/**
 * Build PathLayer instances for all signals that have data.
 *
 * @param {Map} signalsMap — SignalStore._signals
 * @returns {PathLayer[]}
 */
export function buildSignalLayers(signalsMap) {
  const layers = [];
  for (const [id, sig] of signalsMap) {
    if (!sig.layerData || sig.path.length < 2) continue;
    layers.push(new PathLayer({
      id:             `line-${id}`,
      data:           sig.layerData,
      getPath:        d => d.path,
      getColor:       d => d.color,
      getWidth:       2,
      widthUnits:     'pixels',
      pickable:       false,
      updateTriggers: { getPath: sig.version },
    }));
  }
  return layers;
}
