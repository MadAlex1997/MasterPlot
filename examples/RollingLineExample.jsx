/**
 * RollingLineExample — demonstrates 30-second rolling expiration on a line plot.
 *
 * Migrated in ARCH-D: LinePlotController replaced by PlotController + SignalStore.
 *
 * Three live deterministic sin/cos signals are appended every 200 ms.
 * Signals are vertically offset so they never overlap, making it trivially
 * easy to see the wave shape and rolling expiration simultaneously.
 *
 * Wave formula (EX3):
 *   amplitude = 1, spacing = 3
 *   offset_i  = i * (2 * amplitude + spacing)   → 0, 5, 10 for i = 0..2
 *   even i → amplitude * sin(2π * FREQ * t) + offset_i
 *   odd  i → amplitude * cos(2π * FREQ * t) + offset_i
 *   t = wall-clock seconds elapsed since start
 *
 * Data older than WINDOW_SECS is trimmed from the path arrays each tick —
 * the left edge of the plot visibly advances.
 *
 * X-axis: elapsed seconds since start (wall-clock time)
 * Y-axis: signal amplitude (offset bands)
 *
 * Controls:
 *   Pause / Resume — freeze / resume live append
 *   Scroll wheel   — zoom
 *   Drag           — pan
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController } from '../src/plot/PlotController.js';
import { SignalStore }    from '../src/plot/layers/SignalDataLayer.js';

// ── Config ────────────────────────────────────────────────────────────────────

const WINDOW_SECS      = 30;           // seconds of data to retain
const TICK_MS          = 200;          // append interval (ms)
const SAMPLES_PER_TICK = 20;           // points appended per signal per tick
const TICK_DURATION    = TICK_MS / 1000;  // seconds covered per tick
const AMPLITUDE        = 1;
const SPACING          = 3;
const FREQ             = 0.4;          // Hz — one full cycle every 2.5 s

const SIGNALS = [
  { id: 'A', color: [0,   220, 220, 220], label: 'A (sin)' },
  { id: 'B', color: [255, 160,  40, 220], label: 'B (cos)' },
  { id: 'C', color: [100, 230,  80, 220], label: 'C (sin)' },
];

/** Vertical offset for signal i so bands don't overlap. */
function signalOffset(i) {
  return i * (2 * AMPLITUDE + SPACING);
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function RollingLineExample() {
  const webglRef      = useRef(null);
  const axisRef       = useRef(null);
  const controllerRef = useRef(null);
  const signalsRef    = useRef(null);    // SignalStore — not React state
  const startTimeRef  = useRef(null);    // Date.now() at mount
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

  const doTick = useCallback((ctrl, signals) => {
    if (pausedRef.current) return;

    const now        = (Date.now() - startTimeRef.current) / 1000;  // seconds elapsed
    const xWindowMin = now - WINDOW_SECS;
    const dt         = TICK_DURATION / SAMPLES_PER_TICK;  // seconds per sample

    // Append one sample at a time so x = exact wall-clock time.
    // appendSignalData does: path.push([xBase + i, y, 0]) for each i.
    // With a single-element call (count=1), x = xBase + 0 = t ✓.
    SIGNALS.forEach((sig, i) => {
      const offset = signalOffset(i);
      for (let s = 0; s < SAMPLES_PER_TICK; s++) {
        const t = now - TICK_DURATION + s * dt;
        const y = (i % 2 === 0)
          ? AMPLITUDE * Math.sin(2 * Math.PI * FREQ * t) + offset
          : AMPLITUDE * Math.cos(2 * Math.PI * FREQ * t) + offset;
        signals.appendSignalData(sig.id, [y], t);
      }
    });

    // Trim data older than the rolling window
    const prevCount = signals.getPointCount();
    signals.trimBefore(xWindowMin);
    const trimmed = prevCount - signals.getPointCount();

    // y range is deterministic: [−AMPLITUDE, AMPLITUDE + maxOffset] + padding
    const numSigs = SIGNALS.length;
    const yBottom = -AMPLITUDE - 0.5;
    const yTop    = signalOffset(numSigs - 1) + AMPLITUDE + 0.5;

    ctrl.xAxis.setDomain([xWindowMin, now]);   // triggers dirty via _wireEvents
    ctrl.yAxis.setDomain([yBottom, yTop]);

    const totalPts = signals.getPointCount();
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

    const raf = requestAnimationFrame(() => {
      wc.width  = wc.offsetWidth  || 800;
      wc.height = wc.offsetHeight || 600;
      ac.width  = wc.width;
      ac.height = wc.height;

      const numSigs = SIGNALS.length;

      const signals = new SignalStore();
      for (const sig of SIGNALS) signals.addSignal(sig.id, sig.color);

      const ctrl = new PlotController({
        xDomain:                 [0, WINDOW_SECS],
        yDomain:                 [-AMPLITUDE - 0.5, signalOffset(numSigs - 1) + AMPLITUDE + 0.5],
        xLabel:                  'time (s)',
        yLabel:                  'amplitude',
        panMode:                 'drag',
        disableDefaultDataLayer: true,
      });

      ctrl.registerDataLayer('signals', signals.toLayerDef().build);
      ctrl.init(wc, ac);

      ctrl.on('zoomChanged', d => addLog(`zoom: ×${d.factor.toFixed(2)}`));
      ctrl.on('panChanged',  d => {
        if (Math.abs(d.dx) + Math.abs(d.dy) > 5)
          addLog(`pan: dx=${d.dx.toFixed(0)} dy=${d.dy.toFixed(0)}`);
      });

      startTimeRef.current  = Date.now();
      controllerRef.current = ctrl;
      signalsRef.current    = signals;

      // Initial tick then start interval
      doTick(ctrl, signals);
      intervalRef.current = setInterval(() => doTick(ctrl, signals), TICK_MS);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
      signalsRef.current    = null;
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
