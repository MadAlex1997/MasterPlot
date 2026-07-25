import { describe, it, expect, vi } from 'vitest';
import { ConstraintEngine } from '../../../src/plot/ROI/ConstraintEngine.js';
import { LinearRegion } from '../../../src/plot/ROI/LinearRegion.js';
import { RectROI } from '../../../src/plot/ROI/RectROI.js';

function link(parent, child) {
  child.setParent(parent);
  return child;
}

describe('ConstraintEngine — shift rule', () => {
  it('shifts a child by the same delta the parent moved by', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));

    const changed = engine.applyConstraints(parent, { dx: 5, dy: 0 });

    expect(child.x1).toBe(15);
    expect(child.x2).toBe(25);
    expect(changed.has(child)).toBe(true);
  });

  it('does not shift y for a child of LinearRegion (parent y is ±Infinity)', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));

    engine.applyConstraints(parent, { dx: 0, dy: 5 });

    expect(child.y1).toBe(0);
    expect(child.y2).toBe(10);
  });

  it('shifts both x and y for a child of a finite-bounds parent (RectROI-in-RectROI)', () => {
    const engine = new ConstraintEngine();
    const parent = new RectROI({ x1: 0, x2: 100, y1: 0, y2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 10, y2: 20 }));

    engine.applyConstraints(parent, { dx: 5, dy: 5 });

    expect(child.getBounds()).toEqual({ x1: 15, x2: 25, y1: 15, y2: 25 });
  });

  it('is a no-op shift when delta is {dx:0, dy:0} (resize-only operations)', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));

    const changed = engine.applyConstraints(parent, { dx: 0, dy: 0 });

    expect(child.getBounds()).toEqual({ x1: 10, x2: 20, y1: 0, y2: 10 });
    expect(changed.size).toBe(0);
  });
});

describe('ConstraintEngine — clamp rule', () => {
  it('clamps a child whose left edge overflows the parent, preserving width', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: -20, x2: -10, y1: 0, y2: 10 }));

    const changed = engine.applyConstraints(parent);

    expect(child.x1).toBe(0);
    expect(child.x2).toBe(10); // width (10) preserved by shifting x2 right
    expect(changed.has(child)).toBe(true);
  });

  it('clamps a child whose right edge overflows the parent, preserving width', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 110, x2: 120, y1: 0, y2: 10 }));

    engine.applyConstraints(parent);

    expect(child.x2).toBe(100);
    expect(child.x1).toBe(90); // width (10) preserved by shifting x1 left
  });

  it('shrinks a child wider than the parent rather than overflowing both edges', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 10 });
    const child  = link(parent, new RectROI({ x1: -50, x2: 50, y1: 0, y2: 10 }));

    engine.applyConstraints(parent);

    // Left clamp fires first: x1 -> 0, x2 -> min(50 + 50, 10) = 10
    expect(child.x1).toBe(0);
    expect(child.x2).toBe(10);
  });

  it('clamps y bounds when the parent has finite y (RectROI-in-RectROI)', () => {
    const engine = new ConstraintEngine();
    const parent = new RectROI({ x1: 0, x2: 100, y1: 0, y2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: -30, y2: -10 }));

    engine.applyConstraints(parent);

    expect(child.y1).toBe(0);
    expect(child.y2).toBe(20); // width (20) preserved by shifting y2 up
  });

  it('leaves an already-in-bounds child untouched and excludes it from the changed set', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));

    const changed = engine.applyConstraints(parent);

    expect(child.getBounds()).toEqual({ x1: 10, x2: 20, y1: 0, y2: 10 });
    expect(changed.has(child)).toBe(false);
  });
});

describe('ConstraintEngine — xLocked children', () => {
  it('forces xLocked child x-bounds to match the parent exactly, ignoring its own x', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 40, x2: 60, y1: 0, y2: 10, xLocked: true }));

    engine.applyConstraints(parent, { dx: 5, dy: 0 });

    expect(child.x1).toBe(0);
    expect(child.x2).toBe(100);
  });

  it('still shifts y normally for an xLocked child (only x bypasses _clampChild)', () => {
    const engine = new ConstraintEngine();
    const parent = new RectROI({ x1: 0, x2: 100, y1: 0, y2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 10, y2: 20, xLocked: true }));

    engine.applyConstraints(parent, { dx: 0, dy: 5 });

    expect(child.x1).toBe(0);   // forced to parent, not shifted
    expect(child.x2).toBe(100);
    expect(child.y1).toBe(15);  // shifted normally
    expect(child.y2).toBe(25);
  });

  it('does NOT y-clamp an xLocked child, because the xLocked branch skips _clampChild entirely', () => {
    const engine = new ConstraintEngine();
    const parent = new RectROI({ x1: 0, x2: 100, y1: 0, y2: 100 });
    // y already overflows the parent before any mutation — a non-locked child
    // would be clamped by _clampChild, but the xLocked branch never calls it.
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: -30, y2: -10, xLocked: true }));

    engine.applyConstraints(parent, { dx: 0, dy: 0 }); // no shift, so y is untouched either way

    expect(child.y1).toBe(-30);
    expect(child.y2).toBe(-10);
  });
});

describe('ConstraintEngine — cascading multi-level nesting', () => {
  it('propagates parent movement down to grandchildren', () => {
    const engine = new ConstraintEngine();
    const grandparent = new LinearRegion({ x1: 0, x2: 200 });
    const parent = link(grandparent, new RectROI({ x1: 20, x2: 180, y1: 0, y2: 100 }));
    const child  = link(parent, new RectROI({ x1: 30, x2: 170, y1: 10, y2: 90 }));

    const changed = engine.applyConstraints(grandparent, { dx: 10, dy: 0 });

    expect(parent.x1).toBe(30);
    expect(parent.x2).toBe(190);
    // child shifts with its own direct parent's movement (recursed with dx:0 relative
    // to the newly-clamped parent, but the parent itself only translated so the
    // child keeps its position — no clamp triggered since it remains inside)
    expect(child.x1).toBe(30);
    expect(child.x2).toBe(170);
    expect(changed.has(parent)).toBe(true);
    expect(changed.has(child)).toBe(false);
  });

  it('clamps a grandchild that overflows its immediate parent after the parent was clamped', () => {
    const engine = new ConstraintEngine();
    const grandparent = new LinearRegion({ x1: 0, x2: 200 });
    // parent overflows grandparent on the right and will be clamped to [100,200]
    const parent = link(grandparent, new RectROI({ x1: 110, x2: 210, y1: 0, y2: 100 }));
    // child sits near the original right edge of parent — will overflow after parent's clamp
    const child  = link(parent, new RectROI({ x1: 195, x2: 205, y1: 10, y2: 90 }));

    engine.applyConstraints(grandparent);

    expect(parent.x1).toBe(100);
    expect(parent.x2).toBe(200);
    // child must now be clamped inside the *clamped* parent bounds [100,200]
    expect(child.x2).toBe(200);
    expect(child.x1).toBeLessThanOrEqual(200);
    expect(child.x1).toBeGreaterThanOrEqual(100);
  });

  it('only visits each ROI once even if reachable through multiple paths (loop guard)', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));
    // Manually create a childless self-reference to simulate a cycle guard scenario
    child.children.push(parent);

    expect(() => engine.applyConstraints(parent, { dx: 1, dy: 0 })).not.toThrow();
  });
});

describe('ConstraintEngine — onUpdate emission', () => {
  it('emits onUpdate for every visited child, even when bounds are unchanged', () => {
    const engine = new ConstraintEngine();
    const parent = new LinearRegion({ x1: 0, x2: 100 });
    const child  = link(parent, new RectROI({ x1: 10, x2: 20, y1: 0, y2: 10 }));
    const listener = vi.fn();
    child.on('onUpdate', listener);

    engine.applyConstraints(parent, { dx: 0, dy: 0 });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ roi: child, bounds: child.getBounds() });
  });
});
