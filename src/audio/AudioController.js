/**
 * AudioController — unified audio management controller.
 *
 * Absorbs functionality from PlaybackController.js and the STFT/tile logic
 * previously embedded in SpectrogramExample.jsx. PlaybackController.js and
 * FilterController.js are kept unchanged for backwards compatibility until
 * the CLEANUP step.
 *
 * Responsibilities:
 *   - Load audio from ArrayBuffer (file) or direct Float32Array (generated/streamed)
 *   - Optional stateless filter bridge: setFilterFn((samples, sr) => Float32Array)
 *   - Playback: play / pause / stop / seek, with timeUpdate events at ~10 Hz
 *   - Tiled STFT: fixed-width time segments → 'tileReady' per tile → 'stftComplete'
 *   - Streaming append: last tile is recomputed on a configurable interval
 *
 * Events:
 *   'loaded'        { duration, sampleRate, samples: Float32Array }
 *   'stateChanged'  { state: 'playing'|'paused'|'stopped' }
 *   'timeUpdate'    { currentTime }   (~10 Hz during playback)
 *   'tileReady'     { tileIndex, power: Float32Array, width, height,
 *                     globalMin, globalMax, bounds: [tStart, 0, tEnd, nyquist] }
 *   'stftComplete'
 *   'streamingTick'
 */

import EventEmitter  from 'events';
import FFT           from 'fft.js';
import * as fftWindowing from 'fft-windowing';

export class AudioController extends EventEmitter {
  constructor() {
    super();

    // ── Raw sample storage ───────────────────────────────────────────────────
    this._samples    = null;   // Float32Array — raw (pre-filter) samples
    this._sampleRate = 0;

    // ── Filter bridge ────────────────────────────────────────────────────────
    this._filterFn = null;     // (samples: Float32Array, sr: number) => Float32Array | Promise<Float32Array>

    // ── Playback state ───────────────────────────────────────────────────────
    this._audioContext     = null;
    this._audioBuffer      = null;
    this._source           = null;
    this._isPlaying        = false;
    this._pauseOffset      = 0;   // seconds into buffer where we paused/stopped
    this._startContextTime = 0;   // audioContext.currentTime at last play() call
    this._startOffset      = 0;   // buffer offset at last play() call
    this._timeUpdateTimer  = null;

    // ── STFT / tiling ────────────────────────────────────────────────────────
    this._stftConfig  = null;  // { windowSize, hopSize, windowFn, tileWidthSec }

    // ── Streaming ────────────────────────────────────────────────────────────
    this._streamingInterval = 500;
    this._streamingTimer    = null;
    this._pendingAppend     = false;
  }

  // ── Getters ─────────────────────────────────────────────────────────────────

  get isPlaying()  { return this._isPlaying; }
  get sampleRate() { return this._sampleRate; }
  get duration()   { return this._samples ? this._samples.length / this._sampleRate : 0; }

  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  // ── Loading ──────────────────────────────────────────────────────────────────

  /**
   * Decode an ArrayBuffer (e.g. from FileReader or fetch) using the Web Audio API.
   * Emits 'loaded' when ready.
   */
  async loadFile(arrayBuffer) {
    // Temporary context for decoding; sampleRate unknown until decoded.
    const tmpCtx = new AudioContext();
    let decoded;
    try {
      decoded = await tmpCtx.decodeAudioData(arrayBuffer);
    } finally {
      tmpCtx.close();
    }
    const samples = decoded.getChannelData(0).slice();  // copy — ChannelData view is GC'd
    await this.loadBuffer(samples, decoded.sampleRate);
  }

  /**
   * Load from a pre-built Float32Array. Emits 'loaded' when ready.
   * @param {Float32Array} samples
   * @param {number}       sampleRate
   */
  async loadBuffer(samples, sampleRate) {
    this._stopPlayback();
    this._samples    = samples instanceof Float32Array ? samples : new Float32Array(samples);
    this._sampleRate = sampleRate;
    this._pendingAppend = false;

    // Create / reuse AudioContext matched to the sample rate.
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({ sampleRate });
    }
    await this._audioContext.resume();
    await this._rebuildAudioBuffer();

    this.emit('loaded', {
      duration:   this.duration,
      sampleRate: this._sampleRate,
      samples:    this._samples,
    });
  }

  /**
   * Append additional samples to the existing buffer (streaming mode).
   * Rebuilds the playback AudioBuffer in the background.
   * If computeSTFT() was already called, starts the streaming timer so the
   * last STFT tile is recomputed on the configured interval.
   * @param {Float32Array} newSamples
   */
  appendSamples(newSamples) {
    if (!this._samples) throw new Error('AudioController: call loadBuffer() before appendSamples()');

    const combined = new Float32Array(this._samples.length + newSamples.length);
    combined.set(this._samples);
    combined.set(newSamples, this._samples.length);
    this._samples = combined;
    this._pendingAppend = true;

    this._rebuildAudioBuffer();  // fire-and-forget

    if (this._stftConfig) this._startStreamingTimer();
  }

  // ── Filter bridge ────────────────────────────────────────────────────────────

  /**
   * Set (or clear) the stateless filter transform.
   * @param {function|null} fn  (samples: Float32Array, sr: number) => Float32Array | Promise<Float32Array>
   *
   * Bridge to FilterController:
   *   audioCtrl.setFilterFn((s, sr) => filterCtrl.applyToSamples(s, sr));
   */
  setFilterFn(fn) {
    this._filterFn = fn ?? null;
  }

  /**
   * Returns filtered samples (or raw samples if no filterFn is set).
   * The return value is always a Float32Array; may be the same reference as
   * _samples when no filter is applied.
   */
  async getFilteredSamples() {
    if (!this._samples) return null;
    if (!this._filterFn) return this._samples;
    const result = await this._filterFn(this._samples, this._sampleRate);
    return result instanceof Float32Array ? result : new Float32Array(result);
  }

  // ── Playback ─────────────────────────────────────────────────────────────────

  /** Start or resume playback. Optional offsetSec overrides saved position. */
  async play(offsetSec = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume();
    this._stopSource();

    const startAt = (offsetSec !== null) ? Math.max(0, offsetSec) : this._pauseOffset;
    if (startAt >= this.duration) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false;
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying   = false;
        this._pauseOffset = 0;
        this._stopTimeUpdate();
        this.emit('stateChanged', { state: 'stopped' });
      }
    };
    source.start(0, startAt);
    this._source           = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset      = startAt;
    this._isPlaying        = true;
    this._startTimeUpdate();
    this.emit('stateChanged', { state: 'playing' });
  }

  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this._stopTimeUpdate();
    this.emit('stateChanged', { state: 'paused' });
  }

  stop() {
    this._stopPlayback();
    this.emit('stateChanged', { state: 'stopped' });
  }

  /** Jump to a time position; resumes playback if it was already playing. */
  seek(timeSec) {
    const clipped    = Math.max(0, Math.min(timeSec, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) { this._stopSource(); this._isPlaying = false; this._stopTimeUpdate(); }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);
    else this.emit('stateChanged', { state: 'paused' });
  }

  // ── STFT / Tile generation ───────────────────────────────────────────────────

  /**
   * Compute the STFT in fixed-width time tiles. Emits 'tileReady' for each tile,
   * then 'stftComplete' when all tiles are done. If appendSamples() is called
   * afterward, the streaming timer recomputes the last tile automatically.
   *
   * @param {object} opts
   * @param {number} [opts.windowSize=1024]  — FFT window size (power of 2)
   * @param {number} [opts.hopSize]          — frame hop (default windowSize/2)
   * @param {string} [opts.windowFn='hann']  — 'hann'|'hamming'|'blackman'|'rectangular'
   * @param {number} [opts.tileWidthSec=30]  — seconds per tile
   */
  async computeSTFT({ windowSize = 1024, hopSize, windowFn = 'hann', tileWidthSec = 30 } = {}) {
    if (!this._samples || this._samples.length === 0) return;

    const hop = hopSize ?? windowSize / 2;

    // Persist config so the streaming timer can recompute the last tile.
    this._stftConfig = { windowSize, hopSize: hop, windowFn, tileWidthSec };

    const samples        = await this.getFilteredSamples();
    const nyquist        = this._sampleRate / 2;
    const samplesPerTile = Math.round(tileWidthSec * this._sampleRate);
    const numTiles       = Math.ceil(samples.length / samplesPerTile);

    for (let t = 0; t < numTiles; t++) {
      const sampleStart = t * samplesPerTile;
      const sampleEnd   = Math.min(sampleStart + samplesPerTile, samples.length);
      const tStart      = t * tileWidthSec;
      const tEnd        = sampleEnd / this._sampleRate;

      const tileSamples = samples.subarray(sampleStart, sampleEnd);
      const result      = this._computeTileSTFT(tileSamples, windowSize, hop, windowFn);
      if (!result) continue;

      this.emit('tileReady', {
        tileIndex:  t,
        power:      result.power,
        width:      result.numFrames,
        height:     result.numBins,
        globalMin:  result.globalMin,
        globalMax:  result.globalMax,
        bounds:     [tStart, 0, tEnd, nyquist],
      });
    }

    this.emit('stftComplete');

    // If samples were already appended before computeSTFT was called, kick off timer.
    if (this._pendingAppend) this._startStreamingTimer();
  }

  /**
   * Set how often the streaming timer fires (ms). Default 500.
   * Takes effect on the next appendSamples() call.
   */
  setStreamingInterval(ms) {
    this._streamingInterval = ms;
  }

  // ── Lifecycle ────────────────────────────────────────────────────────────────

  destroy() {
    this._stopPlayback();
    this._stopStreamingTimer();
    this._audioContext?.close();
    this._audioContext = null;
    this._samples      = null;
    this.removeAllListeners();
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  async _rebuildAudioBuffer() {
    if (!this._samples || !this._audioContext) return;
    const buf = this._audioContext.createBuffer(1, this._samples.length, this._sampleRate);
    buf.getChannelData(0).set(this._samples);
    this._audioBuffer = buf;
  }

  /**
   * Run the radix-2 FFT over a single tile of samples.
   * Returns { power, numFrames, numBins, globalMin, globalMax } or null if too short.
   */
  _computeTileSTFT(samples, windowSize, hopSize, windowFn) {
    const numBins     = windowSize / 2;
    const numFrames   = Math.max(0, Math.floor((samples.length - windowSize) / hopSize) + 1);
    if (numFrames === 0) return null;

    const fft   = new FFT(windowSize);
    const out   = fft.createComplexArray();
    const frame = new Float32Array(windowSize);
    const power = new Float32Array(numFrames * numBins);

    let globalMin =  Infinity;
    let globalMax = -Infinity;

    for (let f = 0; f < numFrames; f++) {
      const offset = f * hopSize;
      for (let i = 0; i < windowSize; i++) frame[i] = samples[offset + i] || 0;

      if (windowFn !== 'rectangular' && typeof fftWindowing[windowFn] === 'function') {
        fftWindowing[windowFn](frame);  // mutates frame in-place
      }

      fft.realTransform(out, frame);

      for (let bin = 0; bin < numBins; bin++) {
        const re  = out[bin * 2];
        const im  = out[bin * 2 + 1];
        const mag = Math.sqrt(re * re + im * im) / windowSize;
        const db  = 20 * Math.log10(Math.max(mag, 1e-10));
        // Row-major layout with Y-flip so _buildBitmapFromGrid produces the
        // correct orientation when luma.gl uploads with UNPACK_FLIP_Y_WEBGL:
        //   bin 0 (DC, 0 Hz)  → last image row  → texture v=0 → worldY=0 (bottom) ✓
        //   bin numBins-1     → first image row  → texture v=1 → worldY=nyquist (top) ✓
        //   frame f (time)    → column f                                               ✓
        power[(numBins - 1 - bin) * numFrames + f] = db;
        if (db < globalMin) globalMin = db;
        if (db > globalMax) globalMax = db;
      }
    }

    return { power, numFrames, numBins, globalMin, globalMax };
  }

  /** Recompute and re-emit the last STFT tile (called from streaming timer). */
  async _recomputeLastTile() {
    if (!this._stftConfig || !this._samples) return;
    const { windowSize, hopSize, windowFn, tileWidthSec } = this._stftConfig;

    const samples        = await this.getFilteredSamples();
    const nyquist        = this._sampleRate / 2;
    const samplesPerTile = Math.round(tileWidthSec * this._sampleRate);
    const numTiles       = Math.ceil(samples.length / samplesPerTile);
    const lastIdx        = numTiles - 1;

    const sampleStart = lastIdx * samplesPerTile;
    const tStart      = lastIdx * tileWidthSec;
    const tEnd        = samples.length / this._sampleRate;

    const tileSamples = samples.subarray(sampleStart);
    const result      = this._computeTileSTFT(tileSamples, windowSize, hopSize, windowFn);
    if (!result) return;

    this.emit('tileReady', {
      tileIndex: lastIdx,
      power:     result.power,
      width:     result.numFrames,
      height:    result.numBins,
      globalMin: result.globalMin,
      globalMax: result.globalMax,
      bounds:    [tStart, 0, tEnd, nyquist],
    });
  }

  _startStreamingTimer() {
    if (this._streamingTimer) return;
    this._streamingTimer = setInterval(() => {
      if (!this._pendingAppend) return;
      this._pendingAppend = false;
      this._recomputeLastTile();  // async — fire-and-forget
      this.emit('streamingTick');
    }, this._streamingInterval);
  }

  _stopStreamingTimer() {
    if (this._streamingTimer) {
      clearInterval(this._streamingTimer);
      this._streamingTimer = null;
    }
  }

  _startTimeUpdate() {
    this._stopTimeUpdate();
    this._timeUpdateTimer = setInterval(() => {
      if (this._isPlaying) this.emit('timeUpdate', { currentTime: this.currentTime });
    }, 100);  // ~10 Hz
  }

  _stopTimeUpdate() {
    if (this._timeUpdateTimer) {
      clearInterval(this._timeUpdateTimer);
      this._timeUpdateTimer = null;
    }
  }

  _stopPlayback() {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    this._stopTimeUpdate();
  }

  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try { this._source.stop(); } catch (_) {}
      this._source.disconnect();
      this._source = null;
    }
  }
}
