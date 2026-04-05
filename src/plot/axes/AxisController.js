/**
 * AxisController — config-only axis descriptor (ARCH-G).
 *
 * Holds scale type, tick formatting, and appearance options that can be shared
 * across multiple PlotController instances.  All domain/range state and
 * zoom/pan mutations have moved to ViewportController.
 *
 * Shared-config example:
 *   const xAxis = new AxisController({ scaleType: 'log', tickCount: 8 });
 *   const plot1 = new PlotController({ xAxis });
 *   const plot2 = new PlotController({ xAxis });
 *   // Both plots use the same tick formatting; each has its own domain.
 */

import { scaleLinear, scaleLog, scaleTime } from 'd3-scale';
import { format } from 'd3-format';
import { timeFormat } from 'd3-time-format';

// Scientific number formatter: uses SI prefix for large/small numbers
const formatSci = format('.3~s');
const formatFixed = format('.4~g');

function defaultFormatter(scaleType) {
  if (scaleType === 'time') {
    return timeFormat('%Y-%m-%d');
  }
  return (v) => {
    const abs = Math.abs(v);
    if (abs === 0) return '0';
    if (abs >= 1e4 || abs < 1e-3) return formatSci(v);
    return formatFixed(v);
  };
}

const DEFAULT_TICK_SIZE = 5; // px

export class AxisController {
  /**
   * @param {object} opts
   *
   * Scale / tick appearance (ARCH-G):
   * @param {'linear'|'log'|'time'} [opts.scaleType='linear']
   * @param {function|null}          [opts.tickFormat=null]  — (value, index) => string
   * @param {number}                 [opts.tickCount=5]
   * @param {string|null}            [opts.label=null]
   *
   * Positioning (F35):
   * @param {'border'|'relative'}    [opts.mode='border']
   *   'border'   — axis rendered at fixed canvas edges (default behavior)
   *   'relative' — axis line tracks a data coordinate; can snap/hide at edges
   *
   * Border-mode options:
   * @param {string[]|null}          [opts.edges=null]
   *   Edges to render at. For x-axis: 'top'|'bottom'; for y-axis: 'left'|'right'.
   *   Multiple values produce mirrored axes. `null` → AxisRenderer uses its
   *   per-axis default (['bottom'] for x, ['left'] for y).
   *
   * Relative-mode options:
   * @param {number}   [opts.crossingValue=0]
   *   The data coordinate the axis line is anchored to (y-value for x-axis,
   *   x-value for y-axis).
   * @param {number}   [opts.snapTolerancePx=0]
   *   Pixels from edge at which the axis snaps to border rendering.
   *   0 = never snap (stationary). >0 = mobile behavior.
   * @param {'border'|'hide'} [opts.offscreen='border']
   *   What to do when crossingValue is outside the visible domain.
   *   'border' = render at nearest border edge. 'hide' = render nothing.
   * @param {'auto'|'positive'|'negative'} [opts.labelSide='auto']
   *   Which side of the axis line labels appear on.
   *   'auto' = toward nearest edge. 'positive' = data-positive side.
   *   'negative' = data-negative side.
   *
   */
  constructor(opts = {}) {
    // ── Appearance ────────────────────────────────────────────────────────────
    this.scaleType  = opts.scaleType  || 'linear';
    this.tickCount  = opts.tickCount  ?? 5;
    this.label      = opts.label      ?? null;
    this.tickFormat = opts.tickFormat ?? null;

    // ── Positioning (F35) ─────────────────────────────────────────────────────
    this.mode             = opts.mode             ?? 'border';
    this.edges            = opts.edges            ?? null;   // null → renderer default
    this.crossingValue    = opts.crossingValue    ?? 0;
    this.snapTolerancePx  = opts.snapTolerancePx  ?? 0;
    this.offscreen        = opts.offscreen        ?? 'border';
    this.labelSide        = opts.labelSide        ?? 'auto';

    this._formatter = this.tickFormat || defaultFormatter(this.scaleType);
  }

  // ─── Methods consumed by AxisRenderer / ViewportController ──────────────────

  /**
   * Build and return a fresh d3 scale with the given domain and range applied.
   * Does NOT mutate any internal state — safe to share across plots.
   *
   * @param {number[]} domain  — [min, max]
   * @param {number[]} range   — [pxStart, pxEnd]
   * @returns {Function} d3 scale
   */
  getScale(domain, range) {
    let scale;
    switch (this.scaleType) {
      case 'log':   scale = scaleLog();   break;
      case 'time':  scale = scaleTime();  break;
      default:      scale = scaleLinear(); break;
    }
    return scale.domain(domain).range(range);
  }

  /**
   * Generate tick values from a pre-built d3 scale.
   *
   * @param {Function} scale — d3 scale (already has domain+range applied)
   * @returns {{ value: number, screen: number, label: string }[]}
   */
  getTicks(scale) {
    const ticks = scale.ticks(this.tickCount);
    return ticks.map((v, i) => ({
      value:  v,
      screen: scale(v),
      label:  this._formatter(v, i),
    }));
  }

  /**
   * Format a single tick value as a display string.
   *
   * @param {number} value
   * @param {number} [index=0]
   * @returns {string}
   */
  formatTick(value, index = 0) {
    return this._formatter(value, index);
  }

  /**
   * Tick mark length in pixels.
   * @returns {number}
   */
  getTickSize() {
    return DEFAULT_TICK_SIZE;
  }
}

export default AxisController;
