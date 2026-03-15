/**
 * LUTPanel — React component providing a LUT histogram panel.
 *
 * Layout:
 *   ┌──────────────────────────┬──┐
 *   │  histogram plot          │  │
 *   │  (bars + hline handles)  │LU│
 *   │                          │T │
 *   │                          │gd│
 *   ├──────────────────────────┤  │
 *   │  [Colormap ▼]  [Auto]    │  │
 *   └──────────────────────────┴──┘
 *
 * - Left area: two raw canvases wired to lutHistCtrl's internal PlotController
 * - Right strip (12 px): LUT gradient canvas, redrawn on lutController 'lutChanged'
 * - Bottom controls: colormap <select> + Auto Level <button>
 * - Level adjustment is via hline LineROIs inside the plot — no React drag handlers needed
 *
 * Props:
 *   lutController  {LUTController}           — manages colormap + levels
 *   lutHistCtrl    {LUTHistogramController}  — owns the internal PlotController
 *   width          {number}                  — total panel width in px (default 160)
 *   height         {string|number}           — panel height CSS value (default '100%')
 */

import React, { useRef, useEffect, useState } from 'react';
import { LUTController } from '../src/plot/layers/LUTController.js';

const GRAD_W = 12; // LUT gradient strip width in px

export default function LUTPanel({ lutController, lutHistCtrl, width = 160, height = '100%' }) {
  const webglCanvasRef = useRef(null);
  const axisCanvasRef  = useRef(null);
  const gradCanvasRef  = useRef(null);

  const [preset, setPreset] = useState(() => lutController.state.lutName);

  // ── Initialize LUTHistogramController once canvases are in DOM ──────────────
  useEffect(() => {
    const wc = webglCanvasRef.current;
    const ac = axisCanvasRef.current;
    if (!wc || !ac) return;

    const raf = requestAnimationFrame(() => {
      const w = wc.offsetWidth  || 120;
      const h = wc.offsetHeight || 300;
      wc.width = w; wc.height = h;
      ac.width = w; ac.height = h;
      lutHistCtrl.init(wc, ac);
    });

    return () => {
      cancelAnimationFrame(raf);
      lutHistCtrl.destroy();
    };
  }, []); // mount once — lutHistCtrl identity must not change

  // ── LUT gradient strip: resize + redraw on lutChanged ──────────────────────
  useEffect(() => {
    const canvas = gradCanvasRef.current;
    if (!canvas) return;

    const drawGradient = () => {
      const H = canvas.height;
      if (!H) return;
      const ctx = canvas.getContext('2d');
      const lut = lutController.getLUTArray();
      // top = high value, bottom = low value (matches histogram y orientation)
      for (let py = 0; py < H; py++) {
        const t  = 1 - py / H;
        const li = Math.min(255, Math.floor(t * 255)) * 4;
        ctx.fillStyle = `rgb(${lut[li]},${lut[li + 1]},${lut[li + 2]})`;
        ctx.fillRect(0, py, GRAD_W, 1);
      }
    };

    const syncAndDraw = () => {
      canvas.width  = GRAD_W;
      canvas.height = canvas.offsetHeight || 300;
      drawGradient();
    };

    // Initial size + draw after layout
    const initRaf = requestAnimationFrame(syncAndDraw);

    // Resize
    const ro = new ResizeObserver(() => requestAnimationFrame(syncAndDraw));
    ro.observe(canvas);

    // Redraw whenever colormap changes
    const onLutChanged = (presetName) => {
      setPreset(presetName);
      drawGradient();
    };
    lutController.on('lutChanged', onLutChanged);

    return () => {
      cancelAnimationFrame(initRaf);
      ro.disconnect();
      lutController.off('lutChanged', onLutChanged);
    };
  }, [lutController]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{
      width, height, display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderLeft: '1px solid #333',
      fontFamily: 'monospace', fontSize: 11, color: '#888',
      flexShrink: 0, boxSizing: 'border-box',
    }}>
      {/* Main area: histogram plot + LUT gradient side by side */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Histogram view — raw canvases driven by lutHistCtrl's PlotController */}
        <div style={{ flex: 1, position: 'relative' }}>
          <canvas
            ref={webglCanvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
          />
          <canvas
            ref={axisCanvasRef}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
          />
        </div>

        {/* LUT gradient strip */}
        <canvas
          ref={gradCanvasRef}
          style={{ width: GRAD_W, display: 'block', flexShrink: 0 }}
        />
      </div>

      {/* Controls: colormap dropdown + Auto Level button */}
      <div style={{ padding: '4px 6px', borderTop: '1px solid #222', flexShrink: 0 }}>
        <select
          value={preset}
          onChange={e => {
            lutController.setLUT(e.target.value);
            setPreset(e.target.value);
          }}
          style={{
            width: '100%', background: '#1a1a1a', border: '1px solid #444',
            color: '#aaa', padding: '2px 4px', fontSize: 11,
          }}
        >
          {LUTController.presetNames.map(n => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={() => lutController.autoLevel()}
          style={{
            marginTop: 4, width: '100%', background: '#1a1a1a',
            border: '1px solid #444', color: '#adf', padding: '3px',
            fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          Auto Level
        </button>
      </div>
    </div>
  );
}
