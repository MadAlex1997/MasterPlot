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

import { ExternalDataAdapter } from './ExternalDataAdapter.js';

export class MockDataAdapter extends ExternalDataAdapter {
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
    this._batchSize  = opts.batchSize  ?? 100;
    this._xMin       = opts.xMin       ?? 0;
    this._xMax       = opts.xMax       ?? 100;
    this._yMin       = opts.yMin       ?? 0;
    this._yMax       = opts.yMax       ?? 100;

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

      this.appendData({ x, y });
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

export default MockDataAdapter;
