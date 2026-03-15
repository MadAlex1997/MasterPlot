/**
 * _buildBitmapFromGrid — CPU colorization utility for typed-array bitmap sources.
 *
 * Extracted from SpectrogramLayer.buildImage; generalized for BitmapDataLayer.
 *
 * Supported channel/dtype combinations:
 *   channels='rgba',       dtype='uint8'       → direct RGBA copy
 *   channels='rgb',        dtype='uint8'       → RGB + alpha=255
 *   channels='gray+alpha', dtype='uint8'       → interleaved gray+alpha → RGBA
 *   channels='gray',       dtype=float or int  → colorize via lutController (Viridis fallback)
 *
 * @param {TypedArray}  source        — flat pixel data
 * @param {number}      width         — image width in pixels
 * @param {number}      height        — image height in pixels
 * @param {string}      channels      — 'gray' | 'rgb' | 'rgba' | 'gray+alpha'
 * @param {string}      dtype         — 'float32'|'float64'|'uint8'|'uint16'|'int16'|'int32'
 * @param {object|null} lutController — duck-typed { getLUTArray(), state: { level_min, level_max } }
 * @returns {ImageBitmap|HTMLCanvasElement}
 */

// Viridis LUT stops (16 evenly-spaced) — standalone fallback when no lutController is provided
const VIRIDIS = [
  [ 68,  1,  84], [ 72, 25, 107], [ 64, 47, 124], [ 55, 68, 134],
  [ 45, 88, 140], [ 38,107, 143], [ 33,126, 145], [ 30,145, 146],
  [ 32,163, 144], [ 47,181, 138], [ 73,198, 128], [106,214, 114],
  [145,228,  97], [185,240,  74], [223,249,  47], [253,231,  37],
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

export function buildBitmapFromGrid(source, width, height, channels, dtype, lutController) {
  const pixelCount = width * height;
  const imgData    = new ImageData(width, height);
  const d          = imgData.data;

  if (channels === 'rgba' && dtype === 'uint8') {
    // Direct RGBA copy — source is already packed Uint8 RGBA
    d.set(source.subarray(0, pixelCount * 4));

  } else if (channels === 'rgb' && dtype === 'uint8') {
    for (let i = 0; i < pixelCount; i++) {
      d[i * 4]     = source[i * 3];
      d[i * 4 + 1] = source[i * 3 + 1];
      d[i * 4 + 2] = source[i * 3 + 2];
      d[i * 4 + 3] = 255;
    }

  } else if (channels === 'gray+alpha' && dtype === 'uint8') {
    for (let i = 0; i < pixelCount; i++) {
      const v      = source[i * 2];
      d[i * 4]     = v;
      d[i * 4 + 1] = v;
      d[i * 4 + 2] = v;
      d[i * 4 + 3] = source[i * 2 + 1];
    }

  } else {
    // 'gray' channel with any dtype: colorize via LUT (or Viridis fallback)
    const lut      = lutController ? lutController.getLUTArray()     : null;
    let   rangeMin = lutController ? lutController.state.level_min   : null;
    let   rangeMax = lutController ? lutController.state.level_max   : null;

    // When no lutController, auto-range from data min/max
    if (rangeMin == null || rangeMax == null) {
      let lo =  Infinity;
      let hi = -Infinity;
      for (let i = 0; i < pixelCount; i++) {
        if (source[i] < lo) lo = source[i];
        if (source[i] > hi) hi = source[i];
      }
      rangeMin = lo;
      rangeMax = hi;
    }

    const range = (rangeMax - rangeMin) || 1;

    for (let i = 0; i < pixelCount; i++) {
      const t = Math.max(0, Math.min(1, (source[i] - rangeMin) / range));
      let r, g, b;
      if (lut) {
        const li = Math.min(255, Math.floor(t * 255)) * 4;
        r = lut[li]; g = lut[li + 1]; b = lut[li + 2];
      } else {
        [r, g, b] = viridisColor(t);
      }
      d[i * 4]     = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = 255;
    }
  }

  // Render into a canvas and return ImageBitmap for reliable BitmapLayer support.
  // OffscreenCanvas preferred (no DOM dependency); regular canvas as fallback.
  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(width, height);
  } else {
    canvas        = document.createElement('canvas');
    canvas.width  = width;
    canvas.height = height;
  }

  const ctx = canvas.getContext('2d');
  ctx.putImageData(imgData, 0, 0);

  if (canvas.transferToImageBitmap) {
    return canvas.transferToImageBitmap();
  }
  return canvas; // HTMLCanvasElement fallback (luma.gl 8.5.x accepts this)
}
