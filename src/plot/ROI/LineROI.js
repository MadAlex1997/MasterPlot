/**
 * LineROI — a single vertical or horizontal line ROI.
 *
 * Supported modes:
 *   vline             — full-height vertical line
 *   hline             — full-width horizontal line
 *   vline-half-top    — vertical, midpoint → top of plot
 *   vline-half-bottom — vertical, bottom of plot → midpoint
 *   hline-half-left   — horizontal, left edge → midpoint
 *   hline-half-right  — horizontal, midpoint → right edge
 *
 * Labels (optional, max 25 chars) are only rendered on half-variant modes.
 * Labels are drawn on the canvas 2D overlay — NOT in WebGL.
 *
 * Constraint / nesting rules (enforced by ConstraintEngine):
 *   - Vertical LineROI may be a child of LinearRegion (x is constrained).
 *   - Horizontal LineROI may be a child of a horizontal-bounding ROI.
 *   - Mixed alignments are disallowed (vertical inside horizontal is a no-op).
 *
 * ROIBase bounds are kept in sync with this.position so that ConstraintEngine
 * can reason about them without special-casing:
 *   vertical:   x1 = x2 = position; y1 = -Inf; y2 = +Inf
 *   horizontal: y1 = y2 = position; x1 = -Inf; x2 = +Inf
 *
 * After ConstraintEngine clamps the bounds it calls child._syncPosition() (if
 * it exists) to write the updated bound back into this.position.
 *
 * Serialization format:
 *   { id, type:'lineROI', orientation, mode, position, label, version, updatedAt, domain, metadata }
 */

import { ROIBase } from './ROIBase.js';

const DRAG_THRESHOLD_PX = 8;

export const LINE_HANDLE = {
  NONE: 'none',
  MOVE: 'move',
};

export class LineROI extends ROIBase {
  /**
   * @param {object}   opts
   * @param {'vertical'|'horizontal'} [opts.orientation='vertical']
   * @param {string}   [opts.mode]       One of the 6 mode strings (defaults to
   *                                     'vline' for vertical, 'hline' for horizontal)
   * @param {number}   [opts.position=0] Data coordinate on the primary axis
   * @param {string}   [opts.label]      Optional label ≤25 chars; half variants only
   */
  constructor(opts = {}) {
    super(opts);

    this.type        = 'lineROI';
    this.orientation = opts.orientation || 'vertical';
    this.mode        = opts.mode || (this.orientation === 'vertical' ? 'vline' : 'hline');
    this.position    = opts.position ?? 0;
    this.label       = opts.label != null
      ? String(opts.label).slice(0, 25)
      : null;

    // Sync ROIBase x1/x2/y1/y2 from the initial position
    this._syncBoundsFromPosition();

    // Override base domain unless one was passed in (deserialization path)
    if (!opts.domain) {
      this.domain = this._buildDomain();
    }

    // LineROI is movable but not resizable
    this.flags.resizable = false;
  }

  // ─── Domain helpers ───────────────────────────────────────────────────────

  _buildDomain() {
    return this.orientation === 'vertical'
      ? { x: [this.position, this.position] }
      : { y: [this.position, this.position] };
  }

  /**
   * F14 override — domain captures position for version-gating.
   */
  bumpVersion() {
    this.version   += 1;
    this.updatedAt  = Date.now();
    this.domain     = this._buildDomain();
  }

  // ─── Bounds ↔ position sync ───────────────────────────────────────────────

  /**
   * Write this.position into the ROIBase x1/x2/y1/y2 fields so that
   * ConstraintEngine can operate on them without special-casing LineROI.
   */
  _syncBoundsFromPosition() {
    if (this.orientation === 'vertical') {
      this.x1 = this.x2 = this.position;
      this.y1 = -Infinity;
      this.y2 =  Infinity;
    } else {
      this.y1 = this.y2 = this.position;
      this.x1 = -Infinity;
      this.x2 =  Infinity;
    }
  }

  /**
   * Write the ROIBase bounds back into this.position.
   * Called by ConstraintEngine and ROIController after any external clamp.
   */
  _syncPosition() {
    if (this.orientation === 'vertical') {
      this.position = this.x1; // x1 === x2 after clamping
    } else {
      this.position = this.y1; // y1 === y2 after clamping
    }
  }

  // ─── Interaction ──────────────────────────────────────────────────────────

  /**
   * Hit test — returns LINE_HANDLE.MOVE if the pointer is within DRAG_THRESHOLD_PX
   * of the rendered line, LINE_HANDLE.NONE otherwise.
   *
   * @param {number} sx — screen x (canvas pixels)
   * @param {number} sy — screen y (canvas pixels)
   * @param {ViewportController} viewport
   * @returns {'move'|'none'}
   */
  hitTest(sx, sy, viewport) {
    if (!this.flags.visible) return LINE_HANDLE.NONE;

    const { plotArea: pa } = viewport;

    if (this.orientation === 'vertical') {
      // Only match within the y bounds of the plot area
      if (sy < pa.y || sy > pa.y + pa.height) return LINE_HANDLE.NONE;
      const lineScreenX = viewport.dataXToScreen(this.position);
      if (Math.abs(sx - lineScreenX) <= DRAG_THRESHOLD_PX) return LINE_HANDLE.MOVE;
    } else {
      // Only match within the x bounds of the plot area
      if (sx < pa.x || sx > pa.x + pa.width) return LINE_HANDLE.NONE;
      const lineScreenY = viewport.dataYToScreen(this.position);
      if (Math.abs(sy - lineScreenY) <= DRAG_THRESHOLD_PX) return LINE_HANDLE.MOVE;
    }

    return LINE_HANDLE.NONE;
  }

  /**
   * Apply a data-space delta.
   *
   * ROIController restores bounds to dragStartBounds before calling this, so
   * dx/dy represent the total displacement from the drag origin (avoids float
   * drift).  After applying the delta we re-sync the bounds.
   *
   * @param {string} handle — always LINE_HANDLE.MOVE for LineROI
   * @param {number} dx     — total horizontal data-space displacement
   * @param {number} dy     — total vertical data-space displacement
   */
  applyDelta(handle, dx, dy) {
    if (handle !== LINE_HANDLE.MOVE) return;

    if (this.orientation === 'vertical') {
      // this.x1 was restored to the drag-start position just before this call
      this.position = this.x1 + dx;
    } else {
      // this.y1 was restored to the drag-start position just before this call
      this.position = this.y1 + dy;
    }

    this._syncBoundsFromPosition();
    this.emit('onUpdate', { roi: this, bounds: this.getBounds() });
  }

  // ─── Serialization ────────────────────────────────────────────────────────

  /**
   * Override ROIBase to include LineROI-specific fields.
   * Called by ROIController.serializeAll().
   *
   * @returns {{ id, type, orientation, mode, position, label, version, updatedAt, domain, metadata }}
   */
  serialize() {
    return {
      id:          this.id,
      type:        this.type,         // 'lineROI'
      orientation: this.orientation,
      mode:        this.mode,
      position:    this.position,
      label:       this.label,
      version:     this.version,
      updatedAt:   this.updatedAt,
      domain:      this.domain,
      metadata:    this.metadata,
    };
  }
}

export default LineROI;
