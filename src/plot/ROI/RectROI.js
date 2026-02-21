/**
 * RectROI — rectangular region of interest.
 *
 * Draggable and resizable via eight handles (corners + edges).
 * Bounds are stored in data coordinates; screen conversions happen in
 * ROIController using ViewportController.
 *
 * Handle naming convention — names match VISUAL screen positions:
 *   TOP_*    = upper part of the rect on screen  = the y2 data edge (y2 > y1)
 *   BOTTOM_* = lower part of the rect on screen  = the y1 data edge
 * (y-scale is inverted: y2 maps to smaller screen-y, i.e. visually higher)
 *
 * xLocked flag:
 *   When true (set for RectROIs parented to a LinearRegion) the LEFT, RIGHT,
 *   and x-component of corner handles are suppressed.  Only vertical resizing
 *   and pure-y MOVE is allowed.  X bounds are managed entirely by the parent.
 */

import { ROIBase } from './ROIBase.js';

export const HANDLES = {
  NONE:         'none',
  MOVE:         'move',
  TOP_LEFT:     'tl',
  TOP_RIGHT:    'tr',
  BOTTOM_LEFT:  'bl',
  BOTTOM_RIGHT: 'br',
  TOP:          'tm',
  BOTTOM:       'bm',
  LEFT:         'ml',
  RIGHT:        'mr',
};

const HANDLE_SIZE_PX = 8;

export class RectROI extends ROIBase {
  constructor(opts = {}) {
    super(opts);
    this.type = 'rect';
    // When true, x1/x2 are owned by the parent LinearRegion.
    // Left/right handles are hidden and dx is ignored in applyDelta.
    this.xLocked = opts.xLocked ?? false;
  }

  /**
   * Detect which handle (if any) is under the given screen position.
   *
   * Visual layout (y-scale inverted — y2 is higher on screen than y1):
   *   TL ─ TM ─ TR      ← y2s (small screen-y, visual top)
   *   ML         MR
   *   BL ─ BM ─ BR      ← y1s (large screen-y, visual bottom)
   *
   * @param {number} sx — screen x
   * @param {number} sy — screen y
   * @param {ViewportController} viewport
   * @returns {string} — one of HANDLES.*
   */
  hitTestHandles(sx, sy, viewport) {
    if (!this.flags.visible) return HANDLES.NONE;

    const x1s = viewport.dataXToScreen(this.x1);
    const x2s = viewport.dataXToScreen(this.x2);
    // y1 < y2 in data, but y scale is inverted so y1s > y2s on screen
    const y1s = viewport.dataYToScreen(this.y1);  // visual bottom (large screen-y)
    const y2s = viewport.dataYToScreen(this.y2);  // visual top   (small screen-y)

    const h    = HANDLE_SIZE_PX;
    const midX = (x1s + x2s) / 2;
    const midY = (y1s + y2s) / 2;

    const near = (cx, cy) => Math.abs(sx - cx) <= h && Math.abs(sy - cy) <= h;

    if (this.xLocked) {
      // Only vertical resize + move allowed.
      // Corner positions redirect to pure-vertical handles.
      if (near(midX, y2s)) return HANDLES.TOP;
      if (near(midX, y1s)) return HANDLES.BOTTOM;
      // Corner hits → collapse to the matching vertical-only handle
      if (near(x1s, y2s) || near(x2s, y2s)) return HANDLES.TOP;
      if (near(x1s, y1s) || near(x2s, y1s)) return HANDLES.BOTTOM;
      // Left/right midpoint → block (no x movement)
      const inX = sx >= Math.min(x1s, x2s) && sx <= Math.max(x1s, x2s);
      const inY = sy >= Math.min(y2s, y1s) && sy <= Math.max(y2s, y1s);
      if (inX && inY) return HANDLES.MOVE;
      return HANDLES.NONE;
    }

    // Full handle set — names match visual positions:
    //   y2s is the visual TOP, y1s is the visual BOTTOM
    if (near(x1s, y2s)) return HANDLES.TOP_LEFT;
    if (near(x2s, y2s)) return HANDLES.TOP_RIGHT;
    if (near(x1s, y1s)) return HANDLES.BOTTOM_LEFT;
    if (near(x2s, y1s)) return HANDLES.BOTTOM_RIGHT;
    if (near(midX, y2s)) return HANDLES.TOP;
    if (near(midX, y1s)) return HANDLES.BOTTOM;
    if (near(x1s, midY)) return HANDLES.LEFT;
    if (near(x2s, midY)) return HANDLES.RIGHT;

    const inX = sx >= Math.min(x1s, x2s) && sx <= Math.max(x1s, x2s);
    const inY = sy >= Math.min(y2s, y1s) && sy <= Math.max(y2s, y1s);
    if (inX && inY) return HANDLES.MOVE;

    return HANDLES.NONE;
  }

  /**
   * Apply a delta to bounds based on the active handle.
   * All deltas are in DATA coordinates.
   *
   * Handle semantics (corrected to match visual positions):
   *   TOP_*    modifies y2 (the visually upper edge, y2 > y1 in data)
   *   BOTTOM_* modifies y1 (the visually lower edge)
   *
   * When xLocked, dx is silently ignored — x bounds are managed by the parent.
   *
   * @param {string} handle
   * @param {number} dx — data-space delta x
   * @param {number} dy — data-space delta y
   */
  applyDelta(handle, dx, dy) {
    const applyX = !this.xLocked;

    switch (handle) {
      case HANDLES.MOVE:
        if (applyX) { this.x1 += dx; this.x2 += dx; }
        this.y1 += dy; this.y2 += dy;
        break;
      case HANDLES.TOP_LEFT:
        if (applyX) this.x1 += dx;
        this.y2 += dy;   // TOP → y2 (visual top edge)
        break;
      case HANDLES.TOP_RIGHT:
        if (applyX) this.x2 += dx;
        this.y2 += dy;
        break;
      case HANDLES.BOTTOM_LEFT:
        if (applyX) this.x1 += dx;
        this.y1 += dy;   // BOTTOM → y1 (visual bottom edge)
        break;
      case HANDLES.BOTTOM_RIGHT:
        if (applyX) this.x2 += dx;
        this.y1 += dy;
        break;
      case HANDLES.TOP:
        this.y2 += dy;   // visual top edge = y2
        // Clamp: TOP handle must not cross below the BOTTOM edge.
        // Clamping (not swapping) prevents the confusing snap/teleport that
        // occurs when the restore-then-delta approach hits the normalization
        // swap at the crossover boundary.
        if (this.y2 < this.y1) this.y2 = this.y1;
        break;
      case HANDLES.BOTTOM:
        this.y1 += dy;   // visual bottom edge = y1
        // Clamp: BOTTOM handle must not cross above the TOP edge.
        if (this.y1 > this.y2) this.y1 = this.y2;
        break;
      case HANDLES.LEFT:
        if (applyX) this.x1 += dx;
        break;
      case HANDLES.RIGHT:
        if (applyX) this.x2 += dx;
        break;
      default:
        break;
    }

    // Normalise so x1 ≤ x2 and y1 ≤ y2
    if (this.x1 > this.x2) [this.x1, this.x2] = [this.x2, this.x1];
    if (this.y1 > this.y2) [this.y1, this.y2] = [this.y2, this.y1];

    this.emit('onUpdate', { roi: this, bounds: this.getBounds() });
  }
}

export default RectROI;
