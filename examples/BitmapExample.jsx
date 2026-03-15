/**
 * BitmapExample — EX16
 *
 * Demonstrates BitmapDataLayer outside of the audio/spectrogram context.
 * Three panels, each sourcing an image differently:
 *
 *   Panel 1 — Local Image
 *     User picks a file via <input type="file">, decoded with createImageBitmap,
 *     displayed in a BitmapDataLayer with configurable bitMapping.
 *
 *   Panel 2 — Generated Array (Gaussian heatmap)
 *     256×256 Float32Array synthesised in JS (sum of 2D Gaussians).
 *     LUTPanel sidebar for real-time colormap + level adjustment.
 *
 *   Panel 3 — URL Image
 *     Loads a small CORS-accessible NASA Blue Marble tile; displays it with
 *     bitMapping set to geographic bounds (longitude/latitude) for illustration.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController }         from '../src/plot/PlotController.js';
import { LUTController }          from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import { BitmapDataLayer }        from '../src/plot/layers/BitmapDataLayer.js';
import LUTPanel                   from '../ui/LUTPanel.jsx';
import HelpOverlay                from '../ui/HelpOverlay.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const LUT_PANEL_W   = 160;   // px — LUT sidebar width (panel 2 only)
const HEATMAP_SIZE  = 256;   // generated heatmap dimensions (square)

// NASA Blue Marble Next Generation — a small 512×256 PNG served from a
// CORS-enabled endpoint (tile from NASA GIBS open imagery service).
// This URL is publicly accessible and does not require authentication.
const NASA_IMAGE_URL =
  'https://eoimages.gsfc.nasa.gov/images/imagerecords/73000/73726/world.topo.bathy.200401.3x5400x2700.jpg';

// Fallback smaller tile in case the large image is slow to load
const NASA_TILE_URL =
  'https://tile.openstreetmap.org/1/0/0.png';

// Geographic bounds for the NASA image (whole-world equirectangular):
// [left (lon), bottom (lat), right (lon), top (lat)]
const NASA_BOUNDS = [-180, -90, 180, 90];

// ── Gaussian heatmap generator ────────────────────────────────────────────────

function generateHeatmap(w, h) {
  const data = new Float32Array(w * h);

  // Place several 2D Gaussian blobs at different positions and scales
  const blobs = [
    { cx: 0.25, cy: 0.30, sx: 0.12, sy: 0.10, amp: 1.0 },
    { cx: 0.70, cy: 0.20, sx: 0.08, sy: 0.15, amp: 0.75 },
    { cx: 0.55, cy: 0.65, sx: 0.18, sy: 0.09, amp: 0.90 },
    { cx: 0.15, cy: 0.75, sx: 0.07, sy: 0.07, amp: 0.55 },
    { cx: 0.80, cy: 0.80, sx: 0.10, sy: 0.12, amp: 0.65 },
    { cx: 0.42, cy: 0.42, sx: 0.25, sy: 0.20, amp: 0.40 },
  ];

  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const nx = col / (w - 1);
      const ny = row / (h - 1);
      let val = 0;
      for (const b of blobs) {
        const dx = (nx - b.cx) / b.sx;
        const dy = (ny - b.cy) / b.sy;
        val += b.amp * Math.exp(-0.5 * (dx * dx + dy * dy));
      }
      data[row * w + col] = val;
    }
  }

  return data;
}

// ── Module-level state (React owns NONE of this) ──────────────────────────────

let _imgCtrl       = null;   // PlotController — panel 1
let _heatCtrl      = null;   // PlotController — panel 2
let _urlCtrl       = null;   // PlotController — panel 3
let _lutCtrl       = null;   // LUTController  — panel 2
let _lutHistCtrl   = null;   // LUTHistogramController — panel 2
let _heatmap       = null;   // Float32Array — panel 2 data
let _colorTrigger  = 0;      // bumped on LUT change → forces BitmapDataLayer recolorize
let _dataTrigger   = 0;      // bumped when image source changes

function _ensureState() {
  if (_heatmap) return;

  // Heatmap data (panel 2) — generated once
  _heatmap = generateHeatmap(HEATMAP_SIZE, HEATMAP_SIZE);

  // LUT stack for heatmap panel
  _lutCtrl     = new LUTController(256);
  _lutHistCtrl = new LUTHistogramController({ lutController: _lutCtrl, bins: 256 });

  // Pre-load data into LUTController so histogram + auto-level runs immediately
  const min = Math.min(..._heatmap);
  const max = Math.max(..._heatmap);
  _lutCtrl.setData(_heatmap, min, max);
}

function _destroyState() {
  if (_imgCtrl)      { _imgCtrl.destroy();     _imgCtrl     = null; }
  if (_heatCtrl)     { _heatCtrl.destroy();    _heatCtrl    = null; }
  if (_urlCtrl)      { _urlCtrl.destroy();     _urlCtrl     = null; }
  if (_lutHistCtrl)  { _lutHistCtrl.destroy(); _lutHistCtrl = null; }
  _lutCtrl = null;
  _heatmap = null;
  _colorTrigger = 0;
  _dataTrigger  = 0;
}

// ── Panel 1 — Local Image ─────────────────────────────────────────────────────

function useImgPanel() {
  const [imgBitmap, setImgBitmap] = useState(null);
  const [fileName, setFileName]   = useState('');
  // [left, bottom, right, top] in data space; user controls origin + scale
  const [mapping, setMapping]     = useState({ x0: 0, y0: 0, w: 1, h: 1 });

  const handleFile = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const bitmap = await createImageBitmap(file);
    setImgBitmap(bitmap);

    // Auto-fit: keep aspect ratio, data space 0–1 × 0–1
    const aspect = bitmap.width / bitmap.height;
    if (aspect >= 1) {
      setMapping({ x0: 0, y0: 0, w: 1, h: 1 / aspect });
    } else {
      setMapping({ x0: 0, y0: 0, w: aspect, h: 1 });
    }
  }, []);

  return { imgBitmap, fileName, mapping, setMapping, handleFile };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BitmapExample() {
  _ensureState();

  const imgInitRef  = useRef(null);
  const heatInitRef = useRef(null);
  const urlInitRef  = useRef(null);

  const imgWcRef  = useRef(null);
  const imgAcRef  = useRef(null);
  const heatWcRef = useRef(null);
  const heatAcRef = useRef(null);
  const urlWcRef  = useRef(null);
  const urlAcRef  = useRef(null);

  const { imgBitmap, fileName, mapping, setMapping, handleFile } = useImgPanel();
  const [urlLoadStatus, setUrlLoadStatus] = useState('idle'); // 'idle' | 'loading' | 'loaded' | 'error'

  // ── Panel 1 — init ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!imgWcRef.current || !imgAcRef.current) return;

    const ctrl = new PlotController({
      xDomain: [0, 1],
      yDomain: [0, 1],
      xLabel: 'x',
      yLabel: 'y',
      disableDefaultDataLayer: true,
    });
    _imgCtrl = ctrl;

    requestAnimationFrame(() => {
      const wc = imgWcRef.current;
      const ac = imgAcRef.current;
      if (!wc || !ac) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);
    });

    return () => { ctrl.destroy(); _imgCtrl = null; };
  }, []);

  // Update Panel 1 layer when image or mapping changes
  useEffect(() => {
    if (!_imgCtrl || !imgBitmap) return;

    const { x0, y0, w, h } = mapping;
    const bounds = [x0, y0, x0 + w, y0 + h];

    _imgCtrl.registerDataLayer('local-image', () =>
      new BitmapDataLayer({
        source:     imgBitmap,
        bitMapping: { bounds },
      })
    );
    _imgCtrl.markDirty();
  }, [imgBitmap, mapping]);

  // ── Panel 2 — init ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!heatWcRef.current || !heatAcRef.current) return;

    const ctrl = new PlotController({
      xDomain: [0, HEATMAP_SIZE],
      yDomain: [0, HEATMAP_SIZE],
      xLabel: 'col',
      yLabel: 'row',
      disableDefaultDataLayer: true,
    });
    _heatCtrl = ctrl;

    // LUT changes → bump colorTrigger → markDirty
    const onLutChange = () => { _colorTrigger++; _heatCtrl?.markDirty(); };
    _lutCtrl.on('levelChanged', onLutChange);
    _lutCtrl.on('lutChanged',   onLutChange);

    requestAnimationFrame(() => {
      const wc = heatWcRef.current;
      const ac = heatAcRef.current;
      if (!wc || !ac) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);

      // Register heatmap layer
      ctrl.registerDataLayer('heatmap', () =>
        new BitmapDataLayer({
          source:       _heatmap,
          bitMapping:   { bounds: [0, 0, HEATMAP_SIZE, HEATMAP_SIZE] },
          channels:     'gray',
          dtype:        'float32',
          width:        HEATMAP_SIZE,
          height:       HEATMAP_SIZE,
          lutController: _lutCtrl,
          dataTrigger:  _dataTrigger,
          colorTrigger: _colorTrigger,
        })
      );
      ctrl.markDirty();
    });

    return () => {
      _lutCtrl.off('levelChanged', onLutChange);
      _lutCtrl.off('lutChanged',   onLutChange);
      ctrl.destroy();
      _heatCtrl = null;
    };
  }, []);

  // ── Panel 3 — init ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!urlWcRef.current || !urlAcRef.current) return;

    const ctrl = new PlotController({
      xDomain: [NASA_BOUNDS[0], NASA_BOUNDS[2]],  // -180 to 180
      yDomain: [NASA_BOUNDS[1], NASA_BOUNDS[3]],  // -90 to 90
      xLabel: 'Longitude °',
      yLabel: 'Latitude °',
      disableDefaultDataLayer: true,
    });
    _urlCtrl = ctrl;

    requestAnimationFrame(() => {
      const wc = urlWcRef.current;
      const ac = urlAcRef.current;
      if (!wc || !ac) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);

      setUrlLoadStatus('loading');

      ctrl.registerDataLayer('world-map', () =>
        new BitmapDataLayer({
          source:     NASA_TILE_URL,
          bitMapping: { bounds: NASA_BOUNDS },
        })
      );
      ctrl.markDirty();
      setUrlLoadStatus('loaded');
    });

    return () => { ctrl.destroy(); _urlCtrl = null; };
  }, []);

  // ── Stable onInit references (no-op — direct init above) ────────────────────

  // ── Layout ──────────────────────────────────────────────────────────────────

  const canvasStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '8px 16px', background: '#111', borderBottom: '1px solid #2a2a2a', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#7df' }}>BitmapDataLayer Example (EX16)</span>
        <span style={{ fontSize: 11, color: '#555' }}>URL / Local File / Generated Array — three display modes</span>
      </div>

      {/* ── Three panels stacked vertically ─────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Panel 1: Local Image ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #2a2a2a', minHeight: 0 }}>
          <PanelHeader>
            Panel 1 — Local Image
            <span style={{ marginLeft: 12, fontSize: 11, color: '#555' }}>
              Pick a local image file; it will be rendered as a BitmapDataLayer with configurable mapping.
            </span>
          </PanelHeader>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Plot */}
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <canvas ref={imgWcRef} style={canvasStyle} />
              <canvas ref={imgAcRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />
              {!imgBitmap && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: 13, pointerEvents: 'none' }}>
                  No image loaded — use the controls on the right
                </div>
              )}
            </div>
            {/* Controls */}
            <div style={{ width: 200, flexShrink: 0, background: '#111', borderLeft: '1px solid #2a2a2a', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#888' }}>Select image file</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  style={{ fontSize: 11, color: '#ccc' }}
                />
              </label>
              {fileName && (
                <div style={{ color: '#4d8', fontSize: 11, wordBreak: 'break-all' }}>{fileName}</div>
              )}
              {imgBitmap && (
                <>
                  <div style={{ color: '#888', marginTop: 4 }}>bitMapping bounds</div>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#666', fontSize: 11 }}>x origin</span>
                    <input type="number" step="0.1" value={mapping.x0}
                      onChange={e => setMapping(m => ({ ...m, x0: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#666', fontSize: 11 }}>y origin</span>
                    <input type="number" step="0.1" value={mapping.y0}
                      onChange={e => setMapping(m => ({ ...m, y0: parseFloat(e.target.value) || 0 }))}
                      style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#666', fontSize: 11 }}>width (data units)</span>
                    <input type="number" step="0.1" min="0.01" value={mapping.w}
                      onChange={e => setMapping(m => ({ ...m, w: parseFloat(e.target.value) || 1 }))}
                      style={inputStyle} />
                  </label>
                  <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ color: '#666', fontSize: 11 }}>height (data units)</span>
                    <input type="number" step="0.1" min="0.01" value={mapping.h}
                      onChange={e => setMapping(m => ({ ...m, h: parseFloat(e.target.value) || 1 }))}
                      style={inputStyle} />
                  </label>
                  <div style={{ color: '#555', fontSize: 10, marginTop: 4 }}>
                    bounds: [{mapping.x0.toFixed(2)}, {mapping.y0.toFixed(2)}, {(mapping.x0+mapping.w).toFixed(2)}, {(mapping.y0+mapping.h).toFixed(2)}]
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Panel 2: Generated Heatmap ─────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #2a2a2a', minHeight: 0 }}>
          <PanelHeader>
            Panel 2 — Generated Float32 Heatmap
            <span style={{ marginLeft: 12, fontSize: 11, color: '#555' }}>
              256×256 sum-of-Gaussians array with live LUTPanel (drag handles to adjust levels).
            </span>
          </PanelHeader>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            {/* Plot */}
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <canvas ref={heatWcRef} style={canvasStyle} />
              <canvas ref={heatAcRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />
            </div>
            {/* LUT sidebar */}
            <LUTPanel
              lutController={_lutCtrl}
              lutHistCtrl={_lutHistCtrl}
              width={LUT_PANEL_W}
              height="100%"
            />
          </div>
        </div>

        {/* ── Panel 3: URL Image ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          <PanelHeader>
            Panel 3 — URL Image (NASA Blue Marble OSM tile)
            <span style={{ marginLeft: 12, fontSize: 11, color: '#555' }}>
              Loaded from a CORS-accessible URL; bitMapping set to geographic bounds (lon/lat).
              {urlLoadStatus === 'loading' && <span style={{ color: '#fa0', marginLeft: 8 }}>loading…</span>}
              {urlLoadStatus === 'loaded'  && <span style={{ color: '#4d8', marginLeft: 8 }}>loaded</span>}
              {urlLoadStatus === 'error'   && <span style={{ color: '#f66', marginLeft: 8 }}>load error</span>}
            </span>
          </PanelHeader>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={urlWcRef} style={canvasStyle} />
            <canvas ref={urlAcRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 10, color: '#444', pointerEvents: 'none' }}>
              x: longitude °  |  y: latitude °  |  bounds: {NASA_BOUNDS.join(', ')}
            </div>
          </div>
        </div>

      </div>

      <HelpOverlay
        storageKey="masterplot-help-ex16-bitmap"
        title="BitmapDataLayer Example Controls"
        controls={[
          { key: 'Scroll',        description: 'Zoom in / out (all panels)' },
          { key: 'Drag',          description: 'Pan the view (all panels)' },
          { key: 'Right-drag',    description: 'Box-zoom (all panels)' },
          { key: 'Panel 1 — file picker', description: 'Load a local image file as BitmapDataLayer' },
          { key: 'Panel 1 — mapping inputs', description: 'Adjust bitMapping bounds in data space' },
          { key: 'Panel 2 — LUT handles', description: 'Drag hline handles to adjust level_min / level_max' },
          { key: 'Panel 2 — colormap', description: 'Switch colormap preset via dropdown' },
          { key: 'Panel 2 — Auto Level', description: 'Run percentile auto-leveling (2 %–98 %)' },
        ]}
      />
    </div>
  );
}

// ── Small helper components ───────────────────────────────────────────────────

function PanelHeader({ children }) {
  return (
    <div style={{ flexShrink: 0, padding: '4px 12px', background: '#0f0f0f', borderBottom: '1px solid #1e1e1e', fontSize: 12, fontWeight: 700, color: '#aaa', display: 'flex', alignItems: 'center' }}>
      {children}
    </div>
  );
}

const inputStyle = {
  background: '#1a1a1a',
  border: '1px solid #333',
  borderRadius: 3,
  color: '#ccc',
  fontFamily: 'monospace',
  fontSize: 11,
  padding: '2px 6px',
  width: '100%',
};
