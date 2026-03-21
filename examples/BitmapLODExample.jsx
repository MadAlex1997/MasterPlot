/**
 * BitmapLODExample — EX18
 *
 * Demonstrates both usage modes of BitmapViewGenerator (F31):
 *
 *   Panel 1 — Local generation (synthetic Gaussian heatmap)
 *     A 512×512 Float64 sum-of-Gaussians base dataset generated once on load.
 *     BitmapViewGenerator with `generate`: slices the visible domain from the
 *     base grid and bilinear-resamples to Math.min(widthPx, 1024) × Math.min(heightPx, 1024).
 *     Sidebar: LUTPanel (level handles + colormap + Auto Level); debounce slider;
 *     resolution readout showing last request widthPx × heightPx.
 *
 *   Panel 2 — URL fetch mode (CDS HiPS2FITS galactic all-sky)
 *     BitmapViewGenerator with `fetch`: re-fetches the CDS HiPS2FITS service
 *     at the current viewport dimensions whenever the domain changes.
 *     Parameters: fov, width, height, ra, dec derived from request object.
 *     Loading indicator keyed to requestStart / requestComplete.
 *     Demonstrates: pan/zoom → new fetch; stale inflight requests cancelled via AbortSignal.
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController }         from '../src/plot/PlotController.js';
import { LUTController }          from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import { BitmapViewGenerator }    from '../src/plot/layers/BitmapViewGenerator.js';
import LUTPanel                   from '../ui/LUTPanel.jsx';
import HelpOverlay                from '../ui/HelpOverlay.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const LUT_PANEL_W  = 160;   // px — sidebar width
const BASE_SIZE    = 512;   // base Gaussian grid side length

// CDS HiPS2FITS — 2MASS K-band; coordsys=galactic so ra/dec = galactic l/b
const HIPS2FITS_BASE =
  'https://alasky.cds.unistra.fr/hips-image-services/hips2fits?' +
  'hips=CDS%2FP%2F2MASS%2FK&projection=CAR&coordsys=galactic&format=jpg';

// ── Gaussian heatmap grid ────────────────────────────────────────────────────

function generateHeatmapGrid(w, h) {
  const data = new Float64Array(w * h);
  const blobs = [
    { cx: 0.25, cy: 0.30, sx: 0.12, sy: 0.10, amp: 1.0 },
    { cx: 0.70, cy: 0.20, sx: 0.08, sy: 0.15, amp: 0.75 },
    { cx: 0.55, cy: 0.65, sx: 0.18, sy: 0.09, amp: 0.90 },
    { cx: 0.15, cy: 0.75, sx: 0.07, sy: 0.07, amp: 0.55 },
    { cx: 0.80, cy: 0.80, sx: 0.10, sy: 0.12, amp: 0.65 },
    { cx: 0.42, cy: 0.42, sx: 0.25, sy: 0.20, amp: 0.40 },
    { cx: 0.60, cy: 0.45, sx: 0.06, sy: 0.06, amp: 0.95 },
    { cx: 0.35, cy: 0.55, sx: 0.09, sy: 0.14, amp: 0.70 },
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

/**
 * Bilinear resample a w×h Float64 grid to outW×outH.
 * Returns Float32Array (row-major, top→bottom).
 */
function bilinearResample(src, srcW, srcH, outW, outH) {
  const out = new Float32Array(outW * outH);
  const xScale = (srcW - 1) / Math.max(1, outW - 1);
  const yScale = (srcH - 1) / Math.max(1, outH - 1);

  for (let row = 0; row < outH; row++) {
    const sy = row * yScale;
    const fy = Math.floor(sy);
    const cy = Math.min(fy + 1, srcH - 1);
    const ty = sy - fy;

    for (let col = 0; col < outW; col++) {
      const sx = col * xScale;
      const fx = Math.floor(sx);
      const cx = Math.min(fx + 1, srcW - 1);
      const tx = sx - fx;

      const v00 = src[fy * srcW + fx];
      const v10 = src[fy * srcW + cx];
      const v01 = src[cy * srcW + fx];
      const v11 = src[cy * srcW + cx];

      out[row * outW + col] =
        v00 * (1 - tx) * (1 - ty) +
        v10 *      tx  * (1 - ty) +
        v01 * (1 - tx) *      ty  +
        v11 *      tx  *      ty;
    }
  }
  return out;
}

/**
 * Slice the base grid to the visible domain region, then bilinear-resample.
 * baseDomain: [xMin, xMax, yMin, yMax] for the full base grid.
 * viewDomain: [xMin, xMax, yMin, yMax] of the visible viewport.
 */
function sliceAndResample(src, srcW, srcH, baseDomain, viewDomain, outW, outH) {
  const [bxMin, bxMax, byMin, byMax] = baseDomain;
  const [vxMin, vxMax, vyMin, vyMax] = viewDomain;

  const xRatio = srcW / (bxMax - bxMin);
  const yRatio = srcH / (byMax - byMin);

  const px0 = Math.max(0, Math.floor((vxMin - bxMin) * xRatio));
  const px1 = Math.min(srcW, Math.ceil((vxMax - bxMin) * xRatio));
  const py0 = Math.max(0, Math.floor((vyMin - byMin) * yRatio));
  const py1 = Math.min(srcH, Math.ceil((vyMax - byMin) * yRatio));

  const sliceW = Math.max(1, px1 - px0);
  const sliceH = Math.max(1, py1 - py0);

  const slice = new Float64Array(sliceW * sliceH);
  for (let row = 0; row < sliceH; row++) {
    const srcRow = py0 + row;
    if (srcRow >= srcH) continue;
    for (let col = 0; col < sliceW; col++) {
      const srcCol = px0 + col;
      if (srcCol >= srcW) continue;
      slice[row * sliceW + col] = src[srcRow * srcW + srcCol];
    }
  }

  return bilinearResample(slice, sliceW, sliceH, outW, outH);
}

// ── Module-level state (React owns NONE of this) ──────────────────────────────

let _lutCtrl     = null;
let _lutHistCtrl = null;
let _heatGen     = null;   // BitmapViewGenerator — panel 1
let _urlGen      = null;   // BitmapViewGenerator — panel 2
let _baseGrid    = null;   // Float64Array — base Gaussian grid (512×512)
let _lutCleanup  = null;   // () => void — LUT event cleanup for panel 1

const BASE_DOMAIN = [0, 1, 0, 1];  // [xMin, xMax, yMin, yMax] of base grid

function _ensureSharedState() {
  if (_baseGrid) return;
  _baseGrid    = generateHeatmapGrid(BASE_SIZE, BASE_SIZE);
  _lutCtrl     = new LUTController(256);
  _lutHistCtrl = new LUTHistogramController({ lutController: _lutCtrl, bins: 256 });

  const arr = new Float32Array(_baseGrid);
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < arr.length; i++) {
    if (arr[i] < min) min = arr[i];
    if (arr[i] > max) max = arr[i];
  }
  _lutCtrl.setData(arr, min, max);
}

function _destroySharedState() {
  _lutCleanup?.();       _lutCleanup  = null;
  _heatGen?.destroy();   _heatGen     = null;
  _urlGen?.destroy();    _urlGen      = null;
  _lutHistCtrl?.destroy(); _lutHistCtrl = null;
  _lutCtrl = null;
  _baseGrid = null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BitmapLODExample() {
  _ensureSharedState();

  // Canvas refs
  const heatWcRef = useRef(null);
  const heatAcRef = useRef(null);
  const urlWcRef  = useRef(null);
  const urlAcRef  = useRef(null);

  // Panel 1 UI state
  const [heatDebounce,    setHeatDebounce]    = useState(150);
  const [heatResolution,  setHeatResolution]  = useState('—');
  const debounceRef = useRef(150);

  // Panel 2 UI state
  const [urlLoading,    setUrlLoading]    = useState(false);
  const [urlResolution, setUrlResolution] = useState('—');
  const [urlError,      setUrlError]      = useState(null);

  // ── Panel 1 — Local generation ──────────────────────────────────────────────

  useEffect(() => {
    const wc = heatWcRef.current;
    const ac = heatAcRef.current;
    if (!wc || !ac) return;

    const ctrl = new PlotController({
      disableDefaultDataLayer: true,
      panMode: 'drag',
      xDomain: [0, 1],
      yDomain: [0, 1],
      xLabel: 'x',
      yLabel: 'y',
      autoExpand: false,
    });
    requestAnimationFrame(() => {
      if (!heatWcRef.current) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);

      _heatGen = new BitmapViewGenerator(ctrl, {
        layerId:    'lod-heatmap',
        debounceMs: debounceRef.current,
        channels:   'gray',
        dtype:      'float32',
        lutController: _lutCtrl,
        initialBitMapping: { bounds: [0, 0, 1, 1] },
        generate: (req) => {
          const outW = Math.min(req.widthPx,  1024);
          const outH = Math.min(req.heightPx, 1024);
          const source = sliceAndResample(
            _baseGrid, BASE_SIZE, BASE_SIZE,
            BASE_DOMAIN,
            [req.xMin, req.xMax, req.yMin, req.yMax],
            outW, outH
          );
          return {
            source,
            width:      outW,
            height:     outH,
            bitMapping: { bounds: [req.xMin, req.yMin, req.xMax, req.yMax] },
          };
        },
      });

      _heatGen.on('requestComplete', ({ request }) => {
        const w = Math.min(request.widthPx,  1024);
        const h = Math.min(request.heightPx, 1024);
        setHeatResolution(`${w} × ${h}`);
      });

      // LUT changes → force BitmapViewGenerator to re-generate with updated LUT
      const onLutChange = () => {
        if (!_heatGen) return;
        _heatGen.setLutController(_lutCtrl);
        _heatGen.refresh();
      };
      _lutCtrl.on('levelChanged', onLutChange);
      _lutCtrl.on('lutChanged',   onLutChange);
      _lutCleanup = () => {
        _lutCtrl?.off('levelChanged', onLutChange);
        _lutCtrl?.off('lutChanged',   onLutChange);
      };
    });

    return () => {
      _lutCleanup?.(); _lutCleanup = null;
      _heatGen?.destroy(); _heatGen = null;
      ctrl.destroy();
      _heatCtrl = null;
    };
  }, []);

  // ── Panel 2 — URL fetch ─────────────────────────────────────────────────────

  useEffect(() => {
    const wc = urlWcRef.current;
    const ac = urlAcRef.current;
    if (!wc || !ac) return;

    const ctrl = new PlotController({
      disableDefaultDataLayer: true,
      panMode: 'drag',
      xDomain: [0, 360],
      yDomain: [-90, 90],
      xLabel: 'galactic \u2113 (\u00b0)',
      yLabel: 'galactic b (\u00b0)',
      autoExpand: false,
    });
    requestAnimationFrame(() => {
      if (!urlWcRef.current) return;
      wc.width  = wc.offsetWidth  || 640;
      wc.height = wc.offsetHeight || 400;
      ac.width  = wc.width;
      ac.height = wc.height;
      ctrl.init(wc, ac);

      _urlGen = new BitmapViewGenerator(ctrl, {
        layerId:    'lod-starmap',
        debounceMs: 300,
        channels:   'rgba',
        dtype:      'uint8',
        initialBitMapping: { bounds: [0, -90, 360, 90] },
        fetch: async (req, signal) => {
          const w = Math.min(Math.max(64, req.widthPx),  1024);
          const h = Math.min(Math.max(32, req.heightPx), 512);

          // HiPS2FITS with coordsys=galactic: ra/dec are interpreted as galactic l/b
          const fov  = req.xMax - req.xMin;
          const raC  = (req.xMin + req.xMax) / 2;
          const decC = (req.yMin + req.yMax) / 2;

          const url =
            `${HIPS2FITS_BASE}` +
            `&width=${w}&height=${h}` +
            `&fov=${fov.toFixed(4)}&ra=${raC.toFixed(4)}&dec=${decC.toFixed(4)}`;

          const resp = await fetch(url, { signal });
          if (!resp.ok) throw new Error(`HiPS2FITS HTTP ${resp.status}`);
          const blob   = await resp.blob();
          const bitmap = await createImageBitmap(blob);

          return {
            source:     bitmap,
            width:      w,
            height:     h,
            bitMapping: { bounds: [req.xMin, req.yMin, req.xMax, req.yMax] },
          };
        },
      });

      _urlGen.on('requestStart',    () => { setUrlLoading(true); setUrlError(null); });
      _urlGen.on('requestComplete', ({ request }) => {
        setUrlLoading(false);
        const w = Math.min(Math.max(64, request.widthPx),  1024);
        const h = Math.min(Math.max(32, request.heightPx), 512);
        setUrlResolution(`${w} × ${h}`);
      });
      _urlGen.on('requestError', ({ error }) => {
        setUrlLoading(false);
        setUrlError(error?.message || 'fetch failed');
      });
    });

    return () => {
      _urlGen?.destroy(); _urlGen = null;
      ctrl.destroy();
      _urlCtrl = null;
    };
  }, []);

  // ── Cleanup shared state on full unmount ────────────────────────────────────

  useEffect(() => {
    return () => _destroySharedState();
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const handleDebounceChange = useCallback((e) => {
    const val = Number(e.target.value);
    setHeatDebounce(val);
    debounceRef.current = val;
    if (_heatGen) _heatGen._debounceMs = val;
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  const s = styles;
  return (
    <div style={s.page}>
      <HelpOverlay
        title="Bitmap LOD Controls"
        storageKey="mp-bitmap-lod-help"
        controls={[
          { key: 'Scroll',   description: 'Zoom in / out (triggers LOD re-request after debounce)' },
          { key: 'Drag',     description: 'Pan viewport' },
          { key: 'Space',    description: 'Reset to full view' },
          { key: 'Debounce', description: 'Panel 1: adjust delay before re-request fires (ms)' },
        ]}
      />

      <h1 style={s.heading}>Bitmap LOD — BitmapViewGenerator (F31 / EX18)</h1>

      {/* Panel 1 — local generation */}
      <section style={s.panel}>
        <h2 style={s.panelTitle}>
          Panel 1 — Local Generation &mdash; Gaussian heatmap bilinear LOD
        </h2>
        <div style={s.row}>
          <div style={s.plotWrap}>
            <canvas ref={heatWcRef} style={s.canvas} />
            <canvas ref={heatAcRef} style={{ ...s.canvas, pointerEvents: 'none' }} />
          </div>
          <div style={s.sidebar}>
            <LUTPanel
              lutController={_lutCtrl}
              lutHistCtrl={_lutHistCtrl}
              width={LUT_PANEL_W}
              height="55%"
            />
            <div style={s.controlBox}>
              <label style={s.label}>Debounce: {heatDebounce} ms</label>
              <input
                type="range" min={50} max={500} step={10}
                value={heatDebounce}
                onChange={handleDebounceChange}
                style={{ width: '100%', marginTop: '4px' }}
              />
              <div style={s.infoRow}>
                <span style={s.dimLabel}>Last render</span>
                <span style={s.dimValue}>{heatResolution} px</span>
              </div>
              <p style={s.hint}>
                Zoom in to increase effective resolution.
                Debounce controls the delay before re-request fires.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Panel 2 — URL fetch */}
      <section style={s.panel}>
        <h2 style={s.panelTitle}>
          Panel 2 — URL Fetch &mdash; CDS HiPS2FITS 2MASS K-band all-sky (AbortSignal)
        </h2>
        <div style={s.row}>
          <div style={{ ...s.plotWrap, position: 'relative' }}>
            <canvas ref={urlWcRef} style={s.canvas} />
            <canvas ref={urlAcRef} style={{ ...s.canvas, pointerEvents: 'none' }} />
            {urlLoading && <div style={s.loadBadge}>Fetching…</div>}
            {urlError   && <div style={s.errBadge}>{urlError}</div>}
          </div>
          <div style={s.sidebar}>
            <div style={{ ...s.controlBox, height: '100%' }}>
              <div style={s.infoRow}>
                <span style={s.dimLabel}>Last fetch</span>
                <span style={s.dimValue}>{urlResolution} px</span>
              </div>
              <div style={s.infoRow}>
                <span style={s.dimLabel}>Status</span>
                <span style={{
                  ...s.dimValue,
                  color: urlLoading ? '#fbbf24' : urlError ? '#f87171' : '#4ade80',
                }}>
                  {urlLoading ? 'fetching' : urlError ? 'error' : 'idle'}
                </span>
              </div>
              <p style={s.hint}>
                Zoom in / pan to trigger a new fetch at viewport resolution.
                Rapid pan cancels the previous inflight request via AbortSignal.
                Galactic coordsys: ℓ 0°–360°, b −90°–+90°.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  page: {
    display: 'flex', flexDirection: 'column',
    background: '#0d0d0d', color: '#e0e0e0', fontFamily: 'monospace',
    minHeight: '100vh', padding: '16px', gap: '16px',
  },
  heading: { fontSize: '18px', fontWeight: 600, color: '#f0f0f0' },
  panel: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    background: '#161616', border: '1px solid #333',
    borderRadius: '6px', padding: '12px',
  },
  panelTitle: { fontSize: '13px', color: '#aaa', fontWeight: 400 },
  row: {
    display: 'flex', gap: '8px', height: '380px',
  },
  plotWrap: {
    flex: 1, position: 'relative',
    background: '#0a0a0a', borderRadius: '4px', overflow: 'hidden',
  },
  canvas: {
    position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
  },
  sidebar: {
    width: `${LUT_PANEL_W}px`, display: 'flex', flexDirection: 'column',
    gap: '8px', flexShrink: 0,
  },
  controlBox: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: '4px', padding: '10px',
  },
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label:    { fontSize: '11px', color: '#ccc' },
  dimLabel: { fontSize: '11px', color: '#888' },
  dimValue: { fontSize: '11px', color: '#e0e0e0' },
  hint: { fontSize: '10px', color: '#666', lineHeight: '1.5', marginTop: '4px' },
  loadBadge: {
    position: 'absolute', top: '8px', right: '8px',
    background: 'rgba(0,0,0,0.75)', border: '1px solid #fbbf24',
    color: '#fbbf24', borderRadius: '4px', padding: '2px 8px',
    fontSize: '11px', pointerEvents: 'none', zIndex: 10,
  },
  errBadge: {
    position: 'absolute', top: '8px', right: '8px',
    background: 'rgba(0,0,0,0.75)', border: '1px solid #f87171',
    color: '#f87171', borderRadius: '4px', padding: '2px 8px',
    fontSize: '11px', pointerEvents: 'none', zIndex: 10,
  },
};
