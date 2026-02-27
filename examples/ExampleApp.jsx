/**
 * ExampleApp — demonstrates all MasterPlot MVP features.
 *
 * Features demonstrated:
 *  1. 10k initial points rendered via WebGL (log-x axis); dropdown switches 10k–10M
 *  2. Zoom (mouse wheel, centered on cursor)
 *  3. Pan (drag)
 *  4. LinearRegion creation ('L' key → 2 clicks)
 *  5. RectROI creation ('R' key → 2 clicks)
 *  6. Delete ROI ('D' key)
 *  7. Constraint: drag LinearRegion → nested RectROI follows
 *  8. Live append: 10k points every 2 seconds (toggleable)
 *  9. Auto-expand domain toggle
 * 10. All events logged to console
 * 11. LinearRegion table (EX1) — updates on roiCreated/roiFinalized/roiDeleted
 * 12. RectROI subset table (EX1) — shows rects overlapping selected LinearRegion
 * 13. LineROI creation ('V' key → vertical vline, 'H' key → horizontal hline)
 *
 * Keybinds:
 *   L  — create LinearRegion (2 clicks: x1, x2)
 *   R  — create RectROI (auto-parents to overlapping LinearRegion)
 *   V  — create vertical LineROI (single click; auto-parents inside LinearRegion)
 *   H  — create horizontal LineROI (single click)
 *   D  — delete selected ROI
 *   Esc — cancel creation
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { generatePoints, generateAppendChunk } from './dataGenerator.js';

const INITIAL_POINT_COUNT  = 10_000;
const APPEND_INTERVAL_MS   = 2_000;
const POINT_COUNT_OPTIONS  = [10_000, 100_000, 1_000_000, 5_000_000, 10_000_000];

/** True if [a0,a1] overlaps [b0,b1] (open-interval test) */
function xOverlaps(a, b) {
  return a[0] < b[1] && a[1] > b[0];
}

export default function ExampleApp() {
  const plotRef  = useRef(null);
  const appendIntervalRef = useRef(null);
  const roiUpdateDebounceRef = useRef(null);
  const [log, setLog] = useState([]);
  const [roiCount, setRoiCount] = useState(0);
  const [liveAppend, setLiveAppend] = useState(true);
  const [autoExpand, setAutoExpand] = useState(true);
  const [dragPan, setDragPan] = useState(false);
  const [panSpeed, setPanSpeed] = useState(0.02);
  const [pointCount, setPointCount] = useState(INITIAL_POINT_COUNT);

  // ── EX1: ROI table state ────────────────────────────────────────────────────
  const [linearROIs,      setLinearROIs]      = useState([]);
  const [selectedLinearId, setSelectedLinearId] = useState(null);
  const [childRects,      setChildRects]      = useState([]);

  // ── EX6: plot-selection state (double-click highlights on plot) ─────────────
  const [plotSelectedLinearId, setPlotSelectedLinearId] = useState(null);
  const [plotSelectedRectId,   setPlotSelectedRectId]   = useState(null);

  // Refs to avoid stale closures in event handler callbacks
  const roiControllerRef       = useRef(null);
  const selectedLinearIdRef    = useRef(null);
  const plotSelectedLinearIdRef = useRef(null);
  const plotSelectedRectIdRef   = useRef(null);

  const addLog = (msg) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
  };

  // ── EX1: refresh both tables from serializeAll() ────────────────────────────
  const refreshROITables = useCallback(() => {
    const rc = roiControllerRef.current;
    if (!rc) return;
    const all     = rc.serializeAll();
    const linears = all.filter(r => r.type === 'linearRegion');
    setLinearROIs(linears);

    const selId = selectedLinearIdRef.current;
    if (selId) {
      const sel = linears.find(l => l.id === selId);
      if (sel) {
        setChildRects(all.filter(r => r.type === 'rect' && xOverlaps(r.domain.x, sel.domain.x)));
        // EX6: clear plotSelectedRect if the rect was deleted
        const pRectId = plotSelectedRectIdRef.current;
        if (pRectId && !all.find(r => r.id === pRectId)) {
          plotSelectedRectIdRef.current = null;
          setPlotSelectedRectId(null);
        }
      } else {
        // Selected linear was deleted — clear selection
        selectedLinearIdRef.current = null;
        setSelectedLinearId(null);
        setChildRects([]);
        // EX6: clear plot-selected state if it pointed to the deleted linear
        if (plotSelectedLinearIdRef.current === selId) {
          plotSelectedLinearIdRef.current = null;
          setPlotSelectedLinearId(null);
        }
      }
    } else {
      setChildRects([]);
    }
  }, []); // stable: reads only from refs

  // ── EX1: onInit — subscribe to roiController after controller is ready ──────
  const handlePlotInit = useCallback((controller) => {
    roiControllerRef.current = controller.roiController;
    const rc = controller.roiController;
    rc.on('roiCreated',  refreshROITables);
    rc.on('roiFinalized', refreshROITables);
    rc.on('roiDeleted',  refreshROITables);
  }, [refreshROITables]);

  // ── EX1: select/deselect a linear region row ─────────────────────────────────
  const handleSelectLinear = (id) => {
    const newId = selectedLinearIdRef.current === id ? null : id;
    selectedLinearIdRef.current = newId;
    setSelectedLinearId(newId);

    // Immediately recompute child rects for new selection
    const rc = roiControllerRef.current;
    if (!rc) { setChildRects([]); return; }
    const all = rc.serializeAll();
    if (newId) {
      const sel = all.find(l => l.id === newId);
      if (sel) {
        setChildRects(all.filter(r => r.type === 'rect' && xOverlaps(r.domain.x, sel.domain.x)));
        return;
      }
    }
    setChildRects([]);
  };

  // ── EX6: double-click a LinearRegion row → filter + highlight on plot ───────
  const handleDoubleClickLinear = (id) => {
    // Always set as active filter (never toggle on double-click)
    selectedLinearIdRef.current = id;
    setSelectedLinearId(id);

    const rc = roiControllerRef.current;
    if (!rc) return;
    const all = rc.serializeAll();
    const sel = all.find(l => l.id === id);
    if (sel) {
      setChildRects(all.filter(r => r.type === 'rect' && xOverlaps(r.domain.x, sel.domain.x)));
    }

    // Programmatically select on plot
    const roi = rc.getROI(id);
    if (roi) {
      rc._selectOnly(roi);
      rc.emit('roisChanged', { rois: rc.getAllROIs() });
    }

    // Update double-click highlight state
    plotSelectedLinearIdRef.current = id;
    setPlotSelectedLinearId(id);
    plotSelectedRectIdRef.current = null;
    setPlotSelectedRectId(null);
  };

  // ── EX6: double-click a RectROI row → highlight rect + auto-select parent ──
  const handleDoubleClickRect = (id, parentId) => {
    const rc = roiControllerRef.current;
    if (!rc) return;

    // Programmatically select the rect on plot
    const roi = rc.getROI(id);
    if (roi) {
      rc._selectOnly(roi);
      rc.emit('roisChanged', { rois: rc.getAllROIs() });
    }

    // Update double-click highlight state
    plotSelectedRectIdRef.current = id;
    setPlotSelectedRectId(id);
    plotSelectedLinearIdRef.current = parentId ?? null;
    setPlotSelectedLinearId(parentId ?? null);

    // Auto-select parent linear in the table filter
    if (parentId && parentId !== selectedLinearIdRef.current) {
      selectedLinearIdRef.current = parentId;
      setSelectedLinearId(parentId);
      const all = rc.serializeAll();
      const parentSer = all.find(l => l.id === parentId);
      if (parentSer) {
        setChildRects(all.filter(r => r.type === 'rect' && xOverlaps(r.domain.x, parentSer.domain.x)));
      }
    }
  };

  // Handle events from PlotController
  const handleEvent = (eventName, data) => {
    switch (eventName) {
      case 'roiCreated':
        console.log('[roiCreated]', data.type, data.roi.id);
        addLog(`roiCreated: ${data.type} (${data.roi.id})`);
        setRoiCount(c => c + 1);
        break;
      case 'roiUpdated': {
        // Debounce: log only when the stream of updates stops (~150 ms after drag ends).
        clearTimeout(roiUpdateDebounceRef.current);
        const capturedData = data;
        roiUpdateDebounceRef.current = setTimeout(() => {
          const b = capturedData.bounds;
          addLog(`roiUpdated: ${capturedData.roi.id}  x[${b.x1.toFixed(1)}, ${b.x2.toFixed(1)}]  y[${b.y1.toFixed(1)}, ${b.y2.toFixed(1)}]`);
        }, 150);
        break;
      }
      case 'roiDeleted':
        console.log('[roiDeleted]', data.id);
        addLog(`roiDeleted: ${data.id}`);
        setRoiCount(c => Math.max(0, c - 1));
        break;
      case 'dataAppended':
        console.log('[dataAppended]', `+${data.count} pts, total: ${data.total}`);
        addLog(`dataAppended: +${data.count.toLocaleString()} pts`);
        break;
      case 'domainChanged':
        console.log('[domainChanged]', data);
        addLog(`domainChanged: x=[${data.xDomain?.map(v=>v.toFixed(2)).join(', ')}]`);
        break;
      case 'zoomChanged':
        console.log('[zoomChanged]', `factor=${data.factor?.toFixed(3)}`);
        addLog(`zoomChanged: factor=${data.factor?.toFixed(3)}`);
        break;
      case 'panChanged':
        if (Math.abs(data.dx) + Math.abs(data.dy) > 5) {
          addLog(`panChanged: dx=${data.dx.toFixed(0)} dy=${data.dy.toFixed(0)}`);
        }
        break;
      default:
        break;
    }
  };

  const startAppend = (controller) => {
    if (!controller) return;
    appendIntervalRef.current = setInterval(() => {
      const chunk = generateAppendChunk();
      controller.appendData(chunk);
    }, APPEND_INTERVAL_MS);
  };

  // Load initial data and start live append
  useEffect(() => {
    // Small delay to ensure PlotCanvas init has run
    const initTimer = setTimeout(() => {
      const controller = plotRef.current?.getController();
      if (!controller) return;

      // Load 1M initial points
      console.log('[init] Generating 1M points...');
      const initialData = generatePoints(INITIAL_POINT_COUNT);
      controller.appendData(initialData);
      console.log('[init] 1M points loaded.');

      // Start live append every 2 seconds
      startAppend(controller);
    }, 200);

    return () => {
      clearTimeout(initTimer);
      clearInterval(appendIntervalRef.current);
    };
  }, []);

  const handleLiveAppendChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      startAppend(plotRef.current?.getController());
    } else {
      clearInterval(appendIntervalRef.current);
    }
    setLiveAppend(checked);
  };

  const handleAutoExpandChange = (e) => {
    const checked = e.target.checked;
    plotRef.current?.getController()?.setAutoExpand(checked);
    setAutoExpand(checked);
  };

  const handleDragPanChange = (e) => {
    const checked = e.target.checked;
    plotRef.current?.getController()?.setPanMode(checked ? 'drag' : 'follow');
    setDragPan(checked);
  };

  const handlePanSpeedChange = (e) => {
    const v = parseFloat(e.target.value);
    plotRef.current?.getController()?.setFollowPanSpeed(v);
    setPanSpeed(v);
  };

  // ── EX4: Replace DataStore data on point-count dropdown change ───────────────
  const handlePointCountChange = (e) => {
    const count = Number(e.target.value);
    setPointCount(count);
    const controller = plotRef.current?.getController();
    if (!controller) return;

    // Pause live append during replacement
    clearInterval(appendIntervalRef.current);

    // Clear store (resets count/indices without de-allocating buffers)
    controller.dataStore.clear();

    // Reset domain to the generator's range so autoExpand has a clean baseline
    controller.xAxis.setDomain([0, 10000]);
    controller.yAxis.setDomain([0, 100]);

    // Load new data — no large arrays stored in React state
    controller.appendData(generatePoints(count));

    // Resume live append if it was running
    if (liveAppend) {
      startAppend(controller);
    }
  };

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerStyle = {
    display:       'flex',
    flexDirection: 'column',
    width:         '100vw',
    height:        '100vh',
    background:    '#0d0d0d',
    color:         '#ccc',
    fontFamily:    'monospace',
  };

  const headerStyle = {
    display:        'flex',
    alignItems:     'center',
    gap:            16,
    padding:        '6px 16px',
    background:     '#151515',
    borderBottom:   '1px solid #333',
    fontSize:       12,
    flexShrink:     0,
  };

  const plotWrapStyle = {
    flex:     1,
    position: 'relative',
    overflow: 'hidden',
    minHeight: 0,
  };

  const logPanelStyle = {
    height:      100,
    background:  '#0a0a0a',
    borderTop:   '1px solid #222',
    overflowY:   'auto',
    padding:     '4px 12px',
    fontSize:    11,
    flexShrink:  0,
  };

  const roiPanelStyle = {
    display:     'flex',
    flexDirection: 'row',
    gap:         0,
    height:      160,
    background:  '#0c0c0c',
    borderTop:   '1px solid #2a2a2a',
    flexShrink:  0,
    overflow:    'hidden',
  };

  const tableContainerStyle = {
    flex:       1,
    overflowY:  'auto',
    padding:    '6px 10px',
    borderRight: '1px solid #222',
  };

  const tableStyle = {
    width:          '100%',
    borderCollapse: 'collapse',
    fontSize:       11,
  };

  const thStyle = {
    textAlign:    'left',
    padding:      '2px 6px',
    color:        '#666',
    borderBottom: '1px solid #2a2a2a',
    fontWeight:   'normal',
    userSelect:   'none',
  };

  const keyStyle = {
    background: '#222', border: '1px solid #444', borderRadius: 3,
    padding: '1px 5px', color: '#ddd',
  };

  const kbd = (k) => (
    <span style={keyStyle}>{k}</span>
  );

  const checkboxLabelStyle = {
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    color:      '#888',
    cursor:     'pointer',
    userSelect: 'none',
  };

  const keybindStyle = {
    display:     'flex',
    gap:         12,
    alignItems:  'center',
    color:       '#888',
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong style={{ color: '#fff', fontSize: 14 }}>MasterPlot</strong>
        <span style={{ color: '#555' }}>|</span>
        <div style={keybindStyle}>
          {kbd('L')} LinearRegion &nbsp;
          {kbd('R')} RectROI &nbsp;
          {kbd('V')} VLine &nbsp;
          {kbd('H')} HLine &nbsp;
          {kbd('D')} Delete &nbsp;
          {kbd('Esc')} Cancel &nbsp;
          {kbd('scroll')} Zoom &nbsp;
          {kbd('drag')} Pan
        </div>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={liveAppend} onChange={handleLiveAppendChange} />
          Live append
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={autoExpand} onChange={handleAutoExpandChange} />
          Auto-expand
        </label>
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={dragPan} onChange={handleDragPanChange} />
          Drag pan
        </label>
        <label style={checkboxLabelStyle}>
          Pan speed
          <input type="range" min="0.005" max="0.1" step="0.001"
            value={panSpeed} onChange={handlePanSpeedChange}
            style={{ verticalAlign: 'middle', margin: '0 4px' }} />
          {panSpeed.toFixed(3)}
        </label>
        <label style={checkboxLabelStyle}>
          Points
          <select
            value={pointCount}
            onChange={handlePointCountChange}
            style={{ background: '#222', color: '#ccc', border: '1px solid #444', borderRadius: 3, padding: '1px 4px', fontSize: 11 }}
          >
            {POINT_COUNT_OPTIONS.map(n => (
              <option key={n} value={n}>{n.toLocaleString()}</option>
            ))}
          </select>
        </label>
        <span style={{ marginLeft: 'auto', color: '#666' }}>ROIs: {roiCount}</span>
      </div>

      <div style={plotWrapStyle}>
        <PlotCanvas
          ref={plotRef}
          width="100%"
          height="100%"
          xScaleType="linear"
          yScaleType="linear"
          xDomain={[0, 10000]}
          yDomain={[0, 100]}
          xLabel="X"
          yLabel="Y"
          onEvent={handleEvent}
          onInit={handlePlotInit}
        />
      </div>

      <div style={logPanelStyle}>
        {log.map((msg, i) => (
          <div key={i} style={{ color: i === 0 ? '#adf' : '#556', lineHeight: '1.5' }}>
            {msg}
          </div>
        ))}
        {log.length === 0 && <span style={{ color: '#333' }}>Event log (last 20 events)...</span>}
      </div>

      {/* ── EX1: ROI Inspection Tables ──────────────────────────────────────── */}
      <div style={roiPanelStyle}>
        {/* Left: LinearRegion table */}
        <div style={tableContainerStyle}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
            LinearRegions
            <span style={{ color: '#444', marginLeft: 8 }}>
              {linearROIs.length === 0 ? '(none — press L to draw)' : `${linearROIs.length} total · click to filter · dbl-click to select on plot`}
            </span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Left</th>
                <th style={thStyle}>Right</th>
                <th style={thStyle}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {linearROIs.map(r => {
                const isSelected     = r.id === selectedLinearId;
                const isPlotSelected = r.id === plotSelectedLinearId;
                return (
                  <tr
                    key={r.id}
                    onClick={() => handleSelectLinear(r.id)}
                    onDoubleClick={() => handleDoubleClickLinear(r.id)}
                    style={{
                      cursor:        'pointer',
                      background:    isSelected ? '#1a2a1a' : 'transparent',
                      outline:       isPlotSelected ? '1px solid #4f4' : 'none',
                      outlineOffset: '-1px',
                    }}
                  >
                    <td style={{ padding: '2px 6px', color: isSelected ? '#8f8' : '#88b', fontSize: 10 }}>
                      {r.id.slice(0, 8)}
                    </td>
                    <td style={{ padding: '2px 6px', color: '#ccc' }}>
                      {r.domain.x[0].toFixed(2)}
                    </td>
                    <td style={{ padding: '2px 6px', color: '#ccc' }}>
                      {r.domain.x[1].toFixed(2)}
                    </td>
                    <td style={{ padding: '2px 6px', color: '#666' }}>
                      {r.version}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Right: RectROI subset table */}
        <div style={{ ...tableContainerStyle, borderRight: 'none' }}>
          <div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>
            RectROIs within selected LinearRegion
            <span style={{ color: '#444', marginLeft: 8 }}>
              {!selectedLinearId
                ? '(select a LinearRegion row)'
                : childRects.length === 0
                  ? '(none — press R inside a LinearRegion)'
                  : `${childRects.length} rect${childRects.length !== 1 ? 's' : ''} · dbl-click to select on plot`}
            </span>
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={thStyle}>Left</th>
                <th style={thStyle}>Right</th>
                <th style={thStyle}>Bottom</th>
                <th style={thStyle}>Top</th>
                <th style={thStyle}>Ver</th>
              </tr>
            </thead>
            <tbody>
              {childRects.map(r => {
                const isPlotSelected = r.id === plotSelectedRectId;
                return (
                <tr
                  key={r.id}
                  onDoubleClick={() => handleDoubleClickRect(r.id, r.parentId)}
                  style={{
                    cursor:        'pointer',
                    background:    isPlotSelected ? '#2a1a1a' : 'transparent',
                    outline:       isPlotSelected ? '1px solid #f88' : 'none',
                    outlineOffset: '-1px',
                  }}
                >
                  <td style={{ padding: '2px 6px', color: '#b88', fontSize: 10 }}>
                    {r.id.slice(0, 8)}
                  </td>
                  <td style={{ padding: '2px 6px', color: '#ccc' }}>
                    {r.domain.x[0].toFixed(2)}
                  </td>
                  <td style={{ padding: '2px 6px', color: '#ccc' }}>
                    {r.domain.x[1].toFixed(2)}
                  </td>
                  <td style={{ padding: '2px 6px', color: '#ccc' }}>
                    {r.domain.y ? r.domain.y[0].toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '2px 6px', color: '#ccc' }}>
                    {r.domain.y ? r.domain.y[1].toFixed(2) : '—'}
                  </td>
                  <td style={{ padding: '2px 6px', color: '#666' }}>
                    {r.version}
                  </td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
