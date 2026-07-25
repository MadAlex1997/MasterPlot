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
export class ExternalDataAdapter {
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
        throw new Error(
          `ExternalDataAdapter: subclass must override "${method}()" — the base implementation ` +
          'only throws'
        );
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
    throw new Error(
      'ExternalDataAdapter.replaceData() must be implemented by subclass. ' +
      'Call this._dataStore.clear() then this._dataStore.appendData(bufferStruct).'
    );
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
    throw new Error(
      'ExternalDataAdapter.appendData() must be implemented by subclass. ' +
      'Call this._dataStore.appendData(bufferStruct).'
    );
  }
}

export default ExternalDataAdapter;
