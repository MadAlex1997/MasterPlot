import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ROIBase } from '../../../src/plot/ROI/ROIBase.js';
import { RectROI } from '../../../src/plot/ROI/RectROI.js';
import { LinearRegion } from '../../../src/plot/ROI/LinearRegion.js';
import { ROIController } from '../../../src/plot/ROI/ROIController.js';

describe('ROIBase — construction defaults', () => {
  it('defaults version to 1 and derives domain from x1/x2/y1/y2', () => {
    const roi = new ROIBase({ x1: 1, x2: 2, y1: 3, y2: 4 });
    expect(roi.version).toBe(1);
    expect(roi.domain).toEqual({ x: [1, 2], y: [3, 4] });
  });

  it('accepts explicit version/updatedAt/domain overrides (deserialize path)', () => {
    const roi = new ROIBase({ version: 7, updatedAt: 12345, domain: { x: [0, 1], y: [0, 1] } });
    expect(roi.version).toBe(7);
    expect(roi.updatedAt).toBe(12345);
  });
});

describe('ROIBase — bumpVersion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('increments version by exactly 1 per call', () => {
    const roi = new ROIBase();
    expect(roi.version).toBe(1);
    roi.bumpVersion();
    expect(roi.version).toBe(2);
    roi.bumpVersion();
    expect(roi.version).toBe(3);
  });

  it('refreshes updatedAt to the current time', () => {
    vi.setSystemTime(1000);
    const roi = new ROIBase();
    vi.setSystemTime(5000);

    roi.bumpVersion();

    expect(roi.updatedAt).toBe(5000);
  });

  it('re-snapshots domain from the CURRENT bounds, not the bounds at construction', () => {
    const roi = new ROIBase({ x1: 0, x2: 10, y1: 0, y2: 10 });
    roi.x1 = 5;
    roi.x2 = 15;

    roi.bumpVersion();

    expect(roi.domain).toEqual({ x: [5, 15], y: [0, 10] });
  });
});

describe('ROIBase — setBounds', () => {
  it('updates x1/x2/y1/y2 and emits onUpdate by default', () => {
    const roi = new ROIBase();
    const listener = vi.fn();
    roi.on('onUpdate', listener);

    roi.setBounds({ x1: 1, x2: 2, y1: 3, y2: 4 });

    expect(roi.getBounds()).toEqual({ x1: 1, x2: 2, y1: 3, y2: 4 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('suppresses the onUpdate event when silent=true', () => {
    const roi = new ROIBase();
    const listener = vi.fn();
    roi.on('onUpdate', listener);

    roi.setBounds({ x1: 1, x2: 2, y1: 3, y2: 4 }, true);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('ROIBase — tree / lifecycle', () => {
  it('onDelete detaches from its parent and recursively deletes children', () => {
    const parent = new ROIBase();
    const child   = new ROIBase();
    const grandchild = new ROIBase();
    child.setParent(parent);
    grandchild.setParent(child);

    const childDeleteListener = vi.fn();
    const grandchildDeleteListener = vi.fn();
    child.on('onDelete', childDeleteListener);
    grandchild.on('onDelete', grandchildDeleteListener);

    child.onDelete();

    expect(parent.children).not.toContain(child);
    expect(child.parent).toBeNull();
    expect(child.children).toEqual([]);
    expect(childDeleteListener).toHaveBeenCalledTimes(1);
    expect(grandchildDeleteListener).toHaveBeenCalledTimes(1);
  });
});

describe('ROIBase.serialize', () => {
  it('produces a JSON-safe plain object with all versioning fields', () => {
    const roi = new ROIBase({ id: 'roi_1', x1: 0, x2: 1, y1: 0, y2: 1 });
    const s = roi.serialize();

    expect(s).toMatchObject({
      id: 'roi_1',
      type: 'base',
      x1: 0, x2: 1, y1: 0, y2: 1,
      version: 1,
    });
    expect(s.domain).toEqual({ x: [0, 1], y: [0, 1] });
  });
});

describe('ROIController.updateFromExternal — version gating (F14)', () => {
  it('rejects an update with version <= the current version', () => {
    const controller = new ROIController(null);
    const roi = new RectROI({ id: 'r1', x1: 0, x2: 1, y1: 0, y2: 1 });
    roi.version = 3;
    controller.addROI(roi);

    const acceptedEqual = controller.updateFromExternal({
      id: 'r1', type: 'rect', version: 3, updatedAt: Date.now(),
      domain: { x: [5, 6], y: [5, 6] },
    });
    const acceptedLower = controller.updateFromExternal({
      id: 'r1', type: 'rect', version: 2, updatedAt: Date.now(),
      domain: { x: [5, 6], y: [5, 6] },
    });

    expect(acceptedEqual).toBe(false);
    expect(acceptedLower).toBe(false);
    // Bounds must be untouched by the rejected updates
    expect(roi.getBounds()).toEqual({ x1: 0, x2: 1, y1: 0, y2: 1 });
    expect(roi.version).toBe(3);
  });

  it('accepts an update with a strictly higher version and applies domain/version/updatedAt', () => {
    const controller = new ROIController(null);
    const roi = new RectROI({ id: 'r1', x1: 0, x2: 1, y1: 0, y2: 1 });
    roi.version = 3;
    controller.addROI(roi);
    const listener = vi.fn();
    controller.on('roiExternalUpdate', listener);

    const accepted = controller.updateFromExternal({
      id: 'r1', type: 'rect', version: 4, updatedAt: 99999,
      domain: { x: [10, 20], y: [30, 40] },
    });

    expect(accepted).toBe(true);
    expect(roi.x1).toBe(10);
    expect(roi.x2).toBe(20);
    expect(roi.y1).toBe(30);
    expect(roi.y2).toBe(40);
    expect(roi.version).toBe(4);
    expect(roi.updatedAt).toBe(99999);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('creates a new ROI when the id is not already tracked', () => {
    const controller = new ROIController(null);

    const accepted = controller.updateFromExternal({
      id: 'new-1', type: 'rect', version: 1, updatedAt: 1000,
      domain: { x: [0, 5], y: [0, 5] },
    });

    expect(accepted).toBe(true);
    const created = controller.getROI('new-1');
    expect(created).toBeDefined();
    expect(created.getBounds()).toEqual({ x1: 0, x2: 5, y1: 0, y2: 5 });
    expect(created.version).toBe(1);
  });

  it('rejects (returns false) for an unknown ROI type on the create path', () => {
    const controller = new ROIController(null);

    const accepted = controller.updateFromExternal({
      id: 'unknown-1', type: 'not-a-real-type', version: 1, updatedAt: 1000,
      domain: { x: [0, 5], y: [0, 5] },
    });

    expect(accepted).toBe(false);
    expect(controller.getROI('unknown-1')).toBeUndefined();
  });

  it('supports LinearRegion (x-only domain) on both create and update paths', () => {
    const controller = new ROIController(null);
    const region = new LinearRegion({ id: 'lr1', x1: 0, x2: 10 });
    region.version = 1;
    controller.addROI(region);

    const accepted = controller.updateFromExternal({
      id: 'lr1', type: 'linearRegion', version: 2, updatedAt: 2000,
      domain: { x: [5, 15] },
    });

    expect(accepted).toBe(true);
    expect(region.x1).toBe(5);
    expect(region.x2).toBe(15);
  });
});
