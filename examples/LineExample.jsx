/**
 * LineExample — demonstrates buildLineLayer / PathLayer via LinePlotController.
 *
 * Three independent random-walk signals (A, B, C) are appended live.
 * Each signal accumulates 500 new samples per second.
 *
 * Controls:
 *   Live append checkbox — start/stop the 1-second append interval
 *   Reset button        — clear all signals and restart
 *
 * Interaction:
 *   Scroll wheel → zoom (centered on cursor)
 *   Drag         → pan (grab-and-drag)
 */

import React, { useRef, useEffect, useState } from 'react';
import { LinePlotController } from '../src/plot/LinePlotController.js';

// ── Signal configuration ──────────────────────────────────────────────────────

const SIGNALS = [
  { id: 'A', color: [0,   220, 220, 220], label: 'A (cyan)'   },
  { id: 'B', color: [255, 160,  40, 220], label: 'B (orange)' },
  { id: 'C', color: [100, 230,  80, 220], label: 'C (lime)'   },
];

const SAMPLES_PER_TICK = 500;
const TICK_MS          = 1000;

// Random-walk state per signal (module-level, reset with module reload)
const walkState = { A: 0, B: 0, C: 0 };

function generateWalkSamples(id, count) {
  const out = new Float32Array(count);
  let v = walkState[id];
  for (let i = 0; i < count; i++) {
    v += (Math.random() - 0.5) * 0.3;
    out[i] = v;
  }
  walkState[id] = v;
  return out;
}

function resetWalkState() {
  walkState.A = 0;
  walkState.B = 0;
  walkState.C = 0;
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

  // ── tick: append one round of samples ──────────────────────────────────────

  const doTick = (ctrl) => {
    const xBase = ctrl.xCounter;
    for (const sig of SIGNALS) {
      const samples = generateWalkSamples(sig.id, SAMPLES_PER_TICK);
      ctrl.appendSignalData(sig.id, samples, xBase);
    }
    ctrl.advanceXCounter(SAMPLES_PER_TICK);
    ctrl.expandDomains();
    addLog(`dataAppended: +${SAMPLES_PER_TICK} samples/signal  x=[0, ${ctrl.xCounter}]`);
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

      const ctrl = new LinePlotController({
        xDomain: [0, SAMPLES_PER_TICK],
        yDomain: [-1, 1],
        xLabel:  'sample',
        yLabel:  'value',
      });

      for (const sig of SIGNALS) ctrl.addSignal(sig.id, sig.color);

      ctrl.init(wc, ac);

      ctrl.on('zoomChanged',  d => addLog(`zoomChanged: factor=${d.factor.toFixed(3)}`));
      ctrl.on('panChanged',   d => {
        if (Math.abs(d.dx) + Math.abs(d.dy) > 5) {
          addLog(`panChanged: dx=${d.dx.toFixed(0)} dy=${d.dy.toFixed(0)}`);
        }
      });
      ctrl.on('reset',        () => addLog('reset'));

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
    resetWalkState();
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

        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={liveAppend} onChange={handleLiveAppendChange} />
          Live append
        </label>

        <button style={btnStyle} onClick={handleReset}>Reset</button>

        <span style={{ marginLeft: 'auto', color: '#666' }}>
          {/* keybind hint */}
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
