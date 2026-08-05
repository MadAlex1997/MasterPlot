import { describe, it, expect } from 'vitest';
import { timeFormat } from 'd3-time-format';
import {
  buildEpochTickFormatter,
  dataXToEpochSeconds,
  epochSecondsToDataX,
} from '../../../src/plot/axes/epochTickFormat.js';

const fmtDate   = timeFormat('%Y-%m-%d');
const fmtHour   = timeFormat('%m-%d %H:%M');
const fmtMinute = timeFormat('%H:%M');
const fmtSecond = timeFormat('%H:%M:%S');

describe('buildEpochTickFormatter — tier selection by step', () => {
  const timeOriginMs = Date.UTC(2024, 2, 14, 12, 34, 56, 789);
  const fmt = buildEpochTickFormatter({ timeOriginMs, unitsPerSecond: 1 });
  const d = new Date(timeOriginMs);

  it('falls back to the coarsest (date-only) tier when step is undefined', () => {
    expect(fmt(0, 0, undefined)).toBe(fmtDate(d));
  });

  it('uses the date-only tier at/above 1 day', () => {
    expect(fmt(0, 0, 86400)).toBe(fmtDate(d));
    expect(fmt(0, 0, 200000)).toBe(fmtDate(d));
  });

  it('uses the month-day hour:minute tier for [1 hour, 1 day)', () => {
    expect(fmt(0, 0, 3600)).toBe(fmtHour(d));
    expect(fmt(0, 0, 80000)).toBe(fmtHour(d));
  });

  it('uses the hour:minute tier for [1 minute, 1 hour)', () => {
    expect(fmt(0, 0, 60)).toBe(fmtMinute(d));
    expect(fmt(0, 0, 3000)).toBe(fmtMinute(d));
  });

  it('uses the hour:minute:second tier for [1 second, 1 minute)', () => {
    expect(fmt(0, 0, 1)).toBe(fmtSecond(d));
    expect(fmt(0, 0, 50)).toBe(fmtSecond(d));
  });

  it('appends 3 fractional digits for [1 ms, 1 second)', () => {
    expect(fmt(0, 0, 0.5)).toBe(`${fmtSecond(d)}.789`);
    expect(fmt(0, 0, 0.001)).toBe(`${fmtSecond(d)}.789`);
  });

  it('appends 6 fractional digits (microseconds) below 1 ms', () => {
    expect(fmt(0, 0, 0.0005)).toBe(`${fmtSecond(d)}.789000`);
    expect(fmt(0, 0, 0.0000001)).toBe(`${fmtSecond(d)}.789000`);
  });
});

describe('buildEpochTickFormatter — fractional-second precision', () => {
  // timeOrigin lands exactly on a whole second so expected fraction strings are exact.
  const timeOriginMs = Date.UTC(2024, 2, 14, 12, 34, 56, 0);
  const originSeconds = timeOriginMs / 1000;
  const fmt = buildEpochTickFormatter({ timeOriginMs, unitsPerSecond: 1 });
  const base = fmtSecond(new Date(timeOriginMs));

  it('preserves 6-decimal-place (microsecond) offsets exactly', () => {
    expect(fmt(0.123456, 0, 0.000001)).toBe(`${base}.123456`);
  });

  it('preserves a 3-decimal-place (millisecond) offset exactly', () => {
    expect(fmt(0.1, 0, 0.001)).toBe(`${base}.100`);
  });

  it('proves sub-microsecond-adjacent offsets produce different labels (no precision collapse)', () => {
    const a = fmt(0.000001, 0, 0.0000001);
    const b = fmt(0.000002, 0, 0.0000001);
    expect(a).not.toBe(b);
    expect(a).toBe(`${base}.000001`);
    expect(b).toBe(`${base}.000002`);
  });

  it('handles the toFixed() rounding-carry edge case without silently mislabeling the second', () => {
    // 0.9999996 rounds to "1.000000" under naive toFixed(6) — must carry into the
    // next whole second instead of displaying a false ".000000" on the current one.
    const label = fmt(0.9999996, 0, 0.0000001);
    const expectedBase = fmtSecond(new Date(originSeconds * 1000 + 1000)); // one second later
    expect(label).toBe(`${expectedBase}.000000`);
  });
});

describe('dataXToEpochSeconds / epochSecondsToDataX — round trip', () => {
  const timeOriginMs = Date.UTC(2024, 2, 14, 12, 34, 56, 0);

  it('round-trips through both directions for seconds units', () => {
    // Tolerance reflects real double-precision error at epoch magnitude (~1.7e9),
    // not a bug: adding then subtracting a ~1.7e9 reference loses ~1e-7s of
    // precision, which is exactly the inherent-limitation caveat F40 documents.
    const x = 1234.567891;
    const epochSeconds = dataXToEpochSeconds(x, timeOriginMs, 1);
    expect(epochSecondsToDataX(epochSeconds, timeOriginMs, 1)).toBeCloseTo(x, 6);
  });

  it('round-trips through both directions for ms units', () => {
    const x = 1234567.891;
    const epochSeconds = dataXToEpochSeconds(x, timeOriginMs, 1000);
    expect(epochSecondsToDataX(epochSeconds, timeOriginMs, 1000)).toBeCloseTo(x, 3);
  });

  it('x=0 maps to exactly the reference origin', () => {
    expect(dataXToEpochSeconds(0, timeOriginMs, 1)).toBeCloseTo(timeOriginMs / 1000, 9);
  });
});
