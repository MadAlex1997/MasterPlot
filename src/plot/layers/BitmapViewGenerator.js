/**
 * BitmapViewGenerator — Viewport-aware controller that re-generates or
 * re-fetches a BitmapDataLayer whenever the visible domain changes.
 *
 * Decouples "what resolution to request" from "how to render it."
 * Works for both local generation (STFT resampling, heatmap downsampling)
 * and remote API fetches (pass domain bounds + pixel dimensions as query params).
 *
 * Constructor: new BitmapViewGenerator(plotController, opts)
 *
 * opts:
 *   layerId        {string}          — ID passed to plotController.registerDataLayer()
 *   generate       {async fn}        — local generator; exactly one of generate/fetch required
 *   fetch          {async fn}        — remote fetcher; mutually exclusive with generate
 *   debounceMs     {number}   150    — delay after domainChanged before firing
 *   channels       {string}   'gray' — forwarded to BitmapDataLayer
 *   dtype          {string}   'float32' — forwarded to BitmapDataLayer
 *   lutController  {object|null} null — forwarded to BitmapDataLayer
 *   initialBitMapping {object|null} null — starting bitMapping; prevents empty first frame
 *
 * Request object passed to both callbacks:
 *   { xMin, xMax, yMin, yMax, widthPx, heightPx, pixelsPerUnitX, pixelsPerUnitY }
 *
 * generate(request) → { source, width, height, bitMapping? }
 *   - bitMapping defaults to { bounds: [xMin, yMin, xMax, yMax] } if omitted
 *
 * fetch(request, signal) → Promise<{ source, width, height, bitMapping? }>
 *   - signal is an AbortSignal; pass to fetch() calls to cancel stale inflight requests
 *
 * Events: 'requestStart', 'requestComplete', 'requestError'
 */

import { EventEmitter } from 'events';
import { BitmapDataLayer } from './BitmapDataLayer.js';

export class BitmapViewGenerator extends EventEmitter {
  /**
   * @param {import('../PlotController.js').PlotController} plotController
   * @param {object} opts
   */
  constructor(plotController, opts = {}) {
    super();

    if (!opts.layerId) throw new Error('BitmapViewGenerator: opts.layerId is required');
    if (!opts.generate && !opts.fetch) {
      throw new Error('BitmapViewGenerator: exactly one of opts.generate or opts.fetch is required');
    }
    if (opts.generate && opts.fetch) {
      throw new Error('BitmapViewGenerator: opts.generate and opts.fetch are mutually exclusive');
    }

    this._ctrl       = plotController;
    this._layerId    = opts.layerId;
    this._generateFn = opts.generate  || null;
    this._fetchFn    = opts.fetch     || null;
    this._debounceMs = opts.debounceMs ?? 150;

    // Internal layer state — closed over by the registered build fn
    this._layerState = {
      source:        null,
      width:         0,
      height:        0,
      bitMapping:    opts.initialBitMapping || null,
      channels:      opts.channels      || 'gray',
      dtype:         opts.dtype         || 'float32',
      lutController: opts.lutController || null,
      dataTrigger:   0,
      colorTrigger:  0,
    };

    // Stale-result detection (generate mode)
    this._seqId = 0;

    // Inflight abort controller (fetch mode)
    this._abortController = null;

    // Debounce timer
    this._debounceTimer = null;

    // Register the layer
    this._ctrl.registerDataLayer(this._layerId, () => this._buildLayer());

    // Subscribe to domainChanged
    this._onDomainChanged = () => this._scheduleTick();
    this._ctrl.on('domainChanged', this._onDomainChanged);

    // Trigger an initial request immediately if we have initialBitMapping
    // (so the canvas isn't empty on first frame)
    this._scheduleTick();
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  _buildLayer() {
    const s = this._layerState;
    if (!s.source || !s.bitMapping) return null;
    return new BitmapDataLayer({
      id:           this._layerId,
      source:       s.source,
      bitMapping:   s.bitMapping,
      width:        s.width,
      height:       s.height,
      channels:     s.channels,
      dtype:        s.dtype,
      lutController: s.lutController,
      dataTrigger:  s.dataTrigger,
      colorTrigger: s.colorTrigger,
    });
  }

  _getRequest() {
    const pa = this._ctrl.viewport.plotArea;
    const widthPx  = Math.max(1, Math.round(pa.width));
    const heightPx = Math.max(1, Math.round(pa.height));

    const [xMin, xMax] = this._ctrl.xAxis.getDomain();
    const [yMin, yMax] = this._ctrl.yAxis.getDomain();

    const xSpan = xMax - xMin || 1;
    const ySpan = yMax - yMin || 1;

    return {
      xMin, xMax, yMin, yMax,
      widthPx, heightPx,
      pixelsPerUnitX: widthPx  / xSpan,
      pixelsPerUnitY: heightPx / ySpan,
    };
  }

  _scheduleTick() {
    if (this._debounceTimer !== null) clearTimeout(this._debounceTimer);
    this._debounceTimer = setTimeout(() => {
      this._debounceTimer = null;
      this._fire();
    }, this._debounceMs);
  }

  async _fire() {
    const request = this._getRequest();

    this.emit('requestStart', { request });
    const t0 = performance.now();

    if (this._generateFn) {
      await this._fireGenerate(request, t0);
    } else {
      await this._fireFetch(request, t0);
    }
  }

  async _fireGenerate(request, t0) {
    const seqId = ++this._seqId;

    let result;
    try {
      result = await this._generateFn(request);
    } catch (err) {
      this.emit('requestError', { request, error: err });
      return;
    }

    // Discard stale results
    if (seqId !== this._seqId) return;

    this._applyResult(result, request);
    this.emit('requestComplete', { request, durationMs: performance.now() - t0 });
  }

  async _fireFetch(request, t0) {
    // Abort previous inflight request
    if (this._abortController) {
      this._abortController.abort();
    }
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    let result;
    try {
      result = await this._fetchFn(request, signal);
    } catch (err) {
      if (err.name === 'AbortError') return; // stale — silently ignore
      this.emit('requestError', { request, error: err });
      return;
    }

    this._applyResult(result, request);
    this.emit('requestComplete', { request, durationMs: performance.now() - t0 });
  }

  _applyResult(result, request) {
    if (!result) return;

    const bitMapping = result.bitMapping ?? {
      bounds: [request.xMin, request.yMin, request.xMax, request.yMax],
    };

    this._layerState.source      = result.source;
    this._layerState.width       = result.width;
    this._layerState.height      = result.height;
    this._layerState.bitMapping  = bitMapping;
    this._layerState.dataTrigger++;

    this._ctrl.markDirty();
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  /**
   * Update the lutController forwarded to BitmapDataLayer.
   * Call markDirty() on the plotController after this if you want an immediate repaint.
   * @param {object|null} lutController
   */
  setLutController(lutController) {
    this._layerState.lutController = lutController;
  }

  /**
   * Increment colorTrigger and schedule a markDirty() on the plotController.
   * Use this when the LUT colormap or levels change but the underlying data has not —
   * it forces BitmapDataLayer to re-colorize without re-running the generate/fetch fn.
   */
  bumpColorTrigger() {
    this._layerState.colorTrigger++;
    this._ctrl.markDirty();
  }

  /**
   * Force an immediate re-request (bypassing the debounce).
   */
  refresh() {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    this._fire();
  }

  /**
   * Unsubscribes from plotController, aborts any pending request, clears debounce timer.
   */
  destroy() {
    if (this._debounceTimer !== null) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
    if (this._abortController) {
      this._abortController.abort();
      this._abortController = null;
    }
    this._ctrl.off('domainChanged', this._onDomainChanged);
    this._ctrl.unregisterDataLayer(this._layerId);
    this.removeAllListeners();
  }
}

export default BitmapViewGenerator;
