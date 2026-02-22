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

import { ExternalROIAdapter } from './ExternalROIAdapter.js';

const DEFAULT_KEY = 'masterplot_rois';

export class MockROIAdapter extends ExternalROIAdapter {
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

export default MockROIAdapter;
