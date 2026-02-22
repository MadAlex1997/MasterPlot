/**
 * RollingLineExample — demonstrates 30-second rolling expiration on a line plot.
 *
 * Three live signals are appended every 200 ms. Data older than 30 seconds is
 * trimmed from the path arrays on each tick — the left edge of the plot visibly
 * advances, showing expiration in real time.
 *
 * X-axis: elapsed seconds since start (wall-clock time)
 * Y-axis: signal amplitude (auto-fits on each tick)
 *
 * Controls:
 *   Pause / Resume — freeze / resume live append
 *   Scroll wheel   — zoom
 *   Drag           — pan
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { LinePlotController } from '../src/plot/LinePlotController.js';

// ── Config ────────────────────────────────────────────────────────────────────

const WINDOW_SECS    = 30;          // seconds of data to retain
const TICK_MS        = 200;         // append interval (ms)
const SAMPLES_PER_TICK = 20;        // points appended per signal per tick
const TICK_DURATION  = TICK_MS / 1000;  // seconds covered per tick

const SIGNALS = [
  { id: 'A', color: [0,   220, 220, 220], label: 'A' },
  { id: 'B', color: [255, 160,  40, 220], label: 'B' },
  { id: 'C', color: [100, 230,  80, 220], label: 'C' },
];

// ── Signal generators (independent per signal) ────────────────────────────────

function makeSineNoiseGen(freq, amplitude, noiseScale) {
  let phase = Math.random() * Math.PI * 2;
  return function generateSamples(xBase, count) {
    const out = new Float32Array(count);
    const dt = TICK_DURATION / count;
    for (let i = 0; i < count; i++) {
      const t = xBase + i * dt;
      out[i] = amplitude * Math.sin(2 * Math.PI * freq * t + phase)
             + noiseScale * (Math.random() - 0.5);
    }
    return out;
  };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RollingLineExample() {
  const webglRef      = useRef(null);
  const axisRef       = useRef(null);
  const controllerRef = useRef(null);
  const startTimeRef  = useRef(null);   // Date.now() at mount
  const intervalRef   = useRef(null);
  const pausedRef     = useRef(false);

  const [log,        setLog]        = useState([]);
  const [paused,     setPaused]     = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 25));
  }, []);

  // ── tick ───────────────────────────────────────────────────────────────────

  const doTick = useCallback((ctrl, generators) => {
    if (pausedRef.current) return;

    const now = (Date.now() - startTimeRef.current) / 1000;  // seconds elapsed
    const xWindowMin = now - WINDOW_SECS;

    // Append new samples for each signal
    for (let s = 0; s < SIGNALS.length; s++) {
      const sig = SIGNALS[s];
      const xBase = now - TICK_DURATION;
      const samples = generators[s](xBase, SAMPLES_PER_TICK);
      ctrl.appendSignalData(sig.id, samples, xBase);
    }

    // Trim data older than the rolling window
    const prevCount = ctrl.getPointCount();
    ctrl.trimBefore(xWindowMin);
    const trimmed = prevCount - ctrl.getPointCount();

    // Keep x domain = [now - WINDOW_SECS, now], y auto-fit
    let yMin = Infinity, yMax = -Infinity;
    for (const sig of SIGNALS) {
      // Access path data through the internal map — safe for example code
      const internal = ctrl._signals.get(sig.id);
      if (!internal) continue;
      for (const pt of internal.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
    }
    const yPad = (yMax - yMin) * 0.08 || 0.5;
    ctrl.setDomains(
      [xWindowMin, now],
      [yMin - yPad, yMax + yPad]
    );

    const totalPts = ctrl.getPointCount();
    setPointCount(totalPts);
    setElapsedSec(Math.floor(now));

    if (trimmed > 0) {
      addLog(`expired: −${trimmed} pts  window=[${xWindowMin.toFixed(1)}s, ${now.toFixed(1)}s]  live=${totalPts}`);
    }
  }, [addLog]);

  // ── mount ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const wc = webglRef.current;
    const ac = axisRef.current;
    if (!wc || !ac) return;

    // Signal generators — one per signal, stable across ticks
    const generators = [
      makeSineNoiseGen(0.3, 1.0, 0.15),
      makeSineNoiseGen(0.7, 0.7, 0.20),
      makeSineNoiseGen(0.15, 1.3, 0.10),
    ];

    const raf = requestAnimationFrame(() => {
      wc.width  = wc.offsetWidth  || 800;
      wc.height = wc.offsetHeight || 600;
      ac.width  = wc.width;
      ac.height = wc.height;

      const ctrl = new LinePlotController({
        xDomain: [0, WINDOW_SECS],
        yDomain: [-2, 2],
        xLabel:  'time (s)',
        yLabel:  'amplitude',
      });

      for (const sig of SIGNALS) ctrl.addSignal(sig.id, sig.color);
      ctrl.init(wc, ac);

      ctrl.on('zoomChanged', d => addLog(`zoom: ×${d.factor.toFixed(2)}`));
      ctrl.on('panChanged',  d => {
        if (Math.abs(d.dx) + Math.abs(d.dy) > 5)
          addLog(`pan: dx=${d.dx.toFixed(0)} dy=${d.dy.toFixed(0)}`);
      });

      startTimeRef.current = Date.now();
      controllerRef.current = ctrl;

      // Initial tick then start interval
      doTick(ctrl, generators);
      intervalRef.current = setInterval(() => doTick(ctrl, generators), TICK_MS);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── UI handlers ────────────────────────────────────────────────────────────

  const handlePauseToggle = () => {
    const next = !pausedRef.current;
    pausedRef.current = next;
    setPaused(next);
    addLog(next ? 'paused' : 'resumed');
  };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const S = {
    container: {
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: '#0d0d0d', color: '#ccc', fontFamily: 'monospace',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 16,
      padding: '6px 16px', background: '#151515',
      borderBottom: '1px solid #333', fontSize: 12, flexShrink: 0,
    },
    plotWrap: { flex: 1, position: 'relative', overflow: 'hidden' },
    canvas:   { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
    logPanel: {
      height: 130, background: '#0a0a0a', borderTop: '1px solid #222',
      overflowY: 'auto', padding: '4px 12px', fontSize: 11, flexShrink: 0,
    },
    btn: {
      background: '#222', border: '1px solid #444', borderRadius: 3,
      color: '#ccc', padding: '2px 10px', cursor: 'pointer', fontSize: 12,
    },
    badge: (color) => ({
      background: color, borderRadius: 3, padding: '1px 7px',
      color: '#000', fontWeight: 700, fontSize: 11,
    }),
  };

  const legendDot = (color) => (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: `rgb(${color[0]},${color[1]},${color[2]})`, marginRight: 4,
    }} />
  );

  return (
    <div style={S.container}>
      <div style={S.header}>
        <strong style={{ color: '#fff', fontSize: 14 }}>
          MasterPlot — Rolling 30s Window
        </strong>
        <span style={{ color: '#555' }}>|</span>

        {/* Signal legend */}
        <span style={{ color: '#888' }}>
          {SIGNALS.map(s => (
            <span key={s.id}>{legendDot(s.color)}{s.label}&nbsp;&nbsp;</span>
          ))}
        </span>

        <span style={{ color: '#555' }}>|</span>

        {/* Window indicator */}
        <span style={{ color: '#7df' }}>
          window: {WINDOW_SECS}s
        </span>

        {/* Elapsed time */}
        <span style={{ color: '#888' }}>
          t = {elapsedSec}s
        </span>

        {/* Live point count */}
        <span style={S.badge('#2a3a2a')}>
          <span style={{ color: '#6f6' }}>{pointCount.toLocaleString()} pts live</span>
        </span>

        {/* Pause button */}
        <button style={{ ...S.btn, borderColor: paused ? '#f84' : '#444' }}
          onClick={handlePauseToggle}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>
          scroll=zoom · drag=pan
        </span>
      </div>

      <div style={S.plotWrap}>
        <canvas ref={webglRef} style={S.canvas} />
        <canvas ref={axisRef}  style={{ ...S.canvas, pointerEvents: 'none' }} />
      </div>

      <div style={S.logPanel}>
        {log.map((msg, i) => (
          <div key={i} style={{
            color: msg.startsWith('expired') ? '#fa8' : i === 0 ? '#adf' : '#556',
            lineHeight: '1.5',
          }}>
            {msg}
          </div>
        ))}
        {log.length === 0 && (
          <span style={{ color: '#333' }}>
            Expiry events appear here after {WINDOW_SECS}s…
          </span>
        )}
      </div>
    </div>
  );
}
