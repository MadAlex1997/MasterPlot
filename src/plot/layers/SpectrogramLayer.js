/**
 * SpectrogramLayer — deck.gl CompositeLayer that computes an STFT from raw
 * audio samples and renders the result as a BitmapLayer.
 *
 * Pipeline (CPU, runs when props change):
 *   1. STFT via fft.js (Hann window, radix-2 FFT per frame)
 *   2. Magnitude → dB, then global min/max normalisation
 *   3. Colour via LUT (from lutController if provided, else Viridis fallback)
 *   4. ImageData written into an OffscreenCanvas (or regular canvas)
 *   5. BitmapLayer renders the canvas with bounds in data space
 *
 * Props:
 *   samples       {Float32Array}              — raw time-domain samples
 *   sampleRate    {number}                    — samples per second (e.g. 44100)
 *   windowSize    {number}                    — FFT window size, power of 2 (default 1024)
 *   hopSize       {number}                    — hop between windows (default windowSize/2)
 *   dataTrigger   {number}                    — increment to force STFT recompute + re-upload
 *   lutController {HistogramLUTController}    — optional; if provided, uses its levels + LUT
 *   colorTrigger  {number}                    — increment to force image rebuild without STFT
 */

import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer }    from '@deck.gl/layers';
import FFT                from 'fft.js';

// ── Viridis LUT (16 evenly-spaced stops) — used as standalone fallback ───────

const VIRIDIS = [
  [68,  1,  84],
  [72,  25, 107],
  [64,  47, 124],
  [55,  68, 134],
  [45,  88, 140],
  [38, 107, 143],
  [33, 126, 145],
  [30, 145, 146],
  [32, 163, 144],
  [47, 181, 138],
  [73, 198, 128],
  [106, 214, 114],
  [145, 228,  97],
  [185, 240,  74],
  [223, 249,  47],
  [253, 231,  37],
];

function viridisColor(t) {
  const n = VIRIDIS.length - 1;
  const i = Math.min(Math.floor(t * n), n - 1);
  const f = t * n - i;
  const c0 = VIRIDIS[i];
  const c1 = VIRIDIS[i + 1];
  return [
    Math.round(c0[0] + f * (c1[0] - c0[0])),
    Math.round(c0[1] + f * (c1[1] - c0[1])),
    Math.round(c0[2] + f * (c1[2] - c0[2])),
  ];
}

// ── STFT ─────────────────────────────────────────────────────────────────────

function computeSTFT(samples, windowSize, hopSize) {
  const numBins   = windowSize / 2;
  const numFrames = Math.max(0, Math.floor((samples.length - windowSize) / hopSize) + 1);

  if (numFrames === 0) return null;

  // Pre-compute Hann window
  const hann = new Float32Array(windowSize);
  for (let i = 0; i < windowSize; i++) {
    hann[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (windowSize - 1)));
  }

  const fft      = new FFT(windowSize);
  const out      = fft.createComplexArray();
  const windowed = new Float32Array(windowSize);
  const power    = new Float32Array(numFrames * numBins);  // dB values

  let globalMin =  Infinity;
  let globalMax = -Infinity;

  for (let frame = 0; frame < numFrames; frame++) {
    const offset = frame * hopSize;

    // Apply Hann window
    for (let i = 0; i < windowSize; i++) {
      windowed[i] = samples[offset + i] * hann[i];
    }

    fft.realTransform(out, windowed);

    // Compute dB magnitude for each positive-frequency bin
    for (let bin = 0; bin < numBins; bin++) {
      const re  = out[bin * 2];
      const im  = out[bin * 2 + 1];
      const mag = Math.sqrt(re * re + im * im) / windowSize;
      const db  = 20 * Math.log10(Math.max(mag, 1e-10));
      power[frame * numBins + bin] = db;
      if (db < globalMin) globalMin = db;
      if (db > globalMax) globalMax = db;
    }
  }

  return { power, numFrames, numBins, globalMin, globalMax };
}

// ── Image builder ─────────────────────────────────────────────────────────────

/**
 * Build a BitmapLayer-compatible image from STFT power data.
 *
 * @param {Float32Array} power     — flat array [numFrames × numBins] of dB values
 * @param {number}       numFrames
 * @param {number}       numBins
 * @param {number}       levelMin  — dB value that maps to LUT index 0
 * @param {number}       levelMax  — dB value that maps to LUT index 255
 * @param {Uint8Array|null} lut    — RGBA LUT (256*4 bytes); null → Viridis fallback
 */
function buildImage(power, numFrames, numBins, levelMin, levelMax, lut = null) {
  const range = (levelMax - levelMin) || 1;

  // Use OffscreenCanvas if available (no DOM needed), fall back to regular canvas
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(numFrames, numBins);
  } else {
    canvas = document.createElement('canvas');
    canvas.width  = numFrames;
    canvas.height = numBins;
  }

  const ctx     = canvas.getContext('2d');
  const imgData = ctx.createImageData(numFrames, numBins);
  const d       = imgData.data;

  for (let frame = 0; frame < numFrames; frame++) {
    for (let bin = 0; bin < numBins; bin++) {
      const db = power[frame * numBins + bin];
      const t  = Math.max(0, Math.min(1, (db - levelMin) / range));

      let r, g, b;
      if (lut) {
        const li = Math.min(255, Math.floor(t * 255)) * 4;
        r = lut[li]; g = lut[li + 1]; b = lut[li + 2];
      } else {
        [r, g, b] = viridisColor(t);  // standalone fallback
      }

      // Manual flip: bin 0 (0 Hz) → last row of ImageData.
      // luma.gl uploads with UNPACK_FLIP_Y_WEBGL: last row → texture v=0 → worldY=0
      // → visual bottom. Nyquist (bin numBins-1) → row 0 → v=1 → visual top. ✓
      const row = numBins - 1 - bin;
      const idx = (row * numFrames + frame) * 4;
      d[idx]     = r;
      d[idx + 1] = g;
      d[idx + 2] = b;
      d[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  // luma.gl 8.5.x accepts HTMLCanvasElement, HTMLImageElement, and ImageBitmap.
  // OffscreenCanvas support is unreliable at this version — convert to ImageBitmap.
  if (canvas.transferToImageBitmap) {
    return canvas.transferToImageBitmap();
  }
  return canvas;  // HTMLCanvasElement fallback
}

// ── SpectrogramLayer ──────────────────────────────────────────────────────────

export class SpectrogramLayer extends CompositeLayer {
  initializeState() {
    this.setState({ stftResult: null, image: null });
  }

  updateState({ props, oldProps }) {
    const dataChanged  = props.dataTrigger  !== oldProps.dataTrigger;
    const colorChanged = props.colorTrigger !== oldProps.colorTrigger;

    let stftResult = this.state.stftResult;

    // Recompute STFT only when data changes (or first render when stftResult is null)
    if (dataChanged || !stftResult) {
      const { samples, windowSize, hopSize } = props;
      if (samples && samples.length >= windowSize) {
        stftResult = computeSTFT(samples, windowSize, hopSize || windowSize / 2);
        this.setState({ stftResult });
        if (props.lutController && stftResult) {
          // Synchronous: sets controller levels/histogram before buildImage below
          props.lutController.setSpectrogramData(
            stftResult.power, stftResult.globalMin, stftResult.globalMax
          );
        }
      }
    }

    // Rebuild image when data OR color changes
    if ((dataChanged || colorChanged || !this.state.image) && stftResult) {
      const lc       = props.lutController;
      const levelMin = lc ? lc.state.level_min : stftResult.globalMin;
      const levelMax = lc ? lc.state.level_max : stftResult.globalMax;
      const lut      = lc ? lc.getLUTArray()   : null;  // null → Viridis fallback

      const image = buildImage(
        stftResult.power, stftResult.numFrames, stftResult.numBins,
        levelMin, levelMax, lut
      );
      this.setState({ image });
    }
  }

  renderLayers() {
    const { samples, sampleRate, dataTrigger, colorTrigger } = this.props;
    const { image } = this.state;
    if (!image || !samples) return [];

    return [
      new BitmapLayer(this.getSubLayerProps({
        id:    'bitmap',
        image,
        // bounds: [left, bottom, right, top] in world / data space
        bounds: [0, 0, samples.length / sampleRate, sampleRate / 2],
        updateTriggers: { image: [dataTrigger, colorTrigger] },
      })),
    ];
  }
}

SpectrogramLayer.layerName = 'SpectrogramLayer';

SpectrogramLayer.defaultProps = {
  samples:       { type: 'object',  value: null  },
  sampleRate:    { type: 'number',  value: 44100 },
  windowSize:    { type: 'number',  value: 1024  },
  hopSize:       { type: 'number',  value: 512   },
  dataTrigger:   { type: 'number',  value: 0     },  // increment to force re-STFT + re-upload
  lutController: { type: 'object',  value: null  },
  colorTrigger:  { type: 'number',  value: 0     },  // increment to force image rebuild only
};

export default SpectrogramLayer;
