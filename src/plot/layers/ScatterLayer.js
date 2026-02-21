/**
 * ScatterLayer — custom deck.gl layer for high-performance scatter plot rendering.
 *
 * Uses deck.gl's ScatterplotLayer under the hood but wrapped to accept our
 * DataStore GPU attribute buffers directly, avoiding JSON object allocation
 * per point.
 *
 * For 10M+ points we use instanced rendering via deck.gl's attribute system.
 * The data is passed as a plain object with a `length` property (duck-typed
 * iterable) and per-attribute accessors that index into our typed arrays.
 *
 * deck.gl version 8.x attribute accessors:
 *   - getPosition: [x, y] — called once per point
 *   - getColor:    [r,g,b,a]
 *   - getRadius:   number
 *
 * Performance note: Passing typed arrays directly through `data` with numeric
 * `length` allows deck.gl to use them without object-per-point overhead.
 */

import { ScatterplotLayer } from '@deck.gl/layers';

/**
 * Build a deck.gl ScatterplotLayer from DataStore GPU attributes.
 *
 * @param {object} gpuAttrs — { x, y, color, size } typed arrays
 * @param {object} [opts]
 * @returns {ScatterplotLayer}
 */
export function buildScatterLayer(gpuAttrs, opts = {}) {
  const { x, y, color, size } = gpuAttrs;
  const count = x.length;
  const xIsLog = opts.xIsLog || false;
  const yIsLog = opts.yIsLog || false;

  const data = { length: count };

  return new ScatterplotLayer({
    id:               opts.id || 'masterplot-scatter',
    data,
    radiusUnits:      'pixels',
    radiusMinPixels:  1,
    radiusMaxPixels:  30,
    pickable:         false,
    stroked:          false,

    getPosition: (_, { index }) => [
      xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
      yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index],
      0,
    ],
    getRadius: (_, { index }) => size[index] * 0.5,
    getColor:  (_, { index }) => {
      const base = index * 4;
      return [color[base], color[base + 1], color[base + 2], color[base + 3]];
    },

    updateTriggers: {
      getPosition: opts.dataTrigger || 0,
      getRadius:   opts.dataTrigger || 0,
      getColor:    opts.dataTrigger || 0,
    },

    ...opts.layerProps,
  });
}

export default buildScatterLayer;
