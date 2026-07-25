import { describe, it, expect, vi } from 'vitest';
import { PlotDataView } from '../../src/plot/PlotDataView.js';
import { DataStore } from '../../src/plot/DataStore.js';
import { ROIController } from '../../src/plot/ROI/ROIController.js';
import { RectROI } from '../../src/plot/ROI/RectROI.js';

function makeStore(xs) {
  const store = new DataStore(1024);
  store.appendData({
    x: new Float32Array(xs),
    y: new Float32Array(xs.map((v) => v * 10)),
  });
  return store;
}

describe('PlotDataView — lazy recomputation & caching', () => {
  it('starts dirty and computes on the first getData() call', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);

    const data = view.getData();
    expect(Array.from(data.x)).toEqual([1, 2, 3]);
  });

  it('returns the same cached object on repeated getData() calls while not dirty', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);

    const first = view.getData();
    const second = view.getData();

    expect(first).toBe(second);
  });

  it('markDirty() forces recomputation and emits "dirty"', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);
    view.getData();

    const listener = vi.fn();
    view.on('dirty', listener);
    view.markDirty();

    expect(listener).toHaveBeenCalledTimes(1);
    // recompute happens lazily, on the NEXT getData(), not inside markDirty() itself
  });
});

describe('PlotDataView — dirty propagation rules', () => {
  it('marks dirty when the source DataStore emits "dirty" (new data appended)', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);
    view.getData(); // consume initial dirty flag

    store.appendData({ x: new Float32Array([4]), y: new Float32Array([40]) });

    const data = view.getData();
    expect(Array.from(data.x)).toEqual([1, 2, 3, 4]);
  });

  it('marks dirty when the source DataStore emits "dataExpired"', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);
    view.getData();

    const dirtyListener = vi.fn();
    view.on('dirty', dirtyListener);
    store.emit('dataExpired', { expired: 1, remaining: 2 });

    expect(dirtyListener).toHaveBeenCalledTimes(1);
  });

  it('marks dirty on roiController "roiFinalized"', () => {
    const store = makeStore([1, 2, 3]);
    const roiController = new ROIController(null);
    const view = new PlotDataView(store, null, { roiController });
    view.getData();

    const dirtyListener = vi.fn();
    view.on('dirty', dirtyListener);
    roiController.emit('roiFinalized', {});

    expect(dirtyListener).toHaveBeenCalledTimes(1);
  });

  it('marks dirty on roiController "roiExternalUpdate"', () => {
    const store = makeStore([1, 2, 3]);
    const roiController = new ROIController(null);
    const view = new PlotDataView(store, null, { roiController });
    view.getData();

    const dirtyListener = vi.fn();
    view.on('dirty', dirtyListener);
    roiController.emit('roiExternalUpdate', {});

    expect(dirtyListener).toHaveBeenCalledTimes(1);
  });

  it('does NOT mark dirty on roiController "roiUpdated" (drag must not trigger recompute)', () => {
    const store = makeStore([1, 2, 3]);
    const roiController = new ROIController(null);
    const view = new PlotDataView(store, null, { roiController });
    const first = view.getData();

    const dirtyListener = vi.fn();
    view.on('dirty', dirtyListener);
    roiController.emit('roiUpdated', {});

    expect(dirtyListener).not.toHaveBeenCalled();
    expect(view.getData()).toBe(first); // still the same cached snapshot
  });

  it('cascades dirty from a parent PlotDataView to a child view', () => {
    const store = makeStore([1, 2, 3]);
    const parent = new PlotDataView(store);
    const child  = new PlotDataView(parent);
    parent.getData();
    child.getData();

    store.appendData({ x: new Float32Array([4]), y: new Float32Array([40]) });
    // parent recomputes and cascades 'dirty' to child on the parent's own getData() call
    parent.getData();

    const childData = child.getData();
    expect(Array.from(childData.x)).toEqual([1, 2, 3, 4]);
  });
});

describe('PlotDataView.filterByDomain', () => {
  it('keeps only points within the given x domain', () => {
    const store = makeStore([0, 5, 10, 15, 20]);
    const view = new PlotDataView(store);
    const filtered = view.filterByDomain({ x: [5, 15] });

    const data = filtered.getData();
    expect(Array.from(data.x)).toEqual([5, 10, 15]);
    expect(Array.from(data.y)).toEqual([50, 100, 150]);
  });

  it('combines x and y domain constraints', () => {
    const store = makeStore([0, 5, 10, 15, 20]); // y = 10x
    const view = new PlotDataView(store);
    const filtered = view.filterByDomain({ x: [0, 20], y: [60, 150] }); // y in [60,150] -> x in [10,15]... but 5 gives y=50 excluded

    const data = filtered.getData();
    expect(Array.from(data.x)).toEqual([10, 15]);
  });

  it('produces a properly-sized empty result when nothing matches', () => {
    const store = makeStore([0, 5, 10]);
    const view = new PlotDataView(store);
    const filtered = view.filterByDomain({ x: [1000, 2000] });

    const data = filtered.getData();
    expect(data.x.length).toBe(0);
    expect(data.color.length).toBe(0);
  });
});

describe('PlotDataView.filterByROI', () => {
  it('throws if no roiController was provided in constructor opts', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);
    expect(() => view.filterByROI('some-id')).toThrow(/roiController not provided/);
  });

  it('keeps only points inside the named ROI bounding box', () => {
    const store = makeStore([0, 5, 10, 15, 20]); // y = 10x
    const roiController = new ROIController(null);
    const roi = new RectROI({ id: 'box', x1: 4, x2: 16, y1: 0, y2: 200 });
    roiController.addROI(roi);

    const view = new PlotDataView(store, null, { roiController });
    const filtered = view.filterByROI('box');

    const data = filtered.getData();
    expect(Array.from(data.x)).toEqual([5, 10, 15]);
  });

  it('gracefully degrades to all data when the ROI id is not found', () => {
    const store = makeStore([1, 2, 3]);
    const roiController = new ROIController(null);
    const view = new PlotDataView(store, null, { roiController });
    const filtered = view.filterByROI('does-not-exist');

    const data = filtered.getData();
    expect(Array.from(data.x)).toEqual([1, 2, 3]);
  });
});

describe('PlotDataView.histogram', () => {
  it('buckets values into evenly-spaced bins and reports edges of length bins+1', () => {
    const store = makeStore([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const view = new PlotDataView(store);

    const { counts, edges } = view.histogram({ field: 'x', bins: 5 });

    expect(edges.length).toBe(6);
    expect(edges[0]).toBeCloseTo(0);
    expect(edges[5]).toBeCloseTo(9);
    expect(Array.from(counts).reduce((a, b) => a + b, 0)).toBe(10);
  });

  it('clamps the maximum value into the last bin rather than overflowing', () => {
    const store = makeStore([0, 10]);
    const view = new PlotDataView(store);

    const { counts } = view.histogram({ field: 'x', bins: 2 });
    // bin width = 5; value 10 would compute to bin index 2 (out of range) -> clamped to bin 1
    expect(Array.from(counts)).toEqual([1, 1]);
  });

  it('dumps everything into bin 0 when all values are equal (span === 0)', () => {
    const store = makeStore([5, 5, 5]);
    const view = new PlotDataView(store);

    const { counts } = view.histogram({ field: 'x', bins: 4 });
    expect(counts[0]).toBe(3);
    expect(Array.from(counts).slice(1)).toEqual([0, 0, 0]);
  });

  it('throws for an unknown field name', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);
    expect(() => view.histogram({ field: 'bogus', bins: 4 })).toThrow(/unknown field/);
  });
});

describe('PlotDataView.snapshot', () => {
  it('returns a deep copy that does not alias the internal cache', () => {
    const store = makeStore([1, 2, 3]);
    const view = new PlotDataView(store);

    const snap = view.snapshot();
    snap.x[0] = 999;

    expect(view.getData().x[0]).toBe(1);
  });
});

describe('PlotDataView.destroy', () => {
  it('removes source and roiController listeners so further events do not affect the view', () => {
    const store = makeStore([1, 2, 3]);
    const roiController = new ROIController(null);
    const view = new PlotDataView(store, null, { roiController });
    view.getData();

    view.destroy();

    expect(store.listenerCount('dirty')).toBe(0);
    expect(store.listenerCount('dataExpired')).toBe(0);
    expect(roiController.listenerCount('roiFinalized')).toBe(0);
    expect(roiController.listenerCount('roiExternalUpdate')).toBe(0);
  });
});
