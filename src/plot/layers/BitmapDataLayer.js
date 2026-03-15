/**
 * BitmapDataLayer — deck.gl CompositeLayer that renders any 2D image or numeric
 * array as a spatially positioned BitmapLayer inside a PlotController.
 *
 * Supports source types:
 *   URL string             → passed directly to BitmapLayer (deck.gl fetches)
 *   ImageBitmap            → passed directly
 *   ImageData              → passed directly
 *   HTMLCanvasElement      → passed directly
 *   TypedArray             → CPU-colorized via _buildBitmapFromGrid (requires width + height props)
 *
 * Props:
 *   source        {string|ImageBitmap|ImageData|HTMLCanvasElement|TypedArray}
 *   bitMapping    {{ bounds:[l,b,r,t] } | { origin:[x0,y0], scale:[dx,dy] }}  — EXCLUSIVE
 *                 bounds  → [left, bottom, right, top] in data space
 *                 origin+scale → bounds computed as [x0, y0, x0+dx*w, y0+dy*h]
 *   width         {number}  — image width  in pixels; required for TypedArray sources
 *                             and for bitMapping.origin+scale
 *   height        {number}  — image height in pixels; same requirements as width
 *   channels      {string}  — 'gray' | 'rgb' | 'rgba' | 'gray+alpha'  (default: 'rgba')
 *   dtype         {string}  — 'float32'|'float64'|'uint8'|'uint16'|'int16'|'int32'
 *                             (default: 'uint8')
 *   lutController {object|null}  — duck-typed { getLUTArray(), state:{level_min,level_max} };
 *                                  applies LUT to single-channel (gray) TypedArray sources
 *   dataTrigger   {number}  — increment to force re-upload + re-colorize  (default: 0)
 *   colorTrigger  {number}  — increment to force recolorization only      (default: 0)
 *   maxArrayPixels {number} — pixel count cap for TypedArray sources       (default: 16_777_216)
 *
 * Usage example:
 *   myLutCtrl.on('levelChanged', () => { colorTriggerRef.current++; ctrl.markDirty(); });
 *
 *   ctrl.registerDataLayer('heatmap', () =>
 *     new BitmapDataLayer({
 *       source:       myFloat32Array,
 *       bitMapping:   { bounds: [0, 0, 100, 50] },
 *       channels:     'gray',
 *       dtype:        'float32',
 *       width:        512,
 *       height:       256,
 *       lutController: myLutCtrl,
 *       dataTrigger:  dataTriggerRef.current,
 *       colorTrigger: colorTriggerRef.current,
 *     })
 *   );
 */

import { CompositeLayer } from '@deck.gl/core';
import { BitmapLayer }    from '@deck.gl/layers';
import { buildBitmapFromGrid } from './_buildBitmapFromGrid.js';

const DEFAULT_MAX_ARRAY_PIXELS = 16_777_216; // 4096 × 4096

export class BitmapDataLayer extends CompositeLayer {
  initializeState() {
    // undefined = not yet resolved; null = resolved to empty (invalid/null source)
    this.setState({ image: undefined });
  }

  updateState({ props, oldProps }) {
    const firstRender  = this.state.image === undefined;
    const dataChanged  = props.dataTrigger  !== oldProps.dataTrigger;
    const colorChanged = props.colorTrigger !== oldProps.colorTrigger;

    if (!firstRender && !dataChanged && !colorChanged) return;

    this.setState({ image: this._resolveSource(props) });
  }

  // ── Source resolution ───────────────────────────────────────────────────────

  _resolveSource(props) {
    const { source, channels, dtype, lutController, maxArrayPixels, width, height } = props;

    if (source == null) return null;

    // URL string: pass directly to BitmapLayer (deck.gl handles fetch)
    if (typeof source === 'string') return source;

    // Native image types: pass directly (no CPU work needed)
    if (
      source instanceof ImageBitmap ||
      source instanceof ImageData   ||
      source instanceof HTMLCanvasElement ||
      (typeof HTMLImageElement !== 'undefined' && source instanceof HTMLImageElement)
    ) {
      return source;
    }

    // TypedArray: CPU colorize via _buildBitmapFromGrid
    if (ArrayBuffer.isView(source)) {
      if (!width || !height) {
        console.warn('BitmapDataLayer: width and height props are required for TypedArray sources');
        return null;
      }

      const cap = maxArrayPixels ?? DEFAULT_MAX_ARRAY_PIXELS;
      if (width * height > cap) {
        console.warn(
          `BitmapDataLayer: TypedArray source (${width}×${height} = ${width * height} px) ` +
          `exceeds maxArrayPixels=${cap} — layer will not render`
        );
        return null;
      }

      return buildBitmapFromGrid(source, width, height, channels, dtype, lutController);
    }

    console.warn('BitmapDataLayer: unsupported source type', typeof source);
    return null;
  }

  // ── Bounds resolution ───────────────────────────────────────────────────────

  _resolveBounds(props) {
    const { bitMapping, width, height } = props;

    if (!bitMapping) {
      throw new Error('BitmapDataLayer: bitMapping prop is required');
    }

    const hasBounds = bitMapping.bounds  != null;
    const hasOrigin = bitMapping.origin  != null;
    const hasScale  = bitMapping.scale   != null;

    if (hasBounds && (hasOrigin || hasScale)) {
      throw new Error(
        'BitmapDataLayer: bitMapping.bounds and bitMapping.origin/scale are mutually exclusive'
      );
    }

    if (!hasBounds && !hasOrigin) {
      throw new Error(
        'BitmapDataLayer: bitMapping must provide either bounds or origin+scale'
      );
    }

    if (hasBounds) {
      return bitMapping.bounds; // [left, bottom, right, top]
    }

    // origin + scale → compute bounds from image pixel dimensions
    if (!width || !height) {
      throw new Error(
        'BitmapDataLayer: width and height props are required when using bitMapping.origin+scale'
      );
    }
    const [x0, y0] = bitMapping.origin;
    const [dx, dy] = bitMapping.scale;
    return [x0, y0, x0 + dx * width, y0 + dy * height];
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  renderLayers() {
    const { image } = this.state;
    if (!image) return [];

    let bounds;
    try {
      bounds = this._resolveBounds(this.props);
    } catch (e) {
      console.error('BitmapDataLayer:', e.message);
      return [];
    }

    const { dataTrigger, colorTrigger } = this.props;

    return [
      new BitmapLayer(this.getSubLayerProps({
        id:     'bitmap',
        image,
        bounds,
        updateTriggers: { image: [dataTrigger, colorTrigger] },
      })),
    ];
  }
}

BitmapDataLayer.layerName = 'BitmapDataLayer';

BitmapDataLayer.defaultProps = {
  source:          { type: 'object', value: null, optional: true },
  bitMapping:      { type: 'object', value: null                  },
  width:           { type: 'number', value: 0,    optional: true  },
  height:          { type: 'number', value: 0,    optional: true  },
  channels:        { type: 'string', value: 'rgba'                },
  dtype:           { type: 'string', value: 'uint8'               },
  lutController:   { type: 'object', value: null, optional: true  },
  dataTrigger:     { type: 'number', value: 0                     },
  colorTrigger:    { type: 'number', value: 0                     },
  maxArrayPixels:  { type: 'number', value: DEFAULT_MAX_ARRAY_PIXELS },
};

export default BitmapDataLayer;
