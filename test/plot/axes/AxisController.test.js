import { describe, it, expect } from 'vitest';
import { format } from 'd3-format';
import { scaleTime } from 'd3-scale';
import { AxisController } from '../../../src/plot/axes/AxisController.js';

describe('AxisController — construction defaults', () => {
  it('defaults to a linear scale with tickCount 5 and border-mode positioning', () => {
    const axis = new AxisController();
    expect(axis.scaleType).toBe('linear');
    expect(axis.tickCount).toBe(5);
    expect(axis.label).toBeNull();
    expect(axis.tickFormat).toBeNull();
    expect(axis.mode).toBe('border');
    expect(axis.edges).toBeNull();
    expect(axis.crossingValue).toBe(0);
    expect(axis.snapTolerancePx).toBe(0);
    expect(axis.offscreen).toBe('border');
    expect(axis.labelSide).toBe('auto');
  });

  it('getTickSize() returns a fixed 5px regardless of config', () => {
    const axis = new AxisController({ scaleType: 'log' });
    expect(axis.getTickSize()).toBe(5);
  });
});

describe('AxisController.getScale — linear', () => {
  it('maps the domain endpoints onto the range endpoints', () => {
    const axis = new AxisController({ scaleType: 'linear' });
    const scale = axis.getScale([0, 100], [50, 450]);

    expect(scale(0)).toBeCloseTo(50, 10);
    expect(scale(100)).toBeCloseTo(450, 10);
    expect(scale(50)).toBeCloseTo(250, 10);
  });

  it('returns an independent scale instance on each call (no shared mutable state)', () => {
    const axis = new AxisController();
    const scaleA = axis.getScale([0, 10], [0, 100]);
    const scaleB = axis.getScale([0, 20], [0, 200]);

    expect(scaleA(10)).toBeCloseTo(100, 10);
    expect(scaleB(10)).toBeCloseTo(100, 10);
    expect(scaleA.domain()).toEqual([0, 10]);
    expect(scaleB.domain()).toEqual([0, 20]);
  });
});

describe('AxisController.getScale — log', () => {
  it('maps a log-scale domain logarithmically onto the range', () => {
    const axis = new AxisController({ scaleType: 'log' });
    const scale = axis.getScale([1, 100], [0, 200]);

    expect(scale(1)).toBeCloseTo(0, 6);
    expect(scale(100)).toBeCloseTo(200, 6);
    expect(scale(10)).toBeCloseTo(100, 6); // geometric midpoint -> pixel midpoint
  });
});

describe('AxisController.getScale — time', () => {
  it('maps Date domain endpoints onto the range', () => {
    const axis = new AxisController({ scaleType: 'time' });
    const d0 = new Date('2024-01-01T00:00:00Z');
    const d1 = new Date('2024-01-02T00:00:00Z');
    const scale = axis.getScale([d0, d1], [0, 100]);

    expect(scale(d0)).toBeCloseTo(0, 6);
    expect(scale(d1)).toBeCloseTo(100, 6);
  });
});

describe('AxisController.getTicks', () => {
  it('produces { value, screen, label } for each tick, with screen = scale(value)', () => {
    const axis = new AxisController({ scaleType: 'linear', tickCount: 5 });
    const scale = axis.getScale([0, 100], [0, 500]);

    const ticks = axis.getTicks(scale);

    expect(ticks.length).toBeGreaterThan(0);
    for (const t of ticks) {
      expect(t.screen).toBeCloseTo(scale(t.value), 10);
      expect(typeof t.label).toBe('string');
    }
  });
});

describe('AxisController.formatTick — default numeric formatter', () => {
  const formatSci   = format('.3~s');
  const formatFixed = format('.4~g');

  it('formats exactly zero as the string "0"', () => {
    const axis = new AxisController();
    expect(axis.formatTick(0)).toBe('0');
  });

  it('uses fixed-point formatting for values within [1e-3, 1e4)', () => {
    const axis = new AxisController();
    expect(axis.formatTick(1234)).toBe(formatFixed(1234));
    expect(axis.formatTick(0.5)).toBe(formatFixed(0.5));
  });

  it('switches to scientific/SI formatting at and beyond 1e4', () => {
    const axis = new AxisController();
    expect(axis.formatTick(10000)).toBe(formatSci(10000));
    expect(axis.formatTick(1e7)).toBe(formatSci(1e7));
  });

  it('switches to scientific/SI formatting below 1e-3', () => {
    const axis = new AxisController();
    expect(axis.formatTick(0.0001)).toBe(formatSci(0.0001));
  });

  it('treats negative values by their absolute magnitude', () => {
    const axis = new AxisController();
    expect(axis.formatTick(-10000)).toBe(formatSci(-10000));
    expect(axis.formatTick(-5)).toBe(formatFixed(-5));
  });
});

describe('AxisController.formatTick — time scale default formatter (F39)', () => {
  it('matches d3-scale\'s own multi-granularity default tickFormat exactly', () => {
    const axis = new AxisController({ scaleType: 'time' });
    const expected = scaleTime().tickFormat();
    const dCoarse = new Date('2024-03-14T00:00:00'); // day boundary
    const dFine   = new Date('2024-03-14T12:34:56.789'); // sub-second
    expect(axis.formatTick(dCoarse)).toBe(expected(dCoarse));
    expect(axis.formatTick(dFine)).toBe(expected(dFine));
  });

  it('switches granularity depending on which time boundary a tick falls on', () => {
    const axis = new AxisController({ scaleType: 'time' });
    const dCoarse = new Date('2024-03-14T00:00:00'); // day boundary -> coarse label
    const dFine   = new Date('2024-03-14T12:34:56.789'); // sub-second -> fine label
    expect(axis.formatTick(dCoarse)).not.toBe(axis.formatTick(dFine));
  });
});

describe('AxisController.formatTick — custom tickFormat override', () => {
  it('uses the supplied tickFormat function instead of the default', () => {
    const custom = (v, i) => `#${i}:${v}`;
    const axis = new AxisController({ tickFormat: custom });

    expect(axis.formatTick(42, 3)).toBe('#3:42');
  });

  it('getTicks() labels also go through the custom formatter', () => {
    const custom = (v) => `v${v}`;
    const axis = new AxisController({ tickFormat: custom, tickCount: 3 });
    const scale = axis.getScale([0, 10], [0, 100]);

    const ticks = axis.getTicks(scale);
    for (const t of ticks) {
      expect(t.label).toBe(`v${t.value}`);
    }
  });
});

describe('AxisController.getTicks — step 3rd arg (F39/F40)', () => {
  it('passes the delta between consecutive ticks for a linear scale', () => {
    const steps = [];
    const axis = new AxisController({
      tickFormat: (v, i, step) => { steps.push(step); return String(v); },
      tickCount: 5,
    });
    const scale = axis.getScale([0, 100], [0, 500]);
    const ticks = axis.getTicks(scale);

    expect(steps.length).toBe(ticks.length);
    expect(steps[0]).toBeGreaterThan(0);
    for (const s of steps) expect(s).toBeCloseTo(steps[0], 10);
  });

  it('passes a millisecond delta for a time scale (Date subtraction)', () => {
    const steps = [];
    const axis = new AxisController({
      scaleType: 'time',
      tickFormat: (v, i, step) => { steps.push(step); return ''; },
      tickCount: 5,
    });
    const scale = axis.getScale([new Date('2024-01-01T00:00:00Z'), new Date('2024-01-02T00:00:00Z')], [0, 500]);
    axis.getTicks(scale);

    expect(steps[0]).toBeGreaterThan(0);
    expect(Number.isFinite(steps[0])).toBe(true);
  });

  it('leaves step undefined when fewer than 2 ticks are produced', () => {
    let captured = 'not-called';
    const axis = new AxisController({
      tickFormat: (v, i, step) => { captured = step; return ''; },
    });
    // Zero-width domain collapses to a single tick under d3-scale's linear ticks().
    const scale = axis.getScale([5, 5], [0, 100]);
    const ticks = axis.getTicks(scale);

    expect(ticks.length).toBe(1);
    expect(captured).toBeUndefined();
  });
});
