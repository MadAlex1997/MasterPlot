/**
 * BackendAdapter — STUB / COMMENT-ONLY
 *
 * This file documents the intended contract for a future server-side analysis
 * adapter. No production logic is implemented here.
 *
 * ---------------------------------------------------------------------------
 * MOTIVATION
 * ---------------------------------------------------------------------------
 * MasterPlot popup panels currently communicate with the main window via the
 * browser's BroadcastChannel API using the shared message envelope:
 *
 *   { type: 'TYPE_NAME', payload: { ...data } }
 *
 * A future BackendAdapter will allow the same popup UI components to be driven
 * by a remote server-side analysis process over WebSocket — with only a thin
 * transport-layer swap. The message envelope stays identical on both sides.
 *
 * ---------------------------------------------------------------------------
 * TRANSPORT SWAP DESIGN
 * ---------------------------------------------------------------------------
 * The same popup panel component can be wired to either transport:
 *
 *   Local (same browser tab):
 *     channel = new BroadcastChannel('spectrogram-filter');
 *     channel.postMessage({ type: 'FILTER_STATE', payload: { ... } });
 *
 *   Remote (server analysis process):
 *     adapter = new BackendAdapter('wss://analysis-server/session/42');
 *     adapter.send({ type: 'FILTER_STATE', payload: { ... } });
 *     adapter.onMessage = (msg) => { ... };
 *
 * Both expose: send(msg), onMessage callback, and close().
 *
 * ---------------------------------------------------------------------------
 * FUTURE CONTRACT (stubs below)
 * ---------------------------------------------------------------------------
 *
 * class BackendAdapter {
 *   constructor(url) {
 *     // Connect to a WebSocket (or SSE) backend at `url`.
 *     // The server must speak the same { type, payload } envelope.
 *     throw new Error('BackendAdapter: not implemented');
 *   }
 *
 *   // Send a message to the backend.
 *   // @param {{ type: string, payload: object }} message
 *   send(message) {
 *     throw new Error('BackendAdapter.send(): not implemented');
 *   }
 *
 *   // Assign a callback to receive incoming messages from the backend.
 *   // @type {((msg: { type: string, payload: object }) => void) | null}
 *   // onMessage = null;
 *
 *   // Close the connection and release resources.
 *   close() {
 *     throw new Error('BackendAdapter.close(): not implemented');
 *   }
 * }
 *
 * ---------------------------------------------------------------------------
 * EXPECTED MESSAGE TYPES (server-driven analysis example)
 * ---------------------------------------------------------------------------
 *
 * Direction     | Type                | Payload
 * --------------|---------------------|------------------------------------------
 * Client→Server | FILTER_APPLY        | { filterType, cutoff, q, lowFreq, highFreq }
 * Client→Server | REQUEST_SPECTROGRAM | { windowFn, fftSize }
 * Server→Client | FILTER_STATE        | { filterType, cutoff, q, lowFreq, highFreq, applied }
 * Server→Client | SPECTROGRAM_CHUNK   | { timeOffset, magnitudeRows: Float32Array[] }
 * Server→Client | ANALYSIS_RESULT     | { roiId, label, confidence }
 *
 * ---------------------------------------------------------------------------
 * ROLLING BUFFER NOTE
 * ---------------------------------------------------------------------------
 * For arbitrarily long recordings, a future enhancement would combine
 * BackendAdapter with DataStore's rolling ring buffer API (enableRolling).
 * The server streams SPECTROGRAM_CHUNK messages; the client writes them into
 * a rolling DataStore keyed on timeOffset. Segments outside the visible
 * x-range are evicted automatically via DataStore.expireIfNeeded().
 * This enables multi-hour recordings without proportional client-side memory use.
 */

// ---------------------------------------------------------------------------
// Placeholder export — prevents "empty module" lint warnings.
// Remove this line and replace with the real class when BackendAdapter is built.
// ---------------------------------------------------------------------------
export const BACKEND_ADAPTER_NOT_IMPLEMENTED = true;
