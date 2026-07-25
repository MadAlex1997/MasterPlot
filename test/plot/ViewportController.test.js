import { describe, it, expect, vi } from 'vitest';
import { ViewportController } from '../../src/plot/ViewportController.js';
import { AxisController } from '../../src/plot/axes/AxisController.js';

function makeViewport({ xAxisOpts = {}, yAxisOpts = {} } = {}) {
  const viewport = new ViewportController();
  const xAxis = new AxisController(xAxisOpts);
  const yAxis = new AxisController(yAxisOpts);
  viewport.setAxisConfig(xAxis, yAxis);
  return viewport;
}

describe('ViewportController — domain state', () => {
  it('defaults to xDomain [0,1] and yDomain [0,100]', () => {
    const viewport = makeViewport();
    expect(viewport.getXDomain()).toEqual([0, 1]);
    expect(viewport.getYDomain()).toEqual([0, 100]);
  });

  it('setXDomain replaces the domain and emits domainChanged', () => {
    const viewport = makeViewport();
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.setXDomain([5, 15]);

    expect(viewport.getXDomain()).toEqual([5, 15]);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ xDomain: [5, 15], yDomain: [0, 100] });
  });

  it('ignores a degenerate domain (min === max) and does not emit', () => {
    const viewport = makeViewport();
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.setXDomain([7, 7]);

    expect(viewport.getXDomain()).toEqual([0, 1]);
    expect(listener).not.toHaveBeenCalled();
  });

  it('setDomains applies both axes atomically with a single event', () => {
    const viewport = makeViewport();
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.setDomains([1, 2], [3, 4]);

    expect(viewport.getXDomain()).toEqual([1, 2]);
    expect(viewport.getYDomain()).toEqual([3, 4]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('setDomains(null, yDomain) only touches the y domain', () => {
    const viewport = makeViewport();
    viewport.setDomains(null, [3, 4]);
    expect(viewport.getXDomain()).toEqual([0, 1]);
    expect(viewport.getYDomain()).toEqual([3, 4]);
  });

  it('getXDomain/getYDomain return copies, not live references', () => {
    const viewport = makeViewport();
    const domain = viewport.getXDomain();
    domain[0] = 999;
    expect(viewport.getXDomain()).toEqual([0, 1]);
  });
});

describe('ViewportController — zoom (linear)', () => {
  it('zoomAroundX(focal, 2) halves the span, keeping the focal point fixed at the min', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]);

    viewport.zoomAroundX(0, 2); // focal at the domain min — should stay pinned there

    const [min, max] = viewport.getXDomain();
    expect(max - min).toBeCloseTo(50, 10); // span halved
    expect(min).toBeCloseTo(0, 10);
    expect(max).toBeCloseTo(50, 10);
  });

  it('zoomAroundX preserves the focal point\'s relative position within the domain', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]);

    viewport.zoomAroundX(25, 2); // focal 25% through the domain

    const [min, max] = viewport.getXDomain();
    expect(max - min).toBeCloseTo(50, 10); // span halved
    // (focal - min) / span must be unchanged by the zoom (0.25 both before and after)
    expect((25 - min) / (max - min)).toBeCloseTo(0.25, 10);
  });

  it('zoomAroundX(focal, 0.5) doubles the span (zoom out)', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]);

    viewport.zoomAroundX(50, 0.5);

    const [min, max] = viewport.getXDomain();
    expect(max - min).toBeCloseTo(200, 10);
    expect(min).toBeCloseTo(-50, 10);
    expect(max).toBeCloseTo(150, 10);
  });

  it('zoomAround mutates x and y simultaneously in one event', () => {
    const viewport = makeViewport();
    viewport.setDomains([0, 100], [0, 100]);
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.zoomAround(50, 50, 2);

    expect(viewport.getXDomain()).toEqual([25, 75]);
    expect(viewport.getYDomain()).toEqual([25, 75]);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('ViewportController — zoom (log scale)', () => {
  it('zoomAroundX halves the log-span around the focal point for a log-scale axis', () => {
    const viewport = makeViewport({ xAxisOpts: { scaleType: 'log' } });
    viewport.setXDomain([1, 100]); // logSpan = 2 decades

    viewport.zoomAroundX(10, 2); // focal at the geometric midpoint

    const [min, max] = viewport.getXDomain();
    const logSpan = Math.log10(max) - Math.log10(min);
    expect(logSpan).toBeCloseTo(1, 10); // halved
    expect(min).toBeCloseTo(10 / Math.sqrt(10), 6);
    expect(max).toBeCloseTo(10 * Math.sqrt(10), 6);
  });
});

describe('ViewportController — scaleDomainFromMidpoint', () => {
  it('scaleDomainFromMidpointX zooms around the domain midpoint, not a focal point', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]); // midpoint 50

    viewport.scaleDomainFromMidpointX(2);

    expect(viewport.getXDomain()).toEqual([25, 75]);
  });

  it('scaleDomainFromMidpointY works independently of x', () => {
    const viewport = makeViewport();
    viewport.setDomains([0, 100], [0, 100]);

    viewport.scaleDomainFromMidpointY(4);

    expect(viewport.getXDomain()).toEqual([0, 100]);
    expect(viewport.getYDomain()).toEqual([37.5, 62.5]);
  });
});

describe('ViewportController — panByPixels sign convention (AGENT.md y-inversion rule)', () => {
  // Default margins give xRange = [60, 780] (span +720, pxSpan > 0)
  // and yRange = [550, 20] (span -530, pxSpan < 0, inverted).
  it('positive dx on the x axis DECREASES the domain (pxSpan > 0)', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]);

    viewport.panByPixels({ dx: 72 }); // 10% of the 720px x span

    const [min, max] = viewport.getXDomain();
    expect(min).toBeCloseTo(-10, 6);
    expect(max).toBeCloseTo(90, 6);
  });

  it('negative dx on the x axis INCREASES the domain', () => {
    const viewport = makeViewport();
    viewport.setXDomain([0, 100]);

    viewport.panByPixels({ dx: -72 });

    const [min, max] = viewport.getXDomain();
    expect(min).toBeCloseTo(10, 6);
    expect(max).toBeCloseTo(110, 6);
  });

  it('positive dy on the y axis INCREASES the domain (pxSpan < 0 — double negation)', () => {
    const viewport = makeViewport();
    viewport.setYDomain([0, 100]);

    viewport.panByPixels({ dy: 53 }); // 10% of the 530px y span magnitude

    const [min, max] = viewport.getYDomain();
    expect(min).toBeCloseTo(10, 6);
    expect(max).toBeCloseTo(110, 6);
  });

  it('negative dy on the y axis DECREASES the domain', () => {
    const viewport = makeViewport();
    viewport.setYDomain([0, 100]);

    viewport.panByPixels({ dy: -53 });

    const [min, max] = viewport.getYDomain();
    expect(min).toBeCloseTo(-10, 6);
    expect(max).toBeCloseTo(-10 + 100, 6);
  });

  it('panByPixels({dx, dy}) moves both axes and emits a single domainChanged event', () => {
    const viewport = makeViewport();
    viewport.setDomains([0, 100], [0, 100]);
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.panByPixels({ dx: 72, dy: 53 });

    expect(viewport.getXDomain()[0]).toBeCloseTo(-10, 6);
    expect(viewport.getYDomain()[0]).toBeCloseTo(10, 6);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('is a no-op when dx/dy are omitted', () => {
    const viewport = makeViewport();
    viewport.setDomains([0, 100], [0, 100]);
    const listener = vi.fn();
    viewport.on('domainChanged', listener);

    viewport.panByPixels({});

    expect(viewport.getXDomain()).toEqual([0, 100]);
    expect(viewport.getYDomain()).toEqual([0, 100]);
    // _updateScales still runs and 'domainChanged' still fires even with no deltas
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('ViewportController — coordinate transforms', () => {
  it('dataXToScreen / screenXToData round-trip through the built scale', () => {
    const viewport = makeViewport();
    viewport.setCanvasSize(800, 600);
    viewport.setXRange([60, 740]);
    viewport.setXDomain([0, 100]);

    const screenX = viewport.dataXToScreen(50);
    expect(viewport.screenXToData(screenX)).toBeCloseTo(50, 6);
  });

  it('isInPlotArea respects the margin-derived plot area', () => {
    const viewport = makeViewport();
    viewport.setCanvasSize(800, 600);
    // plotArea: x=60,y=20,width=720,height=530 (right=780,bottom=550)
    expect(viewport.isInPlotArea(400, 300)).toBe(true);
    expect(viewport.isInPlotArea(10, 300)).toBe(false);
    expect(viewport.isInPlotArea(400, 590)).toBe(false);
  });
});

describe('ViewportController — getDeckViewState', () => {
  it('computes target as the domain midpoint and zoom from plotArea width', () => {
    const viewport = makeViewport();
    viewport.setCanvasSize(800, 600); // plotArea.width = 800-60-20 = 720

    const state = viewport.getDeckViewState([0, 100], [0, 50]);

    expect(state.target).toEqual([50, 25, 0]);
    expect(state.zoom).toBeCloseTo(Math.log2(720 / 100), 10);
  });
});
