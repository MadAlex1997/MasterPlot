import { describe, it, expect, vi } from 'vitest';
import { PlotController } from '../../src/plot/PlotController.js';

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
