/**
 * ExampleApp — demonstrates all MasterPlot MVP features.
 *
 * Features demonstrated:
 *  1. 1M initial points rendered via WebGL (log-x axis)
 *  2. Zoom (mouse wheel, centered on cursor)
 *  3. Pan (drag)
 *  4. LinearRegion creation ('L' key → 2 clicks)
 *  5. RectROI creation ('R' key → 2 clicks)
 *  6. Delete ROI ('D' key)
 *  7. Constraint: drag LinearRegion → nested RectROI follows
 *  8. Live append: 10k points every 2 seconds (toggleable)
 *  9. Auto-expand domain toggle
 * 10. All events logged to console
 *
 * Keybinds:
 *   L  — create LinearRegion
 *   R  — create RectROI (auto-parents to overlapping LinearRegion)
 *   D  — delete selected ROI
 *   Esc — cancel creation
 */

import { useRef, useEffect, useState } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { generatePoints, generateAppendChunk } from './dataGenerator.js';

const INITIAL_POINT_COUNT = 1_000_000;
const APPEND_INTERVAL_MS  = 2_000;

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

  const addLog = (msg) => {
    setLog(prev => [msg, ...prev].slice(0, 20));
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
  };

  const logPanelStyle = {
    height:      120,
    background:  '#0a0a0a',
    borderTop:   '1px solid #222',
    overflowY:   'auto',
    padding:     '4px 12px',
    fontSize:    11,
    flexShrink:  0,
  };

  const keybindStyle = {
    display:     'flex',
    gap:         12,
    alignItems:  'center',
    color:       '#888',
  };

  const checkboxLabelStyle = {
    display:    'flex',
    alignItems: 'center',
    gap:        5,
    color:      '#888',
    cursor:     'pointer',
    userSelect: 'none',
  };

  const kbd = (k) => (
    <span style={{ background: '#222', border: '1px solid #444', borderRadius: 3, padding: '1px 5px', color: '#ddd' }}>
      {k}
    </span>
  );

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong style={{ color: '#fff', fontSize: 14 }}>MasterPlot</strong>
        <span style={{ color: '#555' }}>|</span>
        <div style={keybindStyle}>
          {kbd('L')} LinearRegion &nbsp;
          {kbd('R')} RectROI &nbsp;
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
    </div>
  );
}
