import React from 'react';
import CodeBlock from './shared/CodeBlock';

// ── Code samples ─────────────────────────────────────────────────────────────

const INSTALL_CODE = `# Clone and install dependencies
git clone https://github.com/madalex1997/MasterPlot.git
cd MasterPlot
npm install`;

const WEBPACK_ENTRY_CODE = `// src/myplot.js  —  webpack entry point
import React from 'react';
import { createRoot } from 'react-dom/client';
import MyApp from '../examples/MyApp.jsx';

createRoot(document.getElementById('root')).render(<MyApp />);`;

const HTML_TEMPLATE_CODE = `<!-- public/myplot.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My Plot</title>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;

const MOUNT_CODE = `import React, { useRef } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';

export default function MyApp() {
  const ctrlRef = useRef(null);

  function handleInit(ctrl) {
    ctrlRef.current = ctrl;

    // Append 1 000 static points
    const count = 1000;
    const x     = new Float32Array(count);
    const y     = new Float32Array(count);
    const size  = new Float32Array(count);
    const color = new Uint8Array(count * 4);

    for (let i = 0; i < count; i++) {
      x[i]    = Math.random() * 100;
      y[i]    = Math.random() * 100;
      size[i] = 4;
      const b = i * 4;
      color[b] = 80; color[b+1] = 160; color[b+2] = 240; color[b+3] = 200;
    }

    ctrl.appendData({ x, y, size, color });
  }

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <PlotCanvas
        xDomain={[0, 100]}
        yDomain={[0, 100]}
        xLabel="X"
        yLabel="Y"
        onInit={handleInit}
      />
    </div>
  );
}`;

const LIVE_APPEND_CODE = `function handleInit(ctrl) {
  ctrl.setAutoExpand(true);   // domain grows automatically when new data exceeds current bounds

  // Append a batch every 2 seconds
  // GPU buffers grow with doubling strategy — no full reallocation
  setInterval(() => {
    const count = 500;
    const x     = new Float32Array(count);
    const y     = new Float32Array(count);
    const size  = new Float32Array(count).fill(3);
    const color = new Uint8Array(count * 4);

    const now = Date.now() / 1000;
    for (let i = 0; i < count; i++) {
      x[i] = now + i / count;            // wall-clock x
      y[i] = Math.sin(now + i * 0.01);   // sine wave y
      const b = i * 4;
      color[b] = 100; color[b+1] = 220; color[b+2] = 100; color[b+3] = 200;
    }

    ctrl.appendData({ x, y, size, color });
  }, 2000);
}`;

const ZOOM_PAN_CODE = `// Wheel zoom and drag-pan are active by default — no setup required.

// Switch pan mode:
ctrl.setPanMode('drag');    // left-click drag moves viewport (default)
ctrl.setPanMode('follow');  // viewport chases cursor position

// Reset zoom to home domain (or to data extents if no home set):
ctrl.autoScale();           // also triggered by pressing Spacebar

// Set a custom home domain for the spacebar reset:
ctrl.setHomeDomain(
  { min: 0, max: 100 },    // x domain
  { min: -1, max: 1 }      // y domain
);`;

const ROI_CODE = `// ROI creation is keyboard-driven — no setup needed beyond PlotCanvas.
//
// Press  L  on the plot canvas → LinearRegion creation mode
//   Click once to anchor x1, click again to anchor x2.
//
// Press  R  → RectROI creation mode (must be inside a LinearRegion)
//   Click top-left corner, click bottom-right corner.
//
// Constraint propagation:
//   Dragging the parent LinearRegion shifts all child RectROIs automatically.
//   Children are clamped to [parent.x1, parent.x2] on every drag tick.
//
// Press  D  → delete the selected ROI.
// Press  V  → create a vertical LineROI (single click to place).
// Press  H  → create a horizontal LineROI (single click to place).
//
// To create ROIs programmatically:
import { LinearRegion } from '../src/plot/ROI/LinearRegion.js';

function handleInit(ctrl) {
  const roi = new LinearRegion({ x1: 20, x2: 60 });
  roi.bumpVersion();
  ctrl.roiController.addROI(roi);
  roi.onCreate();
  ctrl.roiController.emit('roisChanged', {
    rois: ctrl.roiController.getAllROIs(),
  });
}`;

const EVENTS_CODE = `function handleInit(ctrl) {
  // ROI committed (mouseup after drag, or after programmatic creation)
  ctrl.on('roiFinalized', ({ roi }) => {
    const { id, version, domain } = roi;
    console.log('ROI finalized:', id, 'v' + version, domain);
    // domain = { x: [x1, x2] }  for LinearRegion / LineROI
    // domain = { x: [x1, x2], y: [y1, y2] }  for RectROI
  });

  // Viewport change (zoom or pan)
  ctrl.on('domainChanged', ({ xDomain, yDomain }) => {
    console.log('X domain:', xDomain, '  Y domain:', yDomain);
  });

  // Live append confirmed
  ctrl.on('dataAppended', ({ count }) => {
    console.log('Appended', count, 'points');
  });

  // Zoom level changed
  ctrl.on('zoomChanged', ({ zoom }) => {
    console.log('Zoom:', zoom);
  });

  // ROI lifecycle
  ctrl.on('roiCreated',  ({ roi }) => console.log('Created',  roi.id));
  ctrl.on('roiDeleted',  ({ roi }) => console.log('Deleted',  roi.id));
  ctrl.on('roiUpdated',  ({ roi }) => console.log('Dragging', roi.id));
}`;

const BITMAP_CODE = `import React from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { BitmapDataLayer } from '../src/plot/layers/BitmapDataLayer.js';
import { LUTController } from '../src/plot/layers/LUTController.js';
import { LUTHistogramController } from '../src/plot/LUTHistogramController.js';
import LUTPanel from '../ui/LUTPanel.jsx';

// Construct at module level (outside React) — these are not React state
const lutController  = new LUTController();
const lutHistCtrl    = new LUTHistogramController({ lutController });

// Generate a 64×64 Float32 heatmap (sum of two Gaussians)
function makeHeatmap(w, h) {
  const arr = new Float32Array(w * h);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const dx1 = (c - w * 0.3) / (w * 0.15), dy1 = (r - h * 0.4) / (h * 0.15);
      const dx2 = (c - w * 0.7) / (w * 0.20), dy2 = (r - h * 0.6) / (h * 0.20);
      arr[r * w + c] = Math.exp(-0.5 * (dx1*dx1 + dy1*dy1))
                     + Math.exp(-0.5 * (dx2*dx2 + dy2*dy2));
    }
  }
  return arr;
}

const W = 64, H = 64;
const heatmap = makeHeatmap(W, H);
lutController.setData(heatmap, 0, 2);   // feed data to histogram

let _dataTrigger = 0;

export default function HeatmapExample() {
  function handleInit(ctrl) {
    // Disable the default scatter layer and register our BitmapDataLayer instead
    ctrl.registerDataLayer('heatmap', (ctx) => new BitmapDataLayer({
      id: 'heatmap-layer',
      source:        heatmap,
      bitMapping:    { bounds: [0, 0, 100, 100] },  // data-space [left, bottom, right, top]
      width: W, height: H,
      channels:      'gray',
      dtype:         'float32',
      lutController,
      dataTrigger:   _dataTrigger,
      colorTrigger:  lutController.version,
    }));

    // Re-render whenever LUT levels or colormap change
    lutController.on('levelChanged', () => ctrl.markDirty());
    lutController.on('lutChanged',   () => ctrl.markDirty());
  }

  return (
    <div style={{ display: 'flex', width: '100%', height: 400 }}>
      <PlotCanvas
        xDomain={[0, 100]} yDomain={[0, 100]}
        disableDefaultDataLayer
        onInit={handleInit}
        style={{ flex: 1, height: '100%' }}
      />
      {/* LUTPanel sidebar — level handles + colormap select + Auto Level */}
      <LUTPanel lutController={lutController} lutHistCtrl={lutHistCtrl} width={160} />
    </div>
  );
}`;

const AUDIO_CODE = `import React, { useRef, useState } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { AudioController } from '../src/audio/AudioController.js';
import { BitmapDataLayer } from '../src/plot/layers/BitmapDataLayer.js';
import { LUTController } from '../src/plot/layers/LUTController.js';

// Construct at module level — never in React state
const audioCtrl = new AudioController();
const lutCtrl   = new LUTController();

export default function SpectrogramExample() {
  const spectCtrlRef = useRef(null);
  const [status, setStatus] = useState('Load a .wav/.mp3 file to begin');

  // Wire AudioController tileReady → BitmapDataLayer per tile
  function handleInit(ctrl) {
    spectCtrlRef.current = ctrl;

    audioCtrl.on('tileReady', ({ tileIndex, power, width, height,
                                 globalMin, globalMax, bounds }) => {
      lutCtrl.setData(power, globalMin, globalMax);   // feed histogram

      ctrl.registerDataLayer('tile-' + tileIndex, () => new BitmapDataLayer({
        id:           'tile-' + tileIndex,
        source:       power,
        bitMapping:   { bounds },   // [tStart, 0, tEnd, nyquist]
        width, height,
        channels:     'gray',
        dtype:        'float32',
        lutController: lutCtrl,
        dataTrigger:  tileIndex,
        colorTrigger: lutCtrl.version,
      }));
      ctrl.markDirty();
    });

    lutCtrl.on('levelChanged', () => ctrl.markDirty());
    lutCtrl.on('lutChanged',   () => ctrl.markDirty());
  }

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('Decoding…');
    const buf = await file.arrayBuffer();
    await audioCtrl.loadFile(buf);
    setStatus('Computing STFT…');
    spectCtrlRef.current?.xAxis.setDomain([0, audioCtrl.duration]);
    spectCtrlRef.current?.yAxis.setDomain([0, audioCtrl.sampleRate / 2]);
    await audioCtrl.computeSTFT({ windowSize: 1024, hopSize: 512 });
    setStatus('Done — press Play');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 400 }}>
      <div style={{ padding: '8px 0' }}>
        <input type="file" accept="audio/*" onChange={handleFile} />
        <span style={{ marginLeft: 12, color: '#888', fontSize: 13 }}>{status}</span>
        <button onClick={() => audioCtrl.play()}>Play</button>
        <button onClick={() => audioCtrl.pause()}>Pause</button>
        <button onClick={() => audioCtrl.stop()}>Stop</button>
      </div>
      <PlotCanvas
        xDomain={[0, 1]} yDomain={[0, 22050]}
        xLabel="Time (s)" yLabel="Frequency (Hz)"
        disableDefaultDataLayer
        onInit={handleInit}
        style={{ flex: 1 }}
      />
    </div>
  );
}`;

const SHARED_STORE_CODE = `import React, { useRef } from 'react';
import PlotCanvas from '../src/components/PlotCanvas.jsx';
import { DataStore } from '../src/plot/DataStore.js';

// One DataStore shared between both plots — lives outside React tree
let _store = null;
function getStore() {
  if (!_store) _store = new DataStore();
  return _store;
}

export default function SharedExample() {
  const store = getStore();

  function handleInitA(ctrl) {
    // Plot A: show all data, draw ROIs
    ctrl.appendData(generateBatch(5000));
  }

  function handleInitB(ctrl) {
    // Plot B: show the same data — no separate array copy
    // PlotController reads directly from the shared DataStore via setDataView()
  }

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <PlotCanvas
        xDomain={[0, 100]} yDomain={[0, 100]}
        dataStore={store}
        onInit={handleInitA}
        style={{ flex: 1, height: 400 }}
      />
      <PlotCanvas
        xDomain={[0, 100]} yDomain={[0, 100]}
        dataStore={store}   // same store — zero duplication
        onInit={handleInitB}
        style={{ flex: 1, height: 400 }}
      />
    </div>
  );
}`;

// ── Styles ────────────────────────────────────────────────────────────────────

const sectionStyle = { marginBottom: 56 };

const h2Style = {
  fontSize: 22,
  fontWeight: 700,
  color: '#fff',
  marginBottom: 20,
  paddingBottom: 10,
  borderBottom: '1px solid #222',
};

const h3Style = {
  fontSize: 16,
  fontWeight: 700,
  color: '#7df',
  margin: '28px 0 10px',
};

const stepBadgeStyle = {
  display: 'inline-block',
  width: 22,
  height: 22,
  lineHeight: '22px',
  textAlign: 'center',
  background: '#1a3a4a',
  border: '1px solid #2a6a8a',
  borderRadius: '50%',
  fontSize: 12,
  fontWeight: 700,
  color: '#7df',
  marginRight: 10,
  flexShrink: 0,
  verticalAlign: 'middle',
};

const pStyle = {
  fontSize: 14,
  lineHeight: 1.8,
  color: '#bbb',
  marginBottom: 12,
};

const calloutStyle = {
  background: '#0e1e14',
  border: '1px solid #1e4a2a',
  borderRadius: 6,
  padding: '10px 14px',
  fontSize: 13,
  color: '#8ec',
  marginBottom: 16,
  lineHeight: 1.7,
};

const inlineCode = { color: '#fd9', fontFamily: 'monospace', fontSize: '0.95em' };

const demoBtnStyle = {
  display: 'inline-block',
  padding: '6px 14px',
  background: '#1a1a1a',
  border: '1px solid #3a3a3a',
  borderRadius: 4,
  color: '#7df',
  fontSize: 12,
  textDecoration: 'none',
  cursor: 'pointer',
  marginTop: 8,
  transition: 'border-color 0.15s',
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GettingStartedPage() {
  return (
    <section id="getting-started" style={sectionStyle}>
      <h2 style={h2Style}>Getting Started</h2>

      <p style={pStyle}>
        This tutorial walks through the seven essential steps to go from installation to a fully
        interactive scientific plot with live data, ROIs, event listeners, and shared data stores.
        Each step includes a copy-ready code block.
      </p>

      {/* Step 1: Install */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>1</span>Install
      </h3>
      <p style={pStyle}>
        Clone the repository and install Node dependencies. MasterPlot is built with plain React +
        Webpack; no TypeScript or bundler plugins beyond what is already configured.
      </p>
      <CodeBlock code={INSTALL_CODE} language="bash" />
      <p style={pStyle}>
        Each page in the demo hub corresponds to a separate Webpack entry point. To add your own
        page, create an entry file (<code style={inlineCode}>src/myplot.js</code>) and a matching
        HTML template under <code style={inlineCode}>public/</code>:
      </p>
      <CodeBlock code={WEBPACK_ENTRY_CODE} language="javascript" />
      <CodeBlock code={HTML_TEMPLATE_CODE} language="markup" />

      {/* Step 2: Mount a plot */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>2</span>Mount a Plot
      </h3>
      <p style={pStyle}>
        <code style={inlineCode}>PlotCanvas</code> is the React wrapper around{' '}
        <code style={inlineCode}>PlotController</code>. Pass an{' '}
        <code style={inlineCode}>onInit</code> callback to receive the controller instance — that
        is the only place you ever interact with plot internals from React. React must NOT store
        the controller in state; use a ref instead.
      </p>
      <div style={calloutStyle}>
        <strong>Rule:</strong> React owns no geometry. Keep{' '}
        <code style={inlineCode}>ctrlRef.current</code> in a ref, never in{' '}
        <code style={inlineCode}>useState</code>. Data arrays must not be stored in React state
        either — they live inside <code style={inlineCode}>DataStore</code> and are only ever
        touched by GPU-layer accessors.
      </div>
      <CodeBlock code={MOUNT_CODE} language="jsx" />

      {/* Step 3: Live data append */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>3</span>Live Data Append
      </h3>
      <p style={pStyle}>
        Call <code style={inlineCode}>ctrl.appendData()</code> at any time — inside a{' '}
        <code style={inlineCode}>setInterval</code>, a WebSocket handler, or an animation loop.{' '}
        <code style={inlineCode}>DataStore</code> writes into pre-allocated{' '}
        <code style={inlineCode}>Float32Array</code> buffers with a doubling-growth strategy, so
        no full reallocation occurs until the buffer is exhausted. Enable{' '}
        <code style={inlineCode}>setAutoExpand(true)</code> so the domain stretches automatically
        as new data arrives outside the current view.
      </p>
      <CodeBlock code={LIVE_APPEND_CODE} language="javascript" />
      <div style={calloutStyle}>
        <strong>Rolling mode (optional):</strong> to keep only the last N seconds of data, call{' '}
        <code style={inlineCode}>ctrl.dataStore.enableRolling{'({ maxAgeMs: 30_000 })'}</code>.
        Old entries are evicted at the tail of the ring buffer each RAF tick via{' '}
        <code style={inlineCode}>expireIfNeeded()</code> — no JS objects are ever copied.
      </div>

      {/* Step 4: Zoom and pan */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>4</span>Zoom and Pan
      </h3>
      <p style={pStyle}>
        Wheel zoom centered on the cursor and left-click drag-pan are active by default; no extra
        wiring is needed. Two pan modes are available: <code style={inlineCode}>'drag'</code>{' '}
        (pans on every mouse-move while held) and <code style={inlineCode}>'follow'</code>{' '}
        (viewport velocity chases cursor distance from center). Pressing{' '}
        <strong>Spacebar</strong> calls{' '}
        <code style={inlineCode}>autoScale()</code>, which resets the view to the home domain (or
        to actual data extents if no home is set).
      </p>
      <CodeBlock code={ZOOM_PAN_CODE} language="javascript" />
      <div style={calloutStyle}>
        <strong>Y-axis sign convention:</strong> the d3 y-scale uses an inverted range so that
        y=0 appears at the visual bottom. Pan interaction code accounts for this automatically
        inside <code style={inlineCode}>AxisController.panByPixels()</code>. You should not need
        to negate dy yourself unless you are writing custom interaction code — see the Architecture
        page for details.
      </div>

      {/* Step 5: Add a LinearRegion ROI */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>5</span>Add a LinearRegion ROI
      </h3>
      <p style={pStyle}>
        MasterPlot ships a full pyqtgraph-style ROI system out of the box. All creation is
        keyboard-driven — no additional React state or event handlers required on your part.
      </p>
      <CodeBlock code={ROI_CODE} language="javascript" />
      <div style={calloutStyle}>
        <strong>Constraint propagation:</strong> dragging a{' '}
        <code style={inlineCode}>LinearRegion</code> automatically shifts all child{' '}
        <code style={inlineCode}>RectROI</code> objects via{' '}
        <code style={inlineCode}>ConstraintEngine.applyConstraints()</code>. Children are clamped
        to the parent bounds. On mouseup, only ROIs whose bounds actually changed receive a
        version bump and a <code style={inlineCode}>roiFinalized</code> event.
      </div>

      {/* Step 6: Listen to events */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>6</span>Listen to Events
      </h3>
      <p style={pStyle}>
        <code style={inlineCode}>PlotController</code> extends{' '}
        <code style={inlineCode}>EventEmitter</code> and re-emits all sub-controller events at the
        top level. Subscribe with <code style={inlineCode}>ctrl.on()</code> inside your{' '}
        <code style={inlineCode}>onInit</code> callback. Clean up with{' '}
        <code style={inlineCode}>ctrl.off()</code> or call{' '}
        <code style={inlineCode}>ctrl.destroy()</code> on unmount to remove all listeners and
        cancel the RAF loop.
      </p>
      <CodeBlock code={EVENTS_CODE} language="javascript" />

      {/* Step 7: Shared DataStore */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>7</span>Shared DataStore (Advanced)
      </h3>

      <p style={pStyle}>
        Multiple <code style={inlineCode}>PlotCanvas</code> instances can share a single{' '}
        <code style={inlineCode}>DataStore</code>. Pass the same store via the{' '}
        <code style={inlineCode}>dataStore</code> prop — both controllers read from the same
        typed-array buffers, so there is zero data duplication. You can layer a{' '}
        <code style={inlineCode}>PlotDataView</code> on top to filter points by domain or by ROI
        bounding box, updating lazily only when the underlying data or ROI changes.
      </p>
      <CodeBlock code={SHARED_STORE_CODE} language="jsx" />
      <div style={calloutStyle}>
        Create the <code style={inlineCode}>DataStore</code> at module level (outside React) so it
        survives re-renders without triggering them. See the live demo for the full pattern including
        a filtered view on Plot B.
      </div>
      <a
        href="shared-data.html"
        style={demoBtnStyle}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7df'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a'; }}
      >
        Live demo: Shared DataStore example &rarr;
      </a>

      {/* Step 8: Displaying a heatmap / image */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>8</span>Displaying a Heatmap or Image (Phase 4)
      </h3>
      <p style={pStyle}>
        Any 2D numeric array or image can be rendered inside a{' '}
        <code style={inlineCode}>PlotController</code> via{' '}
        <code style={inlineCode}>BitmapDataLayer</code>. Pass a{' '}
        <code style={inlineCode}>Float32Array</code> (or{' '}
        <code style={inlineCode}>Uint8Array</code>, URL, or{' '}
        <code style={inlineCode}>ImageBitmap</code>) as the{' '}
        <code style={inlineCode}>source</code>, set <code style={inlineCode}>bitMapping</code>{' '}
        to position it in data space, and wire a{' '}
        <code style={inlineCode}>LUTController</code> for interactive colormap and level control.
        The optional <code style={inlineCode}>LUTPanel</code> React component provides a
        histogram sidebar with draggable level handles out-of-the-box.
      </p>
      <CodeBlock code={BITMAP_CODE} language="jsx" />
      <div style={calloutStyle}>
        <strong>dataTrigger vs colorTrigger:</strong>{' '}
        increment <code style={inlineCode}>dataTrigger</code> when the source array changes
        (re-upload to GPU); increment <code style={inlineCode}>colorTrigger</code> (use{' '}
        <code style={inlineCode}>lutController.version</code>) when only the colormap or
        levels changed. Using separate triggers avoids redundant GPU uploads on every
        level-drag mousemove.
      </div>
      <a
        href="bitmap.html"
        style={demoBtnStyle}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7df'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a'; }}
      >
        Live demo: Bitmap Layers (EX16) &rarr;
      </a>

      {/* Step 9: AudioController */}
      <h3 style={h3Style}>
        <span style={stepBadgeStyle}>9</span>AudioController + Spectrogram (Phase 4)
      </h3>
      <p style={pStyle}>
        <code style={inlineCode}>AudioController</code> handles audio loading (file or raw
        Float32Array), playback (play/pause/stop/seek with{' '}
        <code style={inlineCode}>timeUpdate</code> at ~10 Hz), and tiled STFT via{' '}
        <code style={inlineCode}>computeSTFT()</code>. Each tile emits{' '}
        <code style={inlineCode}>tileReady</code> with a{' '}
        <code style={inlineCode}>power Float32Array</code> and spatial{' '}
        <code style={inlineCode}>bounds: [tStart, 0, tEnd, nyquist]</code>, ready to pass
        directly to <code style={inlineCode}>BitmapDataLayer</code>. A stateless{' '}
        <code style={inlineCode}>setFilterFn</code> bridge connects{' '}
        <code style={inlineCode}>FilterController</code> without tight coupling.
      </p>
      <CodeBlock code={AUDIO_CODE} language="jsx" />
      <div style={calloutStyle}>
        <strong>Streaming mode:</strong> call{' '}
        <code style={inlineCode}>audioCtrl.appendSamples(newChunk)</code> to extend the buffer
        incrementally (e.g. from a WebSocket). A streaming timer automatically recomputes the
        last STFT tile each interval so the spectrogram stays current without re-running the
        full STFT.
      </div>
      <a
        href="spectrogram-v2.html"
        style={demoBtnStyle}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={e => { e.currentTarget.style.borderColor = '#7df'; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a3a'; }}
      >
        Live demo: Spectrogram V2 (EX-Spec) &rarr;
      </a>
    </section>
  );
}
