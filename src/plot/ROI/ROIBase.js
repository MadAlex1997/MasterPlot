/**
 * ROIBase — abstract base class for all Region-of-Interest types.
 *
 * Stores bounds in data (world) coordinates.  The ConstraintEngine operates
 * on these same coordinates so there is no screen ↔ data conversion needed
 * during constraint enforcement.
 *
 * Event model: ROIBase extends EventEmitter; events bubble upward manually
 * (child emits → ROIController re-emits on PlotController).
 */

import { EventEmitter } from 'events';

let _nextId = 1;

export class ROIBase extends EventEmitter {
  /**
   * @param {object} opts
   * @param {number} [opts.x1]
   * @param {number} [opts.x2]
   * @param {number} [opts.y1]
   * @param {number} [opts.y2]
   * @param {object} [opts.flags]
   * @param {object} [opts.metadata]
   */
  constructor(opts = {}) {
    super();

    this.id = opts.id || `roi_${_nextId++}`;
    this.type = 'base'; // overridden by subclasses

    // Data-space bounds
    this.x1 = opts.x1 ?? 0;
    this.x2 = opts.x2 ?? 1;
    this.y1 = opts.y1 ?? 0;
    this.y2 = opts.y2 ?? 1;

    // Tree relationships
    this.parent   = null;
    this.children = [];

    // Behaviour flags
    this.flags = {
      movable:    true,
      resizable:  true,
      visible:    true,
      ...opts.flags,
    };

    this.metadata = opts.metadata || {};

    // Visual state
    this.selected = false;
    this.hovered  = false;
  }

  // ─── Bounds ──────────────────────────────────────────────────────────────────

  getBounds() {
    return { x1: this.x1, x2: this.x2, y1: this.y1, y2: this.y2 };
  }

  setBounds(bounds, silent = false) {
    this.x1 = bounds.x1;
    this.x2 = bounds.x2;
    this.y1 = bounds.y1;
    this.y2 = bounds.y2;
    if (!silent) this.emit('onUpdate', { roi: this, bounds: this.getBounds() });
  }

  get width()  { return Math.abs(this.x2 - this.x1); }
  get height() { return Math.abs(this.y2 - this.y1); }

  // ─── Tree ────────────────────────────────────────────────────────────────────

  setParent(parent) {
    if (this.parent) {
      this.parent.removeChild(this);
    }
    this.parent = parent;
    if (parent) {
      parent.addChild(this);
    }
  }

  addChild(child) {
    if (!this.children.includes(child)) {
      this.children.push(child);
    }
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }

  /**
   * Walk all descendants (depth-first).
   * @param {Function} fn — called with each child ROI
   */
  walkChildren(fn) {
    for (const child of this.children) {
      fn(child);
      child.walkChildren(fn);
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────────

  onCreate() {
    this.emit('onCreate', { roi: this });
  }

  onDelete() {
    this.emit('onDelete', { roi: this });
    // Detach from parent
    if (this.parent) {
      this.parent.removeChild(this);
      this.parent = null;
    }
    // Recursively delete children
    for (const child of [...this.children]) {
      child.onDelete();
    }
    this.children = [];
  }
}

export default ROIBase;
