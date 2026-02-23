/**
 * LineExample — demonstrates buildLineLayer / PathLayer via LinePlotController.
 *
 * Three deterministic sin/cos signals (A, B, C) are appended live and
 * vertically offset so they never overlap, making rolling expiration easy to
 * observe.  Each signal accumulates 500 new samples per tick (every 1 second).
 *
 * Wave formula (EX3):
 *   amplitude = 1, spacing = 3
 *   offset_i  = i * (2 * amplitude + spacing)   → 0, 5, 10 for i = 0..2
 *   even i → amplitude * sin(t) + offset_i
 *   odd  i → amplitude * cos(t) + offset_i
 *   t increments by TIME_STEP per sample (continuous, never resets)
 *
 * Rolling window: the last WINDOW_SAMPLES samples stay visible; older
 * points are evicted via LinePlotController.trimBefore() each tick.
 *
 * Controls:
 *   Live append checkbox — start/stop the 1-second append interval
 *   Reset button        — clear all signals and restart
 *
 * Interaction:
 *   Scroll wheel → zoom (centered on cursor)
 *   Drag         → pan (grab-and-drag)
 */

import { useRef, useEffect, useState } from 'react';
import { LinePlotController } from '../src/plot/LinePlotController.js';

// ── Signal configuration ──────────────────────────────────────────────────────

const SIGNALS = [
  { id: 'A', color: [0,   220, 220, 220], label: 'A (sin, cyan)'   },
  { id: 'B', color: [255, 160,  40, 220], label: 'B (cos, orange)' },
  { id: 'C', color: [100, 230,  80, 220], label: 'C (sin, lime)'   },
];

const SAMPLES_PER_TICK = 500;
const TICK_MS          = 1000;
const AMPLITUDE        = 1;
const SPACING          = 3;
const TIME_STEP        = (2 * Math.PI) / 200;  // one full cycle per 200 samples
const WINDOW_SAMPLES   = 5000;                 // rolling: keep last 5 000 samples

/** Compute y-offset for signal index i. */
function signalOffset(i) {
  return i * (2 * AMPLITUDE + SPACING);
}

/**
 * Generate SAMPLES_PER_TICK deterministic sin/cos samples for signal i.
 * startSample is the global sample counter at the beginning of this tick.
 */
function generateWaveSamples(signalIndex, startSample, count) {
  const offset = signalOffset(signalIndex);
  const out    = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const t = (startSample + i) * TIME_STEP;
    out[i] = (signalIndex % 2 === 0)
      ? AMPLITUDE * Math.sin(t) + offset
      : AMPLITUDE * Math.cos(t) + offset;
  }
  return out;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LineExample() {
  const webglRef      = useRef(null);
  const axisRef       = useRef(null);
  const controllerRef = useRef(null);
  const intervalRef   = useRef(null);

  const [log,        setLog]        = useState([]);
  const [liveAppend, setLiveAppend] = useState(true);

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 20));

  // ── tick: append one round of deterministic wave samples ───────────────────

  const doTick = (ctrl) => {
    const xBase = ctrl.xCounter;
    SIGNALS.forEach((sig, i) => {
      const samples = generateWaveSamples(i, xBase, SAMPLES_PER_TICK);
      ctrl.appendSignalData(sig.id, samples, xBase);
    });
    ctrl.advanceXCounter(SAMPLES_PER_TICK);

    // Rolling expiration: remove points older than WINDOW_SAMPLES
    const xMin = ctrl.xCounter - WINDOW_SAMPLES;
    if (xMin > 0) ctrl.trimBefore(xMin);

    ctrl.expandDomains();
    addLog(`dataAppended: +${SAMPLES_PER_TICK} samples/signal  x=[${Math.max(0, ctrl.xCounter - WINDOW_SAMPLES)}, ${ctrl.xCounter}]`);
  };

  const startInterval = (ctrl) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => doTick(ctrl), TICK_MS);
  };

  // ── mount ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    const wc = webglRef.current;
    const ac = axisRef.current;
    if (!wc || !ac) return;

    const raf = requestAnimationFrame(() => {
      wc.width  = wc.offsetWidth  || 800;
      wc.height = wc.offsetHeight || 600;
      ac.width  = wc.width;
      ac.height = wc.height;

      // y-domain spans all three signal bands + padding
      const numSignals = SIGNALS.length;
      const yTop    = signalOffset(numSignals - 1) + AMPLITUDE + 0.5;
      const yBottom = -AMPLITUDE - 0.5;

      const ctrl = new LinePlotController({
        xDomain: [0, WINDOW_SAMPLES],
        yDomain: [yBottom, yTop],
        xLabel:  'sample',
        yLabel:  'value',
      });

      SIGNALS.forEach(sig => ctrl.addSignal(sig.id, sig.color));

      ctrl.init(wc, ac);

      ctrl.on('zoomChanged',  d => addLog(`zoomChanged: factor=${d.factor.toFixed(3)}`));
      ctrl.on('panChanged',   d => {
        if (Math.abs(d.dx) + Math.abs(d.dy) > 5) {
          addLog(`panChanged: dx=${d.dx.toFixed(0)} dy=${d.dy.toFixed(0)}`);
        }
      });
      ctrl.on('reset', () => addLog('reset'));

      controllerRef.current = ctrl;

      // Initial tick + start live append
      doTick(ctrl);
      startInterval(ctrl);
    });

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(intervalRef.current);
      controllerRef.current?.destroy();
      controllerRef.current = null;
    };
  }, []); // mount once

  // ── UI handlers ───────────────────────────────────────────────────────────

  const handleLiveAppendChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      startInterval(controllerRef.current);
    } else {
      clearInterval(intervalRef.current);
    }
    setLiveAppend(checked);
  };

  const handleReset = () => {
    clearInterval(intervalRef.current);
    controllerRef.current?.reset();

    // Restart append after reset
    if (liveAppend) {
      const ctrl = controllerRef.current;
      if (ctrl) {
        doTick(ctrl);
        startInterval(ctrl);
      }
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const containerStyle = {
    display: 'flex', flexDirection: 'column',
    width: '100vw', height: '100vh',
    background: '#0d0d0d', color: '#ccc', fontFamily: 'monospace',
  };
  const headerStyle = {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '6px 16px', background: '#151515',
    borderBottom: '1px solid #333', fontSize: 12, flexShrink: 0,
  };
  const plotWrapStyle = {
    flex: 1, position: 'relative', overflow: 'hidden',
  };
  const canvasStyle = {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  };
  const logPanelStyle = {
    height: 120, background: '#0a0a0a', borderTop: '1px solid #222',
    overflowY: 'auto', padding: '4px 12px', fontSize: 11, flexShrink: 0,
  };
  const checkboxLabelStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    color: '#888', cursor: 'pointer', userSelect: 'none',
  };
  const btnStyle = {
    background: '#222', border: '1px solid #444', borderRadius: 3,
    color: '#ccc', padding: '2px 10px', cursor: 'pointer', fontSize: 12,
  };

  const legendDot = (color) => (
    <span style={{
      display: 'inline-block', width: 10, height: 10, borderRadius: '50%',
      background: `rgb(${color[0]},${color[1]},${color[2]})`, marginRight: 4,
    }} />
  );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong style={{ color: '#fff', fontSize: 14 }}>MasterPlot — Line Example</strong>
        <span style={{ color: '#555' }}>|</span>

        {/* Signal legend */}
        <span style={{ color: '#888' }}>
          {SIGNALS.map(s => <span key={s.id}>{legendDot(s.color)}{s.label}&nbsp;&nbsp;</span>)}
        </span>

        <span style={{ color: '#555' }}>|</span>
        <span style={{ color: '#666', fontSize: 11 }}>
          rolling window: {WINDOW_SAMPLES.toLocaleString()} samples
        </span>

        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={liveAppend} onChange={handleLiveAppendChange} />
          Live append
        </label>

        <button style={btnStyle} onClick={handleReset}>Reset</button>

        <span style={{ marginLeft: 'auto', color: '#666' }}>
          scroll=zoom · drag=pan
        </span>
      </div>

      <div style={plotWrapStyle}>
        <canvas ref={webglRef} style={canvasStyle} />
        <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
      </div>

      <div style={logPanelStyle}>
        {log.map((msg, i) => (
          <div key={i} style={{ color: i === 0 ? '#adf' : '#556', lineHeight: '1.5' }}>
            {msg}
          </div>
        ))}
        {log.length === 0 && <span style={{ color: '#333' }}>Event log (last 20 events)...</span>}
      </div>
    </div>
  );
}
