import { describe, it, expect, vi } from 'vitest';
import { PlotController } from '../../src/plot/PlotController.js';
import { AxisController } from '../../src/plot/axes/AxisController.js';

// These tests cover REL7's constructor-option validation only. They never
// call init()/destroy() — those require a real WebGL canvas that jsdom
// doesn't provide — so they exercise state set up entirely in the
// constructor (viewport domains, axis scaleType, panMode).

describe('PlotController constructor — domain validation (REL7)', () => {
  it('falls back to [0,1]/[0,100] and warns when xDomain/yDomain are malformed', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pc = new PlotController({ xDomain: [1, 1], yDomain: 'bad' });

    expect(pc.viewport.getXDomain()).toEqual([0, 1]);
    expect(pc.viewport.getYDomain()).toEqual([0, 100]);
    expect(warn.mock.calls.some(c => /"xDomain"/.test(c[0]))).toBe(true);
    expect(warn.mock.calls.some(c => /"yDomain"/.test(c[0]))).toBe(true);
    warn.mockRestore();
  });

  it('accepts a valid [min, max] domain without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pc = new PlotController({ xDomain: [-5, 5], yDomain: [0, 1000] });

    expect(pc.viewport.getXDomain()).toEqual([-5, 5]);
    expect(pc.viewport.getYDomain()).toEqual([0, 1000]);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('PlotController constructor — scaleType validation (REL7)', () => {
  it('falls back to "linear" and warns on an unrecognized xScaleType/yScaleType', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pc = new PlotController({ xScaleType: 'weird', yScaleType: 'also-weird' });

    expect(pc.xAxis.scaleType).toBe('linear');
    expect(pc.yAxis.scaleType).toBe('linear');
    expect(warn.mock.calls.some(c => /"xScaleType"/.test(c[0]))).toBe(true);
    expect(warn.mock.calls.some(c => /"yScaleType"/.test(c[0]))).toBe(true);
    warn.mockRestore();
  });

  it('accepts "log" and "time" without warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pc = new PlotController({ xScaleType: 'log', yScaleType: 'time' });

    expect(pc.xAxis.scaleType).toBe('log');
    expect(pc.yAxis.scaleType).toBe('time');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('PlotController constructor/setPanMode — panMode validation (REL7)', () => {
  it('defaults to "drag" when omitted', () => {
    const pc = new PlotController({});
    expect(pc._panMode).toBe('drag');
  });

  it('falls back to "drag" and warns on an unrecognized panMode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const pc = new PlotController({ panMode: 'sideways' });

    expect(pc._panMode).toBe('drag');
    expect(warn.mock.calls.some(c => /"panMode"/.test(c[0]))).toBe(true);
    warn.mockRestore();
  });

  it('setPanMode falls back to "drag" and warns on an invalid value', () => {
    const pc = new PlotController({ panMode: 'follow' });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    pc.setPanMode('sideways');

    expect(pc._panMode).toBe('drag');
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('setPanMode accepts "follow"', () => {
    const pc = new PlotController({});
    pc.setPanMode('follow');
    expect(pc._panMode).toBe('follow');
  });
});

describe('PlotController — timeOrigin epoch-offset conversion (F40)', () => {
  it('normalizes a Date timeOrigin to epoch-ms, same as a plain number', () => {
    const d = new Date('2024-03-14T12:00:00.000Z');
    const pcDate   = new PlotController({ timeOrigin: d });
    const pcNumber = new PlotController({ timeOrigin: d.getTime() });

    expect(pcDate.dataXToEpochSeconds(0)).toBeCloseTo(d.getTime() / 1000, 6);
    expect(pcDate.dataXToEpochSeconds(0)).toBeCloseTo(pcNumber.dataXToEpochSeconds(0), 9);
  });

  it('defaults timeOriginUnits to "seconds"', () => {
    const timeOriginMs = 1_700_000_000_000;
    const pc = new PlotController({ timeOrigin: timeOriginMs });

    expect(pc.dataXToEpochSeconds(10)).toBeCloseTo(timeOriginMs / 1000 + 10, 6);
  });

  it('honors timeOriginUnits: "ms"', () => {
    const timeOriginMs = 1_700_000_000_000;
    const pc = new PlotController({ timeOrigin: timeOriginMs, timeOriginUnits: 'ms' });

    expect(pc.dataXToEpochSeconds(5000)).toBeCloseTo(timeOriginMs / 1000 + 5, 6);
  });

  it('dataXToEpochSeconds / epochSecondsToDataX round-trip', () => {
    const pc = new PlotController({ timeOrigin: 1_700_000_000_000 });
    const x = 123.456789;
    expect(pc.epochSecondsToDataX(pc.dataXToEpochSeconds(x))).toBeCloseTo(x, 6);
  });

  it('dataXToDate returns a ms-precision Date matching dataXToEpochSeconds', () => {
    const pc = new PlotController({ timeOrigin: 1_700_000_000_000 });
    const date = pc.dataXToDate(10);
    expect(date.getTime()).toBeCloseTo(pc.dataXToEpochSeconds(10) * 1000, 0);
  });

  it('throws from the conversion methods when timeOrigin was never set', () => {
    const pc = new PlotController({});
    expect(() => pc.dataXToEpochSeconds(0)).toThrow(/timeOrigin/);
    expect(() => pc.epochSecondsToDataX(0)).toThrow(/timeOrigin/);
  });

  it('installs an epoch tick formatter on the default xAxis when no custom xAxis is supplied', () => {
    const pc = new PlotController({ timeOrigin: 1_700_000_000_000 });
    expect(typeof pc.xAxis.tickFormat).toBe('function');
    // Formatter reflects the reference time, not the generic numeric/time default.
    expect(pc.xAxis.formatTick(0, 0)).toContain('-'); // date-ish output at the coarse default tier
  });

  it('does not mutate a caller-supplied shared xAxis, and warns once', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sharedXAxis = new AxisController();

    const pc = new PlotController({ xAxis: sharedXAxis, timeOrigin: 1_700_000_000_000 });

    expect(pc.xAxis).toBe(sharedXAxis);
    expect(sharedXAxis.tickFormat).toBeNull();
    expect(warn.mock.calls.some(c => /"xAxis".*"timeOrigin"/.test(c[0]))).toBe(true);
    // Conversion helpers still work even though the shared axis wasn't touched.
    expect(pc.dataXToEpochSeconds(0)).toBeCloseTo(1_700_000_000_000 / 1000, 6);
    warn.mockRestore();
  });
});
