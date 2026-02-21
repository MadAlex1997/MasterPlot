/**
 * LinearRegion — vertical strip ROI (defined by x1 and x2 on the x-axis).
 *
 * y1 / y2 span the full plot height; only x1 / x2 are user-controlled.
 * Can contain RectROI children; ConstraintEngine enforces that children
 * stay within the x range of this region.
 *
 * Interaction:
 *   - Click on left or right edge → resize (move that edge independently)
 *   - Click in body → move (x1 and x2 shift by same delta)
 */

import { ROIBase } from './ROIBase.js';

const EDGE_THRESHOLD_PX = 8; // screen pixels for edge hit detection

export const LR_HANDLES = {
  NONE:       'none',
  MOVE:       'move',
  LEFT_EDGE:  'left',
  RIGHT_EDGE: 'right',
};

export class LinearRegion extends ROIBase {
  /**
   * @param {object} opts
   * @param {number} opts.x1   — left edge in data coordinates
   * @param {number} opts.x2   — right edge in data coordinates
   * @param {number} [opts.y1=-Infinity]  — auto-spans full plot area
   * @param {number} [opts.y2=Infinity]
   */
  constructor(opts = {}) {
    super(opts);
    this.type = 'linearRegion';
    // y-bounds default to ±Infinity (full height)
    this.y1 = opts.y1 ?? -Infinity;
    this.y2 = opts.y2 ??  Infinity;
  }

  /**
   * Hit test: detect left edge, right edge, or body (move).
   *
   * @param {number} sx — screen x
   * @param {number} sy — screen y
   * @param {ViewportController} viewport
   * @returns {string} LR_HANDLES.*
   */
  hitTest(sx, sy, viewport) {
    if (!this.flags.visible) return LR_HANDLES.NONE;

    const x1s = viewport.dataXToScreen(this.x1);
    const x2s = viewport.dataXToScreen(this.x2);

    const { plotArea: pa } = viewport;

    // Only hit-test within y bounds of plot area
    if (sy < pa.y || sy > pa.y + pa.height) return LR_HANDLES.NONE;

    const left  = Math.min(x1s, x2s);
    const right = Math.max(x1s, x2s);

    if (Math.abs(sx - left)  < EDGE_THRESHOLD_PX) return LR_HANDLES.LEFT_EDGE;
    if (Math.abs(sx - right) < EDGE_THRESHOLD_PX) return LR_HANDLES.RIGHT_EDGE;
    if (sx > left && sx < right) return LR_HANDLES.MOVE;

    return LR_HANDLES.NONE;
  }

  /**
   * Apply a data-space delta based on the active handle.
   * @param {string} handle
   * @param {number} dx
   */
  applyDelta(handle, dx) {
    switch (handle) {
      case LR_HANDLES.MOVE:
        this.x1 += dx;
        this.x2 += dx;
        break;
      case LR_HANDLES.LEFT_EDGE:
        this.x1 += dx;
        if (this.x1 > this.x2) this.x1 = this.x2;
        break;
      case LR_HANDLES.RIGHT_EDGE:
        this.x2 += dx;
        if (this.x2 < this.x1) this.x2 = this.x1;
        break;
      default:
        break;
    }
    this.emit('onUpdate', { roi: this, bounds: this.getBounds() });
  }
}

export default LinearRegion;
