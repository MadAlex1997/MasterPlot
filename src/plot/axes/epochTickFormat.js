/**
 * epochTickFormat — F40: tick formatting + conversion helpers for the epoch-offset
 * high-precision time axis pattern.
 *
 * DataStore's GPU buffers are Float32Array (~7 significant decimal digits), which
 * cannot hold an absolute epoch-seconds timestamp with microsecond precision — at
 * that magnitude (~1.7e9) float32's representable gap already exceeds 100. The fix
 * is to keep small offsets-from-a-reference-time in the GPU buffer (which fit
 * float32 fine) and reconstruct absolute time for display using a reference time
 * kept in JS double precision (PlotController's `timeOrigin` option).
 */

import { timeFormat } from 'd3-time-format';

const fmtDate   = timeFormat('%Y-%m-%d');
const fmtHour   = timeFormat('%m-%d %H:%M');
const fmtMinute = timeFormat('%H:%M');
const fmtSecond = timeFormat('%H:%M:%S');

/**
 * Round `frac` (in [0, 1)) to `decimals` places without the classic toFixed()
 * carry bug (e.g. 0.9999996.toFixed(6) === "1.000000", which would silently
 * belong to the next whole second, not the current one). Returns the corrected
 * whole-second count (bumped by 1 if rounding carried) and a zero-padded string.
 */
function roundFraction(wholeSeconds, frac, decimals) {
  const scale = 10 ** decimals;
  let units = Math.round(frac * scale);
  let whole = wholeSeconds;
  if (units >= scale) {
    units -= scale;
    whole += 1;
  }
  return { whole, fracStr: String(units).padStart(decimals, '0') };
}

/**
 * Build a tick formatter for an epoch-offset x-axis.
 *
 * @param {object} opts
 * @param {number} opts.timeOriginMs   — reference epoch, milliseconds (JS double)
 * @param {number} [opts.unitsPerSecond=1] — 1 if x-domain units are seconds, 1000 if ms
 * @returns {(value: number, index?: number, step?: number) => string}
 */
export function buildEpochTickFormatter({ timeOriginMs, unitsPerSecond = 1 }) {
  return function epochTickFormatter(value, _index, step) {
    const epochSeconds = dataXToEpochSeconds(value, timeOriginMs, unitsPerSecond);
    const stepSeconds = step === undefined ? undefined : Math.abs(step) / unitsPerSecond;

    if (stepSeconds === undefined || stepSeconds >= 86400) {
      return fmtDate(new Date(Math.trunc(epochSeconds * 1000)));
    }
    if (stepSeconds >= 3600) {
      return fmtHour(new Date(Math.trunc(epochSeconds * 1000)));
    }
    if (stepSeconds >= 60) {
      return fmtMinute(new Date(Math.trunc(epochSeconds * 1000)));
    }

    const wholeSecondFloor = Math.floor(epochSeconds);
    const frac = epochSeconds - wholeSecondFloor; // 0 <= frac < 1, double precision

    if (stepSeconds >= 1) {
      return fmtSecond(new Date(wholeSecondFloor * 1000));
    }

    // Sub-second: the fractional digits come from the double `frac`, NOT from
    // Date.getMilliseconds() (which truncates at 1ms and would silently defeat
    // the whole point of this feature).
    const decimals = stepSeconds >= 0.001 ? 3 : 6;
    const { whole, fracStr } = roundFraction(wholeSecondFloor, frac, decimals);
    return `${fmtSecond(new Date(whole * 1000))}.${fracStr}`;
  };
}

/**
 * Convert a data-x offset value into an absolute epoch-seconds timestamp,
 * in JS double precision (never touches a Float32 buffer, so no precision loss).
 *
 * @param {number} x
 * @param {number} timeOriginMs
 * @param {number} [unitsPerSecond=1]
 * @returns {number} epoch seconds (double precision)
 */
export function dataXToEpochSeconds(x, timeOriginMs, unitsPerSecond = 1) {
  return timeOriginMs / 1000 + x / unitsPerSecond;
}

/**
 * Inverse of dataXToEpochSeconds — convert an absolute epoch-seconds timestamp
 * into the small offset value that should be written into a DataStore/ROI x.
 *
 * @param {number} epochSeconds
 * @param {number} timeOriginMs
 * @param {number} [unitsPerSecond=1]
 * @returns {number}
 */
export function epochSecondsToDataX(epochSeconds, timeOriginMs, unitsPerSecond = 1) {
  return (epochSeconds - timeOriginMs / 1000) * unitsPerSecond;
}
