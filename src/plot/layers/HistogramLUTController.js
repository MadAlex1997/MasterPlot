/**
 * HistogramLUTController — pure JS EventEmitter (no React) that manages:
 *   - LUT colormap selection (viridis, grayscale, plasma, inferno, magma, hot)
 *   - level_min / level_max contrast windowing
 *   - Amplitude histogram computation from spectrogram dB power data
 *
 * Used by SpectrogramLayer (calls setSpectrogramData()) and rendered by
 * HistogramLUTPanel (listens to events).
 */

import EventEmitter from 'events';

// LUT preset control points: [t, r, g, b], t in [0, 1]
const LUT_PRESETS = {
  viridis:  [[0,68,1,84],[1/15,72,25,107],[2/15,64,47,124],[3/15,55,68,134],
             [4/15,45,88,140],[5/15,38,107,143],[6/15,33,126,145],[7/15,30,145,146],
             [8/15,32,163,144],[9/15,47,181,138],[10/15,73,198,128],[11/15,106,214,114],
             [12/15,145,228,97],[13/15,185,240,74],[14/15,223,249,47],[1,253,231,37]],
  grayscale:[[0,0,0,0],[1,255,255,255]],
  plasma:   [[0,13,8,135],[0.25,126,3,168],[0.5,204,71,120],[0.75,248,150,64],[1,240,249,33]],
  inferno:  [[0,0,0,4],[0.25,87,16,110],[0.5,188,55,84],[0.75,249,142,9],[1,252,255,164]],
  magma:    [[0,0,0,4],[0.25,79,18,123],[0.5,183,55,121],[0.75,251,136,97],[1,252,253,191]],
  hot:      [[0,0,0,0],[0.33,255,0,0],[0.67,255,255,0],[1,255,255,255]],
};

function buildLUT(stops) {
  // Interpolates control points into Uint8Array[256 * 4] (RGBA)
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // Find adjacent stops
    let s0 = stops[0], s1 = stops[1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j + 1][0]) { s0 = stops[j]; s1 = stops[j + 1]; break; }
    }
    const f = s1[0] === s0[0] ? 0 : (t - s0[0]) / (s1[0] - s0[0]);
    lut[i * 4]     = Math.round(s0[1] + f * (s1[1] - s0[1]));
    lut[i * 4 + 1] = Math.round(s0[2] + f * (s1[2] - s0[2]));
    lut[i * 4 + 2] = Math.round(s0[3] + f * (s1[3] - s0[3]));
    lut[i * 4 + 3] = 255;
  }
  return lut;
}

export class HistogramLUTController extends EventEmitter {
  constructor(binCount = 256) {
    super();
    this._binCount    = binCount;
    this._power       = null;   // Float32Array of dB values (flat, frames×bins)
    this._isFirstData = true;
    this.state = {
      level_min:      -100,
      level_max:      0,
      lut:            buildLUT(LUT_PRESETS.viridis),
      lutName:        'viridis',
      histogramBins:  null,    // Float32Array[binCount] raw counts
      histogramEdges: null,    // Float32Array[binCount+1] bin boundaries
      globalMin:      -100,
      globalMax:      0,
    };
  }

  /** Called by SpectrogramLayer.updateState() after each STFT. Synchronous. */
  setSpectrogramData(power, globalMin, globalMax) {
    this._power = power;
    this.state.globalMin = globalMin;
    this.state.globalMax = globalMax;
    this._computeHistogram();
    this.emit('histogramReady', {
      bins:      this.state.histogramBins,
      edges:     this.state.histogramEdges,
      globalMin,
      globalMax,
    });
    if (this._isFirstData) {
      this._isFirstData = false;
      // autoLevel emits levelsChanged — acceptable on first data
      this.autoLevel();
    }
  }

  _computeHistogram() {
    const { globalMin, globalMax } = this.state;
    const power = this._power;
    const n     = this._binCount;
    const range = (globalMax - globalMin) || 1;
    const bins  = new Float32Array(n);
    const edges = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) edges[i] = globalMin + (i / n) * range;
    for (let i = 0; i < power.length; i++) {
      const idx = Math.min(n - 1, Math.floor((power[i] - globalMin) / range * n));
      if (idx >= 0) bins[idx]++;
    }
    this.state.histogramBins  = bins;
    this.state.histogramEdges = edges;
  }

  setLevels(min, max) {
    this.state.level_min = min;
    this.state.level_max = max;
    this.emit('levelsChanged', min, max);
  }

  setLUT(presetName) {
    const stops = LUT_PRESETS[presetName];
    if (!stops) return;
    this.state.lut     = buildLUT(stops);
    this.state.lutName = presetName;
    this.emit('lutChanged', presetName);
  }

  autoLevel(loPct = 5, hiPct = 99.5) {
    const { histogramBins, histogramEdges } = this.state;
    if (!histogramBins) return;
    const total    = histogramBins.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const loTarget = total * loPct / 100;
    const hiTarget = total * hiPct / 100;
    let cumsum = 0;
    let level_min = histogramEdges[0];
    let level_max = histogramEdges[histogramEdges.length - 1];
    let minSet = false;
    for (let i = 0; i < histogramBins.length; i++) {
      cumsum += histogramBins[i];
      if (!minSet && cumsum >= loTarget) { level_min = histogramEdges[i]; minSet = true; }
      if (cumsum >= hiTarget)            { level_max = histogramEdges[i + 1]; break; }
    }
    this.setLevels(level_min, level_max);
  }

  getLUTArray() { return this.state.lut; }

  reset() { this._isFirstData = true; this._power = null; }

  static get presetNames() { return Object.keys(LUT_PRESETS); }
}
