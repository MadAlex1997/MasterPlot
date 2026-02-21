/**
 * dataGenerator — generates test point data for MasterPlot example.
 *
 * Static batch:
 *   1M random points
 *   x: linear scale, range [0, 10000]
 *   y: linear scale, range [0, 100]
 *   color: 3 bands (low/mid/high y-value), packed RGBA
 *   size: scales with y-value
 *
 * Live append chunk:
 *   10k new random points (same distribution)
 */

/**
 * Generate a batch of random scatter points.
 * @param {number} count
 * @returns {{ x: Float32Array, y: Float32Array, size: Float32Array, color: Uint8Array }}
 */
export function generatePoints(count) {
  const x     = new Float32Array(count);
  const y     = new Float32Array(count);
  const size  = new Float32Array(count);
  const color = new Uint8Array(count * 4);

  for (let i = 0; i < count; i++) {
    // x: linear in [0, 10000]
    x[i] = Math.random() * 10000;

    // y: linear in [0, 100]
    y[i] = Math.random() * 100;

    // size: proportional to y (1–8 px range)
    size[i] = 1 + (y[i] / 100) * 7;

    // color: 3 bands
    const base = i * 4;
    if (y[i] < 33) {
      // Low band → cool blue
      color[base]   = 60;
      color[base+1] = 120;
      color[base+2] = 220;
      color[base+3] = 180;
    } else if (y[i] < 66) {
      // Mid band → green
      color[base]   = 80;
      color[base+1] = 200;
      color[base+2] = 100;
      color[base+3] = 180;
    } else {
      // High band → warm orange
      color[base]   = 240;
      color[base+1] = 120;
      color[base+2] = 40;
      color[base+3] = 180;
    }
  }

  return { x, y, size, color };
}

/**
 * Generate 10k points for live append.
 * @returns {object}
 */
export function generateAppendChunk() {
  return generatePoints(10_000);
}
