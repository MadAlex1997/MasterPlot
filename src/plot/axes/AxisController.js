/**
 * AxisController — manages axis domains and d3-scale instances.
 *
 * Wraps d3-scale (linear / log / time) and exposes a unified API for:
 *   - Setting domain (data range)
 *   - Getting the scale function (data → screen pixels)
 *   - Generating tick values + formatted labels
 *   - Emitting domainChanged events when zoom/pan updates domain
 *
 * PlotController owns one AxisController per axis (x, y) and feeds screen
 * range when canvas size changes.
 */

import { EventEmitter } from 'events';
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

export class AxisController extends EventEmitter {
  /**
   * @param {object} opts
   * @param {'linear'|'log'|'time'} [opts.scaleType='linear']
   * @param {string} [opts.axis='x']  — 'x' or 'y'
   * @param {number[]} [opts.domain]  — initial domain [min, max]
   * @param {number[]} [opts.range]   — initial pixel range [start, end]
   */
  constructor(opts = {}) {
    super();

    this.axis      = opts.axis      || 'x';
    this.scaleType = opts.scaleType || 'linear';
    this._domain   = opts.domain    || [0, 1];
    this._range    = opts.range     || [0, 600];

    this._formatter = defaultFormatter(this.scaleType);
    this._scale     = this._buildScale();
  }

  // ─── Domain ──────────────────────────────────────────────────────────────────

  setDomain(domain) {
    const [min, max] = domain;
    if (min === max) return; // degenerate domain — ignore
    this._domain = [min, max];
    this._scale  = this._buildScale();
    this.emit('domainChanged', { axis: this.axis, domain: this._domain });
  }

  getDomain() {
    return [...this._domain];
  }

  setRange(range) {
    this._range = range;
    this._scale = this._buildScale();
  }

  getRange() {
    return [...this._range];
  }

  // ─── Scale ───────────────────────────────────────────────────────────────────

  /** @returns {Function} d3 scale function */
  getScale() {
    return this._scale;
  }

  /**
   * Change the scale type and rebuild.
   * @param {'linear'|'log'|'time'} type
   */
  setScaleType(type) {
    this.scaleType  = type;
    this._formatter = defaultFormatter(type);
    this._scale     = this._buildScale();
    this.emit('scaleTypeChanged', { axis: this.axis, type });
  }

  // ─── Ticks ───────────────────────────────────────────────────────────────────

  /**
   * Generate tick descriptors for rendering.
   * @param {number} [count=8]
   * @returns {{ value: number, screen: number, label: string }[]}
   */
  getTicks(count = 8) {
    const ticks = this._scale.ticks(count);
    return ticks.map(v => ({
      value:  v,
      screen: this._scale(v),
      label:  this._formatter(v),
    }));
  }

  /**
   * Zoom the domain around a focal point (data coordinate).
   * factor > 1 = zoom in (domain shrinks), factor < 1 = zoom out.
   *
   * @param {number} factor
   * @param {number} focalData — data value at cursor
   */
  zoomAround(factor, focalData) {
    const [min, max] = this._domain;
    const span = max - min;

    if (this.scaleType === 'log') {
      // Log space zoom
      const logMin   = Math.log10(min);
      const logMax   = Math.log10(max);
      const logFocal = Math.log10(focalData);
      const logSpan  = logMax - logMin;
      const newLogSpan = logSpan / factor;
      const ratio = (logFocal - logMin) / logSpan;
      const newLogMin = logFocal - ratio * newLogSpan;
      const newLogMax = newLogMin + newLogSpan;
      this.setDomain([Math.pow(10, newLogMin), Math.pow(10, newLogMax)]);
    } else {
      const newSpan = span / factor;
      const ratio   = (focalData - min) / span;
      const newMin  = focalData - ratio * newSpan;
      this.setDomain([newMin, newMin + newSpan]);
    }
  }

  /**
   * Shift the domain by a pixel delta (pan).
   * @param {number} pixelDelta — positive = right/down
   */
  panByPixels(pixelDelta) {
    const [pxMin, pxMax] = this._range;
    const pxSpan = pxMax - pxMin;
    if (pxSpan === 0) return;

    const [min, max] = this._domain;

    if (this.scaleType === 'log') {
      const logMin  = Math.log10(min);
      const logMax  = Math.log10(max);
      const logSpan = logMax - logMin;
      const dataDelta = -(pixelDelta / pxSpan) * logSpan;
      this.setDomain([
        Math.pow(10, logMin + dataDelta),
        Math.pow(10, logMax + dataDelta),
      ]);
    } else {
      const dataDelta = -(pixelDelta / pxSpan) * (max - min);
      this.setDomain([min + dataDelta, max + dataDelta]);
    }
  }

  /**
   * Expand domain to include a value (used for auto-domain during data append).
   * @param {number} value
   * @param {number} [margin=0.1] — fractional padding
   */
  expandToInclude(value, margin = 0.1) {
    let [min, max] = this._domain;
    let changed = false;

    if (value < min) {
      min = value - Math.abs(value * margin);
      changed = true;
    }
    if (value > max) {
      max = value + Math.abs(value * margin);
      changed = true;
    }

    if (changed) this.setDomain([min, max]);
  }

  // ─── Internal ────────────────────────────────────────────────────────────────

  _buildScale() {
    let scale;

    switch (this.scaleType) {
      case 'log':
        scale = scaleLog();
        break;
      case 'time':
        scale = scaleTime();
        break;
      case 'linear':
      default:
        scale = scaleLinear();
        break;
    }

    return scale.domain(this._domain).range(this._range);
  }
}

export default AxisController;
