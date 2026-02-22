/**
 * SharedDataExample — demonstrates F17: shared DataStore / PlotDataView
 * across two PlotController instances.
 *
 * Architecture:
 *   sharedStore  ─────────────────┬──────── PlotController A (all points)
 *                                 │
 *   baseView (PlotDataView)       │         PlotController B
 *     └─ filteredView (optional) ─┘           (filtered by ROI drawn on A)
 *
 * Interactions:
 *   - "Generate data" button: appends 2000 random points to sharedStore
 *     → both plots update within the same render frame
 *   - Press 'L' on Plot A canvas, click twice to draw a LinearRegion
 *     → on roiFinalized, Plot B recomputes to show only enclosed points
 *   - Press 'D' on Plot A canvas to delete the LinearRegion
 *     → Plot B reverts to showing all points
 *   - Point count badges update independently per plot
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { DataStore } from '../src/plot/DataStore.js';
import { PlotDataView } from '../src/plot/PlotDataView.js';

// ── Shared DataStore — created once outside React tree ───────────────────────
// Using module-level ref so it survives re-renders without triggering them.
let _sharedStore = null;
function getSharedStore() {
  if (!_sharedStore) _sharedStore = new DataStore();
  return _sharedStore;
}

function generateBatch(count = 2000) {
  const x     = new Float32Array(count);
  const y     = new Float32Array(count);
  const size  = new Float32Array(count);
  const color = new Uint8Array(count * 4);
  for (let i = 0; i < count; i++) {
    x[i] = Math.random() * 100;
    y[i] = Math.random() * 100;
    size[i] = 3 + Math.random() * 5;
    const base = i * 4;
    // colour by x-position: blue → green → orange
    if (x[i] < 33) {
      color[base] = 60; color[base+1] = 120; color[base+2] = 220; color[base+3] = 200;
    } else if (x[i] < 66) {
      color[base] = 80; color[base+1] = 200; color[base+2] = 100; color[base+3] = 200;
    } else {
      color[base] = 240; color[base+1] = 120; color[base+2] = 40; color[base+3] = 200;
    }
  }
  return { x, y, size, color };
}

export default function SharedDataExample() {
  const plotARef = useRef(null);
  const plotBRef = useRef(null);

  // Track the active ROI ID on Plot A (null = no ROI)
  const activeRoiIdRef   = useRef(null);
  const filteredViewRef  = useRef(null);
  const baseViewRef      = useRef(null);
  const ctrlARef         = useRef(null);
  const ctrlBRef         = useRef(null);

  const [log, setLog] = useState([]);
  const [ptCountA, setPtCountA] = useState(0);
  const [ptCountB, setPtCountB] = useState(0);
  const [roiInfo, setRoiInfo] = useState(null);

  const addLog = useCallback((msg) => {
    setLog(prev => [msg, ...prev].slice(0, 25));
  }, []);

  const sharedStore = getSharedStore();

  // ── Post-init wiring (called once both controllers are ready) ────────────
  const tryWire = useCallback(() => {
    const ctrlA = ctrlARef.current;
    const ctrlB = ctrlBRef.current;
    if (!ctrlA || !ctrlB) return;

    // Create base PlotDataView over the shared DataStore, using Plot A's ROI controller
    const baseView = new PlotDataView(sharedStore, null, {
      roiController: ctrlA.roiController,
    });
    baseViewRef.current = baseView;

    // Attach base view to both plots (neither owns it — example manages lifecycle)
    ctrlA.setDataView(baseView, /* owns */ false);
    ctrlB.setDataView(baseView, /* owns */ false);

    // ── Plot A ROI events → drive Plot B's filtered view ──────────────────
    ctrlA.on('roiCreated', ({ type, roi }) => {
      if (type !== 'linearRegion') return; // only filter on LinearRegion

      activeRoiIdRef.current = roi.id;

      // Destroy previous filtered view if any
      if (filteredViewRef.current) {
        filteredViewRef.current.destroy();
        filteredViewRef.current = null;
      }

      const filteredView = baseView.filterByROI(roi.id);
      filteredViewRef.current = filteredView;

      // Plot B owns this filtered view; setDataView handles listener wiring
      ctrlB.setDataView(filteredView, /* owns */ true);

      addLog(`roiCreated: ${roi.id} — Plot B now filtered`);
      setRoiInfo(`LinearRegion ${roi.id}`);
    });

    ctrlA.on('roiDeleted', ({ id }) => {
      if (id !== activeRoiIdRef.current) return;

      activeRoiIdRef.current = null;
      // filteredView is destroyed by setDataView (since Plot B owned it)
      filteredViewRef.current = null;

      // Revert Plot B to the base (all-points) view
      ctrlB.setDataView(baseView, /* owns */ false);

      addLog(`roiDeleted: ${id} — Plot B reverted to all points`);
      setRoiInfo(null);
    });

    ctrlA.on('roiFinalized', ({ roi }) => {
      if (roi.id !== activeRoiIdRef.current) return;
      const b = roi.getBounds();
      addLog(`roiFinalized: x[${b.x1.toFixed(1)}, ${b.x2.toFixed(1)}] — Plot B recomputed`);
    });

    // ── Track point counts independently ──────────────────────────────────
    // Plot A always shows all points (base view)
    const updateCountA = () => setPtCountA(sharedStore.getPointCount());
    const updateCountB = () => {
      const view = filteredViewRef.current || baseViewRef.current;
      if (!view) return;
      try {
        const data = view.getData();
        setPtCountB(data.x.length);
      } catch (_) {}
    };

    sharedStore.on('dirty', () => {
      updateCountA();
      // After data lands in the view, update count on next recompute
    });

    ctrlB.on('dataExpired', updateCountB);

    // Wire baseView recomputed → update Plot B count
    baseView.on('recomputed', () => {
      updateCountA();
      if (!filteredViewRef.current) updateCountB();
    });

    // Also forward Plot A's log-worthy events
    ctrlA.on('zoomChanged', () => addLog('Plot A: zoomChanged'));
    ctrlA.on('panChanged',  () => {});

    addLog('Shared DataStore wired. Both plots share the same data source.');
  }, [sharedStore, addLog]);

  const onInitA = useCallback((ctrl) => {
    ctrlARef.current = ctrl;
    tryWire();
  }, [tryWire]);

  const onInitB = useCallback((ctrl) => {
    ctrlBRef.current = ctrl;
    tryWire();
  }, [tryWire]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (filteredViewRef.current) filteredViewRef.current.destroy();
      if (baseViewRef.current) baseViewRef.current.destroy();
      // sharedStore is module-level; reset for next mount
      _sharedStore = null;
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleGenerate = () => {
    const batch = generateBatch(2000);
    sharedStore.appendData(batch);
    addLog(`Generated 2000 pts → total ${sharedStore.getPointCount().toLocaleString()}`);
    setPtCountA(sharedStore.getPointCount());
  };

  const handleClear = () => {
    sharedStore.clear();
    // Both controllers will re-render on next dirty
    sharedStore.emit('dirty');
    setPtCountA(0);
    setPtCountB(0);
    addLog('Store cleared');
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const S = {
    root: {
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace',
      overflow: 'hidden',
    },
    header: {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 16px', borderBottom: '1px solid #222',
      flexShrink: 0,
    },
    title: { fontSize: 14, fontWeight: 700, color: '#7df', marginRight: 8 },
    btn: {
      padding: '4px 12px', background: '#1a1a1a', border: '1px solid #333',
      color: '#ccc', cursor: 'pointer', fontSize: 12, borderRadius: 3,
    },
    hint: { fontSize: 11, color: '#555' },
    roiTag: {
      fontSize: 11, color: '#fa0', background: '#1a1400',
      border: '1px solid #443300', padding: '2px 8px', borderRadius: 3,
    },
    body: { display: 'flex', flex: 1, overflow: 'hidden' },
    plots: { display: 'flex', flexDirection: 'column', flex: 1, gap: 2, padding: 4 },
    plotWrap: { flex: 1, position: 'relative', minHeight: 0 },
    label: {
      position: 'absolute', top: 4, left: 8,
      fontSize: 11, color: '#7df', pointerEvents: 'none',
      background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 2, zIndex: 10,
    },
    countBadge: {
      position: 'absolute', bottom: 4, right: 8,
      fontSize: 11, color: '#888', pointerEvents: 'none',
      background: 'rgba(0,0,0,0.5)', padding: '1px 6px', borderRadius: 2, zIndex: 10,
    },
    sidebar: {
      width: 260, borderLeft: '1px solid #222', display: 'flex',
      flexDirection: 'column', padding: 8, gap: 6, overflowY: 'auto', flexShrink: 0,
    },
    sideTitle: { fontSize: 11, color: '#555', marginBottom: 2 },
    logLine: { fontSize: 10, color: '#888', lineHeight: 1.5 },
  };

  return (
    <div style={S.root}>
      {/* ── Header ── */}
      <div style={S.header}>
        <span style={S.title}>Shared Data</span>
        <button style={S.btn} onClick={handleGenerate}>+ Generate 2000 pts</button>
        <button style={S.btn} onClick={handleClear}>Clear</button>
        <span style={S.hint}>Press <b>L</b> on Plot A, click twice to draw a LinearRegion</span>
        {roiInfo && <span style={S.roiTag}>ROI active: {roiInfo}</span>}
      </div>

      {/* ── Body ── */}
      <div style={S.body}>
        {/* Two stacked plots */}
        <div style={S.plots}>
          {/* Plot A */}
          <div style={S.plotWrap}>
            <div style={S.label}>Plot A — all data (draw ROI here)</div>
            <div style={{ position: 'absolute', top: 4, right: 8, ...S.label, left: 'unset' }}>
              {ptCountA.toLocaleString()} pts
            </div>
            <PlotCanvas
              ref={plotARef}
              width="100%"
              height="100%"
              xDomain={[0, 100]}
              yDomain={[0, 100]}
              xLabel="X"
              yLabel="Y"
              dataStore={sharedStore}
              onInit={onInitA}
            />
          </div>

          {/* Plot B */}
          <div style={S.plotWrap}>
            <div style={S.label}>
              Plot B — {roiInfo ? `filtered by ${roiInfo}` : 'all data (shared)'}
            </div>
            <div style={{ position: 'absolute', top: 4, right: 8, ...S.label, left: 'unset' }}>
              {ptCountB.toLocaleString()} pts
            </div>
            <PlotCanvas
              ref={plotBRef}
              width="100%"
              height="100%"
              xDomain={[0, 100]}
              yDomain={[0, 100]}
              xLabel="X"
              yLabel="Y"
              dataStore={sharedStore}
              onInit={onInitB}
            />
          </div>
        </div>

        {/* Sidebar log */}
        <div style={S.sidebar}>
          <div style={S.sideTitle}>Event log</div>
          {log.map((line, i) => (
            <div key={i} style={S.logLine}>{line}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
