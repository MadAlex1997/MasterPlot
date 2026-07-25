import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataStore } from '../../src/plot/DataStore.js';

function chunk(xs) {
  return { x: new Float32Array(xs), y: new Float32Array(xs.map((v) => v * 10)) };
}

describe('DataStore — non-rolling append + GPU attributes', () => {
  it('appendData grows the live point count and getGPUAttributes returns matching subarrays', () => {
    const store = new DataStore(1024);
    store.appendData(chunk([1, 2, 3]));

    expect(store.getPointCount()).toBe(3);
    const attrs = store.getGPUAttributes();
    expect(Array.from(attrs.x)).toEqual([1, 2, 3]);
    expect(Array.from(attrs.y)).toEqual([10, 20, 30]);
  });

  it('emits "dirty" on every append', () => {
    const store = new DataStore(1024);
    const listener = vi.fn();
    store.on('dirty', listener);

    store.appendData(chunk([1]));
    store.appendData(chunk([2]));

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for an empty chunk (no dirty event, no count change)', () => {
    const store = new DataStore(1024);
    const listener = vi.fn();
    store.on('dirty', listener);

    store.appendData(chunk([]));

    expect(store.getPointCount()).toBe(0);
    expect(listener).not.toHaveBeenCalled();
  });

  it('defaults size to 4.0 and color to opaque white when omitted', () => {
    const store = new DataStore(1024);
    store.appendData({ x: new Float32Array([1, 2]), y: new Float32Array([1, 2]) });

    const attrs = store.getGPUAttributes();
    expect(Array.from(attrs.size)).toEqual([4, 4]);
    expect(Array.from(attrs.color)).toEqual([255, 255, 255, 255, 255, 255, 255, 255]);
  });

  it('clear() resets count without deallocating buffers, and appending afterward works', () => {
    const store = new DataStore(1024);
    store.appendData(chunk([1, 2, 3]));
    store.clear();

    expect(store.getPointCount()).toBe(0);

    store.appendData(chunk([9]));
    expect(store.getPointCount()).toBe(1);
    expect(Array.from(store.getGPUAttributes().x)).toEqual([9]);
  });
});

describe('DataStore — appendData chunk validation (REL7)', () => {
  it('throws naming "chunk" when passed a non-object', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData(null)).toThrow(/chunk must be an object/);
    expect(() => store.appendData('nope')).toThrow(/chunk must be an object/);
  });

  it('throws naming "chunk.x" when x is missing or not array-like', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({ y: new Float32Array([1]) })).toThrow(/chunk\.x/);
    expect(() => store.appendData({ x: 5, y: new Float32Array([1]) })).toThrow(/chunk\.x/);
  });

  it('throws naming "chunk.y" when y is missing or not array-like', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({ x: new Float32Array([1]) })).toThrow(/chunk\.y/);
  });

  it('throws when chunk.x and chunk.y lengths mismatch', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({
      x: new Float32Array([1, 2]),
      y: new Float32Array([1]),
    })).toThrow(/chunk\.x\.length.*chunk\.y\.length/);
  });

  it('throws when chunk.size length does not match chunk.x length', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({
      x: new Float32Array([1, 2]),
      y: new Float32Array([1, 2]),
      size: new Float32Array([1]),
    })).toThrow(/chunk\.size/);
  });

  it('throws when chunk.color length does not match chunk.x.length * 4', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({
      x: new Float32Array([1, 2]),
      y: new Float32Array([1, 2]),
      color: new Uint8Array([255, 255, 255, 255]), // only 1 point's worth
    })).toThrow(/chunk\.color/);
  });

  it('accepts plain number[] arrays (not just typed arrays)', () => {
    const store = new DataStore(1024);
    expect(() => store.appendData({ x: [1, 2], y: [3, 4] })).not.toThrow();
    expect(store.getPointCount()).toBe(2);
  });
});

describe('DataStore — _grow() 1.5x policy (non-rolling)', () => {
  it('grows capacity by ceil(1.5x) exactly enough times to fit an over-sized single append', () => {
    const store = new DataStore(4);
    store.appendData(chunk([1, 2, 3, 4, 5])); // needs 5 > 4 -> one grow: ceil(4*1.5) = 6

    expect(store._capacity).toBe(6);
    expect(store.getPointCount()).toBe(5);
    expect(Array.from(store.getGPUAttributes().x)).toEqual([1, 2, 3, 4, 5]);
  });

  it('grows repeatedly until capacity is sufficient', () => {
    const store = new DataStore(2);
    store.appendData(chunk([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    // 2 -> 3 -> 5 -> 8 -> 12 (ceil(x*1.5) chained until >= 10)
    expect(store._capacity).toBe(12);
    expect(store.getPointCount()).toBe(10);
    expect(Array.from(store.getGPUAttributes().x)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('preserves previously-appended data across a grow triggered by a later append', () => {
    const store = new DataStore(2);
    store.appendData(chunk([1, 2])); // fills initial capacity exactly
    store.appendData(chunk([3]));    // triggers a grow

    expect(store.getPointCount()).toBe(3);
    expect(Array.from(store.getGPUAttributes().x)).toEqual([1, 2, 3]);
  });
});

describe('DataStore — rolling ring buffer (enableRolling)', () => {
  it('throws if neither maxPoints nor maxAgeMs is specified', () => {
    const store = new DataStore();
    expect(() => store.enableRolling()).toThrow();
    expect(() => store.enableRolling({})).toThrow();
  });

  it('evicts the oldest points once maxPoints is exceeded, keeping count capped', () => {
    const store = new DataStore();
    store.enableRolling({ maxPoints: 3 });

    store.appendData(chunk([0, 1, 2, 3, 4]));

    expect(store.getPointCount()).toBe(3);
  });

  it('getLogicalData() returns points in oldest-to-newest order across the wrap boundary', () => {
    const store = new DataStore();
    store.enableRolling({ maxPoints: 3 });

    store.appendData(chunk([0, 1, 2, 3, 4])); // 0,1 evicted; 2,3,4 remain, physically wrapped

    const logical = store.getLogicalData();
    expect(Array.from(logical.x)).toEqual([2, 3, 4]);
    expect(Array.from(logical.y)).toEqual([20, 30, 40]);
  });

  it('getGPUAttributes() delegates to getLogicalData() in rolling mode (ordered, not raw physical layout)', () => {
    const store = new DataStore();
    store.enableRolling({ maxPoints: 3 });
    store.appendData(chunk([0, 1, 2, 3, 4]));

    expect(Array.from(store.getGPUAttributes().x)).toEqual([2, 3, 4]);
  });

  it('handles appends one at a time, still wrapping and evicting correctly', () => {
    const store = new DataStore();
    store.enableRolling({ maxPoints: 3 });

    for (const v of [0, 1, 2, 3, 4]) {
      store.appendData(chunk([v]));
    }

    expect(store.getPointCount()).toBe(3);
    expect(Array.from(store.getLogicalData().x)).toEqual([2, 3, 4]);
  });
});

describe('DataStore — expireIfNeeded (maxAgeMs)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('is a no-op when rolling mode is not enabled', () => {
    const store = new DataStore();
    const listener = vi.fn();
    store.on('dataExpired', listener);
    expect(() => store.expireIfNeeded()).not.toThrow();
    expect(listener).not.toHaveBeenCalled();
  });

  it('evicts points older than maxAgeMs and emits dataExpired with the correct counts', () => {
    const store = new DataStore();
    store.enableRolling({ maxAgeMs: 1000 });

    vi.setSystemTime(0);
    store.appendData(chunk([1, 2, 3])); // timestamp 0

    vi.setSystemTime(500);
    store.appendData(chunk([4, 5])); // timestamp 500

    const listener = vi.fn();
    store.on('dataExpired', listener);

    vi.setSystemTime(1500); // age of ts=0 points is 1500 > 1000; ts=500 points age exactly 1000 (kept)
    store.expireIfNeeded();

    expect(listener).toHaveBeenCalledWith({ expired: 3, remaining: 2 });
    expect(store.getPointCount()).toBe(2);
    expect(Array.from(store.getLogicalData().x)).toEqual([4, 5]);
  });

  it('does not emit dataExpired when nothing is old enough to evict', () => {
    const store = new DataStore();
    store.enableRolling({ maxAgeMs: 1000 });

    vi.setSystemTime(0);
    store.appendData(chunk([1, 2]));

    const listener = vi.fn();
    store.on('dataExpired', listener);

    vi.setSystemTime(500);
    store.expireIfNeeded();

    expect(listener).not.toHaveBeenCalled();
    expect(store.getPointCount()).toBe(2);
  });
});
