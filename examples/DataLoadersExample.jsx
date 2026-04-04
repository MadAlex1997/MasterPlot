/**
 * DataLoadersExample — EX19
 *
 * Demonstrates TableLoaderAdapter (F32) and RasterLoaderAdapter (F33).
 *
 *   Panel 1 — Tabular (scatter):
 *     Drag-and-drop or <input> accepting .csv, .tsv, .arrow, .parquet.
 *     After parse: two <select> dropdowns for X/Y column choice.
 *     "Load" button calls TableLoaderAdapter.loadFile() with chosen columns.
 *     Progress bar updated via 'chunk' events.
 *     "Load Sample CSV" generates 10k-row synthetic data in-memory.
 *
 *   Panel 2 — Raster (heatmap):
 *     <input> accepting .nc, .cdf, .png, .jpg, .webp, .bmp.
 *     For NetCDF files: variable + dimension selects appear after parse.
 *     LUTPanel sidebar for real-time colormap + level adjustment.
 *     "Load Sample Grid" generates a 128×128 synthetic temperature field.
 *     Auto-scales axes to bitMapping.bounds on load.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController }         from '../src/plot/PlotController.js';
import { DataStore }              from '../src/plot/DataStore.js';
import { LUTController }          from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import PlotCanvas                 from '../src/components/PlotCanvas.jsx';
import LUTPanel                   from '../ui/LUTPanel.jsx';
import HelpOverlay                from '../ui/HelpOverlay.jsx';
import { TableLoaderAdapter }     from '../loaders/TableLoaderAdapter.js';
import { RasterLoaderAdapter }    from '../loaders/RasterLoaderAdapter.js';

// ── Constants ─────────────────────────────────────────────────────────────────

const LUT_W      = 160;  // px — LUT sidebar width
const GRID_SIZE  = 128;  // synthetic temperature grid dimensions

// ── Module-level state (survives re-renders) ──────────────────────────────────

let _scatter = null;
let _raster  = null;

function getScatterState() {
  if (_scatter) return _scatter;
  _scatter = {
    store:   new DataStore(),
    ctrl:    null,  // set in onInit
    adapter: null,  // set after column selection
  };
  return _scatter;
}

function getRasterState() {
  if (_raster) return _raster;
  _raster = {
    lut:       new LUTController(256),
    lutHist:   null,  // created after LUTController is ready
    ctrl:      null,  // set in onInit
    adapter:   null,  // set in onInit
  };
  _raster.lutHist = new LUTHistogramController({ lutController: _raster.lut, bins: 256 });
  return _raster;
}

// ── Synthetic sample data generators ─────────────────────────────────────────

/** Generate a synthetic 10k-row CSV string with columns: time, value, magnitude */
function generateSampleCSV(rows = 10_000) {
  const lines = ['time,value,magnitude'];
  for (let i = 0; i < rows; i++) {
    const t   = i / rows * 100;
    const val = Math.sin(t * 0.3) * 50 + 50 + (Math.random() - 0.5) * 10;
    const mag = 1.0 + Math.random() * 3.0;
    lines.push(`${t.toFixed(4)},${val.toFixed(4)},${mag.toFixed(4)}`);
  }
  return lines.join('\n');
}

/** Generate a 128×128 synthetic temperature field (sum of Gaussians). */
function generateTemperatureGrid(w = GRID_SIZE, h = GRID_SIZE) {
  const data = new Float32Array(w * h);
  const blobs = [
    { cx: 0.25, cy: 0.30, sx: 0.15, sy: 0.12, amp: 30.0 },
    { cx: 0.75, cy: 0.20, sx: 0.08, sy: 0.14, amp: 20.0 },
    { cx: 0.55, cy: 0.65, sx: 0.18, sy: 0.10, amp: 25.0 },
    { cx: 0.15, cy: 0.80, sx: 0.07, sy: 0.08, amp: 15.0 },
    { cx: 0.82, cy: 0.78, sx: 0.10, sy: 0.12, amp: 18.0 },
    { cx: 0.45, cy: 0.45, sx: 0.22, sy: 0.18, amp: 10.0 },
  ];
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const nx = col / (w - 1);
      const ny = row / (h - 1);
      let temp = -10.0;  // base temperature
      for (const b of blobs) {
        const dx = (nx - b.cx) / b.sx;
        const dy = (ny - b.cy) / b.sy;
        temp += b.amp * Math.exp(-0.5 * (dx * dx + dy * dy));
      }
      data[row * w + col] = temp;
    }
  }
  return data;
}

// ── Panel 1 — Tabular scatter ─────────────────────────────────────────────────

function ScatterPanel() {
  const [columns,     setColumns]     = useState([]);
  const [xCol,        setXCol]        = useState('');
  const [yCol,        setYCol]        = useState('');
  const [sizeCol,     setSizeCol]     = useState('');
  const [progress,    setProgress]    = useState(null);   // null = idle, 0-100 = loading
  const [status,      setStatus]      = useState('');
  const [warnings,    setWarnings]    = useState([]);
  const [dragOver,    setDragOver]    = useState(false);
  const [file,        setFile]        = useState(null);
  const onInitRef = useRef(null);

  if (!onInitRef.current) {
    onInitRef.current = (ctrl) => {
      getScatterState().ctrl = ctrl;
    };
  }

  // Wire adapter events
  const _wireAdapter = useCallback((adapter) => {
    adapter.on('loaded', ({ rowCount, columns: cols }) => {
      setProgress(null);
      setStatus(`Loaded ${rowCount.toLocaleString()} rows`);
    });
    adapter.on('chunk', ({ loaded, total }) => {
      setProgress(Math.round(loaded / total * 100));
    });
    adapter.on('parseWarning', ({ message }) => {
      setWarnings(w => [...w.slice(-4), message]);
    });
  }, []);

  const handleFileSelect = useCallback((f) => {
    setFile(f);
    setStatus(`File: ${f.name} (${(f.size / 1024).toFixed(1)} KB)`);
    // Pre-parse to get columns
    _preParseColumns(f);
  }, [_wireAdapter]);

  const _preParseColumns = async (f) => {
    // Use a temporary DataStore so we don't pollute the real one.
    // Parse with chunkSize:1 so only 1 row is appended — fast for any format.
    const tmpStore = new DataStore();
    // x/y must be valid column names; we'll discover them from getColumns() after load.
    // We use sentinel names that will fail validation — the adapter throws, but only
    // after normalizing the columns, which populates getColumns(). Catch the error.
    const tmpAdapter = new TableLoaderAdapter(tmpStore, {
      x: '__col_probe__',
      y: '__col_probe__',
      chunkSize: 1,
    });
    try {
      await tmpAdapter.loadFile(f);
    } catch {
      // Expected — __col_probe__ column won't exist; columns are still populated.
    }
    const cols = tmpAdapter.getColumns();
    tmpAdapter.destroy();
    if (cols.length > 0) {
      setColumns(cols);
      setXCol(cols[0] || '');
      setYCol(cols[1] || cols[0] || '');
      setSizeCol('');
    } else {
      setColumns([]);
    }
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  }, [handleFileSelect]);

  const handleLoad = useCallback(async () => {
    if (!file && !xCol) return;
    const { store, ctrl } = getScatterState();
    if (!ctrl) return;
    store.clear();
    setProgress(0);
    setWarnings([]);

    const adapter = new TableLoaderAdapter(store, {
      x:         xCol,
      y:         yCol,
      size:      sizeCol || 3.0,
      replace:   true,
      chunkSize: 20_000,
    });
    _wireAdapter(adapter);

    getScatterState().adapter = adapter;

    try {
      await adapter.loadFile(file);
      ctrl.markDirty();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setProgress(null);
    }
  }, [file, xCol, yCol, sizeCol, _wireAdapter]);

  const handleSampleCSV = useCallback(async () => {
    const { store, ctrl } = getScatterState();
    if (!ctrl) return;
    store.clear();
    setProgress(0);
    setWarnings([]);
    setStatus('Generating sample CSV...');

    const csvText = generateSampleCSV(10_000);
    const sampleFile = new File([csvText], 'sample-sensors.csv', { type: 'text/csv' });

    const adapter = new TableLoaderAdapter(store, {
      x:         'time',
      y:         'value',
      size:      'magnitude',
      replace:   true,
      chunkSize: 5_000,
    });
    _wireAdapter(adapter);
    getScatterState().adapter = adapter;

    setColumns(['time', 'value', 'magnitude']);
    setXCol('time');
    setYCol('value');
    setSizeCol('magnitude');

    try {
      await adapter.loadFile(sampleFile);
      ctrl.viewport.setXDomain([0, 100]);
      ctrl.viewport.setYDomain([0, 100]);
      ctrl.markDirty();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setProgress(null);
    }
  }, [_wireAdapter]);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0, borderBottom: '1px solid #222' }}>
      {/* Plot area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={labelStyle}>Panel 1 — Tabular Scatter</div>
        <PlotCanvas
          style={{ width: '100%', height: '100%' }}
          xLabel="X"
          yLabel="Y"
          dataStore={getScatterState().store}
          xDomain={[0, 100]}
          yDomain={[0, 100]}
          onInit={onInitRef.current}
        />
      </div>

      {/* Sidebar */}
      <div style={sidebarStyle}>
        {/* Drop zone */}
        <div
          style={{
            border: `1px dashed ${dragOver ? '#7df' : '#444'}`,
            borderRadius: 4,
            padding: '8px 4px',
            textAlign: 'center',
            fontSize: 11,
            color: dragOver ? '#7df' : '#666',
            cursor: 'pointer',
            background: dragOver ? '#0d1e2a' : 'transparent',
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => document.getElementById('csv-file-input').click()}
        >
          Drop .csv / .tsv / .arrow / .parquet<br />or click to browse
        </div>
        <input
          id="csv-file-input"
          type="file"
          accept=".csv,.tsv,.arrow,.parquet"
          style={{ display: 'none' }}
          onChange={e => e.target.files[0] && handleFileSelect(e.target.files[0])}
        />

        {/* Column selects */}
        {columns.length > 0 && (
          <>
            <div style={rowStyle}>
              <label style={lblStyle}>X col</label>
              <select value={xCol} onChange={e => setXCol(e.target.value)} style={selectStyle}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={lblStyle}>Y col</label>
              <select value={yCol} onChange={e => setYCol(e.target.value)} style={selectStyle}>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={rowStyle}>
              <label style={lblStyle}>Size col</label>
              <select value={sizeCol} onChange={e => setSizeCol(e.target.value)} style={selectStyle}>
                <option value="">— default (3 px) —</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              style={btnStyle}
              onClick={handleLoad}
              disabled={progress !== null || !file}
            >
              Load File
            </button>
          </>
        )}

        <button style={{ ...btnStyle, background: '#1a2a1a', borderColor: '#3a5a3a', color: '#8fa' }}
          onClick={handleSampleCSV} disabled={progress !== null}>
          Load Sample CSV
        </button>

        {/* Progress */}
        {progress !== null && (
          <div style={{ fontSize: 11, color: '#7df' }}>
            <div style={{ background: '#222', borderRadius: 2, height: 4, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{ width: `${progress}%`, height: '100%', background: '#7df', transition: 'width 0.1s' }} />
            </div>
            {progress}%
          </div>
        )}

        {status && <div style={{ fontSize: 10, color: '#888', wordBreak: 'break-all' }}>{status}</div>}

        {warnings.length > 0 && (
          <div style={{ fontSize: 10, color: '#f80', lineHeight: 1.4 }}>
            {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Panel 2 — Raster heatmap ──────────────────────────────────────────────────

function RasterPanel() {
  const [variables,  setVariables]  = useState([]);
  const [varSel,     setVarSel]     = useState('');
  const [status,     setStatus]     = useState('');
  const [warnings,   setWarnings]   = useState([]);
  const [loaded,     setLoaded]     = useState(false);
  const onInitRef = useRef(null);

  if (!onInitRef.current) {
    onInitRef.current = (ctrl) => {
      const rs = getRasterState();
      rs.ctrl = ctrl;
      rs.adapter = new RasterLoaderAdapter(ctrl, {
        layerId:       'temperature',
        variable:      varSel || undefined,
        xDim:          'lon',
        yDim:          'lat',
        lutController: rs.lut,
        flipY:         true,
      });

      rs.adapter.on('loaded', ({ width, height, variable, bounds }) => {
        setLoaded(true);
        setStatus(`${width}×${height}  bounds: [${bounds.map(v => v.toFixed(2)).join(', ')}]${variable ? `  var: ${variable}` : ''}`);
        // Auto-scale axes
        ctrl.viewport.setXDomain([bounds[0], bounds[2]]);
        ctrl.viewport.setYDomain([bounds[1], bounds[3]]);
        ctrl.markDirty();
      });
      rs.adapter.on('parseWarning', ({ message }) => {
        setWarnings(w => [...w.slice(-4), message]);
      });
    };
  }

  const handleFile = useCallback(async (f) => {
    const rs = getRasterState();
    if (!rs.adapter) return;
    setStatus(`Parsing ${f.name}...`);
    setWarnings([]);
    try {
      // For NetCDF, update variable option from adapter if needed
      await rs.adapter.loadFile(f);
      const vars = rs.adapter.getVariables();
      if (vars.length > 0) {
        setVariables(vars);
        setVarSel(vars[0]);
      }
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }, []);

  const handleSampleGrid = useCallback(() => {
    const rs = getRasterState();
    if (!rs.ctrl || !rs.adapter) return;
    setWarnings([]);
    const grid    = generateTemperatureGrid(GRID_SIZE, GRID_SIZE);
    const bounds  = [-180, -90, 180, 90];  // pretend it's global temperature
    rs.adapter.loadArray(grid, GRID_SIZE, GRID_SIZE, {
      bounds,
      channels: 'gray',
      dtype:    'float32',
    });
  }, []);

  return (
    <div style={{ display: 'flex', flex: 1, minHeight: 0, gap: 0 }}>
      {/* Plot area */}
      <div style={{ flex: 1, position: 'relative' }}>
        <div style={labelStyle}>Panel 2 — Raster / Heatmap</div>
        <PlotCanvas
          style={{ width: '100%', height: '100%' }}
          xLabel="Longitude (°)"
          yLabel="Latitude (°)"
          xDomain={[-180, 180]}
          yDomain={[-90, 90]}
          onInit={onInitRef.current}
        />
      </div>

      {/* LUT sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', width: LUT_W }}>
        <LUTPanel
          lutController={getRasterState().lut}
          lutHistCtrl={getRasterState().lutHist}
          width={LUT_W}
          height="100%"
        />
      </div>

      {/* Controls sidebar */}
      <div style={sidebarStyle}>
        <label style={{ fontSize: 11, color: '#888' }}>
          .nc, .cdf, .png, .jpg, .webp
        </label>
        <input
          type="file"
          accept=".nc,.cdf,.nc4,.png,.jpg,.jpeg,.webp,.bmp"
          style={{ fontSize: 10, color: '#aaa', width: '100%' }}
          onChange={e => e.target.files[0] && handleFile(e.target.files[0])}
        />

        {variables.length > 0 && (
          <div style={rowStyle}>
            <label style={lblStyle}>Variable</label>
            <select value={varSel} onChange={e => setVarSel(e.target.value)} style={selectStyle}>
              {variables.map(v => <option key={v} value={v}>{v}</option>)}
            </select>
          </div>
        )}

        <button
          style={{ ...btnStyle, background: '#1a2a1a', borderColor: '#3a5a3a', color: '#8fa' }}
          onClick={handleSampleGrid}
        >
          Load Sample Grid
        </button>

        {status && (
          <div style={{ fontSize: 10, color: loaded ? '#888' : '#f80', wordBreak: 'break-all', lineHeight: 1.4 }}>
            {status}
          </div>
        )}

        {!loaded && (
          <div style={{ fontSize: 10, color: '#555', lineHeight: 1.5 }}>
            NetCDF3 (.nc) — variable + coord arrays read automatically.<br />
            Image files — bounds default to pixel dimensions.
          </div>
        )}

        {warnings.length > 0 && (
          <div style={{ fontSize: 10, color: '#f80', lineHeight: 1.4 }}>
            {warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared style constants ────────────────────────────────────────────────────

const sidebarStyle = {
  width:           180,
  display:         'flex',
  flexDirection:   'column',
  gap:             8,
  padding:         '8px 10px',
  background:      '#101010',
  borderLeft:      '1px solid #222',
  overflowY:       'auto',
};

const labelStyle = {
  position:   'absolute',
  top:        6,
  left:       8,
  fontSize:   11,
  color:      '#444',
  zIndex:     1,
  pointerEvents: 'none',
};

const rowStyle  = { display: 'flex', flexDirection: 'column', gap: 2 };
const lblStyle  = { fontSize: 10, color: '#666' };
const selectStyle = {
  background: '#1a1a1a',
  border:     '1px solid #333',
  color:      '#ccc',
  fontSize:   11,
  padding:    '2px 4px',
  borderRadius: 2,
};
const btnStyle = {
  background:   '#1a1e2a',
  border:       '1px solid #334',
  color:        '#aad',
  fontSize:     11,
  padding:      '4px 6px',
  borderRadius: 2,
  cursor:       'pointer',
};

// ── Root component ────────────────────────────────────────────────────────────

const HELP_CONTROLS = [
  { key: 'Scroll',           description: 'Zoom in / out (cursor-centered)' },
  { key: 'Drag',             description: 'Pan view' },
  { key: 'Right-drag',       description: 'Box zoom' },
  { key: 'Drop .csv / .tsv', description: 'Load tabular file into Panel 1' },
  { key: 'Load Sample CSV',  description: 'Generate 10k-row synthetic sensor data' },
  { key: 'Load Sample Grid', description: 'Generate synthetic temperature heatmap' },
];

export default function DataLoadersExample() {
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      _scatter?.adapter?.destroy();
      _raster?.adapter?.destroy();
      _scatter = null;
      _raster  = null;
    };
  }, []);

  return (
    <div style={{
      width:           '100vw',
      height:          '100vh',
      display:         'flex',
      flexDirection:   'column',
      background:      '#0d0d0d',
      color:           '#e0e0e0',
      fontFamily:      'monospace',
      position:        'relative',
      overflow:        'hidden',
    }}>
      {/* Header */}
      <div style={{
        flexShrink: 0,
        padding:    '6px 16px',
        borderBottom: '1px solid #222',
        display:    'flex',
        alignItems: 'center',
        gap:        16,
      }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#7df' }}>Data Loaders (F32 / F33 / EX19)</span>
        <span style={{ fontSize: 11, color: '#555' }}>loaders.gl · CSV · Arrow · NetCDF3 · Images</span>
        <a href="index.html" style={{ marginLeft: 'auto', fontSize: 11, color: '#555', textDecoration: 'none' }}>← Hub</a>
      </div>

      {/* Two panels */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <ScatterPanel />
        <RasterPanel />
      </div>

      <HelpOverlay
        title="Data Loaders"
        controls={HELP_CONTROLS}
        storageKey="masterplot-ex19-help"
      />
    </div>
  );
}
