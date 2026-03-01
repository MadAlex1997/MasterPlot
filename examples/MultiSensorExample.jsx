/**
 * MultiSensorExample — EX7: 50 sensors × 10k points each (500k total).
 *
 * Architecture:
 *   TraceGroup partitions all 500k points by tag in one O(n) pass.
 *   PlotController registered with disableDefaultDataLayer: true.
 *   traceGroup.toLayerDef().build() registered via registerDataLayer().
 *   React owns ZERO arrays. All data lives at module level.
 *
 * Palette:
 *   25 OKLAB-derived RGBA colors, high-contrast on dark backgrounds.
 *   Sensors 25–49 reuse palette slots 0–24 (cycled by insertionIndex % 25).
 *
 * Sidebar:
 *   Scrollable checkbox list — each toggle calls setTraceVisible() and
 *   bumps a React counter to force sidebar re-render (not PlotCanvas re-render).
 *   "Show All" / "Hide All" bulk controls.
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { ScatterplotLayer } from '@deck.gl/layers';
import { PlotController }   from '../src/plot/PlotController.js';
import { TraceGroup }       from '../src/plot/layers/TraceGroup.js';
import PlotCanvas           from '../src/components/PlotCanvas.jsx';

// ─── Palette ────────────────────────────────────────────────────────────────
// 25 perceptually-spaced RGBA colors, high-contrast on dark background.
const PALETTE_25 = [
  [255,  85,  85, 255],  //  0 — red
  [255, 165,  50, 255],  //  1 — orange
  [255, 220,  50, 255],  //  2 — yellow
  [160, 230,  50, 255],  //  3 — yellow-green
  [ 80, 220,  80, 255],  //  4 — green
  [ 50, 210, 140, 255],  //  5 — sea-green
  [ 50, 210, 200, 255],  //  6 — cyan-green
  [ 50, 190, 255, 255],  //  7 — sky-blue
  [ 80, 140, 255, 255],  //  8 — blue
  [120,  90, 255, 255],  //  9 — indigo
  [180,  70, 255, 255],  // 10 — violet
  [230,  70, 210, 255],  // 11 — magenta
  [255,  70, 155, 255],  // 12 — hot-pink
  [255, 130, 100, 255],  // 13 — salmon
  [200, 200,  80, 255],  // 14 — gold
  [100, 240, 170, 255],  // 15 — mint
  [ 70, 230, 240, 255],  // 16 — aqua
  [130, 160, 255, 255],  // 17 — lavender-blue
  [200, 120, 255, 255],  // 18 — orchid
  [255, 100, 180, 255],  // 19 — pink
  [255, 200, 120, 255],  // 20 — peach
  [180, 255, 130, 255],  // 21 — lime
  [100, 255, 220, 255],  // 22 — turquoise
  [160, 130, 255, 255],  // 23 — periwinkle
  [255, 150,  60, 255],  // 24 — amber
];

// ─── Constants ──────────────────────────────────────────────────────────────
const NUM_SENSORS  = 50;
const POINTS_PER   = 10_000;
const TOTAL_POINTS = NUM_SENSORS * POINTS_PER;

const SENSOR_TAGS = Array.from({ length: NUM_SENSORS }, (_, i) => `sensor_${i}`);

// ─── Module-level data (React owns none of this) ────────────────────────────

/** @type {TraceGroup|null} */
let _traceGroup = null;

function getTraceGroup() {
  if (_traceGroup) return _traceGroup;

  _traceGroup = new TraceGroup({
    palette:     PALETTE_25,
    defaultAttrs: { opacity: 0.85, size: 3 },
    buildLayer: (traceId, traceData, attrs, ctx) => {
      const { x, y, count } = traceData;
      if (count === 0) return null;
      return new ScatterplotLayer({
        id:          traceId,
        data:        { length: count },
        getPosition: (_, { index }) => [
          ctx.xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
          ctx.yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index],
          0,
        ],
        getRadius:   attrs.size * 0.5,
        getColor:    attrs.color,
        opacity:     attrs.opacity,
        radiusUnits: 'pixels',
        pickable:    false,
        updateTriggers: { getPosition: traceData.version },
      });
    },
  });

  // Generate all data: uniform x ∈ [0, 1000], y ∈ [0, 100], size = 3.
  // Build typed arrays at module level — not inside React.
  const allX   = new Float32Array(TOTAL_POINTS);
  const allY   = new Float32Array(TOTAL_POINTS);
  const allTag = new Array(TOTAL_POINTS);

  // Use a simple LCG for reproducible pseudo-random data without Math.random() overhead.
  let seed = 0x12345678;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xFFFFFFFF;
  };

  for (let s = 0; s < NUM_SENSORS; s++) {
    const tag    = SENSOR_TAGS[s];
    const offset = s * POINTS_PER;
    for (let i = 0; i < POINTS_PER; i++) {
      allX[offset + i]   = rand() * 1000;
      allY[offset + i]   = rand() * 100;
      allTag[offset + i] = tag;
    }
  }

  _traceGroup.appendData({ x: allX, y: allY, tag: allTag });

  return _traceGroup;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function MultiSensorExample() {
  const ctrlRef        = useRef(null);
  const [tick, setTick] = useState(0);  // bumped to force sidebar re-render only

  // Build stable onInit (PlotCanvas calls this once).
  const onInitRef = useRef(null);
  if (!onInitRef.current) {
    onInitRef.current = (ctrl) => {
      ctrlRef.current = ctrl;
      const tg = getTraceGroup();
      ctrl.registerDataLayer('traces', tg.toLayerDef().build);
    };
  }

  // Cleanup on unmount.
  useEffect(() => {
    return () => { _traceGroup = null; };
  }, []);

  // ── Sidebar handlers ──────────────────────────────────────────────────────

  const toggleSensor = useCallback((tag, checked) => {
    const tg = getTraceGroup();
    tg.setTraceVisible(tag, checked);
    ctrlRef.current?.markDirty();
    setTick(t => t + 1);
  }, []);

  const showAll = useCallback(() => {
    const tg = getTraceGroup();
    SENSOR_TAGS.forEach(t => tg.setTraceVisible(t, true));
    ctrlRef.current?.markDirty();
    setTick(t => t + 1);
  }, []);

  const hideAll = useCallback(() => {
    const tg = getTraceGroup();
    SENSOR_TAGS.forEach(t => tg.setTraceVisible(t, false));
    ctrlRef.current?.markDirty();
    setTick(t => t + 1);
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display:       'flex',
      flexDirection: 'column',
      width:         '100%',
      height:        '100%',
      background:    '#0d0d0d',
      color:         '#e0e0e0',
      fontFamily:    'monospace',
    },
    header: {
      padding:       '8px 16px',
      background:    '#111',
      borderBottom:  '1px solid #222',
      fontSize:      13,
      color:         '#aaa',
    },
    body: {
      display:  'flex',
      flex:     1,
      overflow: 'hidden',
    },
    plotWrap: {
      flex:     1,
      position: 'relative',
    },
    sidebar: {
      width:         240,
      display:       'flex',
      flexDirection: 'column',
      borderLeft:    '1px solid #222',
      background:    '#0f0f0f',
    },
    sidebarHeader: {
      padding:      '8px 12px',
      borderBottom: '1px solid #222',
      display:      'flex',
      gap:          8,
    },
    btn: {
      flex:       1,
      padding:    '4px 0',
      background: '#1a1a1a',
      border:     '1px solid #333',
      color:      '#ccc',
      cursor:     'pointer',
      fontSize:   11,
      fontFamily: 'monospace',
    },
    list: {
      flex:       1,
      overflowY:  'auto',
      padding:    4,
    },
    row: {
      display:    'flex',
      alignItems: 'center',
      gap:        6,
      padding:    '3px 4px',
      cursor:     'pointer',
    },
    label: {
      flex:     1,
      fontSize: 11,
      color:    '#bbb',
    },
    swatch: {
      width:        12,
      height:       12,
      borderRadius: 2,
      flexShrink:   0,
    },
  };

  const tg = getTraceGroup();

  return (
    <div style={S.root}>
      <div style={S.header}>
        Multi-Sensor Scatter — {NUM_SENSORS} sensors × {POINTS_PER.toLocaleString()} pts each
        &nbsp;·&nbsp; {TOTAL_POINTS.toLocaleString()} total points &nbsp;·&nbsp; 25-color palette (cycled)
      </div>

      <div style={S.body}>
        <div style={S.plotWrap}>
          <PlotCanvas
            xDomain={[0, 1000]}
            yDomain={[0, 100]}
            xLabel="x"
            yLabel="y"
            panMode="drag"
            onInit={onInitRef.current}
          />
        </div>

        <div style={S.sidebar}>
          <div style={S.sidebarHeader}>
            <button style={S.btn} onClick={showAll}>Show All</button>
            <button style={S.btn} onClick={hideAll}>Hide All</button>
          </div>

          <div style={S.list}>
            {SENSOR_TAGS.map((tag, i) => {
              const color  = PALETTE_25[i % PALETTE_25.length];
              const vis    = tg.getTraceVisible(tag);
              const cssRgba = `rgba(${color[0]},${color[1]},${color[2]},${(color[3] / 255).toFixed(2)})`;
              return (
                <label key={tag} style={S.row}>
                  <input
                    type="checkbox"
                    checked={vis}
                    onChange={e => toggleSensor(tag, e.target.checked)}
                    style={{ margin: 0, cursor: 'pointer' }}
                  />
                  <span style={S.label}>{tag}</span>
                  <span style={{ ...S.swatch, background: cssRgba }} />
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
