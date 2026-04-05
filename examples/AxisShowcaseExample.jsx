/**
 * AxisShowcaseExample — EX20
 *
 * 2×3 grid of small plots demonstrating F34/F35 axis positioning options.
 * Each plot is independently pannable/zoomable.
 */

import React, { useRef, useEffect } from 'react';
import { PlotController } from '../src/plot/PlotController.js';
import { AxisController }  from '../src/plot/axes/AxisController.js';
import { DataStore }       from '../src/plot/DataStore.js';

// ── Seed data ──────────────────────────────────────────────────────────────────

function makeData() {
  const N = 200;
  const x = new Float32Array(N);
  const y = new Float32Array(N);
  const color = new Uint8Array(N * 4);
  const size  = new Float32Array(N);

  // Use a simple LCG so we always get the same layout
  let seed = 0x9e3779b9;
  const rand = () => {
    seed ^= seed << 13; seed ^= seed >> 17; seed ^= seed << 5;
    return (seed >>> 0) / 0xffffffff;
  };

  for (let i = 0; i < N; i++) {
    x[i]  = (rand() - 0.5) * 10;
    y[i]  = (rand() - 0.5) * 10;
    size[i] = 5;
    // Color: orange-ish gradient based on quadrant
    const qi = (x[i] >= 0 ? 1 : 0) + (y[i] >= 0 ? 2 : 0);
    const palettes = [
      [80, 140, 255, 200], [255, 120, 60, 200],
      [60, 200, 120, 200], [220, 80, 200, 200],
    ];
    color.set(palettes[qi], i * 4);
  }
  return { x, y, color, size };
}

const SEED_DATA = makeData();

// ── Plot config ────────────────────────────────────────────────────────────────

const PANELS = [
  {
    title: 'Default border axes',
    sub:   'bordered: true, mode: "border", edges: [bottom] / [left]',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border' }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border' }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: true, autoExpand: false,
    }),
  },
  {
    title: 'No border fill',
    sub:   'bordered: false, mode: "border"',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border' }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border' }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: false, autoExpand: false,
    }),
  },
  {
    title: 'Mirrored axes',
    sub:   'edges: ["bottom","top"] / ["left","right"]',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border', edges: ['bottom', 'top'] }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'border', edges: ['left', 'right'] }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: true, autoExpand: false,
    }),
  },
  {
    title: 'Crossing at zero (stationary)',
    sub:   'mode: "relative", crossingValue: 0, snapTolerancePx: 0',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 0, snapTolerancePx: 0 }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 0, snapTolerancePx: 0 }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: true, autoExpand: false,
    }),
  },
  {
    title: 'Mobile axes crossing at (3,3) (snaps to edges)',
    sub:   'mode: "relative", crossingValue: 3, snapTolerancePx: 30, offscreen: "border"',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 3, snapTolerancePx: 30, offscreen: 'border' }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 3, snapTolerancePx: 30, offscreen: 'border' }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: true, autoExpand: false,
    }),
  },
  {
    title: 'Mobile, hide when off-screen',
    sub:   'mode: "relative", crossingValue: 0, snapTolerancePx: 30, offscreen: "hide"',
    ctrl: () => new PlotController({
      xAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 0, snapTolerancePx: 30, offscreen: 'hide' }),
      yAxis: new AxisController({ scaleType: 'linear', tickCount: 4, mode: 'relative', crossingValue: 0, snapTolerancePx: 30, offscreen: 'hide' }),
      xDomain: [-6, 6], yDomain: [-6, 6],
      bordered: true, autoExpand: false,
    }),
  },
];

// ── Single plot cell ───────────────────────────────────────────────────────────

function PlotCell({ title, sub, makeCtrl }) {
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
      const w = wc.offsetWidth  || 400;
      const h = wc.offsetHeight || 300;
      wc.width = w; wc.height = h;
      ac.width = w; ac.height = h;

      ctrl.init(wc, ac);

      // Seed the shared data
      ctrl.appendData(SEED_DATA);
      // Reset to symmetric domain so crossing value is centred
      ctrl.viewport.setXDomain([-6, 6]);
      ctrl.viewport.setYDomain([-6, 6]);
    });

    return () => {
      cancelAnimationFrame(raf);
      ctrl.destroy();
      ctrlRef.current = null;
    };
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  const wrapStyle = {
    display:       'flex',
    flexDirection: 'column',
    background:    '#0d0d0d',
    border:        '1px solid #333',
    borderRadius:  4,
    overflow:      'hidden',
  };

  const canvasWrap = {
    position: 'relative',
    flex:     1,
  };

  const canvasStyle = {
    position: 'absolute',
    top: 0, left: 0,
    width: '100%', height: '100%',
  };

  const titleStyle = {
    padding:    '5px 8px 2px',
    color:      '#e0e0e0',
    fontSize:   12,
    fontFamily: 'monospace',
    fontWeight: 'bold',
    lineHeight: 1.3,
    flexShrink: 0,
  };

  const subStyle = {
    padding:    '0 8px 5px',
    color:      '#888',
    fontSize:   10,
    fontFamily: 'monospace',
    flexShrink: 0,
  };

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

// ── Page ───────────────────────────────────────────────────────────────────────

export default function AxisShowcaseExample() {
  const outerStyle = {
    width:       '100%',
    minHeight:   '100vh',
    background:  '#0d0d0d',
    color:       '#e0e0e0',
    fontFamily:  'monospace',
    padding:     16,
    boxSizing:   'border-box',
    display:     'flex',
    flexDirection: 'column',
    gap:         12,
  };

  const headerStyle = {
    fontSize:    15,
    fontWeight:  'bold',
    color:       '#7df',
    marginBottom: 4,
  };

  const hintStyle = {
    fontSize:  11,
    color:     '#666',
    marginBottom: 8,
  };

  const gridStyle = {
    display:             'grid',
    gridTemplateColumns: '1fr 1fr',
    gridTemplateRows:    '300px 300px 300px',
    gap:                 12,
    flex:                1,
  };

  return (
    <div style={outerStyle}>
      <div style={headerStyle}>Axis Options Showcase — EX20</div>
      <div style={hintStyle}>
        Scroll to zoom · Drag to pan · Each plot is independent.
        Relative-mode plots: pan away from zero to see the axis float and snap.
      </div>
      <div style={gridStyle}>
        {PANELS.map((p, i) => (
          <PlotCell key={i} title={p.title} sub={p.sub} makeCtrl={p.ctrl} />
        ))}
      </div>
    </div>
  );
}
