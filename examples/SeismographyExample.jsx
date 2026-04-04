/**
 * SeismographyExample — EX5: 50 stacked seismograph channels.
 *
 * Migrated in ARCH-D: LinePlotController replaced by PlotController + SignalStore.
 *
 * Architecture:
 *   50 PlotControllers, each with its own independent Y-axis and a built-in
 *   ROIController for P-wave LineROI picks.  X-axis domain is shared via
 *   domainChanged + syncingRef guard (no infinite loop).
 *
 *   Each channel has a pre-seeded vline-half-bottom LineROI representing a
 *   P-wave pick.  Picks are draggable and labelled on the canvas overlay.
 *   PlotController renders ROI geometry via ROILayer (WebGL) and labels via
 *   AxisRenderer (2D canvas) — no monkey-patching required.
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
import { PlotController } from '../src/plot/PlotController.js';
import { SignalStore }    from '../src/plot/layers/SignalDataLayer.js';
import { LineROI }        from '../src/plot/ROI/LineROI.js';
import HelpOverlay        from '../ui/HelpOverlay.jsx';

// ── Config ─────────────────────────────────────────────────────────────────────

const NUM_PLOTS      = 50;
const SAMPLE_RATE    = 40;
const T_MAX          = 300;
const NUM_POINTS     = T_MAX * SAMPLE_RATE;
const Y_DOMAIN       = [-1.5, 1.5];

const STATION_NAMES = Array.from({ length: NUM_PLOTS }, (_, i) => 'ST' + String(i).padStart(3, '0'));

// Distinct frequency per channel (Hz)
const FREQS  = Array.from({ length: NUM_PLOTS }, (_, i) => 0.5 + i * 0.0015);

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

// ── Component ──────────────────────────────────────────────────────────────────

export default function SeismographyExample() {
  // Canvas refs — filled by callback refs in JSX
  const webglRefs = useRef(new Array(NUM_PLOTS).fill(null));
  const axisRefs  = useRef(new Array(NUM_PLOTS).fill(null));

  // Controller refs — never held in React state
  const ctrlsRef = useRef(new Array(NUM_PLOTS).fill(null));

  // Guard: prevents domainChanged sync from cascading infinitely
  const syncingRef = useRef(false);

  // React table state — lightweight display cache; geometry lives in ROI objects
  const [tableRows, setTableRows] = useState([]);

  // ── Post-init: seed LineROIs once all controllers are ready ──────────────────

  function _onAllReady() {
    const initialRows = [];

    ctrlsRef.current.forEach((ctrl, j) => {
      if (!ctrl) return;
      const roiCtrl = ctrl.roiController;

      const roi = new LineROI({
        orientation: 'vertical',
        mode:        'vline-half-bottom',
        position:    T_MAX / 2,
        label:       STATION_NAMES[j],
      });
      roi.bumpVersion();
      roiCtrl.addROI(roi);
      roi.onCreate();
      roiCtrl.emit('roisChanged', { rois: roiCtrl.getAllROIs() });

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

  // ── Initialization ────────────────────────────────────────────────────────────

  useEffect(() => {
    let rafId;

    function initAll() {
      for (let i = 0; i < NUM_PLOTS; i++) {
        const wc = webglRefs.current[i];
        const ac = axisRefs.current[i];
        if (!wc || !ac) continue;

        // Size canvases to match their layout dimensions
        wc.width  = wc.offsetWidth  || 800;
        wc.height = wc.offsetHeight || 160;
        ac.width  = wc.width;
        ac.height = wc.height;

        const [r, g, b] = COLORS[1];

        // SignalStore manages the signal path data
        const signals = new SignalStore();
        signals.addSignal('s', [r, g, b, 220]);

        // Build signal path directly (exact time coordinates, not integer indices)
        const sig = signals.getSignal('s');
        const dt  = 1 / SAMPLE_RATE;
        for (let j = 0; j < NUM_POINTS; j++) {
          const t = j * dt;
          sig.path.push([t, Math.sin(2 * Math.PI * FREQS[i] * t + PHASES[i]), 0]);
        }
        sig.layerData = [{ path: sig.path, color: sig.color }];
        sig.version++;

        // PlotController: unified controller with pluggable data layer + built-in ROI
        const ctrl = new PlotController({
          xDomain:                 [0, T_MAX],
          yDomain:                 Y_DOMAIN,
          xLabel:                  i === NUM_PLOTS - 1 ? 'Time (s)' : '',
          yLabel:                  '',
          panMode:                 'drag',
          disableDefaultDataLayer: true,
        });

        // Register the signal layer (build fn captures the SignalStore)
        ctrl.registerDataLayer('signals', signals.toLayerDef().build);

        ctrl.init(wc, ac);

        // Shared X-domain: propagate domain changes to all other channels.
        // syncingRef prevents infinite cascade: when ctrl emits domainChanged
        // we set syncingRef=true before syncing others, so their domainChanged
        // listeners return early.
        ctrl.on('domainChanged', ({ xDomain }) => {
          if (syncingRef.current || !xDomain) return;
          syncingRef.current = true;
          ctrlsRef.current.forEach((other, j) => {
            if (j !== i && other) other.viewport.setXDomain(xDomain);
          });
          syncingRef.current = false;
        });

        // Table refresh on user drag commit (roiFinalized forwarded by PlotController)
        ctrl.on('roiFinalized', ({ roi }) => {
          if (roi.type !== 'lineROI') return;
          setTableRows(prev => prev.map(row =>
            row.plotIndex === i
              ? { ...row, label: roi.label ?? '', position: roi.position, version: roi.version }
              : row
          ));
        });

        ctrlsRef.current[i] = ctrl;
      }

      _onAllReady();
    }

    rafId = requestAnimationFrame(initAll);

    return () => {
      cancelAnimationFrame(rafId);
      ctrlsRef.current.forEach(ctrl => ctrl?.destroy());
      ctrlsRef.current.fill(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    plots: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    plotWrap: {
      flexShrink: 0, position: 'relative', height: 160,
      borderBottom: '1px solid #161616',
    },
    canvas: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' },
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
          50 stacked channels · shared X-axis · V = add vline · drag pick to move
        </span>
        <span style={{ marginLeft: 'auto', ...S.hint }}>
          scroll=zoom&nbsp;&nbsp;drag=pan
        </span>
        <HelpOverlay
          storageKey="masterplot-help-seismography"
          title="Seismography Controls"
          controls={[
            { key: 'Scroll',        description: 'Zoom X-axis (shared across all channels)' },
            { key: 'Drag',          description: 'Pan X-axis (shared across all channels)' },
            { key: 'Space',         description: 'Auto-scale to full time range' },
            { key: 'Drag P-pick',   description: 'Drag the vline P-wave pick on any channel' },
            { key: 'Sidebar table', description: 'Edit station label or position — applies version-gated updateFromExternal' },
          ]}
        />
      </div>

      {/* ── Body: stacked plots + sidebar table ── */}
      <div style={S.body}>

        {/* 50 stacked PlotController instances */}
        <div style={S.plots}>
          {Array.from({ length: NUM_PLOTS }, (_, i) => (
            <div key={i} style={S.plotWrap}>
              <div style={{ ...S.stationTag, color: `rgb(${COLORS[0].join(',')})` }}>
                {STATION_NAMES[i]}
              </div>
              <canvas
                ref={el => { webglRefs.current[i] = el; }}
                style={S.canvas}
              />
              <canvas
                ref={el => { axisRefs.current[i] = el; }}
                style={{ ...S.canvas, pointerEvents: 'none' }}
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
                    <td style={{ ...S.td, color: `rgb(${COLORS[0].join(',')})`, fontWeight: 700 }}>
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
