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
 *   Panel 3 — URL Image (CDS HiPS2FITS / 2MASS K-band all-sky)
 *     Fetched from the CDS HiPS2FITS service (powers Aladin Lite; CORS-enabled);
 *     full-sky 2MASS K-band NIR in galactic CAR projection; bitMapping set to
 *     galactic coordinate bounds (l/b).
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

// CDS HiPS2FITS — full-sky 2MASS K-band in galactic equirectangular projection.
// Powered by the same server as Aladin Lite; explicitly CORS-enabled for web use.
// Survey: 2MASS K-band (near-infrared); shows dust lanes + galactic structure.
// Docs: https://aladin.cds.unistra.fr/hips2fits/
const STARMAP_URL =
  'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' +
  'hips=CDS%2FP%2F2MASS%2FK&width=800&height=400' +
  '&fov=360&projection=CAR&coordsys=galactic&format=jpg&ra=0&dec=0';

// Galactic coordinate bounds [l_min, b_min, l_max, b_max].
// Matches the CAR projection output: l 0°–360°, b −90°–+90°.
const STARMAP_BOUNDS = [0, -90, 360, 90];

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

const TABS = [
  { id: 'local',   label: 'Local Image',          sub: 'ImageBitmap via createImageBitmap' },
  { id: 'heatmap', label: 'Generated Heatmap',     sub: 'Float32 array + LUTPanel' },
  { id: 'starmap', label: '2MASS K-band All-Sky',  sub: 'URL fetch → CDS HiPS2FITS' },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function BitmapExample() {
  _ensureState();

  const [activeTab, setActiveTab] = useState('local');

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
  // Pre-fetch the image via browser fetch (respects CORS) → ImageBitmap so we
  // never hand a URL string to deck.gl's loaders.gl (which lacks the browser's
  // credential/cache context and can fail even on CORS-enabled servers).

  useEffect(() => {
    if (!urlWcRef.current || !urlAcRef.current) return;

    const ctrl = new PlotController({
      xDomain: [STARMAP_BOUNDS[0], STARMAP_BOUNDS[2]],  // 0 to 360
      yDomain: [STARMAP_BOUNDS[1], STARMAP_BOUNDS[3]],  // -90 to 90
      xLabel: 'Galactic Longitude (°)',
      yLabel: 'Galactic Latitude (°)',
      disableDefaultDataLayer: true,
    });
    _urlCtrl = ctrl;

    let destroyed = false;

    requestAnimationFrame(async () => {
      const wc = urlWcRef.current;
      const ac = urlAcRef.current;
      if (!wc || !ac || destroyed) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);

      setUrlLoadStatus('loading');

      try {
        const resp   = await fetch(STARMAP_URL, { mode: 'cors' });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const blob   = await resp.blob();
        const bitmap = await createImageBitmap(blob);
        if (destroyed) return;

        ctrl.registerDataLayer('star-map', () =>
          new BitmapDataLayer({
            source:     bitmap,
            bitMapping: { bounds: STARMAP_BOUNDS },
          })
        );
        ctrl.markDirty();
        setUrlLoadStatus('loaded');
      } catch (err) {
        if (!destroyed) setUrlLoadStatus('error');
        console.warn('BitmapExample panel 3: could not load star map —', err.message);
      }
    });

    return () => { destroyed = true; ctrl.destroy(); _urlCtrl = null; };
  }, []);

  // ── Layout ──────────────────────────────────────────────────────────────────

  const canvasStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };

  // All three panels are always mounted so canvases have real dimensions at init.
  // Inactive panels are hidden via visibility:hidden (not display:none) so the
  // canvas offsetWidth/Height remain valid for PlotController.
  const tabPanel = (id) => ({
    position:      'absolute',
    inset:         0,
    display:       'flex',
    flexDirection: 'column',
    visibility:    activeTab === id ? 'visible' : 'hidden',
    pointerEvents: activeTab === id ? 'auto'    : 'none',
  });

  return (
    <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace' }}>

      {/* ── Header + tab bar ────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, background: '#111', borderBottom: '1px solid #2a2a2a' }}>
        <div style={{ padding: '8px 16px 0', display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#7df' }}>BitmapDataLayer Example (EX16)</span>
          <span style={{ fontSize: 11, color: '#444' }}>three source types</span>
        </div>
        <div style={{ display: 'flex', gap: 2, padding: '6px 12px 0' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              padding: '5px 14px',
              background:    activeTab === t.id ? '#0d0d0d' : 'transparent',
              border:        '1px solid',
              borderColor:   activeTab === t.id ? '#2a2a2a' : 'transparent',
              borderBottom:  activeTab === t.id ? '1px solid #0d0d0d' : '1px solid transparent',
              borderRadius:  '4px 4px 0 0',
              color:         activeTab === t.id ? '#7df' : '#555',
              fontFamily:    'monospace',
              fontSize:      12,
              cursor:        'pointer',
              display:       'flex',
              flexDirection: 'column',
              alignItems:    'flex-start',
              gap:           1,
            }}>
              <span style={{ fontWeight: 700 }}>{t.label}</span>
              <span style={{ fontSize: 10, color: activeTab === t.id ? '#445' : '#333' }}>{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content area ────────────────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

        {/* ── Tab 1: Local Image ──────────────────────────────────────────────── */}
        <div style={tabPanel('local')}>
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
            <div style={{ width: 200, flexShrink: 0, background: '#111', borderLeft: '1px solid #2a2a2a', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 12, overflowY: 'auto' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ color: '#888' }}>Select image file</span>
                <input type="file" accept="image/*" onChange={handleFile} style={{ fontSize: 11, color: '#ccc' }} />
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

        {/* ── Tab 2: Generated Heatmap ────────────────────────────────────────── */}
        <div style={tabPanel('heatmap')}>
          <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
            <div style={{ flex: 1, position: 'relative', minWidth: 0 }}>
              <canvas ref={heatWcRef} style={canvasStyle} />
              <canvas ref={heatAcRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />
            </div>
            <LUTPanel
              lutController={_lutCtrl}
              lutHistCtrl={_lutHistCtrl}
              width={LUT_PANEL_W}
              height="100%"
            />
          </div>
        </div>

        {/* ── Tab 3: URL / Star map ───────────────────────────────────────────── */}
        <div style={tabPanel('starmap')}>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <canvas ref={urlWcRef} style={canvasStyle} />
            <canvas ref={urlAcRef} style={{ ...canvasStyle, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 10, color: '#444', pointerEvents: 'none' }}>
              {urlLoadStatus === 'loading' && <span style={{ color: '#fa0' }}>loading…  </span>}
              {urlLoadStatus === 'error'   && <span style={{ color: '#f66' }}>load error  </span>}
              l: galactic longitude °  |  b: galactic latitude °  |  2MASS K-band (CDS HiPS2FITS)  |  bounds: {STARMAP_BOUNDS.join(', ')}
            </div>
          </div>
        </div>

      </div>

      <HelpOverlay
        storageKey="masterplot-help-ex16-bitmap"
        title="BitmapDataLayer Example Controls"
        controls={[
          { key: 'Scroll',                   description: 'Zoom in / out' },
          { key: 'Drag',                     description: 'Pan the view' },
          { key: 'Right-drag',               description: 'Box-zoom' },
          { key: 'Tab 1 — file picker',      description: 'Load a local image as BitmapDataLayer' },
          { key: 'Tab 1 — mapping inputs',   description: 'Adjust bitMapping bounds in data space' },
          { key: 'Tab 2 — LUT handles',      description: 'Drag hline handles to adjust level_min / level_max' },
          { key: 'Tab 2 — colormap',         description: 'Switch colormap preset via dropdown' },
          { key: 'Tab 2 — Auto Level',       description: 'Run percentile auto-leveling (2 %–98 %)' },
        ]}
      />
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
