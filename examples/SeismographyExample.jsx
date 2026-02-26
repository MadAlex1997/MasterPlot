/**
 * SeismographyExample — EX5: 10 stacked seismograph channels.
 *
 * Architecture:
 *   10 LinePlotControllers, each with its own independent Y-axis.
 *   X-axis domain is shared: panning/zooming on any channel propagates to all
 *   others via zoomChanged/panChanged → xAxis.setDomain() (no syncingRef needed;
 *   these events only fire from user interaction, not from programmatic setDomain).
 *
 *   Each channel has a pre-seeded vline-half-bottom LineROI representing a
 *   P-wave pick.  Picks are draggable and labelled on the canvas overlay.
 *
 *   A separate ROIController is created per channel and attached to the same
 *   webgl canvas.  LinePlotController._onMouseDown is patched to yield to ROI
 *   hit-tests so that clicking on a pick drags it instead of panning the plot.
 *
 *   AxisRenderer.render() is monkey-patched to forward ROIs so LineROI labels
 *   are drawn on the 2D canvas overlay.
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
import { LinePlotController } from '../src/plot/LinePlotController.js';
import { ROIController }      from '../src/plot/ROI/ROIController.js';
import { LineROI }            from '../src/plot/ROI/LineROI.js';

// ── ROI canvas renderer ───────────────────────────────────────────────────────
//
// LinePlotController has no ROILayer — it only renders PathLayer signal data.
// We draw ROI geometry on the 2D axis canvas overlay instead, in three passes:
//   1. origRender([])  — clear + ticks/border, no labels
//   2. _drawROILines   — colored line + selection handle
//   3. _renderLineROILabels — text label on top of the line
//
// Passing [] to origRender suppresses label drawing so labels can be re-drawn
// after the lines, keeping the correct z-order.

function _drawROILines(ctx, rois, viewport) {
  const pa = viewport.plotArea;

  for (const roi of rois) {
    if (!roi.flags.visible) continue;
    if (roi.type !== 'lineROI') continue;

    ctx.save();
    const alpha = roi.selected ? 0.94 : 0.70;
    ctx.strokeStyle = `rgba(255,80,80,${alpha})`;
    ctx.lineWidth   = roi.selected ? 2 : 1.5;
    ctx.beginPath();

    if (roi.orientation === 'vertical') {
      const sx = viewport.dataXToScreen(roi.position);
      if (sx < pa.x || sx > pa.x + pa.width) { ctx.restore(); continue; }
      const midY = pa.y + pa.height / 2;

      if (roi.mode === 'vline-half-top') {
        ctx.moveTo(sx, midY); ctx.lineTo(sx, pa.y);
      } else if (roi.mode === 'vline-half-bottom') {
        ctx.moveTo(sx, pa.y + pa.height); ctx.lineTo(sx, midY);
      } else {
        ctx.moveTo(sx, pa.y); ctx.lineTo(sx, pa.y + pa.height);
      }
    } else {
      const sy = viewport.dataYToScreen(roi.position);
      if (sy < pa.y || sy > pa.y + pa.height) { ctx.restore(); continue; }
      const midX = pa.x + pa.width / 2;

      if (roi.mode === 'hline-half-left') {
        ctx.moveTo(pa.x, sy); ctx.lineTo(midX, sy);
      } else if (roi.mode === 'hline-half-right') {
        ctx.moveTo(midX, sy); ctx.lineTo(pa.x + pa.width, sy);
      } else {
        ctx.moveTo(pa.x, sy); ctx.lineTo(pa.x + pa.width, sy);
      }
    }
    ctx.stroke();

    // Selection handle: midpoint dot
    if (roi.selected) {
      const hx = roi.orientation === 'vertical'
        ? viewport.dataXToScreen(roi.position)
        : pa.x + pa.width / 2;
      const hy = roi.orientation === 'vertical'
        ? pa.y + pa.height / 2
        : viewport.dataYToScreen(roi.position);

      ctx.fillStyle   = 'rgba(255,255,255,0.87)';
      ctx.lineWidth   = 1;
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.beginPath();
      ctx.arc(hx, hy, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ── Config ─────────────────────────────────────────────────────────────────────

const NUM_PLOTS      = 50;
const SAMPLE_RATE    = 40;
const T_MAX          = 300;
const NUM_POINTS     = T_MAX * SAMPLE_RATE;
const Y_DOMAIN       = [-1.5, 1.5];

const STATION_NAMES = Array.from({length: NUM_PLOTS},(_, i) =>'ST'+String(i).padStart(3,'0'));


// Distinct frequency per channel (Hz)
const FREQS  = Array.from({length: NUM_PLOTS},(_, i) => 0.5+i*.0015);

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
  const webglRefs   = useRef(new Array(NUM_PLOTS).fill(null));
  const axisRefs    = useRef(new Array(NUM_PLOTS).fill(null));

  // Controller refs — never held in React state
  const linCtrlsRef = useRef(new Array(NUM_PLOTS).fill(null));
  const roiCtrlsRef = useRef(new Array(NUM_PLOTS).fill(null));

  // React table state — lightweight display cache; geometry lives in ROI objects
  const [tableRows, setTableRows] = useState([]);

  // ── Post-init: seed LineROIs once all controllers are ready ──────────────────

  function _onAllReady() {
    const initialRows = [];

    roiCtrlsRef.current.forEach((roiCtrl, j) => {
      if (!roiCtrl) return;

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

        // LinePlotController — renders connected PathLayer lines
        const ctrl = new LinePlotController({
          xDomain: [0, T_MAX],
          yDomain: Y_DOMAIN,
          xLabel:  i === NUM_PLOTS - 1 ? 'Time (s)' : '',
          yLabel:  '',
        });

        ctrl.addSignal('s', [r, g, b, 220]);

        // Build signal path directly (x = fractional seconds, not integer indices).
        // appendSignalData uses xBase+i which would give integer x; building the
        // path directly gives exact time coordinates.
        const sig = ctrl._signals.get('s');
        const dt  = 1 / SAMPLE_RATE;
        for (let j = 0; j < NUM_POINTS; j++) {
          const t = j * dt;
          sig.path.push([t, Math.sin(2 * Math.PI * FREQS[i] * t + PHASES[i]), 0]);
        }
        sig.layerData = [{ path: sig.path, color: sig.color }];
        sig.version++;

        ctrl.init(wc, ac);

        // ROIController — shares the same webgl canvas as LinePlotController
        const roiCtrl = new ROIController(ctrl._viewport);
        roiCtrl.init(wc);

        // Patch LinePlotController._onMouseDown to yield to ROI hit-tests.
        // Without this patch, clicking on a pick would simultaneously start a
        // pan on the plot.  We remove the original listener, update the stored
        // reference (so destroy() removes the right handler), and re-add.
        wc.removeEventListener('mousedown', ctrl._onMouseDown);
        const origDown = ctrl._onMouseDown;
        ctrl._onMouseDown = (e) => {
          if (e.button === 0) {
            if (roiCtrl._mode !== 'idle') return;  // ROI creation takes priority
            const pos = ctrl._viewport.getCanvasPosition(e, wc);
            if (ctrl._viewport.isInPlotArea(pos.x, pos.y) &&
                roiCtrl._hitTest(pos.x, pos.y)) return;  // ROI drag takes priority
          }
          origDown(e);
        };
        wc.addEventListener('mousedown', ctrl._onMouseDown);

        // Patch AxisRenderer.render() to draw ROI lines + labels on the 2D canvas.
        // Three-pass order: ticks/border → ROI lines → ROI labels (correct z-order).
        // origRender([]) draws ticks without labels; we then draw lines, then labels.
        const ar = ctrl._axisRenderer;
        const origRender = ar.render.bind(ar);
        ar.render = () => {
          const rois = roiCtrl.getAllROIs();
          origRender([]);                                          // clear + ticks, no labels
          _drawROILines(ar._ctx, rois, ar._viewport);             // colored lines + handles
          ar._renderLineROILabels(ar._ctx, rois, ar._viewport.plotArea); // labels on top
        };

        // ROI geometry change → schedule WebGL re-render
        roiCtrl.on('roisChanged', () => { ctrl._dirty = true; });

        // Shared X-domain: propagate user-driven zoom/pan to all other channels.
        // zoomChanged/panChanged only fire from user wheel/drag interaction,
        // never from programmatic setDomain() calls — no infinite loop risk.
        const syncX = () => {
          const xd = ctrl._xAxis.getDomain();
          linCtrlsRef.current.forEach((other, j) => {
            if (j !== i && other) other._xAxis.setDomain(xd);
          });
        };
        ctrl.on('zoomChanged', syncX);
        ctrl.on('panChanged',  syncX);

        // Table refresh on user drag commit
        roiCtrl.on('roiFinalized', ({ roi }) => {
          if (roi.type !== 'lineROI') return;
          setTableRows(prev => prev.map(row =>
            row.plotIndex === i
              ? { ...row, label: roi.label ?? '', position: roi.position, version: roi.version }
              : row
          ));
        });

        linCtrlsRef.current[i] = ctrl;
        roiCtrlsRef.current[i] = roiCtrl;
      }

      _onAllReady();
    }

    rafId = requestAnimationFrame(initAll);

    return () => {
      cancelAnimationFrame(rafId);
      linCtrlsRef.current.forEach(ctrl => ctrl?.destroy());
      roiCtrlsRef.current.forEach(rc   => rc?.destroy());
      linCtrlsRef.current.fill(null);
      roiCtrlsRef.current.fill(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Edit handlers ────────────────────────────────────────────────────────────

  function handleLabelCommit(plotIndex, newLabel) {
    const roiCtrl = roiCtrlsRef.current[plotIndex];
    if (!roiCtrl) return;
    const row = tableRows.find(r => r.plotIndex === plotIndex);
    if (!row) return;
    const roi = roiCtrl.getROI(row.roiId);
    if (!roi) return;

    const truncated = String(newLabel).slice(0, 25);
    const accepted  = roiCtrl.updateFromExternal({
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
    const roiCtrl = roiCtrlsRef.current[plotIndex];
    if (!roiCtrl) return;
    const row = tableRows.find(r => r.plotIndex === plotIndex);
    if (!row) return;
    const roi = roiCtrl.getROI(row.roiId);
    if (!roi) return;

    const newPos  = parseFloat(newPosStr);
    if (isNaN(newPos)) return;
    const clamped = Math.max(0, Math.min(T_MAX, newPos));

    const accepted = roiCtrl.updateFromExternal({
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
      </div>

      {/* ── Body: stacked plots + sidebar table ── */}
      <div style={S.body}>

        {/* 10 stacked LinePlotController instances */}
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
