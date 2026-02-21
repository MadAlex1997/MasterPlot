/**
 * LineLayer — deck.gl layer for rendering connected polylines.
 *
 * Uses deck.gl's PathLayer. Points are expected to be pre-ordered sequences
 * (a single connected path or multiple paths separated by a segment count array).
 *
 * This is a v1 placeholder with a simple API. Full multi-path support is v2.
 */

import { PathLayer } from '@deck.gl/layers';

/**
 * @param {object} gpuAttrs  — { x, y } Float32Arrays
 * @param {object} [opts]
 * @returns {PathLayer}
 */
export function buildLineLayer(gpuAttrs, opts = {}) {
  const { x, y } = gpuAttrs;
  const count = x.length;

  // Build a single path as array of [x,y] pairs
  // For large data sets this is less optimal; kept simple for v1
  const path = [];
  for (let i = 0; i < count; i++) {
    path.push([x[i], y[i], 0]);
  }

  return new PathLayer({
    id:           opts.id || 'masterplot-line',
    data:         [{ path }],
    getPath:      d => d.path,
    getColor:     opts.color || [100, 200, 255, 200],
    getWidth:     opts.width || 1,
    widthUnits:   'pixels',
    pickable:     false,
    ...opts.layerProps,
  });
}

export default buildLineLayer;
