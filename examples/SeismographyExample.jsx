/**
 * SeismographyExample — EX5: 10 stacked seismograph channels.
 *
 * Architecture:
 *   10 PlotControllers, each backed by its own DataStore and independent Y-axis.
 *   X-axis domain is shared: panning/zooming on any channel propagates to all
 *   others via domainChanged → xAxis.setDomain() (no engine changes required).
 *
 *   Each channel has a pre-seeded vline-half-bottom LineROI representing a
 *   P-wave pick.  Picks are draggable and labelled on the canvas overlay.
 *
 * Sidebar table (React):
 *   Columns: Station | Label | Pos (s)
 *   Updates only on roiFinalized (user drag commit).
 *   Allows in-place editing of label (≤25 chars) and position.
 *   Edits call updateFromExternal() — version-gated, plot re-renders immediately.
 *   React does NOT own any geometry; the table is a display cache.
 *
 * Signals:
 *   y_i = sin(2π · freq_i · t + phase_i)   for t ∈ [0, T_MAX]
 *   Each channel has distinct freq and phase so signals are clearly different.
 */

import { useRef, useEffect, useState } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { DataStore } from '../src/plot/DataStore.js';
import { LineROI } from '../src/plot/ROI/LineROI.js';

// ── Config ─────────────────────────────────────────────────────────────────────

const NUM_PLOTS      = 10;
const NUM_POINTS     = 2000;
const T_MAX          = 10;          // seconds
const Y_DOMAIN       = [-1.5, 1.5]; // each channel independent, fixed amplitude

const STATION_NAMES = ['ST01','ST02','ST03','ST04','ST05','ST06','ST07','ST08','ST09','ST10'];

// Distinct frequency per channel (Hz)
const FREQS  = [0.50, 0.65, 0.80, 0.95, 1.10, 1.25, 1.40, 1.55, 1.70, 1.85];
// Phase offset per channel (radians)
const PHASES = Array.from({ length: NUM_PLOTS }, (_, i) => i * (Math.PI / 5));

// Colour per channel — distinct hues, all high-contrast on dark background
const COLORS = [
  [0,   220, 255],
  [0,   200, 220],
  [80,  220, 180],
  [120, 220, 120],
  [180, 220,  80],
  [220, 200,  40],
  [240, 160,  40],
  [240, 100,  80],
  [200,  60, 200],
  [140,  80, 240],
];

// ── Data generation ────────────────────────────────────────────────────────────

function generateSignal(i) {
  const dt    = T_MAX / NUM_POINTS;
  const freq  = FREQS[i];
  const phase = PHASES[i];
  const [r, g, b] = COLORS[i];

  const x     = new Float32Array(NUM_POINTS);
  const y     = new Float32Array(NUM_POINTS);
  const size  = new Float32Array(NUM_POINTS);
  const color = new Uint8Array(NUM_POINTS * 4);

  for (let j = 0; j < NUM_POINTS; j++) {
    const t = j * dt;
    x[j]          = t;
    y[j]          = Math.sin(2 * Math.PI * freq * t + phase);
    size[j]       = 1.5;
    color[j * 4]     = r;
    color[j * 4 + 1] = g;
    color[j * 4 + 2] = b;
    color[j * 4 + 3] = 220;
  }

  return { x, y, size, color };
}

// ── Module-level DataStores (survive React re-renders; reset on unmount) ───────

let _stores = null;

function getStores() {
  if (!_stores) {
    _stores = Array.from({ length: NUM_PLOTS }, (_, i) => {
      const store = new DataStore();
      store.appendData(generateSignal(i));
      return store;
    });
  }
  return _stores;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeismographyExample() {
  // Controller refs — never held in React state (no geometry in React)
  const ctrlsRef   = useRef(new Array(NUM_PLOTS).fill(null));
  const initCount  = useRef(0);
  const syncingRef = useRef(false);

  // React table state — lightweight display cache; geometry lives in ROI objects
  const [tableRows, setTableRows] = useState([]);

  const stores = getStores();

  // ── Post-init: seed LineROIs once all 10 controllers are ready ──────────────

  function _onAllReady() {
    const initialRows = [];

    ctrlsRef.current.forEach((ctrl, j) => {
      const roi = new LineROI({
        orientation: 'vertical',
        mode:        'vline-half-bottom',
        position:    T_MAX / 2,       // start at midpoint
        label:       STATION_NAMES[j],
      });
      roi.bumpVersion();
      ctrl.roiController.addROI(roi);
      roi.onCreate();
      ctrl.roiController.emit('roisChanged', { rois: ctrl.roiController.getAllROIs() });

      initialRows.push({
        plotIndex: j,
        roiId:     roi.id,
        label:     roi.label ?? '',
        position:  roi.position,
        version:   roi.version,
      });
    });

    setTableRows(initialRows);
  }

  // ── Stable onInit callbacks (created once; each closes over its index i) ────
  //
  // PlotCanvas calls onInit exactly once (inside useEffect with [] deps).
  // We create these before any render so they reference stable refs.

  const onInitFns = useRef(null);
  if (!onInitFns.current) {
    onInitFns.current = Array.from({ length: NUM_PLOTS }, (_, i) => (ctrl) => {
      ctrlsRef.current[i] = ctrl;

      // ── Shared X-domain: propagate domainChanged to all other controllers ──
      // AxisController.setDomain() → PlotController's wired listener runs
      // _updateScales() + _dirty=true automatically.
      ctrl.on('domainChanged', ({ xDomain }) => {
        if (syncingRef.current || !xDomain) return;
        syncingRef.current = true;
        ctrlsRef.current.forEach((other, j) => {
          if (j === i || !other) return;
          other.xAxis.setDomain(xDomain);
        });
        syncingRef.current = false;
      });

      // ── Table refresh on user drag commit ──────────────────────────────────
      ctrl.roiController.on('roiFinalized', ({ roi }) => {
        if (roi.type !== 'lineROI') return;
        setTableRows(prev => prev.map(row =>
          row.plotIndex === i
            ? { ...row, label: roi.label ?? '', position: roi.position, version: roi.version }
            : row
        ));
      });

      initCount.current += 1;
      if (initCount.current === NUM_PLOTS) {
        _onAllReady();
      }
    });
  }

  // ── Edit handlers ────────────────────────────────────────────────────────────

  function handleLabelCommit(plotIndex, newLabel) {
    const ctrl = ctrlsRef.current[plotIndex];
    if (!ctrl) return;
    const row = tableRows.find(r => r.plotIndex === plotIndex);
    if (!row) return;
    const roi = ctrl.roiController.getROI(row.roiId);
    if (!roi) return;

    const truncated = String(newLabel).slice(0, 25);
    const accepted  = ctrl.roiController.updateFromExternal({
      ...roi.serialize(),
      label:     truncated,
      version:   roi.version + 1,
      updatedAt: Date.now(),
    });

    if (accepted) {
      setTableRows(prev => prev.map(r =>
        r.plotIndex === plotIndex ? { ...r, label: truncated, version: roi.version } : r
      ));
    }
  }

  function handlePositionCommit(plotIndex, newPosStr) {
    const ctrl = ctrlsRef.current[plotIndex];
    if (!ctrl) return;
    const row = tableRows.find(r => r.plotIndex === plotIndex);
    if (!row) return;
    const roi = ctrl.roiController.getROI(row.roiId);
    if (!roi) return;

    const newPos  = parseFloat(newPosStr);
    if (isNaN(newPos)) return;
    const clamped = Math.max(0, Math.min(T_MAX, newPos));

    const accepted = ctrl.roiController.updateFromExternal({
      ...roi.serialize(),
      position:  clamped,
      domain:    { x: [clamped, clamped] },
      version:   roi.version + 1,
      updatedAt: Date.now(),
    });

    if (accepted) {
      setTableRows(prev => prev.map(r =>
        r.plotIndex === plotIndex ? { ...r, position: clamped, version: roi.version } : r
      ));
    }
  }

  // ── Cleanup ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      _stores = null;
      initCount.current = 0;
      ctrlsRef.current.fill(null);
      onInitFns.current = null;
    };
  }, []);

  // ── Styles ────────────────────────────────────────────────────────────────────

  const S = {
    root: {
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace',
      overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '6px 16px', borderBottom: '1px solid #222',
      flexShrink: 0, fontSize: 12,
    },
    title: { fontSize: 14, fontWeight: 700, color: '#7df' },
    hint:  { fontSize: 11, color: '#555' },
    body:  { display: 'flex', flex: 1, overflow: 'hidden' },
    plots: { flex: 1, display: 'flex', flexDirection: 'column' },
    plotWrap: {
      flex: 1, position: 'relative', minHeight: 0,
      borderBottom: '1px solid #161616',
    },
    stationTag: {
      position: 'absolute', top: 2, left: 8, zIndex: 10,
      fontSize: 10, pointerEvents: 'none',
      background: 'rgba(0,0,0,0.55)', padding: '1px 5px', borderRadius: 2,
    },
    sidebar: {
      width: 330, borderLeft: '1px solid #222',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0,
    },
    sideHeader: {
      padding: '8px 12px', borderBottom: '1px solid #222',
      fontSize: 12, color: '#7df', fontWeight: 700, flexShrink: 0,
    },
    tableWrap: { flex: 1, overflowY: 'auto' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: 11 },
    th: {
      padding: '5px 8px', color: '#444', textAlign: 'left',
      borderBottom: '1px solid #1e1e1e', position: 'sticky', top: 0,
      background: '#0d0d0d',
    },
    td: {
      padding: '3px 6px', borderBottom: '1px solid #141414',
      verticalAlign: 'middle',
    },
    inp: {
      width: '100%', background: 'transparent', border: 'none',
      borderBottom: '1px solid #2a2a2a', color: '#ccc', fontSize: 11,
      fontFamily: 'monospace', outline: 'none', padding: '1px 0',
    },
    posInp: {
      width: 68, background: 'transparent', border: 'none',
      borderBottom: '1px solid #2a2a2a', color: '#fa8', fontSize: 11,
      fontFamily: 'monospace', outline: 'none', padding: '1px 0',
      textAlign: 'right',
    },
    note: {
      padding: '6px 12px', fontSize: 10, color: '#333',
      borderTop: '1px solid #1a1a1a', flexShrink: 0, lineHeight: 1.5,
    },
  };

  return (
    <div style={S.root}>
      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.title}>Seismography</span>
        <span style={S.hint}>
          10 stacked channels · shared X-axis · V = add vline · drag pick to move
        </span>
        <span style={{ marginLeft: 'auto', ...S.hint }}>
          scroll=zoom&nbsp;&nbsp;drag=pan&nbsp;&nbsp;right-drag=zoom
        </span>
      </div>

      {/* ── Body: stacked plots + sidebar table ── */}
      <div style={S.body}>

        {/* 10 stacked PlotCanvas instances */}
        <div style={S.plots}>
          {Array.from({ length: NUM_PLOTS }, (_, i) => (
            <div key={i} style={S.plotWrap}>
              <div style={{ ...S.stationTag, color: `rgb(${COLORS[i].join(',')})` }}>
                {STATION_NAMES[i]}
              </div>
              <PlotCanvas
                width="100%"
                height="100%"
                xDomain={[0, T_MAX]}
                yDomain={Y_DOMAIN}
                xLabel={i === NUM_PLOTS - 1 ? 'Time (s)' : ''}
                yLabel=""
                dataStore={stores[i]}
                onInit={onInitFns.current[i]}
              />
            </div>
          ))}
        </div>

        {/* P-wave pick table */}
        <div style={S.sidebar}>
          <div style={S.sideHeader}>P-wave Picks</div>
          <div style={S.tableWrap}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Station</th>
                  <th style={S.th}>Label</th>
                  <th style={{ ...S.th, textAlign: 'right' }}>Pos (s)</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map(row => (
                  // key includes version so inputs re-mount with fresh defaultValue
                  // when the user drags the pick on the plot
                  <tr key={`${row.plotIndex}-${row.version}`}>
                    <td style={{ ...S.td, color: `rgb(${COLORS[row.plotIndex].join(',')})`, fontWeight: 700 }}>
                      {STATION_NAMES[row.plotIndex]}
                    </td>
                    <td style={S.td}>
                      <input
                        style={S.inp}
                        type="text"
                        maxLength={25}
                        defaultValue={row.label}
                        onBlur={e => handleLabelCommit(row.plotIndex, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                            handleLabelCommit(row.plotIndex, e.target.value);
                          }
                        }}
                      />
                    </td>
                    <td style={{ ...S.td, textAlign: 'right' }}>
                      <input
                        style={S.posInp}
                        type="number"
                        step={0.01}
                        min={0}
                        max={T_MAX}
                        defaultValue={row.position.toFixed(3)}
                        onBlur={e => handlePositionCommit(row.plotIndex, e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.target.blur();
                            handlePositionCommit(row.plotIndex, e.target.value);
                          }
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={S.note}>
            Table updates on drag commit (roiFinalized).<br />
            Edits use updateFromExternal() — version-gated.
          </div>
        </div>

      </div>
    </div>
  );
}
