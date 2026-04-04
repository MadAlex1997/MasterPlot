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
   * @param {'linear'|'log'|'time'} [opts.scaleType='linear']
   * @param {function|null}          [opts.tickFormat=null]  — (value, index) => string
   * @param {number}                 [opts.tickCount=5]
   * @param {string|null}            [opts.label=null]
   *
   * @deprecated opts.axis / opts.domain / opts.range — accepted silently for
   *   backwards-compat during migration; domain/range are now owned by ViewportController.
   */
  constructor(opts = {}) {
    this.scaleType  = opts.scaleType  || 'linear';
    this.tickCount  = opts.tickCount  ?? 5;
    this.label      = opts.label      ?? null;
    this.tickFormat = opts.tickFormat ?? null;

    // axis label convenience (legacy prop name)
    if (!this.label && opts.axis) {
      // 'axis' used to mean 'x'/'y' identifier, not the label — ignore
    }

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
