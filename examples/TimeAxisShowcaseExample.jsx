/**
 * TimeAxisShowcaseExample — EX22
 *
 * Two-panel demo of Phase 11's time-axis features:
 *   Panel 1 (F39) — a normal scaleType:'time' x-axis with a real Date/ms domain,
 *     zoomable from a multi-year span down to sub-minute, showing d3-scale's
 *     multi-granularity default tick formatter auto-switch.
 *   Panel 2 (F40) — a timeOrigin-configured PlotController with synthetic
 *     microsecond-spaced sample data (simulated 200 kHz sensor), showing
 *     .ssssss-precision tick labels and non-aliased point positions when
 *     zoomed into a sub-millisecond span — the epoch-offset pattern that
 *     works around DataStore's Float32Array x-buffer precision limit.
 */

import { useRef, useEffect, useState } from 'react';
import { PlotController } from '../src/plot/PlotController.js';
import HelpOverlay         from '../ui/HelpOverlay.jsx';

// ── Panel 1 data: sparse "sensor readings" spread across ~2 years ──────────
// Real epoch-ms values as data-x (the ordinary, pre-existing scaleType:'time'
// convention) — fine for a sparse dataset viewed at date/hour granularity;
// microsecond-precision point positions are Panel 2's concern, not this one.

function makeCalendarData() {
  const N = 180;
  const start = Date.UTC(2023, 0, 1);
  const spanMs = 2 * 365 * 24 * 3600 * 1000; // ~2 years
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const color = new Uint8Array(N * 4);
  const size = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const t = start + (i / (N - 1)) * spanMs;
    x[i] = t;
    const days = (t - start) / 86400000;
    y[i] = 20 + 10 * Math.sin((2 * Math.PI * days) / 365) + (Math.sin(days * 3.1) * 1.5);
    color.set([120, 190, 255, 210], i * 4);
    size[i] = 5;
  }
  return { x, y, color, size };
}

// ── Panel 2 data: 200 kHz synthetic sensor, 5 kHz tone over a 20 ms window ─
// Offsets are seconds since timeOrigin (F40's recommended units) — small
// numbers, so they fit Float32Array precision without any aliasing.

function makeHighFreqData(originMs) {
  const sampleRateHz = 200_000;
  const durationSec  = 0.02; // 20 ms -> 4000 samples
  const toneHz       = 5_000;
  const N = Math.round(durationSec * sampleRateHz);
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const color = new Uint8Array(N * 4);
  const size = new Float32Array(N);

  for (let i = 0; i < N; i++) {
    const tSec = i / sampleRateHz; // offset from originMs, in seconds
    x[i] = tSec;
    y[i] = Math.sin(2 * Math.PI * toneHz * tSec) + 0.15 * Math.sin(2 * Math.PI * 47_000 * tSec);
    color.set([255, 170, 90, 210], i * 4);
    size[i] = 3;
  }
  return { x, y, color, size, originMs };
}

// ── Shared plot-cell shell ───────────────────────────────────────────────────

function PlotCell({ title, sub, makeCtrl, onController }) {
  const webglRef = useRef(null);
  const axisRef  = useRef(null);
  const ctrlRef  = useRef(null);

  useEffect(() => {
    const wc = webglRef.current;
    const ac = axisRef.current;
    if (!wc || !ac) return;

    const ctrl = makeCtrl();
    ctrlRef.current = ctrl;

    const raf = requestAnimationFrame(() => {
      if (!webglRef.current) return;
      const w = wc.offsetWidth  || 700;
      const h = wc.offsetHeight || 320;
      wc.width = w; wc.height = h;
      ac.width = w; ac.height = h;

      ctrl.init(wc, ac);
      if (onController) onController(ctrl);
    });

    return () => {
      cancelAnimationFrame(raf);
      ctrl.destroy();
      ctrlRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const wrapStyle = {
    display: 'flex', flexDirection: 'column',
    background: '#0d0d0d', border: '1px solid #333', borderRadius: 4, overflow: 'hidden',
  };
  const canvasWrap = { position: 'relative', height: 320 };
  const canvasStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
  const titleStyle = { padding: '6px 10px 2px', color: '#e0e0e0', fontSize: 13, fontFamily: 'monospace', fontWeight: 'bold' };
  const subStyle = { padding: '0 10px 6px', color: '#888', fontSize: 11, fontFamily: 'monospace' };

  return (
    <div style={wrapStyle}>
      <div style={titleStyle}>{title}</div>
      <div style={subStyle}>{sub}</div>
      <div style={canvasWrap}>
        <canvas ref={webglRef} style={canvasStyle} />
        <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function TimeAxisShowcaseExample() {
  const [calendarRange, setCalendarRange] = useState('');
  const [highFreqRange, setHighFreqRange] = useState('');
  const originMsRef = useRef(Date.now());

  const makeCalendarCtrl = () => {
    const ctrl = new PlotController({
      xScaleType: 'time',
      xDomain: [Date.UTC(2023, 0, 1), Date.UTC(2024, 11, 31)],
      yDomain: [0, 45],
      autoExpand: false,
      xLabel: 'Date', yLabel: 'Reading',
    });
    ctrl.on('domainChanged', ({ xDomain }) => {
      const [a, b] = xDomain;
      setCalendarRange(`${new Date(a).toISOString()}  →  ${new Date(b).toISOString()}`);
    });
    return ctrl;
  };

  const makeHighFreqCtrl = () => {
    const originMs = originMsRef.current;
    const ctrl = new PlotController({
      timeOrigin: originMs,
      timeOriginUnits: 'seconds',
      xDomain: [0, 0.02],
      yDomain: [-1.3, 1.3],
      autoExpand: false,
      yLabel: 'Amplitude',
    });
    ctrl.on('domainChanged', ({ xDomain }) => {
      const [a, b] = xDomain;
      const es0 = ctrl.dataXToEpochSeconds(a);
      const es1 = ctrl.dataXToEpochSeconds(b);
      const spanUs = (es1 - es0) * 1e6;
      setHighFreqRange(
        `offset ${a.toFixed(6)}s → ${b.toFixed(6)}s  ·  epoch ${es0.toFixed(6)} → ${es1.toFixed(6)}  ·  span ${spanUs.toFixed(1)} µs`
      );
    });
    return ctrl;
  };

  const outerStyle = {
    width: '100%', minHeight: '100vh', background: '#0d0d0d', color: '#e0e0e0',
    fontFamily: 'monospace', padding: 16, boxSizing: 'border-box',
    display: 'flex', flexDirection: 'column', gap: 14, position: 'relative',
  };
  const headerStyle = { fontSize: 15, fontWeight: 'bold', color: '#7df' };
  const hintStyle = { fontSize: 11, color: '#666' };
  const readoutStyle = { fontSize: 11, color: '#9c9', padding: '2px 0 8px' };

  return (
    <div style={outerStyle}>
      <div style={headerStyle}>Time Axis Showcase — EX22 (F39 / F40)</div>
      <div style={hintStyle}>
        Scroll to zoom · Drag to pan. Panel 1 demonstrates F39's multi-granularity tick
        formatter (zoom from years down to minutes). Panel 2 demonstrates F40's epoch-offset
        pattern (zoom into the waveform to see microsecond-precision tick labels).
      </div>

      <div>
        <PlotCell
          title="Panel 1 — scaleType: 'time' (F39)"
          sub="Real Date/ms domain · d3-scale's built-in multi-granularity default tickFormat"
          makeCtrl={makeCalendarCtrl}
        />
        <div style={readoutStyle}>Visible range: {calendarRange}</div>
      </div>

      <div>
        <PlotCell
          title="Panel 2 — timeOrigin epoch-offset (F40)"
          sub={`Synthetic 200 kHz sensor · 5 kHz tone · timeOrigin = ${new Date(originMsRef.current).toISOString()}`}
          makeCtrl={makeHighFreqCtrl}
        />
        <div style={readoutStyle}>{highFreqRange}</div>
      </div>

      <HelpOverlay
        storageKey="masterplot-help-ex22-time-axis"
        title="Time Axis Showcase Controls"
        controls={[
          { key: 'Scroll',                    description: 'Zoom in / out (cursor-centered)' },
          { key: 'Drag',                      description: 'Pan the view' },
          { key: 'Right-drag',                description: 'Box-zoom' },
          { key: 'Panel 1',                   description: 'Zoom in to watch tick labels switch from dates to times (F39)' },
          { key: 'Panel 2',                   description: 'Zoom in on the waveform to see microsecond tick labels (F40)' },
        ]}
      />
    </div>
  );
}
