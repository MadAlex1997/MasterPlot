import React from 'react';
import MermaidDiagram from './shared/MermaidDiagram';
import CodeBlock from './shared/CodeBlock';

// ── Shared styles ──────────────────────────────────────────────────────────────

const sectionStyle = { marginBottom: 72 };

const h2Style = {
  fontSize: 22,
  fontWeight: 700,
  color: '#fff',
  marginBottom: 20,
  paddingBottom: 10,
  borderBottom: '1px solid #222',
};

const h3Style = {
  fontSize: 17,
  fontWeight: 700,
  color: '#fff',
  margin: '40px 0 6px',
  paddingBottom: 8,
  borderBottom: '1px solid #1e1e1e',
};

const h4Style = {
  fontSize: 14,
  fontWeight: 700,
  color: '#7df',
  margin: '20px 0 8px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
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
  background: '#111',
  color: '#7df',
  padding: '8px 12px',
  textAlign: 'left',
  borderBottom: '1px solid #2a2a2a',
  fontWeight: 600,
};

const tdStyle = {
  padding: '7px 12px',
  borderBottom: '1px solid #1a1a1a',
  color: '#ccc',
  verticalAlign: 'top',
};

const tdMonoStyle = {
  ...tdStyle,
  fontFamily: 'monospace',
  color: '#fd9',
  fontSize: 12,
};

const tdTypeStyle = {
  ...tdStyle,
  fontFamily: 'monospace',
  color: '#adf',
  fontSize: 12,
};

const calloutStyle = {
  background: '#0e1a0e',
  border: '1px solid #1e3a1e',
  borderRadius: 4,
  padding: '10px 14px',
  fontSize: 13,
  color: '#8db',
  marginBottom: 14,
};

const warnStyle = {
  background: '#1a110a',
  border: '1px solid #3a2010',
  borderRadius: 4,
  padding: '10px 14px',
  fontSize: 13,
  color: '#da8',
  marginBottom: 14,
};

const codeInline = { color: '#fd9', fontFamily: 'monospace' };

// ── Diagrams ───────────────────────────────────────────────────────────────────

const INIT_SEQUENCE = `sequenceDiagram
  participant APP as App (React)
  participant PC as PlotController
  participant DS as DataStore
  participant AX as AxisController x2
  participant VP as ViewportController
  participant RC as ROIController
  participant DECK as deck.gl Deck
  participant AR as AxisRenderer

  APP->>PC: new PlotController(opts)
  PC->>DS: new DataStore() [or use opts.dataStore]
  PC->>AX: new AxisController(x), new AxisController(y)
  PC->>VP: new ViewportController()
  PC->>RC: new ROIController(viewport)
  PC->>PC: registerDataLayer('default-scatter', ...) [unless disableDefaultDataLayer]
  PC->>PC: _wireEvents() — subscribe to all subsystem events

  APP->>PC: init(webglCanvas, axisCanvas)
  PC->>PC: _resize(w, h) — sets axis ranges to pixel bounds
  PC->>DECK: new Deck({ OrthographicView flipY:false, controller:false })
  PC->>AR: new AxisRenderer(axisCanvas, xAxis, yAxis, viewport)
  PC->>RC: roiController.init(webglCanvas)
  PC->>PC: attach wheel / mousedown / mousemove / mouseup listeners
  PC->>PC: attach window resize listener
  PC->>PC: attach keydown listener (spacebar → autoScale)
  PC->>APP: opts.onInit?.(ctrl)
  PC->>PC: _scheduleRender() — starts RAF loop
`;

const TWO_CANVAS_DIAGRAM = `graph LR
  subgraph DOM["DOM Stack"]
    

    WC["WebGL canvas · z-index 0<br/>pointer-events: auto<br/>deck.gl renders here"]
    AC["Axis canvas · z-index 1<br/>pointer-events: none<br/>Canvas 2D ticks + labels"]
    UI["UI overlay divs · z-index 2<br/>React: buttons, dropdowns<br/>pointer-events: auto"]

    
  end
`;

const RENDER_TICK_SEQUENCE = `sequenceDiagram
  participant RAF as requestAnimationFrame
  participant PC as PlotController
  participant VEL as Velocity Pan
  participant DS as DataStore / DataView
  participant REG as DataLayer Registry
  participant ROI as ROIController
  participant DECK as deck.gl Deck
  participant AR as AxisRenderer

  RAF->>PC: _renderLoop()
  PC->>VEL: velocity tick (if follow-pan + cursor moved > 5 px dead zone)
  VEL->>PC: panByPixels, _dirty = true

  alt _dirty === true
    PC->>DS: expireIfNeeded() [rolling mode only]
    PC->>DS: getGPUAttributes() or DataView.getData()
    DS-->>PC: Float32Array buffers (zero-copy or ordered copy)
    PC->>REG: forEach def.build(ctx)
    REG-->>PC: Layer[]
    PC->>ROI: getAllROIs()
    ROI-->>PC: ROI[]
    PC->>PC: new ROILayer({ rois, domain bounds })
    PC->>DECK: setProps({ viewState, layers })
    DECK->>DECK: WebGL draw
    PC->>AR: axisRenderer.render(rois) — Canvas 2D tick repaint
    PC->>PC: _dirty = false
  end
  PC->>RAF: _scheduleRender() — reschedule next frame
`;

const DATA_FLOW_DIAGRAM = `flowchart TD
  A["appendData(chunk)"] --> B["DataStore.appendData(chunk)\\n(grow or ring-write into Float32Array)"]
  B --> C["emit 'dirty'"]
  C --> D{"_dataView\\npresent?"}
  D -->|No| E["_dirty = true (direct store path)"]
  D -->|Yes| F["DataView.markDirty()\\nemit 'dirty'\\n→ _onDataViewDirty()\\n→ _dirty = true"]
  A --> G["_dataTrigger++"]
  A --> H{"_autoExpand?"}
  H -->|Yes| I["_autoExpandDomain(chunk)\\nor _recalcDomainFromStore()"]
  I --> J["emit 'domainChanged'"]
  A --> K["emit 'dataAppended'"]
  E --> L["RAF tick"]
  F --> L
  L --> M{"_dirty?"}
  M -->|Yes| N["getGPUAttributes()\\nor DataView.getData()"]
  N --> O["RenderContext.gpuAttrs"]
  O --> P["buildFn(ctx) → ScatterLayer accessor\\ngetPosition: (_, {index, data}) => [data.x[index], data.y[index], 0]"]
  P --> Q["deck.gl uploads Float32Array\\nto WebGL as instanced attribute\\n— zero per-point JS objects"]
`;

// ── Code snippets ──────────────────────────────────────────────────────────────

const WHEEL_ZOOM_CODE = `// _onWheel — called on every wheel event inside the plot area
_onWheel(e) {
  e.preventDefault();
  const { x: screenX, y: screenY } = this._viewport.getCanvasPosition(e, this._webglCanvas);
  if (!this._viewport.isInPlotArea(screenX, screenY)) return;

  const delta  = e.deltaY || e.detail || -e.wheelDelta;
  const factor = delta > 0 ? 0.85 : 1 / 0.85;  // scroll down = zoom out

  this.setZoom(factor, screenX, screenY);         // calls zoomAround() on both axes
}

// zoomAround(factor, focalData) inside AxisController:
//   newMin = focal - (focal - min) / factor
//   newMax = focal + (max - focal) / factor
`;

const RIGHT_DRAG_CODE = `// _handleRightMove — restore-and-reapply pattern prevents float drift
_handleRightMove(e) {
  const pos     = this._viewport.getCanvasPosition(e, this._webglCanvas);
  const totalDy = pos.y - this._rightDragStart.y;

  // drag up (totalDy < 0) → factor < 1 → zoom in
  const factor = Math.pow(0.992, -totalDy);

  // 1. Restore initial domain (eliminates accumulated float error)
  this._xAxis.setDomain(this._rightDragStart.xDomain);
  this._yAxis.setDomain(this._rightDragStart.yDomain);
  this._updateScales();

  // 2. Re-apply from clean base using focal point at right-click origin
  const focalDataX = this._viewport.screenXToData(this._rightDragStart.x);
  const focalDataY = this._viewport.screenYToData(this._rightDragStart.y);
  this._xAxis.zoomAround(factor, focalDataX);
  this._yAxis.zoomAround(factor, focalDataY);
  this._updateScales();
  this._dirty = true;
}
// Same restore-and-reapply pattern is used for axis drag zoom and drag pan mode.
`;

const AXIS_DRAG_CODE = `// _handleAxisDragMove — F21: axis drag scales domain from its midpoint
_handleAxisDragMove(e) {
  const pos = this._viewport.getCanvasPosition(e, this._webglCanvas);
  const dx  = pos.x - this._axisDragStart.x;
  const dy  = pos.y - this._axisDragStart.y;

  // X: drag left (dx < 0) → zoom in  |  Y: drag down (dy > 0) → zoom in
  const SENSITIVITY = 0.01;
  const delta       = this._axisDragAxis === 'x' ? -dx : dy;
  const zoomFactor  = Math.exp(delta * SENSITIVITY);

  // Restore-and-reapply to prevent float drift
  this._xAxis.setDomain(this._axisDragStart.xDomain);
  this._yAxis.setDomain(this._axisDragStart.yDomain);
  this._updateScales();

  // scaleDomainFromMidpoint(factor): shrinks/expands around the current domain midpoint
  if (this._axisDragAxis === 'x') this._xAxis.scaleDomainFromMidpoint(zoomFactor);
  else                             this._yAxis.scaleDomainFromMidpoint(zoomFactor);
  this._updateScales();
  this._dirty = true;
}
`;

const COORD_CODE = `// Four coordinate spaces:
//
//  1. Data space  — user units (seconds, Hz, metres)
//     Stored in: DataStore Float32Array, ROI.x1/x2/y1/y2, AxisController domain
//
//  2. log10 space — Math.log10(dataValue)
//     Used by _buildViewState() when scaleType === 'log':
//       deckXMin = Math.log10(Math.max(xMin, 1e-10))
//     This lets deck.gl's linear OrthographicView projection match d3's log scale.
//
//  3. Screen-pixel space — CSS pixels, origin top-left of WebGL canvas
//     Used by: mouse events, viewport.isInPlotArea(), axis gutter hit-tests
//
//  4. deck.gl world space — same as data space (identity: no extra transform)
//     deck.gl layer getPosition returns [data.x[i], data.y[i], 0] directly

// Y-axis inversion: d3 y-scale has an INVERTED range so y=0 sits at the visual bottom:
yAxis.setRange([plotBottom_px, plotTop_px]);   // note: bottom > top in CSS pixels

// This makes pxSpan negative for y, so panByPixels() sign flips:
//   dataDelta = -(pixelDelta / pxSpan) * domainSpan
//
//   x axis: pxSpan > 0 →  panByPixels(+n) moves domain right (viewport shifts right)
//   y axis: pxSpan < 0 →  panByPixels(+n) moves domain UP   (double-negation)
//
// Sign table:
//   Follow pan:    xAxis.panByPixels(-dx),  yAxis.panByPixels(-dy)
//   Drag pan:      xAxis.panByPixels(+dx),  yAxis.panByPixels(+dy)
//   (both happen to use the same sign for y — the inversion is baked into panByPixels)
`;

const LAYER_REGISTRY_CODE = `// DataLayerDef shape (JSDoc typedef in PlotController.js):
// { build: (ctx: RenderContext) => Layer | Layer[] | null, props: object }
//
// RenderContext shape:
// { gpuAttrs, dataTrigger, xIsLog, yIsLog, xDomain, yDomain, props }

// Default scatter registration (unless opts.disableDefaultDataLayer === true):
this._dataLayerDefs = new Map();
this.registerDataLayer('default-scatter', (ctx) => {
  if (ctx.gpuAttrs.x.length === 0) return null;
  return buildScatterLayer(ctx.gpuAttrs, {
    dataTrigger: ctx.dataTrigger,
    xIsLog: ctx.xIsLog,
    yIsLog: ctx.yIsLog,
  });
});

// Replacing with a custom SignalStore layer:
const ctrl = new PlotController({ disableDefaultDataLayer: true, xDomain: [0, 60], yDomain: [-3, 3] });
const signals = new SignalStore();
ctrl.registerDataLayer('signals', signals.toLayerDef().build);

// Z-order: layers are added to deck.gl in Map insertion order (earliest = bottom).
// ROILayer is always appended last (topmost).

// Runtime prop update (triggers re-render):
ctrl.updateDataLayerProps('signals', { opacity: 0.8 });
`;

const OWNERSHIP_CODE = `// Two controllers sharing one DataStore — only the first owns it:
const store = new DataStore();
store.enableRolling({ maxPoints: 200_000 });

const plotA = new PlotController({ dataStore: store });   // _ownsDataStore = false
const plotB = new PlotController({ dataStore: store });   // _ownsDataStore = false

// plotA.destroy() does NOT call store.destroy() — store outlives both controllers.
// If you want one controller to own a shared store, pass it only to that controller
// and use setDataView / onInit on the other to wire up a PlotDataView instead.

// Ownership flag table:
//   opts.dataStore provided  →  _ownsDataStore = false  (destroy() skips store cleanup)
//   opts.dataStore omitted   →  _ownsDataStore = true   (destroy() calls store.destroy())
//   opts.dataView provided   →  _ownsDataView  = false
//   opts.dataView omitted    →  _ownsDataView  = true
//   setDataView(view, false) →  _ownsDataView  = false  (runtime swap, external)
//   setDataView(view, true)  →  _ownsDataView  = true   (runtime swap, owned)
`;

// ── Component ──────────────────────────────────────────────────────────────────

export default function PlotControllerDeepDivePage() {
  return (
    <section id="plotcontroller-deep-dive" style={sectionStyle}>
      <h2 style={h2Style}>PlotController Deep-Dive</h2>

      {/* ── 1. What PlotController Is ────────────────────────────────────────── */}
      <h3 style={h3Style}>1. What PlotController Is</h3>
      <p style={pStyle}>
        <code style={codeInline}>PlotController</code> is the central coordinator of the MasterPlot
        engine. It owns every subsystem — deck.gl Deck, two AxisControllers, a ViewportController,
        an ROIController, a DataStore, and the DataLayer Registry — and is the single object
        external code interacts with at runtime. The{' '}
        <a href="docs.html#api-reference" style={{ color: '#7df' }}>API Reference (DOC3)</a> covers
        all public method signatures; this page goes one level deeper and explains the private
        state, internal algorithms, and design patterns that make the engine work.
      </p>
      <p style={pStyle}>
        React is deliberately kept out of all rendering paths. A{' '}
        <code style={codeInline}>PlotCanvas</code> component simply provides two canvas DOM nodes
        and calls <code style={codeInline}>ctrl.init(webglCanvas, axisCanvas)</code> once. After
        that, React is only involved when the user changes a UI control that calls a public
        setter such as <code style={codeInline}>setAutoExpand()</code> or{' '}
        <code style={codeInline}>setPanMode()</code>. All rendering, zoom, pan, and ROI interaction
        are driven by PlotController's own RAF loop and event listeners.
      </p>

      {/* ── 2. Initialization Pipeline ────────────────────────────────────────── */}
      <h3 style={h3Style}>2. Initialization Pipeline</h3>
      <p style={pStyle}>
        Construction and initialization are split into two phases. The <strong>constructor</strong>{' '}
        allocates all subsystems and calls <code style={codeInline}>_wireEvents()</code> so that
        sub-controller events are already routed before a canvas exists. The{' '}
        <code style={codeInline}>init(webglCanvas, axisCanvas)</code> method is called once the
        canvases are in the DOM; it creates the deck.gl <code style={codeInline}>Deck</code>{' '}
        instance, the <code style={codeInline}>AxisRenderer</code>, attaches interaction listeners,
        and starts the RAF loop.
      </p>
      <MermaidDiagram chart={INIT_SEQUENCE} />
      <div style={calloutStyle}>
        <strong>Why <code>flipY: false</code>?</strong> — deck.gl's default{' '}
        <code>OrthographicView</code> flips the Y axis so the screen origin is at the bottom.
        MasterPlot instead keeps the screen origin at the top-left (matching CSS pixel conventions)
        and handles the inversion explicitly via an inverted d3 y-scale range. This lets
        ROI coordinates, mouse hit-tests, and axis pixel math all live in the same CSS-pixel
        space without any per-coordinate sign correction.
      </div>
      <div style={calloutStyle}>
        <strong>Why does <code>_wireEvents()</code> run in the constructor (not in <code>init</code>)?</strong>{' '}
        — The DataStore and AxisControllers exist from construction time. If a caller calls{' '}
        <code>appendData()</code> or <code>xAxis.setDomain()</code> before <code>init()</code>{' '}
        (e.g. to seed data before mounting), the events still flow correctly and{' '}
        <code>_dirty</code> is set — the first RAF tick after <code>init()</code> will pick
        them up.
      </div>
      <div style={calloutStyle}>
        <strong>What is safe to call inside <code>opts.onInit</code>?</strong> — Everything.
        The callback fires after the Deck instance is created, the ROIController is wired to
        the canvas, and the RAF loop has been scheduled. Callers commonly use it to seed ROIs
        via <code>roiController.addROI()</code> or register additional data layers.
      </div>

      {/* ── 3. The Two-Canvas Model ───────────────────────────────────────────── */}
      <h3 style={h3Style}>3. The Two-Canvas Model</h3>
      <p style={pStyle}>
        Every plot uses two overlapping canvas elements. The WebGL canvas is at z-index 0 and
        receives all pointer events — it is the surface deck.gl renders into. The axis canvas
        sits on top at z-index 1 with{' '}
        <code style={codeInline}>pointer-events: none</code> so that mouse events pass through
        to the WebGL canvas. React UI elements (buttons, dropdowns) live in ordinary divs
        at z-index 2 and intercept their own events normally.
      </p>
      <MermaidDiagram chart={TWO_CANVAS_DIAGRAM} />
      <p style={pStyle}>
        The axis canvas is repainted on every render tick by{' '}
        <code style={codeInline}>AxisRenderer.render(rois)</code>. It draws x/y tick marks,
        labels, grid lines, and — for LineROI half-variants — canvas-2D text labels. Because
        it is a separate canvas it can be made transparent, so only the axis decoration
        is visible and the WebGL content shows through underneath.
      </p>
      <div style={calloutStyle}>
        <strong>Why not use SVG for axes?</strong> — SVG DOM updates are synchronous and
        trigger layout. At 60 fps with a large number of ticks and live-streaming data, Canvas
        2D is significantly faster and keeps latency flat. It also makes export compositing
        straightforward: two canvas elements can be drawn into an offscreen canvas via{' '}
        <code>drawImage</code> without any SVG serialization step.
      </div>

      {/* ── 4. The Render Loop ────────────────────────────────────────────────── */}
      <h3 style={h3Style}>4. The Render Loop</h3>
      <p style={pStyle}>
        A dirty-flag pattern gates all rendering. Anything that changes visible output sets{' '}
        <code style={codeInline}>_dirty = true</code>; the RAF callback only calls{' '}
        <code style={codeInline}>_render()</code> when the flag is set, then clears it.
        This means idle plots consume effectively zero CPU.
      </p>

      <h4 style={h4Style}>What sets _dirty = true</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Trigger</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['appendData()', 'Always'],
            ['DataStore "dirty" event', 'When no DataView is active (direct store path)'],
            ['DataView "dirty" event', 'DataStore append / expiry / roiFinalized / roiExternalUpdate'],
            ['AxisController "domainChanged"', 'setDomain(), zoomAround(), panByPixels(), scaleDomainFromMidpoint()'],
            ['ROIController "roisChanged"', 'Any ROI create / update / delete / external update'],
            ['Wheel zoom', '_onWheel → setZoom()'],
            ['Right-click drag zoom', '_handleRightMove()'],
            ['Axis drag zoom (F21)', '_handleAxisDragMove()'],
            ['Drag pan', '_onMouseMove() in drag mode'],
            ['Velocity pan tick', 'RAF frame while panning in follow mode, cursor > 5 px dead zone'],
            ['registerDataLayer / unregisterDataLayer', 'Layer registry change'],
            ['updateDataLayerProps()', 'Static prop update on a registered layer'],
            ['markDirty()', 'External call — e.g. after TraceGroup visibility change'],
            ['_onResize()', 'window "resize" event'],
            ['autoScale()', 'Spacebar press or explicit call'],
            ['setDataView()', 'DataView swap'],
            ['deck.gl onWebGLInitialized', 'One-time: GPU context ready after init()'],
          ].map(([src, when]) => (
            <tr key={src}>
              <td style={tdMonoStyle}>{src}</td>
              <td style={tdStyle}>{when}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <MermaidDiagram chart={RENDER_TICK_SEQUENCE} />

      {/* ── 5. The Layer Registry (ARCH-A) ────────────────────────────────────── */}
      <h3 style={h3Style}>5. The Layer Registry (ARCH-A)</h3>
      <p style={pStyle}>
        PlotController is type-agnostic about what data it renders. Instead of hardcoding a
        scatter layer it maintains a{' '}
        <code style={codeInline}>Map&lt;string, DataLayerDef&gt;</code> whose entries are
        iterated in insertion order during each <code style={codeInline}>_render()</code> call.
        Insertion order determines deck.gl z-order: earlier entries render below later ones.
        ROILayer is always appended after all registered data layers, so ROI handles are
        always topmost.
      </p>
      <CodeBlock code={LAYER_REGISTRY_CODE} language="javascript" />
      <div style={calloutStyle}>
        <strong>Default layer:</strong> unless <code>opts.disableDefaultDataLayer</code> is{' '}
        <code>true</code>, the constructor registers a <code>'default-scatter'</code> layer
        backed by <code>buildScatterLayer()</code>. To use a line or trace-group layer instead,
        pass <code>disableDefaultDataLayer: true</code> and register your own factory.
      </div>

      {/* ── 6. Zoom & Pan — Three Interaction Modes ─────────────────────────────── */}
      <h3 style={h3Style}>6. Zoom &amp; Pan — Three Interaction Modes</h3>

      <h4 style={h4Style}>Wheel Zoom</h4>
      <p style={pStyle}>
        Each scroll event applies a discrete factor of <code style={codeInline}>0.85</code>{' '}
        (zoom out) or <code style={codeInline}>1/0.85 ≈ 1.176</code> (zoom in) centered on
        the cursor position. The cursor is converted from screen pixels to data space via{' '}
        <code style={codeInline}>ViewportController.screenXToData()</code> and then passed to{' '}
        <code style={codeInline}>AxisController.zoomAround(factor, focalData)</code>, which
        expands or contracts the domain while keeping the focal data point fixed.
      </p>
      <CodeBlock code={WHEEL_ZOOM_CODE} language="javascript" />

      <h4 style={h4Style}>Right-Click Drag Zoom</h4>
      <p style={pStyle}>
        Right-click drag applies a continuous zoom factor of{' '}
        <code style={codeInline}>0.992^(−totalDy)</code> centered on the right-click origin.
        Because this handler fires on every <code>mousemove</code> event, naively accumulating
        the zoom would cause floating-point drift over hundreds of events. The{' '}
        <strong>restore-and-reapply pattern</strong> solves this: at the start of each move,
        the domain is reset to the snapshot taken at mousedown, then the full accumulated
        factor is reapplied from scratch.
      </p>
      <CodeBlock code={RIGHT_DRAG_CODE} language="javascript" />

      <h4 style={h4Style}>Axis Drag Zoom (F21)</h4>
      <p style={pStyle}>
        Dragging inside the x-axis or y-axis gutter area (detected by{' '}
        <code style={codeInline}>AxisRenderer.getAxisHit()</code>) scales the corresponding
        axis domain from its current midpoint. The factor is{' '}
        <code style={codeInline}>exp(delta × 0.01)</code> where delta is the signed pixel
        displacement (left for x zoom-in, down for y zoom-in). Restore-and-reapply is used
        here too.
      </p>
      <CodeBlock code={AXIS_DRAG_CODE} language="javascript" />

      <h4 style={h4Style}>Pan Modes</h4>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Mode</th>
            <th style={thStyle}>Mechanism</th>
            <th style={thStyle}>Restore-and-reapply?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>'follow'</td>
            <td style={tdStyle}>
              RAF velocity tick: each frame, cursor displacement from mousedown origin is
              multiplied by <code style={codeInline}>_followPanSpeed</code> (default 0.02)
              and applied via <code style={codeInline}>panByPixels()</code>. 5 px dead zone.
            </td>
            <td style={tdStyle}>No — incremental each frame</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>'drag'</td>
            <td style={tdStyle}>
              Each mousemove restores the mousedown domain snapshot then applies the full
              pixel displacement so data moves exactly 1:1 with the cursor.
            </td>
            <td style={tdStyle}>Yes — prevents float drift</td>
          </tr>
        </tbody>
      </table>

      {/* ── 7. Coordinate Systems & Y-Axis Convention ────────────────────────── */}
      <h3 style={h3Style}>7. Coordinate Systems &amp; Y-Axis Convention</h3>
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
            <td style={tdStyle}>User units (s, Hz, m …)</td>
            <td style={tdStyle}>Depends on domain</td>
            <td style={tdStyle}>DataStore arrays, ROI bounds, AxisController domain</td>
          </tr>
          <tr>
            <td style={tdStyle}>log10 space</td>
            <td style={tdStyle}>log₁₀(data value)</td>
            <td style={tdStyle}>—</td>
            <td style={tdStyle}>
              <code style={codeInline}>_buildViewState()</code> when{' '}
              <code style={codeInline}>scaleType === 'log'</code>; transparent to callers
            </td>
          </tr>
          <tr>
            <td style={tdStyle}>Screen-pixel space</td>
            <td style={tdStyle}>CSS pixels</td>
            <td style={tdStyle}>Top-left of WebGL canvas</td>
            <td style={tdStyle}>Mouse events, <code style={codeInline}>isInPlotArea()</code>, axis gutter hit-tests</td>
          </tr>
          <tr>
            <td style={tdStyle}>deck.gl world space</td>
            <td style={tdStyle}>Data units (identity)</td>
            <td style={tdStyle}>Same as data space</td>
            <td style={tdStyle}>
              <code style={codeInline}>OrthographicView</code> viewState target/zoom,
              layer <code style={codeInline}>getPosition</code>
            </td>
          </tr>
        </tbody>
      </table>
      <CodeBlock code={COORD_CODE} language="javascript" />
      <div style={warnStyle}>
        <strong>Log axis implementation note:</strong> when an axis is logarithmic, both the
        d3 scale and the deck.gl viewState work in log10 space. The data in the DataStore is
        stored in raw data space (e.g. 1–10000 for frequency). The layer's{' '}
        <code style={codeInline}>getPosition</code> accessor applies{' '}
        <code style={codeInline}>Math.log10(x)</code> on the fly when{' '}
        <code style={codeInline}>ctx.xIsLog === true</code>, so the GPU receives log-space
        coordinates that align with the log-space viewState projection.
      </div>

      {/* ── 8. Data Flow — appendData to GPU ─────────────────────────────────── */}
      <h3 style={h3Style}>8. Data Flow — appendData to GPU</h3>
      <p style={pStyle}>
        Data enters the engine via <code style={codeInline}>PlotController.appendData(chunk)</code>,
        which delegates to <code style={codeInline}>DataStore</code> immediately. No JavaScript
        objects are created per point at any step in this pipeline — only typed array writes.
      </p>
      <MermaidDiagram chart={DATA_FLOW_DIAGRAM} />
      <div style={calloutStyle}>
        <strong>DataView dirty-propagation rules:</strong> a PlotDataView marks itself dirty
        on <code>DataStore 'dirty'</code>, <code>DataStore 'dataExpired'</code>,{' '}
        <code>roiFinalized</code>, and <code>roiExternalUpdate</code>. It does{' '}
        <strong>not</strong> mark dirty on <code>roiUpdated</code> (mid-drag events) — this
        prevents expensive filter recomputation during every mousemove pixel while the user
        is dragging an ROI handle.
      </div>

      {/* ── 9. Ownership Model (F17) ──────────────────────────────────────────── */}
      <h3 style={h3Style}>9. Ownership Model (F17)</h3>
      <p style={pStyle}>
        PlotController can accept an externally created DataStore or DataView at construction
        time (or via <code style={codeInline}>setDataView()</code>). Ownership flags determine
        what <code style={codeInline}>destroy()</code> is responsible for cleaning up.
      </p>
      <CodeBlock code={OWNERSHIP_CODE} language="javascript" />
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Flag</th>
            <th style={thStyle}>true (owned)</th>
            <th style={thStyle}>false (external)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdMonoStyle}>_ownsDataStore</td>
            <td style={tdStyle}><code style={codeInline}>destroy()</code> calls <code style={codeInline}>dataStore.destroy()</code></td>
            <td style={tdStyle}><code style={codeInline}>destroy()</code> skips — caller is responsible</td>
          </tr>
          <tr>
            <td style={tdMonoStyle}>_ownsDataView</td>
            <td style={tdStyle}><code style={codeInline}>destroy()</code> calls <code style={codeInline}>dataView.destroy()</code></td>
            <td style={tdStyle}><code style={codeInline}>destroy()</code> skips — caller is responsible</td>
          </tr>
        </tbody>
      </table>

      {/* ── 10. Events Emitted & Re-Emitted ──────────────────────────────────── */}
      <h3 style={h3Style}>10. Events Emitted &amp; Re-Emitted</h3>
      <p style={pStyle}>
        PlotController re-emits curated events from its subsystems so callers never need to
        subscribe to sub-controllers directly. The table below covers every event a caller
        of <code style={codeInline}>ctrl.on()</code> can receive.
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Event</th>
            <th style={thStyle}>Source</th>
            <th style={thStyle}>Payload</th>
            <th style={thStyle}>When fired</th>
          </tr>
        </thead>
        <tbody>
          {[
            ['dataAppended',      'Own',                      '{ count, total }',                     'After each appendData() call'],
            ['domainChanged',     'Re-emit from xAxis',       '{ domain, xDomain }',                  'When x-axis domain changes (zoom, pan, auto-expand)'],
            ['zoomChanged',       'Own',                      '{ factor, focalDataX?, focalDataY?, axis? }', 'After wheel zoom, right-click drag zoom, axis drag zoom'],
            ['panChanged',        'Own',                      '{ dx, dy }',                           'Each drag-pan mousemove or velocity-pan RAF frame (> 5 px dead zone)'],
            ['autoScaled',        'Own',                      '{ xDomain, yDomain }',                 'After autoScale() / spacebar press'],
            ['roiCreated',        'Re-emit from ROIController', '{ roi }',                            'New ROI finalized after creation click sequence'],
            ['roiUpdated',        'Re-emit from ROIController', '{ roi }',                            'ROI moved/resized during drag (high frequency)'],
            ['roiFinalized',      'Re-emit from ROIController', '{ roi }',                            'ROI drag committed on mouseup — bumpVersion() called'],
            ['roiDeleted',        'Re-emit from ROIController', '{ roi }',                            'ROI removed (D key or programmatic delete)'],
            ['roiExternalUpdate', 'Re-emit from ROIController', '{ roi }',                            'updateFromExternal() accepted an incoming version'],
            ['dataExpired',       'Re-emit from DataStore',   '{ evictedCount }',                     'Rolling ring buffer evicted old points'],
          ].map(([ev, src, payload, when]) => (
            <tr key={ev}>
              <td style={tdMonoStyle}>{ev}</td>
              <td style={tdTypeStyle}>{src}</td>
              <td style={tdMonoStyle}>{payload}</td>
              <td style={tdStyle}>{when}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={calloutStyle}>
        <strong>Not re-emitted:</strong> <code style={codeInline}>roisChanged</code> (only
        sets <code>_dirty</code>), DataStore <code>'dirty'</code> (internal), DataView{' '}
        <code>'dirty'</code> and <code>'recomputed'</code> (internal). Callers that need
        granular ROI-change notifications should subscribe to <code>roiFinalized</code> rather
        than <code>roiUpdated</code> to avoid handler spam during drag.
      </div>
    </section>
  );
}
