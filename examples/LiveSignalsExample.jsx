/**
 * LiveSignalsExample — unified Live Signal Analysis page (EX8).
 *
 * Replaces LineExample and RollingLineExample with a single page that combines:
 *   - Wall-clock X-axis with a configurable rolling window (10 s / 30 s / 60 s)
 *   - Three deterministic sin/cos signals (A, B, C) appended every 200 ms
 *   - LinearRegion ROI (L key) with a live stats sidebar:
 *       Mean, RMS, and peak-to-peak per signal inside the selected region
 *   - Pause/Resume, live point count, event log (last 25 entries)
 *
 * Wave formula (same as EX3/RollingLineExample):
 *   amplitude = 1, spacing = 3
 *   offset_i  = i * (2 * amplitude + spacing)   → 0, 5, 10 for i = 0..2
 *   even i → amplitude * sin(2π * FREQ * t) + offset_i
 *   odd  i → amplitude * cos(2π * FREQ * t) + offset_i
 *   t = wall-clock seconds elapsed since start
 *
 * No engine changes — PlotController, SignalStore, ROIController, AxisController
 * are used as-is.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController } from '../src/plot/PlotController.js';
import { SignalStore }    from '../src/plot/layers/SignalDataLayer.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const SIGNALS = [
  { id: 'A', color: [0,   220, 220, 220], label: 'A (sin)' },
  { id: 'B', color: [255, 160,  40, 220], label: 'B (cos)' },
  { id: 'C', color: [100, 230,  80, 220], label: 'C (sin)' },
];

const WINDOW_OPTIONS      = [10, 30, 60];   // seconds
const DEFAULT_WINDOW_SECS = 30;
const TICK_MS             = 200;
const SAMPLES_PER_TICK    = 20;
const TICK_DURATION       = TICK_MS / 1000; // seconds covered per tick
const FREQ                = 0.4;            // Hz — one full cycle every 2.5 s
const AMPLITUDE           = 1;
const SPACING             = 3;

/** Vertical offset for signal i so bands don't overlap. */
function signalOffset(i) {
  return i * (2 * AMPLITUDE + SPACING);
}

// y bounds are deterministic given signal configuration
const Y_BOTTOM = -AMPLITUDE - 0.5;
const Y_TOP    = signalOffset(SIGNALS.length - 1) + AMPLITUDE + 0.5;

// ── Component ─────────────────────────────────────────────────────────────────

export default function LiveSignalsExample() {
  // ── Refs (not React state — engine-owned) ─────────────────────────────────
  const webglRef      = useRef(null);
  const axisRef       = useRef(null);
  const controllerRef = useRef(null);
  const signalsRef    = useRef(null);
  const startTimeRef  = useRef(null);
  const intervalRef   = useRef(null);
  const pausedRef     = useRef(false);
  const windowSecsRef = useRef(DEFAULT_WINDOW_SECS); // mirrors windowSecs without re-mount

  // ── React state (UI only) ─────────────────────────────────────────────────
  const [windowSecs, setWindowSecs] = useState(DEFAULT_WINDOW_SECS);
  const [paused,     setPaused]     = useState(false);
  const [pointCount, setPointCount] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [log,        setLog]        = useState([]);
  const [roiStats,   setRoiStats]   = useState(null);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 25));
  }, []);

  // ── Stats computation (pure JS, no engine changes) ────────────────────────

  const computeAndSetStats = useCallback((roi) => {
    const signals = signalsRef.current;
    if (!signals) return;
    const x1 = roi.x1;
    const x2 = roi.x2;

    const sigStats = SIGNALS.map(sig => {
      const sigData = signals.getSignal(sig.id);
      if (!sigData) return { id: sig.id, label: sig.label, mean: null, rms: null, peakToPeak: null, count: 0 };

      const pts = sigData.path.filter(pt => pt[0] >= x1 && pt[0] <= x2);
      const n   = pts.length;
      if (n === 0) return { id: sig.id, label: sig.label, mean: null, rms: null, peakToPeak: null, count: 0 };

      let sum = 0, sumSq = 0, yMin = Infinity, yMax = -Infinity;
      for (const pt of pts) {
        sum   += pt[1];
        sumSq += pt[1] * pt[1];
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
      return {
        id: sig.id, label: sig.label,
        mean:        sum / n,
        rms:         Math.sqrt(sumSq / n),
        peakToPeak:  yMax - yMin,
        count:       n,
      };
    });

    setRoiStats({ x1: roi.x1, x2: roi.x2, signals: sigStats });
  }, []); // signalsRef and setRoiStats are stable

  // ── Tick ──────────────────────────────────────────────────────────────────

  const doTick = useCallback((ctrl, signals) => {
    if (pausedRef.current) return;

    const now        = (Date.now() - startTimeRef.current) / 1000; // seconds elapsed
    const windowSecs = windowSecsRef.current;
    const xWindowMin = now - windowSecs;
    const dt         = TICK_DURATION / SAMPLES_PER_TICK; // seconds per sample

    // Append SAMPLES_PER_TICK samples per signal at exact wall-clock x values
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

    // Rolling trim
    const prevCount = signals.getPointCount();
    signals.trimBefore(xWindowMin);
    const trimmed = prevCount - signals.getPointCount();

    ctrl.xAxis.setDomain([xWindowMin, now]); // triggers dirty via _wireEvents
    ctrl.yAxis.setDomain([Y_BOTTOM, Y_TOP]);

    const totalPts = signals.getPointCount();
    setPointCount(totalPts);
    setElapsedSec(Math.floor(now));

    if (trimmed > 0) {
      addLog(`expired: −${trimmed} pts  window=[${xWindowMin.toFixed(1)}s, ${now.toFixed(1)}s]`);
    }

    // Expire LinearRegions that have scrolled entirely off the left edge
    ctrl.roiController.getAllROIs()
      .filter(r => r.type === 'linearRegion' && r.x2 <= xWindowMin)
      .forEach(r => {
        ctrl.roiController.deleteROI(r.id);
        addLog(`roiExpired: LinearRegion ${r.id} scrolled out of window`);
        setRoiStats(null);
      });

    // Re-run stats if a LinearRegion ROI still exists
    const lr = ctrl.roiController.getAllROIs().find(r => r.type === 'linearRegion');
    if (lr) computeAndSetStats(lr);
  }, [addLog, computeAndSetStats]);

  // ── Mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const wc = webglRef.current;
    const ac = axisRef.current;
    if (!wc || !ac) return;

    const raf = requestAnimationFrame(() => {
      wc.width  = wc.offsetWidth  || 800;
      wc.height = wc.offsetHeight || 600;
      ac.width  = wc.width;
      ac.height = wc.height;

      const signals = new SignalStore();
      for (const sig of SIGNALS) signals.addSignal(sig.id, sig.color);

      const ctrl = new PlotController({
        xDomain:                 [0, DEFAULT_WINDOW_SECS],
        yDomain:                 [Y_BOTTOM, Y_TOP],
        xLabel:                  'time (s)',
        yLabel:                  'amplitude',
        panMode:                 'drag',
        disableDefaultDataLayer: true,
      });

      ctrl.registerDataLayer('signals', signals.toLayerDef().build);
      ctrl.init(wc, ac);

      // ── ROI event wiring ────────────────────────────────────────────────
      let debounceTimer = null;

      ctrl.on('roiCreated', ({ roi }) => {
        addLog(`roiCreated: ${roi.type} id=${roi.id}`);
      });

      ctrl.on('roiFinalized', ({ roi }) => {
        addLog(`roiFinalized: ${roi.type} id=${roi.id}`);
        if (roi.type === 'linearRegion') computeAndSetStats(roi);
      });

      ctrl.on('roiUpdated', ({ roi }) => {
        if (roi.type !== 'linearRegion') return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => computeAndSetStats(roi), 100);
      });

      ctrl.on('roiDeleted', () => {
        addLog('roiDeleted');
        const lr = ctrl.roiController.getAllROIs().find(r => r.type === 'linearRegion');
        if (!lr) setRoiStats(null);
      });

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

  const handleWindowChange = (newSecs) => {
    windowSecsRef.current = newSecs;
    setWindowSecs(newSecs);

    const signals = signalsRef.current;
    const ctrl    = controllerRef.current;
    if (!signals || !ctrl) return;

    const now = (Date.now() - startTimeRef.current) / 1000;
    const xWindowMin = now - newSecs;
    signals.trimBefore(xWindowMin);
    ctrl.xAxis.setDomain([xWindowMin, now]);
    addLog(`window changed → ${newSecs}s`);
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const S = {
    container: {
      display: 'flex', flexDirection: 'column',
      width: '100vw', height: '100vh',
      background: '#0d0d0d', color: '#ccc', fontFamily: 'monospace',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 16px', background: '#151515',
      borderBottom: '1px solid #333', fontSize: 12, flexShrink: 0,
      flexWrap: 'wrap',
    },
    midRow: {
      flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden',
    },
    plotWrap: {
      flex: 1, position: 'relative', overflow: 'hidden',
    },
    canvas: {
      position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
    },
    sidebar: {
      width: 220, flexShrink: 0,
      display: 'flex', flexDirection: 'column',
      background: '#111', borderLeft: '1px solid #222',
      padding: '10px 12px', gap: 8, overflowY: 'auto',
    },
    logPanel: {
      height: 130, background: '#0a0a0a', borderTop: '1px solid #222',
      overflowY: 'auto', padding: '4px 12px', fontSize: 11, flexShrink: 0,
    },
    btn: {
      background: '#222', border: '1px solid #444', borderRadius: 3,
      color: '#ccc', padding: '2px 10px', cursor: 'pointer', fontSize: 12,
    },
    select: {
      background: '#1a1a1a', border: '1px solid #444', borderRadius: 3,
      color: '#ccc', padding: '2px 6px', fontSize: 12, cursor: 'pointer',
    },
    badge: (color) => ({
      background: color, borderRadius: 3, padding: '1px 7px',
      color: '#000', fontWeight: 700, fontSize: 11,
    }),
    sidebarTitle: {
      fontSize: 11, fontWeight: 700, color: '#7df',
      borderBottom: '1px solid #222', paddingBottom: 4, marginBottom: 2,
    },
    statsTable: {
      width: '100%', borderCollapse: 'collapse', fontSize: 10,
    },
    th: {
      color: '#555', padding: '2px 4px', textAlign: 'right', fontWeight: 'normal',
    },
    td: {
      color: '#aaa', padding: '2px 4px', textAlign: 'right',
    },
    tdLabel: {
      color: '#888', padding: '2px 4px', textAlign: 'left',
    },
  };

  const legendDot = (color) => (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: `rgb(${color[0]},${color[1]},${color[2]})`, marginRight: 4,
    }} />
  );

  const fmt = (v) => v == null ? '—' : v.toFixed(3);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={S.container}>
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div style={S.header}>
        <strong style={{ color: '#fff', fontSize: 14 }}>
          MasterPlot — Live Signal Analysis
        </strong>
        <span style={{ color: '#555' }}>|</span>

        {/* Signal legend */}
        <span style={{ color: '#888' }}>
          {SIGNALS.map(s => (
            <span key={s.id}>{legendDot(s.color)}{s.label}&nbsp;&nbsp;</span>
          ))}
        </span>

        <span style={{ color: '#555' }}>|</span>

        {/* Rolling window dropdown */}
        <span style={{ color: '#7df' }}>window:</span>
        <select style={S.select} value={windowSecs}
          onChange={e => handleWindowChange(Number(e.target.value))}>
          {WINDOW_OPTIONS.map(w => (
            <option key={w} value={w}>{w}s</option>
          ))}
        </select>

        {/* Elapsed + point count */}
        <span style={{ color: '#888' }}>t = {elapsedSec}s</span>
        <span style={S.badge('#2a3a2a')}>
          <span style={{ color: '#6f6' }}>{pointCount.toLocaleString()} pts live</span>
        </span>

        {/* Pause button */}
        <button style={{ ...S.btn, borderColor: paused ? '#f84' : '#444' }}
          onClick={handlePauseToggle}>
          {paused ? '▶ Resume' : '⏸ Pause'}
        </button>

        <span style={{ marginLeft: 'auto', color: '#555', fontSize: 11 }}>
          L=LinearRegion · D=delete · scroll=zoom · drag=pan
        </span>
      </div>

      {/* ── Middle row: plot + sidebar ───────────────────────────────────── */}
      <div style={S.midRow}>
        {/* WebGL plot canvas */}
        <div style={S.plotWrap}>
          <canvas ref={webglRef} style={S.canvas} />
          <canvas ref={axisRef}  style={{ ...S.canvas, pointerEvents: 'none' }} />
        </div>

        {/* Stats sidebar */}
        <div style={S.sidebar}>
          <div style={S.sidebarTitle}>ROI Stats</div>

          {roiStats === null ? (
            <div style={{ color: '#444', fontSize: 11, lineHeight: 1.6 }}>
              Press <strong style={{ color: '#666' }}>L</strong> to draw a LinearRegion<br />
              then click twice to set x1 and x2.
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, color: '#666' }}>
                x1 = {roiStats.x1.toFixed(2)}s<br />
                x2 = {roiStats.x2.toFixed(2)}s
              </div>
              <table style={S.statsTable}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, textAlign: 'left' }}>Sig</th>
                    <th style={S.th}>Mean</th>
                    <th style={S.th}>RMS</th>
                    <th style={S.th}>P–P</th>
                    <th style={S.th}>n</th>
                  </tr>
                </thead>
                <tbody>
                  {roiStats.signals.map(s => (
                    <tr key={s.id}>
                      <td style={S.tdLabel}>
                        {legendDot(SIGNALS.find(x => x.id === s.id).color)}{s.id}
                      </td>
                      <td style={S.td}>{fmt(s.mean)}</td>
                      <td style={S.td}>{fmt(s.rms)}</td>
                      <td style={S.td}>{fmt(s.peakToPeak)}</td>
                      <td style={S.td}>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>

      {/* ── Event log ────────────────────────────────────────────────────── */}
      <div style={S.logPanel}>
        {log.map((msg, i) => (
          <div key={i} style={{
            color: msg.startsWith('expired') ? '#fa8'
                 : msg.startsWith('roi')     ? '#af8'
                 : i === 0                   ? '#adf' : '#556',
            lineHeight: '1.5',
          }}>
            {msg}
          </div>
        ))}
        {log.length === 0 && (
          <span style={{ color: '#333' }}>
            Events appear here — press L to draw a LinearRegion ROI…
          </span>
        )}
      </div>
    </div>
  );
}
