/**
 * SpectrogramV2Example — EX-Spec
 *
 * Spectrogram viewer built on the Phase 4 primitives:
 *   BitmapDataLayer (F27) + LUTController (F28) + LUTHistogramController (F28)
 *   + LUTPanel (F29) + AudioController (F30)
 *
 * Architecture:
 *   AudioController
 *     'tileReady'  → registerDataLayer('tile-N') with BitmapDataLayer per tile
 *     'timeUpdate' → move playhead vline ROI position → specCtrl.markDirty()
 *
 *   PlotController (spectrogram)
 *     disableDefaultDataLayer: true
 *     one BitmapDataLayer per STFT tile, all sharing one LUTController
 *     ROIController: user-drawn RectROIs (press R) for labeling
 *
 *   LUTController  → levelChanged/lutChanged → colorTrigger++ → specCtrl.markDirty()
 *   LUTHistogramController + ui/LUTPanel.jsx  (right sidebar, top)
 *   ui/FilterPanel.jsx (right sidebar, bottom) → audioCtrl.setFilterFn bridge
 *
 *   PlotController (waveform) + SignalStore → PathLayer
 *
 *   X-axis: spectrogram ↔ waveform synced via domainChanged
 */

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlotController }         from '../src/plot/PlotController.js';
import { LUTController }          from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import { BitmapDataLayer }        from '../src/plot/layers/BitmapDataLayer.js';
import { AudioController }        from '../src/audio/AudioController.js';
import { FilterController }       from '../src/audio/FilterController.js';
import { SignalStore }             from '../src/plot/layers/SignalDataLayer.js';
import { LineROI }                 from '../src/plot/ROI/LineROI.js';
import LUTPanel                   from '../ui/LUTPanel.jsx';
import FilterPanel                from '../ui/FilterPanel.jsx';

// ── Constants ─────────────────────────────────────────────────────────────────

const WAVEFORM_STEP = 20;     // downsample factor for waveform PathLayer
const LUT_PANEL_W   = 160;    // px — right sidebar width
const TILE_W_SEC    = 30;     // seconds per STFT tile

const PRESETS = [
  { label: '— load preset —',  path: null },
  { label: 'bird',              path: '/sounds/city_bird_sound_black_bird_ZU0_YdN.wav' },
  { label: 'ringdove + siren',  path: '/sounds/city_ringdove_with_huma_whistle_and_car_siren_sound_5bn_dzC.wav' },
  { label: 'plane 1',           path: '/sounds/plane1.wav' },
  { label: 'plane 2',           path: '/sounds/plane2.wav' },
];

const WINDOW_FNS   = ['hann', 'hamming', 'blackman', 'rectangular'];
const WINDOW_SIZES = [256, 512, 1024, 2048, 4096];

// ── Module-level state (React owns NONE of this) ──────────────────────────────

let _audioCtrl    = null;
let _specCtrl     = null;
let _waveCtrl     = null;
let _lutCtrl      = null;
let _lutHistCtrl  = null;
let _filterCtrl   = null;
let _signals      = null;   // SignalStore for waveform
let _tiles        = null;   // Map<tileIndex, { power, width, height, bounds, dataTrigger }>
let _colorTrigger = 0;      // incremented on levelChanged / lutChanged
let _globalMin    = Infinity;
let _globalMax    = -Infinity;
let _playheadROI  = null;   // vline LineROI for playback cursor
let _syncingX     = false;  // prevents domainChanged feedback loop

function _ensureState() {
  if (_audioCtrl) return;

  _lutCtrl     = new LUTController();
  _lutHistCtrl = new LUTHistogramController({ lutController: _lutCtrl });
  _filterCtrl  = new FilterController();
  _tiles       = new Map();
  _signals     = new SignalStore();
  _signals.addSignal('waveform', [40, 180, 255, 200]);
  _audioCtrl   = new AudioController();

  _specCtrl = new PlotController({
    disableDefaultDataLayer: true,
    xDomain: [0, 10],
    yDomain: [0, 1000],
    xLabel:  'time (s)',
    yLabel:  'freq (Hz)',
    autoExpand: false,
  });

  _waveCtrl = new PlotController({
    disableDefaultDataLayer: true,
    xDomain: [0, 10],
    yDomain: [-1.2, 1.2],
    xLabel:  'time (s)',
    yLabel:  'amplitude',
    autoExpand: false,
  });

  // Waveform signal layer
  const layerDef = _signals.toLayerDef();
  _waveCtrl.registerDataLayer(layerDef.id, layerDef.build);

  // LUT changes → recolorize tiles
  _lutCtrl.on('levelChanged', () => { _colorTrigger++; _specCtrl?.markDirty(); });
  _lutCtrl.on('lutChanged',   () => { _colorTrigger++; _specCtrl?.markDirty(); });

  // X-axis sync: spectrogram ↔ waveform
  _specCtrl.on('domainChanged', ({ xDomain }) => {
    if (_syncingX || !xDomain) return;
    _syncingX = true;
    _waveCtrl.xAxis.setDomain(xDomain);
    _syncingX = false;
  });
  _waveCtrl.on('domainChanged', ({ xDomain }) => {
    if (_syncingX || !xDomain) return;
    _syncingX = true;
    _specCtrl.xAxis.setDomain(xDomain);
    _syncingX = false;
  });
}

function _destroyState() {
  _audioCtrl?.destroy();
  _specCtrl?.destroy();
  _waveCtrl?.destroy();
  _lutHistCtrl?.destroy();
  _audioCtrl    = null;
  _specCtrl     = null;
  _waveCtrl     = null;
  _lutCtrl      = null;
  _lutHistCtrl  = null;
  _filterCtrl   = null;
  _signals      = null;
  _tiles        = null;
  _colorTrigger = 0;
  _globalMin    = Infinity;
  _globalMax    = -Infinity;
  _playheadROI  = null;
  _syncingX     = false;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Build waveform PathLayer data from samples (downsampled). */
function _buildWaveform(samples, sampleRate) {
  _signals.reset();
  const sig = _signals.getSignal('waveform');
  const n   = Math.ceil(samples.length / WAVEFORM_STEP);
  for (let i = 0; i < n; i++) {
    const si = i * WAVEFORM_STEP;
    sig.path.push([si / sampleRate, samples[si], 0]);
  }
  if (sig.path.length >= 2) {
    sig.layerData = [{ path: sig.path, color: sig.color }];
    sig.version++;
  }
}

/** Remove all tile layers from specCtrl and reset tracking state. */
function _clearTileLayers() {
  if (!_specCtrl || !_tiles) return;
  for (const idx of _tiles.keys()) {
    _specCtrl.unregisterDataLayer(`tile-${idx}`);
  }
  _tiles.clear();
  _globalMin    = Infinity;
  _globalMax    = -Infinity;
  _colorTrigger = 0;
}

/**
 * Register (or replace) a BitmapDataLayer for the given tile index.
 * The build closure reads tile data from _tiles at render time,
 * so dataTrigger / colorTrigger values are always current.
 */
function _registerTileLayer(tileIndex) {
  _specCtrl.registerDataLayer(`tile-${tileIndex}`, () => {
    const tile = _tiles.get(tileIndex);
    if (!tile) return null;
    return new BitmapDataLayer({
      id:            `tile-${tileIndex}`,
      source:        tile.power,
      bitMapping:    { bounds: tile.bounds },
      width:         tile.width,
      height:        tile.height,
      channels:      'gray',
      dtype:         'float32',
      lutController: _lutCtrl,
      dataTrigger:   tile.dataTrigger,
      colorTrigger:  _colorTrigger,
    });
  });
}

/** Create playhead vline ROI and add it to specCtrl (called after init). */
function _addPlayheadROI() {
  if (_playheadROI || !_specCtrl) return;
  const roi = new LineROI({ orientation: 'vertical', mode: 'vline', position: 0, label: '' });
  roi.bumpVersion();
  const rc = _specCtrl.roiController;
  rc.addROI(roi);
  roi.onCreate();
  rc.emit('roisChanged', { rois: rc.getAllROIs() });
  _playheadROI = roi;
}

/** Move playhead to time t via version-gated updateFromExternal. */
function _movePlayhead(t) {
  if (!_playheadROI || !_specCtrl) return;
  _specCtrl.roiController.updateFromExternal({
    ..._playheadROI.serialize(),
    position:  t,
    domain:    { x: [t, t] },
    version:   _playheadROI.version + 1,
    updatedAt: Date.now(),
  });
  _specCtrl.markDirty();
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SpectrogramV2Example() {

  // Initialize module-level state synchronously before first render
  _ensureState();

  // ── Canvas refs ────────────────────────────────────────────────────────────
  const specWebglRef = useRef(null);
  const specAxisRef  = useRef(null);
  const waveWebglRef = useRef(null);
  const waveAxisRef  = useRef(null);

  // ── Stable STFT param refs ────────────────────────────────────────────────
  const windowSizeRef = useRef(1024);
  const windowFnRef   = useRef('hann');
  const srRef         = useRef(44100);

  // ── React state (UI only) ─────────────────────────────────────────────────
  const [status,     setStatus]     = useState('Ready — load audio to begin');
  const [isLoading,  setIsLoading]  = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [playState,  setPlayState]  = useState('stopped');
  const [curTime,    setCurTime]    = useState(0);
  const [duration,   setDuration]   = useState(0);
  const [windowSize, setWindowSize] = useState(1024);
  const [windowFn,   setWindowFn]   = useState('hann');
  const [hasAudio,   setHasAudio]   = useState(false);

  // ── PlotController init ────────────────────────────────────────────────────

  useEffect(() => {
    const initCanvas = (ctrl, wc, ac) => {
      if (!wc || !ac) return;
      const w = wc.offsetWidth  || 800;
      const h = wc.offsetHeight || 300;
      wc.width = w; wc.height = h;
      ac.width = w; ac.height = h;
      ctrl.init(wc, ac);
    };

    // Use rAF so canvas layout dimensions are settled before init
    const rafId = requestAnimationFrame(() => {
      initCanvas(_specCtrl, specWebglRef.current, specAxisRef.current);
      initCanvas(_waveCtrl, waveWebglRef.current, waveAxisRef.current);
      _addPlayheadROI();
    });

    return () => {
      cancelAnimationFrame(rafId);
      _destroyState();
    };
  }, []); // mount once

  // ── AudioController event wiring ──────────────────────────────────────────

  useEffect(() => {
    const onLoaded = ({ duration: dur, sampleRate: sr, samples }) => {
      srRef.current = sr;
      setDuration(dur);
      setHasAudio(true);

      // Build waveform
      _buildWaveform(samples, sr);
      const sig = _signals.getSignal('waveform');
      let yMin = Infinity, yMax = -Infinity;
      for (const pt of sig.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
      const yPad = (yMax - yMin) * 0.1 || 0.1;
      const d = [0, dur];
      _waveCtrl.xAxis.setDomain(d);
      _waveCtrl.yAxis.setDomain([yMin - yPad, yMax + yPad]);
      _waveCtrl.markDirty();
      _specCtrl.xAxis.setDomain(d);
      _specCtrl.yAxis.setDomain([0, sr / 2]);
      _specCtrl.markDirty();

      setStatus('Audio loaded — computing STFT…');
      _runSTFT();
    };

    const onStateChanged = ({ state }) => setPlayState(state);

    const onTimeUpdate = ({ currentTime }) => {
      setCurTime(currentTime);
      _movePlayhead(currentTime);
    };

    const onTileReady = ({ tileIndex, power, width, height, globalMin, globalMax, bounds }) => {
      const existing    = _tiles.get(tileIndex);
      const dataTrigger = existing ? existing.dataTrigger + 1 : 0;
      _tiles.set(tileIndex, { power, width, height, bounds, dataTrigger });

      if (globalMin < _globalMin) _globalMin = globalMin;
      if (globalMax > _globalMax) _globalMax = globalMax;

      _registerTileLayer(tileIndex);
      _specCtrl?.markDirty();
    };

    const onStftComplete = () => {
      const firstTile = _tiles.get(0);
      if (firstTile) {
        _lutCtrl.setData(firstTile.power, _globalMin, _globalMax);
        _lutCtrl.autoLevel();
      }
      setStatus(
        `STFT complete · ${_tiles.size} tile(s) · ` +
        `${windowSizeRef.current}-pt window · ${srRef.current} Hz`
      );
      _specCtrl?.markDirty();
    };

    _audioCtrl.on('loaded',       onLoaded);
    _audioCtrl.on('stateChanged', onStateChanged);
    _audioCtrl.on('timeUpdate',   onTimeUpdate);
    _audioCtrl.on('tileReady',    onTileReady);
    _audioCtrl.on('stftComplete', onStftComplete);

    return () => {
      _audioCtrl?.off('loaded',       onLoaded);
      _audioCtrl?.off('stateChanged', onStateChanged);
      _audioCtrl?.off('timeUpdate',   onTimeUpdate);
      _audioCtrl?.off('tileReady',    onTileReady);
      _audioCtrl?.off('stftComplete', onStftComplete);
    };
  }, []); // mount once — _audioCtrl identity never changes

  // ── STFT computation ───────────────────────────────────────────────────────

  const _runSTFT = useCallback(async () => {
    _clearTileLayers();
    await _audioCtrl.computeSTFT({
      windowSize:   windowSizeRef.current,
      windowFn:     windowFnRef.current,
      tileWidthSec: TILE_W_SEC,
    });
  }, []);

  // ── File / preset loading ─────────────────────────────────────────────────

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsLoading(true);
    setStatus(`Loading ${file.name}…`);
    try {
      const buf = await file.arrayBuffer();
      await _audioCtrl.loadFile(buf);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handlePresetChange = useCallback(async (e) => {
    const path = e.target.value;
    if (!path) return;
    setIsLoading(true);
    setStatus('Loading preset…');
    try {
      const resp = await fetch(path);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf  = await resp.arrayBuffer();
      await _audioCtrl.loadFile(buf);
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Filter apply ────────────────────────────────────────────────────────────

  const handleApplyFilter = useCallback(async () => {
    if (!hasAudio || isApplying) return;
    setIsApplying(true);
    setStatus('Applying filter + recomputing STFT…');
    _audioCtrl.setFilterFn(
      _filterCtrl.state.type === 'none'
        ? null
        : (s, sr) => _filterCtrl.applyToSamples(s, sr)
    );
    try {
      await _runSTFT();
    } finally {
      setIsApplying(false);
    }
  }, [hasAudio, isApplying, _runSTFT]);

  // ── Playback ───────────────────────────────────────────────────────────────

  const handlePlay  = useCallback(() => _audioCtrl?.play(),  []);
  const handlePause = useCallback(() => _audioCtrl?.pause(), []);
  const handleStop  = useCallback(() => {
    _audioCtrl?.stop();
    setCurTime(0);
    _movePlayhead(0);
  }, []);

  // ── STFT param controls ────────────────────────────────────────────────────

  const handleWindowSizeChange = useCallback((e) => {
    const ws = Number(e.target.value);
    setWindowSize(ws);
    windowSizeRef.current = ws;
  }, []);

  const handleWindowFnChange = useCallback((e) => {
    setWindowFn(e.target.value);
    windowFnRef.current = e.target.value;
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    const onKey = (e) => {
      if (!_specCtrl) return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea') return;
      switch (e.key.toLowerCase()) {
        case 'r':
          _specCtrl.roiController.startCreateRect?.();
          break;
        case 'd': {
          const all = _specCtrl.roiController.getAllROIs?.() || [];
          // Delete first non-playhead selected ROI (or most recently hovered)
          for (const roi of all) {
            if (roi !== _playheadROI) {
              _specCtrl.roiController.deleteROI(roi.id);
              break;
            }
          }
          break;
        }
        case ' ':
          e.preventDefault();
          if (playState === 'playing') handlePause();
          else handlePlay();
          break;
        default: break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [playState, handlePlay, handlePause]);

  // ── Format helpers ─────────────────────────────────────────────────────────

  const fmtTime = (t) => {
    const m = Math.floor(t / 60).toString();
    const s = (t % 60).toFixed(1).padStart(4, '0');
    return `${m}:${s}`;
  };

  // ── Styles ─────────────────────────────────────────────────────────────────

  const mono    = { fontFamily: 'monospace', fontSize: 11 };
  const btnBase = { background: '#1a1a1a', border: '1px solid #444', cursor: 'pointer', padding: '2px 8px', ...mono };
  const canvasAbs = { position: 'absolute', inset: 0, width: '100%', height: '100%' };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width: '100%', height: '100vh',
      background: '#0d0d0d', color: '#ccc', ...mono,
    }}>

      {/* ── Header bar ───────────────────────────────────────────────────── */}
      <div style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10,
        padding: '5px 12px', background: '#111', borderBottom: '1px solid #222',
        flexWrap: 'wrap',
      }}>
        <span style={{ color: '#7df', fontWeight: 700 }}>Spectrogram V2</span>

        {/* File upload */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#888', cursor: 'pointer' }}>
          Load file:
          <input type="file" accept="audio/*" onChange={handleFileChange} disabled={isLoading}
            style={{ ...mono, maxWidth: 160 }} />
        </label>

        {/* Preset */}
        <select onChange={handlePresetChange} disabled={isLoading}
          style={{ ...btnBase, border: '1px solid #444', color: '#aaa', padding: '2px 4px' }}>
          {PRESETS.map(p => <option key={p.label} value={p.path || ''}>{p.label}</option>)}
        </select>

        {/* Window fn */}
        <span style={{ color: '#555' }}>Window:&nbsp;
          <select value={windowFn} onChange={handleWindowFnChange}
            style={{ ...btnBase, border: '1px solid #444', color: '#aaa', padding: '2px 4px' }}>
            {WINDOW_FNS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </span>

        {/* Window size */}
        <span style={{ color: '#555' }}>Size:&nbsp;
          <select value={windowSize} onChange={handleWindowSizeChange}
            style={{ ...btnBase, border: '1px solid #444', color: '#aaa', padding: '2px 4px' }}>
            {WINDOW_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </span>

        {/* Recompute */}
        <button onClick={() => hasAudio && _runSTFT()} disabled={!hasAudio || isLoading}
          style={{ ...btnBase, color: (!hasAudio || isLoading) ? '#444' : '#adf' }}>
          Recompute STFT
        </button>

        {/* Playback */}
        <button onClick={handlePlay}  disabled={!hasAudio}
          style={{ ...btnBase, color: hasAudio ? '#4f8' : '#444' }}>▶</button>
        <button onClick={handlePause} disabled={!hasAudio || playState !== 'playing'}
          style={{ ...btnBase, color: (hasAudio && playState === 'playing') ? '#fd8' : '#444' }}>⏸</button>
        <button onClick={handleStop}  disabled={!hasAudio}
          style={{ ...btnBase, color: hasAudio ? '#f88' : '#444' }}>■</button>
        <span style={{ color: '#555' }}>{fmtTime(curTime)} / {fmtTime(duration)}</span>

        {/* Status */}
        <span style={{ marginLeft: 'auto', color: '#555', maxWidth: 400 }}>{status}</span>
      </div>

      {/* ── Body row ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── Left: spectrogram + waveform stacked ─────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Spectrogram — 60% */}
          <div style={{ flex: 6, display: 'flex', flexDirection: 'column', borderBottom: '1px solid #222' }}>
            <div style={{ flexShrink: 0, fontSize: 10, color: '#444', padding: '2px 8px', letterSpacing: 1 }}>
              SPECTROGRAM — R: draw RectROI annotation · D: delete selected
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={specWebglRef} style={canvasAbs} />
              <canvas ref={specAxisRef}  style={{ ...canvasAbs, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Waveform — 40% */}
          <div style={{ flex: 4, display: 'flex', flexDirection: 'column' }}>
            <div style={{ flexShrink: 0, fontSize: 10, color: '#444', padding: '2px 8px', letterSpacing: 1 }}>
              WAVEFORM — pan/zoom synced with spectrogram x-axis
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={waveWebglRef} style={canvasAbs} />
              <canvas ref={waveAxisRef}  style={{ ...canvasAbs, pointerEvents: 'none' }} />
            </div>
          </div>
        </div>

        {/* ── Right sidebar: LUT panel + Filter panel ──────────────────── */}
        <div style={{
          width: LUT_PANEL_W, display: 'flex', flexDirection: 'column',
          flexShrink: 0, borderLeft: '1px solid #222', background: '#0a0a0a',
        }}>
          {/* LUT panel — fills remaining space */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <LUTPanel
              lutController={_lutCtrl}
              lutHistCtrl={_lutHistCtrl}
              width={LUT_PANEL_W}
              height="100%"
            />
          </div>

          {/* Filter panel — fixed height */}
          <FilterPanel
            controller={_filterCtrl}
            sampleRate={srRef.current}
            onApply={handleApplyFilter}
            applying={isApplying}
          />
        </div>
      </div>
    </div>
  );
}
