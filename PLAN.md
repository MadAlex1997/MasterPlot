# MasterPlot Implementation Plan

**Plan Version:** 2.5
**Last Updated:** 2026-02-22
**Status:** F12, F13 COMPLETED — no pending steps

---

## Instructions for Agents

This document tracks the multi-step implementation of MasterPlot. Each step has a status indicator:

- **[PENDING]** — Not started
- **[IN_PROGRESS]** — Currently being worked on
- **[COMPLETED]** — Finished and verified
- **[BLOCKED]** — Cannot proceed (waiting on dependency or clarification)
- **[REGRESSED]** — Previously completed, now broken (needs action)

### Protocol for Agents

1. **Before Starting**: Mark the step you're working on as `[IN_PROGRESS]`
2. **When Making Changes**:
   - Update status of affected steps
   - Add a timestamp and brief note explaining the change
   - If deviating from plan or discovering new requirements → **STOP and ask for clarification**
3. **When Completing**: Mark step as `[COMPLETED]` and verify dependencies
4. **If Something Breaks**: Mark the affected step as `[REGRESSED]` and document the issue
5. **On Handoff**: Clearly mark next step for the following agent
6. **After every completed feature**: Update `README.md` to reflect new capabilities **and** update `HubPage.jsx` so the new demo/example is linked from the hub. GitHub Actions deploys from `main` — a merged PR or push to `main` is sufficient to update https://madalex1997.github.io/MasterPlot/. Do NOT mark a feature `[COMPLETED]` without completing this step.

---

## F10 [COMPLETED] Feature: Audio file loading in SpectrogramExample

**File:** `examples/SpectrogramExample.jsx` (only file changed — no webpack changes needed)

**Behaviour:**
- Add an **"Open audio file"** button in the header that triggers a hidden `<input type="file" accept="audio/*">`. The browser's native file picker lets the user navigate to the `sounds/` folder and select a file.
- Supported formats: anything the browser's `AudioContext.decodeAudioData` can decode (WAV, MP3, OGG, FLAC, etc.).
- On file select:
  1. Stop live-append (clear interval, uncheck checkbox).
  2. Decode audio via `AudioContext.decodeAudioData` — uses the file's actual `sampleRate` (may differ from 44100).
  3. Clear all existing sample + waveform data.
  4. Load decoded PCM (`audioBuffer.getChannelData(0)`) directly into `samplesRef`.
  5. Downsample for waveform using the same `WAVEFORM_STEP = 50` logic as `appendSamples`.
  6. Update both x-axis domains to `[0, durationSecs]` and spectrogram y-axis to `[0, sr / 2]`.
  7. Trigger dirty flags on both panels.
  8. Log: `Loaded: <filename>  ·  <sr> Hz  ·  <dur>s`
- While decoding, button shows "Loading…" and is disabled.
- After load, clicking "Open audio file" again clears old data and loads the new file.

**New refs and state:**
```js
const fileInputRef        = useRef(null);
const loadedSampleRateRef = useRef(SAMPLE_RATE);  // actual sr of loaded audio
const [loading, setLoading] = useState(false);
```

**`handleFileLoad` async function** (add after `handleWindowSizeChange`):
```js
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
    samplesRef.current   = new Float32Array(0);
    sampleCntRef.current = 0;
    waveXRef.current     = new Float32Array(0);
    waveYRef.current     = new Float32Array(0);
    // Load PCM
    samplesRef.current   = pcm;
    sampleCntRef.current = pcm.length;
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
  } catch (err) {
    addLog(`Error loading file: ${err.message}`);
  }
  setLoading(false);
  e.target.value = '';  // allow re-loading same file
};
```

**Fix `renderFrame`** — replace hardcoded `SAMPLE_RATE` with ref so it matches loaded audio:
```js
// BEFORE:
sampleRate:  SAMPLE_RATE,
// AFTER:
sampleRate:  loadedSampleRateRef.current,
```

**JSX header** — add after the "Live append" label:
```jsx
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
```

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Click "Open audio file" → navigate to `sounds/07069030.wav` → Open.
- Chirp + noise data clears immediately; spectrogram fills with real audio STFT.
- Waveform panel shows decoded PCM shape.
- X-axis domain matches file duration; y-axis Nyquist matches file's sample rate.
- Live append checkbox is unchecked; no new data added.
- Log shows `Loaded: 07069030.wav · <sr> Hz · <dur>s`.
- Re-loading the same file or a different file works correctly.

---

## F11 [COMPLETED] Feature: HistogramLUTItem — interactive amplitude remapping for spectrogram

**Branch:** `feature/F11` (create before starting)

**Goal:** Add a pyqtgraph-style HistogramLUTItem as an independent, optional panel that can be attached to the spectrogram. It shows the dB amplitude histogram, provides draggable level_min/level_max handles for contrast windowing, and supports swappable LUT colormaps. `SpectrogramLayer` must still work standalone (no lutController).

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/plot/layers/HistogramLUTController.js` | **Create new** |
| `src/components/HistogramLUTPanel.jsx` | **Create new** |
| `src/plot/layers/SpectrogramLayer.js` | **Modify** — add caching + lutController integration |
| `examples/SpectrogramExample.jsx` | **Modify** — wire panel + colorTrigger |

---

### A. Create `src/plot/layers/HistogramLUTController.js`

Pure JS EventEmitter (import EventEmitter from `'events'` — already used elsewhere in the project). No React.

```javascript
import EventEmitter from 'events';

// LUT preset control points: [t, r, g, b] each, t in [0,1]
const LUT_PRESETS = {
  viridis:  [[0,68,1,84],[1/15,72,25,107],[2/15,64,47,124],[3/15,55,68,134],
             [4/15,45,88,140],[5/15,38,107,143],[6/15,33,126,145],[7/15,30,145,146],
             [8/15,32,163,144],[9/15,47,181,138],[10/15,73,198,128],[11/15,106,214,114],
             [12/15,145,228,97],[13/15,185,240,74],[14/15,223,249,47],[1,253,231,37]],
  grayscale:[[0,0,0,0],[1,255,255,255]],
  plasma:   [[0,13,8,135],[0.25,126,3,168],[0.5,204,71,120],[0.75,248,150,64],[1,240,249,33]],
  inferno:  [[0,0,0,4],[0.25,87,16,110],[0.5,188,55,84],[0.75,249,142,9],[1,252,255,164]],
  magma:    [[0,0,0,4],[0.25,79,18,123],[0.5,183,55,121],[0.75,251,136,97],[1,252,253,191]],
  hot:      [[0,0,0,0],[0.33,255,0,0],[0.67,255,255,0],[1,255,255,255]],
};

function buildLUT(stops) {
  // Interpolates control points into Uint8Array[256 * 4] (RGBA)
  const lut = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    // find adjacent stops
    let s0 = stops[0], s1 = stops[1];
    for (let j = 0; j < stops.length - 1; j++) {
      if (t >= stops[j][0] && t <= stops[j+1][0]) { s0 = stops[j]; s1 = stops[j+1]; break; }
    }
    const f = s1[0] === s0[0] ? 0 : (t - s0[0]) / (s1[0] - s0[0]);
    lut[i*4]   = Math.round(s0[1] + f*(s1[1]-s0[1]));
    lut[i*4+1] = Math.round(s0[2] + f*(s1[2]-s0[2]));
    lut[i*4+2] = Math.round(s0[3] + f*(s1[3]-s0[3]));
    lut[i*4+3] = 255;
  }
  return lut;
}

export class HistogramLUTController extends EventEmitter {
  constructor(binCount = 256) {
    super();
    this._binCount    = binCount;
    this._power       = null;   // Float32Array of dB values (flat, frames×bins)
    this._isFirstData = true;
    this.state = {
      level_min:      -100,
      level_max:      0,
      lut:            buildLUT(LUT_PRESETS.viridis),
      lutName:        'viridis',
      histogramBins:  null,    // Float32Array[binCount] raw counts
      histogramEdges: null,    // Float32Array[binCount+1] bin boundaries
      globalMin:      -100,
      globalMax:      0,
    };
  }

  /** Called by SpectrogramLayer.updateState() after each STFT. Synchronous. */
  setSpectrogramData(power, globalMin, globalMax) {
    this._power = power;
    this.state.globalMin = globalMin;
    this.state.globalMax = globalMax;
    this._computeHistogram();
    this.emit('histogramReady', {
      bins:      this.state.histogramBins,
      edges:     this.state.histogramEdges,
      globalMin, globalMax,
    });
    if (this._isFirstData) {
      this._isFirstData = false;
      // autoLevel emits levelsChanged — that's OK on first data
      this.autoLevel();
    }
  }

  _computeHistogram() {
    const { globalMin, globalMax } = this.state;
    const power    = this._power;
    const n        = this._binCount;
    const range    = (globalMax - globalMin) || 1;
    const bins     = new Float32Array(n);
    const edges    = new Float32Array(n + 1);
    for (let i = 0; i <= n; i++) edges[i] = globalMin + (i / n) * range;
    for (let i = 0; i < power.length; i++) {
      const idx = Math.min(n - 1, Math.floor((power[i] - globalMin) / range * n));
      if (idx >= 0) bins[idx]++;
    }
    this.state.histogramBins  = bins;
    this.state.histogramEdges = edges;
  }

  setLevels(min, max) {
    this.state.level_min = min;
    this.state.level_max = max;
    this.emit('levelsChanged', min, max);
  }

  setLUT(presetName) {
    const stops = LUT_PRESETS[presetName];
    if (!stops) return;
    this.state.lut     = buildLUT(stops);
    this.state.lutName = presetName;
    this.emit('lutChanged', presetName);
  }

  autoLevel(loPct = 5, hiPct = 99.5) {
    const { histogramBins, histogramEdges } = this.state;
    if (!histogramBins) return;
    const total    = histogramBins.reduce((a, b) => a + b, 0);
    if (total === 0) return;
    const loTarget = total * loPct / 100;
    const hiTarget = total * hiPct / 100;
    let cumsum = 0, level_min = histogramEdges[0], level_max = histogramEdges[histogramEdges.length - 1];
    let minSet = false;
    for (let i = 0; i < histogramBins.length; i++) {
      cumsum += histogramBins[i];
      if (!minSet && cumsum >= loTarget) { level_min = histogramEdges[i]; minSet = true; }
      if (cumsum >= hiTarget)            { level_max = histogramEdges[i + 1]; break; }
    }
    this.setLevels(level_min, level_max);
  }

  getLUTArray() { return this.state.lut; }

  reset() { this._isFirstData = true; this._power = null; }

  static get presetNames() { return Object.keys(LUT_PRESETS); }
}
```

---

### B. Modify `src/plot/layers/SpectrogramLayer.js`

**New defaultProps to add:**
```javascript
lutController: { type: 'object', value: null },
colorTrigger:  { type: 'number', value: 0    },
```

**Add deck.gl lifecycle methods for STFT caching:**

```javascript
initializeState() {
  this.setState({ stftResult: null, image: null });
}

updateState({ props, oldProps }) {
  const dataChanged  = props.dataTrigger  !== oldProps.dataTrigger;
  const colorChanged = props.colorTrigger !== oldProps.colorTrigger;

  let stftResult = this.state.stftResult;

  // Recompute STFT only when data changes (or first render)
  if (dataChanged || !stftResult) {
    const { samples, windowSize, hopSize } = props;
    if (samples && samples.length >= windowSize) {
      stftResult = computeSTFT(samples, windowSize, hopSize || windowSize / 2);
      this.setState({ stftResult });
      if (props.lutController && stftResult) {
        // Synchronous: sets controller levels/histogram before buildImage below
        props.lutController.setSpectrogramData(
          stftResult.power, stftResult.globalMin, stftResult.globalMax
        );
      }
    }
  }

  // Rebuild image when data OR color changes
  if ((dataChanged || colorChanged) && stftResult) {
    const lc       = props.lutController;
    const levelMin = lc ? lc.state.level_min : stftResult.globalMin;
    const levelMax = lc ? lc.state.level_max : stftResult.globalMax;
    const lut      = lc ? lc.getLUTArray()   : null;  // null → viridis fallback

    const image = buildImage(
      stftResult.power, stftResult.numFrames, stftResult.numBins,
      levelMin, levelMax, lut
    );
    this.setState({ image });
  }
}
```

**Modify `buildImage` signature and body:**

Old: `function buildImage(power, numFrames, numBins, globalMin, globalMax)`
New: `function buildImage(power, numFrames, numBins, levelMin, levelMax, lut = null)`

Inside the pixel loop replace:
```javascript
// OLD:
const t = Math.max(0, Math.min(1, (db - globalMin) / range));
const c = viridisColor(t);
// ... d[idx] = c[0]; d[idx+1] = c[1]; d[idx+2] = c[2];

// NEW:
const range = (levelMax - levelMin) || 1;
const t = Math.max(0, Math.min(1, (db - levelMin) / range));
let r, g, b;
if (lut) {
  const li = Math.min(255, Math.floor(t * 255)) * 4;
  r = lut[li]; g = lut[li+1]; b = lut[li+2];
} else {
  [r, g, b] = viridisColor(t);  // standalone fallback
}
// ... d[idx] = r; d[idx+1] = g; d[idx+2] = b;
```

Note: move `const range = ...` inside the loop or before it (currently it's computed outside; keep consistent).

**Simplify `renderLayers()`** — reads from state only, no computation:
```javascript
renderLayers() {
  const { samples, sampleRate, windowSize, dataTrigger, colorTrigger } = this.props;
  const { image } = this.state;
  if (!image || !samples) return [];
  return [
    new BitmapLayer(this.getSubLayerProps({
      id:    'bitmap',
      image,
      bounds: [0, 0, samples.length / sampleRate, sampleRate / 2],
      updateTriggers: { image: [dataTrigger, colorTrigger] },
    })),
  ];
}
```

Keep `VIRIDIS` array and `viridisColor()` — used as standalone fallback.

---

### C. Create `src/components/HistogramLUTPanel.jsx`

React component. `import React, { useRef, useEffect, useState } from 'react';`

**Props:** `{ controller, width = 140 }` — height is CSS 100% (fills parent flex container).

**Internal React state (UI display only):**
```javascript
const [levels,    setLevels]    = useState({ min: -100, max: 0 });
const [preset,    setPreset]    = useState('viridis');
const [histState, setHistState] = useState(null); // { bins, edges, globalMin, globalMax }
```

**Wire controller events in `useEffect`:**
```javascript
useEffect(() => {
  const onLevels = (min, max) => setLevels({ min, max });
  const onLUT    = (name)     => setPreset(name);
  const onHist   = (data)     => setHistState(data);
  controller.on('levelsChanged',  onLevels);
  controller.on('lutChanged',     onLUT);
  controller.on('histogramReady', onHist);
  return () => {
    controller.off('levelsChanged',  onLevels);
    controller.off('lutChanged',     onLUT);
    controller.off('histogramReady', onHist);
  };
}, [controller]);
```

**Canvas redraw `useEffect`** (depends on `[levels, histState, preset, controller]`):
```javascript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  const GRAD_W = 18;  // rightmost px for gradient strip
  const HIST_W = W - GRAD_W - 4;

  // 1. Draw histogram bars
  if (histState) {
    const { bins, globalMin, globalMax } = histState;
    const maxCount = Math.max(...bins, 1);
    const binH = H / bins.length;
    ctx.fillStyle = 'rgba(80,150,200,0.55)';
    for (let i = 0; i < bins.length; i++) {
      const barW = (bins[i] / maxCount) * HIST_W;
      // bin 0 = globalMin (bottom), bin N = globalMax (top) → invert Y
      const y = H - (i + 1) / bins.length * H;
      ctx.fillRect(0, y, barW, binH + 0.5);
    }
  }

  // 2. Draw LUT gradient strip (right column)
  const lut = controller.getLUTArray();
  for (let py = 0; py < H; py++) {
    const t  = 1 - py / H;  // t=1 at top, t=0 at bottom
    const li = Math.min(255, Math.floor(t * 255)) * 4;
    ctx.fillStyle = `rgb(${lut[li]},${lut[li+1]},${lut[li+2]})`;
    ctx.fillRect(W - GRAD_W, py, GRAD_W, 1);
  }

  // 3. Draw level lines
  if (histState) {
    const { globalMin, globalMax } = histState;
    const range = (globalMax - globalMin) || 1;
    const minY = H - ((levels.min - globalMin) / range) * H;
    const maxY = H - ((levels.max - globalMin) / range) * H;
    // level_min line (cyan)
    ctx.strokeStyle = '#0ff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, minY); ctx.lineTo(W - GRAD_W, minY); ctx.stroke();
    // level_max line (yellow)
    ctx.strokeStyle = '#ff0'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(0, maxY); ctx.lineTo(W - GRAD_W, maxY); ctx.stroke();
  }
}, [levels, histState, preset, controller]);
```

**Resize canvas to match DOM in `useEffect` (runs once after mount):**
```javascript
useEffect(() => {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ro = new ResizeObserver(() => {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    // trigger redraw by nudging state
    setLevels(l => ({ ...l }));
  });
  ro.observe(canvas);
  return () => ro.disconnect();
}, []);
```

**Drag interaction — attach to canvas element:**
```javascript
const dragRef = useRef(null);  // 'min' | 'max' | null

const onMouseDown = (e) => {
  if (!histState) return;
  const { globalMin, globalMax } = histState;
  const canvas = canvasRef.current;
  const H = canvas.offsetHeight;
  const range = (globalMax - globalMin) || 1;
  const minY = H - ((levels.min - globalMin) / range) * H;
  const maxY = H - ((levels.max - globalMin) / range) * H;
  const y = e.nativeEvent.offsetY;
  if (Math.abs(y - minY) < 8) dragRef.current = 'min';
  else if (Math.abs(y - maxY) < 8) dragRef.current = 'max';
};

const onMouseMove = (e) => {
  if (!dragRef.current || !histState) return;
  const { globalMin, globalMax } = histState;
  const H = canvasRef.current.offsetHeight;
  const amp = globalMin + (1 - e.nativeEvent.offsetY / H) * ((globalMax - globalMin) || 1);
  if (dragRef.current === 'min') {
    controller.setLevels(Math.min(amp, levels.max - 0.5), levels.max);
  } else {
    controller.setLevels(levels.min, Math.max(amp, levels.min + 0.5));
  }
};

const onMouseUp = () => { dragRef.current = null; };
```

**JSX return:**
```jsx
return (
  <div style={{
    width, display: 'flex', flexDirection: 'column',
    background: '#0a0a0a', borderLeft: '1px solid #333',
    fontFamily: 'monospace', fontSize: 11, color: '#888', flexShrink: 0,
  }}>
    <canvas
      ref={canvasRef}
      style={{ flex: 1, width: '100%', cursor: 'ns-resize' }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
    <div style={{ padding: '4px 6px', borderTop: '1px solid #222' }}>
      <select
        value={preset}
        onChange={e => controller.setLUT(e.target.value)}
        style={{ width: '100%', background: '#1a1a1a', border: '1px solid #444',
                 color: '#aaa', padding: '2px 4px', fontSize: 11 }}
      >
        {HistogramLUTController.presetNames.map(n => (
          <option key={n} value={n}>{n}</option>
        ))}
      </select>
      <button
        onClick={() => controller.autoLevel()}
        style={{ marginTop: 4, width: '100%', background: '#1a1a1a',
                 border: '1px solid #444', color: '#adf', padding: '3px',
                 fontSize: 11, cursor: 'pointer', fontFamily: 'monospace' }}
      >
        Auto Level
      </button>
      <div style={{ marginTop: 4, color: '#555', fontSize: 10 }}>
        min: {levels.min.toFixed(1)}<br/>
        max: {levels.max.toFixed(1)}
      </div>
    </div>
  </div>
);
```

Import `HistogramLUTController` at the top of this file for `presetNames` access.

---

### D. Modify `examples/SpectrogramExample.jsx`

**Imports to add (top of file):**
```javascript
import { HistogramLUTController } from '../src/plot/layers/HistogramLUTController.js';
import HistogramLUTPanel from '../src/components/HistogramLUTPanel.jsx';
```

**New refs/state (alongside existing `const [log, ...`  declarations):**
```javascript
const lutControllerRef  = useRef(null);
const colorTriggerRef   = useRef(0);
const [colorTrigger, setColorTrigger] = useState(0);
// Initialize controller once
if (!lutControllerRef.current) {
  lutControllerRef.current = new HistogramLUTController();
}
```

**Wire controller events — add inside the existing big `useEffect` (before the final `scheduleRender()` call):**
```javascript
const lc = lutControllerRef.current;
lc.on('levelsChanged', () => setColorTrigger(prev => prev + 1));
lc.on('lutChanged',    () => setColorTrigger(prev => prev + 1));
```

**Sync colorTrigger ref** — add a separate tiny `useEffect`:
```javascript
useEffect(() => {
  colorTriggerRef.current = colorTrigger;
  dirtyRef.current = true;
}, [colorTrigger]);
```

**Update `renderFrame`** — pass new props:
```javascript
new SpectrogramLayer({
  id:           'spectrogram',
  samples:      samplesRef.current,
  sampleRate:   loadedSampleRateRef.current,
  windowSize:   windowSizeRef.current,
  hopSize:      windowSizeRef.current / 2,
  dataTrigger:  dataTriggerRef.current,
  lutController: lutControllerRef.current,   // ← add
  colorTrigger:  colorTriggerRef.current,    // ← add (read from ref, not state)
})
```

**Reset controller on file load** — add inside `handleFileLoad` after clearing sample data:
```javascript
lutControllerRef.current.reset();
```

**Layout JSX change** — wrap spectrogram panel in a row flex div with LUT panel beside it:

Old:
```jsx
<div style={plotWrapStyle}>
  {/* Spectrogram panel — 65% */}
  <div style={{ ...panelStyle, flex: 3 }}>
    <canvas ref={webglRef} style={canvasStyle} />
    <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
  </div>

  <div style={dividerStyle} />

  {/* Waveform panel — 35% */}
  <div style={{ ...panelStyle, flex: 1.5 }}>
    ...
  </div>
</div>
```

New:
```jsx
<div style={plotWrapStyle}>
  {/* Spectrogram row: canvas + LUT panel side-by-side */}
  <div style={{ flex: 3, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
    <div style={{ ...panelStyle, flex: 1 }}>
      <canvas ref={webglRef} style={canvasStyle} />
      <canvas ref={axisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
    </div>
    <HistogramLUTPanel controller={lutControllerRef.current} width={140} />
  </div>

  <div style={dividerStyle} />

  {/* Waveform panel — unchanged */}
  <div style={{ ...panelStyle, flex: 1.5 }}>
    <canvas ref={waveWebglRef} style={canvasStyle} />
    <canvas ref={waveAxisRef}  style={{ ...canvasStyle, pointerEvents: 'none' }} />
  </div>
</div>
```

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Open `dist/spectrogram.html`
3. Chirp loads → spectrogram renders → LUT panel visible at right with histogram bars
4. Drag level handles → spectrogram recolors immediately (no STFT lag)
5. Change LUT preset dropdown → spectrogram recolors
6. Click Auto Level → handles snap to 5%–99.5% percentile positions
7. Open audio file → histogram refreshes, controller resets, spectrogram redraws
8. Temporarily remove `lutController` + `colorTrigger` props from `renderFrame` → spectrogram still renders with default Viridis (standalone mode)

### Edge cases to watch

- **First render**: `updateState` gets `oldProps.dataTrigger === 0` same as `props.dataTrigger === 0` → `dataChanged = false`. The `!stftResult` guard handles first call.
- **`colorTrigger` in RAF closure**: `renderFrame` reads from `colorTriggerRef.current` (not the closed-over React state value) to avoid stale closure values.
- **`setSpectrogramData` + autoLevel double-build**: On first data, `autoLevel` emits `levelsChanged` → React increments `colorTrigger` → second `updateState` → second `buildImage` with same values. Acceptable; can suppress by checking if levels actually changed.
- **Canvas width shrinks 140px**: Deck reads `wc.offsetWidth` at mount so it adapts automatically.

---

## F12 [COMPLETED] Feature: Audio Playback + Synchronized Playhead Lines

**Branch:** `feature/F12` (create before starting)
<!-- Started: 2026-02-22 · Completed: 2026-02-22 -->
<!-- Created src/audio/PlaybackController.js; modified SpectrogramExample.jsx: added drawPlayhead helpers, playbackRef, playState, stateChanged wiring, loadBuffer on file load, playhead RAF loop, Ctrl+click seek, Play/Pause/Stop header controls. Build: 0 errors. -->

**Goal:** Enable playback of loaded audio (or the live-append chirp) via Web Audio API with a dashed vertical playhead line that moves in real-time at 60 fps across both the spectrogram and the waveform panel. Ctrl+click on either panel seeks to that time. Play/Pause/Stop controls appear in the header.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/audio/PlaybackController.js` | **Create new** |
| `examples/SpectrogramExample.jsx` | **Modify** — add controller, RAF changes, controls, Ctrl+seek |

---

### A. Create `src/audio/PlaybackController.js`

Pure JS EventEmitter. Manages a single `AudioBufferSourceNode` lifecycle (play/pause/stop/seek). `AudioBufferSourceNode` is one-shot and cannot be paused, so pause is implemented by recording position, stopping the node, and creating a new node on resume.

```javascript
import EventEmitter from 'events';

export class PlaybackController extends EventEmitter {
  constructor() {
    super();
    this._audioContext     = null;
    this._audioBuffer      = null;
    this._source           = null;
    this._isPlaying        = false;
    this._pauseOffset      = 0;   // seconds into buffer where we paused/stopped
    this._startContextTime = 0;   // audioContext.currentTime at last play() call
    this._startOffset      = 0;   // buffer offset at last play() call
  }

  get isPlaying() { return this._isPlaying; }
  get duration()  { return this._audioBuffer?.duration ?? 0; }

  /** Returns the current playback position in seconds. */
  get currentTime() {
    if (this._isPlaying && this._audioContext) {
      const elapsed = this._audioContext.currentTime - this._startContextTime;
      return Math.min(this._startOffset + elapsed, this.duration);
    }
    return this._pauseOffset;
  }

  /**
   * Decode samples into an AudioBuffer. Called after file load.
   * Creates or reuses the AudioContext; resumes it (autoplay policy).
   */
  async loadBuffer(samples, sampleRate) {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    if (!this._audioContext || this._audioContext.state === 'closed') {
      this._audioContext = new AudioContext({ sampleRate });
    }
    await this._audioContext.resume();
    const buf = this._audioContext.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    this._audioBuffer = buf;
    this.emit('stateChanged', { state: 'loaded', duration: buf.duration });
  }

  /** Start or resume playback. Optional offset (seconds) overrides saved position. */
  async play(offset = null) {
    if (!this._audioBuffer || !this._audioContext) return;
    await this._audioContext.resume();   // browser autoplay guard
    this._stopSource();
    const startAt = (offset !== null) ? Math.max(0, offset) : this._pauseOffset;
    if (startAt >= this.duration) return;

    const source = this._audioContext.createBufferSource();
    source.buffer = this._audioBuffer;
    source.connect(this._audioContext.destination);
    source._userStopped = false;  // distinguish natural end from manual stop
    source.onended = () => {
      if (!source._userStopped) {
        this._isPlaying   = false;
        this._pauseOffset = 0;
        this.emit('stateChanged', { state: 'stopped' });
      }
    };
    source.start(0, startAt);
    this._source           = source;
    this._startContextTime = this._audioContext.currentTime;
    this._startOffset      = startAt;
    this._isPlaying        = true;
    this.emit('stateChanged', { state: 'playing' });
  }

  pause() {
    if (!this._isPlaying) return;
    this._pauseOffset = this.currentTime;
    this._stopSource();
    this._isPlaying = false;
    this.emit('stateChanged', { state: 'paused' });
  }

  stop() {
    this._stopSource();
    this._isPlaying   = false;
    this._pauseOffset = 0;
    this.emit('stateChanged', { state: 'stopped' });
  }

  /** Jump to a time; resumes playback if it was playing. */
  seek(time) {
    const clipped    = Math.max(0, Math.min(time, this.duration));
    const wasPlaying = this._isPlaying;
    if (wasPlaying) { this._stopSource(); this._isPlaying = false; }
    this._pauseOffset = clipped;
    if (wasPlaying) this.play(clipped);
    else this.emit('stateChanged', { state: 'paused' });
  }

  destroy() {
    this._stopSource();
    this._audioContext?.close();
    this._audioContext = null;
  }

  _stopSource() {
    if (this._source) {
      this._source._userStopped = true;
      try { this._source.stop(); } catch (_) {}
      this._source.disconnect();
      this._source = null;
    }
  }
}
```

---

### B. Playhead drawing helpers (add near top of SpectrogramExample.jsx)

These two free functions are used in the RAF loop immediately after `axisRend.render()` so the playhead is drawn on top of axis grid lines and labels.

```javascript
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
```

---

### C. Modifications to `examples/SpectrogramExample.jsx`

**New import:**
```javascript
import { PlaybackController } from '../src/audio/PlaybackController.js';
```

**New refs / state (alongside existing declarations):**
```javascript
const playbackRef = useRef(null);
if (!playbackRef.current) {
  playbackRef.current = new PlaybackController();
}
const [playState, setPlayState] = useState('stopped'); // 'playing'|'paused'|'stopped'
```

**Wire `stateChanged` event** — add inside the existing mount `useEffect`, after the LUT controller wiring, before `scheduleRender()`:
```javascript
const pb = playbackRef.current;
pb.on('stateChanged', ({ state }) => setPlayState(state));
```

**Add to `useEffect` cleanup (return block):**
```javascript
playbackRef.current?.destroy();
```

**Load buffer on file load** — add at the end of the `try` block in `handleFileLoad`, after the existing `addLog(...)` call:
```javascript
// Load into playback controller (non-blocking — await is fine here since we're already async)
await playbackRef.current.loadBuffer(samplesRef.current, loadedSampleRateRef.current);
```

**Modify `scheduleRender`** — this is the most important change: force dirty every frame during playback so the playhead updates smoothly, and call `drawPlayhead` after each panel render:
```javascript
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
```

**Add Ctrl+click seek** — extend `onMouseDown` (spectrogram):
```javascript
const onMouseDown = (e) => {
  if (e.button !== 0) return;
  const viewport = viewportRef.current;
  if (!viewport) return;
  const pos = viewport.getCanvasPosition(e, webglRef.current);
  if (!viewport.isInPlotArea(pos.x, pos.y)) return;
  // Ctrl+click → seek
  if (e.ctrlKey && playbackRef.current?.duration > 0) {
    playbackRef.current.seek(viewport.screenXToData(pos.x));
    return;
  }
  panRef.current = { ... };  // existing logic unchanged
};
```
Add the same `Ctrl+click` block to `onWaveMouseDown` (using `waveViewportRef.current` and `waveWebglRef.current`).

**Playback controls in header JSX** (add after the "Open audio file" button):
```jsx
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
  {playState === 'playing' ? '⏸' : '▶'}
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
  ⏹
</button>
```

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Load audio file → Play/Pause buttons activate; log shows playback loaded
3. Press **▶** → yellow dashed vertical line appears on both spectrogram and waveform at t=0 and moves rightward smoothly at audio speed
4. Line stays at the correct relative position when zoomed/panned (it uses the live x-domain)
5. **⏸** → playhead freezes; audio stops; resume resumes from same position
6. **⏹** → playhead jumps to t=0
7. Ctrl+click on spectrogram or waveform → playhead jumps to clicked time; if playing, continues from new position
8. Playhead line disappears from view when time is outside the current x-domain (zoomed in elsewhere)
9. Audio ends naturally → `playState` resets to `'stopped'`
10. Load a second file → old playback stops; new buffer loaded

### Edge cases

- **Autoplay policy**: `await audioContext.resume()` is called inside `play()` before `source.start()`; user interaction (file open, button click) already grants permission.
- **Chirp-only (no file loaded)**: Play buttons are disabled (`duration === 0`). A future enhancement could call `loadBuffer` after `appendSamples` on mount.
- **Live append during playback**: Live-appended samples extend `samplesRef` but the `AudioBuffer` already loaded in `PlaybackController` is a snapshot. Playback plays only the originally loaded portion; the spectrogram continues to extend. This is consistent and intentional.
- **Very long files**: `AudioContext.createBuffer(1, N, sr)` allocates `4N` bytes. 30 min at 44100 Hz = ~318 MB float32. Browser may throw `EncodingError`; catch and log.
- **`source.stop()` on already-stopped node**: Guarded by the `try/catch` in `_stopSource()`.

---

## F13 [COMPLETED] Feature: Frequency Filters — offline DSP + frequency response preview

**Branch:** `feature/F12` (implemented on feature/F12 branch)
<!-- Started: 2026-02-22 · Completed: 2026-02-22 -->
<!-- Created src/audio/FilterController.js and src/components/FilterPanel.jsx; modified SpectrogramExample.jsx: added imports, filterControllerRef, originalSamplesRef, applying/filterSampleRate state, PCM snapshot on file load, handleApplyFilter, handleClearFilter, "Clear Filter" header button, right sidebar layout with HistogramLUTPanel + FilterPanel stacked. Build: 0 errors. -->

**Branch:** `feature/F13` (create before starting; may be implemented after F12)

**Goal:** Apply a Web Audio biquad filter (low-pass, high-pass, band-pass, notch, allpass) to the loaded PCM samples offline via `OfflineAudioContext`, then force a spectrogram STFT recompute so the filtered frequency content is visible. A `FilterPanel` component shows a live frequency response curve and the cutoff/Q controls. Original samples are preserved in memory so "Clear Filter" restores them without requiring a file reload.

---

### Files to create / modify

| File | Action |
|------|--------|
| `src/audio/FilterController.js` | **Create new** |
| `src/components/FilterPanel.jsx` | **Create new** |
| `examples/SpectrogramExample.jsx` | **Modify** — add controller, panel, apply/clear, layout |

---

### A. Create `src/audio/FilterController.js`

```javascript
import EventEmitter from 'events';

export class FilterController extends EventEmitter {
  constructor() {
    super();
    this.state = {
      type:      'none',   // 'none'|'lowpass'|'highpass'|'bandpass'|'notch'|'allpass'
      frequency: 1000,     // Hz — cutoff / centre frequency
      Q:         1.0,      // resonance / bandwidth
    };
  }

  setType(type)      { this.state.type = type;       this.emit('changed', { ...this.state }); }
  setFrequency(freq) { this.state.frequency = freq;  this.emit('changed', { ...this.state }); }
  setQ(q)            { this.state.Q = q;             this.emit('changed', { ...this.state }); }

  /**
   * Process samples through the biquad filter using OfflineAudioContext.
   * Returns a new Float32Array — original is not mutated.
   * If type === 'none', returns the same reference unchanged.
   */
  async applyToSamples(samples, sampleRate) {
    if (this.state.type === 'none') return samples;
    const offlineCtx = new OfflineAudioContext(1, samples.length, sampleRate);
    const buf        = offlineCtx.createBuffer(1, samples.length, sampleRate);
    buf.getChannelData(0).set(samples);
    const source = offlineCtx.createBufferSource();
    source.buffer = buf;
    const filter = offlineCtx.createBiquadFilter();
    filter.type            = this.state.type;
    filter.frequency.value = Math.min(this.state.frequency, sampleRate / 2 - 1);
    filter.Q.value         = this.state.Q;
    source.connect(filter);
    filter.connect(offlineCtx.destination);
    source.start(0);
    const rendered = await offlineCtx.startRendering();
    return rendered.getChannelData(0).slice();  // copy — ChannelData view becomes invalid after GC
  }

  /**
   * Compute frequency response for the current filter settings.
   * Returns { freqs: Float32Array, db: Float32Array } for nPoints log-spaced
   * frequencies from 20 Hz to nyquist.  Returns null if type === 'none'.
   *
   * Note: creates and immediately closes a temporary AudioContext; call only
   * when the user interacts with controls (not on every RAF frame).
   */
  getFrequencyResponse(nPoints = 256, sampleRate = 44100) {
    if (this.state.type === 'none') return null;
    const nyquist = sampleRate / 2;
    const freqs   = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      freqs[i] = 20 * Math.pow(nyquist / 20, i / (nPoints - 1));
    }
    const magRes   = new Float32Array(nPoints);
    const phaseRes = new Float32Array(nPoints);
    const tmpCtx   = new AudioContext({ sampleRate });
    const tmpNode  = tmpCtx.createBiquadFilter();
    tmpNode.type            = this.state.type;
    tmpNode.frequency.value = Math.min(this.state.frequency, nyquist - 1);
    tmpNode.Q.value         = this.state.Q;
    tmpNode.getFrequencyResponse(freqs, magRes, phaseRes);
    tmpCtx.close();  // release resources; fire-and-forget async close is fine
    const db = new Float32Array(nPoints);
    for (let i = 0; i < nPoints; i++) {
      db[i] = 20 * Math.log10(Math.max(magRes[i], 1e-10));
    }
    return { freqs, db };
  }

  static get filterTypes() {
    return ['none', 'lowpass', 'highpass', 'bandpass', 'notch', 'allpass'];
  }
}
```

---

### B. Create `src/components/FilterPanel.jsx`

Props: `{ controller, sampleRate, onApply, applying }`.

- `controller` — `FilterController` instance
- `sampleRate` — current audio sample rate (needed for Nyquist in sliders and response curve)
- `onApply()` — called when "Apply" button is clicked (parent handles the async work)
- `applying` — boolean; while true the button shows "Applying…" and is disabled

```jsx
import React, { useRef, useEffect, useState } from 'react';
import { FilterController } from '../audio/FilterController.js';

export default function FilterPanel({ controller, sampleRate = 44100, onApply, applying = false }) {
  const canvasRef = useRef(null);
  const [state, setState] = useState({ ...controller.state });

  // Wire controller events
  useEffect(() => {
    const onChange = s => setState({ ...s });
    controller.on('changed', onChange);
    return () => controller.off('changed', onChange);
  }, [controller]);

  // Draw frequency response every time filter state changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, W, H);

    // 0 dB reference line (dB range: −60 to +6; 0 dB sits at 90.9% from bottom)
    const DB_MIN = -60, DB_MAX = 6;
    const dbToY = db => H - ((db - DB_MIN) / (DB_MAX - DB_MIN)) * H;
    const zeroY = dbToY(0);
    ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();

    if (state.type === 'none') {
      // Flat 0 dB line
      ctx.strokeStyle = '#444'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(0, zeroY); ctx.lineTo(W, zeroY); ctx.stroke();
      return;
    }

    const resp = controller.getFrequencyResponse(W, sampleRate);
    if (!resp) return;

    // Response curve
    ctx.strokeStyle = '#4af'; ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < W; i++) {
      const y = Math.max(0, Math.min(H, dbToY(resp.db[i])));
      if (i === 0) ctx.moveTo(i, y); else ctx.lineTo(i, y);
    }
    ctx.stroke();

    // Cutoff frequency marker (orange vertical dashed line)
    const nyquist = sampleRate / 2;
    const fx = Math.log(state.frequency / 20) / Math.log(nyquist / 20) * W;
    ctx.strokeStyle = '#f80'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(fx, 0); ctx.lineTo(fx, H); ctx.stroke();
    ctx.setLineDash([]);
  }, [state, sampleRate, controller]);

  const nyquist = sampleRate / 2;
  const sliderStyle = { width: '100%', marginTop: 2 };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      background: '#0a0a0a', borderTop: '1px solid #2a2a2a',
      fontFamily: 'monospace', fontSize: 11, color: '#888',
      padding: '6px 8px', boxSizing: 'border-box', gap: 5, flexShrink: 0,
    }}>
      <div style={{ color: '#555', fontSize: 10, letterSpacing: 1 }}>FILTER</div>

      <select
        value={state.type}
        onChange={e => controller.setType(e.target.value)}
        style={{ background: '#1a1a1a', border: '1px solid #444', color: '#aaa', padding: '2px', fontSize: 11 }}
      >
        {FilterController.filterTypes.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {state.type !== 'none' && (
        <>
          <label>
            <span style={{ color: '#555' }}>Cutoff </span>
            <span style={{ color: '#aaa' }}>
              {state.frequency < 1000
                ? `${state.frequency.toFixed(0)} Hz`
                : `${(state.frequency / 1000).toFixed(2)} kHz`}
            </span>
            {/* Log-scale slider: range [0,1] mapped to [20 Hz, Nyquist] via exponential */}
            <input type="range" min="0" max="1" step="0.001"
              value={Math.log(state.frequency / 20) / Math.log(nyquist / 20)}
              onChange={e => {
                const t = parseFloat(e.target.value);
                controller.setFrequency(Math.round(20 * Math.pow(nyquist / 20, t)));
              }}
              style={sliderStyle}
            />
          </label>
          <label>
            <span style={{ color: '#555' }}>Q </span>
            <span style={{ color: '#aaa' }}>{state.Q.toFixed(2)}</span>
            <input type="range" min="0.1" max="30" step="0.1"
              value={state.Q}
              onChange={e => controller.setQ(parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </label>
        </>
      )}

      {/* Frequency response canvas: x = 20 Hz→Nyquist (log), y = −60→+6 dB */}
      <canvas ref={canvasRef} width={118} height={55}
        style={{ width: '100%', height: 55, borderRadius: 2, border: '1px solid #1a1a1a' }}
      />

      <button
        onClick={onApply}
        disabled={applying || state.type === 'none'}
        style={{
          background: '#1a1a1a', border: '1px solid #444',
          color: (applying || state.type === 'none') ? '#444' : '#fda',
          padding: '3px', fontSize: 11, cursor: 'pointer', fontFamily: 'monospace',
        }}
      >
        {applying ? 'Applying…' : 'Apply to spectrogram'}
      </button>
    </div>
  );
}
```

---

### C. Modifications to `examples/SpectrogramExample.jsx`

**New imports:**
```javascript
import { FilterController } from '../src/audio/FilterController.js';
import FilterPanel           from '../src/components/FilterPanel.jsx';
```

**New refs / state:**
```javascript
const filterControllerRef  = useRef(null);
const originalSamplesRef   = useRef(null);  // snapshot of pre-filter PCM for "Clear Filter"
if (!filterControllerRef.current) {
  filterControllerRef.current = new FilterController();
}
const [applying,         setApplying]         = useState(false);
const [filterSampleRate, setFilterSampleRate] = useState(SAMPLE_RATE);
```

**Store original samples on file load** — add inside `handleFileLoad` try block, immediately after loading PCM into `samplesRef.current`:
```javascript
originalSamplesRef.current = samplesRef.current.slice();  // snapshot of raw PCM
setFilterSampleRate(sr);
```

**Apply filter handler:**
```javascript
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
```

Note: `playbackRef` is part of F12. If F13 is implemented before F12, omit the `playbackRef` block.

**Clear filter handler** (restores original pre-filter samples):
```javascript
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
```

**"Clear Filter" button in header** (add beside "Open audio file"):
```jsx
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
```

**Layout** — stack `FilterPanel` below `HistogramLUTPanel` inside the right sidebar div:
```jsx
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
```

Remove the `width={140}` prop from `HistogramLUTPanel` (width is now supplied by the parent `div`). Ensure `HistogramLUTPanel` fills its parent by keeping `width: '100%'` in its outer div — it already does via the existing `boxSizing: 'border-box'` style.

---

### Verification

1. `npx webpack --mode development` → 0 errors
2. Open an audio file → `FilterPanel` appears in the right sidebar below `HistogramLUTPanel`; response canvas shows a flat line (type=none)
3. Select "lowpass", drag cutoff slider → response curve updates live; orange marker moves; no spectrogram change yet
4. Click "Apply to spectrogram" → button shows "Applying…"; STFT recomputes; high frequencies attenuated (dark in spectrogram above cutoff)
5. Raise cutoff → reapply → wider pass band visible
6. Select "highpass" → apply → low frequencies attenuated (dark below cutoff)
7. Select "bandpass", reduce Q → apply → narrow bright horizontal band in spectrogram
8. "Clear Filter" → original unfiltered spectrogram restored; log confirms
9. With F12 implemented: apply low-pass then press Play → audio is audibly dull (highs removed)
10. "Clear Filter" → Play → full bandwidth audio restored

### Edge cases

- **`OfflineAudioContext` limits**: Very long files (> ~30 min mono at 44100 Hz = ~310 MB) may fail with `NotSupportedError`. Catch and log.
- **Filter frequency clamped to Nyquist**: `Math.min(frequency, sampleRate/2 - 1)` prevents invalid `BiquadFilterNode` state.
- **Compound filtering**: Applying a second filter without clearing first compounds with the first (applies to already-filtered samples). This is intentional — the log message shows the current filter params. Users "Clear Filter" to reset to original, then apply a fresh filter.
- **`getFrequencyResponse` cost**: Creates and closes a temporary `AudioContext` on every control change. If latency is noticeable, debounce `onChange` by 100 ms.
- **Live append mode**: "Apply to spectrogram" is not meaningful when live-append is active (data keeps changing). Consider disabling the "Apply" button when `liveAppend` is true, or at least logging a warning.
- **FilterPanel height in sidebar**: `HistogramLUTPanel` uses `flex: 1` to fill the sidebar; `FilterPanel` has `flexShrink: 0` and a fixed content height. Ensure the sidebar div has `overflow: hidden` so the LUT panel doesn't overflow when the sidebar is short.

---

## ✅ PREVIOUSLY COMPLETED (B7–B8, F7–F9)

---

## B7 [COMPLETED] Fix: Y-axis pan direction inverted in follow and drag modes (F4/F5)

**Files:** `src/plot/PlotController.js`, `prompt.md`

**Root cause:**

The d3 y scale is set with an inverted range `[pa.y + pa.height, pa.y]` (e.g. `[620, 20]`) so that data-y=0 maps to the screen bottom. This makes `pxSpan` for y **negative** inside `panByPixels`, causing a double-negation that reverses the effective direction:

```
dataDelta = -(pixelDelta / pxSpan) * domainSpan
x: pxSpan > 0  →  panByPixels(+n) → domain decreases (viewport shifts left/up)
y: pxSpan < 0  →  panByPixels(+n) → domain increases (inverted vs. x!)
```

The F4/F5 code was written assuming a non-inverted y range, so both pan modes move the viewport in the wrong direction for y.

**Fix 1 — Follow velocity tick in `_scheduleRender` (F5):**

```js
// BEFORE (wrong — data moves WITH drag in follow mode):
this._yAxis.panByPixels( dy * FOLLOW_PAN_SPEED);

// AFTER (correct — data scrolls OPPOSITE to drag, matching x-axis scroll direction):
this._yAxis.panByPixels(-dy * FOLLOW_PAN_SPEED);
```

**Fix 2 — Drag mode in `_onMouseMove` (F4):**

```js
// BEFORE (wrong — data moves opposite to cursor):
this._yAxis.panByPixels(-dy);   // inverted: drag down  → data moves down

// AFTER (correct — data follows cursor, matching x-axis drag behavior):
this._yAxis.panByPixels( dy);   // drag down → data moves down
```

**Why the signs feel counterintuitive:** for x, drag and drag-pan signs are opposite (`-dx` for follow, `+dx` for drag). For y they end up both positive-`dy` (follow → `-dy`, drag → `+dy`) because the inverted range already flips the direction once — any additional negation cancels it.

**`prompt.md` note to add** (in or near the Zoom & Pan section):

```
### Y-axis Coordinate Convention

deck.gl `OrthographicView` is explicitly `flipY: false` in MasterPlot — y is NOT
flipped at the GPU/projection level.

However, the d3 y scale uses an **inverted range** `[plotBottom_px, plotTop_px]`
so that data-y=0 appears at the visual bottom and data-y=max at the top (standard
scientific convention). This means `pxSpan` inside `panByPixels` is **negative** for y.

Consequence for interaction code:
- `panByPixels(+n)` on y → domain **increases** (you see higher values)
- `panByPixels(-n)` on y → domain **decreases** (you see lower values)
  (exactly opposite to x, where `panByPixels(+n)` → domain decreases)

Rule for new pan/interaction code: negate `dy` relative to what you would use
for `dx` to get the same directional behavior on both axes.
```

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Follow mode: drag UP → plot scrolls up (see higher y values; data points move downward like standard scroll)
- Drag mode: drag DOWN → data point under cursor moves down with your hand (Google Maps style)

---

## F6 [COMPLETED] Feature: Right-click context-menu suppression + drag zoom

**Files:** `src/plot/PlotController.js`

**Behaviour:**
- Suppress the browser context menu on the WebGL canvas via a `contextmenu` event listener calling `e.preventDefault()`.
- Right-click + drag **vertically** zooms in/out centred on the right-click starting position:
  - Drag **UP** → zoom in (axis domain shrinks, data appears larger)
  - Drag **DOWN** → zoom out (axis domain expands, more data visible)
- Uses restore-and-reapply pattern (store initial domains on mousedown, restore + reapply each mousemove frame) to prevent float drift.
- ROI controller guards `if (e.button !== 0) return` — right-click is completely transparent to ROI logic.

**New state (constructor, after pan state):**
```js
this._isRightDragging = false;
this._rightDragStart  = null;   // { x, y, xDomain, yDomain }
this._onContextMenu   = e => e.preventDefault();
```

**`init()`** — add alongside existing canvas listeners:
```js
webglCanvas.addEventListener('contextmenu', this._onContextMenu);
```

**`destroy()`** — add:
```js
this._webglCanvas?.removeEventListener('contextmenu', this._onContextMenu);
```

**`_onMouseDown`** — route button 2 before the existing `if (e.button !== 0) return` check:
```js
if (e.button === 2) { this._handleRightDown(e); return; }
```

**`_handleRightDown(e)` (new private method):**
```js
_handleRightDown(e) {
  const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
  if (!this._viewport.isInPlotArea(pos.x, pos.y)) return;
  this._isRightDragging = true;
  this._rightDragStart  = {
    x: pos.x, y: pos.y,
    xDomain: this._xAxis.getDomain(),
    yDomain: this._yAxis.getDomain(),
  };
}
```

**`_handleRightMove(e)` (new private method):**
```js
_handleRightMove(e) {
  if (!this._rightDragStart) return;
  const pos     = this._viewport.getCanvasPosition(e, this._webglCanvas);
  const totalDy = pos.y - this._rightDragStart.y;
  // drag up (totalDy<0) → factor<1 → zoom in  ✓
  const factor = Math.pow(0.992, -totalDy);   // tune: sensitivity
  // Restore initial domains to avoid float drift
  this._xAxis.setDomain(this._rightDragStart.xDomain);
  this._yAxis.setDomain(this._rightDragStart.yDomain);
  this._updateScales();
  // Focal point in data space at the right-click origin
  const focalDataX = this._viewport.screenXToData(this._rightDragStart.x);
  const focalDataY = this._viewport.screenYToData(this._rightDragStart.y);
  this._xAxis.zoomAround(factor, focalDataX);
  this._yAxis.zoomAround(factor, focalDataY);
  this._updateScales();
  this._dirty = true;
  this.emit('zoomChanged', { factor, focalDataX, focalDataY });
}
```

**`_onMouseMove`** — call `_handleRightMove` at the top (before left-click pan guard):
```js
if (this._isRightDragging) { this._handleRightMove(e); }
```

**`_onMouseUp`** — add button-2 branch alongside existing button-0 branch:
```js
if (e.button === 2 && this._isRightDragging) {
  this._isRightDragging = false;
  this._rightDragStart  = null;
}
```

---

## F5 [COMPLETED] Feature: Follow pan — continuous velocity mode

**Files:** `src/plot/PlotController.js`

**Behaviour:** In "follow pan" mode (`_panMode === 'follow'`), rather than snapping the domain on each mousemove event, the RAF loop continuously applies a pan proportional to the displacement between the current mouse position and the mousedown position.

- Mouse at mousedown position → no movement (dead zone ≤ 5 px)
- Mouse displaced N px → pan at `N × FOLLOW_PAN_SPEED` of domain-width per frame
- `FOLLOW_PAN_SPEED = 0.02` (tune as needed — corresponds to ~1.2 domain-widths/sec per 100 px at 60 fps)
- `_onMouseMove` in follow mode only updates `_panCurrentPos` — it does NOT modify domains directly

**New state (constructor, after existing pan state):**
```js
this._panCurrentPos = null;   // { x, y } — updated each mousemove in follow mode
```

**`_onMouseDown`** — after setting `_isPanning = true`, also set:
```js
this._panCurrentPos = { x: pos.x, y: pos.y };
```

**`_onMouseMove`** — replace the existing pan block with a mode branch:
```js
if (this._panMode === 'drag') {
  // drag pan: handled in F4
} else {
  // follow pan: just track current cursor position; RAF loop does the work
  this._panCurrentPos = { x: pos.x, y: pos.y };
}
```
(No domain mutation here in follow mode.)

**`_onMouseUp`** — clear `_panCurrentPos`:
```js
this._panCurrentPos = null;
```

**`_scheduleRender`** — insert velocity tick before the `_dirty` render check:
```js
if (this._isPanning && this._panMode === 'follow' && this._panCurrentPos && this._panStart) {
  const dx   = this._panCurrentPos.x - this._panStart.screenX;
  const dy   = this._panCurrentPos.y - this._panStart.screenY;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const DEAD_ZONE        = 5;
  const FOLLOW_PAN_SPEED = 0.02;
  if (dist > DEAD_ZONE) {
    this._xAxis.panByPixels(-dx * FOLLOW_PAN_SPEED);
    this._yAxis.panByPixels( dy * FOLLOW_PAN_SPEED);
    this._updateScales();
    this._dirty = true;
    this.emit('panChanged', {
      dx: Math.round(-dx * FOLLOW_PAN_SPEED),
      dy: Math.round( dy * FOLLOW_PAN_SPEED),
    });
  }
}
```

---

## F4 [COMPLETED] Feature: Pan mode toggle (follow pan / drag pan)

**Files:** `src/plot/PlotController.js`, `examples/ExampleApp.jsx`

**Behaviour:**
- Two pan modes selectable at runtime:
  - `'follow'` (default): current behavior — viewport tracks the drag direction; the axis scrolls in the direction you drag. **After F5 this becomes a continuous velocity/joystick mode.**
  - `'drag'`: grab-and-drag — data moves with the cursor (inverted signs vs follow pan). Uses restore-and-reapply to prevent float drift. Like Google Maps / Photoshop pan.
- A "Drag pan" checkbox is added to the example app header.
- ROI interactions are completely unaffected.

**PlotController constructor** — add after existing pan state:
```js
this._panMode = opts.panMode || 'follow';
```

**New public method** (add after `setAutoExpand`):
```js
/** @param {'follow'|'drag'} mode */
setPanMode(mode) {
  this._panMode = (mode === 'drag') ? 'drag' : 'follow';
}
```

**`_onMouseMove`** — drag pan branch (inverted signs):
```js
if (this._panMode === 'drag') {
  const dx = pos.x - this._panStart.screenX;
  const dy = pos.y - this._panStart.screenY;
  this._xAxis.setDomain(this._panStart.xDomain);
  this._yAxis.setDomain(this._panStart.yDomain);
  this._xAxis.panByPixels(dx);    // inverted: drag right → data moves right
  this._yAxis.panByPixels(-dy);   // inverted: drag down  → data moves down
  this._updateScales();
  this._dirty = true;
  this.emit('panChanged', { dx, dy });
}
```

**`ExampleApp.jsx`** — add state + handler + checkbox:
```jsx
const [dragPan, setDragPan] = useState(false);

const handleDragPanChange = (e) => {
  const checked = e.target.checked;
  plotRef.current?.getController()?.setPanMode(checked ? 'drag' : 'follow');
  setDragPan(checked);
};

// in header JSX, after Auto-expand label:
<label style={checkboxLabelStyle}>
  <input type="checkbox" checked={dragPan} onChange={handleDragPanChange} />
  Drag pan
</label>
```

---

## B6 [COMPLETED] Fix: Y-axis data rendering is vertically inverted

**Files:** `src/plot/PlotController.js`, `src/plot/layers/ScatterLayer.js`, `src/plot/layers/ROILayer.js`

**Symptom:** Data points render upside-down relative to the axis tick labels. Low-y data values appear near the **top** of the plot; high-y values appear near the **bottom**. The axis labels (drawn by `AxisRenderer` via d3 scale) are correct — y=0 is labeled at the bottom and y=max at the top. Only the deck.gl-rendered scatter points and ROI rectangles are inverted.

**Root cause:**

`_buildViewState` (in `PlotController.js`) derives the deck.gl camera target `ty` from the equation:

```
screenY = -(worldY − ty) × 2^zoomY + H/2     ← assumes flipY:true
```

which requires:

```js
const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;
```

If the installed deck.gl version's `OrthographicView` defaults to `flipY: false` (y increases **downward**, screen convention), the actual relationship is:

```
screenY = (worldY − ty) × 2^zoomY + H/2      ← flipY:false
```

Under that convention a **larger** world-y value maps to a **larger** screen-y (visual bottom), inverting the entire plot. Both `ScatterLayer.js` (`getPosition` returns `[x, y_data, 0]`) and `ROILayer.js` (polygon vertices use raw `toY(roi.y1/y2)`) pass raw data-y without compensation, so every rendered element is affected.

**Investigation — do this first:**

1. Check `package.json` for the exact `@deck.gl/core` version installed.
2. Look up whether that version's `OrthographicView` defaults to `flipY: true` or `flipY: false`.
3. Add a quick sanity `console.log` inside `_render()` to print the computed `viewState` and compare `target[1]` against the expected midpoint of the y-domain.

**Fix — Option A (preferred, minimal change):**

Add `flipY: true` explicitly to the `OrthographicView` declaration in `PlotController.init()`:

```js
views: [new OrthographicView({ id: 'ortho', controller: false, flipY: true })],
```

If the `ty` formula was derived for `flipY: true` (as it was), and the view now matches, scatter points and ROI boxes should align with the axis labels without any changes to the layer files.

**Fix — Option B (if Option A doesn't resolve it):**

Negate all y coordinates at the deck.gl boundary to force screen-y convention everywhere:

1. **`PlotController._buildViewState`** — negate `deckYMin` and `deckYMax`, then re-derive `ty` for `flipY: false`:
   ```js
   const deckYMinN = -deckYMax;   // negate: larger data-y → smaller (more negative) deck-y
   const deckYMaxN = -deckYMin;
   const ySpanN    = deckYMaxN - deckYMinN;  // same magnitude as ySpan
   // For flipY:false: deckYMinN → screenY = H−marginBottom, deckYMaxN → screenY = marginTop
   // Equation: (worldY − ty)*zoom + H/2 = H−marginBottom  →  ty = deckYMinN − (H/2−marginBottom)*ySpanN/pa.height
   const ty = deckYMinN - (H / 2 - marginBottom) * ySpanN / pa.height;
   // zoom unchanged (uses pa.height / ySpanN = pa.height / ySpan)
   return { id: 'ortho', target: [tx, ty, 0], zoom: [zoomX, zoomY] };
   ```
2. **`ScatterLayer.js` — negate y in `getPosition`:**
   ```js
   getPosition: (_, { index }) => [
     xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
     -(yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index]),   // ← negate
     0,
   ],
   ```
3. **`ROILayer.js` — update `toY` to negate:**
   ```js
   const toY = v => -(yIsLog ? Math.log10(Math.max(v, 1e-10)) : v);
   ```
   All polygon, path, and handle positions in ROILayer already use `toY(...)`, so this one-line change covers them all.

**After fix:** The visual positions of scatter points and ROI boxes should align with axis tick labels. Verify by:
- Observing that a value of y=0 (lowest) appears at the bottom of the plot.
- Dragging a RectROI and confirming its rendered position matches its reported bounds in the log panel.
- Rebuilding: `npm run build` should produce 0 errors.

---

## B5 [COMPLETED] Fix: Inverted vertical controls on constrained RectROI

**Files:** `src/plot/ROI/RectROI.js`, `src/plot/ROI/ROIController.js`

**Context:** A prior fix (handle naming swap, `xLocked` flag) was applied but the user confirmed vertical controls on constrained RectROIs are still inverted. The fix must be re-examined and corrected from first principles.

**Root cause to verify:**

The y-axis scale range is set as `[pa.y + pa.height, pa.y]` — an inverted range where `y1s = yScale(y1)` is a **larger** screen-y (visual bottom) and `y2s = yScale(y2)` is a **smaller** screen-y (visual top). Dragging UP decreases screen-y → `dataY = yScale.invert(screenY)` **increases** (inverted scale) → `dy > 0`.

The handle naming in the current `RectROI.hitTestHandles` maps:
- `near(midX, y2s)` → `HANDLES.TOP` → `applyDelta(TOP)`: `y2 += dy`
- `near(midX, y1s)` → `HANDLES.BOTTOM` → `applyDelta(BOTTOM)`: `y1 += dy`

Trace the xLocked MOVE handle: `applyDelta(MOVE)` does `y1 += dy; y2 += dy`. After that, ROIController re-syncs `roi.x1 = parent.x1; roi.x2 = parent.x2`. The `dy` sign is correct for the inverted y-scale, so MOVE should be fine.

**Likely remaining issue:** The `_dragStartBounds` is captured at mousedown. Bounds are restored at the top of every `_onMouseMove` frame (`roi.y1 = sb.y1; roi.y2 = sb.y2`). If `applyDelta` then causes the normalization swap `[y1, y2] = [y2, y1]` (when dragging a BOTTOM handle so far up that `y1 > y2`), the restored bounds on the next frame reset to the original un-swapped values and the rect "snaps" — this can feel inverted on the boundary. Ensure the normalization in `applyDelta` does NOT fire during the frame restore (it shouldn't since restore happens before delta), and verify the corner-→-vertical remapping for xLocked rects is consistent.

**Steps:**
1. Instrument `_onMouseMove` with a temporary `console.log` of `dy`, the handle, and `roi.y1`/`roi.y2` before and after `applyDelta` to empirically confirm the sign issue.
2. Correct whichever path is wrong. Do NOT change both sides simultaneously without verifying one first.
3. Remove instrumentation, rebuild, and verify.

---

## F3 [COMPLETED] Feature: Show emitted events on the example page log panel

**File:** `examples/ExampleApp.jsx`

**Context:** The bottom log panel currently shows `roiCreated`, `roiDeleted`, `dataAppended`, and `domainChanged`. `roiUpdated` and `zoomChanged` are either skipped or console-only. The user wants meaningful emitted changes visible in the on-screen log.

**Required changes to `handleEvent` in ExampleApp:**

1. **`roiUpdated`** — currently a no-op in the switch. Throttle it: only log when the active ROI's bounds actually changed by more than a small epsilon (avoids flooding during drag). Display formatted bounds:
   ```javascript
   case 'roiUpdated': {
     const b = data.bounds;
     const msg = `roiUpdated: ${data.roi.id}  x[${b.x1.toFixed(1)}, ${b.x2.toFixed(1)}]  y[${b.y1.toFixed(1)}, ${b.y2.toFixed(1)}]`;
     addLog(msg);  // addLog already caps at 20 entries, so flooding is bounded
     break;
   }
   ```

2. **`zoomChanged`** — currently console-only. Add to the on-screen log:
   ```javascript
   case 'zoomChanged':
     console.log('[zoomChanged]', `factor=${data.factor?.toFixed(3)}`);
     addLog(`zoomChanged: factor=${data.factor?.toFixed(3)}`);
     break;
   ```

3. **`panChanged`** — PlotController already emits this (from `_onMouseMove`). Add a handler entry and log it (throttle: only when `Math.abs(dx) + Math.abs(dy) > 5` pixels to avoid spam):
   ```javascript
   case 'panChanged':
     if (Math.abs(data.dx) + Math.abs(data.dy) > 5) {
       addLog(`panChanged: dx=${data.dx.toFixed(0)} dy=${data.dy.toFixed(0)}`);
     }
     break;
   ```
   Also wire `panChanged` in `PlotCanvas.jsx` (or wherever `onEvent` is wired) if it is not already forwarded.

**Styling note:** Keep existing color scheme — most-recent entry is `#adf`, older entries are `#556`.

**After changes:** Rebuild and verify no new console errors.

---

## ✅ PREVIOUSLY COMPLETED — 2026-02-20

B1–F2 implemented and build verified (`webpack compiled successfully`, 0 errors).

---

## B1 [COMPLETED] Fix: Zoom (scroll wheel) does nothing

**File:** `src/plot/PlotController.js`

**Root cause:** `ViewportController.getCanvasPosition()` returns `{ x, y }` but `_onWheel` destructures `{ screenX, screenY }` → both `undefined` → `isInPlotArea(undefined, undefined)` returns `false` → handler exits immediately.

**Exact fix in `_onWheel` (line ~360):**
```javascript
// BEFORE (broken):
const { screenX, screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);

// AFTER (fixed):
const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
```

**Same bug exists in `_onMouseDown` (line ~377) in the ROI hitTest guard:**
```javascript
// BEFORE (broken):
const { screenX, screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);

// AFTER (fixed):
const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
```

---

## B2 [COMPLETED] Fix: deck.gl coordinate system mismatch (pan/zoom wrong, ROIs misplace)

**Root cause (3 compounding issues in `_buildViewState()`):**

1. **Single zoom level** — `zoom: Math.min(zoomX, zoomY)` forces both axes to same pixels-per-unit. For the example (x: log 1–10000, y: linear 0–100) this distorts the view. deck.gl 8.x supports `zoom: [zoomX, zoomY]` for independent per-axis scaling.

2. **No margin compensation** — deck.gl's `OrthographicView` places `target` at the **full canvas center** (including margins), but d3 scale ranges start at `marginLeft`/`marginTop`. The plot area center ≠ canvas center → points are offset from where axis ticks say they should be.

3. **Log scale mismatch** — points are positioned at raw data values (1–10000) in deck.gl's linear world space, but d3's `scaleLog` spreads them logarithmically. Point at x=10 appears near x=1 visually, but axis tick says 25% across. Complete misalignment.

**Exact replacement for `_buildViewState()` in `src/plot/PlotController.js`:**

```javascript
_buildViewState() {
  const [xMin, xMax] = this._xAxis.getDomain();
  const [yMin, yMax] = this._yAxis.getDomain();

  const { canvasWidth: W, canvasHeight: H, plotArea: pa,
          marginLeft, marginBottom } = this._viewport;

  const xIsLog = this._xAxis.scaleType === 'log';
  const yIsLog = this._yAxis.scaleType === 'log';

  // For log scale axes, work in log10 space so deck.gl's linear projection
  // matches the logarithmic d3 scale. Zoom/pan stays O(1) — viewState only.
  const deckXMin = xIsLog ? Math.log10(Math.max(xMin, 1e-10)) : xMin;
  const deckXMax = xIsLog ? Math.log10(Math.max(xMax, 1e-10)) : xMax;
  const deckYMin = yIsLog ? Math.log10(Math.max(yMin, 1e-10)) : yMin;
  const deckYMax = yIsLog ? Math.log10(Math.max(yMax, 1e-10)) : yMax;

  const xSpan = Math.max(deckXMax - deckXMin, 1e-10);
  const ySpan = Math.max(deckYMax - deckYMin, 1e-10);

  // Independent per-axis zoom (deck.gl 8.x supports zoom: [zoomX, zoomY])
  const zoomX = Math.log2(pa.width  / xSpan);
  const zoomY = Math.log2(pa.height / ySpan);

  // Adjust target to compensate for margin offset.
  // Derived from OrthographicView (flipY:true) projection equations:
  //   screenX = (worldX - tx) * 2^zoomX + W/2  →  solve for tx so that
  //   deckXMin maps to marginLeft and deckXMax maps to marginLeft+plotWidth.
  //
  //   screenY = -(worldY - ty) * 2^zoomY + H/2  (flipY negates y)
  //   deckYMin maps to marginTop+plotHeight, deckYMax maps to marginTop.
  const tx = deckXMin + (W / 2 - marginLeft) * xSpan / pa.width;
  const ty = deckYMin + (H / 2 - marginBottom) * ySpan / pa.height;

  return {
    id:     'ortho',
    target: [tx, ty, 0],
    zoom:   [zoomX, zoomY],
  };
}
```

**Also expose `xIsLog`/`yIsLog` flags for use by layers. Add to `_render()` in the same file:**
```javascript
// Add these two lines near top of _render(), before building layers:
const xIsLog = this._xAxis.scaleType === 'log';
const yIsLog = this._yAxis.scaleType === 'log';

// Pass to buildScatterLayer:
layers.push(buildScatterLayer(gpuAttrs, { dataTrigger: this._dataTrigger, xIsLog, yIsLog }));

// Pass to ROILayer:
layers.push(new ROILayer({
  id:       'roi-layer',
  rois,
  plotYMin: yMin,
  plotYMax: yMax,
  xIsLog,
  yIsLog,
}));
```

**Note on `marginBottom`:** `ViewportController` doesn't currently expose `marginBottom` as a direct property. Either:
- Add `this.marginBottom` to `ViewportController` constructor (it already stores `this.marginBottom = opts.marginBottom ?? 50`) — check the file, it should already be there.
- Or compute `marginBottom = H - pa.y - pa.height` inside `_buildViewState()`.

---

## B3 [COMPLETED] Fix: ScatterLayer must transform to deck.gl coordinate space

**File:** `src/plot/layers/ScatterLayer.js`

For log-x axis: raw data values (1–10000) must be transformed to `log10(x)` before deck.gl renders them, since `_buildViewState()` now sets up the projection in log space. For linear axes, pass through unchanged.

**Exact replacement for `buildScatterLayer` function:**

```javascript
export function buildScatterLayer(gpuAttrs, opts = {}) {
  const { x, y, color, size } = gpuAttrs;
  const count = x.length;
  const xIsLog = opts.xIsLog || false;
  const yIsLog = opts.yIsLog || false;

  const data = { length: count };

  return new ScatterplotLayer({
    id:               opts.id || 'masterplot-scatter',
    data,
    radiusUnits:      'pixels',
    radiusMinPixels:  1,
    radiusMaxPixels:  30,
    pickable:         false,
    stroked:          false,

    getPosition: (_, { index }) => [
      xIsLog ? Math.log10(Math.max(x[index], 1e-10)) : x[index],
      yIsLog ? Math.log10(Math.max(y[index], 1e-10)) : y[index],
      0,
    ],
    getRadius: (_, { index }) => size[index] * 0.5,
    getColor:  (_, { index }) => {
      const base = index * 4;
      return [color[base], color[base + 1], color[base + 2], color[base + 3]];
    },

    updateTriggers: {
      getPosition: opts.dataTrigger || 0,
      getRadius:   opts.dataTrigger || 0,
      getColor:    opts.dataTrigger || 0,
    },

    ...opts.layerProps,
  });
}
```

**Key:** `updateTriggers.getPosition` is tied to `dataTrigger` (changes only on data append). Zoom/pan is handled by `viewState` changes alone — no accessor re-evaluation needed during interaction.

---

## B4 [COMPLETED] Fix: ROILayer must render in deck.gl coordinate space

**File:** `src/plot/layers/ROILayer.js`

ROIs are stored in data space (e.g., `roi.x1 = 1000` for log-x). deck.gl needs them in deck.gl space (`log10(1000) = 3`). Hit-testing already uses the d3 scale (correct), but the visual rendering was in raw data space → visual/click mismatch.

**Changes to `renderLayers()`:**

Add at the top of `renderLayers()`:
```javascript
const xIsLog = this.props.xIsLog || false;
const yIsLog = this.props.yIsLog || false;
const toX = v => xIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
const toY = v => yIsLog ? Math.log10(Math.max(v, 1e-10)) : v;
const { plotYMin, plotYMax } = this.props;
// Convert plot y-extent to deck.gl space for LinearRegion height
const deckYMin = toY(plotYMin);
const deckYMax = toY(plotYMax);
```

Replace LinearRegion polygon:
```javascript
const polygon = [
  [toX(roi.x1), deckYMin],
  [toX(roi.x2), deckYMin],
  [toX(roi.x2), deckYMax],
  [toX(roi.x1), deckYMax],
];
// Edge paths:
{ path: [[toX(roi.x1), deckYMin, 0], [toX(roi.x1), deckYMax, 0]] },
{ path: [[toX(roi.x2), deckYMin, 0], [toX(roi.x2), deckYMax, 0]] },
```

Replace RectROI polygon:
```javascript
const dx1 = toX(roi.x1), dx2 = toX(roi.x2);
const dy1 = toY(roi.y1), dy2 = toY(roi.y2);
const polygon = [[dx1, dy1], [dx2, dy1], [dx2, dy2], [dx1, dy2]];

// Handles:
const handles = [
  [dx1, dy1], [dx2, dy1], [dx1, dy2], [dx2, dy2],
  [(dx1+dx2)/2, dy1], [(dx1+dx2)/2, dy2],
  [dx1, (dy1+dy2)/2], [dx2, (dy1+dy2)/2],
].map(([hx, hy]) => ({ position: [hx, hy, 0] }));
```

Add `xIsLog` and `yIsLog` to `ROILayer.defaultProps`:
```javascript
ROILayer.defaultProps = {
  rois:       { type: 'array',    value: [] },
  plotYMin:   { type: 'number',   value: 0   },
  plotYMax:   { type: 'number',   value: 100  },
  xIsLog:     { type: 'boolean',  value: false },
  yIsLog:     { type: 'boolean',  value: false },
  onROIClick: { type: 'function', value: null, optional: true },
};
```

---

## F1 [COMPLETED] Feature: Auto-expand domain toggle (API + UI)

### PlotController changes (`src/plot/PlotController.js`)

In constructor, after existing fields:
```javascript
this._autoExpand = opts.autoExpand ?? true;
```

Replace existing `appendData` method (remove second param, use internal flag):
```javascript
appendData(chunk) {
  this._dataStore.appendData(chunk);
  this._dataTrigger++;

  if (this._autoExpand) {
    this._autoExpandDomain(chunk);
  }

  this._dirty = true;
  this.emit('dataAppended', { count: chunk.x.length, total: this._dataStore.getPointCount() });
}
```

Add new public method:
```javascript
/** Toggle whether new data appended via appendData() expands the visible domain. */
setAutoExpand(enabled) {
  this._autoExpand = !!enabled;
}
```

### ExampleApp changes (`examples/ExampleApp.jsx`)

1. Add state: `const [autoExpand, setAutoExpand] = useState(true);`
2. When checkbox changes: call `plotRef.current?.getController()?.setAutoExpand(checked)`
3. Remove the `true` second arg from `controller.appendData(initialData, true)` and `controller.appendData(chunk, true)` calls (no longer needed since it's now internal state)

---

## F2 [COMPLETED] Feature: Live append on/off checkbox

### ExampleApp changes (`examples/ExampleApp.jsx`)

1. Move append interval to a ref: `const appendIntervalRef = useRef(null);`
2. Add state: `const [liveAppend, setLiveAppend] = useState(true);`
3. Extract a `startAppend(controller)` helper that sets `appendIntervalRef.current = setInterval(...)`
4. Checkbox onChange:
   ```javascript
   if (checked) {
     startAppend(plotRef.current?.getController());
   } else {
     clearInterval(appendIntervalRef.current);
   }
   setLiveAppend(checked);
   ```
5. `useEffect` cleanup should call `clearInterval(appendIntervalRef.current)` on unmount

### UI placement
Both checkboxes go in the header bar (same `<div style={headerStyle}>` row), after the keybind list, before the ROI count. Style to match the rest of the header (monospace, dark theme).

---

## Build Verification

After all changes: run `npx webpack --mode development` from the project root. It should complete with `compiled successfully` and 0 errors.

---

## Phase 1–10 Status (carried forward from v1.1)

All phases 1–10 MVP steps were COMPLETED in the initial session. The steps above (B1–F2) are new work items discovered during user testing.

### Previously completed steps remain completed. Summary:

| Phase | Status |
|-------|--------|
| 1. Setup | COMPLETED |
| 2. Core | COMPLETED |
| 3. Axes | COMPLETED |
| 4. Deck.gl | COMPLETED |
| 5. ROI Classes | COMPLETED |
| 6. ROI Controller | COMPLETED |
| 7. Zoom/Pan | COMPLETED (but bugs B1–B2 mean it doesn't work correctly — fix via B1–B2) |
| 8. Live Append | COMPLETED |
| 9. Example | COMPLETED |
| 10. Docs | COMPLETED (README) |

---

## F7 [COMPLETED] Feature: Runtime-tunable follow-pan speed + slider control

**Files:** `src/plot/PlotController.js`, `examples/ExampleApp.jsx`

**Behaviour:**
- `FOLLOW_PAN_SPEED` is currently a hardcoded constant (0.02) inside `_scheduleRender`.
  Convert it to an instance field `this._followPanSpeed` (default 0.02) and expose a public setter `setFollowPanSpeed(value)` so callers can tune it at runtime.
- Add a `<input type="range" min="0.005" max="0.1" step="0.001">` slider to the ExampleApp header next to the "Drag pan" checkbox so the user can find a good balance interactively.
  The current value is shown as a fixed-precision number beside the slider.

**PlotController.js changes:**
1. Add `this._followPanSpeed = 0.02;` in constructor after `this._panMode`.
2. Add public method after `setPanMode()`:
   ```js
   /** @param {number} speed  Tuning range: 0.005 – 0.1 */
   setFollowPanSpeed(speed) {
     this._followPanSpeed = Math.max(0.001, Number(speed));
   }
   ```
3. In `_scheduleRender()`, remove `const FOLLOW_PAN_SPEED = 0.02;` and replace both usages with `this._followPanSpeed`.

**ExampleApp.jsx changes:**
```jsx
const [panSpeed, setPanSpeed] = useState(0.02);
const handlePanSpeedChange = (e) => {
  const v = parseFloat(e.target.value);
  plotRef.current?.getController()?.setFollowPanSpeed(v);
  setPanSpeed(v);
};
// In JSX after "Drag pan" label:
<label style={checkboxLabelStyle}>
  Pan speed
  <input type="range" min="0.005" max="0.1" step="0.001"
    value={panSpeed} onChange={handlePanSpeedChange}
    style={{ verticalAlign: 'middle', margin: '0 4px' }} />
  {panSpeed.toFixed(3)}
</label>
```

---

## F8 [COMPLETED] Feature: LineLayer example page (random-walk + live-append time series)

**Files:** `webpack.config.js`, `src/line.js` (new), `examples/LineExample.jsx` (new)

**Behaviour:**
- Separate example page (`line.html`) demonstrating `buildLineLayer` (PathLayer wrapper).
- Three independent random-walk signals (A, B, C) with distinct colours: cyan, orange, lime.
- X axis: linear sample index 0–N. Y axis: linear value range auto-fit.
- Live append: every 1 s, 500 new samples added to each signal; layer rebuilt each tick.
- Header controls: Live append checkbox, Reset button (clears signals and restarts).
- Event log panel (same style as ExampleApp, last 20 entries).
- No ROI, no scatter — line layers only.

**webpack.config.js changes:** Convert single entry to multi-entry object; add two new HtmlWebpackPlugin instances for `line.html` and `spectrogram.html`.

---

## F9 [COMPLETED] Feature: SpectrogramLayer — STFT via fft.js + BitmapLayer rendering

**Files:** `package.json` (+fft.js), `src/plot/layers/SpectrogramLayer.js` (new), `src/spectrogram.js` (new), `examples/SpectrogramExample.jsx` (new)

**Behaviour:**
- New `buildSpectrogramLayer(samples, opts)` builder function (same style as existing layer builders).
- `samples`: `Float32Array` of raw time-domain samples.
- `opts`: `{ sampleRate, windowSize=1024, hopSize=512 }`
- Internal CPU pipeline:
  1. STFT using fft.js (Hann window, radix-2); output: power matrix `[numFrames × windowSize/2]`.
  2. dB normalization (global min/max).
  3. Viridis colour-map (hardcoded 16-stop LUT — no extra dep).
  4. `ImageData` → `BitmapLayer` with bounds `[0, 0, durationSecs, sampleRate/2]`.
- Demo page (`spectrogram.html`): 5-second chirp (440 → 4400 Hz) at 44100 Hz sampleRate + pink noise.
  Live append: every 500 ms, extend chirp by 0.25 s and rebuild layer.
  Header: windowSize selector (256/512/1024/2048), Live append checkbox.

---

## B8 [COMPLETED] Fix: Spectrogram page shows blank graph

**Files:** `src/plot/layers/SpectrogramLayer.js`, `examples/SpectrogramExample.jsx`

**Symptom:** The spectrogram demo page renders axes correctly but shows no spectrogram image.

**Root causes (four compounding issues):**

### Cause A — No `dataTrigger` counter (CompositeLayer re-invocation)

`SpectrogramLayer.renderLayers()` is a CompositeLayer method that deck.gl 8.x only re-runs when the layer's props change. The `samples` prop (`type: 'object'`) uses reference equality — it changes each append because `appendSamples` creates a new `Float32Array`. This *should* work, but it is fragile and can silently break if deck.gl batches or short-circuits prop comparisons. A numeric counter prop (`dataTrigger`) is the established pattern in this codebase (`PlotController._dataTrigger`) and guarantees re-invocation.

**Fix — add `dataTrigger` to `SpectrogramLayer.defaultProps`:**
```js
SpectrogramLayer.defaultProps = {
  samples:      { type: 'object',  value: null  },
  sampleRate:   { type: 'number',  value: 44100 },
  windowSize:   { type: 'number',  value: 1024  },
  hopSize:      { type: 'number',  value: 512   },
  dataTrigger:  { type: 'number',  value: 0     },  // ← add
};
```

**SpectrogramExample.jsx** — add a ref and pass it:
```js
const dataTriggerRef = useRef(0);

// Inside appendSamples(), after growing samplesRef.current:
dataTriggerRef.current += 1;

// Inside renderFrame(), inside the SpectrogramLayer props:
dataTrigger: dataTriggerRef.current,
```

### Cause B — BitmapLayer `image` prop has no `updateTrigger`

deck.gl 8.x sub-layers inside a CompositeLayer are reconciled by ID (`'spectrogram-bitmap'`). When `renderLayers()` returns a new `BitmapLayer` with a new canvas, deck.gl checks whether the `image` prop changed. For accessor-driven props this requires `updateTriggers`; for plain object props deck.gl compares by reference — but `BitmapLayer.image` is internally handled as a texture prop and may not be re-uploaded without an explicit trigger.

**Fix — add `updateTriggers` to the BitmapLayer inside `renderLayers()`:**
```js
new BitmapLayer(this.getSubLayerProps({
  id:             'bitmap',
  image,
  bounds:         [0, 0, durationSecs, sampleRate / 2],
  updateTriggers: { image: this.props.dataTrigger },  // ← add
})),
```

### Cause C — `OffscreenCanvas` not supported as luma.gl 8.5.x texture source

`@luma.gl/core@^8.5.21` creates a `Texture2D` from the `image` prop using `gl.texImage2D`. luma.gl 8.5.x accepts `HTMLCanvasElement`, `HTMLImageElement`, and `ImageBitmap`, but `OffscreenCanvas` support is unreliable at this version. Passing an `OffscreenCanvas` may silently produce an empty/black texture.

**Fix — call `transferToImageBitmap()` to convert OffscreenCanvas to ImageBitmap before returning:**
```js
// Replace the canvas return in buildImage() with:
ctx.putImageData(imgData, 0, 0);
// Return ImageBitmap (supported by luma.gl 8.x) instead of raw OffscreenCanvas
if (canvas.transferToImageBitmap) {
  return canvas.transferToImageBitmap();
}
return canvas;  // HTMLCanvasElement fallback path — already compatible
```

### Cause D — Double Y-flip makes the spectrogram inverted (shows upside-down, not blank)

`buildImage()` manually flips rows: `row = numBins - 1 - bin` so that bin 0 (0 Hz DC) sits at the bottom row of the canvas. However, deck.gl 8.x `BitmapLayer` uploads canvas/ImageBitmap textures with `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`, which flips the image again during GPU upload. This double-flip results in 0 Hz appearing at the *top* of the spectrogram — which is visually inverted rather than blank, but on a dark background with mostly dark-purple low-power colors the error can look like a blank or near-blank image.

**Fix — remove the manual row flip from `buildImage()`; let BitmapLayer/WebGL's UNPACK_FLIP_Y do the single correct flip:**
```js
// BEFORE (double-flip — wrong):
const row = numBins - 1 - bin;

// AFTER (no manual flip — correct, WebGL UNPACK_FLIP_Y handles orientation):
const row = bin;
```

---

**Investigation checklist (run in order if fixes don't immediately resolve the blank):**

1. Add `console.log('[SpectrogramLayer] renderLayers called, numFrames=', numFrames)` at the top of `renderLayers()` — verify it's called at all and with non-zero frames.
2. Log `globalMin`, `globalMax` from `computeSTFT` — if they are equal the image is monochrome dark purple.
3. Log the first pixel of the image canvas to confirm ImageData is being written.
4. In browser DevTools → WebGL inspector (or console `gl.getError()`) — check for texture upload errors.

**After fix:** Build with `npx webpack --mode development`, 0 errors. Verify:
- Spectrogram image fills the plot area with a Viridis colour gradient (dark purple → yellow).
- The chirp sweep appears as a diagonal bright band rising left-to-right.
- 0 Hz is at the visual bottom; Nyquist (22050 Hz) is at the top (matching the y-axis tick labels).
- Live append extends the spectrogram rightward every 500 ms; the x-domain auto-expands.
- Scroll-wheel zoom and drag-pan work correctly.

---

## ✅ ALL ITEMS COMPLETED (updated — B8 included)

---

## Change Log

- **2026-02-20 [Initial]**: Plan created. All steps initialized as PENDING.
- **2026-02-20 [Claude]**: All Phases 1–10 MVP implemented. React 19, 0 vuln. Build clean.
- **2026-02-20 [Claude]**: User testing revealed 3 bugs and 2 feature requests. Full root-cause analysis done. Fix steps B1–F2 added. Next agent should implement B1→B2→B3→B4→F1→F2 in order, then rebuild.
- **2026-02-20 [Claude]**: B1–F2 all implemented. Build verified: `webpack compiled successfully` 0 errors. Removed unused `React` import from ExampleApp.jsx (JSX transform handles it).
- **2026-02-20 [Claude]**: User testing session 2. Additional fixes applied: RectROI handle naming corrected (TOP↔BOTTOM swap to match visual y-axis inversion), `xLocked` flag added for LinearRegion-parented RectROIs (x bounds pinned to parent, no left/right handles). x-axis switched to linear in example. Two new items added: B5 (inverted controls still reported on constrained RectROI — needs empirical verification and re-fix) and F3 (show roiUpdated/zoomChanged/panChanged in on-screen log panel).
- **2026-02-21 [Claude]**: B5 — static analysis confirmed handle positions and dy sign are correct. Remaining issue was the crossover-snap UX artifact: when TOP/BOTTOM handles were dragged past the opposite edge, the normalization swap + per-frame bounds-restore caused the rect to "teleport," which felt like inversion at the boundary. Fix: added per-case clamping inside `applyDelta` for HANDLES.TOP and HANDLES.BOTTOM so handles stop at zero height instead of crossing. Global normalization retained for corner handles. F3 — added `roiUpdated` (debounced 150 ms, logs after drag settles), `zoomChanged` (immediate), and `panChanged` (threshold > 5 px displacement) to ExampleApp `handleEvent`. `panChanged` was already emitted by PlotController and forwarded by PlotCanvas. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: User reports entire y-scale is visually inverted (data rendered upside-down relative to axis tick labels). Root cause identified: `_buildViewState` computes `ty` assuming `OrthographicView` has `flipY: true`, but the installed version may default to `flipY: false`. Added B6 with two fix options: Option A (add `flipY: true` to `OrthographicView`), Option B (negate y at the deck.gl layer boundary in `ScatterLayer.js` and `ROILayer.js` and rederive `ty`). No code changed — next agent to implement.
- **2026-02-21 [Claude]**: B6 — Investigation confirmed deck.gl 8.9.36 defaults to `flipY: true` in `OrthographicViewport`. Tracing the full projection pipeline revealed the `ty` formula (`deckYMin + (H/2 − marginBottom) × ySpan / pa.height`) is derived for `flipY: false` (i.e., `screenY = H/2 − scaleY × (worldY − ty)`). With the default `flipY: true` the equation inverts to `screenY = H/2 + scaleY × (worldY − ty)`, placing y=0 near the top. Fix: add `flipY: false` explicitly to `OrthographicView` in `PlotController.init()`. One-line change; no layer files needed. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: User requested three new features: pan mode toggle (follow/drag), follow pan continuous velocity joystick mode, right-click context menu suppression + drag zoom. Added F4, F5, F6. Updated prompt.md with git branch rule (rule #6). Branch `feature/F4-F5-F6` created for implementation.
- **2026-02-21 [Claude]**: F4, F5, F6 all implemented. F4: added `_panMode` state and `setPanMode()` public method; drag-pan branch in `_onMouseMove` uses restore-and-reapply with inverted signs. F5: `_panCurrentPos` added; `_scheduleRender` RAF loop applies velocity tick for follow mode (dead zone 5 px, speed 0.02). F6: `contextmenu` event suppressed; `_handleRightDown`/`_handleRightMove` private methods handle right-click drag zoom centred on click origin, restore-and-reapply pattern prevents float drift. ExampleApp: "Drag pan" checkbox added to header wired to `setPanMode`. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: B7 — Fixed y-axis pan direction bugs in F4 and F5. Root cause: the d3 y scale uses an inverted range `[plotBottom, plotTop]`, making `pxSpan` negative inside `panByPixels`, which reverses its effective direction vs x. Follow velocity (F5): changed `+dy * speed` → `-dy * speed`. Drag mode (F4): changed `panByPixels(-dy)` → `panByPixels(dy)`. Both fixes make y-axis pan direction consistent with x-axis behavior. Also added Y-axis Coordinate Convention section to `prompt.md` documenting this gotcha. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: F7 — `FOLLOW_PAN_SPEED` hardcoded constant removed from `_scheduleRender`; all 4 usages replaced with `this._followPanSpeed`. Pan speed slider (`<input type="range">` 0.005–0.1, step 0.001) added to ExampleApp header, wired to `setFollowPanSpeed()`. F8 — `LinePlotController.js` created (signal registry, mutable path arrays with `updateTriggers`, drag-pan, wheel-zoom, RAF loop, auto domain expand). `LineExample.jsx` demonstrates 3 random-walk signals (cyan/orange/lime) with live 500-sample/s append and Reset. `src/line.js` entry point + `public/line.html` template added. F9 — `fft.js` installed (npm). `SpectrogramLayer.js` (CompositeLayer): STFT with Hann window via fft.js → dB normalization → 16-stop Viridis LUT → OffscreenCanvas `ImageData` → `BitmapLayer` with bounds `[0,0,durationSecs,sampleRate/2]`. `SpectrogramExample.jsx` demonstrates chirp (440→4400 Hz) + pink noise at 44100 Hz with live 0.25 s/tick append and windowSize selector. `src/spectrogram.js` + `public/spectrogram.html` added. `webpack.config.js` converted to multi-entry (`main`/`line`/`spectrogram`) with separate `HtmlWebpackPlugin` instances per page. Build: `webpack compiled successfully` 0 errors, 3 HTML outputs.
- **2026-02-21 [Claude]**: F10 added (PENDING) — Audio file loading for SpectrogramExample. Uses browser `<input type="file">` + `AudioContext.decodeAudioData`; no webpack changes needed. Clears existing data on load, uses file's actual sampleRate for both spectrogram and waveform panels. Next agent implements F10 then rebuilds.
- **2026-02-21 [Claude]**: F10 — Audio file loading implemented. Added `fileInputRef`, `loadedSampleRateRef`, and `loading` state. `handleFileLoad` async function: stops live append, decodes via `AudioContext.decodeAudioData`, clears all existing sample/waveform data, loads full PCM into `samplesRef`, downsamples for waveform at `WAVEFORM_STEP`, updates both x-axis domains to `[0, durationSecs]` and spectrogram y-axis to `[0, sr/2]`, triggers dirty flags. `renderFrame` now uses `loadedSampleRateRef.current` instead of hardcoded `SAMPLE_RATE`. "Open audio file" button added to header after "Live append" (shows "Loading…" + disabled while decoding; re-opens same file via `e.target.value = ''`). Branch: `feature/F10`. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: B8 — Four fixes applied to resolve blank spectrogram. (A) `dataTrigger` numeric prop added to `SpectrogramLayer.defaultProps`; `SpectrogramExample` increments `dataTriggerRef` on every `appendSamples()` and `windowSize` change, passes it to the layer — guarantees deck.gl re-invokes `renderLayers()`. (B) `updateTriggers: { image: this.props.dataTrigger }` added to BitmapLayer inside `renderLayers()` — forces luma.gl texture re-upload. (C) `buildImage()` now calls `canvas.transferToImageBitmap()` if available before returning — luma.gl 8.5.x silently fails with raw `OffscreenCanvas`. (D) Manual row-flip removed (`row = bin` instead of `row = numBins - 1 - bin`): BitmapLayer/luma.gl already applies `UNPACK_FLIP_Y_WEBGL`; the previous double-flip put 0 Hz at the top. Build: `webpack compiled successfully` 0 errors.
- **2026-02-21 [Claude]**: F12, F13 added as PENDING. F12: `PlaybackController` (play/pause/stop/seek via `AudioBufferSourceNode`; `onended` uses `_userStopped` flag to distinguish natural end from manual stop), `drawPlayhead`/`formatPlayTime` helpers, RAF loop extended to force dirty-every-frame during playback and draw playhead on both axis canvases, Ctrl+click seek, Play/Pause/Stop header buttons. F13: `FilterController` (offline biquad via `OfflineAudioContext.startRendering()`, `getFrequencyResponse()` via temporary AudioContext, `originalSamplesRef` snapshot for Clear Filter), `FilterPanel` (type dropdown, log-scale cutoff slider, Q slider, live response canvas, Apply button), right sidebar refactored to stack LUT + Filter panels vertically. Both features depend on F10 (file loading) being complete.
- **2026-02-21 [Claude]**: F11 — HistogramLUTController and HistogramLUTPanel implemented. `HistogramLUTController.js`: pure EventEmitter; 6 LUT presets (viridis/grayscale/plasma/inferno/magma/hot) built as Uint8Array[256×4]; `setSpectrogramData()` computes histogram + auto-levels on first data; `setLevels()`/`setLUT()`/`autoLevel()` emit events. `HistogramLUTPanel.jsx`: canvas-based React component; ResizeObserver syncs backing store; histogram bars + gradient strip + draggable level lines drawn in one `useEffect`; LUT dropdown + Auto Level button. `SpectrogramLayer.js`: refactored to use `initializeState`/`updateState` lifecycle — STFT cached in layer state, recomputed only on `dataTrigger` change; `buildImage` now accepts `levelMin/levelMax/lut` params (Viridis fallback when no lutController); `renderLayers` reads from state only. `SpectrogramExample.jsx`: imports wired; `HistogramLUTController` created once at render init; levelsChanged/lutChanged → `setColorTrigger`; `colorTrigger` synced to ref for stale-closure safety; `renderFrame` passes `lutController`/`colorTrigger`; `handleFileLoad` calls `lutController.reset()`; spectrogram panel wrapped in row flex div with `<HistogramLUTPanel width={140} />`. Build: `webpack compiled successfully` 0 errors.
