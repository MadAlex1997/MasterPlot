/**
 * SpectrogramExample — demonstrates SpectrogramLayer + waveform LineLayer.
 *
 * Audio: 5-second linear chirp (440 → 4400 Hz) mixed with pink noise,
 * at 44100 Hz sample rate.
 *
 * Layout (top → bottom):
 *   1. Spectrogram panel  (SpectrogramLayer / BitmapLayer)
 *   2. Waveform panel     (buildLineLayer / PathLayer, downsampled by WAVEFORM_STEP)
 *
 * Live append: every 500 ms, extend the chirp signal by 0.25 s and
 * rebuild both layers.
 *
 * Controls:
 *   windowSize selector (256 / 512 / 1024 / 2048)
 *   Live append checkbox
 *
 * Interaction (both panels):
 *   Scroll wheel → zoom (centered on cursor)
 *   Drag         → pan (grab-and-drag)
 */

import React, { useRef, useEffect, useState } from 'react';
import { Deck }             from '@deck.gl/core';
import { OrthographicView } from '@deck.gl/core';
import { ViewportController }    from '../src/plot/ViewportController.js';
import { AxisController }        from '../src/plot/axes/AxisController.js';
import { AxisRenderer }          from '../src/plot/axes/AxisRenderer.js';
import { SpectrogramLayer }      from '../src/plot/layers/SpectrogramLayer.js';
import { buildLineLayer }        from '../src/plot/layers/LineLayer.js';
import { HistogramLUTController } from '../src/plot/layers/HistogramLUTController.js';
import HistogramLUTPanel         from '../src/components/HistogramLUTPanel.jsx';
import { PlaybackController }    from '../src/audio/PlaybackController.js';
import { FilterController }      from '../src/audio/FilterController.js';
import FilterPanel               from '../src/components/FilterPanel.jsx';

// ── Playhead drawing helpers ───────────────────────────────────────────────────

/**
 * Draw a vertical playhead line on a 2D axis canvas overlay.
 * No-ops silently if time is outside the current x-domain.
 */
function drawPlayhead(canvas, time, xAxis, viewport) {
  const [xMin, xMax] = xAxis.getDomain();
  if (time < xMin || time > xMax) return;
  const { plotArea: pa } = viewport;
  const px  = pa.x + (time - xMin) / Math.max(xMax - xMin, 1e-10) * pa.width;
  const ctx = canvas.getContext('2d');
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 220, 40, 0.85)';
  ctx.lineWidth   = 1.5;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(px, pa.y);
  ctx.lineTo(px, pa.y + pa.height);
  ctx.stroke();
  // Time label at top of line, flips side when near right edge
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255, 220, 40, 0.9)';
  ctx.font      = '10px monospace';
  const rightHalf = px > pa.x + pa.width * 0.6;
  ctx.textAlign = rightHalf ? 'right' : 'left';
  ctx.fillText(formatPlayTime(time), px + (rightHalf ? -4 : 4), pa.y + 12);
  ctx.restore();
}

/** Format seconds as m:ss.d  e.g. 1:23.4 */
function formatPlayTime(secs) {
  const m  = Math.floor(secs / 60);
  const s  = Math.floor(secs % 60);
  const ds = Math.floor((secs % 1) * 10);
  return `${m}:${String(s).padStart(2, '0')}.${ds}`;
}

// ── Audio generation ──────────────────────────────────────────────────────────

const SAMPLE_RATE   = 44100;
const CHIRP_F0      = 440;
const CHIRP_F1      = 4400;
const CHIRP_T       = 10;    // chirp sweeps over 10 s (beyond demo duration)
const NOISE_LEVEL   = 0.08;
const APPEND_SECS   = 0.25;
const APPEND_MS     = 500;
const WAVEFORM_STEP = 50;    // downsample: 44100/50 = 882 display pts/sec

// Pink noise state (module-level)
let _b0 = 0, _b1 = 0, _b2 = 0, _b3 = 0, _b4 = 0, _b5 = 0, _b6 = 0;

function pinkNoiseSample() {
  const w = Math.random() * 2 - 1;
  _b0 = 0.99886 * _b0 + w * 0.0555179;
  _b1 = 0.99332 * _b1 + w * 0.0750759;
  _b2 = 0.96900 * _b2 + w * 0.1538520;
  _b3 = 0.86650 * _b3 + w * 0.3104856;
  _b4 = 0.55000 * _b4 + w * 0.5329522;
  _b5 = -0.7616 * _b5 - w * 0.0168980;
  const out = (_b0 + _b1 + _b2 + _b3 + _b4 + _b5 + _b6 + w * 0.5362) * 0.11;
  _b6 = w * 0.115926;
  return out;
}

function chirpSample(sampleIndex) {
  const t = sampleIndex / SAMPLE_RATE;
  return Math.sin(2 * Math.PI * (CHIRP_F0 + (CHIRP_F1 - CHIRP_F0) * t / (2 * CHIRP_T)) * t);
}

function generateSamples(fromSample, count) {
  const buf = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    buf[i] = chirpSample(fromSample + i) + pinkNoiseSample() * NOISE_LEVEL;
  }
  return buf;
}

// ── ViewState builder (shared by both panels) ─────────────────────────────────

function buildViewState(xAxis, yAxis, viewport) {
  const [xMin, xMax] = xAxis.getDomain();
  const [yMin, yMax] = yAxis.getDomain();
  const { canvasWidth: W, canvasHeight: H, plotArea: pa, marginLeft, marginBottom } = viewport;

  const xSpan = Math.max(xMax - xMin, 1e-10);
  const ySpan = Math.max(yMax - yMin, 1e-10);
  const zoomX = Math.log2(pa.width  / xSpan);
  const zoomY = Math.log2(pa.height / ySpan);
  const tx    = xMin + (W / 2 - marginLeft)   * xSpan / pa.width;
  const ty    = yMin + (H / 2 - marginBottom)  * ySpan / pa.height;

  return { id: 'ortho', target: [tx, ty, 0], zoom: [zoomX, zoomY] };
}

// ── Component ────────────────────────────────────────────────────────────────

export default function SpectrogramExample() {
  // ── Spectrogram canvas refs ────────────────────────────────────────────────
  const webglRef = useRef(null);
  const axisRef  = useRef(null);

  // ── Waveform canvas refs ───────────────────────────────────────────────────
  const waveWebglRef = useRef(null);
  const waveAxisRef  = useRef(null);

  // ── Spectrogram mutable state ──────────────────────────────────────────────
  const deckRef         = useRef(null);
  const xAxisRef        = useRef(null);
  const yAxisRef        = useRef(null);
  const viewportRef     = useRef(null);
  const axisRendRef     = useRef(null);
  const samplesRef      = useRef(new Float32Array(0));
  const sampleCntRef    = useRef(0);
  const dataTriggerRef  = useRef(0);
  const dirtyRef        = useRef(true);
  const rafRef          = useRef(null);
  const panRef          = useRef(null);
  const intervalRef     = useRef(null);
  const windowSizeRef   = useRef(1024);
  const timeWindowRef   = useRef(null);   // null = show all; number = seconds to display

  // ── Waveform mutable state ─────────────────────────────────────────────────
  const waveDeckRef       = useRef(null);
  const waveXAxisRef      = useRef(null);
  const waveYAxisRef      = useRef(null);
  const waveViewportRef   = useRef(null);
  const waveAxisRendRef   = useRef(null);
  const waveXRef          = useRef(new Float32Array(0));  // time (seconds)
  const waveYRef          = useRef(new Float32Array(0));  // amplitude
  const waveDataTrigger   = useRef(0);
  const waveDirtyRef      = useRef(true);
  const wavePanRef        = useRef(null);

  const fileInputRef        = useRef(null);
  const loadedSampleRateRef = useRef(SAMPLE_RATE);  // actual sr of loaded audio

  // ── HistogramLUT refs ──────────────────────────────────────────────────────
  const lutControllerRef  = useRef(null);
  const colorTriggerRef   = useRef(0);
  if (!lutControllerRef.current) {
    lutControllerRef.current = new HistogramLUTController();
  }

  // ── Playback refs ──────────────────────────────────────────────────────────
  const playbackRef = useRef(null);
  if (!playbackRef.current) {
    playbackRef.current = new PlaybackController();
  }

  // ── Filter refs ────────────────────────────────────────────────────────────
  const filterControllerRef = useRef(null);
  const originalSamplesRef  = useRef(null);  // snapshot of pre-filter PCM for "Clear Filter"
  if (!filterControllerRef.current) {
    filterControllerRef.current = new FilterController();
  }

  const [log,              setLog]              = useState([]);
  const [liveAppend,       setLiveAppend]       = useState(true);
  const [windowSize,       setWindowSize]       = useState(1024);
  const [loading,          setLoading]          = useState(false);
  const [colorTrigger,     setColorTrigger]     = useState(0);
  const [playState,        setPlayState]        = useState('stopped'); // 'playing'|'paused'|'stopped'
  const [applying,         setApplying]         = useState(false);
  const [filterSampleRate, setFilterSampleRate] = useState(SAMPLE_RATE);
  const [timeWindow,       setTimeWindow]       = useState(null);  // null = All

  const addLog = (msg) => setLog(prev => [msg, ...prev].slice(0, 20));

  // ── Sample append ──────────────────────────────────────────────────────────

  const appendSamples = (count) => {
    const fromSample = sampleCntRef.current;
    const newBuf     = generateSamples(fromSample, count);
    sampleCntRef.current += count;

    const tw = timeWindowRef.current;
    const sr = SAMPLE_RATE;

    // ── PCM buffer ─────────────────────────────────────────────────────────
    const old    = samplesRef.current;
    const merged = new Float32Array(old.length + count);
    merged.set(old);
    merged.set(newBuf, old.length);
    if (tw) {
      const maxSamples = Math.floor(tw * sr);
      samplesRef.current = merged.length > maxSamples
        ? merged.slice(merged.length - maxSamples)
        : merged;
    } else {
      samplesRef.current = merged;
    }
    dataTriggerRef.current += 1;
    dirtyRef.current = true;

    // ── Waveform buffer ────────────────────────────────────────────────────
    const numNewWavePts = Math.floor(count / WAVEFORM_STEP);
    if (numNewWavePts > 0) {
      const oldWY = waveYRef.current;
      const grownY = new Float32Array(oldWY.length + numNewWavePts);
      grownY.set(oldWY);
      for (let i = 0; i < numNewWavePts; i++) {
        grownY[oldWY.length + i] = newBuf[i * WAVEFORM_STEP];
      }

      if (tw) {
        // Keep only the last tw seconds of waveform; rebase x to start at 0
        const maxWavePts = Math.ceil(tw * sr / WAVEFORM_STEP);
        const keepY = grownY.length > maxWavePts
          ? grownY.slice(grownY.length - maxWavePts)
          : grownY;
        const keepX = new Float32Array(keepY.length);
        const xStep = WAVEFORM_STEP / sr;
        for (let i = 0; i < keepY.length; i++) keepX[i] = i * xStep;
        waveXRef.current = keepX;
        waveYRef.current = keepY;
      } else {
        const oldWX = waveXRef.current;
        const grownX = new Float32Array(oldWX.length + numNewWavePts);
        grownX.set(oldWX);
        for (let i = 0; i < numNewWavePts; i++) {
          grownX[oldWX.length + i] = (fromSample + i * WAVEFORM_STEP) / sr;
        }
        waveXRef.current = grownX;
        waveYRef.current = grownY;
      }
      waveDataTrigger.current += 1;
      waveDirtyRef.current = true;
    }

    const bufferSecs = samplesRef.current.length / sr;
    xAxisRef.current?.setDomain([0, bufferSecs]);
    waveXAxisRef.current?.setDomain([0, bufferSecs]);

    addLog(`dataAppended: +${count} samples  buffer=${bufferSecs.toFixed(2)}s`);
  };

  // ── Spectrogram render ─────────────────────────────────────────────────────

  const renderFrame = () => {
    const deck     = deckRef.current;
    const xAxis    = xAxisRef.current;
    const yAxis    = yAxisRef.current;
    const viewport = viewportRef.current;
    const axisRend = axisRendRef.current;
    if (!deck || !xAxis || !yAxis || !viewport) return;

    const layers = [
      new SpectrogramLayer({
        id:            'spectrogram',
        samples:       samplesRef.current,
        sampleRate:    loadedSampleRateRef.current,
        windowSize:    windowSizeRef.current,
        hopSize:       windowSizeRef.current / 2,
        dataTrigger:   dataTriggerRef.current,
        lutController: lutControllerRef.current,
        colorTrigger:  colorTriggerRef.current,  // read from ref, not stale state
      }),
    ];

    deck.setProps({ viewState: buildViewState(xAxis, yAxis, viewport), layers });
    axisRend?.render();
  };

  // ── Waveform render ────────────────────────────────────────────────────────

  const waveRenderFrame = () => {
    const deck     = waveDeckRef.current;
    const xAxis    = waveXAxisRef.current;
    const yAxis    = waveYAxisRef.current;
    const viewport = waveViewportRef.current;
    const axisRend = waveAxisRendRef.current;
    if (!deck || !xAxis || !yAxis || !viewport) return;

    const x = waveXRef.current;
    const y = waveYRef.current;
    const layers = x.length >= 2
      ? [buildLineLayer({ x, y }, {
          id:    'waveform',
          color: [100, 220, 255, 200],
          width: 1,
          layerProps: { updateTriggers: { getPath: waveDataTrigger.current } },
        })]
      : [];

    deck.setProps({ viewState: buildViewState(xAxis, yAxis, viewport), layers });
    axisRend?.render();
  };

  // ── RAF loop ───────────────────────────────────────────────────────────────

  const scheduleRender = () => {
    rafRef.current = requestAnimationFrame(() => {
      const pb = playbackRef.current;
      // Force redraw every frame during playback so the playhead moves in real time
      if (pb?.isPlaying) {
        dirtyRef.current     = true;
        waveDirtyRef.current = true;
      }

      if (dirtyRef.current) {
        renderFrame();
        dirtyRef.current = false;
        // Draw playhead on top of axis overlay (after AxisRenderer clears & redraws)
        if (pb && axisRef.current && xAxisRef.current && viewportRef.current) {
          drawPlayhead(axisRef.current, pb.currentTime, xAxisRef.current, viewportRef.current);
        }
      }
      if (waveDirtyRef.current) {
        waveRenderFrame();
        waveDirtyRef.current = false;
        if (pb && waveAxisRef.current && waveXAxisRef.current && waveViewportRef.current) {
          drawPlayhead(waveAxisRef.current, pb.currentTime, waveXAxisRef.current, waveViewportRef.current);
        }
      }

      scheduleRender();
    });
  };

  // ── Mount / unmount ────────────────────────────────────────────────────────

  useEffect(() => {
    const wc = webglRef.current;
    const ac = axisRef.current;
    const ww = waveWebglRef.current;
    const wa = waveAxisRef.current;
    if (!wc || !ac || !ww || !wa) return;

    const initRaf = requestAnimationFrame(() => {
      // ── Spectrogram panel ───────────────────────────────────────────────────
      const w = wc.offsetWidth  || 800;
      const h = wc.offsetHeight || 400;
      wc.width = w; wc.height = h;
      ac.width = w; ac.height = h;

      const viewport = new ViewportController();
      viewport.setCanvasSize(w, h);
      const { plotArea: pa } = viewport;

      const xAxis = new AxisController({ axis: 'x', scaleType: 'linear', domain: [0, 1] });
      const yAxis = new AxisController({ axis: 'y', scaleType: 'linear', domain: [0, SAMPLE_RATE / 2] });
      xAxis.label = 'Time (s)';
      yAxis.label = 'Frequency (Hz)';
      xAxis.setRange([pa.x, pa.x + pa.width]);
      yAxis.setRange([pa.y + pa.height, pa.y]);  // inverted: y=0 at visual bottom
      viewport.setScales(xAxis.getScale(), yAxis.getScale());

      xAxis.on('domainChanged', () => { viewport.setScales(xAxis.getScale(), yAxis.getScale()); dirtyRef.current = true; });
      yAxis.on('domainChanged', () => { viewport.setScales(xAxis.getScale(), yAxis.getScale()); dirtyRef.current = true; });

      const deck = new Deck({
        canvas: wc, width: w, height: h,
        views: [new OrthographicView({ id: 'ortho', controller: false, flipY: false })],
        viewState: buildViewState(xAxis, yAxis, viewport),
        layers: [],
        controller: false,
      });

      const axisRend = new AxisRenderer(ac, xAxis, yAxis, viewport);

      xAxisRef.current    = xAxis;
      yAxisRef.current    = yAxis;
      viewportRef.current = viewport;
      deckRef.current     = deck;
      axisRendRef.current = axisRend;

      // ── Waveform panel ──────────────────────────────────────────────────────
      const ww2 = waveWebglRef.current;
      const wa2 = waveAxisRef.current;
      const ww_w = ww2.offsetWidth  || 800;
      const ww_h = ww2.offsetHeight || 160;
      ww2.width = ww_w; ww2.height = ww_h;
      wa2.width = ww_w; wa2.height = ww_h;

      const waveViewport = new ViewportController();
      waveViewport.setCanvasSize(ww_w, ww_h);
      const { plotArea: wpa } = waveViewport;

      const waveXAxis = new AxisController({ axis: 'x', scaleType: 'linear', domain: [0, 1] });
      const waveYAxis = new AxisController({ axis: 'y', scaleType: 'linear', domain: [-1.1, 1.1] });
      waveXAxis.label = 'Time (s)';
      waveYAxis.label = 'Amplitude';
      waveXAxis.setRange([wpa.x, wpa.x + wpa.width]);
      waveYAxis.setRange([wpa.y + wpa.height, wpa.y]);
      waveViewport.setScales(waveXAxis.getScale(), waveYAxis.getScale());

      waveXAxis.on('domainChanged', () => { waveViewport.setScales(waveXAxis.getScale(), waveYAxis.getScale()); waveDirtyRef.current = true; });
      waveYAxis.on('domainChanged', () => { waveViewport.setScales(waveXAxis.getScale(), waveYAxis.getScale()); waveDirtyRef.current = true; });

      const waveDeck = new Deck({
        canvas: ww2, width: ww_w, height: ww_h,
        views: [new OrthographicView({ id: 'ortho', controller: false, flipY: false })],
        viewState: buildViewState(waveXAxis, waveYAxis, waveViewport),
        layers: [],
        controller: false,
      });

      const waveAxisRend = new AxisRenderer(wa2, waveXAxis, waveYAxis, waveViewport);

      waveXAxisRef.current    = waveXAxis;
      waveYAxisRef.current    = waveYAxis;
      waveViewportRef.current = waveViewport;
      waveDeckRef.current     = waveDeck;
      waveAxisRendRef.current = waveAxisRend;

      // ── Generate initial 5 s of audio ──────────────────────────────────────
      appendSamples(SAMPLE_RATE * 5);
      xAxis.setDomain([0, 5]);
      waveXAxis.setDomain([0, 5]);
      dirtyRef.current     = true;
      waveDirtyRef.current = true;

      // ── Wire LUT controller → colorTrigger ─────────────────────────────────
      const lc = lutControllerRef.current;
      lc.on('levelsChanged', () => setColorTrigger(prev => prev + 1));
      lc.on('lutChanged',    () => setColorTrigger(prev => prev + 1));

      // ── Wire PlaybackController → playState ────────────────────────────────
      const pb = playbackRef.current;
      pb.on('stateChanged', ({ state }) => setPlayState(state));

      // ── Start RAF loop and live-append interval ─────────────────────────────
      scheduleRender();
      intervalRef.current = setInterval(() => {
        appendSamples(Math.round(SAMPLE_RATE * APPEND_SECS));
      }, APPEND_MS);
    });

    // ── Spectrogram wheel + drag ────────────────────────────────────────────
    const onWheel = (e) => {
      e.preventDefault();
      const viewport = viewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, webglRef.current);
      if (!viewport.isInPlotArea(pos.x, pos.y)) return;
      const factor = (e.deltaY > 0) ? 0.85 : 1 / 0.85;
      xAxisRef.current?.zoomAround(factor, viewport.screenXToData(pos.x));
      yAxisRef.current?.zoomAround(factor, viewport.screenYToData(pos.y));
      dirtyRef.current = true;
    };

    const onMouseDown = (e) => {
      if (e.button !== 0) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, webglRef.current);
      if (!viewport.isInPlotArea(pos.x, pos.y)) return;
      // Ctrl+click → seek
      if (e.ctrlKey && playbackRef.current?.duration > 0) {
        playbackRef.current.seek(viewport.screenXToData(pos.x));
        dirtyRef.current     = true;
        waveDirtyRef.current = true;
        return;
      }
      panRef.current = {
        screenX: pos.x, screenY: pos.y,
        xDomain: xAxisRef.current?.getDomain(),
        yDomain: yAxisRef.current?.getDomain(),
      };
    };

    const onMouseMove = (e) => {
      const pan = panRef.current;
      if (!pan) return;
      const viewport = viewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, webglRef.current);
      const dx  = pos.x - pan.screenX;
      const dy  = pos.y - pan.screenY;
      xAxisRef.current?.setDomain(pan.xDomain);
      yAxisRef.current?.setDomain(pan.yDomain);
      xAxisRef.current?.panByPixels(dx);
      yAxisRef.current?.panByPixels(dy);
      dirtyRef.current = true;
    };

    const onMouseUp = () => { panRef.current = null; };

    // ── Waveform wheel + drag ───────────────────────────────────────────────
    const onWaveWheel = (e) => {
      e.preventDefault();
      const viewport = waveViewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, waveWebglRef.current);
      if (!viewport.isInPlotArea(pos.x, pos.y)) return;
      const factor = (e.deltaY > 0) ? 0.85 : 1 / 0.85;
      waveXAxisRef.current?.zoomAround(factor, viewport.screenXToData(pos.x));
      waveYAxisRef.current?.zoomAround(factor, viewport.screenYToData(pos.y));
      waveDirtyRef.current = true;
    };

    const onWaveMouseDown = (e) => {
      if (e.button !== 0) return;
      const viewport = waveViewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, waveWebglRef.current);
      if (!viewport.isInPlotArea(pos.x, pos.y)) return;
      // Ctrl+click → seek
      if (e.ctrlKey && playbackRef.current?.duration > 0) {
        playbackRef.current.seek(viewport.screenXToData(pos.x));
        dirtyRef.current     = true;
        waveDirtyRef.current = true;
        return;
      }
      wavePanRef.current = {
        screenX: pos.x, screenY: pos.y,
        xDomain: waveXAxisRef.current?.getDomain(),
        yDomain: waveYAxisRef.current?.getDomain(),
      };
    };

    const onWaveMouseMove = (e) => {
      const pan = wavePanRef.current;
      if (!pan) return;
      const viewport = waveViewportRef.current;
      if (!viewport) return;
      const pos = viewport.getCanvasPosition(e, waveWebglRef.current);
      const dx  = pos.x - pan.screenX;
      const dy  = pos.y - pan.screenY;
      waveXAxisRef.current?.setDomain(pan.xDomain);
      waveYAxisRef.current?.setDomain(pan.yDomain);
      waveXAxisRef.current?.panByPixels(dx);
      waveYAxisRef.current?.panByPixels(dy);
      waveDirtyRef.current = true;
    };

    const onWaveMouseUp = () => { wavePanRef.current = null; };

    // ── Resize ─────────────────────────────────────────────────────────────
    const onResize = () => {
      // Spectrogram panel
      const wc2 = webglRef.current;
      const ac2 = axisRef.current;
      if (wc2 && deckRef.current) {
        const w2 = wc2.offsetWidth, h2 = wc2.offsetHeight;
        if (w2 && h2) {
          wc2.width = w2; wc2.height = h2;
          ac2.width = w2; ac2.height = h2;
          deckRef.current.setProps({ width: w2, height: h2 });
          const vp = viewportRef.current;
          if (vp) {
            vp.setCanvasSize(w2, h2);
            const { plotArea: pa2 } = vp;
            xAxisRef.current?.setRange([pa2.x, pa2.x + pa2.width]);
            yAxisRef.current?.setRange([pa2.y + pa2.height, pa2.y]);
            vp.setScales(xAxisRef.current?.getScale(), yAxisRef.current?.getScale());
          }
          dirtyRef.current = true;
        }
      }
      // Waveform panel
      const ww3 = waveWebglRef.current;
      const wa3 = waveAxisRef.current;
      if (ww3 && waveDeckRef.current) {
        const ww_w2 = ww3.offsetWidth, ww_h2 = ww3.offsetHeight;
        if (ww_w2 && ww_h2) {
          ww3.width = ww_w2; ww3.height = ww_h2;
          wa3.width = ww_w2; wa3.height = ww_h2;
          waveDeckRef.current.setProps({ width: ww_w2, height: ww_h2 });
          const wvp = waveViewportRef.current;
          if (wvp) {
            wvp.setCanvasSize(ww_w2, ww_h2);
            const { plotArea: wpa2 } = wvp;
            waveXAxisRef.current?.setRange([wpa2.x, wpa2.x + wpa2.width]);
            waveYAxisRef.current?.setRange([wpa2.y + wpa2.height, wpa2.y]);
            wvp.setScales(waveXAxisRef.current?.getScale(), waveYAxisRef.current?.getScale());
          }
          waveDirtyRef.current = true;
        }
      }
    };

    // ── Attach listeners ────────────────────────────────────────────────────
    wc.addEventListener('wheel',     onWheel,         { passive: false });
    wc.addEventListener('mousedown', onMouseDown);
    wc.addEventListener('mousemove', onMouseMove);
    wc.addEventListener('mouseup',   onMouseUp);
    ww.addEventListener('wheel',     onWaveWheel,     { passive: false });
    ww.addEventListener('mousedown', onWaveMouseDown);
    ww.addEventListener('mousemove', onWaveMouseMove);
    ww.addEventListener('mouseup',   onWaveMouseUp);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(initRaf);
      cancelAnimationFrame(rafRef.current);
      clearInterval(intervalRef.current);
      wc.removeEventListener('wheel',     onWheel);
      wc.removeEventListener('mousedown', onMouseDown);
      wc.removeEventListener('mousemove', onMouseMove);
      wc.removeEventListener('mouseup',   onMouseUp);
      ww.removeEventListener('wheel',     onWaveWheel);
      ww.removeEventListener('mousedown', onWaveMouseDown);
      ww.removeEventListener('mousemove', onWaveMouseMove);
      ww.removeEventListener('mouseup',   onWaveMouseUp);
      window.removeEventListener('resize', onResize);
      deckRef.current?.finalize();
      waveDeckRef.current?.finalize();
      playbackRef.current?.destroy();
    };
  }, []); // mount once

  // ── Sync colorTrigger state → ref (RAF closure reads ref to avoid stale values) ──
  useEffect(() => {
    colorTriggerRef.current = colorTrigger;
    dirtyRef.current = true;
  }, [colorTrigger]);

  // ── Apply time window immediately when dropdown changes ──────────────────────
  useEffect(() => {
    if (!xAxisRef.current || !samplesRef.current.length) return;
    const sr = loadedSampleRateRef.current;

    if (timeWindow) {
      // Trim PCM to last timeWindow seconds
      const maxSamples = Math.floor(timeWindow * sr);
      if (samplesRef.current.length > maxSamples) {
        samplesRef.current = samplesRef.current.slice(samplesRef.current.length - maxSamples);
        dataTriggerRef.current += 1;
      }
      // Trim + rebase waveform
      const maxWavePts = Math.ceil(timeWindow * sr / WAVEFORM_STEP);
      if (waveYRef.current.length > maxWavePts) {
        const trimY = waveYRef.current.slice(waveYRef.current.length - maxWavePts);
        const trimX = new Float32Array(maxWavePts);
        const xStep = WAVEFORM_STEP / sr;
        for (let i = 0; i < maxWavePts; i++) trimX[i] = i * xStep;
        waveXRef.current = trimX;
        waveYRef.current = trimY;
        waveDataTrigger.current += 1;
      }
    }

    const bufferSecs = samplesRef.current.length / sr;
    xAxisRef.current?.setDomain([0, bufferSecs]);
    waveXAxisRef.current?.setDomain([0, bufferSecs]);
    dirtyRef.current     = true;
    waveDirtyRef.current = true;
  }, [timeWindow]);

  // ── UI handlers ───────────────────────────────────────────────────────────

  const handleLiveAppendChange = (e) => {
    const checked = e.target.checked;
    if (checked) {
      intervalRef.current = setInterval(() => {
        appendSamples(Math.round(SAMPLE_RATE * APPEND_SECS));
      }, APPEND_MS);
    } else {
      clearInterval(intervalRef.current);
    }
    setLiveAppend(checked);
  };

  const handleTimeWindowChange = (e) => {
    const v = e.target.value === 'all' ? null : Number(e.target.value);
    timeWindowRef.current = v;
    setTimeWindow(v);
  };

  const handleWindowSizeChange = (e) => {
    const v = parseInt(e.target.value, 10);
    windowSizeRef.current = v;
    dataTriggerRef.current += 1;
    setWindowSize(v);
    dirtyRef.current = true;
  };

  const handleFileLoad = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    clearInterval(intervalRef.current);
    setLiveAppend(false);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const audioCtx    = new AudioContext();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      audioCtx.close();
      const pcm = audioBuffer.getChannelData(0);
      const sr  = audioBuffer.sampleRate;
      loadedSampleRateRef.current = sr;
      // Clear all existing data
      lutControllerRef.current.reset();
      samplesRef.current   = new Float32Array(0);
      sampleCntRef.current = 0;
      waveXRef.current     = new Float32Array(0);
      waveYRef.current     = new Float32Array(0);
      // Load PCM
      samplesRef.current   = pcm;
      sampleCntRef.current = pcm.length;
      originalSamplesRef.current = samplesRef.current.slice();  // snapshot for "Clear Filter"
      setFilterSampleRate(sr);
      dataTriggerRef.current += 1;
      // Downsample for waveform
      const numWavePts = Math.floor(pcm.length / WAVEFORM_STEP);
      const newWX = new Float32Array(numWavePts);
      const newWY = new Float32Array(numWavePts);
      for (let i = 0; i < numWavePts; i++) {
        newWX[i] = (i * WAVEFORM_STEP) / sr;
        newWY[i] = pcm[i * WAVEFORM_STEP];
      }
      waveXRef.current = newWX;
      waveYRef.current = newWY;
      waveDataTrigger.current += 1;
      const durationSecs = pcm.length / sr;
      xAxisRef.current?.setDomain([0, durationSecs]);
      waveXAxisRef.current?.setDomain([0, durationSecs]);
      yAxisRef.current?.setDomain([0, sr / 2]);   // Nyquist for this file
      dirtyRef.current     = true;
      waveDirtyRef.current = true;
      addLog(`Loaded: ${file.name}  ·  ${sr} Hz  ·  ${durationSecs.toFixed(2)}s`);
      // Load into playback controller (non-blocking — await is fine here since we're already async)
      await playbackRef.current.loadBuffer(samplesRef.current, loadedSampleRateRef.current);
    } catch (err) {
      addLog(`Error loading file: ${err.message}`);
    }
    setLoading(false);
    e.target.value = '';  // allow re-loading same file
  };

  // ── Filter handlers ───────────────────────────────────────────────────────

  const handleApplyFilter = async () => {
    if (!samplesRef.current.length) return;
    setApplying(true);
    try {
      const fc       = filterControllerRef.current;
      const filtered = await fc.applyToSamples(samplesRef.current, loadedSampleRateRef.current);
      samplesRef.current = filtered;
      dataTriggerRef.current += 1;
      dirtyRef.current = true;
      // If playback is loaded, reload with filtered audio
      if (playbackRef.current?.duration > 0) {
        await playbackRef.current.loadBuffer(filtered, loadedSampleRateRef.current);
      }
      addLog(`Filter: ${fc.state.type}  cutoff=${fc.state.frequency.toFixed(0)} Hz  Q=${fc.state.Q.toFixed(2)}`);
    } catch (err) {
      addLog(`Filter error: ${err.message}`);
    }
    setApplying(false);
  };

  const handleClearFilter = async () => {
    if (!originalSamplesRef.current) return;
    samplesRef.current = originalSamplesRef.current.slice();
    dataTriggerRef.current += 1;
    dirtyRef.current = true;
    if (playbackRef.current?.duration > 0) {
      await playbackRef.current.loadBuffer(samplesRef.current, loadedSampleRateRef.current);
    }
    addLog('Filter cleared — original audio restored');
  };

  // ── Styles ────────────────────────────────────────────────────────────────

  const containerStyle = {
    display: 'flex', flexDirection: 'column',
    width: '100vw', height: '100vh',
    background: '#0d0d0d', color: '#ccc', fontFamily: 'monospace',
  };
  const headerStyle = {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '6px 16px', background: '#151515',
    borderBottom: '1px solid #333', fontSize: 12, flexShrink: 0,
  };
  const plotWrapStyle = {
    flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden',
  };
  const panelStyle = { position: 'relative', overflow: 'hidden' };
  const canvasStyle = { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' };
  const dividerStyle = { height: 1, background: '#333', flexShrink: 0 };
  const logPanelStyle = {
    height: 100, background: '#0a0a0a', borderTop: '1px solid #222',
    overflowY: 'auto', padding: '4px 12px', fontSize: 11, flexShrink: 0,
  };
  const checkboxLabelStyle = {
    display: 'flex', alignItems: 'center', gap: 5,
    color: '#888', cursor: 'pointer', userSelect: 'none',
  };
  const selectStyle = {
    background: '#222', border: '1px solid #444', borderRadius: 3,
    color: '#ccc', padding: '2px 6px', fontSize: 12, marginLeft: 4,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <strong style={{ color: '#fff', fontSize: 14 }}>MasterPlot — Spectrogram</strong>
        <span style={{ color: '#555' }}>|</span>

        <span style={{ color: '#888' }}>chirp 440→4400 Hz + pink noise · 44100 Hz</span>

        <label style={checkboxLabelStyle}>
          Window
          <select value={windowSize} onChange={handleWindowSizeChange} style={selectStyle}>
            {[256, 512, 1024, 2048].map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </label>

        <label style={checkboxLabelStyle}>
          Time window
          <select value={timeWindow ?? 'all'} onChange={handleTimeWindowChange} style={selectStyle}>
            <option value="all">All</option>
            <option value="5">5 s</option>
            <option value="10">10 s</option>
            <option value="30">30 s</option>
            <option value="60">60 s</option>
          </select>
        </label>

        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={liveAppend} onChange={handleLiveAppendChange} />
          Live append
        </label>

        <label style={checkboxLabelStyle}>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={loading}
            style={{
              background: '#222', border: '1px solid #555', borderRadius: 3,
              color: loading ? '#555' : '#adf', padding: '2px 8px',
              fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'monospace',
            }}
          >
            {loading ? 'Loading…' : 'Open audio file'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            style={{ display: 'none' }}
            onChange={handleFileLoad}
          />
        </label>

        {/* Clear Filter button */}
        <button
          onClick={handleClearFilter}
          disabled={!originalSamplesRef.current}
          style={{
            background: '#222', border: '1px solid #555', borderRadius: 3,
            color: originalSamplesRef.current ? '#fa8' : '#555',
            padding: '2px 8px', fontSize: 12, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          Clear Filter
        </button>

        {/* Playback controls */}
        <button
          onClick={() => {
            const pb = playbackRef.current;
            if (!pb?.duration) return;
            if (playState === 'playing') pb.pause();
            else pb.play();
          }}
          disabled={!playbackRef.current?.duration}
          style={{
            background: '#222', border: '1px solid #555', borderRadius: 3,
            color: playbackRef.current?.duration ? '#adf' : '#555',
            padding: '2px 10px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          {playState === 'playing' ? '\u23F8' : '\u25B6'}
        </button>
        <button
          onClick={() => playbackRef.current?.stop()}
          disabled={playState === 'stopped'}
          style={{
            background: '#222', border: '1px solid #555', borderRadius: 3,
            color: playState !== 'stopped' ? '#faa' : '#555',
            padding: '2px 8px', fontSize: 13, cursor: 'pointer', fontFamily: 'monospace',
          }}
        >
          {'\u23F9'}
        </button>

        <span style={{ marginLeft: 'auto', color: '#666' }}>
          scroll=zoom · drag=pan · ctrl+click=seek
        </span>
      </div>

      <div style={plotWrapStyle}>
        {/* Spectrogram row: plot canvas + right sidebar (LUT + Filter) side-by-side */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          <div style={{ ...panelStyle, flex: 1 }}>
            <canvas ref={webglRef} style={canvasStyle} />
            <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
          </div>
          {/* Right sidebar: LUT panel + Filter panel, vertically stacked */}
          <div style={{ width: 140, display: 'flex', flexDirection: 'column', borderLeft: '1px solid #333', flexShrink: 0 }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <HistogramLUTPanel controller={lutControllerRef.current} />
            </div>
            <FilterPanel
              controller={filterControllerRef.current}
              sampleRate={filterSampleRate}
              onApply={handleApplyFilter}
              applying={applying}
            />
          </div>
        </div>

        <div style={dividerStyle} />

        {/* Waveform panel — unchanged */}
        <div style={{ ...panelStyle, flex: 1.5 }}>
          <canvas ref={waveWebglRef} style={canvasStyle} />
          <canvas ref={waveAxisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
        </div>
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
