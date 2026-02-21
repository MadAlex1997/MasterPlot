/**
 * ConstraintEngine — enforces parent-child bounds constraints after any ROI mutation.
 *
 * How it works:
 * ─────────────
 * 1. After a parent ROI is moved/resized, call enforceConstraints(parent).
 * 2. The engine walks the parent's children (and their children, depth-first).
 * 3. For each child, it applies two rules:
 *      a. SHIFT rule  — if the parent *moved*, shift the child by the same delta
 *         so it stays in the same relative position within the parent.
 *      b. CLAMP rule  — if (after shifting) any child edge would lie outside
 *         the parent bounds, clamp it to the nearest parent edge.
 * 4. After adjusting a child, recurse into that child's own children (they must
 *    also satisfy constraints relative to the newly-clamped child).
 *
 * Cascade sequence:
 *   parentMoved → childShifted → grandChildShifted → ...
 *
 * Infinite loop guard:
 *   Each call gets a Set of visited ROI ids; if we see the same id twice we stop.
 *
 * Note: y constraints are only enforced for ROIBase subclasses with finite y bounds.
 * LinearRegion has y = ±Infinity, so children are only constrained in x.
 */

export class ConstraintEngine {
  constructor() {
    // No state; this is a pure algorithm.
  }

  /**
   * Enforce constraints on all descendants of a moved/resized parent.
   *
   * @param {ROIBase} parent     — the ROI that was just updated
   * @param {object}  delta      — { dx, dy } the parent itself moved by
   *                               (used for shift rule; pass {dx:0,dy:0} for resize)
   * @param {Set}     [visited]  — internal recursion guard
   */
  enforceConstraints(parent, delta = { dx: 0, dy: 0 }, visited = new Set()) {
    if (visited.has(parent.id)) return;
    visited.add(parent.id);

    for (const child of parent.children) {
      if (visited.has(child.id)) continue;

      // ── Step 1: Shift child by same delta as parent ───────────────────────
      // This preserves the child's relative position inside the parent.
      if (delta.dx !== 0 || delta.dy !== 0) {
        child.x1 += delta.dx;
        child.x2 += delta.dx;

        // Only shift y if the parent has finite y bounds (i.e. not LinearRegion)
        if (isFinite(parent.y1)) {
          child.y1 += delta.dy;
          child.y2 += delta.dy;
        }
      }

      // ── Step 2: Clamp child within parent bounds ──────────────────────────
      if (child.xLocked) {
        // xLocked children always match the parent x bounds exactly
        child.x1 = parent.x1;
        child.x2 = parent.x2;
      } else {
        this._clampChild(child, parent);
      }

      // Emit an update event so the render layer picks up the change
      child.emit('onUpdate', { roi: child, bounds: child.getBounds() });

      // ── Step 3: Recurse — child's own children must satisfy constraints ───
      // delta for the grandchildren is zero here because the child itself may
      // have been clamped to a different position than a straight shift would give.
      this.enforceConstraints(child, { dx: 0, dy: 0 }, visited);
    }
  }

  /**
   * Clamp child bounds so they do not exceed parent bounds.
   * The child is modified in-place.
   *
   * Clamping is asymmetric: if the child is wider than the parent, it is
   * shrunk to fit rather than moved.
   *
   * @param {ROIBase} child
   * @param {ROIBase} parent
   */
  _clampChild(child, parent) {
    const px1 = parent.x1;
    const px2 = parent.x2;

    // Clamp x
    if (child.x1 < px1) {
      const overflow = px1 - child.x1;
      child.x1 = px1;
      // Try to shift x2 right to preserve width, but don't exceed parent
      child.x2 = Math.min(child.x2 + overflow, px2);
    }
    if (child.x2 > px2) {
      const overflow = child.x2 - px2;
      child.x2 = px2;
      // Try to shift x1 left to preserve width, but don't go below parent
      child.x1 = Math.max(child.x1 - overflow, px1);
    }

    // Clamp y (only when parent has finite y bounds)
    if (isFinite(parent.y1) && isFinite(parent.y2)) {
      const py1 = Math.min(parent.y1, parent.y2);
      const py2 = Math.max(parent.y1, parent.y2);

      if (child.y1 < py1) {
        const overflow = py1 - child.y1;
        child.y1 = py1;
        child.y2 = Math.min(child.y2 + overflow, py2);
      }
      if (child.y2 > py2) {
        const overflow = child.y2 - py2;
        child.y2 = py2;
        child.y1 = Math.max(child.y1 - overflow, py1);
      }
    }
  }
}

export default ConstraintEngine;
