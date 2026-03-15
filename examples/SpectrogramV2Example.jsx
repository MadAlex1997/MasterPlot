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
import { usePopupChannel } from '../src/popup/usePopupChannel.js';
import { PlotController }         from '../src/plot/PlotController.js';
import { LUTController }          from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import { BitmapDataLayer }        from '../src/plot/layers/BitmapDataLayer.js';
import { AudioController }        from '../src/audio/AudioController.js';
import { FilterController }       from '../src/audio/FilterController.js';
import { SignalStore }             from '../src/plot/layers/SignalDataLayer.js';
import { LineROI }                 from '../src/plot/ROI/LineROI.js';
import LUTPanel                   from '../ui/LUTPanel.jsx';

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
let _playheadROI      = null;   // vline LineROI for playback cursor (spectrogram)
let _wavePlayheadROI  = null;   // vline LineROI for playback cursor (waveform)
let _syncingX         = false;  // prevents domainChanged feedback loop
let _tileIdPrefix     = 0;      // incremented on each _clearTileLayers() call

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
    panMode:"drag",
    xDomain: [0, 10],
    yDomain: [0, 1000],
    xLabel:  'time (s)',
    yLabel:  'freq (Hz)',
    autoExpand: false,
  });

  _waveCtrl = new PlotController({
    disableDefaultDataLayer: true,
    panMode:"drag",
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
  _playheadROI      = null;
  _wavePlayheadROI  = null;
  _syncingX         = false;
  _tileIdPrefix     = 0;
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
    _specCtrl.unregisterDataLayer(`tile-${_tileIdPrefix}-${idx}`);
  }
  _tileIdPrefix++;          // new prefix → deck.gl treats all tile-N IDs as fresh
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
  const layerId = `tile-${_tileIdPrefix}-${tileIndex}`;
  _specCtrl.registerDataLayer(layerId, () => {
    const tile = _tiles.get(tileIndex);
    if (!tile) return null;
    return new BitmapDataLayer({
      id:            layerId,
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

/** Create playhead vline ROIs on both spectrogram and waveform controllers. */
function _addPlayheadROI() {
  if (_playheadROI || !_specCtrl || !_waveCtrl) return;

  const makeVline = (ctrl) => {
    const roi = new LineROI({ orientation: 'vertical', mode: 'vline', position: 0, label: '' });
    roi.bumpVersion();
    const rc = ctrl.roiController;
    rc.addROI(roi);
    roi.onCreate();
    rc.emit('roisChanged', { rois: rc.getAllROIs() });
    return roi;
  };

  _playheadROI     = makeVline(_specCtrl);
  _wavePlayheadROI = makeVline(_waveCtrl);
}

/** Move playhead to time t via version-gated updateFromExternal on both plots. */
function _movePlayhead(t) {
  const moveOn = (ctrl, roi) => {
    if (!ctrl || !roi) return;
    ctrl.roiController.updateFromExternal({
      ...roi.serialize(),
      position:  t,
      domain:    { x: [t, t] },
      version:   roi.version + 1,
      updatedAt: Date.now(),
    });
    ctrl.markDirty();
  };
  moveOn(_specCtrl, _playheadROI);
  moveOn(_waveCtrl, _wavePlayheadROI);
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
  const windowSizeRef  = useRef(1024);
  const windowFnRef    = useRef('hann');
  const srRef          = useRef(44100);
  const isApplyingRef  = useRef(false);  // ref guard prevents double-apply

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

    // Ctrl+click on spectrogram → set playhead at clicked time
    const specCanvas = specWebglRef.current;
    const onSpecClick = (e) => {
      if (!e.ctrlKey || !_specCtrl || !_audioCtrl) return;
      e.preventDefault();
      const t = _specCtrl.viewport.screenXToData(e.offsetX);
      const dur = _audioCtrl.duration || 0;
      const clamped = Math.max(0, Math.min(dur, t));
      _audioCtrl.seek(clamped);
      _movePlayhead(clamped);
      setCurTime(clamped);
    };
    specCanvas?.addEventListener('click', onSpecClick);

    return () => {
      cancelAnimationFrame(rafId);
      specCanvas?.removeEventListener('click', onSpecClick);
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

      // Register home domains so Space → autoScale() snaps to full extents
      _specCtrl.setHomeDomain([0, dur], [0, sr / 2]);
      _waveCtrl.setHomeDomain([0, dur], [yMin - yPad, yMax + yPad]);

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

      // Update LUT histogram + rescale levels on every tile arrival
      _lutCtrl.setData(power, _globalMin, _globalMax);
      _lutCtrl.autoLevel();

      _registerTileLayer(tileIndex);
      _specCtrl?.markDirty();
    };

    const onStftComplete = () => {
      setStatus(
        `STFT complete · ${_tiles.size} tile(s) · ` +
        `${windowSizeRef.current}-pt window · ${srRef.current} Hz`
      );
      _specCtrl?.markDirty();
    };

    // Playhead drag on spectrogram → seek audio + sync waveform playhead
    const onSpecRoiUpdated = ({ roi }) => {
      if (!_playheadROI || roi.id !== _playheadROI.id) return;
      const t = roi.position;
      if (_wavePlayheadROI && _waveCtrl) {
        _waveCtrl.roiController.updateFromExternal({
          ..._wavePlayheadROI.serialize(),
          position: t, domain: { x: [t, t] },
          version: _wavePlayheadROI.version + 1, updatedAt: Date.now(),
        });
        _waveCtrl.markDirty();
      }
      _audioCtrl.seek(t);
      setCurTime(t);
    };

    // Playhead drag on waveform → seek audio + sync spectrogram playhead
    const onWaveRoiUpdated = ({ roi }) => {
      if (!_wavePlayheadROI || roi.id !== _wavePlayheadROI.id) return;
      const t = roi.position;
      if (_playheadROI && _specCtrl) {
        _specCtrl.roiController.updateFromExternal({
          ..._playheadROI.serialize(),
          position: t, domain: { x: [t, t] },
          version: _playheadROI.version + 1, updatedAt: Date.now(),
        });
        _specCtrl.markDirty();
      }
      _audioCtrl.seek(t);
      setCurTime(t);
    };

    _audioCtrl.on('loaded',       onLoaded);
    _audioCtrl.on('stateChanged', onStateChanged);
    _audioCtrl.on('timeUpdate',   onTimeUpdate);
    _audioCtrl.on('tileReady',    onTileReady);
    _audioCtrl.on('stftComplete', onStftComplete);
    _specCtrl.roiController.on('roiUpdated', onSpecRoiUpdated);
    _waveCtrl.roiController.on('roiUpdated', onWaveRoiUpdated);

    return () => {
      _audioCtrl?.off('loaded',       onLoaded);
      _audioCtrl?.off('stateChanged', onStateChanged);
      _audioCtrl?.off('timeUpdate',   onTimeUpdate);
      _audioCtrl?.off('tileReady',    onTileReady);
      _audioCtrl?.off('stftComplete', onStftComplete);
      _specCtrl?.roiController.off('roiUpdated', onSpecRoiUpdated);
      _waveCtrl?.roiController.off('roiUpdated', onWaveRoiUpdated);
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
    if (!hasAudio || isApplyingRef.current) return;
    isApplyingRef.current = true;
    setIsApplying(true);
    // Stop playback and reset position before recomputing
    _audioCtrl.stop();
    _movePlayhead(0);
    setCurTime(0);
    setStatus('Applying filter + recomputing STFT…');
    _audioCtrl.setFilterFn(
      _filterCtrl.state.type === 'none'
        ? null
        : (s, sr) => _filterCtrl.applyToSamples(s, sr)
    );
    try {
      await _runSTFT();
      // Rebuild waveform display with filtered samples
      const filtered = await _audioCtrl.getFilteredSamples();
      _buildWaveform(filtered, _audioCtrl.sampleRate);
      const sig = _signals.getSignal('waveform');
      let yMin = Infinity, yMax = -Infinity;
      for (const pt of sig.path) {
        if (pt[1] < yMin) yMin = pt[1];
        if (pt[1] > yMax) yMax = pt[1];
      }
      const yPad = (yMax - yMin) * 0.1 || 0.1;
      _waveCtrl.yAxis.setDomain([yMin - yPad, yMax + yPad]);
      _waveCtrl.setHomeDomain([0, _audioCtrl.duration], [yMin - yPad, yMax + yPad]);
      _waveCtrl.markDirty();
      // Rebuild AudioBuffer so playback plays the filtered signal
      await _audioCtrl.rebuildFilteredBuffer();
    } finally {
      isApplyingRef.current = false;
      setIsApplying(false);
    }
  }, [hasAudio, _runSTFT]); // isApplying removed from deps — guarded by ref

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

  // Auto-recompute STFT when window size or function changes (skip initial mount)
  const stftParamInitRef = useRef(false);
  useEffect(() => {
    if (!stftParamInitRef.current) { stftParamInitRef.current = true; return; }
    if (hasAudio) _runSTFT();
  }, [windowSize, windowFn]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter popup ───────────────────────────────────────────────────────────

  const filterSuppressRef = useRef(false);

  // usePopupChannel updates onMessage via ref each render — pass inline, no useCallback needed
  const { open: openFilterPopup, send: sendFilter, isOpen: filterPopupOpen } = usePopupChannel(
    'spectrogram-popup.html?panel=filter&channel=spectrogram-v2-filter',
    'spectrogram-v2-filter',
    (msg) => {
      const { type, payload } = msg;
      if (type === 'FILTER_STATE') {
        filterSuppressRef.current = true;
        _filterCtrl.state.type      = payload.filterType;
        _filterCtrl.state.frequency = payload.cutoff;
        _filterCtrl.state.Q         = payload.q;
        _filterCtrl.state.lowFreq   = payload.lowFreq;
        _filterCtrl.state.highFreq  = payload.highFreq;
        if (payload.order != null) _filterCtrl.state.order = payload.order;
        _filterCtrl.emit('changed', { ..._filterCtrl.state });
        filterSuppressRef.current = false;
      } else if (type === 'FILTER_APPLY') {
        handleApplyFilter();
      } else if (type === 'FILTER_CLEAR') {
        _filterCtrl.state.type = 'none';
        _filterCtrl.emit('changed', { ..._filterCtrl.state });
        handleApplyFilter();
      }
    }
  );

  // Sync local FilterController changes → filter popup
  useEffect(() => {
    const onChanged = (s) => {
      if (filterSuppressRef.current) return;
      sendFilter({
        type: 'FILTER_STATE',
        payload: {
          filterType: s.type,
          cutoff:     s.frequency,
          q:          s.Q,
          lowFreq:    s.lowFreq,
          highFreq:   s.highFreq,
          order:      s.order,
          sampleRate: srRef.current,
        },
      });
    };
    _filterCtrl.on('changed', onChanged);
    return () => _filterCtrl.off('changed', onChanged);
  }, [sendFilter]);

  // ── Labels popup ───────────────────────────────────────────────────────────

  const zoomOnSelectRef = useRef(false);

  const { open: openLabelsPopup, send: sendLabels, isOpen: labelsPopupOpen } = usePopupChannel(
    'spectrogram-popup.html?panel=labels&channel=spectrogram-v2-labels',
    'spectrogram-v2-labels',
    (msg) => {
      const { type, payload } = msg;
      if (type === 'SELECT_ROI') {
        if (zoomOnSelectRef.current) {
          const roi = _specCtrl?.roiController.getROI(payload.id);
          if (roi?.domain?.x) {
            _specCtrl.xAxis.setDomain(roi.domain.x);
            if (roi.domain.y) _specCtrl.yAxis.setDomain(roi.domain.y);
            _specCtrl.markDirty();
          }
        }
      } else if (type === 'SET_LABEL') {
        const roi = _specCtrl?.roiController.getROI(payload.id);
        if (roi) {
          roi.metadata = { ...(roi.metadata || {}), label: payload.label };
          roi.bumpVersion();
          // Emit roisChanged so the popup receives updated metadata
          _specCtrl.roiController.emit('roisChanged', { rois: _specCtrl.roiController.getAllROIs() });
        }
      } else if (type === 'DELETE_ROI') {
        _specCtrl?.roiController.deleteROI(payload.id);
      } else if (type === 'ZOOM_TOGGLE') {
        zoomOnSelectRef.current = payload.enabled;
      }
    }
  );

  // Send roisChanged → labels popup (RectROIs only, excluding playhead)
  useEffect(() => {
    if (!_specCtrl) return;
    const onRoisChanged = ({ rois }) => {
      if (!labelsPopupOpen) return;
      const rectRois = rois
        .filter(r => r !== _playheadROI && r.type === 'rect')
        .map(r => r.serialize());
      sendLabels({ type: 'ROIS_CHANGED', payload: rectRois });
    };
    _specCtrl.roiController.on('roisChanged', onRoisChanged);
    return () => _specCtrl?.roiController.off('roisChanged', onRoisChanged);
  }, [labelsPopupOpen, sendLabels]);

  // Auto-select new RectROI in labels popup
  useEffect(() => {
    if (!_specCtrl) return;
    const onRoiCreated = ({ roi }) => {
      if (!labelsPopupOpen || !roi || roi.type !== 'rect') return;
      sendLabels({ type: 'AUTO_SELECT', payload: { id: roi.id } });
    };
    _specCtrl.roiController.on('roiCreated', onRoiCreated);
    return () => _specCtrl?.roiController.off('roiCreated', onRoiCreated);
  }, [labelsPopupOpen, sendLabels]);

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
        case 'p':
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

        {/* Popup buttons */}
        <button onClick={openFilterPopup} disabled={filterPopupOpen || isApplying}
          style={{ ...btnBase, color: (filterPopupOpen || isApplying) ? '#666' : '#fda' }}>
          {isApplying ? 'Applying…' : filterPopupOpen ? 'Filter ▣' : 'Filter ↗'}
        </button>
        <button onClick={openLabelsPopup} disabled={labelsPopupOpen}
          style={{ ...btnBase, color: labelsPopupOpen ? '#666' : '#adf' }}>
          {labelsPopupOpen ? 'Labels ▣' : 'Labels ↗'}
        </button>

        {/* Status */}
        <span style={{ marginLeft: 'auto', color: '#555', maxWidth: 400 }}>{status}</span>
      </div>

      {/* ── Body column ──────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* ── Spectrogram row: plot + LUT panel side by side — 60% ─────── */}
        <div style={{ flex: 6, display: 'flex', borderBottom: '1px solid #222' }}>

          {/* Spectrogram plot */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flexShrink: 0, fontSize: 10, color: '#444', padding: '2px 8px', letterSpacing: 1 }}>
              SPECTROGRAM — R: draw RectROI · D: delete selected · Ctrl+click: set playhead · Space: autoscale
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              <canvas ref={specWebglRef} style={canvasAbs} />
              <canvas ref={specAxisRef}  style={{ ...canvasAbs, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* LUT panel — same height as spectrogram */}
          <LUTPanel
            lutController={_lutCtrl}
            lutHistCtrl={_lutHistCtrl}
            width={LUT_PANEL_W}
            height="100%"
          />
        </div>

        {/* ── Waveform — full width, 40% ────────────────────────────────── */}
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
    </div>
  );
}
