import React from 'react';
import MermaidDiagram from './shared/MermaidDiagram';
import CodeBlock from './shared/CodeBlock';

const ORCHESTRATION_DIAGRAM = `graph TD
  PC[PlotController]

  PC --> XA[AxisController — X]
  PC --> YA[AxisController — Y]
  PC --> VP[ViewportController]
  PC --> RC[ROIController]
  PC --> DS[DataStore]
  PC --> DLR[DataLayer Registry]
  PC --> AR[AxisRenderer]
  PC --> DECK[deck.gl Deck]

  DLR --> SL[ScatterLayer]
  DLR --> SS[SignalStore / PathLayer]
  DLR --> TG[TraceGroup]
  DLR --> BDL[BitmapDataLayer]

  RC --> CE[ConstraintEngine]
  RC --> RL[ROILayer]

  XA --> AR
  YA --> AR
  VP --> XA
  VP --> YA
`;

const BITMAP_LUT_DIAGRAM = `graph TD
  AC[AudioController]
  FC[FilterController]
  LC[LUTController]
  LHC[LUTHistogramController]
  BDL[BitmapDataLayer]
  PC[PlotController — spectrogram]
  WPC[PlotController — waveform]

  subgraph UI["ui/ — optional React UI wrappers"]
    LP[LUTPanel]
    FP[FilterPanel]
    HO[HelpOverlay]
  end

  AC -->|tileReady: power Float32Array + bounds| PC
  AC -->|timeUpdate: currentTime| PC
  FC -->|setFilterFn bridge| AC
  PC -->|registerDataLayer tile-N| BDL
  BDL -->|lutController prop| LC
  LC -->|levelChanged / lutChanged → colorTrigger++| PC
  LC --> LHC
  LHC --> LP
  FP -->|onApply| FC
  AC -->|loaded: samples Float32Array| WPC
`;

const RENDER_LOOP_DIAGRAM = `sequenceDiagram
  participant RAF as requestAnimationFrame
  participant PC as PlotController
  participant DS as DataStore
  participant DV as PlotDataView
  participant REG as DataLayer Registry
  participant DECK as deck.gl Deck

  RAF->>PC: _renderLoop()
  PC->>DS: expireIfNeeded()
  alt DataView present
    PC->>DV: getData()
    DV-->>PC: cached snapshot (recomputes if dirty)
  else Direct DataStore
    PC->>DS: getGPUAttributes()
    DS-->>PC: Float32Array buffers
  end
  PC->>REG: forEach buildLayer(ctx)
  REG-->>PC: layer array
  PC->>PC: append ROILayer
  PC->>DECK: setProps({ layers })
  DECK->>DECK: WebGL draw
`;

const EVENT_BUS_DIAGRAM = `graph LR
  DS[DataStore] -->|dirty, dataExpired| PC
  DV[PlotDataView] -->|dirty| PC
  XA[AxisController X] -->|domainChanged| PC
  YA[AxisController Y] -->|domainChanged| PC
  RC[ROIController] -->|roiCreated, roiUpdated, roiFinalized, roiDeleted, roiExternalUpdate, roisChanged| PC
  PC -->|domainChanged, zoomChanged, panChanged, dataAppended, roiCreated, roiUpdated, roiFinalized, roiDeleted, roiExternalUpdate, autoScaled| REACT[React Components]
`;

const COORD_CODE = `// d3 y-scale uses an inverted range so y=0 is at the visual bottom:
yScale = d3.scaleLinear()
  .domain([yMin, yMax])
  .range([plotBottom_px, plotTop_px]);   // note: bottom > top in CSS pixels

// deck.gl OrthographicView is configured with:
new OrthographicView({ id: 'plot', flipY: false })

// Pan sign convention (inside AxisController.panByPixels):
//   x axis: pxSpan > 0  →  panByPixels(+n) shifts domain right (viewport left)
//   y axis: pxSpan < 0  →  panByPixels(+n) shifts domain up   (double-negation)
//
// Follow-scroll:  xAxis.panByPixels(-dx),  yAxis.panByPixels(+dy)
// Drag pan:       xAxis.panByPixels(+dx),  yAxis.panByPixels(+dy)
`;

const DATA_FLOW_CODE = `// 1. Append raw data (CPU side)
ctrl.appendData({
  x:     Float32Array([...]),
  y:     Float32Array([...]),
  color: Uint8Array([...]),   // packed RGBA per point
  size:  Float32Array([...]),
});

// 2. DataStore writes into Float32Array ring buffer (GPU-friendly, no alloc)
//    If rolling mode: _headIndex advances, old tail evicted via expireIfNeeded()

// 3. On each RAF tick: getGPUAttributes() returns typed-array subarrays
//    (zero-copy in non-rolling mode; ordered copy in rolling mode)

// 4. Layer accessor pulls position directly from GPU buffer:
getPosition: (_, { index, data }) => [data.x[index], data.y[index], 0]

// 5. deck.gl uploads Float32Array to WebGL as instanced attribute — no JS objects per point
`;

const sectionStyle = {
  marginBottom: 56,
};

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
  margin: '24px 0 10px',
};

const pStyle = {
  fontSize: 14,
  lineHeight: 1.8,
  color: '#bbb',
  marginBottom: 12,
};

const tableStyle = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  marginBottom: 16,
};

const thStyle = {
  background: '#1a1a1a',
  color: '#7df',
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #333',
};

const tdStyle = {
  padding: '7px 12px',
  borderBottom: '1px solid #1e1e1e',
  color: '#ccc',
  verticalAlign: 'top',
};

export default function ArchitecturePage() {
  return (
    <section id="architecture" style={sectionStyle}>
      <h2 style={h2Style}>Architecture</h2>

      

      {/* 1. What is MasterPlot */}
      <h3 style={h3Style}>What is MasterPlot?</h3>
      <p style={pStyle}>
        MasterPlot is a production-grade scientific plotting engine built on React and deck.gl. Unlike
        chart libraries that re-render through the React reconciler, MasterPlot is controller-driven:
        all geometry, zoom state, and ROI data live exclusively inside plain JavaScript controller
        objects that communicate via Node-style EventEmitter events. React only manages UI toggles and
        configuration — it never holds a single data point or coordinate.
      </p>
      <p style={pStyle}>
        Rendering is handled by deck.gl{'\u2019'}s <code style={{ color: '#fd9' }}>OrthographicView</code> with
        GPU-instanced layers operating directly on <code style={{ color: '#fd9' }}>Float32Array</code> buffers,
        enabling smooth interaction with 10M+ points. Axes are drawn on a Canvas 2D overlay using
        d3-scale for tick generation and coordinate transforms. The ROI system mirrors pyqtgraph —
        LinearRegions can contain RectROIs with constraint propagation, monotonic versioning, and
        external serialization.
      </p>

      {/* 2. PlotController orchestration */}
      <h3 style={h3Style}>PlotController Orchestration</h3>
      <p style={pStyle}>
        <code style={{ color: '#fd9' }}>PlotController</code> is the central coordinator. It owns the deck.gl
        Deck instance, two AxisControllers (x and y), a ViewportController, an ROIController, and a
        pluggable DataLayer Registry. All sub-controllers are wired together inside{' '}
        <code style={{ color: '#fd9' }}>_wireEvents()</code> — a single place where inter-controller events are
        forwarded and React-visible events are re-emitted on the PlotController itself.
      </p>
      <MermaidDiagram chart={ORCHESTRATION_DIAGRAM} />

      {/* 3. Render loop */}
      <h3 style={h3Style}>Render Loop</h3>
      <p style={pStyle}>
        Each <code style={{ color: '#fd9' }}>requestAnimationFrame</code> tick calls{' '}
        <code style={{ color: '#fd9' }}>_renderLoop()</code>, which first evicts stale rolling-buffer
        entries, then fetches GPU-ready data (either via a lazy PlotDataView snapshot or directly from
        DataStore), drives the DataLayer Registry to build deck.gl layers, appends the ROILayer, and
        calls <code style={{ color: '#fd9' }}>deck.setProps()</code> — bypassing React entirely.
      </p>
      <MermaidDiagram chart={RENDER_LOOP_DIAGRAM} />

      {/* 4. Event bus */}
      <h3 style={h3Style}>Event Bus</h3>
      <p style={pStyle}>
        Every sub-controller emits domain-specific events. PlotController listens to all of them
        inside <code style={{ color: '#fd9' }}>_wireEvents()</code> and re-emits a curated subset upward
        for React. This creates a one-way data flow: sub-controllers never know about React, and React
        never reads from sub-controller internals.
      </p>
      <MermaidDiagram chart={EVENT_BUS_DIAGRAM} />

      {/* 5. Coordinate systems */}
      <h3 style={h3Style}>Coordinate Systems</h3>
      <p style={pStyle}>
        MasterPlot uses three coordinate spaces that must be kept distinct:
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Space</th>
            <th style={thStyle}>Units</th>
            <th style={thStyle}>Origin</th>
            <th style={thStyle}>Used by</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Data space</td>
            <td style={tdStyle}>User units (e.g. seconds, Hz)</td>
            <td style={tdStyle}>Depends on domain</td>
            <td style={tdStyle}>DataStore, ROI bounds, AxisController domain</td>
          </tr>
          <tr>
            <td style={tdStyle}>Screen space</td>
            <td style={tdStyle}>CSS pixels</td>
            <td style={tdStyle}>Top-left of canvas</td>
            <td style={tdStyle}>Mouse events, AxisRenderer tick positions</td>
          </tr>
          <tr>
            <td style={tdStyle}>deck.gl world space</td>
            <td style={tdStyle}>Data units (identity transform)</td>
            <td style={tdStyle}>Same as data space</td>
            <td style={tdStyle}>OrthographicView viewState, layer getPosition</td>
          </tr>
        </tbody>
      </table>
      <p style={pStyle}>
        The d3 y-scale uses an <strong>inverted range</strong> —{' '}
        <code style={{ color: '#fd9' }}>range([plotBottom_px, plotTop_px])</code> — so that y=0 appears at
        the visual bottom and y=max at the top (standard scientific convention). Because{' '}
        <code style={{ color: '#fd9' }}>OrthographicView</code> is configured with{' '}
        <code style={{ color: '#fd9' }}>flipY: false</code>, the GPU projection does not flip Y. This means
        pan interaction code must negate dy relative to dx — see the pan sign convention below.
      </p>
      <CodeBlock code={COORD_CODE} language="javascript" />

      {/* 6. Data flow */}
      <h3 style={h3Style}>Data Flow</h3>
      <p style={pStyle}>
        Data enters the engine via <code style={{ color: '#fd9' }}>PlotController.appendData()</code>, which
        delegates to <code style={{ color: '#fd9' }}>DataStore</code>. The store holds{' '}
        <code style={{ color: '#fd9' }}>Float32Array</code> buffers for x, y, and size, and a{' '}
        <code style={{ color: '#fd9' }}>Uint8Array</code> for RGBA colors. In rolling mode, a ring buffer
        is used — the head index advances on append and the tail advances on eviction, so GPU buffers
        are never reallocated. Layer accessors read directly from these typed arrays by index, so no
        per-point JavaScript objects are ever created during rendering.
      </p>
      <CodeBlock code={DATA_FLOW_CODE} language="javascript" />

      {/* 7. Phase 4 — Bitmap / LUT / Audio pipeline */}
      <h3 style={h3Style}>Phase 4 — Bitmap / LUT / Audio Pipeline</h3>
      <p style={pStyle}>
        Phase 4 introduces composable primitives for 2D image rendering with interactive LUT control.
        Instead of a monolithic spectrogram layer, any numeric 2D grid (STFT power, heatmap, image segment)
        is displayed through a generic{' '}
        <code style={{ color: '#fd9' }}>BitmapDataLayer</code> with a per-layer{' '}
        <code style={{ color: '#fd9' }}>LUTController</code> driving CPU colorization.
      </p>
      <p style={pStyle}>
        <strong style={{ color: '#ccc' }}>BitmapDataLayer</strong> — deck.gl CompositeLayer accepting a URL,
        ImageBitmap, or TypedArray source. For TypedArray sources the layer runs{' '}
        <code style={{ color: '#fd9' }}>_buildBitmapFromGrid()</code> on the CPU to produce an{' '}
        <code style={{ color: '#fd9' }}>ImageBitmap</code>, then passes it to a BitmapLayer. The{' '}
        <code style={{ color: '#fd9' }}>dataTrigger</code> prop gates re-upload; the{' '}
        <code style={{ color: '#fd9' }}>colorTrigger</code> prop gates recolorization only.
      </p>
      <p style={pStyle}>
        <strong style={{ color: '#ccc' }}>LUTController</strong> — pure EventEmitter managing a colormap
        and level window (min/max). The <code style={{ color: '#fd9' }}>version</code> getter is a monotonic
        counter incremented on every <code style={{ color: '#fd9' }}>levelChanged</code> or{' '}
        <code style={{ color: '#fd9' }}>lutChanged</code> event — components use it as{' '}
        <code style={{ color: '#fd9' }}>colorTrigger</code>.
      </p>
      <p style={pStyle}>
        <strong style={{ color: '#ccc' }}>LUTHistogramController</strong> — owns an internal read-only
        PlotController (<code style={{ color: '#fd9' }}>disablePanZoom: true</code>) that renders a
        horizontal histogram bar chart and two draggable hline LineROIs for level handles. Dragging a
        handle calls <code style={{ color: '#fd9' }}>lutController.setLevels()</code>, which bumps the
        version and triggers BitmapDataLayer recolorization without touching React state.
      </p>
      <p style={pStyle}>
        <strong style={{ color: '#ccc' }}>ui/ — optional React UI wrappers</strong> — convenience components
        shipped alongside the engine: <code style={{ color: '#fd9' }}>LUTPanel</code> (histogram +
        level handles + colormap select), <code style={{ color: '#fd9' }}>FilterPanel</code> (filter
        type / frequency controls), and <code style={{ color: '#fd9' }}>HelpOverlay</code> (first-load
        keybind cheatsheet that auto-shows on first visit via <code style={{ color: '#fd9' }}>localStorage</code>).
        These live in <code style={{ color: '#fd9' }}>ui/</code>, NOT in <code style={{ color: '#fd9' }}>src/</code> — users are
        expected to build their own UI on top of the controller events; the <code style={{ color: '#fd9' }}>ui/</code> components are
        provided as a courtesy.
      </p>
      <p style={pStyle}>
        <strong style={{ color: '#ccc' }}>AudioController</strong> — unified controller absorbing
        PlaybackController and STFT logic. Audio is loaded via{' '}
        <code style={{ color: '#fd9' }}>loadFile(arrayBuffer)</code> (Web Audio decode) or{' '}
        <code style={{ color: '#fd9' }}>loadBuffer(samples, sr)</code>. STFT is computed in fixed-width
        time tiles via <code style={{ color: '#fd9' }}>computeSTFT()</code>; each tile emits{' '}
        <code style={{ color: '#fd9' }}>tileReady</code> with a <code style={{ color: '#fd9' }}>power Float32Array</code>{' '}
        and <code style={{ color: '#fd9' }}>bounds: [tStart, 0, tEnd, nyquist]</code>. A stateless{' '}
        <code style={{ color: '#fd9' }}>setFilterFn</code> bridge connects FilterController without coupling.
      </p>
      <MermaidDiagram chart={BITMAP_LUT_DIAGRAM} />
    </section>
  );
}
