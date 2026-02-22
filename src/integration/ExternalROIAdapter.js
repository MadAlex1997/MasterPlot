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
export class ExternalROIAdapter {
  /**
   * @param {import('../plot/ROI/ROIController.js').ROIController} roiController
   */
  constructor(roiController) {
    if (!roiController) {
      throw new Error('ExternalROIAdapter: roiController is required');
    }
    this._roiController = roiController;
  }

  /**
   * Load persisted ROIs on initialisation.
   * Called once during `attach()`. Pass result to `roiController.deserializeAll()`.
   *
   * @returns {Promise<Array<{id, type, version, updatedAt, domain, metadata}>>}
   */
  async load() {
    throw new Error(
      'ExternalROIAdapter.load() must be implemented by subclass. ' +
      'Return a Promise that resolves to a SerializedROI array.'
    );
  }

  /**
   * Persist a single ROI after it has been finalized.
   * Called by `attach()` on every `roiFinalized` event.
   *
   * @param {{ id, type, version, updatedAt, domain, metadata }} serializedROI
   * @returns {Promise<void>}
   */
  async save(serializedROI) {
    throw new Error(
      'ExternalROIAdapter.save() must be implemented by subclass. ' +
      'Persist the serializedROI object to your storage backend.'
    );
  }

  /**
   * Subscribe to incoming ROI updates from external sources (e.g. other clients).
   * The engine calls `roiController.updateFromExternal(roi)` for each update.
   *
   * @param {function({ id, type, version, updatedAt, domain, metadata }): void} callback
   * @returns {function(): void} unsubscribe — call to stop receiving updates
   */
  subscribe(callback) {
    throw new Error(
      'ExternalROIAdapter.subscribe() must be implemented by subclass. ' +
      'Register the callback with your external source and return an unsubscribe function.'
    );
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
    this._unsubscribe = this.subscribe((roi) => {
      this._roiController.updateFromExternal(roi);
    });

    // User commits → save to storage
    this._onFinalized = (payload) => {
      const { roi, version, updatedAt, domain } = payload;
      this.save({
        id:        roi.id,
        type:      roi.type,
        version,
        updatedAt,
        domain,
        metadata:  roi.metadata || {},
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

export default ExternalROIAdapter;
