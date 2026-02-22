/**
 * HistogramLUTPanel — React component that renders the pyqtgraph-style
 * HistogramLUTItem UI beside the spectrogram.
 *
 * Props:
 *   controller {HistogramLUTController}  — the controller to display/control
 *   width      {number}                  — panel width in px (default 140)
 *
 * The panel:
 *   - Draws a histogram of dB amplitude values (bars, left-aligned)
 *   - Draws a LUT gradient strip on the right edge
 *   - Draws draggable level_min (cyan) and level_max (yellow) horizontal lines
 *   - Provides a colormap dropdown and an Auto Level button
 */

import React, { useRef, useEffect, useState } from 'react';
import { HistogramLUTController } from '../plot/layers/HistogramLUTController.js';

export default function HistogramLUTPanel({ controller, width = 140 }) {
  const canvasRef = useRef(null);
  const dragRef   = useRef(null);  // 'min' | 'max' | null

  const [levels,    setLevels]    = useState({ min: -100, max: 0 });
  const [preset,    setPreset]    = useState('viridis');
  const [histState, setHistState] = useState(null); // { bins, edges, globalMin, globalMax }

  // ── Wire controller events ─────────────────────────────────────────────────
  useEffect(() => {
    const onLevels = (min, max) => setLevels({ min, max });
    const onLUT    = (name)     => setPreset(name);
    const onHist   = (data)     => setHistState(data);
    controller.on('levelsChanged',  onLevels);
    controller.on('lutChanged',     onLUT);
    controller.on('histogramReady', onHist);
    return () => {
      controller.off('levelsChanged',  onLevels);
      controller.off('lutChanged',     onLUT);
      controller.off('histogramReady', onHist);
    };
  }, [controller]);

  // ── Resize observer — match canvas backing store to DOM size ───────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Size the canvas immediately on mount so the first draw has correct dims.
    const syncSize = (c) => {
      const w = c.offsetWidth;
      const h = c.offsetHeight;
      if (w && h) { c.width = w; c.height = h; }
    };
    syncSize(canvas);

    let rafId;
    const ro = new ResizeObserver(() => {
      // Defer into the next animation frame to avoid the "ResizeObserver loop
      // completed with undelivered notifications" error that occurs when the
      // callback synchronously triggers a React re-render / layout change.
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const c = canvasRef.current;
        if (!c) return;
        syncSize(c);
        setLevels(l => ({ ...l }));
      });
    });
    ro.observe(canvas);
    return () => { ro.disconnect(); cancelAnimationFrame(rafId); };
  }, []);

  // ── Canvas redraw ──────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);

    const GRAD_W = 18;        // width of LUT gradient strip on the right
    const HIST_W = W - GRAD_W - 4;

    // 1. Draw histogram bars
    if (histState) {
      const { bins, globalMin, globalMax } = histState;
      const maxCount = Math.max(...bins, 1);
      const binH = H / bins.length;
      ctx.fillStyle = 'rgba(80,150,200,0.55)';
      for (let i = 0; i < bins.length; i++) {
        const barW = (bins[i] / maxCount) * HIST_W;
        // bin 0 = globalMin (bottom of range) → invert Y so it appears at visual bottom
        const y = H - (i + 1) / bins.length * H;
        ctx.fillRect(0, y, barW, binH + 0.5);
      }
    }

    // 2. Draw LUT gradient strip (right column, top=high value, bottom=low)
    const lut = controller.getLUTArray();
    for (let py = 0; py < H; py++) {
      const t  = 1 - py / H;  // t=1 at top, t=0 at bottom
      const li = Math.min(255, Math.floor(t * 255)) * 4;
      ctx.fillStyle = `rgb(${lut[li]},${lut[li + 1]},${lut[li + 2]})`;
      ctx.fillRect(W - GRAD_W, py, GRAD_W, 1);
    }

    // 3. Draw level handle lines
    if (histState) {
      const { globalMin, globalMax } = histState;
      const range = (globalMax - globalMin) || 1;
      const minY = H - ((levels.min - globalMin) / range) * H;
      const maxY = H - ((levels.max - globalMin) / range) * H;
      // level_min line (cyan)
      ctx.strokeStyle = '#0ff'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, minY); ctx.lineTo(W - GRAD_W, minY); ctx.stroke();
      // level_max line (yellow)
      ctx.strokeStyle = '#ff0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, maxY); ctx.lineTo(W - GRAD_W, maxY); ctx.stroke();
    }
  }, [levels, histState, preset, controller]);

  // ── Drag interaction ───────────────────────────────────────────────────────
  const onMouseDown = (e) => {
    if (!histState) return;
    const { globalMin, globalMax } = histState;
    const canvas = canvasRef.current;
    const H = canvas.offsetHeight;
    const range = (globalMax - globalMin) || 1;
    const minY = H - ((levels.min - globalMin) / range) * H;
    const maxY = H - ((levels.max - globalMin) / range) * H;
    const y = e.nativeEvent.offsetY;
    if (Math.abs(y - minY) < 8)      dragRef.current = 'min';
    else if (Math.abs(y - maxY) < 8) dragRef.current = 'max';
  };

  const onMouseMove = (e) => {
    if (!dragRef.current || !histState) return;
    const { globalMin, globalMax } = histState;
    const H   = canvasRef.current.offsetHeight;
    const amp = globalMin + (1 - e.nativeEvent.offsetY / H) * ((globalMax - globalMin) || 1);
    if (dragRef.current === 'min') {
      controller.setLevels(Math.min(amp, levels.max - 0.5), levels.max);
    } else {
      controller.setLevels(levels.min, Math.max(amp, levels.min + 0.5));
    }
  };

  const onMouseUp = () => { dragRef.current = null; };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width, height: '100%', display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderLeft: '1px solid #333',
      fontFamily: 'monospace', fontSize: 11, color: '#888', flexShrink: 0,
      boxSizing: 'border-box',
    }}>
      <canvas
        ref={canvasRef}
        style={{ flex: 1, width: '100%', cursor: 'ns-resize' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      />
      <div style={{ padding: '4px 6px', borderTop: '1px solid #222' }}>
        <select
          value={preset}
          onChange={e => controller.setLUT(e.target.value)}
          style={{
            width: '100%', background: '#1a1a1a', border: '1px solid #444',
            color: '#aaa', padding: '2px 4px', fontSize: 11,
          }}
        >
          {HistogramLUTController.presetNames.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={() => controller.autoLevel()}
          style={{
            marginTop: 4, width: '100%', background: '#1a1a1a',
            border: '1px solid #444', color: '#adf', padding: '3px',
            fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          Auto Level
        </button>
        <div style={{ marginTop: 4, color: '#555', fontSize: 10 }}>
          min: {levels.min.toFixed(1)}<br />
          max: {levels.max.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
